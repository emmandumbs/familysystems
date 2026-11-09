import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  buildDefaultStage332Data,
  type AuthoritativeChecklistTemplate,
  type AuthoritativeGoal,
  type AuthoritativeMilestone,
  type AuthoritativeProject,
  type AuthoritativeRewardConfig,
  type AuthoritativeTask,
} from './planningAndExecution';
import {
  buildFam1DemoFinanceData,
  buildFam1DemoHouseholdData,
} from '../../tests/fixtures/demoFixtures';
import { seedDefaultCalendarAndRoutines } from './calendarAndRoutines';
import { ensureFamilySectionSeedData } from './familySectionRoutes';
import { serializeBigIntToDecimalString, toSafeNumberOrNull } from '../utils/financeFormatting';

export interface SharedAccount {
  id: string;
  familyId: string;
  name: string;
  accountType: 'CHECKING' | 'SAVINGS' | 'CREDIT_CARD' | 'INVESTMENT' | 'CASH' | 'LOAN';
  currentBalanceCents: number;
  isLiability: boolean;
  institution: string;
  lastReconciledAt?: number;
  isArchived?: boolean;
  updatedAt?: number;
}

export interface SharedBudget {
  id: string;
  familyId: string;
  category: string;
  allocatedCents: number;
  spentCents: number;
  alertThresholdPercentage: number;
  updatedAt?: number;
}

export interface SharedTransaction {
  id: string;
  familyId: string;
  accountId: string;
  destinationAccountId?: string | null;
  title: string;
  amountCents: number;
  transactionType: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  category: string;
  transactionDate: number;
  isReversal: boolean;
  reversalOfId?: string | null;
  paidBy: string;
  idempotencyKey?: string;
  status?: 'DRAFT' | 'POSTED' | 'VOID';
}

export interface SharedFinancialEntry {
  id: string;
  familyId: string;
  transactionId: string;
  accountId: string;
  entryType: 'DEBIT' | 'CREDIT';
  amountCents: number;
  sequenceNumber: number;
  createdAt: number;
}

export interface SharedSyncRecord {
  operationId: string;
  idempotencyKey: string;
  familyId: string;
  entityType: string;
  entityId: string;
  operationType: string;
  conflictPolicy: string;
  acknowledgedAt: number;
  responseReceipt?: Record<string, unknown>;
}

export interface SharedAuditEvent {
  id: string;
  familyId: string;
  actorUserId?: string;
  actorRole: string;
  actionType: string;
  summary: string;
  createdAt: number;
}

export type FamilyRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'CHILD' | 'GUEST';
export type MembershipStatus = 'ACTIVE' | 'INVITED' | 'PENDING_APPROVAL' | 'SUSPENDED' | 'REVOKED';

export interface AuthoritativeMembership {
  id: string;
  familyId: string;
  userAccountId: string;
  email: string;
  displayName: string;
  memberProfileId: string;
  role: FamilyRole;
  status: MembershipStatus;
  updatedAt: number;
}

export interface AuthoritativeGuardianLink {
  id: string;
  familyId: string;
  guardianMemberId: string;
  minorMemberId: string;
  relationship: string;
  canManageHealthRecords: boolean;
}

export interface ImportantDateItem {
  id: string;
  label: string;
  dateIso: string; // e.g. "1986-10-30" or "06-18"
  category: 'BIRTHDAY' | 'ANNIVERSARY' | 'MILESTONE' | 'SCHOOL' | 'MEDICAL';
}

export interface MemberEmergencyContactInfo {
  contactName: string;
  relationship: string;
  primaryPhone: string;
  secondaryPhone?: string;
  medicalNotes?: string;
}

export interface MemberPersonalWorkspaceInfo {
  privateBioNotes: string;
  personalPhone?: string;
  personalEmail?: string;
  privateGoalsSummary?: string;
  sensitiveMedicalNotes?: string;
}

export interface MemberSharedProfileInfo {
  bio: string;
  favoriteMeals?: string[];
  hobbies?: string[];
  schoolOrWork?: string;
  clothingSizes?: string;
}

export interface AuthoritativeFamilyMember {
  id: string;
  familyId: string;
  userAccountId?: string | null;
  displayName: string;
  relationshipToPrimary: 'SELF' | 'SPOUSE' | 'CHILD' | 'PARENT' | 'GRANDPARENT' | 'SIBLING' | 'OTHER' | string;
  role: FamilyRole;
  membershipStatus: MembershipStatus;
  birthDate: string | null; // ISO YYYY-MM-DD
  birthDateEpoch?: number | null;
  importantDates: ImportantDateItem[];
  avatarUrl: string | null;
  photoUrl: string | null;
  responsibilities: string[];
  emergencyContact: MemberEmergencyContactInfo;
  sharedInfo: MemberSharedProfileInfo;
  personalInfo: MemberPersonalWorkspaceInfo | null;
  dietaryPreferences: string[];
  allergies: string[];
  isRestrictedProfile: boolean;
  pointsBalance: number;
  version: number;
  updatedAt: number;
  isDeleted: boolean;
}

export type RelationshipTypeCode =
  | 'PARENT_CHILD'
  | 'SPOUSE_PARTNER'
  | 'SIBLING'
  | 'GRANDPARENT_GRANDCHILD'
  | 'GUARDIAN_WARD'
  | 'OTHER';

export interface AuthoritativeFamilyRelationship {
  id: string;
  familyId: string;
  person1MemberId: string;
  person2MemberId: string;
  relationshipType: RelationshipTypeCode;
  notes?: string | null;
  createdAt: number;
  updatedAt: number;
  isDeleted?: boolean;
}

export type InvitationLifecycleStatus =
  | 'PENDING'
  | 'ACCEPTED_AWAITING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'REVOKED'
  | 'EXPIRED';

