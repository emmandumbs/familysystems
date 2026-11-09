import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  X,
  Utensils,
  CheckCircle2,
  FolderTree,
  Target,
  Home,
  Heart,
  PhoneCall,
  ArrowRight,
  Sparkles,
  Command
} from 'lucide-react';
import { MainTabType } from '../SidebarNavigation';

export interface GlobalCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  familyId: string;
  onNavigateToTab?: (tab: MainTabType, subId?: string) => void;
  onNavigateSubItem?: (parentTab: MainTabType, subItemId: string, subTabId?: MainTabType) => void;
  userRole?: string;
}

export interface SearchResultItem {
  id: string;
  domain: 'RECIPE' | 'MEAL' | 'GOAL' | 'PROJECT' | 'TASK' | 'CHORE' | 'ASSET' | 'TRADITION' | 'EMERGENCY_CONTACT';
  title: string;
  subtitle?: string;
  snippet?: string;
  badge?: string;
  routePath: string;
  targetRoute?: string;
  targetSubTab?: string;
  targetEntityId?: string;
  relevanceScore: number;
}

const DOMAIN_ICONS: Record<string, React.ElementType> = {
  RECIPE: Utensils,
  MEAL: Utensils,
  GOAL: Target,
  PROJECT: FolderTree,
  TASK: CheckCircle2,
  CHORE: CheckCircle2,
  ASSET: Home,
  TRADITION: Heart,
  EMERGENCY_CONTACT: PhoneCall,
};

const DOMAIN_LABELS: Record<string, string> = {
  ALL: 'All Domains',
  RECIPE: 'Recipes',
  CHORE: 'Chores',
  GOAL: 'Goals',
  PROJECT: 'Projects',
  TASK: 'Tasks',
  ASSET: 'Home Assets',
  TRADITION: 'Traditions',
  EMERGENCY_CONTACT: 'Safety & Contacts',
};

