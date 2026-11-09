import React, { useState } from 'react';
import {
  Compass,
  Users,
  Calendar,
  Shield,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  X,
  LogOut,
  UserCog,
  Star,
  Pin,
} from 'lucide-react';
import { resolveCanonicalDestination } from '../utils/routeRegistry';

export type MainTabType =
  | 'family_home'
  | 'family_presence'
  | 'people_relationships'
  | 'planning_execution'
  | 'calendar_routines'
  | 'household_hub'
  | 'finance_hub'
  | 'relationships'
  | 'parenting_growth'
  | 'life_records'
  | 'stage3'
  | 'stage2'
  | 'overview'
  | 'database'
  | 'rbac'
  | 'finance'
  | 'sync'
  | 'tests'
  | 'docs'
  | 'user_profile'
  | 'general_settings'
  | 'admin_settings';

export interface SidebarNavigationProps {
  activeTab: MainTabType;
  onSelectTab: (tab: MainTabType) => void;
  activeSubItemId?: string;
  onSelectSubItem?: (parentTab: MainTabType, subItemId: string, subTabId?: MainTabType) => void;
  selectedRole: string;
  onSelectRole: (role: string) => void;
  stage3SubTab?: 'finance' | 'wellbeing' | 'emergency';
  onSelectStage3SubTab?: (subTab: 'finance' | 'wellbeing' | 'emergency') => void;
  stage2SubTab?: 'tree' | 'goals' | 'meals' | 'chores' | 'assets' | 'calendar';
  onSelectStage2SubTab?: (subTab: 'tree' | 'goals' | 'meals' | 'chores' | 'assets' | 'calendar') => void;
  authStatusText?: string;
  isMobileOpen: boolean;
  onToggleMobile: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onLogout?: () => void;
  actorDisplayName?: string;
  actorRoleLabel?: string;
  actorAvatar?: string;
  familyLogoUrl?: string;
  themeColors?: {
    primary: string;
    primaryDark: string;
    primaryDeep: string;
    accent: string;
    accentLight: string;
  };
}

const USER_PROFILES: Record<string, { name: string; roleLabel: string; avatar: string }> = {
  OWNER: {
    name: 'Family Owner',
    roleLabel: 'Owner / Parent Head',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
  },
  ADMIN: {
    name: 'Family Admin',
    roleLabel: 'Admin / Co-Parent',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
  },
  MEMBER: {
    name: 'Family Member',
    roleLabel: 'Authenticated Member',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80',
  },
  CHILD: {
    name: 'Child Profile',
    roleLabel: 'Child / Minor',
    avatar: 'https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?auto=format&fit=crop&w=200&q=80',
  },
  GUEST: {
    name: 'Family Guest',
    roleLabel: 'Guest / Caregiver',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
  },
};

export interface SidebarMenuItem {
  id: MainTabType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  subitems?: Array<{ id: string; label: string; tabId?: MainTabType; allowedRoles?: string[] }>;
}

export interface PinnedFavoriteItem {
  parentTab: MainTabType;
  subId: string;
  label: string;
  tabId?: MainTabType;
}

const DEFAULT_PINNED_FAVORITES: PinnedFavoriteItem[] = [
  { parentTab: 'family_home', subId: 'home_command_center', label: 'Main Command Center', tabId: 'family_home' },
  { parentTab: 'family_home', subId: 'home_finance_dashboard', label: 'Finance Dashboard', tabId: 'family_home' },
  { parentTab: 'family_home', subId: 'home_house_dashboard', label: 'Household Dashboard', tabId: 'family_home' },
  { parentTab: 'people_relationships', subId: 'people_gallery', label: 'Family Gallery', tabId: 'people_relationships' },
];

