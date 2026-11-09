import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Upload,
  FileText,
  Lock,
  Shield,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Car,
  Plane,
  Compass,
  Phone,
  Sparkles,
  Download,
  Paperclip,
  Calendar,
  Wrench,
  Edit3,
} from 'lucide-react';

// ============================================================================
// SHARED TYPES FOR LIFE MANAGEMENT (THE PERSONAL & ADMINISTRATIVE CENTER)
// ============================================================================

export interface LifeAttachment {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
  uploadedAt: string;
}

export interface PersonalAdminTask {
  id: string;
  title: string;
  category:
    | 'Document Renewal'
    | 'Vehicle & Insurance'
    | 'Travel Prep'
    | 'Tax & Legal'
    | 'Personal Admin'
    | string;
  dueDate: string;
  priority: 'High' | 'Medium' | 'Low';
  completed: boolean;
  notes?: string;
  isPrivate?: boolean;
  scope?: 'PRIVATE' | 'FAMILY';
  ownerUserId?: string;
  ownerMemberId?: string;
  version?: number;
}

export interface DocumentRecord {
  id: string;
  title: string;
  category:
    | 'Identification'
    | 'Insurance'
    | 'Property & Home'
    | 'Medical'
    | 'Financial & Tax'
    | 'Education & Certificates'
    | 'Contracts & Warranties';
  expirationDate: string;
  renewalReminder: string;
  accessLevel: 'Owner & Admin Only' | 'Adult Members' | 'All Household';
  tags?: string[];
  issuer?: string;
  referenceNumber?: string;
  notes?: string;
  fileName?: string;
  mimeType?: string;
  fileSizeKb?: number;
  sha256Checksum?: string;
  encryptedAtRest?: boolean;
  contentBase64?: string;
  attachments?: LifeAttachment[];
  ownerUserId?: string;
  ownerMemberId?: string;
  version?: number;
}

export interface PersonalNoteItem {
  id: string;
  text: string;
  done: boolean;
}

export interface PersonalList {
  id: string;
  title: string;
  type: 'Checklist' | 'Note' | 'Admin Template';
  category?: string;
  content: string;
  items: PersonalNoteItem[];
  isPrivate?: boolean;
  scope?: 'PRIVATE' | 'FAMILY';
  ownerUserId?: string;
  ownerMemberId?: string;
  updatedAt?: string;
  version?: number;
}

export interface LifeChecklistTemplate {
  id: string;
  title: string;
  domain: 'Personal Admin' | 'Travel & Packing';
  description: string;
  items: string[];
  version?: number;
}

export interface ImportantContact {
  id: string;
  name: string;
  category:
    | 'Emergency & Medical'
    | 'Legal & Financial'
    | 'Insurance & Policy'
    | 'Home & Utilities'
    | 'Schools & Childcare'
    | 'Service Contractors'
    | string;
  role: string;
  phone: string;
  email?: string;
  accountOrPolicyNumber?: string;
  address?: string;
  isEmergencyPriority?: boolean;
  notes: string;
  version?: number;
}

export interface TravelItineraryItem {
  id: string;
  dayOrDate: string;
  activity: string;
  bookingRef?: string;
}

export interface TravelPackingItem {
  id: string;
  item: string;
  category?: string;
  packed: boolean;
}

export interface TravelPlan {
  id: string;
  destination: string;
  dates: string;
  status?: 'Upcoming' | 'Planning' | 'Completed';
  budgetCents: number;
  spentCents: number;
  accommodation: string;
  bookingReference?: string;
  transportationNotes?: string;
  activities: string[];
  itineraryItems?: TravelItineraryItem[];
  packingList: TravelPackingItem[];
  attachments?: LifeAttachment[];
  notes?: string;
  version?: number;
}

export interface VehicleServiceEntry {
  id: string;
  date: string;
  serviceType: string;
  mileage: string;
  provider: string;
  costCents: number;
  notes?: string;
}

export interface VehicleProfile {
  id: string;
  name: string;
  vinOrPlate?: string;
  registration: string;
  registrationExpiryDate?: string;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  insuranceRenewal: string;
  inspectionDate: string;
  nextMaintenance: string;
  serviceInterval?: string;
  currentMileage?: string;
  serviceHistory: string;
  maintenanceLogs?: VehicleServiceEntry[];
  monthlyFuelCents: number;
  attachments?: LifeAttachment[];
  version?: number;
}

export interface LongTermMilestone {
  id: string;
  title: string;
  targetYear?: string;
  completed: boolean;
}

export interface LongTermPlan {
  id: string;
  title: string;
  category:
    | 'Estate & Legal'
    | 'Education & Trust'
    | 'Real Estate & Capital'
    | 'Retirement & Stewardship'
    | 'Multi-Year Family Roadmap'
    | string;
  horizon?: string;
  targetDate: string;
  estimatedBudgetCents: number;
  milestones: string[];
  structuredMilestones?: LongTermMilestone[];
  progressPercent: number;
  advisorOrCustodian?: string;
  reviewCadence?: string;
  notes?: string;
  attachments?: LifeAttachment[];
  version?: number;
}

// ============================================================================
// DEFAULT REUSABLE TEMPLATES
// ============================================================================

export const DEFAULT_LIFE_TEMPLATES: LifeChecklistTemplate[] = [
  {
    id: 'tpl-admin-tax',
    title: 'Annual Tax & Insurance Audit Prep',
    domain: 'Personal Admin',
    description: 'Step-by-step document gathering for annual tax filing and household policy review.',
    items: [
      'Download W-2, 1099, and brokerage tax statements',
      'Compile HSA/FSA medical receipts and charitable donation acknowledgments',
      'Review homeowner & umbrella liability coverage limits',
      'Verify beneficiary designations on retirement and life policies',
      'Upload signed tax return copy to Document Vault',
    ],
  },
  {
    id: 'tpl-admin-id-renewal',
    title: 'Passport & Government ID Renewal Protocol',
    domain: 'Personal Admin',
    description: 'Administrative checklist for renewing adult or minor passports and Real IDs.',
    items: [
      'Verify current passport expiration is >6 months before upcoming travel',
      'Capture compliant digital passport photos',
      'Complete DS-82 / DS-11 renewal application form',
      'Schedule in-person appointment (if minor renewal requires both parents)',
      'Update Document Vault with new passport number and expiration date',
    ],
  },
  {
    id: 'tpl-admin-security',
    title: 'Quarterly Digital Security & Vault Hygiene',
    domain: 'Personal Admin',
    description: 'Routine personal audit of emergency recovery codes, passwords, and encrypted records.',
    items: [
      'Rotate master password manager key and verify 2FA hardware keys',
      'Check credit freeze status across Equifax, Experian, and TransUnion',
      'Verify offline emergency contact sheet is up to date',
      'Archive expired insurance cards and upload current policy declarations',
    ],
  },
  {
    id: 'tpl-travel-family',
    title: 'Family Holiday & Domestic Trip Packing',
    domain: 'Travel & Packing',
    description: 'Comprehensive pre-departure & packing list for multi-day family travel.',
    items: [
      ' Government IDs, insurance cards, and printed boarding/hotel confirmations',
      'First-aid kit, prescription medications, and pediatric essentials',
      'Universal chargers, power banks, and travel adapters',
      'Weather-appropriate footwear, outerwear, and activity gear',
      'Set home thermostat to Eco, lock windows, and pause package deliveries',
    ],
  },
  {
    id: 'tpl-travel-international',
    title: 'International Travel & Document Readiness',
    domain: 'Travel & Packing',
    description: 'High-trust administrative prep for international departures.',
    items: [
      'Passports valid for 6+ months beyond return date',
      'Entry visas / ETIAS / electronic travel authorizations confirmed',
      'Travel medical insurance policy & international emergency numbers saved',
      'Notify primary credit/debit card issuers of international dates',
      'Download offline maps and store encrypted passport copies in Vault',
    ],
  },
];

// ============================================================================
// UTILITY HELPERS
// ============================================================================

export function formatCents(cents: number): string {
  const safe = Number.isFinite(cents) ? cents : 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe / 100);
}

export function parseDollarsToCents(dollarsStr: string): number {
  const cleaned = String(dollarsStr || '').replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

async function readFilesAsAttachments(fileList: FileList | null): Promise<LifeAttachment[]> {
  if (!fileList || fileList.length === 0) return [];
  const results: LifeAttachment[] = [];
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    if (file.size > 1800 * 1024) {
      throw new Error(`File "${file.name}" exceeds the 1.8MB attachment limit.`);
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error(`Failed to read file "${file.name}".`));
      reader.readAsDataURL(file);
    });
    results.push({
      id: `att-${Date.now()}-${i}`,
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      dataUrl,
      uploadedAt: new Date().toISOString().slice(0, 10),
    });
  }
  return results;
}

// ============================================================================
// 1. DELETE CONFIRMATION MODAL
// ============================================================================

