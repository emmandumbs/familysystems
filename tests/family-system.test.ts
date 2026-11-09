/**
 * FamilyOS Comprehensive Verification Test Suite
 * Tests family creation, multi-family accounts, atomic memberships,
 * invitations lifecycle, member profiles, and data isolation.
 */

const BASE_URL = 'http://localhost:3000';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`  ✓ PASS: ${name}`);
  } catch (err: any) {
    results.push({ name, passed: false, error: err.message });
    console.error(`  ✗ FAIL: ${name} -> ${err.message}`);
  }
}

function assert(condition: any, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runAllTests() {
  console.log('\n======================================================');
  console.log('🚀 Running FamilyOS Architecture & Verification Tests');
  console.log('======================================================\n');

  let sarahToken = '';
  let davidToken = '';
  let createdFamilyId = '';
  let inviteToken = '';
  let arthurMemberId = '';

  // 1. Authenticate Sarah (Owner)
  await test('Authenticate Sarah Jenkins (OWNER)', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userAccountId: 'usr-sarah-owner' }),
    });
    assert(res.ok, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.token, 'Session token should be present');
    sarahToken = data.token;
  });

  // 2. Authenticate David (Admin)
  await test('Authenticate David Jenkins (ADMIN)', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userAccountId: 'usr-david-admin' }),
    });
    assert(res.ok, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.token, 'Session token should be present');
    davidToken = data.token;
  });

  // 3. List initial workspaces for Sarah
  await test('List user workspaces for Sarah (GET /api/v1/workspaces)', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/workspaces`, {
      headers: { Authorization: `Bearer ${sarahToken}` },
    });
    assert(res.ok, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(Array.isArray(data.workspaces), 'Workspaces array should be returned');
  });

  // 4. Create a new family workspace with dynamic ID and atomic owner membership
  await test('Create new family workspace atomically (POST /api/v1/workspaces)', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahToken}`,
      },
      body: JSON.stringify({
        name: 'The Sterling Household',
        description: 'Intentional living and generational growth.',
        motto: 'Strength, Grace, and Stewardship',
        mission: 'Cultivate an environment of love, resilience, and purpose.',
        vision: 'Flourishing together through every season of life.',
        values: ['Integrity', 'Kindness', 'Gratitude', 'Curiosity'],
        currencyCode: 'EUR',
        country: 'France',
        timezone: 'Europe/Paris',
        language: 'English',
        ownerDisplayName: 'Sarah Sterling',
      }),
    });
    assert(res.ok, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.success, 'Creation must succeed');
    assert(data.workspace, 'Workspace must be returned');
    assert(data.workspace.id !== 'fam-1', 'Must generate dynamic family ID, not fam-1');
    assert(data.workspace.name === 'The Sterling Household', 'Workspace name must match');
    assert(data.workspace.currencyCode === 'EUR', 'Currency must be saved');
    assert(data.membership, 'Owner membership must be created atomically');
    assert(data.membership.role === 'OWNER', 'User must be OWNER');
    assert(data.memberProfile, 'Owner member profile must be created atomically');
    assert(data.memberProfile.displayName === 'Sarah Sterling', 'Owner profile name should match');
    createdFamilyId = data.workspace.id;
  });

  // 5. Test validation: Reject workspace creation without name
  await test('Reject invalid workspace creation (atomic rollback)', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahToken}`,
      },
      body: JSON.stringify({
        name: '',
      }),
    });
    assert(res.status === 400, `Expected 400 Bad Request, got ${res.status}`);
  });

  // 6. Add a household member profile (Child with no user account or login)
  await test('Add household member profile without login (POST /api/v1/members/:familyId)', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/members/${createdFamilyId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahToken}`,
      },
      body: JSON.stringify({
        displayName: 'Arthur Sterling',
        relationship: 'CHILD',
        birthDate: '2018-05-12',
        allergies: ['Peanuts'],
        isMinor: true,
      }),
    });
    assert(res.ok, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.member, 'Member object must be returned');
    assert(data.member.displayName === 'Arthur Sterling', 'Name must match');
    assert(data.member.familyId === createdFamilyId, 'Family ID must match');
    assert(data.member.isMinor === true, 'Minor flag must be set');
    arthurMemberId = data.member.id;
  });

  // 7. Verify member listing for the newly created family
  await test('List family members (GET /api/v1/members/:familyId)', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/members/${createdFamilyId}`, {
      headers: { Authorization: `Bearer ${sarahToken}` },
    });
    assert(res.ok, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(Array.isArray(data.members), 'Members list should be returned');
    assert(data.members.length >= 2, 'Should have at least Owner and Arthur');
    const arthur = data.members.find((m: any) => m.displayName === 'Arthur Sterling');
    assert(arthur, 'Arthur must be in member directory');
  });

  // 8. Generate a cryptographically secure one-time invitation link
  await test('Create dynamic one-time invitation (POST /api/v1/invitations)', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahToken}`,
      },
      body: JSON.stringify({
        familyId: createdFamilyId,
        inviteeName: 'David Sterling',
        proposedRole: 'ADMIN',
        relationshipToPrimary: 'SPOUSE',
        inviteMethod: 'ONE_TIME_LINK',
        message: 'Join our family workspace!',
      }),
    });
    assert(res.ok, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.invitation, 'Invitation object must be returned');
    assert(data.invitation.invitationToken, 'Invitation token must be generated');
    assert(data.invitation.status === 'PENDING', 'Initial status must be PENDING');
    assert(data.invitation.familyId === createdFamilyId, 'Family ID must match created family');
    inviteToken = data.invitation.invitationToken;
  });

  // 9. Verify invitation token publicly without auth (GET /api/v1/invitations/verify/:token)
  await test('Verify invitation token publicly (GET /api/v1/invitations/verify/:token)', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/invitations/verify/${encodeURIComponent(inviteToken)}`);
    assert(res.ok, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.invitation, 'Invitation preview should be returned');
    assert(data.invitation.familyName === 'The Sterling Household', 'Family name must match');
    assert(data.invitation.proposedRole === 'ADMIN', 'Role must match');
    assert(data.invitation.status === 'PENDING', 'Status must be PENDING');
  });

  // 10. David claims the one-time invitation link
  await test('Claim one-time invitation link (POST /api/v1/invitations/claim-one-time-link)', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/invitations/claim-one-time-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${davidToken}`,
      },
      body: JSON.stringify({
        invitationToken: inviteToken,
      }),
    });
    assert(res.ok, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.success, 'Claim must succeed');
    assert(data.membership, 'Membership must be returned');
    assert(data.membership.familyId === createdFamilyId, 'Joined family must match created family');
    assert(data.membership.role === 'ADMIN', 'Claimed role must be ADMIN');
  });

  // 11. Verify single-use enforcement: Second claim attempt must fail
  await test('Enforce single-use: Reclaiming used token is rejected', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/invitations/claim-one-time-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${davidToken}`,
      },
      body: JSON.stringify({
        invitationToken: inviteToken,
      }),
    });
    assert(!res.ok, `Expected rejection, got ${res.status}`);
    assert(res.status === 400 || res.status === 409, `Expected 400/409 error code, got ${res.status}`);
  });

  // 12. Verify multi-family accounts: David now belongs to multiple workspaces
  await test('Verify multi-family memberships for David', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/workspaces`, {
      headers: { Authorization: `Bearer ${davidToken}` },
    });
    assert(res.ok, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(Array.isArray(data.workspaces), 'Workspaces array should be returned');
    const sterlingWs = data.workspaces.find((w: any) => w.id === createdFamilyId);
    assert(sterlingWs, 'David must belong to The Sterling Household');
    assert(data.workspaces.length >= 2, 'David must belong to multiple workspaces');
  });

  // 13. David switches active family workspace
  await test('Switch active family workspace (POST /api/v1/workspaces/:familyId/switch)', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/workspaces/${createdFamilyId}/switch`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${davidToken}` },
    });
    assert(res.ok, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.success, 'Switch must succeed');
    assert(data.activeMembership.familyId === createdFamilyId, 'Active family ID must be updated');
  });

  // 14. Fetch complete workspace data for the new family
  await test('Fetch workspace data (GET /api/v1/workspace/:familyId)', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/workspace/${createdFamilyId}`, {
      headers: { Authorization: `Bearer ${davidToken}` },
    });
    assert(res.ok, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.workspace.name === 'The Sterling Household', 'Workspace name must match');
    assert(data.members.length >= 2, 'Must include members');
    assert(data.callerMembership.role === 'ADMIN', 'Caller must be ADMIN');
  });

  // 15. Sole OWNER cannot leave family without transferring ownership
  await test('Sole OWNER cannot leave workspace without transfer', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/memberships/${createdFamilyId}/leave`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sarahToken}` },
    });
    assert(!res.ok, 'Sole owner leave request must be rejected');
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  // 16. Non-sole-owner member leaves family workspace
  await test('Member leaves family workspace (POST /api/v1/memberships/:familyId/leave)', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/memberships/${createdFamilyId}/leave`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${davidToken}` },
    });
    assert(res.ok, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.success, 'Leave must succeed');

    // Confirm David no longer has access to this workspace
    const checkRes = await fetch(`${BASE_URL}/api/v1/workspaces`, {
      headers: { Authorization: `Bearer ${davidToken}` },
    });
    const checkData = await checkRes.json();
    const stillPresent = checkData.workspaces.some((w: any) => w.id === createdFamilyId);
    assert(!stillPresent, 'David must no longer belong to The Sterling Household');
  });

  // Summary
  console.log('\n======================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`Test Execution Finished: ${passedCount} Passed, ${failedCount} Failed`);
  console.log('======================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
