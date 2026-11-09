import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Plus,
  Search,
  Trash2,
  Edit3,
  Bookmark,
  FileText,
  Lock,
  RotateCcw,
  SlidersHorizontal,
  RefreshCw,
  Eye,
  X,
} from 'lucide-react';
import {
  readNamespacedCache,
  writeNamespacedCache,
  IS_DEV_FIXTURE_MODE,
} from '../utils/namespacedStorage';
import { syncDomainRecordToDatabase } from '../firebase';
import {
  ChildDevProfile,
  MilestoneEntry,
  ChildRoutine,
  RoutineTemplate,
  StudyLearningItem,
  WellbeingHabit,
  PersonalGrowthGoal,
  MicroLesson,
  FamilyCurriculumItem,
  ParentingResourceItem,
  DEFAULT_ROUTINE_TEMPLATES,
  DeleteConfirmModal,
  ChildProfileFormModal,
  ChildMilestoneModal,
  ChildProfileDetailDrawer,
  ChildRoutineFormModal,
  RoutineTemplatesModal,
  EducationFormModal,
  WellbeingHabitFormModal,
  PersonalGoalFormModal,
  PersonalGoalDetailDrawer,
  MicroLessonFormModal,
  FamilyCurriculumFormModal,
  ParentingResourceFormModal,
} from './parenting/ParentingModals';

export interface ParentingGrowthCenterProps {
  selectedRole: string;
  sessionToken?: string;
  familyId?: string;
  actorUserId?: string;
  actorMemberId?: string;
  actorDisplayName?: string;
  activeSubPage?: string;
  onSelectSubPage?: (subId: string) => void;
}

type ParentingSubTab =
  | 'child_profiles'
  | 'child_routines'
  | 'education'
  | 'wellbeing'
  | 'personal_dev'
  | 'micro_learning'
  | 'family_learning'
  | 'resources';

const SUBPAGE_TO_PARENTING_TAB: Record<string, ParentingSubTab> = {
  parent_profiles: 'child_profiles',
  parent_routines: 'child_routines',
  parent_education: 'education',
  parent_wellbeing: 'wellbeing',
  parent_personal: 'personal_dev',
  parent_micro: 'micro_learning',
  parent_family_learning: 'family_learning',
  parent_resources: 'resources',
};

const PARENTING_TAB_TO_SUBPAGE: Record<ParentingSubTab, string> = {
  child_profiles: 'parent_profiles',
  child_routines: 'parent_routines',
  education: 'parent_education',
  wellbeing: 'parent_wellbeing',
  personal_dev: 'parent_personal',
  micro_learning: 'parent_micro',
  family_learning: 'parent_family_learning',
  resources: 'parent_resources',
};

const DEFAULT_CHILD_PROFILES: ChildDevProfile[] = [
  {
    id: 'cd-lucas',
    name: 'Lucas Jenkins',
    age: 9,
    grade: 'Grade 4 · Westfield Elementary',
    readingProgress: '25 minutes daily · Reading "The Wild Robot" (Chapter 18)',
    developmentalNotes:
      'Thrives with hands-on building projects and visual checklists before morning transitions.',
    milestones: [
      'Completed first 200-page chapter book independently',
      'Mastered multiplication tables 1–12',
      'Co-led youth soccer warm-ups with patience and encouragement',
    ],
    learningActivities: [
      'LEGO Robotics Builders Club',
      'Weekly library reading log',
      'Beginner piano chords',
    ],
    interests: ['Soccer', 'Space Exploration', 'LEGO Engineering', 'Science Experiments'],
    skillsDevelopment: [
      'Teamwork & sportsmanship',
      'Morning routine independence',
      'Asking thoughtful questions during family reading',
    ],
    achievements: ['Kindness & Collaboration Recognition'],
    attachments: [],
  },
  {
    id: 'cd-maya',
    name: 'Maya Jenkins',
    age: 16,
    grade: 'Grade 10 · Westfield High School',
    readingProgress: '35 minutes daily · Reading "Atomic Habits" & AP History primary sources',
    developmentalNotes:
      'Values autonomy in scheduling study blocks and enjoys mentoring younger students in photography.',
    milestones: [
      'Selected for Regional Youth Photography Exhibition',
      'Completed First Aid & Community Care Certification',
      'Designed independent study calendar for fall semester exams',
    ],
    learningActivities: [
      'AP World History seminar',
      'Digital Darkroom & Composition course',
      'Personal budgeting & financial stewardship',
    ],
    interests: ['Digital Photography', 'Track & Field', 'Environmental Science', 'Acoustic Guitar'],
    skillsDevelopment: [
      'Time-blocking for long-term projects',
      'Public speaking & seminar facilitation',
      'Financial literacy & savings planning',
    ],
    achievements: ['Fall Semester Academic Dedication'],
    attachments: [],
  },
];

const DEFAULT_ROUTINES: ChildRoutine[] = [
  {
    id: 'cr-1',
    childName: 'Lucas Jenkins',
    title: 'Morning School Preparation',
    timeOfDay: 'Morning',
    schedule: 'Weekdays · 7:00 AM – 7:45 AM',
    steps: [
      { id: 's1', text: 'Make bed and open curtains', completed: true },
      { id: 's2', text: 'Brush teeth and get dressed', completed: true },
      { id: 's3', text: 'Eat nourishing breakfast & clear plate', completed: true },
      { id: 's4', text: 'Pack homework folder and water bottle', completed: false },
    ],
  },
  {
    id: 'cr-2',
    childName: 'Lucas Jenkins',
    title: 'After-School & Bedtime Wind-Down',
    timeOfDay: 'Bedtime',
    schedule: 'Weekdays · 4:00 PM – 8:30 PM',
    steps: [
      { id: 's5', text: '20 minutes homework & math review', completed: true },
      { id: 's6', text: 'Outdoor play or soccer practice', completed: true },
      { id: 's7', text: '25 minutes chapter book reading', completed: false },
      { id: 's8', text: 'Lay out tomorrow’s clothes & lights out by 8:30 PM', completed: false },
    ],
  },
  {
    id: 'cr-3',
    childName: 'Maya Jenkins',
    title: 'High School Study & Evening Wind-Down',
    timeOfDay: 'After-School',
    schedule: 'Weekdays · 4:30 PM – 9:45 PM',
    steps: [
      { id: 's9', text: 'Focused AP study block (45 mins)', completed: true },
      { id: 's10', text: 'Camera gear & track bag prep for tomorrow', completed: true },
      { id: 's11', text: 'Evening reading & screen-free wind-down', completed: false },
    ],
  },
];

const DEFAULT_STUDY_ITEMS: StudyLearningItem[] = [
  {
    id: 'ed-1',
    student: 'Lucas Jenkins',
    childName: 'Lucas Jenkins',
    subject: 'STEM & Reading List',
    goal: 'Read 12 chapter books this semester & build solar rover kit',
    status: '8 of 12 books read',
    schedule: 'Mon–Fri · 4:15 PM',
    dueDate: '2026-12-15',
    teacherNotes: 'Mr. Alvarez noted strong curiosity during the renewable energy lab.',
    completed: false,
    attachments: [],
    version: 1,
  },
  {
    id: 'ed-2',
    student: 'Maya Jenkins',
    childName: 'Maya Jenkins',
    subject: 'AP World History & Photography Portfolio',
    goal: 'Complete primary source essay and curate 15-piece documentary photo series',
    status: '11 of 15 pieces curated',
    schedule: 'Mon–Thu · 5:00 PM',
    dueDate: '2026-11-30',
    teacherNotes: 'Ms. Chen praised the historical context in Maya’s draft outline.',
    completed: false,
    attachments: [],
    version: 1,
  },
];

const DEFAULT_HABITS: WellbeingHabit[] = [
  {
    id: 'hb-1',
    title: 'Unhurried Evening Reading & Sleep Wind-Down',
    category: 'Sleep & Rest',
    member: 'Lucas Jenkins',
    rhythmTarget: 'Evenings before 8:30 PM',
    supportiveNote: 'Warm lamp light and 20 minutes of story time to rest well.',
    completedToday: true,
    recentCheckInDates: ['2026-11-04', '2026-11-05', '2026-11-06'],
    version: 1,
  },
  {
    id: 'hb-2',
    title: 'Hydration & Whole-Food Afternoon Fuel',
    category: 'Nutrition & Hydration',
    member: 'Maya Jenkins',
    rhythmTarget: 'Daily before track practice',
    supportiveNote: 'Refill water bottle and pack fruit & nuts before afternoon classes.',
    completedToday: true,
    recentCheckInDates: ['2026-11-05', '2026-11-06'],
    version: 1,
  },
  {
    id: 'hb-3',
    title: 'Family Outdoor Walk or Active Play (30 mins)',
    category: 'Physical Activity',
    member: 'Whole Family',
    rhythmTarget: '4–5 afternoons each week',
    supportiveNote: 'Focused on fresh air, conversation, and movement together.',
    completedToday: false,
    recentCheckInDates: ['2026-11-03', '2026-11-05'],
    version: 1,
  },
];

const DEFAULT_PERSONAL_GOALS: PersonalGrowthGoal[] = [
  {
    id: 'pg-1',
    member: 'Sarah Jenkins',
    audienceType: 'ADULT',
    ownerUserId: 'usr-sarah-owner',
    category: 'Leadership & Wellbeing',
    title: 'Mindful Family Presence & Half-Marathon Preparation',
    progress: 75,
    nextAction: 'Complete Saturday 10km trail run and Chapter 6 reflection',
    skills: ['Unhurried active listening', 'Endurance pacing', 'Restful evening boundaries'],
    reflectionLogs: [
      {
        id: 'rl-1',
        date: '2026-11-03',
        note: 'Docking phones before dinner made our evening conversations feel much calmer.',
      },
    ],
    isPrivate: false,
    version: 1,
  },
  {
    id: 'pg-2',
    member: 'David Jenkins',
    audienceType: 'ADULT',
    ownerUserId: 'usr-david-admin',
    category: 'Craft & Stewardship',
    title: 'Custom Woodworking Joinery & Estate Stewardship',
    progress: 60,
    nextAction: 'Finish oak bookshelf joinery in the garage workshop on Sunday',
    skills: ['Hand-cut dovetail joinery', 'Long-term household planning'],
    reflectionLogs: [],
    isPrivate: false,
    version: 1,
  },
  {
    id: 'pg-3',
    member: 'Maya Jenkins',
    audienceType: 'CHILD',
    ownerUserId: 'usr-maya-teen',
    category: 'Creative & Life Skills',
    title: 'Documentary Photography & Independent Budget Stewardship',
    progress: 80,
    nextAction: 'Select final 4 natural-light prints for the school exhibition',
    skills: ['Manual exposure & composition', 'Monthly personal savings planning'],
    reflectionLogs: [
      {
        id: 'rl-2',
        date: '2026-11-04',
        note: 'Planning study blocks on Sunday evening gave me extra time for darkroom printing.',
      },
    ],
    isPrivate: false,
    version: 1,
  },
];

