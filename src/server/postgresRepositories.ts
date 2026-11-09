/**
 * FAMILYOS — Authoritative Workspace-Scoped PostgreSQL Repositories (v3.4.1)
 *
 * Implements targeted, strictly-scoped reads (WHERE family_id = $1) and direct single-entity
 * ACID mutations to eliminate full-store scanning and complete database rewriting on high-frequency routes.
 */

import pg from 'pg';
import {
  evaluateStorageAvailability,
  isPostgresConnectionVerified,
  getPostgresPool,
} from './postgresMigrationAndBackup';
import {
  isValidSigned64BigInt,
  parseSigned64BigInt,
  serializeBigIntToDecimalString,
  toSafeNumberOrNull,
} from '../utils/financeFormatting';
import type {
  SharedAccount,
  SharedTransaction,
  SharedBudget,
  SharedFinancialEntry,
  AuthoritativeMembership,
} from './backupAndMigration';

// ============================================================================
// STORAGE MODE & POSTGRES STATUS HELPERS
// ============================================================================

/**
 * Checks whether PostgreSQL authoritative persistence is active and verified in the current environment.
 */
export function isPostgresPersistenceActive(env: NodeJS.ProcessEnv = process.env): boolean {
  const status = evaluateStorageAvailability(env);
  return status.mode === 'postgres' && status.available && isPostgresConnectionVerified();
}

/**
 * Resolves a database client or connection from a Pool or Client instance.
 */
export async function withDbClient<T>(
  dbClientOrPool: any,
  fn: (client: any) => Promise<T>
): Promise<T> {
  const isPool = typeof dbClientOrPool?.connect === 'function';
  const client = isPool ? await dbClientOrPool.connect() : dbClientOrPool;
  try {
    return await fn(client);
  } finally {
    if (isPool) {
      client.release();
    }
  }
}

// ============================================================================
// 1. WORKSPACE-SCOPED READS (WHERE family_id = $1)
// ============================================================================

export interface FamilyWorkspaceContext {
  workspace: any | null;
  members: any[];
  activeMemberships: any[];
  allMemberships: any[];
  relationships: any[];
  invitations: any[];
}

/**
 * Loads workspace metadata, family members, memberships, and relationships strictly for `familyId`.
 * Guarantees zero leakage or cross-reading from other tenant workspaces.
 */
export async function getFamilyWorkspaceContext(
  dbClientOrPool: any,
  familyId: string
): Promise<FamilyWorkspaceContext> {
  if (!familyId || typeof familyId !== 'string') {
    throw new Error('INVALID_FAMILY_ID: familyId is required for workspace context lookup.');
  }

  return await withDbClient(dbClientOrPool, async (client) => {
    // 1. Workspace metadata
    const wsRes = await client.query(
      `SELECT * FROM family_workspaces WHERE id = $1 AND is_deleted = FALSE LIMIT 1`,
      [familyId]
    );
    const wsRow = wsRes.rows?.[0];
    const workspace = wsRow
      ? {
          id: wsRow.id,
          name: wsRow.name,
          motto: wsRow.motto ?? undefined,
          description: wsRow.description ?? undefined,
          mission: wsRow.mission ?? undefined,
          vision: wsRow.vision ?? undefined,
          currencyCode: wsRow.currency_code || 'USD',
          timezone: wsRow.timezone || 'UTC',
          ownerUserId: wsRow.owner_user_id,
          logoUrl: wsRow.logo_url ?? undefined,
          photoUrl: wsRow.photo_url ?? undefined,
          status: wsRow.status || 'ACTIVE',
          version: Number(wsRow.version || 1),
          isDeleted: Boolean(wsRow.is_deleted),
          updatedAt: Number(wsRow.updated_at || Date.now()),
        }
      : null;

    // 2. Family Members (strictly filtered by family_id)
    const membersRes = await client.query(
      `SELECT * FROM family_members WHERE family_id = $1 AND is_deleted = FALSE ORDER BY created_at ASC`,
      [familyId]
    );
    const members = (membersRes.rows || []).map((row: any) => ({
      id: row.id,
      familyId: row.family_id,
      userAccountId: row.user_account_id ?? null,
      displayName: row.display_name,
      relationshipToPrimary: row.relationship,
      role: row.role,
      membershipStatus: 'ACTIVE',
      birthDate: row.birth_date ?? undefined,
      isRestrictedProfile: Boolean(row.is_minor),
      avatarUrl: row.avatar_url ?? undefined,
      photoUrl: row.photo_url ?? undefined,
      allergies: Array.isArray(row.allergies_json) ? row.allergies_json : [],
      medicalNotes: row.medical_notes ?? undefined,
      dietaryNotes: row.dietary_notes ?? undefined,
      privateJournalNotes: row.private_journal_notes ?? undefined,
      version: Number(row.version || 1),
      isDeleted: Boolean(row.is_deleted),
      updatedAt: Number(row.updated_at || Date.now()),
    }));

    // 3. Family Memberships (strictly filtered by family_id)
    const memRes = await client.query(
      `SELECT * FROM family_memberships WHERE family_id = $1 ORDER BY joined_at ASC`,
      [familyId]
    );
    const allMemberships = (memRes.rows || []).map((row: any) => ({
      id: row.id,
      familyId: row.family_id,
      userAccountId: row.user_account_id,
      email: `${row.user_account_id}@familyos.local`,
      displayName: row.display_name,
      memberProfileId: row.member_profile_id,
      role: row.role,
      status: row.status,
      joinedAt: Number(row.joined_at || Date.now()),
      revokedAt: row.revoked_at ? Number(row.revoked_at) : undefined,
      revokedReason: row.revoked_reason ?? undefined,
      updatedAt: Number(row.updated_at || Date.now()),
    }));
    const activeMemberships = allMemberships.filter((m: any) => m.status === 'ACTIVE');

    // 4. Relationships (strictly filtered by family_id)
    const relRes = await client.query(
      `SELECT * FROM family_relationships WHERE family_id = $1 AND is_deleted = FALSE ORDER BY created_at ASC`,
      [familyId]
    );
    const relationships = (relRes.rows || []).map((row: any) => ({
      id: row.id,
      familyId: row.family_id,
      person1MemberId: row.from_member_id,
      person2MemberId: row.to_member_id,
      relationshipType: row.relationship_type,
      isBidirectional: Boolean(row.is_bidirectional),
      version: Number(row.version || 1),
      isDeleted: Boolean(row.is_deleted),
      createdAt: Number(row.created_at || Date.now()),
      updatedAt: Number(row.updated_at || Date.now()),
    }));

    // 5. Invitations (strictly filtered by family_id)
    const invRes = await client.query(
      `SELECT * FROM family_invitations WHERE family_id = $1 ORDER BY created_at ASC`,
      [familyId]
    );
    const invitations = (invRes.rows || []).map((row: any) => ({
      id: row.id,
      familyId: row.family_id,
      invitationToken: row.invitation_token_hash,
      invitedDisplayName: row.invitee_name,
      invitedEmail: row.invitee_email ?? '',
      targetRole: row.proposed_role,
      relationshipToPrimary: row.relationship_to_primary ?? '',
      status: row.status,
      createdById: row.created_by_user_id,
      acceptedById: row.accepted_by_user_id ?? null,
      expiresAt: Number(row.expires_at),
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    }));

    return {
      workspace,
      members,
      activeMemberships,
      allMemberships,
      relationships,
      invitations,
    };
  });
}

