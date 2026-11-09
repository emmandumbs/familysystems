import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, type User } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDocFromServer,
  setDoc,
  setLogLevel,
  type Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { offlineSyncEngine } from './services/offlineSyncEngine';

setLogLevel('error');

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

function createPersistentFirestore(): Firestore {
  try {
    if (typeof window !== 'undefined' && window.navigator?.webdriver) {
      return getFirestore(app, firebaseConfig.firestoreDatabaseId);
    }
    return initializeFirestore(
      app,
      {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      },
      firebaseConfig.firestoreDatabaseId
    );
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
}

export const db = createPersistentFirestore();
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

if (typeof window !== 'undefined' && !window.navigator?.webdriver) {
  void testConnection();
}

export async function signInWithGooglePopup() {
  const result = await signInWithPopup(auth, googleProvider);
  const idToken = await result.user.getIdToken();
  return { user: result.user, idToken };
}

export async function signOutFirebase() {
  await signOut(auth);
}

export const signOutFromFirebase = signOutFirebase;


export function subscribeToFirebaseAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

const LEGACY_TYPE_REMAP: Record<string, string> = {
  RELATIONSHIPS_CENTER_STATE: 'REL_CHECKIN',
  RELATIONSHIP_STATE: 'REL_CHECKIN',
  PARENTING_GROWTH_CENTER_STATE: 'PAR_HABIT',
  PARENTING_GROWTH_STATE: 'PAR_HABIT',
  LIFE_MANAGEMENT_CENTER_STATE: 'LIFE_PERSONAL_TASK',
  LIFE_MANAGEMENT_STATE: 'LIFE_PERSONAL_TASK',
};

export interface DomainSyncResult {
  ok: boolean;
  status: number;
  version?: number;
  conflictDetected?: boolean;
  conflictingFields?: string[];
  serverRecord?: Record<string, unknown>;
  error?: string;
}

/**
 * Synchronizes an individual typed domain entity to the authoritative backend store
 * (`/api/v1/entities/:familyId`) with per-record version & conflict checking,
 * and mirrors to Cloud Firestore when authenticated.
 */
export async function syncDomainRecordToDatabase(params: {
  sessionToken?: string;
  familyId?: string;
  entityType: string;
  entityId: string;
  data: Record<string, unknown>;
  baseVersion?: number;
  baseSnapshot?: Record<string, unknown>;
  forceOverwrite?: boolean;
  operationType?: 'UPSERT' | 'DELETE';
}): Promise<boolean> {
  const result = await syncDomainRecordWithResult(params);
  return result.ok;
}

export async function syncDomainRecordWithResult(params: {
  sessionToken?: string;
  familyId?: string;
  entityType: string;
  entityId: string;
  data: Record<string, unknown>;
  baseVersion?: number;
  baseSnapshot?: Record<string, unknown>;
  forceOverwrite?: boolean;
  operationType?: 'UPSERT' | 'DELETE';
}): Promise<DomainSyncResult> {
  const {
    sessionToken,
    familyId,
    entityType,
    entityId,
    data,
    baseVersion,
    baseSnapshot,
    forceOverwrite,
    operationType = 'UPSERT',
  } = params;

  const resolvedFamilyId = (familyId || '').trim();
  if (!resolvedFamilyId || !sessionToken) {
    return { ok: false, status: 400, error: 'Missing active familyId or sessionToken' };
  }

  const normalizedType = LEGACY_TYPE_REMAP[entityType] || entityType;
  let syncRes: DomainSyncResult = { ok: false, status: 0 };

  try {
    const res = await fetch(`/api/v1/entities/${encodeURIComponent(resolvedFamilyId)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        entityType: normalizedType,
        entityId,
        operationType,
        data,
        baseVersion,
        baseSnapshot,
        forceOverwrite,
      }),
    });

    const payload = await res.json().catch(() => ({}));
    if (res.status === 409) {
      return {
        ok: false,
        status: 409,
        conflictDetected: true,
        conflictingFields: payload.conflictingFields || [],
        serverRecord: payload.serverRecord?.data || payload.serverRecord,
        version: payload.serverVersion,
        error: payload.message || 'Concurrent modification conflict detected.',
      };
    }

    syncRes = {
      ok: res.ok,
      status: res.status,
      version: payload.entity?.version,
      error: res.ok ? undefined : payload.message || payload.error || 'Sync failed',
    };
  } catch (err: any) {
    // Queue offline mutation into durable outbox so it auto-replays upon reconnect
    try {
      offlineSyncEngine.enqueueMutation({
        url: `/api/v1/entities/${encodeURIComponent(resolvedFamilyId)}`,
        method: 'POST',
        body: {
          entityType: normalizedType,
          entityId,
          operationType,
          data,
          baseVersion,
          baseSnapshot,
          forceOverwrite,
        },
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
        domain: 'entities',
        actionDescription: `${operationType} ${normalizedType} (${entityId})`,
      });
    } catch {
      // Ignore queue error
    }

    syncRes = {
      ok: true, // Optimistically treat as accepted for local offline workflow
      status: 200,
      version: (baseVersion || 0) + 1,
    };
  }

  if (auth.currentUser && syncRes.ok) {
    const path = `workspaces/${resolvedFamilyId}/entities/${normalizedType}_${entityId}`;
    try {
      await setDoc(doc(db, 'workspaces', resolvedFamilyId, 'entities', `${normalizedType}_${entityId}`), {
        id: entityId,
        familyId: resolvedFamilyId,
        entityType: normalizedType,
        version: syncRes.version || 1,
        isDeleted: operationType === 'DELETE',
        updatedAt: Date.now(),
        payloadJson: JSON.stringify(data).slice(0, 60000),
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Missing or insufficient permissions')) {
        try {
          handleFirestoreError(error, OperationType.WRITE, path);
        } catch {
          // Logged by handleFirestoreError
        }
      }
    }
  }

  return syncRes;
}