const DEFAULT_LESSONS: MicroLesson[] = [
  {
    id: 'ml-1',
    topic: 'Active Listening in Family Conversations',
    category: 'Communication',
    format: 'Article',
    durationMinutes: 5,
    objective: 'Practice reflective listening before offering advice or solutions.',
    explanation:
      'When family members feel heard first, defensiveness drops and collaborative problem-solving becomes natural.',
    practicalExample:
      'Instead of "You should just do X," try: "It sounds like today felt overwhelming because of Y—is that right?"',
    reflectionQuestion: 'When did you feel most listened to by a family member this week?',
    suggestedActivity: 'Practice a 3-minute uninterrupted listening turn during dinner tonight.',
    bookmarked: true,
    completed: true,
    userReflection: 'Practiced during Tuesday dinner; helped Maya talk through her exam schedule calmly.',
  },
  {
    id: 'ml-2',
    topic: 'Teaching the Save, Spend, and Share Habit',
    category: 'Financial Literacy',
    format: 'Interactive Guide',
    durationMinutes: 6,
    objective: 'Introduce thoughtful allocation into Save, Spend, and Share buckets.',
    explanation:
      'Visualizing money in distinct purposeful buckets builds patience and generosity early in life.',
    practicalExample:
      'Set aside a portion for long-term goals, a portion for everyday enjoyment, and a portion for family or community giving.',
    reflectionQuestion: 'What shared family giving or savings milestone excites us this season?',
    suggestedActivity: 'Discuss how our household plans for upcoming seasonal projects.',
    bookmarked: false,
    completed: false,
    userReflection: '',
  },
  {
    id: 'ml-3',
    topic: 'Designing Calm Evening Wind-Downs',
    category: 'Wellbeing & Sleep',
    format: 'Video',
    durationMinutes: 4,
    objective: 'Create a 30-minute screen-free transition before sleep for both adults and children.',
    explanation:
      'Lowering visual stimulation and preparing tomorrow’s essentials reduces morning rush and improves sleep quality.',
    practicalExample:
      'At 8:00 PM, dim living room lights, pack backpacks, and read together for 20 minutes.',
    reflectionQuestion: 'What single evening habit makes your next morning feel calmer?',
    suggestedActivity: 'Try a household-wide 8:30 PM device charging dock ritual this week.',
    bookmarked: true,
    completed: false,
    userReflection: '',
  },
];

const DEFAULT_FAMILY_LEARNING: FamilyCurriculumItem[] = [
  {
    id: 'fl-1',
    title: 'Weekly Family Reading & Storytelling Circle',
    category: 'Reading Challenge',
    schedule: 'Sundays · 4:00 PM',
    topic: 'Everyone reads in the living room with herbal tea and shares one favorite insight or character moment.',
    progress: '3 of 4 modules completed',
    modules: [
      { id: 'fl1-m1', text: 'Select autumn individual and family read-aloud books', completed: true },
      { id: 'fl1-m2', text: 'Host two Sunday afternoon quiet reading hours', completed: true },
      { id: 'fl1-m3', text: 'Share favorite character decisions over dinner', completed: true },
      { id: 'fl1-m4', text: 'Write brief book reflections for the family library log', completed: false },
    ],
    version: 1,
  },
  {
    id: 'fl-2',
    title: 'Household Financial Stewardship & Generosity Curriculum',
    category: 'Financial Literacy',
    schedule: 'First Saturday · 10:00 AM',
    topic: 'Explore how household budgets, long-term savings, and community giving work in age-appropriate terms.',
    progress: '2 of 4 modules completed',
    modules: [
      { id: 'fl2-m1', text: 'Understanding Save, Spend, and Share Buckets', completed: true },
      { id: 'fl2-m2', text: 'How Household Utility & Grocery Budgets Work', completed: true },
      { id: 'fl2-m3', text: 'Patience & Long-Term Compounding', completed: false },
      { id: 'fl2-m4', text: 'Choosing a Family Community Giving Project', completed: false },
    ],
    version: 1,
  },
  {
    id: 'fl-3',
    title: 'Hands-On Culinary & Home Care Life Skills',
    category: 'Life Skills',
    schedule: 'Wednesdays · 5:30 PM',
    topic: 'Children and parents co-lead preparing wholesome meals and practicing practical home care skills.',
    progress: '1 of 3 modules completed',
    modules: [
      { id: 'fl3-m1', text: 'Kitchen safety, measurement, and ingredient prep', completed: true },
      { id: 'fl3-m2', text: 'Co-leading a full family recipe from start to finish', completed: false },
      { id: 'fl3-m3', text: 'Planning a balanced meal menu and ingredient list', completed: false },
    ],
    version: 1,
  },
];

const DEFAULT_PARENTING_RESOURCES: ParentingResourceItem[] = [
  {
    id: 'pr-1',
    topic: 'Encouraging Effort & Curiosity Over Comparison',
    category: 'Positive Parenting',
    summary:
      'Acknowledge specific effort, curiosity, patience, and kindness rather than comparing siblings or focusing solely on outcomes.',
    ageGroup: 'All Ages',
    practiceTip: 'Use "I noticed how thoughtfully you worked through..." during evening check-ins.',
    parentNotes: 'Helps keep our home environment supportive and free of sibling competition.',
    bookmarked: true,
    attachments: [],
  },
  {
    id: 'pr-2',
    topic: 'Emotion Coaching During Daily Transitions',
    category: 'Emotional Development',
    summary:
      'Help children name feelings before problem-solving when transitioning from play or creative projects to homework and bedtime.',
    ageGroup: 'Ages 5–12',
    practiceTip: 'Give a calm 10-minute heads-up before switching activities.',
    parentNotes: 'Very helpful before dinner and bedtime transitions.',
    bookmarked: true,
    attachments: [],
  },
  {
    id: 'pr-3',
    topic: 'Supporting Autonomy & Responsibility in Teens',
    category: 'Parent-Child Connection',
    summary:
      'Invite teenagers to co-design their study schedule and personal goals so they build self-advocacy and confidence.',
    ageGroup: 'Ages 13–18',
    practiceTip: 'Hold a relaxed 15-minute Sunday planning chat where your teen leads the agenda.',
    parentNotes: 'Maya enjoys leading her Sunday evening week preview.',
    bookmarked: false,
    attachments: [],
  },
  {
    id: 'pr-4',
    topic: 'Constructive Guidance & Natural Consequences',
    category: 'Constructive Guidance',
    summary:
      'Establish clear, calm household expectations rooted in shared care and mutual respect rather than reactive penalties.',
    ageGroup: 'All Ages',
    practiceTip: 'Review shared agreements together during calm, unhurried moments.',
    parentNotes: '',
    bookmarked: false,
    attachments: [],
  },
];