export const CATEGORY_1_CORE_ITEMS: SidebarMenuItem[] = [
  {
    id: 'family_home',
    label: 'Home',
    icon: Compass,
    badge: '7 Views',
    subitems: [
      { id: 'home_command_center', label: 'Main Command Center', tabId: 'family_home' },
      { id: 'home_finance_dashboard', label: 'Finance Dashboard', tabId: 'family_home' },
      { id: 'home_house_dashboard', label: 'Household Dashboard', tabId: 'family_home' },
      { id: 'home_goals_dashboard', label: 'Goals & Projects Dashboard', tabId: 'family_home' },
      { id: 'home_relationship_dashboard', label: 'Relationship Dashboard', tabId: 'family_home' },
      { id: 'home_parenting_dashboard', label: 'Parenting & Growth Dashboard', tabId: 'family_home' },
      { id: 'home_life_dashboard', label: 'Life Management Dashboard', tabId: 'family_home' },
    ],
  },
  {
    id: 'people_relationships',
    label: 'Family',
    icon: Users,
    badge: 'Heritage',
    subitems: [
      { id: 'home_overview', label: 'Family Home Overview', tabId: 'people_relationships' },
      { id: 'people_gallery', label: 'Family Gallery', tabId: 'people_relationships' },
      { id: 'home_constitution', label: 'Family Constitution', tabId: 'people_relationships' },
      { id: 'people_traditions', label: 'Family Traditions & Culture', tabId: 'people_relationships' },
      { id: 'people_activities', label: 'Shared Activities', tabId: 'people_relationships' },
      { id: 'people_rules', label: 'Family Rules & Principles', tabId: 'people_relationships' },
    ],
  },
];

export const CATEGORY_2_PLANNER_ITEMS: SidebarMenuItem[] = [
  {
    id: 'calendar_routines',
    label: 'Planner',
    icon: Calendar,
    badge: 'Schedules',
    subitems: [
      { id: 'cal_schedule', label: 'Calendar', tabId: 'calendar_routines' },
      { id: 'cal_routines', label: 'Routines', tabId: 'calendar_routines' },
    ],
  },
];

export const CATEGORY_3_ACCOUNT_SETTINGS_ITEMS: SidebarMenuItem[] = [
  {
    id: 'admin_settings',
    label: 'Account & Settings',
    icon: Shield,
    badge: 'System',
    subitems: [
      { id: 'user_profile', label: 'Profile', tabId: 'user_profile' },
      { id: 'admin_settings', label: 'Family Settings', tabId: 'admin_settings' },
      { id: 'general_settings', label: 'App Preferences', tabId: 'general_settings' },
      {
        id: 'database',
        label: 'Authorized Administration & Diagnostics',
        tabId: 'database',
        allowedRoles: ['OWNER', 'ADMIN'],
      },
    ],
  },
];

export const DEFAULT_SUBITEM_BY_TAB: Record<string, string> = {
  family_home: 'home_command_center',
  people_relationships: 'home_overview',
  calendar_routines: 'cal_schedule',
  finance_hub: 'fin_accounts',
  household_hub: 'house_meals',
  planning_execution: 'plan_goals',
  relationships: 'rel_checkins',
  parenting_growth: 'parent_resources',
  life_records: 'life_dashboard',
  database: 'db_all',
  general_settings: 'general_settings',
  admin_settings: 'admin_settings',
};

