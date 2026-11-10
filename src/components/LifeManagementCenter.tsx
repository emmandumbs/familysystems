import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Briefcase,
  FileText,
  ListTodo,
  Phone,
  Plane,
  Car,
  Compass,
  CheckCircle2,
  Circle,
  Lock,
  AlertTriangle,
  Plus,
  Search,
  Shield,
  Calendar,
  Wrench,
  Trash2,
  Download,
  Edit3,
  Copy,
  Check,
  Sparkles,
  Paperclip,
  Eye,
  FolderLock,
  Printer,
} from 'lucide-react';
import type { ExportDocumentType } from './export/PrintableExportView';
import {
  auth,
  syncDomainRecordToDatabase,
} from '../firebase';
import {
  PersonalAdminTask,
  DocumentRecord,
  PersonalList,
  LifeChecklistTemplate,
  ImportantContact,
  TravelPlan,
  VehicleProfile,
  LongTermPlan,
  DEFAULT_LIFE_TEMPLATES,
  formatCents,
  DeleteConfirmModal,
  PersonalTaskModal,
  DocumentVaultModal,
  DocumentDetailDrawer,
  PersonalNoteModal,
  ChecklistTemplatesModal,
  ImportantContactModal,
  TravelPlanModal,
  TravelDetailDrawer,
  VehicleModal,
  VehicleServiceDrawer,
  LongTermPlanModal,
  LongTermPlanDrawer,
} from './life/LifeManagementModals';

export type LifeSubTab =
  | 'personal_dashboard'
  | 'documents'
  | 'personal_org'
  | 'contacts'
  | 'travel'
  | 'vehicles'
  | 'long_term';

// ============================================================================
// HIGH-TRUST ADMINISTRATIVE DEFAULT SEED DATA
// ============================================================================

const DEFAULT_PERSONAL_TASKS: PersonalAdminTask[] = [
  {
    id: 'pt-1',
    title: 'Submit annual dental & vision FSA reimbursement receipts',
    category: 'Tax & Legal',
    dueDate: '2026-11-18',
    priority: 'High',
    completed: false,
    notes: 'Include orthodontic invoice #4412 from pediatric dental clinic.',
    isPrivate: true,
    scope: 'PRIVATE',
  },
  {
    id: 'pt-2',
    title: 'Verify US Passport renewal timeline ahead of international travel',
    category: 'Document Renewal',
    dueDate: '2026-11-24',
    priority: 'High',
    completed: false,
    notes: 'Confirm 6-month validity window for all family passports.',
    isPrivate: true,
    scope: 'PRIVATE',
  },
  {
    id: 'pt-3',
    title: 'Review homeowner & umbrella liability policy declaration',
    category: 'Vehicle & Insurance',
    dueDate: '2026-12-02',
    priority: 'Medium',
    completed: false,
    notes: 'Confirm scheduled personal property riders and deductible.',
    isPrivate: false,
    scope: 'FAMILY',
  },
  {
    id: 'pt-4',
    title: 'Rotate hardware 2FA recovery keys & verify vault backup',
    category: 'Personal Admin',
    dueDate: '2026-11-10',
    priority: 'Low',
    completed: true,
    notes: 'Recovery sheet sealed in fireproof safe.',
    isPrivate: true,
    scope: 'PRIVATE',
  },
];

const DEFAULT_DOCUMENTS: DocumentRecord[] = [
  {
    id: 'doc-1',
    title: 'US Passports — Vance Family Master File',
    category: 'Identification',
    expirationDate: '2028-05-14',
    renewalReminder: '180 days prior',
    accessLevel: 'Owner & Admin Only',
    issuer: 'U.S. Department of State',
    referenceNumber: 'PASS-8841-VF',
    tags: ['passport', 'identification', 'international-travel'],
    notes: 'Physical originals stored in Fireproof Safe Drawer A.',
    fileName: 'vance_family_passports.pdf',
    mimeType: 'application/pdf',
    fileSizeKb: 420,
    encryptedAtRest: true,
  },
  {
    id: 'doc-2',
    title: 'Homeowners & Personal Umbrella Insurance Policy',
    category: 'Insurance',
    expirationDate: '2026-11-30',
    renewalReminder: '30 days prior',
    accessLevel: 'Adult Members',
    issuer: 'Chubb Personal Risk Services',
    referenceNumber: 'HO-992410-B',
    tags: ['insurance', 'property', 'umbrella-policy'],
    notes: 'Includes earthquake endorsement and scheduled valuables coverage.',
    fileName: 'chubb_homeowners_declaration_2026.pdf',
    mimeType: 'application/pdf',
    fileSizeKb: 680,
    encryptedAtRest: true,
  },
  {
    id: 'doc-3',
    title: 'Primary Residence Warranty Deed & Title Policy',
    category: 'Property & Home',
    expirationDate: 'Permanent Record',
    renewalReminder: 'None',
    accessLevel: 'Owner & Admin Only',
    issuer: 'County Recorder & First American Title',
    referenceNumber: 'APN-042-198-11',
    tags: ['deed', 'title', 'real-estate', 'permanent'],
    notes: 'Recorded certified copy.',
    fileName: 'residence_warranty_deed_title.pdf',
    mimeType: 'application/pdf',
    fileSizeKb: 1120,
    encryptedAtRest: true,
  },
  {
    id: 'doc-4',
    title: 'Family Immunization & Allergy Clinical Summary',
    category: 'Medical',
    expirationDate: '2027-08-15',
    renewalReminder: '30 days prior',
    accessLevel: 'All Household',
    issuer: 'Bay Area Family Medicine & Pediatrics',
    referenceNumber: 'MED-2026-VANCE',
    tags: ['medical', 'immunizations', 'school-clearance'],
    notes: 'Required for annual school enrollment and summer camp clearance.',
    fileName: 'immunization_summary_2026.pdf',
    mimeType: 'application/pdf',
    fileSizeKb: 245,
    encryptedAtRest: true,
  },
  {
    id: 'doc-5',
    title: 'Revocable Living Trust & Guardianship Directives',
    category: 'Financial & Tax',
    expirationDate: 'Permanent Record',
    renewalReminder: 'None',
    accessLevel: 'Owner & Admin Only',
    issuer: 'Sterling & Associates Estate Counsel',
    referenceNumber: 'TR-2024-VANCE',
    tags: ['estate', 'trust', 'guardianship', 'legal'],
    notes: 'Signed original held in safe deposit box; digital copy encrypted.',
    fileName: 'vance_living_trust_restatement.pdf',
    mimeType: 'application/pdf',
    fileSizeKb: 950,
    encryptedAtRest: true,
  },
];

const DEFAULT_PERSONAL_LISTS: PersonalList[] = [
  {
    id: 'pl-1',
    title: 'Annual Tax & Insurance Audit Protocol',
    type: 'Checklist',
    category: 'Tax & Financial',
    content: 'Private administrative checklist for year-end tax preparation and insurance coverage verification.',
    items: [
      { id: 'pli-1', text: 'Download W-2, 1099-DIV, and 1099-INT brokerage statements', done: true },
      { id: 'pli-2', text: 'Reconcile HSA/FSA medical receipts and dependent care statements', done: true },
      { id: 'pli-3', text: 'Verify homeowner & auto deductible levels for upcoming policy year', done: false },
      { id: 'pli-4', text: 'Upload signed federal & state return PDF to Document Vault', done: false },
    ],
    isPrivate: true,
    scope: 'PRIVATE',
    updatedAt: '2026-11-04',
  },
  {
    id: 'pl-2',
    title: 'Vital Records & Safe Custody Index',
    type: 'Note',
    category: 'Legal & Estate',
    content:
      'Drawer A (Fireproof Safe): Passports, Birth Certificates, Social Security Cards, Marriage Certificate.\nDrawer B: Property Deed, Vehicle Titles, Hardware Security Keys, Estate Binder.',
    items: [
      { id: 'pli-5', text: 'Audit physical safe contents every 6 months', done: true },
      { id: 'pli-6', text: 'Verify desiccants and battery on biometric lock', done: false },
    ],
    isPrivate: true,
    scope: 'PRIVATE',
    updatedAt: '2026-11-01',
  },
];

const DEFAULT_CONTACTS: ImportantContact[] = [
  {
    id: 'cnt-1',
    name: 'Dr. Elena Rostova — Family Medicine & Pediatrics',
    category: 'Emergency & Medical',
    role: 'Primary Care & Pediatric Physician',
    phone: '(555) 234-8910',
    email: 'care@bayareapediatrics.org',
    accountOrPolicyNumber: 'GRP-77412-V',
    address: '450 Medical Plaza Dr, Suite 310',
    isEmergencyPriority: true,
    notes: '24/7 On-Call Nurse Triage Line: Press 2. Preferred hospital: St. Jude Medical Center.',
  },
  {
    id: 'cnt-2',
    name: 'Chubb Personal Risk Claims & Emergency Assistance',
    category: 'Insurance & Policy',
    role: 'Homeowner, Auto & Umbrella Carrier',
    phone: '(800) 252-4670',
    email: 'claims@chubb.com',
    accountOrPolicyNumber: 'HO-992410-B / AUTO-8812',
    address: '202 Halls Mill Rd, Whitehouse Station, NJ',
    isEmergencyPriority: true,
    notes: '24-hour emergency property mitigation and roadside dispatch.',
  },
  {
    id: 'cnt-3',
    name: 'Sterling & Associates Estate & Tax Counsel',
    category: 'Legal & Financial',
    role: 'Family Legal Counsel & Fiduciary Advisor',
    phone: '(555) 391-4400',
    email: 'msterling@sterlingcounsel.com',
    accountOrPolicyNumber: 'MATTER-2024-089',
    address: '100 Financial Center, Floor 18',
    isEmergencyPriority: false,
    notes: 'Holds certified copies of Living Trust, Healthcare Directives, and Power of Attorney.',
  },
  {
    id: 'cnt-4',
    name: 'Apex Master Plumbing, HVAC & Electrical',
    category: 'Service Contractors',
    role: '24h Emergency Home Infrastructure Service',
    phone: '(555) 892-3311',
    email: 'dispatch@apexhomeservice.com',
    accountOrPolicyNumber: 'MEM-4019',
    address: '88 Industrial Way',
    isEmergencyPriority: true,
    notes: 'Main water shut-off is located in the north garage utility alcove.',
  },
  {
    id: 'cnt-5',
    name: 'Oakridge Academy — Attendance & School Nurse',
    category: 'Schools & Childcare',
    role: 'K-8 Administration & Health Office',
    phone: '(555) 612-0900',
    email: 'office@oakridgeacademy.edu',
    accountOrPolicyNumber: 'FAM-ID-1094',
    address: '1200 Oakridge Blvd',
    isEmergencyPriority: false,
    notes: 'Authorized emergency pickup list includes Sarah Vance and David Vance.',
  },
];

