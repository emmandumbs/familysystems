import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Sparkles,
  Heart,
  Calendar,
  Mail,
  Shield,
  CheckCircle2,
  X,
  Plus,
  Edit2,
  Trash2,
  Copy,
  RefreshCw,
  Cake,
  GitBranch,
  UserCheck,
  Search,
  Link as LinkIcon,
  Image as ImageIcon,
  ScrollText,
  Landmark,
  Compass,
  Scale,
  Star,
  FolderPlus,
  Upload,
  Check,
  Archive,
  Printer,
  Megaphone,
  Clock,
  MapPin,
  DollarSign,
} from 'lucide-react';
import { HomeDashboardsExperience } from './HomeDashboardsExperience';
import { ExtendedFamilyHeritageMap } from './ExtendedFamilyHeritageMap';
import type { MainTabType } from './SidebarNavigation';
import type { ExportDocumentType } from './export/PrintableExportView';

export type Stage331WorkspaceData = any;

export interface Stage331Props {
  mode: 'home' | 'people' | 'presence';
  workspaceData: any;
  sessionToken: string;
  selectedPersona: string;
  accessDeniedError?: string | null;
  onSelectPersona: (role: any) => void;
  onRefresh: () => void;
  onNavigateTab: (tab: string, subItemId?: string) => void;
  activeSubPage?: string;
  onSelectSubPage?: (subId: string) => void;
  onOpenOnboardingModal?: (step?: any, inviteToken?: string) => void;
  onOpenPrintDoc?: (docType: ExportDocumentType, recipeId?: string) => void;
}

const HOME_DASHBOARD_SUBPAGES = new Set([
  'home_command_center',
  'home_finance_dashboard',
  'home_house_dashboard',
  'home_goals_dashboard',
  'home_relationship_dashboard',
  'home_parenting_dashboard',
  'home_life_dashboard',
]);

const FAMILY_SECTION_TABS = [
  { id: 'home_overview', label: 'Family Home Overview', icon: Users },
  { id: 'people_gallery', label: 'Family Gallery', icon: ImageIcon },
  { id: 'home_constitution', label: 'Family Constitution', icon: ScrollText },
  { id: 'people_traditions', label: 'Family Traditions & Culture', icon: Landmark },
  { id: 'people_activities', label: 'Shared Activities', icon: Calendar },
  { id: 'people_rules', label: 'Family Rules & Principles', icon: Scale },
];