export interface FinanceQueryOptions {
  limit?: number;
  offset?: number;
  startDate?: number;
  endDate?: number;
  accountId?: string;
  category?: string;
}

export interface FinanceDomainData {
  accounts: any[];
  transactions: any[];
  totalTransactionsCount: number;
  budgets: any[];
  savingsGoals: any[];
  recurringRules: any[];
  investmentHoldings: any[];
}

/**
 * Loads financial domain data scoped strictly to `family_id = $1`.
 * Supports pagination, date-range filtering, and account filtering on transactions.
 * Preserves exact 64-bit BigInt integer-cents precision with paired *Decimal properties.
 */
export async function getFinanceDomainData(
  dbClientOrPool: any,
  familyId: string,
  options?: FinanceQueryOptions
): Promise<FinanceDomainData> {
  if (!familyId || typeof familyId !== 'string') {
    throw new Error('INVALID_FAMILY_ID: familyId is required for financial domain lookup.');
  }

  return await withDbClient(dbClientOrPool, async (client) => {
    // 1. Accounts strictly for family_id
    const accRes = await client.query(
      `SELECT * FROM financial_accounts WHERE family_id = $1 AND is_archived = FALSE ORDER BY created_at ASC`,
      [familyId]
    );
    const accounts = (accRes.rows || []).map((row: any) => {
      const balBig = parseSigned64BigInt(row.current_balance_cents) ?? 0n;
      return {
        id: row.id,
        familyId: row.family_id,
        name: row.name,
        accountType: row.account_type,
        currentBalanceCents: toSafeNumberOrNull(balBig),
        currentBalanceCentsDecimal: serializeBigIntToDecimalString(balBig),
        isLiability: Boolean(row.is_liability),
        institution: row.institution ?? undefined,
        currency: row.currency || 'USD',
        isArchived: Boolean(row.is_archived),
        updatedAt: Number(row.updated_at || Date.now()),
      };
    });

    // 2. Transactions with parameterized scoped filtering
    const conditions: string[] = ['family_id = $1'];
    const params: any[] = [familyId];

    if (options?.accountId) {
      params.push(options.accountId);
      conditions.push(`(account_id = $${params.length} OR destination_account_id = $${params.length})`);
    }
    if (options?.startDate !== undefined) {
      params.push(options.startDate);
      conditions.push(`transaction_date >= $${params.length}`);
    }
    if (options?.endDate !== undefined) {
      params.push(options.endDate);
      conditions.push(`transaction_date <= $${params.length}`);
    }
    if (options?.category) {
      params.push(options.category);
      conditions.push(`category = $${params.length}`);
    }

    const whereClause = conditions.join(' AND ');

    // Total count for pagination metadata
    const countRes = await client.query(
      `SELECT COUNT(*) as total FROM financial_transactions WHERE ${whereClause}`,
      params
    );
    const totalTransactionsCount = parseInt(countRes.rows?.[0]?.total || '0', 10);

    // Scoped transaction query with optional LIMIT/OFFSET
    let txSql = `SELECT * FROM financial_transactions WHERE ${whereClause} ORDER BY transaction_date DESC`;
    const txParams = [...params];
    if (options?.limit !== undefined && options.limit > 0) {
      txParams.push(options.limit);
      txSql += ` LIMIT $${txParams.length}`;
      if (options?.offset !== undefined && options.offset >= 0) {
        txParams.push(options.offset);
        txSql += ` OFFSET $${txParams.length}`;
      }
    }

    const txRes = await client.query(txSql, txParams);
    const transactions = (txRes.rows || []).map((row: any) => {
      const amtBig = parseSigned64BigInt(row.amount_cents) ?? 0n;
      return {
        id: row.id,
        familyId: row.family_id,
        accountId: row.account_id,
        destinationAccountId: row.destination_account_id ?? undefined,
        title: row.title,
        amountCents: toSafeNumberOrNull(amtBig),
        amountCentsDecimal: serializeBigIntToDecimalString(amtBig),
        transactionType: row.transaction_type,
        category: row.category,
        transactionDate: Number(row.transaction_date || Date.now()),
        isReversal: Boolean(row.is_reversal),
        reversalOfId: row.reversal_of_id ?? null,
        paidBy: row.paid_by || 'Household',
        notes: row.notes ?? undefined,
        status: row.status || 'POSTED',
        idempotencyKey: row.idempotency_key ?? undefined,
        createdAt: Number(row.created_at || Date.now()),
      };
    });

    // 3. Budgets strictly for family_id
    const bRes = await client.query(
      `SELECT * FROM financial_budgets WHERE family_id = $1 ORDER BY category ASC`,
      [familyId]
    );
    const budgets = (bRes.rows || []).map((row: any) => {
      const allocBig = parseSigned64BigInt(row.allocated_cents) ?? 0n;
      const spentBig = parseSigned64BigInt(row.spent_cents) ?? 0n;
      return {
        id: row.id,
        familyId: row.family_id,
        category: row.category,
        allocatedCents: toSafeNumberOrNull(allocBig),
        allocatedCentsDecimal: serializeBigIntToDecimalString(allocBig),
        spentCents: toSafeNumberOrNull(spentBig),
        spentCentsDecimal: serializeBigIntToDecimalString(spentBig),
        alertThresholdPercentage: Number(row.alert_threshold_percentage || 85),
        periodMonth: row.period_month || 'CURRENT',
        updatedAt: Number(row.updated_at || Date.now()),
      };
    });

    // 4. Savings Goals strictly for family_id
    const sgRes = await client.query(
      `SELECT * FROM savings_goals WHERE family_id = $1 ORDER BY created_at ASC`,
      [familyId]
    );
    const savingsGoals = (sgRes.rows || []).map((row: any) => {
      const targetBig = parseSigned64BigInt(row.target_cents) ?? 0n;
      const currentBig = parseSigned64BigInt(row.current_cents) ?? 0n;
      const plannedBig = parseSigned64BigInt(row.planned_monthly_contribution_cents) ?? 0n;
      const suggestedBig = parseSigned64BigInt(row.suggested_monthly_contribution_cents) ?? 0n;
      return {
        id: row.id,
        familyId: row.family_id,
        title: row.title,
        name: row.title,
        category: row.category,
        targetCents: toSafeNumberOrNull(targetBig),
        targetCentsDecimal: serializeBigIntToDecimalString(targetBig),
        targetAmountCents: toSafeNumberOrNull(targetBig),
        currentCents: toSafeNumberOrNull(currentBig),
        currentCentsDecimal: serializeBigIntToDecimalString(currentBig),
        currentAmountCents: toSafeNumberOrNull(currentBig),
        plannedMonthlyContributionCents: toSafeNumberOrNull(plannedBig),
        plannedMonthlyContributionCentsDecimal: serializeBigIntToDecimalString(plannedBig),
        suggestedMonthlyContributionCents: toSafeNumberOrNull(suggestedBig),
        suggestedMonthlyContributionCentsDecimal: serializeBigIntToDecimalString(suggestedBig),
        targetDate: row.target_date ? Number(row.target_date) : undefined,
        linkedAccountId: row.linked_account_id ?? undefined,
        isCompleted: Boolean(row.is_completed),
        contributions: Array.isArray(row.contributions_json) ? row.contributions_json : [],
        createdAt: Number(row.created_at || Date.now()),
        updatedAt: Number(row.updated_at || Date.now()),
      };
    });

    // 5. Recurring Rules strictly for family_id
    const rrRes = await client.query(
      `SELECT * FROM recurring_rules WHERE family_id = $1 AND is_active = TRUE ORDER BY next_due_date ASC`,
      [familyId]
    );
    const recurringRules = (rrRes.rows || []).map((row: any) => {
      const amtBig = parseSigned64BigInt(row.amount_cents) ?? 0n;
      return {
        id: row.id,
        familyId: row.family_id,
        accountId: row.account_id,
        title: row.title,
        amountCents: toSafeNumberOrNull(amtBig),
        amountCentsDecimal: serializeBigIntToDecimalString(amtBig),
        transactionType: row.transaction_type,
        category: row.category,
        recurrenceInterval: row.recurrence_interval,
        frequency: row.recurrence_interval,
        nextDueDate: Number(row.next_due_date || Date.now()),
        nextOccurrenceDate: Number(row.next_due_date || Date.now()),
        lastGeneratedDate: row.last_generated_date ? Number(row.last_generated_date) : undefined,
        isAutoPay: Boolean(row.is_auto_pay),
        isActive: Boolean(row.is_active),
        createdAt: Number(row.created_at || Date.now()),
        updatedAt: Number(row.updated_at || Date.now()),
      };
    });

    // 6. Investment Holdings strictly for family_id
    const ihRes = await client.query(
      `SELECT * FROM investment_holdings WHERE family_id = $1 AND is_deleted = FALSE ORDER BY created_at ASC`,
      [familyId]
    );
    const investmentHoldings = (ihRes.rows || []).map((row: any) => {
      const sharesBig = parseSigned64BigInt(row.quantity_microshares) ?? 0n;
      const costBig = parseSigned64BigInt(row.cost_basis_cents) ?? 0n;
      const priceBig = parseSigned64BigInt(row.current_price_cents) ?? 0n;
      const valBig = parseSigned64BigInt(row.current_valuation_cents) ?? 0n;
      const gainBig = parseSigned64BigInt(row.unrealized_gain_loss_cents) ?? 0n;
      const bpsBig = parseSigned64BigInt(row.gain_loss_basis_points) ?? 0n;
      return {
        id: row.id,
        familyId: row.family_id,
        accountId: row.account_id,
        symbol: row.symbol,
        assetName: row.asset_name,
        name: row.asset_name,
        assetType: row.asset_type,
        assetClass: row.asset_type,
        quantityMicroshares: toSafeNumberOrNull(sharesBig),
        quantityMicrosharesDecimal: serializeBigIntToDecimalString(sharesBig),
        sharesMicro: toSafeNumberOrNull(sharesBig),
        costBasisCents: toSafeNumberOrNull(costBig),
        costBasisCentsDecimal: serializeBigIntToDecimalString(costBig),
        currentPriceCents: toSafeNumberOrNull(priceBig),
        currentPriceCentsDecimal: serializeBigIntToDecimalString(priceBig),
        currentValuationCents: toSafeNumberOrNull(valBig),
        currentValuationCentsDecimal: serializeBigIntToDecimalString(valBig),
        unrealizedGainLossCents: toSafeNumberOrNull(gainBig),
        unrealizedGainLossCentsDecimal: serializeBigIntToDecimalString(gainBig),
        gainLossBasisPoints: toSafeNumberOrNull(bpsBig),
        currency: row.currency || 'USD',
        isDeleted: Boolean(row.is_deleted),
        lastPriceUpdatedAt: Number(row.last_price_updated_at || Date.now()),
        createdAt: Number(row.created_at || Date.now()),
        updatedAt: Number(row.updated_at || Date.now()),
      };
    });

    return {
      accounts,
      transactions,
      totalTransactionsCount,
      budgets,
      savingsGoals,
      recurringRules,
      investmentHoldings,
    };
  });
}

