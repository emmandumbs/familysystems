import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { Express, Request, Response, NextFunction } from 'express';
import type { SharedStore, SynchronizedEntityRecord } from './backupAndMigration';
import {
  canAccessCoupleEnclave,
  canAccessDocumentByLevel,
  canAccessMinorHealthRecord,
  canAccessPrivateJournal,
  getSessionSecret,
  resolveServerMembership,
} from './authAndRbac';

const VAULT_DIR = path.resolve(process.cwd(), 'data', 'vault');
const MAX_VAULT_DOCUMENT_BYTES = 2 * 1024 * 1024; // 2 MB binary limit
const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
]);
const ALLOWED_DOCUMENT_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.txt']);
const FORBIDDEN_EXECUTABLE_EXTENSIONS = new Set([
  '.exe',
  '.bat',
  '.cmd',
  '.sh',
  '.js',
  '.mjs',
  '.cjs',
  '.msi',
  '.vbs',
  '.ps1',
  '.scr',
  '.dll',
  '.so',
  '.dylib',
  '.php',
  '.py',
  '.rb',
  '.jar',
  '.com',
  '.html',
  '.htm',
]);

export const ALLOWED_SYNCHRONIZED_ENTITY_TYPES = new Set([
  'GOAL',
  'PROJECT',
  'MILESTONE',
  'TASK',
  'CHECKLIST_ITEM',
  'CALENDAR_EVENT',
  'ROUTINE',
  'ROUTINE_OCCURRENCE',
  'REMINDER',
  'ANNOUNCEMENT',
  'INVITATION',
  'FAMILY_MEMBER',
  'FAMILY_RELATIONSHIP',
  'WELLBEING_PROFILE',
  'HEALTH_ALLERGY',
  'HEALTH_MEDICATION',
  'REFLECTION_JOURNAL',
  'EMERGENCY_CONTACT',
  'EMERGENCY_SUPPLY',
  'MEAL_PLAN',
  'RECIPE',
  'PANTRY_ITEM',
  'GROCERY_ITEM',
  'CHORE',
  'WARDROBE_ITEM',
  'OUTFIT_PLAN',
  'HOME_ASSET',
  'SAVINGS_GOAL',
  'RECURRING_BILL',
  'INVESTMENT_HOLDING',
  // Typed per-record domain entities (replaces monolithic state blobs)
  'REL_CHECKIN',
  'REL_GRATITUDE',
  'REL_COUPLE_PLAN',
  'REL_MEETING',
  'REL_MEETING_TEMPLATE',
  'REL_EXPERIENCE',
  'REL_AGREEMENT',
  'REL_NETWORK_CONTACT',
  'PAR_CHILD_PROFILE',
  'PAR_CHILD_ROUTINE',
  'PAR_ROUTINE_TEMPLATE',
  'PAR_STUDY_ITEM',
  'PAR_PERSONAL_GOAL',
  'PAR_MICRO_LESSON',
  'PAR_HABIT',
  'PAR_FAMILY_LEARNING',
  'PAR_RESOURCE',
  'SPR_REFLECTION',
  'LIFE_PERSONAL_TASK',
  'LIFE_DOCUMENT',
  'LIFE_PERSONAL_LIST',
  'LIFE_CONTACT',
  'LIFE_TRAVEL_PLAN',
  'LIFE_VEHICLE',
  'LIFE_LONG_TERM_PLAN',
  'LIFE_CHECKLIST_TEMPLATE',
  // Family Section dedicated entities
  'FAMILY_GALLERY_ALBUM',
  'FAMILY_GALLERY_PHOTO',
  'FAMILY_CONSTITUTION_VERSION',
  'FAMILY_TRADITION',
  'FAMILY_SHARED_ACTIVITY',
  'FAMILY_RULE',
  'FAMILY_EXTENDED_RELATIVE',
]);

export const MAX_ENTITY_PAYLOAD_BYTES = 2 * 1024 * 1024; // 2 MB per entity record (supports photo/document attachments)

const RELATIONSHIPS_COLLECTIONS: Record<string, { entityType: string; conflictPolicy: 'FIELD_AWARE_MERGE' | 'APPEND_ONLY' }> = {
  checkins: { entityType: 'REL_CHECKIN', conflictPolicy: 'FIELD_AWARE_MERGE' },
  checkIns: { entityType: 'REL_CHECKIN', conflictPolicy: 'FIELD_AWARE_MERGE' },
  gratitude: { entityType: 'REL_GRATITUDE', conflictPolicy: 'FIELD_AWARE_MERGE' },
  gratitudeNotes: { entityType: 'REL_GRATITUDE', conflictPolicy: 'FIELD_AWARE_MERGE' },
  couple: { entityType: 'REL_COUPLE_PLAN', conflictPolicy: 'FIELD_AWARE_MERGE' },
  couplePlans: { entityType: 'REL_COUPLE_PLAN', conflictPolicy: 'FIELD_AWARE_MERGE' },
  couple_plans: { entityType: 'REL_COUPLE_PLAN', conflictPolicy: 'FIELD_AWARE_MERGE' },
  meetings: { entityType: 'REL_MEETING', conflictPolicy: 'FIELD_AWARE_MERGE' },
  meeting_templates: { entityType: 'REL_MEETING_TEMPLATE', conflictPolicy: 'FIELD_AWARE_MERGE' },
  meetingTemplates: { entityType: 'REL_MEETING_TEMPLATE', conflictPolicy: 'FIELD_AWARE_MERGE' },
  experiences: { entityType: 'REL_EXPERIENCE', conflictPolicy: 'FIELD_AWARE_MERGE' },
  agreements: { entityType: 'REL_AGREEMENT', conflictPolicy: 'FIELD_AWARE_MERGE' },
  network_contacts: { entityType: 'REL_NETWORK_CONTACT', conflictPolicy: 'FIELD_AWARE_MERGE' },
  networkContacts: { entityType: 'REL_NETWORK_CONTACT', conflictPolicy: 'FIELD_AWARE_MERGE' },
};

