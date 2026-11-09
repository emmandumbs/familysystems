import type { MainTabType } from '../components/SidebarNavigation';

export interface CanonicalRouteEntry {
  subItemId: string;
  label: string;
  breadcrumbTitle: string;
  parentTab: MainTabType;
  targetTab: MainTabType;
  domain: 'HOME' | 'FAMILY' | 'PLANNER' | 'SETTINGS';
  embeddedDomainHub?:
    | 'COMMAND_CENTER'
    | 'FINANCE'
    | 'HOUSEHOLD'
    | 'GOALS_PROJECTS'
    | 'RELATIONSHIPS'
    | 'PARENTING_GROWTH'
    | 'LIFE_MANAGEMENT';
  allowedRoles: Array<'OWNER' | 'ADMIN' | 'MEMBER' | 'CHILD' | 'GUEST'>;
}

const ALL_ROLES: Array<'OWNER' | 'ADMIN' | 'MEMBER' | 'CHILD' | 'GUEST'> = [
  'OWNER',
  'ADMIN',
  'MEMBER',
  'CHILD',
  'GUEST',
];

export const CANONICAL_ROUTE_REGISTRY: Record<string, CanonicalRouteEntry> = {
  // 1. HOME — 7 Operational Domain Dashboards (each embeds its domain's full workflow)
  home_command_center: {
    subItemId: 'home_command_center',
    label: 'Main Command Center',
    breadcrumbTitle: 'Home — Main Command Center',
    parentTab: 'family_home',
    targetTab: 'family_home',
    domain: 'HOME',
    embeddedDomainHub: 'COMMAND_CENTER',
    allowedRoles: ALL_ROLES,
  },
  home_finance_dashboard: {
    subItemId: 'home_finance_dashboard',
    label: 'Finance Dashboard',
    breadcrumbTitle: 'Home — Finance Dashboard',
    parentTab: 'family_home',
    targetTab: 'family_home',
    domain: 'HOME',
    embeddedDomainHub: 'FINANCE',
    allowedRoles: ['OWNER', 'ADMIN', 'MEMBER'],
  },
  home_house_dashboard: {
    subItemId: 'home_house_dashboard',
    label: 'Household Dashboard',
    breadcrumbTitle: 'Home — Household Dashboard',
    parentTab: 'family_home',
    targetTab: 'family_home',
    domain: 'HOME',
    embeddedDomainHub: 'HOUSEHOLD',
    allowedRoles: ALL_ROLES,
  },
  home_goals_dashboard: {
    subItemId: 'home_goals_dashboard',
    label: 'Goals & Projects Dashboard',
    breadcrumbTitle: 'Home — Goals & Projects Dashboard',
    parentTab: 'family_home',
    targetTab: 'family_home',
    domain: 'HOME',
    embeddedDomainHub: 'GOALS_PROJECTS',
    allowedRoles: ALL_ROLES,
  },
  home_relationship_dashboard: {
    subItemId: 'home_relationship_dashboard',
    label: 'Relationship Dashboard',
    breadcrumbTitle: 'Home — Relationship Dashboard',
    parentTab: 'family_home',
    targetTab: 'family_home',
    domain: 'HOME',
    embeddedDomainHub: 'RELATIONSHIPS',
    allowedRoles: ALL_ROLES,
  },
  home_parenting_dashboard: {
    subItemId: 'home_parenting_dashboard',
    label: 'Parenting & Growth Dashboard',
    breadcrumbTitle: 'Home — Parenting & Growth Dashboard',
    parentTab: 'family_home',
    targetTab: 'family_home',
    domain: 'HOME',
    embeddedDomainHub: 'PARENTING_GROWTH',
    allowedRoles: ALL_ROLES,
  },
  home_life_dashboard: {
    subItemId: 'home_life_dashboard',
    label: 'Life Management Dashboard',
    breadcrumbTitle: 'Home — Life Management Dashboard',
    parentTab: 'family_home',
    targetTab: 'family_home',
    domain: 'HOME',
    embeddedDomainHub: 'LIFE_MANAGEMENT',
    allowedRoles: ALL_ROLES,
  },

  // 2. FAMILY — 6 Identity, Heritage, Governance & Culture Destinations
  home_overview: {
    subItemId: 'home_overview',
    label: 'Family Home Overview',
    breadcrumbTitle: 'Family — Family Home Overview',
    parentTab: 'people_relationships',
    targetTab: 'people_relationships',
    domain: 'FAMILY',
    allowedRoles: ALL_ROLES,
  },
  people_gallery: {
    subItemId: 'people_gallery',
    label: 'Family Gallery',
    breadcrumbTitle: 'Family — Family Gallery',
    parentTab: 'people_relationships',
    targetTab: 'people_relationships',
    domain: 'FAMILY',
    allowedRoles: ALL_ROLES,
  },
  home_constitution: {
    subItemId: 'home_constitution',
    label: 'Family Constitution',
    breadcrumbTitle: 'Family — Family Constitution',
    parentTab: 'people_relationships',
    targetTab: 'people_relationships',
    domain: 'FAMILY',
    allowedRoles: ALL_ROLES,
  },
  people_traditions: {
    subItemId: 'people_traditions',
    label: 'Family Traditions & Culture',
    breadcrumbTitle: 'Family — Family Traditions & Culture',
    parentTab: 'people_relationships',
    targetTab: 'people_relationships',
    domain: 'FAMILY',
    allowedRoles: ALL_ROLES,
  },
  people_activities: {
    subItemId: 'people_activities',
    label: 'Shared Activities',
    breadcrumbTitle: 'Family — Shared Activities',
    parentTab: 'people_relationships',
    targetTab: 'people_relationships',
    domain: 'FAMILY',
    allowedRoles: ALL_ROLES,
  },
  people_rules: {
    subItemId: 'people_rules',
    label: 'Family Rules & Principles',
    breadcrumbTitle: 'Family — Family Rules & Principles',
    parentTab: 'people_relationships',
    targetTab: 'people_relationships',
    domain: 'FAMILY',
    allowedRoles: ALL_ROLES,
  },

  // 3. PLANNER — Calendar & Routines
  cal_schedule: {
    subItemId: 'cal_schedule',
    label: 'Calendar',
    breadcrumbTitle: 'Planner — Family Calendar',
    parentTab: 'calendar_routines',
    targetTab: 'calendar_routines',
    domain: 'PLANNER',
    allowedRoles: ALL_ROLES,
  },
  cal_routines: {
    subItemId: 'cal_routines',
    label: 'Routines',
    breadcrumbTitle: 'Planner — Daily Routines & Habits',
    parentTab: 'calendar_routines',
    targetTab: 'calendar_routines',
    domain: 'PLANNER',
    allowedRoles: ALL_ROLES,
  },

  // 4. ACCOUNT & SETTINGS — Profile, Family Settings, App Preferences, Authorized Administration & Diagnostics
  user_profile: {
    subItemId: 'user_profile',
    label: 'Profile',
    breadcrumbTitle: 'Account & Settings — Personal Profile',
    parentTab: 'user_profile',
    targetTab: 'user_profile',
    domain: 'SETTINGS',
    allowedRoles: ALL_ROLES,
  },
  admin_settings: {
    subItemId: 'admin_settings',
    label: 'Family Settings',
    breadcrumbTitle: 'Account & Settings — Family Settings, Members & Invitations',
    parentTab: 'admin_settings',
    targetTab: 'admin_settings',
    domain: 'SETTINGS',
    allowedRoles: ['OWNER', 'ADMIN', 'MEMBER'],
  },
  general_settings: {
    subItemId: 'general_settings',
    label: 'App Preferences',
    breadcrumbTitle: 'Account & Settings — App Preferences & Privacy',
    parentTab: 'general_settings',
    targetTab: 'general_settings',
    domain: 'SETTINGS',
    allowedRoles: ALL_ROLES,
  },
  database: {
    subItemId: 'database',
    label: 'Authorized Administration & Diagnostics',
    breadcrumbTitle: 'Account & Settings — Authorized Administration & Diagnostics',
    parentTab: 'database',
    targetTab: 'database',
    domain: 'SETTINGS',
    allowedRoles: ['OWNER', 'ADMIN'],
  },
};

