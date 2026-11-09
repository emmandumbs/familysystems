import React, { useState, useEffect, useCallback } from 'react';
import {
  Heart,
  MessageCircle,
  Sparkles,
  CheckCircle2,
  Plus,
  Lock,
  Globe,
  Users,
  Handshake,
  Compass,
  Search,
  Edit3,
  Trash2,
  Calendar,
  MapPin,
  FileText,
  Image as ImageIcon,
  CheckSquare,
  History,
  Phone,
  Mail,
  BookOpen,
  SlidersHorizontal,
} from 'lucide-react';
import { MainTabType } from './SidebarNavigation';
import { readNamespacedCache, writeNamespacedCache } from '../utils/namespacedStorage';
import {
  CheckInRecord,
  GratitudeNote,
  CouplePlan,
  FamilyMeeting,
  MeetingTemplate,
  SharedExperience,
  AgreementRecord,
  ExternalContact,
  DEFAULT_MEETING_TEMPLATES,
  GUIDED_CHECKIN_PROMPTS,
  CheckInFormModal,
  GratitudeFormModal,
  CoupleConnectionFormModal,
  FamilyMeetingFormModal,
  FamilyMeetingDetailDrawer,
  MeetingTemplatesModal,
  SharedExperienceFormModal,
  SharedAgreementFormModal,
  AgreementHistoryDrawer,
  ExternalContactFormModal,
  ContactTouchpointDrawer,
  DeleteConfirmModal,
} from './relationships/RelationshipsModals';

export interface RelationshipsCenterProps {
  selectedRole: string;
  sessionToken?: string;
  familyId?: string;
  actorUserId?: string;
  actorMemberId?: string;
  actorDisplayName?: string;
  members?: Array<{ id: string; displayName: string; role: string }>;
  onNavigateTab?: (tab: MainTabType) => void;
  activeSubPage?: string;
  onSelectSubPage?: (subId: string) => void;
}

type RelationshipsSubTab =
  | 'checkins'
  | 'gratitude'
  | 'couple'
  | 'communication'
  | 'experiences'
  | 'resolution'
  | 'external_crm';

const SUBPAGE_TO_REL_TAB: Record<string, RelationshipsSubTab> = {
  rel_checkins: 'checkins',
  rel_appreciation: 'gratitude',
  rel_couple: 'couple',
  rel_communication: 'communication',
  rel_experiences: 'experiences',
  rel_reflection: 'resolution',
  rel_external_crm: 'external_crm',
  rel_network: 'external_crm',
};

const REL_TAB_TO_SUBPAGE: Record<RelationshipsSubTab, string> = {
  checkins: 'rel_checkins',
  gratitude: 'rel_appreciation',
  couple: 'rel_couple',
  communication: 'rel_communication',
  experiences: 'rel_experiences',
  resolution: 'rel_reflection',
  external_crm: 'rel_external_crm',
};

const DEMO_FIXTURE_CHECKINS: CheckInRecord[] = [
  {
    id: 'ci-1',
    author: 'Sarah Jenkins',
    type: 'WEEKLY',
    pulseLabel: 'Connected & Grounded',
    promptQuestion: GUIDED_CHECKIN_PROMPTS[0],
    date: 'Nov 2, 2026',
    isPrivate: false,
    weekSummary: 'Balanced a busy school week with peaceful family dinners.',
    wentWell: 'Everyone pitched in with evening kitchen cleanup without reminders.',
    couldImprove: 'Leaving 10 minutes earlier on Tuesday mornings for school drop-off.',
    supportNeeded: 'Help coordinating Friday grocery pickup before soccer practice.',
    gratitude: 'Grateful for David taking over bedtime reading all week.',
    togetherIdea: 'Saturday morning autumn hike at Pine Ridge Trail.',
    followUpAction: 'Prep school backpacks on Sunday night.',
    actionCompleted: false,
  },
  {
    id: 'ci-2',
    author: 'Maya Jenkins',
    type: 'WEEKLY',
    pulseLabel: 'Grateful & Energized',
    promptQuestion: GUIDED_CHECKIN_PROMPTS[1],
    date: 'Nov 1, 2026',
    isPrivate: false,
    weekSummary: 'Finished mid-term photography portfolio and track practice.',
    wentWell: 'Completed my history presentation and helped Lucas with his LEGO project.',
    couldImprove: 'Getting to sleep before 10:30 PM on weeknights.',
    supportNeeded: 'Quiet study hour between 4:30 PM and 5:30 PM.',
    gratitude: 'Thankful for Mom cheering at my track meet.',
    togetherIdea: 'Homemade taco bar and movie night this Friday.',
    followUpAction: 'Set evening phone wind-down reminder at 10:00 PM.',
    actionCompleted: true,
  },
];

const DEMO_FIXTURE_GRATITUDE: GratitudeNote[] = [
  {
    id: 'gn-1',
    from: 'David Jenkins',
    to: 'Sarah Jenkins',
    category: 'Appreciation',
    message: 'Thank you for organizing our November family calendar and meal plan so thoughtfully!',
    date: 'Nov 5, 2026',
    reactions: [{ memberName: 'Sarah Jenkins', type: 'HEART' }],
  },
  {
    id: 'gn-2',
    from: 'Lucas Jenkins',
    to: 'Maya Jenkins',
    category: 'Thank You',
    message: 'Thank you for helping me practice my reading chapters before bed!',
    date: 'Nov 4, 2026',
    reactions: [{ memberName: 'Maya Jenkins', type: 'SPARKLE' }],
  },
  {
    id: 'gn-3',
    from: 'Sarah Jenkins',
    to: 'Lucas Jenkins',
    category: 'Kindness',
    message: 'Loved seeing your kindness and teamwork helping carry groceries in the rain!',
    date: 'Nov 2, 2026',
    reactions: [{ memberName: 'David Jenkins', type: 'THANKFUL' }],
  },
];

const DEMO_FIXTURE_COUPLE_PLANS: CouplePlan[] = [
  {
    id: 'cp-1',
    title: 'Friday Evening Coffee & Patio Walk',
    date: 'Nov 6, 2026 • 7:00 PM',
    category: 'Date Night',
    connectionPulse: 'Aligned & Connected',
    notes: 'Uninterrupted conversation on holiday travel plans and personal recharging.',
    isPrivate: true,
    completed: false,
  },
  {
    id: 'cp-2',
    title: 'Holiday Hosting & Rest Boundaries Alignment',
    date: 'Nov 4, 2026',
    category: 'Alignment Note',
    connectionPulse: 'Deep Appreciation',
    alignmentTopic: 'Household Rhythms',
    sharedDecision: 'Keep Sunday evenings completely free of outside commitments through December.',
    notes: 'Discussed protecting unhurried weekend mornings for immediate family rest.',
    isPrivate: true,
    completed: false,
  },
];

const DEMO_FIXTURE_MEETINGS: FamilyMeeting[] = [
  {
    id: 'fm-1',
    title: 'Sunday Evening Family Huddle',
    date: 'Nov 8, 2026 • 6:00 PM',
    facilitator: 'Sarah Jenkins',
    participants: 'Sarah, David, Maya, Lucas',
    status: 'UPCOMING',
    agendaItems: [
      'Review upcoming school events',
      'Assign Thanksgiving preparation roles',
      'Choose weekend family outing',
    ],
    discussedAgendaIndices: [0],
    decisions: [
      'Thanksgiving dinner will be hosted at home',
      'Friday game night starts at 6:30 PM',
    ],
    followUpTasks: [
      'David to inspect guest room heating',
      'Maya & Lucas to pick board games',
    ],
    completedTaskIndices: [],
    meetingNotes: 'Everyone is excited for autumn family traditions.',
    completed: false,
  },
];

const DEMO_FIXTURE_EXPERIENCES: SharedExperience[] = [
  {
    id: 'se-1',
    title: 'Friday Night Homemade Pizza & Board Games',
    category: 'Game Night',
    date: 'Every Friday • 6:30 PM',
    location: 'Family Kitchen & Dining Room',
    participants: 'Whole Family',
    notes: 'Lucas chooses the first game this week; homemade margherita & veggie pizzas.',
    attachments: [],
    completed: false,
  },
  {
    id: 'se-2',
    title: 'Saturday Morning Pine Lake Trail Walk',
    category: 'Outdoor',
    date: 'Nov 7, 2026 • 9:30 AM',
    location: 'Pine Lake Trailhead',
    participants: 'Sarah, David, Maya, Lucas',
    notes: 'Bring thermoses of hot cocoa and Maya’s camera for autumn foliage photos.',
    attachments: [],
    completed: true,
  },
];

const DEMO_FIXTURE_AGREEMENTS: AgreementRecord[] = [
  {
    id: 'ag-1',
    topic: 'Screen-Free Family Dinner Table',
    category: 'Tech & Presence',
    reflectionPrompt: 'How can we make dinner time feel more connected and unhurried for everyone?',
    sharedAgreement: 'All phones and tablets rest in the charging basket from 6:00 PM to 7:15 PM.',
    commitments: [
      'Silence notifications before coming to the table',
      'Share one daily highlight and one gratitude',
      'Clear the table together as a 10-minute team reset',
    ],
    followUpAction: 'Use conversation starter cards on Wednesday and Sunday evenings.',
    reviewDate: 'Monthly Review • Dec 1, 2026',
    versionNumber: 1,
    versionHistory: [
      {
        version: 1,
        date: '2026-10-15',
        updatedBy: 'Sarah Jenkins',
        summary: 'Initial family charter agreed upon during Sunday huddle.',
      },
    ],
    reflections: [
      {
        id: 'ref-1',
        author: 'David Jenkins',
        date: '2026-11-01',
        note: 'Dinner conversations have been much calmer and more engaged all week.',
      },
    ],
    completed: false,
  },
  {
    id: 'ag-2',
    topic: 'Calm Morning Departure Routine',
    category: 'Shared Responsibilities',
    reflectionPrompt: 'What causes morning stress, and how can we support each other before school?',
    sharedAgreement: 'Outfits and school bags are prepared the night before; we speak with patience.',
    commitments: [
      'Pack backpacks and sign school forms before 8:30 PM',
      'Add a 10-minute buffer before departure time',
    ],
    followUpAction: '10-minute buffer added to the morning kitchen timer.',
    reviewDate: 'Weekly Check • Sundays',
    versionNumber: 1,
    versionHistory: [
      {
        version: 1,
        date: '2026-10-20',
        updatedBy: 'Sarah Jenkins',
        summary: 'Created together to ease Tuesday and Thursday school mornings.',
      },
    ],
    reflections: [],
    completed: false,
  },
];