export const Stage331FamilyExperience: React.FC<Stage331Props> = ({
  mode,
  workspaceData,
  sessionToken,
  onRefresh,
  onNavigateTab,
  activeSubPage = 'home_overview',
  onSelectSubPage,
  onOpenPrintDoc,
}) => {
  const familyId = workspaceData?.familyId || workspaceData?.workspace?.id || '';
  const callerRole = workspaceData?.callerMembership?.role || workspaceData?.actor?.role || 'OWNER';
  const callerMemberId = workspaceData?.callerMembership?.memberProfileId || workspaceData?.actor?.memberId || '';
  const callerDisplayName = workspaceData?.callerMembership?.displayName || 'Family Member';
  const canManage =
    Boolean(workspaceData?.permissions?.canManageMembers) ||
    callerRole === 'OWNER' ||
    callerRole === 'ADMIN';

  const members: any[] = workspaceData?.members || [];
  const memberships: any[] = workspaceData?.memberships || [];
  const relationships: any[] = workspaceData?.relationships || [];
  const invitations: any[] = workspaceData?.invitations || [];
  const ws = workspaceData?.workspace || { id: familyId, name: 'Family Household' };

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Family Section backend state (/api/v1/family-section/:familyId)
  const [sectionData, setSectionData] = useState<any>(null);
  const [sectionLoading, setSectionLoading] = useState(false);

  // Overview sub-states
  const [overviewSubView, setOverviewSubView] = useState<'ALL' | 'HERITAGE_MAP' | 'DIRECTORY'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('ALL');
  const [detailMember, setDetailMember] = useState<any | null>(null);
  const [showEditIdentityModal, setShowEditIdentityModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showAddRelationshipModal, setShowAddRelationshipModal] = useState(false);
  const [showConnectAccountModal, setShowConnectAccountModal] = useState<any | null>(null);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);

  // Identity edit form
  const [identityForm, setIdentityForm] = useState({
    name: '',
    description: '',
    motto: '',
    mission: '',
    vision: '',
    valuesText: '',
  });

  // Add Member form
  const [memberForm, setMemberForm] = useState({
    displayName: '',
    relationshipToPrimary: 'MEMBER',
    role: 'MEMBER',
    birthDate: '',
    responsibilitiesText: '',
    dietaryText: '',
    allergiesText: '',
    isRestrictedProfile: false,
  });

  // Invite form
  const [inviteForm, setInviteForm] = useState({
    inviteMethod: 'ONE_TIME_LINK' as 'ONE_TIME_LINK' | 'GOOGLE_ACCOUNT',
    email: '',
    displayName: '',
    proposedRole: 'MEMBER',
    relationshipToPrimary: 'SPOUSE',
    message: 'Welcome to our family space on FamilyOS!',
  });

  // Relationship form
  const [relForm, setRelForm] = useState({
    person1MemberId: '',
    person2MemberId: '',
    relationshipType: 'PARENT_CHILD',
    notes: '',
  });

  // Connect Account form
  const [connectAccountForm, setConnectAccountForm] = useState({
    userAccountId: '',
    email: '',
    displayName: '',
    role: 'MEMBER',
  });

  // Announcement form
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    body: '',
    priority: 'NORMAL',
  });

  // Gallery states
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>('ALL');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [showAlbumModal, setShowAlbumModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [albumForm, setAlbumForm] = useState({ title: '', description: '', category: 'Family Memories' });
  const [photoForm, setPhotoForm] = useState({
    albumId: '',
    title: '',
    caption: '',
    eventName: '',
    takenDate: new Date().toISOString().slice(0, 10),
    imageUrl: '',
    visibility: 'FAMILY',
    taggedMemberIds: [] as string[],
  });

  // Constitution states
  const [showConstitutionModal, setShowConstitutionModal] = useState(false);
  const [constitutionForm, setConstitutionForm] = useState({
    motto: '',
    missionStatement: '',
    visionStatement: '',
    coreValuesText: '',
    familyIdentityStatement: '',
    sharedAspirationsText: '',
    memberCommitmentsText: '',
    legacyStatement: '',
  });

  // Traditions states
  const [traditionCategoryFilter, setTraditionCategoryFilter] = useState('ALL');
  const [showArchivedTraditions, setShowArchivedTraditions] = useState(false);
  const [showTraditionModal, setShowTraditionModal] = useState(false);
  const [editingTradition, setEditingTradition] = useState<any | null>(null);
  const [traditionForm, setTraditionForm] = useState({
    title: '',
    category: 'Annual Tradition',
    frequency: 'Annually',
    nextPlannedDate: '',
    meaningAndOrigin: '',
    culturalBackground: '',
    linkedRecipeTitle: '',
    memoriesText: '',
  });

  // Shared Activities states
  const [activityStatusFilter, setActivityStatusFilter] = useState('ALL');
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [activityForm, setActivityForm] = useState({
    title: '',
    description: '',
    dateIso: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
    startTime: '18:00',
    endTime: '20:00',
    location: 'Family Home',
    category: 'Family Gathering',
    budgetDollars: '25.00',
    checklistText: 'Prepare refreshments, Confirm family schedule',
    recurrence: 'NONE',
  });

  // Rules & Principles states
  const [ruleCategoryFilter, setRuleCategoryFilter] = useState('ALL');
  const [showArchivedRules, setShowArchivedRules] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<any | null>(null);
  const [ruleForm, setRuleForm] = useState({
    title: '',
    category: 'Household Conduct',
    principleStatement: '',
    expectationsText: '',
    appliesTo: 'All Family Members',
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const getHeaders = useCallback(() => {
    const raw = sessionToken || 'usr-sarah-owner';
    return {
      'Content-Type': 'application/json',
      Authorization: raw.startsWith('Bearer ') ? raw : `Bearer ${raw}`,
    };
  }, [sessionToken]);

  const fetchFamilySection = useCallback(async () => {
    if (!familyId) return;
    setSectionLoading(true);
    try {
      const res = await fetch(`/api/v1/family-section/${encodeURIComponent(familyId)}`, {
        headers: getHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        setSectionData(json);
      }
    } catch {
      // Ignore transient error
    } finally {
      setSectionLoading(false);
    }
  }, [familyId, getHeaders]);

  useEffect(() => {
    void fetchFamilySection();
  }, [fetchFamilySection]);

  // Calculate upcoming birthdays within next 90 days
  const upcomingBirthdays = useMemo(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const list: Array<{ member: any; date: string; daysRemaining: number }> = [];

    for (const m of members) {
      const bdayStr = m.birthDate;
      if (!bdayStr) continue;
      const parts = bdayStr.split('-');
      if (parts.length < 3) continue;
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      let nextBday = new Date(currentYear, month, day);
      if (nextBday.getTime() < today.getTime() - 86400000) {
        nextBday = new Date(currentYear + 1, month, day);
      }
      const diffDays = Math.ceil((nextBday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays <= 90) {
        list.push({ member: m, date: bdayStr, daysRemaining: diffDays });
      }
    }
    return list.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [members]);

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (selectedRoleFilter !== 'ALL' && m.role !== selectedRoleFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (m.displayName || '').toLowerCase().includes(q);
        const matchRel = (m.relationshipToPrimary || '').toLowerCase().includes(q);
        const matchRole = (m.role || '').toLowerCase().includes(q);
        return matchName || matchRel || matchRole;
      }
      return true;
    });
  }, [members, selectedRoleFilter, searchQuery]);

  // If mode is 'home' or activeSubPage is one of the 7 Home dashboards, delegate to HomeDashboardsExperience
  if (mode === 'home' || HOME_DASHBOARD_SUBPAGES.has(activeSubPage)) {
    return (
      <HomeDashboardsExperience
        familyId={familyId}
        activeSubPage={HOME_DASHBOARD_SUBPAGES.has(activeSubPage) ? activeSubPage : 'home_command_center'}
        authToken={sessionToken}
        onNavigate={(tab, subId) => {
          onNavigateTab(tab, subId);
        }}
      />
    );
  }

  const resolvedFamilySubPage = FAMILY_SECTION_TABS.some((t) => t.id === activeSubPage)
    ? activeSubPage
    : 'home_overview';

  const selectFamilySubPage = (subId: string) => {
    if (onSelectSubPage) {
      onSelectSubPage(subId);
    } else {
      onNavigateTab('people_relationships', subId);
    }
  };

  // ============================================================================
  // HANDLERS — OVERVIEW (IDENTITY, MEMBERS, INVITATIONS, RELATIONSHIPS, ANNOUNCEMENTS)
  // ============================================================================
  const openEditIdentity = () => {
    setIdentityForm({
      name: ws.name || '',
      description: ws.description || '',
      motto: ws.motto || '',
      mission: ws.mission || '',
      vision: ws.vision || '',
      valuesText: Array.isArray(ws.values) ? ws.values.join(', ') : '',
    });
    setShowEditIdentityModal(true);
  };

  const handleSaveIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/workspace/${encodeURIComponent(familyId)}/identity`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          name: identityForm.name.trim(),
          description: identityForm.description.trim(),
          motto: identityForm.motto.trim(),
          mission: identityForm.mission.trim(),
          vision: identityForm.vision.trim(),
          values: identityForm.valuesText
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.message || 'Could not update family identity.');
        return;
      }
      showToast('Updated family identity & charter header!');
      setShowEditIdentityModal(false);
      onRefresh();
      void fetchFamilySection();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberForm.displayName.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/members', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          familyId,
          displayName: memberForm.displayName.trim(),
          relationshipToPrimary: memberForm.relationshipToPrimary,
          role: memberForm.role,
          birthDate: memberForm.birthDate || null,
          responsibilities: memberForm.responsibilitiesText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          dietaryPreferences: memberForm.dietaryText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          allergies: memberForm.allergiesText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          isRestrictedProfile: memberForm.isRestrictedProfile,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.message || 'Failed to add member.');
        return;
      }
      showToast(`Added ${memberForm.displayName} to family members!`);
      setShowAddMemberModal(false);
      setMemberForm({
        displayName: '',
        relationshipToPrimary: 'MEMBER',
        role: 'MEMBER',
        birthDate: '',
        responsibilitiesText: '',
        dietaryText: '',
        allergiesText: '',
        isRestrictedProfile: false,
      });
      onRefresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/members/invite', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          familyId,
          inviteMethod: inviteForm.inviteMethod,
          email: inviteForm.email || undefined,
          displayName: inviteForm.displayName || undefined,
          proposedRole: inviteForm.proposedRole,
          relationshipToPrimary: inviteForm.relationshipToPrimary,
          message: inviteForm.message,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.message || 'Failed to generate invitation.');
        return;
      }
      const data = await res.json();
      const token = data.invitation?.invitationToken;
      if (token) {
        navigator.clipboard?.writeText(token);
        showToast('Invitation token generated and copied to clipboard!');
      } else {
        showToast('Invitation sent!');
      }
      setShowInviteModal(false);
      onRefresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeInvite = async (invitationId: string) => {
    try {
      const res = await fetch(`/api/v1/invitations/${encodeURIComponent(invitationId)}/revoke`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (res.ok) {
        showToast('Invitation revoked.');
        onRefresh();
      }
    } catch {
      showToast('Error revoking invitation.');
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    try {
      const res = await fetch(`/api/v1/members/${encodeURIComponent(familyId)}/${encodeURIComponent(memberId)}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (res.ok) {
        showToast(`Removed ${memberName} from family.`);
        if (detailMember?.id === memberId) setDetailMember(null);
        onRefresh();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.message || 'Could not remove member.');
      }
    } catch {
      showToast('Error removing member.');
    }
  };

  const handleAddRelationship = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!relForm.person1MemberId || !relForm.person2MemberId) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/relationships/${encodeURIComponent(familyId)}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          member1Id: relForm.person1MemberId,
          member2Id: relForm.person2MemberId,
          relationshipType: relForm.relationshipType,
          notes: relForm.notes,
        }),
      });
      if (res.ok) {
        showToast('Relationship added to family tree!');
        setShowAddRelationshipModal(false);
        onRefresh();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.message || 'Could not add relationship.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConnectAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showConnectAccountModal || !connectAccountForm.userAccountId.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(
        `/api/v1/members/${encodeURIComponent(familyId)}/${encodeURIComponent(showConnectAccountModal.id)}/connect-account`,
        {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            userAccountId: connectAccountForm.userAccountId.trim(),
            email: connectAccountForm.email.trim() || undefined,
            displayName: connectAccountForm.displayName.trim() || showConnectAccountModal.displayName,
            role: connectAccountForm.role,
          }),
        }
      );
      if (res.ok) {
        showToast(`Connected account to ${showConnectAccountModal.displayName}!`);
        setShowConnectAccountModal(null);
        onRefresh();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.message || 'Failed to connect account.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementForm.title.trim() || !announcementForm.body.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/workspace/${encodeURIComponent(familyId)}/announcements`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(announcementForm),
      });
      if (res.ok) {
        showToast('Family announcement posted!');
        setShowAnnouncementModal(false);
        setAnnouncementForm({ title: '', body: '', priority: 'NORMAL' });
        onRefresh();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================================================
  // HANDLERS — GALLERY (ALBUMS & PHOTOS)
  // ============================================================================
  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!albumForm.title.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/family-section/${encodeURIComponent(familyId)}/albums`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(albumForm),
      });
      if (res.ok) {
        showToast(`Created album "${albumForm.title}"!`);
        setShowAlbumModal(false);
        setAlbumForm({ title: '', description: '', category: 'Family Memories' });
        await fetchFamilySection();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'].includes(file.type.toLowerCase())) {
      showToast('Please select a valid PNG, JPEG, WEBP, or GIF image file.');
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image file exceeds maximum 5 MB upload size.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoForm((prev) => ({
          ...prev,
          imageUrl: reader.result as string,
          title: prev.title || file.name.replace(/\.[^.]+$/, ''),
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUploadPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoForm.title.trim()) return;
    if (!photoForm.imageUrl.trim()) {
      showToast('Please select an image file to upload.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/family-section/${encodeURIComponent(familyId)}/photos`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(photoForm),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.message || 'Photo upload failed.');
        return;
      }
      const saved = await res.json();
      if (saved.persisted) {
        showToast(`Photo "${photoForm.title}" persisted to Family Gallery!`);
      }
      setShowPhotoModal(false);
      setPhotoForm({
        albumId: '',
        title: '',
        caption: '',
        eventName: '',
        takenDate: new Date().toISOString().slice(0, 10),
        imageUrl: '',
        visibility: 'FAMILY',
        taggedMemberIds: [],
      });
      await fetchFamilySection();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleFavoritePhoto = async (photo: any) => {
    try {
      await fetch(`/api/v1/family-section/${encodeURIComponent(familyId)}/photos/${encodeURIComponent(photo.id)}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ isFavorite: !photo.isFavorite }),
      });
      await fetchFamilySection();
    } catch {
      showToast('Could not update photo');
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    try {
      const res = await fetch(`/api/v1/family-section/${encodeURIComponent(familyId)}/photos/${encodeURIComponent(photoId)}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (res.ok) {
        showToast('Photo removed from gallery.');
        await fetchFamilySection();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.message || 'Cannot delete photo.');
      }
    } catch {
      showToast('Error deleting photo.');
    }
  };

  // ============================================================================
  // HANDLERS — FAMILY CONSTITUTION
  // ============================================================================
  const openEditConstitution = () => {
    const c = sectionData?.currentConstitution || {};
    setConstitutionForm({
      motto: c.motto || ws.motto || '',
      missionStatement: c.missionStatement || ws.mission || '',
      visionStatement: c.visionStatement || ws.vision || '',
      coreValuesText: Array.isArray(c.coreValues) ? c.coreValues.join(', ') : (ws.values || []).join(', '),
      familyIdentityStatement: c.familyIdentityStatement || '',
      sharedAspirationsText: Array.isArray(c.sharedAspirations) ? c.sharedAspirations.join('\n') : '',
      memberCommitmentsText: Array.isArray(c.memberCommitments) ? c.memberCommitments.join('\n') : '',
      legacyStatement: c.legacyStatement || '',
    });
    setShowConstitutionModal(true);
  };

  const handleSaveConstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/family-section/${encodeURIComponent(familyId)}/constitution`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          motto: constitutionForm.motto.trim(),
          missionStatement: constitutionForm.missionStatement.trim(),
          visionStatement: constitutionForm.visionStatement.trim(),
          coreValues: constitutionForm.coreValuesText
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean),
          familyIdentityStatement: constitutionForm.familyIdentityStatement.trim(),
          sharedAspirations: constitutionForm.sharedAspirationsText
            .split('\n')
            .map((v) => v.trim())
            .filter(Boolean),
          memberCommitments: constitutionForm.memberCommitmentsText
            .split('\n')
            .map((v) => v.trim())
            .filter(Boolean),
          legacyStatement: constitutionForm.legacyStatement.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.message || 'Could not save constitution.');
        return;
      }
      showToast('New Family Constitution version published!');
      setShowConstitutionModal(false);
      await fetchFamilySection();
      onRefresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcknowledgeConstitution = async () => {
    try {
      const res = await fetch(`/api/v1/family-section/${encodeURIComponent(familyId)}/constitution/acknowledge`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (res.ok) {
        showToast('Your acknowledgment has been recorded on the Family Constitution!');
        await fetchFamilySection();
      }
    } catch {
      showToast('Could not record acknowledgment.');
    }
  };

  // ============================================================================
  // HANDLERS — FAMILY TRADITIONS & CULTURE
  // ============================================================================
  const openCreateTradition = (trad?: any) => {
    if (trad) {
      setEditingTradition(trad);
      setTraditionForm({
        title: trad.title || '',
        category: trad.category || 'Annual Tradition',
        frequency: trad.frequency || 'Annually',
        nextPlannedDate: trad.nextPlannedDate || '',
        meaningAndOrigin: trad.meaningAndOrigin || '',
        culturalBackground: trad.culturalBackground || '',
        linkedRecipeTitle: trad.linkedRecipeTitle || '',
        memoriesText: Array.isArray(trad.memoriesAndNotes) ? trad.memoriesAndNotes.join('\n') : '',
      });
    } else {
      setEditingTradition(null);
      setTraditionForm({
        title: '',
        category: 'Annual Tradition',
        frequency: 'Annually',
        nextPlannedDate: '',
        meaningAndOrigin: '',
        culturalBackground: '',
        linkedRecipeTitle: '',
        memoriesText: '',
      });
    }
    setShowTraditionModal(true);
  };

  const handleSaveTradition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!traditionForm.title.trim()) return;
    setIsSubmitting(true);
    try {
      const url = editingTradition
        ? `/api/v1/family-section/${encodeURIComponent(familyId)}/traditions/${encodeURIComponent(editingTradition.id)}`
        : `/api/v1/family-section/${encodeURIComponent(familyId)}/traditions`;
      const method = editingTradition ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify({
          title: traditionForm.title.trim(),
          category: traditionForm.category,
          frequency: traditionForm.frequency.trim(),
          nextPlannedDate: traditionForm.nextPlannedDate,
          meaningAndOrigin: traditionForm.meaningAndOrigin.trim(),
          culturalBackground: traditionForm.culturalBackground.trim(),
          linkedRecipeTitle: traditionForm.linkedRecipeTitle.trim(),
          memoriesAndNotes: traditionForm.memoriesText
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      if (res.ok) {
        showToast(editingTradition ? 'Tradition updated!' : 'New family tradition added!');
        setShowTraditionModal(false);
        await fetchFamilySection();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleArchiveTradition = async (trad: any) => {
    const nextStatus = trad.status === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED';
    await fetch(`/api/v1/family-section/${encodeURIComponent(familyId)}/traditions/${encodeURIComponent(trad.id)}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ status: nextStatus }),
    });
    showToast(nextStatus === 'ARCHIVED' ? 'Tradition archived.' : 'Tradition restored.');
    await fetchFamilySection();
  };

  // ============================================================================
  // HANDLERS — SHARED ACTIVITIES
  // ============================================================================
  const handleCreateActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activityForm.title.trim()) return;
    setIsSubmitting(true);
    try {
      const budgetCents = Math.max(0, Math.round(parseFloat(activityForm.budgetDollars || '0') * 100));
      const checklist = activityForm.checklistText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((text, idx) => ({ id: `chk-${Date.now()}-${idx}`, text, completed: false }));

      const res = await fetch(`/api/v1/family-section/${encodeURIComponent(familyId)}/activities`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          title: activityForm.title.trim(),
          description: activityForm.description.trim(),
          dateIso: activityForm.dateIso,
          startTime: activityForm.startTime,
          endTime: activityForm.endTime,
          location: activityForm.location.trim(),
          category: activityForm.category,
          budgetCents,
          preparationChecklist: checklist,
          recurrence: activityForm.recurrence,
        }),
      });
      if (res.ok) {
        showToast('Shared activity scheduled & synced to Family Calendar!');
        setShowActivityModal(false);
        await fetchFamilySection();
        onRefresh();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRsvpActivity = async (activityId: string, status: 'GOING' | 'MAYBE' | 'DECLINED') => {
    await fetch(`/api/v1/family-section/${encodeURIComponent(familyId)}/activities/${encodeURIComponent(activityId)}/rsvp`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ status, memberId: callerMemberId }),
    });
    showToast(`RSVP updated to ${status}`);
    await fetchFamilySection();
  };

  const handleUpdateActivityStatus = async (activityId: string, status: string) => {
    await fetch(`/api/v1/family-section/${encodeURIComponent(familyId)}/activities/${encodeURIComponent(activityId)}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ status }),
    });
    showToast(`Activity marked ${status}`);
    await fetchFamilySection();
  };

  // ============================================================================
  // HANDLERS — FAMILY RULES & PRINCIPLES
  // ============================================================================
  const openRuleModal = (rule?: any) => {
    if (rule) {
      setEditingRule(rule);
      setRuleForm({
        title: rule.title || '',
        category: rule.category || 'Household Conduct',
        principleStatement: rule.principleStatement || '',
        expectationsText: Array.isArray(rule.practicalExpectations) ? rule.practicalExpectations.join('\n') : '',
        appliesTo: rule.appliesTo || 'All Family Members',
      });
    } else {
      setEditingRule(null);
      setRuleForm({
        title: '',
        category: 'Household Conduct',
        principleStatement: '',
        expectationsText: '',
        appliesTo: 'All Family Members',
      });
    }
    setShowRuleModal(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleForm.title.trim()) return;
    setIsSubmitting(true);
    try {
      const url = editingRule
        ? `/api/v1/family-section/${encodeURIComponent(familyId)}/rules/${encodeURIComponent(editingRule.id)}`
        : `/api/v1/family-section/${encodeURIComponent(familyId)}/rules`;
      const method = editingRule ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify({
          title: ruleForm.title.trim(),
          category: ruleForm.category,
          principleStatement: ruleForm.principleStatement.trim(),
          practicalExpectations: ruleForm.expectationsText
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
          appliesTo: ruleForm.appliesTo.trim(),
        }),
      });
      if (res.ok) {
        showToast(editingRule ? 'Family rule updated!' : 'New family rule & principle added!');
        setShowRuleModal(false);
        await fetchFamilySection();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.message || 'Permission denied');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcknowledgeRule = async (ruleId: string) => {
    const res = await fetch(`/api/v1/family-section/${encodeURIComponent(familyId)}/rules/${encodeURIComponent(ruleId)}/acknowledge`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (res.ok) {
      showToast('Acknowledged family principle!');
      await fetchFamilySection();
    }
  };

  const handleToggleArchiveRule = async (rule: any) => {
    const nextStatus = rule.status === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED';
    await fetch(`/api/v1/family-section/${encodeURIComponent(familyId)}/rules/${encodeURIComponent(rule.id)}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ status: nextStatus }),
    });
    showToast(nextStatus === 'ARCHIVED' ? 'Rule archived.' : 'Rule restored.');
    await fetchFamilySection();
  };

  const albums = sectionData?.albums || [];
  const allPhotos = sectionData?.photos || [];
  const filteredPhotos = allPhotos.filter((p: any) => {
    if (selectedAlbumId !== 'ALL' && p.albumId !== selectedAlbumId) return false;
    if (favoritesOnly && !p.isFavorite) return false;
    return true;
  });
  const constitution = sectionData?.currentConstitution || null;
  const constitutionHistory = sectionData?.constitutionHistory || [];
  const allTraditions = sectionData?.traditions || [];
  const filteredTraditions = allTraditions.filter((t: any) => {
    if (!showArchivedTraditions && t.status === 'ARCHIVED') return false;
    if (traditionCategoryFilter !== 'ALL' && t.category !== traditionCategoryFilter) return false;
    return true;
  });
  const allActivities = sectionData?.sharedActivities || [];
  const filteredActivities = allActivities.filter((a: any) => {
    if (activityStatusFilter !== 'ALL' && a.status !== activityStatusFilter) return false;
    return true;
  });
  const allRules = sectionData?.rules || [];
  const extendedRelatives = sectionData?.extendedRelatives || [];
  const filteredRules = allRules.filter((r: any) => {
    if (!showArchivedRules && r.status === 'ARCHIVED') return false;
    if (ruleCategoryFilter !== 'ALL' && r.category !== ruleCategoryFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6 pb-16" data-testid="family-section-experience">
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#173D35] text-[#F7F4EC] px-5 py-3 rounded-2xl shadow-xl border border-[#C39A60]/40 flex items-center gap-3">
          <Sparkles className="w-4 h-4 text-[#C39A60]" />
          <span className="text-xs font-semibold">{toastMessage}</span>
          <button onClick={() => setToastMessage(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Sub-Navigation Bar for the 6 Canonical Family Section Destinations */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-2 shadow-xs flex flex-wrap items-center gap-1.5">
        {FAMILY_SECTION_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = resolvedFamilySubPage === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              data-testid={`family-subnav-${tab.id}`}
              onClick={() => selectFamilySubPage(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                active
                  ? 'bg-[#173D35] text-[#F7F4EC] shadow-xs'
                  : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${active ? 'text-[#E7D1AA]' : 'text-stone-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* =====================================================================
          DESTINATION 1: FAMILY HOME OVERVIEW (home_overview)
         ===================================================================== */}
      {resolvedFamilySubPage === 'home_overview' && (
        <div className="space-y-6" data-testid="family-destination-overview">
          {/* Family Identity Banner */}
          <div className="rounded-3xl bg-gradient-to-br from-[#173D35] via-[#1E4E44] to-[#0E2822] text-[#F7F4EC] p-6 lg:p-8 shadow-md">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex items-start sm:items-center gap-5">
                <div className="w-20 h-20 rounded-3xl bg-[#C39A60]/20 border-2 border-[#C39A60] flex items-center justify-center overflow-hidden shrink-0">
                  {ws.logoUrl ? (
                    <img src={ws.logoUrl} alt={ws.name} className="w-full h-full object-cover" />
                  ) : (
                    <Users className="w-9 h-9 text-[#C39A60]" />
                  )}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="text-2xl lg:text-3xl font-serif font-bold text-white">{ws.name}</h1>
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#C39A60]/20 border border-[#C39A60]/50 text-[#E7D1AA] font-semibold uppercase tracking-wider">
                      Canonical Family Identity
                    </span>
                  </div>
                  <p className="italic text-[#E7D1AA] mt-1 text-sm font-serif">
                    “{ws.motto || 'Together in Stewardship, Kindness, and Purpose'}”
                  </p>
                  <p className="text-xs text-emerald-100/80 mt-1 max-w-2xl">
                    {ws.description || ws.mission || 'A shared multi-generational family environment anchored by trust, shared traditions, and mutual care.'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {canManage && (
                  <>
                    <button
                      type="button"
                      onClick={openEditIdentity}
                      className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/15 flex items-center gap-1.5"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-[#E7D1AA]" />
                      <span>Edit Identity</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddMemberModal(true)}
                      className="px-3.5 py-2 rounded-xl bg-white text-[#173D35] hover:bg-stone-100 text-xs font-bold flex items-center gap-1.5"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Add Member</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowInviteModal(true)}
                      className="px-3.5 py-2 rounded-xl bg-[#C39A60] hover:bg-[#B38950] text-stone-950 text-xs font-bold flex items-center gap-1.5"
                    >
                      <LinkIcon className="w-3.5 h-3.5" />
                      <span>Invite Adult / Member</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Key Identity & Membership Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mt-6 pt-6 border-t border-white/10">
              <div className="p-3.5 rounded-2xl bg-black/20 border border-white/10">
                <div className="text-[11px] uppercase tracking-wider text-emerald-200/80">Family Members</div>
                <div className="text-xl font-bold text-white mt-0.5 font-mono tabular-nums">{members.length} Profiles</div>
                <div className="text-[11px] text-[#E7D1AA] mt-0.5">
                  {members.filter((m) => m.role === 'CHILD').length} Youth · {members.filter((m) => m.role !== 'CHILD').length} Adults
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-black/20 border border-white/10">
                <div className="text-[11px] uppercase tracking-wider text-emerald-200/80">Extended Heritage Map</div>
                <div className="text-xl font-bold text-white mt-0.5 font-mono tabular-nums">
                  {extendedRelatives.length} Relatives
                </div>
                <button
                  type="button"
                  onClick={() => setOverviewSubView('HERITAGE_MAP')}
                  className="text-[11px] text-[#E7D1AA] mt-0.5 hover:underline"
                >
                  Father’s & Mother’s Map →
                </button>
              </div>
              <div className="p-3.5 rounded-2xl bg-black/20 border border-white/10">
                <div className="text-[11px] uppercase tracking-wider text-emerald-200/80">Family Traditions</div>
                <div className="text-xl font-bold text-white mt-0.5 font-mono tabular-nums">{allTraditions.length} Traditions</div>
                <button
                  type="button"
                  onClick={() => selectFamilySubPage('people_traditions')}
                  className="text-[11px] text-[#E7D1AA] mt-0.5 hover:underline"
                >
                  Explore Culture →
                </button>
              </div>
              <div className="p-3.5 rounded-2xl bg-black/20 border border-white/10">
                <div className="text-[11px] uppercase tracking-wider text-emerald-200/80">Shared Gallery</div>
                <div className="text-xl font-bold text-white mt-0.5 font-mono tabular-nums">
                  {allPhotos.length} Photos · {albums.length} Albums
                </div>
                <button
                  type="button"
                  onClick={() => selectFamilySubPage('people_gallery')}
                  className="text-[11px] text-[#E7D1AA] mt-0.5 hover:underline"
                >
                  Open Family Gallery →
                </button>
              </div>
            </div>
          </div>

          {/* Segmented Workspace Switcher inside Family Home Overview */}
          <div className="bg-white rounded-2xl border border-stone-200 p-2 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                data-testid="overview-subtab-all"
                onClick={() => setOverviewSubView('ALL')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  overviewSubView === 'ALL'
                    ? 'bg-[#173D35] text-[#F7F4EC]'
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                }`}
              >
                Complete Overview & Heritage Map
              </button>
              <button
                type="button"
                data-testid="overview-subtab-heritage-map"
                onClick={() => setOverviewSubView('HERITAGE_MAP')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  overviewSubView === 'HERITAGE_MAP'
                    ? 'bg-[#173D35] text-[#F7F4EC]'
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                }`}
              >
                <GitBranch className="w-3.5 h-3.5 text-[#C39A60]" />
                <span>Extended Family Heritage Map ({extendedRelatives.length})</span>
              </button>
              <button
                type="button"
                data-testid="overview-subtab-directory"
                onClick={() => setOverviewSubView('DIRECTORY')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  overviewSubView === 'DIRECTORY'
                    ? 'bg-[#173D35] text-[#F7F4EC]'
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                }`}
              >
                Core Household Directory ({members.length})
              </button>
            </div>
            <div className="text-xs text-stone-500 px-2">
              Recognize faces, ages, professions, cities, and growth areas across Father’s & Mother’s lineages
            </div>
          </div>

          {/* Extended Family Heritage Map Workspace (Dual-Lineage Tree + Geographic Where-They-Live Map) */}
          {(overviewSubView === 'ALL' || overviewSubView === 'HERITAGE_MAP') && (
            <ExtendedFamilyHeritageMap
              familyId={familyId}
              familyName={ws.name || 'Our Family'}
              callerRole={callerRole}
              canManage={canManage}
              coreMembers={members}
              extendedRelatives={extendedRelatives}
              getHeaders={getHeaders}
              onRefreshSection={fetchFamilySection}
              showToast={showToast}
            />
          )}

          {/* Member Directory Section */}
          {(overviewSubView === 'ALL' || overviewSubView === 'DIRECTORY') && (
          <>
          <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-serif font-bold text-stone-900">Family Member Directory & Roles</h2>
                <p className="text-xs text-stone-500">
                  Adult accounts and non-login child/relative profiles belonging to {ws.name}.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search members..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 rounded-xl bg-stone-50 border border-stone-200 text-xs"
                  />
                </div>
                <select
                  value={selectedRoleFilter}
                  onChange={(e) => setSelectedRoleFilter(e.target.value)}
                  className="px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium"
                >
                  <option value="ALL">All Roles</option>
                  <option value="OWNER">Owner</option>
                  <option value="ADMIN">Admin</option>
                  <option value="MEMBER">Member</option>
                  <option value="CHILD">Child</option>
                  <option value="GUEST">Guest</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMembers.map((m) => (
                <div
                  key={m.id}
                  className="rounded-2xl border border-stone-200/90 p-4 bg-stone-50/50 hover:bg-white transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-[#173D35] text-[#F7F4EC] font-serif font-bold text-sm flex items-center justify-center overflow-hidden">
                          {m.avatarUrl ? (
                            <img src={m.avatarUrl} alt={m.displayName} className="w-full h-full object-cover" />
                          ) : (
                            m.displayName?.slice(0, 2).toUpperCase()
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-stone-900">{m.displayName}</div>
                          <div className="text-xs text-stone-500 capitalize">
                            {m.relationshipToPrimary || 'Member'} {m.birthDate ? `• Born ${m.birthDate}` : ''}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-950/10 text-emerald-950 uppercase">
                        {m.role}
                      </span>
                    </div>

                    <div className="mt-3 text-xs text-stone-600 space-y-1">
                      {m.userAccountId ? (
                        <div className="text-emerald-800 font-medium flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Connected Account ({m.userAccountId})</span>
                        </div>
                      ) : (
                        <div className="text-stone-500 flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          <span>Member Profile (No login required)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-stone-200/60">
                    <button
                      type="button"
                      onClick={() => setDetailMember(m)}
                      className="flex-1 py-1.5 rounded-xl bg-white border border-stone-200 text-xs font-semibold text-stone-800 hover:bg-stone-100"
                    >
                      Profile Details
                    </button>
                    {canManage && !m.userAccountId && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowConnectAccountModal(m);
                          setConnectAccountForm({
                            userAccountId: '',
                            email: '',
                            displayName: m.displayName,
                            role: m.role,
                          });
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-amber-100/80 text-amber-900 text-xs font-semibold hover:bg-amber-200/80"
                        title="Connect Login Account"
                      >
                        Connect Account
                      </button>
                    )}
                    {canManage && m.role !== 'OWNER' && (
                      <button
                        type="button"
                        onClick={() => void handleRemoveMember(m.id, m.displayName)}
                        className="p-1.5 text-stone-400 hover:text-rose-600"
                        title="Remove member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Relationship Tree, Announcements & Invitations Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Family Relationship Tree & Upcoming Birthdays */}
            <div className="bg-white rounded-3xl border border-stone-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-emerald-800" />
                  <span>Family Relationship Bonds ({relationships.length})</span>
                </h3>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setShowAddRelationshipModal(true)}
                    className="text-xs font-semibold text-emerald-800 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Link</span>
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {relationships.slice(0, 5).map((rel: any) => {
                  const p1 = members.find((m) => m.id === (rel.person1MemberId || rel.member1Id));
                  const p2 = members.find((m) => m.id === (rel.person2MemberId || rel.member2Id));
                  return (
                    <div key={rel.id} className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/70 flex items-center justify-between text-xs">
                      <span className="font-semibold text-stone-900">{p1?.displayName || 'Member'}</span>
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold">
                        {rel.relationshipType?.replace('_', ' ')}
                      </span>
                      <span className="font-semibold text-stone-900">{p2?.displayName || 'Member'}</span>
                    </div>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-stone-100">
                <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
                  Birthdays & Anniversaries
                </div>
                <div className="space-y-1.5">
                  {upcomingBirthdays.slice(0, 4).map(({ member, date, daysRemaining }) => (
                    <div key={member.id} className="flex justify-between text-xs p-2 rounded-lg bg-rose-50/60 text-stone-800">
                      <span className="font-semibold">{member.displayName} ({date})</span>
                      <span className="text-rose-700 font-bold">
                        {daysRemaining === 0 ? 'Today!' : `In ${daysRemaining}d`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Family Announcements */}
            <div className="bg-white rounded-3xl border border-stone-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-emerald-800" />
                  <span>Family Announcements</span>
                </h3>
                {callerRole !== 'GUEST' && (
                  <button
                    type="button"
                    onClick={() => setShowAnnouncementModal(true)}
                    className="text-xs font-semibold text-emerald-800 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Post</span>
                  </button>
                )}
              </div>
              <div className="space-y-2.5">
                {(ws.announcements || []).slice(0, 4).map((ann: any) => (
                  <div key={ann.id} className="p-3 rounded-xl bg-stone-50 border border-stone-200/70">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-stone-900">{ann.title}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">
                        {ann.priority || 'NORMAL'}
                      </span>
                    </div>
                    <p className="text-xs text-stone-600 mt-1">{ann.body}</p>
                    <div className="text-[10px] text-stone-400 mt-1">Posted by {ann.authorName || 'Family'}</div>
                  </div>
                ))}
                {(ws.announcements || []).length === 0 && (
                  <p className="text-xs text-stone-500">No announcements posted yet.</p>
                )}
              </div>
            </div>

            {/* Permission-Gated Invitations Panel */}
            <div className="bg-white rounded-3xl border border-stone-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-emerald-800" />
                  <span>Family Invitations ({invitations.length})</span>
                </h3>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(true)}
                    className="text-xs font-semibold text-emerald-800 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Invite</span>
                  </button>
                )}
              </div>
              <div className="space-y-2.5">
                {invitations.slice(0, 4).map((inv: any) => (
                  <div key={inv.id} className="p-3 rounded-xl bg-stone-50 border border-stone-200/70 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-stone-900">
                        {inv.invitedDisplayName || inv.invitedEmail || 'Family Invite'}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                        {inv.status}
                      </span>
                    </div>
                    {inv.invitationToken && (
                      <div className="flex items-center justify-between gap-2 bg-white px-2.5 py-1 rounded border border-stone-200">
                        <code className="text-[10px] font-mono truncate">{inv.invitationToken}</code>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(inv.invitationToken);
                            showToast('Invite token copied!');
                          }}
                          className="text-emerald-800 font-semibold shrink-0"
                        >
                          Copy
                        </button>
                      </div>
                    )}
                    {canManage && inv.status === 'PENDING' && (
                      <button
                        type="button"
                        onClick={() => void handleRevokeInvite(inv.id)}
                        className="text-[11px] text-rose-700 font-semibold hover:underline"
                      >
                        Revoke Invitation
                      </button>
                    )}
                  </div>
                ))}
                {invitations.length === 0 && (
                  <p className="text-xs text-stone-500">No pending or historical invitations.</p>
                )}
              </div>
            </div>
          </div>
          </>
          )}
        </div>
      )}

      {/* =====================================================================
          DESTINATION 2: FAMILY GALLERY (people_gallery)
         ===================================================================== */}
      {resolvedFamilySubPage === 'people_gallery' && (
        <div className="space-y-6" data-testid="family-destination-gallery">
          <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Family — Shared Visual Heritage
                </span>
                <h1 className="text-2xl font-serif font-bold text-stone-900 mt-0.5">
                  Family Photo Gallery & Albums
                </h1>
                <p className="text-xs text-stone-500 mt-0.5">
                  Persistent family albums, milestone memories, member tagging, favorites, and visibility controls.
                </p>
              </div>
              {callerRole !== 'GUEST' && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAlbumModal(true)}
                    className="px-3.5 py-2 rounded-xl border border-stone-200 hover:bg-stone-50 text-xs font-semibold text-stone-800 flex items-center gap-1.5"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>New Album</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPhotoModal(true)}
                    className="px-4 py-2 rounded-xl bg-[#173D35] text-white text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Photo Memory</span>
                  </button>
                </div>
              )}
            </div>

            {/* Albums Filter Strip */}
            <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setSelectedAlbumId('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  selectedAlbumId === 'ALL'
                    ? 'bg-[#173D35] text-white'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                All Photos ({allPhotos.length})
              </button>
              {albums.map((alb: any) => (
                <button
                  key={alb.id}
                  type="button"
                  onClick={() => setSelectedAlbumId(alb.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    selectedAlbumId === alb.id
                      ? 'bg-[#173D35] text-white'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  {alb.title}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setFavoritesOnly(!favoritesOnly)}
                className={`ml-auto px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border ${
                  favoritesOnly
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : 'border-stone-200 text-stone-600'
                }`}
              >
                <Star className={`w-3.5 h-3.5 ${favoritesOnly ? 'fill-amber-500 text-amber-500' : ''}`} />
                <span>Favorites Only</span>
              </button>
            </div>
          </div>

          {/* Photo Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPhotos.map((photo: any) => (
              <div
                key={photo.id}
                className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="aspect-16/10 bg-stone-900 relative overflow-hidden">
                    <img
                      src={photo.imageUrl}
                      alt={photo.title}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => void handleToggleFavoritePhoto(photo)}
                      className="absolute top-3 right-3 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white"
                      title="Toggle Favorite"
                    >
                      <Star
                        className={`w-4 h-4 ${
                          photo.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-white'
                        }`}
                      />
                    </button>
                    {photo.eventName && (
                      <span className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg bg-black/60 text-white text-[11px] font-semibold">
                        {photo.eventName}
                      </span>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-stone-900">{photo.title}</h3>
                      <span className="text-[11px] text-stone-500 shrink-0">{photo.takenDate}</span>
                    </div>
                    {photo.caption && (
                      <p className="text-xs text-stone-600 mt-1.5 leading-relaxed">{photo.caption}</p>
                    )}
                    {Array.isArray(photo.taggedMemberNames) && photo.taggedMemberNames.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {photo.taggedMemberNames.map((name: string, idx: number) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[10px] font-semibold"
                          >
                            @{name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="px-5 py-3 bg-stone-50 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500">
                  <span>By {photo.uploadedByName || 'Family Member'} • {photo.visibility || 'FAMILY'}</span>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => void handleDeletePhoto(photo.id)}
                      className="text-rose-600 hover:underline font-semibold"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =====================================================================
          DESTINATION 3: FAMILY CONSTITUTION (home_constitution)
         ===================================================================== */}
      {resolvedFamilySubPage === 'home_constitution' && (
        <div className="space-y-6" data-testid="family-destination-constitution">
          <div className="bg-white rounded-3xl border border-stone-200 p-6 lg:p-8 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-stone-200">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800">
                  <ScrollText className="w-4 h-4" />
                  <span>Foundational Family Charter • Version {constitution?.versionNumber || 1}</span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-serif font-bold text-stone-900 mt-1">
                  The {ws.name} Constitution
                </h1>
                <p className="text-xs text-stone-500 mt-1">
                  Last revised by {constitution?.editedByName || 'Family Founder'} •{' '}
                  {constitution?.updatedAt ? new Date(constitution.updatedAt).toLocaleDateString() : 'Active'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleAcknowledgeConstitution()}
                  className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-100"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Review & Acknowledge Charter</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenPrintDoc ? onOpenPrintDoc('FAMILY_CONSTITUTION') : window.print()}
                  className="p-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-[#C39A60] transition-colors cursor-pointer shadow-2xs"
                  title="Print Family Constitution"
                  aria-label="Print Family Constitution"
                >
                  <Printer className="w-4 h-4 text-[#C39A60]" />
                </button>
                {canManage && (
                  <button
                    type="button"
                    onClick={openEditConstitution}
                    className="px-4 py-2 rounded-xl bg-[#173D35] text-white text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Revise Constitution</span>
                  </button>
                )}
              </div>
            </div>

            {/* Motto & Mission */}
            <div className="mt-6 p-6 rounded-2xl bg-[#F7F4EC] border border-[#C39A60]/30 text-center">
              <div className="text-xs font-bold uppercase tracking-widest text-[#8C6A30]">Family Motto</div>
              <div className="text-xl lg:text-2xl font-serif italic font-bold text-[#173D35] mt-1">
                “{constitution?.motto || ws.motto || 'Together in Stewardship, Kindness, and Purpose'}”
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200/80">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-900">Our Family Mission</h3>
                <p className="text-sm text-stone-800 mt-2 leading-relaxed font-serif">
                  {constitution?.missionStatement || ws.mission}
                </p>
              </div>
              <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200/80">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-900">Our Multi-Generational Vision</h3>
                <p className="text-sm text-stone-800 mt-2 leading-relaxed font-serif">
                  {constitution?.visionStatement || ws.vision}
                </p>
              </div>
            </div>

            {/* Core Values */}
            <div className="mt-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">
                Core Family Values & Pillars
              </h3>
              <div className="flex flex-wrap gap-2.5">
                {(constitution?.coreValues || ws.values || []).map((val: string, idx: number) => (
                  <span
                    key={idx}
                    className="px-3.5 py-2 rounded-xl bg-[#173D35] text-[#F7F4EC] text-xs font-semibold flex items-center gap-2"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#E7D1AA]" />
                    <span>{val}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Identity, Aspirations, Commitments & Legacy */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              <div className="p-5 rounded-2xl border border-stone-200 space-y-2">
                <h3 className="text-sm font-bold text-stone-900">Shared Family Aspirations</h3>
                <ul className="space-y-1.5 text-xs text-stone-700 list-disc pl-4">
                  {(constitution?.sharedAspirations || []).map((item: string, idx: number) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="p-5 rounded-2xl border border-stone-200 space-y-2">
                <h3 className="text-sm font-bold text-stone-900">Member Covenants & Commitments</h3>
                <ul className="space-y-1.5 text-xs text-stone-700 list-disc pl-4">
                  {(constitution?.memberCommitments || []).map((item: string, idx: number) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            {constitution?.legacyStatement && (
              <div className="mt-6 p-5 rounded-2xl bg-stone-900 text-stone-100">
                <div className="text-xs font-bold uppercase tracking-wider text-[#E7D1AA]">
                  Family Legacy & Stewardship Statement
                </div>
                <p className="text-xs text-stone-200 mt-1.5 leading-relaxed">{constitution.legacyStatement}</p>
              </div>
            )}

            {/* Member Acknowledgments & Version History */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6 pt-6 border-t border-stone-200">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2.5">
                  Member Charter Acknowledgments ({(constitution?.acknowledgments || []).length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {(constitution?.acknowledgments || []).map((ack: any, i: number) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                      <span>{ack.displayName} (v{ack.versionNumber || 1})</span>
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2.5">
                  Constitution Version History ({constitutionHistory.length})
                </h4>
                <div className="space-y-1.5">
                  {constitutionHistory.slice(0, 4).map((ver: any) => (
                    <div key={ver.id} className="text-xs flex justify-between p-2 rounded-lg bg-stone-50">
                      <span className="font-semibold text-stone-800">
                        Version {ver.versionNumber} — Edited by {ver.editedByName}
                      </span>
                      <span className="text-stone-500">
                        {ver.updatedAt ? new Date(ver.updatedAt).toLocaleDateString() : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          DESTINATION 4: FAMILY TRADITIONS & CULTURE (people_traditions)
         ===================================================================== */}
      {resolvedFamilySubPage === 'people_traditions' && (
        <div className="space-y-6" data-testid="family-destination-traditions">
          <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Family — Living Heritage & Rituals
                </span>
                <h1 className="text-2xl font-serif font-bold text-stone-900 mt-0.5">
                  Family Traditions & Culture
                </h1>
                <p className="text-xs text-stone-500 mt-0.5">
                  Annual traditions, seasonal celebrations, special family meals, cultural stories, and recurring rituals.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowArchivedTraditions(!showArchivedTraditions)}
                  className="px-3 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-700"
                >
                  {showArchivedTraditions ? 'Hide Archived' : 'Show Archived'}
                </button>
                {callerRole !== 'GUEST' && (
                  <button
                    type="button"
                    onClick={() => openCreateTradition()}
                    className="px-4 py-2 rounded-xl bg-[#173D35] text-white text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Family Tradition</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredTraditions.map((trad: any) => (
              <div
                key={trad.id}
                className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900">
                        {trad.category}
                      </span>
                      <h3 className="text-lg font-serif font-bold text-stone-900 mt-1.5">{trad.title}</h3>
                    </div>
                    <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg">
                      {trad.frequency}
                    </span>
                  </div>

                  <p className="text-xs text-stone-700 mt-3 leading-relaxed">{trad.meaningAndOrigin}</p>

                  <div className="grid grid-cols-2 gap-3 mt-4 p-3 rounded-2xl bg-stone-50 border border-stone-200/60 text-xs">
                    <div>
                      <div className="text-[10px] uppercase text-stone-400 font-bold">Next Planned Celebration</div>
                      <div className="font-semibold text-stone-800 mt-0.5">{trad.nextPlannedDate || 'Recurring'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-stone-400 font-bold">Linked Meal / Recipe</div>
                      <div className="font-semibold text-stone-800 mt-0.5">{trad.linkedRecipeTitle || 'Family Table'}</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-stone-100 text-xs">
                  <span className="text-stone-500">
                    Stewards: {(trad.responsibleMemberNames || []).join(', ') || 'All Family'}
                  </span>
                  {callerRole !== 'GUEST' && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openCreateTradition(trad)}
                        className="text-emerald-800 font-semibold hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleToggleArchiveTradition(trad)}
                        className="text-stone-500 hover:text-stone-800 font-semibold"
                      >
                        {trad.status === 'ARCHIVED' ? 'Restore' : 'Archive'}
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
          DESTINATION 5: SHARED ACTIVITIES (people_activities)
         ===================================================================== */}
      {resolvedFamilySubPage === 'people_activities' && (
        <div className="space-y-6" data-testid="family-destination-activities">
          <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Family — Shared Experiences & Two-Way Calendar Sync
                </span>
                <h1 className="text-2xl font-serif font-bold text-stone-900 mt-0.5">
                  Shared Family Activities
                </h1>
                <p className="text-xs text-stone-500 mt-0.5">
                  Plan family game nights, outings, service projects, and celebrations — automatically synced with the Master Family Calendar.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onNavigateTab('calendar_routines', 'cal_schedule')}
                  className="px-3.5 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-800 hover:bg-stone-50 flex items-center gap-1.5"
                >
                  <Calendar className="w-3.5 h-3.5 text-emerald-800" />
                  <span>View in Master Calendar</span>
                </button>
                {callerRole !== 'GUEST' && (
                  <button
                    type="button"
                    onClick={() => setShowActivityModal(true)}
                    className="px-4 py-2 rounded-xl bg-[#173D35] text-white text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Schedule Shared Activity</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-stone-100">
              {['ALL', 'PLANNED', 'COMPLETED', 'CANCELLED'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setActivityStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${
                    activityStatusFilter === st
                      ? 'bg-[#173D35] text-white'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  {st === 'ALL' ? 'All Activities' : st}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredActivities.map((act: any) => (
              <div
                key={act.id}
                className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900">
                        {act.category} • {act.status}
                      </span>
                      <h3 className="text-lg font-serif font-bold text-stone-900 mt-1.5">{act.title}</h3>
                    </div>
                    <span className="text-xs font-bold text-stone-700 bg-stone-100 px-2.5 py-1 rounded-lg">
                      {act.dateIso} • {act.startTime}
                    </span>
                  </div>

                  <p className="text-xs text-stone-600 mt-2">{act.description}</p>

                  <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-stone-600">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-800" />
                      {act.location}
                    </span>
                    {act.budgetCents !== undefined && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-800" />
                        Est. Budget: ${(Number(act.budgetCents || 0) / 100).toFixed(2)}
                      </span>
                    )}
                    {act.linkedCalendarEventId && (
                      <span className="text-[11px] text-emerald-800 font-semibold">
                        ✓ Calendar Synced
                      </span>
                    )}
                  </div>

                  {/* Preparation Checklist */}
                  {Array.isArray(act.preparationChecklist) && act.preparationChecklist.length > 0 && (
                    <div className="mt-4 p-3 rounded-2xl bg-stone-50 border border-stone-200/70 space-y-1.5">
                      <div className="text-[10px] font-bold uppercase text-stone-500">Preparation Checklist</div>
                      {act.preparationChecklist.map((chk: any) => (
                        <div key={chk.id} className="flex items-center gap-2 text-xs text-stone-700">
                          <CheckCircle2 className={`w-3.5 h-3.5 ${chk.completed ? 'text-emerald-700' : 'text-stone-400'}`} />
                          <span className={chk.completed ? 'line-through text-stone-400' : ''}>{chk.text}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* RSVPs */}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {(act.rsvps || []).map((r: any, idx: number) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-700 text-[11px] font-medium"
                      >
                        {r.displayName}: <strong>{r.status}</strong>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void handleRsvpActivity(act.id, 'GOING')}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-900 text-xs font-semibold hover:bg-emerald-100"
                    >
                      RSVP Going
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRsvpActivity(act.id, 'MAYBE')}
                      className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-700 text-xs font-semibold hover:bg-stone-200"
                    >
                      Maybe
                    </button>
                  </div>

                  {callerRole !== 'GUEST' && act.status === 'PLANNED' && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleUpdateActivityStatus(act.id, 'COMPLETED')}
                        className="text-xs font-semibold text-emerald-800 hover:underline"
                      >
                        Mark Completed
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleUpdateActivityStatus(act.id, 'CANCELLED')}
                        className="text-xs font-semibold text-rose-700 hover:underline"
                      >
                        Cancel
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
          DESTINATION 6: FAMILY RULES & PRINCIPLES (people_rules)
         ===================================================================== */}
      {resolvedFamilySubPage === 'people_rules' && (
        <div className="space-y-6" data-testid="family-destination-rules">
          <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Family — Constructive Household Principles & Expectations
                </span>
                <h1 className="text-2xl font-serif font-bold text-stone-900 mt-0.5">
                  Family Rules & Principles
                </h1>
                <p className="text-xs text-stone-500 mt-0.5">
                  Clear, respectful agreements for shared spaces, digital devices, household conduct, and mutual respect.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowArchivedRules(!showArchivedRules)}
                  className="px-3 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-700"
                >
                  {showArchivedRules ? 'Hide Archived' : 'Show Archived'}
                </button>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => openRuleModal()}
                    className="px-4 py-2 rounded-xl bg-[#173D35] text-white text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Family Principle</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredRules.map((rule: any) => (
              <div
                key={rule.id}
                className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900">
                        {rule.category}
                      </span>
                      <h3 className="text-lg font-serif font-bold text-stone-900 mt-1.5">{rule.title}</h3>
                    </div>
                    <span className="text-[11px] text-stone-500">Rev. {rule.revisionDate}</span>
                  </div>

                  <p className="text-xs text-stone-700 mt-2.5 leading-relaxed font-medium">
                    {rule.principleStatement}
                  </p>

                  {Array.isArray(rule.practicalExpectations) && rule.practicalExpectations.length > 0 && (
                    <ul className="mt-3 space-y-1.5 text-xs text-stone-600 list-disc pl-4 bg-stone-50 p-3.5 rounded-2xl border border-stone-200/60">
                      {rule.practicalExpectations.map((exp: string, idx: number) => (
                        <li key={idx}>{exp}</li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {(rule.acknowledgments || []).map((ack: any, i: number) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-[10px] font-semibold"
                      >
                        ✓ {ack.displayName}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => void handleAcknowledgeRule(rule.id)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-900 font-semibold hover:bg-emerald-100 flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Acknowledge Principle</span>
                  </button>
                  {canManage && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openRuleModal(rule)}
                        className="text-emerald-800 font-semibold hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleToggleArchiveRule(rule)}
                        className="text-stone-500 hover:text-stone-800 font-semibold"
                      >
                        {rule.status === 'ARCHIVED' ? 'Restore' : 'Archive'}
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
          MODALS FOR OVERVIEW, GALLERY, CONSTITUTION, TRADITIONS, ACTIVITIES, RULES
         ===================================================================== */}

      {/* Edit Family Identity Modal */}
      {showEditIdentityModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-900">Edit Family Identity & Motto</h3>
              <button onClick={() => setShowEditIdentityModal(false)}>
                <X className="w-4 h-4 text-stone-400" />
              </button>
            </div>
            <form onSubmit={handleSaveIdentity} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Family Name</label>
                <input
                  type="text"
                  required
                  value={identityForm.name}
                  onChange={(e) => setIdentityForm({ ...identityForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Family Motto</label>
                <input
                  type="text"
                  value={identityForm.motto}
                  onChange={(e) => setIdentityForm({ ...identityForm, motto: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Family Introduction / Description</label>
                <textarea
                  rows={2}
                  value={identityForm.description}
                  onChange={(e) => setIdentityForm({ ...identityForm, description: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Core Values (comma-separated)</label>
                <input
                  type="text"
                  value={identityForm.valuesText}
                  onChange={(e) => setIdentityForm({ ...identityForm, valuesText: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditIdentityModal(false)}
                  className="px-4 py-2 rounded-xl border border-stone-200 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-[#173D35] text-white font-semibold"
                >
                  Save Identity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-900">Add Family Member Profile</h3>
              <button onClick={() => setShowAddMemberModal(false)}>
                <X className="w-4 h-4 text-stone-400" />
              </button>
            </div>
            <form onSubmit={handleAddMember} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Display Name *</label>
                <input
                  type="text"
                  required
                  value={memberForm.displayName}
                  onChange={(e) => setMemberForm({ ...memberForm, displayName: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Relationship</label>
                  <select
                    value={memberForm.relationshipToPrimary}
                    onChange={(e) => setMemberForm({ ...memberForm, relationshipToPrimary: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white"
                  >
                    <option value="SPOUSE">Spouse / Partner</option>
                    <option value="CHILD">Child</option>
                    <option value="PARENT">Parent</option>
                    <option value="GRANDPARENT">Grandparent</option>
                    <option value="SIBLING">Sibling</option>
                    <option value="OTHER">Relative</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Role</label>
                  <select
                    value={memberForm.role}
                    onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white"
                  >
                    <option value="MEMBER">Adult Member</option>
                    <option value="ADMIN">Co-Parent Admin</option>
                    <option value="CHILD">Child</option>
                    <option value="GUEST">Guest / Caregiver</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Birth Date</label>
                <input
                  type="date"
                  value={memberForm.birthDate}
                  onChange={(e) => setMemberForm({ ...memberForm, birthDate: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="px-4 py-2 rounded-xl border border-stone-200 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-[#173D35] text-white font-semibold"
                >
                  Save Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-900">Invite to {ws.name}</h3>
              <button onClick={() => setShowInviteModal(false)}>
                <X className="w-4 h-4 text-stone-400" />
              </button>
            </div>
            <form onSubmit={handleSendInvite} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Recipient Name</label>
                <input
                  type="text"
                  value={inviteForm.displayName}
                  onChange={(e) => setInviteForm({ ...inviteForm, displayName: e.target.value })}
                  placeholder="e.g. David Henderson"
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Email (optional for shareable link)</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  placeholder="member@example.com"
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Role</label>
                  <select
                    value={inviteForm.proposedRole}
                    onChange={(e) => setInviteForm({ ...inviteForm, proposedRole: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white"
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="MEMBER">Adult Member</option>
                    <option value="CHILD">Child</option>
                    <option value="GUEST">Guest</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Relationship</label>
                  <select
                    value={inviteForm.relationshipToPrimary}
                    onChange={(e) => setInviteForm({ ...inviteForm, relationshipToPrimary: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white"
                  >
                    <option value="SPOUSE">Spouse</option>
                    <option value="PARENT">Parent</option>
                    <option value="CHILD">Child</option>
                    <option value="SIBLING">Sibling</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 rounded-xl border border-stone-200 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-[#C39A60] text-stone-950 font-bold"
                >
                  Generate Invite Token
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Relationship Modal */}
      {showAddRelationshipModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-900">Link Family Relationship</h3>
              <button onClick={() => setShowAddRelationshipModal(false)}>
                <X className="w-4 h-4 text-stone-400" />
              </button>
            </div>
            <form onSubmit={handleAddRelationship} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">First Member</label>
                <select
                  required
                  value={relForm.person1MemberId}
                  onChange={(e) => setRelForm({ ...relForm, person1MemberId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white"
                >
                  <option value="">Select member...</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.displayName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Relationship Type</label>
                <select
                  value={relForm.relationshipType}
                  onChange={(e) => setRelForm({ ...relForm, relationshipType: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white"
                >
                  <option value="PARENT_CHILD">Parent → Child</option>
                  <option value="SPOUSE_PARTNER">Spouse / Partner</option>
                  <option value="SIBLING">Sibling</option>
                  <option value="GRANDPARENT_GRANDCHILD">Grandparent → Grandchild</option>
                  <option value="GUARDIAN_WARD">Guardian → Ward</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Second Member</label>
                <select
                  required
                  value={relForm.person2MemberId}
                  onChange={(e) => setRelForm({ ...relForm, person2MemberId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white"
                >
                  <option value="">Select member...</option>
                  {members.filter((m) => m.id !== relForm.person1MemberId).map((m) => (
                    <option key={m.id} value={m.id}>{m.displayName}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddRelationshipModal(false)}
                  className="px-4 py-2 rounded-xl border border-stone-200 font-semibold"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-[#173D35] text-white font-semibold">
                  Save Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Connect Account Modal */}
      {showConnectAccountModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-900">
                Connect Account to {showConnectAccountModal.displayName}
              </h3>
              <button onClick={() => setShowConnectAccountModal(null)}>
                <X className="w-4 h-4 text-stone-400" />
              </button>
            </div>
            <form onSubmit={handleConnectAccount} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Authenticated User Account ID *</label>
                <input
                  type="text"
                  required
                  value={connectAccountForm.userAccountId}
                  onChange={(e) => setConnectAccountForm({ ...connectAccountForm, userAccountId: e.target.value })}
                  placeholder="usr-..."
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Email</label>
                <input
                  type="email"
                  value={connectAccountForm.email}
                  onChange={(e) => setConnectAccountForm({ ...connectAccountForm, email: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConnectAccountModal(null)}
                  className="px-4 py-2 rounded-xl border border-stone-200 font-semibold"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-[#173D35] text-white font-semibold">
                  Connect Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Post Announcement Modal */}
      {showAnnouncementModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-900">Post Family Announcement</h3>
              <button onClick={() => setShowAnnouncementModal(false)}>
                <X className="w-4 h-4 text-stone-400" />
              </button>
            </div>
            <form onSubmit={handlePostAnnouncement} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={announcementForm.title}
                  onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Announcement Message *</label>
                <textarea
                  rows={3}
                  required
                  value={announcementForm.body}
                  onChange={(e) => setAnnouncementForm({ ...announcementForm, body: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAnnouncementModal(false)}
                  className="px-4 py-2 rounded-xl border border-stone-200 font-semibold"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-[#173D35] text-white font-semibold">
                  Post Announcement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Album Modal */}
      {showAlbumModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-900">Create Family Photo Album</h3>
              <button onClick={() => setShowAlbumModal(false)}>
                <X className="w-4 h-4 text-stone-400" />
              </button>
            </div>
            <form onSubmit={handleCreateAlbum} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Album Title *</label>
                <input
                  type="text"
                  required
                  value={albumForm.title}
                  onChange={(e) => setAlbumForm({ ...albumForm, title: e.target.value })}
                  placeholder="e.g. Summer Mountain Trip"
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={albumForm.description}
                  onChange={(e) => setAlbumForm({ ...albumForm, description: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAlbumModal(false)}
                  className="px-4 py-2 rounded-xl border border-stone-200 font-semibold"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-[#173D35] text-white font-semibold">
                  Create Album
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Photo Modal */}
      {showPhotoModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-900">Upload Family Photo Memory</h3>
              <button onClick={() => setShowPhotoModal(false)}>
                <X className="w-4 h-4 text-stone-400" />
              </button>
            </div>
            <form onSubmit={handleUploadPhoto} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Select Image File (PNG, JPEG, WEBP, GIF — Max 5 MB) *</label>
                <input
                  type="file"
                  required
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handlePhotoFileChange}
                  className="w-full text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Photo Title *</label>
                <input
                  type="text"
                  required
                  value={photoForm.title}
                  onChange={(e) => setPhotoForm({ ...photoForm, title: e.target.value })}
                  placeholder="e.g. Maya's Piano Recital"
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Album</label>
                  <select
                    value={photoForm.albumId}
                    onChange={(e) => setPhotoForm({ ...photoForm, albumId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white"
                  >
                    <option value="">General Gallery</option>
                    {albums.map((alb: any) => (
                      <option key={alb.id} value={alb.id}>{alb.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Visibility</label>
                  <select
                    value={photoForm.visibility}
                    onChange={(e) => setPhotoForm({ ...photoForm, visibility: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white"
                  >
                    <option value="FAMILY">All Family Members</option>
                    <option value="PARENTS_ONLY">Parents & Admins Only</option>
                    <option value="PRIVATE">Private to Me</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Caption / Story</label>
                <textarea
                  rows={2}
                  value={photoForm.caption}
                  onChange={(e) => setPhotoForm({ ...photoForm, caption: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPhotoModal(false)}
                  className="px-4 py-2 rounded-xl border border-stone-200 font-semibold"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-[#173D35] text-white font-semibold">
                  Save Photo to Gallery
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revise Constitution Modal */}
      {showConstitutionModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-900">Revise Family Constitution</h3>
              <button onClick={() => setShowConstitutionModal(false)}>
                <X className="w-4 h-4 text-stone-400" />
              </button>
            </div>
            <form onSubmit={handleSaveConstitution} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Family Motto</label>
                <input
                  type="text"
                  value={constitutionForm.motto}
                  onChange={(e) => setConstitutionForm({ ...constitutionForm, motto: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Mission Statement</label>
                <textarea
                  rows={2}
                  value={constitutionForm.missionStatement}
                  onChange={(e) => setConstitutionForm({ ...constitutionForm, missionStatement: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Vision Statement</label>
                <textarea
                  rows={2}
                  value={constitutionForm.visionStatement}
                  onChange={(e) => setConstitutionForm({ ...constitutionForm, visionStatement: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Core Values (comma-separated)</label>
                <input
                  type="text"
                  value={constitutionForm.coreValuesText}
                  onChange={(e) => setConstitutionForm({ ...constitutionForm, coreValuesText: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Legacy Statement</label>
                <textarea
                  rows={2}
                  value={constitutionForm.legacyStatement}
                  onChange={(e) => setConstitutionForm({ ...constitutionForm, legacyStatement: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConstitutionModal(false)}
                  className="px-4 py-2 rounded-xl border border-stone-200 font-semibold"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-[#173D35] text-white font-semibold">
                  Publish New Constitution Version
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tradition Modal */}
      {showTraditionModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-900">
                {editingTradition ? 'Edit Family Tradition' : 'Create Family Tradition'}
              </h3>
              <button onClick={() => setShowTraditionModal(false)}>
                <X className="w-4 h-4 text-stone-400" />
              </button>
            </div>
            <form onSubmit={handleSaveTradition} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Tradition Title *</label>
                <input
                  type="text"
                  required
                  value={traditionForm.title}
                  onChange={(e) => setTraditionForm({ ...traditionForm, title: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Category</label>
                  <select
                    value={traditionForm.category}
                    onChange={(e) => setTraditionForm({ ...traditionForm, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white"
                  >
                    <option value="Annual Tradition">Annual Tradition</option>
                    <option value="Seasonal Tradition">Seasonal Tradition</option>
                    <option value="Cultural Celebration">Cultural Celebration</option>
                    <option value="Holiday Custom">Holiday Custom</option>
                    <option value="Special Family Meal">Special Family Meal</option>
                    <option value="Family Ritual">Family Ritual</option>
                    <option value="Heritage Story">Heritage Story</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Frequency</label>
                  <input
                    type="text"
                    value={traditionForm.frequency}
                    onChange={(e) => setTraditionForm({ ...traditionForm, frequency: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Meaning & Origin Story</label>
                <textarea
                  rows={3}
                  value={traditionForm.meaningAndOrigin}
                  onChange={(e) => setTraditionForm({ ...traditionForm, meaningAndOrigin: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTraditionModal(false)}
                  className="px-4 py-2 rounded-xl border border-stone-200 font-semibold"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-[#173D35] text-white font-semibold">
                  Save Tradition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Shared Activity Modal */}
      {showActivityModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-900">Schedule Shared Family Activity</h3>
              <button onClick={() => setShowActivityModal(false)}>
                <X className="w-4 h-4 text-stone-400" />
              </button>
            </div>
            <form onSubmit={handleCreateActivity} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Activity Title *</label>
                <input
                  type="text"
                  required
                  value={activityForm.title}
                  onChange={(e) => setActivityForm({ ...activityForm, title: e.target.value })}
                  placeholder="e.g. Saturday Botanical Garden Picnic"
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={activityForm.dateIso}
                    onChange={(e) => setActivityForm({ ...activityForm, dateIso: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={activityForm.startTime}
                    onChange={(e) => setActivityForm({ ...activityForm, startTime: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Est. Budget ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={activityForm.budgetDollars}
                    onChange={(e) => setActivityForm({ ...activityForm, budgetDollars: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Location</label>
                <input
                  type="text"
                  value={activityForm.location}
                  onChange={(e) => setActivityForm({ ...activityForm, location: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={activityForm.description}
                  onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowActivityModal(false)}
                  className="px-4 py-2 rounded-xl border border-stone-200 font-semibold"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-[#173D35] text-white font-semibold">
                  Schedule & Sync to Calendar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Family Rule Modal */}
      {showRuleModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-900">
                {editingRule ? 'Edit Family Principle' : 'Add Family Rule & Principle'}
              </h3>
              <button onClick={() => setShowRuleModal(false)}>
                <X className="w-4 h-4 text-stone-400" />
              </button>
            </div>
            <form onSubmit={handleSaveRule} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Principle Title *</label>
                <input
                  type="text"
                  required
                  value={ruleForm.title}
                  onChange={(e) => setRuleForm({ ...ruleForm, title: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Category</label>
                <select
                  value={ruleForm.category}
                  onChange={(e) => setRuleForm({ ...ruleForm, category: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white"
                >
                  <option value="Household Conduct">Household Conduct</option>
                  <option value="Shared Spaces">Shared Spaces</option>
                  <option value="Digital & Devices">Digital & Devices</option>
                  <option value="Respect & Communication">Respect & Communication</option>
                  <option value="Practical Expectations">Practical Expectations</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Principle Statement</label>
                <textarea
                  rows={2}
                  value={ruleForm.principleStatement}
                  onChange={(e) => setRuleForm({ ...ruleForm, principleStatement: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Practical Expectations (one per line)</label>
                <textarea
                  rows={3}
                  value={ruleForm.expectationsText}
                  onChange={(e) => setRuleForm({ ...ruleForm, expectationsText: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRuleModal(false)}
                  className="px-4 py-2 rounded-xl border border-stone-200 font-semibold"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-[#173D35] text-white font-semibold">
                  Save Principle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Member Detail Modal */}
      {detailMember && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-900">{detailMember.displayName}</h3>
              <button onClick={() => setDetailMember(null)}>
                <X className="w-4 h-4 text-stone-400" />
              </button>
            </div>
            <div className="text-xs space-y-2 text-stone-700">
              <div><strong>Role:</strong> {detailMember.role}</div>
              <div><strong>Relationship:</strong> {detailMember.relationshipToPrimary}</div>
              <div><strong>Birth Date:</strong> {detailMember.birthDate || 'Not set'}</div>
              <div><strong>Account Status:</strong> {detailMember.userAccountId || 'Household Profile (No login)'}</div>
              <div>
                <strong>Responsibilities:</strong>{' '}
                {(detailMember.responsibilities || []).join(', ') || 'Family Member'}
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setDetailMember(null)}
                className="px-4 py-2 rounded-xl bg-[#173D35] text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