export const GlobalCommandPalette: React.FC<GlobalCommandPaletteProps> = ({
  isOpen,
  onClose,
  familyId,
  onNavigateToTab,
  onNavigateSubItem,
  userRole = 'MEMBER',
}) => {
  const [query, setQuery] = useState('');
  const [activeDomain, setActiveDomain] = useState<string>('ALL');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  // Debounced search query to backend
  useEffect(() => {
    if (!isOpen || !familyId) return;

    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const domainParam = activeDomain === 'ALL' ? '' : `&domains=${encodeURIComponent(activeDomain)}`;
        const res = await fetch(`/api/v1/search/${encodeURIComponent(familyId)}?q=${encodeURIComponent(query.trim())}${domainParam}`, {
          headers: { 'Content-Type': 'application/json' },
        });

        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
          setSelectedIndex(0);
        } else {
          setResults([]);
        }
      } catch (err) {
        console.warn('Search query error:', err);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, activeDomain, familyId, isOpen]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (results.length > 0 ? (prev - 1 + results.length) % results.length : 0));
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault();
        handleSelect(results[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [results, selectedIndex, onClose]
  );

  const handleSelect = (item: SearchResultItem) => {
    const targetRoute = (item.targetRoute as MainTabType) || 'overview';
    const targetSubTab = (item.targetSubTab as MainTabType) || targetRoute;
    const targetEntityId = item.targetEntityId || item.id;

    if (onNavigateSubItem) {
      onNavigateSubItem(targetRoute, targetEntityId, targetSubTab);
    } else if (onNavigateToTab) {
      onNavigateToTab(targetRoute, targetEntityId);
    } else {
      // Fallback domain-based switch if neither navigation callback is provided
      switch (item.domain) {
        case 'RECIPE':
        case 'MEAL':
        case 'CHORE':
        case 'ASSET':
          break;
        case 'GOAL':
        case 'PROJECT':
        case 'TASK':
          break;
        case 'TRADITION':
          break;
        case 'EMERGENCY_CONTACT':
          break;
        default:
          break;
      }
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="command-palette-title"
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-stone-900/60 backdrop-blur-xs transition-opacity"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-stone-200 bg-[#F7F4EC]">
          <Search className="w-5 h-5 text-[#173D35] shrink-0 mr-3" />
          <input
            id="command-palette-title"
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search recipes, chores, goals, tasks, traditions, or safety contacts..."
            className="w-full text-sm text-stone-900 bg-transparent focus:outline-hidden placeholder:text-stone-400 font-medium"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 rounded-full text-stone-400 hover:text-stone-700 mr-2 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono font-medium px-2 py-1 rounded bg-stone-200 text-stone-700 border border-stone-300">
            <Command className="w-3 h-3" /> K
          </kbd>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-stone-100 bg-stone-50 overflow-x-auto text-xs">
          {['ALL', 'RECIPE', 'CHORE', 'GOAL', 'TASK', 'ASSET', 'TRADITION', 'EMERGENCY_CONTACT'].map((dom) => (
            <button
              key={dom}
              type="button"
              onClick={() => setActiveDomain(dom)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeDomain === dom
                  ? 'bg-[#173D35] text-white shadow-xs'
                  : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
              }`}
            >
              {DOMAIN_LABELS[dom]}
            </button>
          ))}
        </div>

        {/* Results List */}
        <div ref={listRef} className="max-h-96 overflow-y-auto divide-y divide-stone-100 p-2">
          {isLoading ? (
            <div className="py-12 text-center text-stone-400">
              <div className="inline-block w-6 h-6 border-2 border-[#173D35] border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-xs">Searching family workspace...</p>
            </div>
          ) : results.length > 0 ? (
            results.map((item, idx) => {
              const Icon = DOMAIN_ICONS[item.domain] || Target;
              const isSelected = idx === selectedIndex;

              return (
                <div
                  key={`${item.domain}-${item.id}`}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between p-3 rounded-xl transition-colors cursor-pointer ${
                    isSelected ? 'bg-[#173D35]/10 text-stone-900 ring-1 ring-[#173D35]/20' : 'hover:bg-stone-50 text-stone-700'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 pr-2">
                    <div
                      className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                        isSelected ? 'bg-[#173D35] text-[#C39A60]' : 'bg-stone-100 text-[#173D35]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-stone-900 truncate">{item.title}</span>
                        {item.badge && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-stone-200 text-stone-700 shrink-0">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      {item.subtitle && <p className="text-xs text-stone-500 truncate mt-0.5">{item.subtitle}</p>}
                      {item.snippet && <p className="text-xs text-stone-400 line-clamp-1 mt-0.5 italic">{item.snippet}</p>}
                    </div>
                  </div>

                  <ArrowRight className={`w-4 h-4 shrink-0 transition-transform ${isSelected ? 'translate-x-1 text-[#173D35]' : 'text-stone-300'}`} />
                </div>
              );
            })
          ) : query.trim().length >= 2 ? (
            <div className="py-12 text-center text-stone-400">
              <Sparkles className="w-8 h-8 mx-auto text-stone-300 mb-2" />
              <p className="text-sm font-medium text-stone-700">No matching workspace records found</p>
              <p className="text-xs text-stone-400 mt-1">Try another term or adjust the domain filter.</p>
            </div>
          ) : (
            <div className="py-12 text-center text-stone-400">
              <Search className="w-8 h-8 mx-auto text-stone-300 mb-2" />
              <p className="text-sm font-medium text-stone-700">Type at least 2 characters to search</p>
              <p className="text-xs text-stone-400 mt-1">
                Searches across recipes, chores, goals, tasks, assets, traditions, and emergency contacts.
              </p>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 bg-[#F7F4EC] border-t border-stone-200/80 flex items-center justify-between text-[11px] text-stone-500">
          <div className="flex items-center gap-3">
            <span>↑↓ to navigate</span>
            <span>↵ to select</span>
            <span>ESC to close</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium text-[#173D35]">
            <span className="w-2 h-2 rounded-full bg-[#173D35]" />
            <span>Role: {userRole}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
