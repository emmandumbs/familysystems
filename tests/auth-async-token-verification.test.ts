process.env.NODE_ENV = 'test';

import assert from 'node:assert/strict';
import http from 'http';
import { createTestFirebaseIdToken } from '../src/server/firebaseAdminVerifier';
import { issueSignedSessionToken, clearRevokedSessionsForTest } from '../src/server/authAndRbac';

let serverProcess: any = null;
let serverPort = 0;
let baseUrl = '';

function makeRequest(
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body: any = null
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const req = http.request(
      url,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            const parsed = raw ? JSON.parse(raw) : {};
            resolve({ status: res.statusCode || 500, body: parsed });
          } catch {
            resolve({ status: res.statusCode || 500, body: raw });
          }
        });
      }
    );
    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runAuthVerificationSuite() {
  console.log('================================================================');
  console.log('🚀 Running FamilyOS Asynchronous Auth & Revocable Session Suite');
  console.log('================================================================');

  clearRevokedSessionsForTest();

  // Dynamically import server.ts app
  const serverModule = await import('../server');
  const app = await serverModule.getApp();

  await new Promise<void>((resolve) => {
    const listener = (app as any).listen(0, '127.0.0.1', () => {
      const addr = listener.address();
      serverPort = typeof addr === 'object' && addr ? addr.port : 0;
      baseUrl = `http://127.0.0.1:${serverPort}`;
      serverProcess = listener;
      resolve();
    });
  });

  try {
    const testUid = 'usr-test-async-auth-1';
    const testEmail = 'sarah.async@familyos.local';

    // 1. Valid Asynchronous Firebase ID Token Exchange
    const validIdToken = createTestFirebaseIdToken({
      uid: testUid,
      email: testEmail,
      displayName: 'Sarah Async Test',
      email_verified: true,
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    const syncRes = await makeRequest(
      'POST',
      '/api/v1/auth/session/sync',
      {},
      {
        firebaseIdToken: validIdToken,
        deviceName: 'Pixel 8 Pro Test',
        platform: 'Android',
        userAgent: 'FamilyOS-Android-Test-Runner/1.0',
      }
    );

    assert.equal(syncRes.status, 200, '[TEST 1] Session sync should return 200 OK');
    assert.ok(syncRes.body.token, '[TEST 1] Returns signed session bearer token');
    assert.equal(syncRes.body.user.id, testUid, '[TEST 1] Returns authenticated user ID');
    assert.equal(syncRes.body.session.deviceName, 'Pixel 8 Pro Test', '[TEST 1] Records device name');
    console.log('  ✓ [TEST 1] PASS: Asynchronous Firebase ID token exchange establishes session');

    const sessionBearerToken = syncRes.body.token;

    // 2. Reject Tampered or Invalid Firebase ID Token
    const badTokenRes = await makeRequest(
      'POST',
      '/api/v1/auth/session/sync',
      {},
      { firebaseIdToken: 'invalid.tampered.jwt' }
    );
    assert.equal(badTokenRes.status, 401, '[TEST 2] Tampered JWT must return 401');
    console.log('  ✓ [TEST 2] PASS: Tampered or invalid JWT is strictly rejected (401)');

    // 3. Reject Expired Firebase ID Token
    const expiredIdToken = createTestFirebaseIdToken({
      uid: testUid,
      email: testEmail,
      exp: Math.floor(Date.now() / 1000) - 100, // Expired
    });
    const expiredRes = await makeRequest(
      'POST',
      '/api/v1/auth/session/sync',
      {},
      { firebaseIdToken: expiredIdToken }
    );
    assert.equal(expiredRes.status, 401, '[TEST 3] Expired JWT must return 401');
    console.log('  ✓ [TEST 3] PASS: Expired JWT is strictly rejected (401)');

    // 4. Multi-Device Session Listing
    // Sync a second device session
    const secondIdToken = createTestFirebaseIdToken({
      uid: testUid,
      email: testEmail,
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const secondSyncRes = await makeRequest(
      'POST',
      '/api/v1/auth/session/sync',
      {},
      {
        firebaseIdToken: secondIdToken,
        deviceName: 'MacBook Pro Chrome',
        platform: 'Web',
      }
    );
    assert.equal(secondSyncRes.status, 200, '[TEST 4] Second device sync succeeds');

    const sessionsListRes = await makeRequest('GET', '/api/v1/auth/sessions', {
      Authorization: `Bearer ${sessionBearerToken}`,
    });
    assert.equal(sessionsListRes.status, 200, '[TEST 4] List sessions returns 200 OK');
    assert.ok(Array.isArray(sessionsListRes.body.sessions), '[TEST 4] Returns sessions array');
    assert.ok(sessionsListRes.body.sessions.length >= 2, '[TEST 4] Contains multiple device sessions');
    console.log('  ✓ [TEST 4] PASS: GET /api/v1/auth/sessions lists active device sessions');

    // 5. Single-Session Revocation
    const targetSessionId = sessionsListRes.body.sessions.find(
      (s: any) => s.deviceName === 'MacBook Pro Chrome'
    )?.id;
    assert.ok(targetSessionId, 'Target session found for revocation');

    const revokeSingleRes = await makeRequest(
      'DELETE',
      `/api/v1/auth/sessions/${targetSessionId}`,
      { Authorization: `Bearer ${sessionBearerToken}` }
    );
    assert.equal(revokeSingleRes.status, 200, '[TEST 5] Single session revocation returns 200 OK');

    const checkRevokedList = await makeRequest('GET', '/api/v1/auth/sessions', {
      Authorization: `Bearer ${sessionBearerToken}`,
    });
    const revokedSess = checkRevokedList.body.sessions.find((s: any) => s.id === targetSessionId);
    assert.ok(revokedSess?.isRevoked, '[TEST 5] Session marked as revoked');
    console.log('  ✓ [TEST 5] PASS: DELETE /api/v1/auth/sessions/:id revokes specific device');

    // 6. Revoke All Other Sessions
    const revokeOthersRes = await makeRequest(
      'POST',
      '/api/v1/auth/sessions/revoke-others',
      { Authorization: `Bearer ${sessionBearerToken}` },
      {}
    );
    assert.equal(revokeOthersRes.status, 200, '[TEST 6] Revoke others returns 200 OK');
    assert.ok(revokeOthersRes.body.revokedOthers, '[TEST 6] Confirms revokedOthers flag');
    console.log('  ✓ [TEST 6] PASS: POST /api/v1/auth/sessions/revoke-others revokes all other devices');

    // 7. Session Revocation Sign-Out Endpoint
    const revokeSelfRes = await makeRequest(
      'POST',
      '/api/v1/auth/revoke',
      { Authorization: `Bearer ${sessionBearerToken}` },
      { revokeAllForUser: false }
    );
    assert.equal(revokeSelfRes.status, 200, '[TEST 7] Auth revoke returns 200 OK');

    const subsequentProtectedRes = await makeRequest('GET', '/api/v1/auth/sessions', {
      Authorization: `Bearer ${sessionBearerToken}`,
    });
    assert.equal(
      subsequentProtectedRes.status,
      401,
      '[TEST 7] Revoked session token is denied protected access (401)'
    );
    console.log('  ✓ [TEST 7] PASS: Sign-out invalidates session bearer token immediately');

    // 8. Email Verification Gating
    const unverifiedUid = 'usr-unverified-1';
    const unverifiedIdToken = createTestFirebaseIdToken({
      uid: unverifiedUid,
      email: 'unverified@familyos.local',
      email_verified: false,
    });
    const unverifiedSync = await makeRequest(
      'POST',
      '/api/v1/auth/session/sync',
      {},
      { firebaseIdToken: unverifiedIdToken }
    );
    assert.equal(unverifiedSync.status, 200, '[TEST 8] Sync allowed for unverified user');
    assert.equal(unverifiedSync.body.emailVerified, false, '[TEST 8] Flag reflects unverified state');
    console.log('  ✓ [TEST 8] PASS: Unverified email returns emailVerified=false in sync payload');

    // 9. GDPR Account Deletion
    const deleteUid = 'usr-delete-me-1';
    const deleteIdToken = createTestFirebaseIdToken({
      uid: deleteUid,
      email: 'delete.me@familyos.local',
      email_verified: true,
    });
    const deleteSync = await makeRequest(
      'POST',
      '/api/v1/auth/session/sync',
      {},
      { firebaseIdToken: deleteIdToken }
    );
    const deleteSessionToken = deleteSync.body.token;

    const accountDeleteRes = await makeRequest(
      'DELETE',
      '/api/v1/account/me',
      { Authorization: `Bearer ${deleteSessionToken}` }
    );
    assert.equal(accountDeleteRes.status, 200, '[TEST 9] GDPR deletion returns 200 OK');
    assert.ok(accountDeleteRes.body.success, '[TEST 9] Confirms deletion success');

    // Subsequent access by deleted account must fail
    const deletedAccessRes = await makeRequest(
      'POST',
      '/api/v1/auth/session/sync',
      {},
      { firebaseIdToken: deleteIdToken }
    );
    assert.equal(deletedAccessRes.status, 401, '[TEST 9] Deleted account sync is rejected (401)');
    console.log('  ✓ [TEST 9] PASS: GDPR account deletion purges account and revokes future access');

    console.log('================================================================');
    console.log('Execution Results: All 9 Tests Passed Successfully!');
    console.log('================================================================');
  } finally {
    if (serverProcess) {
      serverProcess.close();
    }
  }
}

runAuthVerificationSuite().catch((err) => {
  console.error('❌ Auth Verification Suite Failed:', err);
  process.exit(1);
});
