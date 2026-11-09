import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Upload,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  Bookmark,
  Lock,
  Globe,
  BookOpen,
  Calendar,
  Clock,
  Sparkles,
  Download,
} from 'lucide-react';

export interface ParentingAttachment {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
  uploadedAt: string;
}

export interface MilestoneEntry {
  id: string;
  title: string;
  category: 'Cognitive & Reading' | 'Social & Emotional' | 'Creative & Physical' | 'Independence';
  date: string;
  note?: string;
}

export interface ChildDevProfile {
  id: string;
  name: string;
  age: number;
  grade: string;
  readingProgress: string;
  developmentalNotes?: string;
  milestones: string[];
  structuredMilestones?: MilestoneEntry[];
  learningActivities: string[];
  interests: string[];
  skillsDevelopment: string[];
  achievements: string[];
  attachments?: ParentingAttachment[];
  version?: number;
}

export interface RoutineStepItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface ChildRoutine {
  id: string;
  childName: string;
  title: string;
  timeOfDay?: 'Morning' | 'After-School' | 'Bedtime' | 'Weekend';
  schedule: string;
  steps: RoutineStepItem[];
  lastCompletedDate?: string;
  version?: number;
}

export interface RoutineTemplate {
  id: string;
  title: string;
  timeOfDay: 'Morning' | 'After-School' | 'Bedtime' | 'Weekend';
  schedule: string;
  steps: string[];
  isBuiltIn?: boolean;
  version?: number;
}

export interface StudyLearningItem {
  id: string;
  student: string;
  childName?: string;
  subject: string;
  goal: string;
  title?: string;
  status: string;
  schedule: string;
  dueDate?: string;
  teacherNotes?: string;
  completed: boolean;
  attachments?: ParentingAttachment[];
  version?: number;
}

export interface WellbeingHabit {
  id: string;
  title: string;
  category: 'Sleep & Rest' | 'Nutrition & Hydration' | 'Mindfulness & Calm' | 'Physical Activity' | 'Screen Balance';
  member: string;
  rhythmTarget: string;
  supportiveNote?: string;
  completedToday: boolean;
  recentCheckInDates?: string[];
  version?: number;
}

export interface SelfReflectionLog {
  id: string;
  date: string;
  note: string;
}

export interface PersonalGrowthGoal {
  id: string;
  member: string;
  audienceType?: 'ADULT' | 'CHILD';
  ownerUserId?: string;
  ownerMemberId?: string;
  category: string;
  title: string;
  progress: number;
  nextAction: string;
  skills?: string[];
  reflectionLogs?: SelfReflectionLog[];
  isPrivate?: boolean;
  version?: number;
}

export interface MicroLesson {
  id: string;
  topic: string;
  category: string;
  format?: 'Article' | 'Video' | 'Interactive Guide';
  durationMinutes?: number;
  objective: string;
  explanation: string;
  practicalExample: string;
  reflectionQuestion: string;
  suggestedActivity: string;
  bookmarked?: boolean;
  completed: boolean;
  userReflection?: string;
  version?: number;
}

export interface CurriculumModuleStep {
  id: string;
  text: string;
  completed: boolean;
}

export interface FamilyCurriculumItem {
  id: string;
  title: string;
  category: string;
  schedule: string;
  topic: string;
  progress?: string;
  modules?: CurriculumModuleStep[];
  notes?: string;
  version?: number;
}

export interface ParentingResourceItem {
  id: string;
  topic: string;
  category: string;
  ageGroup: string;
  summary: string;
  practiceTip: string;
  parentNotes?: string;
  bookmarked?: boolean;
  attachments?: ParentingAttachment[];
  version?: number;
}

export const DEFAULT_ROUTINE_TEMPLATES: RoutineTemplate[] = [
  {
    id: 'rt-tpl-morning',
    title: 'Calm School Morning Routine',
    timeOfDay: 'Morning',
    schedule: 'Weekdays • 7:00 AM – 7:45 AM',
    steps: [
      'Open curtains and make bed',
      'Brush teeth, wash face, and get dressed',
      'Eat a nourishing breakfast and clear plate',
      'Check backpack for homework folder and water bottle',
    ],
    isBuiltIn: true,
  },
  {
    id: 'rt-tpl-afterschool',
    title: 'After-School Unpack & Study Rhythm',
    timeOfDay: 'After-School',
    schedule: 'Weekdays • 3:45 PM – 5:15 PM',
    steps: [
      'Empty lunchbox and place shoes by the entryway',
      'Enjoy a healthy snack and 15-minute reset',
      'Complete focused homework or reading block (30 mins)',
      'Outdoor movement or creative free play',
    ],
    isBuiltIn: true,
  },
  {
    id: 'rt-tpl-bedtime',
    title: 'Screen-Free Bedtime Wind-Down',
    timeOfDay: 'Bedtime',
    schedule: 'Sun–Thu • 8:00 PM – 8:45 PM',
    steps: [
      'Dock devices at the family charging station',
      'Lay out tomorrow’s clothes and pack school bag',
      'Warm shower, brush teeth, and dim bedroom lights',
      '20 minutes of chapter book reading or calm gratitude chat',
    ],
    isBuiltIn: true,
  },
  {
    id: 'rt-tpl-weekend',
    title: 'Weekend Morning Reset & Creative Play',
    timeOfDay: 'Weekend',
    schedule: 'Saturdays • 8:30 AM – 10:00 AM',
    steps: [
      'Tidy bedroom desk and book corner (10 mins)',
      'Place laundry in hamper',
      'Family breakfast together',
      'Choose a creative project, instrument practice, or outdoor walk',
    ],
    isBuiltIn: true,
  },
];

export const DEFAULT_CURRICULUM_TEMPLATES: Array<{
  id: string;
  title: string;
  category: string;
  schedule: string;
  topic: string;
  steps: string[];
}> = [
  {
    id: 'cur-tpl-finance',
    title: 'Family Financial Literacy & Generosity',
    category: 'Financial Literacy',
    schedule: 'First Saturday • 10:00 AM',
    topic: 'Age-appropriate exploration of saving, thoughtful spending, compounding, and generosity.',
    steps: [
      'Module 1: Save, Spend, and Share Buckets',
      'Module 2: How Household Budgets & Utilities Work',
      'Module 3: Patience & Long-Term Compounding',
      'Module 4: Designing a Shared Family Giving Project',
    ],
  },
  {
    id: 'cur-tpl-culinary',
    title: 'Hands-On Culinary & Nutrition Life Skills',
    category: 'Life Skills',
    schedule: 'Wednesdays • 5:30 PM',
    topic: 'Cooking wholesome meals together while practicing kitchen safety, measurement, and teamwork.',
    steps: [
      'Module 1: Kitchen Safety, Knife Skills & Prep Setup',
      'Module 2: Balancing Whole Grains, Proteins & Greens',
      'Module 3: Planning a Grocery List Within Budget',
      'Module 4: Co-Leading a Full Family Dinner',
    ],
  },
  {
    id: 'cur-tpl-reading',
    title: 'Seasonal Family Reading & Discussion Circle',
    category: 'Reading Challenge',
    schedule: 'Sundays • 4:00 PM',
    topic: 'Shared quiet reading hour followed by open-ended storytelling and reflection.',
    steps: [
      'Week 1: Choose individual and read-aloud books',
      'Week 2: Share a favorite character decision or dilemma',
      'Week 3: Connect a book theme to everyday family life',
      'Week 4: Celebrate finished books and write brief reflections',
    ],
  },
];