export interface AuthoritativeInvitation {
  id: string;
  familyId: string;
  invitationToken: string;
  invitedEmail: string;
  invitedDisplayName: string;
  targetRole: FamilyRole;
  assignedMemberProfileId: string;
  invitedByUserId: string;
  acceptedByUserId?: string | null;
  status: InvitationLifecycleStatus;
  useCount?: number;
  maxUses?: number;
  expiresAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface AuthoritativeMediaAsset {
  id: string;
  familyId: string;
  ownerMemberId: string;
  uploadedByUserId: string;
  visibility: 'SHARED' | 'PERSONAL';
  category: 'LOGO' | 'FAMILY_PHOTO' | 'AVATAR' | 'PROFILE_PHOTO';
  mimeType: string;
  fileName: string;
  dataUrl: string;
  sizeBytes: number;
  createdAt: number;
  updatedAt: number;
  isDeleted?: boolean;
}

export interface AuthoritativeAnnouncement {
  id: string;
  title: string;
  body: string;
  authorName: string;
  priority: 'NORMAL' | 'IMPORTANT' | 'URGENT';
  pinned: boolean;
  createdAt: number;
}

export interface AuthoritativeReminder {
  id: string;
  title: string;
  dueLabel: string;
  assignedMemberId?: string | null;
  category: 'HOUSEHOLD' | 'SCHOOL' | 'MAINTENANCE' | 'HEALTH' | 'FINANCE';
  isCompleted: boolean;
  createdAt: number;
}

export interface AuthoritativeAiSuggestion {
  id: string;
  title: string;
  summary: string;
  category: 'SCHEDULE' | 'MEAL_PLAN' | 'BUDGET' | 'CHORES';
  status: 'APPROVED' | 'DISMISSED';
  approvedByMemberId: string;
  createdAt: number;
}

export interface SynchronizedEntityRecord {
  id: string;
  familyId: string;
  entityType: string;
  version: number;
  isDeleted: boolean;
  updatedAt: number;
  updatedByUserId: string;
  data: Record<string, unknown>;
}

export interface AuthoritativeWorkspace {
  id: string;
  name: string;
  description?: string;
  motto?: string;
  mission?: string;
  vision?: string;
  values?: string[];
  logoUrl?: string | null;
  photoUrl?: string | null;
  coverImageUrl?: string | null;
  country?: string;
  language?: string;
  status?: string;
  timezone?: string;
  currencyCode: string;
  ownerUserId: string;
  announcements?: AuthoritativeAnnouncement[];
  reminders?: AuthoritativeReminder[];
  approvedAiSuggestions?: AuthoritativeAiSuggestion[];
  version: number;
  updatedAt: number;
  isDeleted?: boolean;
}

export interface SharedStore {
  schemaVersion?: string;
  migrationReconciliation?: Record<string, unknown>;
  workspace: AuthoritativeWorkspace;
  workspaces?: Record<string, AuthoritativeWorkspace>;
  memberships?: AuthoritativeMembership[];
  familyMembers?: AuthoritativeFamilyMember[];
  familyRelationships?: AuthoritativeFamilyRelationship[];
  invitations?: AuthoritativeInvitation[];
  mediaAssets?: Record<string, AuthoritativeMediaAsset>;
  guardianRelationships?: AuthoritativeGuardianLink[];
  goals?: AuthoritativeGoal[];
  projects?: AuthoritativeProject[];
  milestones?: AuthoritativeMilestone[];
  planningTasks?: AuthoritativeTask[];
  checklistTemplates?: AuthoritativeChecklistTemplate[];
  rewardConfigs?: Record<string, AuthoritativeRewardConfig>;
  calendarEvents?: any[];
  routines?: any[];
  routineOccurrences?: any[];
  tasks?: any[];
  accounts: SharedAccount[];
  budgets: SharedBudget[];
  transactions: SharedTransaction[];
  financialEntries?: SharedFinancialEntry[];
  // Durable Finance Collections
  savingsGoals?: any[];
  recurringRules?: any[];
  investmentHoldings?: any[];
  reconciliations?: any[];
  // Durable Household Collections
  householdRecipes?: any[];
  householdMeals?: any[];
  householdGroceries?: any[];
  householdChores?: any[];
  householdChoreHistory?: any[];
  householdAssets?: any[];
  householdAssetMaintenance?: any[];
  householdPantry?: any[];
  householdWardrobe?: any[];
  householdOutfits?: any[];
  householdCustomTaxonomies?: Record<string, { locations: string[]; categories: string[] }>;
  synchronizedEntities?: Record<string, SynchronizedEntityRecord>;
  processedIdempotencyKeys: Record<string, SharedSyncRecord>;
  auditEvents: SharedAuditEvent[];
}

export interface BackupManifestEntry {
  backupFile: string;
  sourceFile: string;
  sha256: string;
  createdAt: number;
  accountCount: number;
  transactionCount: number;
  netWorthCents: number;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'familyos-shared-store.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const PRE_3_2_BACKUP_PATH = path.join(BACKUP_DIR, 'familyos-shared-store.pre-3.2.bak.json');
const MANIFEST_PATH = path.join(BACKUP_DIR, 'manifest.json');

export function computeSha256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
}

export function calculateNetWorthFromAccounts(accounts: SharedAccount[], familyId = 'fam-1') {
  const famAccounts = (accounts || []).filter((a) => a.familyId === familyId);
  let totalAssetsBig = 0n;
  let totalLiabilitiesBig = 0n;
  for (const a of famAccounts) {
    const raw = (a as any).currentBalanceCentsDecimal ?? a.currentBalanceCents ?? 0;
    const balBig = BigInt(typeof raw === 'number' ? Math.trunc(raw) : String(raw).trim() || '0');
    if (a.isLiability) {
      totalLiabilitiesBig += balBig < 0n ? -balBig : balBig;
    } else {
      totalAssetsBig += balBig;
    }
  }
  const netWorthBig = totalAssetsBig - totalLiabilitiesBig;
  return {
    totalAssetsCents: toSafeNumberOrNull(totalAssetsBig) ?? 0,
    totalAssetsCentsDecimal: serializeBigIntToDecimalString(totalAssetsBig),
    totalLiabilitiesCents: toSafeNumberOrNull(totalLiabilitiesBig) ?? 0,
    totalLiabilitiesCentsDecimal: serializeBigIntToDecimalString(totalLiabilitiesBig),
    netWorthCents: toSafeNumberOrNull(netWorthBig) ?? 0,
    netWorthCentsDecimal: serializeBigIntToDecimalString(netWorthBig),
  };
}

export function seedDefaultAuthoritativeData(baseStore: SharedStore): SharedStore {
  const now = Date.now();
  const prevWs = baseStore.workspaces?.['fam-1'] || baseStore.workspace;

  const defaultAnnouncements: AuthoritativeAnnouncement[] = prevWs?.announcements || [
    {
      id: 'ann-1',
      title: 'Autumn Family Council & Sunday Roast',
      body: 'Grandma Martha and Grandpa Edward are joining us this Sunday at 4:00 PM. Please review your weekly chore checklists before 2:00 PM.',
      authorName: 'Sarah Henderson',
      priority: 'IMPORTANT',
      pinned: true,
      createdAt: now - 3600_000 * 6,
    },
    {
      id: 'ann-2',
      title: 'Winter Emergency Kit & Smoke Detector Verification Complete',
      body: 'All basement water reserves, flashlights, and dual-sensor smoke detectors have been inspected and logged for Q4.',
      authorName: 'David Henderson',
      priority: 'NORMAL',
      pinned: false,
      createdAt: now - 3600_000 * 28,
    },
  ];

  const defaultReminders: AuthoritativeReminder[] = prevWs?.reminders || [
    {
      id: 'rem-1',
      title: 'Sign Lucas permission slip for Science Museum field trip',
      dueLabel: 'Today, 5:00 PM',
      assignedMemberId: 'mem-sarah',
      category: 'SCHOOL',
      isCompleted: false,
      createdAt: now - 3600_000 * 12,
    },
    {
      id: 'rem-2',
      title: 'Replace HVAC MERV-13 air filter in attic unit',
      dueLabel: 'Saturday, 10:00 AM',
      assignedMemberId: 'mem-david',
      category: 'MAINTENANCE',
      isCompleted: false,
      createdAt: now - 3600_000 * 24,
    },
    {
      id: 'rem-3',
      title: 'Confirm pediatric dental checkup for Maya & Lucas',
      dueLabel: 'Next Tuesday',
      assignedMemberId: 'mem-sarah',
      category: 'HEALTH',
      isCompleted: true,
      createdAt: now - 3600_000 * 48,
    },
  ];

  const defaultApprovedAiSuggestions: AuthoritativeAiSuggestion[] = prevWs?.approvedAiSuggestions || [
    {
      id: 'ai-sug-1',
      title: 'Batch Prep Quinoa & Herb Chicken on Wednesday Evening',
      summary: 'Approved schedule optimization: shifts 25 mins of prep to Wednesday so Thursday soccer practice evening stays stress-free.',
      category: 'MEAL_PLAN',
      status: 'APPROVED',
      approvedByMemberId: 'mem-sarah',
      createdAt: now - 3600_000 * 18,
    },
    {
      id: 'ai-sug-2',
      title: 'Auto-Sweep $350 Surplus to High-Yield Emergency Reserve',
      summary: 'Approved monthly cash-flow rule based on October utility savings (+35000L cents under envelope target).',
      category: 'BUDGET',
      status: 'APPROVED',
      approvedByMemberId: 'mem-david',
      createdAt: now - 3600_000 * 40,
    },
  ];

  const fam1Workspace: AuthoritativeWorkspace = {
    id: 'fam-1',
    name: prevWs?.name || 'The Henderson Household',
    description:
      prevWs?.description ||
      'Multi-generational family stewardship workspace anchored in calm organization, financial clarity, and mutual care.',
    motto: prevWs?.motto || 'Stewardship, Kindness, and Calm Preparedness in Every Season.',
    mission:
      prevWs?.mission ||
      'To cultivate a warm, resilient, and well-ordered home where every generation is supported, heard, and equipped to thrive.',
    vision:
      prevWs?.vision ||
      'A multi-generational household operating with zero financial ambiguity, shared responsibility, and enduring family traditions.',
    values: prevWs?.values || [
      'Intentional Stewardship',
      'Generational Connection',
      'Truth & Transparency',
      'Calm Preparedness',
      'Joyful Hospitality',
    ],
    logoUrl: prevWs?.logoUrl || '/api/v1/media/fam-1/media-logo-fam1',
    photoUrl: prevWs?.photoUrl || '/api/v1/media/fam-1/media-photo-fam1',
    currencyCode: prevWs?.currencyCode || 'USD',
    ownerUserId: 'usr-sarah-owner',
    announcements: defaultAnnouncements,
    reminders: defaultReminders,
    approvedAiSuggestions: defaultApprovedAiSuggestions,
    version: Math.max(prevWs?.version || 3, 3),
    updatedAt: prevWs?.updatedAt || now,
    isDeleted: false,
  };

  const fam2Workspace: AuthoritativeWorkspace = {
    id: 'fam-2',
    name: 'The Carter Household',
    description: 'Carter family shared workspace',
    motto: 'Together Forward',
    mission: 'Support our family goals and daily routines.',
    vision: 'Peaceful home operations.',
    values: ['Unity', 'Growth'],
    logoUrl: null,
    photoUrl: null,
    currencyCode: 'USD',
    ownerUserId: 'usr-carter-owner',
    announcements: [],
    reminders: [],
    approvedAiSuggestions: [],
    version: 1,
    updatedAt: now,
    isDeleted: false,
  };

  const defaultMemberships: AuthoritativeMembership[] = [
    {
      id: 'memship-sarah-fam1',
      familyId: 'fam-1',
      userAccountId: 'usr-sarah-owner',
      email: 'emmanuelsillah19@gmail.com',
      displayName: 'Sarah Henderson',
      memberProfileId: 'mem-sarah',
      role: 'OWNER',
      status: 'ACTIVE',
      updatedAt: now,
    },
    {
      id: 'memship-david-fam1',
      familyId: 'fam-1',
      userAccountId: 'usr-david-admin',
      email: 'david.henderson@familyos.local',
      displayName: 'David Henderson',
      memberProfileId: 'mem-david',
      role: 'ADMIN',
      status: 'ACTIVE',
      updatedAt: now,
    },
    {
      id: 'memship-maya-fam1',
      familyId: 'fam-1',
      userAccountId: 'usr-maya-member',
      email: 'maya.henderson@familyos.local',
      displayName: 'Maya Henderson',
      memberProfileId: 'mem-maya',
      role: 'MEMBER',
      status: 'ACTIVE',
      updatedAt: now,
    },
    {
      id: 'memship-lucas-fam1',
      familyId: 'fam-1',
      userAccountId: 'usr-lucas-child',
      email: 'lucas.henderson@familyos.local',
      displayName: 'Lucas Henderson',
      memberProfileId: 'mem-lucas',
      role: 'CHILD',
      status: 'ACTIVE',
      updatedAt: now,
    },
    {
      id: 'memship-martha-fam1',
      familyId: 'fam-1',
      userAccountId: 'usr-martha-guest',
      email: 'martha.grandma@familyos.local',
      displayName: 'Grandma Martha',
      memberProfileId: 'mem-martha',
      role: 'GUEST',
      status: 'ACTIVE',
      updatedAt: now,
    },
    {
      id: 'memship-revoked-fam1',
      familyId: 'fam-1',
      userAccountId: 'usr-former-babysitter',
      email: 'former.sitter@familyos.local',
      displayName: 'Former Babysitter',
      memberProfileId: 'mem-former-sitter',
      role: 'GUEST',
      status: 'REVOKED',
      updatedAt: now,
    },
    {
      id: 'memship-carter-fam2',
      familyId: 'fam-2',
      userAccountId: 'usr-carter-owner',
      email: 'alex.carter@familyos.local',
      displayName: 'Alex Carter',
      memberProfileId: 'mem-carter',
      role: 'OWNER',
      status: 'ACTIVE',
      updatedAt: now,
    },
  ];

  const defaultFamilyMembers: AuthoritativeFamilyMember[] = [
    {
      id: 'mem-sarah',
      familyId: 'fam-1',
      userAccountId: 'usr-sarah-owner',
      displayName: 'Sarah Henderson',
      relationshipToPrimary: 'SELF',
      role: 'OWNER',
      membershipStatus: 'ACTIVE',
      birthDate: '1986-10-30',
      birthDateEpoch: 531014400000,
      importantDates: [
        { id: 'id-sarah-bday', label: 'Sarah Birthday', dateIso: '1986-10-30', category: 'BIRTHDAY' },
        { id: 'id-sarah-anniv', label: 'Wedding Anniversary', dateIso: '2012-06-16', category: 'ANNIVERSARY' },
      ],
      avatarUrl: '/api/v1/media/fam-1/media-avatar-sarah',
      photoUrl: '/api/v1/media/fam-1/media-avatar-sarah',
      responsibilities: [
        'Household Financial Architecture & Monthly Treasury Review',
        'Pediatric Healthcare & School Coordination',
        'Weekly Meal Planning & Nutrition',
      ],
      emergencyContact: {
        contactName: 'David Henderson (Spouse)',
        relationship: 'Husband / Co-Head',
        primaryPhone: '(555) 234-5678',
        secondaryPhone: '(555) 876-5432',
        medicalNotes: 'No known drug allergies. Blood Type O+.',
      },
      sharedInfo: {
        bio: 'Pediatric nurse practitioner, family steward, and avid sourdough baker.',
        favoriteMeals: ['Herb-Roasted Lemon Chicken & Quinoa', 'Tuscan Garlic Herb Pasta'],
        hobbies: ['Botanical gardening', 'Chamber music', 'Trail running'],
        schoolOrWork: 'St. Jude Family Health Clinic',
      },
      personalInfo: {
        privateBioNotes: 'Personal reflection workspace: preparing 2027 sabbatical proposal and estate trust update.',
        personalPhone: '(555) 123-4567',
        personalEmail: 'emmanuelsillah19@gmail.com',
        privateGoalsSummary: 'Complete half-marathon training by May; max out HSA contribution.',
      },
      dietaryPreferences: ['Mediterranean', 'Low Refined Sugar'],
      allergies: [],
      isRestrictedProfile: false,
      pointsBalance: 140,
      version: 1,
      updatedAt: now,
      isDeleted: false,
    },
    {
      id: 'mem-david',
      familyId: 'fam-1',
      userAccountId: 'usr-david-admin',
      displayName: 'David Henderson',
      relationshipToPrimary: 'SPOUSE',
      role: 'ADMIN',
      membershipStatus: 'ACTIVE',
      birthDate: '1985-04-14',
      birthDateEpoch: 482284800000,
      importantDates: [
        { id: 'id-david-bday', label: 'David Birthday', dateIso: '1985-04-14', category: 'BIRTHDAY' },
        { id: 'id-david-anniv', label: 'Wedding Anniversary', dateIso: '2012-06-16', category: 'ANNIVERSARY' },
      ],
      avatarUrl: '/api/v1/media/fam-1/media-avatar-david',
      photoUrl: '/api/v1/media/fam-1/media-avatar-david',
      responsibilities: [
        'Home Assets, HVAC & Solar Infrastructure Maintenance',
        'Emergency Preparedness & Utility Shutoff Drills',
        'Weekend Grocery & Outdoor Stewardship',
      ],
      emergencyContact: {
        contactName: 'Sarah Henderson (Spouse)',
        relationship: 'Wife / Co-Head',
        primaryPhone: '(555) 123-4567',
        secondaryPhone: '(555) 345-6789',
        medicalNotes: 'Low-sodium blood pressure management. Blood Type A+.',
      },
      sharedInfo: {
        bio: 'Structural engineer and household operations lead.',
        favoriteMeals: ['Cedar Plank Salmon', 'Rosemary Focaccia'],
        hobbies: ['Woodworking', 'Youth soccer coaching', 'Home automation'],
        schoolOrWork: 'Meridian Civil Engineering',
      },
      personalInfo: {
        privateBioNotes: 'Personal workspace: tracking patent filing notes and anniversary trip planning.',
        personalPhone: '(555) 234-5678',
        personalEmail: 'david.henderson@familyos.local',
        privateGoalsSummary: 'Finish workshop dust collection build.',
      },
      dietaryPreferences: ['Low Sodium'],
      allergies: ['Penicillin (Mild Rash)'],
      isRestrictedProfile: false,
      pointsBalance: 120,
      version: 1,
      updatedAt: now,
      isDeleted: false,
    },
    {
      id: 'mem-maya',
      familyId: 'fam-1',
      userAccountId: 'usr-maya-member',
      displayName: 'Maya Henderson',
      relationshipToPrimary: 'CHILD',
      role: 'MEMBER',
      membershipStatus: 'ACTIVE',
      birthDate: '2011-09-12',
      birthDateEpoch: 1315785600000,
      importantDates: [
        { id: 'id-maya-bday', label: 'Maya Birthday', dateIso: '2011-09-12', category: 'BIRTHDAY' },
        { id: 'id-maya-recital', label: 'Autumn Cello Recital', dateIso: '2026-11-18', category: 'SCHOOL' },
      ],
      avatarUrl: '/api/v1/media/fam-1/media-avatar-maya',
      photoUrl: '/api/v1/media/fam-1/media-avatar-maya',
      responsibilities: [
        'Living Room & Study Area Organization',
        'Evening Dog Walk (Bailey)',
        'Thursday Dinner Salad Prep',
      ],
      emergencyContact: {
        contactName: 'Sarah Henderson (Mother)',
        relationship: 'Mother / Primary Guardian',
        primaryPhone: '(555) 123-4567',
        secondaryPhone: '(555) 234-5678',
        medicalNotes: 'Seasonal pollen sensitivity.',
      },
      sharedInfo: {
        bio: 'High school sophomore, cellist, and robotics team programmer.',
        favoriteMeals: ['Tuscan Garlic Herb Pasta', 'Berry Smoothie Bowls'],
        hobbies: ['Cello', 'Python robotics', 'Watercolor'],
        schoolOrWork: 'Oakridge Academy (Grade 10)',
      },
      personalInfo: {
        privateBioNotes: 'Maya private study journal & AP Biology exam prep checklist (visible only to Maya & Owners/Admins).',
        personalEmail: 'maya.henderson@familyos.local',
        privateGoalsSummary: 'First chair audition in December.',
      },
      dietaryPreferences: ['Vegetarian Friendly'],
      allergies: ['Tree Pollen'],
      isRestrictedProfile: false,
      pointsBalance: 95,
      version: 1,
      updatedAt: now,
      isDeleted: false,
    },
    {
      id: 'mem-lucas',
      familyId: 'fam-1',
      userAccountId: 'usr-lucas-child',
      displayName: 'Lucas Henderson',
      relationshipToPrimary: 'CHILD',
      role: 'CHILD',
      membershipStatus: 'ACTIVE',
      birthDate: '2016-05-22',
      birthDateEpoch: 1463875200000,
      importantDates: [
        { id: 'id-lucas-bday', label: 'Lucas Birthday', dateIso: '2016-05-22', category: 'BIRTHDAY' },
        { id: 'id-lucas-science', label: 'Elementary Science Fair', dateIso: '2026-11-12', category: 'SCHOOL' },
      ],
      avatarUrl: '/api/v1/media/fam-1/media-avatar-lucas',
      photoUrl: '/api/v1/media/fam-1/media-avatar-lucas',
      responsibilities: [
        'Morning Dishwasher Unloading & Plate Reset',
        'Bedroom Toy & Book Shelf Tidy',
        'Watering Kitchen Herb Window Box',
      ],
      emergencyContact: {
        contactName: 'Sarah & David Henderson (Parents)',
        relationship: 'Legal Guardians',
        primaryPhone: '(555) 123-4567',
        secondaryPhone: '(555) 234-5678',
        medicalNotes: 'SEVERE ANAPHYLACTIC PEANUT ALLERGY — Carry EpiPen Jr at all times.',
      },
      sharedInfo: {
        bio: '5th grader who loves astronomy, LEGO engineering, and soccer goalkeeper drills.',
        favoriteMeals: ['Herb-Roasted Lemon Chicken & Quinoa', 'Apple Cinnamon Pancakes'],
        hobbies: ['Telescope stargazing', 'Soccer', 'LEGO Technic'],
        schoolOrWork: 'Oakridge Elementary (Grade 5)',
      },
      personalInfo: {
        privateBioNotes: 'Guardian-managed minor profile. Pediatrician: Dr. Eleanor Vance, MD.',
        sensitiveMedicalNotes: 'EpiPen Jr lot #EP-88412 stored in kitchen medical cabinet and school nurse office.',
      },
      dietaryPreferences: ['Strict Nut-Free'],
      allergies: ['Peanuts & Tree Nuts (Severe Anaphylactic)'],
      isRestrictedProfile: true,
      pointsBalance: 110,
      version: 1,
      updatedAt: now,
      isDeleted: false,
    },
    {
      id: 'mem-martha',
      familyId: 'fam-1',
      userAccountId: 'usr-martha-guest',
      displayName: 'Grandma Martha',
      relationshipToPrimary: 'GRANDPARENT',
      role: 'GUEST',
      membershipStatus: 'ACTIVE',
      birthDate: '1954-02-19',
      birthDateEpoch: -500688000000,
      importantDates: [
        { id: 'id-martha-bday', label: 'Grandma Martha Birthday', dateIso: '1954-02-19', category: 'BIRTHDAY' },
      ],
      avatarUrl: '/api/v1/media/fam-1/media-avatar-martha',
      photoUrl: '/api/v1/media/fam-1/media-avatar-martha',
      responsibilities: [
        'Family Recipe Archive Curator',
        'Wednesday Afternoon Reading & Piano Time with Lucas',
      ],
      emergencyContact: {
        contactName: 'Sarah Henderson (Daughter)',
        relationship: 'Daughter',
        primaryPhone: '(555) 123-4567',
        medicalNotes: 'Dr. Gregory Patel (Cardiology) • (555) 990-1122',
      },
      sharedInfo: {
        bio: 'Retired music teacher and keeper of three generations of family recipes.',
        favoriteMeals: ['Sunday Pot Roast', 'Chamomile Lemon Cake'],
        hobbies: ['Piano', 'Quilting', 'Genealogy'],
        schoolOrWork: 'Retired Educator',
      },
      personalInfo: {
        privateBioNotes: 'Guest profile personal notes.',
        personalPhone: '(555) 444-8899',
      },
      dietaryPreferences: ['Low Sodium', 'Decaf Only'],
      allergies: [],
      isRestrictedProfile: false,
      pointsBalance: 40,
      version: 1,
      updatedAt: now,
      isDeleted: false,
    },
    {
      id: 'mem-edward',
      familyId: 'fam-1',
      userAccountId: null,
      displayName: 'Grandpa Edward',
      relationshipToPrimary: 'GRANDPARENT',
      role: 'GUEST',
      membershipStatus: 'ACTIVE',
      birthDate: '1952-08-03',
      birthDateEpoch: -549504000000,
      importantDates: [
        { id: 'id-edward-bday', label: 'Grandpa Edward Birthday', dateIso: '1952-08-03', category: 'BIRTHDAY' },
      ],
      avatarUrl: '/api/v1/media/fam-1/media-avatar-edward',
      photoUrl: '/api/v1/media/fam-1/media-avatar-edward',
      responsibilities: [
        'Family History & Heirloom Tool Mentor',
        'Seasonal Orchard & Garden Pruning',
      ],
      emergencyContact: {
        contactName: 'David Henderson (Son)',
        relationship: 'Son',
        primaryPhone: '(555) 234-5678',
      },
      sharedInfo: {
        bio: 'Retired master carpenter and storyteller.',
        favoriteMeals: ['Roast Chicken', 'Minestrone Soup'],
        hobbies: ['Cabinetmaking', 'Chess with Maya & Lucas'],
        schoolOrWork: 'Retired Master Carpenter',
      },
      personalInfo: null,
      dietaryPreferences: [],
      allergies: [],
      isRestrictedProfile: false,
      pointsBalance: 35,
      version: 1,
      updatedAt: now,
      isDeleted: false,
    },
    {
      id: 'mem-carter',
      familyId: 'fam-2',
      userAccountId: 'usr-carter-owner',
      displayName: 'Alex Carter',
      relationshipToPrimary: 'SELF',
      role: 'OWNER',
      membershipStatus: 'ACTIVE',
      birthDate: '1988-07-10',
      birthDateEpoch: 584496000000,
      importantDates: [],
      avatarUrl: null,
      photoUrl: null,
      responsibilities: ['Household Lead'],
      emergencyContact: {
        contactName: 'Jordan Carter',
        relationship: 'Spouse',
        primaryPhone: '(555) 777-9999',
      },
      sharedInfo: {
        bio: 'Carter household head.',
      },
      personalInfo: {
        privateBioNotes: 'Carter private workspace notes.',
      },
      dietaryPreferences: [],
      allergies: [],
      isRestrictedProfile: false,
      pointsBalance: 0,
      version: 1,
      updatedAt: now,
      isDeleted: false,
    },
  ];

  const defaultFamilyRelationships: AuthoritativeFamilyRelationship[] = [
    {
      id: 'rel-sarah-david',
      familyId: 'fam-1',
      person1MemberId: 'mem-sarah',
      person2MemberId: 'mem-david',
      relationshipType: 'SPOUSE_PARTNER',
      notes: 'Married June 16, 2012 • Co-Heads of Household',
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    },
    {
      id: 'rel-sarah-maya',
      familyId: 'fam-1',
      person1MemberId: 'mem-sarah',
      person2MemberId: 'mem-maya',
      relationshipType: 'PARENT_CHILD',
      notes: 'Mother to Maya',
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    },
    {
      id: 'rel-david-maya',
      familyId: 'fam-1',
      person1MemberId: 'mem-david',
      person2MemberId: 'mem-maya',
      relationshipType: 'PARENT_CHILD',
      notes: 'Father to Maya',
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    },
    {
      id: 'rel-sarah-lucas',
      familyId: 'fam-1',
      person1MemberId: 'mem-sarah',
      person2MemberId: 'mem-lucas',
      relationshipType: 'PARENT_CHILD',
      notes: 'Mother & Primary Guardian to Lucas',
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    },
    {
      id: 'rel-david-lucas',
      familyId: 'fam-1',
      person1MemberId: 'mem-david',
      person2MemberId: 'mem-lucas',
      relationshipType: 'PARENT_CHILD',
      notes: 'Father & Primary Guardian to Lucas',
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    },
    {
      id: 'rel-maya-lucas',
      familyId: 'fam-1',
      person1MemberId: 'mem-maya',
      person2MemberId: 'mem-lucas',
      relationshipType: 'SIBLING',
      notes: 'Sister & Brother',
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    },
    {
      id: 'rel-martha-sarah',
      familyId: 'fam-1',
      person1MemberId: 'mem-martha',
      person2MemberId: 'mem-sarah',
      relationshipType: 'PARENT_CHILD',
      notes: 'Grandma Martha is Sarah’s mother (Generation I -> II)',
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    },
    {
      id: 'rel-edward-david',
      familyId: 'fam-1',
      person1MemberId: 'mem-edward',
      person2MemberId: 'mem-david',
      relationshipType: 'PARENT_CHILD',
      notes: 'Grandpa Edward is David’s father (Generation I -> II)',
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    },
  ];

  const defaultInvitations: AuthoritativeInvitation[] = [
    {
      id: 'inv-uncle-james',
      familyId: 'fam-1',
      invitationToken: 'fos_inv_james_2026',
      invitedEmail: 'james.henderson@familyos.local',
      invitedDisplayName: 'Uncle James Henderson',
      targetRole: 'MEMBER',
      assignedMemberProfileId: 'mem-james-pending',
      invitedByUserId: 'usr-sarah-owner',
      acceptedByUserId: null,
      status: 'PENDING',
      expiresAt: now + 7 * 24 * 3600 * 1000,
      createdAt: now - 3600_000 * 10,
      updatedAt: now - 3600_000 * 10,
    },
  ];

  const makeSvgDataUrl = (initials: string, bgHex: string, accentHex: string) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="36" fill="${bgHex}"/><circle cx="80" cy="80" r="68" fill="none" stroke="${accentHex}" stroke-width="3" opacity="0.65"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#F7F4EC" font-family="Georgia, serif" font-size="52" font-weight="bold">${initials}</text></svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf-8').toString('base64')}`;
  };