const PARENTING_COLLECTIONS: Record<string, { entityType: string; conflictPolicy: 'FIELD_AWARE_MERGE' | 'APPEND_ONLY' }> = {
  childProfiles: { entityType: 'PAR_CHILD_PROFILE', conflictPolicy: 'FIELD_AWARE_MERGE' },
  child_profiles: { entityType: 'PAR_CHILD_PROFILE', conflictPolicy: 'FIELD_AWARE_MERGE' },
  childRoutines: { entityType: 'PAR_CHILD_ROUTINE', conflictPolicy: 'FIELD_AWARE_MERGE' },
  child_routines: { entityType: 'PAR_CHILD_ROUTINE', conflictPolicy: 'FIELD_AWARE_MERGE' },
  routineTemplates: { entityType: 'PAR_ROUTINE_TEMPLATE', conflictPolicy: 'FIELD_AWARE_MERGE' },
  routine_templates: { entityType: 'PAR_ROUTINE_TEMPLATE', conflictPolicy: 'FIELD_AWARE_MERGE' },
  studyItems: { entityType: 'PAR_STUDY_ITEM', conflictPolicy: 'FIELD_AWARE_MERGE' },
  study_items: { entityType: 'PAR_STUDY_ITEM', conflictPolicy: 'FIELD_AWARE_MERGE' },
  personalGrowthGoals: { entityType: 'PAR_PERSONAL_GOAL', conflictPolicy: 'FIELD_AWARE_MERGE' },
  personal_goals: { entityType: 'PAR_PERSONAL_GOAL', conflictPolicy: 'FIELD_AWARE_MERGE' },
  lessons: { entityType: 'PAR_MICRO_LESSON', conflictPolicy: 'FIELD_AWARE_MERGE' },
  micro_lessons: { entityType: 'PAR_MICRO_LESSON', conflictPolicy: 'FIELD_AWARE_MERGE' },
  habits: { entityType: 'PAR_HABIT', conflictPolicy: 'FIELD_AWARE_MERGE' },
  familyLearningItems: { entityType: 'PAR_FAMILY_LEARNING', conflictPolicy: 'FIELD_AWARE_MERGE' },
  family_learning: { entityType: 'PAR_FAMILY_LEARNING', conflictPolicy: 'FIELD_AWARE_MERGE' },
  parentingResources: { entityType: 'PAR_RESOURCE', conflictPolicy: 'FIELD_AWARE_MERGE' },
  parenting_resources: { entityType: 'PAR_RESOURCE', conflictPolicy: 'FIELD_AWARE_MERGE' },
  resources: { entityType: 'PAR_RESOURCE', conflictPolicy: 'FIELD_AWARE_MERGE' },
  spiritual_reflections: { entityType: 'SPR_REFLECTION', conflictPolicy: 'APPEND_ONLY' },
};

const LIFE_COLLECTIONS: Record<string, { entityType: string; conflictPolicy: 'FIELD_AWARE_MERGE' | 'APPEND_ONLY' }> = {
  personalTasks: { entityType: 'LIFE_PERSONAL_TASK', conflictPolicy: 'FIELD_AWARE_MERGE' },
  personal_tasks: { entityType: 'LIFE_PERSONAL_TASK', conflictPolicy: 'FIELD_AWARE_MERGE' },
  documents: { entityType: 'LIFE_DOCUMENT', conflictPolicy: 'FIELD_AWARE_MERGE' },
  personalLists: { entityType: 'LIFE_PERSONAL_LIST', conflictPolicy: 'FIELD_AWARE_MERGE' },
  personal_lists: { entityType: 'LIFE_PERSONAL_LIST', conflictPolicy: 'FIELD_AWARE_MERGE' },
  contacts: { entityType: 'LIFE_CONTACT', conflictPolicy: 'FIELD_AWARE_MERGE' },
  trips: { entityType: 'LIFE_TRAVEL_PLAN', conflictPolicy: 'FIELD_AWARE_MERGE' },
  travel_plans: { entityType: 'LIFE_TRAVEL_PLAN', conflictPolicy: 'FIELD_AWARE_MERGE' },
  vehicles: { entityType: 'LIFE_VEHICLE', conflictPolicy: 'FIELD_AWARE_MERGE' },
  longTermPlans: { entityType: 'LIFE_LONG_TERM_PLAN', conflictPolicy: 'FIELD_AWARE_MERGE' },
  long_term_plans: { entityType: 'LIFE_LONG_TERM_PLAN', conflictPolicy: 'FIELD_AWARE_MERGE' },
  checklistTemplates: { entityType: 'LIFE_CHECKLIST_TEMPLATE', conflictPolicy: 'FIELD_AWARE_MERGE' },
  checklist_templates: { entityType: 'LIFE_CHECKLIST_TEMPLATE', conflictPolicy: 'FIELD_AWARE_MERGE' },
  health_records: { entityType: 'WELLBEING_PROFILE', conflictPolicy: 'FIELD_AWARE_MERGE' },
  emergency_supplies: { entityType: 'EMERGENCY_SUPPLY', conflictPolicy: 'FIELD_AWARE_MERGE' },
};