// ============================================================================
// REUSABLE ATTACHMENT UPLOADER
// ============================================================================
const AttachmentPickerSection: React.FC<{
  label?: string;
  attachments: ParentingAttachment[];
  onChange: (next: ParentingAttachment[]) => void;
  onError: (msg: string) => void;
}> = ({ label = 'Photos & Document Attachments', attachments, onChange, onError }) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.size > 1.5 * 1024 * 1024) {
      onError('File exceeds 1.5 MB limit. Please choose a smaller photo or PDF document.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      const nextItem: ParentingAttachment = {
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        dataUrl,
        uploadedAt: new Date().toISOString().slice(0, 10),
      };
      onChange([...attachments, nextItem]);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-stone-700">{label}</span>
        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold cursor-pointer transition-colors">
          <Upload className="w-3.5 h-3.5" />
          <span>Attach Photo / PDF</span>
          <input
            type="file"
            accept=".png,.jpg,.jpeg,.webp,.pdf,.txt"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
      </div>

      {attachments.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {attachments.map((att) => {
            const isImage = att.mimeType.startsWith('image/');
            return (
              <div
                key={att.id}
                className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isImage && att.dataUrl ? (
                    <img
                      src={att.dataUrl}
                      alt={att.name}
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-lg object-cover shrink-0 border border-stone-200"
                    />
                  ) : (
                    <FileText className="w-4 h-4 text-emerald-800 shrink-0" />
                  )}
                  <div className="truncate">
                    <div className="font-medium text-stone-800 truncate">{att.name}</div>
                    <div className="text-[10px] text-stone-500 font-mono tabular-nums">
                      {Math.max(1, Math.round(att.sizeBytes / 1024))} KB
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onChange(attachments.filter((a) => a.id !== att.id))}
                  className="p-1 text-stone-400 hover:text-rose-600 cursor-pointer shrink-0"
                  title="Remove attachment"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// DELETE CONFIRMATION MODAL
// ============================================================================
export const DeleteConfirmModal: React.FC<{
  title: string;
  description: string;
  isDeleting?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}> = ({ title, description, isDeleting, onConfirm, onClose }) => (
  <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl border border-stone-200 max-w-md w-full p-6 space-y-4 shadow-xl">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-serif font-bold text-stone-900">{title}</h3>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-stone-400 hover:text-stone-700 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-xs text-stone-600 leading-relaxed">{description}</p>
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={isDeleting}
          onClick={onConfirm}
          className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
        >
          {isDeleting ? 'Removing...' : 'Confirm Remove'}
        </button>
      </div>
    </div>
  </div>
);

// ============================================================================
// 1. CHILD PROFILE FORM MODAL & MILESTONE MODAL & DETAIL DRAWER
// ============================================================================
export const ChildProfileFormModal: React.FC<{
  initial?: ChildDevProfile | null;
  isSaving?: boolean;
  onSave: (profile: ChildDevProfile) => void;
  onClose: () => void;
}> = ({ initial, isSaving, onSave, onClose }) => {
  const [name, setName] = useState(initial?.name || '');
  const [age, setAge] = useState(String(initial?.age ?? 9));
  const [grade, setGrade] = useState(initial?.grade || '');
  const [readingProgress, setReadingProgress] = useState(initial?.readingProgress || '');
  const [developmentalNotes, setDevelopmentalNotes] = useState(initial?.developmentalNotes || '');
  const [interestsText, setInterestsText] = useState((initial?.interests || []).join(', '));
  const [skillsText, setSkillsText] = useState((initial?.skillsDevelopment || []).join('\n'));
  const [activitiesText, setActivitiesText] = useState((initial?.learningActivities || []).join('\n'));
  const [attachments, setAttachments] = useState<ParentingAttachment[]>(initial?.attachments || []);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Child name is required.');
      return;
    }
    const parsedAge = Math.max(0, Math.min(25, parseInt(age, 10) || 0));
    const profile: ChildDevProfile = {
      id: initial?.id || `cd-${Date.now()}`,
      name: name.trim(),
      age: parsedAge,
      grade: grade.trim() || `Age ${parsedAge}`,
      readingProgress: readingProgress.trim() || 'Daily reading habit in progress',
      developmentalNotes: developmentalNotes.trim(),
      milestones: initial?.milestones || [],
      structuredMilestones: initial?.structuredMilestones || [],
      interests: interestsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      skillsDevelopment: skillsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      learningActivities: activitiesText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      achievements: initial?.achievements || [],
      attachments,
      version: initial?.version,
    };
    onSave(profile);
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-stone-200 max-w-xl w-full p-6 space-y-4 shadow-xl my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div>
            <h3 className="text-lg font-serif font-bold text-stone-900">
              {initial ? `Edit ${initial.name}'s Profile` : 'Add Child Development Profile'}
            </h3>
            <p className="text-xs text-stone-500">
              Individualized developmental profile—celebrating personal growth at their own pace.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {formError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-stone-700 mb-1">Child Full Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Lucas Jenkins"
                className="w-full px-3 py-2 rounded-xl border border-stone-300"
              />
            </div>
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Age *</label>
              <input
                type="number"
                min={0}
                max={25}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 font-mono tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">Grade / School Stage</label>
            <input
              type="text"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="e.g. Grade 4 • Westfield Elementary"
              className="w-full px-3 py-2 rounded-xl border border-stone-300"
            />
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">Current Reading & Curiosity Note</label>
            <input
              type="text"
              value={readingProgress}
              onChange={(e) => setReadingProgress(e.target.value)}
              placeholder='e.g. 25 minutes daily • Reading "The Wild Robot"'
              className="w-full px-3 py-2 rounded-xl border border-stone-300"
            />
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">Age-Appropriate Developmental & Support Notes</label>
            <textarea
              rows={2}
              value={developmentalNotes}
              onChange={(e) => setDevelopmentalNotes(e.target.value)}
              placeholder="Observational notes on learning style, emotional comfort, and ways to support..."
              className="w-full px-3 py-2 rounded-xl border border-stone-300"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Skills in Progress (one per line)
              </label>
              <textarea
                rows={3}
                value={skillsText}
                onChange={(e) => setSkillsText(e.target.value)}
                placeholder={'Teamwork & sportsmanship\nMorning routine independence'}
                className="w-full px-3 py-2 rounded-xl border border-stone-300"
              />
            </div>
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Enrichment & Activities (one per line)
              </label>
              <textarea
                rows={3}
                value={activitiesText}
                onChange={(e) => setActivitiesText(e.target.value)}
                placeholder={'LEGO Robotics Builders Club\nBeginner piano chords'}
                className="w-full px-3 py-2 rounded-xl border border-stone-300"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Current Interests (comma-separated)
            </label>
            <input
              type="text"
              value={interestsText}
              onChange={(e) => setInterestsText(e.target.value)}
              placeholder="Soccer, Space Exploration, LEGO Engineering, Science"
              className="w-full px-3 py-2 rounded-xl border border-stone-300"
            />
          </div>

          <AttachmentPickerSection
            label="Milestone Photos, Artwork & Developmental Documents"
            attachments={attachments}
            onChange={setAttachments}
            onError={setFormError}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
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
              className="px-4 py-2 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white font-semibold cursor-pointer disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : initial ? 'Save Profile Changes' : 'Create Child Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const ChildMilestoneModal: React.FC<{
  childProfiles: ChildDevProfile[];
  defaultChildId?: string;
  isSaving?: boolean;
  onSaveMilestone: (childId: string, milestoneText: string, entry: MilestoneEntry) => void;
  onClose: () => void;
}> = ({ childProfiles, defaultChildId, isSaving, onSaveMilestone, onClose }) => {
  const [childId, setChildId] = useState(defaultChildId || childProfiles[0]?.id || '');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<MilestoneEntry['category']>('Cognitive & Reading');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!childId) {
      setError('Please select a child profile.');
      return;
    }
    if (!title.trim()) {
      setError('Please enter a milestone description.');
      return;
    }
    const entry: MilestoneEntry = {
      id: `ms-${Date.now()}`,
      title: title.trim(),
      category,
      date,
      note: note.trim() || undefined,
    };
    onSaveMilestone(childId, title.trim(), entry);
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-stone-200 max-w-md w-full p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div>
            <h3 className="text-base font-serif font-bold text-stone-900">Record Developmental Milestone</h3>
            <p className="text-xs text-stone-500">Celebrate personal growth, curiosity, or new independence.</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-stone-700 mb-1">Child *</label>
            <select
              value={childId}
              onChange={(e) => setChildId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white"
            >
              {childProfiles.map((cp) => (
                <option key={cp.id} value={cp.id}>
                  {cp.name} (Age {cp.age})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Area of Growth</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as MilestoneEntry['category'])}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white"
              >
                <option value="Cognitive & Reading">Cognitive & Reading</option>
                <option value="Social & Emotional">Social & Emotional</option>
                <option value="Creative & Physical">Creative & Physical</option>
                <option value="Independence">Independence</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Date Observed</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 font-mono tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">Milestone Description *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Completed first 200-page chapter book independently"
              className="w-full px-3 py-2 rounded-xl border border-stone-300"
            />
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">Context / Supportive Note</label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional memory or observation about how they approached this..."
              className="w-full px-3 py-2 rounded-xl border border-stone-300"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
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
              className="px-4 py-2 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white font-semibold cursor-pointer"
            >
              {isSaving ? 'Saving...' : 'Save Milestone'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const ChildProfileDetailDrawer: React.FC<{
  profile: ChildDevProfile;
  onEditProfile: (profile: ChildDevProfile) => void;
  onAddMilestone: (childId: string) => void;
  onRemoveMilestone: (profile: ChildDevProfile, index: number) => void;
  onClose: () => void;
}> = ({ profile, onEditProfile, onAddMilestone, onRemoveMilestone, onClose }) => (
  <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex justify-end">
    <div className="bg-white w-full max-w-lg h-full p-6 overflow-y-auto space-y-5 shadow-2xl border-l border-stone-200">
      <div className="flex items-start justify-between border-b border-stone-100 pb-4">
        <div>
          <div className="text-xs text-stone-500">
            Age <span className="font-mono tabular-nums">{profile.age}</span> · {profile.grade}
          </div>
          <h3 className="text-xl font-serif font-bold text-stone-900 mt-0.5">{profile.name}</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onEditProfile(profile)}
            className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
          >
            Edit Profile
          </button>
          <button type="button" onClick={onClose} className="p-1.5 text-stone-400 hover:text-stone-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {profile.developmentalNotes && (
        <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-1 text-xs">
          <span className="font-semibold text-stone-900 block">Developmental & Support Notes</span>
          <p className="text-stone-600 leading-relaxed">{profile.developmentalNotes}</p>
        </div>
      )}

      <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-1 text-xs">
        <span className="font-semibold text-stone-900 block">Reading & Curiosity</span>
        <p className="text-stone-700">{profile.readingProgress}</p>
      </div>

      <div className="space-y-2.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-stone-900">
            Recorded Milestones ({profile.milestones.length})
          </span>
          <button
            type="button"
            onClick={() => onAddMilestone(profile.id)}
            className="text-emerald-900 font-semibold hover:underline cursor-pointer"
          >
            + Add Milestone
          </button>
        </div>
        {profile.milestones.length === 0 ? (
          <p className="text-stone-500 py-3">No milestones recorded yet.</p>
        ) : (
          <ul className="divide-y divide-stone-100 border border-stone-200 rounded-xl bg-white">
            {profile.milestones.map((m, idx) => (
              <li key={idx} className="p-3 flex items-start justify-between gap-2">
                <span className="text-stone-800 leading-relaxed">{m}</span>
                <button
                  type="button"
                  onClick={() => onRemoveMilestone(profile, idx)}
                  className="text-stone-400 hover:text-rose-600 p-1 cursor-pointer shrink-0"
                  title="Remove milestone"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div className="space-y-1.5">
          <span className="font-semibold text-stone-900 block">Skills in Progress</span>
          <ul className="space-y-1 text-stone-600">
            {profile.skillsDevelopment.map((sk, idx) => (
              <li key={idx}>• {sk}</li>
            ))}
          </ul>
        </div>
        <div className="space-y-1.5">
          <span className="font-semibold text-stone-900 block">Enrichment & Activities</span>
          <ul className="space-y-1 text-stone-600">
            {profile.learningActivities.map((act, idx) => (
              <li key={idx}>• {act}</li>
            ))}
          </ul>
        </div>
      </div>

      {(profile.attachments || []).length > 0 && (
        <div className="space-y-2 text-xs pt-2 border-t border-stone-100">
          <span className="font-semibold text-stone-900 block">
            Portfolio Photos & Documents ({profile.attachments?.length})
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {profile.attachments?.map((att) => {
              const isImg = att.mimeType.startsWith('image/');
              return (
                <div key={att.id} className="p-2.5 rounded-xl border border-stone-200 bg-stone-50 space-y-2">
                  {isImg && att.dataUrl && (
                    <img
                      src={att.dataUrl}
                      alt={att.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-28 object-cover rounded-lg border border-stone-200"
                    />
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-stone-800 truncate">{att.name}</span>
                    {att.dataUrl && (
                      <a
                        href={att.dataUrl}
                        download={att.name}
                        className="text-emerald-900 font-semibold hover:underline shrink-0"
                      >
                        Download
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  </div>
);

// ============================================================================
// 2. CHILDREN'S ROUTINES FORM MODAL & REUSABLE TEMPLATES MODAL
// ============================================================================
export const ChildRoutineFormModal: React.FC<{
  initial?: ChildRoutine | null;
  childNames: string[];
  templates: RoutineTemplate[];
  isSaving?: boolean;
  onSave: (routine: ChildRoutine) => void;
  onClose: () => void;
}> = ({ initial, childNames, templates, isSaving, onSave, onClose }) => {
  const [childName, setChildName] = useState(initial?.childName || childNames[0] || 'Lucas Jenkins');
  const [title, setTitle] = useState(initial?.title || '');
  const [timeOfDay, setTimeOfDay] = useState<NonNullable<ChildRoutine['timeOfDay']>>(
    initial?.timeOfDay || 'Morning'
  );
  const [schedule, setSchedule] = useState(initial?.schedule || 'Weekdays • 7:00 AM – 7:45 AM');
  const [stepsText, setStepsText] = useState(
    (initial?.steps || []).map((s) => s.text).join('\n')
  );
  const [error, setError] = useState<string | null>(null);

  const handleApplyTemplate = (tpl: RoutineTemplate) => {
    setTitle(tpl.title);
    setTimeOfDay(tpl.timeOfDay);
    setSchedule(tpl.schedule);
    setStepsText(tpl.steps.join('\n'));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Routine title is required.');
      return;
    }
    const lines = stepsText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      setError('Please add at least one checklist step.');
      return;
    }

    const existingMap = new Map((initial?.steps || []).map((s) => [s.text, s.completed]));
    const steps: RoutineStepItem[] = lines.map((text, idx) => ({
      id: `step-${Date.now()}-${idx}`,
      text,
      completed: existingMap.get(text) ?? false,
    }));

    onSave({
      id: initial?.id || `cr-${Date.now()}`,
      childName,
      title: title.trim(),
      timeOfDay,
      schedule: schedule.trim() || timeOfDay,
      steps,
      version: initial?.version,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-stone-200 max-w-lg w-full p-6 space-y-4 shadow-xl my-8">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div>
            <h3 className="text-lg font-serif font-bold text-stone-900">
              {initial ? 'Edit Child Routine' : 'Create Child Routine'}
            </h3>
            <p className="text-xs text-stone-500">
              Build predictable, supportive daily rhythms using reusable checklist templates.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* One-Click Template Picker */}
        <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-2 text-xs">
          <span className="font-semibold text-stone-700 block">Load Reusable Routine Template:</span>
          <div className="flex flex-wrap gap-1.5">
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => handleApplyTemplate(tpl)}
                className="px-2.5 py-1 rounded-lg border border-stone-200 bg-white hover:bg-stone-100 text-stone-700 font-medium cursor-pointer transition-colors"
              >
                {tpl.title}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Child *</label>
              <select
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white"
              >
                {childNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Time of Day</label>
              <select
                value={timeOfDay}
                onChange={(e) => setTimeOfDay(e.target.value as NonNullable<ChildRoutine['timeOfDay']>)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white"
              >
                <option value="Morning">Morning</option>
                <option value="After-School">After-School</option>
                <option value="Bedtime">Bedtime</option>
                <option value="Weekend">Weekend</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">Routine Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Morning School Preparation"
              className="w-full px-3 py-2 rounded-xl border border-stone-300"
            />
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">Schedule / Timing</label>
            <input
              type="text"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              placeholder="e.g. Weekdays • 7:00 AM – 7:45 AM"
              className="w-full px-3 py-2 rounded-xl border border-stone-300"
            />
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Checklist Steps (one step per line) *
            </label>
            <textarea
              rows={5}
              required
              value={stepsText}
              onChange={(e) => setStepsText(e.target.value)}
              placeholder={'Make bed and open curtains\nBrush teeth and get dressed\nPack homework folder and water bottle'}
              className="w-full px-3 py-2 rounded-xl border border-stone-300"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
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
              className="px-4 py-2 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white font-semibold cursor-pointer"
            >
              {isSaving ? 'Saving...' : initial ? 'Save Routine' : 'Create Routine'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const RoutineTemplatesModal: React.FC<{
  templates: RoutineTemplate[];
  onSaveTemplate: (tpl: RoutineTemplate) => void;
  onDeleteTemplate: (id: string) => void;
  onUseTemplate: (tpl: RoutineTemplate) => void;
  onClose: () => void;
}> = ({ templates, onSaveTemplate, onDeleteTemplate, onUseTemplate, onClose }) => {
  const [title, setTitle] = useState('');
  const [timeOfDay, setTimeOfDay] = useState<RoutineTemplate['timeOfDay']>('Morning');
  const [schedule, setSchedule] = useState('Weekdays • 7:00 AM');
  const [stepsText, setStepsText] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !stepsText.trim()) return;
    onSaveTemplate({
      id: `rt-custom-${Date.now()}`,
      title: title.trim(),
      timeOfDay,
      schedule: schedule.trim() || timeOfDay,
      steps: stepsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      isBuiltIn: false,
    });
    setTitle('');
    setStepsText('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-stone-200 max-w-2xl w-full p-6 space-y-5 shadow-xl my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div>
            <h3 className="text-lg font-serif font-bold text-stone-900">Reusable Routine Checklist Templates</h3>
            <p className="text-xs text-stone-500">
              Standardize morning, after-school, and bedtime checklists across the household.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {templates.map((tpl) => (
            <div key={tpl.id} className="p-4 rounded-xl border border-stone-200 bg-stone-50 flex flex-col justify-between space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-stone-500 font-medium">
                    {tpl.timeOfDay} · {tpl.schedule}
                  </span>
                  {!tpl.isBuiltIn && (
                    <button
                      type="button"
                      onClick={() => onDeleteTemplate(tpl.id)}
                      className="text-stone-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <h4 className="font-serif font-bold text-sm text-stone-900">{tpl.title}</h4>
                <ul className="space-y-1 text-stone-600 pt-1">
                  {tpl.steps.map((s, idx) => (
                    <li key={idx}>• {s}</li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                onClick={() => onUseTemplate(tpl)}
                className="w-full py-1.5 rounded-lg bg-[#173D35] text-white font-semibold hover:bg-emerald-950 cursor-pointer"
              >
                Use This Template
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={handleCreate} className="pt-4 border-t border-stone-200 space-y-3 text-xs">
          <h4 className="font-serif font-bold text-sm text-stone-900">Save New Reusable Template</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Template Title *"
              className="px-3 py-2 rounded-xl border border-stone-300"
            />
            <select
              value={timeOfDay}
              onChange={(e) => setTimeOfDay(e.target.value as RoutineTemplate['timeOfDay'])}
              className="px-3 py-2 rounded-xl border border-stone-300 bg-white"
            >
              <option value="Morning">Morning</option>
              <option value="After-School">After-School</option>
              <option value="Bedtime">Bedtime</option>
              <option value="Weekend">Weekend</option>
            </select>
            <input
              type="text"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              placeholder="Schedule label"
              className="px-3 py-2 rounded-xl border border-stone-300"
            />
          </div>
          <textarea
            rows={3}
            required
            value={stepsText}
            onChange={(e) => setStepsText(e.target.value)}
            placeholder="Enter checklist steps (one per line) *"
            className="w-full px-3 py-2 rounded-xl border border-stone-300"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-stone-900 text-white font-semibold hover:bg-stone-800 cursor-pointer"
            >
              + Save Custom Template
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 3. EDUCATION & LEARNING FORM MODAL & DETAIL DRAWER
// ============================================================================
export const EducationFormModal: React.FC<{
  initial?: StudyLearningItem | null;
  childNames: string[];
  isSaving?: boolean;
  onSave: (item: StudyLearningItem) => void;
  onClose: () => void;
}> = ({ initial, childNames, isSaving, onSave, onClose }) => {
  const [student, setStudent] = useState(
    initial?.student || initial?.childName || childNames[0] || 'Lucas Jenkins'
  );
  const [subject, setSubject] = useState(initial?.subject || '');
  const [goal, setGoal] = useState(initial?.goal || initial?.title || '');
  const [status, setStatus] = useState(initial?.status || 'In Progress');
  const [schedule, setSchedule] = useState(initial?.schedule || 'Mon–Thu • 4:15 PM');
  const [dueDate, setDueDate] = useState(initial?.dueDate || '');
  const [teacherNotes, setTeacherNotes] = useState(initial?.teacherNotes || '');
  const [completed, setCompleted] = useState(Boolean(initial?.completed));
  const [attachments, setAttachments] = useState<ParentingAttachment[]>(initial?.attachments || []);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !goal.trim()) {
      setError('Both subject and learning goal/assignment are required.');
      return;
    }
    onSave({
      id: initial?.id || `ed-${Date.now()}`,
      student,
      childName: student,
      subject: subject.trim(),
      goal: goal.trim(),
      title: goal.trim(),
      status: status.trim() || (completed ? 'Completed' : 'In Progress'),
      schedule: schedule.trim() || 'Weekly Study Schedule',
      dueDate: dueDate || undefined,
      teacherNotes: teacherNotes.trim() || undefined,
      completed,
      attachments,
      version: initial?.version,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-stone-200 max-w-lg w-full p-6 space-y-4 shadow-xl my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div>
            <h3 className="text-lg font-serif font-bold text-stone-900">
              {initial ? 'Edit School & Learning Card' : 'Add School & Learning Card'}
            </h3>
            <p className="text-xs text-stone-500">
              Track subjects, reading lists, teacher notes, study schedules, and uploaded reports.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Child / Student *</label>
              <select
                value={student}
                onChange={(e) => setStudent(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white"
              >
                {childNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Subject / Course *</label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. STEM & Reading List"
                className="w-full px-3 py-2 rounded-xl border border-stone-300"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">Learning Goal / Project / Reading Plan *</label>
            <input
              type="text"
              required
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. Read 12 chapter books & complete solar rover project"
              className="w-full px-3 py-2 rounded-xl border border-stone-300"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Current Progress Note</label>
              <input
                type="text"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                placeholder="e.g. 8 of 12 books read"
                className="w-full px-3 py-2 rounded-xl border border-stone-300"
              />
            </div>
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Study Schedule</label>
              <input
                type="text"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                placeholder="e.g. Mon–Fri • 4:15 PM"
                className="w-full px-3 py-2 rounded-xl border border-stone-300"
              />
            </div>
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Target / Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 font-mono tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">Teacher Notes & Classroom Feedback</label>
            <textarea
              rows={2}
              value={teacherNotes}
              onChange={(e) => setTeacherNotes(e.target.value)}
              placeholder="Notes from parent-teacher conferences, encouragement areas, or study tips..."
              className="w-full px-3 py-2 rounded-xl border border-stone-300"
            />
          </div>

          <label className="inline-flex items-center gap-2 text-stone-700 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={completed}
              onChange={(e) => setCompleted(e.target.checked)}
              className="rounded border-stone-300 text-emerald-900"
            />
            <span>Mark this learning goal / project as completed</span>
          </label>

          <AttachmentPickerSection
            label="School Reports, Reading Logs & Project Rubrics"
            attachments={attachments}
            onChange={setAttachments}
            onError={setError}
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
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
              className="px-4 py-2 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white font-semibold cursor-pointer"
            >
              {isSaving ? 'Saving...' : initial ? 'Save Changes' : 'Save Learning Card'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 4. WELLBEING & HEALTHY HABITS FORM MODAL (Non-competitive, Rhythm-Focused)
// ============================================================================
export const WellbeingHabitFormModal: React.FC<{
  initial?: WellbeingHabit | null;
  memberOptions: string[];
  isSaving?: boolean;
  onSave: (habit: WellbeingHabit) => void;
  onClose: () => void;
}> = ({ initial, memberOptions, isSaving, onSave, onClose }) => {
  const [title, setTitle] = useState(initial?.title || '');
  const [category, setCategory] = useState<WellbeingHabit['category']>(
    initial?.category || 'Sleep & Rest'
  );
  const [member, setMember] = useState(initial?.member || memberOptions[0] || 'Whole Family');
  const [rhythmTarget, setRhythmTarget] = useState(
    initial?.rhythmTarget || 'Daily gentle rhythm'
  );
  const [supportiveNote, setSupportiveNote] = useState(initial?.supportiveNote || '');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please enter a habit title.');
      return;
    }
    onSave({
      id: initial?.id || `hb-${Date.now()}`,
      title: title.trim(),
      category,
      member,
      rhythmTarget: rhythmTarget.trim() || 'Daily gentle rhythm',
      supportiveNote: supportiveNote.trim() || undefined,
      completedToday: initial?.completedToday ?? false,
      recentCheckInDates: initial?.recentCheckInDates || [],
      version: initial?.version,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-stone-200 max-w-md w-full p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div>
            <h3 className="text-base font-serif font-bold text-stone-900">
              {initial ? 'Edit Healthy Habit' : 'Add Healthy Habit'}
            </h3>
            <p className="text-xs text-stone-500">
              Supportive personal consistency—focused on wellbeing rather than streaks or penalties.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-stone-700 mb-1">Habit Description *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Unhurried Evening Reading & Sleep Wind-Down"
              className="w-full px-3 py-2 rounded-xl border border-stone-300"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Wellbeing Pillar</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as WellbeingHabit['category'])}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white"
              >
                <option value="Sleep & Rest">Sleep & Rest</option>
                <option value="Nutrition & Hydration">Nutrition & Hydration</option>
                <option value="Mindfulness & Calm">Mindfulness & Calm</option>
                <option value="Physical Activity">Physical Activity</option>
                <option value="Screen Balance">Screen Balance</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Family Member</label>
              <select
                value={member}
                onChange={(e) => setMember(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white"
              >
                {memberOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">Gentle Rhythm / Timing</label>
            <input
              type="text"
              value={rhythmTarget}
              onChange={(e) => setRhythmTarget(e.target.value)}
              placeholder="e.g. Evenings before 8:30 PM or 4–5 days a week"
              className="w-full px-3 py-2 rounded-xl border border-stone-300"
            />
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">Supportive Intention Note</label>
            <textarea
              rows={2}
              value={supportiveNote}
              onChange={(e) => setSupportiveNote(e.target.value)}
              placeholder="Why this habit feels nourishing or how the family can make it easier..."
              className="w-full px-3 py-2 rounded-xl border border-stone-300"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
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
              className="px-4 py-2 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white font-semibold cursor-pointer"
            >
              {isSaving ? 'Saving...' : initial ? 'Save Habit' : 'Create Habit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 5. PERSONAL DEVELOPMENT FORM MODAL & SELF-REFLECTION DRAWER
// ============================================================================
export const PersonalGoalFormModal: React.FC<{
  initial?: PersonalGrowthGoal | null;
  memberOptions: string[];
  defaultMember: string;
  actorUserId: string;
  actorMemberId: string;
  isSaving?: boolean;
  onSave: (goal: PersonalGrowthGoal) => void;
  onClose: () => void;
}> = ({
  initial,
  memberOptions,
  defaultMember,
  actorUserId,
  actorMemberId,
  isSaving,
  onSave,
  onClose,
}) => {
  const [member, setMember] = useState(initial?.member || defaultMember || memberOptions[0] || 'Sarah Jenkins');
  const [audienceType, setAudienceType] = useState<'ADULT' | 'CHILD'>(
    initial?.audienceType ||
      (member.toLowerCase().includes('lucas') || member.toLowerCase().includes('maya') ? 'CHILD' : 'ADULT')
  );
  const [category, setCategory] = useState(initial?.category || 'Skill Building & Craft');
  const [title, setTitle] = useState(initial?.title || '');
  const [progress, setProgress] = useState(String(initial?.progress ?? 25));
  const [nextAction, setNextAction] = useState(initial?.nextAction || '');
  const [skillsText, setSkillsText] = useState((initial?.skills || []).join('\n'));
  const [isPrivate, setIsPrivate] = useState(Boolean(initial?.isPrivate));
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Goal title is required.');
      return;
    }
    const clampedProgress = Math.max(0, Math.min(100, parseInt(progress, 10) || 0));
    onSave({
      id: initial?.id || `pg-${Date.now()}`,
      member,
      audienceType,
      ownerUserId: initial?.ownerUserId || actorUserId,
      ownerMemberId: initial?.ownerMemberId || actorMemberId,
      category: category.trim() || 'Personal Growth',
      title: title.trim(),
      progress: clampedProgress,
      nextAction: nextAction.trim() || 'Schedule weekly practice block',
      skills: skillsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      reflectionLogs: initial?.reflectionLogs || [],
      isPrivate,
      version: initial?.version,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-stone-200 max-w-lg w-full p-6 space-y-4 shadow-xl my-8">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div>
            <h3 className="text-lg font-serif font-bold text-stone-900">
              {initial ? 'Edit Personal Growth Goal' : 'New Personal Growth Goal'}
            </h3>
            <p className="text-xs text-stone-500">
              Individual skill building, growth intentions, and self-reflection tailored for adults or children.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Family Member *</label>
              <select
                value={member}
                onChange={(e) => setMember(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white"
              >
                {memberOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Growth Track</label>
              <select
                value={audienceType}
                onChange={(e) => setAudienceType(e.target.value as 'ADULT' | 'CHILD')}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white"
              >
                <option value="ADULT">Adult / Parent Track</option>
                <option value="CHILD">Child / Teen Track</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-stone-700 mb-1">Growth Area / Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Leadership & Wellbeing or Creative & Life Skills"
                className="w-full px-3 py-2 rounded-xl border border-stone-300"
              />
            </div>
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Progress (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={progress}
                onChange={(e) => setProgress(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 font-mono tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">Goal Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Mindful Leadership & Half-Marathon Prep"
              className="w-full px-3 py-2 rounded-xl border border-stone-300"
            />
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">Next Immediate Step</label>
            <input
              type="text"
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              placeholder="e.g. Complete Saturday 10km trail run and Chapter 6 reflection"
              className="w-full px-3 py-2 rounded-xl border border-stone-300"
            />
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Skills Being Practiced (one per line)
            </label>
            <textarea
              rows={3}
              value={skillsText}
              onChange={(e) => setSkillsText(e.target.value)}
              placeholder={'Active listening\nWeekly calendar time-blocking'}
              className="w-full px-3 py-2 rounded-xl border border-stone-300"
            />
          </div>

          <label className="inline-flex items-center gap-2 text-stone-700 font-medium cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="rounded border-stone-300 text-emerald-900"
            />
            <span>Keep this personal goal & reflection log private to me</span>
          </label>

          <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
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
              className="px-4 py-2 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white font-semibold cursor-pointer"
            >
              {isSaving ? 'Saving...' : initial ? 'Save Goal' : 'Create Goal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const PersonalGoalDetailDrawer: React.FC<{
  goal: PersonalGrowthGoal;
  onUpdateGoal: (updated: PersonalGrowthGoal) => void;
  onEditGoal: (goal: PersonalGrowthGoal) => void;
  onClose: () => void;
}> = ({ goal, onUpdateGoal, onEditGoal, onClose }) => {
  const [reflectionNote, setReflectionNote] = useState('');

  const handleAddReflection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reflectionNote.trim()) return;
    const entry: SelfReflectionLog = {
      id: `rl-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      note: reflectionNote.trim(),
    };
    onUpdateGoal({
      ...goal,
      reflectionLogs: [entry, ...(goal.reflectionLogs || [])],
    });
    setReflectionNote('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex justify-end">
      <div className="bg-white w-full max-w-lg h-full p-6 overflow-y-auto space-y-5 shadow-2xl border-l border-stone-200">
        <div className="flex items-start justify-between border-b border-stone-100 pb-4">
          <div>
            <div className="text-xs text-stone-500">
              {goal.member} · {goal.audienceType === 'CHILD' ? 'Child / Teen Track' : 'Adult Track'} · {goal.category}
            </div>
            <h3 className="text-lg font-serif font-bold text-stone-900 mt-0.5">{goal.title}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onEditGoal(goal)}
              className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
            >
              Edit
            </button>
            <button type="button" onClick={onClose} className="p-1.5 text-stone-400 hover:text-stone-700 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2 text-xs">
          <div className="flex items-center justify-between font-semibold">
            <span className="text-stone-700">Personal Progress</span>
            <span className="font-mono tabular-nums text-stone-900">{goal.progress}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-stone-200 overflow-hidden">
            <div className="h-full bg-[#173D35] rounded-full" style={{ width: `${goal.progress}%` }} />
          </div>
          <p className="text-stone-600 pt-1">
            <strong>Next Step:</strong> {goal.nextAction}
          </p>
        </div>

        {(goal.skills || []).length > 0 && (
          <div className="space-y-1.5 text-xs">
            <span className="font-semibold text-stone-900 block">Skills Being Practiced</span>
            <ul className="space-y-1 text-stone-600">
              {goal.skills?.map((sk, idx) => (
                <li key={idx}>• {sk}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-3 text-xs pt-2 border-t border-stone-100">
          <span className="font-semibold text-stone-900 block">
            Self-Reflection Journal ({(goal.reflectionLogs || []).length})
          </span>
          <form onSubmit={handleAddReflection} className="space-y-2">
            <textarea
              rows={2}
              value={reflectionNote}
              onChange={(e) => setReflectionNote(e.target.value)}
              placeholder="Write a personal reflection on what you learned or noticed this week..."
              className="w-full px-3 py-2 rounded-xl border border-stone-300"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-xl bg-[#173D35] text-white font-semibold hover:bg-emerald-950 cursor-pointer"
              >
                + Log Reflection
              </button>
            </div>
          </form>

          {(goal.reflectionLogs || []).length === 0 ? (
            <p className="text-stone-500 py-2">No self-reflections logged yet.</p>
          ) : (
            <div className="space-y-2">
              {goal.reflectionLogs?.map((log) => (
                <div key={log.id} className="p-3 rounded-xl border border-stone-200 bg-stone-50 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-stone-500">
                    <span className="font-mono tabular-nums">{log.date}</span>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateGoal({
                          ...goal,
                          reflectionLogs: (goal.reflectionLogs || []).filter((r) => r.id !== log.id),
                        })
                      }
                      className="text-stone-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-stone-800 leading-relaxed">{log.note}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 6. MICRO-LEARNING LIBRARY FORM MODAL & LESSON READER DRAWER
// ============================================================================
export const MicroLessonFormModal: React.FC<{
  initial?: MicroLesson | null;
  isSaving?: boolean;
  onSave: (lesson: MicroLesson) => void;
  onClose: () => void;
}> = ({ initial, isSaving, onSave, onClose }) => {
  const [topic, setTopic] = useState(initial?.topic || '');
  const [category, setCategory] = useState(initial?.category || 'Communication');
  const [format, setFormat] = useState<NonNullable<MicroLesson['format']>>(
    initial?.format || 'Article'
  );
  const [durationMinutes, setDurationMinutes] = useState(String(initial?.durationMinutes ?? 5));
  const [objective, setObjective] = useState(initial?.objective || '');
  const [explanation, setExplanation] = useState(initial?.explanation || '');
  const [practicalExample, setPracticalExample] = useState(initial?.practicalExample || '');
  const [reflectionQuestion, setReflectionQuestion] = useState(initial?.reflectionQuestion || '');
  const [suggestedActivity, setSuggestedActivity] = useState(initial?.suggestedActivity || '');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || !objective.trim()) {
      setError('Lesson topic and objective are required.');
      return;
    }
    onSave({
      id: initial?.id || `ml-${Date.now()}`,
      topic: topic.trim(),
      category: category.trim() || 'Communication',
      format,
      durationMinutes: Math.max(1, Math.min(60, parseInt(durationMinutes, 10) || 5)),
      objective: objective.trim(),
      explanation: explanation.trim(),
      practicalExample: practicalExample.trim(),
      reflectionQuestion: reflectionQuestion.trim() || 'How can we apply this idea this week?',
      suggestedActivity: suggestedActivity.trim() || 'Discuss together over family dinner.',
      bookmarked: initial?.bookmarked ?? false,
      completed: initial?.completed ?? false,
      userReflection: initial?.userReflection || '',
      version: initial?.version,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-stone-200 max-w-lg w-full p-6 space-y-4 shadow-xl my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div>
            <h3 className="text-lg font-serif font-bold text-stone-900">
              {initial ? 'Edit Micro-Lesson' : 'Add Micro-Learning Lesson'}
            </h3>
            <p className="text-xs text-stone-500">
              Bite-sized articles, videos, and interactive guides for calm everyday learning.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-stone-700 mb-1">Lesson Title / Topic *</label>
            <input
              type="text"
              required
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Active Listening in Family Conversations"
              className="w-full px-3 py-2 rounded-xl border border-stone-300"
            />
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Communication"
                className="w-full px-3 py-2 rounded-xl border border-stone-300"
              />
            </div>
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Format</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as NonNullable<MicroLesson['format']>)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white"
              >
                <option value="Article">Article</option>
                <option value="Video">Video</option>
                <option value="Interactive Guide">Interactive Guide</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Minutes</label>
              <input
                type="number"
                min={1}
                max={60}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 font-mono tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">Core Objective *</label>
            <input
              type="text"
              required
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="e.g. Practice reflective listening before offering solutions."
              className="w-full px-3 py-2 rounded-xl border border-stone-300"
            />
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">Key Explanation</label>
            <textarea
              rows={2}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Explain why this concept matters in everyday family life..."
              className="w-full px-3 py-2 rounded-xl border border-stone-300"
            />
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">Practical Example</label>
            <textarea
              rows={2}
              value={practicalExample}
              onChange={(e) => setPracticalExample(e.target.value)}
              placeholder="Concrete phrasing or real-world scenario..."
              className="w-full px-3 py-2 rounded-xl border border-stone-300"
            />
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">Reflection Question</label>
            <input
              type="text"
              value={reflectionQuestion}
              onChange={(e) => setReflectionQuestion(e.target.value)}
              placeholder="e.g. When did you feel most listened to this week?"
              className="w-full px-3 py-2 rounded-xl border border-stone-300"
            />
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">Suggested Activity</label>
            <input
              type="text"
              value={suggestedActivity}
              onChange={(e) => setSuggestedActivity(e.target.value)}
              placeholder="e.g. Practice a 3-minute uninterrupted listening turn at dinner."
              className="w-full px-3 py-2 rounded-xl border border-stone-300"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
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
              className="px-4 py-2 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white font-semibold cursor-pointer"
            >
              {isSaving ? 'Saving...' : initial ? 'Save Lesson' : 'Add Lesson'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 7. FAMILY LEARNING & CURRICULA FORM MODAL & DRAWER
// ============================================================================
export const FamilyCurriculumFormModal: React.FC<{
  initial?: FamilyCurriculumItem | null;
  isSaving?: boolean;
  onSave: (item: FamilyCurriculumItem) => void;
  onClose: () => void;
}> = ({ initial, isSaving, onSave, onClose }) => {
  const [title, setTitle] = useState(initial?.title || '');
  const [category, setCategory] = useState(initial?.category || 'Financial Literacy');
  const [schedule, setSchedule] = useState(initial?.schedule || 'Sundays • 4:00 PM');
  const [topic, setTopic] = useState(initial?.topic || '');
  const [stepsText, setStepsText] = useState(
    (initial?.modules || []).map((m) => m.text).join('\n')
  );
  const [error, setError] = useState<string | null>(null);

  const handleApplyTemplate = (tpl: (typeof DEFAULT_CURRICULUM_TEMPLATES)[number]) => {
    setTitle(tpl.title);
    setCategory(tpl.category);
    setSchedule(tpl.schedule);
    setTopic(tpl.topic);
    setStepsText(tpl.steps.join('\n'));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Curriculum title is required.');
      return;
    }
    const lines = stepsText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const existingMap = new Map((initial?.modules || []).map((m) => [m.text, m.completed]));
    const modules: CurriculumModuleStep[] = lines.map((text, idx) => ({
      id: `mod-${Date.now()}-${idx}`,
      text,
      completed: existingMap.get(text) ?? false,
    }));
    const doneCount = modules.filter((m) => m.completed).length;

    onSave({
      id: initial?.id || `fl-${Date.now()}`,
      title: title.trim(),
      category: category.trim() || 'Family Study Plan',
      schedule: schedule.trim() || 'Weekly Family Session',
      topic: topic.trim() || 'Shared family study plan and discussion.',
      modules,
      progress:
        modules.length > 0
          ? `${doneCount} of ${modules.length} modules completed`
          : 'Active Family Curriculum',
      version: initial?.version,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-stone-200 max-w-lg w-full p-6 space-y-4 shadow-xl my-8">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div>
            <h3 className="text-lg font-serif font-bold text-stone-900">
              {initial ? 'Edit Family Curriculum' : 'Create Family Learning Curriculum'}
            </h3>
            <p className="text-xs text-stone-500">
              Structured shared family study plans with step-by-step module checklists.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-2 text-xs">
          <span className="font-semibold text-stone-700 block">Load Curriculum Template:</span>
          <div className="flex flex-wrap gap-1.5">
            {DEFAULT_CURRICULUM_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => handleApplyTemplate(tpl)}
                className="px-2.5 py-1 rounded-lg border border-stone-200 bg-white hover:bg-stone-100 text-stone-700 font-medium cursor-pointer"
              >
                {tpl.title}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-stone-700 mb-1">Curriculum / Study Plan Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Monthly Household Financial Literacy Workshop"
              className="w-full px-3 py-2 rounded-xl border border-stone-300"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white"
              >
                <option value="Reading Challenge">Reading Challenge</option>
                <option value="Financial Literacy">Financial Literacy</option>
                <option value="Life Skills">Life Skills</option>
                <option value="Science & Nature">Science & Nature</option>
                <option value="Cultural & History">Cultural & History</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Schedule</label>
              <input
                type="text"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                placeholder="e.g. Sundays • 4:00 PM"
                className="w-full px-3 py-2 rounded-xl border border-stone-300"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">Study Plan Overview</label>
            <textarea
              rows={2}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Describe how the family will explore this topic together..."
              className="w-full px-3 py-2 rounded-xl border border-stone-300"
            />
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Step-by-Step Modules / Checklist Items (one per line)
            </label>
            <textarea
              rows={4}
              value={stepsText}
              onChange={(e) => setStepsText(e.target.value)}
              placeholder={'Module 1: Save, Spend, and Share Buckets\nModule 2: Reading Household Utility Budgets Together'}
              className="w-full px-3 py-2 rounded-xl border border-stone-300"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
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
              className="px-4 py-2 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white font-semibold cursor-pointer"
            >
              {isSaving ? 'Saving...' : initial ? 'Save Curriculum' : 'Create Curriculum'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 8. PARENTING RESOURCES FORM MODAL
// ============================================================================
export const ParentingResourceFormModal: React.FC<{
  initial?: ParentingResourceItem | null;
  isSaving?: boolean;
  onSave: (item: ParentingResourceItem) => void;
  onClose: () => void;
}> = ({ initial, isSaving, onSave, onClose }) => {
  const [topic, setTopic] = useState(initial?.topic || '');
  const [category, setCategory] = useState(initial?.category || 'Positive Parenting');
  const [ageGroup, setAgeGroup] = useState(initial?.ageGroup || 'All Ages');
  const [summary, setSummary] = useState(initial?.summary || '');
  const [practiceTip, setPracticeTip] = useState(initial?.practiceTip || '');
  const [parentNotes, setParentNotes] = useState(initial?.parentNotes || '');
  const [bookmarked, setBookmarked] = useState(Boolean(initial?.bookmarked));
  const [attachments, setAttachments] = useState<ParentingAttachment[]>(initial?.attachments || []);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || !summary.trim()) {
      setError('Resource title and summary are required.');
      return;
    }
    onSave({
      id: initial?.id || `pr-${Date.now()}`,
      topic: topic.trim(),
      category,
      ageGroup,
      summary: summary.trim(),
      practiceTip: practiceTip.trim() || 'Discuss calmly during a unhurried moment.',
      parentNotes: parentNotes.trim() || undefined,
      bookmarked,
      attachments,
      version: initial?.version,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-stone-200 max-w-lg w-full p-6 space-y-4 shadow-xl my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div>
            <h3 className="text-lg font-serif font-bold text-stone-900">
              {initial ? 'Edit Parenting Guide' : 'Add Parenting Reference Guide'}
            </h3>
            <p className="text-xs text-stone-500">
              Save trusted parenting articles, practical scripts, notes, and reference documents.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-stone-700 mb-1">Guide / Resource Title *</label>
            <input
              type="text"
              required
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Emotion Coaching During Transitions"
              className="w-full px-3 py-2 rounded-xl border border-stone-300"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white"
              >
                <option value="Positive Parenting">Positive Parenting</option>
                <option value="Emotional Development">Emotional Development</option>
                <option value="Parent-Child Connection">Parent-Child Connection</option>
                <option value="Constructive Guidance">Constructive Guidance</option>
                <option value="Digital Wellbeing">Digital Wellbeing</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Age Stage</label>
              <select
                value={ageGroup}
                onChange={(e) => setAgeGroup(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white"
              >
                <option value="All Ages">All Ages</option>
                <option value="Early Childhood (3–6)">Early Childhood (3–6)</option>
                <option value="Ages 5–12">Elementary (Ages 5–12)</option>
                <option value="Ages 13–18">Teens (Ages 13–18)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">Key Summary *</label>
            <textarea
              rows={2}
              required
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Core takeaway or guidance principle..."
              className="w-full px-3 py-2 rounded-xl border border-stone-300"
            />
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">Practical Everyday Tip / Script</label>
            <input
              type="text"
              value={practiceTip}
              onChange={(e) => setPracticeTip(e.target.value)}
              placeholder='e.g. Give a gentle 10-minute heads-up before changing activities.'
              className="w-full px-3 py-2 rounded-xl border border-stone-300"
            />
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">Parent Notes & Reflections</label>
            <textarea
              rows={2}
              value={parentNotes}
              onChange={(e) => setParentNotes(e.target.value)}
              placeholder="Personal notes on how this applies to our household..."
              className="w-full px-3 py-2 rounded-xl border border-stone-300"
            />
          </div>

          <label className="inline-flex items-center gap-2 text-stone-700 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={bookmarked}
              onChange={(e) => setBookmarked(e.target.checked)}
              className="rounded border-stone-300 text-emerald-900"
            />
            <span>Bookmark this guide for quick reference</span>
          </label>

          <AttachmentPickerSection
            label="Reference PDFs, Handouts & Visual Guides"
            attachments={attachments}
            onChange={setAttachments}
            onError={setError}
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
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
              className="px-4 py-2 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white font-semibold cursor-pointer"
            >
              {isSaving ? 'Saving...' : initial ? 'Save Guide' : 'Add Guide'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
