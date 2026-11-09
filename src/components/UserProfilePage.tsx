import React, { useState, useRef, useEffect } from 'react';
import {
  Shield,
  Upload,
  Download,
  Trash2,
  CheckCircle2,
  ArrowLeft,
  Mail,
  Phone,
  Camera,
  Sparkles,
  Save,
  Image as ImageIcon,
  UserCheck,
} from 'lucide-react';
import { Stage331WorkspaceData } from './Stage331FamilyExperience';
import {
  computeProfileCompletion,
  getOrCreateRoleProfileCompletion,
  saveProfileCompletionForRole,
  MemberProfileCompletionRecord,
} from './SingleFamilyOnboardingSystem';
import { syncDomainRecordToDatabase } from '../firebase';

export interface UserProfilePageProps {
  selectedRole: string;
  sessionToken?: string;
  workspaceData?: Stage331WorkspaceData | null;
  onSelectRole: (role: string) => void;
  onBackToWorkspace: () => void;
  onRefreshWorkspace?: () => Promise<void>;
  onOpenOnboardingModal?: (mode: 'first_time_signup' | 'claim_one_time_link' | 'complete_profile_only') => void;
}

interface UserPhoto {
  id: string;
  name: string;
  category: string;
  url: string;
  dateAdded: string;
}

// Member identity is strictly resolved dynamically from validated workspace data.
// Hardcoded role-to-member mappings and fallback identifiers have been removed.

const PERSONA_DETAILS: Record<
  string,
  {
    name: string;
    roleTitle: string;
    relationship: string;
    email: string;
    phone: string;
    birthDate: string;
    avatarUrl: string;
    securityClearance: string;
    bio: string;
    yearlyStatement: string;
    personalVision: string;
    interests: string[];
    hobbies: string[];
    emergencyContactName: string;
    emergencyContactPhone: string;
    dietaryNotes: string;
    medicalNotes: string;
  }
> = {
  OWNER: {
    name: 'Sarah Jenkins',
    roleTitle: 'Owner / Head of Household',
    relationship: 'Parent / Mother',
    email: 'sarah.jenkins@gmail.com',
    phone: '+1 (555) 234-5678',
    birthDate: '1986-04-12',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    securityClearance: 'Level 5 — Super Administrator (Full Financial & Billing)',
    bio: 'Primary family steward, managing household budgets, financial planning, health records & core routines.',
    yearlyStatement: '2026: A Year of Generational Harmony, Health & Financial Resilience',
    personalVision: 'Build enduring family traditions, master executive leadership, and complete a half-marathon.',
    interests: ['Financial Stewardship', 'Wellness', 'Organic Gardening', 'Aviation'],
    hobbies: ['Trail Running', 'Baking', 'Oil Painting'],
    emergencyContactName: 'David Jenkins (Co-Parent)',
    emergencyContactPhone: '+1 (555) 234-5679',
    dietaryNotes: 'Gluten-conscious, Organic preference',
    medicalNotes: 'No known drug allergies. Tetanus booster updated 2025.',
  },
  ADMIN: {
    name: 'David Jenkins',
    roleTitle: 'Admin / Co-Parent',
    relationship: 'Parent / Father',
    email: 'david.jenkins@gmail.com',
    phone: '+1 (555) 234-5679',
    birthDate: '1985-08-22',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    securityClearance: 'Level 4 — Administrator (Co-Parent Financial & Chores)',
    bio: 'Co-parent administrator managing chore approvals, home maintenance, vehicle registry & family goals.',
    yearlyStatement: '2026: Year of Home Infrastructure & Mindful Family Stewardship',
    personalVision: 'Maintain sustainable household assets and mentor children in woodworking and STEM.',
    interests: ['Home Automation', 'Woodworking', 'STEM Education', 'Cycling'],
    hobbies: ['Carpentry', 'Mountain Biking', 'Chess'],
    emergencyContactName: 'Sarah Jenkins (Parent)',
    emergencyContactPhone: '+1 (555) 234-5678',
    dietaryNotes: 'None',
    medicalNotes: 'Penicillin allergy (Severe). Carry EpiPen for bee stings.',
  },
  MEMBER: {
    name: 'Maya Jenkins',
    roleTitle: 'Member / Teenager',
    relationship: 'Daughter (Age 16)',
    email: 'maya.jenkins@gmail.com',
    phone: '+1 (555) 234-5680',
    birthDate: '2010-03-19',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
    securityClearance: 'Level 2 — Family Member (Personal Expenses & Tasks)',
    bio: 'High school sophomore interested in photography and track & field. Records personal expenses & goals.',
    yearlyStatement: '2026: Year of Academic Excellence & Creative Expression',
    personalVision: 'Achieve varsity track honors and build a digital photography portfolio for college admissions.',
    interests: ['Photography', 'Track & Field', 'Environmental Science', 'Graphic Design'],
    hobbies: ['Digital Photography', 'Running', 'Guitar'],
    emergencyContactName: 'Sarah Jenkins (Mother)',
    emergencyContactPhone: '+1 (555) 234-5678',
    dietaryNotes: 'Vegetarian',
    medicalNotes: 'Mild asthma (Albuterol inhaler as needed).',
  },
  CHILD: {
    name: 'Lucas Jenkins',
    roleTitle: 'Child / Minor Profile',
    relationship: 'Son (Age 9)',
    email: 'lucas.jenkins@gmail.com',
    phone: '+1 (555) 234-5678',
    birthDate: '2017-06-15',
    avatarUrl: 'https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?auto=format&fit=crop&w=400&q=80',
    securityClearance: 'Level 1 — Minor Child (Chores & Rewards Only)',
    bio: '4th grader, loves soccer and LEGOs. Completes daily chores to earn reward points for savings.',
    yearlyStatement: '2026: Year of Soccer Team Spirit & Savings Goals',
    personalVision: 'Score 10 goals in youth soccer and build the LEGO Space Station model.',
    interests: ['Soccer', 'LEGO Robotics', 'Space Exploration'],
    hobbies: ['Youth Soccer', 'LEGO Building', 'Reading Sci-Fi'],
    emergencyContactName: 'Sarah Jenkins (Mother)',
    emergencyContactPhone: '+1 (555) 234-5678',
    dietaryNotes: 'Peanut allergy (Strictly Peanut-Free)',
    medicalNotes: 'Peanut anaphylaxis. Emergency EpiPen kept in school nurse office.',
  },
  GUEST: {
    name: 'Martha Vance',
    roleTitle: 'Guest / Caregiver',
    relationship: 'Babysitter & Family Assistant',
    email: 'martha.vance@gmail.com',
    phone: '+1 (555) 987-6543',
    birthDate: '1958-11-04',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
    securityClearance: 'Level 0 — Guest Caregiver (Schedules & Emergency Contacts)',
    bio: 'Family babysitter assisting with evening routines, dinner preparation, and emergency coverage.',
    yearlyStatement: '2026: Dedicated Support for Household Care & Early Childhood Development',
    personalVision: 'Provide nurturing and safe environment for children during co-parent work travel.',
    interests: ['Child Psychology', 'Culinary Arts', 'Early Education'],
    hobbies: ['Baking', 'Storytelling', 'Crafting'],
    emergencyContactName: 'Sarah Jenkins (Primary Host)',
    emergencyContactPhone: '+1 (555) 234-5678',
    dietaryNotes: 'None',
    medicalNotes: 'CPR & First Aid Certified (Red Cross 2025).',
  },
};

