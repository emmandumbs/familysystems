import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { signInWithGooglePopup, signOutFirebase } from '../firebase';
import {
  clearNamespacedCacheForScope,
  purgeAllClientSessionCaches,
} from '../utils/namespacedStorage';

export interface AuthenticatedActor {
  userAccountId: string;
  email: string;
  displayName: string;
  authMethod: 'FIREBASE_ID_TOKEN' | 'SESSION_TOKEN';
}

export interface ServerResolvedMembership {
  id: string;
  familyId: string;
  userAccountId: string;
  email: string;
  displayName: string;
  memberProfileId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'CHILD' | 'GUEST';
  status: string;
}

export interface DomainMutationResponse<T = any> {
  ok: boolean;
  status: number;
  record?: T;
  version?: number;
  conflictDetected?: boolean;
  conflictingFields?: string[];
  serverRecord?: T;
  error?: string;
}

export interface WorkspaceAuthContextValue {
  sessionToken: string;
  actor: AuthenticatedActor | null;
  activeFamilyId: string | null;
  activeMembership: ServerResolvedMembership | null;
  selectedRole: string;
  isTestHarnessMode: boolean;
  isRestoringSession: boolean;
  authError: string | null;
  signInWithFirebaseGoogle: () => Promise<boolean>;
  switchTestHarnessRole: (roleKey: string) => Promise<string>;
  restoreAuthoritativeSession: (overrideToken?: string) => Promise<{
    activeFamilyId: string | null;
    actor: AuthenticatedActor | null;
    activeMembership: ServerResolvedMembership | null;
  }>;
  signOutSession: () => Promise<void>;
  fetchDomainModule: (
    moduleName: 'relationships' | 'parenting' | 'life'
  ) => Promise<Record<string, any[]> | null>;
  saveDomainRecord: <T extends Record<string, any>>(params: {
    moduleName: 'relationships' | 'parenting' | 'life';
    collection: string;
    recordId: string;
    data: T;
    baseVersion?: number;
    baseSnapshot?: Record<string, unknown>;
    forceOverwrite?: boolean;
  }) => Promise<DomainMutationResponse<T>>;
  removeDomainRecord: (params: {
    moduleName: 'relationships' | 'parenting' | 'life';
    collection: string;
    recordId: string;
  }) => Promise<boolean>;
  uploadVaultDocument: (payload: {
    id?: string;
    title: string;
    category: string;
    expirationDate: string;
    renewalReminder: string;
    accessLevel: string;
    fileName: string;
    mimeType: string;
    contentBase64: string;
  }) => Promise<DomainMutationResponse>;
  downloadVaultDocument: (docId: string) => Promise<{
    ok: boolean;
    fileName?: string;
    mimeType?: string;
    contentBase64?: string;
    error?: string;
  }>;
}

const TEST_HARNESS_ROLE_MAP: Record<string, string> = {
  OWNER: 'usr-sarah-owner',
  ADMIN: 'usr-david-admin',
  MEMBER: 'usr-maya-member',
  CHILD: 'usr-lucas-child',
  GUEST: 'usr-martha-guest',
  REVOKED: 'usr-revoked-former',
};

const IS_NON_PROD_TEST_HARNESS =
  typeof import.meta !== 'undefined' && Boolean((import.meta as any).env?.DEV);

const WorkspaceAuthContext = createContext<WorkspaceAuthContextValue | null>(null);

