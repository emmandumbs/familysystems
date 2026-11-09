import React, { useState, useRef } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Paperclip,
  Plus,
  Trash2,
  X,
  Check,
  Printer,
  Edit3,
  Copy,
  AlertTriangle,
  Download,
  Eye,
  ListChecks,
} from 'lucide-react';

export interface HouseholdAttachment {
  id: string;
  name: string;
  type: 'PHOTO' | 'DOCUMENT';
  mimeType: string;
  dataUrl: string;
  sizeBytes?: number;
  uploadedAt: number;
}

export interface ChecklistTemplate {
  id: string;
  familyId: string;
  name: string;
  domain: 'CHORE' | 'MAINTENANCE' | 'ROUTINE';
  category: string;
  items: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ChoreChecklistItem {
  id: string;
  text: string;
  isDone: boolean;
}

export const FAMILY_MEMBERS = [
  { id: 'mem-sarah', name: 'Sarah Jenkins', role: 'Owner' },
  { id: 'mem-david-admin', name: 'David Jenkins', role: 'Admin' },
  { id: 'mem-maya-child', name: 'Maya Jenkins', role: 'Member' },
  { id: 'mem-lucas-child', name: 'Lucas Jenkins', role: 'Child' },
  { id: 'mem-martha-guest', name: 'Martha Vance', role: 'Guest' },
];

export const ROLE_TO_MEMBER_ID: Record<string, string> = {
  OWNER: 'mem-sarah',
  ADMIN: 'mem-david-admin',
  MEMBER: 'mem-maya-child',
  CHILD: 'mem-lucas-child',
  GUEST: 'mem-martha-guest',
};

export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getMemberName(memberId?: string): string {
  if (!memberId) return 'Unassigned';
  const found = FAMILY_MEMBERS.find((m) => m.id === memberId);
  return found ? found.name : memberId;
}

export function getMemberShortName(memberId?: string): string {
  if (!memberId) return 'Anyone';
  const found = FAMILY_MEMBERS.find((m) => m.id === memberId);
  return found ? found.name.split(' ')[0] : memberId;
}

// ============================================================================
// 1. RICH PHOTO & DOCUMENT ATTACHMENT UPLOADER (FOR MODALS / DRAWERS)
// ============================================================================
interface AttachmentUploaderProps {
  imageUri?: string;
  attachments: HouseholdAttachment[];
  onChange: (nextImageUri: string | undefined, nextAttachments: HouseholdAttachment[]) => void;
  label?: string;
}

export const AttachmentUploader: React.FC<AttachmentUploaderProps> = ({
  imageUri,
  attachments,
  onChange,
  label = 'Photos & Document Attachments',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlField, setShowUrlField] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = String(ev.target?.result || '');
        if (!dataUrl) return;
        const isImage = file.type.startsWith('image/');
        const newAtt: HouseholdAttachment = {
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          type: isImage ? 'PHOTO' : 'DOCUMENT',
          mimeType: file.type || (isImage ? 'image/jpeg' : 'application/pdf'),
          dataUrl,
          sizeBytes: file.size,
          uploadedAt: Date.now(),
        };
        const updatedList = [...attachments, newAtt];
        const nextPrimaryImage = isImage && !imageUri ? dataUrl : imageUri;
        onChange(nextPrimaryImage, updatedList);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleAddExternalUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    const isDoc = /\.(pdf|doc|docx|txt|csv|xlsx)$/i.test(trimmed);
    const newAtt: HouseholdAttachment = {
      id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: trimmed.split('/').pop()?.slice(0, 32) || (isDoc ? 'Document Link' : 'Photo Link'),
      type: isDoc ? 'DOCUMENT' : 'PHOTO',
      mimeType: isDoc ? 'application/pdf' : 'image/jpeg',
      dataUrl: trimmed,
      uploadedAt: Date.now(),
    };
    const updatedList = [...attachments, newAtt];
    const nextPrimaryImage = !isDoc && !imageUri ? trimmed : imageUri;
    onChange(nextPrimaryImage, updatedList);
    setUrlInput('');
    setShowUrlField(false);
  };

