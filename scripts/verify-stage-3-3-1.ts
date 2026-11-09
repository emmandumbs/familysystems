import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const STORE_PATH = path.resolve(process.cwd(), 'data', 'familyos-shared-store.json');

interface GateResult {
  id: string;
  name: string;
  passed: boolean;
  details: string;
}

const results: GateResult[] = [];

function recordGate(id: string, name: string, passed: boolean, details: string) {
  results.push({ id, name, passed, details });
  const badge = passed ? 'PASS' : 'FAIL';
  console.log(`[${badge}] ${id} — ${name}: ${details}`);
}

async function getToken(userAccountId: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/v1/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userAccountId }),
  });
  if (!res.ok) {
    throw new Error(`Failed to get session token for ${userAccountId}: ${res.status}`);
  }
  const data = await res.json();
  return data.token as string;
}

async function runVerification() {
  console.log('================================================================');
  console.log('FAMILYOS STAGE 3.3.1 — AUTOMATED VERIFICATION SUITE (TESTS 1–12)');
  console.log('================================================================');

  const originalStoreSnapshot = fs.existsSync(STORE_PATH)
    ? fs.readFileSync(STORE_PATH, 'utf-8')
    : null;

  try {
    await fetch(`${BASE_URL}/api/v1/admin/reset-store`, { method: 'POST' }).catch(() => {});
    const sarahOwnerToken = await getToken('usr-sarah-owner');
    const davidAdminToken = await getToken('usr-david-admin');
    const mayaMemberToken = await getToken('usr-maya-member');
    const lucasChildToken = await getToken('usr-lucas-child');
    const marthaGuestToken = await getToken('usr-martha-guest');
    const revokedToken = await getToken('usr-revoked-former');
    const founderNewToken = await getToken('usr-founder-331');

    // ------------------------------------------------------------------
    // TEST 1: Family Creation, Session Restore & One-Family Membership Rule
    // ------------------------------------------------------------------
    const createFamRes = await fetch(`${BASE_URL}/api/v1/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${founderNewToken}`,
      },
      body: JSON.stringify({
        familyId: 'fam-331-created',
        name: 'The Sterling Household',
        motto: 'Built on Trust and Grace',
        mission: 'Nurture resilience and curiosity.',
        vision: 'A connected multi-generational home.',
        values: ['Integrity', 'Kindness', 'Stewardship'],
        ownerDisplayName: 'Arthur Sterling',
      }),
    });
    const createFamData = await createFamRes.json();

    const restoreRes = await fetch(`${BASE_URL}/api/v1/session/restore`, {
      headers: { Authorization: `Bearer ${founderNewToken}` },
    });
    const restoreData = await restoreRes.json();

    // Verify Sarah (already active in fam-1) is blocked by the One-Family Membership Rule
    const duplicateFamRes = await fetch(`${BASE_URL}/api/v1/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahOwnerToken}`,
      },
      body: JSON.stringify({
        name: 'Accidental Second Family',
        motto: 'Should be blocked',
      }),
    });
    const duplicateFamData = await duplicateFamRes.json();

    recordGate(
      'TEST-01',
      'Family Creation, Session Restore & One-Family Membership Rule',
      createFamRes.status === 201 &&
        createFamData.workspace?.motto === 'Built on Trust and Grace' &&
        restoreRes.status === 200 &&
        restoreData.hasActiveFamily === true &&
        restoreData.activeFamilyId === 'fam-331-created' &&
        duplicateFamRes.status === 409 &&
        duplicateFamData.error === 'ONE_FAMILY_RULE_VIOLATION',
      `Created fam-331-created (${createFamRes.status}), restored session (${restoreData.activeFamilyId}), blocked active member second family (${duplicateFamRes.status} ${duplicateFamData.error})`
    );

    // ------------------------------------------------------------------
    // TEST 2: Member Invitation & Role Gating
    // ------------------------------------------------------------------
    const childInviteAttempt = await fetch(`${BASE_URL}/api/v1/members/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${lucasChildToken}`,
      },
      body: JSON.stringify({
        familyId: 'fam-1',
        inviteeEmail: 'friend@example.com',
        inviteeName: 'School Friend',
        proposedRole: 'GUEST',
      }),
    });

    const ownerInviteAcceptTarget = await fetch(`${BASE_URL}/api/v1/members/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahOwnerToken}`,
      },
      body: JSON.stringify({
        familyId: 'fam-1',
        inviteeEmail: 'claire.henderson@example.com',
        inviteeName: 'Aunt Claire Henderson',
        proposedRole: 'MEMBER',
        relationshipToPrimary: 'AUNT',
      }),
    });
    const inviteAcceptData = await ownerInviteAcceptTarget.json();

    const ownerInviteRejectTarget = await fetch(`${BASE_URL}/api/v1/members/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahOwnerToken}`,
      },
      body: JSON.stringify({
        familyId: 'fam-1',
        inviteeEmail: 'bob.neighbor@example.com',
        inviteeName: 'Bob Neighbor',
        proposedRole: 'GUEST',
        relationshipToPrimary: 'NEIGHBOR',
      }),
    });
    const inviteRejectData = await ownerInviteRejectTarget.json();

    recordGate(
      'TEST-02',
      'Member Invitation Creation & Permission Enforcement',
      childInviteAttempt.status === 403 &&
        ownerInviteAcceptTarget.status === 201 &&
        inviteAcceptData.invitation?.status === 'PENDING' &&
        ownerInviteRejectTarget.status === 201,
      `Blocked CHILD invite (${childInviteAttempt.status}), created invitations ${inviteAcceptData.invitation?.id} & ${inviteRejectData.invitation?.id}`
    );

    // ------------------------------------------------------------------
    // TEST 3: Invitation Acceptance, Rejection & One-Family Conflict Check
    // ------------------------------------------------------------------
    const invitationIdToAccept = inviteAcceptData.invitation.id;
    const invitationIdToReject = inviteRejectData.invitation.id;

    // Verify Arthur Sterling (already active in fam-331-created) cannot accept an invitation into fam-1
    const multiFamilyAcceptAttempt = await fetch(
      `${BASE_URL}/api/v1/invitations/${invitationIdToAccept}/respond`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${founderNewToken}`,
        },
        body: JSON.stringify({
          action: 'ACCEPT',
          userAccountId: 'usr-founder-331',
        }),
      }
    );
    const multiFamilyAcceptData = await multiFamilyAcceptAttempt.json();

    const claireToken = await getToken('usr-claire-331');
    const claireAcceptRes = await fetch(
      `${BASE_URL}/api/v1/invitations/${invitationIdToAccept}/respond`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${claireToken}`,
        },
        body: JSON.stringify({
          action: 'ACCEPT',
          userAccountId: 'usr-claire-331',
        }),
      }
    );
    const claireAcceptData = await claireAcceptRes.json();

    const bobToken = await getToken('usr-bob-331');
    const bobRejectRes = await fetch(
      `${BASE_URL}/api/v1/invitations/${invitationIdToReject}/respond`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bobToken}`,
        },
        body: JSON.stringify({
          action: 'REJECT',
          userAccountId: 'usr-bob-331',
        }),
      }
    );
    const bobRejectData = await bobRejectRes.json();

    recordGate(
      'TEST-03',
      'Invitation Acceptance, Rejection & Multi-Family Prevention',
      multiFamilyAcceptAttempt.status === 409 &&
        multiFamilyAcceptData.error === 'ONE_FAMILY_RULE_VIOLATION' &&
        claireAcceptRes.status === 200 &&
        claireAcceptData.membership?.status === 'PENDING_APPROVAL' &&
        bobRejectRes.status === 200 &&
        bobRejectData.invitation?.status === 'REJECTED',
      `Blocked multi-family accept (${multiFamilyAcceptAttempt.status}), accepted Claire into PENDING_APPROVAL (${claireAcceptData.membership?.id}), rejected Bob (${bobRejectData.invitation?.status})`
    );

    // ------------------------------------------------------------------
    // TEST 4: Membership Approval Workflow
    // ------------------------------------------------------------------
    const claireMembershipId = claireAcceptData.membership.id;
    const claireMemberId = claireAcceptData.member.id;

    // Maya (MEMBER) cannot approve pending memberships
    const mayaApproveAttempt = await fetch(
      `${BASE_URL}/api/v1/memberships/${claireMembershipId}/approve`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${mayaMemberToken}` },
      }
    );

    // David (ADMIN) approves Claire's membership
    const davidApproveRes = await fetch(
      `${BASE_URL}/api/v1/memberships/${claireMembershipId}/approve`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${davidAdminToken}` },
      }
    );
    const davidApproveData = await davidApproveRes.json();

    recordGate(
      'TEST-04',
      'Membership Approval by Household Admin/Owner',
      mayaApproveAttempt.status === 403 &&
        davidApproveRes.status === 200 &&
        davidApproveData.membership?.status === 'ACTIVE',
      `Blocked MEMBER approval (${mayaApproveAttempt.status}), ADMIN approved ${claireMembershipId} -> ${davidApproveData.membership?.status}`
    );

    // ------------------------------------------------------------------
    // TEST 5: Role Enforcement & Client Self-Promotion Blocking
    // ------------------------------------------------------------------
    // 5a: Maya (MEMBER) tries to self-promote via profile edit
    const mayaSelfPromoteProfile = await fetch(
      `${BASE_URL}/api/v1/members/fam-1/mem-maya`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mayaMemberToken}`,
        },
        body: JSON.stringify({ role: 'OWNER' }),
      }
    );
    const mayaSelfPromoteProfileData = await mayaSelfPromoteProfile.json();

    // 5b: Maya (MEMBER) tries to self-promote via role endpoint
    const mayaSelfPromoteRole = await fetch(
      `${BASE_URL}/api/v1/memberships/ms-fam1-maya/role`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mayaMemberToken}`,
        },
        body: JSON.stringify({ role: 'ADMIN' }),
      }
    );

    // 5c: David (ADMIN) tries to modify his own role
    const davidSelfRoleAttempt = await fetch(
      `${BASE_URL}/api/v1/memberships/ms-fam1-david/role`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${davidAdminToken}`,
        },
        body: JSON.stringify({ role: 'OWNER' }),
      }
    );

    // 5d: Sarah (OWNER) promotes Claire to ADMIN, then back to MEMBER
    const sarahPromoteClaire = await fetch(
      `${BASE_URL}/api/v1/memberships/${claireMembershipId}/role`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sarahOwnerToken}`,
        },
        body: JSON.stringify({ role: 'ADMIN' }),
      }
    );
    const sarahPromoteData = await sarahPromoteClaire.json();

    recordGate(
      'TEST-05',
      'Role Enforcement & Anti-Self-Promotion Guardrails',
      mayaSelfPromoteProfile.status === 403 &&
        mayaSelfPromoteProfileData.error === 'SELF_PROMOTION_FORBIDDEN' &&
        mayaSelfPromoteRole.status === 403 &&
        davidSelfRoleAttempt.status === 403 &&
        sarahPromoteClaire.status === 200 &&
        sarahPromoteData.membership?.role === 'ADMIN',
      `Blocked profile self-promotion (${mayaSelfPromoteProfile.status}), blocked role endpoint self-promotion (${mayaSelfPromoteRole.status}, ${davidSelfRoleAttempt.status}), OWNER assigned ADMIN (${sarahPromoteData.membership?.role})`
    );

    // ------------------------------------------------------------------
    // TEST 6: Member Removal & Access Revocation
    // ------------------------------------------------------------------
    const removeClaireRes = await fetch(
      `${BASE_URL}/api/v1/members/fam-1/${claireMemberId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sarahOwnerToken}` },
      }
    );

    // Claire attempts to fetch workspace after removal/revocation
    const claireWorkspaceAfterRevoke = await fetch(
      `${BASE_URL}/api/v1/workspace/fam-1`,
      {
        headers: { Authorization: `Bearer ${claireToken}` },
      }
    );
    const claireRevokeErr = await claireWorkspaceAfterRevoke.json();

    // Seeded revoked babysitter attempts sync pull
    const revokedSyncPull = await fetch(
      `${BASE_URL}/api/v1/sync/pull?familyId=fam-1&sinceVersion=0`,
      {
        headers: { Authorization: `Bearer ${revokedToken}` },
      }
    );
    const revokedSyncErr = await revokedSyncPull.json();

    recordGate(
      'TEST-06',
      'Member Removal & Immediate Access Revocation',
      removeClaireRes.status === 200 &&
        claireWorkspaceAfterRevoke.status === 403 &&
        claireRevokeErr.error === 'MEMBERSHIP_REVOKED' &&
        revokedSyncPull.status === 403 &&
        revokedSyncErr.error === 'MEMBERSHIP_REVOKED',
      `Removed ${claireMemberId} (${removeClaireRes.status}), blocked Claire workspace read (${claireWorkspaceAfterRevoke.status} ${claireRevokeErr.error}), blocked revoked sync pull (${revokedSyncPull.status} ${revokedSyncErr.error})`
    );

    // ------------------------------------------------------------------
    // TEST 7: Family Identity & Member Profile Updates (Motto, Birthdays, Emergency Contacts, Responsibilities)
    // ------------------------------------------------------------------
    const identityUpdateRes = await fetch(
      `${BASE_URL}/api/v1/workspace/fam-1/identity`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sarahOwnerToken}`,
        },
        body: JSON.stringify({
          motto: 'Stewardship, Kindness, and Shared Purpose — Verified 3.3.1',
          values: ['Stewardship', 'Kindness', 'Gratitude', 'Courage', 'Unity'],
        }),
      }
    );
    const identityUpdateData = await identityUpdateRes.json();

    const profileUpdateRes = await fetch(
      `${BASE_URL}/api/v1/members/fam-1/mem-lucas`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sarahOwnerToken}`,
        },
        body: JSON.stringify({
          responsibilities: ['Dishwasher Unloading', 'Evening Reading', 'Pet Feeding'],
          emergencyContact: {
            name: 'Sarah Henderson',
            relation: 'Mother & Primary Guardian',
            phone: '(555) 123-4567',
            medicalNotes: 'Severe peanut allergy — carry EpiPen Jr',
          },
          importantDates: [
            { id: 'date-lucas-bday', label: 'Lucas Birthday', date: '11-12', category: 'BIRTHDAY' },
            { id: 'date-lucas-piano', label: 'Winter Piano Recital', date: '12-10', category: 'SCHOOL' },
          ],
        }),
      }
    );
    const profileUpdateData = await profileUpdateRes.json();

    recordGate(
      'TEST-07',
      'Family Identity & Member Profile Updates (Motto, Emergency Contacts, Birthdays, Responsibilities)',
      identityUpdateRes.status === 200 &&
        identityUpdateData.workspace?.motto.includes('Verified 3.3.1') &&
        profileUpdateRes.status === 200 &&
        profileUpdateData.member?.responsibilities.includes('Pet Feeding') &&
        profileUpdateData.member?.importantDates.length === 2,
      `Updated motto ("${identityUpdateData.workspace?.motto}") and Lucas profile (${profileUpdateData.member?.responsibilities.length} responsibilities, ${profileUpdateData.member?.importantDates.length} dates)`
    );

    // ------------------------------------------------------------------
    // TEST 8: Family Isolation (fam-1 vs fam-2)
    // ------------------------------------------------------------------
    const crossFamWorkspace = await fetch(`${BASE_URL}/api/v1/workspace/fam-2`, {
      headers: { Authorization: `Bearer ${sarahOwnerToken}` },
    });
    const crossFamData = await crossFamWorkspace.json();

    const crossFamMemberWrite = await fetch(`${BASE_URL}/api/v1/members/fam-2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahOwnerToken}`,
      },
      body: JSON.stringify({ displayName: 'Intruder' }),
    });

    recordGate(
      'TEST-08',
      'Multi-Tenant Family Isolation (fam-1 vs fam-2)',
      crossFamWorkspace.status === 403 &&
        crossFamData.error === 'WORKSPACE_ISOLATION_VIOLATION' &&
        crossFamMemberWrite.status === 403,
      `Blocked fam-1 OWNER from reading fam-2 (${crossFamWorkspace.status} ${crossFamData.error}) and writing to fam-2 (${crossFamMemberWrite.status})`
    );

    // ------------------------------------------------------------------
    // TEST 9: Personal Workspace Record Privacy & Role-Based Finance Privacy
    // ------------------------------------------------------------------
    // 9a: Sarah fetches workspace -> sees own personalInfo & minor child Lucas personalInfo, but Maya's is redacted
    const sarahViewRes = await fetch(`${BASE_URL}/api/v1/workspace/fam-1`, {
      headers: { Authorization: `Bearer ${sarahOwnerToken}` },
    });
    const sarahViewData = await sarahViewRes.json();
    const sarahSelfObj = sarahViewData.members.find((m: any) => m.id === 'mem-sarah');
    const sarahLucasObj = sarahViewData.members.find((m: any) => m.id === 'mem-lucas');
    const sarahMayaObj = sarahViewData.members.find((m: any) => m.id === 'mem-maya');

    // 9b: Maya fetches workspace -> sees her own personalInfo, but Sarah's & David's are redacted
    const mayaViewRes = await fetch(`${BASE_URL}/api/v1/workspace/fam-1`, {
      headers: { Authorization: `Bearer ${mayaMemberToken}` },
    });
    const mayaViewData = await mayaViewRes.json();
    const mayaSelfObj = mayaViewData.members.find((m: any) => m.id === 'mem-maya');
    const mayaSarahObj = mayaViewData.members.find((m: any) => m.id === 'mem-sarah');

    // 9c: Lucas (CHILD) fetches workspace -> financial data (netWorth, accounts, budgets, transactions) is hidden
    const lucasViewRes = await fetch(`${BASE_URL}/api/v1/workspace/fam-1`, {
      headers: { Authorization: `Bearer ${lucasChildToken}` },
    });
    const lucasViewData = await lucasViewRes.json();

    // 9d: David (ADMIN) attempts to overwrite Sarah's personalInfo -> 403 PERSONAL_WORKSPACE_PRIVACY_VIOLATION
    const davidOverwriteSarahPersonal = await fetch(
      `${BASE_URL}/api/v1/members/fam-1/mem-sarah`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${davidAdminToken}`,
        },
        body: JSON.stringify({
          personalInfo: { privateNotes: 'Unauthorized intrusion' },
        }),
      }
    );
    const davidOverwriteData = await davidOverwriteSarahPersonal.json();

    recordGate(
      'TEST-09',
      'Personal Workspace Privacy & Child Financial Redaction',
      sarahSelfObj?.personalInfo !== null &&
        sarahLucasObj?.personalInfo !== null &&
        sarahMayaObj?.personalInfo === null &&
        sarahMayaObj?.personalInfoRedacted === true &&
        mayaSelfObj?.personalInfo !== null &&
        mayaSarahObj?.personalInfo === null &&
        lucasViewData.netWorth === null &&
        lucasViewData.transactions.length === 0 &&
        davidOverwriteSarahPersonal.status === 403 &&
        davidOverwriteData.error === 'PERSONAL_WORKSPACE_PRIVACY_VIOLATION',
      `Sarah sees own & minor Lucas personalInfo; Maya sees own (${mayaSelfObj?.personalInfo !== null}) while Sarah's is redacted (${mayaSarahObj?.personalInfoRedacted}); Lucas finance redacted (netWorth=${lucasViewData.netWorth}); blocked cross-member personalInfo write (${davidOverwriteSarahPersonal.status})`
    );

    // ------------------------------------------------------------------
    // TEST 10: Cross-Platform Consistency (Android Sync Push -> Web View; Web Edit -> Android Sync Pull)
    // ------------------------------------------------------------------
    // 10a: Android creates member "Noah Henderson" via /api/v1/sync/push
    const androidPushMemberRes = await fetch(`${BASE_URL}/api/v1/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahOwnerToken}`,
        'X-Idempotency-Key': 'ANDROID-PUSH-MEM-NOAH-331',
      },
      body: JSON.stringify({
        familyId: 'fam-1',
        entityType: 'FAMILY_MEMBER',
        entityId: 'mem-noah-android',
        operation: 'UPSERT',
        idempotencyKey: 'ANDROID-PUSH-MEM-NOAH-331',
        payload: {
          displayName: 'Noah Henderson',
          relationshipToPrimary: 'CHILD',
          role: 'CHILD',
          birthDate: '2021-04-10',
          isRestrictedProfile: true,
          pointsBalance: 30,
          responsibilities: ['Toy Cleanup'],
        },
      }),
    });
    const androidPushMemberData = await androidPushMemberRes.json();

    // Verify Web immediately sees "Noah Henderson" on GET /api/v1/workspace/fam-1
    const webAfterAndroidCreateRes = await fetch(`${BASE_URL}/api/v1/workspace/fam-1`, {
      headers: { Authorization: `Bearer ${sarahOwnerToken}` },
    });
    const webAfterAndroidCreateData = await webAfterAndroidCreateRes.json();
    const noahOnWeb = webAfterAndroidCreateData.members.find(
      (m: any) => m.id === 'mem-noah-android'
    );

    // 10b: Web edits Noah's profile -> Android pulls delta via GET /api/v1/sync/pull
    const webEditNoahRes = await fetch(
      `${BASE_URL}/api/v1/members/fam-1/mem-noah-android`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sarahOwnerToken}`,
        },
        body: JSON.stringify({
          displayName: 'Noah Alexander Henderson',
          responsibilities: ['Toy Cleanup', 'Bedtime Story Helper'],
        }),
      }
    );

    const androidPullRes = await fetch(
      `${BASE_URL}/api/v1/sync/pull?familyId=fam-1&sinceVersion=0`,
      {
        headers: { Authorization: `Bearer ${sarahOwnerToken}` },
      }
    );
    const androidPullData = await androidPullRes.json();
    const noahInAndroidPull = androidPullData.entities.find(
      (e: any) => e.entityType === 'FAMILY_MEMBER' && e.entityId === 'mem-noah-android'
    );

    recordGate(
      'TEST-10',
      'Cross-Platform Consistency (Android Push -> Web View & Web Edit -> Android Pull)',
      androidPushMemberRes.status === 200 &&
        Boolean(noahOnWeb) &&
        noahOnWeb.displayName === 'Noah Henderson' &&
        webEditNoahRes.status === 200 &&
        Boolean(noahInAndroidPull) &&
        noahInAndroidPull.payload?.displayName === 'Noah Alexander Henderson',
      `Android pushed mem-noah-android (v${androidPushMemberData.ack?.serverVersion}) -> Web saw "${noahOnWeb?.displayName}" -> Web updated to "${noahInAndroidPull?.payload?.displayName}" -> Android pulled v${noahInAndroidPull?.version}`
    );

    // ------------------------------------------------------------------
    // TEST 11: Offline Synchronization Idempotency & Relationship DAG Cycle Protection
    // ------------------------------------------------------------------
    // Replay the exact same Android sync push idempotency key
    const replayPushRes = await fetch(`${BASE_URL}/api/v1/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahOwnerToken}`,
        'X-Idempotency-Key': 'ANDROID-PUSH-MEM-NOAH-331',
      },
      body: JSON.stringify({
        familyId: 'fam-1',
        entityType: 'FAMILY_MEMBER',
        entityId: 'mem-noah-android',
        operation: 'UPSERT',
        idempotencyKey: 'ANDROID-PUSH-MEM-NOAH-331',
        payload: { displayName: 'Duplicate Should Not Apply' },
      }),
    });
    const replayPushData = await replayPushRes.json();

    // Attempt transitive PARENT_CHILD cycle: rel-2 is mem-sarah -> mem-lucas; try mem-lucas -> mem-sarah
    const cycleRelRes = await fetch(`${BASE_URL}/api/v1/relationships/fam-1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahOwnerToken}`,
      },
      body: JSON.stringify({
        member1Id: 'mem-lucas',
        member2Id: 'mem-sarah',
        relationshipType: 'PARENT_CHILD',
      }),
    });
    const cycleRelData = await cycleRelRes.json();

    recordGate(
      'TEST-11',
      'Offline Sync Idempotency & Relationship Graph DAG Cycle Prevention',
      replayPushRes.status === 200 &&
        replayPushData.ack?.idempotentReplay === true &&
        cycleRelRes.status === 400 &&
        cycleRelData.error === 'RELATIONSHIP_CYCLE_DETECTED',
      `Idempotent replay acknowledged (idempotentReplay=${replayPushData.ack?.idempotentReplay}), blocked PARENT_CHILD cycle (${cycleRelRes.status} ${cycleRelData.error})`
    );

    // ------------------------------------------------------------------
    // TEST 12: Image Storage Upload & Visibility Access Control
    // ------------------------------------------------------------------
    const sampleSvgDataUrl = `data:image/svg+xml;base64,${Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="30" fill="#173D35"/></svg>'
    ).toString('base64')}`;

    // Upload SHARED family logo as Sarah (OWNER)
    const uploadSharedLogoRes = await fetch(`${BASE_URL}/api/v1/media/fam-1/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sarahOwnerToken}`,
      },
      body: JSON.stringify({
        ownerMemberId: 'mem-sarah',
        category: 'FAMILY_LOGO',
        visibility: 'SHARED',
        mimeType: 'image/svg+xml',
        fileName: 'henderson-crest.svg',
        dataUrl: sampleSvgDataUrl,
      }),
    });
    const uploadSharedLogoData = await uploadSharedLogoRes.json();

    // Upload PERSONAL photo as Maya (MEMBER)
    const uploadPersonalPhotoRes = await fetch(`${BASE_URL}/api/v1/media/fam-1/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mayaMemberToken}`,
      },
      body: JSON.stringify({
        ownerMemberId: 'mem-maya',
        category: 'MEMBER_PHOTO',
        visibility: 'PERSONAL',
        mimeType: 'image/svg+xml',
        fileName: 'maya-private-journal-photo.svg',
        dataUrl: sampleSvgDataUrl,
      }),
    });
    const uploadPersonalPhotoData = await uploadPersonalPhotoRes.json();
    const personalMediaId = uploadPersonalPhotoData.mediaAsset?.id;

    // Maya can retrieve her own PERSONAL photo
    const mayaGetOwnMedia = await fetch(
      `${BASE_URL}/api/v1/media/fam-1/${personalMediaId}`,
      {
        headers: { Authorization: `Bearer ${mayaMemberToken}` },
      }
    );

    // David (ADMIN) is blocked from retrieving Maya's PERSONAL photo
    const davidGetMayaPersonalMedia = await fetch(
      `${BASE_URL}/api/v1/media/fam-1/${personalMediaId}`,
      {
        headers: { Authorization: `Bearer ${davidAdminToken}` },
      }
    );
    const davidMediaErr = await davidGetMayaPersonalMedia.json();

    // Revoked user is blocked from retrieving even SHARED family logo
    const sharedLogoId = uploadSharedLogoData.mediaAsset?.id;
    const revokedGetSharedMedia = await fetch(
      `${BASE_URL}/api/v1/media/fam-1/${sharedLogoId}`,
      {
        headers: { Authorization: `Bearer ${revokedToken}` },
      }
    );

    recordGate(
      'TEST-12',
      'Image Storage Upload, Retrieval & Personal/Revoked Access Control',
      uploadSharedLogoRes.status === 201 &&
        uploadPersonalPhotoRes.status === 201 &&
        mayaGetOwnMedia.status === 200 &&
        davidGetMayaPersonalMedia.status === 403 &&
        davidMediaErr.error === 'PERSONAL_MEDIA_ACCESS_DENIED' &&
        revokedGetSharedMedia.status === 403,
      `Uploaded SHARED logo (${sharedLogoId}) & PERSONAL photo (${personalMediaId}); owner read=200, non-owner read=403 (${davidMediaErr.error}), revoked read=${revokedGetSharedMedia.status}`
    );
  } finally {
    if (originalStoreSnapshot !== null) {
      fs.writeFileSync(STORE_PATH, originalStoreSnapshot, 'utf-8');
      await fetch(`${BASE_URL}/api/v1/admin/reset-store`, { method: 'POST' }).catch(() => {});
    }
  }

  console.log('----------------------------------------------------------------');
  const passedCount = results.filter((r) => r.passed).length;
  console.log(`SUMMARY: ${passedCount}/${results.length} STAGE 3.3.1 VERIFICATION TESTS PASSED`);
  console.log('================================================================');

  if (passedCount !== results.length) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Stage 3.3.1 verification failed with unhandled error:', err);
  process.exit(1);
});