  const defaultMediaAssets: Record<string, AuthoritativeMediaAsset> = {
    'media-logo-fam1': {
      id: 'media-logo-fam1',
      familyId: 'fam-1',
      ownerMemberId: 'mem-sarah',
      uploadedByUserId: 'usr-sarah-owner',
      visibility: 'SHARED',
      category: 'LOGO',
      mimeType: 'image/svg+xml',
      fileName: 'henderson-crest.svg',
      dataUrl: makeSvgDataUrl('HH', '#173D35', '#C39A60'),
      sizeBytes: 412,
      createdAt: now,
      updatedAt: now,
    },
    'media-photo-fam1': {
      id: 'media-photo-fam1',
      familyId: 'fam-1',
      ownerMemberId: 'mem-sarah',
      uploadedByUserId: 'usr-sarah-owner',
      visibility: 'SHARED',
      category: 'FAMILY_PHOTO',
      mimeType: 'image/svg+xml',
      fileName: 'henderson-family-portrait.svg',
      dataUrl: makeSvgDataUrl('FAM', '#214E43', '#C39A60'),
      sizeBytes: 428,
      createdAt: now,
      updatedAt: now,
    },
    'media-avatar-sarah': {
      id: 'media-avatar-sarah',
      familyId: 'fam-1',
      ownerMemberId: 'mem-sarah',
      uploadedByUserId: 'usr-sarah-owner',
      visibility: 'SHARED',
      category: 'AVATAR',
      mimeType: 'image/svg+xml',
      fileName: 'sarah-avatar.svg',
      dataUrl: makeSvgDataUrl('SH', '#173D35', '#C39A60'),
      sizeBytes: 390,
      createdAt: now,
      updatedAt: now,
    },
    'media-avatar-david': {
      id: 'media-avatar-david',
      familyId: 'fam-1',
      ownerMemberId: 'mem-david',
      uploadedByUserId: 'usr-david-admin',
      visibility: 'SHARED',
      category: 'AVATAR',
      mimeType: 'image/svg+xml',
      fileName: 'david-avatar.svg',
      dataUrl: makeSvgDataUrl('DH', '#1E463D', '#C39A60'),
      sizeBytes: 390,
      createdAt: now,
      updatedAt: now,
    },
    'media-avatar-maya': {
      id: 'media-avatar-maya',
      familyId: 'fam-1',
      ownerMemberId: 'mem-maya',
      uploadedByUserId: 'usr-maya-member',
      visibility: 'SHARED',
      category: 'AVATAR',
      mimeType: 'image/svg+xml',
      fileName: 'maya-avatar.svg',
      dataUrl: makeSvgDataUrl('MH', '#2E5A4E', '#C39A60'),
      sizeBytes: 390,
      createdAt: now,
      updatedAt: now,
    },
    'media-avatar-lucas': {
      id: 'media-avatar-lucas',
      familyId: 'fam-1',
      ownerMemberId: 'mem-lucas',
      uploadedByUserId: 'usr-sarah-owner',
      visibility: 'SHARED',
      category: 'AVATAR',
      mimeType: 'image/svg+xml',
      fileName: 'lucas-avatar.svg',
      dataUrl: makeSvgDataUrl('LH', '#78552B', '#F7F4EC'),
      sizeBytes: 390,
      createdAt: now,
      updatedAt: now,
    },
    'media-avatar-martha': {
      id: 'media-avatar-martha',
      familyId: 'fam-1',
      ownerMemberId: 'mem-martha',
      uploadedByUserId: 'usr-sarah-owner',
      visibility: 'SHARED',
      category: 'AVATAR',
      mimeType: 'image/svg+xml',
      fileName: 'martha-avatar.svg',
      dataUrl: makeSvgDataUrl('GM', '#3B5249', '#C39A60'),
      sizeBytes: 390,
      createdAt: now,
      updatedAt: now,
    },
    'media-avatar-edward': {
      id: 'media-avatar-edward',
      familyId: 'fam-1',
      ownerMemberId: 'mem-edward',
      uploadedByUserId: 'usr-sarah-owner',
      visibility: 'SHARED',
      category: 'AVATAR',
      mimeType: 'image/svg+xml',
      fileName: 'edward-avatar.svg',
      dataUrl: makeSvgDataUrl('GE', '#3B5249', '#C39A60'),
      sizeBytes: 390,
      createdAt: now,
      updatedAt: now,
    },
  };

