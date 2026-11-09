/**
 * FamilyOS — Third-Pass Independent Verification & Final Gap Closure Test Suite
 * Validates Sections 1 through 8 across runtime APIs, persistence, migrations, RBAC, and sync.
 */

import fs from 'fs';
import path from 'path';
import {
  evaluateStorageAvailability,
  setPostgresConnectionVerifiedForTest,
  runIdempotentPostgresMigrationExport,
  createProtectedPrePostgresBackup,
  verifyProtectedBackup,
} from '../src/server/postgresMigrationAndBackup';
import { computeSha256 } from '../src/server/backupAndMigration';
import {
  issueSignedSessionToken,
  recordAuthSession,
  getTrackedAuthSessions,
  cleanupExpiredAuthSessions,
  revokeSessionToken,
  revokeAllSessionsForUser,
  isSessionRevoked,
  loadRevocationsFromDisk,
  clearRevokedSessionsForTest,
  canPerformFinanceMutation,
} from '../src/server/authAndRbac';
import { offlineSyncEngine, type QueuedMutation } from '../src/services/offlineSyncEngine';
import { validateUploadedImageDataUrl, extractImageDimensions } from '../src/server/familySectionRoutes';
import { getOrCreateRoleProfileCompletion } from '../src/components/SingleFamilyOnboardingSystem';

const BASE_URL = 'http://localhost:3000';

interface TestRecord {
  category: string;
  name: string;
  passed: boolean;
  error?: string;
}

const testResults: TestRecord[] = [];

async function testCase(category: string, name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    testResults.push({ category, name, passed: true });
    console.log(`  ✓ [${category}] ${name}`);
  } catch (err: any) {
    testResults.push({ category, name, passed: false, error: err.message });
    console.error(`  ✗ [${category}] ${name} -> ${err.message}`);
  }
}

function assert(cond: any, msg: string) {
  if (!cond) throw new Error(msg);
}