  const handleRemoveAttachment = (attId: string) => {
    const target = attachments.find((a) => a.id === attId);
    const remaining = attachments.filter((a) => a.id !== attId);
    let nextImg = imageUri;
    if (target && imageUri === target.dataUrl) {
      const firstPhoto = remaining.find((a) => a.type === 'PHOTO');
      nextImg = firstPhoto ? firstPhoto.dataUrl : undefined;
    }
    onChange(nextImg, remaining);
  };

  return (
    <div className="space-y-2.5 pt-2 border-t border-stone-200/80">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-stone-700 flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5 text-stone-500" />
          <span>{label}</span>
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowUrlField(!showUrlField)}
            className="text-[11px] font-semibold text-stone-600 hover:text-stone-900 px-2 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 transition cursor-pointer"
          >
            {showUrlField ? 'Cancel URL' : '+ Link URL'}
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-[11px] font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>Upload Photo / Doc</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.txt"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </div>

      {showUrlField && (
        <div className="flex items-center gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Paste image or document URL (https://...)"
            className="flex-1 px-3 py-1.5 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-emerald-800"
          />
          <button
            type="button"
            onClick={handleAddExternalUrl}
            className="px-3 py-1.5 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 cursor-pointer"
          >
            Attach
          </button>
        </div>
      )}

