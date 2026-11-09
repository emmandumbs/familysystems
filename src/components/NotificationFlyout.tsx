import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  CheckCircle2,
  DollarSign,
  AlertTriangle,
  Heart,
  Calendar,
  Check,
  X,
  ExternalLink,
  Inbox,
  Sliders
} from 'lucide-react';
import { MainTabType } from './SidebarNavigation';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  category: 'finance' | 'chores' | 'medical' | 'emergency' | 'calendar';
  targetTab: MainTabType;
  targetSubTab?: 'finance' | 'wellbeing' | 'emergency';
}

export interface NotificationFlyoutProps {
  onNavigate: (tab: MainTabType, subTab?: 'finance' | 'wellbeing' | 'emergency') => void;
  selectedRole?: string;
  onOpenCompleteProfile?: () => void;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'n-1',
    title: 'Budget Alert: Food & Groceries',
    message: 'Monthly grocery spending reached 84.5% ($845.00 of $1,200.00 planned).',
    timestamp: '10 mins ago',
    read: false,
    category: 'finance',
    targetTab: 'finance_hub',
  },
  {
    id: 'n-2',
    title: 'Chore Completed & Verified',
    message: 'David verified "Organize Pantry" completed by Lucas (+25 reward points).',
    timestamp: '45 mins ago',
    read: false,
    category: 'chores',
    targetTab: 'household_hub',
  },
  {
    id: 'n-3',
    title: 'Upcoming Appointment Reminder',
    message: 'Lucas Pediatric Dental Checkup scheduled for tomorrow at 3:30 PM.',
    timestamp: '2 hours ago',
    read: false,
    category: 'calendar',
    targetTab: 'calendar_routines',
  },
  {
    id: 'n-4',
    title: 'Important Document Renewal Notice',
    message: 'Homeowners Insurance policy review due in 30 days in Document Vault.',
    timestamp: 'Yesterday',
    read: true,
    category: 'emergency',
    targetTab: 'life_records',
  },
  {
    id: 'n-5',
    title: 'Upcoming Anniversary Milestone',
    message: 'Sarah & David 12th Wedding Anniversary gift & getaway checklist updated.',
    timestamp: '2 days ago',
    read: true,
    category: 'medical',
    targetTab: 'people_relationships',
  },
];

const STORAGE_KEY = 'familyos_notifications_v2';
const PREFS_STORAGE_KEY = 'familyos_notification_prefs_v1';

