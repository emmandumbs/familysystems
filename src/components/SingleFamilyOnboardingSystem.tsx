import React, { useState, useEffect } from 'react';
import {
  Shield,
  Users,
  CheckCircle2,
  AlertTriangle,
  Link2,
  Copy,
  Check,
  Mail,
  UserCheck,
  Sparkles,
  Lock,
  Bell,
  ArrowRight,
  ArrowLeft,
  X,
  Clock,
  ExternalLink,
  Plus,
  Home,
  Heart,
  Globe,
  DollarSign,
  UserPlus
} from 'lucide-react';
import { Stage331WorkspaceData } from './Stage331FamilyExperience';
import { signInWithGooglePopup } from '../firebase';

export interface MemberProfileCompletionRecord {
  roleKey: string;
  memberId: string;
  displayName: string;
  googleEmail: string;
  relationshipToPrimary: string;
  birthDate: string;
  phone: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  allergiesText: string;
  bio: string;
  responsibilitiesText: string;
  avatarUrl: string;
  mandatoryCompleted: boolean;
  isFullyComplete: boolean;
  completionPercentage: number;
  missingOptionalFields: string[];
  skippedAt: number | null;
  lastRemindedAt: number | null;
}

const PROFILE_COMPLETION_STORAGE_KEY = 'familyos_member_profile_completion_v2';

export function computeProfileCompletion(record: Partial<MemberProfileCompletionRecord>): {
  mandatoryCompleted: boolean;
  isFullyComplete: boolean;
  completionPercentage: number;
  missingMandatoryFields: string[];
  missingOptionalFields: string[];
} {
  const missingMandatoryFields: string[] = [];
  if (!record.displayName?.trim()) missingMandatoryFields.push('Full Name');
  if (!record.relationshipToPrimary?.trim()) missingMandatoryFields.push('Family Relationship');

  const missingOptionalFields: string[] = [];
  if (!record.birthDate?.trim()) missingOptionalFields.push('Date of Birth');
  if (!record.phone?.trim()) missingOptionalFields.push('Phone Number');
  if (!record.emergencyContactName?.trim() || !record.emergencyContactPhone?.trim()) {
    missingOptionalFields.push('Emergency Contact (Name & Phone)');
  }
  if (!record.allergiesText?.trim()) missingOptionalFields.push('Allergies & Medical Notes');
  if (!record.bio?.trim()) missingOptionalFields.push('Personal Bio & Responsibilities');

  const totalFields = 7;
  const filledCount = totalFields - missingMandatoryFields.length - missingOptionalFields.length;
  const completionPercentage = Math.round((Math.max(0, filledCount) / totalFields) * 100);

  return {
    mandatoryCompleted: missingMandatoryFields.length === 0,
    isFullyComplete: missingMandatoryFields.length === 0 && missingOptionalFields.length === 0,
    completionPercentage,
    missingMandatoryFields,
    missingOptionalFields,
  };
}

