import type { Express, Request, Response } from 'express';
import type {
  SharedStore,
  AuthoritativeFamilyMember,
  AuthoritativeFamilyRelationship,
  AuthoritativeMembership,
  AuthoritativeInvitation,
  SharedAccount,
  SharedBudget,
  SharedTransaction,
  SynchronizedEntityRecord,
} from './backupAndMigration';
import type {
  AuthoritativeGoal,
  AuthoritativeProject,
  AuthoritativeMilestone,
  AuthoritativeTask,
  AuthoritativeChecklistTemplate,
} from './planningAndExecution';
import { resolveServerMembership } from './authAndRbac';
import {
  DATABASE_TABLES_REGISTRY,
  type TableDefinition,
  type FieldDefinition,
} from '../shared/databaseStudioSchema';

export { DATABASE_TABLES_REGISTRY };
export type { TableDefinition, FieldDefinition };

export function registerDatabaseStudioRoutes(
  app: Express,
  deps: {
    requireAuth: (req: Request, res: Response, next: () => void) => void;
    loadStore: () => SharedStore;
    withAtomicStoreTransaction: (fn: (store: SharedStore) => Promise<void> | void) => Promise<void>;
    bumpWorkspaceVersion: (store: SharedStore, familyId: string, now?: number) => number;
    mirrorEntityToFirestore: (entity: SynchronizedEntityRecord) => Promise<void>;
  }
) {
  const { requireAuth, loadStore, withAtomicStoreTransaction, bumpWorkspaceVersion, mirrorEntityToFirestore } = deps;

  // 1. Get Table Metadata & Live Record Counts
  app.get('/api/v1/database/:familyId/meta', requireAuth, (req, res) => {
    const familyId = String(req.params.familyId || '').trim();
    const actor = (req as any).actor!;
    const store = loadStore();

    const access = resolveServerMembership(store, actor.userAccountId, familyId);
    if (!access.allowed || !access.membership) {
      res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
      return;
    }

    const tablesWithCounts = DATABASE_TABLES_REGISTRY.map((table) => {
      let count = 0;
      if (table.storeTarget === 'DIRECT_ARRAY') {
        const arr = (store as any)[table.storeKey];
        if (Array.isArray(arr)) {
          count = arr.filter((item: any) => !item.familyId || item.familyId === familyId).length;
        }
      } else {
        const syn = store.synchronizedEntities || {};
        if (table.id === 'synchronized_entities') {
          count = Object.values(syn).filter((e) => e.familyId === familyId && !e.isDeleted).length;
        } else if (table.entityType) {
          count = Object.values(syn).filter(
            (e) => e.familyId === familyId && e.entityType === table.entityType && !e.isDeleted
          ).length;
        }
      }
      return {
        ...table,
        recordCount: count,
      };
    });

    const categories = Array.from(new Set(tablesWithCounts.map((t) => t.category)));

    res.status(200).json({
      familyId,
      tables: tablesWithCounts,
      categories,
      totalTables: tablesWithCounts.length,
      workspaceVersion: store.workspace?.version || 1,
      currentUserRole: access.membership.role,
    });
  });

  // 2. Query Records for a Specific Table
  app.get('/api/v1/database/:familyId/table/:tableId', requireAuth, (req, res) => {
    const familyId = String(req.params.familyId || '').trim();
    const tableId = String(req.params.tableId || '').trim();
    const searchQuery = String(req.query.q || '').trim().toLowerCase();
    const actor = (req as any).actor!;
    const store = loadStore();

    const access = resolveServerMembership(store, actor.userAccountId, familyId);
    if (!access.allowed || !access.membership) {
      res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
      return;
    }

    const tableDef = DATABASE_TABLES_REGISTRY.find((t) => t.id === tableId);
    if (!tableDef) {
      res.status(404).json({ error: 'TABLE_NOT_FOUND', message: `Database table '${tableId}' does not exist.` });
      return;
    }

    let records: any[] = [];
    if (tableDef.storeTarget === 'DIRECT_ARRAY') {
      const arr = (store as any)[tableDef.storeKey];
      if (Array.isArray(arr)) {
        records = arr
          .filter((item: any) => (!item.familyId || item.familyId === familyId) && !item.isDeleted)
          .map((item: any) => ({ ...item }));
      }
    } else {
      const syn = store.synchronizedEntities || {};
      if (tableDef.id === 'synchronized_entities') {
        records = Object.values(syn)
          .filter((e) => e.familyId === familyId && !e.isDeleted)
          .map((e) => ({
            ...e.data,
            id: e.id,
            entityType: e.entityType,
            version: e.version,
            updatedAt: e.updatedAt,
            updatedByUserId: e.updatedByUserId,
          }));
      } else if (tableDef.entityType) {
        records = Object.values(syn)
          .filter((e) => e.familyId === familyId && e.entityType === tableDef.entityType && !e.isDeleted)
          .map((e) => ({
            ...e.data,
            id: e.id,
            entityType: e.entityType,
            version: e.version,
            updatedAt: e.updatedAt,
            updatedByUserId: e.updatedByUserId,
          }));
      }
    }

    if (searchQuery) {
      records = records.filter((r) => JSON.stringify(r).toLowerCase().includes(searchQuery));
    }

    res.status(200).json({
      familyId,
      table: tableDef,
      count: records.length,
      records,
    });
  });

  // 3. Add Record to Table
  app.post('/api/v1/database/:familyId/table/:tableId', requireAuth, async (req, res) => {
    const familyId = String(req.params.familyId || '').trim();
    const tableId = String(req.params.tableId || '').trim();
    const actor = (req as any).actor!;

    const tableDef = DATABASE_TABLES_REGISTRY.find((t) => t.id === tableId);
    if (!tableDef) {
      res.status(404).json({ error: 'TABLE_NOT_FOUND', message: `Database table '${tableId}' does not exist.` });
      return;
    }

    const rawData = req.body || {};
    const inputPayload = rawData.data && typeof rawData.data === 'object' ? rawData.data : rawData;

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, familyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }

      const now = Date.now();
      const generatedId =
        inputPayload.id && String(inputPayload.id).trim()
          ? String(inputPayload.id).trim()
          : `${tableDef.defaultPrefix}-${now}-${Math.random().toString(36).slice(2, 6)}`;

      const newRecord: Record<string, unknown> = {
        ...inputPayload,
        id: generatedId,
        familyId,
        version: 1,
        createdAt: inputPayload.createdAt || now,
        updatedAt: now,
        isDeleted: false,
      };

      if (tableDef.storeTarget === 'DIRECT_ARRAY') {
        const targetArr = (store as any)[tableDef.storeKey];
        if (!Array.isArray(targetArr)) {
          (store as any)[tableDef.storeKey] = [newRecord];
        } else {
          targetArr.unshift(newRecord);
        }
      } else {
        store.synchronizedEntities = store.synchronizedEntities || {};
        const entityType = tableDef.entityType || String(newRecord.entityType || 'CUSTOM_RECORD');
        const entityKey = `${entityType}:${generatedId}`;
        const synRecord: SynchronizedEntityRecord = {
          id: generatedId,
          familyId,
          entityType,
          version: 1,
          isDeleted: false,
          updatedAt: now,
          updatedByUserId: actor.userAccountId,
          data: {
            ...newRecord,
            id: generatedId,
            familyId,
            version: 1,
            updatedAt: now,
          },
        };
        store.synchronizedEntities[entityKey] = synRecord;
        void mirrorEntityToFirestore(synRecord);
      }

      bumpWorkspaceVersion(store, familyId, now);

      res.status(201).json({
        success: true,
        record: newRecord,
        tableId,
        message: `Successfully created record in ${tableDef.name}.`,
      });
    });
  });

  // 4. Full Edit Record in Table
  app.put('/api/v1/database/:familyId/table/:tableId/:recordId', requireAuth, async (req, res) => {
    const familyId = String(req.params.familyId || '').trim();
    const tableId = String(req.params.tableId || '').trim();
    const recordId = String(req.params.recordId || '').trim();
    const actor = (req as any).actor!;

    const tableDef = DATABASE_TABLES_REGISTRY.find((t) => t.id === tableId);
    if (!tableDef) {
      res.status(404).json({ error: 'TABLE_NOT_FOUND', message: `Database table '${tableId}' does not exist.` });
      return;
    }

    const rawData = req.body || {};
    const inputPayload = rawData.data && typeof rawData.data === 'object' ? rawData.data : rawData;

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, familyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }

      const now = Date.now();
      let updatedRecord: Record<string, unknown> | null = null;

      if (tableDef.storeTarget === 'DIRECT_ARRAY') {
        const arr = (store as any)[tableDef.storeKey];
        if (!Array.isArray(arr)) {
          res.status(404).json({ error: 'RECORD_NOT_FOUND', message: 'Table contains no records.' });
          return;
        }
        const index = arr.findIndex((r: any) => String(r.id) === recordId && (!r.familyId || r.familyId === familyId));
        if (index === -1) {
          res.status(404).json({ error: 'RECORD_NOT_FOUND', message: `Record '${recordId}' not found.` });
          return;
        }
        const existing = arr[index];
        const nextVersion = (Number(existing.version) || 1) + 1;
        updatedRecord = {
          ...existing,
          ...inputPayload,
          id: recordId,
          familyId,
          version: nextVersion,
          updatedAt: now,
        };
        arr[index] = updatedRecord;
      } else {
        store.synchronizedEntities = store.synchronizedEntities || {};
        const entityType = tableDef.entityType || String(inputPayload.entityType || 'CUSTOM_RECORD');
        const entityKey = `${entityType}:${recordId}`;
        const existing = store.synchronizedEntities[entityKey];

        const nextVersion = (existing?.version || 1) + 1;
        const mergedData = {
          ...(existing?.data || {}),
          ...inputPayload,
          id: recordId,
          familyId,
          version: nextVersion,
          updatedAt: now,
        };

        const synRecord: SynchronizedEntityRecord = {
          id: recordId,
          familyId,
          entityType,
          version: nextVersion,
          isDeleted: Boolean(inputPayload.isDeleted),
          updatedAt: now,
          updatedByUserId: actor.userAccountId,
          data: mergedData,
        };
        store.synchronizedEntities[entityKey] = synRecord;
        updatedRecord = mergedData;
        void mirrorEntityToFirestore(synRecord);
      }

      bumpWorkspaceVersion(store, familyId, now);

      res.status(200).json({
        success: true,
        record: updatedRecord,
        tableId,
        message: `Record '${recordId}' saved in ${tableDef.name}.`,
      });
    });
  });

  // 5. Delete Record from Table
  app.delete('/api/v1/database/:familyId/table/:tableId/:recordId', requireAuth, async (req, res) => {
    const familyId = String(req.params.familyId || '').trim();
    const tableId = String(req.params.tableId || '').trim();
    const recordId = String(req.params.recordId || '').trim();
    const actor = (req as any).actor!;

    const tableDef = DATABASE_TABLES_REGISTRY.find((t) => t.id === tableId);
    if (!tableDef) {
      res.status(404).json({ error: 'TABLE_NOT_FOUND', message: `Database table '${tableId}' does not exist.` });
      return;
    }

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, familyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }

      const now = Date.now();

      if (tableDef.storeTarget === 'DIRECT_ARRAY') {
        const arr = (store as any)[tableDef.storeKey];
        if (Array.isArray(arr)) {
          const idx = arr.findIndex((r: any) => String(r.id) === recordId && (!r.familyId || r.familyId === familyId));
          if (idx !== -1) {
            arr.splice(idx, 1);
          }
        }
      } else {
        store.synchronizedEntities = store.synchronizedEntities || {};
        const entityType = tableDef.entityType || 'CUSTOM_RECORD';
        const entityKey = `${entityType}:${recordId}`;
        const existing = store.synchronizedEntities[entityKey];
        if (existing) {
          existing.isDeleted = true;
          existing.updatedAt = now;
          existing.version += 1;
          if (existing.data) {
            existing.data.isDeleted = true;
            existing.data.updatedAt = now;
          }
          void mirrorEntityToFirestore(existing);
        }
      }

      bumpWorkspaceVersion(store, familyId, now);

      res.status(200).json({
        success: true,
        recordId,
        tableId,
        message: `Record '${recordId}' deleted from ${tableDef.name}.`,
      });
    });
  });

  // 6. Batch Import JSON Records to Table
  app.post('/api/v1/database/:familyId/table/:tableId/batch-import', requireAuth, async (req, res) => {
    const familyId = String(req.params.familyId || '').trim();
    const tableId = String(req.params.tableId || '').trim();
    const actor = (req as any).actor!;
    const { records } = req.body || {};

    if (!Array.isArray(records) || records.length === 0) {
      res.status(400).json({ error: 'INVALID_IMPORT_PAYLOAD', message: 'An array of records is required.' });
      return;
    }

    const tableDef = DATABASE_TABLES_REGISTRY.find((t) => t.id === tableId);
    if (!tableDef) {
      res.status(404).json({ error: 'TABLE_NOT_FOUND', message: `Database table '${tableId}' does not exist.` });
      return;
    }

    await withAtomicStoreTransaction(async (store) => {
      const access = resolveServerMembership(store, actor.userAccountId, familyId);
      if (!access.allowed || !access.membership) {
        res.status(access.httpStatus).json({ error: access.errorCode, message: access.errorMessage });
        return;
      }

      const now = Date.now();
      let importedCount = 0;

      for (const item of records) {
        if (!item || typeof item !== 'object') continue;
        const recordId = item.id ? String(item.id).trim() : `${tableDef.defaultPrefix}-${now}-${Math.random().toString(36).slice(2, 6)}`;
        const fullItem = {
          ...item,
          id: recordId,
          familyId,
          version: item.version ? Number(item.version) : 1,
          updatedAt: now,
          isDeleted: Boolean(item.isDeleted),
        };

        if (tableDef.storeTarget === 'DIRECT_ARRAY') {
          const arr = (store as any)[tableDef.storeKey];
          if (Array.isArray(arr)) {
            const idx = arr.findIndex((r: any) => String(r.id) === recordId);
            if (idx >= 0) arr[idx] = fullItem;
            else arr.unshift(fullItem);
          } else {
            (store as any)[tableDef.storeKey] = [fullItem];
          }
        } else {
          store.synchronizedEntities = store.synchronizedEntities || {};
          const entityType = tableDef.entityType || String(fullItem.entityType || 'CUSTOM_RECORD');
          const entityKey = `${entityType}:${recordId}`;
          const synRecord: SynchronizedEntityRecord = {
            id: recordId,
            familyId,
            entityType,
            version: fullItem.version,
            isDeleted: fullItem.isDeleted,
            updatedAt: now,
            updatedByUserId: actor.userAccountId,
            data: fullItem,
          };
          store.synchronizedEntities[entityKey] = synRecord;
          void mirrorEntityToFirestore(synRecord);
        }
        importedCount++;
      }

      bumpWorkspaceVersion(store, familyId, now);

      res.status(200).json({
        success: true,
        importedCount,
        tableId,
        message: `Imported ${importedCount} records into ${tableDef.name}.`,
      });
    });
  });
}