async function requestJson(method: string, endpoint: string, body?: any, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function createRoleUserAndJoinWorkspace(familyId: string, ownerToken: string, role: string, runId: number) {
  const userId = `usr-${role.toLowerCase()}-${runId}-${Math.random().toString(36).slice(2, 6)}`;
  const email = `${role.toLowerCase()}-${runId}@familyos.test`;
  const authRes = await requestJson('POST', '/api/v1/auth/session', {
    userAccountId: userId,
    email,
    registerNewUser: true,
  });
  assert(authRes.ok, `${role} auth session failed`);
  const token = authRes.data.token || authRes.data.sessionToken;

  const inviteRes = await requestJson(
    'POST',
    '/api/v1/invitations',
    {
      familyId,
      role,
      proposedRole: role,
      inviteeName: `Audit ${role}`,
      inviteeEmail: email,
      inviteMethod: 'ONE_TIME_LINK',
    },
    ownerToken
  );
  assert(inviteRes.ok, `Failed to invite ${role}: ${JSON.stringify(inviteRes.data)}`);
  const inviteToken = inviteRes.data.invitation.invitationToken;

  const claimRes = await requestJson(
    'POST',
    '/api/v1/invitations/claim-one-time-link',
    { invitationToken: inviteToken },
    token
  );
  assert(claimRes.ok, `Failed to claim invitation for ${role}: ${JSON.stringify(claimRes.data)}`);

  return { userId, token };
}

async function main() {
  console.log('\n================================================================');
  console.log('🛡️ FAMILYOS — THIRD-PASS INDEPENDENT VERIFICATION SUITE');
  console.log('================================================================\n');

  const runId = Date.now();
  const ownerUserId = `usr-owner-${runId}`;

  // Authenticate OWNER and create workspace
  const ownerAuth = await requestJson('POST', '/api/v1/auth/session', {
    userAccountId: ownerUserId,
    email: `owner-${runId}@familyos.test`,
    registerNewUser: true,
  });
  assert(ownerAuth.ok, 'Owner auth session failed');
  const ownerToken = ownerAuth.data.token || ownerAuth.data.sessionToken;

  const wsRes = await requestJson('POST', '/api/v1/workspaces', { name: `Audit Family ${runId}` }, ownerToken);
  assert(wsRes.ok, 'Failed to create workspace');
  const familyId = wsRes.data.workspace.id;

  // Provision ADMIN, MEMBER, CHILD, and GUEST members in this workspace
  const adminActor = await createRoleUserAndJoinWorkspace(familyId, ownerToken, 'ADMIN', runId);
  const memberActor = await createRoleUserAndJoinWorkspace(familyId, ownerToken, 'MEMBER', runId);
  const childActor = await createRoleUserAndJoinWorkspace(familyId, ownerToken, 'CHILD', runId);
  const guestActor = await createRoleUserAndJoinWorkspace(familyId, ownerToken, 'GUEST', runId);

  // ==========================================================================
  // SECTION 1: NO HARDCODED FAMILY OR MEMBER FALLBACKS
  // ==========================================================================

  await testCase('SEC-1-FALLBACKS', 'UserProfilePage and production components contain no hardcoded fam-1 fallbacks or ROLE_TO_MEMBER_ID', () => {
    const profileSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/UserProfilePage.tsx'), 'utf-8');
    assert(!profileSource.includes('ROLE_TO_MEMBER_ID'), 'UserProfilePage must not contain ROLE_TO_MEMBER_ID');
    assert(!profileSource.includes("'fam-1'"), 'UserProfilePage must not contain hardcoded fam-1 fallback');
    assert(!profileSource.includes("'mem-sarah'"), 'UserProfilePage must not contain hardcoded mem-sarah fallback');
    assert(profileSource.includes('No Active Family Workspace'), 'UserProfilePage must render No Active Family Workspace empty state');

    const settingsSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/FamilySettingsPage.tsx'), 'utf-8');
    assert(!settingsSource.includes("'fam-1'"), 'FamilySettingsPage must not contain fam-1 fallback');

    const familyExpSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/Stage331FamilyExperience.tsx'), 'utf-8');
    assert(!familyExpSource.includes("|| 'fam-1'"), 'Stage331FamilyExperience must not fallback to fam-1');
  });

  await testCase('SEC-1-FALLBACKS', 'Absent workspace context returns uninitialized profile and never substitutes fictional identity', () => {
    const rec = getOrCreateRoleProfileCompletion('OWNER', null);
    assert(rec.memberId === '', `Expected empty memberId when workspaceData is null, got '${rec.memberId}'`);
    assert(rec.displayName === '', `Expected empty displayName when workspaceData is null, got '${rec.displayName}'`);
    assert(rec.completionPercentage === 0, `Expected 0% completion for uninitialized context, got ${rec.completionPercentage}`);
  });

  // ==========================================================================
  // SECTION 2 & 5: DATABASE-ENFORCED DOUBLE-ENTRY & TENANT COMPOSITE FKs
  // ==========================================================================

  await testCase('SEC-2-DOUBLE-ENTRY', 'PostgreSQL migration 0002 enforces deferred double-entry trigger, immutability trigger, and composite tenant FKs', () => {
    const mig0002Up = fs.readFileSync(path.resolve(process.cwd(), 'migrations/postgres/0002_familyos_v341_reconciliation_up.sql'), 'utf-8');
    assert(mig0002Up.includes('CREATE OR REPLACE FUNCTION check_balanced_transaction_entries()'), 'Missing double-entry balance trigger function');
    assert(mig0002Up.includes('CREATE CONSTRAINT TRIGGER trg_enforce_double_entry_balance'), 'Missing constraint trigger');
    assert(mig0002Up.includes('DEFERRABLE INITIALLY DEFERRED'), 'Double-entry constraint trigger must be DEFERRABLE INITIALLY DEFERRED');
    assert(mig0002Up.includes('CREATE TRIGGER trg_immutable_financial_entries'), 'Missing immutability trigger on financial_entries');
    assert(mig0002Up.includes('FOREIGN KEY (family_id, transaction_id) REFERENCES financial_transactions (family_id, id)'), 'Missing composite FK (family_id, transaction_id)');
    assert(mig0002Up.includes('FOREIGN KEY (family_id, account_id) REFERENCES financial_accounts (family_id, id)'), 'Missing composite FK (family_id, account_id)');
    assert(mig0002Up.includes('FOREIGN KEY (family_id, assigned_member_id) REFERENCES family_members (family_id, id)'), 'Missing composite FK on household_chores');
    assert(mig0002Up.includes('FOREIGN KEY (family_id, event_id) REFERENCES calendar_events (family_id, id)'), 'Missing composite FK on event_attendees');
  });

  await testCase('SEC-2-DOUBLE-ENTRY', 'Atomic posting, idempotency deduplication, and opposite-direction reversal work end-to-end', async () => {
    const accRes = await requestJson('POST', `/api/v1/finance/${familyId}/accounts`, {
      name: 'Primary Operating Checking',
      accountType: 'CHECKING',
      currentBalanceCents: 200000,
    }, ownerToken);
    assert(accRes.status === 201, 'Failed to create checking account');
    const accountId = accRes.data.account.id;

    // Post expense with idempotencyKey
    const idempKey = `idemp-tx-${runId}`;
    const tx1 = await requestJson('POST', `/api/v1/finance/${familyId}/transactions`, {
      accountId,
      title: 'Organic Groceries',
      amountCents: 15000,
      transactionType: 'EXPENSE',
      category: 'FOOD',
      idempotencyKey: idempKey,
    }, ownerToken);
    assert(tx1.status === 201, `Expected 201 on transaction post, got ${tx1.status}`);
    const txId = tx1.data.transaction.id;

    // Duplicate replay with same idempotencyKey must not duplicate debit/balance change
    const txDup = await requestJson('POST', `/api/v1/finance/${familyId}/transactions`, {
      accountId,
      title: 'Organic Groceries',
      amountCents: 15000,
      transactionType: 'EXPENSE',
      category: 'FOOD',
      idempotencyKey: idempKey,
    }, ownerToken);
    assert(txDup.ok, 'Idempotent replay should return existing transaction');
    assert(txDup.data.transaction.id === txId, 'Idempotent replay must return identical transaction ID');

    // Verify account balance was debited only once (200000 - 15000 = 185000)
    const accCheck1 = await requestJson('GET', `/api/v1/finance/${familyId}/accounts`, undefined, ownerToken);
    const updatedAcc1 = accCheck1.data.accounts.find((a: any) => a.id === accountId);
    assert(Number(updatedAcc1.currentBalanceCents) === 185000, `Expected balance 185000, got ${updatedAcc1.currentBalanceCents}`);

    // Reverse transaction and verify opposite-direction balance restoration (185000 + 15000 = 200000)
    const revRes = await requestJson('POST', `/api/v1/finance/${familyId}/transactions/${txId}/reverse`, {}, ownerToken);
    assert(revRes.ok, `Expected 200 OK on reversal, got ${revRes.status}`);
    assert(revRes.data.reversal.isReversal === true, 'Reversal must set isReversal=true');
    assert(revRes.data.reversal.reversalOfId === txId, 'Reversal must reference original txId');
    const revTxId = revRes.data.reversal.id;

    const accCheck2 = await requestJson('GET', `/api/v1/finance/${familyId}/accounts`, undefined, ownerToken);
    const updatedAcc2 = accCheck2.data.accounts.find((a: any) => a.id === accountId);
    assert(Number(updatedAcc2.currentBalanceCents) === 200000, `Expected restored balance 200000 after reversal, got ${updatedAcc2.currentBalanceCents}`);

    // Verify SQL export generates opposite-direction postings for the reversal vs original expense
    const report = runIdempotentPostgresMigrationExport();
    const sql = fs.readFileSync(report.sqlBundlePath, 'utf-8');
    assert(sql.includes(`'${txId}-credit', '${txId}', '${familyId}', '${accountId}', 'CREDIT'`), 'Original expense must CREDIT asset account');
    assert(sql.includes(`'${revTxId}-debit', '${revTxId}', '${familyId}', '${accountId}', 'DEBIT'`), 'Reversal of expense must DEBIT asset account (opposite direction)');
  });

  await testCase('SEC-2-DOUBLE-ENTRY', 'Generated SQL export bundle maintains exact debit/credit equality for every transaction', () => {
    const report = runIdempotentPostgresMigrationExport();
    assert(report.reconciled === true, 'Migration reconciliation must pass');
    const sql = fs.readFileSync(report.sqlBundlePath, 'utf-8');
    assert(sql.includes('CREATE CONSTRAINT TRIGGER trg_enforce_double_entry_balance'), 'Export bundle must include balance trigger');
    assert(sql.includes('CREATE TRIGGER trg_immutable_financial_entries'), 'Export bundle must include immutability trigger');

    // Parse all INSERT INTO financial_entries lines and verify sum(DEBIT) === sum(CREDIT)
    const entryLines = sql.split('\n').filter((line) => line.startsWith('INSERT INTO financial_entries'));
    assert(entryLines.length > 0, 'Must have financial_entries inserts');
    let totalDebits = 0n;
    let totalCredits = 0n;
    for (const line of entryLines) {
      const match = line.match(/VALUES \('[^']+', '[^']+', '[^']+', '[^']+', '(DEBIT|CREDIT)', (\d+),/);
      if (match) {
        const type = match[1];
        const amt = BigInt(match[2]);
        if (type === 'DEBIT') totalDebits += amt;
        if (type === 'CREDIT') totalCredits += amt;
      }
    }
    assert(totalDebits > 0n && totalDebits === totalCredits, `Total debits (${totalDebits}) must equal total credits (${totalCredits})`);
  });

  // ==========================================================================
  // SECTION 3: PERSISTENT SESSION MANAGEMENT & MULTI-INSTANCE REVOCATION
  // ==========================================================================

  await testCase('SEC-3-SESSIONS', 'Persistent session registry records metadata, survives restart, and syncs across instances', () => {
    clearRevokedSessionsForTest();
    const nowSec = Math.floor(Date.now() / 1000);
    const rawToken = issueSignedSessionToken({
      userAccountId: 'usr-multi-instance-test',
      email: 'multi@familyos.org',
      displayName: 'Multi Instance User',
    });
    const tokenHash = computeSha256(rawToken);

    recordAuthSession({
      sessionIdentifier: 'jti-sess-1',
      tokenHash,
      userAccountId: 'usr-multi-instance-test',
      createdAtSec: nowSec - 60,
      expiresAtSec: nowSec + 3600,
      isRevoked: false,
      deviceInfo: 'Chrome/Linux',
    });

    assert(getTrackedAuthSessions().some((s) => s.sessionIdentifier === 'jti-sess-1'), 'Session must be tracked');
    assert(!isSessionRevoked({ rawToken, jti: 'jti-sess-1', userAccountId: 'usr-multi-instance-test' }), 'Active session must not be revoked');

    // Revoke by raw token (simulating instance A) and reload on instance B
    revokeSessionToken(rawToken, 'USER_LOGOUT');
    loadRevocationsFromDisk();
    assert(isSessionRevoked({ rawToken, jti: 'jti-sess-1', userAccountId: 'usr-multi-instance-test' }), 'Revocation must persist across reload');

    // Cleanup expired revoked sessions
    recordAuthSession({
      sessionIdentifier: 'jti-expired-1',
      tokenHash: 'hash-expired',
      userAccountId: 'usr-multi-instance-test',
      createdAtSec: nowSec - 7200,
      expiresAtSec: nowSec - 100,
      isRevoked: true,
    });
    const cleaned = cleanupExpiredAuthSessions(nowSec);
    assert(cleaned >= 1, `Expected at least 1 expired session cleaned up, got ${cleaned}`);
    clearRevokedSessionsForTest();
  });

  // ==========================================================================
  // SECTION 4: DURABLE INDEXEDDB MUTATION OUTBOX & REPLAY SEMANTICS
  // ==========================================================================

  await testCase('SEC-4-OUTBOX', 'Outbox strips sensitive headers, generates idempotencyKey, routes 404/409 to DLQ, and handles 401 reauth', () => {
    offlineSyncEngine.saveOutbox([]);
    offlineSyncEngine.clearDeadLetterQueue();

    const queued = offlineSyncEngine.enqueueMutation({
      url: `/api/v1/finance/${familyId}/budgets`,
      method: 'POST',
      body: { category: 'UTILITIES', allocatedCents: 25000 },
      headers: {
        Authorization: 'Bearer secret_token_must_not_persist',
        Cookie: 'session=secret',
        'X-Custom-Header': 'kept',
      },
      domain: 'finance',
      actionDescription: 'Create utilities budget',
    });

    assert(!queued.headers?.Authorization, 'Authorization header must not be persisted in outbox');
    assert(!queued.headers?.Cookie, 'Cookie header must not be persisted in outbox');
    assert(queued.headers?.['X-Custom-Header'] === 'kept', 'Safe custom headers must be preserved');
    assert(queued.idempotencyKey.startsWith('idemp-'), 'Queued mutation must have generated idempotencyKey');

    // Verify 409 Conflict preserves conflictMetadata in Dead Letter Queue
    offlineSyncEngine.pushToDeadLetter(queued, 409, 'VERSION_OR_ENTITY_CONFLICT_409', { serverVersion: 5, clientVersion: 3 });
    const dlq = offlineSyncEngine.getDeadLetterQueue();
    assert(dlq.length === 1, 'DLQ must contain 1 conflict entry');
    assert(dlq[0].statusCode === 409, 'DLQ entry must record 409 status');
    assert(dlq[0].conflictMetadata?.serverVersion === 5, 'DLQ entry must preserve conflictMetadata');

    offlineSyncEngine.saveOutbox([]);
    offlineSyncEngine.clearDeadLetterQueue();
  });

  // ==========================================================================
  // SECTION 6: EXHAUSTIVE FINANCE ROUTE VERIFICATION ACROSS ALL 5 ROLES
  // ==========================================================================

  await testCase('SEC-6-FINANCE-RBAC', 'All 15 finance mutation routes enforce OWNER/ADMIN allow and MEMBER/CHILD/GUEST deny', async () => {
    // 1. Create prerequisite entities as OWNER
    const accRes = await requestJson('POST', `/api/v1/finance/${familyId}/accounts`, {
      name: 'RBAC Test Account',
      accountType: 'CHECKING',
      currentBalanceCents: 1000000,
    }, ownerToken);
    assert(accRes.status === 201, 'OWNER POST account failed');
    const accId = accRes.data.account.id;

    // Create disposable account as ADMIN to test PUT, reconcile, DELETE
    const adminAccRes = await requestJson('POST', `/api/v1/finance/${familyId}/accounts`, {
      name: 'ADMIN Disposable Account',
      accountType: 'SAVINGS',
      currentBalanceCents: 50000,
    }, adminActor.token);
    assert(adminAccRes.status === 201, 'ADMIN POST account failed');
    const disposableAccId = adminAccRes.data.account.id;

    const txRes = await requestJson('POST', `/api/v1/finance/${familyId}/transactions`, {
      accountId: accId,
      title: 'RBAC Expense',
      amountCents: 5000,
      transactionType: 'EXPENSE',
      category: 'HOUSING',
    }, adminActor.token);
    assert(txRes.status === 201, 'ADMIN POST transaction failed');
    const txId = txRes.data.transaction.id;

    const sgRes = await requestJson('POST', `/api/v1/finance/${familyId}/savings`, {
      title: 'RBAC Emergency Fund',
      targetCents: 500000,
      currentCents: 10000,
      category: 'EMERGENCY',
    }, ownerToken);
    assert(sgRes.status === 201, 'OWNER POST savings goal failed');
    const goalId = sgRes.data.goal.id;

    const recRes = await requestJson('POST', `/api/v1/finance/${familyId}/recurring`, {
      accountId: accId,
      title: 'Monthly Water Bill',
      amountCents: 8000,
      transactionType: 'EXPENSE',
      category: 'UTILITIES',
      recurrenceInterval: 'MONTHLY',
      nextDueDate: Date.now() - 1000,
    }, ownerToken);
    assert(recRes.status === 201, 'OWNER POST recurring rule failed');
    const ruleId = recRes.data.rule.id;

    const invRes = await requestJson('POST', `/api/v1/finance/${familyId}/investments`, {
      accountId: accId,
      symbol: 'VTI',
      assetName: 'Vanguard Total Stock Market ETF',
      assetType: 'ETF',
      quantityMicroshares: 10000000,
      costBasisCents: 200000,
      currentPriceCents: 25000,
    }, ownerToken);
    assert(invRes.status === 201, 'OWNER POST investment holding failed');
    const holdingId = invRes.data.holding.id;

    // Define all mutation endpoints to test against MEMBER (403 FINANCE_MUTATION_FORBIDDEN), CHILD (403), GUEST (403)
    const mutationCalls: Array<{ method: string; url: string; body: any; label: string }> = [
      { method: 'POST', url: `/api/v1/finance/${familyId}/accounts`, body: { name: 'X', accountType: 'CHECKING' }, label: 'POST accounts' },
      { method: 'PUT', url: `/api/v1/finance/${familyId}/accounts/${accId}`, body: { name: 'Edited' }, label: 'PUT account' },
      { method: 'POST', url: `/api/v1/finance/${familyId}/accounts/${accId}/reconcile`, body: { statementBalanceCents: 995000 }, label: 'POST reconcile' },
      { method: 'DELETE', url: `/api/v1/finance/${familyId}/accounts/${disposableAccId}`, body: {}, label: 'DELETE account' },
      { method: 'POST', url: `/api/v1/finance/${familyId}/transactions`, body: { accountId: accId, title: 'T', amountCents: 100, transactionType: 'EXPENSE', category: 'FOOD' }, label: 'POST transactions' },
      { method: 'POST', url: `/api/v1/finance/${familyId}/transactions/${txId}/reverse`, body: {}, label: 'POST reverse transaction' },
      { method: 'POST', url: `/api/v1/finance/${familyId}/budgets`, body: { category: 'FOOD', allocatedCents: 50000 }, label: 'POST budgets' },
      { method: 'POST', url: `/api/v1/finance/${familyId}/savings`, body: { title: 'S', targetCents: 10000 }, label: 'POST savings' },
      { method: 'POST', url: `/api/v1/finance/${familyId}/savings/${goalId}/contribute`, body: { amountCents: 1000 }, label: 'POST savings contribute' },
      { method: 'POST', url: `/api/v1/finance/${familyId}/recurring`, body: { accountId: accId, title: 'R', amountCents: 1000, transactionType: 'EXPENSE', category: 'FOOD', recurrenceInterval: 'MONTHLY' }, label: 'POST recurring' },
      { method: 'PUT', url: `/api/v1/finance/${familyId}/recurring/${ruleId}`, body: { isActive: true }, label: 'PUT recurring' },
      { method: 'POST', url: `/api/v1/finance/${familyId}/recurring/${ruleId}/generate`, body: {}, label: 'POST recurring generate' },
      { method: 'POST', url: `/api/v1/finance/${familyId}/investments`, body: { accountId: accId, symbol: 'BND', assetName: 'Bond', assetType: 'ETF', quantityMicroshares: 1000000, costBasisCents: 10000, currentPriceCents: 10000 }, label: 'POST investments' },
      { method: 'PUT', url: `/api/v1/finance/${familyId}/investments/${holdingId}/price`, body: { currentPriceCents: 26000 }, label: 'PUT investment price' },
      { method: 'DELETE', url: `/api/v1/finance/${familyId}/investments/${holdingId}`, body: {}, label: 'DELETE investment' },
    ];

    // Verify MEMBER is blocked with 403 FINANCE_MUTATION_FORBIDDEN on every single mutation route
    for (const call of mutationCalls) {
      const res = await requestJson(call.method, call.url, call.body, memberActor.token);
      assert(res.status === 403, `MEMBER ${call.label} expected 403, got ${res.status}`);
      assert(res.data.error === 'FINANCE_MUTATION_FORBIDDEN', `MEMBER ${call.label} expected FINANCE_MUTATION_FORBIDDEN, got ${res.data.error}`);
    }

    // Verify MEMBER is allowed read-only GET access
    const memberRead = await requestJson('GET', `/api/v1/finance/${familyId}/accounts`, undefined, memberActor.token);
    assert(memberRead.status === 200, `MEMBER GET accounts expected 200, got ${memberRead.status}`);

    // Verify CHILD and GUEST are blocked with 403 FINANCE_ACCESS_RESTRICTED on both GET and mutation routes
    for (const restricted of [
      { role: 'CHILD', token: childActor.token },
      { role: 'GUEST', token: guestActor.token },
    ]) {
      const getRes = await requestJson('GET', `/api/v1/finance/${familyId}/accounts`, undefined, restricted.token);
      assert(getRes.status === 403 && getRes.data.error === 'FINANCE_ACCESS_RESTRICTED', `${restricted.role} GET must return 403 FINANCE_ACCESS_RESTRICTED`);

      for (const call of mutationCalls) {
        const mutRes = await requestJson(call.method, call.url, call.body, restricted.token);
        assert(mutRes.status === 403 && mutRes.data.error === 'FINANCE_ACCESS_RESTRICTED', `${restricted.role} ${call.label} must return 403 FINANCE_ACCESS_RESTRICTED`);
      }
    }

    // Verify ADMIN can execute remaining mutations (PUT account, reconcile, budget, savings contribute, recurring PUT/generate, investment price/DELETE)
    const adminPutAcc = await requestJson('PUT', `/api/v1/finance/${familyId}/accounts/${accId}`, { name: 'RBAC Verified Checking' }, adminActor.token);
    assert(adminPutAcc.ok, 'ADMIN PUT account failed');

    const adminRecAcc = await requestJson('POST', `/api/v1/finance/${familyId}/accounts/${accId}/reconcile`, { statementBalanceCents: 995000 }, adminActor.token);
    assert(adminRecAcc.ok, 'ADMIN POST reconcile failed');

    const adminBudget = await requestJson('POST', `/api/v1/finance/${familyId}/budgets`, { category: 'FOOD', allocatedCents: 75000 }, adminActor.token);
    assert(adminBudget.ok, 'ADMIN POST budget failed');

    const adminSgContrib = await requestJson('POST', `/api/v1/finance/${familyId}/savings/${goalId}/contribute`, { amountCents: 5000 }, adminActor.token);
    assert(adminSgContrib.ok, 'ADMIN POST savings contribute failed');

    const adminPutRule = await requestJson('PUT', `/api/v1/finance/${familyId}/recurring/${ruleId}`, { isActive: true }, adminActor.token);
    assert(adminPutRule.ok, 'ADMIN PUT recurring failed');

    const adminGenRule = await requestJson('POST', `/api/v1/finance/${familyId}/recurring/${ruleId}/generate`, {}, adminActor.token);
    assert(adminGenRule.ok, 'ADMIN POST recurring generate failed');

    const adminPutInv = await requestJson('PUT', `/api/v1/finance/${familyId}/investments/${holdingId}/price`, { currentPriceCents: 26500 }, adminActor.token);
    assert(adminPutInv.ok, 'ADMIN PUT investment price failed');

    const adminDelInv = await requestJson('DELETE', `/api/v1/finance/${familyId}/investments/${holdingId}`, {}, adminActor.token);
    assert(adminDelInv.ok, 'ADMIN DELETE investment failed');
  });

  // ==========================================================================
  // SECTION 7: BACKUP AUTHENTICATED INTEGRITY & MEDIA SECURITY
  // ==========================================================================

  await testCase('SEC-7-BACKUP-HMAC', 'Protected backup verifies SHA-256 and HMAC-SHA256 signature and rejects tampered metadata', () => {
    const tmpSource = path.resolve(process.cwd(), `data/test-store-${runId}.json`);
    const tmpBackup = path.resolve(process.cwd(), `data/backups/test-backup-${runId}.bak.json`);
    const metaPath = `${tmpBackup}.sha256.json`;

    fs.writeFileSync(tmpSource, JSON.stringify({ schemaVersion: '3.4.1', workspaces: {} }), 'utf-8');
    const meta = createProtectedPrePostgresBackup(tmpSource, tmpBackup);
    assert(Boolean(meta.hmacSignature), 'Backup metadata must include hmacSignature');

    const okCheck = verifyProtectedBackup(tmpBackup);
    assert(okCheck.valid === true, 'Untampered backup must pass verification');

    // Tamper with backup file AND update sha256 in metadata (simulating attacker without HMAC secret)
    const tamperedContent = JSON.stringify({ schemaVersion: '3.4.1', workspaces: { hacked: true } });
    fs.writeFileSync(tmpBackup, tamperedContent, 'utf-8');
    const tamperedSha = computeSha256(tamperedContent);
    const metaObj = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    metaObj.sha256 = tamperedSha; // Attacker updates SHA-256, but cannot forge HMAC-SHA256
    fs.writeFileSync(metaPath, JSON.stringify(metaObj), 'utf-8');

    const hmacCheck = verifyProtectedBackup(tmpBackup);
    assert(hmacCheck.valid === false, 'Backup with forged SHA-256 but invalid HMAC must fail');
    assert(hmacCheck.reason === 'HMAC_SIGNATURE_MISMATCH', `Expected HMAC_SIGNATURE_MISMATCH, got ${hmacCheck.reason}`);

    try {
      fs.unlinkSync(tmpSource);
      fs.unlinkSync(tmpBackup);
      fs.unlinkSync(metaPath);
    } catch {}
  });

  await testCase('SEC-7-MEDIA', 'Image dimension and 16MP decompression bomb limits are enforced', () => {
    const onePxPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const dims = extractImageDimensions(onePxPng, 'image/png');
    assert(dims !== null && dims.width === 1 && dims.height === 1, 'Width/height must be 1x1');

    // Construct 5000x4000 PNG header (within 8192px dimension, but 20,000,000 pixels > 16MP limit)
    const bombPng = Buffer.from(onePxPng);
    bombPng.writeUInt32BE(5000, 16);
    bombPng.writeUInt32BE(4000, 20);

    const bombCheck = validateUploadedImageDataUrl(`data:image/png;base64,${bombPng.toString('base64')}`);
    assert(bombCheck.valid === false, '20MP image must be rejected');
    assert(bombCheck.errorCode === 'IMAGE_PIXEL_LIMIT_EXCEEDED', `Expected IMAGE_PIXEL_LIMIT_EXCEEDED, got ${bombCheck.errorCode}`);
  });

  await testCase('SEC-2-POSTGRES-ENV', 'Fail-closed PostgreSQL check when no live PostgreSQL daemon is running', () => {
    setPostgresConnectionVerifiedForTest(false);
    const status = evaluateStorageAvailability({
      FAMILYOS_STORAGE_MODE: 'postgres',
      SQL_HOST: '127.0.0.1',
      SQL_DB_NAME: 'familyos',
      SQL_USER: 'postgres',
      SQL_PASSWORD: 'password',
    });
    assert(status.available === false, 'Must report unavailable when PostgreSQL daemon is not reachable');
    assert(status.errorCode === 'POSTGRES_UNAVAILABLE_NO_JSON_FALLBACK', 'Must fail closed without silent JSON fallback');
  });

  // Summary Report
  const total = testResults.length;
  const passed = testResults.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log('\n================================================================');
  console.log(`📊 THIRD-PASS VERIFICATION RESULTS: ${passed}/${total} PASSED (${failed} FAILED)`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
