import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Lock,
  Globe,
  Sparkles,
  Upload,
  FileText,
  Image as ImageIcon,
  CheckSquare,
  Square,
  History,
  MessageCircle,
  Heart,
  Users,
  Calendar,
  MapPin,
  Tag,
  Phone,
  Mail,
  BookOpen,
} from 'lucide-react';

export interface RelationshipAttachment {
  id: string;
  name: string;
  type: 'PHOTO' | 'DOCUMENT';
  dataUrl: string;
  uploadedAt?: string;
}

export interface CheckInRecord {
  id: string;
  author: string;
  type: 'WEEKLY' | 'MONTHLY' | 'MOMENT' | 'COUPLE';
  pulseLabel?:
    | 'Connected & Grounded'
    | 'Grateful & Energized'
    | 'Reflective & Quiet'
    | 'Stretched — Needs Support'
    | 'Seeking Quality Time';
  promptQuestion?: string;
  date: string;
  isPrivate: boolean;
  weekSummary: string;
  wentWell: string;
  couldImprove: string;
  supportNeeded: string;
  gratitude: string;
  togetherIdea: string;
  followUpAction: string;
  actionCompleted?: boolean;
  ownerUserId?: string;
  ownerMemberId?: string;
  version?: number;
}

export interface GratitudeNote {
  id: string;
  from: string;
  to: string;
  category: 'Appreciation' | 'Thank You' | 'Encouragement' | 'Kindness' | 'Milestone' | 'Achievement';
  message: string;
  date: string;
  attachments?: RelationshipAttachment[];
  reactions?: Array<{ memberName: string; type: 'HEART' | 'THANKFUL' | 'SPARKLE' }>;
  version?: number;
}

export interface CouplePlan {
  id: string;
  title: string;
  date: string;
  category: 'Date Night' | 'Partner Check-in' | 'Alignment Note' | 'Shared Goal' | 'Milestone' | 'Reflection';
  connectionPulse?:
    | 'Aligned & Connected'
    | 'Needs Unhurried Time'
    | 'Deep Appreciation'
    | 'Working Through Together';
  alignmentTopic?:
    | 'Parenting & Kids'
    | 'Household Rhythms'
    | 'Finances & Stewardship'
    | 'Rest & Intimacy'
    | 'Future Vision';
  sharedDecision?: string;
  notes: string;
  isPrivate: boolean;
  completed: boolean;
  version?: number;
}

export interface FamilyMeeting {
  id: string;
  title: string;
  date: string;
  facilitator?: string;
  participants: string;
  status?: 'UPCOMING' | 'COMPLETED' | 'ARCHIVED';
  agendaItems: string[];
  discussedAgendaIndices?: number[];
  decisions: string[];
  followUpTasks: string[];
  completedTaskIndices?: number[];
  meetingNotes?: string;
  completed?: boolean;
  version?: number;
}

export interface MeetingTemplate {
  id: string;
  title: string;
  description: string;
  agendaItems: string[];
  followUpTasks: string[];
  version?: number;
}

export interface SharedExperience {
  id: string;
  title: string;
  category:
    | 'Game Night'
    | 'Outdoor'
    | 'Family Dinner'
    | 'Movie Night'
    | 'Weekend Adventure'
    | 'Shared Hobby'
    | 'Tradition';
  date: string;
  location?: string;
  participants: string;
  notes: string;
  highlights?: string;
  attachments?: RelationshipAttachment[];
  completed?: boolean;
  version?: number;
}

export interface AgreementRecord {
  id: string;
  topic: string;
  category?:
    | 'Communication'
    | 'Tech & Presence'
    | 'Conflict Repair'
    | 'Shared Responsibilities'
    | 'Hospitality';
  reflectionPrompt: string;
  sharedAgreement: string;
  commitments?: string[];
  followUpAction: string;
  reviewDate: string;
  versionNumber?: number;
  versionHistory?: Array<{
    version: number;
    date: string;
    updatedBy: string;
    summary: string;
  }>;
  reflections?: Array<{
    id: string;
    author: string;
    date: string;
    note: string;
  }>;
  completed?: boolean;
  version?: number;
}

export interface ExternalContact {
  id: string;
  name: string;
  category:
    | 'EXTENDED_FAMILY'
    | 'FRIEND'
    | 'NEIGHBOR'
    | 'MENTOR'
    | 'COMMUNITY'
    | 'PROFESSIONAL';
  tags?: string[];
  phone?: string;
  email?: string;
  location?: string;
  birthday?: string;
  importantEvent?: string;
  checkInCadence: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';
  lastCheckedIn?: string;
  nextFollowUpDate?: string;
  notes?: string;
  interactionHistory: Array<{
    id: string;
    date: string;
    method: 'Call' | 'Message' | 'Email' | 'Coffee / Meetup' | 'Visit' | 'Other';
    summary: string;
  }>;
  version?: number;
}

export const GUIDED_CHECKIN_PROMPTS = [
  'What was one moment this week where you felt genuinely supported by someone in our home?',
  'How can our family help lighten your load or create space for rest in the coming days?',
  'What is one small routine or shared moment you would love to protect this week?',
  'Where did you feel the most calm and connected over the last few days?',
  'Is there anything unsaid or weighing on your mind that you would like gentle listening for?',
];

export const DEFAULT_MEETING_TEMPLATES: MeetingTemplate[] = [
  {
    id: 'tpl-sunday-huddle',
    title: 'Sunday Evening Family Huddle',
    description: 'Warm weekly check-in to celebrate wins, align schedules, and assign household helpers.',
    agendaItems: [
      'Share one appreciation or highlight from the past week',
      'Review school, work, and activity rides for Monday–Friday',
      'Choose Friday family meal and weekend outing idea',
      'Check in on anyone needing extra support this week',
    ],
    followUpTasks: [
      'Post weekly meal plan on kitchen board',
      'Prepare Monday morning backpacks and lunches',
      'Confirm weekend family time slot on shared calendar',
    ],
  },
  {
    id: 'tpl-monthly-rhythm',
    title: 'Monthly Household Rhythm & Charter Review',
    description: 'Reflect on shared family agreements, screen-free habits, and hospitality plans.',
    agendaItems: [
      'Celebrate a family agreement that went well this month',
      'Adjust morning or evening routines that felt rushed',
      'Plan upcoming birthdays, extended family calls, or hosting',
    ],
    followUpTasks: [
      'Update shared agreement notes if routines shifted',
      'Reach out to extended family contacts due for a catch-up',
    ],
  },
  {
    id: 'tpl-holiday-gathering',
    title: 'Seasonal & Holiday Gathering Planner',
    description: 'Coordinate travel, traditions, guest preparation, and shared cooking roles.',
    agendaItems: [
      'Decide which family traditions are most meaningful to keep simple',
      'Coordinate travel dates or guest room preparation',
      'Divide meal preparation and hosting tasks fairly',
    ],
    followUpTasks: [
      'Confirm travel or guest arrival times',
      'Add shared grocery ingredients to Household list',
    ],
  },
];

// Helper for reading uploaded files as base64 data URLs
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

