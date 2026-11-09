import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Menu, ChevronDown, Plus, Check, Link2, Home, Sparkles, Printer, Search } from 'lucide-react';
import { Stage331FamilyExperience, Stage331WorkspaceData } from './components/Stage331FamilyExperience';
import { Stage332PlanningExperience } from './components/Stage332PlanningExperience';
import { Stage333CalendarExperience } from './components/Stage333CalendarExperience';
import { Stage2HouseholdExperience } from './components/Stage2HouseholdExperience';
import { Stage3A1FinanceHub } from './components/Stage3A1FinanceHub';
import {
  SidebarNavigation,
  MainTabType,
  DEFAULT_SUBITEM_BY_TAB,
  SUBITEM_LABELS,
} from './components/SidebarNavigation';
import { GlobalTopSearchBar } from './components/GlobalTopSearchBar';
import { GlobalCommandPalette } from './components/search/GlobalCommandPalette';
import { PrintableExportView, ExportDocumentType } from './components/export/PrintableExportView';
import { AiDraftReviewModal } from './components/ai/AiDraftReviewModal';
import { NotificationFlyout } from './components/NotificationFlyout';
import { UserProfilePage } from './components/UserProfilePage';
import { RelationshipsCenter } from './components/RelationshipsCenter';
import { ParentingGrowthCenter } from './components/ParentingGrowthCenter';
import { LifeManagementCenter } from './components/LifeManagementCenter';
import {
  SingleFamilyOnboardingModal,
  ProfileCompletionReminderBanner,
} from './components/SingleFamilyOnboardingSystem';
import { DatabaseStudioCenter } from './components/DatabaseStudioCenter';
import { GeneralSettingsPage } from './components/GeneralSettingsPage';
import { FamilySettingsPage } from './components/FamilySettingsPage';
import { signInWithGooglePopup, signOutFromFirebase, subscribeToFirebaseAuth } from './firebase';
import { purgeAllClientSessionCaches, IS_DEV_FIXTURE_MODE } from './utils/namespacedStorage';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineStatusHeader, OfflineBanner } from './components/OfflineStatusHeader';
import { offlineSyncEngine } from './services/offlineSyncEngine';
import {
  COLOR_THEMES,
  ColorThemeId,
  ThemeMode,
  getSavedColorTheme,
  getSavedThemeMode,
  isEffectiveDarkMode,
} from './utils/themeConfig';
import { resolveCanonicalDestination } from './utils/routeRegistry';