  const defaultGuardians: AuthoritativeGuardianLink[] = [
    {
      id: 'guard-sarah-lucas',
      familyId: 'fam-1',
      guardianMemberId: 'mem-sarah',
      minorMemberId: 'mem-lucas',
      relationship: 'MOTHER',
      canManageHealthRecords: true,
    },
    {
      id: 'guard-david-lucas',
      familyId: 'fam-1',
      guardianMemberId: 'mem-david',
      minorMemberId: 'mem-lucas',
      relationship: 'FATHER',
      canManageHealthRecords: true,
    },
  ];

  const defaultHomeAndDomainEntities: Record<string, SynchronizedEntityRecord> = {
    'WELLBEING_PROFILE:wp-lucas': {
      id: 'wp-lucas',
      familyId: 'fam-1',
      entityType: 'WELLBEING_PROFILE',
      version: 1,
      isDeleted: false,
      updatedAt: now,
      updatedByUserId: 'usr-sarah-owner',
      data: {
        id: 'wp-lucas',
        familyId: 'fam-1',
        memberId: 'mem-lucas',
        isRestrictedMinor: true,
        bloodType: 'A+',
        primaryPhysicianName: 'Dr. Eleanor Vance, MD',
        allergies: ['Peanuts & Tree Nuts (Severe Anaphylactic)'],
      },
    },
    'REFLECTION_JOURNAL:rj-maya-private': {
      id: 'rj-maya-private',
      familyId: 'fam-1',
      entityType: 'REFLECTION_JOURNAL',
      version: 1,
      isDeleted: false,
      updatedAt: now,
      updatedByUserId: 'usr-maya-member',
      data: {
        id: 'rj-maya-private',
        familyId: 'fam-1',
        memberId: 'mem-maya',
        isPrivate: true,
        title: 'Personal Gratitude & Exam Reflections',
        content: 'Private personal entry visible only to Maya.',
      },
    },
    'EMERGENCY_CONTACT:ec-1': {
      id: 'ec-1',
      familyId: 'fam-1',
      entityType: 'EMERGENCY_CONTACT',
      version: 1,
      isDeleted: false,
      updatedAt: now,
      updatedByUserId: 'usr-sarah-owner',
      data: {
        id: 'ec-1',
        familyId: 'fam-1',
        name: 'Sarah Henderson (Mother)',
        relationship: 'Primary Guardian',
        phonePrimary: '(555) 123-4567',
        isPrimary: true,
      },
    },
    'CALENDAR_EVENT:ce-today-1': {
      id: 'ce-today-1',
      familyId: 'fam-1',
      entityType: 'CALENDAR_EVENT',
      version: 1,
      isDeleted: false,
      updatedAt: now,
      updatedByUserId: 'usr-sarah-owner',
      data: {
        id: 'ce-today-1',
        familyId: 'fam-1',
        title: 'Morning School Drop-off & Instrument Check',
        timeLabel: '07:45 AM',
        dateLabel: 'Today',
        isToday: true,
        category: 'SCHOOL',
        assignedTo: 'Sarah & Maya',
        location: 'Oakridge Academy',
      },
    },
    'CALENDAR_EVENT:ce-today-2': {
      id: 'ce-today-2',
      familyId: 'fam-1',
      entityType: 'CALENDAR_EVENT',
      version: 1,
      isDeleted: false,
      updatedAt: now,
      updatedByUserId: 'usr-david-admin',
      data: {
        id: 'ce-today-2',
        familyId: 'fam-1',
        title: 'Family Dinner: Herb-Roasted Lemon Chicken & Quinoa',
        timeLabel: '06:30 PM',
        dateLabel: 'Today',
        isToday: true,
        category: 'MEAL',
        assignedTo: 'Sarah & David',
        location: 'Family Dining Room (5 Servings)',
      },
    },
    'CALENDAR_EVENT:ce-today-3': {
      id: 'ce-today-3',
      familyId: 'fam-1',
      entityType: 'CALENDAR_EVENT',
      version: 1,
      isDeleted: false,
      updatedAt: now,
      updatedByUserId: 'usr-sarah-owner',
      data: {
        id: 'ce-today-3',
        familyId: 'fam-1',
        title: 'Evening Reading & Astronomy Stargazing with Lucas',
        timeLabel: '08:00 PM',
        dateLabel: 'Today',
        isToday: true,
        category: 'FAMILY_EVENT',
        assignedTo: 'David & Lucas',
        location: 'Back Deck',
      },
    },
    'CALENDAR_EVENT:ce-up-1': {
      id: 'ce-up-1',
      familyId: 'fam-1',
      entityType: 'CALENDAR_EVENT',
      version: 1,
      isDeleted: false,
      updatedAt: now,
      updatedByUserId: 'usr-sarah-owner',
      data: {
        id: 'ce-up-1',
        familyId: 'fam-1',
        title: 'Sunday Multi-Generational Roast with Grandma Martha & Grandpa Edward',
        timeLabel: '04:00 PM',
        dateLabel: 'This Sunday',
        isToday: false,
        category: 'FAMILY_EVENT',
        assignedTo: 'Whole Family',
        location: 'Henderson Home',
      },
    },
    'CALENDAR_EVENT:ce-up-2': {
      id: 'ce-up-2',
      familyId: 'fam-1',
      entityType: 'CALENDAR_EVENT',
      version: 1,
      isDeleted: false,
      updatedAt: now,
      updatedByUserId: 'usr-david-admin',
      data: {
        id: 'ce-up-2',
        familyId: 'fam-1',
        title: 'Heat Pump & Solar Inverter Preventative Inspection',
        timeLabel: '10:00 AM',
        dateLabel: 'Saturday, Nov 7',
        isToday: false,
        category: 'MAINTENANCE',
        assignedTo: 'David Henderson',
        location: 'Garage & Attic',
      },
    },
    'CALENDAR_EVENT:ce-up-3': {
      id: 'ce-up-3',
      familyId: 'fam-1',
      entityType: 'CALENDAR_EVENT',
      version: 1,
      isDeleted: false,
      updatedAt: now,
      updatedByUserId: 'usr-maya-member',
      data: {
        id: 'ce-up-3',
        familyId: 'fam-1',
        title: 'Maya Autumn Chamber Cello Recital',
        timeLabel: '07:00 PM',
        dateLabel: 'Wednesday, Nov 18',
        isToday: false,
        category: 'SCHOOL',
        assignedTo: 'Maya Henderson',
        location: 'Oakridge Auditorium',
      },
    },
    'TASK:tsk-priority-1': {
      id: 'tsk-priority-1',
      familyId: 'fam-1',
      entityType: 'TASK',
      version: 1,
      isDeleted: false,
      updatedAt: now,
      updatedByUserId: 'usr-sarah-owner',
      data: {
        id: 'tsk-priority-1',
        familyId: 'fam-1',
        title: 'Reconcile November Envelope Budgets & Winter Utility Reserve',
        assignedMemberId: 'mem-sarah',
        assignedToName: 'Sarah Henderson',
        priority: 'HIGH',
        dueLabel: 'Today, 7:00 PM',
        isOverdue: false,
        isCompleted: false,
        goalId: 'goal-reserve',
      },
    },
    'TASK:tsk-priority-2': {
      id: 'tsk-priority-2',
      familyId: 'fam-1',
      entityType: 'TASK',
      version: 1,
      isDeleted: false,
      updatedAt: now,
      updatedByUserId: 'usr-david-admin',
      data: {
        id: 'tsk-priority-2',
        familyId: 'fam-1',
        title: 'Compare 3 licensed solar battery installer warranties',
        assignedMemberId: 'mem-david',
        assignedToName: 'David Henderson',
        priority: 'HIGH',
        dueLabel: 'Tomorrow',
        isOverdue: false,
        isCompleted: false,
        goalId: 'goal-solar',
      },
    },
    'TASK:tsk-priority-3': {
      id: 'tsk-priority-3',
      familyId: 'fam-1',
      entityType: 'TASK',
      version: 1,
      isDeleted: false,
      updatedAt: now,
      updatedByUserId: 'usr-maya-member',
      data: {
        id: 'tsk-priority-3',
        familyId: 'fam-1',
        title: 'Organize Cello Sheet Music & Robotics Notebook',
        assignedMemberId: 'mem-maya',
        assignedToName: 'Maya Henderson',
        priority: 'MEDIUM',
        dueLabel: 'Friday',
        isOverdue: false,
        isCompleted: true,
        goalId: 'goal-education',
      },
    },
    'TASK:tsk-overdue-1': {
      id: 'tsk-overdue-1',
      familyId: 'fam-1',
      entityType: 'TASK',
      version: 1,
      isDeleted: false,
      updatedAt: now,
      updatedByUserId: 'usr-david-admin',
      data: {
        id: 'tsk-overdue-1',
        familyId: 'fam-1',
        title: 'Flush basement tankless water heater descaling loop',
        assignedMemberId: 'mem-david',
        assignedToName: 'David Henderson',
        priority: 'URGENT',
        dueLabel: 'Overdue by 2 days',
        isOverdue: true,
        isCompleted: false,
        goalId: 'goal-solar',
      },
    },
    'TASK:tsk-overdue-2': {
      id: 'tsk-overdue-2',
      familyId: 'fam-1',
      entityType: 'TASK',
      version: 1,
      isDeleted: false,
      updatedAt: now,
      updatedByUserId: 'usr-sarah-owner',
      data: {
        id: 'tsk-overdue-2',
        familyId: 'fam-1',
        title: 'Upload Lucas updated anaphylaxis action card for school nurse',
        assignedMemberId: 'mem-sarah',
        assignedToName: 'Sarah Henderson',
        priority: 'HIGH',
        dueLabel: 'Overdue by 1 day',
        isOverdue: true,
        isCompleted: false,
        goalId: 'goal-reserve',
      },
    },
    'GOAL:goal-reserve': {
      id: 'goal-reserve',
      familyId: 'fam-1',
      entityType: 'GOAL',
      version: 1,
      isDeleted: false,
      updatedAt: now,
      updatedByUserId: 'usr-sarah-owner',
      data: {
        id: 'goal-reserve',
        familyId: 'fam-1',
        title: '6-Month Family Emergency Reserve ($35,000 Target)',
        category: 'FINANCIAL',
        ownerName: 'Sarah Henderson',
        projectName: 'Automated Monthly Treasury Sweep',
        progressPercentage: 88,
        budgetCents: 3500000,
        currentCents: 3080000,
        status: 'ACTIVE',
      },
    },
    'GOAL:goal-solar': {
      id: 'goal-solar',
      familyId: 'fam-1',
      entityType: 'GOAL',
      version: 1,
      isDeleted: false,
      updatedAt: now,
      updatedByUserId: 'usr-david-admin',
      data: {
        id: 'goal-solar',
        familyId: 'fam-1',
        title: 'Home Solar & Whole-House Battery Resilience',
        category: 'HOUSEHOLD',
        ownerName: 'David Henderson',
        projectName: 'Contractor Bids & Municipal Net-Metering',
        progressPercentage: 65,
        budgetCents: 1500000,
        currentCents: 975000,
        status: 'ACTIVE',
      },
    },
    'GOAL:goal-traditions': {
      id: 'goal-traditions',
      familyId: 'fam-1',
      entityType: 'GOAL',
      version: 1,
      isDeleted: false,
      updatedAt: now,
      updatedByUserId: 'usr-sarah-owner',
      data: {
        id: 'goal-traditions',
        familyId: 'fam-1',
        title: 'Digitize Grandma Martha’s 40 Heirloom Family Recipes',
        category: 'LIFESTYLE',
        ownerName: 'Grandma Martha & Maya',
        projectName: 'Henderson Kitchen Heritage Binder',
        progressPercentage: 75,
        budgetCents: 25000,
        currentCents: 18750,
        status: 'ACTIVE',
      },
    },
  };