const DEFAULT_TRIPS: TravelPlan[] = [
  {
    id: 'tr-1',
    destination: 'Lake Tahoe Alpine Retreat',
    dates: 'Jul 14 – Jul 21, 2026',
    status: 'Upcoming',
    budgetCents: 420000,
    spentCents: 265000,
    accommodation: 'Pinehaven Lakefront Cabin #4B',
    bookingReference: 'PNR-88412-TAHOE',
    activities: [
      'Day 1: Arrival, grocery provisioning & lakeside check-in',
      'Day 2: Emerald Bay Trail morning hike & boat charter',
      'Day 3: Sand Harbor beach day & family dinner reservation',
    ],
    packingList: [
      { id: 'pk-1', item: 'Government IDs, health insurance cards & cabin confirmation', packed: true },
      { id: 'pk-2', item: 'Pediatric first-aid kit, sunscreen & altitude hydration packs', packed: true },
      { id: 'pk-3', item: 'Hiking boots, fleece layers & lake swimwear', packed: false },
      { id: 'pk-4', item: 'Set home security alarm, water shutoff check & mail hold', packed: false },
    ],
    notes: 'Check-in after 4:00 PM. Lockbox code provided 24h prior to arrival.',
  },
];

const DEFAULT_VEHICLES: VehicleProfile[] = [
  {
    id: 'veh-1',
    name: '2024 Volvo XC90 Recharge AWD',
    vinOrPlate: '7XVL924 · YV4062JE',
    registration: 'Valid thru Nov 2026',
    insuranceProvider: 'Chubb Auto #AUTO-8812-A',
    insuranceRenewal: '2026-12-01',
    inspectionDate: '2026-10-15',
    nextMaintenance: '20,000-mile scheduled factory service (Oct 2026)',
    serviceInterval: 'Every 10,000 miles / 12 months',
    currentMileage: '17,840 mi',
    serviceHistory: '10k mile synthetic oil, cabin filter & 4-wheel alignment completed (2026-04-12)',
    maintenanceLogs: [
      {
        id: 'vse-1',
        date: '2026-04-12',
        serviceType: '10,000-Mile Scheduled Maintenance & Tire Rotation',
        mileage: '10,120 mi',
        provider: 'Peninsula Volvo Service Center',
        costCents: 24500,
      },
    ],
    monthlyFuelCents: 13500,
  },
  {
    id: 'veh-2',
    name: '2023 Honda Odyssey Elite',
    vinOrPlate: '8KQP310 · 5FNRL6H9',
    registration: 'Valid thru Aug 2026',
    insuranceProvider: 'Chubb Auto #AUTO-8812-B',
    insuranceRenewal: '2026-12-01',
    inspectionDate: '2026-08-20',
    nextMaintenance: 'Brake fluid flush & tire rotation at 30,000 miles',
    serviceInterval: 'Every 7,500 miles / 6 months',
    currentMileage: '27,310 mi',
    serviceHistory: 'Synthetic oil change, battery load test & wiper blades (2026-05-02)',
    maintenanceLogs: [
      {
        id: 'vse-2',
        date: '2026-05-02',
        serviceType: 'Oil Service, Multi-Point Inspection & Battery Test',
        mileage: '25,400 mi',
        provider: 'Bay Area Honda Service',
        costCents: 16800,
      },
    ],
    monthlyFuelCents: 18500,
  },
];

const DEFAULT_LONG_TERM: LongTermPlan[] = [
  {
    id: 'lt-1',
    title: '529 Higher Education Trust & University Roadmap',
    category: 'Education & Trust',
    horizon: '10+ Year Generational',
    targetDate: '2034',
    estimatedBudgetCents: 18000000,
    advisorOrCustodian: 'Vanguard 529 Plan / Sterling Fiduciary',
    reviewCadence: 'Annual Review',
    milestones: [
      'Establish automated monthly tax-advantaged 529 contributions',
      'Complete age-based portfolio glidepath review at Grade 6 transition',
      'Achieve 50% target funding milestone across beneficiary accounts',
    ],
    structuredMilestones: [
      {
        id: 'ltm-1',
        title: 'Establish automated monthly tax-advantaged 529 contributions',
        completed: true,
      },
      {
        id: 'ltm-2',
        title: 'Complete age-based portfolio glidepath review at Grade 6 transition',
        completed: true,
      },
      {
        id: 'ltm-3',
        title: 'Achieve 50% target funding milestone across beneficiary accounts',
        completed: false,
      },
    ],
    progressPercent: 67,
    notes: 'Rebalance annually every November during open enrollment and tax review.',
  },
  {
    id: 'lt-2',
    title: 'Family Living Trust, Estate & Guardianship Charter',
    category: 'Estate & Legal',
    horizon: '5–10 Year Horizon',
    targetDate: '2028',
    estimatedBudgetCents: 650000,
    advisorOrCustodian: 'Sterling & Associates Estate Counsel',
    reviewCadence: 'Biennial Estate Audit',
    milestones: [
      'Execute Revocable Living Trust & Pour-Over Wills',
      'Record primary residence title transfer into Family Trust',
      'Complete 3-year beneficiary & successor trustee alignment audit',
    ],
    structuredMilestones: [
      {
        id: 'ltm-4',
        title: 'Execute Revocable Living Trust & Pour-Over Wills',
        completed: true,
      },
      {
        id: 'ltm-5',
        title: 'Record primary residence title transfer into Family Trust',
        completed: true,
      },
      {
        id: 'ltm-6',
        title: 'Complete 3-year beneficiary & successor trustee alignment audit',
        completed: false,
      },
    ],
    progressPercent: 67,
    notes: 'Ensure Document Vault holds latest notarized certificate of trust.',
  },
];

// ============================================================================
// EXPIRATION / RENEWAL HELPERS
// ============================================================================