/**
 * Maps legacy sub-item IDs from the previous 9-category sidebar to their canonical
 * single-owner Home Dashboard or Planner destination.
 */
export const LEGACY_SUBITEM_REDIRECT_MAP: Record<
  string,
  { parentTab: MainTabType; subItemId: string; internalSection?: string }
> = {
  // Legacy Finance subitems -> Home Finance Dashboard
  fin_accounts: { parentTab: 'family_home', subItemId: 'home_finance_dashboard', internalSection: 'accounts' },
  fin_transactions: { parentTab: 'family_home', subItemId: 'home_finance_dashboard', internalSection: 'transactions' },
  fin_budgets: { parentTab: 'family_home', subItemId: 'home_finance_dashboard', internalSection: 'budgets' },
  fin_savings: { parentTab: 'family_home', subItemId: 'home_finance_dashboard', internalSection: 'savings' },
  fin_recurring: { parentTab: 'family_home', subItemId: 'home_finance_dashboard', internalSection: 'recurring' },
  fin_investments: { parentTab: 'family_home', subItemId: 'home_finance_dashboard', internalSection: 'investments' },

  // Legacy Household subitems -> Home Household Dashboard
  house_meals: { parentTab: 'family_home', subItemId: 'home_house_dashboard', internalSection: 'meals' },
  house_recipes: { parentTab: 'family_home', subItemId: 'home_house_dashboard', internalSection: 'recipes' },
  house_pantry: { parentTab: 'family_home', subItemId: 'home_house_dashboard', internalSection: 'pantry' },
  house_groceries: { parentTab: 'family_home', subItemId: 'home_house_dashboard', internalSection: 'groceries' },
  house_chores: { parentTab: 'family_home', subItemId: 'home_house_dashboard', internalSection: 'chores' },
  house_wardrobe: { parentTab: 'family_home', subItemId: 'home_house_dashboard', internalSection: 'wardrobe' },
  house_assets: { parentTab: 'family_home', subItemId: 'home_house_dashboard', internalSection: 'assets' },

  // Legacy Goals & Projects subitems -> Home Goals & Projects Dashboard
  plan_goals: { parentTab: 'family_home', subItemId: 'home_goals_dashboard', internalSection: 'goals' },
  plan_projects: { parentTab: 'family_home', subItemId: 'home_goals_dashboard', internalSection: 'projects' },
  plan_tasks: { parentTab: 'family_home', subItemId: 'home_goals_dashboard', internalSection: 'tasks' },
  plan_rewards: { parentTab: 'family_home', subItemId: 'home_goals_dashboard', internalSection: 'rewards' },

  // Legacy Relationships subitems -> Home Relationship Dashboard
  rel_checkins: { parentTab: 'family_home', subItemId: 'home_relationship_dashboard', internalSection: 'checkins' },
  rel_appreciation: { parentTab: 'family_home', subItemId: 'home_relationship_dashboard', internalSection: 'appreciation' },
  rel_couple: { parentTab: 'family_home', subItemId: 'home_relationship_dashboard', internalSection: 'couple' },
  rel_communication: { parentTab: 'family_home', subItemId: 'home_relationship_dashboard', internalSection: 'communication' },
  rel_experiences: { parentTab: 'family_home', subItemId: 'home_relationship_dashboard', internalSection: 'experiences' },
  rel_reflection: { parentTab: 'family_home', subItemId: 'home_relationship_dashboard', internalSection: 'reflection' },
  rel_external_crm: { parentTab: 'family_home', subItemId: 'home_relationship_dashboard', internalSection: 'external_crm' },
  rel_network: { parentTab: 'family_home', subItemId: 'home_relationship_dashboard', internalSection: 'external_crm' },

  // Legacy Parenting & Growth subitems -> Home Parenting & Growth Dashboard
  parent_resources: { parentTab: 'family_home', subItemId: 'home_parenting_dashboard', internalSection: 'resources' },
  parent_profiles: { parentTab: 'family_home', subItemId: 'home_parenting_dashboard', internalSection: 'profiles' },
  parent_routines: { parentTab: 'family_home', subItemId: 'home_parenting_dashboard', internalSection: 'routines' },
  parent_education: { parentTab: 'family_home', subItemId: 'home_parenting_dashboard', internalSection: 'education' },
  parent_personal: { parentTab: 'family_home', subItemId: 'home_parenting_dashboard', internalSection: 'personal' },
  parent_micro: { parentTab: 'family_home', subItemId: 'home_parenting_dashboard', internalSection: 'micro' },
  parent_wellbeing: { parentTab: 'family_home', subItemId: 'home_parenting_dashboard', internalSection: 'wellbeing' },
  parent_family_learning: { parentTab: 'family_home', subItemId: 'home_parenting_dashboard', internalSection: 'family_learning' },

  // Legacy Life Management subitems -> Home Life Management Dashboard
  life_dashboard: { parentTab: 'family_home', subItemId: 'home_life_dashboard', internalSection: 'dashboard' },
  life_docs: { parentTab: 'family_home', subItemId: 'home_life_dashboard', internalSection: 'docs' },
  life_organization: { parentTab: 'family_home', subItemId: 'home_life_dashboard', internalSection: 'organization' },
  life_contacts: { parentTab: 'family_home', subItemId: 'home_life_dashboard', internalSection: 'contacts' },
  life_travel: { parentTab: 'family_home', subItemId: 'home_life_dashboard', internalSection: 'travel' },
  life_vehicles: { parentTab: 'family_home', subItemId: 'home_life_dashboard', internalSection: 'vehicles' },
  life_longterm: { parentTab: 'family_home', subItemId: 'home_life_dashboard', internalSection: 'longterm' },

  // Legacy Planner synced calendar & events -> Calendar
  cal_events: { parentTab: 'calendar_routines', subItemId: 'cal_schedule' },
  cal_synced: { parentTab: 'calendar_routines', subItemId: 'cal_schedule' },
};