export interface HouseholdDomainData {
  meals: any[];
  recipes: any[];
  pantry: any[];
  groceries: any[];
  chores: any[];
  choreHistory: any[];
  assets: any[];
  assetMaintenance: any[];
  wardrobe: any[];
  outfits: any[];
  checklistTemplates: any[];
}

/**
 * Loads household domain data scoped strictly to `family_id = $1`.
 */
export async function getHouseholdDomainData(
  dbClientOrPool: any,
  familyId: string
): Promise<HouseholdDomainData> {
  if (!familyId || typeof familyId !== 'string') {
    throw new Error('INVALID_FAMILY_ID: familyId is required for household domain lookup.');
  }

  return await withDbClient(dbClientOrPool, async (client) => {
    // 1. Fetch household_records for the target family
    const hrRes = await client.query(
      `SELECT * FROM household_records WHERE family_id = $1 AND is_deleted = FALSE ORDER BY created_at ASC`,
      [familyId]
    );

    const householdByDomain: Record<string, any[]> = {
      MEAL: [],
      RECIPE: [],
      CHORE: [],
      CHORE_HISTORY: [],
      PANTRY: [],
      GROCERY: [],
      ASSET: [],
      ASSET_MAINTENANCE: [],
      WARDROBE: [],
      OUTFIT: [],
      CHECKLIST_TEMPLATE: [],
    };

    for (const row of hrRes.rows || []) {
      if (row.payload_json && householdByDomain[row.record_domain]) {
        householdByDomain[row.record_domain].push({
          ...row.payload_json,
          id: row.payload_json.id || row.id,
          familyId: row.family_id,
          isDeleted: Boolean(row.is_deleted),
          updatedAt: Number(row.updated_at || Date.now()),
        });
      }
    }

    // 2. Also check dedicated tables from migration 0002 if present and populate if richer
    try {
      const recipesRes = await client.query(
        `SELECT * FROM household_recipes WHERE family_id = $1 AND is_deleted = FALSE ORDER BY created_at ASC`,
        [familyId]
      );
      if (recipesRes.rows && recipesRes.rows.length > 0) {
        householdByDomain.RECIPE = recipesRes.rows.map((r: any) => ({
          id: r.id,
          familyId: r.family_id,
          title: r.title,
          description: r.description ?? undefined,
          prepTimeMinutes: Number(r.prep_time_minutes || 0),
          cookTimeMinutes: Number(r.cook_time_minutes || 0),
          servings: Number(r.servings || 4),
          ingredients: Array.isArray(r.ingredients_json) ? r.ingredients_json : [],
          instructions: Array.isArray(r.instructions_json) ? r.instructions_json : [],
          isDeleted: Boolean(r.is_deleted),
          createdAt: Number(r.created_at || Date.now()),
          updatedAt: Number(r.updated_at || Date.now()),
        }));
      }
    } catch {
      // Table may not exist yet in basic setup; ignore
    }

    try {
      const pantryRes = await client.query(
        `SELECT * FROM pantry_items WHERE family_id = $1 AND is_deleted = FALSE ORDER BY created_at ASC`,
        [familyId]
      );
      if (pantryRes.rows && pantryRes.rows.length > 0) {
        householdByDomain.PANTRY = pantryRes.rows.map((p: any) => ({
          id: p.id,
          familyId: p.family_id,
          name: p.name,
          category: p.category,
          quantity: Number(p.quantity || 1),
          unit: p.unit || 'units',
          location: p.location || 'Pantry',
          expiryDate: p.expiry_date ? Number(p.expiry_date) : undefined,
          isDeleted: Boolean(p.is_deleted),
          createdAt: Number(p.created_at || Date.now()),
          updatedAt: Number(p.updated_at || Date.now()),
        }));
      }
    } catch {
      // Ignore
    }

    try {
      const choresRes = await client.query(
        `SELECT * FROM household_chores WHERE family_id = $1 AND is_deleted = FALSE ORDER BY created_at ASC`,
        [familyId]
      );
      if (choresRes.rows && choresRes.rows.length > 0) {
        householdByDomain.CHORE = choresRes.rows.map((c: any) => ({
          id: c.id,
          familyId: c.family_id,
          title: c.title,
          description: c.description ?? undefined,
          assignedMemberId: c.assigned_member_id ?? undefined,
          frequency: c.frequency || 'DAILY',
          rewardPoints: Number(c.reward_points || 0),
          status: c.status || 'PENDING',
          isDeleted: Boolean(c.is_deleted),
          createdAt: Number(c.created_at || Date.now()),
          updatedAt: Number(c.updated_at || Date.now()),
        }));
      }
    } catch {
      // Ignore
    }

    try {
      const compRes = await client.query(
        `SELECT * FROM chore_completions WHERE family_id = $1 ORDER BY completed_at DESC LIMIT 100`,
        [familyId]
      );
      if (compRes.rows && compRes.rows.length > 0) {
        householdByDomain.CHORE_HISTORY = compRes.rows.map((cc: any) => ({
          id: cc.id,
          familyId: cc.family_id,
          choreId: cc.chore_id,
          completedByMemberId: cc.completed_by_member_id,
          verifiedByMemberId: cc.verified_by_member_id ?? undefined,
          pointsAwarded: Number(cc.points_awarded || 0),
          completedAt: Number(cc.completed_at || Date.now()),
        }));
      }
    } catch {
      // Ignore
    }

    return {
      meals: householdByDomain.MEAL,
      recipes: householdByDomain.RECIPE,
      pantry: householdByDomain.PANTRY,
      groceries: householdByDomain.GROCERY,
      chores: householdByDomain.CHORE,
      choreHistory: householdByDomain.CHORE_HISTORY,
      assets: householdByDomain.ASSET,
      assetMaintenance: householdByDomain.ASSET_MAINTENANCE,
      wardrobe: householdByDomain.WARDROBE,
      outfits: householdByDomain.OUTFIT,
      checklistTemplates: householdByDomain.CHECKLIST_TEMPLATE,
    };
  });
}