export const ParentingGrowthCenter: React.FC<ParentingGrowthCenterProps> = ({
  selectedRole,
  sessionToken = '',
  familyId = '',
  actorUserId = '',
  actorMemberId = '',
  actorDisplayName = '',
  activeSubPage,
  onSelectSubPage,
}) => {
  const canMutate = selectedRole !== 'GUEST';

  const [resolvedFamilyId, setResolvedFamilyId] = useState<string>(familyId);
  const [resolvedUserId, setResolvedUserId] = useState<string>(actorUserId);
  const [resolvedMemberId, setResolvedMemberId] = useState<string>(actorMemberId);

  useEffect(() => {
    if (familyId) setResolvedFamilyId(familyId);
    if (actorUserId) setResolvedUserId(actorUserId);
    if (actorMemberId) setResolvedMemberId(actorMemberId);
  }, [familyId, actorUserId, actorMemberId]);

  const cacheScope = useMemo(
    () =>
      resolvedFamilyId && resolvedUserId
        ? { userAccountId: resolvedUserId, familyId: resolvedFamilyId }
        : null,
    [resolvedFamilyId, resolvedUserId]
  );

  const [activeSubTab, setActiveSubTab] = useState<ParentingSubTab>(
    (activeSubPage && SUBPAGE_TO_PARENTING_TAB[activeSubPage]) || 'child_profiles'
  );

  useEffect(() => {
    if (activeSubPage && SUBPAGE_TO_PARENTING_TAB[activeSubPage]) {
      setActiveSubTab(SUBPAGE_TO_PARENTING_TAB[activeSubPage]);
    }
  }, [activeSubPage]);

  const handleSelectParentingTab = (tab: ParentingSubTab) => {
    setActiveSubTab(tab);
    setValidationError(null);
    if (onSelectSubPage) {
      onSelectSubPage(PARENTING_TAB_TO_SUBPAGE[tab]);
    }
  };

  // Global search & scoped filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChildFilter, setSelectedChildFilter] = useState<string>('ALL');
  const [routineTimeFilter, setRoutineTimeFilter] = useState<string>('ALL');
  const [educationStatusFilter, setEducationStatusFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');
  const [wellbeingMemberFilter, setWellbeingMemberFilter] = useState<string>('ALL');
  const [wellbeingCategoryFilter, setWellbeingCategoryFilter] = useState<string>('ALL');
  const [personalTrackFilter, setPersonalTrackFilter] = useState<'ALL' | 'ADULT' | 'CHILD'>('ALL');
  const [personalMemberFilter, setPersonalMemberFilter] = useState<string>('ALL');
  const [lessonFilter, setLessonFilter] = useState<'ALL' | 'BOOKMARKED' | 'COMPLETED'>('ALL');
  const [lessonCategoryFilter, setLessonCategoryFilter] = useState<string>('ALL');
  const [curriculumCategoryFilter, setCurriculumCategoryFilter] = useState<string>('ALL');
  const [resourceCategoryFilter, setResourceCategoryFilter] = useState<string>('ALL');
  const [resourceBookmarkOnly, setResourceBookmarkOnly] = useState<boolean>(false);

  // Feedback & loading states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [conflictBanner, setConflictBanner] = useState<string | null>(null);

  // 8 Domain Collections State + Custom Routine Templates
  const [childProfiles, setChildProfiles] = useState<ChildDevProfile[]>(() =>
    readNamespacedCache(
      cacheScope,
      'parenting',
      'childProfiles',
      IS_DEV_FIXTURE_MODE ? DEFAULT_CHILD_PROFILES : []
    )
  );
  const [childRoutines, setChildRoutines] = useState<ChildRoutine[]>(() =>
    readNamespacedCache(
      cacheScope,
      'parenting',
      'childRoutines',
      IS_DEV_FIXTURE_MODE ? DEFAULT_ROUTINES : []
    )
  );
  const [customRoutineTemplates, setCustomRoutineTemplates] = useState<RoutineTemplate[]>(() =>
    readNamespacedCache(cacheScope, 'parenting', 'routineTemplates', [])
  );
  const [studyItems, setStudyItems] = useState<StudyLearningItem[]>(() =>
    readNamespacedCache(
      cacheScope,
      'parenting',
      'studyItems',
      IS_DEV_FIXTURE_MODE ? DEFAULT_STUDY_ITEMS : []
    )
  );
  const [habits, setHabits] = useState<WellbeingHabit[]>(() =>
    readNamespacedCache(
      cacheScope,
      'parenting',
      'habits',
      IS_DEV_FIXTURE_MODE ? DEFAULT_HABITS : []
    )
  );
  const [personalGrowthGoals, setPersonalGrowthGoals] = useState<PersonalGrowthGoal[]>(() =>
    readNamespacedCache(
      cacheScope,
      'parenting',
      'personalGrowthGoals',
      IS_DEV_FIXTURE_MODE ? DEFAULT_PERSONAL_GOALS : []
    )
  );
  const [lessons, setLessons] = useState<MicroLesson[]>(() =>
    readNamespacedCache(
      cacheScope,
      'parenting',
      'lessons',
      IS_DEV_FIXTURE_MODE ? DEFAULT_LESSONS : []
    )
  );
  const [familyLearningItems, setFamilyLearningItems] = useState<FamilyCurriculumItem[]>(() =>
    readNamespacedCache(
      cacheScope,
      'parenting',
      'familyLearningItems',
      IS_DEV_FIXTURE_MODE ? DEFAULT_FAMILY_LEARNING : []
    )
  );
  const [parentingResources, setParentingResources] = useState<ParentingResourceItem[]>(() =>
    readNamespacedCache(
      cacheScope,
      'parenting',
      'parentingResources',
      IS_DEV_FIXTURE_MODE ? DEFAULT_PARENTING_RESOURCES : []
    )
  );

  // Modals & Slide-Over Drawers State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ChildDevProfile | null>(null);
  const [milestoneModalChildId, setMilestoneModalChildId] = useState<string | null>(null);
  const [inspectingProfileId, setInspectingProfileId] = useState<string | null>(null);

  const [isRoutineModalOpen, setIsRoutineModalOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<ChildRoutine | null>(null);
  const [isRoutineTemplatesOpen, setIsRoutineTemplatesOpen] = useState(false);

  const [isEducationModalOpen, setIsEducationModalOpen] = useState(false);
  const [editingEducation, setEditingEducation] = useState<StudyLearningItem | null>(null);

  const [isHabitModalOpen, setIsHabitModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<WellbeingHabit | null>(null);

  const [isPersonalGoalModalOpen, setIsPersonalGoalModalOpen] = useState(false);
  const [editingPersonalGoal, setEditingPersonalGoal] = useState<PersonalGrowthGoal | null>(null);
  const [inspectingPersonalGoalId, setInspectingPersonalGoalId] = useState<string | null>(null);

  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<MicroLesson | null>(null);
  const [activeLessonDrawerId, setActiveLessonDrawerId] = useState<string | null>(null);

  const [isCurriculumModalOpen, setIsCurriculumModalOpen] = useState(false);
  const [editingCurriculum, setEditingCurriculum] = useState<FamilyCurriculumItem | null>(null);

  const [isResourceModalOpen, setIsResourceModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<ParentingResourceItem | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{
    collection: string;
    entityType: string;
    id: string;
    title: string;
  } | null>(null);

  const showToast = (msg: string) => {
    setStatusNotice(msg);
    setValidationError(null);
    setTimeout(() => setStatusNotice(null), 3500);
  };

  const notifyParentingUpdated = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('familyos-parenting-updated'));
    }
  };

  // Authoritative bidirectional GET hydration
  const hydrateFromBackend = useCallback(async () => {
    if (!sessionToken) return;
    setIsLoading(true);
    try {
      let activeFamId = familyId || resolvedFamilyId;
      let activeUsrId = actorUserId || resolvedUserId;
      if (!activeFamId || !activeUsrId) {
        const restoreRes = await fetch('/api/v1/session/restore', {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        if (restoreRes.ok) {
          const restoreData = await restoreRes.json();
          activeFamId = restoreData.activeFamilyId || restoreData.activeMembership?.familyId || '';
          activeUsrId = restoreData.actor?.userAccountId || '';
          setResolvedFamilyId(activeFamId);
          setResolvedUserId(activeUsrId);
          setResolvedMemberId(restoreData.activeMembership?.memberProfileId || '');
        }
      }
      if (!activeFamId) return;

      const res = await fetch(`/api/v1/domain/${encodeURIComponent(activeFamId)}/parenting`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!res.ok) return;
      const payload = await res.json();
      const cols = payload?.collections;
      if (!cols) return;

      if (Array.isArray(cols.childProfiles) && cols.childProfiles.length > 0) {
        setChildProfiles(
          cols.childProfiles.map((cp: any) => ({
            ...cp,
            name: cp.name || cp.childName || 'Child',
            age: typeof cp.age === 'number' ? cp.age : 9,
            grade: cp.grade || cp.gradeOrStage || 'Elementary',
            readingProgress: cp.readingProgress || 'Daily reading habit',
            milestones: Array.isArray(cp.milestones)
              ? cp.milestones
              : cp.currentMilestone
              ? [cp.currentMilestone]
              : [],
            learningActivities: Array.isArray(cp.learningActivities) ? cp.learningActivities : [],
            interests: Array.isArray(cp.interests) ? cp.interests : [],
            skillsDevelopment: Array.isArray(cp.skillsDevelopment) ? cp.skillsDevelopment : [],
            achievements: Array.isArray(cp.achievements) ? cp.achievements : [],
          }))
        );
      }
      if (Array.isArray(cols.childRoutines) && cols.childRoutines.length > 0) {
        setChildRoutines(
          cols.childRoutines.map((cr: any) => ({
            ...cr,
            title: cr.title || cr.routineName || 'Daily Routine',
            schedule: cr.schedule || cr.timeOfDay || 'Daily',
            steps: Array.isArray(cr.steps) ? cr.steps : [],
          }))
        );
      }
      if (Array.isArray(cols.routineTemplates)) {
        setCustomRoutineTemplates(cols.routineTemplates);
      }
      if (Array.isArray(cols.studyItems) && cols.studyItems.length > 0) {
        setStudyItems(
          cols.studyItems.map((st: any) => ({
            ...st,
            student: st.student || st.childName || 'Lucas Jenkins',
            subject: st.subject || 'General Studies',
            goal: st.goal || st.title || 'Study Goal',
            status: st.status || 'In Progress',
            schedule: st.schedule || (st.dueDate ? `Due ${st.dueDate}` : 'Weekly Schedule'),
            completed: Boolean(st.completed || st.status === 'Completed'),
          }))
        );
      }
      if (Array.isArray(cols.habits) && cols.habits.length > 0) {
        setHabits(
          cols.habits.map((hb: any) => ({
            ...hb,
            category: hb.category || 'Sleep & Rest',
            rhythmTarget: hb.rhythmTarget || 'Daily gentle rhythm',
            completedToday: Boolean(hb.completedToday),
          }))
        );
      }
      if (Array.isArray(cols.personalGrowthGoals) && cols.personalGrowthGoals.length > 0) {
        setPersonalGrowthGoals(cols.personalGrowthGoals);
      }
      if (Array.isArray(cols.lessons) && cols.lessons.length > 0) {
        setLessons(cols.lessons);
      }
      if (Array.isArray(cols.familyLearningItems) && cols.familyLearningItems.length > 0) {
        setFamilyLearningItems(
          cols.familyLearningItems.map((fl: any) => ({
            ...fl,
            title: fl.title || fl.topic || 'Family Learning Session',
            category: fl.category || 'Family Study Plan',
            schedule: fl.schedule || 'Weekly Session',
            topic: fl.topic || fl.progress || '',
            modules: Array.isArray(fl.modules) ? fl.modules : [],
          }))
        );
      }
      if (Array.isArray(cols.parentingResources) && cols.parentingResources.length > 0) {
        setParentingResources(cols.parentingResources);
      }
    } catch {
      // Offline fallback uses namespaced cache
    } finally {
      setIsLoading(false);
    }
  }, [sessionToken, familyId, resolvedFamilyId, actorUserId, resolvedUserId]);

  useEffect(() => {
    void hydrateFromBackend();
  }, [hydrateFromBackend, selectedRole]);

  useEffect(() => {
    const onRefresh = () => {
      void hydrateFromBackend();
    };
    window.addEventListener('familyos-parenting-updated', onRefresh);
    return () => window.removeEventListener('familyos-parenting-updated', onRefresh);
  }, [hydrateFromBackend]);

  // Namespaced cache write
  useEffect(() => {
    if (!cacheScope) return;
    writeNamespacedCache(cacheScope, 'parenting', 'childProfiles', childProfiles);
    writeNamespacedCache(cacheScope, 'parenting', 'childRoutines', childRoutines);
    writeNamespacedCache(cacheScope, 'parenting', 'routineTemplates', customRoutineTemplates);
    writeNamespacedCache(cacheScope, 'parenting', 'studyItems', studyItems);
    writeNamespacedCache(cacheScope, 'parenting', 'habits', habits);
    writeNamespacedCache(cacheScope, 'parenting', 'personalGrowthGoals', personalGrowthGoals);
    writeNamespacedCache(cacheScope, 'parenting', 'lessons', lessons);
    writeNamespacedCache(cacheScope, 'parenting', 'familyLearningItems', familyLearningItems);
    writeNamespacedCache(cacheScope, 'parenting', 'parentingResources', parentingResources);
  }, [
    cacheScope,
    childProfiles,
    childRoutines,
    customRoutineTemplates,
    studyItems,
    habits,
    personalGrowthGoals,
    lessons,
    familyLearningItems,
    parentingResources,
  ]);

  const persistSingleRecord = async (
    collection: string,
    entityType: string,
    recordId: string,
    recordData: Record<string, any>
  ) => {
    if (!sessionToken || !resolvedFamilyId) return;
    setIsSaving(true);
    try {
      const res = await fetch(
        `/api/v1/domain/${encodeURIComponent(resolvedFamilyId)}/parenting/${encodeURIComponent(collection)}/${encodeURIComponent(recordId)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            baseVersion: typeof recordData.version === 'number' ? recordData.version : undefined,
            data: recordData,
          }),
        }
      );
      if (res.status === 409) {
        const conflictJson = await res.json().catch(() => ({}));
        setConflictBanner(
          conflictJson?.message ||
            conflictJson?.error ||
            'Concurrent edit conflict detected. Refreshing latest state.'
        );
        void hydrateFromBackend();
        return;
      }
      void syncDomainRecordToDatabase({
        sessionToken,
        familyId: resolvedFamilyId,
        entityType,
        entityId: recordId,
        data: recordData,
        operationType: 'UPSERT',
      });
      notifyParentingUpdated();
    } catch {
      // Offline fallback retained in namespaced cache
    } finally {
      setIsSaving(false);
    }
  };

  const deleteSingleRecord = async (collection: string, entityType: string, recordId: string) => {
    if (!sessionToken || !resolvedFamilyId) return;
    setIsSaving(true);
    try {
      await fetch(
        `/api/v1/domain/${encodeURIComponent(resolvedFamilyId)}/parenting/${encodeURIComponent(collection)}/${encodeURIComponent(recordId)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${sessionToken}` },
        }
      );
      void syncDomainRecordToDatabase({
        sessionToken,
        familyId: resolvedFamilyId,
        entityType,
        entityId: recordId,
        data: { id: recordId, isDeleted: true },
        operationType: 'DELETE',
      });
      notifyParentingUpdated();
    } catch {
      // Offline fallback
    } finally {
      setIsSaving(false);
    }
  };

  const childNames = useMemo(() => {
    const fromProfiles = childProfiles.map((c) => c.name).filter(Boolean);
    return Array.from(new Set([...fromProfiles, 'Lucas Jenkins', 'Maya Jenkins']));
  }, [childProfiles]);

  const memberOptions = useMemo(() => {
    return Array.from(
      new Set([
        actorDisplayName || 'Sarah Jenkins',
        'Sarah Jenkins',
        'David Jenkins',
        ...childNames,
        'Whole Family',
      ])
    );
  }, [actorDisplayName, childNames]);

  const allRoutineTemplates = useMemo(
    () => [...DEFAULT_ROUTINE_TEMPLATES, ...customRoutineTemplates],
    [customRoutineTemplates]
  );

  // ============================================================================
  // CRUD HANDLERS ACROSS ALL 8 SUB-MODULES
  // ============================================================================

  // 1. Child Profiles & Milestones
  const handleSaveChildProfile = async (profile: ChildDevProfile) => {
    setChildProfiles((prev) => {
      const exists = prev.some((p) => p.id === profile.id);
      return exists ? prev.map((p) => (p.id === profile.id ? profile : p)) : [profile, ...prev];
    });
    setIsProfileModalOpen(false);
    setEditingProfile(null);
    await persistSingleRecord('childProfiles', 'PAR_CHILD_PROFILE', profile.id, profile);
    showToast(`Saved ${profile.name}'s development profile.`);
  };

  const handleSaveMilestone = async (
    childId: string,
    milestoneText: string,
    entry: MilestoneEntry
  ) => {
    const target = childProfiles.find((cp) => cp.id === childId);
    if (!target) return;
    const updated: ChildDevProfile = {
      ...target,
      milestones: [milestoneText, ...(target.milestones || [])],
      structuredMilestones: [entry, ...(target.structuredMilestones || [])],
    };
    setChildProfiles((prev) => prev.map((cp) => (cp.id === childId ? updated : cp)));
    setMilestoneModalChildId(null);
    await persistSingleRecord('childProfiles', 'PAR_CHILD_PROFILE', updated.id, updated);
    showToast(`Recorded developmental milestone for ${target.name}.`);
  };

  const handleRemoveMilestone = async (profile: ChildDevProfile, index: number) => {
    const updated: ChildDevProfile = {
      ...profile,
      milestones: profile.milestones.filter((_, idx) => idx !== index),
    };
    setChildProfiles((prev) => prev.map((cp) => (cp.id === profile.id ? updated : cp)));
    await persistSingleRecord('childProfiles', 'PAR_CHILD_PROFILE', updated.id, updated);
    showToast('Milestone removed.');
  };

  // 2. Children's Routines & Templates
  const handleSaveRoutine = async (routine: ChildRoutine) => {
    setChildRoutines((prev) => {
      const exists = prev.some((r) => r.id === routine.id);
      return exists ? prev.map((r) => (r.id === routine.id ? routine : r)) : [routine, ...prev];
    });
    setIsRoutineModalOpen(false);
    setEditingRoutine(null);
    await persistSingleRecord('childRoutines', 'PAR_CHILD_ROUTINE', routine.id, routine);
    showToast(`Saved routine "${routine.title}".`);
  };

  const handleToggleRoutineStep = async (routineId: string, stepId: string) => {
    const target = childRoutines.find((r) => r.id === routineId);
    if (!target) return;
    const updated: ChildRoutine = {
      ...target,
      steps: target.steps.map((s) => (s.id === stepId ? { ...s, completed: !s.completed } : s)),
      lastCompletedDate: new Date().toISOString().slice(0, 10),
    };
    setChildRoutines((prev) => prev.map((r) => (r.id === routineId ? updated : r)));
    await persistSingleRecord('childRoutines', 'PAR_CHILD_ROUTINE', routineId, updated);
  };

  const handleResetRoutineSteps = async (routine: ChildRoutine) => {
    const updated: ChildRoutine = {
      ...routine,
      steps: routine.steps.map((s) => ({ ...s, completed: false })),
    };
    setChildRoutines((prev) => prev.map((r) => (r.id === routine.id ? updated : r)));
    await persistSingleRecord('childRoutines', 'PAR_CHILD_ROUTINE', routine.id, updated);
    showToast(`Reset daily checklist for "${routine.title}".`);
  };

  const handleSaveRoutineTemplate = async (tpl: RoutineTemplate) => {
    setCustomRoutineTemplates((prev) => [tpl, ...prev]);
    await persistSingleRecord('routineTemplates', 'PAR_ROUTINE_TEMPLATE', tpl.id, tpl);
    showToast(`Saved reusable template "${tpl.title}".`);
  };

  const handleDeleteRoutineTemplate = async (id: string) => {
    setCustomRoutineTemplates((prev) => prev.filter((t) => t.id !== id));
    await deleteSingleRecord('routineTemplates', 'PAR_ROUTINE_TEMPLATE', id);
    showToast('Custom routine template deleted.');
  };

  // 3. Education & Learning
  const handleSaveEducationItem = async (item: StudyLearningItem) => {
    setStudyItems((prev) => {
      const exists = prev.some((ed) => ed.id === item.id);
      return exists ? prev.map((ed) => (ed.id === item.id ? item : ed)) : [item, ...prev];
    });
    setIsEducationModalOpen(false);
    setEditingEducation(null);
    await persistSingleRecord('studyItems', 'PAR_STUDY_ITEM', item.id, item);
    showToast(`Saved learning plan "${item.subject}".`);
  };

  const handleToggleEducationComplete = async (ed: StudyLearningItem) => {
    const nextCompleted = !ed.completed;
    const updated: StudyLearningItem = {
      ...ed,
      completed: nextCompleted,
      status: nextCompleted ? 'Completed' : 'In Progress',
    };
    setStudyItems((prev) => prev.map((item) => (item.id === ed.id ? updated : item)));
    await persistSingleRecord('studyItems', 'PAR_STUDY_ITEM', ed.id, updated);
    showToast(nextCompleted ? 'Marked learning goal complete.' : 'Reopened learning goal.');
  };

  // 4. Wellbeing & Healthy Habits
  const handleSaveHabit = async (habit: WellbeingHabit) => {
    setHabits((prev) => {
      const exists = prev.some((h) => h.id === habit.id);
      return exists ? prev.map((h) => (h.id === habit.id ? habit : h)) : [habit, ...prev];
    });
    setIsHabitModalOpen(false);
    setEditingHabit(null);
    await persistSingleRecord('habits', 'PAR_HABIT', habit.id, habit);
    showToast(`Saved healthy habit "${habit.title}".`);
  };

  const handleToggleHabitToday = async (habit: WellbeingHabit) => {
    const todayIso = new Date().toISOString().slice(0, 10);
    const nextCompleted = !habit.completedToday;
    const existingDates = habit.recentCheckInDates || [];
    const nextDates = nextCompleted
      ? Array.from(new Set([...existingDates, todayIso]))
      : existingDates.filter((d) => d !== todayIso);

    const updated: WellbeingHabit = {
      ...habit,
      completedToday: nextCompleted,
      recentCheckInDates: nextDates,
    };
    setHabits((prev) => prev.map((item) => (item.id === habit.id ? updated : item)));
    await persistSingleRecord('habits', 'PAR_HABIT', habit.id, updated);
  };

  // 5. Personal Development
  const handleSavePersonalGoal = async (goal: PersonalGrowthGoal) => {
    setPersonalGrowthGoals((prev) => {
      const exists = prev.some((g) => g.id === goal.id);
      return exists ? prev.map((g) => (g.id === goal.id ? goal : g)) : [goal, ...prev];
    });
    setIsPersonalGoalModalOpen(false);
    setEditingPersonalGoal(null);
    await persistSingleRecord('personalGrowthGoals', 'PAR_PERSONAL_GOAL', goal.id, goal);
    showToast(`Saved personal growth goal "${goal.title}".`);
  };

  // 6. Micro-Learning Library
  const handleSaveLesson = async (lesson: MicroLesson) => {
    setLessons((prev) => {
      const exists = prev.some((l) => l.id === lesson.id);
      return exists ? prev.map((l) => (l.id === lesson.id ? lesson : l)) : [lesson, ...prev];
    });
    setIsLessonModalOpen(false);
    setEditingLesson(null);
    await persistSingleRecord('lessons', 'PAR_MICRO_LESSON', lesson.id, lesson);
    showToast(`Saved micro-lesson "${lesson.topic}".`);
  };

  // 7. Family Learning & Curricula
  const handleSaveCurriculum = async (item: FamilyCurriculumItem) => {
    setFamilyLearningItems((prev) => {
      const exists = prev.some((fl) => fl.id === item.id);
      return exists ? prev.map((fl) => (fl.id === item.id ? item : fl)) : [item, ...prev];
    });
    setIsCurriculumModalOpen(false);
    setEditingCurriculum(null);
    await persistSingleRecord('familyLearningItems', 'PAR_FAMILY_LEARNING', item.id, item);
    showToast(`Saved family curriculum "${item.title}".`);
  };

  const handleToggleCurriculumStep = async (curriculum: FamilyCurriculumItem, stepId: string) => {
    const nextModules = (curriculum.modules || []).map((m) =>
      m.id === stepId ? { ...m, completed: !m.completed } : m
    );
    const doneCount = nextModules.filter((m) => m.completed).length;
    const updated: FamilyCurriculumItem = {
      ...curriculum,
      modules: nextModules,
      progress: `${doneCount} of ${nextModules.length} modules completed`,
    };
    setFamilyLearningItems((prev) =>
      prev.map((item) => (item.id === curriculum.id ? updated : item))
    );
    await persistSingleRecord('familyLearningItems', 'PAR_FAMILY_LEARNING', curriculum.id, updated);
  };

  // 8. Parenting Resources
  const handleSaveResource = async (item: ParentingResourceItem) => {
    setParentingResources((prev) => {
      const exists = prev.some((pr) => pr.id === item.id);
      return exists ? prev.map((pr) => (pr.id === item.id ? item : pr)) : [item, ...prev];
    });
    setIsResourceModalOpen(false);
    setEditingResource(null);
    await persistSingleRecord('parentingResources', 'PAR_RESOURCE', item.id, item);
    showToast(`Saved parenting guide "${item.topic}".`);
  };

  // Unified Delete Handler
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const { collection, entityType, id, title } = deleteTarget;

    if (collection === 'childProfiles') {
      setChildProfiles((prev) => prev.filter((item) => item.id !== id));
    } else if (collection === 'childRoutines') {
      setChildRoutines((prev) => prev.filter((item) => item.id !== id));
    } else if (collection === 'studyItems') {
      setStudyItems((prev) => prev.filter((item) => item.id !== id));
    } else if (collection === 'habits') {
      setHabits((prev) => prev.filter((item) => item.id !== id));
    } else if (collection === 'personalGrowthGoals') {
      setPersonalGrowthGoals((prev) => prev.filter((item) => item.id !== id));
    } else if (collection === 'lessons') {
      setLessons((prev) => prev.filter((item) => item.id !== id));
    } else if (collection === 'familyLearningItems') {
      setFamilyLearningItems((prev) => prev.filter((item) => item.id !== id));
    } else if (collection === 'parentingResources') {
      setParentingResources((prev) => prev.filter((item) => item.id !== id));
    }

    setDeleteTarget(null);
    await deleteSingleRecord(collection, entityType, id);
    showToast(`Removed "${title}".`);
  };

  // ============================================================================
  // FILTERED VIEWS
  // ============================================================================
  const q = searchQuery.trim().toLowerCase();

  const filteredProfiles = useMemo(
    () =>
      childProfiles.filter((cp) => {
        if (selectedChildFilter !== 'ALL' && cp.name !== selectedChildFilter) return false;
        if (!q) return true;
        return (
          cp.name.toLowerCase().includes(q) ||
          cp.grade.toLowerCase().includes(q) ||
          cp.milestones.some((m) => m.toLowerCase().includes(q)) ||
          cp.interests.some((i) => i.toLowerCase().includes(q))
        );
      }),
    [childProfiles, selectedChildFilter, q]
  );

  const filteredRoutines = useMemo(
    () =>
      childRoutines.filter((cr) => {
        if (selectedChildFilter !== 'ALL' && cr.childName !== selectedChildFilter) return false;
        if (
          routineTimeFilter !== 'ALL' &&
          (cr.timeOfDay || '').toLowerCase() !== routineTimeFilter.toLowerCase()
        ) {
          return false;
        }
        if (!q) return true;
        return (
          cr.title.toLowerCase().includes(q) ||
          cr.childName.toLowerCase().includes(q) ||
          cr.steps.some((s) => s.text.toLowerCase().includes(q))
        );
      }),
    [childRoutines, selectedChildFilter, routineTimeFilter, q]
  );

  const filteredEducation = useMemo(
    () =>
      studyItems.filter((ed) => {
        const studentName = ed.student || ed.childName || '';
        if (selectedChildFilter !== 'ALL' && studentName !== selectedChildFilter) return false;
        if (educationStatusFilter === 'ACTIVE' && ed.completed) return false;
        if (educationStatusFilter === 'COMPLETED' && !ed.completed) return false;
        if (!q) return true;
        return (
          studentName.toLowerCase().includes(q) ||
          ed.subject.toLowerCase().includes(q) ||
          ed.goal.toLowerCase().includes(q) ||
          (ed.teacherNotes || '').toLowerCase().includes(q)
        );
      }),
    [studyItems, selectedChildFilter, educationStatusFilter, q]
  );

  const filteredHabits = useMemo(
    () =>
      habits.filter((hb) => {
        if (wellbeingMemberFilter !== 'ALL' && hb.member !== wellbeingMemberFilter) return false;
        if (wellbeingCategoryFilter !== 'ALL' && hb.category !== wellbeingCategoryFilter) {
          return false;
        }
        if (!q) return true;
        return (
          hb.title.toLowerCase().includes(q) ||
          hb.member.toLowerCase().includes(q) ||
          (hb.supportiveNote || '').toLowerCase().includes(q)
        );
      }),
    [habits, wellbeingMemberFilter, wellbeingCategoryFilter, q]
  );

  const filteredPersonalGoals = useMemo(
    () =>
      personalGrowthGoals.filter((pg) => {
        // Privacy check: if private, only show to owner or when matching actorUserId
        if (
          pg.isPrivate &&
          pg.ownerUserId &&
          resolvedUserId &&
          pg.ownerUserId !== resolvedUserId &&
          pg.member !== actorDisplayName
        ) {
          return false;
        }
        const track =
          pg.audienceType ||
          (pg.member.toLowerCase().includes('lucas') || pg.member.toLowerCase().includes('maya')
            ? 'CHILD'
            : 'ADULT');
        if (personalTrackFilter !== 'ALL' && track !== personalTrackFilter) return false;
        if (personalMemberFilter !== 'ALL' && pg.member !== personalMemberFilter) return false;
        if (!q) return true;
        return (
          pg.title.toLowerCase().includes(q) ||
          pg.member.toLowerCase().includes(q) ||
          pg.category.toLowerCase().includes(q) ||
          pg.nextAction.toLowerCase().includes(q)
        );
      }),
    [
      personalGrowthGoals,
      personalTrackFilter,
      personalMemberFilter,
      q,
      resolvedUserId,
      actorDisplayName,
    ]
  );

  const filteredLessons = useMemo(
    () =>
      lessons.filter((ml) => {
        if (lessonFilter === 'BOOKMARKED' && !ml.bookmarked) return false;
        if (lessonFilter === 'COMPLETED' && !ml.completed) return false;
        if (lessonCategoryFilter !== 'ALL' && ml.category !== lessonCategoryFilter) return false;
        if (!q) return true;
        return (
          ml.topic.toLowerCase().includes(q) ||
          ml.category.toLowerCase().includes(q) ||
          ml.objective.toLowerCase().includes(q) ||
          ml.explanation.toLowerCase().includes(q)
        );
      }),
    [lessons, lessonFilter, lessonCategoryFilter, q]
  );

  const filteredCurricula = useMemo(
    () =>
      familyLearningItems.filter((fl) => {
        if (curriculumCategoryFilter !== 'ALL' && fl.category !== curriculumCategoryFilter) {
          return false;
        }
        if (!q) return true;
        return (
          fl.title.toLowerCase().includes(q) ||
          fl.category.toLowerCase().includes(q) ||
          fl.topic.toLowerCase().includes(q)
        );
      }),
    [familyLearningItems, curriculumCategoryFilter, q]
  );

  const filteredResources = useMemo(
    () =>
      parentingResources.filter((pr) => {
        if (resourceBookmarkOnly && !pr.bookmarked) return false;
        if (resourceCategoryFilter !== 'ALL' && pr.category !== resourceCategoryFilter) {
          return false;
        }
        if (!q) return true;
        return (
          pr.topic.toLowerCase().includes(q) ||
          pr.summary.toLowerCase().includes(q) ||
          pr.category.toLowerCase().includes(q) ||
          (pr.parentNotes || '').toLowerCase().includes(q)
        );
      }),
    [parentingResources, resourceBookmarkOnly, resourceCategoryFilter, q]
  );

  const inspectingProfile = useMemo(
    () => childProfiles.find((p) => p.id === inspectingProfileId) || null,
    [childProfiles, inspectingProfileId]
  );

  const inspectingPersonalGoal = useMemo(
    () => personalGrowthGoals.find((g) => g.id === inspectingPersonalGoalId) || null,
    [personalGrowthGoals, inspectingPersonalGoalId]
  );

  const activeLessonDrawer = useMemo(
    () => lessons.find((l) => l.id === activeLessonDrawerId) || null,
    [lessons, activeLessonDrawerId]
  );

  return (
    <div className="space-y-6">
      {/* Calm Header & Sub-Navigation */}
      <div className="rounded-2xl p-6 sm:p-7 bg-[#173D35] text-white">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="max-w-2xl space-y-1.5">
            <div className="text-xs font-medium text-[#E5C388]">
              Parenting & Growth · The Development Center
            </div>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-white">
              Individual Growth, Education, Wellbeing & Family Learning
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
              Celebrate each child’s personal milestones, supportive routines, and curiosity at their own pace—free of sibling comparisons or competitive rankings.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void hydrateFromBackend()}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-emerald-100 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0"
              title="Sync latest development records"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading || isSaving ? 'animate-spin' : ''}`} />
              <span>{isSaving ? 'Syncing...' : 'Sync'}</span>
            </button>
          </div>
        </div>

        {/* 8 Sub-Module Navigation Tabs */}
        <div className="flex flex-wrap gap-1.5 mt-5 pt-4 border-t border-white/15">
          {[
            { id: 'child_profiles', label: 'Child Profiles & Milestones' },
            { id: 'child_routines', label: 'Children’s Routines' },
            { id: 'education', label: 'Education & Learning' },
            { id: 'wellbeing', label: 'Wellbeing & Healthy Habits' },
            { id: 'personal_dev', label: 'Personal Development' },
            { id: 'micro_learning', label: 'Micro-Learning Library' },
            { id: 'family_learning', label: 'Family Learning & Curricula' },
            { id: 'resources', label: 'Parenting Resources' },
          ].map((tab) => {
            const active = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSelectParentingTab(tab.id as ParentingSubTab)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#C39A60] text-[#173D35]'
                    : 'bg-white/10 text-emerald-100 hover:bg-white/15'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Global Search & Child/Member Scope Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-stone-200">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search milestones, routines, subjects, habits, or guides..."
            className="w-full pl-9 pr-8 py-1.5 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-stone-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Child Filter Buttons for Child-Scoped Tabs */}
        {(activeSubTab === 'child_profiles' ||
          activeSubTab === 'child_routines' ||
          activeSubTab === 'education') && (
          <div className="flex flex-wrap items-center gap-1 p-1 bg-stone-100 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setSelectedChildFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                selectedChildFilter === 'ALL'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              All Children
            </button>
            {childNames.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setSelectedChildFilter(name)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  selectedChildFilter === name
                    ? 'bg-white text-stone-900 shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        )}

        <div className="text-xs text-stone-500 font-mono tabular-nums hidden xl:flex items-center gap-2">
          <span>{childProfiles.reduce((acc, c) => acc + c.milestones.length, 0)} milestones</span>
          <span aria-hidden="true">·</span>
          <span>
            {lessons.filter((l) => l.completed).length}/{lessons.length} lessons completed
          </span>
        </div>
      </div>

      {/* Feedback Banners */}
      {conflictBanner && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs font-medium flex items-center justify-between">
          <span>{conflictBanner}</span>
          <button
            type="button"
            onClick={() => setConflictBanner(null)}
            className="font-bold underline ml-3 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {validationError && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium flex items-center justify-between">
          <span>{validationError}</span>
          <button
            type="button"
            onClick={() => setValidationError(null)}
            className="font-bold underline ml-3 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {statusNotice && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs font-medium flex items-center justify-between">
          <span>{statusNotice}</span>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            className="font-bold underline ml-3 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* =====================================================================
          1. CHILD PROFILES & MILESTONES
      ===================================================================== */}
      {activeSubTab === 'child_profiles' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-serif font-bold text-stone-900">
                Child Profiles & Developmental Milestones
              </h3>
              <p className="text-xs text-stone-500">
                Individualized growth records, reading notes, interests, and portfolio attachments for each child.
              </p>
            </div>
            {canMutate && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMilestoneModalChildId(childProfiles[0]?.id || '')}
                  className="px-3.5 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                >
                  + Record Milestone
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingProfile(null);
                    setIsProfileModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Child Profile</span>
                </button>
              </div>
            )}
          </div>

          {filteredProfiles.length === 0 ? (
            <div className="p-10 rounded-2xl bg-white border border-stone-200 text-center space-y-2">
              <p className="text-sm font-serif font-bold text-stone-800">No child profiles match your filter</p>
              <p className="text-xs text-stone-500">
                Clear your search filter or add a child development profile to begin tracking milestones.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredProfiles.map((cp) => (
                <div
                  key={cp.id}
                  className="rounded-2xl p-6 bg-white border border-stone-200 flex flex-col justify-between space-y-5"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2 text-xs text-stone-500">
                          <span>
                            Age <strong className="font-mono tabular-nums text-stone-700">{cp.age}</strong>
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{cp.grade}</span>
                          {(cp.attachments || []).length > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">
                                {cp.attachments?.length} attachment{cp.attachments?.length === 1 ? '' : 's'}
                              </span>
                            </>
                          )}
                        </div>
                        <h4 className="font-serif font-bold text-xl text-stone-900 mt-0.5">{cp.name}</h4>
                      </div>

                      {canMutate && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setMilestoneModalChildId(cp.id)}
                            className="px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs font-semibold text-emerald-900 hover:bg-stone-50 cursor-pointer whitespace-nowrap shrink-0"
                          >
                            + Milestone
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProfile(cp);
                              setIsProfileModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 cursor-pointer"
                            title={`Edit ${cp.name}`}
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteTarget({
                                collection: 'childProfiles',
                                entityType: 'PAR_CHILD_PROFILE',
                                id: cp.id,
                                title: cp.name,
                              })
                            }
                            className="p-1.5 rounded-lg text-stone-400 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                            title={`Remove ${cp.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {cp.developmentalNotes && (
                      <p className="text-xs text-stone-600 leading-relaxed">{cp.developmentalNotes}</p>
                    )}

                    <div className="pt-1 space-y-1 text-xs">
                      <span className="font-semibold text-stone-900 block">Reading & Curiosity</span>
                      <p className="text-stone-700">{cp.readingProgress}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-stone-100 text-xs">
                      <div className="space-y-1.5">
                        <span className="font-semibold text-stone-900 block">
                          Recent Milestones ({cp.milestones.length})
                        </span>
                        <ul className="space-y-1.5 text-stone-700">
                          {cp.milestones.slice(0, 4).map((m, i) => (
                            <li key={i} className="flex items-start justify-between gap-2">
                              <span className="leading-relaxed">• {m}</span>
                              {canMutate && (
                                <button
                                  type="button"
                                  onClick={() => void handleRemoveMilestone(cp, i)}
                                  className="text-stone-400 hover:text-rose-600 shrink-0 cursor-pointer"
                                  title="Remove milestone"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="space-y-1.5">
                        <span className="font-semibold text-stone-900 block">
                          Skills & Enrichment
                        </span>
                        <ul className="space-y-1 text-stone-600">
                          {[...cp.skillsDevelopment.slice(0, 2), ...cp.learningActivities.slice(0, 2)].map(
                            (act, i) => (
                              <li key={i} className="leading-relaxed">
                                • {act}
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-3 text-xs">
                    <div className="text-stone-500 truncate">
                      Interests: <span className="text-stone-700">{cp.interests.join(' · ') || 'Exploring'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setInspectingProfileId(cp.id)}
                      className="text-emerald-900 font-semibold hover:underline flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Full Portfolio & Notes</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          2. CHILDREN'S ROUTINES (with Reusable Checklist Templates)
      ===================================================================== */}
      {activeSubTab === 'child_routines' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-xl text-xs">
                {['ALL', 'Morning', 'After-School', 'Bedtime', 'Weekend'].map((tod) => (
                  <button
                    key={tod}
                    type="button"
                    onClick={() => setRoutineTimeFilter(tod)}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      routineTimeFilter === tod
                        ? 'bg-white text-stone-900 shadow-2xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    {tod === 'ALL' ? 'All Times' : tod}
                  </button>
                ))}
              </div>
            </div>

            {canMutate && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsRoutineTemplatesOpen(true)}
                  className="px-3.5 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Checklist Templates ({allRoutineTemplates.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingRoutine(null);
                    setIsRoutineModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Routine</span>
                </button>
              </div>
            )}
          </div>

          {filteredRoutines.length === 0 ? (
            <div className="p-10 rounded-2xl bg-white border border-stone-200 text-center space-y-2">
              <p className="text-sm font-serif font-bold text-stone-800">No routines match your filter</p>
              <p className="text-xs text-stone-500">
                Create a morning, after-school, or bedtime routine from a reusable template.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredRoutines.map((r) => {
                const doneCount = r.steps.filter((s) => s.completed).length;
                const totalSteps = r.steps.length;
                const pct = totalSteps > 0 ? Math.round((doneCount / totalSteps) * 100) : 0;

                return (
                  <div
                    key={r.id}
                    className="rounded-2xl p-6 bg-white border border-stone-200 flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-2 border-b border-stone-100 pb-3">
                        <div>
                          <div className="text-xs text-stone-500">
                            <span className="font-semibold text-emerald-900">{r.childName}</span>
                            <span aria-hidden="true"> · </span>
                            <span>{r.timeOfDay || 'Daily'}</span>
                          </div>
                          <h4 className="font-serif font-bold text-lg text-stone-900 mt-0.5">{r.title}</h4>
                          <p className="text-xs text-stone-500 mt-0.5">{r.schedule}</p>
                        </div>

                        {canMutate && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => void handleResetRoutineSteps(r)}
                              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-800 hover:bg-stone-100 cursor-pointer"
                              title="Reset today's checkboxes"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRoutine(r);
                                setIsRoutineModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-800 hover:bg-stone-100 cursor-pointer"
                              title="Edit routine"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({
                                  collection: 'childRoutines',
                                  entityType: 'PAR_CHILD_ROUTINE',
                                  id: r.id,
                                  title: r.title,
                                })
                              }
                              className="p-1.5 rounded-lg text-stone-400 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                              title="Delete routine"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Subtle Progress Bar */}
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center justify-between text-stone-600">
                          <span>Daily Checklist</span>
                          <span className="font-mono tabular-nums font-semibold text-stone-900">
                            {doneCount}/{totalSteps} steps ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-stone-100 overflow-hidden">
                          <div
                            className="h-full bg-[#173D35] rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      <div className="space-y-2 text-xs">
                        {r.steps.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => void handleToggleRoutineStep(r.id, s.id)}
                            className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                              s.completed
                                ? 'bg-emerald-50/60 border-emerald-200 text-stone-500 line-through'
                                : 'bg-stone-50/70 border-stone-200 text-stone-800 hover:bg-stone-100'
                            }`}
                          >
                            <span className="leading-snug">{s.text}</span>
                            <CheckCircle2
                              className={`w-4 h-4 shrink-0 ${
                                s.completed ? 'text-emerald-700' : 'text-stone-300'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          3. EDUCATION & LEARNING (Subjects, Teacher Notes & Report Uploads)
      ===================================================================== */}
      {activeSubTab === 'education' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-xl text-xs">
              {(
                [
                  { id: 'ALL', label: 'All Subjects' },
                  { id: 'ACTIVE', label: 'In Progress' },
                  { id: 'COMPLETED', label: 'Completed' },
                ] as const
              ).map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setEducationStatusFilter(st.id)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    educationStatusFilter === st.id
                      ? 'bg-white text-stone-900 shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {canMutate && (
              <button
                type="button"
                onClick={() => {
                  setEditingEducation(null);
                  setIsEducationModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add Subject / Study Card</span>
              </button>
            )}
          </div>

          {filteredEducation.length === 0 ? (
            <div className="p-10 rounded-2xl bg-white border border-stone-200 text-center space-y-2">
              <p className="text-sm font-serif font-bold text-stone-800">No education items found</p>
              <p className="text-xs text-stone-500">
                Add a reading list, school subject, study schedule, or teacher conference note.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredEducation.map((ed) => {
                const studentName = ed.student || ed.childName || 'Student';
                return (
                  <div
                    key={ed.id}
                    className="rounded-2xl p-6 bg-white border border-stone-200 flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2 border-b border-stone-100 pb-3">
                        <div>
                          <div className="text-xs text-stone-500">
                            <span className="font-semibold text-emerald-900">{studentName}</span>
                            <span aria-hidden="true"> · </span>
                            <span>{ed.subject}</span>
                            <span aria-hidden="true"> · </span>
                            <span className="font-mono tabular-nums">{ed.schedule}</span>
                          </div>
                          <h4
                            className={`font-serif font-bold text-lg mt-0.5 ${
                              ed.completed ? 'line-through text-stone-400' : 'text-stone-900'
                            }`}
                          >
                            {ed.goal}
                          </h4>
                        </div>

                        {canMutate && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingEducation(ed);
                                setIsEducationModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-800 hover:bg-stone-100 cursor-pointer"
                              title="Edit learning card"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({
                                  collection: 'studyItems',
                                  entityType: 'PAR_STUDY_ITEM',
                                  id: ed.id,
                                  title: ed.subject,
                                })
                              }
                              className="p-1.5 rounded-lg text-stone-400 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                              title="Delete learning card"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="text-xs text-stone-600 flex flex-wrap items-center gap-2">
                        <span>
                          Progress: <strong className="text-stone-900">{ed.status}</strong>
                        </span>
                        {ed.dueDate && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">Target: {ed.dueDate}</span>
                          </>
                        )}
                      </div>

                      {ed.teacherNotes && (
                        <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 text-xs text-stone-700 leading-relaxed">
                          <strong className="text-stone-900">Teacher / Study Note:</strong> {ed.teacherNotes}
                        </div>
                      )}

                      {(ed.attachments || []).length > 0 && (
                        <div className="pt-1 space-y-1.5 text-xs">
                          <span className="font-semibold text-stone-700 block">
                            Attached Reports & Study Files ({ed.attachments?.length})
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {ed.attachments?.map((att) => (
                              <a
                                key={att.id}
                                href={att.dataUrl}
                                download={att.name}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-800 font-medium"
                              >
                                <FileText className="w-3.5 h-3.5 text-emerald-800" />
                                <span className="truncate max-w-[160px]">{att.name}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
                      <span className="text-stone-500">
                        {ed.completed ? 'Completed milestone' : 'Active study plan'}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleToggleEducationComplete(ed)}
                        className={`px-3 py-1.5 rounded-xl font-semibold cursor-pointer transition-colors ${
                          ed.completed
                            ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                            : 'bg-stone-100 hover:bg-stone-200 text-stone-800'
                        }`}
                      >
                        {ed.completed ? 'Completed ✓' : 'Mark Complete'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          4. WELLBEING & HEALTHY HABITS (Personal Consistency, No Penalties)
      ===================================================================== */}
      {activeSubTab === 'wellbeing' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap items-center gap-1 p-1 bg-stone-100 rounded-xl text-xs">
                {[
                  'ALL',
                  'Sleep & Rest',
                  'Nutrition & Hydration',
                  'Mindfulness & Calm',
                  'Physical Activity',
                  'Screen Balance',
                ].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setWellbeingCategoryFilter(cat)}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      wellbeingCategoryFilter === cat
                        ? 'bg-white text-stone-900 shadow-2xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    {cat === 'ALL' ? 'All Pillars' : cat}
                  </button>
                ))}
              </div>

              <select
                value={wellbeingMemberFilter}
                onChange={(e) => setWellbeingMemberFilter(e.target.value)}
                aria-label="Filter habits by family member"
                className="px-3 py-1.5 rounded-xl border border-stone-200 bg-white text-xs text-stone-700 font-medium"
              >
                <option value="ALL">All Family Members</option>
                {memberOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {canMutate && (
              <button
                type="button"
                onClick={() => {
                  setEditingHabit(null);
                  setIsHabitModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add Healthy Habit</span>
              </button>
            )}
          </div>

          {filteredHabits.length === 0 ? (
            <div className="p-10 rounded-2xl bg-white border border-stone-200 text-center space-y-2">
              <p className="text-sm font-serif font-bold text-stone-800">No healthy habits match your filter</p>
              <p className="text-xs text-stone-500">
                Add a supportive sleep, nutrition, mindfulness, or outdoor movement habit.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredHabits.map((hb) => (
                <div
                  key={hb.id}
                  className="rounded-2xl p-6 bg-white border border-stone-200 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs text-stone-500">
                        <span className="font-semibold text-emerald-900">{hb.member}</span>
                        <span aria-hidden="true"> · </span>
                        <span>{hb.category}</span>
                      </div>

                      {canMutate && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingHabit(hb);
                              setIsHabitModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-800 hover:bg-stone-100 cursor-pointer"
                            title="Edit habit"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteTarget({
                                collection: 'habits',
                                entityType: 'PAR_HABIT',
                                id: hb.id,
                                title: hb.title,
                              })
                            }
                            className="p-1.5 rounded-lg text-stone-400 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                            title="Remove habit"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <h4 className="font-serif font-bold text-base text-stone-900">{hb.title}</h4>
                    <div className="text-xs text-stone-500">
                      Gentle Rhythm: <span className="text-stone-700 font-medium">{hb.rhythmTarget}</span>
                    </div>

                    {hb.supportiveNote && (
                      <p className="text-xs text-stone-600 leading-relaxed">{hb.supportiveNote}</p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2 text-xs">
                    <span className="text-stone-500">
                      {hb.completedToday ? 'Practiced today' : 'Ready for today'}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleToggleHabitToday(hb)}
                      className={`px-3.5 py-1.5 rounded-xl font-semibold cursor-pointer transition-colors ${
                        hb.completedToday
                          ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                          : 'bg-stone-100 hover:bg-stone-200 text-stone-800'
                      }`}
                    >
                      {hb.completedToday ? 'Practiced Today ✓' : 'Check In for Today'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          5. PERSONAL DEVELOPMENT (Adults & Children Tracks + Reflection Logs)
      ===================================================================== */}
      {activeSubTab === 'personal_dev' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-xl text-xs">
                {(
                  [
                    { id: 'ALL', label: 'All Growth Tracks' },
                    { id: 'ADULT', label: 'Parents & Adults' },
                    { id: 'CHILD', label: 'Children & Teens' },
                  ] as const
                ).map((tr) => (
                  <button
                    key={tr.id}
                    type="button"
                    onClick={() => setPersonalTrackFilter(tr.id)}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      personalTrackFilter === tr.id
                        ? 'bg-white text-stone-900 shadow-2xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    {tr.label}
                  </button>
                ))}
              </div>

              <select
                value={personalMemberFilter}
                onChange={(e) => setPersonalMemberFilter(e.target.value)}
                aria-label="Filter personal goals by member"
                className="px-3 py-1.5 rounded-xl border border-stone-200 bg-white text-xs text-stone-700 font-medium"
              >
                <option value="ALL">All Members</option>
                {memberOptions
                  .filter((m) => m !== 'Whole Family')
                  .map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
              </select>
            </div>

            {canMutate && (
              <button
                type="button"
                onClick={() => {
                  setEditingPersonalGoal(null);
                  setIsPersonalGoalModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>New Personal Goal</span>
              </button>
            )}
          </div>

          {filteredPersonalGoals.length === 0 ? (
            <div className="p-10 rounded-2xl bg-white border border-stone-200 text-center space-y-2">
              <p className="text-sm font-serif font-bold text-stone-800">No personal growth goals found</p>
              <p className="text-xs text-stone-500">
                Create an individual skill-building goal and reflection log for an adult or child.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredPersonalGoals.map((pg) => {
                const trackLabel =
                  pg.audienceType === 'CHILD' ||
                  pg.member.toLowerCase().includes('lucas') ||
                  pg.member.toLowerCase().includes('maya')
                    ? 'Child / Teen Track'
                    : 'Adult Track';
                return (
                  <div
                    key={pg.id}
                    className="rounded-2xl p-6 bg-white border border-stone-200 flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2 border-b border-stone-100 pb-3">
                        <div>
                          <div className="flex items-center gap-1.5 text-xs text-stone-500">
                            <span className="font-semibold text-emerald-900">{pg.member}</span>
                            <span aria-hidden="true">·</span>
                            <span>{trackLabel}</span>
                            <span aria-hidden="true">·</span>
                            <span>{pg.category}</span>
                            {pg.isPrivate && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="inline-flex items-center gap-0.5 text-amber-800">
                                  <Lock className="w-3 h-3" /> Private
                                </span>
                              </>
                            )}
                          </div>
                          <h4 className="font-serif font-bold text-lg text-stone-900 mt-0.5">{pg.title}</h4>
                        </div>

                        {canMutate && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPersonalGoal(pg);
                                setIsPersonalGoalModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-800 hover:bg-stone-100 cursor-pointer"
                              title="Edit goal"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({
                                  collection: 'personalGrowthGoals',
                                  entityType: 'PAR_PERSONAL_GOAL',
                                  id: pg.id,
                                  title: pg.title,
                                })
                              }
                              className="p-1.5 rounded-lg text-stone-400 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                              title="Delete goal"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-stone-600 font-medium">Personal Progress</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono tabular-nums font-semibold text-stone-900">
                              {pg.progress}%
                            </span>
                            {canMutate && (
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = {
                                    ...pg,
                                    progress: Math.min(100, pg.progress + 10),
                                  };
                                  void handleSavePersonalGoal(updated);
                                }}
                                className="px-2 py-0.5 rounded bg-stone-100 hover:bg-stone-200 text-stone-800 font-mono text-[11px] font-semibold cursor-pointer"
                              >
                                +10%
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-stone-100 overflow-hidden">
                          <div
                            className="h-full bg-[#173D35] rounded-full transition-all"
                            style={{ width: `${pg.progress}%` }}
                          />
                        </div>
                      </div>

                      <p className="text-xs text-stone-600">
                        <strong className="text-stone-900">Next Step:</strong> {pg.nextAction}
                      </p>

                      {(pg.skills || []).length > 0 && (
                        <div className="text-xs text-stone-500">
                          Skills: <span className="text-stone-700">{pg.skills?.join(' · ')}</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
                      <span className="text-stone-500 font-mono tabular-nums">
                        {(pg.reflectionLogs || []).length} reflection log
                        {(pg.reflectionLogs || []).length === 1 ? '' : 's'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setInspectingPersonalGoalId(pg.id)}
                        className="text-emerald-900 font-semibold hover:underline cursor-pointer"
                      >
                        Open Reflection Journal →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          6. MICRO-LEARNING LIBRARY (Articles, Videos, Saved & Completed States)
      ===================================================================== */}
      {activeSubTab === 'micro_learning' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-xl text-xs">
                {(
                  [
                    { id: 'ALL', label: 'All Lessons' },
                    { id: 'BOOKMARKED', label: 'Saved / Bookmarked' },
                    { id: 'COMPLETED', label: 'Completed' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setLessonFilter(f.id)}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      lessonFilter === f.id
                        ? 'bg-white text-stone-900 shadow-2xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <select
                value={lessonCategoryFilter}
                onChange={(e) => setLessonCategoryFilter(e.target.value)}
                aria-label="Filter micro-lessons by category"
                className="px-3 py-1.5 rounded-xl border border-stone-200 bg-white text-xs text-stone-700 font-medium"
              >
                <option value="ALL">All Categories</option>
                {Array.from(new Set(lessons.map((l) => l.category))).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {canMutate && (
              <button
                type="button"
                onClick={() => {
                  setEditingLesson(null);
                  setIsLessonModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add Micro-Lesson</span>
              </button>
            )}
          </div>

          {filteredLessons.length === 0 ? (
            <div className="p-10 rounded-2xl bg-white border border-stone-200 text-center space-y-2">
              <p className="text-sm font-serif font-bold text-stone-800">No micro-lessons match your filter</p>
              <p className="text-xs text-stone-500">
                Reset filters or add a bite-sized lesson to the family library.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredLessons.map((ml) => (
                <div
                  key={ml.id}
                  className="rounded-2xl p-6 bg-white border border-stone-200 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2 border-b border-stone-100 pb-3">
                      <div>
                        <div className="text-xs text-stone-500">
                          <span>{ml.format || 'Article'}</span>
                          <span aria-hidden="true"> · </span>
                          <span className="font-mono tabular-nums">{ml.durationMinutes || 5} min</span>
                          <span aria-hidden="true"> · </span>
                          <span>{ml.category}</span>
                        </div>
                        <h4 className="font-serif font-bold text-lg text-stone-900 mt-0.5">{ml.topic}</h4>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            void handleSaveLesson({ ...ml, bookmarked: !ml.bookmarked })
                          }
                          className={`p-1.5 rounded-lg cursor-pointer ${
                            ml.bookmarked
                              ? 'text-amber-600 bg-amber-50'
                              : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100'
                          }`}
                          title={ml.bookmarked ? 'Saved' : 'Save lesson'}
                        >
                          <Bookmark className="w-4 h-4" />
                        </button>
                        {canMutate && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingLesson(ml);
                                setIsLessonModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-800 hover:bg-stone-100 cursor-pointer"
                              title="Edit lesson"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({
                                  collection: 'lessons',
                                  entityType: 'PAR_MICRO_LESSON',
                                  id: ml.id,
                                  title: ml.topic,
                                })
                              }
                              className="p-1.5 rounded-lg text-stone-400 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                              title="Delete lesson"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <p className="text-xs font-medium text-stone-800 leading-relaxed">{ml.objective}</p>
                    <p className="text-xs text-stone-600 leading-relaxed">{ml.explanation}</p>

                    <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 text-xs space-y-1">
                      <span className="font-semibold text-stone-900 block">Try Together:</span>
                      <p className="text-stone-700">{ml.suggestedActivity}</p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setActiveLessonDrawerId(ml.id)}
                      className="text-emerald-900 font-semibold hover:underline cursor-pointer"
                    >
                      {ml.userReflection ? 'View / Edit Reflection Note →' : 'Read & Add Reflection →'}
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleSaveLesson({ ...ml, completed: !ml.completed })}
                      className={`px-3 py-1.5 rounded-xl font-semibold cursor-pointer transition-colors ${
                        ml.completed
                          ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                          : 'bg-stone-100 hover:bg-stone-200 text-stone-800'
                      }`}
                    >
                      {ml.completed ? 'Completed ✓' : 'Mark Complete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          7. FAMILY LEARNING & CURRICULA (Step-by-Step Checklists)
      ===================================================================== */}
      {activeSubTab === 'family_learning' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-stone-100 rounded-xl text-xs">
              {[
                'ALL',
                'Reading Challenge',
                'Financial Literacy',
                'Life Skills',
                'Science & Nature',
              ].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCurriculumCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    curriculumCategoryFilter === cat
                      ? 'bg-white text-stone-900 shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {cat === 'ALL' ? 'All Study Plans' : cat}
                </button>
              ))}
            </div>

            {canMutate && (
              <button
                type="button"
                onClick={() => {
                  setEditingCurriculum(null);
                  setIsCurriculumModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Create Family Curriculum</span>
              </button>
            )}
          </div>

          {filteredCurricula.length === 0 ? (
            <div className="p-10 rounded-2xl bg-white border border-stone-200 text-center space-y-2">
              <p className="text-sm font-serif font-bold text-stone-800">No family curricula match your filter</p>
              <p className="text-xs text-stone-500">
                Create a structured family study plan or load a curriculum template.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredCurricula.map((fl) => {
                const modules = fl.modules || [];
                const doneCount = modules.filter((m) => m.completed).length;
                const totalCount = modules.length;
                const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

                return (
                  <div
                    key={fl.id}
                    className="rounded-2xl p-6 bg-white border border-stone-200 flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3.5">
                      <div className="flex items-start justify-between gap-2 border-b border-stone-100 pb-3">
                        <div>
                          <div className="text-xs text-stone-500">
                            <span className="font-semibold text-emerald-900">{fl.category}</span>
                            <span aria-hidden="true"> · </span>
                            <span className="font-mono tabular-nums">{fl.schedule}</span>
                          </div>
                          <h4 className="font-serif font-bold text-lg text-stone-900 mt-0.5">{fl.title}</h4>
                        </div>

                        {canMutate && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCurriculum(fl);
                                setIsCurriculumModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-800 hover:bg-stone-100 cursor-pointer"
                              title="Edit curriculum"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({
                                  collection: 'familyLearningItems',
                                  entityType: 'PAR_FAMILY_LEARNING',
                                  id: fl.id,
                                  title: fl.title,
                                })
                              }
                              className="p-1.5 rounded-lg text-stone-400 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                              title="Delete curriculum"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      <p className="text-xs text-stone-600 leading-relaxed">{fl.topic}</p>

                      {totalCount > 0 && (
                        <>
                          <div className="space-y-1 text-xs">
                            <div className="flex items-center justify-between text-stone-600">
                              <span>Study Plan Progress</span>
                              <span className="font-mono tabular-nums font-semibold text-stone-900">
                                {doneCount}/{totalCount} modules ({pct}%)
                              </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-stone-100 overflow-hidden">
                              <div
                                className="h-full bg-[#173D35] rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5 text-xs pt-1">
                            {modules.map((mod) => (
                              <button
                                key={mod.id}
                                type="button"
                                onClick={() => void handleToggleCurriculumStep(fl, mod.id)}
                                className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                                  mod.completed
                                    ? 'bg-emerald-50/60 border-emerald-200 text-stone-500 line-through'
                                    : 'bg-stone-50/70 border-stone-200 text-stone-800 hover:bg-stone-100'
                                }`}
                              >
                                <span className="leading-snug">{mod.text}</span>
                                <CheckCircle2
                                  className={`w-4 h-4 shrink-0 ${
                                    mod.completed ? 'text-emerald-700' : 'text-stone-300'
                                  }`}
                                />
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          8. PARENTING RESOURCES (Searchable Guides, Bookmarks & Attachments)
      ===================================================================== */}
      {activeSubTab === 'resources' && (
        <div className="space-y-5">
          <div className="p-4 rounded-2xl bg-stone-100/80 border border-stone-200 text-xs text-stone-700">
            <strong>Supportive Guidance Note:</strong> Parenting reference guides in FamilyOS support calm household communication and never replace licensed medical or developmental care.
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap items-center gap-1 p-1 bg-stone-100 rounded-xl text-xs">
                {[
                  'ALL',
                  'Positive Parenting',
                  'Emotional Development',
                  'Parent-Child Connection',
                  'Constructive Guidance',
                ].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setResourceCategoryFilter(cat)}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      resourceCategoryFilter === cat
                        ? 'bg-white text-stone-900 shadow-2xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    {cat === 'ALL' ? 'All Guides' : cat}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setResourceBookmarkOnly((prev) => !prev)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  resourceBookmarkOnly
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>Bookmarked Only</span>
              </button>
            </div>

            {canMutate && (
              <button
                type="button"
                onClick={() => {
                  setEditingResource(null);
                  setIsResourceModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-[#173D35] hover:bg-emerald-950 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add Parenting Guide</span>
              </button>
            )}
          </div>

          {filteredResources.length === 0 ? (
            <div className="p-10 rounded-2xl bg-white border border-stone-200 text-center space-y-2">
              <p className="text-sm font-serif font-bold text-stone-800">No parenting guides match your filter</p>
              <p className="text-xs text-stone-500">
                Clear filters or add a new reference guide with notes and attachments.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredResources.map((pr) => (
                <div
                  key={pr.id}
                  className="rounded-2xl p-6 bg-white border border-stone-200 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2 border-b border-stone-100 pb-3">
                      <div>
                        <div className="text-xs text-stone-500">
                          <span className="font-semibold text-emerald-900">{pr.category}</span>
                          <span aria-hidden="true"> · </span>
                          <span>{pr.ageGroup}</span>
                        </div>
                        <h4 className="font-serif font-bold text-lg text-stone-900 mt-0.5">{pr.topic}</h4>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            void handleSaveResource({ ...pr, bookmarked: !pr.bookmarked })
                          }
                          className={`p-1.5 rounded-lg cursor-pointer ${
                            pr.bookmarked
                              ? 'text-amber-600 bg-amber-50'
                              : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100'
                          }`}
                          title={pr.bookmarked ? 'Bookmarked' : 'Bookmark guide'}
                        >
                          <Bookmark className="w-4 h-4" />
                        </button>
                        {canMutate && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingResource(pr);
                                setIsResourceModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-800 hover:bg-stone-100 cursor-pointer"
                              title="Edit guide"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({
                                  collection: 'parentingResources',
                                  entityType: 'PAR_RESOURCE',
                                  id: pr.id,
                                  title: pr.topic,
                                })
                              }
                              className="p-1.5 rounded-lg text-stone-400 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                              title="Delete guide"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-stone-700 leading-relaxed">{pr.summary}</p>

                    <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 text-xs text-stone-800">
                      <strong className="text-stone-900">Practical Tip:</strong> {pr.practiceTip}
                    </div>

                    {pr.parentNotes && (
                      <p className="text-xs text-stone-500 italic">
                        <strong className="not-italic text-stone-700">Our Notes:</strong> “{pr.parentNotes}”
                      </p>
                    )}

                    {(pr.attachments || []).length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1 text-xs">
                        {pr.attachments?.map((att) => (
                          <a
                            key={att.id}
                            href={att.dataUrl}
                            download={att.name}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-800 font-medium"
                          >
                            <FileText className="w-3.5 h-3.5 text-emerald-800" />
                            <span className="truncate max-w-[160px]">{att.name}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          MODALS & SLIDE-OVER DRAWERS
      ===================================================================== */}
      {isProfileModalOpen && (
        <ChildProfileFormModal
          initial={editingProfile}
          isSaving={isSaving}
          onSave={(profile) => void handleSaveChildProfile(profile)}
          onClose={() => {
            setIsProfileModalOpen(false);
            setEditingProfile(null);
          }}
        />
      )}

      {milestoneModalChildId !== null && (
        <ChildMilestoneModal
          childProfiles={childProfiles}
          defaultChildId={milestoneModalChildId}
          isSaving={isSaving}
          onSaveMilestone={(cId, text, entry) => void handleSaveMilestone(cId, text, entry)}
          onClose={() => setMilestoneModalChildId(null)}
        />
      )}

      {inspectingProfile && (
        <ChildProfileDetailDrawer
          profile={inspectingProfile}
          onEditProfile={(prof) => {
            setInspectingProfileId(null);
            setEditingProfile(prof);
            setIsProfileModalOpen(true);
          }}
          onAddMilestone={(cId) => {
            setInspectingProfileId(null);
            setMilestoneModalChildId(cId);
          }}
          onRemoveMilestone={(prof, idx) => void handleRemoveMilestone(prof, idx)}
          onClose={() => setInspectingProfileId(null)}
        />
      )}

      {isRoutineModalOpen && (
        <ChildRoutineFormModal
          initial={editingRoutine}
          childNames={childNames}
          templates={allRoutineTemplates}
          isSaving={isSaving}
          onSave={(routine) => void handleSaveRoutine(routine)}
          onClose={() => {
            setIsRoutineModalOpen(false);
            setEditingRoutine(null);
          }}
        />
      )}

      {isRoutineTemplatesOpen && (
        <RoutineTemplatesModal
          templates={allRoutineTemplates}
          onSaveTemplate={(tpl) => void handleSaveRoutineTemplate(tpl)}
          onDeleteTemplate={(id) => void handleDeleteRoutineTemplate(id)}
          onUseTemplate={(tpl) => {
            setIsRoutineTemplatesOpen(false);
            setEditingRoutine({
              id: `cr-${Date.now()}`,
              childName:
                selectedChildFilter !== 'ALL' ? selectedChildFilter : childNames[0] || 'Lucas Jenkins',
              title: tpl.title,
              timeOfDay: tpl.timeOfDay,
              schedule: tpl.schedule,
              steps: tpl.steps.map((s, idx) => ({
                id: `st-${Date.now()}-${idx}`,
                text: s,
                completed: false,
              })),
            });
            setIsRoutineModalOpen(true);
          }}
          onClose={() => setIsRoutineTemplatesOpen(false)}
        />
      )}

      {isEducationModalOpen && (
        <EducationFormModal
          initial={editingEducation}
          childNames={childNames}
          isSaving={isSaving}
          onSave={(item) => void handleSaveEducationItem(item)}
          onClose={() => {
            setIsEducationModalOpen(false);
            setEditingEducation(null);
          }}
        />
      )}

      {isHabitModalOpen && (
        <WellbeingHabitFormModal
          initial={editingHabit}
          memberOptions={memberOptions}
          isSaving={isSaving}
          onSave={(habit) => void handleSaveHabit(habit)}
          onClose={() => {
            setIsHabitModalOpen(false);
            setEditingHabit(null);
          }}
        />
      )}

      {isPersonalGoalModalOpen && (
        <PersonalGoalFormModal
          initial={editingPersonalGoal}
          memberOptions={memberOptions.filter((m) => m !== 'Whole Family')}
          defaultMember={actorDisplayName || 'Sarah Jenkins'}
          actorUserId={resolvedUserId}
          actorMemberId={resolvedMemberId}
          isSaving={isSaving}
          onSave={(goal) => void handleSavePersonalGoal(goal)}
          onClose={() => {
            setIsPersonalGoalModalOpen(false);
            setEditingPersonalGoal(null);
          }}
        />
      )}

      {inspectingPersonalGoal && (
        <PersonalGoalDetailDrawer
          goal={inspectingPersonalGoal}
          onUpdateGoal={(updated) => void handleSavePersonalGoal(updated)}
          onEditGoal={(g) => {
            setInspectingPersonalGoalId(null);
            setEditingPersonalGoal(g);
            setIsPersonalGoalModalOpen(true);
          }}
          onClose={() => setInspectingPersonalGoalId(null)}
        />
      )}

      {isLessonModalOpen && (
        <MicroLessonFormModal
          initial={editingLesson}
          isSaving={isSaving}
          onSave={(lesson) => void handleSaveLesson(lesson)}
          onClose={() => {
            setIsLessonModalOpen(false);
            setEditingLesson(null);
          }}
        />
      )}

      {activeLessonDrawer && (
        <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex justify-end">
          <div className="bg-white w-full max-w-lg h-full p-6 overflow-y-auto space-y-5 shadow-2xl border-l border-stone-200">
            <div className="flex items-start justify-between border-b border-stone-100 pb-4">
              <div>
                <div className="text-xs text-stone-500">
                  {activeLessonDrawer.format || 'Article'} · {activeLessonDrawer.durationMinutes || 5} min ·{' '}
                  {activeLessonDrawer.category}
                </div>
                <h3 className="text-lg font-serif font-bold text-stone-900 mt-0.5">
                  {activeLessonDrawer.topic}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveLessonDrawerId(null)}
                className="p-1.5 text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-1.5">
                <span className="font-semibold text-stone-900 block">Objective & Core Concept</span>
                <p className="text-stone-800 font-medium">{activeLessonDrawer.objective}</p>
                <p className="text-stone-600 leading-relaxed">{activeLessonDrawer.explanation}</p>
              </div>

              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-1.5">
                <span className="font-semibold text-stone-900 block">Practical Everyday Example</span>
                <p className="text-stone-700 leading-relaxed">{activeLessonDrawer.practicalExample}</p>
              </div>

              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-1.5">
                <span className="font-semibold text-stone-900 block">Suggested Family Practice</span>
                <p className="text-stone-700 leading-relaxed">{activeLessonDrawer.suggestedActivity}</p>
              </div>

              <div className="space-y-2 pt-2">
                <label className="block font-semibold text-stone-900">
                  Reflection Prompt: “{activeLessonDrawer.reflectionQuestion}”
                </label>
                <textarea
                  rows={3}
                  value={activeLessonDrawer.userReflection || ''}
                  onChange={(e) => {
                    const updated = { ...activeLessonDrawer, userReflection: e.target.value };
                    setLessons((prev) =>
                      prev.map((item) => (item.id === activeLessonDrawer.id ? updated : item))
                    );
                  }}
                  placeholder="Write your personal or family takeaway here..."
                  className="w-full px-3 py-2 rounded-xl border border-stone-300"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void handleSaveLesson(activeLessonDrawer);
                      setActiveLessonDrawerId(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-[#173D35] text-white font-semibold hover:bg-emerald-950 cursor-pointer"
                  >
                    Save Reflection Note
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isCurriculumModalOpen && (
        <FamilyCurriculumFormModal
          initial={editingCurriculum}
          isSaving={isSaving}
          onSave={(item) => void handleSaveCurriculum(item)}
          onClose={() => {
            setIsCurriculumModalOpen(false);
            setEditingCurriculum(null);
          }}
        />
      )}

      {isResourceModalOpen && (
        <ParentingResourceFormModal
          initial={editingResource}
          isSaving={isSaving}
          onSave={(item) => void handleSaveResource(item)}
          onClose={() => {
            setIsResourceModalOpen(false);
            setEditingResource(null);
          }}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          title={`Remove "${deleteTarget.title}"?`}
          description="This record will be removed from the Parenting & Growth Center and synchronized across your household devices."
          isDeleting={isSaving}
          onConfirm={() => void handleConfirmDelete()}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};