export function loadAllProfileCompletions(): Record<string, MemberProfileCompletionRecord> {
  try {
    const raw = localStorage.getItem(PROFILE_COMPLETION_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Ignore storage error
  }
  return {};
}

export function saveProfileCompletionForRole(
  roleKey: string,
  record: MemberProfileCompletionRecord
): void {
  try {
    const all = loadAllProfileCompletions();
    all[roleKey] = record;
    localStorage.setItem(PROFILE_COMPLETION_STORAGE_KEY, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent('familyos-profile-completion-updated'));
  } catch {
    // Ignore
  }
}

export function getOrCreateRoleProfileCompletion(
  roleKey: string,
  workspaceData: Stage331WorkspaceData | null
): MemberProfileCompletionRecord {
  const all = loadAllProfileCompletions();
  if (all[roleKey]) {
    return all[roleKey];
  }

  // Look for member in active workspace data first
  if (workspaceData?.members && workspaceData.members.length > 0) {
    const found = workspaceData.members.find(
      (m: any) =>
        m.id === workspaceData.callerMemberProfileId ||
        m.role === roleKey ||
        m.displayName?.toLowerCase().includes(roleKey.toLowerCase())
    );
    if (found) {
      const stats = computeProfileCompletion(found);
      return {
        roleKey,
        memberId: found.id,
        displayName: found.displayName || 'Family Member',
        googleEmail: found.email || '',
        relationshipToPrimary: found.relationshipToPrimary || found.relationship || 'MEMBER',
        birthDate: found.birthDate || '',
        phone: found.phone || '',
        emergencyContactName: found.emergencyContactName || '',
        emergencyContactPhone: found.emergencyContactPhone || '',
        allergiesText: Array.isArray(found.allergies) ? found.allergies.join(', ') : found.allergies || '',
        bio: found.bio || '',
        responsibilitiesText: Array.isArray(found.responsibilities) ? found.responsibilities.join(', ') : '',
        avatarUrl: found.avatarUrl || '',
        mandatoryCompleted: stats.mandatoryCompleted,
        isFullyComplete: stats.isFullyComplete,
        completionPercentage: stats.completionPercentage,
        missingOptionalFields: stats.missingOptionalFields,
        skippedAt: null,
        lastRemindedAt: null,
      };
    }
  }

  // When no member or saved completion exists, return a blank template requiring authenticated setup
  const uninitializedRecord: MemberProfileCompletionRecord = {
    roleKey,
    memberId: '',
    displayName: '',
    googleEmail: '',
    relationshipToPrimary: roleKey === 'OWNER' ? 'PRIMARY' : roleKey,
    birthDate: '',
    phone: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    allergiesText: '',
    bio: '',
    responsibilitiesText: '',
    avatarUrl: '',
    mandatoryCompleted: false,
    isFullyComplete: false,
    completionPercentage: 0,
    missingOptionalFields: [
      'Phone Number',
      'Emergency Contact Name',
      'Emergency Contact Phone',
      'Allergies / Dietary Restrictions',
      'Personal Bio',
      'Family Responsibilities & Skills',
      'Profile Photo / Avatar',
    ],
    skippedAt: null,
    lastRemindedAt: null,
  };

  return uninitializedRecord;
}

interface ProfileCompletionReminderBannerProps {
  selectedRole: string;
  workspaceData: Stage331WorkspaceData | null;
  onOpenCompletionModal: () => void;
}

export const ProfileCompletionReminderBanner: React.FC<ProfileCompletionReminderBannerProps> = ({
  selectedRole,
  workspaceData,
  onOpenCompletionModal,
}) => {
  const [record, setRecord] = useState<MemberProfileCompletionRecord>(() =>
    getOrCreateRoleProfileCompletion(selectedRole, workspaceData)
  );
  const [snoozed, setSnoozed] = useState(false);

  useEffect(() => {
    const sync = () => {
      setRecord(getOrCreateRoleProfileCompletion(selectedRole, workspaceData));
      setSnoozed(false);
    };
    sync();
    window.addEventListener('familyos-profile-completion-updated', sync);
    return () => window.removeEventListener('familyos-profile-completion-updated', sync);
  }, [selectedRole, workspaceData]);

  if (record.isFullyComplete || snoozed) {
    return null;
  }

  return (
    <div className="bg-amber-50 border-b border-amber-300 px-4 sm:px-6 py-2.5 text-xs text-amber-950 shadow-2xs">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-1.5 rounded-xl bg-amber-200/80 text-amber-950 shrink-0">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-amber-950">
                Profile ({record.completionPercentage}% Complete) for {record.displayName}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-950 font-mono text-[10px] font-bold">
                {record.missingOptionalFields.length} Optional Field(s) Pending
              </span>
            </div>
            <p className="text-[11px] text-amber-900 mt-0.5">
              Missing optional fields: <strong>{record.missingOptionalFields.join(' • ')}</strong>. You can update these at any time.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={onOpenCompletionModal}
            className="px-3 py-1 rounded-xl font-bold bg-[#173D35] text-white hover:bg-emerald-950 transition-colors cursor-pointer flex items-center space-x-1.5 text-xs"
          >
            <UserCheck className="w-3.5 h-3.5 text-[#E5C388]" />
            <span>Update Profile</span>
          </button>
          <button
            type="button"
            onClick={() => setSnoozed(true)}
            className="px-2.5 py-1 rounded-xl font-semibold bg-amber-200/60 hover:bg-amber-200 text-amber-950 cursor-pointer text-xs"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

interface SingleFamilyOnboardingModalProps {
  isOpen: boolean;
  initialMode: 'first_time_signup' | 'claim_one_time_link' | 'complete_profile_only';
  initialInviteToken?: string;
  selectedRole: string;
  sessionToken: string;
  workspaceData: Stage331WorkspaceData | null;
  onClose: () => void;
  onSelectRole: (role: string) => void;
  onRefreshWorkspace: (overrideFamilyId?: string) => Promise<void>;
}

type WizardStep =
  | 'welcome'
  | 'identity'
  | 'mission_values'
  | 'creating'
  | 'add_members'
  | 'finish'
  | 'claim_invite'
  | 'complete_member_profile';

export const SingleFamilyOnboardingModal: React.FC<SingleFamilyOnboardingModalProps> = ({
  isOpen,
  initialMode,
  initialInviteToken = '',
  selectedRole,
  sessionToken,
  workspaceData,
  onClose,
  onSelectRole,
  onRefreshWorkspace,
}) => {
  const [step, setStep] = useState<WizardStep>('welcome');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Step 2: Family Identity
  const [identityForm, setIdentityForm] = useState({
    name: 'The Sterling Family',
    description: 'A shared home for intentional living, daily rhythm, and lifelong care.',
    logoUrl: '',
    coverImageUrl: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=1200&q=80',
    country: 'United States',
    currencyCode: 'USD',
    language: 'English',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
  });

  // Step 3: Mission and Values (optional)
  const [missionForm, setMissionForm] = useState({
    motto: 'Together in Stewardship, Harmony, and Purpose.',
    mission: 'Cultivate an environment of unconditional love, structured growth, and mutual support.',
    vision: 'A flourishing multi-generational family rooted in resilience and shared purpose.',
    valuesText: 'Integrity, Compassion, Responsibility, Gratitude, Curiosity',
  });

  // Step 4: Created Family Workspace Record
  const [createdFamily, setCreatedFamily] = useState<any>(null);

  // Step 5: Add Members & Invitations
  const [memberTab, setMemberTab] = useState<'HOUSEHOLD_PROFILE' | 'INVITE_USER'>('HOUSEHOLD_PROFILE');
  const [householdForm, setHouseholdForm] = useState({
    displayName: '',
    relationshipToPrimary: 'CHILD',
    birthDate: '',
    avatarUrl: '',
    phone: '',
    allergiesText: '',
  });
  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    role: 'MEMBER' as 'ADMIN' | 'MEMBER' | 'GUEST',
    relationship: 'SPOUSE',
    message: 'Join our family workspace on FamilyOS!',
    method: 'ONE_TIME_LINK' as 'ONE_TIME_LINK' | 'EMAIL',
  });
  const [createdHouseholdMembers, setCreatedHouseholdMembers] = useState<any[]>([]);
  const [createdInvites, setCreatedInvites] = useState<any[]>([]);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Claim Invitation Flow
  const [claimTokenInput, setClaimTokenInput] = useState(initialInviteToken);
  const [verifiedInvitation, setVerifiedInvitation] = useState<any>(null);
  const [verifyingToken, setVerifyingToken] = useState(false);

  // Profile Edit
  const [memberForm, setMemberForm] = useState({
    displayName: '',
    googleEmail: '',
    relationshipToPrimary: 'PARENT',
    birthDate: '1990-05-15',
    phone: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    allergiesText: '',
    bio: '',
    responsibilitiesText: '',
    avatarUrl: '',
  });

  const apiCall = async (url: string, options: RequestInit = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
        ...(options.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || data.error || `Request failed (${res.status})`);
    }
    return data;
  };

  useEffect(() => {
    if (!isOpen) return;
    setStatusMsg(null);

    if (initialMode === 'complete_profile_only') {
      const existingProfile = getOrCreateRoleProfileCompletion(selectedRole, workspaceData);
      setMemberForm({
        displayName: existingProfile.displayName,
        googleEmail: existingProfile.googleEmail,
        relationshipToPrimary: existingProfile.relationshipToPrimary,
        birthDate: existingProfile.birthDate,
        phone: existingProfile.phone,
        emergencyContactName: existingProfile.emergencyContactName,
        emergencyContactPhone: existingProfile.emergencyContactPhone,
        allergiesText: existingProfile.allergiesText,
        bio: existingProfile.bio,
        responsibilitiesText: existingProfile.responsibilitiesText,
        avatarUrl: existingProfile.avatarUrl,
      });
      setStep('complete_member_profile');
    } else if (initialMode === 'claim_one_time_link') {
      setClaimTokenInput(initialInviteToken);
      setStep('claim_invite');
      if (initialInviteToken.trim()) {
        verifyInviteToken(initialInviteToken.trim());
      }
    } else {
      setStep('welcome');
    }
  }, [isOpen, initialMode, initialInviteToken, selectedRole, workspaceData, sessionToken]);

  // Verify invitation token
  const verifyInviteToken = async (token: string) => {
    setVerifyingToken(true);
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/v1/invitations/verify/${encodeURIComponent(token)}`);
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.message || body.error || 'Invalid or expired invitation token');
      }
      setVerifiedInvitation(body.invitation);
      setStatusMsg({
        type: 'success',
        text: `Invitation found for "${body.invitation.familyName || 'Family Workspace'}" as ${body.invitation.proposedRole}!`,
      });
    } catch (err: any) {
      setVerifiedInvitation(null);
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setVerifyingToken(false);
    }
  };

  // Claim Invitation and Switch
  const handleClaimInvitation = async () => {
    const token = claimTokenInput.trim();
    if (!token) return;
    setLoading(true);
    setStatusMsg(null);
    try {
      const res = await apiCall('/api/v1/invitations/claim-one-time-link', {
        method: 'POST',
        body: JSON.stringify({ invitationToken: token }),
      });
      setStatusMsg({
        type: 'success',
        text: `Successfully joined ${res.family?.name || 'family'}!`,
      });
      await onRefreshWorkspace(res.family?.id);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Create Family Workspace
  const handleCreateFamilySubmit = async () => {
    setLoading(true);
    setStatusMsg(null);
    try {
      const valuesArray = missionForm.valuesText
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);

      const res = await apiCall('/api/v1/workspaces', {
        method: 'POST',
        body: JSON.stringify({
          name: identityForm.name.trim() || 'Our Family',
          description: identityForm.description.trim(),
          logoUrl: identityForm.logoUrl.trim(),
          coverImageUrl: identityForm.coverImageUrl.trim(),
          country: identityForm.country.trim(),
          currencyCode: identityForm.currencyCode.trim(),
          language: identityForm.language.trim(),
          timezone: identityForm.timezone.trim(),
          motto: missionForm.motto.trim(),
          mission: missionForm.mission.trim(),
          vision: missionForm.vision.trim(),
          values: valuesArray,
        }),
      });

      setCreatedFamily(res.workspace || res.family);
      await onRefreshWorkspace(res.workspace?.id || res.family?.id);
      setStep('add_members');
      setStatusMsg({
        type: 'success',
        text: `Family workspace "${identityForm.name}" created successfully with you as OWNER!`,
      });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Step 5: Add Household Profile
  const handleAddHouseholdMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!householdForm.displayName.trim()) {
      setStatusMsg({ type: 'error', text: 'Please enter a name for the household member.' });
      return;
    }
    const familyId = createdFamily?.id || workspaceData?.workspace?.id || workspaceData?.familyId;
    if (!familyId) {
      setStatusMsg({ type: 'error', text: 'Active family workspace required. Please create or select a family first.' });
      return;
    }
    setLoading(true);
    setStatusMsg(null);
    try {
      const res = await apiCall(`/api/v1/members/${encodeURIComponent(familyId)}`, {
        method: 'POST',
        body: JSON.stringify({
          displayName: householdForm.displayName.trim(),
          relationship: householdForm.relationshipToPrimary,
          birthDate: householdForm.birthDate || null,
          avatarUrl: householdForm.avatarUrl || null,
          phone: householdForm.phone || null,
          allergies: householdForm.allergiesText ? [householdForm.allergiesText] : [],
          isMinor: householdForm.relationshipToPrimary === 'CHILD',
        }),
      });
      setCreatedHouseholdMembers((prev) => [...prev, res.member]);
      setHouseholdForm({
        displayName: '',
        relationshipToPrimary: 'CHILD',
        birthDate: '',
        avatarUrl: '',
        phone: '',
        allergiesText: '',
      });
      setStatusMsg({
        type: 'success',
        text: `Added ${res.member?.displayName || 'member'} to family profiles!`,
      });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Step 5: Send or Generate Invitation
  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    const familyId = createdFamily?.id || workspaceData?.workspace?.id || workspaceData?.familyId;
    if (!familyId) {
      setStatusMsg({ type: 'error', text: 'Active family workspace required. Please create or select a family first.' });
      return;
    }
    setLoading(true);
    setStatusMsg(null);
    try {
      const res = await apiCall('/api/v1/invitations', {
        method: 'POST',
        body: JSON.stringify({
          familyId,
          inviteeName: inviteForm.name.trim() || 'Invited Family Member',
          inviteeEmail: inviteForm.method === 'EMAIL' ? inviteForm.email.trim() : undefined,
          proposedRole: inviteForm.role,
          relationshipToPrimary: inviteForm.relationship,
          message: inviteForm.message.trim(),
          inviteMethod: inviteForm.method,
        }),
      });
      setCreatedInvites((prev) => [...prev, res.invitation]);
      setInviteForm({
        name: '',
        email: '',
        role: 'MEMBER',
        relationship: 'SPOUSE',
        message: 'Join our family workspace on FamilyOS!',
        method: 'ONE_TIME_LINK',
      });
      setStatusMsg({
        type: 'success',
        text:
          inviteForm.method === 'ONE_TIME_LINK'
            ? 'One-time secure invitation link generated!'
            : `Invitation sent to ${inviteForm.email.trim()}!`,
      });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/?invite=${encodeURIComponent(token)}`;
    navigator.clipboard?.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  // Complete Profile Only
  const handleSaveMemberProfile = (skipOptional: boolean) => {
    const stats = computeProfileCompletion(memberForm);
    if (!stats.mandatoryCompleted) {
      setStatusMsg({
        type: 'error',
        text: `Mandatory fields required: ${stats.missingMandatoryFields.join(', ')}`,
      });
      return;
    }
    const finalRecord: MemberProfileCompletionRecord = {
      roleKey: selectedRole,
      memberId: 'mem-' + Date.now(),
      displayName: memberForm.displayName,
      googleEmail: memberForm.googleEmail,
      relationshipToPrimary: memberForm.relationshipToPrimary,
      birthDate: memberForm.birthDate,
      phone: memberForm.phone,
      emergencyContactName: memberForm.emergencyContactName,
      emergencyContactPhone: memberForm.emergencyContactPhone,
      allergiesText: memberForm.allergiesText,
      bio: memberForm.bio,
      responsibilitiesText: memberForm.responsibilitiesText,
      avatarUrl: memberForm.avatarUrl,
      mandatoryCompleted: true,
      isFullyComplete: !skipOptional && stats.isFullyComplete,
      completionPercentage: stats.completionPercentage,
      missingOptionalFields: skipOptional ? stats.missingOptionalFields : [],
      skippedAt: skipOptional ? Date.now() : null,
      lastRemindedAt: null,
    };
    saveProfileCompletionForRole(selectedRole, finalRecord);
    setStatusMsg({ type: 'success', text: 'Member profile saved successfully!' });
    setTimeout(() => onClose(), 800);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 border border-stone-200 shadow-2xl relative my-auto max-h-[92vh] flex flex-col">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Wizard Progress Header */}
        {step !== 'complete_member_profile' && step !== 'claim_invite' && (
          <div className="mb-5 pb-4 border-b border-stone-200 shrink-0">
            <div className="flex items-center justify-between text-xs font-semibold text-stone-500 mb-2">
              <span className="flex items-center space-x-1.5 text-[#173D35]">
                <Sparkles className="w-4 h-4 text-[#C39A60]" />
                <span className="font-bold">Family Workspace Onboarding</span>
              </span>
              <span className="font-mono text-stone-600">
                {step === 'welcome' && 'Step 1 of 6'}
                {step === 'identity' && 'Step 2 of 6'}
                {step === 'mission_values' && 'Step 3 of 6'}
                {step === 'creating' && 'Step 4 of 6'}
                {step === 'add_members' && 'Step 5 of 6'}
                {step === 'finish' && 'Step 6 of 6'}
              </span>
            </div>

            {/* Stepper Progress Bar */}
            <div className="grid grid-cols-6 gap-1.5">
              {['welcome', 'identity', 'mission_values', 'creating', 'add_members', 'finish'].map(
                (s, idx) => {
                  const stepIndex = ['welcome', 'identity', 'mission_values', 'creating', 'add_members', 'finish'].indexOf(step);
                  const isDone = stepIndex > idx;
                  const isCurrent = stepIndex === idx;
                  return (
                    <div
                      key={s}
                      className={`h-1.5 rounded-full transition-colors ${
                        isDone ? 'bg-[#173D35]' : isCurrent ? 'bg-[#C39A60]' : 'bg-stone-200'
                      }`}
                    />
                  );
                }
              )}
            </div>
          </div>
        )}

        {/* Status Message Notification */}
        {statusMsg && (
          <div
            className={`p-3 rounded-2xl mb-4 text-xs font-semibold flex items-center space-x-2 shrink-0 ${
              statusMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                : 'bg-rose-50 text-rose-900 border border-rose-200'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Scrollable Wizard Body */}
        <div className="flex-1 overflow-y-auto pr-1">
          {/* STEP 1: WELCOME */}
          {step === 'welcome' && (
            <div className="space-y-6">
              <div className="text-center max-w-md mx-auto space-y-2">
                <div className="w-14 h-14 rounded-3xl bg-[#173D35] text-[#E5C388] font-serif text-2xl font-bold flex items-center justify-center mx-auto shadow-md">
                  F
                </div>
                <h2 className="text-2xl font-serif font-bold text-stone-900">Welcome to FamilyOS</h2>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Your household command center for finances, daily rhythm, chores, relationships, and legacy. Set up a family workspace or join an existing one.
                </p>
              </div>

              {/* If user already belongs to a family, show their existing family and forbid creating a second family */}
              {Boolean(workspaceData?.workspace?.id || workspaceData?.familyId) ? (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-left space-y-3">
                  <div className="flex items-center space-x-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-[#173D35] text-[#E5C388] font-serif font-bold text-lg flex items-center justify-center shrink-0">
                      {workspaceData?.workspace?.name?.[0] || 'F'}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-stone-900">{workspaceData?.workspace?.name || 'Your Family'}</h4>
                      <p className="text-xs text-emerald-800 font-semibold">
                        Role: {workspaceData?.callerMembership?.role || selectedRole} • Active Household
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    FamilyOS enforces one family per account. Your account is already linked to this family. You cannot create a second family.
                  </p>
                  <div className="pt-1 flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onRefreshWorkspace();
                        onClose();
                      }}
                      className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-[#173D35] text-white hover:bg-emerald-950 transition-colors cursor-pointer text-center"
                    >
                      Enter {workspaceData?.workspace?.name || 'Family'} Dashboard &rarr;
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep('identity')}
                    className="p-4 rounded-2xl border-2 border-emerald-800 bg-emerald-50/60 hover:bg-emerald-50 transition-all text-left flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center space-x-3.5">
                      <div className="w-10 h-10 rounded-xl bg-[#173D35] text-[#E5C388] flex items-center justify-center shrink-0">
                        <Home className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-stone-900 group-hover:text-[#173D35]">
                          Create Your Family
                        </h4>
                        <p className="text-xs text-stone-600">
                          Establish your family identity, invite loved ones, and become the family owner.
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-emerald-800 group-hover:translate-x-1 transition-transform shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep('claim_invite')}
                    className="p-4 rounded-2xl border border-stone-200 hover:border-[#C39A60] hover:bg-amber-50/40 transition-all text-left flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center space-x-3.5">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center shrink-0">
                        <Link2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-stone-900 group-hover:text-amber-900">
                          Join Existing Family with an Invitation
                        </h4>
                        <p className="text-xs text-stone-600">
                          Use a secure single-use invitation link or code shared by a family member.
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-stone-400 group-hover:text-amber-800 group-hover:translate-x-1 transition-transform shrink-0" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: FAMILY IDENTITY */}
          {step === 'identity' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-serif font-bold text-stone-900">Step 2: Family Identity</h3>
                <p className="text-xs text-stone-600">
                  Choose a name and regional preferences for your family workspace.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Family Workspace Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={identityForm.name}
                    onChange={(e) => setIdentityForm({ ...identityForm, name: e.target.value })}
                    placeholder="e.g. The Sterling Household"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#173D35]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-stone-700 mb-1">Short Description</label>
                  <input
                    type="text"
                    value={identityForm.description}
                    onChange={(e) => setIdentityForm({ ...identityForm, description: e.target.value })}
                    placeholder="A brief summary of your home or family"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#173D35]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Family Crest / Logo URL</label>
                  <input
                    type="url"
                    value={identityForm.logoUrl}
                    onChange={(e) => setIdentityForm({ ...identityForm, logoUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#173D35]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Cover Image URL</label>
                  <input
                    type="url"
                    value={identityForm.coverImageUrl}
                    onChange={(e) => setIdentityForm({ ...identityForm, coverImageUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#173D35]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Country</label>
                  <input
                    type="text"
                    value={identityForm.country}
                    onChange={(e) => setIdentityForm({ ...identityForm, country: e.target.value })}
                    placeholder="e.g. United States"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#173D35]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Preferred Currency</label>
                  <select
                    value={identityForm.currencyCode}
                    onChange={(e) => setIdentityForm({ ...identityForm, currencyCode: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#173D35]"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="CAD">CAD ($)</option>
                    <option value="AUD">AUD ($)</option>
                    <option value="JPY">JPY (¥)</option>
                    <option value="CHF">CHF (Fr)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Timezone</label>
                  <input
                    type="text"
                    value={identityForm.timezone}
                    onChange={(e) => setIdentityForm({ ...identityForm, timezone: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#173D35]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Language</label>
                  <input
                    type="text"
                    value={identityForm.language}
                    onChange={(e) => setIdentityForm({ ...identityForm, language: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#173D35]"
                  />
                </div>
              </div>

              {/* Live Family Identity Preview */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block mb-2">
                  Live Identity Preview
                </span>
                <div className="flex items-center space-x-3.5">
                  {identityForm.logoUrl ? (
                    <img
                      src={identityForm.logoUrl}
                      alt="Logo"
                      className="w-12 h-12 rounded-2xl object-cover border border-[#C39A60]"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-[#173D35] text-[#E5C388] font-serif font-bold text-xl flex items-center justify-center">
                      {identityForm.name?.[0] || 'F'}
                    </div>
                  )}
                  <div>
                    <h4 className="text-sm font-bold text-stone-900 font-serif">
                      {identityForm.name || 'Unnamed Family'}
                    </h4>
                    <p className="text-xs text-stone-500 line-clamp-1">{identityForm.description}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-stone-200 font-semibold text-stone-700">
                        {identityForm.country}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-100 font-semibold text-emerald-800">
                        {identityForm.currencyCode}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep('welcome')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100 flex items-center space-x-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!identityForm.name.trim()) {
                      setStatusMsg({ type: 'error', text: 'Family name is required.' });
                      return;
                    }
                    setStatusMsg(null);
                    setStep('mission_values');
                  }}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#173D35] text-white hover:bg-emerald-950 flex items-center space-x-1.5 cursor-pointer shadow-xs"
                >
                  <span>Next: Mission & Values</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#E5C388]" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: MISSION AND VALUES */}
          {step === 'mission_values' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-serif font-bold text-stone-900">Step 3: Family Mission & Values</h3>
                <p className="text-xs text-stone-600">
                  Optional guiding principles for your household. You can edit or expand these later in Family Settings.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Family Motto (Optional)
                  </label>
                  <input
                    type="text"
                    value={missionForm.motto}
                    onChange={(e) => setMissionForm({ ...missionForm, motto: e.target.value })}
                    placeholder="e.g. Together in Stewardship and Care."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#173D35]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Mission Statement (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={missionForm.mission}
                    onChange={(e) => setMissionForm({ ...missionForm, mission: e.target.value })}
                    placeholder="What is our family's primary purpose and daily focus?"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#173D35]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Vision Statement (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={missionForm.vision}
                    onChange={(e) => setMissionForm({ ...missionForm, vision: e.target.value })}
                    placeholder="What kind of generational legacy and future are we building?"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#173D35]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Core Family Values (Comma-separated)
                  </label>
                  <input
                    type="text"
                    value={missionForm.valuesText}
                    onChange={(e) => setMissionForm({ ...missionForm, valuesText: e.target.value })}
                    placeholder="e.g. Trust, Kindness, Stewardship, Resilience"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#173D35]"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep('identity')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100 flex items-center space-x-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleCreateFamilySubmit}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#173D35] text-white hover:bg-emerald-950 flex items-center space-x-1.5 cursor-pointer shadow-xs disabled:opacity-60"
                >
                  {loading ? (
                    <span>Creating Workspace...</span>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-[#E5C388]" />
                      <span>Create Family Workspace</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: ADD MEMBERS & INVITATIONS */}
          {step === 'add_members' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-serif font-bold text-stone-900">Step 5: Add Family Members</h3>
                <p className="text-xs text-stone-600">
                  Add profiles for household members (including children) or invite relatives to create an account.
                </p>
              </div>

              {/* Tabs */}
              <div className="flex rounded-xl bg-stone-100 p-1">
                <button
                  type="button"
                  onClick={() => setMemberTab('HOUSEHOLD_PROFILE')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    memberTab === 'HOUSEHOLD_PROFILE'
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Add Household Profile (No Login)
                </button>
                <button
                  type="button"
                  onClick={() => setMemberTab('INVITE_USER')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    memberTab === 'INVITE_USER'
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Invite to Join FamilyOS (Account)
                </button>
              </div>

              {/* ACTION A: Household Member Profile Form */}
              {memberTab === 'HOUSEHOLD_PROFILE' && (
                <form onSubmit={handleAddHouseholdMember} className="space-y-3 p-4 rounded-2xl bg-stone-50 border border-stone-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">Member Name *</label>
                      <input
                        type="text"
                        required
                        value={householdForm.displayName}
                        onChange={(e) => setHouseholdForm({ ...householdForm, displayName: e.target.value })}
                        placeholder="e.g. Leo Vance"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#173D35]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">Relationship to You</label>
                      <select
                        value={householdForm.relationshipToPrimary}
                        onChange={(e) => setHouseholdForm({ ...householdForm, relationshipToPrimary: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#173D35]"
                      >
                        <option value="CHILD">Child / Minor</option>
                        <option value="SPOUSE">Spouse / Partner</option>
                        <option value="PARENT">Parent / In-Law</option>
                        <option value="SIBLING">Sibling</option>
                        <option value="GRANDPARENT">Grandparent</option>
                        <option value="CAREGIVER">Caregiver</option>
                        <option value="OTHER">Other Relative</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">Date of Birth (Optional)</label>
                      <input
                        type="date"
                        value={householdForm.birthDate}
                        onChange={(e) => setHouseholdForm({ ...householdForm, birthDate: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#173D35]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">Health / Allergy Notes</label>
                      <input
                        type="text"
                        value={householdForm.allergiesText}
                        onChange={(e) => setHouseholdForm({ ...householdForm, allergiesText: e.target.value })}
                        placeholder="e.g. Peanut allergy, Asthma"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#173D35]"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-[#173D35] text-white hover:bg-emerald-950 flex items-center space-x-1.5 cursor-pointer disabled:opacity-60"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Save Household Member</span>
                    </button>
                  </div>
                </form>
              )}

              {/* ACTION B: Invite to Join FamilyOS */}
              {memberTab === 'INVITE_USER' && (
                <form onSubmit={handleCreateInvitation} className="space-y-3 p-4 rounded-2xl bg-stone-50 border border-stone-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">Invitee Name</label>
                      <input
                        type="text"
                        value={inviteForm.name}
                        onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                        placeholder="e.g. David Sterling"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#173D35]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">Proposed Role</label>
                      <select
                        value={inviteForm.role}
                        onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as any })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#173D35]"
                      >
                        <option value="ADMIN">Admin / Co-Parent (Full access)</option>
                        <option value="MEMBER">Member (Standard access)</option>
                        <option value="GUEST">Guest / Caregiver (Limited)</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-stone-700 mb-1">Delivery Method</label>
                      <div className="flex space-x-3 text-xs">
                        <label className="flex items-center space-x-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="delivery_method"
                            checked={inviteForm.method === 'ONE_TIME_LINK'}
                            onChange={() => setInviteForm({ ...inviteForm, method: 'ONE_TIME_LINK' })}
                          />
                          <span>Shareable 1-Time Secure Link</span>
                        </label>
                        <label className="flex items-center space-x-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="delivery_method"
                            checked={inviteForm.method === 'EMAIL'}
                            onChange={() => setInviteForm({ ...inviteForm, method: 'EMAIL' })}
                          />
                          <span>Email Invitation</span>
                        </label>
                      </div>
                    </div>

                    {inviteForm.method === 'EMAIL' && (
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-stone-700 mb-1">Invitee Email Address *</label>
                        <input
                          type="email"
                          required
                          value={inviteForm.email}
                          onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                          placeholder="relative@example.com"
                          className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#173D35]"
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-[#C39A60] text-[#173D35] hover:bg-[#d6af74] flex items-center space-x-1.5 cursor-pointer disabled:opacity-60"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>{inviteForm.method === 'ONE_TIME_LINK' ? 'Generate 1-Time Link' : 'Send Invitation'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Added Members & Generated Invites List */}
              {(createdHouseholdMembers.length > 0 || createdInvites.length > 0) && (
                <div className="space-y-2 pt-2">
                  <h5 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                    Added to Family Workspace
                  </h5>
                  {createdHouseholdMembers.map((m, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl border border-stone-200 bg-white flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px]">
                          {m.displayName?.[0] || 'M'}
                        </div>
                        <span className="font-bold text-stone-900">{m.displayName}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-semibold">
                          {m.relationship || 'MEMBER'}
                        </span>
                      </div>
                      <span className="text-[10px] text-emerald-700 font-semibold">Profile Active</span>
                    </div>
                  ))}

                  {createdInvites.map((inv, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl border border-amber-200 bg-amber-50/50 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <Link2 className="w-4 h-4 text-amber-800" />
                        <span className="font-bold text-stone-900">{inv.inviteeName || 'Guest'}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-semibold">
                          {inv.proposedRole}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {inv.invitationToken && (
                          <button
                            type="button"
                            onClick={() => handleCopyLink(inv.invitationToken)}
                            className="px-2.5 py-1 rounded-lg bg-white border border-stone-300 font-semibold text-stone-700 hover:bg-stone-50 text-[11px] flex items-center space-x-1 cursor-pointer"
                          >
                            {copiedToken === inv.invitationToken ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 text-stone-500" />
                                <span>Copy Link</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Finish Button */}
              <div className="flex items-center justify-between pt-3 border-t border-stone-200">
                <span className="text-xs text-stone-500">
                  You can invite more people anytime from the Family dashboard.
                </span>
                <button
                  type="button"
                  onClick={() => setStep('finish')}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#173D35] text-white hover:bg-emerald-950 flex items-center space-x-1.5 cursor-pointer shadow-xs"
                >
                  <span>Finish Onboarding</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#E5C388]" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: FINISH ONBOARDING */}
          {step === 'finish' && (
            <div className="space-y-6 text-center">
              <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-8 h-8 text-emerald-700" />
              </div>

              <div>
                <h3 className="text-xl font-serif font-bold text-stone-900">
                  Welcome to {createdFamily?.name || identityForm.name}!
                </h3>
                <p className="text-xs text-stone-600 mt-1 max-w-md mx-auto">
                  Your family workspace has been created. You are registered as the OWNER with full stewardship permissions.
                </p>
              </div>

              {/* Summary Card */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 text-left space-y-3">
                <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                  <span className="text-xs font-semibold text-stone-500">Workspace Identity:</span>
                  <span className="text-xs font-bold text-stone-900">{createdFamily?.name || identityForm.name}</span>
                </div>
                <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                  <span className="text-xs font-semibold text-stone-500">Primary Steward / Owner:</span>
                  <span className="text-xs font-bold text-emerald-800">You (Owner)</span>
                </div>
                <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                  <span className="text-xs font-semibold text-stone-500">Household Profiles:</span>
                  <span className="text-xs font-bold text-stone-900">{createdHouseholdMembers.length + 1} Member(s)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-stone-500">Pending Invitations:</span>
                  <span className="text-xs font-bold text-stone-900">{createdInvites.length} Sent</span>
                </div>
              </div>

              {/* Enter Dashboard Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={async () => {
                    await onRefreshWorkspace(createdFamily?.id);
                    onClose();
                  }}
                  className="w-full py-3.5 px-6 rounded-2xl font-bold bg-[#173D35] text-white hover:bg-emerald-950 flex items-center justify-center space-x-2 text-sm shadow-md cursor-pointer transition-all"
                >
                  <Sparkles className="w-4 h-4 text-[#E5C388]" />
                  <span>Enter Family Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* CLAIM INVITATION FLOW */}
          {step === 'claim_invite' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-serif font-bold text-stone-900">Join Family with Invitation</h3>
                <p className="text-xs text-stone-600">
                  Paste your invitation token or full link to verify and claim membership.
                </p>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-bold text-stone-700">Invitation Link or Token</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={claimTokenInput}
                    onChange={(e) => {
                      let val = e.target.value.trim();
                      if (val.includes('invite=')) {
                        val = val.split('invite=')[1]?.split('&')[0] || val;
                      }
                      setClaimTokenInput(val);
                    }}
                    placeholder="Paste token or link (e.g. fos_inv_...)"
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#173D35]"
                  />
                  <button
                    type="button"
                    disabled={verifyingToken || !claimTokenInput.trim()}
                    onClick={() => verifyInviteToken(claimTokenInput.trim())}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-stone-800 text-white hover:bg-black disabled:opacity-50 cursor-pointer"
                  >
                    {verifyingToken ? 'Checking...' : 'Verify'}
                  </button>
                </div>
              </div>

              {/* Verified Details Card */}
              {verifiedInvitation && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                    Verified Invitation
                  </span>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-600">Family Workspace:</span>
                    <span className="font-bold text-stone-900">{verifiedInvitation.familyName || 'FamilyOS Workspace'}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-600">Assigned Role:</span>
                    <span className="font-bold text-emerald-800">{verifiedInvitation.proposedRole}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-600">Relationship:</span>
                    <span className="font-bold text-stone-900">{verifiedInvitation.relationshipToPrimary || 'Member'}</span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setStep('welcome')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100 flex items-center space-x-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  disabled={loading || !claimTokenInput.trim()}
                  onClick={handleClaimInvitation}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#173D35] text-white hover:bg-emerald-950 flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  {loading ? (
                    <span>Joining Family...</span>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5 text-[#E5C388]" />
                      <span>Claim Invitation & Join Family</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* COMPLETE PROFILE ONLY */}
          {step === 'complete_member_profile' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-serif font-bold text-stone-900">Personal Member Profile</h3>
                <p className="text-xs text-stone-600">
                  Update your contact, emergency, and dietary details. Optional fields can be completed at your convenience.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={memberForm.displayName}
                    onChange={(e) => setMemberForm({ ...memberForm, displayName: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#173D35]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Family Relationship *</label>
                  <input
                    type="text"
                    value={memberForm.relationshipToPrimary}
                    onChange={(e) => setMemberForm({ ...memberForm, relationshipToPrimary: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#173D35]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={memberForm.birthDate}
                    onChange={(e) => setMemberForm({ ...memberForm, birthDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#173D35]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={memberForm.phone}
                    onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#173D35]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Emergency Contact Name</label>
                  <input
                    type="text"
                    value={memberForm.emergencyContactName}
                    onChange={(e) => setMemberForm({ ...memberForm, emergencyContactName: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#173D35]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Emergency Contact Phone</label>
                  <input
                    type="tel"
                    value={memberForm.emergencyContactPhone}
                    onChange={(e) => setMemberForm({ ...memberForm, emergencyContactPhone: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#173D35]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-stone-700 mb-1">Allergies & Medical Notes</label>
                  <input
                    type="text"
                    value={memberForm.allergiesText}
                    onChange={(e) => setMemberForm({ ...memberForm, allergiesText: e.target.value })}
                    placeholder="e.g. Penicillin, bee stings"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#173D35]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => handleSaveMemberProfile(true)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100 cursor-pointer"
                >
                  Save & Skip Optional
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveMemberProfile(false)}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#173D35] text-white hover:bg-emerald-950 cursor-pointer shadow-xs"
                >
                  Save Profile
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