export const NotificationFlyout: React.FC<NotificationFlyoutProps> = ({
  onNavigate,
  selectedRole = 'OWNER',
  onOpenCompleteProfile,
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback
    }
    return INITIAL_NOTIFICATIONS;
  });

  const [profileReminderItem, setProfileReminderItem] = useState<NotificationItem | null>(null);

  useEffect(() => {
    const syncProfileReminder = () => {
      try {
        const raw = localStorage.getItem('familyos_member_profile_completion_v1');
        const all = raw ? JSON.parse(raw) : {};
        const rec = all[selectedRole];
        if (rec && !rec.isFullyComplete) {
          setProfileReminderItem({
            id: `n-profile-incomplete-${selectedRole}`,
            title: `Reminder: Complete Your Profile (${rec.completionPercentage}% Done)`,
            message: `Skipped fields remaining: ${rec.missingOptionalFields.join(', ')}. Click to finish your profile.`,
            timestamp: 'Active Reminder',
            read: false,
            category: 'emergency',
            targetTab: 'user_profile',
          });
        } else if (!rec && ['MEMBER', 'CHILD', 'GUEST'].includes(selectedRole)) {
          setProfileReminderItem({
            id: `n-profile-incomplete-${selectedRole}`,
            title: 'Reminder: Complete Your Member Profile',
            message: 'You skipped optional profile details during onboarding. Click to complete your profile.',
            timestamp: 'Active Reminder',
            read: false,
            category: 'emergency',
            targetTab: 'user_profile',
          });
        } else {
          setProfileReminderItem(null);
        }
      } catch {
        setProfileReminderItem(null);
      }
    };
    syncProfileReminder();
    window.addEventListener('familyos-profile-completion-updated', syncProfileReminder);
    return () => window.removeEventListener('familyos-profile-completion-updated', syncProfileReminder);
  }, [selectedRole]);

  const [prefs, setPrefs] = useState<{ finance: boolean; chores: boolean; calendar: boolean }>(() => {
    try {
      const saved = localStorage.getItem(PREFS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // Fallback
    }
    return { finance: true, chores: true, calendar: true };
  });

  const [filterMode, setFilterMode] = useState<'all' | 'unread'>('all');
  const [showPrefs, setShowPrefs] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    } catch {
      // Ignore storage error
    }
  }, [notifications]);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Ignore
    }
  }, [prefs]);

  const combinedNotifications = profileReminderItem
    ? [profileReminderItem, ...notifications]
    : notifications;

  const visibleNotifications = combinedNotifications.filter((n) => {
    if (!prefs.finance && n.category === 'finance') return false;
    if (!prefs.chores && n.category === 'chores') return false;
    if (!prefs.calendar && n.category === 'calendar') return false;
    if (filterMode === 'unread') return !n.read;
    return true;
  });

  const unreadCount = combinedNotifications.filter((n) => !n.read).length;

  const handleMouseEnter = () => {
    if (hoverTimeout) clearTimeout(hoverTimeout);
    const timeout = setTimeout(() => setIsOpen(true), 150);
    setHoverTimeout(timeout);
  };

  const handleMouseLeave = () => {
    if (hoverTimeout) clearTimeout(hoverTimeout);
    const timeout = setTimeout(() => setIsOpen(false), 300);
    setHoverTimeout(timeout);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleRead = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n))
    );
  };

  const handleDismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleResetDefaultNotifications = () => {
    setNotifications(INITIAL_NOTIFICATIONS);
  };

  const handleNotificationClick = (n: NotificationItem) => {
    if (n.id.startsWith('n-profile-incomplete-') && onOpenCompleteProfile) {
      setIsOpen(false);
      onOpenCompleteProfile();
      return;
    }
    setNotifications((prev) =>
      prev.map((item) => (item.id === n.id ? { ...item, read: true } : item))
    );
    setIsOpen(false);
    onNavigate(n.targetTab, n.targetSubTab);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'finance':
        return <DollarSign className="w-3.5 h-3.5 text-emerald-400" />;
      case 'chores':
        return <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />;
      case 'calendar':
        return <Calendar className="w-3.5 h-3.5 text-sky-400" />;
      case 'medical':
        return <Heart className="w-3.5 h-3.5 text-rose-400" />;
      case 'emergency':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />;
      default:
        return <Bell className="w-3.5 h-3.5 text-emerald-300" />;
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative shrink-0 z-50"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl bg-black/20 hover:bg-white/10 text-white transition-all duration-200 border border-white/15 focus:outline-hidden cursor-pointer"
        aria-label="View notifications"
      >
        <Bell className="w-4 h-4 text-emerald-100 group-hover:text-white" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white shadow-md animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl bg-stone-900/98 border border-white/20 shadow-2xl text-white text-xs z-50 overflow-hidden transition-all duration-200"
          style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
        >
          {/* Flyout Header */}
          <div className="p-3.5 border-b border-white/10 flex items-center justify-between bg-white/5">
            <div className="flex items-center space-x-2">
              <Bell className="w-4 h-4 text-[#E5C388]" />
              <h2 className="font-bold text-white tracking-wide">Notifications Center</h2>
              {unreadCount > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-[10px] text-emerald-300 hover:text-white flex items-center space-x-1 hover:underline cursor-pointer"
                >
                  <Check className="w-3 h-3" />
                  <span>Mark all read</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowPrefs(!showPrefs)}
                title="Notification Preferences"
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-emerald-200 cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Filter & Preferences Bar */}
          <div className="px-3.5 py-2 border-b border-white/10 flex items-center justify-between bg-black/30">
            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-2.5 py-0.5 rounded-lg text-[10px] font-semibold cursor-pointer ${
                  filterMode === 'all' ? 'bg-[#C39A60] text-[#173D35]' : 'text-stone-300 hover:bg-white/10'
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('unread')}
                className={`px-2.5 py-0.5 rounded-lg text-[10px] font-semibold cursor-pointer ${
                  filterMode === 'unread' ? 'bg-[#C39A60] text-[#173D35]' : 'text-stone-300 hover:bg-white/10'
                }`}
              >
                Unread ({unreadCount})
              </button>
            </div>
            {notifications.length < INITIAL_NOTIFICATIONS.length && (
              <button
                type="button"
                onClick={handleResetDefaultNotifications}
                className="text-[10px] text-emerald-300 hover:underline cursor-pointer"
              >
                Restore dismissed
              </button>
            )}
          </div>

          {showPrefs && (
            <div className="p-3 bg-emerald-950/60 border-b border-white/10 space-y-2 text-[11px]">
              <p className="font-bold text-[#E5C388]">Alert Preferences</p>
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.finance}
                    onChange={(e) => setPrefs({ ...prefs, finance: e.target.checked })}
                  />
                  <span>Finance & Budgets</span>
                </label>
                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.chores}
                    onChange={(e) => setPrefs({ ...prefs, chores: e.target.checked })}
                  />
                  <span>Chores & Household</span>
                </label>
                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.calendar}
                    onChange={(e) => setPrefs({ ...prefs, calendar: e.target.checked })}
                  />
                  <span>Planner & Reminders</span>
                </label>
              </div>
            </div>
          )}

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-white/5 scrollbar-thin scrollbar-thumb-white/10">
            {visibleNotifications.length > 0 ? (
              visibleNotifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-3 transition-all flex items-start space-x-3 cursor-pointer group ${
                    !n.read ? 'bg-emerald-950/40 hover:bg-white/10' : 'hover:bg-white/5 opacity-80 hover:opacity-100'
                  }`}
                >
                  <div className="p-2 rounded-xl bg-black/40 border border-white/10 shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                    {getCategoryIcon(n.category)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between space-x-2">
                      <p className={`font-semibold truncate text-xs ${!n.read ? 'text-white' : 'text-stone-300'}`}>
                        {n.title}
                      </p>
                      <div className="flex items-center space-x-1.5 shrink-0">
                        <span className="text-[9px] text-emerald-200/50 font-mono">{n.timestamp}</span>
                        <button
                          type="button"
                          onClick={(e) => handleDismiss(n.id, e)}
                          title="Dismiss notification"
                          className="text-stone-400 hover:text-rose-400 p-0.5 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-emerald-100/70 mt-0.5 line-clamp-2 leading-tight">
                      {n.message}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-[9px] text-[#E5C388] font-medium flex items-center space-x-1 group-hover:underline">
                        <span>Open record</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleToggleRead(n.id, e)}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-emerald-200 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
                      >
                        {n.read ? 'Mark unread' : 'Mark read'}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-emerald-200/60 space-y-2">
                <Inbox className="w-8 h-8 mx-auto text-emerald-400/40" />
                <p className="text-xs font-medium">All caught up!</p>
                <p className="text-[10px]">No matching household notifications.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
