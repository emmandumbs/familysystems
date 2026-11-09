import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
  Compass,
  Users,
  FolderTree,
  Calendar,
  Utensils,
  DollarSign,
  Shield,
  CheckCircle2,
  FileText,
  Search,
  User,
  X,
  Heart,
  BookOpen,
  UserCheck
} from 'lucide-react';
import { MainTabType } from './SidebarNavigation';

export interface GlobalTopSearchBarProps {
  onSelectTab: (tab: MainTabType, subId?: string) => void;
  onSelectRole: (role: string) => void;
  onSelectStage3SubTab?: (subTab: 'finance' | 'wellbeing' | 'emergency') => void;
}

type SearchCategory =
  | 'All'
  | 'Tasks & Planner'
  | 'Family Members'
  | 'Transactions & Money'
  | 'Events & Traditions'
  | 'Recipes & Household'
  | 'Documents & Life'
  | 'Goals & Projects';

interface SearchIndexItem {
  id: string;
  title: string;
  subtitle: string;
  category: Exclude<SearchCategory, 'All'>;
  icon: any;
  targetTab: MainTabType;
  targetSubItem?: string;
  targetRole?: string;
  keywords: string[];
}

const STATIC_SEARCH_INDEX: SearchIndexItem[] = [
  // Tasks & Planner
  {
    id: 'tp-calendar',
    title: 'Master Family Calendar & Schedule',
    subtitle: 'Day, week, month & agenda views with appointments and routines',
    category: 'Tasks & Planner',
    icon: Calendar,
    targetTab: 'calendar_routines',
    targetSubItem: 'master_calendar',
    keywords: ['calendar', 'schedule', 'appointments', 'agenda', 'week', 'month', 'planner'],
  },
  {
    id: 'tp-morning-routine',
    title: 'Morning School & Work Routine',
    subtitle: 'Daily multi-step checklist for weekday departures',
    category: 'Tasks & Planner',
    icon: CheckCircle2,
    targetTab: 'calendar_routines',
    targetSubItem: 'routines_habits',
    keywords: ['routine', 'morning', 'school', 'checklist', 'habits'],
  },
  {
    id: 'tp-dental',
    title: 'Pediatric Dentist Checkup — Lucas',
    subtitle: 'Upcoming appointment • Westfield Dental Clinic',
    category: 'Tasks & Planner',
    icon: Calendar,
    targetTab: 'calendar_routines',
    targetSubItem: 'master_calendar',
    keywords: ['dentist', 'appointment', 'lucas', 'checkup', 'doctor'],
  },

  // Family Members
  {
    id: 'fm-sarah',
    title: 'Sarah Jenkins (Owner / Mom)',
    subtitle: 'Primary household head • Full family & financial stewardship',
    category: 'Family Members',
    icon: UserCheck,
    targetTab: 'people_relationships',
    targetSubItem: 'family_tree',
    targetRole: 'OWNER',
    keywords: ['sarah', 'owner', 'mom', 'mother', 'parent', 'profile'],
  },
  {
    id: 'fm-david',
    title: 'David Jenkins (Co-Admin / Dad)',
    subtitle: 'Co-parent administrator • Budgets, projects & household care',
    category: 'Family Members',
    icon: UserCheck,
    targetTab: 'people_relationships',
    targetSubItem: 'family_tree',
    targetRole: 'ADMIN',
    keywords: ['david', 'admin', 'dad', 'father', 'spouse', 'profile'],
  },
  {
    id: 'fm-maya',
    title: 'Maya Jenkins (Teen Member)',
    subtitle: 'Grade 10 • Photography portfolio, track & personal savings',
    category: 'Family Members',
    icon: User,
    targetTab: 'people_relationships',
    targetSubItem: 'family_tree',
    targetRole: 'MEMBER',
    keywords: ['maya', 'teen', 'daughter', 'sister', 'photography'],
  },
  {
    id: 'fm-lucas',
    title: 'Lucas Jenkins (Child Profile)',
    subtitle: 'Grade 4 • Chores, reward points, reading log & soccer',
    category: 'Family Members',
    icon: User,
    targetTab: 'people_relationships',
    targetSubItem: 'family_tree',
    targetRole: 'CHILD',
    keywords: ['lucas', 'child', 'son', 'brother', 'soccer', 'lego'],
  },
  {
    id: 'fm-martha',
    title: 'Grandma Martha Vance (Extended Family)',
    subtitle: 'Trusted grandmother & weekend caregiver',
    category: 'Family Members',
    icon: Users,
    targetTab: 'people_relationships',
    targetSubItem: 'family_tree',
    targetRole: 'GUEST',
    keywords: ['martha', 'grandma', 'grandmother', 'guest', 'caregiver'],
  },

  // Transactions & Money
  {
    id: 'fin-overview',
    title: 'Household Net Worth & Cash Flow Overview',
    subtitle: 'Assets, liabilities, safe-to-spend & monthly surplus in exact cents',
    category: 'Transactions & Money',
    icon: DollarSign,
    targetTab: 'finance_hub',
    targetSubItem: 'finance_overview',
    keywords: ['money', 'finance', 'net worth', 'cash flow', 'safe to spend', 'assets'],
  },
  {
    id: 'fin-budgets',
    title: 'Monthly Category Budgets & Rollover',
    subtitle: 'Food & Groceries, Housing, Utilities, Transport & Family Fun',
    category: 'Transactions & Money',
    icon: DollarSign,
    targetTab: 'finance_hub',
    targetSubItem: 'envelope_budgets',
    keywords: ['budget', 'groceries', 'housing', 'rollover', 'spending', 'envelopes'],
  },
  {
    id: 'fin-bills',
    title: 'Recurring Bills & Subscriptions',
    subtitle: 'Mortgage, city utilities, fiber internet & insurance renewals',
    category: 'Transactions & Money',
    icon: DollarSign,
    targetTab: 'finance_hub',
    targetSubItem: 'bills_subscriptions',
    keywords: ['bills', 'recurring', 'subscriptions', 'mortgage', 'utilities', 'electric'],
  },
  {
    id: 'fin-whatif',
    title: 'Financial What-If Scenario Calculator',
    subtitle: 'Simulate changes to income, expenses & savings goals safely',
    category: 'Transactions & Money',
    icon: DollarSign,
    targetTab: 'finance_hub',
    targetSubItem: 'what_if_calculator',
    keywords: ['calculator', 'what if', 'simulation', 'savings', 'projection'],
  },

  // Events & Traditions
  {
    id: 'ev-pizza',
    title: 'Friday Night Homemade Pizza & Board Games',
    subtitle: 'Weekly Family Tradition • Every Friday at 6:30 PM',
    category: 'Events & Traditions',
    icon: Heart,
    targetTab: 'people_relationships',
    targetSubItem: 'family_traditions',
    keywords: ['tradition', 'pizza', 'game night', 'friday', 'family dinner'],
  },
  {
    id: 'ev-birthday',
    title: 'Lucas Jenkins — 10th Birthday & Gift Plan',
    subtitle: 'Important Date • Gift wishlist, budget & party checklist',
    category: 'Events & Traditions',
    icon: Calendar,
    targetTab: 'people_relationships',
    targetSubItem: 'family_traditions',
    keywords: ['birthday', 'anniversary', 'gifts', 'wishlist', 'celebration', 'lucas'],
  },
  {
    id: 'ev-checkins',
    title: 'Weekly Relationship Check-ins & Gratitude Wall',
    subtitle: 'Family appreciation notes, couple connection & Sunday huddle',
    category: 'Events & Traditions',
    icon: Heart,
    targetTab: 'relationships',
    targetSubItem: 'couple_hub',
    keywords: ['relationships', 'gratitude', 'appreciation', 'check-in', 'couple', 'meeting'],
  },

  // Recipes & Household
  {
    id: 'hh-recipes',
    title: 'Artisan Margherita & Veggie Pizza Recipe',
    subtitle: 'Recipe Library • Printable recipe card, QR code & ingredient scaler',
    category: 'Recipes & Household',
    icon: Utensils,
    targetTab: 'household_hub',
    targetSubItem: 'recipe_library',
    keywords: ['recipe', 'meal', 'pizza', 'cooking', 'qr', 'ingredients', 'dinner'],
  },
  {
    id: 'hh-grocery',
    title: 'Smart Grocery List & Pantry Inventory',
    subtitle: 'Shopping items, low-stock alerts & expiration date tracking',
    category: 'Recipes & Household',
    icon: Utensils,
    targetTab: 'household_hub',
    targetSubItem: 'grocery_pantry',
    keywords: ['grocery', 'shopping', 'pantry', 'fridge', 'expiry', 'stock'],
  },
  {
    id: 'hh-chores',
    title: 'Household Chores, Rotation & Reward Points',
    subtitle: 'Assigned chores, completion verification & point redemptions',
    category: 'Recipes & Household',
    icon: CheckCircle2,
    targetTab: 'household_hub',
    targetSubItem: 'chores_rotation',
    keywords: ['chores', 'cleaning', 'rewards', 'points', 'rotation'],
  },

  // Documents & Life
  {
    id: 'doc-passports',
    title: 'Household Passports & Birth Certificates Vault',
    subtitle: 'Identification Document • Owner & Admin access • Expiry tracked',
    category: 'Documents & Life',
    icon: FileText,
    targetTab: 'life_records',
    targetSubItem: 'document_vault',
    keywords: ['passport', 'birth certificate', 'document', 'vault', 'id', 'records'],
  },
  {
    id: 'doc-insurance',
    title: 'Comprehensive Homeowners & Auto Insurance Policy',
    subtitle: 'Insurance Document • Renewal reminder configured',
    category: 'Documents & Life',
    icon: Shield,
    targetTab: 'life_records',
    targetSubItem: 'document_vault',
    keywords: ['insurance', 'homeowners', 'policy', 'warranty', 'legal', 'deed'],
  },
  {
    id: 'doc-vehicles',
    title: '2024 Volvo XC90 & 2022 Rivian R1T Maintenance Logs',
    subtitle: 'Vehicle Management • Registration, inspection & service history',
    category: 'Documents & Life',
    icon: Compass,
    targetTab: 'life_records',
    targetSubItem: 'vehicle_management',
    keywords: ['vehicle', 'car', 'volvo', 'rivian', 'registration', 'service', 'travel'],
  },

  // Goals & Projects
  {
    id: 'gp-emergency-fund',
    title: '6-Month Family Emergency Reserve & Summer Retreat',
    subtitle: 'Family Goal • Projects, milestones, tasks & progress tracking',
    category: 'Goals & Projects',
    icon: FolderTree,
    targetTab: 'planning_execution',
    targetSubItem: 'goals_management',
    keywords: ['goal', 'project', 'milestone', 'emergency fund', 'retreat', 'progress'],
  },
  {
    id: 'gp-parenting',
    title: 'Child Milestones, Reading Logs & Micro-Lessons',
    subtitle: 'Parenting & Growth • Developmental milestones & study goals',
    category: 'Goals & Projects',
    icon: BookOpen,
    targetTab: 'parenting_growth',
    targetSubItem: 'child_milestones',
    keywords: ['parenting', 'milestones', 'reading', 'education', 'homework', 'lessons'],
  },
];