export const WorkspaceAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sessionToken, setSessionToken] = useState<string>('');
  const [actor, setActor] = useState<AuthenticatedActor | null>(null);
  const [activeFamilyId, setActiveFamilyId] = useState<string | null>(null);
  const [activeMembership, setActiveMembership] = useState<ServerResolvedMembership | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('OWNER');
  const [isRestoringSession, setIsRestoringSession] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const restoreAuthoritativeSession = useCallback(
    async (overrideToken?: string) => {
      const token = overrideToken || sessionToken;
      if (!token) {
        return { activeFamilyId: null, actor: null, activeMembership: null };
      }
      try {
        const res = await fetch('/api/v1/session/restore', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            purgeAllClientSessionCaches();
          }
          return { activeFamilyId: null, actor: null, activeMembership: null };
        }
        const data = await res.json();
        const resolvedActor: AuthenticatedActor | null = data.actor || null;
        const resolvedMembership: ServerResolvedMembership | null =
          data.activeMembership ||
          (Array.isArray(data.memberships) ? data.memberships[0] : null) ||
          null;
        const resolvedFamilyId: string | null =
          data.activeFamilyId || resolvedMembership?.familyId || null;

        if (resolvedMembership && resolvedMembership.status === 'REVOKED') {
          clearNamespacedCacheForScope(resolvedActor?.userAccountId, resolvedFamilyId || undefined);
        }

        setActor(resolvedActor);
        setActiveMembership(resolvedMembership);
        setActiveFamilyId(resolvedFamilyId);
        if (resolvedMembership?.role) {
          setSelectedRole(resolvedMembership.role);
        }
        return {
          activeFamilyId: resolvedFamilyId,
          actor: resolvedActor,
          activeMembership: resolvedMembership,
        };
      } catch {
        return { activeFamilyId: null, actor: null, activeMembership: null };
      }
    },
    [sessionToken]
  );

  const signInWithFirebaseGoogle = useCallback(async (): Promise<boolean> => {
    try {
      setAuthError(null);
      const { idToken } = await signInWithGooglePopup();
      const res = await fetch('/api/v1/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firebaseIdToken: idToken }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setAuthError(err.message || 'Firebase authentication failed.');
        return false;
      }
      const data = await res.json();
      if (data.token) {
        purgeAllClientSessionCaches();
        setSessionToken(data.token);
        await restoreAuthoritativeSession(data.token);
        return true;
      }
      return false;
    } catch (err: any) {
      setAuthError(err?.message || 'Google Sign-In cancelled or failed.');
      return false;
    }
  }, [restoreAuthoritativeSession]);

  const switchTestHarnessRole = useCallback(
    async (roleKey: string): Promise<string> => {
      if (!IS_NON_PROD_TEST_HARNESS) {
        setAuthError('Role simulation is disabled in production builds.');
        return '';
      }
      const previousUserId = actor?.userAccountId;
      const previousFamilyId = activeFamilyId;
      if (previousUserId) {
        clearNamespacedCacheForScope(previousUserId, previousFamilyId || undefined);
      }

      setSelectedRole(roleKey);
      const targetUserAccountId = TEST_HARNESS_ROLE_MAP[roleKey] || 'usr-sarah-owner';
      try {
        setIsRestoringSession(true);
        const res = await fetch('/api/v1/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userAccountId: targetUserAccountId }),
        });
        if (!res.ok) {
          setIsRestoringSession(false);
          return '';
        }
        const data = await res.json();
        if (data.token) {
          setSessionToken(data.token);
          await restoreAuthoritativeSession(data.token);
          setIsRestoringSession(false);
          return data.token as string;
        }
      } catch {
        // Offline fallback
      }
      setIsRestoringSession(false);
      return '';
    },
    [actor?.userAccountId, activeFamilyId, restoreAuthoritativeSession]
  );

  const signOutSession = useCallback(async () => {
    try {
      if (sessionToken) {
        await fetch('/api/v1/auth/revoke', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({ revokeAllForUser: false }),
        });
      }
      await signOutFirebase().catch(() => undefined);
    } finally {
      purgeAllClientSessionCaches();
      setSessionToken('');
      setActor(null);
      setActiveMembership(null);
      setActiveFamilyId(null);
    }
  }, [sessionToken]);

  useEffect(() => {
    // Remove any legacy un-namespaced keys immediately on boot
    clearNamespacedCacheForScope();
    if (IS_NON_PROD_TEST_HARNESS && !sessionToken) {
      void switchTestHarnessRole('OWNER');
    } else {
      setIsRestoringSession(false);
    }
  }, []);

  const fetchDomainModule = useCallback(
    async (
      moduleName: 'relationships' | 'parenting' | 'life'
    ): Promise<Record<string, any[]> | null> => {
      if (!sessionToken || !activeFamilyId) return null;
      try {
        const res = await fetch(
          `/api/v1/domain/${encodeURIComponent(activeFamilyId)}/${moduleName}`,
          {
            headers: { Authorization: `Bearer ${sessionToken}` },
          }
        );
        if (!res.ok) return null;
        const payload = await res.json();
        return payload.collections || null;
      } catch {
        return null;
      }
    },
    [sessionToken, activeFamilyId]
  );

  const saveDomainRecord = useCallback(
    async <T extends Record<string, any>>(params: {
      moduleName: 'relationships' | 'parenting' | 'life';
      collection: string;
      recordId: string;
      data: T;
      baseVersion?: number;
      baseSnapshot?: Record<string, unknown>;
      forceOverwrite?: boolean;
    }): Promise<DomainMutationResponse<T>> => {
      if (!sessionToken || !activeFamilyId) {
        return {
          ok: false,
          status: 401,
          error: 'No active authenticated family workspace session.',
        };
      }
      try {
        const res = await fetch(
          `/api/v1/domain/${encodeURIComponent(activeFamilyId)}/${params.moduleName}/${encodeURIComponent(
            params.collection
          )}/${encodeURIComponent(params.recordId)}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${sessionToken}`,
            },
            body: JSON.stringify({
              data: params.data,
              baseVersion: params.baseVersion ?? params.data.version,
              baseSnapshot: params.baseSnapshot,
              forceOverwrite: params.forceOverwrite,
            }),
          }
        );

        const body = await res.json().catch(() => ({}));
        if (res.status === 409) {
          return {
            ok: false,
            status: 409,
            conflictDetected: true,
            conflictingFields: body.conflictingFields || [],
            serverRecord: body.serverRecord,
            version: body.serverVersion,
            error: body.message || 'Concurrent modification conflict detected.',
          };
        }

        if (!res.ok) {
          return {
            ok: false,
            status: res.status,
            error: body.message || body.error || 'Failed to save record.',
          };
        }

        return {
          ok: true,
          status: res.status,
          record: body.record,
          version: body.version,
        };
      } catch (err: any) {
        return {
          ok: false,
          status: 0,
          error: err?.message || 'Network error while saving record.',
        };
      }
    },
    [sessionToken, activeFamilyId]
  );

  const removeDomainRecord = useCallback(
    async (params: {
      moduleName: 'relationships' | 'parenting' | 'life';
      collection: string;
      recordId: string;
    }): Promise<boolean> => {
      if (!sessionToken || !activeFamilyId) return false;
      try {
        const res = await fetch(
          `/api/v1/domain/${encodeURIComponent(activeFamilyId)}/${params.moduleName}/${encodeURIComponent(
            params.collection
          )}/${encodeURIComponent(params.recordId)}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${sessionToken}` },
          }
        );
        return res.ok;
      } catch {
        return false;
      }
    },
    [sessionToken, activeFamilyId]
  );

  const uploadVaultDocument = useCallback(
    async (payload: {
      id?: string;
      title: string;
      category: string;
      expirationDate: string;
      renewalReminder: string;
      accessLevel: string;
      fileName: string;
      mimeType: string;
      contentBase64: string;
    }): Promise<DomainMutationResponse> => {
      if (!sessionToken || !activeFamilyId) {
        return { ok: false, status: 401, error: 'Not authenticated.' };
      }
      try {
        const res = await fetch(
          `/api/v1/domain/${encodeURIComponent(activeFamilyId)}/documents/upload`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${sessionToken}`,
            },
            body: JSON.stringify(payload),
          }
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          return {
            ok: false,
            status: res.status,
            error: body.message || body.error || 'Document vault upload rejected.',
          };
        }
        return {
          ok: true,
          status: res.status,
          record: body.document,
          version: body.version,
        };
      } catch (err: any) {
        return { ok: false, status: 0, error: err?.message || 'Upload failed.' };
      }
    },
    [sessionToken, activeFamilyId]
  );

  const downloadVaultDocument = useCallback(
    async (docId: string) => {
      if (!sessionToken || !activeFamilyId) {
        return { ok: false, error: 'Not authenticated.' };
      }
      try {
        const res = await fetch(
          `/api/v1/domain/${encodeURIComponent(activeFamilyId)}/documents/${encodeURIComponent(
            docId
          )}/download`,
          {
            headers: { Authorization: `Bearer ${sessionToken}` },
          }
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          return {
            ok: false,
            error: body.message || body.error || 'Access denied or document unavailable.',
          };
        }
        return {
          ok: true,
          fileName: body.fileName,
          mimeType: body.mimeType,
          contentBase64: body.contentBase64,
        };
      } catch (err: any) {
        return { ok: false, error: err?.message || 'Download failed.' };
      }
    },
    [sessionToken, activeFamilyId]
  );

  return (
    <WorkspaceAuthContext.Provider
      value={{
        sessionToken,
        actor,
        activeFamilyId,
        activeMembership,
        selectedRole,
        isTestHarnessMode: IS_NON_PROD_TEST_HARNESS,
        isRestoringSession,
        authError,
        signInWithFirebaseGoogle,
        switchTestHarnessRole,
        restoreAuthoritativeSession,
        signOutSession,
        fetchDomainModule,
        saveDomainRecord,
        removeDomainRecord,
        uploadVaultDocument,
        downloadVaultDocument,
      }}
    >
      {children}
    </WorkspaceAuthContext.Provider>
  );
};

export function useWorkspaceAuth(): WorkspaceAuthContextValue {
  const ctx = useContext(WorkspaceAuthContext);
  if (!ctx) {
    throw new Error('useWorkspaceAuth must be used inside a WorkspaceAuthProvider');
  }
  return ctx;
}