/**
 * Resolves any navigation request (including legacy tab IDs or saved localStorage favorites)
 * to a canonical destination without broken screens.
 */
export function resolveCanonicalDestination(
  requestedTab: MainTabType,
  requestedSubItemId?: string
): {
  activeTab: MainTabType;
  activeSubItemId: string;
  internalDomainSection?: string;
  routeEntry: CanonicalRouteEntry;
} {
  if (requestedSubItemId && CANONICAL_ROUTE_REGISTRY[requestedSubItemId]) {
    const entry = CANONICAL_ROUTE_REGISTRY[requestedSubItemId];
    return {
      activeTab: entry.targetTab,
      activeSubItemId: entry.subItemId,
      routeEntry: entry,
    };
  }

  if (requestedSubItemId && LEGACY_SUBITEM_REDIRECT_MAP[requestedSubItemId]) {
    const mapped = LEGACY_SUBITEM_REDIRECT_MAP[requestedSubItemId];
    const entry = CANONICAL_ROUTE_REGISTRY[mapped.subItemId] || CANONICAL_ROUTE_REGISTRY.home_command_center;
    return {
      activeTab: mapped.parentTab,
      activeSubItemId: mapped.subItemId,
      internalDomainSection: mapped.internalSection,
      routeEntry: entry,
    };
  }

  // Map top-level legacy tabs to their canonical Home Dashboard
  switch (requestedTab) {
    case 'finance_hub':
    case 'finance':
      return {
        activeTab: 'family_home',
        activeSubItemId: 'home_finance_dashboard',
        routeEntry: CANONICAL_ROUTE_REGISTRY.home_finance_dashboard,
      };
    case 'household_hub':
      return {
        activeTab: 'family_home',
        activeSubItemId: 'home_house_dashboard',
        routeEntry: CANONICAL_ROUTE_REGISTRY.home_house_dashboard,
      };
    case 'planning_execution':
      return {
        activeTab: 'family_home',
        activeSubItemId: 'home_goals_dashboard',
        routeEntry: CANONICAL_ROUTE_REGISTRY.home_goals_dashboard,
      };
    case 'relationships':
      return {
        activeTab: 'family_home',
        activeSubItemId: 'home_relationship_dashboard',
        routeEntry: CANONICAL_ROUTE_REGISTRY.home_relationship_dashboard,
      };
    case 'parenting_growth':
      return {
        activeTab: 'family_home',
        activeSubItemId: 'home_parenting_dashboard',
        routeEntry: CANONICAL_ROUTE_REGISTRY.home_parenting_dashboard,
      };
    case 'life_records':
      return {
        activeTab: 'family_home',
        activeSubItemId: 'home_life_dashboard',
        routeEntry: CANONICAL_ROUTE_REGISTRY.home_life_dashboard,
      };
    case 'people_relationships':
      return {
        activeTab: 'people_relationships',
        activeSubItemId: 'home_overview',
        routeEntry: CANONICAL_ROUTE_REGISTRY.home_overview,
      };
    case 'calendar_routines':
      return {
        activeTab: 'calendar_routines',
        activeSubItemId: 'cal_schedule',
        routeEntry: CANONICAL_ROUTE_REGISTRY.cal_schedule,
      };
    case 'user_profile':
      return {
        activeTab: 'user_profile',
        activeSubItemId: 'user_profile',
        routeEntry: CANONICAL_ROUTE_REGISTRY.user_profile,
      };
    case 'admin_settings':
      return {
        activeTab: 'admin_settings',
        activeSubItemId: 'admin_settings',
        routeEntry: CANONICAL_ROUTE_REGISTRY.admin_settings,
      };
    case 'database':
      return {
        activeTab: 'database',
        activeSubItemId: 'database',
        routeEntry: CANONICAL_ROUTE_REGISTRY.database,
      };
    case 'general_settings':
    case 'rbac':
    case 'sync':
    case 'tests':
    case 'docs':
      return {
        activeTab: requestedTab,
        activeSubItemId: 'general_settings',
        routeEntry: CANONICAL_ROUTE_REGISTRY.general_settings,
      };
    default:
      return {
        activeTab: 'family_home',
        activeSubItemId: 'home_command_center',
        routeEntry: CANONICAL_ROUTE_REGISTRY.home_command_center,
      };
  }
}