export const DeleteConfirmModal: React.FC<{
  isOpen: boolean;
  title: string;
  description: string;
  isDeleting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ isOpen, title, description, isDeleting, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl border border-stone-200 max-w-md w-full p-6 shadow-xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="font-serif font-bold text-lg text-stone-900">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-stone-600 leading-relaxed">{description}</p>
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            {isDeleting ? 'Removing...' : 'Confirm Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 2. PERSONAL ADMIN TASK / REMINDER MODAL
// ============================================================================

export const PersonalTaskModal: React.FC<{
  isOpen: boolean;
  initialData?: PersonalAdminTask | null;
  onClose: () => void;
  onSave: (record: Omit<PersonalAdminTask, 'id'> & { id?: string }) => Promise<void>;
}> = ({ isOpen, initialData, onClose, onSave }) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('Personal Admin');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [isPrivate, setIsPrivate] = useState(true);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setCategory(initialData.category || 'Personal Admin');
      setDueDate(initialData.dueDate || new Date().toISOString().slice(0, 10));
      setPriority(initialData.priority || 'Medium');
      setIsPrivate(initialData.isPrivate !== false && initialData.scope !== 'FAMILY');
      setNotes(initialData.notes || '');
    } else {
      setTitle('');
      setCategory('Personal Admin');
      setDueDate(new Date().toISOString().slice(0, 10));
      setPriority('Medium');
      setIsPrivate(true);
      setNotes('');
    }
    setError(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please enter a title for this administrative action.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        id: initialData?.id,
        title: title.trim(),
        category,
        dueDate: dueDate.trim() || 'Upcoming',
        priority,
        completed: initialData?.completed ?? false,
        notes: notes.trim(),
        isPrivate,
        scope: isPrivate ? 'PRIVATE' : 'FAMILY',
        version: initialData?.version,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save administrative action.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl border border-stone-200 max-w-lg w-full p-6 shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-stone-100">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              Personal Administration
            </span>
            <h3 className="font-serif font-bold text-lg text-stone-900">
              {initialData ? 'Edit Administrative Reminder' : 'New Administrative Action'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block font-semibold text-stone-700 mb-1">Action Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Renew passport before October trip, File quarterly estimated tax"
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-none focus:border-emerald-800"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white"
              >
                <option value="Personal Admin">Personal Admin</option>
                <option value="Document Renewal">Document Renewal</option>
                <option value="Vehicle & Insurance">Vehicle & Insurance</option>
                <option value="Tax & Legal">Tax & Legal</option>
                <option value="Travel Prep">Travel Prep</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Target Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-300 tabular-nums"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Urgency</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as 'High' | 'Medium' | 'Low')}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white"
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">Visibility & Access Scope</label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setIsPrivate(true)}
                className={`p-3 rounded-xl border text-left flex items-center gap-2.5 cursor-pointer ${
                  isPrivate
                    ? 'bg-emerald-50/70 border-emerald-800 text-emerald-950'
                    : 'bg-stone-50 border-stone-200 text-stone-600'
                }`}
              >
                <Lock className="w-4 h-4 shrink-0 text-emerald-800" />
                <div>
                  <div className="font-bold">Private (User-Scoped)</div>
                  <div className="text-[11px] text-stone-500">Visible only to your profile</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setIsPrivate(false)}
                className={`p-3 rounded-xl border text-left flex items-center gap-2.5 cursor-pointer ${
                  !isPrivate
                    ? 'bg-emerald-50/70 border-emerald-800 text-emerald-950'
                    : 'bg-stone-50 border-stone-200 text-stone-600'
                }`}
              >
                <Shield className="w-4 h-4 shrink-0 text-emerald-800" />
                <div>
                  <div className="font-bold">Shared Household</div>
                  <div className="text-[11px] text-stone-500">Visible to adult administrators</div>
                </div>
              </button>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">Administrative Notes (Optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reference numbers, portal instructions, or filing details..."
              className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-stone-200 text-stone-700 font-semibold hover:bg-stone-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white font-semibold cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Saving...' : initialData ? 'Save Changes' : 'Add Action'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 3. DOCUMENT VAULT MODAL & SLIDE-OVER DETAIL DRAWER
// ============================================================================

export const DocumentVaultModal: React.FC<{
  isOpen: boolean;
  initialData?: DocumentRecord | null;
  onClose: () => void;
  onSave: (
    docPayload: Omit<DocumentRecord, 'id'> & {
      id?: string;
      contentBase64?: string;
    }
  ) => Promise<void>;
}> = ({ isOpen, initialData, onClose, onSave }) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocumentRecord['category']>('Identification');
  const [expirationDate, setExpirationDate] = useState('');
  const [renewalReminder, setRenewalReminder] = useState('60 days prior');
  const [accessLevel, setAccessLevel] = useState<DocumentRecord['accessLevel']>('Owner & Admin Only');
  const [issuer, setIssuer] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [notes, setNotes] = useState('');
  const [fileName, setFileName] = useState('');
  const [mimeType, setMimeType] = useState('application/pdf');
  const [contentBase64, setContentBase64] = useState('');
  const [fileSizeKb, setFileSizeKb] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setCategory(initialData.category || 'Identification');
      setExpirationDate(
        initialData.expirationDate && initialData.expirationDate !== 'Permanent Record'
          ? initialData.expirationDate
          : ''
      );
      setRenewalReminder(initialData.renewalReminder || '60 days prior');
      setAccessLevel(initialData.accessLevel || 'Owner & Admin Only');
      setIssuer(initialData.issuer || '');
      setReferenceNumber(initialData.referenceNumber || '');
      setTagsInput((initialData.tags || []).join(', '));
      setNotes(initialData.notes || '');
      setFileName(initialData.fileName || '');
      setMimeType(initialData.mimeType || 'application/pdf');
      setContentBase64('');
      setFileSizeKb(initialData.fileSizeKb || 0);
    } else {
      setTitle('');
      setCategory('Identification');
      setExpirationDate('');
      setRenewalReminder('60 days prior');
      setAccessLevel('Owner & Admin Only');
      setIssuer('');
      setReferenceNumber('');
      setTagsInput('');
      setNotes('');
      setFileName('');
      setMimeType('application/pdf');
      setContentBase64('');
      setFileSizeKb(0);
    }
    setError(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1950 * 1024) {
      setError('Vault file size must be under 2.0 MB.');
      return;
    }
    setError(null);
    setFileName(file.name);
    setMimeType(file.type || 'application/pdf');
    setFileSizeKb(Math.max(1, Math.round(file.size / 1024)));
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] || '' : result;
      setContentBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Document title is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      await onSave({
        id: initialData?.id,
        title: title.trim(),
        category,
        expirationDate: expirationDate.trim() || 'Permanent Record',
        renewalReminder,
        accessLevel,
        issuer: issuer.trim(),
        referenceNumber: referenceNumber.trim(),
        tags,
        notes: notes.trim(),
        fileName: fileName || initialData?.fileName || `${title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}.pdf`,
        mimeType: mimeType || initialData?.mimeType || 'application/pdf',
        fileSizeKb: fileSizeKb || initialData?.fileSizeKb || 12,
        contentBase64: contentBase64 || undefined,
        encryptedAtRest: true,
        version: initialData?.version,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Could not save vault document.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-stone-200 max-w-xl w-full p-6 shadow-xl my-8">
        <div className="flex items-center justify-between pb-4 border-b border-stone-100">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              AES-256 Encrypted Document Vault
            </span>
            <h3 className="font-serif font-bold text-lg text-stone-900">
              {initialData ? 'Update Vault Record & Permissions' : 'Upload Protected Document'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-stone-700 mb-1">Document Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., US Passport — Sarah Vance, Homeowner Policy Declaration"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as DocumentRecord['category'])}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white"
              >
                <option value="Identification">Identification</option>
                <option value="Insurance">Insurance</option>
                <option value="Property & Home">Property & Home</option>
                <option value="Medical">Medical</option>
                <option value="Financial & Tax">Financial & Tax</option>
                <option value="Education & Certificates">Education & Certificates</option>
                <option value="Contracts & Warranties">Contracts & Warranties</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Expiration Date <span className="text-stone-400 font-normal">(Blank if permanent)</span>
              </label>
              <input
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-300 tabular-nums"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Renewal Alert Lead Time</label>
              <select
                value={renewalReminder}
                onChange={(e) => setRenewalReminder(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white"
              >
                <option value="180 days prior">180 days prior</option>
                <option value="90 days prior">90 days prior</option>
                <option value="60 days prior">60 days prior</option>
                <option value="30 days prior">30 days prior</option>
                <option value="None">No alert needed</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">RBAC Access Policy</label>
              <select
                value={accessLevel}
                onChange={(e) => setAccessLevel(e.target.value as DocumentRecord['accessLevel'])}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white font-semibold text-stone-800"
              >
                <option value="Owner & Admin Only">Owner & Admin Only</option>
                <option value="Adult Members">Adult Members</option>
                <option value="All Household">All Household</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Issuing Authority / Institution</label>
              <input
                type="text"
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                placeholder="e.g., U.S. Dept of State, Chubb Insurance"
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
              />
            </div>
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Policy / Document Reference #</label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="e.g., POL-88412-B or Last 4 digits"
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Tags <span className="text-stone-400 font-normal">(Comma-separated)</span>
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g., passport, travel,vital-record, tax-2026"
              className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
            />
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">Custody & Storage Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Physical original location (e.g., Fireproof Safe Drawer B), attorney contact, or renewal notes..."
              className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-emerald-800" />
                <span>Attach File / Photo for Encrypted Vault Storage (PDF, PNG, JPG, TXT)</span>
              </span>
              {fileName && (
                <span className="text-[11px] font-mono text-emerald-800">
                  {fileName} {fileSizeKb ? `(${fileSizeKb} KB)` : ''}
                </span>
              )}
            </div>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.txt"
              onChange={handleFileChange}
              className="text-xs text-stone-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-900 file:text-white file:text-xs file:font-semibold hover:file:bg-emerald-950 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-stone-200 text-stone-700 font-semibold hover:bg-stone-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white font-semibold cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Encrypting & Saving...' : initialData ? 'Save Document Changes' : 'Encrypt & Store in Vault'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const DocumentDetailDrawer: React.FC<{
  document: DocumentRecord | null;
  canMutate: boolean;
  onClose: () => void;
  onEdit: (doc: DocumentRecord) => void;
  onDelete: (doc: DocumentRecord) => void;
  onDownload: (doc: DocumentRecord) => void;
}> = ({ document, canMutate, onClose, onEdit, onDelete, onDownload }) => {
  if (!document) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-stone-950/40 backdrop-blur-xs">
      <div className="bg-white w-full max-w-md h-full shadow-2xl border-l border-stone-200 flex flex-col justify-between overflow-y-auto">
        <div className="p-6 space-y-5">
          <div className="flex items-start justify-between gap-3 pb-4 border-b border-stone-100">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                {document.category} · {document.accessLevel}
              </span>
              <h3 className="font-serif font-bold text-xl text-stone-900 mt-0.5">{document.title}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2.5 text-xs">
            <div className="flex justify-between py-1 border-b border-stone-200/60">
              <span className="text-stone-500">Expiration / Status</span>
              <span className="font-mono font-semibold text-stone-900 tabular-nums">{document.expirationDate}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-stone-200/60">
              <span className="text-stone-500">Renewal Lead Alert</span>
              <span className="font-medium text-stone-800">{document.renewalReminder}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-stone-200/60">
              <span className="text-stone-500">Access Policy</span>
              <span className="font-semibold text-emerald-900">{document.accessLevel}</span>
            </div>
            {document.issuer && (
              <div className="flex justify-between py-1 border-b border-stone-200/60">
                <span className="text-stone-500">Issuing Authority</span>
                <span className="font-medium text-stone-900">{document.issuer}</span>
              </div>
            )}
            {document.referenceNumber && (
              <div className="flex justify-between py-1 border-b border-stone-200/60">
                <span className="text-stone-500">Reference / Policy #</span>
                <span className="font-mono font-semibold text-stone-900">{document.referenceNumber}</span>
              </div>
            )}
            <div className="flex justify-between py-1">
              <span className="text-stone-500">Vault File</span>
              <span className="font-mono text-stone-800">
                {document.fileName || `${document.id}.pdf`} ({document.fileSizeKb || 12} KB)
              </span>
            </div>
          </div>

          {document.tags && document.tags.length > 0 && (
            <div className="text-xs">
              <span className="text-stone-500 block mb-1 font-semibold">Classification Tags</span>
              <p className="text-stone-700 font-medium">{document.tags.join(' · ')}</p>
            </div>
          )}

          {document.notes && (
            <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 text-xs space-y-1">
              <span className="font-bold text-stone-900 block">Custody & Administrative Notes</span>
              <p className="text-stone-600 leading-relaxed">{document.notes}</p>
            </div>
          )}

          <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-emerald-950">
              <Lock className="w-3.5 h-3.5 text-emerald-800" />
              <span>AES-256-GCM Encrypted Vault Record</span>
            </div>
            <p className="text-[11px] text-emerald-900/80">
              {document.sha256Checksum
                ? `SHA-256 Verified: ${document.sha256Checksum.slice(0, 20)}...`
                : 'Integrity verified on authenticated download.'}
            </p>
          </div>
        </div>

        <div className="p-5 border-t border-stone-200 bg-stone-50 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onDownload(document)}
            className="px-4 py-2 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Decrypt & Download</span>
          </button>

          {canMutate && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(document);
                }}
                className="px-3.5 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 text-xs font-semibold text-stone-800 cursor-pointer"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDelete(document);
                }}
                className="px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-xs font-semibold text-rose-700 cursor-pointer"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 4. PERSONAL NOTES & CHECKLISTS MODAL + TEMPLATE LIBRARY MODAL