  const stage332Defaults = buildDefaultStage332Data(now);

  for (const g of stage332Defaults.defaultGoals) {
    defaultHomeAndDomainEntities[`GOAL:${g.id}`] = {
      id: g.id,
      familyId: g.familyId,
      entityType: 'GOAL',
      version: g.version,
      isDeleted: g.isDeleted,
      updatedAt: g.updatedAt,
      updatedByUserId: 'usr-sarah-owner',
      data: { ...g, ownerName: g.ownerName, progressPercentage: g.progressPercentage },
    };
  }
  for (const p of stage332Defaults.defaultProjects) {
    defaultHomeAndDomainEntities[`PROJECT:${p.id}`] = {
      id: p.id,
      familyId: p.familyId,
      entityType: 'PROJECT',
      version: p.version,
      isDeleted: p.isDeleted,
      updatedAt: p.updatedAt,
      updatedByUserId: 'usr-david-admin',
      data: { ...p },
    };
  }
  for (const m of stage332Defaults.defaultMilestones) {
    defaultHomeAndDomainEntities[`MILESTONE:${m.id}`] = {
      id: m.id,
      familyId: m.familyId,
      entityType: 'MILESTONE',
      version: m.version,
      isDeleted: m.isDeleted,
      updatedAt: m.updatedAt,
      updatedByUserId: 'usr-david-admin',
      data: { ...m },
    };
  }
  for (const t of stage332Defaults.defaultTasks) {
    defaultHomeAndDomainEntities[`TASK:${t.id}`] = {
      id: t.id,
      familyId: t.familyId,
      entityType: 'TASK',
      version: t.version,
      isDeleted: t.isDeleted,
      updatedAt: t.updatedAt,
      updatedByUserId: 'usr-sarah-owner',
      data: { ...t },
    };
  }