const DEMO_FIXTURE_NETWORK: ExternalContact[] = [
  {
    id: 'ext-1',
    name: 'Aunt Clara & Uncle Mateo',
    category: 'EXTENDED_FAMILY',
    tags: ['Holiday Hosting', 'Extended Family', 'Support Circle'],
    phone: '+1 (555) 234-8891',
    email: 'clara.mateo@familymail.org',
    location: 'Portland, OR',
    birthday: '1978-05-19',
    importantEvent: 'Thanksgiving Family Gathering',
    checkInCadence: 'MONTHLY',
    lastCheckedIn: '2026-10-26',
    nextFollowUpDate: '2026-11-18',
    notes: 'Coordinate Thanksgiving potluck dishes and guest room dates.',
    interactionHistory: [
      {
        id: 'ih-1',
        date: '2026-10-26',
        method: 'Call',
        summary: 'Confirmed November travel dates and shared autumn school photos.',
      },
    ],
  },
  {
    id: 'ext-2',
    name: 'Arthur & Helen Pendelton',
    category: 'NEIGHBOR',
    tags: ['Trusted Neighbor', 'Emergency Keyholder', 'Garden Share'],
    phone: '+1 (555) 345-6789',
    email: 'arthur.p@suburbanmail.net',
    location: 'Next Door (404 Oak Lane)',
    birthday: '1962-11-14',
    importantEvent: 'Neighborhood Holiday Potluck',
    checkInCadence: 'MONTHLY',
    lastCheckedIn: '2026-10-29',
    nextFollowUpDate: '2026-11-14',
    notes: 'Has spare house key; loves fresh sourdough and garden tomatoes.',
    interactionHistory: [
      {
        id: 'ih-2',
        date: '2026-10-29',
        method: 'Coffee / Meetup',
        summary: 'Shared cinnamon rolls and coordinated winter snow-shoveling help.',
      },
    ],
  },
];

const IS_DEV_FIXTURE_MODE =
  typeof import.meta !== 'undefined' && Boolean((import.meta as any).env?.DEV);