const INITIAL_PHOTOS: Record<string, UserPhoto[]> = {
  OWNER: [
    { id: 'p-1', name: 'sarah_headshot_2026.jpg', category: 'Profile', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80', dateAdded: '2026-01-15' },
    { id: 'p-2', name: 'family_summer_cabin.jpg', category: 'Family Album', url: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=800&q=80', dateAdded: '2026-02-10' },
    { id: 'p-3', name: 'household_property_deed.jpg', category: 'Documents', url: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80', dateAdded: '2026-03-01' },
  ],
  ADMIN: [
    { id: 'p-4', name: 'david_headshot_2026.jpg', category: 'Profile', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80', dateAdded: '2026-01-15' },
    { id: 'p-5', name: 'family_hiking_trip.jpg', category: 'Family Album', url: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&q=80', dateAdded: '2026-02-20' },
  ],
  MEMBER: [
    { id: 'p-6', name: 'maya_track_meet.jpg', category: 'Sports', url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80', dateAdded: '2026-02-05' },
  ],
  CHILD: [
    { id: 'p-7', name: 'lucas_soccer_trophy.jpg', category: 'Achievements', url: 'https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?auto=format&fit=crop&w=800&q=80', dateAdded: '2026-02-28' },
  ],
  GUEST: [
    { id: 'p-8', name: 'martha_caregiver_cert.jpg', category: 'Certification', url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=800&q=80', dateAdded: '2026-01-10' },
  ],
};

export const UserProfilePage: React.FC<UserProfilePageProps> = ({
  selectedRole,
  sessionToken = '',
  workspaceData = null,
  onSelectRole,
  onBackToWorkspace,
  onRefreshWorkspace,
  onOpenOnboardingModal,
}) => {
  const currentPersona = PERSONA_DETAILS[selectedRole] || PERSONA_DETAILS.OWNER;
  const completionRecord = getOrCreateRoleProfileCompletion(selectedRole, workspaceData);

  const [photos, setPhotos] = useState<UserPhoto[]>(() => {
    try {
      const saved = localStorage.getItem(`familyos_user_photos_v1_${selectedRole}`);
      if (saved) return JSON.parse(saved);
    } catch {
      // Fallback
    }
    return INITIAL_PHOTOS[selectedRole] || [];
  });

  const [avatarUrl, setAvatarUrl] = useState<string>(
    completionRecord.avatarUrl || currentPersona.avatarUrl
  );

  const [editForm, setEditForm] = useState({
    name: completionRecord.displayName || currentPersona.name,
    email: completionRecord.googleEmail || currentPersona.email,
    relationship: completionRecord.relationshipToPrimary || currentPersona.relationship,
    birthDate: completionRecord.birthDate || currentPersona.birthDate,
    phone: completionRecord.phone || currentPersona.phone,
    bio: completionRecord.bio || currentPersona.bio,
    yearlyStatement: currentPersona.yearlyStatement,
    personalVision: currentPersona.personalVision,
    interestsText: currentPersona.interests.join(', '),
    hobbiesText: currentPersona.hobbies.join(', '),
    emergencyContactName: completionRecord.emergencyContactName || currentPersona.emergencyContactName,
    emergencyContactPhone: completionRecord.emergencyContactPhone || currentPersona.emergencyContactPhone,
    dietaryNotes: currentPersona.dietaryNotes,
    medicalNotes: completionRecord.allergiesText || currentPersona.medicalNotes,
  });

  const [isSavedToastVisible, setIsSavedToastVisible] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteAccount = async () => {
    if (deleteConfirmationText !== 'DELETE') return;
    setIsDeletingAccount(true);
    setDeleteError(null);
    try {
      const res = await fetch('/api/v1/account/me', {
        method: 'DELETE',
        headers: {
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to delete account.');
      }
      localStorage.removeItem('familyos_session_token');
      localStorage.clear();
      window.location.reload();
    } catch (err: any) {
      setDeleteError(err.message || 'An error occurred during account deletion.');
      setIsDeletingAccount(false);
    }
  };
  const [savedToastMessage, setSavedToastMessage] = useState<string>(
    'Profile & completion status saved to database!'
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Sync state when selectedRole changes
  useEffect(() => {
    const p = PERSONA_DETAILS[selectedRole] || PERSONA_DETAILS.OWNER;
    const rec = getOrCreateRoleProfileCompletion(selectedRole, workspaceData);
    let savedForm: Partial<typeof editForm> = {};
    try {
      const raw = localStorage.getItem(`familyos_user_profile_v1_${selectedRole}`);
      if (raw) savedForm = JSON.parse(raw);
    } catch {
      // Ignore
    }

    let savedPhotos = INITIAL_PHOTOS[selectedRole] || [];
    try {
      const rawPhotos = localStorage.getItem(`familyos_user_photos_v1_${selectedRole}`);
      if (rawPhotos) savedPhotos = JSON.parse(rawPhotos);
    } catch {
      // Ignore
    }

    setAvatarUrl(rec.avatarUrl || p.avatarUrl);
    setPhotos(savedPhotos);
    setEditForm({
      name: savedForm.name ?? rec.displayName ?? p.name,
      email: savedForm.email ?? rec.googleEmail ?? p.email,
      relationship: savedForm.relationship ?? rec.relationshipToPrimary ?? p.relationship,
      birthDate: savedForm.birthDate ?? rec.birthDate ?? p.birthDate,
      phone: savedForm.phone ?? (rec.phone || p.phone),
      bio: savedForm.bio ?? (rec.bio || p.bio),
      yearlyStatement: savedForm.yearlyStatement ?? p.yearlyStatement,
      personalVision: savedForm.personalVision ?? p.personalVision,
      interestsText: savedForm.interestsText ?? p.interests.join(', '),
      hobbiesText: savedForm.hobbiesText ?? p.hobbies.join(', '),
      emergencyContactName: savedForm.emergencyContactName ?? (rec.emergencyContactName || p.emergencyContactName),
      emergencyContactPhone: savedForm.emergencyContactPhone ?? (rec.emergencyContactPhone || p.emergencyContactPhone),
      dietaryNotes: savedForm.dietaryNotes ?? p.dietaryNotes,
      medicalNotes: savedForm.medicalNotes ?? (rec.allergiesText || p.medicalNotes),
    });
  }, [selectedRole, workspaceData]);

  // Persist photos per role
  useEffect(() => {
    try {
      localStorage.setItem(`familyos_user_photos_v1_${selectedRole}`, JSON.stringify(photos));
    } catch {
      // Ignore quota errors
    }
  }, [photos, selectedRole]);

  // Handle Photo Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();
    reader.onload = async (event) => {
      const resultUrl = event.target?.result as string;
      const newPhoto: UserPhoto = {
        id: `photo-${Date.now()}`,
        name: file.name,
        category: 'Uploaded Photo',
        url: resultUrl,
        dateAdded: new Date().toISOString().split('T')[0],
      };
      setPhotos((prev) => [newPhoto, ...prev]);

      const activeFamilyId = workspaceData?.workspace?.familyId || workspaceData?.workspace?.id || workspaceData?.familyId || '';
      const activeMember = workspaceData?.members?.find((m: any) => m.id === workspaceData.callerMemberProfileId || m.role === selectedRole) || workspaceData?.members?.[0];
      const activeMemberId = activeMember?.id || workspaceData?.callerMemberProfileId || workspaceData?.caller?.memberProfileId || '';

      if (!activeFamilyId || !activeMemberId) {
        setSavedToastMessage('Cannot upload photo: No active family workspace or member context.');
        setIsSavedToastVisible(true);
        setTimeout(() => setIsSavedToastVisible(false), 3500);
        return;
      }

      if (sessionToken && activeFamilyId) {
        try {
          const res = await fetch(`/api/v1/media/${encodeURIComponent(activeFamilyId)}/upload`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${sessionToken}`,
            },
            body: JSON.stringify({
              ownerMemberId: activeMemberId,
              visibility: 'SHARED',
              category: 'MEMBER_PHOTO',
              mimeType: file.type || 'image/jpeg',
              fileName: file.name,
              dataUrl: resultUrl,
            }),
          });
          if (!res.ok) {
            setSavedToastMessage(`Photo upload failed: server returned ${res.status}`);
            setIsSavedToastVisible(true);
            setTimeout(() => setIsSavedToastVisible(false), 3500);
            return;
          }
        } catch {
          setSavedToastMessage('Photo upload failed: network or server error');
          setIsSavedToastVisible(true);
          setTimeout(() => setIsSavedToastVisible(false), 3500);
          return;
        }
      }

      setSavedToastMessage(`Photo "${file.name}" uploaded & saved to database!`);
      setIsSavedToastVisible(true);
      setTimeout(() => setIsSavedToastVisible(false), 3000);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handle Avatar Change Upload
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();
    reader.onload = async (event) => {
      const resultUrl = event.target?.result as string;
      setAvatarUrl(resultUrl);
      const activeFamilyId = workspaceData?.workspace?.familyId || workspaceData?.workspace?.id || workspaceData?.familyId || '';
      const activeMember = workspaceData?.members?.find((m: any) => m.id === workspaceData.callerMemberProfileId || m.role === selectedRole) || workspaceData?.members?.[0];
      const activeMemberId = activeMember?.id || workspaceData?.callerMemberProfileId || workspaceData?.caller?.memberProfileId || '';

      if (!activeFamilyId || !activeMemberId) {
        setSavedToastMessage('Cannot update avatar: No active family workspace or member context.');
        setIsSavedToastVisible(true);
        setTimeout(() => setIsSavedToastVisible(false), 3500);
        return;
      }

      if (sessionToken && activeFamilyId) {
        try {
          const res = await fetch(`/api/v1/media/${encodeURIComponent(activeFamilyId)}/upload`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${sessionToken}`,
            },
            body: JSON.stringify({
              ownerMemberId: activeMemberId,
              visibility: 'SHARED',
              category: 'AVATAR',
              mimeType: file.type || 'image/jpeg',
              fileName: file.name,
              dataUrl: resultUrl,
            }),
          });
          if (!res.ok) {
            setSavedToastMessage(`Avatar update failed: server returned ${res.status}`);
            setIsSavedToastVisible(true);
            setTimeout(() => setIsSavedToastVisible(false), 3500);
            return;
          }
          if (onRefreshWorkspace) await onRefreshWorkspace();
        } catch {
          setSavedToastMessage('Avatar update failed: network or server error');
          setIsSavedToastVisible(true);
          setTimeout(() => setIsSavedToastVisible(false), 3500);
          return;
        }
      }
      setSavedToastMessage('Profile picture updated & synced!');
      setIsSavedToastVisible(true);
      setTimeout(() => setIsSavedToastVisible(false), 3000);
    };
    reader.readAsDataURL(file);
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  // Handle Photo Download
  const handleDownloadPhoto = (photo: UserPhoto) => {
    const link = document.createElement('a');
    link.href = photo.url;
    link.download = photo.name || 'familyos_photo.jpg';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle Delete Photo
  const handleDeletePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  // Handle Save Details Form (Sanitizes sensitive data for local cache + validates server HTTP status)
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();

    // Sensitive data protection: omit raw medical notes and emergency contact numbers from ordinary localStorage
    try {
      const sanitizedLocalProfile = {
        name: editForm.name,
        relationship: editForm.relationship,
        email: editForm.email,
        phone: editForm.phone,
        birthDate: editForm.birthDate,
        avatarUrl,
        bio: editForm.bio,
        yearlyStatement: editForm.yearlyStatement,
        personalVision: editForm.personalVision,
        interestsText: editForm.interestsText,
        hobbiesText: editForm.hobbiesText,
        dietaryNotes: editForm.dietaryNotes,
      };
      localStorage.setItem(`familyos_user_profile_v1_${selectedRole}`, JSON.stringify(sanitizedLocalProfile));
    } catch {
      // Ignore
    }

    const effectiveFamilyId =
      workspaceData?.workspace?.familyId ||
      workspaceData?.workspace?.id ||
      workspaceData?.familyId ||
      '';
    const activeMember =
      workspaceData?.members?.find((m: any) => m.id === workspaceData.callerMemberProfileId || m.role === selectedRole) ||
      workspaceData?.members?.[0];
    const memberId =
      activeMember?.id ||
      workspaceData?.callerMemberProfileId ||
      workspaceData?.caller?.memberProfileId ||
      '';

    if (!effectiveFamilyId || !memberId) {
      setSavedToastMessage('Cannot save profile: Valid family workspace and member identity required.');
      setIsSavedToastVisible(true);
      setTimeout(() => setIsSavedToastVisible(false), 3500);
      return;
    }

    const completionCandidate: Partial<MemberProfileCompletionRecord> = {
      roleKey: selectedRole,
      memberId,
      displayName: editForm.name.trim(),
      googleEmail: editForm.email.trim(),
      relationshipToPrimary: editForm.relationship.trim(),
      birthDate: editForm.birthDate.trim(),
      phone: editForm.phone.trim(),
      emergencyContactName: editForm.emergencyContactName.trim(),
      emergencyContactPhone: editForm.emergencyContactPhone.trim(),
      allergiesText: editForm.medicalNotes.trim(),
      bio: editForm.bio.trim(),
      responsibilitiesText: editForm.interestsText.trim(),
      avatarUrl,
    };

    const stats = computeProfileCompletion(completionCandidate);
    const updatedCompletion: MemberProfileCompletionRecord = {
      ...(completionCandidate as MemberProfileCompletionRecord),
      mandatoryCompleted: stats.mandatoryCompleted,
      isFullyComplete: stats.isFullyComplete,
      completionPercentage: stats.completionPercentage,
      missingOptionalFields: stats.missingOptionalFields,
      skippedAt: stats.isFullyComplete ? null : Date.now(),
      lastRemindedAt: Date.now(),
    };

    saveProfileCompletionForRole(selectedRole, updatedCompletion);
    void syncDomainRecordToDatabase({
      sessionToken,
      familyId: effectiveFamilyId,
      entityType: 'MEMBER_PROFILE_COMPLETION',
      entityId: selectedRole,
      data: updatedCompletion as unknown as Record<string, unknown>,
    });

    if (sessionToken) {
      try {
        const res = await fetch(`/api/v1/members/${encodeURIComponent(effectiveFamilyId)}/${encodeURIComponent(memberId)}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            displayName: editForm.name.trim(),
            birthDate: editForm.birthDate.trim(),
            avatarUrl,
            dietaryPreferences: editForm.dietaryNotes
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
            allergies: editForm.medicalNotes
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
            sharedInfo: {
              bio: editForm.bio.trim(),
              yearlyStatement: editForm.yearlyStatement.trim(),
              personalVision: editForm.personalVision.trim(),
              interests: editForm.interestsText
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
              hobbies: editForm.hobbiesText
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            },
            emergencyContact: {
              contactName: editForm.emergencyContactName.trim(),
              relationship: 'Family Emergency Contact',
              primaryPhone: editForm.emergencyContactPhone.trim(),
            },
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          setSavedToastMessage(`Save failed (${res.status}): ${errData.message || 'Server rejected profile update'}`);
          setIsSavedToastVisible(true);
          setTimeout(() => setIsSavedToastVisible(false), 4000);
          return;
        }

        if (onRefreshWorkspace) {
          await onRefreshWorkspace();
        }
      } catch {
        setSavedToastMessage('Network error saving profile to server.');
        setIsSavedToastVisible(true);
        setTimeout(() => setIsSavedToastVisible(false), 4000);
        return;
      }
    }

    setSavedToastMessage(
      stats.isFullyComplete
        ? 'Profile 100% completed & synced! All reminders cleared.'
        : `Profile saved (${stats.completionPercentage}% complete)!`
    );
    setIsSavedToastVisible(true);
    setTimeout(() => setIsSavedToastVisible(false), 3500);
  };

  const liveCompletion = computeProfileCompletion({
    displayName: editForm.name,
    googleEmail: editForm.email,
    relationshipToPrimary: editForm.relationship,
    birthDate: editForm.birthDate,
    phone: editForm.phone,
    emergencyContactName: editForm.emergencyContactName,
    emergencyContactPhone: editForm.emergencyContactPhone,
    allergiesText: editForm.medicalNotes,
    bio: editForm.bio,
  });

  const effectiveFamilyId =
    workspaceData?.workspace?.familyId ||
    workspaceData?.workspace?.id ||
    workspaceData?.familyId ||
    '';

  if (!effectiveFamilyId) {
    return (
      <div className="min-h-screen bg-[#F7F4EC] text-[#11231E] p-6 lg:p-12 font-sans flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-[#E2DCD0] shadow-md text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
            <Shield className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold font-serif text-[#173D35]">No Active Family Workspace</h2>
          <p className="text-xs text-stone-600 leading-relaxed">
            An authoritative family workspace context is required to access, complete, or modify member profiles. No active workspace context is available in this session.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            {onOpenOnboardingModal && (
              <button
                type="button"
                onClick={() => onOpenOnboardingModal('first_time_signup')}
                className="w-full py-2.5 px-4 rounded-xl bg-[#173D35] text-white text-xs font-semibold hover:bg-[#12332C] transition-all cursor-pointer"
              >
                Create or Join Family Workspace
              </button>
            )}
            <button
              type="button"
              onClick={onBackToWorkspace}
              className="w-full py-2.5 px-4 rounded-xl bg-stone-100 text-stone-700 text-xs font-semibold hover:bg-stone-200 transition-all cursor-pointer"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F4EC] text-[#11231E] p-4 sm:p-6 lg:p-10 font-sans">
      {/* Toast Confirmation */}
      {isSavedToastVisible && (
        <div className="fixed top-6 right-6 z-50 bg-[#173D35] text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center space-x-3 border border-[#C39A60]/40 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-[#C39A60]" />
          <span className="font-semibold text-xs">{savedToastMessage}</span>
        </div>
      )}

      {/* Navigation Header */}
      <div className="max-w-6xl mx-auto mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#E2DCD0] pb-6">
        <div className="flex items-center space-x-4">
          <button
            type="button"
            onClick={onBackToWorkspace}
            className="p-2.5 rounded-2xl bg-white border border-[#E2DCD0] hover:bg-[#173D35] hover:text-white transition-all shadow-xs flex items-center space-x-2 text-xs font-semibold cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Workspace</span>
          </button>

          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#C39A60] bg-[#173D35] px-2.5 py-0.5 rounded-full">
              Authoritative Member Profile
            </span>
            <h1 className="text-xl sm:text-2xl font-bold font-serif text-[#173D35] mt-1">
              User Profile, Completion Status & Security Scope
            </h1>
          </div>
        </div>

        {/* Persona Selector Pill Tabs */}
        <div className="flex items-center space-x-1 p-1 bg-white rounded-2xl border border-[#E2DCD0] shadow-xs overflow-x-auto max-w-full">
          {Object.keys(PERSONA_DETAILS).map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => onSelectRole(role)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                selectedRole === role
                  ? 'bg-[#173D35] text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
              }`}
            >
              {role}
            </button>
          ))}
        </div>
      </div>

      {/* Main Profile Grid Container */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Avatar Card & Security Clearance */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-[#E2DCD0] shadow-sm text-center relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-r from-[#173D35] via-[#12332C] to-[#0E2822]" />

            <div className="relative inline-block mt-6">
              <img
                src={avatarUrl}
                alt={editForm.name}
                className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-lg mx-auto bg-stone-200"
              />
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                title="Upload new profile picture"
                className="absolute bottom-1 right-1 p-2 rounded-full bg-[#173D35] text-white hover:bg-[#C39A60] hover:text-[#173D35] shadow-md transition-all cursor-pointer border-2 border-white"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>

            <h2 className="text-xl font-bold font-serif text-[#173D35] mt-3">
              {editForm.name}
            </h2>
            <p className="text-xs font-semibold text-[#C39A60] mt-0.5">{currentPersona.roleTitle}</p>
            <p className="text-xs text-stone-500 mt-1">{editForm.relationship}</p>

            {/* Live Profile Completion Indicator */}
            <div className="mt-4 p-3 rounded-2xl bg-stone-50 border border-stone-200 text-left space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-stone-800">Profile Completion</span>
                <span className="font-mono font-bold text-[#173D35]">
                  {liveCompletion.completionPercentage}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-stone-200 overflow-hidden">
                <div
                  className="h-full bg-[#173D35] rounded-full transition-all"
                  style={{ width: `${liveCompletion.completionPercentage}%` }}
                />
              </div>
              {!liveCompletion.isFullyComplete && onOpenOnboardingModal && (
                <button
                  type="button"
                  onClick={() => onOpenOnboardingModal('complete_profile_only')}
                  className="w-full mt-1 py-1.5 px-2.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold text-[11px] flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Complete Skipped Fields ({liveCompletion.missingOptionalFields.length})</span>
                </button>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-stone-200 space-y-2 text-left text-xs">
              <div className="flex items-center space-x-2 text-stone-700">
                <Mail className="w-3.5 h-3.5 text-[#173D35] shrink-0" />
                <span className="truncate">{editForm.email}</span>
              </div>
              <div className="flex items-center space-x-2 text-stone-700">
                <Phone className="w-3.5 h-3.5 text-[#173D35] shrink-0" />
                <span>{editForm.phone || 'Phone skipped (add on right)'}</span>
              </div>
            </div>
          </div>

          {/* RBAC Security Scope Badge */}
          <div className="bg-[#173D35] text-white rounded-3xl p-6 border border-[#0E2822] shadow-md space-y-3">
            <div className="flex items-center space-x-2.5 text-[#E5C388]">
              <Shield className="w-5 h-5 shrink-0" />
              <h3 className="font-bold text-sm">Security Scope & RBAC</h3>
            </div>
            <p className="text-xs text-emerald-100/80 leading-relaxed">
              {currentPersona.securityClearance}
            </p>
            <div className="pt-2 border-t border-emerald-800/80 text-[11px] text-emerald-200/60 flex items-center justify-between">
              <span>Single-Family Scope</span>
              <span className="font-mono text-[#E5C388] font-bold">VERIFIED</span>
            </div>
          </div>
        </div>

        {/* Right Column: Edit Form & Photo Gallery */}
        <div className="lg:col-span-2 space-y-8">
          {/* Section 1: Photo Album Upload & Download System */}
          <div className="bg-white rounded-3xl p-6 border border-[#E2DCD0] shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-stone-200 pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <ImageIcon className="w-5 h-5 text-[#173D35]" />
                  <h3 className="text-base font-bold font-serif text-[#173D35]">
                    Personal & Family Photo Gallery
                  </h3>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  Upload new photos or download high-res family files
                </p>
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-2xl bg-[#173D35] text-white hover:bg-[#12332C] transition-all shadow-xs flex items-center space-x-2 text-xs font-semibold cursor-pointer"
              >
                <Upload className="w-4 h-4 text-[#E5C388]" />
                <span>Upload New Photo</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {photos.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="group relative rounded-2xl overflow-hidden border border-[#E2DCD0] bg-stone-50 shadow-2xs hover:shadow-md transition-all"
                  >
                    <div className="h-36 overflow-hidden bg-stone-200 relative">
                      <img
                        src={photo.url}
                        alt={photo.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <span className="absolute top-2 left-2 text-[9px] font-mono font-bold px-2 py-0.5 rounded-md bg-black/60 text-white backdrop-blur-xs">
                        {photo.category}
                      </span>
                    </div>

                    <div className="p-3">
                      <p className="font-semibold text-xs text-stone-900 truncate" title={photo.name}>
                        {photo.name}
                      </p>
                      <p className="text-[10px] text-stone-500 mt-0.5">Added {photo.dateAdded}</p>

                      <div className="mt-2 pt-2 border-t border-stone-200 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => handleDownloadPhoto(photo)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 text-[#173D35] hover:bg-[#173D35] hover:text-white transition-colors text-[10px] font-bold flex items-center space-x-1.5 cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeletePhoto(photo.id)}
                          title="Delete photo"
                          className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center bg-stone-50 rounded-2xl border border-dashed border-stone-300 text-stone-500 space-y-2">
                <Camera className="w-8 h-8 mx-auto text-stone-400" />
                <p className="text-xs font-medium">No photos uploaded yet for this user.</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl bg-[#173D35] text-white text-xs font-semibold hover:bg-[#12332C] cursor-pointer"
                >
                  Upload First Photo
                </button>
              </div>
            )}
          </div>

          {/* Section 2: Edit Persona Profile Form */}
          <form onSubmit={handleSaveForm} className="bg-white rounded-3xl p-6 border border-[#E2DCD0] shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-stone-200 pb-4">
              <div>
                <h3 className="text-base font-bold font-serif text-[#173D35]">
                  Personal & Emergency Profile Info
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Update mandatory and optional fields (saving here updates the database & clears any skipped-field reminders)
                </p>
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-2xl bg-[#173D35] text-white hover:bg-[#12332C] transition-all shadow-xs flex items-center space-x-2 text-xs font-semibold cursor-pointer"
              >
                <Save className="w-4 h-4 text-[#E5C388]" />
                <span>Save Profile to Database</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-stone-700">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-stone-50 font-medium focus:outline-hidden focus:bg-white focus:border-[#173D35]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-stone-700">Google Account Email *</label>
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-stone-50 font-medium focus:outline-hidden focus:bg-white focus:border-[#173D35]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-stone-700">Family Relationship *</label>
                <input
                  type="text"
                  required
                  value={editForm.relationship}
                  onChange={(e) => setEditForm({ ...editForm, relationship: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-stone-50 font-medium focus:outline-hidden focus:bg-white focus:border-[#173D35]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-stone-700">Date of Birth *</label>
                <input
                  type="date"
                  required
                  value={editForm.birthDate}
                  onChange={(e) => setEditForm({ ...editForm, birthDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-stone-50 font-medium focus:outline-hidden focus:bg-white focus:border-[#173D35]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-stone-700">Contact Phone</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="+1 (555) 234-5678"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-stone-50 font-medium focus:outline-hidden focus:bg-white focus:border-[#173D35]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-stone-700">Dietary Preferences</label>
                <input
                  type="text"
                  value={editForm.dietaryNotes}
                  onChange={(e) => setEditForm({ ...editForm, dietaryNotes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-stone-50 font-medium focus:outline-hidden focus:bg-white focus:border-[#173D35]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-stone-700">Emergency Contact Name</label>
                <input
                  type="text"
                  value={editForm.emergencyContactName}
                  onChange={(e) => setEditForm({ ...editForm, emergencyContactName: e.target.value })}
                  placeholder="Emergency Contact Name"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-stone-50 font-medium focus:outline-hidden focus:bg-white focus:border-[#173D35]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-stone-700">Emergency Contact Phone</label>
                <input
                  type="text"
                  value={editForm.emergencyContactPhone}
                  onChange={(e) => setEditForm({ ...editForm, emergencyContactPhone: e.target.value })}
                  placeholder="+1 (555) 234-5678"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-stone-50 font-medium focus:outline-hidden focus:bg-white focus:border-[#173D35]"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="font-bold text-[#173D35] flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5 text-[#C39A60]" />
                  <span>2026 Yearly Statement & Theme</span>
                </label>
                <input
                  type="text"
                  value={editForm.yearlyStatement}
                  onChange={(e) => setEditForm({ ...editForm, yearlyStatement: e.target.value })}
                  placeholder="e.g. 2026: Year of Strategic Health, Learning & Family Unity"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-emerald-50/50 font-semibold text-[#173D35] focus:outline-hidden focus:bg-white focus:border-[#173D35]"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="font-bold text-stone-700">Personal Vision & Long-Term Aspiration</label>
                <textarea
                  rows={2}
                  value={editForm.personalVision}
                  onChange={(e) => setEditForm({ ...editForm, personalVision: e.target.value })}
                  placeholder="e.g. Build enduring family traditions, master executive leadership, and run a marathon."
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-stone-50 font-medium focus:outline-hidden focus:bg-white focus:border-[#173D35]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-stone-700">Personal Interests (comma-separated)</label>
                <input
                  type="text"
                  value={editForm.interestsText}
                  onChange={(e) => setEditForm({ ...editForm, interestsText: e.target.value })}
                  placeholder="e.g. Financial Stewardship, Wellness, Aviation"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-stone-50 font-medium focus:outline-hidden focus:bg-white focus:border-[#173D35]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-stone-700">Hobbies & Activities (comma-separated)</label>
                <input
                  type="text"
                  value={editForm.hobbiesText}
                  onChange={(e) => setEditForm({ ...editForm, hobbiesText: e.target.value })}
                  placeholder="e.g. Trail Running, Baking, Oil Painting"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-stone-50 font-medium focus:outline-hidden focus:bg-white focus:border-[#173D35]"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="font-bold text-stone-700">Personal Bio Notes</label>
                <textarea
                  rows={2}
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-stone-50 font-medium focus:outline-hidden focus:bg-white focus:border-[#173D35]"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="font-bold text-stone-700">Medical Notes & Allergies</label>
                <input
                  type="text"
                  value={editForm.medicalNotes}
                  onChange={(e) => setEditForm({ ...editForm, medicalNotes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-stone-50 font-medium focus:outline-hidden focus:bg-white focus:border-[#173D35]"
                />
              </div>
            </div>
          </form>
        </div>

        {/* Danger Zone: GDPR Account Deletion */}
        <div className="mt-8 bg-white rounded-3xl border border-red-200 p-8 shadow-sm">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2.5 bg-red-50 text-red-600 rounded-2xl">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-stone-900">Danger Zone: Account & Data Deletion</h3>
              <p className="text-sm font-medium text-stone-500">Permanently purge your account, profile PII, and revoke all active sessions under GDPR (Google Play Data Safety compliant).</p>
            </div>
          </div>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-5 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-sm"
          >
            Delete Account & Data...
          </button>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-stone-100">
              <div className="flex items-center space-x-3 text-red-600">
                <Trash2 className="w-7 h-7" />
                <h3 className="text-xl font-black text-stone-900">Confirm Account Deletion</h3>
              </div>
              <p className="text-sm text-stone-600 leading-relaxed font-medium">
                This action is <strong className="text-red-600">irreversible</strong>. All your personal profile records, encrypted documents, and sessions will be permanently purged. Primary workspace owners cannot delete accounts while active members remain.
              </p>
              {deleteError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs font-bold rounded-xl border border-red-200">
                  {deleteError}
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-500">
                  Type <span className="text-red-600 font-black">DELETE</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirmationText}
                  onChange={(e) => setDeleteConfirmationText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 font-bold focus:outline-hidden focus:border-red-600"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 bg-stone-100 text-stone-700 font-bold rounded-xl hover:bg-stone-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteConfirmationText !== 'DELETE' || isDeletingAccount}
                  onClick={handleDeleteAccount}
                  className="px-4 py-2 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {isDeletingAccount ? 'Purging...' : 'Permanently Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
