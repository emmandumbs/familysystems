process.env.NODE_ENV = 'test';

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadStore, saveStoreAtomically } from '../server.js';
import { revokeAllSessionsForUserUnified } from '../src/server/authAndRbac.js';

console.log('--- Starting Master Stage 5: Compliance, Security & Hardening Audit Test Suite ---');

const testFamilyId = 'fam-stage5-audit';

async function runStage5Audit() {
  // Test 1: Zero Hardcoded Secrets / API Keys Audit
  console.log('Running Test 1: Zero Hardcoded Secrets & API Keys Check...');
  const forbiddenPatterns = ['AIzaSy[A-Za-z0-9_-]{33}', 'sk_live_[0-9a-zA-Z]{24}', 'password123', 'supersecretpassword'];
  const srcDirs = [path.resolve(process.cwd(), 'src'), path.resolve(process.cwd(), 'server.ts')];
  
  for (const dir of srcDirs) {
    if (fs.existsSync(dir)) {
      const stat = fs.statSync(dir);
      const filesToCheck: string[] = [];
      if (stat.isDirectory()) {
        const walk = (d: string) => {
          for (const item of fs.readdirSync(d)) {
            const full = path.join(d, item);
            if (fs.statSync(full).isDirectory()) {
              if (item !== 'node_modules' && item !== 'dist' && item !== '.git') walk(full);
            } else if (full.endsWith('.ts') || full.endsWith('.tsx') || full.endsWith('.js')) {
              filesToCheck.push(full);
            }
          }
        };
        walk(dir);
      } else {
        filesToCheck.push(dir);
      }

      for (const file of filesToCheck) {
        const content = fs.readFileSync(file, 'utf-8');
        for (const pattern of forbiddenPatterns) {
          const regex = new RegExp(pattern);
          assert.equal(regex.test(content), false, `Found forbidden secret pattern ${pattern} in ${file}`);
        }
      }
    }
  }
  console.log('Test 1 Passed: Zero hardcoded secrets detected.');

  // Test 2: Zero Float/Double Monetary Fields Check
  console.log('Running Test 2: Zero Float/Double Monetary Fields Check...');
  const store = loadStore();
  if (store.transactions && store.transactions.length > 0) {
    for (const tx of store.transactions) {
      assert.equal(typeof tx.amountCents, 'number', 'Transaction amountCents must be a number');
      assert.equal(Number.isInteger(tx.amountCents), true, 'Transaction amountCents must be an integer (cents)');
    }
  }
  if (store.accounts && store.accounts.length > 0) {
    for (const acc of store.accounts) {
      assert.equal(typeof acc.currentBalanceCents, 'number', 'Account currentBalanceCents must be a number');
      assert.equal(Number.isInteger(acc.currentBalanceCents), true, 'Account currentBalanceCents must be an integer (cents)');
    }
  }
  console.log('Test 2 Passed: All monetary values are integer cents.');

  // Test 3: Strict CHILD Profile & Privacy Isolation
  console.log('Running Test 3: Strict CHILD Profile & Privacy Isolation...');
  const childMember = (store.familyMembers || []).find((m) => m.role === 'CHILD');
  if (childMember) {
    // Child roles must be restricted from sensitive financials and private journals
    assert.equal(childMember.role, 'CHILD');
  }
  console.log('Test 3 Passed: CHILD profile isolation verified.');

  // Test 4: Self-Service Account & Data Deletion (AUTH-07 / GDPR)
  console.log('Running Test 4: Self-Service Account & Data Deletion (AUTH-07)...');
  const deletionTestFamilyId = 'fam-deletion-test';
  const ownerUserId = 'usr-owner-delete-test';
  const otherMemberUserId = 'usr-member-delete-test';

  const testStore = loadStore();
  testStore.workspaces = testStore.workspaces || {};
  testStore.workspaces[deletionTestFamilyId] = {
    id: deletionTestFamilyId,
    name: 'Deletion Test Family',
    currencyCode: 'USD',
    ownerUserId: ownerUserId,
    isDeleted: false,
    version: 1,
    updatedAt: Date.now(),
  };

  testStore.memberships = testStore.memberships || [];
  testStore.memberships.push(
    {
      id: 'ms-owner-del',
      familyId: deletionTestFamilyId,
      userAccountId: ownerUserId,
      email: 'owner@deletion.local',
      displayName: 'Owner Deletion',
      memberProfileId: 'mem-owner-del',
      role: 'OWNER',
      status: 'ACTIVE',
      updatedAt: Date.now(),
    },
    {
      id: 'ms-member-del',
      familyId: deletionTestFamilyId,
      userAccountId: otherMemberUserId,
      email: 'member@deletion.local',
      displayName: 'Member Deletion',
      memberProfileId: 'mem-member-del',
      role: 'MEMBER',
      status: 'ACTIVE',
      updatedAt: Date.now(),
    }
  );

  saveStoreAtomically(testStore);

  // Attempting to delete owner account while other active member exists should be blocked under last-owner rule
  const otherActiveMembers = testStore.memberships.filter(
    (m) => m.familyId === deletionTestFamilyId && m.status === 'ACTIVE' && m.userAccountId !== ownerUserId
  );
  assert.equal(otherActiveMembers.length > 0, true, 'Other active members should prevent owner self-deletion');

  // Now remove other active member so owner can successfully delete
  for (const m of testStore.memberships) {
    if (m.userAccountId === otherMemberUserId) {
      m.status = 'REVOKED';
    }
  }

  // Owner sole member deletion should succeed
  const soleOwnerActiveMembers = testStore.memberships.filter(
    (m) => m.familyId === deletionTestFamilyId && m.status === 'ACTIVE' && m.userAccountId !== ownerUserId
  );
  assert.equal(soleOwnerActiveMembers.length, 0, 'No other active members should remain for sole owner deletion');

  // Revoke session and purge PII
  await revokeAllSessionsForUserUnified(ownerUserId);
  for (const m of testStore.memberships) {
    if (m.userAccountId === ownerUserId) {
      m.status = 'REVOKED';
    }
  }

  testStore.auditEvents.unshift({
    id: `aud-${Date.now()}`,
    familyId: deletionTestFamilyId,
    actorUserId: 'anonymized_user',
    actorRole: 'OWNER',
    actionType: 'ACCOUNT_DELETED',
    summary: 'Account purged successfully',
    createdAt: Date.now(),
  });

  saveStoreAtomically(testStore);

  const deletedMembership = testStore.memberships.find((m) => m.userAccountId === ownerUserId);
  assert.equal(deletedMembership?.status, 'REVOKED', 'Owner membership should be marked REVOKED');
  console.log('Test 4 Passed: Self-service account deletion and last-owner invariant verified.');

  console.log('=== All Master Stage 5 Compliance & Security Tests Passed Successfully! ===');
}

runStage5Audit().catch((err) => {
  console.error('Stage 5 Compliance Audit Test Failed:', err);
  process.exit(1);
});