export const RelationshipsCenter: React.FC<RelationshipsCenterProps> = ({
  selectedRole,
  sessionToken = '',
  familyId = '',
  actorUserId = '',
  actorMemberId = '',
  actorDisplayName = '',
  members = [],
  activeSubPage,
  onSelectSubPage,
}) => {
  const isCoupleAuthorized = selectedRole === 'OWNER' || selectedRole === 'ADMIN';
  const canMutate = selectedRole !== 'GUEST';

  const [activeSubTab, setActiveSubTab] = useState<RelationshipsSubTab>(() => {
    const mapped = activeSubPage ? SUBPAGE_TO_REL_TAB[activeSubPage] : undefined;
    if (mapped === 'couple' && !isCoupleAuthorized) return 'checkins';
    return mapped || 'checkins';
  });

  useEffect(() => {
    if (activeSubPage && SUBPAGE_TO_REL_TAB[activeSubPage]) {
      const target = SUBPAGE_TO_REL_TAB[activeSubPage];
      if (target === 'couple' && !isCoupleAuthorized) {
        setActiveSubTab('checkins');
      } else {
        setActiveSubTab(target);
      }
    }
  }, [activeSubPage, isCoupleAuthorized]);

  const handleSelectRelTab = (tab: RelationshipsSubTab) => {
    if (tab === 'couple' && !isCoupleAuthorized) return;
    setActiveSubTab(tab);
    setValidationError(null);
    if (onSelectSubPage) {
      onSelectSubPage(REL_TAB_TO_SUBPAGE[tab]);
    }
  };

  const [resolvedFamilyId, setResolvedFamilyId] = useState<string>(familyId);
  const [resolvedUserId, setResolvedUserId] = useState<string>(actorUserId);
  const [resolvedMemberId, setResolvedMemberId] = useState<string>(actorMemberId);
  const [resolvedAuthorName, setResolvedAuthorName] = useState<string>(actorDisplayName);

  useEffect(() => {
    if (familyId) setResolvedFamilyId(familyId);
    if (actorUserId) setResolvedUserId(actorUserId);
    if (actorMemberId) setResolvedMemberId(actorMemberId);
    if (actorDisplayName) setResolvedAuthorName(actorDisplayName);
  }, [familyId, actorUserId, actorMemberId, actorDisplayName]);

  // Global search & per-tab filters
  const [searchQuery, setSearchQuery] = useState('');
  const [checkInAuthorFilter, setCheckInAuthorFilter] = useState('ALL');
  const [checkInCadenceFilter, setCheckInCadenceFilter] = useState('ALL');
  const [gratitudeRecipientFilter, setGratitudeRecipientFilter] = useState('ALL');
  const [gratitudeCategoryFilter, setGratitudeCategoryFilter] = useState('ALL');
  const [coupleCategoryFilter, setCoupleCategoryFilter] = useState('ALL');
  const [meetingStatusFilter, setMeetingStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED'>('ALL');
  const [experienceCategoryFilter, setExperienceCategoryFilter] = useState('ALL');
  const [experienceStatusFilter, setExperienceStatusFilter] = useState<'ALL' | 'UPCOMING' | 'MEMORY'>('ALL');
  const [agreementCategoryFilter, setAgreementCategoryFilter] = useState('ALL');
  const [networkCategoryFilter, setNetworkCategoryFilter] = useState('ALL');

  // UI Feedback & Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [conflictBanner, setConflictBanner] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Domain Collections State
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>(
    IS_DEV_FIXTURE_MODE ? DEMO_FIXTURE_CHECKINS : []
  );
  const [gratitudeNotes, setGratitudeNotes] = useState<GratitudeNote[]>(
    IS_DEV_FIXTURE_MODE ? DEMO_FIXTURE_GRATITUDE : []
  );
  const [couplePlans, setCouplePlans] = useState<CouplePlan[]>(
    IS_DEV_FIXTURE_MODE && isCoupleAuthorized ? DEMO_FIXTURE_COUPLE_PLANS : []
  );
  const [meetings, setMeetings] = useState<FamilyMeeting[]>(
    IS_DEV_FIXTURE_MODE ? DEMO_FIXTURE_MEETINGS : []
  );
  const [customTemplates, setCustomTemplates] = useState<MeetingTemplate[]>([]);
  const [experiences, setExperiences] = useState<SharedExperience[]>(
    IS_DEV_FIXTURE_MODE ? DEMO_FIXTURE_EXPERIENCES : []
  );
  const [agreements, setAgreements] = useState<AgreementRecord[]>(
    IS_DEV_FIXTURE_MODE ? DEMO_FIXTURE_AGREEMENTS : []
  );
  const [networkContacts, setNetworkContacts] = useState<ExternalContact[]>(
    IS_DEV_FIXTURE_MODE ? DEMO_FIXTURE_NETWORK : []
  );

  // Modals & Drawers State
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [editingCheckIn, setEditingCheckIn] = useState<CheckInRecord | null>(null);

  const [isGratitudeModalOpen, setIsGratitudeModalOpen] = useState(false);
  const [editingGratitude, setEditingGratitude] = useState<GratitudeNote | null>(null);

  const [isCoupleModalOpen, setIsCoupleModalOpen] = useState(false);
  const [editingCouplePlan, setEditingCouplePlan] = useState<CouplePlan | null>(null);

  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<FamilyMeeting | null>(null);
  const [activeMeetingDrawerId, setActiveMeetingDrawerId] = useState<string | null>(null);
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);

  const [isExperienceModalOpen, setIsExperienceModalOpen] = useState(false);
  const [editingExperience, setEditingExperience] = useState<SharedExperience | null>(null);

  const [isAgreementModalOpen, setIsAgreementModalOpen] = useState(false);
  const [editingAgreement, setEditingAgreement] = useState<AgreementRecord | null>(null);
  const [activeAgreementDrawerId, setActiveAgreementDrawerId] = useState<string | null>(null);

  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ExternalContact | null>(null);
  const [activeContactDrawerId, setActiveContactDrawerId] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{
    collection: string;
    id: string;
    title: string;
  } | null>(null);

  const matchedMember = members.find((m) => m.id === resolvedMemberId || m.role === selectedRole);
  const currentUserName =
    resolvedAuthorName || matchedMember?.displayName || `Member (${selectedRole})`;

  const recipientOptions = Array.from(
    new Set([
      ...members.map((m) => m.displayName).filter(Boolean),
      'Sarah Jenkins',
      'David Jenkins',
      'Maya Jenkins',
      'Lucas Jenkins',
      'Whole Family',
    ])
  );

  const allMeetingTemplates: MeetingTemplate[] = [
    ...DEFAULT_MEETING_TEMPLATES,
    ...customTemplates,
  ];

  const showToast = (msg: string) => {
    setStatusNotice(msg);
    setValidationError(null);
    setTimeout(() => setStatusNotice(null), 3500);
  };

  const notifyRelationshipsUpdated = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('familyos-relationships-updated'));
    }
  };

  // Hydrate all 7 sub-modules from authoritative backend
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
          setResolvedAuthorName(
            restoreData.activeMembership?.displayName ||
              restoreData.actor?.displayName ||
              'Family Member'
          );
        }
      }
      if (!activeFamId) return;

      if (activeUsrId) {
        const cachedCheckins = readNamespacedCache<CheckInRecord[] | null>(
          { userAccountId: activeUsrId, familyId: activeFamId, moduleName: 'relationships', key: 'checkins' },
          null
        );
        if (cachedCheckins && cachedCheckins.length > 0) setCheckIns(cachedCheckins);
      }

      const res = await fetch(`/api/v1/domain/${encodeURIComponent(activeFamId)}/relationships`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!res.ok) return;
      const payload = await res.json();
      const cols = payload.collections || {};

      if (Array.isArray(cols.checkins) && cols.checkins.length > 0) setCheckIns(cols.checkins);
      if (Array.isArray(cols.gratitude) && cols.gratitude.length > 0) setGratitudeNotes(cols.gratitude);
      if (!isCoupleAuthorized) {
        setCouplePlans([]);
      } else if (Array.isArray(cols.couple_plans) && cols.couple_plans.length > 0) {
        setCouplePlans(cols.couple_plans);
      }
      if (Array.isArray(cols.meetings) && cols.meetings.length > 0) setMeetings(cols.meetings);
      if (Array.isArray(cols.meeting_templates)) setCustomTemplates(cols.meeting_templates);
      if (Array.isArray(cols.experiences) && cols.experiences.length > 0) setExperiences(cols.experiences);
      if (Array.isArray(cols.agreements) && cols.agreements.length > 0) setAgreements(cols.agreements);
      if (Array.isArray(cols.network_contacts) && cols.network_contacts.length > 0) {
        setNetworkContacts(cols.network_contacts);
      }
    } catch {
      // Offline fallback uses namespaced cache
    } finally {
      setIsLoading(false);
    }
  }, [sessionToken, familyId, resolvedFamilyId, actorUserId, resolvedUserId, isCoupleAuthorized]);

  useEffect(() => {
    void hydrateFromBackend();
  }, [hydrateFromBackend]);

  useEffect(() => {
    const onExternalUpdate = () => {
      void hydrateFromBackend();
    };
    window.addEventListener('familyos-relationships-updated', onExternalUpdate);
    return () => window.removeEventListener('familyos-relationships-updated', onExternalUpdate);
  }, [hydrateFromBackend]);

  // Write to user + family namespaced cache
  useEffect(() => {
    if (!resolvedUserId || !resolvedFamilyId) return;
    writeNamespacedCache(
      { userAccountId: resolvedUserId, familyId: resolvedFamilyId, moduleName: 'relationships', key: 'checkins' },
      checkIns
    );
    writeNamespacedCache(
      { userAccountId: resolvedUserId, familyId: resolvedFamilyId, moduleName: 'relationships', key: 'gratitude' },
      gratitudeNotes
    );
    writeNamespacedCache(
      { userAccountId: resolvedUserId, familyId: resolvedFamilyId, moduleName: 'relationships', key: 'couple_plans' },
      couplePlans
    );
    writeNamespacedCache(
      { userAccountId: resolvedUserId, familyId: resolvedFamilyId, moduleName: 'relationships', key: 'meetings' },
      meetings
    );
    writeNamespacedCache(
      { userAccountId: resolvedUserId, familyId: resolvedFamilyId, moduleName: 'relationships', key: 'experiences' },
      experiences
    );
    writeNamespacedCache(
      { userAccountId: resolvedUserId, familyId: resolvedFamilyId, moduleName: 'relationships', key: 'agreements' },
      agreements
    );
    writeNamespacedCache(
      { userAccountId: resolvedUserId, familyId: resolvedFamilyId, moduleName: 'relationships', key: 'network_contacts' },
      networkContacts
    );
  }, [
    checkIns,
    gratitudeNotes,
    couplePlans,
    meetings,
    experiences,
    agreements,
    networkContacts,
    resolvedUserId,
    resolvedFamilyId,
  ]);

  const persistSingleRecord = async (
    collection: string,
    recordId: string,
    data: Record<string, any>,
    baseVersion?: number
  ) => {
    if (!sessionToken || !resolvedFamilyId) return;
    setIsSaving(true);
    try {
      const res = await fetch(
        `/api/v1/domain/${encodeURIComponent(resolvedFamilyId)}/relationships/${encodeURIComponent(collection)}/${encodeURIComponent(recordId)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({ data, baseVersion }),
        }
      );
      if (res.status === 409) {
        const err = await res.json().catch(() => ({}));
        setConflictBanner(
          err.message || 'Concurrent modification conflict detected on server. Reloading latest record.'
        );
        void hydrateFromBackend();
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setValidationError(err.message || err.error || 'Could not synchronize record with server.');
        return;
      }
      notifyRelationshipsUpdated();
    } catch {
      // Offline cache preserved
    } finally {
      setIsSaving(false);
    }
  };

  const deleteSingleRecord = async (collection: string, recordId: string) => {
    if (!sessionToken || !resolvedFamilyId) return;
    try {
      const res = await fetch(
        `/api/v1/domain/${encodeURIComponent(resolvedFamilyId)}/relationships/${encodeURIComponent(collection)}/${encodeURIComponent(recordId)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${sessionToken}` },
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setValidationError(err.message || 'Could not delete record.');
        return;
      }
      notifyRelationshipsUpdated();
    } catch {
      // Offline fallback
    }
  };

  // ============================================================================
  // CRUD HANDLERS ACROSS ALL 7 SUB-MODULES
  // ============================================================================

  // 1. Relationship Check-ins
  const handleSaveCheckIn = async (payload: Omit<CheckInRecord, 'id' | 'author' | 'date'>) => {
    if (editingCheckIn) {
      const updated: CheckInRecord = {
        ...editingCheckIn,
        ...payload,
        ownerUserId: editingCheckIn.ownerUserId || resolvedUserId,
        ownerMemberId: editingCheckIn.ownerMemberId || resolvedMemberId,
      };
      setCheckIns((prev) => prev.map((c) => (c.id === editingCheckIn.id ? updated : c)));
      await persistSingleRecord('checkins', editingCheckIn.id, updated, editingCheckIn.version);
      showToast('Relationship check-in updated.');
    } else {
      const newRecord: CheckInRecord = {
        id: `ci-${Date.now()}`,
        author: currentUserName,
        date: new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        ownerUserId: resolvedUserId,
        ownerMemberId: resolvedMemberId,
        ...payload,
      };
      setCheckIns((prev) => [newRecord, ...prev]);
      await persistSingleRecord('checkins', newRecord.id, newRecord);
      showToast(
        newRecord.isPrivate
          ? 'Private check-in saved (visible only to you).'
          : 'Check-in shared with the household.'
      );
    }
    setIsCheckInModalOpen(false);
    setEditingCheckIn(null);
  };

  // 2. Gratitude & Appreciation Wall
  const handleSaveGratitude = async (payload: {
    to: string;
    category: GratitudeNote['category'];
    message: string;
    attachments: NonNullable<GratitudeNote['attachments']>;
  }) => {
    if (editingGratitude) {
      const updated: GratitudeNote = {
        ...editingGratitude,
        to: payload.to,
        category: payload.category,
        message: payload.message,
        attachments: payload.attachments,
      };
      setGratitudeNotes((prev) => prev.map((n) => (n.id === editingGratitude.id ? updated : n)));
      await persistSingleRecord('gratitude', editingGratitude.id, updated, editingGratitude.version);
      showToast('Appreciation note updated.');
    } else {
      const newNote: GratitudeNote = {
        id: `gn-${Date.now()}`,
        from: currentUserName,
        to: payload.to,
        category: payload.category,
        message: payload.message,
        date: new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        attachments: payload.attachments,
        reactions: [],
      };
      setGratitudeNotes((prev) => [newNote, ...prev]);
      await persistSingleRecord('gratitude', newNote.id, newNote);
      showToast(`Appreciation note posted for ${payload.to}.`);
    }
    setIsGratitudeModalOpen(false);
    setEditingGratitude(null);
  };

  const handleToggleGratitudeReaction = async (
    note: GratitudeNote,
    reactionType: 'HEART' | 'THANKFUL' | 'SPARKLE'
  ) => {
    if (!canMutate) return;
    const currentReactions = note.reactions || [];
    const existingIdx = currentReactions.findIndex(
      (r) => r.memberName === currentUserName && r.type === reactionType
    );
    const nextReactions =
      existingIdx >= 0
        ? currentReactions.filter((_, idx) => idx !== existingIdx)
        : [...currentReactions, { memberName: currentUserName, type: reactionType }];
    const updated: GratitudeNote = { ...note, reactions: nextReactions };
    setGratitudeNotes((prev) => prev.map((n) => (n.id === note.id ? updated : n)));
    await persistSingleRecord('gratitude', note.id, updated, note.version);
  };

  // 3. Couple Connection
  const handleSaveCouplePlan = async (payload: Omit<CouplePlan, 'id'>) => {
    if (!isCoupleAuthorized) return;
    if (editingCouplePlan) {
      const updated: CouplePlan = {
        ...editingCouplePlan,
        ...payload,
      };
      setCouplePlans((prev) => prev.map((p) => (p.id === editingCouplePlan.id ? updated : p)));
      await persistSingleRecord('couple_plans', editingCouplePlan.id, updated, editingCouplePlan.version);
      showToast('Partner entry updated.');
    } else {
      const newPlan: CouplePlan = {
        id: `cp-${Date.now()}`,
        ...payload,
      };
      setCouplePlans((prev) => [newPlan, ...prev]);
      await persistSingleRecord('couple_plans', newPlan.id, newPlan);
      showToast('Saved to Couple Connection space.');
    }
    setIsCoupleModalOpen(false);
    setEditingCouplePlan(null);
  };

  // 4. Family Meetings & Discussions
  const handleSaveMeeting = async (payload: Omit<FamilyMeeting, 'id'>) => {
    if (editingMeeting) {
      const updated: FamilyMeeting = {
        ...editingMeeting,
        ...payload,
      };
      setMeetings((prev) => prev.map((m) => (m.id === editingMeeting.id ? updated : m)));
      await persistSingleRecord('meetings', editingMeeting.id, updated, editingMeeting.version);
      showToast('Family meeting updated.');
    } else {
      const newMtg: FamilyMeeting = {
        id: `fm-${Date.now()}`,
        ...payload,
      };
      setMeetings((prev) => [newMtg, ...prev]);
      await persistSingleRecord('meetings', newMtg.id, newMtg);
      showToast('Family meeting scheduled.');
    }
    setIsMeetingModalOpen(false);
    setEditingMeeting(null);
  };

  const handleUpdateMeetingFromDrawer = async (updated: FamilyMeeting) => {
    setMeetings((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    await persistSingleRecord('meetings', updated.id, updated, updated.version);
  };

  const handleCreateMeetingTemplate = async (payload: Omit<MeetingTemplate, 'id'>) => {
    const newTpl: MeetingTemplate = {
      id: `custom-tpl-${Date.now()}`,
      ...payload,
    };
    setCustomTemplates((prev) => [newTpl, ...prev]);
    await persistSingleRecord('meeting_templates', newTpl.id, newTpl);
    showToast('Reusable meeting checklist template saved.');
  };

  const handleDeleteMeetingTemplate = async (id: string) => {
    setCustomTemplates((prev) => prev.filter((t) => t.id !== id));
    await deleteSingleRecord('meeting_templates', id);
    showToast('Custom meeting template removed.');
  };

  // 5. Shared Experiences
  const handleSaveExperience = async (payload: Omit<SharedExperience, 'id'>) => {
    if (editingExperience) {
      const updated: SharedExperience = {
        ...editingExperience,
        ...payload,
      };
      setExperiences((prev) => prev.map((ex) => (ex.id === editingExperience.id ? updated : ex)));
      await persistSingleRecord('experiences', editingExperience.id, updated, editingExperience.version);
      showToast('Shared experience updated.');
    } else {
      const newExp: SharedExperience = {
        id: `se-${Date.now()}`,
        ...payload,
      };
      setExperiences((prev) => [newExp, ...prev]);
      await persistSingleRecord('experiences', newExp.id, newExp);
      showToast('Shared family experience saved.');
    }
    setIsExperienceModalOpen(false);
    setEditingExperience(null);
  };

  // 6. Shared Agreements & Reflection
  const handleSaveAgreement = async (payload: Omit<AgreementRecord, 'id'>) => {
    if (editingAgreement) {
      const updated: AgreementRecord = {
        ...editingAgreement,
        ...payload,
      };
      setAgreements((prev) => prev.map((ag) => (ag.id === editingAgreement.id ? updated : ag)));
      await persistSingleRecord('agreements', editingAgreement.id, updated, editingAgreement.version);
      showToast(`Shared agreement updated to v${updated.versionNumber || 1}.`);
    } else {
      const newAgr: AgreementRecord = {
        id: `ag-${Date.now()}`,
        ...payload,
      };
      setAgreements((prev) => [newAgr, ...prev]);
      await persistSingleRecord('agreements', newAgr.id, newAgr);
      showToast('Living family agreement created.');
    }
    setIsAgreementModalOpen(false);
    setEditingAgreement(null);
  };

  const handleAddAgreementReflection = async (
    agreement: AgreementRecord,
    reflectionNote: string
  ) => {
    const newRef = {
      id: `ref-${Date.now()}`,
      author: currentUserName,
      date: new Date().toISOString().slice(0, 10),
      note: reflectionNote,
    };
    const updated: AgreementRecord = {
      ...agreement,
      reflections: [newRef, ...(agreement.reflections || [])],
    };
    setAgreements((prev) => prev.map((ag) => (ag.id === agreement.id ? updated : ag)));
    await persistSingleRecord('agreements', agreement.id, updated, agreement.version);
    showToast('Reflection logged on family charter.');
  };

  // 7. External Network & CRM
  const handleSaveNetworkContact = async (payload: Omit<ExternalContact, 'id'>) => {
    if (editingContact) {
      const updated: ExternalContact = {
        ...editingContact,
        ...payload,
      };
      setNetworkContacts((prev) => prev.map((c) => (c.id === editingContact.id ? updated : c)));
      await persistSingleRecord('network_contacts', editingContact.id, updated, editingContact.version);
      showToast('Network contact updated.');
    } else {
      const newContact: ExternalContact = {
        id: `net-${Date.now()}`,
        ...payload,
      };
      setNetworkContacts((prev) => [newContact, ...prev]);
      await persistSingleRecord('network_contacts', newContact.id, newContact);
      showToast('Contact added to External Network & CRM.');
    }
    setIsContactModalOpen(false);
    setEditingContact(null);
  };

  const handleLogContactTouchpoint = async (
    contact: ExternalContact,
    entry: {
      method: 'Call' | 'Message' | 'Email' | 'Coffee / Meetup' | 'Visit' | 'Other';
      date: string;
      summary: string;
      nextFollowUpDate?: string;
    }
  ) => {
    const newEntry = {
      id: `ih-${Date.now()}`,
      date: entry.date,
      method: entry.method,
      summary: entry.summary,
    };
    const updated: ExternalContact = {
      ...contact,
      lastCheckedIn: entry.date,
      nextFollowUpDate: entry.nextFollowUpDate || contact.nextFollowUpDate,
      interactionHistory: [newEntry, ...(contact.interactionHistory || [])],
    };
    setNetworkContacts((prev) => prev.map((c) => (c.id === contact.id ? updated : c)));
    await persistSingleRecord('network_contacts', contact.id, updated, contact.version);
    showToast(`Recorded ${entry.method.toLowerCase()} with ${contact.name}.`);
  };

  // Unified Delete Handler
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const { collection, id, title } = deleteTarget;
    if (collection === 'checkins') {
      setCheckIns((prev) => prev.filter((item) => item.id !== id));
    } else if (collection === 'gratitude') {
      setGratitudeNotes((prev) => prev.filter((item) => item.id !== id));
    } else if (collection === 'couple_plans') {
      setCouplePlans((prev) => prev.filter((item) => item.id !== id));
    } else if (collection === 'meetings') {
      setMeetings((prev) => prev.filter((item) => item.id !== id));
      if (activeMeetingDrawerId === id) setActiveMeetingDrawerId(null);
    } else if (collection === 'experiences') {
      setExperiences((prev) => prev.filter((item) => item.id !== id));
    } else if (collection === 'agreements') {
      setAgreements((prev) => prev.filter((item) => item.id !== id));
      if (activeAgreementDrawerId === id) setActiveAgreementDrawerId(null);
    } else if (collection === 'network_contacts') {
      setNetworkContacts((prev) => prev.filter((item) => item.id !== id));
      if (activeContactDrawerId === id) setActiveContactDrawerId(null);
    }
    setDeleteTarget(null);
    await deleteSingleRecord(collection, id);
    showToast(`Removed “${title}”.`);
  };

  // ============================================================================
  // FILTERED VIEWS & PRIVACY ENFORCEMENT
  // ============================================================================
  const q = searchQuery.trim().toLowerCase();

  const authorizedCheckIns = checkIns.filter((ci) => {
    if (
      ci.isPrivate &&
      ci.author !== currentUserName &&
      (!ci.ownerUserId || ci.ownerUserId !== resolvedUserId)
    ) {
      return false;
    }
    if (checkInAuthorFilter !== 'ALL' && ci.author !== checkInAuthorFilter) return false;
    if (checkInCadenceFilter !== 'ALL' && ci.type !== checkInCadenceFilter) return false;
    if (!q) return true;
    return (
      (ci.weekSummary || '').toLowerCase().includes(q) ||
      (ci.wentWell || '').toLowerCase().includes(q) ||
      (ci.gratitude || '').toLowerCase().includes(q) ||
      (ci.author || '').toLowerCase().includes(q)
    );
  });

  const filteredGratitude = gratitudeNotes.filter((gn) => {
    if (gratitudeRecipientFilter !== 'ALL' && gn.to !== gratitudeRecipientFilter) return false;
    if (gratitudeCategoryFilter !== 'ALL' && gn.category !== gratitudeCategoryFilter) return false;
    if (!q) return true;
    return (
      (gn.message || '').toLowerCase().includes(q) ||
      (gn.to || '').toLowerCase().includes(q) ||
      (gn.from || '').toLowerCase().includes(q)
    );
  });

  const filteredCouplePlans = couplePlans.filter((cp) => {
    if (coupleCategoryFilter !== 'ALL' && cp.category !== coupleCategoryFilter) return false;
    if (!q) return true;
    return (
      (cp.title || '').toLowerCase().includes(q) ||
      (cp.notes || '').toLowerCase().includes(q) ||
      (cp.sharedDecision || '').toLowerCase().includes(q)
    );
  });

  const filteredMeetings = meetings.filter((m) => {
    const isArchived = Boolean(m.completed) || m.status === 'ARCHIVED';
    if (meetingStatusFilter === 'ACTIVE' && isArchived) return false;
    if (meetingStatusFilter === 'ARCHIVED' && !isArchived) return false;
    if (!q) return true;
    return (
      (m.title || '').toLowerCase().includes(q) ||
      (m.participants || '').toLowerCase().includes(q) ||
      (m.agendaItems || []).some((a) => a.toLowerCase().includes(q))
    );
  });

  const filteredExperiences = experiences.filter((ex) => {
    if (experienceCategoryFilter !== 'ALL' && ex.category !== experienceCategoryFilter) return false;
    if (experienceStatusFilter === 'UPCOMING' && ex.completed) return false;
    if (experienceStatusFilter === 'MEMORY' && !ex.completed) return false;
    if (!q) return true;
    return (
      (ex.title || '').toLowerCase().includes(q) ||
      (ex.notes || '').toLowerCase().includes(q) ||
      (ex.location || '').toLowerCase().includes(q)
    );
  });

  const filteredAgreements = agreements.filter((ag) => {
    if (agreementCategoryFilter !== 'ALL' && (ag.category || 'Tech & Presence') !== agreementCategoryFilter) {
      return false;
    }
    if (!q) return true;
    return (
      (ag.topic || '').toLowerCase().includes(q) ||
      (ag.sharedAgreement || '').toLowerCase().includes(q) ||
      (ag.followUpAction || '').toLowerCase().includes(q)
    );
  });

  const filteredContacts = networkContacts.filter((c) => {
    if (networkCategoryFilter !== 'ALL' && c.category !== networkCategoryFilter) return false;
    if (!q) return true;
    return (
      (c.name || '').toLowerCase().includes(q) ||
      (c.notes || '').toLowerCase().includes(q) ||
      (c.location || '').toLowerCase().includes(q) ||
      (c.tags || []).some((t) => t.toLowerCase().includes(q))
    );
  });

  const activeMeetingDrawer = meetings.find((m) => m.id === activeMeetingDrawerId) || null;
  const activeAgreementDrawer = agreements.find((ag) => ag.id === activeAgreementDrawerId) || null;
  const activeContactDrawer = networkContacts.find((c) => c.id === activeContactDrawerId) || null;

  return (
    <div className="space-y-6 pb-10">
      {/* Warm, Minimalist Header & Sub-Navigation */}
      <div className="rounded-3xl p-6 sm:p-8 bg-[#173D35] text-white shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="max-w-2xl space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#E5C388] tracking-wide uppercase">
              <Heart className="w-3.5 h-3.5" />
              <span>The Family Connection Center</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-white">
              Communication, Gratitude & Household Alignment
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100/85 leading-relaxed">
              A calm space for reflective check-ins, shared appreciation, partner alignment, family meetings, memories, living agreements, and your extended support circle.
            </p>
          </div>

          {/* Contextual Primary Action Button for Current Sub-Module */}
          {canMutate && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {activeSubTab === 'checkins' && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingCheckIn(null);
                    setIsCheckInModalOpen(true);
                  }}
                  className="px-4 py-2.5 rounded-2xl bg-[#C39A60] hover:bg-[#d3aa70] text-[#173D35] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Check-in</span>
                </button>
              )}
              {activeSubTab === 'gratitude' && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingGratitude(null);
                    setIsGratitudeModalOpen(true);
                  }}
                  className="px-4 py-2.5 rounded-2xl bg-[#C39A60] hover:bg-[#d3aa70] text-[#173D35] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Post Appreciation Note</span>
                </button>
              )}
              {activeSubTab === 'couple' && isCoupleAuthorized && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingCouplePlan(null);
                    setIsCoupleModalOpen(true);
                  }}
                  className="px-4 py-2.5 rounded-2xl bg-[#C39A60] hover:bg-[#d3aa70] text-[#173D35] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Partner Entry</span>
                </button>
              )}
              {activeSubTab === 'communication' && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsTemplatesModalOpen(true)}
                    className="px-3.5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Agenda Templates</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMeeting(null);
                      setIsMeetingModalOpen(true);
                    }}
                    className="px-4 py-2.5 rounded-2xl bg-[#C39A60] hover:bg-[#d3aa70] text-[#173D35] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Schedule Meeting</span>
                  </button>
                </>
              )}
              {activeSubTab === 'experiences' && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingExperience(null);
                    setIsExperienceModalOpen(true);
                  }}
                  className="px-4 py-2.5 rounded-2xl bg-[#C39A60] hover:bg-[#d3aa70] text-[#173D35] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Shared Experience</span>
                </button>
              )}
              {activeSubTab === 'resolution' && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingAgreement(null);
                    setIsAgreementModalOpen(true);
                  }}
                  className="px-4 py-2.5 rounded-2xl bg-[#C39A60] hover:bg-[#d3aa70] text-[#173D35] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Shared Agreement</span>
                </button>
              )}
              {activeSubTab === 'external_crm' && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingContact(null);
                    setIsContactModalOpen(true);
                  }}
                  className="px-4 py-2.5 rounded-2xl bg-[#C39A60] hover:bg-[#d3aa70] text-[#173D35] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Network Contact</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* 7 Sub-Modules Navigation Bar */}
        <div className="flex flex-wrap gap-2 mt-6 pt-5 border-t border-white/15">
          {[
            { id: 'checkins', label: 'Relationship Check-ins', icon: MessageCircle, visible: true },
            { id: 'gratitude', label: 'Gratitude & Appreciation', icon: Sparkles, visible: true },
            { id: 'couple', label: 'Couple Connection', icon: Heart, visible: isCoupleAuthorized },
            { id: 'communication', label: 'Family Meetings', icon: Users, visible: true },
            { id: 'experiences', label: 'Shared Experiences', icon: Compass, visible: true },
            { id: 'resolution', label: 'Agreements & Reflection', icon: Handshake, visible: true },
            { id: 'external_crm', label: 'External Network & CRM', icon: Users, visible: true },
          ]
            .filter((t) => t.visible)
            .map((tab) => {
              const Icon = tab.icon;
              const active = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleSelectRelTab(tab.id as RelationshipsSubTab)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#C39A60] text-[#173D35]'
                      : 'bg-white/10 text-emerald-100 hover:bg-white/15'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
        </div>
      </div>

      {/* Notifications & Conflict Banners */}
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

      {/* Unified Search & Contextual Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by keyword, person, topic, or tag..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-stone-200 text-xs"
          />
        </div>

        {/* Sub-module specific filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <SlidersHorizontal className="w-3.5 h-3.5 text-stone-400" />
          {activeSubTab === 'checkins' && (
            <>
              <select
                value={checkInAuthorFilter}
                onChange={(e) => setCheckInAuthorFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-700 font-medium"
              >
                <option value="ALL">All Family Members</option>
                {Array.from(new Set(checkIns.map((c) => c.author))).map((author) => (
                  <option key={author} value={author}>
                    {author}
                  </option>
                ))}
              </select>
              <select
                value={checkInCadenceFilter}
                onChange={(e) => setCheckInCadenceFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-700 font-medium"
              >
                <option value="ALL">All Cadences</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="MOMENT">Moment-in-Time</option>
              </select>
            </>
          )}

          {activeSubTab === 'gratitude' && (
            <>
              <select
                value={gratitudeRecipientFilter}
                onChange={(e) => setGratitudeRecipientFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-700 font-medium"
              >
                <option value="ALL">All Recipients</option>
                {recipientOptions.map((r) => (
                  <option key={r} value={r}>
                    To: {r}
                  </option>
                ))}
              </select>
              <select
                value={gratitudeCategoryFilter}
                onChange={(e) => setGratitudeCategoryFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-700 font-medium"
              >
                <option value="ALL">All Recognition Types</option>
                <option value="Appreciation">Appreciation</option>
                <option value="Thank You">Thank You</option>
                <option value="Encouragement">Encouragement</option>
                <option value="Kindness">Kindness</option>
                <option value="Milestone">Milestone</option>
              </select>
            </>
          )}

          {activeSubTab === 'couple' && (
            <select
              value={coupleCategoryFilter}
              onChange={(e) => setCoupleCategoryFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-700 font-medium"
            >
              <option value="ALL">All Partner Entries</option>
              <option value="Date Night">Shared Date Ideas</option>
              <option value="Partner Check-in">Partner Check-ins</option>
              <option value="Alignment Note">Alignment Notes</option>
              <option value="Milestone">Milestones</option>
            </select>
          )}

          {activeSubTab === 'communication' && (
            <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl">
              {(['ALL', 'ACTIVE', 'ARCHIVED'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setMeetingStatusFilter(status)}
                  className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                    meetingStatusFilter === status
                      ? 'bg-white text-stone-900 shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {status === 'ALL' ? 'All Meetings' : status === 'ACTIVE' ? 'Upcoming' : 'Archived'}
                </button>
              ))}
            </div>
          )}

          {activeSubTab === 'experiences' && (
            <>
              <select
                value={experienceCategoryFilter}
                onChange={(e) => setExperienceCategoryFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-700 font-medium"
              >
                <option value="ALL">All Categories</option>
                <option value="Game Night">Game Night</option>
                <option value="Outdoor">Outdoor</option>
                <option value="Family Dinner">Family Dinner</option>
                <option value="Movie Night">Movie Night</option>
                <option value="Weekend Adventure">Weekend Adventure</option>
                <option value="Tradition">Tradition</option>
              </select>
              <select
                value={experienceStatusFilter}
                onChange={(e) => setExperienceStatusFilter(e.target.value as any)}
                className="px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-700 font-medium"
              >
                <option value="ALL">Upcoming & Memories</option>
                <option value="UPCOMING">Upcoming Plans</option>
                <option value="MEMORY">Completed Memories</option>
              </select>
            </>
          )}

          {activeSubTab === 'resolution' && (
            <select
              value={agreementCategoryFilter}
              onChange={(e) => setAgreementCategoryFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-700 font-medium"
            >
              <option value="ALL">All Charter Domains</option>
              <option value="Tech & Presence">Tech & Presence</option>
              <option value="Communication">Communication</option>
              <option value="Conflict Repair">Conflict Repair</option>
              <option value="Shared Responsibilities">Shared Responsibilities</option>
              <option value="Hospitality">Hospitality</option>
            </select>
          )}

          {activeSubTab === 'external_crm' && (
            <select
              value={networkCategoryFilter}
              onChange={(e) => setNetworkCategoryFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-700 font-medium"
            >
              <option value="ALL">All Circles</option>
              <option value="EXTENDED_FAMILY">Extended Family</option>
              <option value="FRIEND">Close Friends</option>
              <option value="NEIGHBOR">Neighbors</option>
              <option value="MENTOR">Mentors</option>
              <option value="COMMUNITY">Community & School</option>
            </select>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 text-xs text-stone-500 text-center">
          Synchronizing Family Connection Center...
        </div>
      )}

      {/* =====================================================================
          1. RELATIONSHIP CHECK-INS
         ===================================================================== */}
      {activeSubTab === 'checkins' && (
        <div className="space-y-4">
          {/* Guided Reflection Prompt Banner */}
          <div className="p-5 rounded-2xl bg-emerald-950/5 border border-emerald-900/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                <span>Weekly Reflection Prompt</span>
              </div>
              <p className="text-sm font-serif text-stone-900">
                “{GUIDED_CHECKIN_PROMPTS[0]}”
              </p>
            </div>
            {canMutate && (
              <button
                type="button"
                onClick={() => {
                  setEditingCheckIn(null);
                  setIsCheckInModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-[#173D35] text-white text-xs font-semibold hover:bg-emerald-950 shrink-0 cursor-pointer"
              >
                Reflect on Prompt
              </button>
            )}
          </div>

          {authorizedCheckIns.length === 0 ? (
            <div className="rounded-3xl p-10 bg-white border border-stone-200 text-center space-y-3">
              <MessageCircle className="w-7 h-7 text-stone-400 mx-auto" />
              <div className="space-y-1">
                <p className="text-base font-serif font-bold text-stone-900">No check-ins found</p>
                <p className="text-xs text-stone-500 max-w-md mx-auto">
                  Share a gentle weekly or moment-in-time check-in to let your household know how you are feeling and how to support one another.
                </p>
              </div>
              {canMutate && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingCheckIn(null);
                    setIsCheckInModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#173D35] text-white text-xs font-semibold cursor-pointer"
                >
                  + Log First Check-in
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {authorizedCheckIns.map((ci) => (
                <div
                  key={ci.id}
                  className="rounded-2xl p-5 bg-white border border-stone-200 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2 border-b border-stone-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#173D35] text-[#E5C388] font-serif font-bold flex items-center justify-center text-sm shrink-0">
                          {(ci.author || 'M').charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-stone-900">{ci.author}</h4>
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-stone-500 font-mono">
                            <span>{ci.date}</span>
                            <span>•</span>
                            <span>{ci.type}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {ci.pulseLabel && (
                          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-stone-100 text-stone-800">
                            {ci.pulseLabel}
                          </span>
                        )}
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg flex items-center gap-1 ${
                            ci.isPrivate
                              ? 'bg-amber-50 text-amber-900 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                          }`}
                        >
                          {ci.isPrivate ? <Lock className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                          <span>{ci.isPrivate ? 'Private' : 'Shared'}</span>
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      <p className="text-stone-800 leading-relaxed font-medium">{ci.weekSummary}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {ci.wentWell && (
                          <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/70">
                            <span className="font-bold text-stone-800 block text-[11px]">
                              What Felt Meaningful
                            </span>
                            <p className="text-stone-600 mt-0.5">{ci.wentWell}</p>
                          </div>
                        )}
                        {ci.supportNeeded && (
                          <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/70">
                            <span className="font-bold text-stone-800 block text-[11px]">
                              Support Needed
                            </span>
                            <p className="text-stone-600 mt-0.5">{ci.supportNeeded}</p>
                          </div>
                        )}
                      </div>
                      {ci.gratitude && (
                        <div className="p-2.5 rounded-xl bg-amber-50/50 border border-amber-200/60 text-amber-950">
                          <span className="font-bold text-[11px] block">Gratitude</span>
                          <p className="mt-0.5">{ci.gratitude}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2 text-xs">
                    <button
                      type="button"
                      disabled={!canMutate}
                      onClick={() => {
                        const updated = { ...ci, actionCompleted: !ci.actionCompleted };
                        setCheckIns((prev) =>
                          prev.map((item) => (item.id === ci.id ? updated : item))
                        );
                        void persistSingleRecord('checkins', ci.id, updated, ci.version);
                      }}
                      className="flex items-center gap-1.5 text-stone-700 cursor-pointer"
                    >
                      <CheckCircle2
                        className={`w-4 h-4 shrink-0 ${
                          ci.actionCompleted ? 'text-emerald-600' : 'text-stone-300'
                        }`}
                      />
                      <span
                        className={
                          ci.actionCompleted
                            ? 'line-through text-stone-400'
                            : 'font-medium text-stone-800'
                        }
                      >
                        {ci.followUpAction || 'Weekly check-in complete'}
                      </span>
                    </button>

                    {canMutate && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCheckIn(ci);
                            setIsCheckInModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 cursor-pointer"
                          title="Edit Check-in"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteTarget({
                              collection: 'checkins',
                              id: ci.id,
                              title: `${ci.author}'s Check-in`,
                            })
                          }
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                          title="Delete Check-in"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
          2. GRATITUDE & APPRECIATION WALL
         ===================================================================== */}
      {activeSubTab === 'gratitude' && (
        <div className="space-y-4">
          {filteredGratitude.length === 0 ? (
            <div className="rounded-3xl p-10 bg-white border border-stone-200 text-center space-y-3">
              <Sparkles className="w-7 h-7 text-amber-600 mx-auto" />
              <div className="space-y-1">
                <p className="text-base font-serif font-bold text-stone-900">
                  The Appreciation Wall is waiting for your first note
                </p>
                <p className="text-xs text-stone-500 max-w-md mx-auto">
                  Post a quick thank-you, celebrate someone’s kindness, or attach a snapshot from the week.
                </p>
              </div>
              {canMutate && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingGratitude(null);
                    setIsGratitudeModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#173D35] text-white text-xs font-semibold cursor-pointer"
                >
                  + Share First Appreciation Note
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGratitude.map((gn) => {
                const reactions = gn.reactions || [];
                const heartCount = reactions.filter((r) => r.type === 'HEART').length;
                const thankfulCount = reactions.filter((r) => r.type === 'THANKFUL').length;
                const sparkleCount = reactions.filter((r) => r.type === 'SPARKLE').length;

                return (
                  <div
                    key={gn.id}
                    className="rounded-2xl p-5 bg-white border border-stone-200 flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-200/70">
                          {gn.category}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-mono text-stone-400">{gn.date}</span>
                          {canMutate && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingGratitude(gn);
                                  setIsGratitudeModalOpen(true);
                                }}
                                className="p-1 text-stone-400 hover:text-stone-800 cursor-pointer"
                                title="Edit Note"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setDeleteTarget({
                                    collection: 'gratitude',
                                    id: gn.id,
                                    title: `Appreciation note for ${gn.to}`,
                                  })
                                }
                                className="p-1 text-rose-500 hover:text-rose-700 cursor-pointer"
                                title="Delete Note"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <p className="text-sm font-serif text-stone-900 leading-relaxed">
                        “{gn.message}”
                      </p>

                      {(gn.attachments || []).length > 0 && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {(gn.attachments || []).map((att) => (
                            <img
                              key={att.id}
                              src={att.dataUrl}
                              alt={att.name}
                              className="w-full h-28 object-cover rounded-xl border border-stone-200 bg-stone-50"
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-stone-100 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-emerald-900">To: {gn.to}</span>
                        <span className="text-stone-500">From: {gn.from}</span>
                      </div>

                      {/* Warm Reactions Bar */}
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <button
                          type="button"
                          onClick={() => void handleToggleGratitudeReaction(gn, 'HEART')}
                          className="px-2.5 py-1 rounded-lg bg-stone-50 hover:bg-rose-50 border border-stone-200 text-[11px] font-medium text-stone-700 flex items-center gap-1 cursor-pointer"
                        >
                          <span>❤️</span>
                          <span>Warmth</span>
                          {heartCount > 0 && <span className="font-mono font-bold">{heartCount}</span>}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleToggleGratitudeReaction(gn, 'THANKFUL')}
                          className="px-2.5 py-1 rounded-lg bg-stone-50 hover:bg-amber-50 border border-stone-200 text-[11px] font-medium text-stone-700 flex items-center gap-1 cursor-pointer"
                        >
                          <span>🙏</span>
                          <span>Thankful</span>
                          {thankfulCount > 0 && (
                            <span className="font-mono font-bold">{thankfulCount}</span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleToggleGratitudeReaction(gn, 'SPARKLE')}
                          className="px-2.5 py-1 rounded-lg bg-stone-50 hover:bg-emerald-50 border border-stone-200 text-[11px] font-medium text-stone-700 flex items-center gap-1 cursor-pointer"
                        >
                          <span>✨</span>
                          <span>Celebrate</span>
                          {sparkleCount > 0 && (
                            <span className="font-mono font-bold">{sparkleCount}</span>
                          )}
                        </button>
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
          3. COUPLE CONNECTION (Partner-Only Space)
         ===================================================================== */}
      {activeSubTab === 'couple' && (
        !isCoupleAuthorized ? (
          <div className="rounded-3xl p-10 bg-white border border-stone-200 text-center space-y-2">
            <Lock className="w-6 h-6 text-amber-700 mx-auto" />
            <h3 className="font-serif font-bold text-lg text-stone-900">
              Couple Connection Space is Private to Partners
            </h3>
            <p className="text-xs text-stone-500 max-w-md mx-auto">
              Private partner check-ins, shared date ideas, and alignment notes are restricted to household Owners and Admins.
            </p>
          </div>
        ) : filteredCouplePlans.length === 0 ? (
          <div className="rounded-3xl p-10 bg-white border border-stone-200 text-center space-y-3">
            <Heart className="w-7 h-7 text-rose-600 mx-auto" />
            <div className="space-y-1">
              <p className="text-base font-serif font-bold text-stone-900">
                No partner entries match your filter
              </p>
              <p className="text-xs text-stone-500 max-w-md mx-auto">
                Save a shared date idea, log a private partner check-in, or record a couple alignment note.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingCouplePlan(null);
                setIsCoupleModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-[#173D35] text-white text-xs font-semibold cursor-pointer"
            >
              + Add Partner Entry
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCouplePlans.map((cp) => (
              <div
                key={cp.id}
                className="rounded-2xl p-5 bg-white border border-stone-200 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-rose-50 text-rose-900 border border-rose-200/70">
                        {cp.category}
                      </span>
                      {cp.connectionPulse && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-lg bg-stone-100 text-stone-700">
                          {cp.connectionPulse}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-mono text-stone-500">{cp.date}</span>
                  </div>

                  <h4
                    className={`font-serif font-bold text-base ${
                      cp.completed ? 'line-through text-stone-400' : 'text-stone-900'
                    }`}
                  >
                    {cp.title}
                  </h4>

                  <p className="text-xs text-stone-600 leading-relaxed">{cp.notes}</p>

                  {cp.sharedDecision && (
                    <div className="p-2.5 rounded-xl bg-emerald-50/50 border border-emerald-200/70 text-xs">
                      <span className="font-bold text-emerald-950 block text-[11px]">
                        Shared Partner Understanding {cp.alignmentTopic ? `• ${cp.alignmentTopic}` : ''}
                      </span>
                      <p className="text-emerald-900 mt-0.5">{cp.sharedDecision}</p>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const updated = { ...cp, completed: !cp.completed };
                      setCouplePlans((prev) =>
                        prev.map((item) => (item.id === cp.id ? updated : item))
                      );
                      void persistSingleRecord('couple_plans', cp.id, updated, cp.version);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                      cp.completed
                        ? 'bg-emerald-100 text-emerald-900'
                        : 'bg-stone-100 hover:bg-stone-200 text-stone-800'
                    }`}
                  >
                    {cp.completed ? 'Completed ✓' : 'Mark Complete'}
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCouplePlan(cp);
                        setIsCoupleModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 cursor-pointer"
                      title="Edit Partner Entry"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteTarget({
                          collection: 'couple_plans',
                          id: cp.id,
                          title: cp.title,
                        })
                      }
                      className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                      title="Delete Partner Entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* =====================================================================
          4. FAMILY MEETINGS & DISCUSSIONS
         ===================================================================== */}
      {activeSubTab === 'communication' && (
        <div className="space-y-4">
          {filteredMeetings.length === 0 ? (
            <div className="rounded-3xl p-10 bg-white border border-stone-200 text-center space-y-3">
              <Users className="w-7 h-7 text-stone-400 mx-auto" />
              <div className="space-y-1">
                <p className="text-base font-serif font-bold text-stone-900">
                  No family meetings match your view
                </p>
                <p className="text-xs text-stone-500 max-w-md mx-auto">
                  Schedule a Sunday huddle or use a reusable agenda template to organize discussion topics and action-item checklists.
                </p>
              </div>
              {canMutate && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingMeeting(null);
                    setIsMeetingModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#173D35] text-white text-xs font-semibold cursor-pointer"
                >
                  + Schedule Family Meeting
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredMeetings.map((m) => {
                const discussedCount = (m.discussedAgendaIndices || []).length;
                const totalAgenda = (m.agendaItems || []).length;
                const doneTasks = (m.completedTaskIndices || []).length;
                const totalTasks = (m.followUpTasks || []).length;

                return (
                  <div
                    key={m.id}
                    className="rounded-2xl p-5 bg-white border border-stone-200 flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2 border-b border-stone-100 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                                m.completed
                                  ? 'bg-stone-100 text-stone-600'
                                  : 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                              }`}
                            >
                              {m.completed ? 'Archived' : 'Active'}
                            </span>
                            <span className="text-xs font-mono text-stone-500">{m.date}</span>
                          </div>
                          <h4 className="font-serif font-bold text-base text-stone-900 mt-1">
                            {m.title}
                          </h4>
                          <p className="text-[11px] text-stone-500">
                            Facilitator: {m.facilitator || 'Family'} • {m.participants}
                          </p>
                        </div>

                        {canMutate && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMeeting(m);
                                setIsMeetingModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 cursor-pointer"
                              title="Edit Meeting"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({
                                  collection: 'meetings',
                                  id: m.id,
                                  title: m.title,
                                })
                              }
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                              title="Delete Meeting"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1.5">
                          <div className="flex items-center justify-between font-bold text-stone-800">
                            <span>Agenda Topics</span>
                            <span className="font-mono text-[11px] text-stone-500">
                              {discussedCount}/{totalAgenda}
                            </span>
                          </div>
                          <ul className="space-y-1 text-stone-600 list-disc list-inside">
                            {(m.agendaItems || []).slice(0, 3).map((item, i) => (
                              <li key={i} className="truncate">
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-200/70 space-y-1.5">
                          <div className="flex items-center justify-between font-bold text-emerald-950">
                            <span>Action Checklist</span>
                            <span className="font-mono text-[11px] text-emerald-800">
                              {doneTasks}/{totalTasks}
                            </span>
                          </div>
                          {(m.followUpTasks || []).length === 0 ? (
                            <p className="text-stone-500 italic">No action items yet</p>
                          ) : (
                            <ul className="space-y-1 text-emerald-900 list-disc list-inside">
                              {(m.followUpTasks || []).slice(0, 3).map((t, i) => (
                                <li key={i} className="truncate">
                                  {t}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
                      <span className="text-[11px] text-stone-500">
                        {(m.decisions || []).length} recorded decision(s)
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveMeetingDrawerId(m.id)}
                        className="px-3.5 py-1.5 rounded-xl bg-[#173D35] text-white text-xs font-semibold hover:bg-emerald-950 flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                        <span>Open Agenda & Checklist</span>
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
          5. SHARED EXPERIENCES
         ===================================================================== */}
      {activeSubTab === 'experiences' && (
        <div className="space-y-4">
          {filteredExperiences.length === 0 ? (
            <div className="rounded-3xl p-10 bg-white border border-stone-200 text-center space-y-3">
              <Compass className="w-7 h-7 text-stone-400 mx-auto" />
              <div className="space-y-1">
                <p className="text-base font-serif font-bold text-stone-900">
                  No shared experiences match your filter
                </p>
                <p className="text-xs text-stone-500 max-w-md mx-auto">
                  Plan an upcoming family activity or record a cherished memory with photos and keepsake documents.
                </p>
              </div>
              {canMutate && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingExperience(null);
                    setIsExperienceModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#173D35] text-white text-xs font-semibold cursor-pointer"
                >
                  + Add Shared Experience
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredExperiences.map((ex) => (
                <div
                  key={ex.id}
                  className="rounded-2xl p-5 bg-white border border-stone-200 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200/70">
                        {ex.category}
                      </span>
                      <span className="text-xs font-mono text-stone-500">{ex.date}</span>
                    </div>

                    <h4 className="font-serif font-bold text-base text-stone-900">{ex.title}</h4>

                    {ex.location && (
                      <div className="flex items-center gap-1 text-[11px] text-stone-500">
                        <MapPin className="w-3 h-3 text-stone-400 shrink-0" />
                        <span>{ex.location}</span>
                      </div>
                    )}

                    <p className="text-xs text-stone-600 leading-relaxed">{ex.notes}</p>

                    {(ex.attachments || []).length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex flex-wrap gap-2">
                          {(ex.attachments || []).map((att) =>
                            att.type === 'PHOTO' ? (
                              <img
                                key={att.id}
                                src={att.dataUrl}
                                alt={att.name}
                                className="w-16 h-16 rounded-xl object-cover border border-stone-200"
                              />
                            ) : (
                              <a
                                key={att.id}
                                href={att.dataUrl}
                                download={att.name}
                                className="px-2.5 py-1.5 rounded-xl bg-stone-50 border border-stone-200 text-[11px] text-stone-700 flex items-center gap-1.5 hover:bg-stone-100"
                              >
                                <FileText className="w-3.5 h-3.5 text-stone-500" />
                                <span className="truncate max-w-[120px]">{att.name}</span>
                              </a>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2 text-xs">
                    <button
                      type="button"
                      disabled={!canMutate}
                      onClick={() => {
                        const updated = { ...ex, completed: !ex.completed };
                        setExperiences((prev) =>
                          prev.map((item) => (item.id === ex.id ? updated : item))
                        );
                        void persistSingleRecord('experiences', ex.id, updated, ex.version);
                      }}
                      className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                        ex.completed
                          ? 'bg-amber-50 text-amber-900 border border-amber-200'
                          : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                      }`}
                    >
                      {ex.completed ? 'Memory Logged ✓' : 'Mark Completed'}
                    </button>

                    {canMutate && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingExperience(ex);
                            setIsExperienceModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 cursor-pointer"
                          title="Edit Experience"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteTarget({
                              collection: 'experiences',
                              id: ex.id,
                              title: ex.title,
                            })
                          }
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                          title="Delete Experience"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
          6. SHARED AGREEMENTS & REFLECTION
         ===================================================================== */}
      {activeSubTab === 'resolution' && (
        <div className="space-y-4">
          {filteredAgreements.length === 0 ? (
            <div className="rounded-3xl p-10 bg-white border border-stone-200 text-center space-y-3">
              <Handshake className="w-7 h-7 text-stone-400 mx-auto" />
              <div className="space-y-1">
                <p className="text-base font-serif font-bold text-stone-900">
                  No shared agreements match your filter
                </p>
                <p className="text-xs text-stone-500 max-w-md mx-auto">
                  Create living family agreements with clear commitments, version history, and periodic reflection prompts.
                </p>
              </div>
              {canMutate && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingAgreement(null);
                    setIsAgreementModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#173D35] text-white text-xs font-semibold cursor-pointer"
                >
                  + Create Shared Agreement
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredAgreements.map((ag) => (
                <div
                  key={ag.id}
                  className="rounded-2xl p-5 bg-white border border-stone-200 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200/70">
                            {ag.category || 'Tech & Presence'}
                          </span>
                          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-stone-100 text-stone-700">
                            v{ag.versionNumber || 1}
                          </span>
                          <span className="text-[11px] text-stone-500">{ag.reviewDate}</span>
                        </div>
                        <h4 className="font-serif font-bold text-base text-stone-900 mt-1.5">
                          {ag.topic}
                        </h4>
                      </div>

                      {canMutate && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAgreement(ag);
                              setIsAgreementModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 cursor-pointer"
                            title="Revise Agreement"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteTarget({
                                collection: 'agreements',
                                id: ag.id,
                                title: ag.topic,
                              })
                            }
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                            title="Delete Agreement"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <p className="text-xs italic text-stone-500">
                      Prompt: “{ag.reflectionPrompt}”
                    </p>

                    <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80 text-xs space-y-1.5">
                      <span className="font-bold text-stone-900 block">Our Shared Charter</span>
                      <p className="text-stone-700 leading-relaxed">{ag.sharedAgreement}</p>
                      {(ag.commitments || []).length > 0 && (
                        <ul className="list-disc list-inside text-stone-600 space-y-0.5 pt-1">
                          {(ag.commitments || []).map((c, idx) => (
                            <li key={idx}>{c}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2 text-xs">
                    <span className="text-stone-500 truncate">
                      Follow-up: <strong className="text-stone-800">{ag.followUpAction}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveAgreementDrawerId(ag.id)}
                      className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>
                        History & Reflections ({(ag.reflections || []).length})
                      </span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          7. EXTERNAL NETWORK & CRM
         ===================================================================== */}
      {activeSubTab === 'external_crm' && (
        <div className="space-y-4">
          {filteredContacts.length === 0 ? (
            <div className="rounded-3xl p-10 bg-white border border-stone-200 text-center space-y-3">
              <Users className="w-7 h-7 text-stone-400 mx-auto" />
              <div className="space-y-1">
                <p className="text-base font-serif font-bold text-stone-900">
                  No contacts match your filter
                </p>
                <p className="text-xs text-stone-500 max-w-md mx-auto">
                  Keep extended family, close friends, trusted neighbors, and mentors organized with tags and follow-up reminders.
                </p>
              </div>
              {canMutate && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingContact(null);
                    setIsContactModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#173D35] text-white text-xs font-semibold cursor-pointer"
                >
                  + Add First Contact
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredContacts.map((c) => (
                <div
                  key={c.id}
                  className="rounded-2xl p-5 bg-white border border-stone-200 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-900 border border-emerald-200/70">
                          {c.category.replace('_', ' ')}
                        </span>
                        <h4 className="font-serif font-bold text-base text-stone-900 mt-1">
                          {c.name}
                        </h4>
                        {c.location && (
                          <div className="flex items-center gap-1 text-[11px] text-stone-500 mt-0.5">
                            <MapPin className="w-3 h-3 text-stone-400" />
                            <span>{c.location}</span>
                          </div>
                        )}
                      </div>

                      {canMutate && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingContact(c);
                              setIsContactModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 cursor-pointer"
                            title="Edit Contact"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteTarget({
                                collection: 'network_contacts',
                                id: c.id,
                                title: c.name,
                              })
                            }
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                            title="Delete Contact"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Tags */}
                    {(c.tags || []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {(c.tags || []).map((tag, i) => (
                          <span
                            key={i}
                            className="text-[11px] px-2 py-0.5 rounded-lg bg-stone-100 text-stone-700 font-medium"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Contact Details & Follow-up Notes */}
                    <div className="space-y-1 text-xs text-stone-600">
                      {c.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-stone-400" />
                          <span className="font-mono">{c.phone}</span>
                        </div>
                      )}
                      {c.email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-stone-400" />
                          <span>{c.email}</span>
                        </div>
                      )}
                      {c.importantEvent && (
                        <div className="flex items-center gap-1.5 text-amber-900 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-amber-600" />
                          <span>{c.importantEvent}</span>
                        </div>
                      )}
                    </div>

                    {c.notes && (
                      <p className="text-xs text-stone-600 bg-stone-50 p-2.5 rounded-xl border border-stone-200/70">
                        {c.notes}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2 text-xs">
                    <div className="text-[11px] text-stone-500">
                      <div>
                        Last contact:{' '}
                        <span className="font-mono text-stone-800">
                          {(c.lastCheckedIn || 'None').slice(0, 10)}
                        </span>
                      </div>
                      {c.nextFollowUpDate && (
                        <div>
                          Follow-up:{' '}
                          <span className="font-mono text-emerald-900 font-semibold">
                            {c.nextFollowUpDate}
                          </span>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveContactDrawerId(c.id)}
                      className="px-3 py-1.5 rounded-xl bg-[#173D35] text-white font-semibold hover:bg-emerald-950 cursor-pointer shrink-0"
                    >
                      Log Catch-Up ({(c.interactionHistory || []).length})
                    </button>
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
      <CheckInFormModal
        isOpen={isCheckInModalOpen}
        onClose={() => {
          setIsCheckInModalOpen(false);
          setEditingCheckIn(null);
        }}
        initialRecord={editingCheckIn}
        currentUserName={currentUserName}
        isSaving={isSaving}
        onSave={handleSaveCheckIn}
      />

      <GratitudeFormModal
        isOpen={isGratitudeModalOpen}
        onClose={() => {
          setIsGratitudeModalOpen(false);
          setEditingGratitude(null);
        }}
        initialNote={editingGratitude}
        recipientOptions={recipientOptions}
        isSaving={isSaving}
        onSave={handleSaveGratitude}
      />

      <CoupleConnectionFormModal
        isOpen={isCoupleModalOpen}
        onClose={() => {
          setIsCoupleModalOpen(false);
          setEditingCouplePlan(null);
        }}
        initialPlan={editingCouplePlan}
        isSaving={isSaving}
        onSave={handleSaveCouplePlan}
      />

      <FamilyMeetingFormModal
        isOpen={isMeetingModalOpen}
        onClose={() => {
          setIsMeetingModalOpen(false);
          setEditingMeeting(null);
        }}
        initialMeeting={editingMeeting}
        templates={allMeetingTemplates}
        defaultFacilitator={currentUserName}
        isSaving={isSaving}
        onSave={handleSaveMeeting}
      />

      <FamilyMeetingDetailDrawer
        meeting={activeMeetingDrawer}
        onClose={() => setActiveMeetingDrawerId(null)}
        canMutate={canMutate}
        onUpdateMeeting={handleUpdateMeetingFromDrawer}
      />

      <MeetingTemplatesModal
        isOpen={isTemplatesModalOpen}
        onClose={() => setIsTemplatesModalOpen(false)}
        templates={allMeetingTemplates}
        canMutate={canMutate}
        onCreateTemplate={handleCreateMeetingTemplate}
        onDeleteTemplate={handleDeleteMeetingTemplate}
      />

      <SharedExperienceFormModal
        isOpen={isExperienceModalOpen}
        onClose={() => {
          setIsExperienceModalOpen(false);
          setEditingExperience(null);
        }}
        initialExperience={editingExperience}
        isSaving={isSaving}
        onSave={handleSaveExperience}
      />

      <SharedAgreementFormModal
        isOpen={isAgreementModalOpen}
        onClose={() => {
          setIsAgreementModalOpen(false);
          setEditingAgreement(null);
        }}
        initialAgreement={editingAgreement}
        currentUserName={currentUserName}
        isSaving={isSaving}
        onSave={handleSaveAgreement}
      />

      <AgreementHistoryDrawer
        agreement={activeAgreementDrawer}
        onClose={() => setActiveAgreementDrawerId(null)}
        currentUserName={currentUserName}
        canMutate={canMutate}
        onAddReflection={handleAddAgreementReflection}
      />

      <ExternalContactFormModal
        isOpen={isContactModalOpen}
        onClose={() => {
          setIsContactModalOpen(false);
          setEditingContact(null);
        }}
        initialContact={editingContact}
        isSaving={isSaving}
        onSave={handleSaveNetworkContact}
      />

      <ContactTouchpointDrawer
        contact={activeContactDrawer}
        onClose={() => setActiveContactDrawerId(null)}
        canMutate={canMutate}
        onLogTouchpoint={handleLogContactTouchpoint}
      />

      <DeleteConfirmModal
        target={deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