export const SUBITEM_LABELS: Record<string, string> = {
  home_command_center: 'Home — Main Command Center',
  home_finance_dashboard: 'Home — Finance Dashboard',
  home_house_dashboard: 'Home — Household Dashboard',
  home_goals_dashboard: 'Home — Goals & Projects Dashboard',
  home_relationship_dashboard: 'Home — Relationship Dashboard',
  home_parenting_dashboard: 'Home — Parenting & Growth Dashboard',
  home_life_dashboard: 'Home — Life Management Dashboard',
  home_overview: 'Family — Family Home Overview',
  people_gallery: 'Family — Family Gallery',
  home_constitution: 'Family — Family Constitution',
  people_traditions: 'Family — Family Traditions & Culture',
  people_activities: 'Family — Shared Activities',
  people_rules: 'Family — Family Rules & Principles',
  cal_schedule: 'Planner — Master Family Calendar',
  cal_events: 'Planner — Shared Events & Milestones',
  cal_routines: 'Planner — Daily Routines & Habits',
  cal_synced: 'Planner — Synced Household Calendar',
  fin_accounts: 'Money — Accounts & Cash Flow',
  fin_transactions: 'Money — Income & Expense Ledger',
  fin_budgets: 'Money — Envelope Budgets',
  fin_savings: 'Money — Savings & Reserves',
  fin_recurring: 'Money — Recurring Bills & Subscriptions',
  fin_investments: 'Money — Household Net Worth',
  house_meals: 'Household — 7-Day Meal Planner',
  house_recipes: 'Household — Recipe Collection',
  house_pantry: 'Household — Pantry & Expiry Tracking',
  house_groceries: 'Household — Smart Grocery List',
  house_chores: 'Household — Chores & Responsibility Points',
  house_wardrobe: 'Household — Wardrobe & Outfits',
  house_assets: 'Household — Home Assets & Maintenance',
  plan_goals: 'Goals & Projects — Strategic Family Goals',
  plan_projects: 'Goals & Projects — Active Household Projects',
  plan_tasks: 'Goals & Projects — Action Tasks & Milestones',
  plan_rewards: 'Goals & Projects — Achievement & Reward Points',
  rel_checkins: 'Relationships — Relationship Check-ins',
  rel_appreciation: 'Relationships — Gratitude & Appreciation Wall',
  rel_couple: 'Relationships — Couple Connection',
  rel_communication: 'Relationships — Family Communication & Meetings',
  rel_experiences: 'Relationships — Shared Experiences & Memories',
  rel_reflection: 'Relationships — Shared Agreements & Reflection',
  rel_external_crm: 'Relationships — External Network & CRM',
  rel_network: 'Relationships — External Network & CRM',
  parent_resources: 'Parenting & Growth — Parenting Resources',
  parent_profiles: 'Parenting & Growth — Child Profiles & Milestones',
  parent_routines: 'Parenting & Growth — Children’s Routines',
  parent_education: 'Parenting & Growth — Education & Learning',
  parent_personal: 'Parenting & Growth — Personal Development',
  parent_micro: 'Parenting & Growth — Micro-Learning Library',
  parent_wellbeing: 'Parenting & Growth — Wellbeing & Healthy Habits',
  parent_family_learning: 'Parenting & Growth — Family Learning & Curricula',
  life_dashboard: 'Life Management — Personal Dashboard',
  life_docs: 'Life Management — Important Documents & Records',
  life_organization: 'Life Management — Personal Organization',
  life_contacts: 'Life Management — Important & Emergency Contacts',
  life_travel: 'Life Management — Travel & Holiday Planning',
  life_vehicles: 'Life Management — Vehicle Management',
  life_longterm: 'Life Management — Long-Term Family Planning',
  db_all: 'Database Studio — All Databases & Tables',
  db_governance: 'Database Studio — Core Governance DB',
  db_finance: 'Database Studio — Financial Stewardship DB',
  db_household: 'Database Studio — Household Operations DB',
  db_planner: 'Database Studio — Planner & Routines DB',
  db_goals: 'Database Studio — Goals & Projects DB',
  db_relationships: 'Database Studio — Relationships DB',
  db_parenting: 'Database Studio — Parenting & Growth DB',
  db_life: 'Database Studio — Life Management DB',
  db_sync: 'Database Studio — Raw Synchronized Entities',
  general_settings: 'General Settings — System Preferences & Diagnostics',
  admin_settings: 'Admin Settings — Governance, RBAC & Security Hub',
};