function getDaysUntilDate(dateStr: string): number | null {
  if (!dateStr || dateStr === 'Permanent Record') return null;
  const parsed = Date.parse(dateStr);
  if (Number.isNaN(parsed)) return null;
  const diffMs = parsed - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function isExpiringWithinDays(dateStr: string, thresholdDays = 90): boolean {
  const days = getDaysUntilDate(dateStr);
  if (days === null) return false;
  return days <= thresholdDays;
}

// ============================================================================
// MAIN LIFE MANAGEMENT COMPONENT
// ============================================================================

const COLLECTION_TO_ENTITY_TYPE: Record<string, string> = {
  personalTasks: 'LIFE_PERSONAL_TASK',
  documents: 'LIFE_DOCUMENT',
  personalLists: 'LIFE_PERSONAL_LIST',
  checklistTemplates: 'LIFE_CHECKLIST_TEMPLATE',
  contacts: 'LIFE_CONTACT',
  trips: 'LIFE_TRAVEL_PLAN',
  vehicles: 'LIFE_VEHICLE',
  longTermPlans: 'LIFE_LONG_TERM_PLAN',
};

const TAB_TO_SUBPAGE: Record<LifeSubTab, string> = {
  personal_dashboard: 'life_personal',
  documents: 'life_vault',
  personal_org: 'life_notes',
  contacts: 'life_contacts',
  travel: 'life_travel',
  vehicles: 'life_vehicles',
  long_term: 'life_longterm',
};

export const LifeManagementCenter: React.FC<{
  selectedRole: string;
  sessionToken?: string;
  familyId?: string;
  actorUserId?: string;
  actorMemberId?: string;
  actorDisplayName?: string;
  members?: any[];
  activeSubPage?: string;
  onSelectSubPage?: (subId: string) => void;
  onOpenPrintDoc?: (docType: ExportDocumentType, recipeId?: string) => void;
}> = ({
  selectedRole,
  sessionToken = '',
  familyId = 'fam-1',
  actorUserId = 'usr-sarah-owner',
  actorMemberId = 'mem-1',
  activeSubPage,
  onSelectSubPage,
  onOpenPrintDoc,
}) => {
  const mapSubPageToTab = (sub?: string): LifeSubTab => {
    switch (sub) {
      case 'life_personal':
        return 'personal_dashboard';
      case 'life_vault':
        return 'documents';
      case 'life_notes':
        return 'personal_org';
      case 'life_contacts':
        return 'contacts';
      case 'life_travel':
        return 'travel';
      case 'life_vehicles':
        return 'vehicles';
      case 'life_longterm':
        return 'long_term';
      default:
        return 'personal_dashboard';
    }
  };

  const [activeSubTab, setActiveSubTab] = useState<LifeSubTab>(() => mapSubPageToTab(activeSubPage));

  useEffect(() => {
    if (activeSubPage && activeSubPage.startsWith('life_')) {
      setActiveSubTab(mapSubPageToTab(activeSubPage));
    }
  }, [activeSubPage]);

  // Role-Based Access Control Helpers
  const normalizedRole = String(selectedRole || 'OWNER').toUpperCase();
  const isOwnerOrAdmin = normalizedRole === 'OWNER' || normalizedRole === 'ADMIN';
  const isAdultRole = isOwnerOrAdmin || normalizedRole === 'MEMBER' || normalizedRole === 'ADULT';
  const isGuestRole = normalizedRole === 'GUEST';
  const canMutateShared = !isGuestRole;
  const canMutateVault = isAdultRole && !isGuestRole;

  const canRoleViewDocument = useCallback(
    (accessLevel: DocumentRecord['accessLevel']): boolean => {
      if (isOwnerOrAdmin) return true;
      if (accessLevel === 'Owner & Admin Only') return false;
      if (accessLevel === 'Adult Members') return isAdultRole;
      return true;
    },
    [isOwnerOrAdmin, isAdultRole]
  );

  // Domain State
  const [personalTasks, setPersonalTasks] = useState<PersonalAdminTask[]>(DEFAULT_PERSONAL_TASKS);
  const [documents, setDocuments] = useState<DocumentRecord[]>(DEFAULT_DOCUMENTS);
  const [personalLists, setPersonalLists] = useState<PersonalList[]>(DEFAULT_PERSONAL_LISTS);
  const [templates, setTemplates] = useState<LifeChecklistTemplate[]>(DEFAULT_LIFE_TEMPLATES);
  const [contacts, setContacts] = useState<ImportantContact[]>(DEFAULT_CONTACTS);
  const [trips, setTrips] = useState<TravelPlan[]>(DEFAULT_TRIPS);
  const [vehicles, setVehicles] = useState<VehicleProfile[]>(DEFAULT_VEHICLES);
  const [longTermPlans, setLongTermPlans] = useState<LongTermPlan[]>(DEFAULT_LONG_TERM);

  // Loading, Sync & Feedback State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Filter & Search States
  const [taskScopeFilter, setTaskScopeFilter] = useState<'ALL' | 'PRIVATE' | 'FAMILY'>('ALL');
  const [taskCategoryFilter, setTaskCategoryFilter] = useState<string>('ALL');
  const [docSearch, setDocSearch] = useState('');
  const [docCategoryFilter, setDocCategoryFilter] = useState<string>('ALL');
  const [docAccessFilter, setDocAccessFilter] = useState<string>('ALL');
  const [noteSearch, setNoteSearch] = useState('');
  const [noteTypeFilter, setNoteTypeFilter] = useState<string>('ALL');
  const [contactSearch, setContactSearch] = useState('');
  const [contactCategoryFilter, setContactCategoryFilter] = useState<string>('ALL');
  const [longTermCategoryFilter, setLongTermCategoryFilter] = useState<string>('ALL');

  // Active Modals & Slide-Over Drawers
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<PersonalAdminTask | null>(null);

  const [docModalOpen, setDocModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<DocumentRecord | null>(null);
  const [inspectingDoc, setInspectingDoc] = useState<DocumentRecord | null>(null);

  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<PersonalList | null>(null);
  const [templatesModalOpen, setTemplatesModalOpen] = useState(false);
  const [templatesModalDomain, setTemplatesModalDomain] = useState<
    'Personal Admin' | 'Travel & Packing' | undefined
  >(undefined);

  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ImportantContact | null>(null);

  const [tripModalOpen, setTripModalOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<TravelPlan | null>(null);
  const [inspectingTrip, setInspectingTrip] = useState<TravelPlan | null>(null);

  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<VehicleProfile | null>(null);
  const [inspectingVehicle, setInspectingVehicle] = useState<VehicleProfile | null>(null);

  const [ltModalOpen, setLtModalOpen] = useState(false);
  const [editingLtPlan, setEditingLtPlan] = useState<LongTermPlan | null>(null);
  const [inspectingLtPlan, setInspectingLtPlan] = useState<LongTermPlan | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{
    collection: string;
    id: string;
    title: string;
    description: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  const handleCopyText = (key: string, value: string, label: string) => {
    if (!value) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      void navigator.clipboard.writeText(value);
    }
    setCopiedKey(key);
    showToast(`Copied ${label} to clipboard.`);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 2000);
  };

  const buildAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      if (auth.currentUser) {
        const idToken = await auth.currentUser.getIdToken();
        if (idToken) {
          headers['Authorization'] = `Bearer ${idToken}`;
          return headers;
        }
      }
    } catch {
      // Fallback to sessionToken
    }
    const fallbackToken =
      sessionToken || localStorage.getItem('familyos_session_token') || 'usr-sarah-owner';
    headers['Authorization'] = `Bearer ${fallbackToken}`;
    return headers;
  }, [sessionToken]);

  const dispatchLifeSync = useCallback(() => {
    window.dispatchEvent(new CustomEvent('familyos-life-updated'));
  }, []);

  // Hydrate all 7 Life Management collections from Backend API
  const fetchLifeData = useCallback(async () => {
    setIsLoading(true);
    setSyncError(null);
    try {
      const headers = await buildAuthHeaders();
      const res = await fetch(`/api/v1/domain/${encodeURIComponent(familyId)}/life`, {
        method: 'GET',
        headers,
      });
      if (!res.ok) {
        throw new Error(`Unable to load Life Management records (HTTP ${res.status})`);
      }
      const payload = await res.json();
      const cols = payload.collections || {};

      if (Array.isArray(cols.personalTasks) && cols.personalTasks.length > 0) {
        setPersonalTasks(
          cols.personalTasks.map((t: any) => ({
            ...t,
            completed: Boolean(t.completed ?? t.status === 'Completed'),
          }))
        );
      }
      if (Array.isArray(cols.documents) && cols.documents.length > 0) {
        setDocuments(cols.documents);
      }
      if (Array.isArray(cols.personalLists) && cols.personalLists.length > 0) {
        setPersonalLists(cols.personalLists);
      }
      if (Array.isArray(cols.checklistTemplates) && cols.checklistTemplates.length > 0) {
        const mergedMap = new Map<string, LifeChecklistTemplate>();
        for (const def of DEFAULT_LIFE_TEMPLATES) mergedMap.set(def.id, def);
        for (const custom of cols.checklistTemplates) mergedMap.set(custom.id, custom);
        setTemplates(Array.from(mergedMap.values()));
      }
      if (Array.isArray(cols.contacts) && cols.contacts.length > 0) {
        // Filter out any legacy social/family gathering contacts so directory stays strictly administrative
        const adminContacts = cols.contacts.filter(
          (c: any) => String(c.category || '').toLowerCase() !== 'family'
        );
        if (adminContacts.length > 0) {
          setContacts(adminContacts);
        }
      }
      if (Array.isArray(cols.trips) && cols.trips.length > 0) {
        setTrips(cols.trips);
      }
      if (Array.isArray(cols.vehicles) && cols.vehicles.length > 0) {
        setVehicles(cols.vehicles);
      }
      if (Array.isArray(cols.longTermPlans) && cols.longTermPlans.length > 0) {
        setLongTermPlans(cols.longTermPlans);
      }
    } catch (err: any) {
      setSyncError(err?.message || 'Unable to synchronize with backend server.');
    } finally {
      setIsLoading(false);
    }
  }, [familyId, buildAuthHeaders]);

  useEffect(() => {
    void fetchLifeData();
  }, [fetchLifeData, selectedRole]);

  // Persist a single record to Backend + Firestore mirror
  const persistSingleRecord = useCallback(
    async <T extends { id: string; version?: number }>(
      collection: string,
      recordId: string,
      recordData: T
    ): Promise<T> => {
      setSyncError(null);
      const headers = await buildAuthHeaders();
      const res = await fetch(
        `/api/v1/domain/${encodeURIComponent(familyId)}/life/${encodeURIComponent(collection)}/${encodeURIComponent(recordId)}`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            ...recordData,
            baseVersion: recordData.version || 0,
          }),
        }
      );

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const message = errBody.message || `Failed to save ${collection} record (${res.status})`;
        setSyncError(message);
        throw new Error(message);
      }

      const saved = await res.json();
      const merged: T = {
        ...recordData,
        ...(saved.record || {}),
        version: saved.version || (recordData.version || 0) + 1,
      };
      const resolvedToken =
        sessionToken || localStorage.getItem('familyos_session_token') || 'usr-sarah-owner';
      void syncDomainRecordToDatabase({
        sessionToken: resolvedToken,
        familyId,
        entityType: COLLECTION_TO_ENTITY_TYPE[collection] || 'LIFE_PERSONAL_TASK',
        entityId: recordId,
        data: merged as unknown as Record<string, unknown>,
        baseVersion: recordData.version || 0,
        operationType: 'UPSERT',
      });
      dispatchLifeSync();
      return merged;
    },
    [familyId, sessionToken, buildAuthHeaders, dispatchLifeSync]
  );

  // Delete a single record from Backend + Firestore mirror
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setSyncError(null);
    try {
      const headers = await buildAuthHeaders();
      const res = await fetch(
        `/api/v1/domain/${encodeURIComponent(familyId)}/life/${encodeURIComponent(deleteTarget.collection)}/${encodeURIComponent(deleteTarget.id)}`,
        {
          method: 'DELETE',
          headers,
        }
      );
      if (!res.ok && res.status !== 404) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || `Delete failed (${res.status})`);
      }

      const { collection, id } = deleteTarget;
      if (collection === 'personalTasks') {
        setPersonalTasks((prev) => prev.filter((item) => item.id !== id));
      } else if (collection === 'documents') {
        setDocuments((prev) => prev.filter((item) => item.id !== id));
      } else if (collection === 'personalLists') {
        setPersonalLists((prev) => prev.filter((item) => item.id !== id));
      } else if (collection === 'contacts') {
        setContacts((prev) => prev.filter((item) => item.id !== id));
      } else if (collection === 'trips') {
        setTrips((prev) => prev.filter((item) => item.id !== id));
      } else if (collection === 'vehicles') {
        setVehicles((prev) => prev.filter((item) => item.id !== id));
      } else if (collection === 'longTermPlans') {
        setLongTermPlans((prev) => prev.filter((item) => item.id !== id));
      }

      const resolvedToken =
        sessionToken || localStorage.getItem('familyos_session_token') || 'usr-sarah-owner';
      void syncDomainRecordToDatabase({
        sessionToken: resolvedToken,
        familyId,
        entityType: COLLECTION_TO_ENTITY_TYPE[collection] || 'LIFE_PERSONAL_TASK',
        entityId: id,
        data: { id, isDeleted: true },
        operationType: 'DELETE',
      });
      dispatchLifeSync();
      showToast(`Removed "${deleteTarget.title}".`);
      setDeleteTarget(null);
    } catch (err: any) {
      setSyncError(err?.message || 'Failed to delete record.');
    } finally {
      setIsDeleting(false);
    }
  };

  // ============================================================================
  // SUB-MODULE CRUD HANDLERS
  // ============================================================================

  // 1. Personal Tasks / Reminders
  const handleSavePersonalTask = async (
    payload: Omit<PersonalAdminTask, 'id'> & { id?: string }
  ) => {
    const id = payload.id || `pt-${Date.now()}`;
    const record: PersonalAdminTask = {
      ...payload,
      id,
      ownerUserId: payload.ownerUserId || actorUserId,
      ownerMemberId: payload.ownerMemberId || actorMemberId,
    };
    const saved = await persistSingleRecord('personalTasks', id, record);
    setPersonalTasks((prev) => {
      const exists = prev.some((t) => t.id === id);
      return exists ? prev.map((t) => (t.id === id ? saved : t)) : [saved, ...prev];
    });
    showToast(payload.id ? 'Administrative action updated.' : 'Administrative action created.');
  };

  const handleTogglePersonalTask = async (task: PersonalAdminTask) => {
    const updated: PersonalAdminTask = {
      ...task,
      completed: !task.completed,
    };
    setPersonalTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    try {
      await persistSingleRecord('personalTasks', task.id, updated);
    } catch {
      // Revert on failure
      setPersonalTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
    }
  };

  // 2. Document Vault Upload / Update & Download
  const handleSaveDocument = async (
    docPayload: Omit<DocumentRecord, 'id'> & { id?: string; contentBase64?: string }
  ) => {
    if (!canMutateVault) {
      throw new Error(`Role "${selectedRole}" is not permitted to modify Document Vault records.`);
    }
    const id = docPayload.id || `doc-${Date.now()}`;
    const headers = await buildAuthHeaders();

    // If a new file binary was attached or creating a new vault record, use the encrypted upload endpoint
    if (docPayload.contentBase64 || !docPayload.id) {
      const res = await fetch(`/api/v1/domain/${encodeURIComponent(familyId)}/documents/upload`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...docPayload,
          id,
          contentBase64: docPayload.contentBase64 || '',
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Vault upload failed (${res.status})`);
      }
      const data = await res.json();
      const savedDoc: DocumentRecord = {
        ...docPayload,
        ...(data.document || {}),
        id,
      };
      setDocuments((prev) => {
        const exists = prev.some((d) => d.id === id);
        return exists ? prev.map((d) => (d.id === id ? savedDoc : d)) : [savedDoc, ...prev];
      });
      const resolvedToken =
        sessionToken || localStorage.getItem('familyos_session_token') || 'usr-sarah-owner';
      void syncDomainRecordToDatabase({
        sessionToken: resolvedToken,
        familyId,
        entityType: 'LIFE_DOCUMENT',
        entityId: id,
        data: savedDoc as unknown as Record<string, unknown>,
        operationType: 'UPSERT',
      });
      dispatchLifeSync();
      showToast(docPayload.id ? 'Vault document updated.' : 'Encrypted document stored in vault.');
      return;
    }

    // Metadata-only update on existing document
    const record: DocumentRecord = {
      ...docPayload,
      id,
    };
    const saved = await persistSingleRecord('documents', id, record);
    setDocuments((prev) => prev.map((d) => (d.id === id ? saved : d)));
    showToast('Document metadata & permissions updated.');
  };

  const handleDownloadDocument = async (doc: DocumentRecord) => {
    try {
      const headers = await buildAuthHeaders();
      const res = await fetch(
        `/api/v1/domain/${encodeURIComponent(familyId)}/documents/${encodeURIComponent(doc.id)}/download`,
        {
          method: 'GET',
          headers,
        }
      );
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || `Access denied (${res.status})`);
      }
      const payload = await res.json();
      const base64 = payload.contentBase64 || payload.base64Content;
      if (base64) {
        const link = document.createElement('a');
        link.href = `data:${payload.mimeType || 'application/pdf'};base64,${base64}`;
        link.download = payload.fileName || doc.fileName || `${doc.id}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast(`Decrypted & downloaded "${doc.title}".`);
      }
    } catch (err: any) {
      setSyncError(err?.message || 'Vault download failed.');
    }
  };

  // 3. Personal Notes & Checklists + Templates
  const handleSavePersonalList = async (
    payload: Omit<PersonalList, 'id'> & { id?: string }
  ) => {
    const id = payload.id || `pl-${Date.now()}`;
    const record: PersonalList = {
      ...payload,
      id,
      ownerUserId: payload.ownerUserId || actorUserId,
      ownerMemberId: payload.ownerMemberId || actorMemberId,
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    const saved = await persistSingleRecord('personalLists', id, record);
    setPersonalLists((prev) => {
      const exists = prev.some((l) => l.id === id);
      return exists ? prev.map((l) => (l.id === id ? saved : l)) : [saved, ...prev];
    });
    showToast(payload.id ? 'Personal note updated.' : 'Personal note saved.');
  };

  const handleToggleChecklistItem = async (list: PersonalList, itemId: string) => {
    const updated: PersonalList = {
      ...list,
      items: list.items.map((it) => (it.id === itemId ? { ...it, done: !it.done } : it)),
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    setPersonalLists((prev) => prev.map((l) => (l.id === list.id ? updated : l)));
    try {
      await persistSingleRecord('personalLists', list.id, updated);
    } catch {
      setPersonalLists((prev) => prev.map((l) => (l.id === list.id ? list : l)));
    }
  };

  const handleUseChecklistTemplate = async (tpl: LifeChecklistTemplate) => {
    if (tpl.domain === 'Personal Admin') {
      const newList: PersonalList = {
        id: `pl-${Date.now()}`,
        title: tpl.title,
        type: 'Checklist',
        category: 'Personal Admin',
        content: tpl.description,
        items: tpl.items.map((text, idx) => ({
          id: `pli-${Date.now()}-${idx}`,
          text,
          done: false,
        })),
        isPrivate: true,
        scope: 'PRIVATE',
        ownerUserId: actorUserId,
        ownerMemberId: actorMemberId,
        updatedAt: new Date().toISOString().slice(0, 10),
      };
      const saved = await persistSingleRecord('personalLists', newList.id, newList);
      setPersonalLists((prev) => [saved, ...prev]);
      setActiveSubTab('personal_org');
      showToast(`Created checklist from "${tpl.title}".`);
    } else if (tpl.domain === 'Travel & Packing') {
      if (trips.length > 0) {
        const targetTrip = inspectingTrip || trips[0];
        const existingSet = new Set(targetTrip.packingList.map((p) => p.item.toLowerCase()));
        const added = tpl.items
          .filter((item) => !existingSet.has(item.toLowerCase()))
          .map((item, idx) => ({
            id: `pk-${Date.now()}-${idx}`,
            item,
            packed: false,
          }));
        const updatedTrip: TravelPlan = {
          ...targetTrip,
          packingList: [...targetTrip.packingList, ...added],
        };
        const saved = await persistSingleRecord('trips', updatedTrip.id, updatedTrip);
        setTrips((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
        if (inspectingTrip?.id === saved.id) setInspectingTrip(saved);
        showToast(`Applied "${tpl.title}" to ${targetTrip.destination}.`);
      } else {
        showToast('Create a trip plan first to apply a travel packing template.');
      }
    }
  };

  const handleSaveCustomTemplate = async (
    tplPayload: Omit<LifeChecklistTemplate, 'id'> & { id?: string }
  ) => {
    const id = tplPayload.id || `cust-tpl-${Date.now()}`;
    const record: LifeChecklistTemplate = { ...tplPayload, id };
    const saved = await persistSingleRecord('checklistTemplates', id, record);
    setTemplates((prev) => [...prev, saved]);
    showToast(`Saved reusable template "${saved.title}".`);
  };

  const handleDeleteCustomTemplate = async (tplId: string) => {
    const headers = await buildAuthHeaders();
    await fetch(
      `/api/v1/domain/${encodeURIComponent(familyId)}/life/checklistTemplates/${encodeURIComponent(tplId)}`,
      { method: 'DELETE', headers }
    );
    setTemplates((prev) => prev.filter((t) => t.id !== tplId));
    showToast('Custom template deleted.');
  };

  // 4. Important Contacts
  const handleSaveContact = async (
    payload: Omit<ImportantContact, 'id'> & { id?: string }
  ) => {
    const id = payload.id || `cnt-${Date.now()}`;
    const record: ImportantContact = { ...payload, id };
    const saved = await persistSingleRecord('contacts', id, record);
    setContacts((prev) => {
      const exists = prev.some((c) => c.id === id);
      return exists ? prev.map((c) => (c.id === id ? saved : c)) : [saved, ...prev];
    });
    showToast(payload.id ? 'Directory contact updated.' : 'Contact added to directory.');
  };

  // 5. Travel & Holiday Planning
  const handleSaveTrip = async (payload: Omit<TravelPlan, 'id'> & { id?: string }) => {
    const id = payload.id || `tr-${Date.now()}`;
    const record: TravelPlan = { ...payload, id };
    const saved = await persistSingleRecord('trips', id, record);
    setTrips((prev) => {
      const exists = prev.some((t) => t.id === id);
      return exists ? prev.map((t) => (t.id === id ? saved : t)) : [saved, ...prev];
    });
    if (inspectingTrip?.id === id) setInspectingTrip(saved);
    showToast(payload.id ? 'Trip logistics updated.' : 'Family trip plan created.');
  };

  // 6. Vehicle Management
  const handleSaveVehicle = async (payload: Omit<VehicleProfile, 'id'> & { id?: string }) => {
    const id = payload.id || `veh-${Date.now()}`;
    const record: VehicleProfile = { ...payload, id };
    const saved = await persistSingleRecord('vehicles', id, record);
    setVehicles((prev) => {
      const exists = prev.some((v) => v.id === id);
      return exists ? prev.map((v) => (v.id === id ? saved : v)) : [saved, ...prev];
    });
    if (inspectingVehicle?.id === id) setInspectingVehicle(saved);
    showToast(payload.id ? 'Vehicle profile updated.' : 'Vehicle added to household fleet.');
  };

  // 7. Long-Term Family Plans
  const handleSaveLongTermPlan = async (
    payload: Omit<LongTermPlan, 'id'> & { id?: string }
  ) => {
    const id = payload.id || `lt-${Date.now()}`;
    const record: LongTermPlan = { ...payload, id };
    const saved = await persistSingleRecord('longTermPlans', id, record);
    setLongTermPlans((prev) => {
      const exists = prev.some((lt) => lt.id === id);
      return exists ? prev.map((lt) => (lt.id === id ? saved : lt)) : [saved, ...prev];
    });
    if (inspectingLtPlan?.id === id) setInspectingLtPlan(saved);
    showToast(payload.id ? 'Long-term roadmap updated.' : 'Long-term family plan created.');
  };

  // ============================================================================
  // DERIVED & FILTERED VIEWS
  // ============================================================================

  const accessibleDocuments = useMemo(
    () => documents.filter((doc) => canRoleViewDocument(doc.accessLevel)),
    [documents, canRoleViewDocument]
  );

  const expiringDocuments = useMemo(
    () => accessibleDocuments.filter((doc) => isExpiringWithinDays(doc.expirationDate, 120)),
    [accessibleDocuments]
  );

  const filteredTasks = useMemo(() => {
    return personalTasks.filter((t) => {
      const privateFlag = t.isPrivate !== false && t.scope !== 'FAMILY';
      if (taskScopeFilter === 'PRIVATE' && !privateFlag) return false;
      if (taskScopeFilter === 'FAMILY' && privateFlag) return false;
      if (taskCategoryFilter !== 'ALL' && t.category !== taskCategoryFilter) return false;
      return true;
    });
  }, [personalTasks, taskScopeFilter, taskCategoryFilter]);

  const filteredDocuments = useMemo(() => {
    return accessibleDocuments.filter((doc) => {
      if (docCategoryFilter !== 'ALL' && doc.category !== docCategoryFilter) return false;
      if (docAccessFilter !== 'ALL' && doc.accessLevel !== docAccessFilter) return false;
      if (docSearch.trim()) {
        const q = docSearch.toLowerCase();
        const matchTitle = doc.title.toLowerCase().includes(q);
        const matchIssuer = (doc.issuer || '').toLowerCase().includes(q);
        const matchRef = (doc.referenceNumber || '').toLowerCase().includes(q);
        const matchTags = (doc.tags || []).some((t) => t.toLowerCase().includes(q));
        if (!matchTitle && !matchIssuer && !matchRef && !matchTags) return false;
      }
      return true;
    });
  }, [accessibleDocuments, docCategoryFilter, docAccessFilter, docSearch]);

  const filteredNotes = useMemo(() => {
    return personalLists.filter((note) => {
      if (noteTypeFilter !== 'ALL' && note.type !== noteTypeFilter) return false;
      if (noteSearch.trim()) {
        const q = noteSearch.toLowerCase();
        const inTitle = note.title.toLowerCase().includes(q);
        const inContent = note.content.toLowerCase().includes(q);
        const inItems = note.items.some((i) => i.text.toLowerCase().includes(q));
        if (!inTitle && !inContent && !inItems) return false;
      }
      return true;
    });
  }, [personalLists, noteTypeFilter, noteSearch]);

  const filteredContacts = useMemo(() => {
    return contacts
      .filter((c) => {
        if (contactCategoryFilter !== 'ALL' && c.category !== contactCategoryFilter) return false;
        if (contactSearch.trim()) {
          const q = contactSearch.toLowerCase();
          const matchName = c.name.toLowerCase().includes(q);
          const matchRole = c.role.toLowerCase().includes(q);
          const matchPhone = c.phone.toLowerCase().includes(q);
          const matchNotes = c.notes.toLowerCase().includes(q);
          const matchPolicy = (c.accountOrPolicyNumber || '').toLowerCase().includes(q);
          if (!matchName && !matchRole && !matchPhone && !matchNotes && !matchPolicy) return false;
        }
        return true;
      })
      .sort((a, b) => Number(Boolean(b.isEmergencyPriority)) - Number(Boolean(a.isEmergencyPriority)));
  }, [contacts, contactCategoryFilter, contactSearch]);

  const filteredLongTermPlans = useMemo(() => {
    if (longTermCategoryFilter === 'ALL') return longTermPlans;
    return longTermPlans.filter((p) => p.category === longTermCategoryFilter);
  }, [longTermPlans, longTermCategoryFilter]);

  return (
    <div className="space-y-6">
      {/* Feedback Toast & Error Banner */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl bg-stone-900 text-white text-xs font-semibold shadow-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {syncError && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
            <span className="font-medium">{syncError}</span>
          </div>
          <button
            type="button"
            onClick={() => setSyncError(null)}
            className="text-rose-700 font-semibold hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Minimalist Workspace Header & Navigation */}
      <div className="rounded-2xl p-6 bg-white border border-stone-200 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              Personal & Administrative Center · Role: {selectedRole}
            </span>
            <h2 className="font-serif font-bold text-2xl text-stone-900 mt-0.5">
              Life Management & Vault Administration
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              High-trust workspace for user-scoped administration, encrypted vital records, emergency directories, fleet compliance, and multi-year roadmaps.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => {
                setTemplatesModalDomain(undefined);
                setTemplatesModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl border border-stone-200 hover:bg-stone-50 font-semibold text-stone-800 flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-800" />
              <span>Checklist Templates</span>
            </button>
            {canMutateVault && (
              <button
                type="button"
                onClick={() => {
                  setEditingDoc(null);
                  setDocModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <FolderLock className="w-3.5 h-3.5" />
                <span>Upload to Vault</span>
              </button>
            )}
          </div>
        </div>

        {/* 7 Sub-Module Navigation Tabs */}
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-stone-100">
          {(
            [
              { id: 'personal_dashboard', label: 'Personal Dashboard', icon: Briefcase },
              { id: 'documents', label: 'Document Vault', icon: FileText },
              { id: 'personal_org', label: 'Personal Notes & Checklists', icon: ListTodo },
              { id: 'contacts', label: 'Important Contacts', icon: Phone },
              { id: 'travel', label: 'Travel & Holidays', icon: Plane },
              { id: 'vehicles', label: 'Vehicle Management', icon: Car },
              { id: 'long_term', label: 'Long-Term Family Plans', icon: Compass },
            ] as { id: LifeSubTab; label: string; icon: React.FC<{ className?: string }> }[]
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveSubTab(tab.id);
                  onSelectSubPage?.(TAB_TO_SUBPAGE[tab.id]);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  active
                    ? 'bg-[#173D35] text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {isLoading && (
        <div className="p-4 rounded-2xl bg-white border border-stone-200 text-xs text-stone-500 flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded-full border-2 border-emerald-800 border-t-transparent animate-spin" />
          <span>Synchronizing administrative records...</span>
        </div>
      )}

      {/* =====================================================================
          1. PERSONAL DASHBOARD (USER-SCOPED ADMINISTRATIVE OVERVIEW)
         ===================================================================== */}
      {activeSubTab === 'personal_dashboard' && (
        <div className="space-y-6">
          {/* Calm Status Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs">
              <span className="text-xs text-stone-500 block">Open Admin Actions</span>
              <span className="font-serif font-bold text-2xl text-stone-900 mt-1 block tabular-nums">
                {personalTasks.filter((t) => !t.completed).length} Pending
              </span>
              <span className="text-[11px] text-stone-500 mt-0.5 block">
                {personalTasks.filter((t) => t.isPrivate !== false && !t.completed).length} private ·{' '}
                {personalTasks.filter((t) => t.scope === 'FAMILY' && !t.completed).length} shared
              </span>
            </div>

            <button
              type="button"
              onClick={() => setActiveSubTab('documents')}
              className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs text-left hover:border-emerald-800 transition cursor-pointer"
            >
              <span className="text-xs text-stone-500 block">Vault Expiration Alerts</span>
              <span className="font-serif font-bold text-2xl text-stone-900 mt-1 block tabular-nums">
                {expiringDocuments.length} Upcoming
              </span>
              <span className="text-[11px] text-emerald-800 font-semibold mt-0.5 block">
                {accessibleDocuments.length} accessible vault files →
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('vehicles')}
              className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs text-left hover:border-emerald-800 transition cursor-pointer"
            >
              <span className="text-xs text-stone-500 block">Household Vehicles</span>
              <span className="font-serif font-bold text-2xl text-stone-900 mt-1 block tabular-nums">
                {vehicles.length} Active
              </span>
              <span className="text-[11px] text-emerald-800 font-semibold mt-0.5 block">
                Registration & service logs →
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('travel')}
              className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs text-left hover:border-emerald-800 transition cursor-pointer"
            >
              <span className="text-xs text-stone-500 block">Active Travel Plans</span>
              <span className="font-serif font-bold text-2xl text-stone-900 mt-1 block tabular-nums">
                {trips.length} Planned
              </span>
              <span className="text-[11px] text-emerald-800 font-semibold mt-0.5 block">
                {trips[0] ? `${trips[0].destination} (${trips[0].dates})` : 'Plan itinerary & packing →'}
              </span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Columns: User-Scoped Administrative Actions */}
            <div className="lg:col-span-2 rounded-2xl p-6 bg-white border border-stone-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
                <div>
                  <h3 className="font-serif font-bold text-lg text-stone-900">
                    Personal Administrative Queue
                  </h3>
                  <p className="text-xs text-stone-500">
                    User-scoped renewals, filings, and private administrative reminders (distinct from shared household chores).
                  </p>
                </div>
                {canMutateShared && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTask(null);
                      setTaskModalOpen(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Action</span>
                  </button>
                )}
              </div>

              {/* Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  {(
                    [
                      { id: 'ALL', label: 'All Scopes' },
                      { id: 'PRIVATE', label: 'Private Only' },
                      { id: 'FAMILY', label: 'Shared Admin' },
                    ] as const
                  ).map((sc) => (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => setTaskScopeFilter(sc.id)}
                      className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                        taskScopeFilter === sc.id
                          ? 'bg-stone-900 text-white'
                          : 'bg-stone-100 text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      {sc.label}
                    </button>
                  ))}
                </div>

                <select
                  value={taskCategoryFilter}
                  onChange={(e) => setTaskCategoryFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-stone-200 bg-white text-stone-700 font-medium"
                >
                  <option value="ALL">All Categories</option>
                  <option value="Personal Admin">Personal Admin</option>
                  <option value="Document Renewal">Document Renewal</option>
                  <option value="Vehicle & Insurance">Vehicle & Insurance</option>
                  <option value="Tax & Legal">Tax & Legal</option>
                  <option value="Travel Prep">Travel Prep</option>
                </select>
              </div>

              {/* Tasks List */}
              <div className="space-y-2.5">
                {filteredTasks.length === 0 ? (
                  <div className="p-8 text-center rounded-xl bg-stone-50 border border-stone-200/70 text-xs text-stone-500">
                    No administrative actions match the current filter.
                  </div>
                ) : (
                  filteredTasks.map((t) => {
                    const isPriv = t.isPrivate !== false && t.scope !== 'FAMILY';
                    return (
                      <div
                        key={t.id}
                        className={`p-3.5 rounded-xl border transition flex items-start justify-between gap-3 ${
                          t.completed
                            ? 'bg-stone-50/70 border-stone-200/70'
                            : 'bg-white border-stone-200 hover:border-stone-300'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => void handleTogglePersonalTask(t)}
                          className="flex items-start gap-3 text-left flex-1 cursor-pointer"
                        >
                          {t.completed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                          ) : (
                            <Circle className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
                          )}
                          <div className="space-y-0.5">
                            <p
                              className={`text-xs font-semibold ${
                                t.completed ? 'line-through text-stone-400' : 'text-stone-900'
                              }`}
                            >
                              {t.title}
                            </p>
                            <p className="text-[11px] text-stone-500 tabular-nums">
                              {t.category} · Due {t.dueDate} · {t.priority} Priority ·{' '}
                              {isPriv ? 'Private' : 'Shared Admin'}
                            </p>
                            {t.notes && (
                              <p className="text-[11px] text-stone-500 pt-0.5">{t.notes}</p>
                            )}
                          </div>
                        </button>

                        {canMutateShared && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTask(t);
                                setTaskModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-800 hover:bg-stone-100 cursor-pointer"
                              title="Edit action"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({
                                  collection: 'personalTasks',
                                  id: t.id,
                                  title: t.title,
                                  description:
                                    'Are you sure you want to remove this administrative reminder?',
                                })
                              }
                              className="p-1.5 rounded-lg text-stone-400 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                              title="Delete action"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Column: Expirations, Fleet Reminders & Emergency Quick-Dial */}
            <div className="space-y-6">
              {/* Document Expirations & Vehicle Compliance */}
              <div className="rounded-2xl p-5 bg-white border border-stone-200 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-serif font-bold text-base text-stone-900">
                    Upcoming Renewals & Compliance
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('documents')}
                    className="text-xs font-semibold text-emerald-800 hover:underline cursor-pointer"
                  >
                    Vault →
                  </button>
                </div>

                <div className="space-y-2 text-xs">
                  {accessibleDocuments.slice(0, 3).map((doc) => {
                    const expiring = isExpiringWithinDays(doc.expirationDate, 120);
                    return (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => setInspectingDoc(doc)}
                        className="w-full p-3 rounded-xl bg-stone-50 border border-stone-200/80 hover:border-emerald-800 text-left flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-stone-900 truncate">{doc.title}</div>
                          <div className="text-[11px] text-stone-500">
                            {doc.category} · {doc.accessLevel}
                          </div>
                        </div>
                        <span
                          className={`font-mono text-[11px] shrink-0 tabular-nums ${
                            expiring ? 'font-bold text-amber-800' : 'text-stone-600'
                          }`}
                        >
                          {doc.expirationDate}
                        </span>
                      </button>
                    );
                  })}

                  {vehicles.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setInspectingVehicle(v)}
                      className="w-full p-3 rounded-xl bg-stone-50 border border-stone-200/80 hover:border-emerald-800 text-left flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-stone-900 truncate">{v.name}</div>
                        <div className="text-[11px] text-stone-500 truncate">{v.nextMaintenance}</div>
                      </div>
                      <span className="font-mono text-[11px] text-stone-600 shrink-0 tabular-nums">
                        {v.registration}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority Emergency Contacts */}
              <div className="rounded-2xl p-5 bg-white border border-stone-200 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif font-bold text-base text-stone-900">
                      Priority Emergency Directory
                    </h3>
                    <button
                      type="button"
                      onClick={() => onOpenPrintDoc ? onOpenPrintDoc('EMERGENCY_CRISIS_PACKET') : window.print()}
                      className="p-1 rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 text-[#C39A60] transition-colors cursor-pointer"
                      title="Print Emergency Crisis Packet"
                      aria-label="Print Emergency Crisis Packet"
                    >
                      <Printer className="w-4 h-4 text-[#C39A60]" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('contacts')}
                    className="text-xs font-semibold text-emerald-800 hover:underline cursor-pointer"
                  >
                    All Contacts →
                  </button>
                </div>

                <div className="space-y-2 text-xs">
                  {contacts
                    .filter((c) => c.isEmergencyPriority)
                    .slice(0, 3)
                    .map((c) => (
                      <div
                        key={c.id}
                        className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-stone-900 truncate">{c.name}</div>
                          <div className="text-[11px] text-stone-500">
                            {c.role} · <span className="font-mono tabular-nums">{c.phone}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyText(`dash-${c.id}`, c.phone, c.name)}
                          className="p-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-100 text-stone-700 shrink-0 cursor-pointer"
                          title="Copy phone number"
                        >
                          {copiedKey === `dash-${c.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-700" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          2. DOCUMENT VAULT (ENCRYPTED RECORDS & RBAC POLICIES)
         ===================================================================== */}
      {activeSubTab === 'documents' && (
        <div className="space-y-5">
          {/* Search, Category & RBAC Filter Bar */}
          <div className="rounded-2xl p-5 bg-white border border-stone-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2.5 flex-1 text-xs">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={docSearch}
                  onChange={(e) => setDocSearch(e.target.value)}
                  placeholder="Search vault by title, issuer, policy #, or tag..."
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-stone-300"
                />
              </div>

              <select
                value={docCategoryFilter}
                onChange={(e) => setDocCategoryFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-stone-300 bg-white font-medium text-stone-700"
              >
                <option value="ALL">All Categories</option>
                <option value="Identification">Identification</option>
                <option value="Insurance">Insurance</option>
                <option value="Property & Home">Property & Home</option>
                <option value="Medical">Medical</option>
                <option value="Financial & Tax">Financial & Tax</option>
                <option value="Education & Certificates">Education & Certificates</option>
                <option value="Contracts & Warranties">Contracts & Warranties</option>
              </select>

              <select
                value={docAccessFilter}
                onChange={(e) => setDocAccessFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-stone-300 bg-white font-medium text-stone-700"
              >
                <option value="ALL">All Access Policies</option>
                <option value="Owner & Admin Only">Owner & Admin Only</option>
                <option value="Adult Members">Adult Members</option>
                <option value="All Household">All Household</option>
              </select>
            </div>

            {canMutateVault ? (
              <button
                type="button"
                onClick={() => {
                  setEditingDoc(null);
                  setDocModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Upload Protected Document</span>
              </button>
            ) : (
              <span className="text-xs text-stone-500 font-medium">
                Read-only vault access for role {selectedRole}
              </span>
            )}
          </div>

          {/* Document Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredDocuments.length === 0 ? (
              <div className="col-span-full p-10 text-center rounded-2xl bg-white border border-stone-200 text-xs text-stone-500">
                No accessible vault documents match your current filter.
              </div>
            ) : (
              filteredDocuments.map((doc) => {
                const expiring = isExpiringWithinDays(doc.expirationDate, 120);
                return (
                  <div
                    key={doc.id}
                    className="rounded-2xl p-5 bg-white border border-stone-200 shadow-xs flex flex-col justify-between space-y-4 hover:border-stone-300 transition"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[11px] font-semibold text-emerald-800">
                          {doc.category} · {doc.accessLevel}
                        </span>
                        <Lock className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      </div>

                      <button
                        type="button"
                        onClick={() => setInspectingDoc(doc)}
                        className="text-left block group cursor-pointer"
                      >
                        <h3 className="font-serif font-bold text-base text-stone-900 group-hover:text-emerald-900">
                          {doc.title}
                        </h3>
                      </button>

                      {(doc.issuer || doc.referenceNumber) && (
                        <p className="text-xs text-stone-500">
                          {doc.issuer || 'Verified Record'}
                          {doc.referenceNumber ? ` · Ref: ${doc.referenceNumber}` : ''}
                        </p>
                      )}

                      {doc.tags && doc.tags.length > 0 && (
                        <p className="text-[11px] text-stone-500">
                          Tags: {doc.tags.join(' · ')}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-stone-100 space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-stone-500">Expiration</span>
                        <span
                          className={`font-mono tabular-nums ${
                            expiring ? 'font-bold text-amber-800' : 'font-medium text-stone-800'
                          }`}
                        >
                          {expiring ? `Alert · ${doc.expirationDate}` : doc.expirationDate}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setInspectingDoc(doc)}
                            className="px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Inspect</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDownloadDocument(doc)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download</span>
                          </button>
                        </div>

                        {canMutateVault && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingDoc(doc);
                                setDocModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-800 hover:bg-stone-100 cursor-pointer"
                              title="Edit document"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({
                                  collection: 'documents',
                                  id: doc.id,
                                  title: doc.title,
                                  description:
                                    'Permanently remove this encrypted document record from the FamilyOS Document Vault?',
                                })
                              }
                              className="p-1.5 rounded-lg text-stone-400 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                              title="Delete document"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          3. PERSONAL NOTES & CHECKLISTS (USER-SCOPED + REUSABLE TEMPLATES)
         ===================================================================== */}
      {activeSubTab === 'personal_org' && (
        <div className="space-y-5">
          <div className="rounded-2xl p-5 bg-white border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 flex-1 text-xs">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={noteSearch}
                  onChange={(e) => setNoteSearch(e.target.value)}
                  placeholder="Search personal notes and checklists..."
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-stone-300"
                />
              </div>

              <select
                value={noteTypeFilter}
                onChange={(e) => setNoteTypeFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-stone-300 bg-white font-medium text-stone-700"
              >
                <option value="ALL">All Formats</option>
                <option value="Checklist">Checklists</option>
                <option value="Note">Notes</option>
                <option value="Admin Template">Admin Protocols</option>
              </select>
            </div>

            {canMutateShared && (
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setTemplatesModalDomain('Personal Admin');
                    setTemplatesModalOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-xl border border-stone-200 hover:bg-stone-50 font-semibold text-stone-800 flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-800" />
                  <span>Admin Templates</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingNote(null);
                    setNoteModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Note / Checklist</span>
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredNotes.length === 0 ? (
              <div className="col-span-full p-10 text-center rounded-2xl bg-white border border-stone-200 text-xs text-stone-500">
                No personal notes or checklists found.
              </div>
            ) : (
              filteredNotes.map((pl) => {
                const isPriv = pl.isPrivate !== false && pl.scope !== 'FAMILY';
                const doneCount = pl.items.filter((i) => i.done).length;
                return (
                  <div
                    key={pl.id}
                    className="rounded-2xl p-6 bg-white border border-stone-200 shadow-xs flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[11px] font-semibold text-emerald-800">
                            {pl.type} · {pl.category || 'Personal Admin'} ·{' '}
                            {isPriv ? 'Private (User-Scoped)' : 'Shared Admin'}
                          </span>
                          <h3 className="font-serif font-bold text-lg text-stone-900 mt-0.5">
                            {pl.title}
                          </h3>
                        </div>

                        {canMutateShared && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingNote(pl);
                                setNoteModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-800 hover:bg-stone-100 cursor-pointer"
                              title="Edit note or checklist"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({
                                  collection: 'personalLists',
                                  id: pl.id,
                                  title: pl.title,
                                  description: 'Delete this personal note and its checklist items?',
                                })
                              }
                              className="p-1.5 rounded-lg text-stone-400 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                              title="Delete note"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {pl.content && (
                        <p className="text-xs text-stone-600 whitespace-pre-line leading-relaxed bg-stone-50 p-3.5 rounded-xl border border-stone-200/80">
                          {pl.content}
                        </p>
                      )}

                      {pl.items.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between text-[11px] text-stone-500 font-semibold">
                            <span>Checklist Progress</span>
                            <span className="font-mono tabular-nums">
                              {doneCount}/{pl.items.length} completed
                            </span>
                          </div>
                          {pl.items.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => void handleToggleChecklistItem(pl, item.id)}
                              className="w-full px-3 py-2 rounded-xl bg-stone-50 hover:bg-stone-100/80 border border-stone-200/70 flex items-center gap-2.5 text-left text-xs cursor-pointer"
                            >
                              {item.done ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                              ) : (
                                <Circle className="w-4 h-4 text-stone-400 shrink-0" />
                              )}
                              <span
                                className={
                                  item.done ? 'line-through text-stone-400' : 'text-stone-800 font-medium'
                                }
                              >
                                {item.text}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-400">
                      <span>Updated {pl.updatedAt || 'Recently'}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingNote(pl);
                          setNoteModalOpen(true);
                        }}
                        className="text-emerald-800 font-semibold hover:underline cursor-pointer"
                      >
                        Manage Steps →
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          4. IMPORTANT CONTACTS (ADMINISTRATIVE, MEDICAL, LEGAL & EMERGENCY)
         ===================================================================== */}
      {activeSubTab === 'contacts' && (
        <div className="space-y-5">
          <div className="rounded-2xl p-5 bg-white border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 flex-1 text-xs">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  placeholder="Search medical, legal, insurance, utilities, or policy #..."
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-stone-300"
                />
              </div>

              <select
                value={contactCategoryFilter}
                onChange={(e) => setContactCategoryFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-stone-300 bg-white font-medium text-stone-700"
              >
                <option value="ALL">All Administrative Categories</option>
                <option value="Emergency & Medical">Emergency & Medical</option>
                <option value="Insurance & Policy">Insurance & Policy</option>
                <option value="Legal & Financial">Legal & Financial</option>
                <option value="Home & Utilities">Home & Utilities</option>
                <option value="Schools & Childcare">Schools & Childcare</option>
                <option value="Service Contractors">Service Contractors</option>
              </select>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onOpenPrintDoc ? onOpenPrintDoc('EMERGENCY_CRISIS_PACKET') : window.print()}
                className="p-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-[#C39A60] shrink-0 cursor-pointer transition-colors shadow-2xs"
                title="Print Emergency Crisis Packet"
                aria-label="Print Emergency Crisis Packet"
              >
                <Printer className="w-4 h-4 text-[#C39A60]" />
              </button>
              {canMutateShared && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingContact(null);
                    setContactModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Provider / Contact</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredContacts.length === 0 ? (
              <div className="col-span-full p-10 text-center rounded-2xl bg-white border border-stone-200 text-xs text-stone-500">
                No administrative or emergency contacts match your search.
              </div>
            ) : (
              filteredContacts.map((c) => (
                <div
                  key={c.id}
                  className="rounded-2xl p-5 bg-white border border-stone-200 shadow-xs flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] font-semibold text-emerald-800">
                        {c.category}
                        {c.isEmergencyPriority ? ' · Priority Emergency' : ''}
                      </span>

                      {canMutateShared && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingContact(c);
                              setContactModalOpen(true);
                            }}
                            className="p-1 rounded-lg text-stone-400 hover:text-stone-800 hover:bg-stone-100 cursor-pointer"
                            title="Edit contact"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteTarget({
                                collection: 'contacts',
                                id: c.id,
                                title: c.name,
                                description:
                                  'Remove this provider from the Important Contacts directory?',
                              })
                            }
                            className="p-1 rounded-lg text-stone-400 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                            title="Delete contact"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <h3 className="font-serif font-bold text-base text-stone-900">{c.name}</h3>
                    <p className="text-xs text-stone-500">{c.role}</p>

                    {c.notes && (
                      <p className="text-xs text-stone-600 bg-stone-50 p-3 rounded-xl border border-stone-200/70 leading-relaxed">
                        {c.notes}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-stone-100 space-y-2 text-xs">
                    {/* Quick-Copy Phone Row */}
                    <div className="flex items-center justify-between">
                      <span className="text-stone-500">Phone</span>
                      <button
                        type="button"
                        onClick={() => handleCopyText(`ph-${c.id}`, c.phone, 'phone number')}
                        className="font-mono font-semibold text-emerald-900 hover:underline flex items-center gap-1.5 tabular-nums cursor-pointer"
                      >
                        <span>{c.phone}</span>
                        {copiedKey === `ph-${c.id}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-700" />
                        ) : (
                          <Copy className="w-3 h-3 text-stone-400" />
                        )}
                      </button>
                    </div>

                    {c.accountOrPolicyNumber && (
                      <div className="flex items-center justify-between">
                        <span className="text-stone-500">Policy / Acct #</span>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyText(
                              `pol-${c.id}`,
                              c.accountOrPolicyNumber || '',
                              'policy/account number'
                            )
                          }
                          className="font-mono font-medium text-stone-800 hover:underline flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>{c.accountOrPolicyNumber}</span>
                          {copiedKey === `pol-${c.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-700" />
                          ) : (
                            <Copy className="w-3 h-3 text-stone-400" />
                          )}
                        </button>
                      </div>
                    )}

                    {c.email && (
                      <div className="flex items-center justify-between">
                        <span className="text-stone-500">Email</span>
                        <button
                          type="button"
                          onClick={() => handleCopyText(`em-${c.id}`, c.email || '', 'email')}
                          className="font-medium text-stone-700 hover:underline flex items-center gap-1.5 truncate max-w-[190px] cursor-pointer"
                        >
                          <span className="truncate">{c.email}</span>
                          <Copy className="w-3 h-3 text-stone-400 shrink-0" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          5. TRAVEL & HOLIDAY PLANNING (ITINERARIES, PACKING & ATTACHMENTS)
         ===================================================================== */}
      {activeSubTab === 'travel' && (
        <div className="space-y-5">
          <div className="rounded-2xl p-5 bg-white border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-serif font-bold text-lg text-stone-900">
                Travel & Holiday Planning
              </h3>
              <p className="text-xs text-stone-500">
                Structured trip cards with itineraries, reusable packing checklists, booking references, and ticket attachments.
              </p>
            </div>

            {canMutateShared && (
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setTemplatesModalDomain('Travel & Packing');
                    setTemplatesModalOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-xl border border-stone-200 hover:bg-stone-50 font-semibold text-stone-800 flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-800" />
                  <span>Packing Templates</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingTrip(null);
                    setTripModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Plan New Trip</span>
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {trips.map((tr) => {
              const packedCount = tr.packingList.filter((p) => p.packed).length;
              return (
                <div
                  key={tr.id}
                  className="rounded-2xl p-6 bg-white border border-stone-200 shadow-xs flex flex-col justify-between space-y-5"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[11px] font-semibold text-emerald-800">
                          {tr.status || 'Upcoming'} · {tr.dates}
                        </span>
                        <h3 className="font-serif font-bold text-xl text-stone-900 mt-0.5">
                          {tr.destination}
                        </h3>
                        <p className="text-xs text-stone-500 mt-0.5">
                          {tr.accommodation}
                          {tr.bookingReference ? ` · Ref: ${tr.bookingReference}` : ''}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-[11px] text-stone-500 block">Spent / Budget</span>
                        <span className="font-mono font-bold text-sm text-stone-900 tabular-nums">
                          {formatCents(tr.spentCents)} / {formatCents(tr.budgetCents)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2">
                      <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1.5">
                        <span className="font-bold text-stone-900 block">
                          Itinerary ({tr.activities.length} items)
                        </span>
                        {tr.activities.slice(0, 3).map((act, idx) => (
                          <p key={idx} className="text-stone-600 truncate">
                            • {act}
                          </p>
                        ))}
                      </div>

                      <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-stone-900">Packing Readiness</span>
                          <span className="font-mono text-[11px] text-emerald-800 font-semibold tabular-nums">
                            {packedCount}/{tr.packingList.length}
                          </span>
                        </div>
                        {tr.packingList.slice(0, 3).map((pk) => (
                          <button
                            key={pk.id}
                            type="button"
                            onClick={() => {
                              const updated: TravelPlan = {
                                ...tr,
                                packingList: tr.packingList.map((item) =>
                                  item.id === pk.id ? { ...item, packed: !item.packed } : item
                                ),
                              };
                              void handleSaveTrip(updated);
                            }}
                            className="w-full text-left flex items-center gap-1.5 text-stone-700 hover:text-stone-950 truncate cursor-pointer"
                          >
                            {pk.packed ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                            ) : (
                              <Circle className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                            )}
                            <span className={pk.packed ? 'line-through text-stone-400 truncate' : 'truncate'}>
                              {pk.item}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => setInspectingTrip(tr)}
                      className="px-3.5 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-semibold cursor-pointer"
                    >
                      Open Itinerary & Packing Drawer
                    </button>

                    {canMutateShared && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTrip(tr);
                            setTripModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-stone-400 hover:text-stone-800 hover:bg-stone-100 cursor-pointer"
                          title="Edit trip"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteTarget({
                              collection: 'trips',
                              id: tr.id,
                              title: tr.destination,
                              description: 'Delete this travel plan and its packing checklist?',
                            })
                          }
                          className="p-1.5 rounded-lg text-stone-400 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                          title="Delete trip"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          6. VEHICLE MANAGEMENT (REGISTRATION, INSURANCE & SERVICE LOGS)
         ===================================================================== */}
      {activeSubTab === 'vehicles' && (
        <div className="space-y-5">
          <div className="rounded-2xl p-5 bg-white border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-serif font-bold text-lg text-stone-900">
                Household Vehicle Fleet & Service Compliance
              </h3>
              <p className="text-xs text-stone-500">
                Dedicated vehicle profiles tracking registration, insurance renewals, maintenance intervals, and service receipts.
              </p>
            </div>

            {canMutateShared && (
              <button
                type="button"
                onClick={() => {
                  setEditingVehicle(null);
                  setVehicleModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Vehicle</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {vehicles.map((v) => (
              <div
                key={v.id}
                className="rounded-2xl p-6 bg-white border border-stone-200 shadow-xs flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between border-b border-stone-100 pb-3">
                    <div>
                      <span className="text-[11px] font-semibold text-emerald-800">
                        {v.registration}
                        {v.vinOrPlate ? ` · ${v.vinOrPlate}` : ''}
                      </span>
                      <h3 className="font-serif font-bold text-lg text-stone-900 mt-0.5">
                        {v.name}
                      </h3>
                    </div>
                    <span className="font-mono text-xs font-semibold text-stone-700 tabular-nums">
                      {formatCents(v.monthlyFuelCents)}/mo energy
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-stone-100">
                      <span className="text-stone-500">Insurance Renewal</span>
                      <span className="font-mono text-stone-900 tabular-nums">
                        {v.insuranceRenewal}
                        {v.insuranceProvider ? ` (${v.insuranceProvider})` : ''}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-stone-100">
                      <span className="text-stone-500">Inspection Date</span>
                      <span className="font-mono text-stone-900 tabular-nums">{v.inspectionDate}</span>
                    </div>
                    {v.currentMileage && (
                      <div className="flex justify-between py-1 border-b border-stone-100">
                        <span className="text-stone-500">Current Odometer</span>
                        <span className="font-mono text-stone-900 tabular-nums">{v.currentMileage}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-1 border-b border-stone-100">
                      <span className="text-stone-500">Next Scheduled Service</span>
                      <span className="font-semibold text-amber-900">{v.nextMaintenance}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 mt-2">
                      <span className="font-bold text-stone-900 block mb-0.5">
                        Latest Maintenance Summary ({(v.maintenanceLogs || []).length} logged entries)
                      </span>
                      <p className="text-stone-600">{v.serviceHistory}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => setInspectingVehicle(v)}
                    className="px-3.5 py-1.5 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Log Service & View History</span>
                  </button>

                  {canMutateShared && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingVehicle(v);
                          setVehicleModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-stone-800 hover:bg-stone-100 cursor-pointer"
                        title="Edit vehicle"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({
                            collection: 'vehicles',
                            id: v.id,
                            title: v.name,
                            description: 'Remove this vehicle profile and its maintenance history?',
                          })
                        }
                        className="p-1.5 rounded-lg text-stone-400 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                        title="Delete vehicle"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =====================================================================
          7. LONG-TERM FAMILY PLANS (MULTI-YEAR ROADMAPS & ESTATE MILESTONES)
         ===================================================================== */}
      {activeSubTab === 'long_term' && (
        <div className="space-y-5">
          <div className="rounded-2xl p-5 bg-white border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <h3 className="font-serif font-bold text-lg text-stone-900">
                  Long-Term Family Plans & Multi-Year Roadmaps
                </h3>
                <p className="text-xs text-stone-500">
                  High-level multi-year family priorities, estate structures, and major capital roadmaps (distinct from day-to-day Goals & Projects).
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select
                value={longTermCategoryFilter}
                onChange={(e) => setLongTermCategoryFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-stone-300 bg-white font-medium text-stone-700"
              >
                <option value="ALL">All Strategic Domains</option>
                <option value="Estate & Legal">Estate & Legal</option>
                <option value="Education & Trust">Education & Trust</option>
                <option value="Real Estate & Capital">Real Estate & Capital</option>
                <option value="Retirement & Stewardship">Retirement & Stewardship</option>
                <option value="Multi-Year Family Roadmap">Multi-Year Family Roadmap</option>
              </select>

              {canMutateShared && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingLtPlan(null);
                    setLtModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Long-Term Plan</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredLongTermPlans.map((lt) => (
              <div
                key={lt.id}
                className="rounded-2xl p-6 bg-white border border-stone-200 shadow-xs flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-emerald-800">
                      {lt.category} · {lt.horizon || 'Multi-Year'}
                    </span>
                    <span className="font-mono text-stone-500 tabular-nums">
                      Target: {lt.targetDate}
                    </span>
                  </div>

                  <h3 className="font-serif font-bold text-xl text-stone-900">{lt.title}</h3>

                  <div className="flex items-center justify-between text-xs py-1 border-b border-stone-100">
                    <span className="text-stone-500">Target Capital Allocation</span>
                    <span className="font-mono font-bold text-stone-900 tabular-nums">
                      {formatCents(lt.estimatedBudgetCents)}
                    </span>
                  </div>

                  {lt.advisorOrCustodian && (
                    <div className="flex items-center justify-between text-xs py-1 border-b border-stone-100">
                      <span className="text-stone-500">Fiduciary / Custodian</span>
                      <span className="font-medium text-stone-800">{lt.advisorOrCustodian}</span>
                    </div>
                  )}

                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-stone-700">Milestone Readiness</span>
                      <span className="font-mono text-emerald-900 tabular-nums">
                        {lt.progressPercent}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-stone-100 overflow-hidden">
                      <div
                        className="h-full bg-[#173D35] rounded-full transition-all"
                        style={{ width: `${lt.progressPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80 text-xs space-y-1">
                    <span className="font-bold text-stone-900 block">Key Multi-Year Milestones</span>
                    <ul className="space-y-1 text-stone-600">
                      {(lt.milestones || []).slice(0, 3).map((m, i) => (
                        <li key={i} className="truncate">
                          • {m}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => setInspectingLtPlan(lt)}
                    className="px-3.5 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-semibold cursor-pointer"
                  >
                    Review Roadmap & Milestones
                  </button>

                  {canMutateShared && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingLtPlan(lt);
                          setLtModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-stone-800 hover:bg-stone-100 cursor-pointer"
                        title="Edit long-term plan"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({
                            collection: 'longTermPlans',
                            id: lt.id,
                            title: lt.title,
                            description: 'Remove this long-term family roadmap?',
                          })
                        }
                        className="p-1.5 rounded-lg text-stone-400 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                        title="Delete long-term plan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =====================================================================
          MODALS & SLIDE-OVER DRAWERS
         ===================================================================== */}
      <PersonalTaskModal
        isOpen={taskModalOpen}
        initialData={editingTask}
        onClose={() => {
          setTaskModalOpen(false);
          setEditingTask(null);
        }}
        onSave={handleSavePersonalTask}
      />

      <DocumentVaultModal
        isOpen={docModalOpen}
        initialData={editingDoc}
        onClose={() => {
          setDocModalOpen(false);
          setEditingDoc(null);
        }}
        onSave={handleSaveDocument}
      />

      <DocumentDetailDrawer
        document={inspectingDoc}
        canMutate={canMutateVault}
        onClose={() => setInspectingDoc(null)}
        onEdit={(doc) => {
          setEditingDoc(doc);
          setDocModalOpen(true);
        }}
        onDelete={(doc) =>
          setDeleteTarget({
            collection: 'documents',
            id: doc.id,
            title: doc.title,
            description: 'Permanently delete this encrypted record from the Document Vault?',
          })
        }
        onDownload={(doc) => void handleDownloadDocument(doc)}
      />

      <PersonalNoteModal
        isOpen={noteModalOpen}
        initialData={editingNote}
        templates={templates}
        onClose={() => {
          setNoteModalOpen(false);
          setEditingNote(null);
        }}
        onSave={handleSavePersonalList}
      />

      <ChecklistTemplatesModal
        isOpen={templatesModalOpen}
        domainFilter={templatesModalDomain}
        templates={templates}
        onClose={() => setTemplatesModalOpen(false)}
        onUseTemplate={(tpl) => void handleUseChecklistTemplate(tpl)}
        onSaveTemplate={handleSaveCustomTemplate}
        onDeleteTemplate={handleDeleteCustomTemplate}
      />

      <ImportantContactModal
        isOpen={contactModalOpen}
        initialData={editingContact}
        onClose={() => {
          setContactModalOpen(false);
          setEditingContact(null);
        }}
        onSave={handleSaveContact}
      />

      <TravelPlanModal
        isOpen={tripModalOpen}
        initialData={editingTrip}
        onClose={() => {
          setTripModalOpen(false);
          setEditingTrip(null);
        }}
        onSave={handleSaveTrip}
      />

      <TravelDetailDrawer
        trip={inspectingTrip}
        templates={templates}
        canMutate={canMutateShared}
        onClose={() => setInspectingTrip(null)}
        onUpdateTrip={handleSaveTrip}
        onEditTrip={(tr) => {
          setEditingTrip(tr);
          setTripModalOpen(true);
        }}
        onDeleteTrip={(tr) =>
          setDeleteTarget({
            collection: 'trips',
            id: tr.id,
            title: tr.destination,
            description: 'Delete this travel plan and its packing checklist?',
          })
        }
      />

      <VehicleModal
        isOpen={vehicleModalOpen}
        initialData={editingVehicle}
        onClose={() => {
          setVehicleModalOpen(false);
          setEditingVehicle(null);
        }}
        onSave={handleSaveVehicle}
      />

      <VehicleServiceDrawer
        vehicle={inspectingVehicle}
        canMutate={canMutateShared}
        onClose={() => setInspectingVehicle(null)}
        onUpdateVehicle={handleSaveVehicle}
        onEditVehicle={(v) => {
          setEditingVehicle(v);
          setVehicleModalOpen(true);
        }}
        onDeleteVehicle={(v) =>
          setDeleteTarget({
            collection: 'vehicles',
            id: v.id,
            title: v.name,
            description: 'Remove this vehicle profile and its maintenance history?',
          })
        }
      />

      <LongTermPlanModal
        isOpen={ltModalOpen}
        initialData={editingLtPlan}
        onClose={() => {
          setLtModalOpen(false);
          setEditingLtPlan(null);
        }}
        onSave={handleSaveLongTermPlan}
      />

      <LongTermPlanDrawer
        plan={inspectingLtPlan}
        canMutate={canMutateShared}
        onClose={() => setInspectingLtPlan(null)}
        onUpdatePlan={handleSaveLongTermPlan}
        onEditPlan={(lt) => {
          setEditingLtPlan(lt);
          setLtModalOpen(true);
        }}
        onDeletePlan={(lt) =>
          setDeleteTarget({
            collection: 'longTermPlans',
            id: lt.id,
            title: lt.title,
            description: 'Remove this long-term family roadmap?',
          })
        }
      />

      <DeleteConfirmModal
        isOpen={Boolean(deleteTarget)}
        title={`Delete "${deleteTarget?.title || 'Record'}"`}
        description={deleteTarget?.description || 'Are you sure you want to delete this record?'}
        isDeleting={isDeleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
};
