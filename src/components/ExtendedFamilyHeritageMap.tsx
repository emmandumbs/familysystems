import React, { useState, useMemo } from 'react';
import {
  Users,
  MapPin,
  Briefcase,
  Sparkles,
  Heart,
  MessageCircle,
  TrendingUp,
  Plus,
  Edit2,
  Trash2,
  Search,
  Globe,
  GitBranch,
  CheckCircle2,
  Upload,
  X,
  Compass,
} from 'lucide-react';

export interface GrowthAreaItem {
  id: string;
  title: string;
  category: 'CAREER_SKILL' | 'WELLBEING_HEALTH' | 'SPIRITUAL_CHARACTER' | 'EDUCATION_MENTORSHIP' | 'FAMILY_BOND' | string;
  description: string;
  howKidsCanSupport: string;
  status: 'EXPLORING' | 'ACTIVE_SUPPORT' | 'CELEBRATED' | string;
  addedByName?: string;
  createdAt?: number;
}

export interface EncouragementNoteItem {
  id: string;
  authorName: string;
  authorRole?: string;
  message: string;
  createdAt: number;
}

export interface ExtendedRelativeRecord {
  id: string;
  familyId: string;
  fullName: string;
  preferredTitle: string;
  lineageSide: 'PATERNAL' | 'MATERNAL' | 'CORE_HOUSEHOLD' | string;
  generationTier: 'ELDERS_GRANDPARENTS' | 'PARENTS_AUNTS_UNCLES' | 'CHILDREN_COUSINS' | string;
  relationshipToChildren: string;
  birthYear: number;
  age: number;
  occupation: string;
  workplaceOrSpecialty?: string;
  city: string;
  country: string;
  regionTag?: string;
  mapCoordinates?: { xPercent: number; yPercent: number };
  avatarUrl: string;
  bioAndHeritageStory: string;
  sharedInterests: string[];
  conversationStarters: string[];
  growthAreas: GrowthAreaItem[];
  encouragementNotes: EncouragementNoteItem[];
}

interface ExtendedFamilyHeritageMapProps {
  familyId: string;
  familyName: string;
  callerRole: string;
  canManage: boolean;
  coreMembers: any[];
  extendedRelatives: ExtendedRelativeRecord[];
  getHeaders: () => Record<string, string>;
  onRefreshSection: () => Promise<void>;
  showToast: (msg: string) => void;
}

const CITY_COORDINATE_PRESETS: Record<string, { xPercent: number; yPercent: number; regionTag: string }> = {
  edinburgh: { xPercent: 47, yPercent: 26, regionTag: 'Europe' },
  london: { xPercent: 48, yPercent: 32, regionTag: 'Europe' },
  paris: { xPercent: 50, yPercent: 35, regionTag: 'Europe' },
  lagos: { xPercent: 51, yPercent: 58, regionTag: 'West Africa' },
  accra: { xPercent: 48, yPercent: 59, regionTag: 'West Africa' },
  freetown: { xPercent: 44, yPercent: 57, regionTag: 'West Africa' },
  nairobi: { xPercent: 59, yPercent: 62, regionTag: 'East Africa' },
  johannesburg: { xPercent: 56, yPercent: 76, regionTag: 'Southern Africa' },
  toronto: { xPercent: 27, yPercent: 33, regionTag: 'North America' },
  boston: { xPercent: 29, yPercent: 37, regionTag: 'North America' },
  'new york': { xPercent: 28, yPercent: 39, regionTag: 'North America' },
  atlanta: { xPercent: 25, yPercent: 43, regionTag: 'North America' },
  chicago: { xPercent: 23, yPercent: 36, regionTag: 'North America' },
  'san francisco': { xPercent: 15, yPercent: 40, regionTag: 'North America' },
  sydney: { xPercent: 86, yPercent: 78, regionTag: 'Oceania' },
  dubai: { xPercent: 64, yPercent: 47, regionTag: 'Middle East' },
};

const GROWTH_CATEGORY_LABELS: Record<string, string> = {
  EDUCATION_MENTORSHIP: 'Mentorship & Learning',
  CAREER_SKILL: 'Vocation & Career Growth',
  WELLBEING_HEALTH: 'Health & Wellbeing',
  SPIRITUAL_CHARACTER: 'Spiritual & Character',
  FAMILY_BOND: 'Family Heritage & Connection',
};

const GENERATION_LABELS: Record<string, string> = {
  ELDERS_GRANDPARENTS: 'Grandparents & Family Elders',
  PARENTS_AUNTS_UNCLES: 'Parents, Aunts & Uncles',
  CHILDREN_COUSINS: 'Children & First Cousins',
};