export const SidebarNavigation: React.FC<SidebarNavigationProps> = ({
  activeTab,
  onSelectTab,
  activeSubItemId,
  onSelectSubItem,
  selectedRole,
  isMobileOpen,
  onToggleMobile,
  isCollapsed: controlledIsCollapsed,
  onToggleCollapse,
  onLogout,
  actorDisplayName,
  actorRoleLabel,
  actorAvatar,
  familyLogoUrl,
}) => {
  const [internalIsCollapsed, setInternalIsCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      return false; // Desktop view expanded by default
    }
    return true;
  });
  const [isHoverExpanded, setIsHoverExpanded] = useState<boolean>(false);
  const isCollapsed = controlledIsCollapsed !== undefined ? controlledIsCollapsed : internalIsCollapsed;
  const effectiveCollapsed = isCollapsed && !isHoverExpanded;

  const handleToggleCollapse = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalIsCollapsed(!internalIsCollapsed);
    }
  };

  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    core: true,
    planner: true,
    settings: true,
  });

  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({
    family_home: true,
    people_relationships: true,
    calendar_routines: false,
    admin_settings: false,
  });

  const [pinnedFavorites, setPinnedFavorites] = useState<PinnedFavoriteItem[]>(() => {
    try {
      const saved = localStorage.getItem('familyos_pinned_favorites');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const seen = new Set<string>();
          const normalized: PinnedFavoriteItem[] = [];
          for (const fav of parsed) {
            const resolved = resolveCanonicalDestination(fav.parentTab || 'family_home', fav.subId);
            if (!seen.has(resolved.activeSubItemId)) {
              seen.add(resolved.activeSubItemId);
              normalized.push({
                parentTab: resolved.activeTab,
                subId: resolved.activeSubItemId,
                label: resolved.routeEntry.label,
                tabId: resolved.activeTab,
              });
            }
          }
          if (normalized.length > 0) return normalized;
        }
      }
    } catch {
      // Fallback
    }
    return DEFAULT_PINNED_FAVORITES;
  });

  const togglePinFavorite = (parentTab: MainTabType, subId: string, label: string, tabId?: MainTabType) => {
    setPinnedFavorites((prev) => {
      const exists = prev.some((f) => f.subId === subId);
      let next: PinnedFavoriteItem[];
      if (exists) {
        next = prev.filter((f) => f.subId !== subId);
      } else {
        next = [...prev, { parentTab, subId, label, tabId }];
      }
      try {
        localStorage.setItem('familyos_pinned_favorites', JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });
  };

  const toggleCategory = (catKey: string) => {
    setOpenCategories((prev) => ({ ...prev, [catKey]: !prev[catKey] }));
  };

  const toggleSubmenu = (itemId: string) => {
    setExpandedItems((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const handleTabClick = (tab: MainTabType) => {
    onSelectTab(tab);
    if (isMobileOpen) {
      onToggleMobile();
    }
  };

  const handleSubItemClick = (parentTab: MainTabType, subId: string, subTabId?: MainTabType) => {
    if (onSelectSubItem) {
      onSelectSubItem(parentTab, subId, subTabId);
    } else {
      onSelectTab(subTabId || parentTab);
    }
    if (isMobileOpen) {
      onToggleMobile();
    }
  };

  const fallbackUser = USER_PROFILES[selectedRole] || USER_PROFILES.OWNER;
  const currentUser = {
    name: actorDisplayName || fallbackUser.name,
    roleLabel: actorRoleLabel || fallbackUser.roleLabel,
    avatar: actorAvatar || fallbackUser.avatar,
  };

  const renderMenuItem = (item: SidebarMenuItem) => {
    const Icon = item.icon;
    const isActive =
      activeTab === item.id ||
      Boolean(item.subitems && item.subitems.some((sub) => sub.tabId === activeTab));
    const hasSubitems = Boolean(item.subitems && item.subitems.length > 0);
    const isMenuExpanded = Boolean(expandedItems[item.id]);

    return (
      <div key={item.id} className="space-y-0.5 relative">
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setExpandedItems((prev) => ({ ...prev, [item.id]: true }));
            if (item.subitems && item.subitems.length > 0 && onSelectSubItem) {
              const firstSub = item.subitems[0];
              onSelectSubItem(item.id, firstSub.id, firstSub.tabId);
              if (isMobileOpen) onToggleMobile();
            } else {
              handleTabClick(item.id);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setExpandedItems((prev) => ({ ...prev, [item.id]: true }));
              if (item.subitems && item.subitems.length > 0 && onSelectSubItem) {
                const firstSub = item.subitems[0];
                onSelectSubItem(item.id, firstSub.id, firstSub.tabId);
                if (isMobileOpen) onToggleMobile();
              } else {
                handleTabClick(item.id);
              }
            }
          }}
          title={effectiveCollapsed ? item.label : undefined}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 relative cursor-pointer select-none ${
            isActive
              ? 'bg-stone-100 text-stone-900 font-semibold border border-stone-200/90 shadow-2xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/60 border border-transparent'
          }`}
        >
          {isActive && (
            <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-md bg-emerald-800" />
          )}
          <div className="flex items-center space-x-2.5 min-w-0">
            <Icon
              className={`w-4 h-4 shrink-0 transition-colors ${
                isActive ? 'text-emerald-800' : 'text-stone-400 group-hover:text-stone-600'
              }`}
            />
            {!effectiveCollapsed && (
              <span className="truncate tracking-tight font-medium text-stone-800">
                {item.label}
              </span>
            )}
          </div>
          {!effectiveCollapsed && (
            <div className="flex items-center space-x-1.5 shrink-0">
              {item.badge && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono font-medium ${
                    isActive
                      ? 'bg-emerald-100/70 text-emerald-900 border border-emerald-200/80'
                      : 'bg-stone-100 text-stone-500 border border-stone-200/60'
                  }`}
                >
                  {item.badge}
                </span>
              )}
              {hasSubitems && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSubmenu(item.id);
                  }}
                  className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors cursor-pointer"
                  title={isMenuExpanded ? 'Collapse Submenu' : 'Expand Submenu'}
                  aria-expanded={isMenuExpanded}
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      isMenuExpanded ? 'rotate-180 text-stone-700' : 'rotate-0'
                    }`}
                  />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Clean Light Submenu List with Star Shortcut Toggles */}
        {!effectiveCollapsed && hasSubitems && isMenuExpanded && item.subitems && (
          <div className="ml-4 mt-0.5 space-y-0.5 border-l-2 border-stone-200/90 pl-2.5 py-0.5">
            {item.subitems
              .filter((sub) => !sub.allowedRoles || sub.allowedRoles.includes(selectedRole))
              .map((sub) => {
                const isSubActive = activeSubItemId
                  ? activeSubItemId === sub.id
                  : Boolean(sub.tabId && activeTab === sub.tabId);
                const isPinned = pinnedFavorites.some((f) => f.subId === sub.id);

                return (
                  <div key={sub.id} className="flex items-center justify-between group/sub">
                    <button
                      type="button"
                      onClick={() => handleSubItemClick(item.id, sub.id, sub.tabId)}
                      className={`flex-1 text-left py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-between cursor-pointer transition-colors ${
                        isSubActive
                          ? 'bg-emerald-50 text-emerald-950 font-semibold border border-emerald-200/70 shadow-2xs'
                          : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/70'
                      }`}
                    >
                      <span className="truncate">{sub.label}</span>
                      <ChevronRight
                        className={`w-3 h-3 transition-opacity ${
                          isSubActive ? 'text-emerald-800 opacity-90' : 'opacity-30 text-stone-400 group-hover/sub:opacity-75'
                        }`}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePinFavorite(item.id, sub.id, sub.label, sub.tabId);
                      }}
                      title={isPinned ? 'Unpin favorite shortcut' : 'Pin to favorite shortcuts'}
                      className={`p-1 rounded-md transition-all ml-1 cursor-pointer ${
                        isPinned
                          ? 'text-amber-500 opacity-100'
                          : 'text-stone-300 opacity-0 group-hover/sub:opacity-100 hover:text-amber-500 hover:bg-stone-100'
                      }`}
                    >
                      <Star className={`w-3 h-3 ${isPinned ? 'fill-amber-400' : ''}`} />
                    </button>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-stone-900/40 z-40 lg:hidden transition-opacity duration-300"
          style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
          onClick={onToggleMobile}
          aria-hidden="true"
        />
      )}

      {/* Main Clean Light Minimalist Sidebar Container */}
      <aside
        onMouseEnter={() => {
          if (isCollapsed) setIsHoverExpanded(true);
        }}
        onMouseLeave={() => {
          setIsHoverExpanded(false);
        }}
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          effectiveCollapsed ? 'w-20' : 'w-72 shadow-lg ring-1 ring-stone-900/5'
        } ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } bg-white border-r border-stone-200 text-stone-900 select-none`}
      >
        {/* Sidebar Header — Family Crest Identity Lockup */}
        <div className="relative px-4 py-3.5 border-b border-stone-200 flex items-center justify-between shrink-0 bg-stone-50/70">
          <div
            onClick={effectiveCollapsed ? handleToggleCollapse : undefined}
            title={effectiveCollapsed ? 'Click to open side menu' : undefined}
            className={`flex items-center space-x-3 overflow-hidden min-w-0 ${
              effectiveCollapsed ? 'justify-center w-full cursor-pointer hover:scale-105 transition-transform' : ''
            }`}
          >
            <div className="relative shrink-0 flex items-center justify-center">
              {familyLogoUrl ? (
                <img
                  src={familyLogoUrl}
                  alt="Family Crest Logo"
                  className="w-9 h-9 rounded-xl object-cover border border-stone-200 shadow-2xs shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-stone-900 text-amber-200 flex items-center justify-center font-serif text-base font-bold shadow-2xs shrink-0 border border-stone-800">
                  F
                </div>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full shadow-2xs" />
            </div>

            {!effectiveCollapsed && (
              <div className="min-w-0">
                <div className="flex items-center space-x-1.5">
                  <h1 className="text-base font-bold text-stone-900 tracking-tight font-serif truncate">
                    FamilyOS
                  </h1>
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold uppercase tracking-wider bg-stone-200 text-stone-700 shrink-0">
                    Platform
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 truncate font-medium">Household Operating System</p>
              </div>
            )}
          </div>

          <div className="hidden lg:flex items-center space-x-1 shrink-0">
            {!effectiveCollapsed && (
              <button
                type="button"
                onClick={() => {
                  if (isCollapsed) {
                    handleToggleCollapse();
                    setIsHoverExpanded(false);
                  } else {
                    handleToggleCollapse();
                  }
                }}
                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                  !isCollapsed
                    ? 'bg-stone-200/70 text-stone-800 border-stone-300 shadow-2xs'
                    : 'text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 border-transparent'
                }`}
                aria-label={!isCollapsed ? 'Sidebar pinned expanded' : 'Pin sidebar expanded'}
                title={!isCollapsed ? 'Sidebar is pinned expanded (Click to unpin)' : 'Pin sidebar expanded'}
              >
                <Pin className={`w-3.5 h-3.5 ${!isCollapsed ? 'fill-stone-800 text-stone-800' : ''}`} />
              </button>
            )}

            <button
              type="button"
              onClick={handleToggleCollapse}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 border border-transparent transition-colors cursor-pointer"
              aria-label={effectiveCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={effectiveCollapsed ? 'Expand and pin sidebar menu' : 'Collapse sidebar menu'}
            >
              {effectiveCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          <button
            type="button"
            onClick={onToggleMobile}
            className="lg:hidden p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 border border-transparent transition-colors cursor-pointer"
            aria-label="Close mobile sidebar"
            title="Close mobile sidebar"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        {/* PINNED FAVORITES SHORTCUTS BAR */}
        {!effectiveCollapsed && pinnedFavorites.length > 0 && (
          <div className="px-3 py-2 border-b border-stone-100 bg-stone-50/50 space-y-1.5 shrink-0">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 flex items-center space-x-1">
                <Star className="w-3 h-3 fill-amber-400 text-amber-500 inline shrink-0" />
                <span>Pinned Favorites</span>
              </span>
              <span className="text-[10px] text-stone-400 font-mono">{pinnedFavorites.length} Pinned</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {pinnedFavorites.map((fav) => (
                <div
                  key={fav.subId}
                  className="group/fav relative flex items-center justify-between p-1.5 rounded-lg bg-white border border-stone-200 hover:border-stone-300 hover:bg-stone-50 transition-all shadow-2xs"
                >
                  <button
                    type="button"
                    onClick={() => handleSubItemClick(fav.parentTab, fav.subId, fav.tabId)}
                    className="flex-1 text-left flex items-center space-x-1.5 min-w-0 cursor-pointer"
                    title={`Jump to ${fav.label}`}
                  >
                    <Star className="w-3 h-3 fill-amber-400 text-amber-500 shrink-0" />
                    <span className="text-[11px] font-medium text-stone-700 group-hover:text-stone-900 truncate">
                      {fav.label}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePinFavorite(fav.parentTab, fav.subId, fav.label, fav.tabId);
                    }}
                    title={`Unpin ${fav.label} from favorites`}
                    className="p-0.5 rounded text-stone-300 hover:text-rose-600 opacity-60 group-hover/fav:opacity-100 transition-opacity cursor-pointer ml-1 shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CATEGORIZED NAVIGATION ACCORDIONS */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 text-xs scrollbar-thin scrollbar-thumb-stone-200">
          {/* AREA 1: HOME & FAMILY */}
          <div className="space-y-1">
            {!effectiveCollapsed && (
              <button
                type="button"
                onClick={() => toggleCategory('core')}
                className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-400 hover:text-stone-600 transition-colors cursor-pointer"
              >
                <span>Home & Family</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    openCategories.core ? 'rotate-0' : '-rotate-90'
                  }`}
                />
              </button>
            )}
            {(effectiveCollapsed || openCategories.core) && (
              <div className="space-y-0.5">
                {CATEGORY_1_CORE_ITEMS.map((item) => renderMenuItem(item))}
              </div>
            )}
          </div>

          {/* AREA 2: PLANNER */}
          <div className="space-y-1">
            {!effectiveCollapsed && (
              <button
                type="button"
                onClick={() => toggleCategory('planner')}
                className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-400 hover:text-stone-600 transition-colors cursor-pointer"
              >
                <span>Planner & Schedules</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    openCategories.planner ? 'rotate-0' : '-rotate-90'
                  }`}
                />
              </button>
            )}
            {(effectiveCollapsed || openCategories.planner) && (
              <div className="space-y-0.5">
                {CATEGORY_2_PLANNER_ITEMS.map((item) => renderMenuItem(item))}
              </div>
            )}
          </div>

          {/* AREA 3: ACCOUNT & SETTINGS */}
          <div className="space-y-1">
            {!effectiveCollapsed && (
              <button
                type="button"
                onClick={() => toggleCategory('settings')}
                className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-400 hover:text-stone-600 transition-colors cursor-pointer"
              >
                <span>Account & Settings</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    openCategories.settings ? 'rotate-0' : '-rotate-90'
                  }`}
                />
              </button>
            )}
            {(effectiveCollapsed || openCategories.settings) && (
              <div className="space-y-0.5">
                {CATEGORY_3_ACCOUNT_SETTINGS_ITEMS.map((item) => renderMenuItem(item))}
              </div>
            )}
          </div>
        </div>

        {/* USER PROFILE FOOTER CARD & LOGOUT */}
        <div className="p-3 border-t border-stone-200 bg-stone-50/80 shrink-0 space-y-2">
          {!effectiveCollapsed ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleTabClick('user_profile')}
                title="View and edit your personal profile"
                className="w-full p-2.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 hover:border-stone-300 text-left flex items-center space-x-3 transition-all cursor-pointer shadow-2xs"
              >
                <div className="relative shrink-0">
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="w-9 h-9 rounded-xl object-cover border border-stone-200"
                  />
                  <span
                    className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5"
                    title="Active Online"
                  >
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-white" />
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-stone-900 truncate tracking-tight">{currentUser.name}</p>
                  <p className="text-[10px] text-stone-500 truncate">{currentUser.roleLabel}</p>
                  <span className="inline-flex items-center space-x-1 text-[10px] font-semibold text-emerald-800 mt-0.5">
                    <UserCog className="w-3 h-3" />
                    <span>View Profile</span>
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onLogout) {
                    onLogout();
                  }
                }}
                className="w-full py-1.5 px-3 rounded-lg bg-white hover:bg-rose-50 border border-stone-200 hover:border-rose-200 text-stone-600 hover:text-rose-700 text-xs font-semibold flex items-center justify-center space-x-2 transition-colors cursor-pointer shadow-2xs"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-2 py-1">
              <button
                type="button"
                onClick={() => handleTabClick('user_profile')}
                title={`${currentUser.name} • View Profile`}
                className="relative cursor-pointer"
              >
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-9 h-9 rounded-xl object-cover border border-stone-200"
                />
                <span className="absolute -bottom-0.5 -right-0.5 flex h-2 w-2" title="Active Online">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 border border-white" />
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onLogout) {
                    onLogout();
                  }
                }}
                title="Log Out"
                className="p-1.5 rounded-lg bg-white hover:bg-rose-50 border border-stone-200 hover:border-rose-200 text-stone-500 hover:text-rose-700 cursor-pointer transition-colors shadow-2xs"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