const CATEGORIES: SearchCategory[] = [
  'All',
  'Tasks & Planner',
  'Family Members',
  'Transactions & Money',
  'Events & Traditions',
  'Recipes & Household',
  'Documents & Life',
  'Goals & Projects',
];

export const GlobalTopSearchBar: React.FC<GlobalTopSearchBarProps> = ({
  onSelectTab,
  onSelectRole,
}) => {
  const [query, setQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<SearchCategory>('All');
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      setDropdownRect(containerRef.current.getBoundingClientRect());
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleUpdate = () => {
      if (containerRef.current) {
        setDropdownRect(containerRef.current.getBoundingClientRect());
      }
    };
    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate, true);
    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
    };
  }, [isOpen]);

  // Dynamically include persisted documents, contacts, traditions, and goals from localStorage
  const dynamicItems = useMemo<SearchIndexItem[]>(() => {
    const extra: SearchIndexItem[] = [];
    try {
      const savedDocs = JSON.parse(localStorage.getItem('familyos_life_documents') || '[]');
      for (const d of savedDocs) {
        if (d?.title) {
          extra.push({
            id: `dyn-doc-${d.id}`,
            title: d.title,
            subtitle: `${d.category || 'Document'} • Expires: ${d.expirationDate || 'N/A'}`,
            category: 'Documents & Life',
            icon: FileText,
            targetTab: 'life_records',
            keywords: [d.title.toLowerCase(), (d.category || '').toLowerCase(), 'document', 'vault'],
          });
        }
      }
      const savedContacts = JSON.parse(localStorage.getItem('familyos_life_contacts') || '[]');
      for (const c of savedContacts) {
        if (c?.name) {
          extra.push({
            id: `dyn-cnt-${c.id}`,
            title: c.name,
            subtitle: `${c.category || 'Contact'} • ${c.phone || ''}`,
            category: 'Documents & Life',
            icon: Shield,
            targetTab: 'life_records',
            keywords: [c.name.toLowerCase(), (c.category || '').toLowerCase(), 'contact', 'phone'],
          });
        }
      }
      const savedDates = JSON.parse(localStorage.getItem('familyos_important_dates') || '[]');
      for (const dt of savedDates) {
        if (dt?.title) {
          extra.push({
            id: `dyn-dt-${dt.id}`,
            title: dt.title,
            subtitle: `${dt.category} • ${dt.nextOccurrence || dt.date}`,
            category: 'Events & Traditions',
            icon: Calendar,
            targetTab: 'people_relationships',
            keywords: [dt.title.toLowerCase(), (dt.category || '').toLowerCase(), 'birthday', 'anniversary'],
          });
        }
      }
    } catch {
      // Ignore storage parse errors
    }
    return extra;
  }, [isOpen, query]);

  const combinedIndex = useMemo(() => {
    const map = new Map<string, SearchIndexItem>();
    for (const item of [...dynamicItems, ...STATIC_SEARCH_INDEX]) {
      map.set(item.title.toLowerCase(), item);
    }
    return Array.from(map.values());
  }, [dynamicItems]);

  const filteredResults = useMemo(() => {
    return combinedIndex
      .filter((item) => {
        if (selectedCategory !== 'All' && item.category !== selectedCategory) return false;
        if (!query.trim()) return true;
        const q = query.toLowerCase().trim();
        return (
          item.title.toLowerCase().includes(q) ||
          item.subtitle.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.keywords.some((k) => k.toLowerCase().includes(q))
        );
      })
      .slice(0, 10);
  }, [combinedIndex, query, selectedCategory]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(true);
        inputRef.current?.focus();
      } else if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, selectedCategory]);

  const handleSelectResult = (item: SearchIndexItem) => {
    if (item.targetTab) {
      onSelectTab(item.targetTab, item.targetSubItem);
    }
    if (item.targetRole) {
      onSelectRole(item.targetRole);
    }
    setIsOpen(false);
    setQuery('');
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredResults.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + Math.max(1, filteredResults.length)) % Math.max(1, filteredResults.length));
    } else if (e.key === 'Enter' && filteredResults[selectedIndex]) {
      e.preventDefault();
      handleSelectResult(filteredResults[selectedIndex]);
    }
  };

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0 max-w-md mx-1 sm:mx-4">
      <div
        onClick={() => {
          setIsOpen(true);
          inputRef.current?.focus();
        }}
        className={`flex items-center w-full px-3.5 py-2 rounded-2xl border transition-all duration-200 cursor-pointer ${
          isOpen
            ? 'bg-white text-stone-900 border-[#C39A60] shadow-lg ring-2 ring-[#C39A60]/30'
            : 'bg-black/20 text-white border-white/15 hover:bg-black/30 hover:border-white/25'
        }`}
      >
        <Search className={`w-4 h-4 mr-2.5 shrink-0 ${isOpen ? 'text-emerald-900' : 'text-emerald-200/80'}`} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onKeyDown={handleInputKeyDown}
          placeholder="Search tasks, members, money, events, recipes, docs... (⌘K)"
          className={`w-full text-xs bg-transparent focus:outline-hidden placeholder:truncate ${
            isOpen ? 'text-stone-900 placeholder-stone-400' : 'text-white placeholder-emerald-100/70'
          }`}
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            className={`p-0.5 rounded-full ${
              isOpen ? 'text-stone-400 hover:text-stone-700' : 'text-emerald-200 hover:text-white'
            }`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <kbd
            className={`hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded border ml-2 shrink-0 ${
              isOpen
                ? 'bg-stone-100 text-stone-500 border-stone-300'
                : 'bg-white/10 text-emerald-100/90 border-white/15'
            }`}
          >
            ⌘K
          </kbd>
        )}
      </div>

      {isOpen && dropdownRect && ReactDOM.createPortal(
        <div className="fixed inset-0 z-50 bg-transparent" onClick={() => setIsOpen(false)}>
          <div
            className="absolute bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden z-50 animate-in fade-in duration-150"
            style={{
              top: dropdownRect.bottom + 6,
              left: dropdownRect.left,
              width: Math.max(dropdownRect.width, 380),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Category Filter Pills */}
            <div className="px-3 py-2 bg-stone-50 border-b border-stone-200 flex items-center gap-1.5 overflow-x-auto">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    selectedCategory === cat
                      ? 'bg-[#173D35] text-white'
                      : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-stone-100">
              {filteredResults.length > 0 ? (
                <div className="py-1.5">
                  {filteredResults.map((item, idx) => {
                    const IconComponent = item.icon;
                    const isHighlighted = idx === selectedIndex;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectResult(item)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between transition-colors cursor-pointer ${
                          isHighlighted ? 'bg-emerald-900/10 text-stone-900' : 'hover:bg-stone-50 text-stone-700'
                        }`}
                      >
                        <div className="flex items-center space-x-3 min-w-0 pr-3">
                          <div
                            className={`p-2 rounded-xl shrink-0 ${
                              isHighlighted ? 'bg-[#173D35] text-[#E5C388]' : 'bg-stone-100 text-stone-600'
                            }`}
                          >
                            <IconComponent className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-stone-900 truncate">{item.title}</div>
                            <div className="text-[11px] text-stone-500 truncate">{item.subtitle}</div>
                          </div>
                        </div>

                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 bg-stone-100 text-stone-600">
                          {item.category}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 px-4 text-center">
                  <p className="text-xs font-semibold text-stone-700">No matching family records found</p>
                  <p className="text-[11px] text-stone-400 mt-1">
                    Try searching for a family member, budget category, recipe, task, or document title.
                  </p>
                </div>
              )}
            </div>

            <div className="px-3.5 py-2 bg-stone-50 border-t border-stone-200/80 flex items-center justify-between text-[10px] text-stone-500">
              <span>↑↓ to navigate • Enter to open</span>
              <span>ESC to close</span>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
