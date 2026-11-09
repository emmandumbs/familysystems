import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, setDoc, setLogLevel } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type {
  SharedAccount,
  SharedTransaction,
  SynchronizedEntityRecord,
  AuthoritativeWorkspace,
  AuthoritativeMembership,
} from './backupAndMigration';

// Suppress noisy gRPC background stream warnings when testing unauthenticated edge rules
setLogLevel('error');

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const serverAuth = getAuth(app);
export const serverFirestore = getFirestore(app, firebaseConfig.firestoreDatabaseId);

/**
 * Explicit Firestore Role & Conflict Policy:
 * - Role: Downstream, read-only projection mirror for client snapshot notifications.
 * - Synchronization Direction: Strictly unidirectional (Authoritative Backend DB -> Cloud Firestore).
 * - Conflict Policy: AUTHORITATIVE_BACKEND_WINS_BY_VERSION. Firestore is NEVER read by the backend
 *   as an authoritative source of truth and is NEVER permitted to act as a second independent write store.
 */
export const FIRESTORE_SYNCHRONIZATION_POLICY = {
  role: 'DOWNSTREAM_READ_ONLY_MIRROR',
  direction: 'BACKEND_TO_FIRESTORE_UNIDIRECTIONAL',
  authoritativeStore: 'BACKEND_RELATIONAL_STORE',
  conflictPolicy: 'AUTHORITATIVE_BACKEND_WINS_BY_VERSION',
  allowDirectClientAuthoritativeWrites: false,
} as const;

/**
 * Mirrors authoritative domain records to the provisioned Cloud Firestore database
 * (`ai-studio-familyos-8f842ec0-cec0-443c-b279-e4955acacfaf`) when an authenticated
 * Firebase user session is active on the SDK instance.
 */
export async function mirrorTransactionToFirestore(tx: SharedTransaction, account?: SharedAccount): Promise<void> {
  if (!serverAuth.currentUser) return;
  try {
    const txRef = doc(serverFirestore, 'workspaces', tx.familyId, 'transactions', tx.id);
    await setDoc(txRef, {
      id: tx.id,
      familyId: tx.familyId,
      accountId: tx.accountId,
      destinationAccountId: tx.destinationAccountId || null,
      title: tx.title,
      amountCents: tx.amountCents,
      transactionType: tx.transactionType,
      category: tx.category,
      transactionDate: tx.transactionDate,
      isReversal: tx.isReversal,
      reversalOfId: tx.reversalOfId || null,
      paidBy: tx.paidBy,
      idempotencyKey: tx.idempotencyKey || '',
    });

    if (account) {
      const accRef = doc(serverFirestore, 'workspaces', account.familyId, 'accounts', account.id);
      await setDoc(accRef, {
        id: account.id,
        familyId: account.familyId,
        name: account.name,
        accountType: account.accountType,
        currentBalanceCents: account.currentBalanceCents,
        isLiability: account.isLiability,
        institution: account.institution,
        updatedAt: Date.now(),
      });
    }
  } catch {
    // Non-fatal in background mirror
  }
}

export async function mirrorEntityToFirestore(entity: SynchronizedEntityRecord): Promise<void> {
  if (!serverAuth.currentUser) return;
  try {
    const entityKey = `${entity.entityType}_${entity.id}`;
    const entityRef = doc(serverFirestore, 'workspaces', entity.familyId, 'entities', entityKey);
    await setDoc(entityRef, {
      id: entity.id,
      familyId: entity.familyId,
      entityType: entity.entityType,
      version: entity.version,
      isDeleted: entity.isDeleted,
      updatedAt: entity.updatedAt,
      payloadJson: JSON.stringify(entity.data),
    });
  } catch {
    // Non-fatal in background mirror
  }
}

export async function mirrorWorkspaceToFirestore(
  workspace: AuthoritativeWorkspace,
  memberships: AuthoritativeMembership[]
): Promise<void> {
  if (!serverAuth.currentUser) return;
  try {
    const wsRef = doc(serverFirestore, 'workspaces', workspace.id);
    await setDoc(wsRef, {
      id: workspace.id,
      name: workspace.name,
      currencyCode: workspace.currencyCode,
      ownerUserId: workspace.ownerUserId,
      version: workspace.version,
      updatedAt: workspace.updatedAt,
      isDeleted: Boolean(workspace.isDeleted),
    });
    for (const m of memberships.filter((mem) => mem.familyId === workspace.id)) {
      const mRef = doc(serverFirestore, 'workspaces', workspace.id, 'memberships', m.userAccountId);
      await setDoc(mRef, m);
    }
  } catch {
    // Non-fatal in background mirror
  }
}