// ============================================================================
// 1. CHECK-IN FORM MODAL
// ============================================================================
export const CheckInFormModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  initialRecord: CheckInRecord | null;
  currentUserName: string;
  isSaving: boolean;
  onSave: (payload: Omit<CheckInRecord, 'id' | 'author' | 'date'>) => Promise<void>;
}> = ({ isOpen, onClose, initialRecord, currentUserName, isSaving, onSave }) => {
  const [type, setType] = useState<CheckInRecord['type']>('WEEKLY');
  const [pulseLabel, setPulseLabel] = useState<NonNullable<CheckInRecord['pulseLabel']>>('Connected & Grounded');
  const [promptQuestion, setPromptQuestion] = useState<string>(GUIDED_CHECKIN_PROMPTS[0]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [weekSummary, setWeekSummary] = useState('');
  const [wentWell, setWentWell] = useState('');
  const [couldImprove, setCouldImprove] = useState('');
  const [supportNeeded, setSupportNeeded] = useState('');
  const [gratitude, setGratitude] = useState('');
  const [togetherIdea, setTogetherIdea] = useState('');
  const [followUpAction, setFollowUpAction] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (initialRecord) {
      setType(initialRecord.type || 'WEEKLY');
      setPulseLabel(initialRecord.pulseLabel || 'Connected & Grounded');
      setPromptQuestion(initialRecord.promptQuestion || GUIDED_CHECKIN_PROMPTS[0]);
      setIsPrivate(Boolean(initialRecord.isPrivate));
      setWeekSummary(initialRecord.weekSummary || '');
      setWentWell(initialRecord.wentWell || '');
      setCouldImprove(initialRecord.couldImprove || '');
      setSupportNeeded(initialRecord.supportNeeded || '');
      setGratitude(initialRecord.gratitude || '');
      setTogetherIdea(initialRecord.togetherIdea || '');
      setFollowUpAction(initialRecord.followUpAction || '');
    } else {
      setType('WEEKLY');
      setPulseLabel('Connected & Grounded');
      setPromptQuestion(GUIDED_CHECKIN_PROMPTS[0]);
      setIsPrivate(false);
      setWeekSummary('');
      setWentWell('');
      setCouldImprove('');
      setSupportNeeded('');
      setGratitude('');
      setTogetherIdea('');
      setFollowUpAction('');
    }
  }, [isOpen, initialRecord]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weekSummary.trim() && !wentWell.trim()) {
      setError('Please share a brief reflection on how things are going or what went well.');
      return;
    }
    setError(null);
    await onSave({
      type,
      pulseLabel,
      promptQuestion,
      isPrivate,
      weekSummary: weekSummary.trim() || 'Reflected on recent rhythms and connection.',
      wentWell: wentWell.trim() || 'Shared warm moments together.',
      couldImprove: couldImprove.trim(),
      supportNeeded: supportNeeded.trim() || 'Unrushed conversation and steady rhythms.',
      gratitude: gratitude.trim() || 'Grateful for household care and patience.',
      togetherIdea: togetherIdea.trim(),
      followUpAction: followUpAction.trim() || 'Check in again next week.',
      actionCompleted: initialRecord?.actionCompleted || false,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-stone-200 max-w-2xl w-full p-6 sm:p-7 shadow-xl space-y-5 my-8">
        <div className="flex items-start justify-between gap-4 border-b border-stone-100 pb-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              Guided Reflection • {currentUserName}
            </span>
            <h3 className="text-xl font-serif font-bold text-stone-900 mt-0.5">
              {initialRecord ? 'Edit Relationship Check-in' : 'New Relationship Check-in'}
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Qualitative reflection without scores—share with the household or keep private to yourself.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-semibold text-stone-700 block mb-1">Cadence</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as CheckInRecord['type'])}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-stone-800"
              >
                <option value="WEEKLY">Weekly Check-in</option>
                <option value="MONTHLY">Monthly Reflection</option>
                <option value="MOMENT">Moment-in-Time</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-stone-700 block mb-1">Current Feeling / Pulse</label>
              <select
                value={pulseLabel}
                onChange={(e) => setPulseLabel(e.target.value as NonNullable<CheckInRecord['pulseLabel']>)}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-stone-800"
              >
                <option value="Connected & Grounded">Connected & Grounded</option>
                <option value="Grateful & Energized">Grateful & Energized</option>
                <option value="Reflective & Quiet">Reflective & Quiet</option>
                <option value="Stretched — Needs Support">Stretched — Needs Support</option>
                <option value="Seeking Quality Time">Seeking Quality Time</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-stone-700 block mb-1">Privacy Boundary</label>
              <button
                type="button"
                onClick={() => setIsPrivate(!isPrivate)}
                className={`w-full px-3 py-2 rounded-xl border font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                  isPrivate
                    ? 'bg-amber-50 border-amber-300 text-amber-950'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-950'
                }`}
              >
                {isPrivate ? <Lock className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
                <span>{isPrivate ? 'Private to Me' : 'Shared with Family'}</span>
              </button>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-stone-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Guided Reflection Prompt</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  const idx = GUIDED_CHECKIN_PROMPTS.indexOf(promptQuestion);
                  const next = GUIDED_CHECKIN_PROMPTS[(idx + 1) % GUIDED_CHECKIN_PROMPTS.length];
                  setPromptQuestion(next);
                }}
                className="text-[11px] font-semibold text-emerald-800 hover:underline cursor-pointer"
              >
                Try Another Prompt →
              </button>
            </div>
            <p className="text-xs italic text-stone-700">“{promptQuestion}”</p>
          </div>

          <div>
            <label className="font-semibold text-stone-700 block mb-1">
              Reflection & Overview *
            </label>
            <textarea
              rows={2}
              value={weekSummary}
              onChange={(e) => setWeekSummary(e.target.value)}
              placeholder="Share your reflection on the prompt or how the week felt..."
              className="w-full px-3 py-2 rounded-xl border border-stone-200"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-stone-700 block mb-1">What Felt Meaningful or Went Well</label>
              <input
                type="text"
                value={wentWell}
                onChange={(e) => setWentWell(e.target.value)}
                placeholder="Peaceful dinners, teamwork, shared laughter..."
                className="w-full px-3 py-2 rounded-xl border border-stone-200"
              />
            </div>
            <div>
              <label className="font-semibold text-stone-700 block mb-1">Support or Care Needed Next</label>
              <input
                type="text"
                value={supportNeeded}
                onChange={(e) => setSupportNeeded(e.target.value)}
                placeholder="How family members can support you..."
                className="w-full px-3 py-2 rounded-xl border border-stone-200"
              />
            </div>
            <div>
              <label className="font-semibold text-stone-700 block mb-1">Gratitude Moment</label>
              <input
                type="text"
                value={gratitude}
                onChange={(e) => setGratitude(e.target.value)}
                placeholder="Someone or something you appreciate..."
                className="w-full px-3 py-2 rounded-xl border border-stone-200"
              />
            </div>
            <div>
              <label className="font-semibold text-stone-700 block mb-1">Gentle Follow-up Intention</label>
              <input
                type="text"
                value={followUpAction}
                onChange={(e) => setFollowUpAction(e.target.value)}
                placeholder="Small next step or connection idea..."
                className="w-full px-3 py-2 rounded-xl border border-stone-200"
              />
            </div>
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
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-[#173D35] text-white font-semibold hover:bg-emerald-950 disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? 'Saving...' : initialRecord ? 'Save Check-in Changes' : 'Save Check-in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 2. GRATITUDE & APPRECIATION FORM MODAL (with Photo Attachment Support)
// ============================================================================
export const GratitudeFormModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  initialNote: GratitudeNote | null;
  recipientOptions: string[];
  isSaving: boolean;
  onSave: (payload: {
    to: string;
    category: GratitudeNote['category'];
    message: string;
    attachments: RelationshipAttachment[];
  }) => Promise<void>;
}> = ({ isOpen, onClose, initialNote, recipientOptions, isSaving, onSave }) => {
  const [to, setTo] = useState(recipientOptions[0] || 'Whole Family');
  const [category, setCategory] = useState<GratitudeNote['category']>('Appreciation');
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<RelationshipAttachment[]>([]);
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setPhotoUrlInput('');
    if (initialNote) {
      setTo(initialNote.to || recipientOptions[0] || 'Whole Family');
      setCategory(initialNote.category || 'Appreciation');
      setMessage(initialNote.message || '');
      setAttachments(initialNote.attachments || []);
    } else {
      setTo(recipientOptions[0] || 'Whole Family');
      setCategory('Appreciation');
      setMessage('');
      setAttachments([]);
    }
  }, [isOpen, initialNote, recipientOptions]);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1500 * 1024) {
      setError('Please choose an image smaller than 1.5 MB.');
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setAttachments((prev) => [
        ...prev,
        {
          id: `att-${Date.now()}`,
          name: file.name,
          type: 'PHOTO',
          dataUrl,
          uploadedAt: new Date().toISOString().slice(0, 10),
        },
      ]);
      setError(null);
    } catch {
      setError('Could not read image file.');
    }
  };

  const handleAddPhotoUrl = () => {
    if (!photoUrlInput.trim()) return;
    setAttachments((prev) => [
      ...prev,
      {
        id: `att-${Date.now()}`,
        name: 'Attached Photo',
        type: 'PHOTO',
        dataUrl: photoUrlInput.trim(),
        uploadedAt: new Date().toISOString().slice(0, 10),
      },
    ]);
    setPhotoUrlInput('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setError('Please write a warm note of appreciation before posting.');
      return;
    }
    setError(null);
    await onSave({
      to: to.trim() || 'Whole Family',
      category,
      message: message.trim(),
      attachments,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-stone-200 max-w-lg w-full p-6 sm:p-7 shadow-xl space-y-5 my-8">
        <div className="flex items-start justify-between gap-4 border-b border-stone-100 pb-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
              Gratitude & Appreciation Wall
            </span>
            <h3 className="text-xl font-serif font-bold text-stone-900 mt-0.5">
              {initialNote ? 'Edit Appreciation Note' : 'Share Appreciation Note'}
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Celebrate everyday kindness, encouragement, and thoughtful moments across the household.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-stone-700 block mb-1">To Family Member</label>
              <select
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-stone-800"
              >
                {recipientOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-semibold text-stone-700 block mb-1">Kind of Recognition</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as GratitudeNote['category'])}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-stone-800"
              >
                <option value="Appreciation">Everyday Appreciation</option>
                <option value="Thank You">Thank You</option>
                <option value="Encouragement">Encouragement</option>
                <option value="Kindness">Thoughtful Kindness</option>
                <option value="Milestone">Family Milestone</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-semibold text-stone-700 block mb-1">Appreciation Message *</label>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write a warm, specific note of gratitude..."
              className="w-full px-3 py-2 rounded-xl border border-stone-200"
            />
          </div>

          {/* Optional Photo Attachment */}
          <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-stone-700 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-stone-500" />
                <span>Optional Photo Snapshot</span>
              </span>
              <label className="px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-stone-700 font-semibold hover:bg-stone-100 cursor-pointer flex items-center gap-1">
                <Upload className="w-3 h-3" />
                <span>Upload Photo</span>
                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </label>
            </div>

            <div className="flex gap-2">
              <input
                type="url"
                value={photoUrlInput}
                onChange={(e) => setPhotoUrlInput(e.target.value)}
                placeholder="Or paste an image URL..."
                className="flex-1 px-3 py-1.5 rounded-xl border border-stone-200 bg-white"
              />
              <button
                type="button"
                onClick={handleAddPhotoUrl}
                className="px-3 py-1.5 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 font-semibold cursor-pointer"
              >
                Attach
              </button>
            </div>

            {attachments.length > 0 && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="relative rounded-xl overflow-hidden border border-stone-200 bg-white p-1.5 flex items-center gap-2"
                  >
                    <img
                      src={att.dataUrl}
                      alt={att.name}
                      className="w-10 h-10 rounded-lg object-cover shrink-0 bg-stone-100"
                    />
                    <span className="text-[11px] text-stone-700 truncate flex-1">{att.name}</span>
                    <button
                      type="button"
                      onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                      className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
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
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-[#173D35] text-white font-semibold hover:bg-emerald-950 disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? 'Posting...' : initialNote ? 'Update Note' : 'Post to Wall'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 3. COUPLE CONNECTION FORM MODAL (Partner-Only Space)
// ============================================================================
export const CoupleConnectionFormModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  initialPlan: CouplePlan | null;
  isSaving: boolean;
  onSave: (payload: Omit<CouplePlan, 'id'>) => Promise<void>;
}> = ({ isOpen, onClose, initialPlan, isSaving, onSave }) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<CouplePlan['category']>('Date Night');
  const [date, setDate] = useState('');
  const [connectionPulse, setConnectionPulse] = useState<NonNullable<CouplePlan['connectionPulse']>>('Aligned & Connected');
  const [alignmentTopic, setAlignmentTopic] = useState<NonNullable<CouplePlan['alignmentTopic']>>('Household Rhythms');
  const [sharedDecision, setSharedDecision] = useState('');
  const [notes, setNotes] = useState('');
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (initialPlan) {
      setTitle(initialPlan.title || '');
      setCategory(initialPlan.category || 'Date Night');
      setDate(initialPlan.date || '');
      setConnectionPulse(initialPlan.connectionPulse || 'Aligned & Connected');
      setAlignmentTopic(initialPlan.alignmentTopic || 'Household Rhythms');
      setSharedDecision(initialPlan.sharedDecision || '');
      setNotes(initialPlan.notes || '');
      setCompleted(Boolean(initialPlan.completed));
    } else {
      setTitle('');
      setCategory('Date Night');
      setDate(new Date().toISOString().slice(0, 10));
      setConnectionPulse('Aligned & Connected');
      setAlignmentTopic('Household Rhythms');
      setSharedDecision('');
      setNotes('');
      setCompleted(false);
    }
  }, [isOpen, initialPlan]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please enter a title for this partner check-in, date idea, or alignment note.');
      return;
    }
    setError(null);
    await onSave({
      title: title.trim(),
      category,
      date: date.trim() || 'Flexible Timing',
      connectionPulse,
      alignmentTopic: category === 'Alignment Note' ? alignmentTopic : undefined,
      sharedDecision: sharedDecision.trim() || undefined,
      notes: notes.trim() || 'Intentional partner time and alignment.',
      isPrivate: true,
      completed,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-stone-200 max-w-lg w-full p-6 sm:p-7 shadow-xl space-y-5 my-8">
        <div className="flex items-start justify-between gap-4 border-b border-stone-100 pb-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              <span>Partner-Only Enclave</span>
            </span>
            <h3 className="text-xl font-serif font-bold text-stone-900 mt-0.5">
              {initialPlan ? 'Edit Partner Entry' : 'New Couple Connection Entry'}
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Private to household partners (Owners & Admins)—log a partner check-in, date idea, or alignment note.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-stone-700 block mb-1">Entry Type</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as CouplePlan['category'])}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-stone-800"
              >
                <option value="Date Night">Shared Date Idea</option>
                <option value="Partner Check-in">Private Partner Check-in</option>
                <option value="Alignment Note">Couple Alignment Note</option>
                <option value="Milestone">Relationship Milestone</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-stone-700 block mb-1">Date or Target Timing</label>
              <input
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder="e.g. Friday 7:30 PM or 2026-11-14"
                className="w-full px-3 py-2 rounded-xl border border-stone-200"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-stone-700 block mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                category === 'Date Night'
                  ? 'e.g. Evening Patio Coffee & Unhurried Walk'
                  : category === 'Alignment Note'
                  ? 'e.g. Holiday Travel & Rest Boundaries'
                  : 'e.g. Mid-Week Partner Check-in'
              }
              className="w-full px-3 py-2 rounded-xl border border-stone-200"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-stone-700 block mb-1">Connection Pulse</label>
              <select
                value={connectionPulse}
                onChange={(e) =>
                  setConnectionPulse(e.target.value as NonNullable<CouplePlan['connectionPulse']>)
                }
                className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-stone-800"
              >
                <option value="Aligned & Connected">Aligned & Connected</option>
                <option value="Needs Unhurried Time">Needs Unhurried Time</option>
                <option value="Deep Appreciation">Deep Appreciation</option>
                <option value="Working Through Together">Working Through Together</option>
              </select>
            </div>
            {category === 'Alignment Note' && (
              <div>
                <label className="font-semibold text-stone-700 block mb-1">Alignment Domain</label>
                <select
                  value={alignmentTopic}
                  onChange={(e) =>
                    setAlignmentTopic(e.target.value as NonNullable<CouplePlan['alignmentTopic']>)
                  }
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-stone-800"
                >
                  <option value="Household Rhythms">Household Rhythms</option>
                  <option value="Parenting & Kids">Parenting & Kids</option>
                  <option value="Finances & Stewardship">Finances & Stewardship</option>
                  <option value="Rest & Intimacy">Rest & Intimacy</option>
                  <option value="Future Vision">Future Vision</option>
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="font-semibold text-stone-700 block mb-1">
              {category === 'Date Night'
                ? 'Date Details & Conversation Ideas'
                : 'Reflection & Notes'}
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Write private notes, conversation prompts, or preparation ideas..."
              className="w-full px-3 py-2 rounded-xl border border-stone-200"
            />
          </div>

          {(category === 'Alignment Note' || category === 'Partner Check-in') && (
            <div>
              <label className="font-semibold text-stone-700 block mb-1">
                Shared Understanding / Next Step
              </label>
              <input
                type="text"
                value={sharedDecision}
                onChange={(e) => setSharedDecision(e.target.value)}
                placeholder="What we agreed on or want to remember together..."
                className="w-full px-3 py-2 rounded-xl border border-stone-200"
              />
            </div>
          )}

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
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-[#173D35] text-white font-semibold hover:bg-emerald-950 disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? 'Saving...' : initialPlan ? 'Save Partner Entry' : 'Save to Couple Space'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 4. FAMILY MEETING FORM MODAL & AGENDA/CHECKLIST SLIDE-OVER DRAWER
// ============================================================================
export const FamilyMeetingFormModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  initialMeeting: FamilyMeeting | null;
  templates: MeetingTemplate[];
  defaultFacilitator: string;
  isSaving: boolean;
  onSave: (payload: Omit<FamilyMeeting, 'id'>) => Promise<void>;
}> = ({ isOpen, onClose, initialMeeting, templates, defaultFacilitator, isSaving, onSave }) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [facilitator, setFacilitator] = useState(defaultFacilitator);
  const [participants, setParticipants] = useState('Whole Family');
  const [agendaText, setAgendaText] = useState('');
  const [decisionsText, setDecisionsText] = useState('');
  const [tasksText, setTasksText] = useState('');
  const [meetingNotes, setMeetingNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (initialMeeting) {
      setTitle(initialMeeting.title || '');
      setDate(initialMeeting.date || '');
      setFacilitator(initialMeeting.facilitator || defaultFacilitator);
      setParticipants(initialMeeting.participants || 'Whole Family');
      setAgendaText((initialMeeting.agendaItems || []).join('\n'));
      setDecisionsText((initialMeeting.decisions || []).join('\n'));
      setTasksText((initialMeeting.followUpTasks || []).join('\n'));
      setMeetingNotes(initialMeeting.meetingNotes || '');
    } else {
      setTitle('');
      setDate(new Date().toISOString().slice(0, 10));
      setFacilitator(defaultFacilitator);
      setParticipants('Whole Family');
      setAgendaText('');
      setDecisionsText('');
      setTasksText('');
      setMeetingNotes('');
    }
  }, [isOpen, initialMeeting, defaultFacilitator]);

  if (!isOpen) return null;

  const applyTemplate = (tpl: MeetingTemplate) => {
    if (!title.trim()) setTitle(tpl.title);
    setAgendaText(tpl.agendaItems.join('\n'));
    setTasksText(tpl.followUpTasks.join('\n'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const agendaItems = agendaText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!title.trim() || agendaItems.length === 0) {
      setError('Please provide a meeting title and at least one agenda topic (one per line).');
      return;
    }
    const decisions = decisionsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const followUpTasks = tasksText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    await onSave({
      title: title.trim(),
      date: date.trim() || new Date().toISOString().slice(0, 10),
      facilitator: facilitator.trim() || defaultFacilitator,
      participants: participants.trim() || 'Whole Family',
      status: initialMeeting?.status || 'UPCOMING',
      agendaItems,
      discussedAgendaIndices: initialMeeting?.discussedAgendaIndices || [],
      decisions: decisions.length > 0 ? decisions : ['Open family discussion'],
      followUpTasks,
      completedTaskIndices: initialMeeting?.completedTaskIndices || [],
      meetingNotes: meetingNotes.trim(),
      completed: Boolean(initialMeeting?.completed),
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-stone-200 max-w-2xl w-full p-6 sm:p-7 shadow-xl space-y-5 my-8">
        <div className="flex items-start justify-between gap-4 border-b border-stone-100 pb-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              Family Meetings & Discussions
            </span>
            <h3 className="text-xl font-serif font-bold text-stone-900 mt-0.5">
              {initialMeeting ? 'Edit Family Meeting' : 'Schedule Family Meeting'}
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Build a collaborative agenda or start from a reusable family huddle template.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Template Loader */}
        {templates.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-600 block">
              Load Reusable Agenda & Action Checklist Template
            </span>
            <div className="flex flex-wrap gap-2">
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => applyTemplate(tpl)}
                  className="px-3 py-1.5 rounded-xl bg-white border border-stone-200 hover:border-emerald-700 text-xs font-semibold text-stone-800 cursor-pointer"
                >
                  + {tpl.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-stone-700 block mb-1">Meeting Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Sunday Evening Family Huddle"
                className="w-full px-3 py-2 rounded-xl border border-stone-200"
              />
            </div>
            <div>
              <label className="font-semibold text-stone-700 block mb-1">Date & Time</label>
              <input
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder="e.g. Sunday 6:00 PM or 2026-11-08"
                className="w-full px-3 py-2 rounded-xl border border-stone-200"
              />
            </div>
            <div>
              <label className="font-semibold text-stone-700 block mb-1">Facilitator</label>
              <input
                type="text"
                value={facilitator}
                onChange={(e) => setFacilitator(e.target.value)}
                placeholder="Facilitator name"
                className="w-full px-3 py-2 rounded-xl border border-stone-200"
              />
            </div>
            <div>
              <label className="font-semibold text-stone-700 block mb-1">Participants</label>
              <input
                type="text"
                value={participants}
                onChange={(e) => setParticipants(e.target.value)}
                placeholder="e.g. Whole Family"
                className="w-full px-3 py-2 rounded-xl border border-stone-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-stone-700 block mb-1">
                Discussion Agenda Points * (one per line)
              </label>
              <textarea
                rows={4}
                value={agendaText}
                onChange={(e) => setAgendaText(e.target.value)}
                placeholder={'Celebrate weekly wins\nCoordinate school rides\nPick Friday family dinner'}
                className="w-full px-3 py-2 rounded-xl border border-stone-200"
              />
            </div>
            <div>
              <label className="font-semibold text-stone-700 block mb-1">
                Action-Item Checklist (one per line)
              </label>
              <textarea
                rows={4}
                value={tasksText}
                onChange={(e) => setTasksText(e.target.value)}
                placeholder={'Post meal plan on kitchen board\nPack sports gear on Thursday night'}
                className="w-full px-3 py-2 rounded-xl border border-stone-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-stone-700 block mb-1">
                Key Family Decisions (one per line)
              </label>
              <textarea
                rows={2}
                value={decisionsText}
                onChange={(e) => setDecisionsText(e.target.value)}
                placeholder="Shared agreements reached together..."
                className="w-full px-3 py-2 rounded-xl border border-stone-200"
              />
            </div>
            <div>
              <label className="font-semibold text-stone-700 block mb-1">Meeting Notes</label>
              <textarea
                rows={2}
                value={meetingNotes}
                onChange={(e) => setMeetingNotes(e.target.value)}
                placeholder="Summary notes or highlights to archive..."
                className="w-full px-3 py-2 rounded-xl border border-stone-200"
              />
            </div>
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
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-[#173D35] text-white font-semibold hover:bg-emerald-950 disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? 'Saving...' : initialMeeting ? 'Update Meeting' : 'Save Meeting Agenda'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const FamilyMeetingDetailDrawer: React.FC<{
  meeting: FamilyMeeting | null;
  onClose: () => void;
  canMutate: boolean;
  onUpdateMeeting: (updated: FamilyMeeting) => Promise<void>;
}> = ({ meeting, onClose, canMutate, onUpdateMeeting }) => {
  const [newAgendaPoint, setNewAgendaPoint] = useState('');
  const [newTaskItem, setNewTaskItem] = useState('');
  const [notesDraft, setNotesDraft] = useState('');

  useEffect(() => {
    if (meeting) {
      setNotesDraft(meeting.meetingNotes || '');
    }
  }, [meeting]);

  if (!meeting) return null;

  const discussedIndices = meeting.discussedAgendaIndices || [];
  const completedTaskIndices = meeting.completedTaskIndices || [];

  const toggleAgendaIndex = async (idx: number) => {
    if (!canMutate) return;
    const exists = discussedIndices.includes(idx);
    const next = exists ? discussedIndices.filter((i) => i !== idx) : [...discussedIndices, idx];
    await onUpdateMeeting({ ...meeting, discussedAgendaIndices: next });
  };

  const toggleTaskIndex = async (idx: number) => {
    if (!canMutate) return;
    const exists = completedTaskIndices.includes(idx);
    const next = exists ? completedTaskIndices.filter((i) => i !== idx) : [...completedTaskIndices, idx];
    await onUpdateMeeting({ ...meeting, completedTaskIndices: next });
  };

  const handleAddAgendaPoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgendaPoint.trim() || !canMutate) return;
    await onUpdateMeeting({
      ...meeting,
      agendaItems: [...(meeting.agendaItems || []), newAgendaPoint.trim()],
    });
    setNewAgendaPoint('');
  };

  const handleAddTaskItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskItem.trim() || !canMutate) return;
    await onUpdateMeeting({
      ...meeting,
      followUpTasks: [...(meeting.followUpTasks || []), newTaskItem.trim()],
    });
    setNewTaskItem('');
  };

  const handleSaveNotes = async () => {
    if (!canMutate) return;
    await onUpdateMeeting({
      ...meeting,
      meetingNotes: notesDraft.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/40 backdrop-blur-xs flex justify-end">
      <div className="bg-white w-full max-w-xl h-full shadow-2xl border-l border-stone-200 p-6 sm:p-7 overflow-y-auto flex flex-col justify-between space-y-6">
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4 border-b border-stone-100 pb-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                Interactive Agenda & Action Checklist
              </span>
              <h3 className="text-xl font-serif font-bold text-stone-900 mt-0.5">{meeting.title}</h3>
              <p className="text-xs text-stone-500 mt-0.5">
                {meeting.date} • Facilitator: {meeting.facilitator || 'Family'} • {meeting.participants}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Interactive Discussion Points */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                Discussion Topics ({discussedIndices.length}/{(meeting.agendaItems || []).length} Discussed)
              </h4>
            </div>
            <div className="space-y-2">
              {(meeting.agendaItems || []).map((item, idx) => {
                const isDone = discussedIndices.includes(idx);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => void toggleAgendaIndex(idx)}
                    className={`w-full p-3 rounded-2xl border text-left flex items-center gap-3 transition-colors cursor-pointer ${
                      isDone
                        ? 'bg-emerald-50/60 border-emerald-200 text-stone-500 line-through'
                        : 'bg-stone-50 border-stone-200/80 text-stone-900 hover:bg-stone-100/70'
                    }`}
                  >
                    {isDone ? (
                      <CheckSquare className="w-4 h-4 text-emerald-700 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-stone-400 shrink-0" />
                    )}
                    <span className="text-xs font-medium">{item}</span>
                  </button>
                );
              })}
            </div>
            {canMutate && (
              <form onSubmit={handleAddAgendaPoint} className="flex gap-2">
                <input
                  type="text"
                  value={newAgendaPoint}
                  onChange={(e) => setNewAgendaPoint(e.target.value)}
                  placeholder="Add a discussion point..."
                  className="flex-1 px-3 py-2 rounded-xl border border-stone-200 text-xs"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-xl bg-stone-900 text-white text-xs font-semibold cursor-pointer"
                >
                  + Topic
                </button>
              </form>
            )}
          </div>

          {/* Action-Item Checklist */}
          <div className="space-y-3 pt-2 border-t border-stone-100">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700">
              Action-Item Checklist ({completedTaskIndices.length}/{(meeting.followUpTasks || []).length} Completed)
            </h4>
            <div className="space-y-2">
              {(meeting.followUpTasks || []).length === 0 ? (
                <p className="text-xs text-stone-400 italic">No follow-up action items added yet.</p>
              ) : (
                (meeting.followUpTasks || []).map((task, idx) => {
                  const isDone = completedTaskIndices.includes(idx);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => void toggleTaskIndex(idx)}
                      className={`w-full p-3 rounded-2xl border text-left flex items-center gap-3 transition-colors cursor-pointer ${
                        isDone
                          ? 'bg-emerald-50/60 border-emerald-200 text-stone-500 line-through'
                          : 'bg-white border-stone-200 text-stone-900 hover:bg-stone-50'
                      }`}
                    >
                      {isDone ? (
                        <CheckSquare className="w-4 h-4 text-emerald-700 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-stone-400 shrink-0" />
                      )}
                      <span className="text-xs font-medium">{task}</span>
                    </button>
                  );
                })
              )}
            </div>
            {canMutate && (
              <form onSubmit={handleAddTaskItem} className="flex gap-2">
                <input
                  type="text"
                  value={newTaskItem}
                  onChange={(e) => setNewTaskItem(e.target.value)}
                  placeholder="Add an action item..."
                  className="flex-1 px-3 py-2 rounded-xl border border-stone-200 text-xs"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-xl bg-stone-900 text-white text-xs font-semibold cursor-pointer"
                >
                  + Action
                </button>
              </form>
            )}
          </div>

          {/* Meeting Notes & Archive Controls */}
          <div className="space-y-2 pt-2 border-t border-stone-100">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-700 block">
              Archived Meeting Notes & Summary
            </label>
            <textarea
              rows={3}
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              disabled={!canMutate}
              placeholder="Record warm takeaways, decisions, and notes from this family discussion..."
              className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs"
            />
            {canMutate && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleSaveNotes()}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-900 text-white text-xs font-semibold cursor-pointer"
                >
                  Save Notes
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-stone-100 flex items-center justify-between">
          {canMutate && (
            <button
              type="button"
              onClick={() =>
                void onUpdateMeeting({
                  ...meeting,
                  completed: !meeting.completed,
                  status: !meeting.completed ? 'ARCHIVED' : 'UPCOMING',
                })
              }
              className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
            >
              {meeting.completed ? 'Move Back to Active' : 'Mark Completed & Archive'}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#173D35] text-white text-xs font-semibold cursor-pointer ml-auto"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export const MeetingTemplatesModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  templates: MeetingTemplate[];
  canMutate: boolean;
  onCreateTemplate: (tpl: Omit<MeetingTemplate, 'id'>) => Promise<void>;
  onDeleteTemplate: (id: string) => Promise<void>;
}> = ({ isOpen, onClose, templates, canMutate, onCreateTemplate, onDeleteTemplate }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [agendaText, setAgendaText] = useState('');
  const [tasksText, setTasksText] = useState('');

  if (!isOpen) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !agendaText.trim()) return;
    await onCreateTemplate({
      title: title.trim(),
      description: description.trim() || 'Reusable family discussion & checklist template.',
      agendaItems: agendaText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      followUpTasks: tasksText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    });
    setTitle('');
    setDescription('');
    setAgendaText('');
    setTasksText('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-stone-200 max-w-2xl w-full p-6 sm:p-7 shadow-xl space-y-5 my-8">
        <div className="flex items-start justify-between gap-4 border-b border-stone-100 pb-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              Reusable Checklist Templates
            </span>
            <h3 className="text-xl font-serif font-bold text-stone-900 mt-0.5">
              Family Meeting Agenda & Checklist Templates
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Standardize recurring family discussions and follow-up checklists.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
          {templates.map((tpl) => {
            const isBuiltIn = tpl.id.startsWith('tpl-');
            return (
              <div
                key={tpl.id}
                className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 flex items-start justify-between gap-3"
              >
                <div className="space-y-1 text-xs">
                  <div className="font-bold text-stone-900">{tpl.title}</div>
                  <p className="text-stone-500">{tpl.description}</p>
                  <div className="text-[11px] text-emerald-900 font-medium">
                    {tpl.agendaItems.length} agenda points • {tpl.followUpTasks.length} checklist items
                  </div>
                </div>
                {canMutate && !isBuiltIn && (
                  <button
                    type="button"
                    onClick={() => void onDeleteTemplate(tpl.id)}
                    className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {canMutate && (
          <form onSubmit={handleAdd} className="space-y-3 pt-4 border-t border-stone-100 text-xs">
            <h4 className="font-bold text-stone-900">Create Custom Meeting Template</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Template Name (e.g. Monthly Tech Reset) *"
                className="px-3 py-2 rounded-xl border border-stone-200"
              />
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description..."
                className="px-3 py-2 rounded-xl border border-stone-200"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <textarea
                rows={3}
                value={agendaText}
                onChange={(e) => setAgendaText(e.target.value)}
                placeholder="Agenda topics (one per line) *"
                className="px-3 py-2 rounded-xl border border-stone-200"
              />
              <textarea
                rows={3}
                value={tasksText}
                onChange={(e) => setTasksText(e.target.value)}
                placeholder="Default checklist items (one per line)"
                className="px-3 py-2 rounded-xl border border-stone-200"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#173D35] text-white font-semibold cursor-pointer"
              >
                + Save Template
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 5. SHARED EXPERIENCES FORM MODAL (with Photo & Document Attachments)
// ============================================================================
export const SharedExperienceFormModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  initialExperience: SharedExperience | null;
  isSaving: boolean;
  onSave: (payload: Omit<SharedExperience, 'id'>) => Promise<void>;
}> = ({ isOpen, onClose, initialExperience, isSaving, onSave }) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<SharedExperience['category']>('Game Night');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [participants, setParticipants] = useState('Whole Family');
  const [notes, setNotes] = useState('');
  const [completed, setCompleted] = useState(false);
  const [attachments, setAttachments] = useState<RelationshipAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (initialExperience) {
      setTitle(initialExperience.title || '');
      setCategory(initialExperience.category || 'Game Night');
      setDate(initialExperience.date || '');
      setLocation(initialExperience.location || '');
      setParticipants(initialExperience.participants || 'Whole Family');
      setNotes(initialExperience.notes || '');
      setCompleted(Boolean(initialExperience.completed));
      setAttachments(initialExperience.attachments || []);
    } else {
      setTitle('');
      setCategory('Game Night');
      setDate(new Date().toISOString().slice(0, 10));
      setLocation('');
      setParticipants('Whole Family');
      setNotes('');
      setCompleted(false);
      setAttachments([]);
    }
  }, [isOpen, initialExperience]);

  if (!isOpen) return null;

  const handleAttachmentUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    attType: 'PHOTO' | 'DOCUMENT'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1500 * 1024) {
      setError('Attachment size must be under 1.5 MB.');
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setAttachments((prev) => [
        ...prev,
        {
          id: `exp-att-${Date.now()}`,
          name: file.name,
          type: attType,
          dataUrl,
          uploadedAt: new Date().toISOString().slice(0, 10),
        },
      ]);
      setError(null);
    } catch {
      setError('Could not read uploaded file.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please enter a title for this shared experience or memory.');
      return;
    }
    setError(null);
    await onSave({
      title: title.trim(),
      category,
      date: date.trim() || 'This Weekend',
      location: location.trim() || undefined,
      participants: participants.trim() || 'Whole Family',
      notes: notes.trim() || 'Meaningful shared family time.',
      attachments,
      completed,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-stone-200 max-w-xl w-full p-6 sm:p-7 shadow-xl space-y-5 my-8">
        <div className="flex items-start justify-between gap-4 border-b border-stone-100 pb-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              Shared Experiences & Memories
            </span>
            <h3 className="text-xl font-serif font-bold text-stone-900 mt-0.5">
              {initialExperience ? 'Edit Shared Experience' : 'Add Shared Experience or Memory'}
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Plan upcoming quality time or archive favorite family memories with photos and keepsake documents.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-stone-700 block mb-1">Experience Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Saturday Morning Pine Lake Trail Walk"
              className="w-full px-3 py-2 rounded-xl border border-stone-200"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-stone-700 block mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as SharedExperience['category'])}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-stone-800"
              >
                <option value="Game Night">Game Night</option>
                <option value="Outdoor">Outdoor Activity</option>
                <option value="Family Dinner">Family Dinner</option>
                <option value="Movie Night">Movie Night</option>
                <option value="Weekend Adventure">Weekend Adventure</option>
                <option value="Tradition">Family Tradition</option>
                <option value="Shared Hobby">Shared Hobby</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-stone-700 block mb-1">Date / Cadence</label>
              <input
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder="e.g. Every Friday or 2026-11-07"
                className="w-full px-3 py-2 rounded-xl border border-stone-200"
              />
            </div>
            <div>
              <label className="font-semibold text-stone-700 block mb-1">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Home Living Room or Pine Ridge Trail"
                className="w-full px-3 py-2 rounded-xl border border-stone-200"
              />
            </div>
            <div>
              <label className="font-semibold text-stone-700 block mb-1">Participants</label>
              <input
                type="text"
                value={participants}
                onChange={(e) => setParticipants(e.target.value)}
                placeholder="Whole Family"
                className="w-full px-3 py-2 rounded-xl border border-stone-200"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-stone-700 block mb-1">Story, Details & Highlights</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Capture preparation notes or favorite memories from the experience..."
              className="w-full px-3 py-2 rounded-xl border border-stone-200"
            />
          </div>

          {/* Photo & Document Attachments */}
          <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-stone-700">Photo & Document Keepsakes</span>
              <div className="flex items-center gap-2">
                <label className="px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-stone-700 font-semibold hover:bg-stone-100 cursor-pointer flex items-center gap-1">
                  <ImageIcon className="w-3 h-3" />
                  <span>+ Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => void handleAttachmentUpload(e, 'PHOTO')}
                    className="hidden"
                  />
                </label>
                <label className="px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-stone-700 font-semibold hover:bg-stone-100 cursor-pointer flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  <span>+ Document</span>
                  <input
                    type="file"
                    accept=".pdf,.txt,.png,.jpg,.jpeg"
                    onChange={(e) => void handleAttachmentUpload(e, 'DOCUMENT')}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {attachments.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="rounded-xl border border-stone-200 bg-white p-2 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {att.type === 'PHOTO' ? (
                        <img
                          src={att.dataUrl}
                          alt={att.name}
                          className="w-9 h-9 rounded-lg object-cover shrink-0 bg-stone-100"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-stone-600" />
                        </div>
                      )}
                      <div className="truncate">
                        <div className="text-[11px] font-semibold text-stone-800 truncate">{att.name}</div>
                        <div className="text-[10px] text-stone-400">{att.type}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                      className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-stone-100">
            <label className="flex items-center gap-2 cursor-pointer text-stone-700 font-medium">
              <input
                type="checkbox"
                checked={completed}
                onChange={(e) => setCompleted(e.target.checked)}
                className="rounded border-stone-300"
              />
              <span>Mark as Completed Family Memory</span>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-stone-200 text-stone-700 font-semibold hover:bg-stone-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-[#173D35] text-white font-semibold hover:bg-emerald-950 disabled:opacity-50 cursor-pointer"
              >
                {isSaving ? 'Saving...' : initialExperience ? 'Update Experience' : 'Save Experience'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 6. SHARED AGREEMENTS MODAL & VERSION HISTORY / REFLECTION DRAWER
// ============================================================================
export const SharedAgreementFormModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  initialAgreement: AgreementRecord | null;
  currentUserName: string;
  isSaving: boolean;
  onSave: (payload: Omit<AgreementRecord, 'id'>) => Promise<void>;
}> = ({ isOpen, onClose, initialAgreement, currentUserName, isSaving, onSave }) => {
  const [topic, setTopic] = useState('');
  const [category, setCategory] = useState<NonNullable<AgreementRecord['category']>>('Tech & Presence');
  const [reflectionPrompt, setReflectionPrompt] = useState('');
  const [sharedAgreement, setSharedAgreement] = useState('');
  const [commitmentsText, setCommitmentsText] = useState('');
  const [followUpAction, setFollowUpAction] = useState('');
  const [reviewDate, setReviewDate] = useState('Monthly Review');
  const [changeSummary, setChangeSummary] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setChangeSummary('');
    if (initialAgreement) {
      setTopic(initialAgreement.topic || '');
      setCategory(initialAgreement.category || 'Tech & Presence');
      setReflectionPrompt(
        initialAgreement.reflectionPrompt ||
          'How can we uphold this agreement with kindness and consistency?'
      );
      setSharedAgreement(initialAgreement.sharedAgreement || '');
      setCommitmentsText((initialAgreement.commitments || []).join('\n'));
      setFollowUpAction(initialAgreement.followUpAction || '');
      setReviewDate(initialAgreement.reviewDate || 'Monthly Review');
    } else {
      setTopic('');
      setCategory('Tech & Presence');
      setReflectionPrompt('How can we uphold this agreement with kindness and consistency?');
      setSharedAgreement('');
      setCommitmentsText('');
      setFollowUpAction('');
      setReviewDate('Monthly Review');
    }
  }, [isOpen, initialAgreement]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || !sharedAgreement.trim()) {
      setError('Both an agreement title and the shared charter statement are required.');
      return;
    }
    const nextVersionNumber = (initialAgreement?.versionNumber || 0) + 1;
    const prevHistory = initialAgreement?.versionHistory || [];
    const nextHistory = [
      {
        version: nextVersionNumber,
        date: new Date().toISOString().slice(0, 10),
        updatedBy: currentUserName,
        summary:
          changeSummary.trim() ||
          (initialAgreement ? 'Refined shared charter commitments.' : 'Initial family charter created.'),
      },
      ...prevHistory,
    ];

    await onSave({
      topic: topic.trim(),
      category,
      reflectionPrompt:
        reflectionPrompt.trim() || 'How can we uphold this agreement with kindness and consistency?',
      sharedAgreement: sharedAgreement.trim(),
      commitments: commitmentsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      followUpAction: followUpAction.trim() || 'Review together during Sunday huddle.',
      reviewDate: reviewDate.trim() || 'Monthly Review',
      versionNumber: nextVersionNumber,
      versionHistory: nextHistory,
      reflections: initialAgreement?.reflections || [],
      completed: Boolean(initialAgreement?.completed),
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-stone-200 max-w-xl w-full p-6 sm:p-7 shadow-xl space-y-5 my-8">
        <div className="flex items-start justify-between gap-4 border-b border-stone-100 pb-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              Living Family Charter & Reflection
            </span>
            <h3 className="text-xl font-serif font-bold text-stone-900 mt-0.5">
              {initialAgreement
                ? `Revise Agreement (v${(initialAgreement.versionNumber || 1) + 1})`
                : 'New Shared Family Agreement'}
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Co-create clear, compassionate household agreements with version history and periodic reflection.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-stone-700 block mb-1">Charter Topic *</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Screen-Free Family Dinner Table"
                className="w-full px-3 py-2 rounded-xl border border-stone-200"
              />
            </div>
            <div>
              <label className="font-semibold text-stone-700 block mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as NonNullable<AgreementRecord['category']>)}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-stone-800"
              >
                <option value="Tech & Presence">Tech & Presence</option>
                <option value="Communication">Warm Communication</option>
                <option value="Conflict Repair">Calm Conflict Repair</option>
                <option value="Shared Responsibilities">Shared Responsibilities</option>
                <option value="Hospitality">Hospitality & Rest</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-semibold text-stone-700 block mb-1">Guiding Reflection Question</label>
            <input
              type="text"
              value={reflectionPrompt}
              onChange={(e) => setReflectionPrompt(e.target.value)}
              placeholder="How can we make evening meals feel unhurried and connected?"
              className="w-full px-3 py-2 rounded-xl border border-stone-200"
            />
          </div>

          <div>
            <label className="font-semibold text-stone-700 block mb-1">Our Shared Agreement Statement *</label>
            <textarea
              rows={2}
              value={sharedAgreement}
              onChange={(e) => setSharedAgreement(e.target.value)}
              placeholder="Describe the core principle our household commits to..."
              className="w-full px-3 py-2 rounded-xl border border-stone-200"
            />
          </div>

          <div>
            <label className="font-semibold text-stone-700 block mb-1">
              Practical Commitments (one per line)
            </label>
            <textarea
              rows={3}
              value={commitmentsText}
              onChange={(e) => setCommitmentsText(e.target.value)}
              placeholder={'Phones rest in charging basket at 6:00 PM\nEveryone shares one daily highlight'}
              className="w-full px-3 py-2 rounded-xl border border-stone-200"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-stone-700 block mb-1">Supportive Follow-up Action</label>
              <input
                type="text"
                value={followUpAction}
                onChange={(e) => setFollowUpAction(e.target.value)}
                placeholder="e.g. Keep conversation cards on dining table"
                className="w-full px-3 py-2 rounded-xl border border-stone-200"
              />
            </div>
            <div>
              <label className="font-semibold text-stone-700 block mb-1">Review Rhythm</label>
              <input
                type="text"
                value={reviewDate}
                onChange={(e) => setReviewDate(e.target.value)}
                placeholder="e.g. Monthly Review • First Sunday"
                className="w-full px-3 py-2 rounded-xl border border-stone-200"
              />
            </div>
          </div>

          {initialAgreement && (
            <div>
              <label className="font-semibold text-stone-700 block mb-1">
                Version Revision Note (recorded in Version History)
              </label>
              <input
                type="text"
                value={changeSummary}
                onChange={(e) => setChangeSummary(e.target.value)}
                placeholder="Why are we updating this agreement today?"
                className="w-full px-3 py-2 rounded-xl border border-stone-200"
              />
            </div>
          )}

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
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-[#173D35] text-white font-semibold hover:bg-emerald-950 disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? 'Saving...' : initialAgreement ? 'Save New Version' : 'Save Shared Agreement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const AgreementHistoryDrawer: React.FC<{
  agreement: AgreementRecord | null;
  onClose: () => void;
  currentUserName: string;
  canMutate: boolean;
  onAddReflection: (agreement: AgreementRecord, reflectionNote: string) => Promise<void>;
}> = ({ agreement, onClose, currentUserName, canMutate, onAddReflection }) => {
  const [reflectionNote, setReflectionNote] = useState('');

  if (!agreement) return null;

  const versionHistory = agreement.versionHistory || [
    {
      version: agreement.versionNumber || 1,
      date: 'Initial Charter',
      updatedBy: 'Family Council',
      summary: 'Shared household charter established.',
    },
  ];
  const reflections = agreement.reflections || [];

  const handleSubmitReflection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reflectionNote.trim() || !canMutate) return;
    await onAddReflection(agreement, reflectionNote.trim());
    setReflectionNote('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/40 backdrop-blur-xs flex justify-end">
      <div className="bg-white w-full max-w-xl h-full shadow-2xl border-l border-stone-200 p-6 sm:p-7 overflow-y-auto flex flex-col justify-between space-y-6">
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4 border-b border-stone-100 pb-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                Charter Version History & Reflections • v{agreement.versionNumber || 1}
              </span>
              <h3 className="text-xl font-serif font-bold text-stone-900 mt-0.5">{agreement.topic}</h3>
              <p className="text-xs italic text-stone-500 mt-0.5">“{agreement.reflectionPrompt}”</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2 text-xs">
            <div className="font-bold text-stone-900">Living Agreement Statement</div>
            <p className="text-stone-700 leading-relaxed">{agreement.sharedAgreement}</p>
            {(agreement.commitments || []).length > 0 && (
              <ul className="list-disc list-inside text-stone-600 space-y-1 pt-1">
                {(agreement.commitments || []).map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Periodic Reflections */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5 text-emerald-800" />
              <span>Periodic Family Reflections ({reflections.length})</span>
            </h4>
            {reflections.length === 0 ? (
              <p className="text-xs text-stone-400 italic">
                No reflections logged yet. Share how this agreement is feeling in practice below.
              </p>
            ) : (
              <div className="space-y-2">
                {reflections.map((ref) => (
                  <div
                    key={ref.id}
                    className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-200/70 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-[11px] text-emerald-950 font-semibold">
                      <span>{ref.author}</span>
                      <span className="font-mono text-stone-500">{ref.date}</span>
                    </div>
                    <p className="text-stone-700">{ref.note}</p>
                  </div>
                ))}
              </div>
            )}

            {canMutate && (
              <form onSubmit={handleSubmitReflection} className="space-y-2 pt-1">
                <textarea
                  rows={2}
                  value={reflectionNote}
                  onChange={(e) => setReflectionNote(e.target.value)}
                  placeholder={`Add a gentle reflection as ${currentUserName}...`}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#173D35] text-white text-xs font-semibold cursor-pointer"
                  >
                    + Log Reflection
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Version History Timeline */}
          <div className="space-y-3 pt-2 border-t border-stone-100">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-stone-500" />
              <span>Charter Version History</span>
            </h4>
            <div className="space-y-2">
              {versionHistory.map((vh, i) => (
                <div
                  key={i}
                  className="p-3 rounded-2xl bg-stone-50 border border-stone-200/80 text-xs flex items-start justify-between gap-3"
                >
                  <div>
                    <span className="font-bold text-stone-900">Version {vh.version}</span>
                    <span className="text-stone-500"> • Updated by {vh.updatedBy}</span>
                    <p className="text-stone-600 mt-0.5">{vh.summary}</p>
                  </div>
                  <span className="text-[11px] font-mono text-stone-400 shrink-0">{vh.date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-stone-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-900 text-white text-xs font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 7. EXTERNAL NETWORK & CRM MODALS
// ============================================================================
export const ExternalContactFormModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  initialContact: ExternalContact | null;
  isSaving: boolean;
  onSave: (payload: Omit<ExternalContact, 'id'>) => Promise<void>;
}> = ({ isOpen, onClose, initialContact, isSaving, onSave }) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ExternalContact['category']>('EXTENDED_FAMILY');
  const [tagsText, setTagsText] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [location, setLocation] = useState('');
  const [birthday, setBirthday] = useState('');
  const [importantEvent, setImportantEvent] = useState('');
  const [checkInCadence, setCheckInCadence] = useState<ExternalContact['checkInCadence']>('MONTHLY');
  const [lastCheckedIn, setLastCheckedIn] = useState('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (initialContact) {
      setName(initialContact.name || '');
      setCategory(initialContact.category || 'EXTENDED_FAMILY');
      setTagsText((initialContact.tags || []).join(', '));
      setPhone(initialContact.phone || '');
      setEmail(initialContact.email || '');
      setLocation(initialContact.location || '');
      setBirthday(initialContact.birthday || '');
      setImportantEvent(initialContact.importantEvent || '');
      setCheckInCadence(initialContact.checkInCadence || 'MONTHLY');
      setLastCheckedIn((initialContact.lastCheckedIn || '').slice(0, 10));
      setNextFollowUpDate(initialContact.nextFollowUpDate || '');
      setNotes(initialContact.notes || '');
    } else {
      setName('');
      setCategory('EXTENDED_FAMILY');
      setTagsText('');
      setPhone('');
      setEmail('');
      setLocation('');
      setBirthday('');
      setImportantEvent('');
      setCheckInCadence('MONTHLY');
      setLastCheckedIn(new Date().toISOString().slice(0, 10));
      setNextFollowUpDate('');
      setNotes('');
    }
  }, [isOpen, initialContact]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Contact name is required.');
      return;
    }
    const tags = tagsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    await onSave({
      name: name.trim(),
      category,
      tags,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      location: location.trim() || undefined,
      birthday: birthday.trim() || undefined,
      importantEvent: importantEvent.trim() || undefined,
      checkInCadence,
      lastCheckedIn: lastCheckedIn || new Date().toISOString().slice(0, 10),
      nextFollowUpDate: nextFollowUpDate || undefined,
      notes: notes.trim() || undefined,
      interactionHistory: initialContact?.interactionHistory || [],
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-stone-200 max-w-xl w-full p-6 sm:p-7 shadow-xl space-y-5 my-8">
        <div className="flex items-start justify-between gap-4 border-b border-stone-100 pb-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              External Network & Family CRM
            </span>
            <h3 className="text-xl font-serif font-bold text-stone-900 mt-0.5">
              {initialContact ? 'Edit Network Contact' : 'Add Extended Family or Community Contact'}
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Keep extended relatives, close friends, neighbors, and community support organized.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-stone-700 block mb-1">Full Name / Household *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Aunt Clara & Uncle Mateo"
                className="w-full px-3 py-2 rounded-xl border border-stone-200"
              />
            </div>
            <div>
              <label className="font-semibold text-stone-700 block mb-1">Relationship Circle</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExternalContact['category'])}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-stone-800"
              >
                <option value="EXTENDED_FAMILY">Extended Family</option>
                <option value="FRIEND">Close Friend</option>
                <option value="NEIGHBOR">Trusted Neighbor</option>
                <option value="MENTOR">Mentor & Advisor</option>
                <option value="COMMUNITY">Community & School</option>
                <option value="PROFESSIONAL">Household Professional</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-stone-700 block mb-1">Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="w-full px-3 py-2 rounded-xl border border-stone-200"
              />
            </div>
            <div>
              <label className="font-semibold text-stone-700 block mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-3 py-2 rounded-xl border border-stone-200"
              />
            </div>
            <div>
              <label className="font-semibold text-stone-700 block mb-1">City / Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Portland, OR"
                className="w-full px-3 py-2 rounded-xl border border-stone-200"
              />
            </div>
            <div>
              <label className="font-semibold text-stone-700 block mb-1">Tags (comma-separated)</label>
              <input
                type="text"
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                placeholder="Holiday Hosting, Emergency Key, Kids Carpool"
                className="w-full px-3 py-2 rounded-xl border border-stone-200"
              />
            </div>
            <div>
              <label className="font-semibold text-stone-700 block mb-1">Preferred Catch-Up Cadence</label>
              <select
                value={checkInCadence}
                onChange={(e) => setCheckInCadence(e.target.value as ExternalContact['checkInCadence'])}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-stone-800"
              >
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-stone-700 block mb-1">Last Contact Date</label>
              <input
                type="date"
                value={lastCheckedIn}
                onChange={(e) => setLastCheckedIn(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-200"
              />
            </div>
            <div>
              <label className="font-semibold text-stone-700 block mb-1">Next Follow-Up Date</label>
              <input
                type="date"
                value={nextFollowUpDate}
                onChange={(e) => setNextFollowUpDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-200"
              />
            </div>
            <div>
              <label className="font-semibold text-stone-700 block mb-1">Important Date / Occasion</label>
              <input
                type="text"
                value={importantEvent}
                onChange={(e) => setImportantEvent(e.target.value)}
                placeholder="e.g. Birthday May 19 / Thanksgiving"
                className="w-full px-3 py-2 rounded-xl border border-stone-200"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-stone-700 block mb-1">Follow-up & Relationship Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Hospitality notes, kids' names, or what to ask about next time..."
              className="w-full px-3 py-2 rounded-xl border border-stone-200"
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
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-[#173D35] text-white font-semibold hover:bg-emerald-950 disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? 'Saving...' : initialContact ? 'Save Contact Changes' : 'Add Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const ContactTouchpointDrawer: React.FC<{
  contact: ExternalContact | null;
  onClose: () => void;
  canMutate: boolean;
  onLogTouchpoint: (
    contact: ExternalContact,
    entry: {
      method: 'Call' | 'Message' | 'Email' | 'Coffee / Meetup' | 'Visit' | 'Other';
      date: string;
      summary: string;
      nextFollowUpDate?: string;
    }
  ) => Promise<void>;
}> = ({ contact, onClose, canMutate, onLogTouchpoint }) => {
  const [method, setMethod] = useState<'Call' | 'Message' | 'Email' | 'Coffee / Meetup' | 'Visit' | 'Other'>('Call');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');

  useEffect(() => {
    if (contact) {
      setDate(new Date().toISOString().slice(0, 10));
      setSummary('');
      setNextFollowUpDate(contact.nextFollowUpDate || '');
    }
  }, [contact]);

  if (!contact) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim() || !canMutate) return;
    await onLogTouchpoint(contact, {
      method,
      date: date || new Date().toISOString().slice(0, 10),
      summary: summary.trim(),
      nextFollowUpDate: nextFollowUpDate || undefined,
    });
    setSummary('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/40 backdrop-blur-xs flex justify-end">
      <div className="bg-white w-full max-w-lg h-full shadow-2xl border-l border-stone-200 p-6 sm:p-7 overflow-y-auto flex flex-col justify-between space-y-6">
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4 border-b border-stone-100 pb-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                Contact History & Follow-Up Log
              </span>
              <h3 className="text-xl font-serif font-bold text-stone-900 mt-0.5">{contact.name}</h3>
              <p className="text-xs text-stone-500 mt-0.5">
                {contact.category.replace('_', ' ')} • Cadence: {contact.checkInCadence}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {canMutate && (
            <form
              onSubmit={handleSubmit}
              className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-3 text-xs"
            >
              <div className="font-bold text-stone-900">Record New Catch-Up or Follow-Up Note</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-stone-600 block mb-1">Channel</label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as any)}
                    className="w-full px-3 py-1.5 rounded-xl border border-stone-200 bg-white"
                  >
                    <option value="Call">Phone / Video Call</option>
                    <option value="Message">Text / Message</option>
                    <option value="Coffee / Meetup">Coffee / Meal Together</option>
                    <option value="Visit">Home Visit</option>
                    <option value="Email">Email / Letter</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-stone-600 block mb-1">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-stone-200 bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-stone-600 block mb-1">
                  Conversation Summary *
                </label>
                <textarea
                  rows={2}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="What did you catch up on or want to remember for next time?"
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-stone-600 block mb-1">
                  Next Follow-Up Reminder Date (optional)
                </label>
                <input
                  type="date"
                  value={nextFollowUpDate}
                  onChange={(e) => setNextFollowUpDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-stone-200 bg-white"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#173D35] text-white font-semibold cursor-pointer"
                >
                  + Save Touchpoint
                </button>
              </div>
            </form>
          )}

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700">
              Recent Touchpoints ({(contact.interactionHistory || []).length})
            </h4>
            {(contact.interactionHistory || []).length === 0 ? (
              <p className="text-xs text-stone-400 italic">No touchpoints logged yet.</p>
            ) : (
              <div className="space-y-2">
                {(contact.interactionHistory || []).map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-white border border-stone-200 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-900">{item.method}</span>
                      <span className="font-mono text-[11px] text-stone-400">{item.date}</span>
                    </div>
                    <p className="text-stone-700">{item.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-stone-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-900 text-white text-xs font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 8. CLEAN DELETE CONFIRMATION MODAL
// ============================================================================
export const DeleteConfirmModal: React.FC<{
  target: { collection: string; id: string; title: string } | null;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}> = ({ target, onCancel, onConfirm }) => {
  if (!target) return null;
  return (
    <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-stone-200 max-w-md w-full p-6 shadow-xl space-y-4">
        <h3 className="text-lg font-serif font-bold text-stone-900">Remove Record?</h3>
        <p className="text-xs text-stone-600 leading-relaxed">
          Are you sure you want to remove <span className="font-bold text-stone-900">“{target.title}”</span>? This change will sync across your household workspace.
        </p>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold cursor-pointer"
          >
            Remove Permanently
          </button>
        </div>
      </div>
    </div>
  );
};