      {(imageUri || attachments.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {imageUri && !attachments.some((a) => a.dataUrl === imageUri) && (
            <div className="flex items-center justify-between p-2 rounded-xl bg-stone-50 border border-stone-200 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <img src={imageUri} alt="Primary" className="w-8 h-8 rounded-lg object-cover border border-stone-200 shrink-0" />
                <span className="truncate font-medium text-stone-700">Cover Photo</span>
              </div>
              <button
                type="button"
                onClick={() => onChange(undefined, attachments)}
                className="p-1 text-stone-400 hover:text-rose-600 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center justify-between p-2 rounded-xl bg-stone-50 border border-stone-200 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                {att.type === 'PHOTO' ? (
                  <img
                    src={att.dataUrl}
                    alt={att.name}
                    className="w-8 h-8 rounded-lg object-cover border border-stone-200 shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-amber-800" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-medium text-stone-800 truncate">{att.name}</p>
                  <p className="text-[10px] text-stone-500">
                    {att.type} {att.sizeBytes ? `• ${formatBytes(att.sizeBytes)}` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveAttachment(att.id)}
                className="p-1 text-stone-400 hover:text-rose-600 shrink-0 cursor-pointer"
                title="Remove attachment"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 2. COMPACT ATTACHMENT BADGES & PREVIEW FOR CARDS
// ============================================================================
export const AttachmentBadgeList: React.FC<{
  imageUri?: string;
  attachments?: HouseholdAttachment[];
  onPreview?: (att: HouseholdAttachment) => void;
}> = ({ imageUri, attachments = [], onPreview }) => {
  const hasPhoto = Boolean(imageUri) || attachments.some((a) => a.type === 'PHOTO');
  const docs = attachments.filter((a) => a.type === 'DOCUMENT');
  const photos = attachments.filter((a) => a.type === 'PHOTO');
  const coverUrl = imageUri || photos[0]?.dataUrl;

  if (!hasPhoto && docs.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-2">
      {coverUrl && (
        <button
          type="button"
          onClick={() =>
            onPreview?.({
              id: 'cover',
              name: 'Attached Photo',
              type: 'PHOTO',
              mimeType: 'image/jpeg',
              dataUrl: coverUrl,
              uploadedAt: Date.now(),
            })
          }
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-stone-100 hover:bg-stone-200/80 text-[11px] font-medium text-stone-700 transition cursor-pointer"
        >
          <img src={coverUrl} alt="Thumbnail" className="w-4 h-4 rounded object-cover" />
          <span>{photos.length > 1 ? `${photos.length} Photos` : 'Photo'}</span>
        </button>
      )}
      {docs.map((doc) => (
        <button
          key={doc.id}
          type="button"
          onClick={() => onPreview?.(doc)}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200/80 text-[11px] font-medium text-amber-900 transition cursor-pointer"
        >
          <FileText className="w-3 h-3 text-amber-700 shrink-0" />
          <span className="truncate max-w-[130px]">{doc.name}</span>
        </button>
      ))}
    </div>
  );
};

// ============================================================================
// 3. ATTACHMENT VIEWER MODAL
// ============================================================================
export const AttachmentPreviewModal: React.FC<{
  attachment: HouseholdAttachment | null;
  onClose: () => void;
}> = ({ attachment, onClose }) => {
  if (!attachment) return null;

  return (
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-5 max-w-lg w-full border border-stone-200 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-stone-200 pb-3">
          <div className="flex items-center gap-2 min-w-0">
            {attachment.type === 'PHOTO' ? (
              <ImageIcon className="w-4 h-4 text-emerald-800 shrink-0" />
            ) : (
              <FileText className="w-4 h-4 text-amber-700 shrink-0" />
            )}
            <h4 className="font-serif font-bold text-stone-900 text-base truncate">{attachment.name}</h4>
          </div>
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {attachment.type === 'PHOTO' ? (
          <div className="rounded-xl overflow-hidden bg-stone-100 border border-stone-200 max-h-[60vh] flex items-center justify-center">
            <img src={attachment.dataUrl} alt={attachment.name} className="max-h-[58vh] w-auto object-contain" />
          </div>
        ) : (
          <div className="p-6 rounded-xl bg-stone-50 border border-stone-200 text-center space-y-2">
            <FileText className="w-10 h-10 text-amber-700 mx-auto" />
            <p className="text-sm font-semibold text-stone-900">{attachment.name}</p>
            <p className="text-xs text-stone-500">
              {attachment.mimeType} {attachment.sizeBytes ? `• ${formatBytes(attachment.sizeBytes)}` : ''}
            </p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200">
          <a
            href={attachment.dataUrl}
            download={attachment.name}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 rounded-xl bg-[#173D35] text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-emerald-950 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download File</span>
          </a>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 4. REUSABLE CHECKLIST TEMPLATES MODAL / DRAWER (CRUD + 1-CLICK APPLY)
// ============================================================================
interface TemplateManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: ChecklistTemplate[];
  onSaveTemplate: (
    payload: { name: string; domain: 'CHORE' | 'MAINTENANCE' | 'ROUTINE'; category: string; items: string[] },
    editingId?: string | null
  ) => Promise<void>;
  onDeleteTemplate: (templateId: string) => Promise<void>;
  onApplyTemplate?: (template: ChecklistTemplate) => void;
  defaultDomainFilter?: 'ALL' | 'CHORE' | 'MAINTENANCE' | 'ROUTINE';
}

export const TemplateManagerModal: React.FC<TemplateManagerModalProps> = ({
  isOpen,
  onClose,
  templates,
  onSaveTemplate,
  onDeleteTemplate,
  onApplyTemplate,
  defaultDomainFilter = 'ALL',
}) => {
  const [domainFilter, setDomainFilter] = useState<'ALL' | 'CHORE' | 'MAINTENANCE' | 'ROUTINE'>(
    defaultDomainFilter
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tplName, setTplName] = useState('');
  const [tplDomain, setTplDomain] = useState<'CHORE' | 'MAINTENANCE' | 'ROUTINE'>('CHORE');
  const [tplCategory, setTplCategory] = useState('KITCHEN');
  const [tplSteps, setTplSteps] = useState<string[]>(['']);
  const [showBuilder, setShowBuilder] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const filtered = templates.filter(
    (t) => domainFilter === 'ALL' || t.domain === domainFilter
  );

  const openNewBuilder = () => {
    setEditingId(null);
    setTplName('');
    setTplDomain(domainFilter === 'ALL' ? 'CHORE' : domainFilter);
    setTplCategory('GENERAL');
    setTplSteps(['Inspect and prepare area', 'Complete primary task checklist']);
    setShowBuilder(true);
  };

  const openEditBuilder = (tpl: ChecklistTemplate) => {
    setEditingId(tpl.id);
    setTplName(tpl.name);
    setTplDomain(tpl.domain);
    setTplCategory(tpl.category);
    setTplSteps(tpl.items.length > 0 ? [...tpl.items] : ['']);
    setShowBuilder(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validSteps = tplSteps.map((s) => s.trim()).filter(Boolean);
    if (!tplName.trim() || validSteps.length === 0) return;
    setSaving(true);
    try {
      await onSaveTemplate(
        {
          name: tplName.trim(),
          domain: tplDomain,
          category: tplCategory.trim().toUpperCase() || 'GENERAL',
          items: validSteps,
        },
        editingId
      );
      setShowBuilder(false);
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl p-6 max-w-2xl w-full border border-stone-200 shadow-2xl space-y-5 my-8">
        <div className="flex items-center justify-between border-b border-stone-200 pb-3">
          <div>
            <h4 className="font-serif font-bold text-stone-900 text-lg flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-emerald-800" />
              <span>Reusable Checklist Templates</span>
            </h4>
            <p className="text-xs text-stone-500">
              Standardized step-by-step checklists for household chores, routines, and preventive equipment maintenance.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter & Create Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {(['ALL', 'CHORE', 'ROUTINE', 'MAINTENANCE'] as const).map((dom) => (
              <button
                key={dom}
                type="button"
                onClick={() => setDomainFilter(dom)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  domainFilter === dom
                    ? 'bg-[#173D35] text-white'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                {dom === 'ALL'
                  ? 'All Templates'
                  : dom === 'CHORE'
                    ? 'Chore Checklists'
                    : dom === 'ROUTINE'
                      ? 'Daily Routines'
                      : 'Asset Maintenance'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={openNewBuilder}
            className="px-3.5 py-1.5 rounded-xl bg-[#173D35] text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-emerald-950 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Template</span>
          </button>
        </div>

        {/* Template Form Builder */}
        {showBuilder && (
          <form onSubmit={handleSubmit} className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-700">
                {editingId ? 'Edit Checklist Template' : 'Create Reusable Template'}
              </span>
              <button
                type="button"
                onClick={() => setShowBuilder(false)}
                className="text-xs text-stone-500 hover:text-stone-800 cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <label className="text-[11px] font-bold text-stone-700">Template Name</label>
                <input
                  type="text"
                  required
                  value={tplName}
                  onChange={(e) => setTplName(e.target.value)}
                  placeholder="e.g. Weekly Kitchen Sanitize"
                  className="w-full mt-1 px-3 py-1.5 rounded-xl border border-stone-200 bg-white text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-stone-700">Domain</label>
                <select
                  value={tplDomain}
                  onChange={(e) => setTplDomain(e.target.value as any)}
                  className="w-full mt-1 px-3 py-1.5 rounded-xl border border-stone-200 bg-white text-xs"
                >
                  <option value="CHORE">Chore</option>
                  <option value="ROUTINE">Routine</option>
                  <option value="MAINTENANCE">Asset Maintenance</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-stone-700">Zone / Category</label>
                <input
                  type="text"
                  value={tplCategory}
                  onChange={(e) => setTplCategory(e.target.value)}
                  placeholder="e.g. KITCHEN, HVAC"
                  className="w-full mt-1 px-3 py-1.5 rounded-xl border border-stone-200 bg-white text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-stone-700">Checklist Steps</label>
                <button
                  type="button"
                  onClick={() => setTplSteps([...tplSteps, ''])}
                  className="text-[11px] font-semibold text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Step</span>
                </button>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {tplSteps.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-stone-500 w-4">{idx + 1}.</span>
                    <input
                      type="text"
                      value={step}
                      onChange={(e) => {
                        const next = [...tplSteps];
                        next[idx] = e.target.value;
                        setTplSteps(next);
                      }}
                      placeholder="Describe checklist step..."
                      className="flex-1 px-3 py-1.5 rounded-xl border border-stone-200 bg-white text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setTplSteps(tplSteps.filter((_, i) => i !== idx))}
                      className="p-1 text-stone-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-1.5 rounded-xl bg-[#173D35] text-white text-xs font-semibold hover:bg-emerald-950 transition cursor-pointer"
              >
                {saving ? 'Saving...' : editingId ? 'Update Template' : 'Save Template'}
              </button>
            </div>
          </form>
        )}

        {/* Templates List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-1">
          {filtered.map((tpl) => (
            <div
              key={tpl.id}
              className="p-4 rounded-2xl border border-stone-200 bg-white flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-stone-100 text-stone-700">
                    {tpl.domain} • {tpl.category}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditBuilder(tpl)}
                      className="p-1 text-stone-400 hover:text-stone-800 cursor-pointer"
                      title="Edit template"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDeleteTemplate(tpl.id)}
                      className="p-1 text-stone-400 hover:text-rose-600 cursor-pointer"
                      title="Delete template"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <h5 className="font-bold text-stone-900 text-sm mt-1.5">{tpl.name}</h5>
                <ul className="mt-2 space-y-1 text-xs text-stone-600">
                  {tpl.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {onApplyTemplate && (
                <button
                  type="button"
                  onClick={() => {
                    onApplyTemplate(tpl);
                    onClose();
                  }}
                  className="w-full py-1.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border border-emerald-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Use This Checklist</span>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 5. DELETE CONFIRMATION MODAL
// ============================================================================
export const DeleteConfirmModal: React.FC<{
  target: { title: string; subtitle?: string; onConfirm: () => Promise<void> } | null;
  onClose: () => void;
}> = ({ target, onClose }) => {
  const [deleting, setDeleting] = useState(false);
  if (!target) return null;

  return (
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full border border-stone-200 shadow-xl space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h4 className="font-serif font-bold text-stone-900 text-base">Confirm Deletion</h4>
            <p className="text-xs text-stone-600 mt-1">
              Are you sure you want to remove <strong>{target.title}</strong>?
              {target.subtitle ? ` ${target.subtitle}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={async () => {
              setDeleting(true);
              try {
                await target.onConfirm();
                onClose();
              } finally {
                setDeleting(false);
              }
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 6. PRINT OPERATIONS MODAL
// ============================================================================
export type PrintDocType =
  | 'meal_plan'
  | 'groceries'
  | 'pantry_inventory'
  | 'chores_board'
  | 'assets_maintenance'
  | 'wardrobe_outfits'
  | 'all_operations';

export const PrintOperationsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  weekDayDates: Array<{ dayName: string; iso: string; formatted: string }>;
  meals: any[];
  recipes: any[];
  groceries: any[];
  pantry: any[];
  chores: any[];
  assets: any[];
  outfits: any[];
}> = ({
  isOpen,
  onClose,
  weekDayDates,
  meals,
  recipes,
  groceries,
  pantry,
  chores,
  assets,
  outfits,
}) => {
  const [selectedPrintDoc, setSelectedPrintDoc] = useState<PrintDocType>('meal_plan');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl p-6 max-w-4xl w-full border border-stone-200 shadow-2xl space-y-4 my-8">
        <div className="flex items-center justify-between border-b border-stone-200 pb-3">
          <div>
            <h4 className="font-serif font-bold text-stone-900 text-lg flex items-center gap-2">
              <Printer className="w-5 h-5 text-emerald-800" />
              <span>Print & Export Household Schedules</span>
            </h4>
            <p className="text-xs text-stone-500">
              Generate clean printable sheets for the kitchen binder or refrigerator board.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'meal_plan', label: '7-Day Meal Plan' },
              { id: 'groceries', label: 'Grocery Checklist' },
              { id: 'pantry_inventory', label: 'Inventory Audit' },
              { id: 'chores_board', label: 'Chore Chart' },
              { id: 'assets_maintenance', label: 'Asset & Service Log' },
              { id: 'wardrobe_outfits', label: 'Outfit Schedule' },
              { id: 'all_operations', label: 'Complete Dossier' },
            ].map((doc) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => setSelectedPrintDoc(doc.id as PrintDocType)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  selectedPrintDoc === doc.id
                    ? 'bg-[#173D35] text-white'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                {doc.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 rounded-xl bg-[#173D35] text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-emerald-950 transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / Save PDF</span>
          </button>
        </div>

        <div className="border border-stone-200 p-6 rounded-2xl bg-white max-h-[60vh] overflow-y-auto space-y-6 text-stone-900">
          <div className="border-b border-stone-300 pb-3 flex items-start justify-between">
            <div>
              <h1 className="font-serif font-bold text-xl text-stone-900">FamilyOS • Household Operations</h1>
              <p className="text-xs text-stone-500">
                Generated on {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <span className="text-xs text-stone-500 font-mono">Household Binder</span>
          </div>

          {(selectedPrintDoc === 'meal_plan' || selectedPrintDoc === 'all_operations') && (
            <div className="space-y-2">
              <h2 className="font-serif font-bold text-sm uppercase tracking-wider text-stone-800">Weekly Meal Schedule</h2>
              <table className="w-full text-xs text-left border-collapse border border-stone-300">
                <thead>
                  <tr className="bg-stone-100 border-b border-stone-300">
                    <th className="p-2 border-r border-stone-300 font-bold">Day</th>
                    <th className="p-2 border-r border-stone-300 font-bold">Slot</th>
                    <th className="p-2 border-r border-stone-300 font-bold">Dish / Recipe</th>
                    <th className="p-2 border-r border-stone-300 font-bold text-center">Servings</th>
                    <th className="p-2 font-bold">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {weekDayDates.map((day) => {
                    const dayMeals = meals.filter(
                      (m) => new Date(m.planDate).toISOString().split('T')[0] === day.iso
                    );
                    if (dayMeals.length === 0) {
                      return (
                        <tr key={day.dayName} className="border-b border-stone-200">
                          <td className="p-2 border-r border-stone-200 font-semibold">{day.dayName} ({day.formatted})</td>
                          <td className="p-2 text-stone-400 italic" colSpan={4}>No meals scheduled</td>
                        </tr>
                      );
                    }
                    return dayMeals.map((m, idx) => (
                      <tr key={m.id} className="border-b border-stone-200">
                        {idx === 0 && (
                          <td className="p-2 border-r border-stone-200 font-semibold" rowSpan={dayMeals.length}>
                            {day.dayName} ({day.formatted})
                          </td>
                        )}
                        <td className="p-2 border-r border-stone-200 text-[10px] font-bold uppercase">{m.mealType}</td>
                        <td className="p-2 border-r border-stone-200 font-semibold">
                          {m.customMealTitle || recipes.find((r) => r.id === m.recipeId)?.title || 'Scheduled Meal'}
                        </td>
                        <td className="p-2 border-r border-stone-200 text-center">{m.servings}</td>
                        <td className="p-2 text-stone-600">{m.notes || '—'}</td>
                      </tr>
                    ));
                  })}
                </tbody>
              </table>
            </div>
          )}

          {(selectedPrintDoc === 'groceries' || selectedPrintDoc === 'all_operations') && (
            <div className="space-y-2">
              <h2 className="font-serif font-bold text-sm uppercase tracking-wider text-stone-800">Grocery Shopping List</h2>
              <div className="grid grid-cols-2 gap-3">
                {groceries.map((g) => (
                  <div key={g.id} className="flex items-center justify-between p-2 border border-stone-200 rounded-lg text-xs">
                    <span>☐ {g.itemName} ({g.quantity} {g.unit})</span>
                    <span className="text-[10px] font-semibold text-stone-500">{g.category}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(selectedPrintDoc === 'pantry_inventory' || selectedPrintDoc === 'all_operations') && (
            <div className="space-y-2">
              <h2 className="font-serif font-bold text-sm uppercase tracking-wider text-stone-800">Pantry & Cold Storage Inventory</h2>
              <table className="w-full text-xs text-left border-collapse border border-stone-300">
                <thead>
                  <tr className="bg-stone-100 border-b border-stone-300">
                    <th className="p-2 border-r border-stone-300">Location</th>
                    <th className="p-2 border-r border-stone-300">Item</th>
                    <th className="p-2 border-r border-stone-300">Category</th>
                    <th className="p-2 border-r border-stone-300 text-center">Qty</th>
                    <th className="p-2">Expiry</th>
                  </tr>
                </thead>
                <tbody>
                  {pantry.map((item) => (
                    <tr key={item.id} className="border-b border-stone-200">
                      <td className="p-2 border-r border-stone-200">{item.storageLocation || 'Main Pantry'}</td>
                      <td className="p-2 border-r border-stone-200 font-semibold">{item.itemName}</td>
                      <td className="p-2 border-r border-stone-200">{item.category}</td>
                      <td className="p-2 border-r border-stone-200 text-center">{item.quantity} {item.unit}</td>
                      <td className="p-2">{item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(selectedPrintDoc === 'chores_board' || selectedPrintDoc === 'all_operations') && (
            <div className="space-y-2">
              <h2 className="font-serif font-bold text-sm uppercase tracking-wider text-stone-800">Weekly Chore Chart</h2>
              <div className="grid grid-cols-2 gap-3">
                {chores.map((c) => (
                  <div key={c.id} className="p-3 border border-stone-200 rounded-xl text-xs space-y-1">
                    <div className="flex justify-between font-bold">
                      <span>{c.title}</span>
                      <span>+{c.rewardPoints} pts</span>
                    </div>
                    <p className="text-stone-500">{c.location || c.zone} • {getMemberName(c.assignedMemberId)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(selectedPrintDoc === 'assets_maintenance' || selectedPrintDoc === 'all_operations') && (
            <div className="space-y-2">
              <h2 className="font-serif font-bold text-sm uppercase tracking-wider text-stone-800">Home Assets & Maintenance Schedule</h2>
              <table className="w-full text-xs text-left border-collapse border border-stone-300">
                <thead>
                  <tr className="bg-stone-100 border-b border-stone-300">
                    <th className="p-2 border-r border-stone-300">Asset</th>
                    <th className="p-2 border-r border-stone-300">Category</th>
                    <th className="p-2 border-r border-stone-300">Location</th>
                    <th className="p-2 border-r border-stone-300">Purchase Cost</th>
                    <th className="p-2">Next Service</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((a) => (
                    <tr key={a.id} className="border-b border-stone-200">
                      <td className="p-2 border-r border-stone-200 font-semibold">{a.name}</td>
                      <td className="p-2 border-r border-stone-200">{a.category}</td>
                      <td className="p-2 border-r border-stone-200">{a.location || 'Home'}</td>
                      <td className="p-2 border-r border-stone-200">${((a.purchasePriceCents || 0) / 100).toFixed(2)}</td>
                      <td className="p-2">{a.nextMaintenanceDate ? new Date(a.nextMaintenanceDate).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(selectedPrintDoc === 'wardrobe_outfits' || selectedPrintDoc === 'all_operations') && (
            <div className="space-y-2">
              <h2 className="font-serif font-bold text-sm uppercase tracking-wider text-stone-800">Planned Outfits</h2>
              <div className="grid grid-cols-2 gap-3">
                {outfits.map((o) => (
                  <div key={o.id} className="p-2.5 border border-stone-200 rounded-xl text-xs">
                    <div className="font-bold">{o.planDate} — {o.outfitName}</div>
                    <div className="text-stone-500">{getMemberName(o.memberId)} • {o.occasion}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
