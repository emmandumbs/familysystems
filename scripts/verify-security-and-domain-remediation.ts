import crypto from 'crypto';
import {
  validateProductionAuthConfig,
  isTestHarnessAuthAllowed,
  registerTrustedFirebasePublicKey,
  verifyFirebaseJwtCryptographically,
  issueSignedSessionToken,
  verifyBearerToken,
  revokeSessionToken,
  isSessionRevoked,
} from '../src/server/authAndRbac';
import type { SharedStore } from '../src/server/backupAndMigration';
import firebaseConfig from '../firebase-applet-config.json';
import {
  readNamespacedCache,
  writeNamespacedCache,
  clearNamespacedCacheForScope,
  purgeAllClientSessionCaches,
} from '../src/utils/namespacedStorage';

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';

interface GateResult {
  id: string;
  name: string;
  passed: boolean;
  details: string;
}

const results: GateResult[] = [];

function recordGate(id: string, name: string, passed: boolean, details: string) {
  results.push({ id, name, passed, details });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} [${id}] ${name} — ${details}`);
}

function base64UrlEncode(buf: Buffer | string): string {
  const b = typeof buf === 'string' ? Buffer.from(buf, 'utf8') : buf;
  return b.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function runVerificationSuite() {
  console.log('================================================================================');
  console.log('FAMILYOS — CRITICAL SECURITY & DOMAIN PERSISTENCE REMEDIATION VERIFICATION SUITE');
  console.log('================================================================================\n');

  // ---------------------------------------------------------------------------
  // GATE 0.1: Production Auth Config Secret Validation (Reject Missing/Derived)
  // ---------------------------------------------------------------------------
  const missingCheck = validateProductionAuthConfig({
    NODE_ENV: 'production',
  } as unknown as NodeJS.ProcessEnv);

  const derivedCheck = validateProductionAuthConfig({
    NODE_ENV: 'production',
    FAMILYOS_SESSION_SECRET: `${firebaseConfig.projectId}-derived-secret-key-123456`,
  } as unknown as NodeJS.ProcessEnv);

  const validProdCheck = validateProductionAuthConfig({
    NODE_ENV: 'production',
    FAMILYOS_SESSION_SECRET: crypto.randomBytes(32).toString('hex'),
  } as unknown as NodeJS.ProcessEnv);

  const testHarnessProdAllowed = isTestHarnessAuthAllowed({
    NODE_ENV: 'production',
  } as unknown as NodeJS.ProcessEnv);

  recordGate(
    'G0-01',
    'Production startup secret enforcement & test-harness lockout',
    !missingCheck.valid && !derivedCheck.valid && validProdCheck.valid && !testHarnessProdAllowed,
    `missingRejected=${!missingCheck.valid}, derivedProjectIdRejected=${!derivedCheck.valid}, testHarnessInProdAllowed=${testHarnessProdAllowed}, highEntropyAccepted=${validProdCheck.valid}`
  );

  // ---------------------------------------------------------------------------
  // GATE 0.2: Cryptographic RS256 Firebase JWT Verification & Negative Cases
  // ---------------------------------------------------------------------------
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const wrongKeyPair = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const testKid = 'test-rs256-kid-2026';
  registerTrustedFirebasePublicKey(testKid, publicKey);

  const projectId = firebaseConfig.projectId;
  const nowSec = Math.floor(Date.now() / 1000);
  const mockStore = {
    memberships: [
      {
        id: 'ms-sarah',
        familyId: 'fam-1',
        userAccountId: 'usr-sarah-owner',
        memberProfileId: 'mem-sarah',
        email: 'sarah@familyos.app',
        displayName: 'Sarah Jenkins',
        role: 'OWNER',
        status: 'ACTIVE',
      },
    ],
  } as unknown as SharedStore;

  function signRs256Jwt(
    header: Record<string, unknown>,
    payload: Record<string, unknown>,
    privKeyPem: string
  ): string {
    const h = base64UrlEncode(JSON.stringify(header));
    const p = base64UrlEncode(JSON.stringify(payload));
    const signingInput = `${h}.${p}`;
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signingInput);
    signer.end();
    const sig = signer.sign(privKeyPem);
    return `${signingInput}.${base64UrlEncode(sig)}`;
  }

  // 1) Valid RS256 JWT
  const validJwt = signRs256Jwt(
    { alg: 'RS256', typ: 'JWT', kid: testKid },
    {
      iss: `https://securetoken.google.com/${projectId}`,
      aud: projectId,
      sub: 'usr-sarah-owner',
      email: 'sarah@familyos.app',
      iat: nowSec - 60,
      exp: nowSec + 3600,
    },
    privateKey
  );
  const validActor = verifyFirebaseJwtCryptographically(validJwt, mockStore);

  // 2) Forged signature (signed with wrong RSA private key)
  const forgedJwt = signRs256Jwt(
    { alg: 'RS256', typ: 'JWT', kid: testKid },
    {
      iss: `https://securetoken.google.com/${projectId}`,
      aud: projectId,
      sub: 'usr-sarah-owner',
      iat: nowSec - 60,
      exp: nowSec + 3600,
    },
    wrongKeyPair.privateKey
  );
  const forgedActor = verifyFirebaseJwtCryptographically(forgedJwt, mockStore);

  // 3) alg: none attack
  const noneHeader = base64UrlEncode(JSON.stringify({ alg: 'none', typ: 'JWT', kid: testKid }));
  const nonePayload = base64UrlEncode(
    JSON.stringify({
      iss: `https://securetoken.google.com/${projectId}`,
      aud: projectId,
      sub: 'usr-sarah-owner',
      iat: nowSec - 60,
      exp: nowSec + 3600,
    })
  );
  const algNoneJwt = `${noneHeader}.${nonePayload}.fakesig`;
  const algNoneActor = verifyFirebaseJwtCryptographically(algNoneJwt, mockStore);

  // 4) Tampered claims after signing
  const validParts = validJwt.split('.');
  const tamperedPayload = base64UrlEncode(
    JSON.stringify({
      iss: `https://securetoken.google.com/${projectId}`,
      aud: projectId,
      sub: 'usr-attacker-escalated',
      iat: nowSec - 60,
      exp: nowSec + 3600,
    })
  );
  const tamperedJwt = `${validParts[0]}.${tamperedPayload}.${validParts[2]}`;
  const tamperedActor = verifyFirebaseJwtCryptographically(tamperedJwt, mockStore);

  // 5) Expired token
  const expiredJwt = signRs256Jwt(
    { alg: 'RS256', typ: 'JWT', kid: testKid },
    {
      iss: `https://securetoken.google.com/${projectId}`,
      aud: projectId,
      sub: 'usr-sarah-owner',
      iat: nowSec - 7200,
      exp: nowSec - 1800,
    },
    privateKey
  );
  const expiredActor = verifyFirebaseJwtCryptographically(expiredJwt, mockStore);

  // 6) Wrong audience
  const wrongAudJwt = signRs256Jwt(
    { alg: 'RS256', typ: 'JWT', kid: testKid },
    {
      iss: `https://securetoken.google.com/${projectId}`,
      aud: 'other-firebase-project',
      sub: 'usr-sarah-owner',
      iat: nowSec - 60,
      exp: nowSec + 3600,
    },
    privateKey
  );
  const wrongAudActor = verifyFirebaseJwtCryptographically(wrongAudJwt, mockStore);

  recordGate(
    'G0-02',
    'Cryptographic RS256 JWT verification rejects forged, alg:none, tampered, expired & wrong-aud tokens',
    Boolean(validActor) &&
      forgedActor === null &&
      algNoneActor === null &&
      tamperedActor === null &&
      expiredActor === null &&
      wrongAudActor === null,
    `valid=${Boolean(validActor)}, forged=${forgedActor === null}, algNone=${algNoneActor === null}, tampered=${tamperedActor === null}, expired=${expiredActor === null}, wrongAud=${wrongAudActor === null}`
  );

  // ---------------------------------------------------------------------------
  // GATE 0.3: Session Token Revocation & Forged Bearer Rejection Over HTTP
  // ---------------------------------------------------------------------------
  const tempToken = issueSignedSessionToken({
    userAccountId: 'usr-sarah-owner',
    email: 'sarah@familyos.app',
    displayName: 'Sarah Jenkins',
  });
  const beforeRevoke = verifyBearerToken(tempToken, mockStore);
  revokeSessionToken(tempToken);
  const afterRevoke = verifyBearerToken(tempToken, mockStore);
  const revokedFlag = isSessionRevoked({
    rawToken: tempToken,
    userAccountId: 'usr-sarah-owner',
  });

  // Also test HTTP /api/v1/auth/session with forged 3-part JWT and arbitrary userAccountId
  const forgedHttpRes = await fetch(`${BASE_URL}/api/v1/auth/session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${forgedJwt}`,
    },
    body: JSON.stringify({}),
  });

  const arbitraryUserRes = await fetch(`${BASE_URL}/api/v1/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userAccountId: 'usr-arbitrary-unregistered-attacker-999' }),
  });

  recordGate(
    'G0-03',
    'Session revocation invalidates active tokens and /api/v1/auth/session blocks forged JWTs & arbitrary user IDs',
    Boolean(beforeRevoke) &&
      afterRevoke === null &&
      revokedFlag &&
      forgedHttpRes.status === 401 &&
      arbitraryUserRes.status === 403,
    `beforeRevoke=${Boolean(beforeRevoke)}, afterRevoke=${afterRevoke}, forgedHttpStatus=${forgedHttpRes.status}, arbitraryUserStatus=${arbitraryUserRes.status}`
  );

  // Acquire valid sessions for OWNER (Sarah), ADMIN (David), and CHILD (Lucas)
  async function getHarnessToken(userAccountId: string): Promise<string> {
    const r = await fetch(`${BASE_URL}/api/v1/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userAccountId }),
    });
    const d = await r.json();
    return d.token || '';
  }

  const ownerToken = await getHarnessToken('usr-sarah-owner');
  const adminToken = await getHarnessToken('usr-david-admin');
  const childToken = await getHarnessToken('usr-lucas-child');

  // ---------------------------------------------------------------------------
  // GATE 1.1: Authoritative /api/v1/session/restore & Cross-Family Isolation
  // ---------------------------------------------------------------------------
  const restoreRes = await fetch(`${BASE_URL}/api/v1/session/restore`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  const restoreBody = await restoreRes.json();

  const crossFamilyRes = await fetch(`${BASE_URL}/api/v1/domain/fam-unauthorized-999/relationships`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });

  recordGate(
    'G1-01',
    'Authoritative session restore resolves server membership and blocks cross-family access (403)',
    restoreRes.status === 200 &&
      restoreBody.activeMembership?.familyId === 'fam-1' &&
      restoreBody.activeMembership?.role === 'OWNER' &&
      crossFamilyRes.status === 403,
    `restoredFamily=${restoreBody.activeMembership?.familyId}, role=${restoreBody.activeMembership?.role}, crossFamilyStatus=${crossFamilyRes.status}`
  );

  // ---------------------------------------------------------------------------
  // GATE 1.2: Namespaced Local Storage Isolation & Purge on Sign-Out
  // ---------------------------------------------------------------------------
  const memStore = new Map<string, string>();
  (globalThis as any).window = {
    localStorage: {
      get length() {
        return memStore.size;
      },
      key(i: number) {
        return Array.from(memStore.keys())[i] ?? null;
      },
      getItem(k: string) {
        return memStore.get(k) ?? null;
      },
      setItem(k: string, v: string) {
        memStore.set(k, v);
      },
      removeItem(k: string) {
        memStore.delete(k);
      },
    },
  };

  const scopeUserA = {
    userAccountId: 'usr-sarah-owner',
    familyId: 'fam-1',
    moduleName: 'relationships',
    key: 'checkins',
  };
  const scopeUserB = {
    userAccountId: 'usr-david-admin',
    familyId: 'fam-1',
    moduleName: 'relationships',
    key: 'checkins',
  };
  writeNamespacedCache(scopeUserA, [{ id: 'rc-private-a' }]);
  writeNamespacedCache(scopeUserB, [{ id: 'rc-private-b' }]);

  const readA = readNamespacedCache<Array<{ id: string }>>(scopeUserA, []);
  const readB = readNamespacedCache<Array<{ id: string }>>(scopeUserB, []);
  const isolated = readA[0]?.id === 'rc-private-a' && readB[0]?.id === 'rc-private-b';

  clearNamespacedCacheForScope('usr-sarah-owner', 'fam-1');
  const afterClearA = readNamespacedCache<Array<{ id: string }>>(scopeUserA, []);
  const afterClearB = readNamespacedCache<Array<{ id: string }>>(scopeUserB, []);

  purgeAllClientSessionCaches();
  const afterPurgeB = readNamespacedCache<Array<{ id: string }>>(scopeUserB, []);

  recordGate(
    'G1-02',
    'Namespaced localStorage isolates users/families on shared device and purges on logout',
    isolated && afterClearA.length === 0 && afterClearB.length === 1 && afterPurgeB.length === 0,
    `isolated=${isolated}, afterClearA=${afterClearA.length}, afterClearB=${afterClearB.length}, afterPurgeAll=${afterPurgeB.length}`
  );

  // ---------------------------------------------------------------------------
  // GATE 2.1: Cross-Device Authoritative Hydration & Private Reflection Filtering
  // ---------------------------------------------------------------------------
  const privCheckinId = `rc-priv-${Date.now()}`;
  const sharedCheckinId = `rc-shared-${Date.now()}`;

  const putPrivRes = await fetch(
    `${BASE_URL}/api/v1/domain/fam-1/relationships/checkins/${privCheckinId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        data: {
          id: privCheckinId,
          memberName: 'Sarah Jenkins',
          moodScore: 4,
          energyLevel: 'Balanced',
          gratitudeNote: 'Private personal reflection only for Sarah',
          supportNeeded: 'Quiet reading hour',
          isPrivate: true,
        },
      }),
    }
  );

  const putSharedRes = await fetch(
    `${BASE_URL}/api/v1/domain/fam-1/relationships/checkins/${sharedCheckinId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        data: {
          id: sharedCheckinId,
          memberName: 'Sarah Jenkins',
          moodScore: 5,
          energyLevel: 'Energized',
          gratitudeNote: 'Shared family appreciation from Device A',
          supportNeeded: 'None',
          isPrivate: false,
        },
      }),
    }
  );

  const ownerHydrateRes = await fetch(`${BASE_URL}/api/v1/domain/fam-1/relationships`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  const ownerHydrate = await ownerHydrateRes.json();
  const ownerSeesPrivate = ownerHydrate.collections?.checkins?.some(
    (c: any) => c.id === privCheckinId
  );
  const ownerSeesShared = ownerHydrate.collections?.checkins?.some(
    (c: any) => c.id === sharedCheckinId
  );

  const childHydrateRes = await fetch(`${BASE_URL}/api/v1/domain/fam-1/relationships`, {
    headers: { Authorization: `Bearer ${childToken}` },
  });
  const childHydrate = await childHydrateRes.json();
  const childSeesPrivate = childHydrate.collections?.checkins?.some(
    (c: any) => c.id === privCheckinId
  );
  const childSeesShared = childHydrate.collections?.checkins?.some(
    (c: any) => c.id === sharedCheckinId
  );

  recordGate(
    'G2-01',
    'Cross-device GET hydration & server-side privacy filtering of private check-ins',
    putPrivRes.status === 200 &&
      putSharedRes.status === 200 &&
      Boolean(ownerSeesPrivate) &&
      Boolean(ownerSeesShared) &&
      !childSeesPrivate &&
      Boolean(childSeesShared),
    `ownerSeesPrivate=${ownerSeesPrivate}, ownerSeesShared=${ownerSeesShared}, childSeesPrivate=${childSeesPrivate}, childSeesShared=${childSeesShared}`
  );

  // ---------------------------------------------------------------------------
  // GATE 2.2: CPL-01 Couple Connection Enclave Server Enforcement
  // ---------------------------------------------------------------------------
  const coupleId = `cpl-ritual-${Date.now()}`;
  const ownerCouplePut = await fetch(
    `${BASE_URL}/api/v1/domain/fam-1/relationships/couple/${coupleId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        data: {
          id: coupleId,
          title: 'Spousal Alignment Check-In',
          category: 'Goal',
          cadence: 'Weekly',
          nextDate: '2026-11-15',
          completedCount: 4,
          notes: 'Strict couple enclave record',
        },
      }),
    }
  );

  const childCouplePut = await fetch(
    `${BASE_URL}/api/v1/domain/fam-1/relationships/couple/${coupleId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${childToken}`,
      },
      body: JSON.stringify({
        data: {
          id: coupleId,
          title: 'Child attempting to overwrite couple enclave',
        },
      }),
    }
  );

  const childCoupleHydrate = await fetch(`${BASE_URL}/api/v1/domain/fam-1/relationships`, {
    headers: { Authorization: `Bearer ${childToken}` },
  });
  const childCoupleBody = await childCoupleHydrate.json();
  const childCoupleCount = (childCoupleBody.collections?.couple || []).length;

  recordGate(
    'G2-02',
    'CPL-01 Couple Connection enclave enforced on server (OWNER allowed, CHILD 403 & 0 records leaked)',
    ownerCouplePut.status === 200 && childCouplePut.status === 403 && childCoupleCount === 0,
    `ownerPut=${ownerCouplePut.status}, childPut=${childCouplePut.status}, childCoupleRecordsLeaked=${childCoupleCount}`
  );

  // ---------------------------------------------------------------------------
  // GATE 2.3: Per-Record Versioning & 409 Conflict Detection
  // ---------------------------------------------------------------------------
  const childProfId = `cp-conflict-test-${Date.now()}`;
  const v1Res = await fetch(
    `${BASE_URL}/api/v1/domain/fam-1/parenting/childProfiles/${childProfId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        data: {
          id: childProfId,
          name: 'Lucas Jenkins',
          age: 9,
          stage: 'Elementary',
          currentMilestone: 'Reading chapter books',
          milestoneProgress: 50,
          strengths: 'Lego engineering',
          supportFocus: 'Bedtime routine',
        },
      }),
    }
  );
  const v1Body = await v1Res.json();

  const v2Res = await fetch(
    `${BASE_URL}/api/v1/domain/fam-1/parenting/childProfiles/${childProfId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        baseVersion: 1,
        data: {
          id: childProfId,
          name: 'Lucas Jenkins',
          age: 9,
          stage: 'Elementary',
          currentMilestone: 'Reading chapter books',
          milestoneProgress: 75,
          strengths: 'Lego engineering',
          supportFocus: 'Bedtime routine',
        },
      }),
    }
  );
  const v2Body = await v2Res.json();

  const conflictRes = await fetch(
    `${BASE_URL}/api/v1/domain/fam-1/parenting/childProfiles/${childProfId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        baseVersion: 1,
        data: {
          id: childProfId,
          name: 'Lucas Jenkins',
          age: 9,
          stage: 'Elementary',
          currentMilestone: 'Reading chapter books',
          milestoneProgress: 60,
          strengths: 'Lego engineering',
          supportFocus: 'Bedtime routine',
        },
      }),
    }
  );
  const conflictBody = await conflictRes.json();

  recordGate(
    'G2-03',
    'Per-record optimistic concurrency detects stale baseVersion conflicting edits with 409 VERSION_CONFLICT',
    v1Body.version === 1 &&
      v2Body.version === 2 &&
      conflictRes.status === 409 &&
      conflictBody.error === 'VERSION_CONFLICT',
    `v1=${v1Body.version}, v2=${v2Body.version}, conflictStatus=${conflictRes.status} (${conflictBody.error})`
  );

  // ---------------------------------------------------------------------------
  // GATE 2.4: Synchronized Entity Allowlist & Legacy Monolithic Blob Rejection
  // ---------------------------------------------------------------------------
  const legacyBlobRes = await fetch(`${BASE_URL}/api/v1/entities/fam-1`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({
      entityType: 'RELATIONSHIPS_CENTER_STATE',
      entityId: 'rel-state-fam-1',
      data: { massiveBlob: true },
    }),
  });
  const legacyBlobBody = await legacyBlobRes.json();

  recordGate(
    'G2-04',
    'Synchronized Entity API rejects deprecated monolithic state blobs (400 UNSUPPORTED_ENTITY_TYPE)',
    legacyBlobRes.status === 400 && legacyBlobBody.error === 'UNSUPPORTED_ENTITY_TYPE',
    `status=${legacyBlobRes.status}, error=${legacyBlobBody.error}`
  );

  // ---------------------------------------------------------------------------
  // GATE 2.5: AES-256-GCM Encrypted Document Vault Upload, Malware Rejection & RBAC Download
  // ---------------------------------------------------------------------------
  const exePayloadBase64 = Buffer.from('MZ\x90\x00\x03\x00\x00\x00malicious-payload').toString('base64');
  const malwareRes = await fetch(`${BASE_URL}/api/v1/domain/fam-1/documents/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({
      title: 'Suspicious Installer',
      category: 'Other',
      ownerName: 'Sarah Jenkins',
      accessLevel: 'Owner & Admin Only',
      fileName: 'installer.exe',
      mimeType: 'application/x-msdownload',
      contentBase64: exePayloadBase64,
    }),
  });

  const validPdfBytes = Buffer.from('%PDF-1.7\n1 0 obj\n<< /Title (Family Trust Deed 2026) >>\nendobj\n%%EOF', 'utf8');
  const validUploadRes = await fetch(`${BASE_URL}/api/v1/domain/fam-1/documents/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({
      title: 'Jenkins Family Living Trust 2026',
      category: 'Legal',
      ownerName: 'Sarah & David Jenkins',
      expiryDate: '2036-01-01',
      storageLocation: 'AES-256-GCM Vault',
      accessLevel: 'Owner & Admin Only',
      notes: 'Confidential legal trust deed',
      fileName: 'jenkins-family-trust-2026.pdf',
      mimeType: 'application/pdf',
      contentBase64: validPdfBytes.toString('base64'),
    }),
  });
  const validUploadBody = await validUploadRes.json();
  const uploadedDocId = validUploadBody.document?.id;

  const childDownloadRes = await fetch(
    `${BASE_URL}/api/v1/domain/fam-1/documents/${uploadedDocId}/download`,
    {
      headers: { Authorization: `Bearer ${childToken}` },
    }
  );

  const adminDownloadRes = await fetch(
    `${BASE_URL}/api/v1/domain/fam-1/documents/${uploadedDocId}/download`,
    {
      headers: { Authorization: `Bearer ${adminToken}` },
    }
  );
  const adminDownloadBody = await adminDownloadRes.json();
  const decryptedBytes = Buffer.from(adminDownloadBody.contentBase64 || '', 'base64');
  const bytesMatch = decryptedBytes.equals(validPdfBytes);

  recordGate(
    'G2-05',
    'AES-256-GCM Document Vault rejects executables (400), blocks unauthorized roles (403), and round-trips encrypted PDFs',
    malwareRes.status === 400 &&
      (validUploadRes.status === 200 || validUploadRes.status === 201) &&
      Boolean(uploadedDocId) &&
      childDownloadRes.status === 403 &&
      adminDownloadRes.status === 200 &&
      bytesMatch,
    `malwareStatus=${malwareRes.status}, uploadStatus=${validUploadRes.status}, childDownloadStatus=${childDownloadRes.status}, adminDownloadStatus=${adminDownloadRes.status}, bytesMatch=${bytesMatch}`
  );

  // Summary
  console.log('\n================================================================================');
  const passedCount = results.filter((r) => r.passed).length;
  console.log(`VERIFICATION SUMMARY: ${passedCount} / ${results.length} GATES PASSED`);
  console.log('================================================================================');

  if (passedCount !== results.length) {
    process.exit(1);
  }
}

runVerificationSuite().catch((err) => {
  console.error('Verification suite error:', err);
  process.exit(1);
});