// ============================================================================

export const PersonalNoteModal: React.FC<{
  isOpen: boolean;
  initialData?: PersonalList | null;
  templates: LifeChecklistTemplate[];
  onClose: () => void;
  onSave: (list: Omit<PersonalList, 'id'> & { id?: string }) => Promise<void>;
}> = ({ isOpen, initialData, templates, onClose, onSave }) => {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<PersonalList['type']>('Checklist');
  const [category, setCategory] = useState('Personal Admin');
  const [content, setContent] = useState('');
  const [items, setItems] = useState<PersonalNoteItem[]>([]);
  const [newItemText, setNewItemText] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setType(initialData.type || 'Checklist');
      setCategory(initialData.category || 'Personal Admin');
      setContent(initialData.content || '');
      setItems(initialData.items || []);
      setIsPrivate(initialData.isPrivate !== false && initialData.scope !== 'FAMILY');
    } else {
      setTitle('');
      setType('Checklist');
      setCategory('Personal Admin');
      setContent('');
      setItems([]);
      setIsPrivate(true);
    }
    setNewItemText('');
    setError(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const adminTemplates = templates.filter((t) => t.domain === 'Personal Admin');

  const handleApplyTemplate = (tpl: LifeChecklistTemplate) => {
    if (!title.trim()) setTitle(tpl.title);
    setType('Checklist');
    if (!content.trim()) setContent(tpl.description);
    const appended: PersonalNoteItem[] = tpl.items.map((text, idx) => ({
      id: `pli-${Date.now()}-${idx}`,
      text,
      done: false,
    }));
    setItems((prev) => [...prev, ...appended]);
  };

  const handleAddItem = () => {
    if (!newItemText.trim()) return;
    setItems((prev) => [
      ...prev,
      { id: `pli-${Date.now()}-${prev.length}`, text: newItemText.trim(), done: false },
    ]);
    setNewItemText('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please enter a title for this note or checklist.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        id: initialData?.id,
        title: title.trim(),
        type,
        category,
        content: content.trim(),
        items,
        isPrivate,
        scope: isPrivate ? 'PRIVATE' : 'FAMILY',
        updatedAt: new Date().toISOString().slice(0, 10),
        version: initialData?.version,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save personal note.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-stone-200 max-w-xl w-full p-6 shadow-xl my-8">
        <div className="flex items-center justify-between pb-4 border-b border-stone-100">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              Personal Notes & Checklists
            </span>
            <h3 className="font-serif font-bold text-lg text-stone-900">
              {initialData ? 'Edit Note or Checklist' : 'New Personal Note / Checklist'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-stone-700 mb-1">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Annual Tax Prep Checklist, Private Reference Notes"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300"
              />
            </div>
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Format</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as PersonalList['type'])}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white"
              >
                <option value="Checklist">Interactive Checklist</option>
                <option value="Note">Structured Note</option>
                <option value="Admin Template">Admin Protocol</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white"
              >
                <option value="Personal Admin">Personal Admin</option>
                <option value="Tax & Financial">Tax & Financial</option>
                <option value="Legal & Estate">Legal & Estate</option>
                <option value="Digital Security">Digital Security</option>
                <option value="Renewal Protocol">Renewal Protocol</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Privacy Scope</label>
              <select
                value={isPrivate ? 'PRIVATE' : 'FAMILY'}
                onChange={(e) => setIsPrivate(e.target.value === 'PRIVATE')}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white font-semibold"
              >
                <option value="PRIVATE">Private (Only Me)</option>
                <option value="FAMILY">Shared Household Admin</option>
              </select>
            </div>
          </div>

          {adminTemplates.length > 0 && (
            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
              <span className="font-semibold text-stone-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-800" />
                <span>Quick-Load Administrative Checklist Template:</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {adminTemplates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleApplyTemplate(tpl)}
                    className="px-2.5 py-1.5 rounded-lg bg-white border border-stone-200 hover:border-emerald-700 text-stone-800 font-medium cursor-pointer"
                  >
                    + {tpl.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block font-semibold text-stone-700 mb-1">Summary / Reference Notes</label>
            <textarea
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write private administrative notes, instructions, or context..."
              className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
            />
          </div>

          <div className="space-y-2">
            <label className="block font-semibold text-stone-700">
              Checklist Steps ({items.filter((i) => i.done).length}/{items.length} completed)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddItem();
                  }
                }}
                placeholder="Add step-by-step checklist item..."
                className="flex-1 px-3 py-2 rounded-xl border border-stone-300"
              />
              <button
                type="button"
                onClick={handleAddItem}
                className="px-3.5 py-2 rounded-xl bg-stone-900 text-white font-semibold cursor-pointer"
              >
                + Add Step
              </button>
            </div>

            {items.length > 0 && (
              <div className="max-h-44 overflow-y-auto space-y-1.5 pt-1">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-stone-50 border border-stone-200"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setItems((prev) =>
                          prev.map((p) => (p.id === item.id ? { ...p, done: !p.done } : p))
                        )
                      }
                      className="flex items-center gap-2 text-left flex-1 cursor-pointer"
                    >
                      {item.done ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-stone-400 shrink-0" />
                      )}
                      <span className={item.done ? 'line-through text-stone-400' : 'text-stone-800'}>
                        {item.text}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setItems((prev) => prev.filter((p) => p.id !== item.id))}
                      className="text-stone-400 hover:text-rose-600 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-stone-200 text-stone-700 font-semibold hover:bg-stone-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white font-semibold cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Saving...' : initialData ? 'Save Changes' : 'Create Note / Checklist'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 5. REUSABLE CHECKLIST TEMPLATE MANAGER MODAL
// ============================================================================