function deriveVaultKey(): Buffer {
  const secret = getSessionSecret();
  return crypto.createHash('sha256').update(`familyos-vault-aes256-${secret}`).digest();
}

function encryptVaultBuffer(plainBuf: Buffer): { ivHex: string; authTagHex: string; cipherHex: string } {
  const key = deriveVaultKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainBuf), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ivHex: iv.toString('hex'),
    authTagHex: authTag.toString('hex'),
    cipherHex: encrypted.toString('hex'),
  };
}

function decryptVaultBuffer(envelope: { ivHex: string; authTagHex: string; cipherHex: string }): Buffer {
  const key = deriveVaultKey();
  const iv = Buffer.from(envelope.ivHex, 'hex');
  const authTag = Buffer.from(envelope.authTagHex, 'hex');
  const encrypted = Buffer.from(envelope.cipherHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

/**
 * Evaluates server-side visibility/privacy rules for any domain record before returning to a caller.
 */
export function canCallerReadDomainEntity(
  store: SharedStore,
  callerMembership: {
    familyId: string;
    userAccountId: string;
    memberProfileId: string;
    role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'CHILD' | 'GUEST';
  },
  entity: SynchronizedEntityRecord
): boolean {
  if (entity.familyId !== callerMembership.familyId || entity.isDeleted) {
    return false;
  }

  const data = entity.data || {};
  const entityType = entity.entityType;

  // 1. Couple Enclave (CPL-01): Restricted strictly to OWNER and ADMIN (spousal/parental enclave)
  if (
    entityType === 'REL_COUPLE_PLAN' ||
    (entityType === 'REL_CHECKIN' && String(data.type || '').toUpperCase() === 'COUPLE')
  ) {
    if (!canAccessCoupleEnclave(callerMembership.role)) {
      return false;
    }
    if (
      Boolean(data.isPrivate) &&
      data.ownerUserId &&
      data.ownerUserId !== callerMembership.userAccountId &&
      !canAccessCoupleEnclave(callerMembership.role)
    ) {
      return false;
    }
    return true;
  }

  // 2. Private Check-ins, Personal Goals, Spiritual Reflections, Personal Tasks/Lists
  if (
    entityType === 'REL_CHECKIN' ||
    entityType === 'PAR_PERSONAL_GOAL' ||
    entityType === 'SPR_REFLECTION' ||
    entityType === 'REFLECTION_JOURNAL' ||
    entityType === 'LIFE_PERSONAL_TASK' ||
    entityType === 'LIFE_PERSONAL_LIST'
  ) {
    const isPrivate =
      entityType === 'LIFE_PERSONAL_TASK' || entityType === 'LIFE_PERSONAL_LIST'
        ? data.isPrivate !== false && data.scope !== 'FAMILY'
        : Boolean(data.isPrivate);

    if (isPrivate) {
      const ownerUserId = String(data.ownerUserId || data.authorUserId || entity.updatedByUserId || '');
      const ownerMemberId = String(data.ownerMemberId || data.authorMemberId || data.memberId || '');
      const isOwnerMatch =
        (ownerUserId && ownerUserId === callerMembership.userAccountId) ||
        (ownerMemberId && ownerMemberId === callerMembership.memberProfileId);
      if (!isOwnerMatch) {
        return false;
      }
    }
  }

  // 3. Document Vault Access Level Enforcement
  if (entityType === 'LIFE_DOCUMENT') {
    const accessLevel = String(data.accessLevel || 'Owner & Admin Only');
    if (!canAccessDocumentByLevel(callerMembership.role, accessLevel)) {
      return false;
    }
  }

  // 4. Minor Health & Child Profile COPPA / Guardian Protection
  if (
    entityType === 'WELLBEING_PROFILE' ||
    entityType === 'HEALTH_ALLERGY' ||
    entityType === 'HEALTH_MEDICATION'
  ) {
    const targetMemberId = String(data.memberId || '');
    if (Boolean(data.isRestrictedMinor) && !canAccessMinorHealthRecord(store, callerMembership as any, targetMemberId)) {
      return false;
    }
  }

  if (entityType === 'PAR_CHILD_PROFILE') {
    if (callerMembership.role === 'GUEST') {
      return false;
    }
  }

  return true;
}

/**
 * Evaluates whether a caller is permitted to create/update/delete a domain record.
 */
export function canCallerMutateDomainEntity(
  store: SharedStore,
  callerMembership: {
    familyId: string;
    userAccountId: string;
    memberProfileId: string;
    role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'CHILD' | 'GUEST';
  },
  entityType: string,
  incomingData: Record<string, unknown>,
  existingEntity?: SynchronizedEntityRecord
): { allowed: boolean; status: number; errorCode?: string; message?: string } {
  if (callerMembership.role === 'GUEST') {
    return {
      allowed: false,
      status: 403,
      errorCode: 'PERMISSION_DENIED',
      message: 'GUEST role has read-only access and cannot mutate family records.',
    };
  }

  if (
    entityType === 'REL_COUPLE_PLAN' ||
    (entityType === 'REL_CHECKIN' && String(incomingData.type || '').toUpperCase() === 'COUPLE')
  ) {
    if (!canAccessCoupleEnclave(callerMembership.role)) {
      return {
        allowed: false,
        status: 403,
        errorCode: 'COUPLE_ENCLAVE_RESTRICTED',
        message: 'Only OWNER or ADMIN roles can create or modify Couple Connection records.',
      };
    }
  }

  if (entityType === 'LIFE_DOCUMENT') {
    const level = String(incomingData.accessLevel || existingEntity?.data?.accessLevel || 'Owner & Admin Only');
    if (!canAccessDocumentByLevel(callerMembership.role, level)) {
      return {
        allowed: false,
        status: 403,
        errorCode: 'DOCUMENT_ACCESS_DENIED',
        message: `Role '${callerMembership.role}' cannot create or modify documents with access level '${level}'.`,
      };
    }
    if (callerMembership.role === 'CHILD') {
      return {
        allowed: false,
        status: 403,
        errorCode: 'DOCUMENT_VAULT_ADULT_ONLY',
        message: 'CHILD role cannot upload or modify household vault documents.',
      };
    }
  }

  if (existingEntity && !existingEntity.isDeleted) {
    const exData = existingEntity.data || {};
    const isPrivate = Boolean(exData.isPrivate);
    if (isPrivate) {
      const ownerUserId = String(exData.ownerUserId || exData.authorUserId || existingEntity.updatedByUserId || '');
      const ownerMemberId = String(exData.ownerMemberId || exData.authorMemberId || '');
      const isOwner =
        (ownerUserId && ownerUserId === callerMembership.userAccountId) ||
        (ownerMemberId && ownerMemberId === callerMembership.memberProfileId);
      if (!isOwner) {
        return {
          allowed: false,
          status: 403,
          errorCode: 'PRIVATE_RECORD_OWNERSHIP_VIOLATION',
          message: 'Cannot modify another member’s private record.',
        };
      }
    }
  }

  return { allowed: true, status: 200 };
}

/**
 * Performs per-record conflict detection and field-aware merging.
 * If `baseVersion` is older than `existing.version`:
 * - If `conflictPolicy === 'APPEND_ONLY'`, merges without data loss.
 * - If `conflictPolicy === 'FIELD_AWARE_MERGE'`, checks if the modified fields overlap with fields changed since `baseVersion`.
 *   If overlapping fields have different values and `forceOverwrite !== true`, returns a conflict (`409 VERSION_CONFLICT`).
 */
export function resolvePerRecordMutation(params: {
  existing?: SynchronizedEntityRecord;
  incomingData: Record<string, unknown>;
  baseVersion?: number;
  baseSnapshot?: Record<string, unknown>;
  conflictPolicy: 'FIELD_AWARE_MERGE' | 'APPEND_ONLY';
  forceOverwrite?: boolean;
}): {
  conflictRejected: boolean;
  mergedData: Record<string, unknown>;
  conflictingFields: string[];
} {
  const { existing, incomingData, baseVersion, baseSnapshot, conflictPolicy, forceOverwrite } = params;
  if (!existing || existing.isDeleted) {
    return {
      conflictRejected: false,
      mergedData: { ...incomingData },
      conflictingFields: [],
    };
  }

  const serverData = existing.data || {};
  const hasStaleBaseVersion =
    typeof baseVersion === 'number' && !Number.isNaN(baseVersion) && baseVersion < existing.version;

  if (!hasStaleBaseVersion || forceOverwrite || conflictPolicy === 'APPEND_ONLY') {
    return {
      conflictRejected: false,
      mergedData: {
        ...serverData,
        ...incomingData,
      },
      conflictingFields: [],
    };
  }

  // Field-aware conflict analysis when baseVersion < existing.version
  const metadataKeys = new Set([
    'id',
    'familyId',
    'version',
    'baseVersion',
    'updatedAt',
    'createdAt',
    'updatedByUserId',
    'ownerUserId',
    'ownerMemberId',
    'authorUserId',
    'authorMemberId',
    'isDeleted',
  ]);

  const conflictingFields: string[] = [];
  for (const [key, clientVal] of Object.entries(incomingData)) {
    if (metadataKeys.has(key)) continue;
    const serverVal = serverData[key];
    const baseVal = baseSnapshot ? baseSnapshot[key] : undefined;

    const serverEqualsClient = JSON.stringify(serverVal) === JSON.stringify(clientVal);
    if (serverEqualsClient) continue;

    if (baseSnapshot) {
      const serverChangedSinceBase = JSON.stringify(serverVal) !== JSON.stringify(baseVal);
      const clientChangedSinceBase = JSON.stringify(clientVal) !== JSON.stringify(baseVal);
      if (serverChangedSinceBase && clientChangedSinceBase) {
        conflictingFields.push(key);
      }
    } else {
      // Without baseSnapshot, any differing field that exists on server and is modified by stale client is flagged
      if (serverVal !== undefined && !serverEqualsClient) {
        conflictingFields.push(key);
      }
    }
  }

  if (conflictingFields.length > 0) {
    return {
      conflictRejected: true,
      mergedData: serverData,
      conflictingFields,
    };
  }

  return {
    conflictRejected: false,
    mergedData: {
      ...serverData,
      ...incomingData,
    },
    conflictingFields: [],
  };
}

export function registerDomainModulesRoutes(
  app: Express,
  deps: {
    requireAuth: (req: Request, res: Response, next: NextFunction) => void;
    loadStore: () => SharedStore;
    withAtomicStoreTransaction: <T>(fn: (store: SharedStore) => Promise<T> | T) => Promise<T>;
    bumpWorkspaceVersion: (store: SharedStore, familyId: string, now?: number) => number;
    mirrorEntityToFirestore: (record: SynchronizedEntityRecord) => Promise<void>;
  }
) {
  const { requireAuth, loadStore, withAtomicStoreTransaction, bumpWorkspaceVersion, mirrorEntityToFirestore } = deps;

  function handleModuleHydration(
    req: Request,
    res: Response,
    collectionMap: Record<string, { entityType: string; conflictPolicy: 'FIELD_AWARE_MERGE' | 'APPEND_ONLY' }>
  ) {
    const familyId = String(req.params.familyId || '').trim();
    const store = loadStore();
    const actor = req.actor!;

    const access = resolveServerMembership(store, actor.userAccountId, familyId);
    if (!access.allowed || !access.membership) {
      res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
      return;
    }

    const callerMembership = access.membership;
    const allEntities = Object.values(store.synchronizedEntities || {});
    const collectionsPayload: Record<string, any[]> = {};

    for (const [colName, meta] of Object.entries(collectionMap)) {
      const records = allEntities
        .filter(
          (e) =>
            e.familyId === familyId &&
            e.entityType === meta.entityType &&
            !e.isDeleted &&
            canCallerReadDomainEntity(store, callerMembership, e)
        )
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map((e) => ({
          ...e.data,
          id: e.id,
          familyId: e.familyId,
          version: e.version,
          updatedAt: e.updatedAt,
          updatedByUserId: e.updatedByUserId,
        }));
      collectionsPayload[colName] = records;
    }

    const ws = store.workspaces?.[familyId] || store.workspace;
    res.status(200).json({
      familyId,
      workspaceVersion: ws.version,
      actor: {
        userAccountId: actor.userAccountId,
        memberProfileId: callerMembership.memberProfileId,
        displayName: callerMembership.displayName,
        role: callerMembership.role,
      },
      collections: collectionsPayload,
    });
  }

  async function handleRecordUpsert(
    req: Request,
    res: Response,
    collectionMap: Record<string, { entityType: string; conflictPolicy: 'FIELD_AWARE_MERGE' | 'APPEND_ONLY' }>
  ) {
    const familyId = String(req.params.familyId || '').trim();
    const collectionName = String(req.params.collection || '').trim();
    const rawProvidedId = String(req.params.recordId || req.body?.id || req.body?.data?.id || '').trim();
    const recordId =
      rawProvidedId ||
      (req.method === 'POST' ? `dom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` : '');
    const actor = req.actor!;

    const colMeta = collectionMap[collectionName];
    if (!colMeta) {
      res.status(400).json({
        error: 'UNKNOWN_DOMAIN_COLLECTION',
        message: `Collection '${collectionName}' is not a valid domain collection.`,
      });
      return;
    }

    if (!recordId || !/^[a-zA-Z0-9_\-]+$/.test(recordId) || recordId.length > 128) {
      res.status(400).json({
        error: 'INVALID_RECORD_ID',
        message: 'Record ID must be 1–128 alphanumeric, underscore, or hyphen characters.',
      });
      return;
    }

    const rawBody = req.body || {};
    const incomingData: Record<string, unknown> =
      rawBody.data && typeof rawBody.data === 'object' ? rawBody.data : rawBody;
    const serializedSize = Buffer.byteLength(JSON.stringify(incomingData), 'utf-8');
    if (serializedSize > MAX_ENTITY_PAYLOAD_BYTES) {
      res.status(413).json({
        error: 'PAYLOAD_TOO_LARGE',
        message: `Record payload (${serializedSize} bytes) exceeds maximum limit (${MAX_ENTITY_PAYLOAD_BYTES} bytes).`,
      });
      return;
    }

    const baseVersion =
      rawBody.baseVersion !== undefined
        ? Number(rawBody.baseVersion)
        : incomingData.baseVersion !== undefined
        ? Number(incomingData.baseVersion)
        : undefined;
    const baseSnapshot =
      rawBody.baseSnapshot && typeof rawBody.baseSnapshot === 'object'
        ? (rawBody.baseSnapshot as Record<string, unknown>)
        : undefined;
    const forceOverwrite = Boolean(rawBody.forceOverwrite);

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, familyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }

      const callerMembership = access.membership;
      store.synchronizedEntities = store.synchronizedEntities || {};
      const entityKey = `${colMeta.entityType}:${recordId}`;
      const existing = store.synchronizedEntities[entityKey];

      const permCheck = canCallerMutateDomainEntity(
        store,
        callerMembership,
        colMeta.entityType,
        incomingData,
        existing
      );
      if (!permCheck.allowed) {
        res.status(permCheck.status).json({
          error: permCheck.errorCode,
          message: permCheck.message,
        });
        return;
      }

      const resolution = resolvePerRecordMutation({
        existing: existing && existing.familyId === familyId ? existing : undefined,
        incomingData,
        baseVersion,
        baseSnapshot,
        conflictPolicy: colMeta.conflictPolicy,
        forceOverwrite,
      });

      if (resolution.conflictRejected && existing) {
        res.status(409).json({
          error: 'VERSION_CONFLICT',
          message: `Concurrent modification detected on ${colMeta.entityType}:${recordId} (client baseVersion=${baseVersion}, server version=${existing.version}).`,
          conflictingFields: resolution.conflictingFields,
          serverVersion: existing.version,
          serverRecord: {
            ...existing.data,
            id: existing.id,
            version: existing.version,
            updatedAt: existing.updatedAt,
          },
        });
        return;
      }

      const now = Date.now();
      const nextVersion = (existing?.version || 0) + 1;
      const ownerUserId = String(
        existing?.data?.ownerUserId || incomingData.ownerUserId || actor.userAccountId
      );
      const ownerMemberId = String(
        existing?.data?.ownerMemberId || incomingData.ownerMemberId || callerMembership.memberProfileId
      );

      const record: SynchronizedEntityRecord = {
        id: recordId,
        familyId,
        entityType: colMeta.entityType,
        version: nextVersion,
        isDeleted: false,
        updatedAt: now,
        updatedByUserId: actor.userAccountId,
        data: {
          ...resolution.mergedData,
          id: recordId,
          familyId,
          ownerUserId,
          ownerMemberId,
          authorName:
            resolution.mergedData.author ||
            resolution.mergedData.authorName ||
            callerMembership.displayName,
          version: nextVersion,
          updatedAt: now,
          isDeleted: false,
        },
      };

      store.synchronizedEntities[entityKey] = record;
      const wsVersion = bumpWorkspaceVersion(store, familyId, now);

      store.auditEvents.unshift({
        id: `aud-${now}-${Math.random().toString(36).slice(2, 6)}`,
        familyId,
        actorUserId: actor.userAccountId,
        actorRole: callerMembership.role,
        actionType: `DOMAIN_UPSERT_${colMeta.entityType}`,
        summary: `Upserted ${colMeta.entityType}:${recordId} (v${nextVersion})`,
        createdAt: now,
      });

      void mirrorEntityToFirestore(record);

      res.status(200).json({
        record: {
          ...record.data,
          id: record.id,
          version: record.version,
          updatedAt: record.updatedAt,
        },
        version: nextVersion,
        workspaceVersion: wsVersion,
        conflictPolicy: colMeta.conflictPolicy,
      });
    });
  }

  async function handleRecordDelete(
    req: Request,
    res: Response,
    collectionMap: Record<string, { entityType: string; conflictPolicy: 'FIELD_AWARE_MERGE' | 'APPEND_ONLY' }>
  ) {
    const familyId = String(req.params.familyId || '').trim();
    const collectionName = String(req.params.collection || '').trim();
    const recordId = String(req.params.recordId || '').trim();
    const actor = req.actor!;

    const colMeta = collectionMap[collectionName];
    if (!colMeta) {
      res.status(400).json({ error: 'UNKNOWN_DOMAIN_COLLECTION', message: 'Invalid domain collection.' });
      return;
    }

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, familyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }

      const callerMembership = access.membership;
      store.synchronizedEntities = store.synchronizedEntities || {};
      const entityKey = `${colMeta.entityType}:${recordId}`;
      const existing = store.synchronizedEntities[entityKey];

      if (!existing || existing.familyId !== familyId || existing.isDeleted) {
        res.status(404).json({ error: 'RECORD_NOT_FOUND', message: 'Record not found.' });
        return;
      }

      const permCheck = canCallerMutateDomainEntity(
        store,
        callerMembership,
        colMeta.entityType,
        {},
        existing
      );
      if (!permCheck.allowed) {
        res.status(permCheck.status).json({ error: permCheck.errorCode, message: permCheck.message });
        return;
      }

      const now = Date.now();
      const nextVersion = existing.version + 1;
      const tombstone: SynchronizedEntityRecord = {
        ...existing,
        version: nextVersion,
        isDeleted: true,
        updatedAt: now,
        updatedByUserId: actor.userAccountId,
        data: {
          ...existing.data,
          isDeleted: true,
          deletedAt: now,
          version: nextVersion,
        },
      };

      store.synchronizedEntities[entityKey] = tombstone;
      const wsVersion = bumpWorkspaceVersion(store, familyId, now);
      void mirrorEntityToFirestore(tombstone);

      res.status(200).json({
        deleted: true,
        id: recordId,
        version: nextVersion,
        workspaceVersion: wsVersion,
      });
    });
  }

  // 1. Relationships Module Routes
  app.get('/api/v1/domain/:familyId/relationships', requireAuth, (req, res) =>
    handleModuleHydration(req, res, RELATIONSHIPS_COLLECTIONS)
  );
  app.put('/api/v1/domain/:familyId/relationships/:collection/:recordId', requireAuth, (req, res) =>
    handleRecordUpsert(req, res, RELATIONSHIPS_COLLECTIONS)
  );
  app.post('/api/v1/domain/:familyId/relationships/:collection', requireAuth, (req, res) =>
    handleRecordUpsert(req, res, RELATIONSHIPS_COLLECTIONS)
  );
  app.delete('/api/v1/domain/:familyId/relationships/:collection/:recordId', requireAuth, (req, res) =>
    handleRecordDelete(req, res, RELATIONSHIPS_COLLECTIONS)
  );

  // 2. Parenting & Growth Module Routes
  app.get('/api/v1/domain/:familyId/parenting', requireAuth, (req, res) =>
    handleModuleHydration(req, res, PARENTING_COLLECTIONS)
  );
  app.put('/api/v1/domain/:familyId/parenting/:collection/:recordId', requireAuth, (req, res) =>
    handleRecordUpsert(req, res, PARENTING_COLLECTIONS)
  );
  app.post('/api/v1/domain/:familyId/parenting/:collection', requireAuth, (req, res) =>
    handleRecordUpsert(req, res, PARENTING_COLLECTIONS)
  );
  app.delete('/api/v1/domain/:familyId/parenting/:collection/:recordId', requireAuth, (req, res) =>
    handleRecordDelete(req, res, PARENTING_COLLECTIONS)
  );

  // 3. Life Management Module Routes
  app.get('/api/v1/domain/:familyId/life', requireAuth, (req, res) =>
    handleModuleHydration(req, res, LIFE_COLLECTIONS)
  );
  app.put('/api/v1/domain/:familyId/life/:collection/:recordId', requireAuth, (req, res) =>
    handleRecordUpsert(req, res, LIFE_COLLECTIONS)
  );
  app.post('/api/v1/domain/:familyId/life/:collection', requireAuth, (req, res) =>
    handleRecordUpsert(req, res, LIFE_COLLECTIONS)
  );
  app.delete('/api/v1/domain/:familyId/life/:collection/:recordId', requireAuth, (req, res) =>
    handleRecordDelete(req, res, LIFE_COLLECTIONS)
  );

  // 4. Secure Encrypted Document Vault Upload & Authenticated Download
  app.post('/api/v1/domain/:familyId/documents/upload', requireAuth, async (req, res) => {
    const familyId = String(req.params.familyId || '').trim();
    const actor = req.actor!;
    const {
      id,
      title,
      category = 'Identification',
      expirationDate = 'Permanent Record',
      renewalReminder = '30 days prior',
      accessLevel = 'Owner & Admin Only',
      fileName = 'document.pdf',
      mimeType = 'application/pdf',
      contentBase64 = '',
      base64Content = '',
      tags = [],
      notes = '',
      issuer = '',
      referenceNumber = '',
      attachments = [],
    } = req.body || {};
    const resolvedBase64 = contentBase64 || base64Content || '';

    if (!title || !String(title).trim()) {
      res.status(400).json({ error: 'INVALID_DOCUMENT_TITLE', message: 'Document title is required.' });
      return;
    }

    const cleanFileName = path.basename(String(fileName).trim());
    const ext = path.extname(cleanFileName).toLowerCase();

    if (FORBIDDEN_EXECUTABLE_EXTENSIONS.has(ext) || !ALLOWED_DOCUMENT_EXTENSIONS.has(ext)) {
      res.status(400).json({
        error: 'INVALID_DOCUMENT_TYPE',
        message: `File extension '${ext || 'none'}' is forbidden. Allowed vault types: PDF, PNG, JPG, WEBP, TXT.`,
      });
      return;
    }

    if (mimeType && !ALLOWED_DOCUMENT_MIME_TYPES.has(String(mimeType).toLowerCase())) {
      res.status(400).json({
        error: 'INVALID_DOCUMENT_MIME_TYPE',
        message: `MIME type '${mimeType}' is not permitted in the secure document vault.`,
      });
      return;
    }

    const rawBuffer = resolvedBase64
      ? Buffer.from(String(resolvedBase64).replace(/^data:[^;]+;base64,/, ''), 'base64')
      : Buffer.from(`FamilyOS Vault Protected Document: ${title}`, 'utf-8');

    if (rawBuffer.byteLength > MAX_VAULT_DOCUMENT_BYTES) {
      res.status(413).json({
        error: 'DOCUMENT_TOO_LARGE',
        message: `Document size (${rawBuffer.byteLength} bytes) exceeds 2MB vault limit.`,
      });
      return;
    }

    // Malware / executable signature check (MZ / ELF / shebang header check)
    if (
      (rawBuffer.length >= 2 && rawBuffer[0] === 0x4d && rawBuffer[1] === 0x5a) || // PE/EXE 'MZ'
      (rawBuffer.length >= 4 &&
        rawBuffer[0] === 0x7f &&
        rawBuffer[1] === 0x45 &&
        rawBuffer[2] === 0x4c &&
        rawBuffer[3] === 0x46) || // ELF binary
      rawBuffer.subarray(0, 32).toString('utf-8').startsWith('#!')
    ) {
      res.status(400).json({
        error: 'MALWARE_OR_EXECUTABLE_SIGNATURE_DETECTED',
        message: 'Executable binary signatures are strictly blocked by the FamilyOS Document Vault.',
      });
      return;
    }

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, familyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }

      const callerMembership = access.membership;
      const permCheck = canCallerMutateDomainEntity(store, callerMembership, 'LIFE_DOCUMENT', { accessLevel });
      if (!permCheck.allowed) {
        res.status(permCheck.status).json({ error: permCheck.errorCode, message: permCheck.message });
        return;
      }

      if (!fs.existsSync(VAULT_DIR)) {
        fs.mkdirSync(VAULT_DIR, { recursive: true });
      }

      const docId = id && /^[a-zA-Z0-9_\-]+$/.test(String(id)) ? String(id) : `doc-${Date.now()}`;
      const sha256Checksum = crypto.createHash('sha256').update(rawBuffer).digest('hex');
      const encryptedEnvelope = encryptVaultBuffer(rawBuffer);
      const vaultFilePath = path.join(VAULT_DIR, `${familyId}_${docId}.vault.json`);
      fs.writeFileSync(
        vaultFilePath,
        JSON.stringify({
          docId,
          familyId,
          fileName: cleanFileName,
          mimeType,
          sha256Checksum,
          ...encryptedEnvelope,
        }),
        'utf-8'
      );

      const now = Date.now();
      store.synchronizedEntities = store.synchronizedEntities || {};
      const entityKey = `LIFE_DOCUMENT:${docId}`;
      const prev = store.synchronizedEntities[entityKey];
      const nextVersion = (prev?.version || 0) + 1;

      const record: SynchronizedEntityRecord = {
        id: docId,
        familyId,
        entityType: 'LIFE_DOCUMENT',
        version: nextVersion,
        isDeleted: false,
        updatedAt: now,
        updatedByUserId: actor.userAccountId,
        data: {
          id: docId,
          familyId,
          title: String(title).trim(),
          category,
          expirationDate,
          renewalReminder,
          accessLevel,
          fileName: cleanFileName,
          mimeType,
          fileSizeKb: Math.max(1, Math.round(rawBuffer.byteLength / 1024)),
          sha256Checksum,
          encryptedAtRest: true,
          tags: Array.isArray(tags) ? tags : [],
          notes: String(notes || '').trim(),
          issuer: String(issuer || '').trim(),
          referenceNumber: String(referenceNumber || '').trim(),
          attachments: Array.isArray(attachments) ? attachments : [],
          ownerUserId: actor.userAccountId,
          ownerMemberId: callerMembership.memberProfileId,
          version: nextVersion,
          updatedAt: now,
        },
      };

      store.synchronizedEntities[entityKey] = record;
      const wsVersion = bumpWorkspaceVersion(store, familyId, now);
      void mirrorEntityToFirestore(record);

      res.status(201).json({
        document: record.data,
        version: nextVersion,
        workspaceVersion: wsVersion,
      });
    });
  });

  app.get('/api/v1/domain/:familyId/documents/:docId/download', requireAuth, (req, res) => {
    const familyId = String(req.params.familyId || '').trim();
    const docId = String(req.params.docId || '').trim();
    const store = loadStore();
    const actor = req.actor!;

    const access = resolveServerMembership(store, actor.userAccountId, familyId);
    if (!access.allowed || !access.membership) {
      res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
      return;
    }

    const callerMembership = access.membership;
    const entity = store.synchronizedEntities?.[`LIFE_DOCUMENT:${docId}`];
    if (!entity || entity.familyId !== familyId || entity.isDeleted) {
      res.status(404).json({ error: 'DOCUMENT_NOT_FOUND', message: 'Document record not found.' });
      return;
    }

    if (!canCallerReadDomainEntity(store, callerMembership, entity)) {
      res.status(403).json({
        error: 'DOCUMENT_ACCESS_DENIED',
        message: `Role '${callerMembership.role}' is not authorized to download this vault document.`,
      });
      return;
    }

    const vaultFilePath = path.join(VAULT_DIR, `${familyId}_${docId}.vault.json`);
    if (!fs.existsSync(vaultFilePath)) {
      // Return synthesized metadata summary if binary was created before vault file existed
      const fallbackContent = Buffer.from(
        `FamilyOS Encrypted Document Record\nTitle: ${entity.data.title}\nCategory: ${entity.data.category}\nExpiration: ${entity.data.expirationDate}`,
        'utf-8'
      );
      res.status(200).json({
        docId,
        fileName: entity.data.fileName || `${docId}.txt`,
        mimeType: 'text/plain',
        contentBase64: fallbackContent.toString('base64'),
        encryptedAtRest: true,
      });
      return;
    }

    try {
      const envelope = JSON.parse(fs.readFileSync(vaultFilePath, 'utf-8'));
      const decrypted = decryptVaultBuffer(envelope);
      const actualHash = crypto.createHash('sha256').update(decrypted).digest('hex');
      if (envelope.sha256Checksum && actualHash !== envelope.sha256Checksum) {
        res.status(500).json({ error: 'VAULT_INTEGRITY_MISMATCH', message: 'Document checksum verification failed.' });
        return;
      }

      res.status(200).json({
        docId,
        fileName: envelope.fileName || entity.data.fileName || `${docId}.pdf`,
        mimeType: envelope.mimeType || entity.data.mimeType || 'application/pdf',
        sha256Checksum: actualHash,
        contentBase64: decrypted.toString('base64'),
        encryptedAtRest: true,
      });
    } catch {
      res.status(500).json({ error: 'VAULT_DECRYPTION_ERROR', message: 'Could not decrypt vault document.' });
    }
  });
}