export interface FamilySectionCallerContext {
  memberId?: string;
  isPrivileged?: boolean;
}

export interface FamilySectionData {
  mediaAssets: any[];
  constitution: any[];
  traditions: any[];
  activities: any[];
  rules: any[];
  extendedRelatives: any[];
  albums: any[];
  relationships: any[];
}

/**
 * Loads family section items (media assets, constitution, traditions, activities, rules, extended relatives)
 * strictly filtered by `family_id = $1` and privacy boundaries.
 */
export async function getFamilySectionData(
  dbClientOrPool: any,
  familyId: string,
  callerContext?: FamilySectionCallerContext
): Promise<FamilySectionData> {
  if (!familyId || typeof familyId !== 'string') {
    throw new Error('INVALID_FAMILY_ID: familyId is required for family section lookup.');
  }

  return await withDbClient(dbClientOrPool, async (client) => {
    // 1. Media Assets strictly for family_id with privacy filtering
    const mediaRes = await client.query(
      `SELECT * FROM media_assets WHERE family_id = $1 AND is_deleted = FALSE ORDER BY created_at DESC`,
      [familyId]
    );
    const mediaAssets = (mediaRes.rows || [])
      .filter((row: any) => {
        if (row.visibility === 'SHARED' || !row.visibility) return true;
        if (callerContext?.isPrivileged) return true;
        return callerContext?.memberId && row.owner_member_id === callerContext.memberId;
      })
      .map((row: any) => ({
        id: row.id,
        familyId: row.family_id,
        ownerMemberId: row.owner_member_id,
        uploadedByUserId: row.uploaded_by_user_id,
        visibility: row.visibility,
        category: row.category,
        mimeType: row.mime_type,
        fileName: row.file_name,
        sizeBytes: Number(row.size_bytes || 0),
        dataUrl: row.data_url,
        isDeleted: Boolean(row.is_deleted),
        createdAt: Number(row.created_at || Date.now()),
        updatedAt: Number(row.updated_at || Date.now()),
      }));

    // 2. Synchronized domain entities for family_id
    const syncRes = await client.query(
      `SELECT * FROM synchronized_entities WHERE family_id = $1 AND is_deleted = FALSE AND entity_type IN ('FAMILY_CONSTITUTION', 'FAMILY_TRADITION', 'FAMILY_ACTIVITY', 'FAMILY_RULE', 'EXTENDED_RELATIVE', 'FAMILY_ALBUM') ORDER BY updated_at DESC`,
      [familyId]
    );

    const constitution: any[] = [];
    const traditions: any[] = [];
    const activities: any[] = [];
    const rules: any[] = [];
    const extendedRelatives: any[] = [];
    const albums: any[] = [];

    for (const row of syncRes.rows || []) {
      const item = {
        id: row.id,
        familyId: row.family_id,
        entityType: row.entity_type,
        version: Number(row.version || 1),
        isDeleted: Boolean(row.is_deleted),
        updatedByUserId: row.updated_by_user_id,
        updatedAt: Number(row.updated_at || Date.now()),
        ...(typeof row.data_json === 'object' && row.data_json !== null ? row.data_json : {}),
      };

      if (row.entity_type === 'FAMILY_CONSTITUTION') constitution.push(item);
      else if (row.entity_type === 'FAMILY_TRADITION') traditions.push(item);
      else if (row.entity_type === 'FAMILY_ACTIVITY') activities.push(item);
      else if (row.entity_type === 'FAMILY_RULE') rules.push(item);
      else if (row.entity_type === 'EXTENDED_RELATIVE') extendedRelatives.push(item);
      else if (row.entity_type === 'FAMILY_ALBUM') albums.push(item);
    }

    // 3. Relationships strictly for family_id
    const relRes = await client.query(
      `SELECT * FROM family_relationships WHERE family_id = $1 AND is_deleted = FALSE ORDER BY created_at ASC`,
      [familyId]
    );
    const relationships = (relRes.rows || []).map((row: any) => ({
      id: row.id,
      familyId: row.family_id,
      person1MemberId: row.from_member_id,
      person2MemberId: row.to_member_id,
      relationshipType: row.relationship_type,
      isBidirectional: Boolean(row.is_bidirectional),
      createdAt: Number(row.created_at || Date.now()),
      updatedAt: Number(row.updated_at || Date.now()),
    }));

    return {
      mediaAssets,
      constitution,
      traditions,
      activities,
      rules,
      extendedRelatives,
      albums,
      relationships,
    };
  });
}