  const mergedEntities: Record<string, SynchronizedEntityRecord> = {
    ...defaultHomeAndDomainEntities,
    ...(baseStore.synchronizedEntities || {}),
  };

  return {
    ...baseStore,
    schemaVersion: '3.3.2',
    workspace: fam1Workspace,
    workspaces: {
      'fam-2': fam2Workspace,
      ...(baseStore.workspaces || {}),
      // Ensure fam-1 always has the upgraded Stage 3.3.1+ identity fields
      'fam-1': {
        ...(baseStore.workspaces?.['fam-1'] || {}),
        ...fam1Workspace,
      },
    },
    memberships: (() => {
      const existing = baseStore.memberships || [];
      const existingIds = new Set(existing.map((m) => m.id));
      return [...existing, ...defaultMemberships.filter((m) => !existingIds.has(m.id))];
    })(),
    familyMembers: (() => {
      const existing = baseStore.familyMembers || [];
      const existingIds = new Set(existing.map((m) => m.id));
      return [...existing, ...defaultFamilyMembers.filter((m) => !existingIds.has(m.id))];
    })(),
    familyRelationships: (() => {
      const existing = baseStore.familyRelationships || [];
      const existingIds = new Set(existing.map((r) => r.id));
      return [...existing, ...defaultFamilyRelationships.filter((r) => !existingIds.has(r.id))];
    })(),
    invitations: (() => {
      const existing = baseStore.invitations || [];
      const existingIds = new Set(existing.map((i) => i.id));
      return [...existing, ...defaultInvitations.filter((i) => !existingIds.has(i.id))];
    })(),
    goals: (() => {
      const existing = baseStore.goals || [];
      const existingIds = new Set(existing.map((g) => g.id));
      return [...existing, ...stage332Defaults.defaultGoals.filter((g) => !existingIds.has(g.id))];
    })(),
    projects: (() => {
      const existing = baseStore.projects || [];
      const existingIds = new Set(existing.map((p) => p.id));
      return [...existing, ...stage332Defaults.defaultProjects.filter((p) => !existingIds.has(p.id))];
    })(),
    milestones: (() => {
      const existing = baseStore.milestones || [];
      const existingIds = new Set(existing.map((m) => m.id));
      return [...existing, ...stage332Defaults.defaultMilestones.filter((m) => !existingIds.has(m.id))];
    })(),
    planningTasks: (() => {
      const existing = baseStore.planningTasks || [];
      const existingIds = new Set(existing.map((t) => t.id));
      return [...existing, ...stage332Defaults.defaultTasks.filter((t) => !existingIds.has(t.id))];
    })(),
    checklistTemplates: (() => {
      const existing = baseStore.checklistTemplates || [];
      const existingIds = new Set(existing.map((tpl) => tpl.id));
      return [...existing, ...stage332Defaults.defaultTemplates.filter((tpl) => !existingIds.has(tpl.id))];
    })(),
    rewardConfigs: {
      'fam-1': stage332Defaults.defaultRewardConfig,
      ...(baseStore.rewardConfigs || {}),
    },
    mediaAssets: {
      ...defaultMediaAssets,
      ...(baseStore.mediaAssets || {}),
    },
    guardianRelationships:
      baseStore.guardianRelationships && baseStore.guardianRelationships.length > 0
        ? baseStore.guardianRelationships
        : defaultGuardians,
    synchronizedEntities: mergedEntities,
  };
}