export const ExtendedFamilyHeritageMap: React.FC<ExtendedFamilyHeritageMapProps> = ({
  familyId,
  familyName,
  callerRole,
  canManage,
  coreMembers,
  extendedRelatives,
  getHeaders,
  onRefreshSection,
  showToast,
}) => {
  const [mapMode, setMapMode] = useState<'TREE' | 'GEO_MAP'>('TREE');
  const [lineageFilter, setLineageFilter] = useState<'ALL' | 'PATERNAL' | 'MATERNAL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRelativeId, setSelectedRelativeId] = useState<string | null>(
    extendedRelatives[0]?.id || null
  );

  // Add / Edit Relative Modal State
  const [showRelativeModal, setShowRelativeModal] = useState(false);
  const [editingRelativeId, setEditingRelativeId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [relativeForm, setRelativeForm] = useState({
    fullName: '',
    preferredTitle: '',
    lineageSide: 'PATERNAL',
    generationTier: 'PARENTS_AUNTS_UNCLES',
    relationshipToChildren: '',
    age: '42',
    occupation: '',
    workplaceOrSpecialty: '',
    city: '',
    country: '',
    avatarUrl: '',
    bioAndHeritageStory: '',
    sharedInterestsText: '',
    conversationStartersText: '',
    initialGrowthTitle: '',
    initialGrowthSupport: '',
  });

  // Collaborative Growth Area & Encouragement Form State inside the Selected Relative Drawer
  const [newGrowthForm, setNewGrowthForm] = useState({
    title: '',
    category: 'EDUCATION_MENTORSHIP',
    description: '',
    howKidsCanSupport: '',
  });
  const [newEncouragementText, setNewEncouragementText] = useState('');

  const canMutate = callerRole !== 'GUEST';

  const filteredRelatives = useMemo(() => {
    return extendedRelatives.filter((rel) => {
      if (lineageFilter !== 'ALL' && rel.lineageSide !== lineageFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = rel.fullName.toLowerCase().includes(q) || rel.preferredTitle.toLowerCase().includes(q);
        const matchJob = rel.occupation.toLowerCase().includes(q) || (rel.workplaceOrSpecialty || '').toLowerCase().includes(q);
        const matchLoc = rel.city.toLowerCase().includes(q) || rel.country.toLowerCase().includes(q);
        const matchRel = rel.relationshipToChildren.toLowerCase().includes(q);
        return matchName || matchJob || matchLoc || matchRel;
      }
      return true;
    });
  }, [extendedRelatives, lineageFilter, searchQuery]);

  const selectedRelative = useMemo(() => {
    if (!selectedRelativeId) return filteredRelatives[0] || extendedRelatives[0] || null;
    return (
      extendedRelatives.find((r) => r.id === selectedRelativeId) ||
      filteredRelatives[0] ||
      null
    );
  }, [extendedRelatives, filteredRelatives, selectedRelativeId]);

  const paternalRelatives = useMemo(
    () => filteredRelatives.filter((r) => r.lineageSide === 'PATERNAL'),
    [filteredRelatives]
  );
  const maternalRelatives = useMemo(
    () => filteredRelatives.filter((r) => r.lineageSide === 'MATERNAL'),
    [filteredRelatives]
  );

  // Group by City/Country Hubs for the Geographic View
  const locationHubs = useMemo(() => {
    const map = new Map<string, { city: string; country: string; relatives: ExtendedRelativeRecord[] }>();
    for (const rel of filteredRelatives) {
      const key = `${rel.city}, ${rel.country}`;
      const existing = map.get(key);
      if (existing) {
        existing.relatives.push(rel);
      } else {
        map.set(key, { city: rel.city, country: rel.country, relatives: [rel] });
      }
    }
    return Array.from(map.values());
  }, [filteredRelatives]);

  const totalGrowthAreas = useMemo(
    () => extendedRelatives.reduce((sum, r) => sum + (r.growthAreas?.length || 0), 0),
    [extendedRelatives]
  );

  const openCreateModal = (defaultSide: 'PATERNAL' | 'MATERNAL' = 'PATERNAL') => {
    setEditingRelativeId(null);
    setRelativeForm({
      fullName: '',
      preferredTitle: '',
      lineageSide: defaultSide,
      generationTier: 'PARENTS_AUNTS_UNCLES',
      relationshipToChildren: defaultSide === 'PATERNAL' ? 'Paternal Uncle / Aunt' : 'Maternal Aunt / Uncle',
      age: '40',
      occupation: '',
      workplaceOrSpecialty: '',
      city: '',
      country: '',
      avatarUrl: '',
      bioAndHeritageStory: '',
      sharedInterestsText: '',
      conversationStartersText: '',
      initialGrowthTitle: '',
      initialGrowthSupport: '',
    });
    setShowRelativeModal(true);
  };

  const openEditModal = (rel: ExtendedRelativeRecord) => {
    setEditingRelativeId(rel.id);
    setRelativeForm({
      fullName: rel.fullName,
      preferredTitle: rel.preferredTitle,
      lineageSide: rel.lineageSide,
      generationTier: rel.generationTier,
      relationshipToChildren: rel.relationshipToChildren,
      age: String(rel.age || 40),
      occupation: rel.occupation,
      workplaceOrSpecialty: rel.workplaceOrSpecialty || '',
      city: rel.city,
      country: rel.country,
      avatarUrl: rel.avatarUrl || '',
      bioAndHeritageStory: rel.bioAndHeritageStory || '',
      sharedInterestsText: (rel.sharedInterests || []).join(', '),
      conversationStartersText: (rel.conversationStarters || []).join('\n'),
      initialGrowthTitle: '',
      initialGrowthSupport: '',
    });
    setShowRelativeModal(true);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setRelativeForm((prev) => ({ ...prev, avatarUrl: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveRelative = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!relativeForm.fullName.trim()) return;
    setIsSubmitting(true);
    try {
      const cityKey = relativeForm.city.trim().toLowerCase();
      const preset = CITY_COORDINATE_PRESETS[cityKey];
      const payload: Record<string, any> = {
        fullName: relativeForm.fullName.trim(),
        preferredTitle: relativeForm.preferredTitle.trim() || relativeForm.fullName.trim(),
        lineageSide: relativeForm.lineageSide,
        generationTier: relativeForm.generationTier,
        relationshipToChildren: relativeForm.relationshipToChildren.trim(),
        age: Math.max(1, Number(relativeForm.age || 40)),
        occupation: relativeForm.occupation.trim(),
        workplaceOrSpecialty: relativeForm.workplaceOrSpecialty.trim(),
        city: relativeForm.city.trim(),
        country: relativeForm.country.trim(),
        regionTag: preset?.regionTag || 'Family Heritage Region',
        mapCoordinates: preset
          ? { xPercent: preset.xPercent, yPercent: preset.yPercent }
          : undefined,
        avatarUrl: relativeForm.avatarUrl.trim() || undefined,
        bioAndHeritageStory: relativeForm.bioAndHeritageStory.trim(),
        sharedInterests: relativeForm.sharedInterestsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        conversationStarters: relativeForm.conversationStartersText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      };

      if (!editingRelativeId && relativeForm.initialGrowthTitle.trim()) {
        payload.growthAreas = [
          {
            title: relativeForm.initialGrowthTitle.trim(),
            category: 'EDUCATION_MENTORSHIP',
            description: relativeForm.initialGrowthTitle.trim(),
            howKidsCanSupport: relativeForm.initialGrowthSupport.trim() || 'Encourage and check in during family calls.',
            status: 'ACTIVE_SUPPORT',
          },
        ];
      }

      const url = editingRelativeId
        ? `/api/v1/family-section/${encodeURIComponent(familyId)}/extended-relatives/${encodeURIComponent(editingRelativeId)}`
        : `/api/v1/family-section/${encodeURIComponent(familyId)}/extended-relatives`;

      const res = await fetch(url, {
        method: editingRelativeId ? 'PUT' : 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        showToast(
          editingRelativeId
            ? `Updated ${relativeForm.preferredTitle || relativeForm.fullName}!`
            : `Added ${relativeForm.preferredTitle || relativeForm.fullName} to the Family Heritage Map!`
        );
        setShowRelativeModal(false);
        await onRefreshSection();
        if (data.relative?.id) {
          setSelectedRelativeId(data.relative.id);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.message || 'Could not save extended relative.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRelative = async (rel: ExtendedRelativeRecord) => {
    const res = await fetch(
      `/api/v1/family-section/${encodeURIComponent(familyId)}/extended-relatives/${encodeURIComponent(rel.id)}`,
      {
        method: 'DELETE',
        headers: getHeaders(),
      }
    );
    if (res.ok) {
      showToast(`Removed ${rel.preferredTitle || rel.fullName} from Heritage Map.`);
      await onRefreshSection();
    }
  };

  const handleAddGrowthArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRelative || !newGrowthForm.title.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(
        `/api/v1/family-section/${encodeURIComponent(familyId)}/extended-relatives/${encodeURIComponent(selectedRelative.id)}/growth`,
        {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            action: 'ADD_GROWTH_AREA',
            title: newGrowthForm.title.trim(),
            category: newGrowthForm.category,
            description: newGrowthForm.description.trim(),
            howKidsCanSupport: newGrowthForm.howKidsCanSupport.trim(),
            status: 'ACTIVE_SUPPORT',
          }),
        }
      );
      if (res.ok) {
        showToast(`Added growth & support goal for ${selectedRelative.preferredTitle}!`);
        setNewGrowthForm({
          title: '',
          category: 'EDUCATION_MENTORSHIP',
          description: '',
          howKidsCanSupport: '',
        });
        await onRefreshSection();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCycleGrowthStatus = async (growthArea: GrowthAreaItem) => {
    if (!selectedRelative || !canMutate) return;
    const order = ['EXPLORING', 'ACTIVE_SUPPORT', 'CELEBRATED'];
    const nextStatus = order[(order.indexOf(growthArea.status) + 1) % order.length];
    const res = await fetch(
      `/api/v1/family-section/${encodeURIComponent(familyId)}/extended-relatives/${encodeURIComponent(selectedRelative.id)}/growth`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          action: 'UPDATE_GROWTH_STATUS',
          growthAreaId: growthArea.id,
          status: nextStatus,
        }),
      }
    );
    if (res.ok) {
      showToast(`Updated growth status to ${nextStatus.replace('_', ' ')}.`);
      await onRefreshSection();
    }
  };

  const handleAddEncouragement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRelative || !newEncouragementText.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(
        `/api/v1/family-section/${encodeURIComponent(familyId)}/extended-relatives/${encodeURIComponent(selectedRelative.id)}/growth`,
        {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            action: 'ADD_ENCOURAGEMENT_NOTE',
            message: newEncouragementText.trim(),
          }),
        }
      );
      if (res.ok) {
        showToast(`Posted encouragement note for ${selectedRelative.preferredTitle}!`);
        setNewEncouragementText('');
        await onRefreshSection();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Renders a single compact Relative Node Card with rounded portrait photo, age, job, and city
  const renderRelativeNode = (rel: ExtendedRelativeRecord) => {
    const isSelected = selectedRelative?.id === rel.id;
    const isPaternal = rel.lineageSide === 'PATERNAL';
    const ringClass = isPaternal ? 'ring-[#C39A60]' : 'ring-[#2E6F5E]';

    return (
      <button
        key={rel.id}
        type="button"
        data-testid={`heritage-relative-node-${rel.id}`}
        onClick={() => setSelectedRelativeId(rel.id)}
        className={`w-full text-left rounded-2xl p-3.5 transition-all border ${
          isSelected
            ? 'bg-[#173D35] text-[#F7F4EC] border-[#C39A60] shadow-md'
            : 'bg-white hover:bg-stone-50/90 text-stone-900 border-stone-200/90'
        }`}
      >
        <div className="flex items-start gap-3.5">
          {/* Small Rounded Portrait Photo with Lineage Ring */}
          <div
            className={`w-14 h-14 rounded-full ring-2 ${ringClass} overflow-hidden shrink-0 bg-[#173D35] flex items-center justify-center`}
          >
            {rel.avatarUrl ? (
              <img
                src={rel.avatarUrl}
                alt={rel.fullName}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="font-serif font-bold text-sm text-[#F7F4EC]">
                {rel.fullName.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className={`font-serif font-bold text-sm truncate ${isSelected ? 'text-white' : 'text-stone-900'}`}>
                {rel.preferredTitle || rel.fullName}
              </div>
              <span
                className={`text-xs font-mono tabular-nums shrink-0 ${
                  isSelected ? 'text-[#E7D1AA]' : 'text-stone-500'
                }`}
              >
                {rel.age} yrs
              </span>
            </div>

            <div className={`text-xs truncate mt-0.5 ${isSelected ? 'text-emerald-100/90' : 'text-stone-600'}`}>
              {rel.relationshipToChildren}
            </div>

            {/* Clean unboxed metadata: What they do for a living · Where they live */}
            <div
              className={`text-[11px] mt-1.5 flex flex-wrap items-center gap-1.5 leading-snug ${
                isSelected ? 'text-[#E7D1AA]' : 'text-stone-500'
              }`}
            >
              <span className="font-medium truncate max-w-[210px]">{rel.occupation}</span>
              <span aria-hidden="true">·</span>
              <span className="whitespace-nowrap">
                {rel.city}, {rel.country}
              </span>
            </div>

            {(rel.growthAreas?.length || 0) > 0 && (
              <div
                className={`text-[11px] mt-1.5 flex items-center gap-1 ${
                  isSelected ? 'text-emerald-200' : 'text-emerald-800'
                }`}
              >
                <TrendingUp className="w-3 h-3 shrink-0" />
                <span className="truncate">
                  {rel.growthAreas.length} Growth {rel.growthAreas.length === 1 ? 'Area' : 'Areas'} ·{' '}
                  {rel.growthAreas[0].title}
                </span>
              </div>
            )}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-6" data-testid="extended-family-heritage-map">
      {/* Header & Controls Bar */}
      <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-emerald-800 tracking-wide">
              Father’s & Mother’s Extended Lineage Explorer
            </div>
            <h2 className="text-xl lg:text-2xl font-serif font-bold text-stone-900 mt-0.5">
              {familyName} Extended Family Heritage & Recognition Map
            </h2>
            <p className="text-xs text-stone-600 mt-1 max-w-3xl">
              Help children recognize every relative’s face, age, what they do for a living, where they live, and how our household can encourage their growth.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Segmented Mode Switcher: Dual-Lineage Tree vs Geographic Location Map */}
            <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-xl border border-stone-200">
              <button
                type="button"
                data-testid="heritage-mode-tree"
                onClick={() => setMapMode('TREE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                  mapMode === 'TREE'
                    ? 'bg-[#173D35] text-[#F7F4EC] shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>Dual-Lineage Tree</span>
              </button>
              <button
                type="button"
                data-testid="heritage-mode-geomap"
                onClick={() => setMapMode('GEO_MAP')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                  mapMode === 'GEO_MAP'
                    ? 'bg-[#173D35] text-[#F7F4EC] shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Where They Live Map</span>
              </button>
            </div>

            {canMutate && (
              <button
                type="button"
                data-testid="add-extended-relative-btn"
                onClick={() => openCreateModal('PATERNAL')}
                className="px-4 py-2 rounded-xl bg-[#173D35] hover:bg-[#1E4E44] text-[#F7F4EC] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5 text-[#E7D1AA]" />
                <span>Add Extended Relative</span>
              </button>
            )}
          </div>
        </div>

        {/* Summary Metrics & Filter Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4 border-t border-stone-200/80">
          <div className="flex flex-wrap items-center gap-4 text-xs text-stone-600 font-mono tabular-nums">
            <span>
              <strong className="text-stone-900">{extendedRelatives.length}</strong> Extended Relatives
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <strong className="text-[#8B652E]">
                {extendedRelatives.filter((r) => r.lineageSide === 'PATERNAL').length}
              </strong>{' '}
              Father’s Side
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <strong className="text-[#173D35]">
                {extendedRelatives.filter((r) => r.lineageSide === 'MATERNAL').length}
              </strong>{' '}
              Mother’s Side
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <strong className="text-stone-900">{locationHubs.length}</strong> Cities
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <strong className="text-emerald-800">{totalGrowthAreas}</strong> Active Growth & Mentorship Areas
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-xl">
              {(['ALL', 'PATERNAL', 'MATERNAL'] as const).map((side) => (
                <button
                  key={side}
                  type="button"
                  onClick={() => setLineageFilter(side)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    lineageFilter === side
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {side === 'ALL'
                    ? 'All Lineages'
                    : side === 'PATERNAL'
                    ? 'Father’s Side'
                    : 'Mother’s Side'}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search name, job, or city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-xl bg-stone-50 border border-stone-200 text-xs w-52"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Split Workspace: Left/Center = Interactive Heritage Map | Right = Recognition & Growth Popover Drawer */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT 7 COLUMNS: Dual-Lineage Tree OR Geographic Map */}
        <div className="xl:col-span-7 space-y-6">
          {mapMode === 'TREE' ? (
            <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs space-y-6">
              {/* Immediate Household Centerpiece Anchor */}
              <div className="rounded-2xl bg-stone-50 border border-stone-200/90 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div>
                    <div className="text-[11px] font-semibold text-stone-500">
                      Immediate Household Anchor
                    </div>
                    <h3 className="text-sm font-serif font-bold text-stone-900">
                      {familyName} Core Household (Children & Parents)
                    </h3>
                  </div>
                  <div className="text-xs text-stone-500">
                    Both lineages converge here
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {coreMembers.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white border border-stone-200/80"
                    >
                      <div className="w-9 h-9 rounded-full bg-[#173D35] text-[#F7F4EC] font-serif font-bold text-xs flex items-center justify-center overflow-hidden shrink-0">
                        {m.avatarUrl ? (
                          <img
                            src={m.avatarUrl}
                            alt={m.displayName}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          m.displayName?.slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-stone-900">{m.displayName}</div>
                        <div className="text-[11px] text-stone-500">
                          {m.relationshipToPrimary || m.role}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dual-Lineage Columns: Father's Side vs Mother's Side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* FATHER'S SIDE (PATERNAL LINEAGE) */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-stone-200">
                    <div>
                      <div className="text-[11px] font-semibold text-[#8B652E]">
                        Paternal Lineage
                      </div>
                      <h3 className="text-base font-serif font-bold text-stone-900">
                        Father’s Side ({paternalRelatives.length})
                      </h3>
                    </div>
                    {canMutate && (
                      <button
                        type="button"
                        onClick={() => openCreateModal('PATERNAL')}
                        className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add</span>
                      </button>
                    )}
                  </div>

                  {(['ELDERS_GRANDPARENTS', 'PARENTS_AUNTS_UNCLES', 'CHILDREN_COUSINS'] as const).map((tier) => {
                    const tierItems = paternalRelatives.filter((r) => r.generationTier === tier);
                    if (tierItems.length === 0) return null;
                    return (
                      <div key={tier} className="space-y-2.5">
                        <div className="text-xs font-semibold text-stone-500">
                          {GENERATION_LABELS[tier]}
                        </div>
                        <div className="space-y-2.5">{tierItems.map(renderRelativeNode)}</div>
                      </div>
                    );
                  })}
                </div>

                {/* MOTHER'S SIDE (MATERNAL LINEAGE) */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-stone-200">
                    <div>
                      <div className="text-[11px] font-semibold text-[#173D35]">
                        Maternal Lineage
                      </div>
                      <h3 className="text-base font-serif font-bold text-stone-900">
                        Mother’s Side ({maternalRelatives.length})
                      </h3>
                    </div>
                    {canMutate && (
                      <button
                        type="button"
                        onClick={() => openCreateModal('MATERNAL')}
                        className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add</span>
                      </button>
                    )}
                  </div>

                  {(['ELDERS_GRANDPARENTS', 'PARENTS_AUNTS_UNCLES', 'CHILDREN_COUSINS'] as const).map((tier) => {
                    const tierItems = maternalRelatives.filter((r) => r.generationTier === tier);
                    if (tierItems.length === 0) return null;
                    return (
                      <div key={tier} className="space-y-2.5">
                        <div className="text-xs font-semibold text-stone-500">
                          {GENERATION_LABELS[tier]}
                        </div>
                        <div className="space-y-2.5">{tierItems.map(renderRelativeNode)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* GEOGRAPHIC WHERE-THEY-LIVE MAP VIEW */
            <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs space-y-6" data-testid="heritage-geographic-map-view">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-serif font-bold text-stone-900">
                    Where Our Extended Family Lives
                  </h3>
                  <p className="text-xs text-stone-500">
                    Click any rounded portrait pin on the map to recognize their face, profession, and city.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs text-stone-600">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full border-2 border-[#C39A60] bg-[#173D35] inline-block" />
                    <span>Father’s Side</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full border-2 border-[#2E6F5E] bg-[#173D35] inline-block" />
                    <span>Mother’s Side</span>
                  </span>
                </div>
              </div>

              {/* Interactive Cartographic Canvas with Rounded Photo Pins */}
              <div className="relative w-full h-80 rounded-2xl bg-[#132A24] border border-stone-300 overflow-hidden">
                {/* Stylized Continental Map SVG Backdrop */}
                <svg
                  viewBox="0 0 1000 500"
                  className="w-full h-full object-cover opacity-35"
                  aria-hidden="true"
                >
                  <defs>
                    <pattern id="mapGrid" width="50" height="50" patternUnits="userSpaceOnUse">
                      <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#A8BDAA" strokeWidth="0.4" opacity="0.35" />
                    </pattern>
                  </defs>
                  <rect width="1000" height="500" fill="url(#mapGrid)" />
                  {/* North America */}
                  <path
                    d="M110,90 Q210,70 310,120 T330,230 Q260,260 210,230 T110,90 Z"
                    fill="#2E6F5E"
                  />
                  {/* South America */}
                  <path
                    d="M270,270 Q340,290 360,370 T300,460 Q260,410 270,270 Z"
                    fill="#2E6F5E"
                  />
                  {/* Europe */}
                  <path
                    d="M440,85 Q530,75 570,130 T510,195 Q450,185 440,85 Z"
                    fill="#C39A60"
                  />
                  {/* Africa */}
                  <path
                    d="M450,215 Q560,210 600,290 T550,430 Q470,390 450,215 Z"
                    fill="#C39A60"
                  />
                  {/* Asia & Oceania */}
                  <path
                    d="M590,95 Q780,85 870,175 T770,310 Q640,280 590,95 Z"
                    fill="#2E6F5E"
                  />
                  <path
                    d="M780,355 Q870,350 890,415 T800,435 Z"
                    fill="#C39A60"
                  />
                </svg>

                {/* Plotted Relative Rounded Portrait Pins */}
                {filteredRelatives.map((rel, index) => {
                  const coords = rel.mapCoordinates || {
                    xPercent: 25 + ((index * 17) % 55),
                    yPercent: 28 + ((index * 13) % 45),
                  };
                  const isSelected = selectedRelative?.id === rel.id;
                  const isPaternal = rel.lineageSide === 'PATERNAL';

                  return (
                    <button
                      key={rel.id}
                      type="button"
                      onClick={() => setSelectedRelativeId(rel.id)}
                      style={{
                        left: `${coords.xPercent}%`,
                        top: `${coords.yPercent}%`,
                      }}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 group focus:outline-none transition-transform ${
                        isSelected ? 'z-20 scale-110' : 'z-10 hover:scale-110'
                      }`}
                      title={`${rel.preferredTitle} · ${rel.city}, ${rel.country}`}
                    >
                      <div
                        className={`w-12 h-12 rounded-full overflow-hidden border-2 shadow-lg bg-[#173D35] ${
                          isSelected
                            ? 'border-white ring-4 ring-[#C39A60]'
                            : isPaternal
                            ? 'border-[#C39A60]'
                            : 'border-[#2E6F5E]'
                        }`}
                      >
                        <img
                          src={rel.avatarUrl}
                          alt={rel.fullName}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="mt-1 px-2 py-0.5 rounded-md bg-stone-950/85 text-[#F7F4EC] text-[10px] font-semibold whitespace-nowrap shadow-sm">
                        {rel.preferredTitle} · {rel.city}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* City & Regional Hubs Directory */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {locationHubs.map((hub) => (
                  <div
                    key={`${hub.city}-${hub.country}`}
                    className="rounded-2xl border border-stone-200 p-4 bg-stone-50/60 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-[#173D35]" />
                        <h4 className="font-serif font-bold text-sm text-stone-900">
                          {hub.city}, {hub.country}
                        </h4>
                      </div>
                      <span className="text-xs text-stone-500 font-mono tabular-nums">
                        {hub.relatives.length} {hub.relatives.length === 1 ? 'Relative' : 'Relatives'}
                      </span>
                    </div>
                    <div className="space-y-2">{hub.relatives.map(renderRelativeNode)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT 5 COLUMNS: Interactive Relative Recognition & Collaborative Growth Popover Drawer */}
        <div className="xl:col-span-5">
          {selectedRelative ? (
            <div
              className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs space-y-6 sticky top-6"
              data-testid="heritage-relative-detail-drawer"
            >
              {/* Profile Recognition Header */}
              <div className="flex items-start justify-between gap-4 pb-5 border-b border-stone-200">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-20 h-20 rounded-full overflow-hidden ring-4 shrink-0 bg-[#173D35] ${
                      selectedRelative.lineageSide === 'PATERNAL'
                        ? 'ring-[#C39A60]'
                        : 'ring-[#2E6F5E]'
                    }`}
                  >
                    <img
                      src={selectedRelative.avatarUrl}
                      alt={selectedRelative.fullName}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-emerald-800">
                      {selectedRelative.lineageSide === 'PATERNAL'
                        ? 'Father’s Side (Paternal)'
                        : 'Mother’s Side (Maternal)'}{' '}
                      · {selectedRelative.relationshipToChildren}
                    </div>
                    <h3 className="text-xl font-serif font-bold text-stone-900 mt-0.5">
                      {selectedRelative.preferredTitle}{' '}
                      <span className="text-stone-500 font-normal text-sm">
                        ({selectedRelative.fullName})
                      </span>
                    </h3>
                    <div className="text-xs text-stone-600 mt-1 font-mono tabular-nums">
                      Age {selectedRelative.age} · Born {selectedRelative.birthYear} · Lives in{' '}
                      {selectedRelative.city}, {selectedRelative.country}
                    </div>
                  </div>
                </div>

                {canMutate && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditModal(selectedRelative)}
                      className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700"
                      title="Edit relative profile"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => void handleDeleteRelative(selectedRelative)}
                        className="p-2 rounded-xl bg-stone-100 hover:bg-rose-50 text-stone-500 hover:text-rose-600"
                        title="Remove relative"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Recognition Facts: What They Do for a Living & Where They Live */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-500">
                    <Briefcase className="w-3.5 h-3.5 text-[#173D35]" />
                    <span>What They Do for a Living</span>
                  </div>
                  <div className="text-sm font-bold text-stone-900 mt-1">
                    {selectedRelative.occupation}
                  </div>
                  {selectedRelative.workplaceOrSpecialty && (
                    <div className="text-xs text-stone-600 mt-0.5">
                      {selectedRelative.workplaceOrSpecialty}
                    </div>
                  )}
                </div>

                <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-500">
                    <MapPin className="w-3.5 h-3.5 text-[#C39A60]" />
                    <span>Where They Live</span>
                  </div>
                  <div className="text-sm font-bold text-stone-900 mt-1">
                    {selectedRelative.city}, {selectedRelative.country}
                  </div>
                  <div className="text-xs text-stone-600 mt-0.5">
                    {selectedRelative.regionTag || 'Family Heritage Hub'}
                  </div>
                </div>
              </div>

              {/* Family Background Story & Shared Interests */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-stone-900">
                  Family Background & Story
                </h4>
                <p className="text-xs text-stone-600 leading-relaxed">
                  {selectedRelative.bioAndHeritageStory ||
                    `${selectedRelative.preferredTitle} is a cherished member of our ${
                      selectedRelative.lineageSide === 'PATERNAL' ? 'father’s' : 'mother’s'
                    } extended family living in ${selectedRelative.city}.`}
                </p>
                {(selectedRelative.sharedInterests || []).length > 0 && (
                  <div className="text-xs text-stone-500 pt-1">
                    <strong className="text-stone-700">Topics & Skills They Love:</strong>{' '}
                    {selectedRelative.sharedInterests.join(' · ')}
                  </div>
                )}
              </div>

              {/* Kid-Friendly Conversation Starters for Visits & Calls */}
              <div className="rounded-2xl bg-[#F7F4EC] border border-[#C39A60]/40 p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-[#173D35]">
                  <MessageCircle className="w-4 h-4 text-[#C39A60]" />
                  <span>Conversation Starters When You Meet or Call</span>
                </div>
                <ul className="space-y-1.5 text-xs text-stone-700">
                  {(selectedRelative.conversationStarters?.length
                    ? selectedRelative.conversationStarters
                    : [
                        `Ask ${selectedRelative.preferredTitle} what they enjoy most about working as a ${selectedRelative.occupation}.`,
                        `Ask them about their favorite childhood memory with our family.`,
                      ]
                  ).map((prompt, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-[#C39A60] font-bold">•</span>
                      <span>{prompt}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Potential Growth Areas, Mentorship & Support Tracker */}
              <div className="space-y-3 pt-2 border-t border-stone-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-serif font-bold text-stone-900 flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-emerald-800" />
                      <span>Potential Growth Areas & Family Support</span>
                    </h4>
                    <p className="text-[11px] text-stone-500">
                      Identify ways our household can support, learn from, or encourage {selectedRelative.preferredTitle}.
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {(selectedRelative.growthAreas || []).map((gr) => (
                    <div
                      key={gr.id}
                      className="rounded-2xl border border-stone-200 p-3.5 bg-stone-50/70 space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-bold text-xs text-stone-900">{gr.title}</div>
                        <button
                          type="button"
                          onClick={() => void handleCycleGrowthStatus(gr)}
                          className="text-[11px] font-semibold text-emerald-800 hover:underline whitespace-nowrap shrink-0"
                          title="Click to advance status"
                        >
                          {gr.status === 'CELEBRATED'
                            ? 'Celebrated'
                            : gr.status === 'ACTIVE_SUPPORT'
                            ? 'Active Support'
                            : 'Exploring'}
                        </button>
                      </div>
                      <div className="text-[11px] text-stone-500">
                        {GROWTH_CATEGORY_LABELS[gr.category] || gr.category}
                        {gr.addedByName ? ` · Identified by ${gr.addedByName}` : ''}
                      </div>
                      {gr.description && (
                        <p className="text-xs text-stone-600">{gr.description}</p>
                      )}
                      {gr.howKidsCanSupport && (
                        <div className="text-xs text-emerald-900 bg-emerald-950/5 rounded-xl px-3 py-2 mt-1">
                          <strong>How Children & Family Can Help:</strong> {gr.howKidsCanSupport}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Collaborative Form to Identify a New Potential Growth Area */}
                {canMutate && (
                  <form onSubmit={handleAddGrowthArea} className="rounded-2xl border border-stone-200 p-3.5 space-y-2.5 bg-white">
                    <div className="text-xs font-bold text-stone-800">
                      Identify a New Growth Area or Mentorship Goal
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        required
                        data-testid="growth-area-title-input"
                        placeholder="e.g., Digital skills, health walk, mentorship..."
                        value={newGrowthForm.title}
                        onChange={(e) => setNewGrowthForm((p) => ({ ...p, title: e.target.value }))}
                        className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs"
                      />
                      <select
                        value={newGrowthForm.category}
                        onChange={(e) => setNewGrowthForm((p) => ({ ...p, category: e.target.value }))}
                        className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs bg-stone-50"
                      >
                        <option value="EDUCATION_MENTORSHIP">Mentorship & Learning</option>
                        <option value="CAREER_SKILL">Vocation & Career Growth</option>
                        <option value="WELLBEING_HEALTH">Health & Wellbeing</option>
                        <option value="SPIRITUAL_CHARACTER">Spiritual & Character</option>
                        <option value="FAMILY_BOND">Family Heritage & Connection</option>
                      </select>
                    </div>
                    <input
                      type="text"
                      placeholder="How can our children or family support them in this area?"
                      value={newGrowthForm.howKidsCanSupport}
                      onChange={(e) =>
                        setNewGrowthForm((p) => ({ ...p, howKidsCanSupport: e.target.value }))
                      }
                      className="w-full px-3 py-1.5 rounded-xl border border-stone-200 text-xs"
                    />
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        data-testid="add-growth-area-submit-btn"
                        className="px-3.5 py-1.5 rounded-xl bg-[#173D35] hover:bg-[#1E4E44] text-[#F7F4EC] text-xs font-semibold"
                      >
                        Add Growth Area
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Prayer & Encouragement Notes */}
              <div className="space-y-3 pt-2 border-t border-stone-200">
                <h4 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-rose-600" />
                  <span>Encouragement & Prayer Notes ({selectedRelative.encouragementNotes?.length || 0})</span>
                </h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {(selectedRelative.encouragementNotes || []).map((note) => (
                    <div key={note.id} className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/70 text-xs">
                      <p className="text-stone-800">“{note.message}”</p>
                      <div className="text-[11px] text-stone-500 mt-1">
                        — {note.authorName}
                      </div>
                    </div>
                  ))}
                </div>
                {canMutate && (
                  <form onSubmit={handleAddEncouragement} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={`Write an encouragement note for ${selectedRelative.preferredTitle}...`}
                      value={newEncouragementText}
                      onChange={(e) => setNewEncouragementText(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-xl border border-stone-200 text-xs"
                    />
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold whitespace-nowrap shrink-0"
                    >
                      Post Note
                    </button>
                  </form>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Modal: Add or Edit Extended Family Relative */}
      {showRelativeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <h3 className="text-lg font-serif font-bold text-stone-900">
                  {editingRelativeId ? 'Edit Extended Relative Profile' : 'Add Extended Family Relative'}
                </h3>
                <p className="text-xs text-stone-500">
                  Add a relative from Father’s or Mother’s side so children recognize their face, age, profession, and city.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRelativeModal(false)}
                className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRelative} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Uncle Kwame Mensah"
                    value={relativeForm.fullName}
                    onChange={(e) => setRelativeForm((p) => ({ ...p, fullName: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200"
                  />
                </div>
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">
                    Preferred Family Title (How Kids Call Them)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Uncle Kwame / Grandma Rose"
                    value={relativeForm.preferredTitle}
                    onChange={(e) => setRelativeForm((p) => ({ ...p, preferredTitle: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">Family Lineage Side</label>
                  <select
                    value={relativeForm.lineageSide}
                    onChange={(e) => setRelativeForm((p) => ({ ...p, lineageSide: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-stone-50"
                  >
                    <option value="PATERNAL">Father’s Side (Paternal)</option>
                    <option value="MATERNAL">Mother’s Side (Maternal)</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">Generation Tier</label>
                  <select
                    value={relativeForm.generationTier}
                    onChange={(e) => setRelativeForm((p) => ({ ...p, generationTier: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-stone-50"
                  >
                    <option value="ELDERS_GRANDPARENTS">Grandparents & Elders</option>
                    <option value="PARENTS_AUNTS_UNCLES">Aunts, Uncles & Parents</option>
                    <option value="CHILDREN_COUSINS">First Cousins & Youth</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">Age (Years)</label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={relativeForm.age}
                    onChange={(e) => setRelativeForm((p) => ({ ...p, age: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">
                    Relationship to Children
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Maternal Uncle (Mother’s Brother)"
                    value={relativeForm.relationshipToChildren}
                    onChange={(e) =>
                      setRelativeForm((p) => ({ ...p, relationshipToChildren: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-stone-200"
                  />
                </div>
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">
                    What They Do for a Living (Occupation) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Cardiologist / Agricultural Entrepreneur"
                    value={relativeForm.occupation}
                    onChange={(e) => setRelativeForm((p) => ({ ...p, occupation: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">City *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., London, Toronto, Lagos, Atlanta..."
                    value={relativeForm.city}
                    onChange={(e) => setRelativeForm((p) => ({ ...p, city: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200"
                  />
                </div>
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">Country *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., United Kingdom, Canada, USA..."
                    value={relativeForm.country}
                    onChange={(e) => setRelativeForm((p) => ({ ...p, country: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">
                  Rounded Portrait Photo (Upload File or Leave Blank for Illustrated Heritage Avatar)
                </label>
                <div className="flex items-center gap-3">
                  <label className="px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold cursor-pointer flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Photo</span>
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                  </label>
                  {relativeForm.avatarUrl && (
                    <img
                      src={relativeForm.avatarUrl}
                      alt="Preview"
                      className="w-10 h-10 rounded-full object-cover border border-stone-300"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">
                  Family Background Story & Heritage Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Share their background story, values, and how they connect to our family..."
                  value={relativeForm.bioAndHeritageStory}
                  onChange={(e) =>
                    setRelativeForm((p) => ({ ...p, bioAndHeritageStory: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-stone-200"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">
                  Conversation Starters for Children (One per line)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ask Uncle Kwame how solar panels store energy..."
                  value={relativeForm.conversationStartersText}
                  onChange={(e) =>
                    setRelativeForm((p) => ({ ...p, conversationStartersText: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-stone-200"
                />
              </div>

              {!editingRelativeId && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-stone-200">
                  <div>
                    <label className="font-semibold text-stone-700 block mb-1">
                      Initial Potential Growth Area (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Expanding community clinic"
                      value={relativeForm.initialGrowthTitle}
                      onChange={(e) =>
                        setRelativeForm((p) => ({ ...p, initialGrowthTitle: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-stone-200"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-stone-700 block mb-1">
                      How Children Can Support
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Send encouragement cards & pray together"
                      value={relativeForm.initialGrowthSupport}
                      onChange={(e) =>
                        setRelativeForm((p) => ({ ...p, initialGrowthSupport: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-stone-200"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowRelativeModal(false)}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-stone-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-[#173D35] hover:bg-[#1E4E44] text-[#F7F4EC] font-semibold"
                >
                  {editingRelativeId ? 'Save Changes' : 'Add to Family Map'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