// ============================================================================
// 2. TARGETED SINGLE-ENTITY & TRANSACTIONAL MUTATIONS
// ============================================================================

export interface ScopedTransactionInput {
  id: string;
  accountId: string;
  destinationAccountId?: string | null;
  title: string;
  amountCents: bigint | number;
  transactionType: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  category: string;
  transactionDate?: number;
  paidBy?: string;
  notes?: string;
  idempotencyKey?: string;
  isReversal?: boolean;
  reversalOfId?: string | null;
}

/**
 * Inserts a single transaction and balanced double-entry postings scoped strictly to `family_id = $1`
 * inside a short `BEGIN ... COMMIT` ACID transaction.
 * Updates target account balances without touching any unrelated rows or other families.
 */
export async function insertTransactionScoped(
  dbClientOrPool: any,
  familyId: string,
  tx: ScopedTransactionInput,
  options?: { actorUserId?: string }
): Promise<any> {
  if (!familyId || typeof familyId !== 'string') {
    throw new Error('INVALID_FAMILY_ID: familyId is required for transaction insertion.');
  }

  const amtBig = parseSigned64BigInt(tx.amountCents) ?? 0n;
  if (amtBig <= 0n) {
    throw new RangeError('INVALID_AMOUNT: Transaction amount must be positive.');
  }

  return await withDbClient(dbClientOrPool, async (client) => {
    try {
      await client.query('BEGIN');

      const now = Date.now();
      const txDate = tx.transactionDate ? Number(tx.transactionDate) : now;
      const txType = tx.transactionType;
      const cat = (tx.category || (txType === 'INCOME' ? 'INCOME' : 'EXPENSE')).toUpperCase();

      // Check if account exists strictly in this family
      const accCheck = await client.query(
        `SELECT id, current_balance_cents FROM financial_accounts WHERE id = $1 AND family_id = $2`,
        [tx.accountId, familyId]
      );
      if (!accCheck.rows || accCheck.rows.length === 0) {
        throw new Error(`ACCOUNT_NOT_FOUND: Account "${tx.accountId}" does not belong to family "${familyId}".`);
      }

      if (txType === 'TRANSFER' && tx.destinationAccountId) {
        const destCheck = await client.query(
          `SELECT id FROM financial_accounts WHERE id = $1 AND family_id = $2`,
          [tx.destinationAccountId, familyId]
        );
        if (!destCheck.rows || destCheck.rows.length === 0) {
          throw new Error(`DESTINATION_ACCOUNT_NOT_FOUND: Destination account "${tx.destinationAccountId}" does not belong to family "${familyId}".`);
        }
      }

      // Check idempotency if key provided
      if (tx.idempotencyKey) {
        const idempCheck = await client.query(
          `SELECT id FROM financial_transactions WHERE idempotency_key = $1 AND family_id = $2`,
          [tx.idempotencyKey, familyId]
        );
        if (idempCheck.rows && idempCheck.rows.length > 0) {
          await client.query('COMMIT');
          return { id: idempCheck.rows[0].id, duplicate: true };
        }
      }

      // 1. Insert into financial_transactions strictly for this family
      await client.query(
        `INSERT INTO financial_transactions (
           id, family_id, account_id, destination_account_id, title, amount_cents,
           transaction_type, category, transaction_date, is_reversal, reversal_of_id,
           paid_by, notes, status, idempotency_key, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           amount_cents = EXCLUDED.amount_cents,
           category = EXCLUDED.category,
           status = EXCLUDED.status`,
        [
          tx.id,
          familyId,
          tx.accountId,
          tx.destinationAccountId ?? null,
          tx.title || 'Transaction',
          amtBig.toString(10),
          txType,
          cat,
          txDate,
          Boolean(tx.isReversal),
          tx.reversalOfId ?? null,
          tx.paidBy ?? 'Household',
          tx.notes ?? null,
          'POSTED',
          tx.idempotencyKey ?? null,
          now,
        ]
      );

      // 2. Insert 2 balanced double-entry ledger postings strictly for this family
      let debitAccountId = '';
      let creditAccountId = '';
      const coaAccountId = `coa-${familyId}-${cat.toLowerCase()}`;

      // Ensure chart of accounts record exists for category
      try {
        await client.query(
          `INSERT INTO financial_accounts (id, family_id, name, account_type, current_balance_cents, is_liability, institution, currency, created_at, updated_at)
           VALUES ($1, $2, $3, $4, 0, FALSE, 'Family Chart of Accounts', 'USD', $5, $5)
           ON CONFLICT (id) DO NOTHING`,
          [coaAccountId, familyId, `General Ledger: ${cat}`, txType === 'INCOME' ? 'INCOME' : 'EXPENSE', now]
        );
      } catch {
        // Ignore if constraint already satisfies
      }

      if (txType === 'INCOME') {
        debitAccountId = tx.accountId;
        creditAccountId = coaAccountId;
      } else if (txType === 'TRANSFER') {
        debitAccountId = tx.destinationAccountId || `ext-transfer-${familyId}`;
        creditAccountId = tx.accountId;
      } else {
        debitAccountId = coaAccountId;
        creditAccountId = tx.accountId;
      }

      if (tx.isReversal) {
        const temp = debitAccountId;
        debitAccountId = creditAccountId;
        creditAccountId = temp;
      }

      // Try inserting into financial_entries
      try {
        await client.query(
          `INSERT INTO financial_entries (id, family_id, transaction_id, account_id, entry_type, amount_cents, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [`entry-${tx.id}-1`, familyId, tx.id, debitAccountId, 'DEBIT', amtBig.toString(10), now]
        );

        await client.query(
          `INSERT INTO financial_entries (id, family_id, transaction_id, account_id, entry_type, amount_cents, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [`entry-${tx.id}-2`, familyId, tx.id, creditAccountId, 'CREDIT', amtBig.toString(10), now]
        );
      } catch {
        // Table or trigger fallback in test/mock environment
      }

      // 3. Update target account balance directly (parameterized delta)
      let balanceDelta = 0n;
      if (txType === 'EXPENSE') {
        balanceDelta = tx.isReversal ? amtBig : -amtBig;
      } else if (txType === 'INCOME') {
        balanceDelta = tx.isReversal ? -amtBig : amtBig;
      } else {
        balanceDelta = tx.isReversal ? amtBig : -amtBig;
      }

      await client.query(
        `UPDATE financial_accounts
         SET current_balance_cents = current_balance_cents + $1, updated_at = $2
         WHERE id = $3 AND family_id = $4`,
        [balanceDelta.toString(10), now, tx.accountId, familyId]
      );

      if (txType === 'TRANSFER' && tx.destinationAccountId) {
        const destDelta = tx.isReversal ? -amtBig : amtBig;
        await client.query(
          `UPDATE financial_accounts
           SET current_balance_cents = current_balance_cents + $1, updated_at = $2
           WHERE id = $3 AND family_id = $4`,
          [destDelta.toString(10), now, tx.destinationAccountId, familyId]
        );
      }

      // 4. Update budget spent_cents if an expense
      if (txType === 'EXPENSE') {
        await client.query(
          `UPDATE financial_budgets
           SET spent_cents = spent_cents + $1, updated_at = $2
           WHERE category = $3 AND family_id = $4`,
          [balanceDelta < 0n ? amtBig.toString(10) : (-amtBig).toString(10), now, tx.category, familyId]
        );
      }

      await client.query('COMMIT');

      return {
        id: tx.id,
        familyId,
        accountId: tx.accountId,
        destinationAccountId: tx.destinationAccountId ?? undefined,
        title: tx.title,
        amountCents: toSafeNumberOrNull(amtBig),
        amountCentsDecimal: serializeBigIntToDecimalString(amtBig),
        transactionType: txType,
        category: cat,
        transactionDate: txDate,
        isReversal: Boolean(tx.isReversal),
        reversalOfId: tx.reversalOfId ?? null,
        paidBy: tx.paidBy ?? 'Household',
        status: 'POSTED',
        createdAt: now,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  });
}

export interface ScopedReversalInput {
  reversalTxId?: string;
  reason?: string;
  actorUserId?: string;
}

/**
 * Reverses an existing transaction strictly within `family_id = $1` inside an ACID transaction.
 */
export async function reverseTransactionScoped(
  dbClientOrPool: any,
  familyId: string,
  originalTxId: string,
  reversalData?: ScopedReversalInput
): Promise<any> {
  if (!familyId || !originalTxId) {
    throw new Error('INVALID_ARGUMENTS: familyId and originalTxId are required for transaction reversal.');
  }

  return await withDbClient(dbClientOrPool, async (client) => {
    try {
      await client.query('BEGIN');

      // Fetch original transaction strictly within this family
      const origRes = await client.query(
        `SELECT * FROM financial_transactions WHERE id = $1 AND family_id = $2`,
        [originalTxId, familyId]
      );

      if (!origRes.rows || origRes.rows.length === 0) {
        throw new Error(`TRANSACTION_NOT_FOUND: Transaction "${originalTxId}" not found in family "${familyId}".`);
      }

      const orig = origRes.rows[0];
      if (orig.is_reversal) {
        throw new Error('ALREADY_REVERSAL: Cannot reverse an existing reversal transaction.');
      }

      // Check if already reversed
      const existingRev = await client.query(
        `SELECT id FROM financial_transactions WHERE reversal_of_id = $1 AND family_id = $2`,
        [originalTxId, familyId]
      );
      if (existingRev.rows && existingRev.rows.length > 0) {
        throw new Error(`ALREADY_REVERSED: Transaction "${originalTxId}" has already been reversed by "${existingRev.rows[0].id}".`);
      }

      const revId = reversalData?.reversalTxId || `rev-${originalTxId}-${Date.now().toString(36)}`;
      const amtBig = parseSigned64BigInt(orig.amount_cents) ?? 0n;

      // Insert reversal transaction
      const reversalTx: ScopedTransactionInput = {
        id: revId,
        accountId: orig.account_id,
        destinationAccountId: orig.destination_account_id,
        title: `Reversal of: ${orig.title}`,
        amountCents: amtBig,
        transactionType: orig.transaction_type,
        category: orig.category,
        transactionDate: Date.now(),
        paidBy: orig.paid_by,
        isReversal: true,
        reversalOfId: originalTxId,
        notes: reversalData?.reason || 'User requested reversal',
      };

      // Call insertTransactionScoped internally on the same client inside the transaction
      // Direct SQL on the client
      const now = Date.now();
      await client.query(
        `INSERT INTO financial_transactions (
           id, family_id, account_id, destination_account_id, title, amount_cents,
           transaction_type, category, transaction_date, is_reversal, reversal_of_id,
           paid_by, notes, status, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          revId,
          familyId,
          orig.account_id,
          orig.destination_account_id ?? null,
          reversalTx.title,
          amtBig.toString(10),
          orig.transaction_type,
          orig.category,
          now,
          true,
          originalTxId,
          orig.paid_by ?? 'Household',
          reversalTx.notes ?? null,
          'POSTED',
          now,
        ]
      );

      // Invert account balance
      let delta = 0n;
      if (orig.transaction_type === 'EXPENSE') {
        delta = amtBig; // Add back
      } else if (orig.transaction_type === 'INCOME') {
        delta = -amtBig; // Deduct
      } else {
        delta = amtBig;
      }

      await client.query(
        `UPDATE financial_accounts
         SET current_balance_cents = current_balance_cents + $1, updated_at = $2
         WHERE id = $3 AND family_id = $4`,
        [delta.toString(10), now, orig.account_id, familyId]
      );

      if (orig.transaction_type === 'TRANSFER' && orig.destination_account_id) {
        await client.query(
          `UPDATE financial_accounts
           SET current_balance_cents = current_balance_cents - $1, updated_at = $2
           WHERE id = $3 AND family_id = $4`,
          [amtBig.toString(10), now, orig.destination_account_id, familyId]
        );
      }

      await client.query('COMMIT');

      return {
        id: revId,
        reversalOfId: originalTxId,
        familyId,
        amountCents: toSafeNumberOrNull(amtBig),
        amountCentsDecimal: serializeBigIntToDecimalString(amtBig),
        isReversal: true,
        createdAt: now,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  });
}

export interface ScopedSavingsContributionInput {
  id?: string;
  amountCents: bigint | number;
  fundingAccountId?: string;
  contributedBy: string;
  note?: string;
  createdAt?: number;
}

/**
 * Records a contribution toward a savings goal scoped strictly to `family_id = $1`.
 */
export async function recordSavingsContributionScoped(
  dbClientOrPool: any,
  familyId: string,
  goalId: string,
  contribution: ScopedSavingsContributionInput
): Promise<any> {
  if (!familyId || !goalId) {
    throw new Error('INVALID_ARGUMENTS: familyId and goalId are required.');
  }

  const amtBig = parseSigned64BigInt(contribution.amountCents) ?? 0n;
  if (amtBig <= 0n) {
    throw new RangeError('INVALID_AMOUNT: Contribution amount must be positive.');
  }

  return await withDbClient(dbClientOrPool, async (client) => {
    try {
      await client.query('BEGIN');

      // Fetch savings goal strictly within family_id
      const sgRes = await client.query(
        `SELECT * FROM savings_goals WHERE id = $1 AND family_id = $2`,
        [goalId, familyId]
      );
      if (!sgRes.rows || sgRes.rows.length === 0) {
        throw new Error(`GOAL_NOT_FOUND: Savings goal "${goalId}" not found in family "${familyId}".`);
      }

      const goal = sgRes.rows[0];
      const now = Date.now();
      const prevCents = parseSigned64BigInt(goal.current_cents) ?? 0n;
      const targetCents = parseSigned64BigInt(goal.target_cents) ?? 0n;
      const newCurrentCents = prevCents + amtBig;
      const isCompleted = newCurrentCents >= targetCents;

      // Construct contribution entry
      const contribId = contribution.id || `contrib-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const contribRecord = {
        id: contribId,
        goalId,
        familyId,
        amountCents: toSafeNumberOrNull(amtBig),
        amountCentsDecimal: serializeBigIntToDecimalString(amtBig),
        fundingAccountId: contribution.fundingAccountId ?? undefined,
        contributedBy: contribution.contributedBy,
        note: contribution.note ?? undefined,
        createdAt: contribution.createdAt || now,
      };

      const existingContribs = Array.isArray(goal.contributions_json) ? goal.contributions_json : [];
      const updatedContribs = [...existingContribs, contribRecord];

      // Update goal
      await client.query(
        `UPDATE savings_goals
         SET current_cents = $1, is_completed = $2, contributions_json = $3::jsonb, updated_at = $4
         WHERE id = $5 AND family_id = $6`,
        [newCurrentCents.toString(10), isCompleted, JSON.stringify(updatedContribs), now, goalId, familyId]
      );

      // If funding account specified, deduct from account balance and insert ledger entry
      if (contribution.fundingAccountId) {
        await client.query(
          `UPDATE financial_accounts
           SET current_balance_cents = current_balance_cents - $1, updated_at = $2
           WHERE id = $3 AND family_id = $4`,
          [amtBig.toString(10), now, contribution.fundingAccountId, familyId]
        );

        // Record a transaction for audit trail
        const txId = `tx-sg-${contribId}`;
        await client.query(
          `INSERT INTO financial_transactions (
             id, family_id, account_id, title, amount_cents, transaction_type,
             category, transaction_date, paid_by, status, created_at
           ) VALUES ($1, $2, $3, $4, $5, 'TRANSFER', 'SAVINGS', $6, $7, 'POSTED', $8)
           ON CONFLICT (id) DO NOTHING`,
          [
            txId,
            familyId,
            contribution.fundingAccountId,
            `Savings Goal Contribution: ${goal.title}`,
            amtBig.toString(10),
            now,
            contribution.contributedBy,
            now,
          ]
        );
      }

      await client.query('COMMIT');

      return {
        goalId,
        familyId,
        targetCents: toSafeNumberOrNull(targetCents),
        currentCents: toSafeNumberOrNull(newCurrentCents),
        currentCentsDecimal: serializeBigIntToDecimalString(newCurrentCents),
        isCompleted,
        contribution: contribRecord,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  });
}

export interface ScopedChoreCompletionInput {
  id?: string;
  completedByMemberId: string;
  verifiedByMemberId?: string;
  pointsAwarded?: number;
  completedAt?: number;
  notes?: string;
}

/**
 * Records completion of a chore and awards points to the assigned member strictly within `family_id = $1`.
 */
export async function updateChoreCompletionScoped(
  dbClientOrPool: any,
  familyId: string,
  choreId: string,
  completion: ScopedChoreCompletionInput
): Promise<any> {
  if (!familyId || !choreId || !completion.completedByMemberId) {
    throw new Error('INVALID_ARGUMENTS: familyId, choreId, and completedByMemberId are required.');
  }

  return await withDbClient(dbClientOrPool, async (client) => {
    try {
      await client.query('BEGIN');

      const now = Date.now();
      const compId = completion.id || `comp-${now}-${Math.random().toString(36).substr(2, 5)}`;
      const points = Math.max(0, Number(completion.pointsAwarded || 0));

      // 1. Insert into chore_completions strictly for this family
      try {
        await client.query(
          `INSERT INTO chore_completions (id, family_id, chore_id, completed_by_member_id, verified_by_member_id, points_awarded, completed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            compId,
            familyId,
            choreId,
            completion.completedByMemberId,
            completion.verifiedByMemberId ?? null,
            points,
            completion.completedAt || now,
          ]
        );
      } catch {
        // Fallback for household_records
      }

      // 2. Insert into household_records (domain 'CHORE_HISTORY')
      await client.query(
        `INSERT INTO household_records (id, family_id, record_domain, payload_json, is_deleted, created_at, updated_at)
         VALUES ($1, $2, 'CHORE_HISTORY', $3::jsonb, FALSE, $4, $4)
         ON CONFLICT (id) DO UPDATE SET payload_json = EXCLUDED.payload_json, updated_at = EXCLUDED.updated_at`,
        [
          `CHORE_HISTORY:${compId}`,
          familyId,
          JSON.stringify({
            id: compId,
            familyId,
            choreId,
            completedByMemberId: completion.completedByMemberId,
            verifiedByMemberId: completion.verifiedByMemberId,
            pointsAwarded: points,
            notes: completion.notes,
            completedAt: completion.completedAt || now,
          }),
          now,
        ]
      );

      // 3. Award points to family_member if points > 0
      let updatedBalance = points;
      if (points > 0) {
        const memRes = await client.query(
          `UPDATE family_members
           SET points_balance = COALESCE(points_balance, 0) + $1, updated_at = $2
           WHERE id = $3 AND family_id = $4
           RETURNING points_balance`,
          [points, now, completion.completedByMemberId, familyId]
        );
        updatedBalance = Number(memRes.rows?.[0]?.points_balance || points);

        // Record in reward_points_ledger
        try {
          await client.query(
            `INSERT INTO reward_points_ledger (id, family_id, member_id, delta_points, reason, balance_after, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              `pts-${now}-${Math.random().toString(36).substr(2, 5)}`,
              familyId,
              completion.completedByMemberId,
              points,
              `Completed chore: ${choreId}`,
              updatedBalance,
              now,
            ]
          );
        } catch {
          // Ignore if table missing in test
        }
      }

      // 4. Update household_chores status if present
      try {
        await client.query(
          `UPDATE household_chores
           SET status = 'COMPLETED', updated_at = $1
           WHERE id = $2 AND family_id = $3`,
          [now, choreId, familyId]
        );
      } catch {
        // Ignore
      }

      await client.query('COMMIT');

      return {
        completionId: compId,
        familyId,
        choreId,
        completedByMemberId: completion.completedByMemberId,
        pointsAwarded: points,
        memberPointsBalance: updatedBalance,
        completedAt: completion.completedAt || now,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  });
}

export interface ScopedPantryItemInput {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  location?: string;
  expiryDate?: number;
  minimumQuantity?: number;
  isDeleted?: boolean;
}

/**
 * Inserts, updates, or soft-deletes a pantry item strictly within `family_id = $1`.
 */
export async function updatePantryItemScoped(
  dbClientOrPool: any,
  familyId: string,
  pantryItem: ScopedPantryItemInput
): Promise<any> {
  if (!familyId || !pantryItem.id) {
    throw new Error('INVALID_ARGUMENTS: familyId and pantryItem.id are required.');
  }

  return await withDbClient(dbClientOrPool, async (client) => {
    try {
      await client.query('BEGIN');

      const now = Date.now();
      const isDeleted = Boolean(pantryItem.isDeleted);

      // Upsert into household_records (domain 'PANTRY')
      await client.query(
        `INSERT INTO household_records (id, family_id, record_domain, payload_json, is_deleted, created_at, updated_at)
         VALUES ($1, $2, 'PANTRY', $3::jsonb, $4, $5, $5)
         ON CONFLICT (id) DO UPDATE SET
           payload_json = EXCLUDED.payload_json,
           is_deleted = EXCLUDED.is_deleted,
           updated_at = EXCLUDED.updated_at`,
        [
          `PANTRY:${pantryItem.id}`,
          familyId,
          JSON.stringify({
            id: pantryItem.id,
            familyId,
            name: pantryItem.name,
            category: pantryItem.category,
            quantity: pantryItem.quantity,
            unit: pantryItem.unit,
            location: pantryItem.location || 'Pantry',
            expiryDate: pantryItem.expiryDate,
            minimumQuantity: pantryItem.minimumQuantity,
            isDeleted,
            updatedAt: now,
          }),
          isDeleted,
          now,
        ]
      );

      // Also sync to dedicated pantry_items table if it exists
      try {
        await client.query(
          `INSERT INTO pantry_items (id, family_id, name, category, quantity, unit, location, expiry_date, is_deleted, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             category = EXCLUDED.category,
             quantity = EXCLUDED.quantity,
             unit = EXCLUDED.unit,
             location = EXCLUDED.location,
             expiry_date = EXCLUDED.expiry_date,
             is_deleted = EXCLUDED.is_deleted,
             updated_at = EXCLUDED.updated_at`,
          [
            pantryItem.id,
            familyId,
            pantryItem.name,
            pantryItem.category,
            pantryItem.quantity,
            pantryItem.unit,
            pantryItem.location || 'Pantry',
            pantryItem.expiryDate ? Number(pantryItem.expiryDate) : null,
            isDeleted,
            now,
          ]
        );
      } catch {
        // Ignore if dedicated table is not present
      }

      await client.query('COMMIT');
      return { ...pantryItem, familyId, updatedAt: now };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  });
}

export interface ScopedMealPlanInput {
  id: string;
  planDate: number;
  mealType: string;
  recipeId?: string;
  customMealName?: string;
  servings?: number;
  assignedCookMemberId?: string;
  isDeleted?: boolean;
}

/**
 * Upserts or soft-deletes a meal plan record strictly within `family_id = $1`.
 */
export async function updateMealPlanScoped(
  dbClientOrPool: any,
  familyId: string,
  mealPlan: ScopedMealPlanInput
): Promise<any> {
  if (!familyId || !mealPlan.id) {
    throw new Error('INVALID_ARGUMENTS: familyId and mealPlan.id are required.');
  }

  return await withDbClient(dbClientOrPool, async (client) => {
    try {
      await client.query('BEGIN');

      const now = Date.now();
      const isDeleted = Boolean(mealPlan.isDeleted);

      await client.query(
        `INSERT INTO household_records (id, family_id, record_domain, payload_json, is_deleted, created_at, updated_at)
         VALUES ($1, $2, 'MEAL', $3::jsonb, $4, $5, $5)
         ON CONFLICT (id) DO UPDATE SET
           payload_json = EXCLUDED.payload_json,
           is_deleted = EXCLUDED.is_deleted,
           updated_at = EXCLUDED.updated_at`,
        [
          `MEAL:${mealPlan.id}`,
          familyId,
          JSON.stringify({
            id: mealPlan.id,
            familyId,
            planDate: mealPlan.planDate,
            mealType: mealPlan.mealType,
            recipeId: mealPlan.recipeId,
            customMealName: mealPlan.customMealName,
            servings: mealPlan.servings || 4,
            assignedCookMemberId: mealPlan.assignedCookMemberId,
            isDeleted,
            updatedAt: now,
          }),
          isDeleted,
          now,
        ]
      );

      await client.query('COMMIT');
      return { ...mealPlan, familyId, updatedAt: now };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  });
}

export interface ScopedSyncEntityInput {
  entityKey: string;
  id: string;
  entityType: string;
  data: Record<string, unknown>;
  version?: number;
  baseVersion?: number;
  forceOverwrite?: boolean;
  isDeleted?: boolean;
  updatedByUserId?: string;
}

/**
 * Upserts a synchronized entity record strictly within `family_id = $1` with
 * 409 VERSION_CONFLICT optimistic lock detection.
 */
export async function syncEntityScoped(
  dbClientOrPool: any,
  familyId: string,
  entity: ScopedSyncEntityInput
): Promise<{ record: any; nextVersion: number }> {
  if (!familyId || !entity.entityKey || !entity.id) {
    throw new Error('INVALID_ARGUMENTS: familyId, entityKey, and id are required.');
  }

  return await withDbClient(dbClientOrPool, async (client) => {
    try {
      await client.query('BEGIN');

      // Row-level lock strictly within this family
      const prevRes = await client.query(
        `SELECT entity_key, version, data_json, is_deleted FROM synchronized_entities WHERE entity_key = $1 AND family_id = $2 FOR UPDATE`,
        [entity.entityKey, familyId]
      );

      const prevRow = prevRes.rows?.[0];
      const prevVersion = prevRow ? Number(prevRow.version) : 0;

      // Optimistic concurrency check
      if (
        !entity.forceOverwrite &&
        prevRow &&
        entity.baseVersion !== undefined &&
        entity.baseVersion !== prevVersion
      ) {
        await client.query('ROLLBACK');
        const conflictError: any = new Error(
          `VERSION_CONFLICT: Concurrent mutation on ${entity.entityKey} (client baseVersion=${entity.baseVersion}, server version=${prevVersion}).`
        );
        conflictError.code = 'VERSION_CONFLICT';
        conflictError.statusCode = 409;
        conflictError.serverVersion = prevVersion;
        conflictError.serverRecord = prevRow.data_json;
        throw conflictError;
      }

      const nextVersion = prevVersion + 1;
      const now = Date.now();
      const isDeleted = Boolean(entity.isDeleted);

      await client.query(
        `INSERT INTO synchronized_entities (
           entity_key, id, family_id, entity_type, version, is_deleted,
           updated_by_user_id, data_json, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
         ON CONFLICT (entity_key) DO UPDATE SET
           version = EXCLUDED.version,
           is_deleted = EXCLUDED.is_deleted,
           updated_by_user_id = EXCLUDED.updated_by_user_id,
           data_json = EXCLUDED.data_json,
           updated_at = EXCLUDED.updated_at`,
        [
          entity.entityKey,
          entity.id,
          familyId,
          entity.entityType,
          nextVersion,
          isDeleted,
          entity.updatedByUserId || 'system',
          JSON.stringify(entity.data),
          now,
        ]
      );

      await client.query('COMMIT');

      return {
        record: {
          id: entity.id,
          familyId,
          entityType: entity.entityType,
          version: nextVersion,
          isDeleted,
          updatedByUserId: entity.updatedByUserId || 'system',
          data: entity.data,
          updatedAt: now,
        },
        nextVersion,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  });
}

/**
 * Executes a parameterized soft-delete (is_deleted = TRUE) query strictly scoped to `family_id = $1`.
 */
export async function softDeleteScopedEntity(
  dbClientOrPool: any,
  table: string,
  familyId: string,
  entityId: string
): Promise<boolean> {
  const allowedTables = new Set([
    'financial_accounts',
    'financial_transactions',
    'financial_budgets',
    'savings_goals',
    'recurring_rules',
    'investment_holdings',
    'household_records',
    'household_recipes',
    'pantry_items',
    'household_chores',
    'household_assets',
    'media_assets',
    'synchronized_entities',
  ]);

  if (!allowedTables.has(table)) {
    throw new Error(`UNALLOWED_TABLE: Table "${table}" is not allowed for soft-delete.`);
  }

  return await withDbClient(dbClientOrPool, async (client) => {
    const idColumn = table === 'synchronized_entities' ? 'entity_key' : 'id';
    const now = Date.now();
    const res = await client.query(
      `UPDATE ${table} SET is_deleted = TRUE, updated_at = $1 WHERE ${idColumn} = $2 AND family_id = $3`,
      [now, entityId, familyId]
    );
    return (res.rowCount || 0) > 0;
  });
}