export function ensurePre32BackupAndMigrate(store: SharedStore): {
  migratedStore: SharedStore;
  backupManifest: BackupManifestEntry;
} {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const rawCurrent = fs.existsSync(STORE_PATH)
    ? fs.readFileSync(STORE_PATH, 'utf-8')
    : JSON.stringify(store, null, 2);

  // Create immutable pre-3.2 backup if not yet created
  if (!fs.existsSync(PRE_3_2_BACKUP_PATH)) {
    fs.writeFileSync(PRE_3_2_BACKUP_PATH, rawCurrent, 'utf-8');
  }

  const backupRaw = fs.readFileSync(PRE_3_2_BACKUP_PATH, 'utf-8');
  const backupSha256 = computeSha256(backupRaw);
  const preNetWorth = calculateNetWorthFromAccounts(store.accounts, 'fam-1');

  const manifest: BackupManifestEntry = {
    backupFile: PRE_3_2_BACKUP_PATH,
    sourceFile: STORE_PATH,
    sha256: backupSha256,
    createdAt: Date.now(),
    accountCount: store.accounts.length,
    transactionCount: store.transactions.length,
    netWorthCents: preNetWorth.netWorthCents,
  };
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');

  const isProd = process.env.NODE_ENV === 'production';
  const migrated = isProd ? { ...store, schemaVersion: '3.4.0' } : seedDefaultAuthoritativeData(store);

  // Ensure durable Finance & Household arrays exist on migrated store
  migrated.savingsGoals = Array.isArray(migrated.savingsGoals) ? migrated.savingsGoals : [];
  migrated.recurringRules = Array.isArray(migrated.recurringRules) ? migrated.recurringRules : [];
  migrated.investmentHoldings = Array.isArray(migrated.investmentHoldings) ? migrated.investmentHoldings : [];
  migrated.reconciliations = Array.isArray(migrated.reconciliations) ? migrated.reconciliations : [];

  migrated.householdRecipes = Array.isArray(migrated.householdRecipes) ? migrated.householdRecipes : [];
  migrated.householdMeals = Array.isArray(migrated.householdMeals) ? migrated.householdMeals : [];
  migrated.householdGroceries = Array.isArray(migrated.householdGroceries) ? migrated.householdGroceries : [];
  migrated.householdChores = Array.isArray(migrated.householdChores) ? migrated.householdChores : [];
  migrated.householdChoreHistory = Array.isArray(migrated.householdChoreHistory) ? migrated.householdChoreHistory : [];
  migrated.householdAssets = Array.isArray(migrated.householdAssets) ? migrated.householdAssets : [];
  migrated.householdAssetMaintenance = Array.isArray(migrated.householdAssetMaintenance)
    ? migrated.householdAssetMaintenance
    : [];
  migrated.householdPantry = Array.isArray(migrated.householdPantry) ? migrated.householdPantry : [];
  migrated.householdWardrobe = Array.isArray(migrated.householdWardrobe) ? migrated.householdWardrobe : [];
  migrated.householdOutfits = Array.isArray(migrated.householdOutfits) ? migrated.householdOutfits : [];
  migrated.householdCustomTaxonomies = migrated.householdCustomTaxonomies || {};

  // Migrate legacy fam-1 in-memory baseline records into the durable store ONCE during migration to 3.4.0
  // (Strictly skipped in production or if schemaVersion is already 3.4.0)
  if (!isProd && store.schemaVersion !== '3.4.0') {
    const fam1Fin = buildFam1DemoFinanceData('fam-1');
    if (!migrated.savingsGoals.some((g: any) => g.familyId === 'fam-1')) {
      migrated.savingsGoals.push(...fam1Fin.savingsGoals);
    }
    if (!migrated.reconciliations.some((r: any) => r.familyId === 'fam-1')) {
      migrated.reconciliations.push(...fam1Fin.reconciliations);
    }
    if (!migrated.recurringRules.some((r: any) => r.familyId === 'fam-1')) {
      migrated.recurringRules.push(...fam1Fin.recurringRules);
    }
    if (!migrated.investmentHoldings.some((h: any) => h.familyId === 'fam-1')) {
      migrated.investmentHoldings.push(...fam1Fin.investmentHoldings);
    }

    const fam1Hh = buildFam1DemoHouseholdData('fam-1');
    if (!migrated.householdRecipes.some((r: any) => r.familyId === 'fam-1')) {
      migrated.householdRecipes.push(...fam1Hh.recipes);
    }
    if (!migrated.householdPantry.some((p: any) => p.familyId === 'fam-1')) {
      migrated.householdPantry.push(...fam1Hh.pantry);
    }
    if (!migrated.householdMeals.some((m: any) => m.familyId === 'fam-1')) {
      migrated.householdMeals.push(...fam1Hh.meals);
    }
    if (!migrated.householdChores.some((c: any) => c.familyId === 'fam-1')) {
      migrated.householdChores.push(...fam1Hh.chores);
    }
    if (!migrated.householdAssets.some((a: any) => a.familyId === 'fam-1')) {
      migrated.householdAssets.push(...fam1Hh.assets);
    }
    if (!migrated.householdWardrobe.some((w: any) => w.familyId === 'fam-1')) {
      migrated.householdWardrobe.push(...fam1Hh.wardrobe);
    }
    if (!migrated.householdOutfits.some((o: any) => o.familyId === 'fam-1')) {
      migrated.householdOutfits.push(...fam1Hh.outfits);
    }
    if (!migrated.householdGroceries.some((g: any) => g.familyId === 'fam-1')) {
      migrated.householdGroceries.push(...fam1Hh.groceries);
    }

    seedDefaultCalendarAndRoutines(migrated, 'fam-1');
    ensureFamilySectionSeedData(migrated, 'fam-1');
  }

  migrated.schemaVersion = '3.4.0';
  migrated.migrationReconciliation = {
    migratedAt: Date.now(),
    toSchemaVersion: '3.4.0',
    backupSha256,
    recordCounts: {
      accounts: migrated.accounts.length,
      budgets: migrated.budgets.length,
      transactions: migrated.transactions.length,
      savingsGoals: migrated.savingsGoals.length,
      recurringRules: migrated.recurringRules.length,
      investmentHoldings: migrated.investmentHoldings.length,
      reconciliations: migrated.reconciliations.length,
      householdRecipes: migrated.householdRecipes.length,
      householdMeals: migrated.householdMeals.length,
      householdGroceries: migrated.householdGroceries.length,
      householdChores: migrated.householdChores.length,
      householdAssets: migrated.householdAssets.length,
      householdPantry: migrated.householdPantry.length,
      householdWardrobe: migrated.householdWardrobe.length,
      householdOutfits: migrated.householdOutfits.length,
    },
    status: 'VERIFIED',
  };

  const postNetWorth = calculateNetWorthFromAccounts(migrated.accounts, 'fam-1');

  // Reconcile pre vs post migration integrity
  if (
    postNetWorth.netWorthCents !== preNetWorth.netWorthCents ||
    migrated.accounts.length < store.accounts.length ||
    migrated.transactions.length < store.transactions.length
  ) {
    rollbackToPre32Backup();
    throw new Error('MIGRATION_RECONCILIATION_FAILED: Post-migration financial or record count mismatch.');
  }

  return { migratedStore: migrated, backupManifest: manifest };
}

export function rollbackToPre32Backup(): SharedStore {
  if (!fs.existsSync(PRE_3_2_BACKUP_PATH)) {
    throw new Error('Cannot rollback: pre-3.2 backup file does not exist.');
  }
  const backupRaw = fs.readFileSync(PRE_3_2_BACKUP_PATH, 'utf-8');
  if (fs.existsSync(MANIFEST_PATH)) {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8')) as BackupManifestEntry;
    const actualHash = computeSha256(backupRaw);
    if (actualHash !== manifest.sha256) {
      throw new Error(`Backup checksum mismatch: expected ${manifest.sha256}, got ${actualHash}`);
    }
  }
  const tmpPath = `${STORE_PATH}.rollback.tmp`;
  fs.writeFileSync(tmpPath, backupRaw, 'utf-8');
  fs.renameSync(tmpPath, STORE_PATH);
  return JSON.parse(backupRaw) as SharedStore;
}