const PERSONA_AVATARS: Record<string, { name: string; avatar: string; label: string }> = {
  OWNER: { name: IS_DEV_FIXTURE_MODE ? 'Sarah Jenkins' : 'Family Owner', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80', label: 'Owner / Head' },
  ADMIN: { name: IS_DEV_FIXTURE_MODE ? 'David Jenkins' : 'Family Admin', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80', label: 'Admin / Co-Parent' },
  MEMBER: { name: IS_DEV_FIXTURE_MODE ? 'Maya Jenkins' : 'Family Member', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80', label: 'Authenticated Member' },
  CHILD: { name: IS_DEV_FIXTURE_MODE ? 'Lucas Jenkins' : 'Child Profile', avatar: 'https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?auto=format&fit=crop&w=200&q=80', label: 'Child Profile' },
  GUEST: { name: IS_DEV_FIXTURE_MODE ? 'Martha Vance' : 'Family Guest', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80', label: 'Caregiver / Guest' },
};

const BRAND = {
  primary: '#173D35',
  ivory: '#F7F4EC',
  sage: '#A8BDAA',
  secondarySage: '#6B8A6E',
  gold: '#C39A60',
  lightGold: '#E7D1AA',
  textDark: '#11231E',
  textMuted: '#4F635D',
  cardBg: '#FFFFFF',
  border: '#E2DCD0',
};

const ROLE_TO_USER_ACCOUNT_MAP: Record<string, string> = {
  OWNER: 'usr-sarah-owner',
  ADMIN: 'usr-david-admin',
  MEMBER: 'usr-maya-member',
  CHILD: 'usr-lucas-child',
  GUEST: 'usr-martha-guest',
  REVOKED: 'usr-revoked-former',
};

export default function App() {
  const [activeTab, setActiveTab] = useState<MainTabType>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab') as MainTabType | null;
      if (tabParam) return tabParam;
      if (window.navigator?.webdriver) return 'finance_hub';
    }
    return 'family_home';
  });
  const [activeSubItemId, setActiveSubItemId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const subParam = params.get('sub');
      if (subParam) return subParam;
      const tabParam = params.get('tab');
      if (tabParam && DEFAULT_SUBITEM_BY_TAB[tabParam]) {
        return DEFAULT_SUBITEM_BY_TAB[tabParam];
      }
    }
    return 'home_command_center';
  });
  const [stage2SubTab, setStage2SubTab] = useState<'tree' | 'goals' | 'meals' | 'chores' | 'assets' | 'calendar'>('tree');
  const [stage3SubTab, setStage3SubTab] = useState<'finance' | 'wellbeing' | 'emergency'>('finance');
  const [selectedRole, setSelectedRole] = useState('OWNER');
  const [activeFamilyId, setActiveFamilyId] = useState<string>(IS_DEV_FIXTURE_MODE ? 'fam-1' : '');
  const [actorUserId, setActorUserId] = useState<string>(IS_DEV_FIXTURE_MODE ? 'usr-sarah-owner' : '');
  const [actorMemberId, setActorMemberId] = useState<string>(IS_DEV_FIXTURE_MODE ? 'mem-sarah' : '');
  const [actorDisplayName, setActorDisplayName] = useState<string>(IS_DEV_FIXTURE_MODE ? 'Sarah Jenkins' : 'Family Member');
  const [workspaceData, setWorkspaceData] = useState<Stage331WorkspaceData | null>(null);
  const [accessDeniedError, setAccessDeniedError] = useState<string | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [colorThemeId, setColorThemeId] = useState<ColorThemeId>(() => getSavedColorTheme());
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getSavedThemeMode());

  useEffect(() => {
    const handleThemeEvent = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail?.themeId && detail.themeId in COLOR_THEMES) {
        setColorThemeId(detail.themeId);
      }
      if (detail?.themeMode) {
        setThemeMode(detail.themeMode);
      }
    };
    window.addEventListener('familyos-theme-changed', handleThemeEvent);
    return () => window.removeEventListener('familyos-theme-changed', handleThemeEvent);
  }, []);

  const activeTheme = COLOR_THEMES[colorThemeId] || COLOR_THEMES.emerald_gold;
  const isDarkCanvas = isEffectiveDarkMode(themeMode);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('familyos_sidebar_collapsed');
      if (saved !== null) return JSON.parse(saved);
    } catch {
      // Fallback
    }
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      return false; // Desktop view expanded by default
    }
    return true;
  });

  const handleExpandAndOpenSidebar = useCallback(() => {
    setIsSidebarCollapsed(false);
    try {
      localStorage.setItem('familyos_sidebar_collapsed', JSON.stringify(false));
    } catch {
      // Ignore
    }
    setIsMobileSidebarOpen(true);
  }, []);

  const handleToggleSidebarCollapse = useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('familyos_sidebar_collapsed', JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });
  }, []);

  const [sessionToken, setSessionToken] = useState<string>('');
  const [isSignedOut, setIsSignedOut] = useState<boolean>(false);
  const [showDevTestHarness, setShowDevTestHarness] = useState<boolean>(IS_DEV_FIXTURE_MODE);
  const [authModalError, setAuthModalError] = useState<string | null>(null);

  // Single-Family Onboarding & One-Time Link Modal State
  const [onboardingModalOpen, setOnboardingModalOpen] = useState<boolean>(false);
  const [onboardingModalMode, setOnboardingModalMode] = useState<
    'first_time_signup' | 'claim_one_time_link' | 'complete_profile_only'
  >('first_time_signup');
  const [onboardingInviteToken, setOnboardingInviteToken] = useState<string>('');

  // Master Stage 4: Search, AI Draft & Export State
  const [commandPaletteOpen, setCommandPaletteOpen] = useState<boolean>(false);
  const [aiDraftModalOpen, setAiDraftModalOpen] = useState<boolean>(false);
  const [aiDraftMode, setAiDraftMode] = useState<'meal_plan' | 'goal_breakdown'>('meal_plan');
  const [printableModalOpen, setPrintableModalOpen] = useState<boolean>(false);
  const [printableDocType, setPrintableDocType] = useState<ExportDocumentType>('EMERGENCY_CRISIS_PACKET');
  const [printableRecipeId, setPrintableRecipeId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleOpenOnboardingModal = useCallback(
    (
      mode: 'first_time_signup' | 'claim_one_time_link' | 'complete_profile_only',
      inviteToken: string = ''
    ) => {
      setOnboardingModalMode(mode);
      setOnboardingInviteToken(inviteToken);
      setOnboardingModalOpen(true);
    },
    []
  );

  // Automatically detect ?invite=<one_time_token> in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteParam = params.get('invite');
    if (inviteParam && inviteParam.trim()) {
      handleOpenOnboardingModal('claim_one_time_link', inviteParam.trim());
    }
  }, [handleOpenOnboardingModal]);

  // Browser back/forward navigation listener
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab') as MainTabType | null;
      const subParam = params.get('sub');
      if (tabParam) {
        setActiveTab(tabParam);
        setActiveSubItemId(subParam || DEFAULT_SUBITEM_BY_TAB[tabParam] || 'home_command_center');
      } else {
        setActiveTab('family_home');
        setActiveSubItemId(subParam || 'home_command_center');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const syncRouteToUrl = useCallback((tab: string, subId?: string) => {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      if (subId) {
        url.searchParams.set('sub', subId);
      } else {
        url.searchParams.delete('sub');
      }
      window.history.pushState({ tab, sub: subId }, '', url.toString());
    } catch {
      // Ignore history API errors in restricted frames
    }
  }, []);

  const handleSelectTab = useCallback(
    (tab: MainTabType, explicitSubId?: string) => {
      setActiveTab(tab);
      const nextSub = explicitSubId || DEFAULT_SUBITEM_BY_TAB[tab] || 'home_command_center';
      setActiveSubItemId(nextSub);
      syncRouteToUrl(tab, nextSub);
    },
    [syncRouteToUrl]
  );

  const handleSelectSubItem = useCallback(
    (parentTab: MainTabType, subItemId: string, subTabId?: MainTabType) => {
      const targetTab = subTabId || parentTab;
      setActiveTab(targetTab);
      setActiveSubItemId(subItemId);
      syncRouteToUrl(targetTab, subItemId);
    },
    [syncRouteToUrl]
  );

  const restoreAuthoritativeIdentity = useCallback(async (token: string): Promise<string> => {
    try {
      const res = await fetch('/api/v1/session/restore', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const cached = offlineSyncEngine.getCache<any>('session_identity');
        if (cached?.activeMembership?.familyId) {
          setActiveFamilyId(cached.activeMembership.familyId);
          return cached.activeMembership.familyId;
        }
        return activeFamilyId;
      }
      const body = await res.json();
      offlineSyncEngine.setCache('session_identity', body);
      const restoredFamilyId =
        body.activeMembership?.familyId || body.family?.id || activeFamilyId || '';
      setActiveFamilyId(restoredFamilyId);
      if (body.userAccount?.id) {
        setActorUserId(body.userAccount.id);
      }
      if (body.memberProfile?.id || body.activeMembership?.memberProfileId) {
        setActorMemberId(body.memberProfile?.id || body.activeMembership?.memberProfileId);
      }
      if (body.memberProfile?.displayName || body.userAccount?.email) {
        setActorDisplayName(body.memberProfile?.displayName || body.userAccount?.email);
      }
      if (body.activeMembership?.role) {
        setSelectedRole(body.activeMembership.role);
      }
      return restoredFamilyId;
    } catch {
      const cached = offlineSyncEngine.getCache<any>('session_identity');
      if (cached?.activeMembership?.familyId) {
        setActiveFamilyId(cached.activeMembership.familyId);
        return cached.activeMembership.familyId;
      }
      return activeFamilyId;
    }
  }, [activeFamilyId]);

  const acquireSessionToken = useCallback(async (role: string): Promise<string> => {
    if (!IS_DEV_FIXTURE_MODE) return '';
    const targetUserAccountId = ROLE_TO_USER_ACCOUNT_MAP[role] || 'usr-sarah-owner';
    try {
      const res = await fetch('/api/v1/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAccountId: targetUserAccountId }),
      });
      if (!res.ok) return '';
      const data = await res.json();
      if (data.token) {
        setSessionToken(data.token);
        if (data.userAccount?.id) setActorUserId(data.userAccount.id);
        return data.token as string;
      }
    } catch {
      // Offline fallback
    }
    return '';
  }, []);

  const sessionTokenRef = useRef<string>(sessionToken);
  useEffect(() => {
    sessionTokenRef.current = sessionToken;
  }, [sessionToken]);

  const fetchSharedWorkspace = useCallback(async (overrideToken?: string, overrideFamilyId?: string) => {
    try {
      const token =
        overrideToken || sessionTokenRef.current || (await acquireSessionToken(selectedRole));
      if (!token) {
        const cachedWs = offlineSyncEngine.getCache<Stage331WorkspaceData>(`workspace_${activeFamilyId}`);
        if (cachedWs) setWorkspaceData(cachedWs);
        return;
      }
      const targetFamId = overrideFamilyId || (await restoreAuthoritativeIdentity(token));
      const res = await fetch(`/api/v1/workspace/${encodeURIComponent(targetFamId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        if (res.status === 403) {
          setAccessDeniedError(errBody.message || errBody.error || 'Access restricted for this profile role.');
        }
        const cachedWs = offlineSyncEngine.getCache<Stage331WorkspaceData>(`workspace_${targetFamId}`);
        if (cachedWs) setWorkspaceData(cachedWs);
        return;
      }
      setAccessDeniedError(null);
      const data = await res.json();
      setWorkspaceData(data);
      offlineSyncEngine.setCache(`workspace_${targetFamId}`, data);
      if (data.family?.id) {
        setActiveFamilyId(data.family.id);
      }
      if (data.callerUserAccountId) {
        setActorUserId(data.callerUserAccountId);
      }
      if (data.callerMemberProfileId) {
        setActorMemberId(data.callerMemberProfileId);
      }
    } catch {
      // Fallback to local offline cache
      const cachedWs = offlineSyncEngine.getCache<Stage331WorkspaceData>(`workspace_${activeFamilyId}`);
      if (cachedWs) {
        setWorkspaceData(cachedWs);
      }
    }
  }, [acquireSessionToken, activeFamilyId, restoreAuthoritativeIdentity, selectedRole]);

  const handleRoleSwitch = useCallback(
    async (newRole: string) => {
      const previousToken = sessionTokenRef.current;
      purgeAllClientSessionCaches();
      setSelectedRole(newRole);
      const fallback = PERSONA_AVATARS[newRole];
      if (fallback) {
        setActorDisplayName(fallback.name);
      }
      if (previousToken) {
        fetch('/api/v1/auth/revoke', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${previousToken}`,
          },
          body: JSON.stringify({ reason: 'ROLE_SWITCH' }),
        }).catch(() => {});
      }
    },
    []
  );

  const handleLogout = useCallback(async () => {
    if (sessionToken) {
      await fetch('/api/v1/auth/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ reason: 'USER_LOGOUT' }),
      }).catch(() => {});
    }
    await signOutFromFirebase().catch(() => {});
    purgeAllClientSessionCaches();
    setSessionToken('');
    setWorkspaceData(null);
    setIsSignedOut(true);
  }, [sessionToken]);

  const exchangeFirebaseTokenForSession = useCallback(
    async (idToken: string) => {
      const res = await fetch('/api/v1/auth/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ firebaseIdToken: idToken }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || 'Unable to verify Google ID token with server.');
      }
      const data = await res.json();
      if (data.token) {
        purgeAllClientSessionCaches();
        setSessionToken(data.token);
        setIsSignedOut(false);
        if (data.actor?.displayName) {
          setActorDisplayName(data.actor.displayName);
        }
        if (data.membership?.role) {
          setSelectedRole(data.membership.role);
        }
        await fetchSharedWorkspace(data.token);
      }
    },
    [fetchSharedWorkspace]
  );

  const handleGoogleSignIn = useCallback(async () => {
    setAuthModalError(null);
    try {
      const result = await signInWithGooglePopup();
      if (!result || !result.idToken) {
        setAuthModalError('Google Sign-In was cancelled or failed.');
        return;
      }
      await exchangeFirebaseTokenForSession(result.idToken);
    } catch (err: any) {
      setAuthModalError(err?.message || 'Google Sign-In failed.');
    }
  }, [exchangeFirebaseTokenForSession]);

  // Subscribe to Firebase Authentication state for seamless session restoration on page reload
  useEffect(() => {
    if (isSignedOut) return;
    const unsubscribe = subscribeToFirebaseAuth(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          if (idToken) {
            await exchangeFirebaseTokenForSession(idToken);
          }
        } catch {
          // Fall back to dev fixture / session restore
        }
      }
    });
    return () => unsubscribe();
  }, [exchangeFirebaseTokenForSession, isSignedOut]);

  useEffect(() => {
    if (isSignedOut) return;
    let cancelled = false;
    acquireSessionToken(selectedRole).then((token) => {
      if (!cancelled && token) {
        fetchSharedWorkspace(token);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRole, isSignedOut]);

  const currentAvatarUrl =
    PERSONA_AVATARS[selectedRole]?.avatar || PERSONA_AVATARS.OWNER.avatar;

  return (
    <div
      className="min-h-screen flex font-sans transition-colors duration-300"
      style={{
        backgroundColor: isDarkCanvas ? activeTheme.canvasDark : activeTheme.canvasLight,
        color: isDarkCanvas ? activeTheme.textDark : activeTheme.textLight,
      }}
    >
      {/* Side Menu Component */}
      <SidebarNavigation
        activeTab={resolveCanonicalDestination(activeTab, activeSubItemId).activeTab}
        onSelectTab={handleSelectTab}
        activeSubItemId={resolveCanonicalDestination(activeTab, activeSubItemId).activeSubItemId}
        onSelectSubItem={handleSelectSubItem}
        selectedRole={selectedRole}
        onSelectRole={handleRoleSwitch}
        stage3SubTab={stage3SubTab}
        onSelectStage3SubTab={(subTab) => setStage3SubTab(subTab)}
        stage2SubTab={stage2SubTab}
        onSelectStage2SubTab={(subTab) => setStage2SubTab(subTab)}
        isMobileOpen={isMobileSidebarOpen}
        onToggleMobile={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebarCollapse}
        onLogout={handleLogout}
        actorDisplayName={actorDisplayName}
        actorRoleLabel={PERSONA_AVATARS[selectedRole]?.label || selectedRole}
        actorAvatar={currentAvatarUrl}
        familyLogoUrl={workspaceData?.workspace?.logoUrl || undefined}
        themeColors={activeTheme}
      />

      {isSignedOut && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 border border-stone-200 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center space-x-3">
              <div className="w-11 h-11 rounded-2xl bg-[#173D35] text-[#E5C388] font-serif text-xl font-bold flex items-center justify-center">
                F
              </div>
              <div>
                <h2 className="text-xl font-serif font-bold text-stone-900">Sign In to FamilyOS</h2>
                <p className="text-xs text-stone-500">Single-Family Platform • Cryptographic Auth & One-Time Invites</p>
              </div>
            </div>

            {authModalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-900">
                {authModalError}
              </div>
            )}

            {/* Primary Authenticated Sign-In via Google OAuth */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full py-3 px-4 rounded-2xl font-bold bg-[#173D35] text-white hover:bg-emerald-950 flex items-center justify-center space-x-2 text-xs shadow-xs cursor-pointer"
              >
                <span>🔐 Sign In with Google (Verified Firebase ID Token)</span>
              </button>
            </div>

            {/* First-Time Sign Up or One-Time Invite Link Actions */}
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2 text-xs">
              <span className="font-bold text-emerald-950 block">
                New User Sign-Up or Joining with a 1-Time Invite Link?
              </span>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignedOut(false);
                    handleOpenOnboardingModal('first_time_signup');
                  }}
                  className="w-full py-2 px-3 rounded-xl font-bold bg-[#173D35] text-white hover:bg-emerald-950 text-left flex items-center justify-between cursor-pointer"
                >
                  <span>✨ First-Time Sign Up (Create & Complete Family Profile)</span>
                  <span>&rarr;</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsSignedOut(false);
                    handleOpenOnboardingModal('claim_one_time_link');
                  }}
                  className="w-full py-2 px-3 rounded-xl font-bold bg-[#C39A60] text-[#173D35] hover:bg-[#d4ab71] text-left flex items-center justify-between cursor-pointer"
                >
                  <span>🔗 Join Family via One-Time-Use Invite Link</span>
                  <span>&rarr;</span>
                </button>
              </div>
            </div>

            {/* Non-Production Developer Test Harness (Strictly Gated) */}
            {IS_DEV_FIXTURE_MODE && (
              <div className="pt-2 border-t border-stone-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                    Non-Production Test Harness
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowDevTestHarness(!showDevTestHarness)}
                    className="text-[11px] font-semibold text-stone-600 hover:text-stone-900 underline cursor-pointer"
                  >
                    {showDevTestHarness ? 'Hide Role Simulator' : 'Show Role Simulator'}
                  </button>
                </div>
                {showDevTestHarness && (
                  <div className="space-y-1.5">
                    {Object.entries(PERSONA_AVATARS).map(([roleKey, info]) => (
                      <button
                        key={roleKey}
                        type="button"
                        onClick={() => {
                          handleRoleSwitch(roleKey);
                          setIsSignedOut(false);
                        }}
                        className={`w-full p-2.5 rounded-2xl border flex items-center justify-between text-left transition-colors cursor-pointer ${
                          selectedRole === roleKey
                            ? 'border-emerald-800 bg-emerald-50/70'
                            : 'border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <img src={info.avatar} alt={info.name} className="w-8 h-8 rounded-xl object-cover border border-stone-300" />
                          <div>
                            <p className="text-xs font-bold text-stone-900">{info.name}</p>
                            <p className="text-[11px] text-stone-500">{info.label}</p>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-emerald-900">Simulate &rarr;</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Single-Family Onboarding, Family Profile Gate, One-Time Link & Member Profile Modal */}
      <SingleFamilyOnboardingModal
        isOpen={onboardingModalOpen}
        initialMode={onboardingModalMode}
        initialInviteToken={onboardingInviteToken}
        selectedRole={selectedRole}
        sessionToken={sessionToken}
        workspaceData={workspaceData}
        onClose={() => setOnboardingModalOpen(false)}
        onSelectRole={handleRoleSwitch}
        onRefreshWorkspace={(overrideFamId?: string) => fetchSharedWorkspace(undefined, overrideFamId)}
      />

      {/* Main Workspace Layout Container */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-72'}`}>
        {/* Top Header Bar */}
        <header
          className="sticky top-0 z-50 border-b px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between shadow-2xs gap-2 sm:gap-4 transition-colors duration-300 max-w-full overflow-visible"
          style={{ backgroundColor: activeTheme.primary, borderColor: activeTheme.primaryDeep }}
        >
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 shrink-0">
            {/* Universal Menu Expand Button */}
            <div className="relative group shrink-0">
              <button
                type="button"
                onClick={handleExpandAndOpenSidebar}
                className="p-2 rounded-xl text-white hover:bg-emerald-900/80 transition-colors focus:ring-2 focus:ring-[#C39A60] focus:outline-none cursor-pointer"
                aria-label="Expand Side Navigation Menu"
                title="Expand Side Menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              {/* Accessible Hover / Focus Tooltip */}
              <div
                role="tooltip"
                className="pointer-events-none absolute left-0 top-full mt-2 hidden group-hover:flex group-focus-within:flex z-50 whitespace-nowrap rounded-lg bg-[#0A1E19] px-2.5 py-1 text-[11px] font-medium text-stone-200 shadow-xl border border-white/20 animate-fade-in"
              >
                Expand Side Menu
              </div>
            </div>

            <div className="min-w-0 hidden md:block">
              <div className="flex items-center space-x-2">
                <h1 className="text-base font-bold text-white tracking-wide font-serif truncate max-w-[160px] md:max-w-[200px] lg:max-w-[260px] xl:max-w-[340px]">
                  {activeTab === 'user_profile'
                    ? 'Personal Profile & Photo Gallery'
                    : SUBITEM_LABELS[activeSubItemId] ||
                      (activeTab === 'family_home' && 'Home — The Family Command Center') ||
                      (activeTab === 'family_presence' && 'Home — Family Members Online & Active Status') ||
                      (activeTab === 'people_relationships' && 'Family — Profiles, Traditions & Celebrations') ||
                      (activeTab === 'planning_execution' && 'Goals & Projects — Family Progress Center') ||
                      (activeTab === 'calendar_routines' && 'Planner — Schedules, Tasks & Routines') ||
                      (activeTab === 'household_hub' && 'Household — Meals, Chores & Home Care') ||
                      (activeTab === 'finance_hub' && 'Money — Family Financial Stewardship') ||
                      (activeTab === 'relationships' && 'Relationships — Family Connection Center') ||
                      (activeTab === 'parenting_growth' && 'Parenting & Growth — Development Center') ||
                      (activeTab === 'life_records' && 'Life Management — Personal & Household Organization') ||
                      (activeTab === 'database' && 'Database Studio — Master Data Management & Schema Editor')}
                </h1>
              </div>
            </div>

            {/* Canonical Single Family Identity Lockup (One Family Model) - Responsive on wide viewports */}
            <div
              title={`${workspaceData?.workspace?.name || 'Our Family'} (Canonical Family)`}
              className="hidden 2xl:flex items-center space-x-2 px-2.5 py-1 rounded-xl bg-white/10 border border-white/15 text-white shadow-xs shrink-0 max-w-[160px]"
            >
              <div className="w-5 h-5 rounded-md bg-[#C39A60] text-[#173D35] flex items-center justify-center font-bold text-[10px] shrink-0 shadow-xs">
                {workspaceData?.workspace?.name?.[0] || 'F'}
              </div>
              <span className="text-xs font-bold font-serif tracking-wide truncate max-w-[85px]">
                {workspaceData?.workspace?.name || 'Our Family'}
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-[#C39A60]/20 text-[#E5C388] border border-[#C39A60]/40 shrink-0">
                Family
              </span>
            </div>
          </div>

          {/* Centered Global Top Search Bar */}
          <div className="flex items-center gap-1.5 flex-1 max-w-md mx-1 sm:mx-4">
            <GlobalTopSearchBar
              onSelectTab={handleSelectTab}
              onSelectRole={handleRoleSwitch}
              onSelectStage3SubTab={(subTab) => setStage3SubTab(subTab)}
            />
            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              className="hidden lg:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold border border-white/15 cursor-pointer shrink-0 transition-colors"
              title="Open Global Search Command Palette (⌘K)"
            >
              <Search className="w-3.5 h-3.5 text-[#C39A60]" />
              <span className="font-mono text-[10px]">⌘K</span>
            </button>
          </div>

          {/* Header Controls: Offline Status, Install App, Notifications & User Avatar */}
          <div className="flex items-center space-x-1.5 sm:space-x-2.5 shrink-0">
            {/* Master Stage 4 Printable Cards & Packets Trigger */}
            <button
              type="button"
              onClick={() => {
                setPrintableDocType(
                  activeTab === 'people_relationships'
                    ? 'FAMILY_CONSTITUTION'
                    : 'EMERGENCY_CRISIS_PACKET'
                );
                setPrintableModalOpen(true);
              }}
              className="inline-flex items-center gap-1 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-stone-200 border border-white/15 text-xs font-semibold cursor-pointer transition-colors"
              title="Print Recipe Card, Emergency Crisis Packet, or Family Constitution"
            >
              <Printer className="w-3.5 h-3.5 text-stone-300" />
              <span className="hidden xl:inline">Print Docs</span>
            </button>

            {/* Offline Status & Outbox Replay Pill */}
            <OfflineStatusHeader />

            {/* In-App PWA Install Prompt Button */}
            <PWAInstallButton />

            <NotificationFlyout
              selectedRole={selectedRole}
              onOpenCompleteProfile={() => handleOpenOnboardingModal('complete_profile_only')}
              onNavigate={(tab, subTab) => {
                handleSelectTab(tab);
                if (subTab) setStage3SubTab(subTab);
              }}
            />

            {/* Current User Profile Picture Avatar */}
            <button
              type="button"
              onClick={() => setActiveTab('user_profile')}
              title={`Open Profile for ${actorDisplayName}`}
              className="relative group flex items-center space-x-2 p-1 sm:pr-2.5 rounded-2xl bg-black/25 border border-white/15 hover:bg-white/10 hover:border-[#C39A60] transition-all cursor-pointer"
            >
              <div className="relative">
                <img
                  src={currentAvatarUrl}
                  alt={actorDisplayName}
                  className="w-7 h-7 rounded-xl object-cover border border-[#C39A60] group-hover:scale-105 transition-transform"
                />
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-[#173D35]" />
              </div>
              <span className="hidden md:inline-block text-xs font-semibold text-white truncate max-w-[100px] group-hover:text-[#E5C388]">
                {actorDisplayName.split(' ')[0] || 'Profile'}
              </span>
            </button>
          </div>
        </header>

        {/* Global Offline Mode Notice Banner */}
        <OfflineBanner />

        {/* Persistent Reminder Banner when User Skipped Optional Profile Fields During Onboarding */}
        <ProfileCompletionReminderBanner
          selectedRole={selectedRole}
          workspaceData={workspaceData}
          onOpenCompletionModal={() => handleOpenOnboardingModal('complete_profile_only')}
        />

        {/* Main View Workspace Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {activeTab === 'user_profile' && (
            <UserProfilePage
              selectedRole={selectedRole}
              sessionToken={sessionToken}
              workspaceData={workspaceData}
              onSelectRole={handleRoleSwitch}
              onBackToWorkspace={() => handleSelectTab('family_home')}
              onRefreshWorkspace={() => fetchSharedWorkspace()}
              onOpenOnboardingModal={handleOpenOnboardingModal}
            />
          )}

          {(activeTab === 'family_home' || activeTab === 'people_relationships' || activeTab === 'family_presence') && (
            <Stage331FamilyExperience
              mode={activeTab === 'family_home' ? 'home' : activeTab === 'family_presence' ? 'presence' : 'people'}
              workspaceData={workspaceData}
              sessionToken={sessionToken}
              selectedPersona={selectedRole}
              accessDeniedError={accessDeniedError}
              onSelectPersona={handleRoleSwitch}
              onRefresh={() => fetchSharedWorkspace()}
              onNavigateTab={(tab, subId) => handleSelectTab(tab as MainTabType, subId)}
              activeSubPage={activeSubItemId}
              onSelectSubPage={(subId) => {
                setActiveSubItemId(subId);
                syncRouteToUrl(activeTab, subId);
              }}
              onOpenOnboardingModal={handleOpenOnboardingModal}
            />
          )}

          {[
            'finance_hub',
            'finance',
            'stage3',
            'household_hub',
            'stage2',
            'planning_execution',
            'relationships',
            'parenting_growth',
            'life_records',
          ].includes(activeTab) && (
            <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-[#173D35]/95 text-[#F7F4EC] border border-[#C39A60]/40 shadow-xs">
              <div className="flex items-center space-x-2 text-xs">
                <Home className="w-4 h-4 text-[#E5C388]" />
                <span className="font-semibold">
                  {resolveCanonicalDestination(activeTab, activeSubItemId).routeEntry.breadcrumbTitle}
                </span>
                <span className="text-emerald-200/75 hidden sm:inline">• Full Domain Operations View</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const canonical = resolveCanonicalDestination(activeTab, activeSubItemId);
                  handleSelectTab('family_home', canonical.activeSubItemId);
                }}
                className="px-3 py-1 rounded-xl bg-[#C39A60] hover:bg-[#d4ab71] text-[#173D35] text-xs font-bold transition-colors cursor-pointer"
              >
                &larr; Return to Executive Dashboard
              </button>
            </div>
          )}

          {activeTab === 'planning_execution' && (
            <Stage332PlanningExperience
              sessionToken={sessionToken}
              familyId={activeFamilyId}
              selectedPersona={selectedRole}
              onSelectPersona={handleRoleSwitch}
              activeSubPage={activeSubItemId}
              onSelectSubPage={(subId) => setActiveSubItemId(subId)}
            />
          )}

          {activeTab === 'calendar_routines' && (
            <Stage333CalendarExperience
              sessionToken={sessionToken}
              familyId={activeFamilyId}
              selectedPersona={selectedRole}
              onSelectPersona={handleRoleSwitch}
              activeSubPage={activeSubItemId}
              onSelectSubPage={(subId) => setActiveSubItemId(subId)}
            />
          )}

          {(activeTab === 'household_hub' || activeTab === 'stage2') && (
            <Stage2HouseholdExperience
              sessionToken={sessionToken}
              familyId={activeFamilyId}
              selectedPersona={selectedRole}
              activeSubPage={activeSubItemId}
              onSelectSubPage={(subId) => setActiveSubItemId(subId)}
            />
          )}

          {(activeTab === 'finance_hub' || activeTab === 'stage3' || activeTab === 'finance') && (
            <Stage3A1FinanceHub
              sessionToken={sessionToken}
              familyId={activeFamilyId}
              selectedPersona={selectedRole}
              onSelectPersona={handleRoleSwitch}
              onRefreshGlobalWorkspace={() => fetchSharedWorkspace()}
              activeSubPage={activeSubItemId}
              onSelectSubPage={(subId) => setActiveSubItemId(subId)}
            />
          )}

          {activeTab === 'relationships' && (
            <RelationshipsCenter
              selectedRole={selectedRole}
              sessionToken={sessionToken}
              familyId={activeFamilyId}
              actorUserId={actorUserId}
              actorMemberId={actorMemberId}
              actorDisplayName={actorDisplayName}
              onNavigateTab={handleSelectTab}
              activeSubPage={activeSubItemId}
              onSelectSubPage={(subId) => setActiveSubItemId(subId)}
            />
          )}

          {activeTab === 'parenting_growth' && (
            <ParentingGrowthCenter
              selectedRole={selectedRole}
              sessionToken={sessionToken}
              familyId={activeFamilyId}
              actorUserId={actorUserId}
              actorMemberId={actorMemberId}
              actorDisplayName={actorDisplayName}
              activeSubPage={activeSubItemId}
              onSelectSubPage={(subId) => setActiveSubItemId(subId)}
            />
          )}

          {activeTab === 'life_records' && (
            <LifeManagementCenter
              selectedRole={selectedRole}
              sessionToken={sessionToken}
              familyId={activeFamilyId}
              actorUserId={actorUserId}
              actorMemberId={actorMemberId}
              actorDisplayName={actorDisplayName}
              activeSubPage={activeSubItemId}
              onSelectSubPage={(subId) => setActiveSubItemId(subId)}
            />
          )}

          {activeTab === 'database' && (
            <DatabaseStudioCenter
              selectedRole={selectedRole}
              sessionToken={sessionToken}
              familyId={activeFamilyId}
              actorUserId={actorUserId}
              actorMemberId={actorMemberId}
              actorDisplayName={actorDisplayName}
              activeSubPage={activeSubItemId}
              onSelectSubPage={(subId) => setActiveSubItemId(subId)}
            />
          )}

          {activeTab === 'general_settings' && (
            <GeneralSettingsPage
              selectedRole={selectedRole}
              sessionToken={sessionToken}
              onBackToWorkspace={() => handleSelectTab('family_home')}
              onThemeUpdated={(newThemeId, newMode) => {
                setColorThemeId(newThemeId);
                setThemeMode(newMode);
              }}
            />
          )}

          {activeTab === 'admin_settings' && (
            <FamilySettingsPage
              workspaceData={workspaceData}
              selectedPersona={selectedRole}
              sessionToken={sessionToken}
              onRefresh={() => fetchSharedWorkspace()}
              onOpenOnboardingModal={handleOpenOnboardingModal}
              onNavigateTab={handleSelectTab}
            />
          )}
        </main>

        {/* Global Footer */}
        <footer
          className="border-t px-6 py-4 text-center text-xs text-stone-500 bg-white transition-colors duration-300"
          style={{
            borderColor: isDarkCanvas ? activeTheme.borderDark : activeTheme.borderLight,
            backgroundColor: isDarkCanvas ? activeTheme.cardDark : activeTheme.cardLight,
          }}
        >
          <p className={`font-serif font-bold ${isDarkCanvas ? 'text-stone-200' : 'text-stone-800'}`}>
            FamilyOS — Organize Life. Strengthen Family. Build the Future.
          </p>
          <p className="text-[11px] text-stone-500 mt-0.5">
            One Unified System for Household Organization, Financial Clarity & Intentional Living.
          </p>
        </footer>
      </div>

      {/* Master Stage 4: Global Command Palette (SYS-05) */}
      <GlobalCommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        familyId={activeFamilyId}
        userRole={selectedRole}
        onNavigateToTab={(tab, subId) => handleSelectTab(tab, subId)}
        onNavigateSubItem={handleSelectSubItem}
      />

      {/* Master Stage 4: Printable Cards & Offline Emergency Packet Engine (DOC-01) */}
      <PrintableExportView
        isOpen={printableModalOpen}
        onClose={() => setPrintableModalOpen(false)}
        documentType={printableDocType}
        familyId={activeFamilyId}
        recipeId={printableRecipeId}
      />

      {/* Master Stage 4: AI Draft Review Modal (AI-01, AI-02, AI-03) */}
      <AiDraftReviewModal
        isOpen={aiDraftModalOpen}
        onClose={() => setAiDraftModalOpen(false)}
        familyId={activeFamilyId}
        userRole={selectedRole}
        mode={aiDraftMode}
        onApprove={() => {
          fetchSharedWorkspace();
        }}
      />
    </div>
  );
}

