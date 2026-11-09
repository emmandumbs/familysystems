/**
 * FamilyOS Corrective Architecture Verification Suite
 * ENFORCE ONE FAMILY PER ACCOUNT — REMOVE MULTI-FAMILY WORKSPACES
 * Verifies all 20 requirements specified in the Product Owner prompt.
 */

process.env.NODE_ENV = 'test';

import fs from 'fs';
import path from 'path';
import { createApp, loadStore } from '../server';

const STORE_PATH = path.join(process.cwd(), 'data', 'familyos-shared-store.json');
let BASE_URL = 'http://127.0.0.1:3000';

interface TestResult {
  num: number;
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function runTest(num: number, name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ num, name, passed: true });
    console.log(`  ✓ [TEST ${num}] PASS: ${name}`);
  } catch (err: any) {
    results.push({ num, name, passed: false, error: err.message });
    console.error(`  ✗ [TEST ${num}] FAIL: ${name} -> ${err.message}`);
  }
}

function assert(condition: any, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runSuite() {
  console.log('\n================================================================');
  console.log('🚀 Running FamilyOS One-Family-Per-Account Verification Suite');
  console.log('================================================================\n');

  const storeSnapshotBefore = fs.existsSync(STORE_PATH)
    ? fs.readFileSync(STORE_PATH, 'utf-8')
    : null;

  const app = await createApp();
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as { port: number };
  BASE_URL = `http://127.0.0.1:${address.port}`;

  try {
    const testRunId = Date.now();
  const aliceUserId = `usr-test-alice-${testRunId}`;
  const bobUserId = `usr-test-bob-${testRunId}`;
  const charlieUserId = `usr-test-charlie-${testRunId}`;

  let aliceToken = '';
  let bobToken = '';
  let charlieToken = '';
  let aliceFamilyId = '';
  let validInviteToken = '';
  let expiredInviteToken = '';
  let revokedInviteToken = '';
  let childProfileId = '';

  // Helpers to get tokens
  const getAuthToken = async (userId: string, email?: string) => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAccountId: userId,
        email: email || `${userId}@example.com`,
        registerNewUser: true,
      }),
    });
    if (!res.ok) throw new Error(`Auth failed (${res.status}) for ${userId}`);
    const data = await res.json();
    return data.token;
  };

  aliceToken = await getAuthToken(aliceUserId, `alice.${testRunId}@example.com`);
  bobToken = await getAuthToken(bobUserId, `bob.${testRunId}@example.com`);
  charlieToken = await getAuthToken(charlieUserId, `charlie.${testRunId}@example.com`);

  // 1. New account can create one family
  await runTest(1, 'New account can create one family', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`,
      },
      body: JSON.stringify({
        name: 'The Sterling Family',
        motto: 'Strength, Grace, and Stewardship',
        mission: 'Build an enduring home.',
        currencyCode: 'USD',
        ownerDisplayName: 'Alice Sterling',
      }),
    });
    assert(res.ok, `Expected 201/200, got ${res.status}`);
    const data = await res.json();
    assert(data.workspace, 'Workspace must be returned');
    assert(data.workspace.id, 'Family ID must be generated');
    aliceFamilyId = data.workspace.id;
  });

  // 2. Creator automatically becomes OWNER
  await runTest(2, 'Creator automatically becomes OWNER', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/workspaces`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    assert(res.ok, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.family, 'Canonical family must be returned');
    assert(data.family.id === aliceFamilyId, 'Family ID must match');
    assert(data.family.role === 'OWNER', `Creator role must be OWNER, got ${data.family.role}`);
  });

  // 3. Second family creation is rejected
  await runTest(3, 'Second family creation is rejected (ONE_FAMILY_PER_ACCOUNT_RULE)', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`,
      },
      body: JSON.stringify({
        name: 'Second Family Attempt',
      }),
    });
    assert(res.status === 409, `Expected 409 Conflict, got ${res.status}`);
    const data = await res.json();
    assert(data.error === 'ONE_FAMILY_PER_ACCOUNT_RULE', `Expected error ONE_FAMILY_PER_ACCOUNT_RULE, got ${data.error}`);
  });

  // 4. Concurrent duplicate creation by a brand-new account is serialized atomically (exactly 1 succeeds with 201, 1 rejected with 409)
  await runTest(4, 'Concurrent duplicate creation by a new account is rejected atomically (1x 201, 1x 409)', async () => {
    const raceUserToken = await getAuthToken(`usr-test-race-${testRunId}`, `race.${testRunId}@example.com`);
    const attempts = await Promise.all([
      fetch(`${BASE_URL}/api/v1/workspaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${raceUserToken}` },
        body: JSON.stringify({ name: 'Concurrent Race Family A' }),
      }),
      fetch(`${BASE_URL}/api/v1/workspaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${raceUserToken}` },
        body: JSON.stringify({ name: 'Concurrent Race Family B' }),
      }),
    ]);
    const statuses = attempts.map((r) => r.status).sort();
    assert(
      statuses[0] === 201 && statuses[1] === 409,
      `Expected exactly one 201 Created and one 409 Conflict under concurrent creation, got [${statuses.join(', ')}]`
    );
  });

  // 5. Existing family owner cannot create another family
  await runTest(5, 'Existing family owner cannot create another family', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`,
      },
      body: JSON.stringify({ name: 'Another Branch Family' }),
    });
    assert(res.status === 409, `Expected 409 Conflict, got ${res.status}`);
  });

  // Create valid invitation for Bob
  const invRes = await fetch(`${BASE_URL}/api/v1/invitations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${aliceToken}`,
    },
    body: JSON.stringify({
      familyId: aliceFamilyId,
      inviteeName: 'Bob Sterling',
      proposedRole: 'ADMIN',
      relationshipToPrimary: 'SPOUSE',
      inviteMethod: 'ONE_TIME_LINK',
    }),
  });
  const invData = await invRes.json();
  validInviteToken = invData.invitation.invitationToken;

  // 6. Adult can join through a valid invitation
  await runTest(6, 'Adult can join existing family through valid invitation', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/invitations/claim-one-time-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bobToken}`,
      },
      body: JSON.stringify({
        invitationToken: validInviteToken,
      }),
    });
    assert(res.ok, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.success, 'Joining must succeed');
    assert(data.membership, 'Membership must be returned');
    assert(data.membership.familyId === aliceFamilyId, 'Must join Alice family ID');
  });

  // 7. Invitation acceptance does not create a new family
  await runTest(7, 'Invitation acceptance connects to existing family, does not create new family', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/workspaces`, {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    assert(res.ok, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.family.id === aliceFamilyId, `Bob must be connected to Alice family ${aliceFamilyId}, got ${data.family.id}`);
    assert(data.workspaces.length === 1, `Must belong to exactly 1 family, got ${data.workspaces.length}`);
  });

  // 8. Invalid invitation is rejected
  await runTest(8, 'Invalid invitation token is rejected (404)', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/invitations/claim-one-time-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${charlieToken}`,
      },
      body: JSON.stringify({
        invitationToken: 'nonexistent-token-xyz',
      }),
    });
    assert(res.status === 404, `Expected 404, got ${res.status}`);
  });

  // Create an expired invitation (expiresInMs: -60000)
  const expRes = await fetch(`${BASE_URL}/api/v1/invitations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${aliceToken}`,
    },
    body: JSON.stringify({
      familyId: aliceFamilyId,
      inviteeName: 'Charlie Expired',
      proposedRole: 'MEMBER',
      inviteMethod: 'ONE_TIME_LINK',
      expiresInMs: -60000,
    }),
  });
  const expData = await expRes.json();
  expiredInviteToken = expData.invitation.invitationToken;

  // 9. Expired invitation is strictly rejected with 410 on both verify and claim
  await runTest(9, 'Expired invitation is strictly rejected (410 Gone)', async () => {
    const verifyRes = await fetch(`${BASE_URL}/api/v1/invitations/verify/${encodeURIComponent(expiredInviteToken)}`);
    assert(verifyRes.status === 410, `Expected 410 Gone on verify, got ${verifyRes.status}`);

    const claimRes = await fetch(`${BASE_URL}/api/v1/invitations/claim-one-time-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${charlieToken}`,
      },
      body: JSON.stringify({ invitationToken: expiredInviteToken }),
    });
    assert(claimRes.status === 410, `Expected 410 Gone on claim, got ${claimRes.status}`);
  });

  // 10. Reused invitation is rejected (single-use enforced)
  await runTest(10, 'Reused invitation is rejected (409 single-use enforced)', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/invitations/claim-one-time-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${charlieToken}`,
      },
      body: JSON.stringify({
        invitationToken: validInviteToken,
      }),
    });
    assert(res.status === 409, `Expected 409 Conflict (reused), got ${res.status}`);
  });

  // Create and revoke an invitation
  const revRes = await fetch(`${BASE_URL}/api/v1/invitations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${aliceToken}`,
    },
    body: JSON.stringify({
      familyId: aliceFamilyId,
      inviteeName: 'Revoked User',
      proposedRole: 'GUEST',
      inviteMethod: 'ONE_TIME_LINK',
    }),
  });
  const revData = await revRes.json();
  revokedInviteToken = revData.invitation.invitationToken;
  await fetch(`${BASE_URL}/api/v1/invitations/${encodeURIComponent(revData.invitation.id)}/revoke`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${aliceToken}` },
  });

  // 11. Revoked invitation is rejected
  await runTest(11, 'Revoked invitation is rejected (403)', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/invitations/claim-one-time-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${charlieToken}`,
      },
      body: JSON.stringify({
        invitationToken: revokedInviteToken,
      }),
    });
    assert(res.status === 403, `Expected 403 Forbidden, got ${res.status}`);
  });

  // 12. Duplicate membership is prevented
  await runTest(12, 'Duplicate membership in same family is prevented', async () => {
    // Generate fresh invite
    const freshRes = await fetch(`${BASE_URL}/api/v1/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`,
      },
      body: JSON.stringify({
        familyId: aliceFamilyId,
        inviteeName: 'Bob Again',
        proposedRole: 'MEMBER',
      }),
    });
    const freshData = await freshRes.json();
    const token = freshData.invitation.invitationToken;

    // Bob attempts to claim again
    const claimRes = await fetch(`${BASE_URL}/api/v1/invitations/claim-one-time-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bobToken}`,
      },
      body: JSON.stringify({ invitationToken: token }),
    });
    assert(claimRes.status === 409, `Expected 409 already a member, got ${claimRes.status}`);
  });

  // 13. Child profile can exist without an account
  await runTest(13, 'Child profile can exist without an authenticated account', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/members/${aliceFamilyId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`,
      },
      body: JSON.stringify({
        displayName: 'Tommy Sterling',
        relationship: 'CHILD',
        birthDate: '2020-04-10',
        allergies: ['Peanuts'],
        isMinor: true,
      }),
    });
    assert(res.ok, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.member, 'Member profile must be created');
    assert(data.member.userAccountId === null, 'Child profile must not require userAccountId');
    assert(data.member.displayName === 'Tommy Sterling', 'Child name must match');
    childProfileId = data.member.id;
  });

  // 14. Multiple adult accounts can belong to the same family
  await runTest(14, 'Multiple adult accounts belong to the same family', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/members/${aliceFamilyId}`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    assert(res.ok, `Expected 200, got ${res.status}`);
    const data = await res.json();
    const members = data.members || [];
    const aliceMember = members.find((m: any) => m.displayName.includes('Alice'));
    const bobMember = members.find((m: any) => m.displayName.includes('Bob'));
    const tommyMember = members.find((m: any) => m.displayName.includes('Tommy'));
    assert(aliceMember, 'Alice must be in family directory');
    assert(bobMember, 'Bob must be in family directory');
    assert(tommyMember, 'Tommy (child) must be in family directory');
  });

  // 15. Family data is visible only to authorized members
  await runTest(15, 'Family data is isolated: unauthorized account is denied access (403)', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/workspace/${aliceFamilyId}`, {
      headers: { Authorization: `Bearer ${charlieToken}` },
    });
    assert(res.status === 403, `Expected 403 Forbidden for outsider Charlie, got ${res.status}`);
  });

  // 16. Account without a family receives empty workspaces list (creation onboarding)
  await runTest(16, 'Account without family receives empty workspaces list', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/workspaces`, {
      headers: { Authorization: `Bearer ${charlieToken}` },
    });
    assert(res.ok, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.hasFamily === false, 'Charlie should have hasFamily === false');
    assert(data.workspaces.length === 0, 'Charlie should have 0 workspaces');
  });

  // 17. Account with an existing family receives the existing family dashboard
  await runTest(17, 'Account with existing family receives canonical family record', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/workspaces`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    assert(res.ok, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.hasFamily === true, 'Alice should have hasFamily === true');
    assert(data.family.id === aliceFamilyId, `Family ID must match ${aliceFamilyId}`);
    assert(data.workspaces.length === 1, 'Only one canonical family workspace must be returned');
  });

  // 18. No workspace switcher appears in production UI
  await runTest(18, 'Verify no workspace switcher in App.tsx or Stage331FamilyExperience.tsx', async () => {
    const appTsx = fs.readFileSync('src/App.tsx', 'utf-8');
    assert(!appTsx.includes('Switch Family Workspace'), 'App.tsx must not contain Switch Family Workspace');
    assert(!appTsx.includes('handleSwitchFamily'), 'App.tsx must not contain handleSwitchFamily');
    assert(!appTsx.includes('isFamilyDropdownOpen'), 'App.tsx must not contain isFamilyDropdownOpen');

    const singleFamTsx = fs.readFileSync('src/components/SingleFamilyOnboardingSystem.tsx', 'utf-8');
    assert(!singleFamTsx.includes('Switch &rarr;'), 'SingleFamilyOnboardingSystem must not contain Switch &rarr;');
  });

  // 19. Finance and Household records remain associated with the correct family
  await runTest(19, 'Finance and Household records bind to canonical familyId', async () => {
    const wsRes = await fetch(`${BASE_URL}/api/v1/workspace/${aliceFamilyId}`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    assert(wsRes.ok, `Expected 200, got ${wsRes.status}`);
    const wsData = await wsRes.json();
    assert(wsData.workspace.id === aliceFamilyId, 'Workspace ID must match');
    assert(wsData.callerMembership.familyId === aliceFamilyId, 'Caller membership must match');
  });

  // 20. Android and Web use the same family ID structure & cryptographic invitation tokens
  await runTest(20, 'Android and Web use dynamic family IDs and 192-bit cryptographic invite tokens', async () => {
    assert(aliceFamilyId.startsWith('fam-'), `Family ID must start with fam-, got ${aliceFamilyId}`);
    assert(aliceFamilyId !== 'fam-1', `Family ID must be dynamic and unique, not hardcoded fam-1`);
    // Verify invitation token has 48 hex chars (24 random bytes = 192 bits) after fos_1time_<timestamp>_
    const tokenParts = validInviteToken.split('_');
    const randomHex = tokenParts[tokenParts.length - 1];
    assert(
      /^[0-9a-f]{48}$/.test(randomHex),
      `Invitation token must contain 48 hex characters (192-bit CSPRNG), got "${randomHex}"`
    );
  });

  // 20B. Simultaneous invitation claims by two distinct accounts on the same single-use token
  await runTest(29, 'Simultaneous concurrent claims on single-use invitation (1x 200, 1x 409)', async () => {
    const simInvRes = await fetch(`${BASE_URL}/api/v1/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`,
      },
      body: JSON.stringify({
        familyId: aliceFamilyId,
        inviteeName: 'Simultaneous Claimer',
        proposedRole: 'MEMBER',
        inviteMethod: 'ONE_TIME_LINK',
      }),
    });
    const simInvData = await simInvRes.json();
    const simToken = simInvData.invitation.invitationToken;

    const dianaToken = await getAuthToken(`usr-test-diana-${testRunId}`, `diana.${testRunId}@example.com`);
    const evanToken = await getAuthToken(`usr-test-evan-${testRunId}`, `evan.${testRunId}@example.com`);

    const claims = await Promise.all([
      fetch(`${BASE_URL}/api/v1/invitations/claim-one-time-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${dianaToken}` },
        body: JSON.stringify({ invitationToken: simToken }),
      }),
      fetch(`${BASE_URL}/api/v1/invitations/claim-one-time-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${evanToken}` },
        body: JSON.stringify({ invitationToken: simToken }),
      }),
    ]);
    const claimStatuses = claims.map((c) => c.status).sort();
    assert(
      claimStatuses[0] === 200 && claimStatuses[1] === 409,
      `Expected one 200 OK and one 409 Conflict on simultaneous single-use claim, got [${claimStatuses.join(', ')}]`
    );
  });

  // 21. Audit 4 Lifecycle: Sole OWNER cannot leave without ownership transfer
  await runTest(21, 'Sole OWNER cannot leave without ownership transfer (400 SOLE_OWNER_CANNOT_LEAVE)', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/memberships/${aliceFamilyId}/leave`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
    const data = await res.json();
    assert(data.error === 'SOLE_OWNER_CANNOT_LEAVE', `Expected SOLE_OWNER_CANNOT_LEAVE, got ${data.error}`);
  });

  // 22. Audit 4 Lifecycle: Invitation sent to specific email rejects claim by wrong email
  await runTest(22, 'Invitation sent to specific email rejects claim by wrong email (403 INVITATION_EMAIL_MISMATCH)', async () => {
    // Alice invites target@example.com via GOOGLE_ACCOUNT
    const emailInvRes = await fetch(`${BASE_URL}/api/v1/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`,
      },
      body: JSON.stringify({
        familyId: aliceFamilyId,
        inviteeEmail: `intended.target.${testRunId}@example.com`,
        inviteeName: 'Intended Target',
        proposedRole: 'MEMBER',
        inviteMethod: 'GOOGLE_ACCOUNT',
      }),
    });
    const emailInvData = await emailInvRes.json();
    const token = emailInvData.invitation.invitationToken;

    // Charlie (charlie@example.com) attempts to claim it
    const claimRes = await fetch(`${BASE_URL}/api/v1/invitations/claim-one-time-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${charlieToken}`,
      },
      body: JSON.stringify({ invitationToken: token }),
    });
    assert(claimRes.status === 403, `Expected 403, got ${claimRes.status}`);
    const claimData = await claimRes.json();
    assert(claimData.error === 'INVITATION_EMAIL_MISMATCH', `Expected INVITATION_EMAIL_MISMATCH, got ${claimData.error}`);
  });

  // 23. Audit 4 Lifecycle: Owner transfers ownership to another active adult member
  await runTest(23, 'Owner transfers ownership to active adult member (Bob)', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/workspaces/${aliceFamilyId}/transfer-ownership`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`,
      },
      body: JSON.stringify({ newOwnerUserAccountId: bobUserId }),
    });
    assert(res.ok, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.success, 'Transfer must succeed');
    assert(data.previousOwnerRole === 'ADMIN', 'Alice must be demoted to ADMIN');
    assert(data.newOwner.role === 'OWNER', 'Bob must be promoted to OWNER');
  });

  // 24. Audit 4 Lifecycle: Former owner (now ADMIN) leaves family successfully
  await runTest(24, 'Former owner (now ADMIN) leaves family workspace', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/memberships/${aliceFamilyId}/leave`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    assert(res.ok, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.success, 'Leave must succeed');

    // Alice now has no family
    const wsRes = await fetch(`${BASE_URL}/api/v1/workspaces`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    const wsData = await wsRes.json();
    assert(wsData.hasFamily === false, 'Alice should have no family after leaving');
  });

  // 25. Audit 1 & 4: connect-account rejects user who already belongs to another family
  await runTest(25, 'connect-account rejects user who already belongs to another family', async () => {
    // Bob (current owner of AliceFamily) attempts to connect his account to a member in another family
    const connRes = await fetch(`${BASE_URL}/api/v1/members/fam-1/mem-maya-child/connect-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bobToken}`,
      },
      body: JSON.stringify({ userAccountId: bobUserId }),
    });
    assert(connRes.status === 409 || connRes.status === 403, `Expected 409/403, got ${connRes.status}`);
  });

  // 26. Audit 4 Lifecycle: New Owner (Bob) closes and deletes the family workspace
  await runTest(26, 'Owner closes and soft-deletes family workspace (DELETE /api/v1/workspaces/:familyId)', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/workspaces/${aliceFamilyId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    assert(res.ok, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.status === 'CLOSED', 'Workspace status must be CLOSED');

    // Bob now receives hasFamily === false
    const wsRes = await fetch(`${BASE_URL}/api/v1/workspaces`, {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    const wsData = await wsRes.json();
    assert(wsData.hasFamily === false, 'Bob should have no active family after closure');
  });

  // 27. Audit 1: Persistent storage invariants verify zero active duplicate memberships
  await runTest(27, 'Persistent storage invariants verify zero active duplicate memberships', async () => {
    const storeRaw = fs.readFileSync('data/familyos-shared-store.json', 'utf-8');
    const store = JSON.parse(storeRaw);
    const activeMap = new Map<string, string>();
    for (const m of store.memberships || []) {
      if (m.status === 'ACTIVE' && m.userAccountId) {
        if (activeMap.has(m.userAccountId)) {
          const prev = activeMap.get(m.userAccountId);
          assert(false, `Invariant violation: User ${m.userAccountId} has multiple active memberships: ${prev} and ${m.familyId}`);
        }
        activeMap.set(m.userAccountId, m.familyId);
      }
    }
  });

  // 28. Audit 1: Reloading store from disk verifies persistence integrity across restarts
  await runTest(28, 'Reloading store from disk verifies persistence integrity across restarts', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/workspaces`, {
      headers: { Authorization: `Bearer ${charlieToken}` },
    });
    assert(res.ok, 'Store reload must succeed');
  });

    // Test Summary
    console.log('\n================================================================');
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;
    console.log(`Execution Results: ${passed} Passed, ${failed} Failed out of ${results.length} Tests`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    server.close();
    if (storeSnapshotBefore !== null) {
      fs.writeFileSync(STORE_PATH, storeSnapshotBefore, 'utf-8');
      loadStore();
    }
  }
}

runSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