export const ChecklistTemplatesModal: React.FC<{
  isOpen: boolean;
  domainFilter?: 'Personal Admin' | 'Travel & Packing';
  templates: LifeChecklistTemplate[];
  onClose: () => void;
  onUseTemplate: (tpl: LifeChecklistTemplate) => void;
  onSaveTemplate: (tpl: Omit<LifeChecklistTemplate, 'id'> & { id?: string }) => Promise<void>;
  onDeleteTemplate?: (tplId: string) => Promise<void>;
}> = ({
  isOpen,
  domainFilter,
  templates,
  onClose,
  onUseTemplate,
  onSaveTemplate,
  onDeleteTemplate,
}) => {
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [domain, setDomain] = useState<'Personal Admin' | 'Travel & Packing'>(
    domainFilter || 'Personal Admin'
  );
  const [description, setDescription] = useState('');
  const [stepsText, setStepsText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (domainFilter) setDomain(domainFilter);
  }, [domainFilter]);

  if (!isOpen) return null;

  const filtered = domainFilter ? templates.filter((t) => t.domain === domainFilter) : templates;

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const items = stepsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (items.length === 0) return;
    setSaving(true);
    try {
      await onSaveTemplate({
        title: title.trim(),
        domain,
        description: description.trim() || 'Reusable checklist template',
        items,
      });
      setTitle('');
      setDescription('');
      setStepsText('');
      setCreating(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-stone-200 max-w-2xl w-full p-6 shadow-xl my-8 space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-stone-100">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              Reusable Checklist Library
            </span>
            <h3 className="font-serif font-bold text-lg text-stone-900">
              {domainFilter ? `${domainFilter} Templates` : 'Administrative & Travel Checklist Templates'}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCreating((v) => !v)}
              className="px-3 py-1.5 rounded-xl bg-stone-900 text-white text-xs font-semibold cursor-pointer"
            >
              {creating ? 'View Library' : '+ New Template'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {creating ? (
          <form onSubmit={handleCreateTemplate} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block font-semibold text-stone-700 mb-1">Template Name *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Moving / Address Change Protocol"
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Domain</label>
                <select
                  value={domain}
                  onChange={(e) => setDomain(e.target.value as 'Personal Admin' | 'Travel & Packing')}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white"
                >
                  <option value="Personal Admin">Personal Admin</option>
                  <option value="Travel & Packing">Travel & Packing</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Brief Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="When to use this template..."
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
              />
            </div>
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Checklist Items (One per line) *
              </label>
              <textarea
                rows={5}
                value={stepsText}
                onChange={(e) => setStepsText(e.target.value)}
                placeholder={'Update USPS mail forwarding\nNotify bank & insurance carriers\nUpdate driver license address'}
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="px-4 py-2 rounded-xl border border-stone-200 text-stone-700 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-[#173D35] text-white font-semibold cursor-pointer"
              >
                {saving ? 'Saving...' : 'Save Reusable Template'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {filtered.map((tpl) => {
              const isCustom = !tpl.id.startsWith('tpl-');
              return (
                <div
                  key={tpl.id}
                  className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[11px] font-semibold text-emerald-800">
                        {tpl.domain} · {tpl.items.length} steps
                      </span>
                      <h4 className="font-serif font-bold text-base text-stone-900">{tpl.title}</h4>
                      <p className="text-xs text-stone-500 mt-0.5">{tpl.description}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          onUseTemplate(tpl);
                          onClose();
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white text-xs font-semibold cursor-pointer"
                      >
                        Apply Template
                      </button>
                      {isCustom && onDeleteTemplate && (
                        <button
                          type="button"
                          onClick={() => void onDeleteTemplate(tpl.id)}
                          className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 cursor-pointer"
                          title="Delete custom template"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-stone-600 pt-2 border-t border-stone-200/70">
                    {tpl.items.map((step, i) => (
                      <li key={i} className="truncate">
                        • {step}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 6. IMPORTANT CONTACTS MODAL (EMERGENCY, MEDICAL, LEGAL, UTILITIES, SERVICE)
// ============================================================================

export const ImportantContactModal: React.FC<{
  isOpen: boolean;
  initialData?: ImportantContact | null;
  onClose: () => void;
  onSave: (contact: Omit<ImportantContact, 'id'> & { id?: string }) => Promise<void>;
}> = ({ isOpen, initialData, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>('Emergency & Medical');
  const [role, setRole] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [accountOrPolicyNumber, setAccountOrPolicyNumber] = useState('');
  const [address, setAddress] = useState('');
  const [isEmergencyPriority, setIsEmergencyPriority] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setCategory(initialData.category || 'Emergency & Medical');
      setRole(initialData.role || '');
      setPhone(initialData.phone || '');
      setEmail(initialData.email || '');
      setAccountOrPolicyNumber(initialData.accountOrPolicyNumber || '');
      setAddress(initialData.address || '');
      setIsEmergencyPriority(Boolean(initialData.isEmergencyPriority));
      setNotes(initialData.notes || '');
    } else {
      setName('');
      setCategory('Emergency & Medical');
      setRole('');
      setPhone('');
      setEmail('');
      setAccountOrPolicyNumber('');
      setAddress('');
      setIsEmergencyPriority(false);
      setNotes('');
    }
    setError(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setError('Provider/Contact name and phone number are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        id: initialData?.id,
        name: name.trim(),
        category,
        role: role.trim() || category,
        phone: phone.trim(),
        email: email.trim(),
        accountOrPolicyNumber: accountOrPolicyNumber.trim(),
        address: address.trim(),
        isEmergencyPriority,
        notes: notes.trim(),
        version: initialData?.version,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save contact.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-stone-200 max-w-xl w-full p-6 shadow-xl my-8">
        <div className="flex items-center justify-between pb-4 border-b border-stone-100">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              Administrative & Emergency Directory
            </span>
            <h3 className="font-serif font-bold text-lg text-stone-900">
              {initialData ? 'Edit Provider / Emergency Contact' : 'Add Administrative or Emergency Contact'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-stone-700 mb-1">
                Institution / Provider / Contact Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Dr. Elena Rostova (Pediatrics), Chubb Claims Desk"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Directory Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white"
              >
                <option value="Emergency & Medical">Emergency & Medical</option>
                <option value="Legal & Financial">Legal & Financial</option>
                <option value="Insurance & Policy">Insurance & Policy</option>
                <option value="Home & Utilities">Home & Utilities</option>
                <option value="Schools & Childcare">Schools & Childcare</option>
                <option value="Service Contractors">Service Contractors</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Role / Specialty</label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g., Family Physician, Estate Counsel"
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Phone / 24h Dispatch *</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 234-5678"
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300 font-mono tabular-nums"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Policy / Account #</label>
              <input
                type="text"
                value={accountOrPolicyNumber}
                onChange={(e) => setAccountOrPolicyNumber(e.target.value)}
                placeholder="e.g., GRP-44019-A"
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Email / Portal Contact</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="dispatch@provider.org"
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Service Address / Clinic Location</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="450 Medical Plaza, Suite 300"
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-50/70 border border-amber-200 cursor-pointer">
            <input
              type="checkbox"
              checked={isEmergencyPriority}
              onChange={(e) => setIsEmergencyPriority(e.target.checked)}
              className="rounded border-amber-400 text-emerald-800"
            />
            <div>
              <span className="font-bold text-amber-950 block">Pin as Priority Emergency Contact</span>
              <span className="text-[11px] text-amber-900/80">
                Surfaces at the top of the directory and Personal Dashboard emergency quick-reference.
              </span>
            </div>
          </label>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              After-Hours Protocol & Instructions
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="On-call extension, gate code, water shutoff instructions, or claim filing notes..."
              className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-stone-200 text-stone-700 font-semibold hover:bg-stone-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white font-semibold cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Saving...' : initialData ? 'Save Contact' : 'Add to Directory'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 7. TRAVEL & HOLIDAY PLANNING MODAL + SLIDE-OVER DRAWER
// ============================================================================

export const TravelPlanModal: React.FC<{
  isOpen: boolean;
  initialData?: TravelPlan | null;
  onClose: () => void;
  onSave: (trip: Omit<TravelPlan, 'id'> & { id?: string }) => Promise<void>;
}> = ({ isOpen, initialData, onClose, onSave }) => {
  const [destination, setDestination] = useState('');
  const [dates, setDates] = useState('');
  const [status, setStatus] = useState<'Upcoming' | 'Planning' | 'Completed'>('Upcoming');
  const [accommodation, setAccommodation] = useState('');
  const [bookingReference, setBookingReference] = useState('');
  const [transportationNotes, setTransportationNotes] = useState('');
  const [budgetDollars, setBudgetDollars] = useState('3500.00');
  const [spentDollars, setSpentDollars] = useState('0.00');
  const [activitiesText, setActivitiesText] = useState('');
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState<LifeAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
      setDestination(initialData.destination || '');
      setDates(initialData.dates || '');
      setStatus(initialData.status || 'Upcoming');
      setAccommodation(initialData.accommodation || '');
      setBookingReference(initialData.bookingReference || '');
      setTransportationNotes(initialData.transportationNotes || '');
      setBudgetDollars(((initialData.budgetCents || 0) / 100).toFixed(2));
      setSpentDollars(((initialData.spentCents || 0) / 100).toFixed(2));
      setActivitiesText((initialData.activities || []).join('\n'));
      setNotes(initialData.notes || '');
      setAttachments(initialData.attachments || []);
    } else {
      setDestination('');
      setDates('');
      setStatus('Upcoming');
      setAccommodation('');
      setBookingReference('');
      setTransportationNotes('');
      setBudgetDollars('3500.00');
      setSpentDollars('0.00');
      setActivitiesText('Arrival & check-in\nFamily excursion & local dining');
      setNotes('');
      setAttachments([]);
    }
    setError(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const uploaded = await readFilesAsAttachments(e.target.files);
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (err: any) {
      setError(err?.message || 'Attachment upload failed.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination.trim()) {
      setError('Trip destination is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const activities = activitiesText
        .split('\n')
        .map((a) => a.trim())
        .filter(Boolean);
      const defaultPacking: TravelPackingItem[] = initialData?.packingList || [
        { id: `pk-${Date.now()}-1`, item: 'Passports / Government IDs & Boarding Passes', packed: false },
        { id: `pk-${Date.now()}-2`, item: 'Medications & Pediatric First-Aid Kit', packed: false },
        { id: `pk-${Date.now()}-3`, item: 'Chargers, Power Bank & Travel Adapters', packed: false },
      ];
      await onSave({
        id: initialData?.id,
        destination: destination.trim(),
        dates: dates.trim() || 'TBD Dates',
        status,
        accommodation: accommodation.trim() || 'Accommodation TBD',
        bookingReference: bookingReference.trim(),
        transportationNotes: transportationNotes.trim(),
        budgetCents: parseDollarsToCents(budgetDollars),
        spentCents: parseDollarsToCents(spentDollars),
        activities: activities.length > 0 ? activities : ['Arrival & check-in'],
        itineraryItems: initialData?.itineraryItems || [],
        packingList: defaultPacking,
        attachments,
        notes: notes.trim(),
        version: initialData?.version,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save travel plan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-stone-200 max-w-xl w-full p-6 shadow-xl my-8">
        <div className="flex items-center justify-between pb-4 border-b border-stone-100">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              Travel & Holiday Logistics
            </span>
            <h3 className="font-serif font-bold text-lg text-stone-900">
              {initialData ? 'Edit Trip Logistics & Budget' : 'Plan New Family Trip'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-stone-700 mb-1">Destination / Trip Title *</label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g., Lake Tahoe Summer Retreat, Kyoto Autumn Holiday"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'Upcoming' | 'Planning' | 'Completed')}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white"
              >
                <option value="Upcoming">Upcoming</option>
                <option value="Planning">In Planning</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Travel Dates</label>
              <input
                type="text"
                value={dates}
                onChange={(e) => setDates(e.target.value)}
                placeholder="Jul 14 – Jul 21, 2026"
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300 tabular-nums"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Total Budget ($)</label>
              <input
                type="text"
                value={budgetDollars}
                onChange={(e) => setBudgetDollars(e.target.value)}
                placeholder="4200.00"
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300 font-mono tabular-nums"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Committed / Spent ($)</label>
              <input
                type="text"
                value={spentDollars}
                onChange={(e) => setSpentDollars(e.target.value)}
                placeholder="1850.00"
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300 font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Accommodation / Lodging</label>
              <input
                type="text"
                value={accommodation}
                onChange={(e) => setAccommodation(e.target.value)}
                placeholder="e.g., Pinehaven Lodge #4B"
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Confirmation / PNR Reference</label>
              <input
                type="text"
                value={bookingReference}
                onChange={(e) => setBookingReference(e.target.value)}
                placeholder="e.g., PNR-99412X / Conf #8821"
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Itinerary Highlights (One per line)
            </label>
            <textarea
              rows={3}
              value={activitiesText}
              onChange={(e) => setActivitiesText(e.target.value)}
              placeholder={'Day 1: Arrival & cabin check-in\nDay 2: Emerald Bay trail hike\nDay 3: Kayak rental & lakeside dinner'}
              className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
            />
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Transportation & Booking Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Flight numbers, car rental desk, check-in lockbox code, or pet care arrangements..."
              className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
            />
          </div>

          <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-emerald-800" />
                <span>Attach Tickets, Confirmations, or Visas ({attachments.length})</span>
              </span>
            </div>
            <input
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.webp,.txt"
              onChange={handleFileUpload}
              className="text-xs text-stone-600 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-stone-800 file:text-white file:text-xs file:font-semibold cursor-pointer"
            />
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {attachments.map((att) => (
                  <span
                    key={att.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-[11px]"
                  >
                    <span className="truncate max-w-[160px]">{att.name}</span>
                    <button
                      type="button"
                      onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                      className="text-stone-400 hover:text-rose-600 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-stone-200 text-stone-700 font-semibold hover:bg-stone-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white font-semibold cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Saving...' : initialData ? 'Save Trip Changes' : 'Create Trip Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const TravelDetailDrawer: React.FC<{
  trip: TravelPlan | null;
  templates: LifeChecklistTemplate[];
  canMutate: boolean;
  onClose: () => void;
  onUpdateTrip: (updated: TravelPlan) => Promise<void>;
  onEditTrip: (trip: TravelPlan) => void;
  onDeleteTrip: (trip: TravelPlan) => void;
}> = ({ trip, templates, canMutate, onClose, onUpdateTrip, onEditTrip, onDeleteTrip }) => {
  const [newPackingText, setNewPackingText] = useState('');
  const [newActivityText, setNewActivityText] = useState('');

  if (!trip) return null;

  const travelTemplates = templates.filter((t) => t.domain === 'Travel & Packing');
  const packedCount = trip.packingList.filter((p) => p.packed).length;

  const handleTogglePacking = (itemId: string) => {
    if (!canMutate) return;
    const updated: TravelPlan = {
      ...trip,
      packingList: trip.packingList.map((p) => (p.id === itemId ? { ...p, packed: !p.packed } : p)),
    };
    void onUpdateTrip(updated);
  };

  const handleAddPacking = () => {
    if (!newPackingText.trim() || !canMutate) return;
    const updated: TravelPlan = {
      ...trip,
      packingList: [
        ...trip.packingList,
        { id: `pk-${Date.now()}`, item: newPackingText.trim(), packed: false },
      ],
    };
    setNewPackingText('');
    void onUpdateTrip(updated);
  };

  const handleApplyTravelTemplate = (tpl: LifeChecklistTemplate) => {
    if (!canMutate) return;
    const existingNames = new Set(trip.packingList.map((p) => p.item.toLowerCase()));
    const added = tpl.items
      .filter((t) => !existingNames.has(t.toLowerCase()))
      .map((item, idx) => ({
        id: `pk-${Date.now()}-${idx}`,
        item,
        packed: false,
      }));
    if (added.length === 0) return;
    void onUpdateTrip({
      ...trip,
      packingList: [...trip.packingList, ...added],
    });
  };

  const handleAddActivity = () => {
    if (!newActivityText.trim() || !canMutate) return;
    const updated: TravelPlan = {
      ...trip,
      activities: [...trip.activities, newActivityText.trim()],
    };
    setNewActivityText('');
    void onUpdateTrip(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-stone-950/40 backdrop-blur-xs">
      <div className="bg-white w-full max-w-lg h-full shadow-2xl border-l border-stone-200 flex flex-col justify-between overflow-y-auto">
        <div className="p-6 space-y-6">
          <div className="flex items-start justify-between gap-3 pb-4 border-b border-stone-100">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                {trip.status || 'Upcoming'} · {trip.dates}
              </span>
              <h3 className="font-serif font-bold text-2xl text-stone-900 mt-0.5">{trip.destination}</h3>
              <p className="text-xs text-stone-500 mt-0.5">
                {trip.accommodation}
                {trip.bookingReference ? ` · Ref: ${trip.bookingReference}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200">
              <span className="text-stone-500 block">Allocated Budget</span>
              <span className="font-mono font-bold text-base text-stone-900 tabular-nums">
                {formatCents(trip.budgetCents)}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200">
              <span className="text-emerald-900 block">Committed / Spent</span>
              <span className="font-mono font-bold text-base text-emerald-950 tabular-nums">
                {formatCents(trip.spentCents)}
              </span>
            </div>
          </div>

          {/* Itinerary Section */}
          <div className="space-y-2.5 text-xs">
            <span className="font-bold text-stone-900 block">Planned Itinerary & Activities</span>
            <div className="space-y-1.5">
              {trip.activities.map((act, idx) => (
                <div
                  key={idx}
                  className="px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between gap-2"
                >
                  <span className="text-stone-800 font-medium">• {act}</span>
                  {canMutate && (
                    <button
                      type="button"
                      onClick={() =>
                        void onUpdateTrip({
                          ...trip,
                          activities: trip.activities.filter((_, i) => i !== idx),
                        })
                      }
                      className="text-stone-400 hover:text-rose-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {canMutate && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newActivityText}
                  onChange={(e) => setNewActivityText(e.target.value)}
                  placeholder="Add itinerary item or reservation..."
                  className="flex-1 px-3 py-2 rounded-xl border border-stone-300"
                />
                <button
                  type="button"
                  onClick={handleAddActivity}
                  className="px-3.5 py-2 rounded-xl bg-stone-900 text-white font-semibold cursor-pointer"
                >
                  + Add
                </button>
              </div>
            )}
          </div>

          {/* Packing & Readiness Checklist */}
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-stone-900">
                Packing & Pre-Departure Checklist ({packedCount}/{trip.packingList.length})
              </span>
            </div>

            {canMutate && travelTemplates.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pb-1">
                {travelTemplates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleApplyTravelTemplate(tpl)}
                    className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-emerald-50 border border-stone-200 text-[11px] font-medium text-stone-700 cursor-pointer"
                  >
                    + Load {tpl.title}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              {trip.packingList.map((pk) => (
                <div
                  key={pk.id}
                  className={`px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                    pk.packed ? 'bg-emerald-50/50 border-emerald-200' : 'bg-stone-50 border-stone-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleTogglePacking(pk.id)}
                    className="flex items-center gap-2 text-left flex-1 cursor-pointer"
                  >
                    {pk.packed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-stone-400 shrink-0" />
                    )}
                    <span className={pk.packed ? 'line-through text-stone-400' : 'text-stone-800 font-medium'}>
                      {pk.item}
                    </span>
                  </button>
                  {canMutate && (
                    <button
                      type="button"
                      onClick={() =>
                        void onUpdateTrip({
                          ...trip,
                          packingList: trip.packingList.filter((item) => item.id !== pk.id),
                        })
                      }
                      className="text-stone-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {canMutate && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPackingText}
                  onChange={(e) => setNewPackingText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddPacking();
                    }
                  }}
                  placeholder="Add packing or pre-trip item..."
                  className="flex-1 px-3 py-2 rounded-xl border border-stone-300"
                />
                <button
                  type="button"
                  onClick={handleAddPacking}
                  className="px-3.5 py-2 rounded-xl bg-[#173D35] text-white font-semibold cursor-pointer"
                >
                  + Add
                </button>
              </div>
            )}
          </div>

          {trip.notes && (
            <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 text-xs space-y-1">
              <span className="font-bold text-stone-900 block">Logistics & Booking Notes</span>
              <p className="text-stone-600 leading-relaxed">{trip.notes}</p>
            </div>
          )}

          {trip.attachments && trip.attachments.length > 0 && (
            <div className="space-y-2 text-xs">
              <span className="font-bold text-stone-900 block">Attached Tickets & Confirmations</span>
              <div className="space-y-1.5">
                {trip.attachments.map((att) => (
                  <a
                    key={att.id}
                    href={att.dataUrl}
                    download={att.name}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 hover:border-emerald-700 text-stone-800"
                  >
                    <span className="font-medium truncate">{att.name}</span>
                    <Download className="w-3.5 h-3.5 text-emerald-800 shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {canMutate && (
          <div className="p-5 border-t border-stone-200 bg-stone-50 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                onClose();
                onEditTrip(trip);
              }}
              className="px-4 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 text-xs font-semibold text-stone-800 cursor-pointer"
            >
              Edit Trip Details
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onDeleteTrip(trip);
              }}
              className="px-4 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-xs font-semibold text-rose-700 cursor-pointer"
            >
              Delete Trip
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 8. VEHICLE MANAGEMENT MODAL + MAINTENANCE DRAWER
// ============================================================================

export const VehicleModal: React.FC<{
  isOpen: boolean;
  initialData?: VehicleProfile | null;
  onClose: () => void;
  onSave: (vehicle: Omit<VehicleProfile, 'id'> & { id?: string }) => Promise<void>;
}> = ({ isOpen, initialData, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [vinOrPlate, setVinOrPlate] = useState('');
  const [registration, setRegistration] = useState('');
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState('');
  const [insuranceRenewal, setInsuranceRenewal] = useState('');
  const [inspectionDate, setInspectionDate] = useState('');
  const [nextMaintenance, setNextMaintenance] = useState('');
  const [serviceInterval, setServiceInterval] = useState('Every 7,500 miles / 6 months');
  const [currentMileage, setCurrentMileage] = useState('');
  const [serviceHistory, setServiceHistory] = useState('');
  const [monthlyFuelDollars, setMonthlyFuelDollars] = useState('140.00');
  const [attachments, setAttachments] = useState<LifeAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setVinOrPlate(initialData.vinOrPlate || '');
      setRegistration(initialData.registration || '');
      setInsuranceProvider(initialData.insuranceProvider || '');
      setInsurancePolicyNumber(initialData.insurancePolicyNumber || '');
      setInsuranceRenewal(initialData.insuranceRenewal || '');
      setInspectionDate(initialData.inspectionDate || '');
      setNextMaintenance(initialData.nextMaintenance || '');
      setServiceInterval(initialData.serviceInterval || 'Every 7,500 miles / 6 months');
      setCurrentMileage(initialData.currentMileage || '');
      setServiceHistory(initialData.serviceHistory || '');
      setMonthlyFuelDollars(((initialData.monthlyFuelCents || 0) / 100).toFixed(2));
      setAttachments(initialData.attachments || []);
    } else {
      setName('');
      setVinOrPlate('');
      setRegistration('');
      setInsuranceProvider('');
      setInsurancePolicyNumber('');
      setInsuranceRenewal(new Date().toISOString().slice(0, 10));
      setInspectionDate(new Date().toISOString().slice(0, 10));
      setNextMaintenance('');
      setServiceInterval('Every 7,500 miles / 6 months');
      setCurrentMileage('');
      setServiceHistory('Up to date on scheduled factory maintenance.');
      setMonthlyFuelDollars('140.00');
      setAttachments([]);
    }
    setError(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const uploaded = await readFilesAsAttachments(e.target.files);
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (err: any) {
      setError(err?.message || 'Attachment upload failed.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Vehicle year, make, and model name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        id: initialData?.id,
        name: name.trim(),
        vinOrPlate: vinOrPlate.trim(),
        registration: registration.trim() || 'Active Registration',
        insuranceProvider: insuranceProvider.trim(),
        insurancePolicyNumber: insurancePolicyNumber.trim(),
        insuranceRenewal: insuranceRenewal.trim() || 'Annual',
        inspectionDate: inspectionDate.trim() || 'Current',
        nextMaintenance: nextMaintenance.trim() || 'Scheduled interval',
        serviceInterval: serviceInterval.trim(),
        currentMileage: currentMileage.trim(),
        serviceHistory: serviceHistory.trim() || 'No recent service notes.',
        maintenanceLogs: initialData?.maintenanceLogs || [],
        monthlyFuelCents: parseDollarsToCents(monthlyFuelDollars),
        attachments,
        version: initialData?.version,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save vehicle profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-stone-200 max-w-xl w-full p-6 shadow-xl my-8">
        <div className="flex items-center justify-between pb-4 border-b border-stone-100">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              Household Fleet & Compliance
            </span>
            <h3 className="font-serif font-bold text-lg text-stone-900">
              {initialData ? 'Edit Vehicle Profile' : 'Register Household Vehicle'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-stone-700 mb-1">
                Vehicle Year, Make & Model *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., 2024 Volvo XC90 Recharge"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">License Plate / VIN</label>
              <input
                type="text"
                value={vinOrPlate}
                onChange={(e) => setVinOrPlate(e.target.value)}
                placeholder="CA 8XWL492"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Registration Status & Expiry</label>
              <input
                type="text"
                value={registration}
                onChange={(e) => setRegistration(e.target.value)}
                placeholder="Valid thru Nov 2026"
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Insurance Renewal Date</label>
              <input
                type="date"
                value={insuranceRenewal}
                onChange={(e) => setInsuranceRenewal(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300 tabular-nums"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Inspection Due Date</label>
              <input
                type="date"
                value={inspectionDate}
                onChange={(e) => setInspectionDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300 tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Insurance Carrier & Policy #</label>
              <input
                type="text"
                value={insuranceProvider}
                onChange={(e) => setInsuranceProvider(e.target.value)}
                placeholder="e.g., Chubb Auto #A-9921"
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Current Odometer</label>
              <input
                type="text"
                value={currentMileage}
                onChange={(e) => setCurrentMileage(e.target.value)}
                placeholder="e.g., 18,450 mi"
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300 font-mono tabular-nums"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Est. Monthly Fuel/EV ($)</label>
              <input
                type="text"
                value={monthlyFuelDollars}
                onChange={(e) => setMonthlyFuelDollars(e.target.value)}
                placeholder="135.00"
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300 font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Next Scheduled Maintenance</label>
              <input
                type="text"
                value={nextMaintenance}
                onChange={(e) => setNextMaintenance(e.target.value)}
                placeholder="e.g., 20,000-mile service / Oct 2026"
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Service Interval Standard</label>
              <input
                type="text"
                value={serviceInterval}
                onChange={(e) => setServiceInterval(e.target.value)}
                placeholder="Every 7,500 miles / 6 months"
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">Latest Service Summary</label>
            <textarea
              rows={2}
              value={serviceHistory}
              onChange={(e) => setServiceHistory(e.target.value)}
              placeholder="Recent tire rotation, brake inspection, synthetic oil service..."
              className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
            />
          </div>

          <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
            <span className="font-semibold text-stone-800 flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5 text-emerald-800" />
              <span>Attach Registration, Insurance Card, or Service Receipts ({attachments.length})</span>
            </span>
            <input
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.webp,.txt"
              onChange={handleFileUpload}
              className="text-xs text-stone-600 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-stone-800 file:text-white file:text-xs file:font-semibold cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-stone-200 text-stone-700 font-semibold hover:bg-stone-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white font-semibold cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Saving...' : initialData ? 'Save Vehicle Changes' : 'Add Vehicle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const VehicleServiceDrawer: React.FC<{
  vehicle: VehicleProfile | null;
  canMutate: boolean;
  onClose: () => void;
  onUpdateVehicle: (updated: VehicleProfile) => Promise<void>;
  onEditVehicle: (vehicle: VehicleProfile) => void;
  onDeleteVehicle: (vehicle: VehicleProfile) => void;
}> = ({ vehicle, canMutate, onClose, onUpdateVehicle, onEditVehicle, onDeleteVehicle }) => {
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [serviceType, setServiceType] = useState('');
  const [mileage, setMileage] = useState('');
  const [provider, setProvider] = useState('');
  const [costDollars, setCostDollars] = useState('0.00');
  const [nextDueInput, setNextDueInput] = useState('');

  if (!vehicle) return null;

  const logs = vehicle.maintenanceLogs || [];

  const handleAddServiceEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceType.trim() || !canMutate) return;
    const entry: VehicleServiceEntry = {
      id: `vse-${Date.now()}`,
      date: serviceDate || new Date().toISOString().slice(0, 10),
      serviceType: serviceType.trim(),
      mileage: mileage.trim() || vehicle.currentMileage || 'Recorded',
      provider: provider.trim() || 'Authorized Service Center',
      costCents: parseDollarsToCents(costDollars),
    };
    const summaryLine = `${entry.serviceType} (${entry.date}${entry.mileage ? ` @ ${entry.mileage}` : ''})`;
    const updated: VehicleProfile = {
      ...vehicle,
      currentMileage: mileage.trim() || vehicle.currentMileage,
      nextMaintenance: nextDueInput.trim() || vehicle.nextMaintenance,
      serviceHistory: summaryLine,
      maintenanceLogs: [entry, ...logs],
    };
    setServiceType('');
    setCostDollars('0.00');
    setNextDueInput('');
    void onUpdateVehicle(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-stone-950/40 backdrop-blur-xs">
      <div className="bg-white w-full max-w-lg h-full shadow-2xl border-l border-stone-200 flex flex-col justify-between overflow-y-auto">
        <div className="p-6 space-y-6">
          <div className="flex items-start justify-between gap-3 pb-4 border-b border-stone-100">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                Vehicle Service & Compliance Log
              </span>
              <h3 className="font-serif font-bold text-xl text-stone-900 mt-0.5">{vehicle.name}</h3>
              <p className="text-xs text-stone-500 mt-0.5">
                {vehicle.registration}
                {vehicle.vinOrPlate ? ` · ${vehicle.vinOrPlate}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-stone-200/60">
              <span className="text-stone-500">Insurance Renewal</span>
              <span className="font-mono font-semibold text-stone-900 tabular-nums">{vehicle.insuranceRenewal}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-stone-200/60">
              <span className="text-stone-500">Inspection Date</span>
              <span className="font-mono text-stone-900 tabular-nums">{vehicle.inspectionDate}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-stone-200/60">
              <span className="text-stone-500">Next Scheduled Service</span>
              <span className="font-semibold text-amber-900">{vehicle.nextMaintenance}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-stone-500">Monthly Energy / Fuel Estimate</span>
              <span className="font-mono font-semibold text-emerald-900 tabular-nums">
                {formatCents(vehicle.monthlyFuelCents)}/mo
              </span>
            </div>
          </div>

          {canMutate && (
            <form
              onSubmit={handleAddServiceEntry}
              className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3 text-xs"
            >
              <span className="font-bold text-stone-900 flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-emerald-800" />
                <span>Log Completed Maintenance / Service Event</span>
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  placeholder="Service performed (e.g., 20k Mile Service & Brake Check) *"
                  className="sm:col-span-2 px-3 py-2 rounded-xl border border-stone-300 bg-white"
                />
                <input
                  type="date"
                  value={serviceDate}
                  onChange={(e) => setServiceDate(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-stone-300 bg-white tabular-nums"
                />
                <input
                  type="text"
                  value={mileage}
                  onChange={(e) => setMileage(e.target.value)}
                  placeholder="Odometer (e.g., 21,400 mi)"
                  className="px-3 py-2 rounded-xl border border-stone-300 bg-white font-mono"
                />
                <input
                  type="text"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  placeholder="Service Provider / Dealer"
                  className="px-3 py-2 rounded-xl border border-stone-300 bg-white"
                />
                <input
                  type="text"
                  value={costDollars}
                  onChange={(e) => setCostDollars(e.target.value)}
                  placeholder="Service Cost ($)"
                  className="px-3 py-2 rounded-xl border border-stone-300 bg-white font-mono"
                />
                <input
                  type="text"
                  value={nextDueInput}
                  onChange={(e) => setNextDueInput(e.target.value)}
                  placeholder="Update Next Maintenance Target (optional)"
                  className="sm:col-span-2 px-3 py-2 rounded-xl border border-stone-300 bg-white"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white font-semibold cursor-pointer"
              >
                + Record Service Entry
              </button>
            </form>
          )}

          <div className="space-y-2.5 text-xs">
            <span className="font-bold text-stone-900 block">Maintenance & Service History</span>
            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-stone-700">
              <span className="text-[11px] font-semibold text-stone-400 block mb-0.5">Latest Summary</span>
              {vehicle.serviceHistory}
            </div>
            {logs.map((entry) => (
              <div
                key={entry.id}
                className="p-3.5 rounded-xl bg-white border border-stone-200 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="font-bold text-stone-900">{entry.serviceType}</div>
                  <div className="text-[11px] text-stone-500 tabular-nums">
                    {entry.date} · {entry.mileage} · {entry.provider}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-stone-900 tabular-nums">
                    {formatCents(entry.costCents)}
                  </span>
                  {canMutate && (
                    <button
                      type="button"
                      onClick={() =>
                        void onUpdateVehicle({
                          ...vehicle,
                          maintenanceLogs: logs.filter((l) => l.id !== entry.id),
                        })
                      }
                      className="text-stone-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {vehicle.attachments && vehicle.attachments.length > 0 && (
            <div className="space-y-2 text-xs">
              <span className="font-bold text-stone-900 block">Attached Registration & Service Receipts</span>
              <div className="space-y-1.5">
                {vehicle.attachments.map((att) => (
                  <a
                    key={att.id}
                    href={att.dataUrl}
                    download={att.name}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 hover:border-emerald-700 text-stone-800"
                  >
                    <span className="font-medium truncate">{att.name}</span>
                    <Download className="w-3.5 h-3.5 text-emerald-800 shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {canMutate && (
          <div className="p-5 border-t border-stone-200 bg-stone-50 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                onClose();
                onEditVehicle(vehicle);
              }}
              className="px-4 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 text-xs font-semibold text-stone-800 cursor-pointer"
            >
              Edit Vehicle Profile
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onDeleteVehicle(vehicle);
              }}
              className="px-4 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-xs font-semibold text-rose-700 cursor-pointer"
            >
              Delete Vehicle
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 9. LONG-TERM FAMILY PLANS MODAL + MILESTONE DRAWER
// ============================================================================

export const LongTermPlanModal: React.FC<{
  isOpen: boolean;
  initialData?: LongTermPlan | null;
  onClose: () => void;
  onSave: (plan: Omit<LongTermPlan, 'id'> & { id?: string }) => Promise<void>;
}> = ({ isOpen, initialData, onClose, onSave }) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('Estate & Legal');
  const [horizon, setHorizon] = useState('5–10 Year Horizon');
  const [targetDate, setTargetDate] = useState('2030');
  const [budgetDollars, setBudgetDollars] = useState('50000.00');
  const [advisorOrCustodian, setAdvisorOrCustodian] = useState('');
  const [reviewCadence, setReviewCadence] = useState('Annual Review');
  const [milestonesText, setMilestonesText] = useState('');
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState<LifeAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setCategory(initialData.category || 'Estate & Legal');
      setHorizon(initialData.horizon || '5–10 Year Horizon');
      setTargetDate(initialData.targetDate || '2030');
      setBudgetDollars(((initialData.estimatedBudgetCents || 0) / 100).toFixed(2));
      setAdvisorOrCustodian(initialData.advisorOrCustodian || '');
      setReviewCadence(initialData.reviewCadence || 'Annual Review');
      setMilestonesText((initialData.milestones || []).join('\n'));
      setNotes(initialData.notes || '');
      setAttachments(initialData.attachments || []);
    } else {
      setTitle('');
      setCategory('Estate & Legal');
      setHorizon('5–10 Year Horizon');
      setTargetDate('2032');
      setBudgetDollars('75000.00');
      setAdvisorOrCustodian('');
      setReviewCadence('Annual Review');
      setMilestonesText(
        'Establish multi-year family charter & scope\nReview legal/custodial structure with advisor\nComplete annual capital allocation milestone'
      );
      setNotes('');
      setAttachments([]);
    }
    setError(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const uploaded = await readFilesAsAttachments(e.target.files);
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (err: any) {
      setError(err?.message || 'Attachment upload failed.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please enter a title for the long-term family roadmap.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const milestones = milestonesText
        .split('\n')
        .map((m) => m.trim())
        .filter(Boolean);
      const existingStructured = initialData?.structuredMilestones || [];
      const structuredMilestones: LongTermMilestone[] = milestones.map((mTitle, idx) => {
        const match = existingStructured.find((em) => em.title.toLowerCase() === mTitle.toLowerCase());
        return {
          id: match?.id || `ltm-${Date.now()}-${idx}`,
          title: mTitle,
          completed: match?.completed ?? false,
        };
      });
      const completedCount = structuredMilestones.filter((m) => m.completed).length;
      const computedProgress =
        structuredMilestones.length > 0
          ? Math.round((completedCount / structuredMilestones.length) * 100)
          : initialData?.progressPercent || 15;

      await onSave({
        id: initialData?.id,
        title: title.trim(),
        category,
        horizon,
        targetDate: targetDate.trim() || '2030',
        estimatedBudgetCents: parseDollarsToCents(budgetDollars),
        milestones,
        structuredMilestones,
        progressPercent: computedProgress,
        advisorOrCustodian: advisorOrCustodian.trim(),
        reviewCadence,
        notes: notes.trim(),
        attachments,
        version: initialData?.version,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save long-term family plan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-stone-200 max-w-xl w-full p-6 shadow-xl my-8">
        <div className="flex items-center justify-between pb-4 border-b border-stone-100">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              Multi-Year Family Stewardship & Roadmaps
            </span>
            <h3 className="font-serif font-bold text-lg text-stone-900">
              {initialData ? 'Edit Long-Term Family Plan' : 'New Long-Term Family Plan'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-stone-700 mb-1">
                Long-Term Initiative / Estate Roadmap *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., 529 Higher Education Trust & University Roadmap"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Strategic Domain</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white"
              >
                <option value="Estate & Legal">Estate & Legal</option>
                <option value="Education & Trust">Education & Trust</option>
                <option value="Real Estate & Capital">Real Estate & Capital</option>
                <option value="Retirement & Stewardship">Retirement & Stewardship</option>
                <option value="Multi-Year Family Roadmap">Multi-Year Family Roadmap</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Planning Horizon</label>
              <select
                value={horizon}
                onChange={(e) => setHorizon(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white"
              >
                <option value="3–5 Year Horizon">3–5 Year Horizon</option>
                <option value="5–10 Year Horizon">5–10 Year Horizon</option>
                <option value="10+ Year Generational">10+ Year Generational</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Target Horizon Year</label>
              <input
                type="text"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                placeholder="2031"
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300 font-mono tabular-nums"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Target Capital ($)</label>
              <input
                type="text"
                value={budgetDollars}
                onChange={(e) => setBudgetDollars(e.target.value)}
                placeholder="85000.00"
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300 font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Fiduciary / Custodian / Legal Counsel
              </label>
              <input
                type="text"
                value={advisorOrCustodian}
                onChange={(e) => setAdvisorOrCustodian(e.target.value)}
                placeholder="e.g., Vanguard 529 / Sterling Legal LLP"
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Governance Review Cadence</label>
              <select
                value={reviewCadence}
                onChange={(e) => setReviewCadence(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white"
              >
                <option value="Semi-Annual Review">Semi-Annual Review</option>
                <option value="Annual Review">Annual Review</option>
                <option value="Biennial Estate Audit">Biennial Estate Audit</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Multi-Year Milestones (One per line)
            </label>
            <textarea
              rows={4}
              value={milestonesText}
              onChange={(e) => setMilestonesText(e.target.value)}
              placeholder={'Complete trust restatement & guardianship schedule\nFund 50% of target capital allocation\nConduct annual family governance review'}
              className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
            />
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">Stewardship & Advisor Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Long-term assumptions, succession directives, or policy references..."
              className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
            />
          </div>

          <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
            <span className="font-semibold text-stone-800 flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5 text-emerald-800" />
              <span>Attach Estate Summaries or Roadmap Briefs ({attachments.length})</span>
            </span>
            <input
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.webp,.txt"
              onChange={handleFileUpload}
              className="text-xs text-stone-600 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-stone-800 file:text-white file:text-xs file:font-semibold cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-stone-200 text-stone-700 font-semibold hover:bg-stone-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white font-semibold cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Saving...' : initialData ? 'Save Roadmap' : 'Create Long-Term Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const LongTermPlanDrawer: React.FC<{
  plan: LongTermPlan | null;
  canMutate: boolean;
  onClose: () => void;
  onUpdatePlan: (updated: LongTermPlan) => Promise<void>;
  onEditPlan: (plan: LongTermPlan) => void;
  onDeletePlan: (plan: LongTermPlan) => void;
}> = ({ plan, canMutate, onClose, onUpdatePlan, onEditPlan, onDeletePlan }) => {
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');

  if (!plan) return null;

  const structured: LongTermMilestone[] =
    plan.structuredMilestones && plan.structuredMilestones.length > 0
      ? plan.structuredMilestones
      : (plan.milestones || []).map((m, idx) => ({
          id: `ltm-${idx}`,
          title: m,
          completed: idx < Math.round(((plan.progressPercent || 0) / 100) * (plan.milestones?.length || 1)),
        }));

  const handleToggleMilestone = (mId: string) => {
    if (!canMutate) return;
    const nextStructured = structured.map((m) =>
      m.id === mId ? { ...m, completed: !m.completed } : m
    );
    const doneCount = nextStructured.filter((m) => m.completed).length;
    const progressPercent =
      nextStructured.length > 0 ? Math.round((doneCount / nextStructured.length) * 100) : 0;
    void onUpdatePlan({
      ...plan,
      structuredMilestones: nextStructured,
      milestones: nextStructured.map((m) => m.title),
      progressPercent,
    });
  };

  const handleAddMilestone = () => {
    if (!newMilestoneTitle.trim() || !canMutate) return;
    const nextStructured: LongTermMilestone[] = [
      ...structured,
      { id: `ltm-${Date.now()}`, title: newMilestoneTitle.trim(), completed: false },
    ];
    const doneCount = nextStructured.filter((m) => m.completed).length;
    const progressPercent = Math.round((doneCount / nextStructured.length) * 100);
    setNewMilestoneTitle('');
    void onUpdatePlan({
      ...plan,
      structuredMilestones: nextStructured,
      milestones: nextStructured.map((m) => m.title),
      progressPercent,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-stone-950/40 backdrop-blur-xs">
      <div className="bg-white w-full max-w-lg h-full shadow-2xl border-l border-stone-200 flex flex-col justify-between overflow-y-auto">
        <div className="p-6 space-y-6">
          <div className="flex items-start justify-between gap-3 pb-4 border-b border-stone-100">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                {plan.category} · Target {plan.targetDate}
              </span>
              <h3 className="font-serif font-bold text-xl text-stone-900 mt-0.5">{plan.title}</h3>
              <p className="text-xs text-stone-500 mt-0.5">
                {plan.horizon || 'Multi-Year Horizon'}
                {plan.reviewCadence ? ` · ${plan.reviewCadence}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200">
              <span className="text-stone-500 block">Target Capital Allocation</span>
              <span className="font-mono font-bold text-base text-stone-900 tabular-nums">
                {formatCents(plan.estimatedBudgetCents)}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200">
              <span className="text-emerald-900 block">Milestone Readiness</span>
              <span className="font-mono font-bold text-base text-emerald-950 tabular-nums">
                {plan.progressPercent}% Complete
              </span>
            </div>
          </div>

          {plan.advisorOrCustodian && (
            <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 text-xs flex justify-between">
              <span className="text-stone-500">Fiduciary / Custodian</span>
              <span className="font-semibold text-stone-900">{plan.advisorOrCustodian}</span>
            </div>
          )}

          <div className="space-y-2.5 text-xs">
            <span className="font-bold text-stone-900 block">
              Multi-Year Milestones (Automatic Progress Rollup)
            </span>
            <div className="space-y-1.5">
              {structured.map((m) => (
                <div
                  key={m.id}
                  className={`px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                    m.completed ? 'bg-emerald-50/60 border-emerald-200' : 'bg-stone-50 border-stone-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleToggleMilestone(m.id)}
                    className="flex items-center gap-2 text-left flex-1 cursor-pointer"
                  >
                    {m.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-stone-400 shrink-0" />
                    )}
                    <span className={m.completed ? 'line-through text-stone-400' : 'text-stone-800 font-medium'}>
                      {m.title}
                    </span>
                  </button>
                </div>
              ))}
            </div>

            {canMutate && (
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={newMilestoneTitle}
                  onChange={(e) => setNewMilestoneTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddMilestone();
                    }
                  }}
                  placeholder="Add long-term milestone..."
                  className="flex-1 px-3 py-2 rounded-xl border border-stone-300"
                />
                <button
                  type="button"
                  onClick={handleAddMilestone}
                  className="px-3.5 py-2 rounded-xl bg-[#173D35] text-white font-semibold cursor-pointer"
                >
                  + Add
                </button>
              </div>
            )}
          </div>

          {plan.notes && (
            <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 text-xs space-y-1">
              <span className="font-bold text-stone-900 block">Stewardship & Legal Notes</span>
              <p className="text-stone-600 leading-relaxed">{plan.notes}</p>
            </div>
          )}

          {plan.attachments && plan.attachments.length > 0 && (
            <div className="space-y-2 text-xs">
              <span className="font-bold text-stone-900 block">Attached Estate & Roadmap Documents</span>
              <div className="space-y-1.5">
                {plan.attachments.map((att) => (
                  <a
                    key={att.id}
                    href={att.dataUrl}
                    download={att.name}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 hover:border-emerald-700 text-stone-800"
                  >
                    <span className="font-medium truncate">{att.name}</span>
                    <Download className="w-3.5 h-3.5 text-emerald-800 shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {canMutate && (
          <div className="p-5 border-t border-stone-200 bg-stone-50 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                onClose();
                onEditPlan(plan);
              }}
              className="px-4 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 text-xs font-semibold text-stone-800 cursor-pointer"
            >
              Edit Roadmap
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onDeletePlan(plan);
              }}
              className="px-4 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-xs font-semibold text-rose-700 cursor-pointer"
            >
              Delete Plan
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
