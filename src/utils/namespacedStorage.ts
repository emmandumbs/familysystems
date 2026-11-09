/**
 * Zero-Trust Namespaced Client Cache Utility
 *
 * Ensures all temporary localStorage entries are strictly isolated by:
 *   `familyos_v4:${userAccountId}:${familyId}:${moduleName}:${collectionKey}`
 *
 * Prevents cross-account or cross-household leakage on shared browser profiles,
 * and purges all sensitive cached state on sign-out, revocation, or identity switch.
 */

const CACHE_PREFIX = 'familyos_v4';

const LEGACY_GLOBAL_KEYS = [
  'familyos_rel_checkins_v1',
  'familyos_rel_gratitude_v1',
  'familyos_rel_couple_v1',
  'familyos_rel_meetings_v1',
  'familyos_rel_experiences_v1',
  'familyos_rel_agreements_v1',
  'familyos_parenting_profiles',
  'familyos_parenting_routines',
  'familyos_parenting_study',
  'familyos_parenting_personal_goals',
  'familyos_parenting_lessons',
  'familyos_parenting_habits',
  'familyos_parenting_family_learning',
  'familyos_life_personal_tasks',
  'familyos_life_documents',
  'familyos_life_personal_lists',
  'familyos_life_contacts',
  'familyos_life_trips',
  'familyos_life_vehicles',
  'familyos_life_long_term_plans',
];

export function buildNamespacedStorageKey(params: {
  userAccountId: string;
  familyId: string;
  moduleName: string;
  key: string;
}): string {
  const safeUser = (params.userAccountId || 'anonymous').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const safeFamily = (params.familyId || 'unassigned').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const safeModule = (params.moduleName || 'general').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const safeKey = (params.key || 'state').replace(/[^a-zA-Z0-9_\-]/g, '_');
  return `${CACHE_PREFIX}:${safeUser}:${safeFamily}:${safeModule}:${safeKey}`;
}

export interface CacheScopeInput {
  userAccountId: string;
  familyId: string;
  moduleName?: string;
  key?: string;
}

export function readNamespacedCache<T>(
  params: { userAccountId: string; familyId: string; moduleName: string; key: string },
  fallback: T
): T;
export function readNamespacedCache<T>(
  scope: { userAccountId: string; familyId: string } | null | undefined,
  moduleName: string,
  key: string,
  fallback: T
): T;
export function readNamespacedCache<T>(
  arg1: any,
  arg2: any,
  arg3?: any,
  arg4?: any
): T {
  const isFourArg = arguments.length >= 4;
  const fallback: T = isFourArg ? arg4 : arg2;
  if (typeof window === 'undefined' || !arg1 || !arg1.userAccountId || !arg1.familyId) {
    return fallback;
  }
  const params = isFourArg
    ? {
        userAccountId: String(arg1.userAccountId),
        familyId: String(arg1.familyId),
        moduleName: String(arg2),
        key: String(arg3),
      }
    : {
        userAccountId: String(arg1.userAccountId),
        familyId: String(arg1.familyId),
        moduleName: String(arg1.moduleName || 'general'),
        key: String(arg1.key || 'state'),
      };
  try {
    const storageKey = buildNamespacedStorageKey(params);
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeNamespacedCache<T>(
  params: { userAccountId: string; familyId: string; moduleName: string; key: string },
  value: T
): void;
export function writeNamespacedCache<T>(
  scope: { userAccountId: string; familyId: string } | null | undefined,
  moduleName: string,
  key: string,
  value: T
): void;
export function writeNamespacedCache<T>(
  arg1: any,
  arg2: any,
  arg3?: any,
  arg4?: any
): void {
  const isFourArg = arguments.length >= 4;
  if (typeof window === 'undefined' || !arg1 || !arg1.userAccountId || !arg1.familyId) {
    return;
  }
  const params = isFourArg
    ? {
        userAccountId: String(arg1.userAccountId),
        familyId: String(arg1.familyId),
        moduleName: String(arg2),
        key: String(arg3),
      }
    : {
        userAccountId: String(arg1.userAccountId),
        familyId: String(arg1.familyId),
        moduleName: String(arg1.moduleName || 'general'),
        key: String(arg1.key || 'state'),
      };
  const value: T = isFourArg ? arg4 : arg2;
  try {
    const storageKey = buildNamespacedStorageKey(params);
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

export function clearNamespacedCacheForScope(userAccountId?: string, familyId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    // Remove legacy un-namespaced global keys so stale data never leaks
    for (const legacyKey of LEGACY_GLOBAL_KEYS) {
      window.localStorage.removeItem(legacyKey);
    }

    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      if (k.startsWith(`${CACHE_PREFIX}:`)) {
        if (!userAccountId || k.startsWith(`${CACHE_PREFIX}:${userAccountId}:`)) {
          if (!familyId || k.startsWith(`${CACHE_PREFIX}:${userAccountId}:${familyId}:`)) {
            keysToRemove.push(k);
          }
        }
      }
    }
    for (const k of keysToRemove) {
      window.localStorage.removeItem(k);
    }
  } catch {
    // Ignore
  }
}

export function purgeAllClientSessionCaches(): void {
  clearNamespacedCacheForScope();
}

export const IS_DEV_FIXTURE_MODE: boolean =
  typeof import.meta !== 'undefined' && (import.meta as any).env
    ? Boolean((import.meta as any).env.DEV) &&
      (import.meta as any).env.VITE_DISABLE_DEV_FIXTURES !== 'true'
    : process.env.NODE_ENV !== 'production';

