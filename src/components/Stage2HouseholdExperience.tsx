import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Utensils,
  BookOpen,
  Package,
  ShoppingCart,
  CheckSquare,
  Shirt,
  Wrench,
  Plus,
  Search,
  Trash2,
  Edit2,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Star,
  Sparkles,
  RefreshCw,
  Printer,
  ListChecks,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  BookmarkPlus,
  History,
  FolderCog,
  Check,
  X,
} from 'lucide-react';
import {
  HouseholdAttachment,
  ChecklistTemplate,
  AttachmentUploader,
  AttachmentBadgeList,
  AttachmentPreviewModal,
  TemplateManagerModal,
  DeleteConfirmModal,
  PrintOperationsModal,
  FAMILY_MEMBERS,
  ROLE_TO_MEMBER_ID,
  getMemberName,
  getMemberShortName,
} from './household/HouseholdSharedComponents';
import {
  RecipeScalerDrawer,
  AssetServiceHistoryDrawer,
  PantryTaxonomyModal,
  formatEpochDate,
} from './household/HouseholdModals';
import type { ExportDocumentType } from './export/PrintableExportView';

type SubTab = 'meals' | 'recipes' | 'pantry' | 'groceries' | 'chores' | 'wardrobe' | 'assets';

const SUB_TO_ID: Record<SubTab, string> = {
  meals: 'house_meals',
  recipes: 'house_recipes',
  pantry: 'house_pantry',
  groceries: 'house_groceries',
  chores: 'house_chores',
  wardrobe: 'house_wardrobe',
  assets: 'house_assets',
};

const ID_TO_SUB: Record<string, SubTab> = {
  house_meals: 'meals',
  house_recipes: 'recipes',
  house_pantry: 'pantry',
  house_groceries: 'groceries',
  house_chores: 'chores',
  house_wardrobe: 'wardrobe',
  house_assets: 'assets',
};

function getStartOfWeek(offsetWeeks: number): Date {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() + diffToMonday + offsetWeeks * 7);
  return monday;
}

function formatDateISO(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseDateISOToEpoch(iso?: string): number {
  if (!iso) return Date.now();
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return Date.now();
  const dateObj = new Date(y, m - 1, d, 0, 0, 0, 0);
  return dateObj.getTime();
}

export const Stage2HouseholdExperience: React.FC<{
  familyId: string;
  callerRole?: string;
  sessionToken?: string;
  selectedPersona?: string;
  activeSubPage?: string;
  onSelectSubPage?: (subId: string) => void;
  onOpenPrintDoc?: (docType: ExportDocumentType, recipeId?: string) => void;
}> = ({ familyId, callerRole, sessionToken, selectedPersona, activeSubPage, onSelectSubPage, onOpenPrintDoc }) => {
  const effectiveRole = callerRole || selectedPersona || 'OWNER';
  const [subTab, setSubTab] = useState<SubTab>(() =>
    activeSubPage && ID_TO_SUB[activeSubPage] ? ID_TO_SUB[activeSubPage] : 'meals'
  );

  useEffect(() => {
    if (activeSubPage && ID_TO_SUB[activeSubPage] && ID_TO_SUB[activeSubPage] !== subTab) {
      setSubTab(ID_TO_SUB[activeSubPage]);
    }
  }, [activeSubPage, subTab]);

  const handleSelectTab = (tab: SubTab) => {
    setSubTab(tab);
    if (onSelectSubPage) {
      onSelectSubPage(SUB_TO_ID[tab]);
    }
  };

  const activeMemberId = ROLE_TO_MEMBER_ID[effectiveRole] || 'mem-sarah';

  // Backend state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [recipes, setRecipes] = useState<any[]>([]);
  const [meals, setMeals] = useState<any[]>([]);
  const [pantry, setPantry] = useState<any[]>([]);
  const [groceries, setGroceries] = useState<any[]>([]);
  const [chores, setChores] = useState<any[]>([]);
  const [choreHistory, setChoreHistory] = useState<any[]>([]);
  const [wardrobe, setWardrobe] = useState<any[]>([]);
  const [outfits, setOutfits] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [assetMaintenance, setAssetMaintenance] = useState<any[]>([]);
  const [checklistTemplates, setChecklistTemplates] = useState<ChecklistTemplate[]>([]);
  const [customLocations, setCustomLocations] = useState<string[]>([]);
  const [customCategories, setCustomCategories] = useState<string[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 3500);
  }, []);

  const getHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-dev-Bypass-Auth': effectiveRole,
      'x-dev-member-id': activeMemberId,
    };
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }
    return headers;
  }, [effectiveRole, activeMemberId, sessionToken]);

  const fetchHouseholdData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/v1/household/${encodeURIComponent(familyId)}/overview`, {
          headers: getHeaders(),
        });
        if (!res.ok) throw new Error('Failed to load household records');
        const json = await res.json();
        const d = json.data || {};
        setRecipes(d.recipes || []);
        setMeals(d.mealPlan || []);
        setPantry(d.pantry || []);
        setGroceries(d.groceries || []);
        setChores(d.chores || []);
        setChoreHistory(d.choreHistory || []);
        setWardrobe(d.wardrobe || []);
        setOutfits(d.outfits || []);
        setAssets(d.assets || []);
        setAssetMaintenance(d.assetMaintenance || []);
        setChecklistTemplates(d.checklistTemplates || []);
        setCustomLocations(d.customPantryLocations || []);
        setCustomCategories(d.customPantryCategories || []);
      } catch (err: any) {
        setError(err.message || 'Unable to load household data');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [familyId, getHeaders]
  );

  useEffect(() => {
    fetchHouseholdData();
  }, [fetchHouseholdData]);

  useEffect(() => {
    const onExternalSync = () => fetchHouseholdData(true);
    window.addEventListener('familyos-household-updated', onExternalSync);
    return () => window.removeEventListener('familyos-household-updated', onExternalSync);
  }, [fetchHouseholdData]);

  const notifySync = useCallback(async () => {
    await fetchHouseholdData(true);
    window.dispatchEvent(new CustomEvent('familyos-household-updated'));
  }, [fetchHouseholdData]);

  // Global Modals & Drawers
  const [previewAttachment, setPreviewAttachment] = useState<HouseholdAttachment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    title: string;
    subtitle?: string;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateDomainFilter, setTemplateDomainFilter] = useState<'ALL' | 'CHORE' | 'ROUTINE' | 'MAINTENANCE'>('ALL');
  const [templateApplyCallback, setTemplateApplyCallback] = useState<
    ((template: ChecklistTemplate) => void) | undefined
  >(undefined);
  const [showTaxonomyModal, setShowTaxonomyModal] = useState(false);
  const [scalerRecipe, setScalerRecipe] = useState<any | null>(null);
  const [serviceDrawerAsset, setServiceDrawerAsset] = useState<any | null>(null);
  const [showChoreHistoryModal, setShowChoreHistoryModal] = useState(false);

  // Search, Filters, Sorting per sub-page
  const [searchQuery, setSearchQuery] = useState('');
  const [weekOffset, setWeekOffset] = useState(0);
  const [mealTypeFilter, setMealTypeFilter] = useState<'ALL' | 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK'>('ALL');

  const [recipeCategoryFilter, setRecipeCategoryFilter] = useState('ALL');
  const [recipeDifficultyFilter, setRecipeDifficultyFilter] = useState('ALL');
  const [recipeFavoritesOnly, setRecipeFavoritesOnly] = useState(false);
  const [recipeSort, setRecipeSort] = useState<'title' | 'time' | 'rating'>('rating');

  const [pantryLocationFilter, setPantryLocationFilter] = useState('ALL');
  const [pantryCategoryFilter, setPantryCategoryFilter] = useState('ALL');
  const [pantryStatusFilter, setPantryStatusFilter] = useState<'ALL' | 'LOW_STOCK' | 'EXPIRING_SOON' | 'EXPIRED'>('ALL');
  const [pantrySort, setPantrySort] = useState<'name' | 'quantity' | 'expiry'>('name');

  const [groceryCategoryFilter, setGroceryCategoryFilter] = useState('ALL');
  const [groceryStatusFilter, setGroceryStatusFilter] = useState<'ALL' | 'TO_BUY' | 'PURCHASED'>('ALL');
  const [grocerySort, setGrocerySort] = useState<'category' | 'name' | 'quantity'>('category');

  const [choreZoneFilter, setChoreZoneFilter] = useState('ALL');
  const [choreStatusFilter, setChoreStatusFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');
  const [choreMemberFilter, setChoreMemberFilter] = useState('ALL');
  const [choreSort, setChoreSort] = useState<'dueDate' | 'points' | 'title'>('dueDate');

  const [wardrobeSeasonFilter, setWardrobeSeasonFilter] = useState('ALL');
  const [wardrobeMemberFilter, setWardrobeMemberFilter] = useState('ALL');
  const [wardrobeStatusFilter, setWardrobeStatusFilter] = useState<'ALL' | 'CLEAN' | 'LAUNDRY'>('ALL');

  const [assetCategoryFilter, setAssetCategoryFilter] = useState('ALL');
  const [assetSort, setAssetSort] = useState<'name' | 'nextMaintenance' | 'price'>('nextMaintenance');

  useEffect(() => {
    setSearchQuery('');
  }, [subTab]);

  // Unified Entity Form Modal State
  const [entityModal, setEntityModal] = useState<{
    type: 'MEAL' | 'RECIPE' | 'PANTRY' | 'GROCERY' | 'CHORE' | 'WARDROBE' | 'OUTFIT' | 'ASSET' | 'MAINTENANCE';
    mode: 'CREATE' | 'EDIT';
    record?: any;
    parentAsset?: any;
  } | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const allPantryLocations = useMemo(
    () =>
      Array.from(
        new Set([
          'Main Pantry',
          'Main Fridge',
          'Deep Freezer',
          'Spice Rack',
          'Root Cellar',
          ...customLocations,
        ])
      ),
    [customLocations]
  );

  const allPantryCategories = useMemo(
    () =>
      Array.from(
        new Set([
          'PANTRY',
          'FRIDGE',
          'FREEZER',
          'PRODUCE',
          'DAIRY',
          'MEAT',
          'BAKERY',
          'SNACKS',
          'BEVERAGES',
          'SPICES',
          ...customCategories,
        ])
      ),
    [customCategories]
  );

  const todayISO = formatDateISO(new Date());

  // Open Form Helper
  const openEntityModal = (
    type: 'MEAL' | 'RECIPE' | 'PANTRY' | 'GROCERY' | 'CHORE' | 'WARDROBE' | 'OUTFIT' | 'ASSET' | 'MAINTENANCE',
    mode: 'CREATE' | 'EDIT',
    record?: any,
    parentAsset?: any
  ) => {
    setFormError(null);
    if (type === 'MEAL') {
      setFormData({
        date: record?.date || formatEpochDate(record?.planDate) || todayISO,
        mealType: record?.mealType || 'DINNER',
        recipeId: record?.recipeId || '',
        customMealTitle: record?.customMealTitle || '',
        servings: record?.servings ?? 4,
        notes: record?.notes || '',
        imageUri: record?.imageUri || undefined,
        attachments: record?.attachments || [],
      });
    } else if (type === 'RECIPE') {
      setFormData({
        title: record?.title || '',
        description: record?.description || '',
        category: record?.category || 'DINNER',
        difficulty: record?.difficulty || 'MEDIUM',
        prepTimeMinutes: record?.prepTimeMinutes ?? 15,
        cookTimeMinutes: record?.cookTimeMinutes ?? 25,
        servings: record?.servings ?? 4,
        familyRating: record?.familyRating ?? 5,
        isFavorite: record?.isFavorite ?? false,
        dietaryNotes: record?.dietaryNotes || '',
        ingredients:
          record?.ingredients?.length > 0
            ? record.ingredients.map((i: any) => ({
                id: i.id,
                itemName: i.itemName || i.name || '',
                quantity: i.quantity ?? 1,
                unit: i.unit || 'item',
              }))
            : [{ itemName: '', quantity: 1, unit: 'cups' }],
        instructions:
          record?.instructions?.length > 0
            ? record.instructions.map((s: any) => (typeof s === 'string' ? s : s.instructionText || ''))
            : [''],
        imageUri: record?.imageUri || undefined,
        attachments: record?.attachments || [],
      });
    } else if (type === 'PANTRY') {
      setFormData({
        itemName: record?.itemName || '',
        category: record?.category || 'PANTRY',
        storageLocation: record?.storageLocation || allPantryLocations[0] || 'Main Pantry',
        quantity: record?.quantity ?? 1,
        unit: record?.unit || 'item',
        minThreshold: record?.minThreshold ?? 1,
        expiryDate: formatEpochDate(record?.expiryDate) || '',
        notes: record?.notes || '',
        imageUri: record?.imageUri || undefined,
        attachments: record?.attachments || [],
      });
    } else if (type === 'GROCERY') {
      setFormData({
        itemName: record?.itemName || '',
        category: record?.category || 'PRODUCE',
        quantity: record?.quantity ?? 1,
        unit: record?.unit || 'item',
        notes: record?.notes || '',
      });
    } else if (type === 'CHORE') {
      setFormData({
        title: record?.title || '',
        description: record?.description || '',
        zone: record?.zone || 'KITCHEN',
        frequency: record?.frequency || 'WEEKLY',
        rewardPoints: record?.rewardPoints ?? 20,
        nextDueDate: formatEpochDate(record?.nextDueDate) || todayISO,
        assignedMemberId: record?.assignedMemberId || activeMemberId,
        checklist:
          record?.checklist?.length > 0
            ? record.checklist.map((s: any) => ({
                id: s.id,
                text: s.text || s.title || '',
                isDone: Boolean(s.isDone ?? s.completed),
              }))
            : [{ id: 'step-1', text: '', isDone: false }],
        imageUri: record?.imageUri || undefined,
        attachments: record?.attachments || [],
      });
    } else if (type === 'WARDROBE') {
      setFormData({
        itemName: record?.itemName || '',
        memberId: record?.memberId || activeMemberId,
        category: record?.category || 'TOPS',
        season: record?.season || 'ALL_SEASON',
        color: record?.color || 'Navy',
        isClean: record?.isClean ?? true,
        notes: record?.notes || '',
        imageUri: record?.imageUri || undefined,
        attachments: record?.attachments || [],
      });
    } else if (type === 'OUTFIT') {
      setFormData({
        outfitName: record?.outfitName || '',
        memberId: record?.memberId || activeMemberId,
        occasion: record?.occasion || 'SCHOOL',
        planDate: record?.planDate || todayISO,
        notes: record?.notes || '',
        itemIds: record?.itemIds ? [...record.itemIds] : [],
        imageUri: record?.imageUri || undefined,
        attachments: record?.attachments || [],
      });
    } else if (type === 'ASSET') {
      setFormData({
        name: record?.name || '',
        category: record?.category || 'APPLIANCES',
        location: record?.location || 'Kitchen',
        modelNumber: record?.modelNumber || '',
        serialNumber: record?.serialNumber || '',
        purchaseDate: formatEpochDate(record?.purchaseDate) || todayISO,
        purchasePriceDollars: record?.purchasePriceCents ? (record.purchasePriceCents / 100).toFixed(2) : '0.00',
        warrantyExpiration: formatEpochDate(record?.warrantyExpiration) || '',
        maintenanceFrequencyMonths: record?.maintenanceFrequencyMonths ?? 6,
        nextMaintenanceDate: formatEpochDate(record?.nextMaintenanceDate) || todayISO,
        description: record?.description || '',
        imageUri: record?.imageUri || undefined,
        attachments: record?.attachments || [],
      });
    } else if (type === 'MAINTENANCE') {
      setFormData({
        notes: record?.notes || '',
        maintenanceDate: formatEpochDate(record?.maintenanceDate) || todayISO,
        performedBy: record?.performedBy || getMemberName(activeMemberId),
        costDollars: record?.costCents ? (record.costCents / 100).toFixed(2) : '0.00',
        nextDueDate: formatEpochDate(record?.nextDueDate) || '',
        checklist:
          record?.checklist?.length > 0
            ? record.checklist.map((s: any) => ({
                id: s.id,
                text: s.text || s.title || '',
                isDone: Boolean(s.isDone ?? s.completed),
              }))
            : [],
        attachments: record?.attachments || [],
      });
    }
    setEntityModal({ type, mode, record, parentAsset });
  };

  // Template API Handlers
  const handleSaveTemplate = async (
    payload: { name: string; domain: 'CHORE' | 'MAINTENANCE' | 'ROUTINE'; category: string; items: string[] },
    editingId?: string | null
  ) => {
    const url = editingId
      ? `/api/v1/household/${encodeURIComponent(familyId)}/templates/${encodeURIComponent(editingId)}`
      : `/api/v1/household/${encodeURIComponent(familyId)}/templates`;
    const res = await fetch(url, {
      method: editingId ? 'PUT' : 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to save checklist template');
    await notifySync();
    showToast(editingId ? 'Checklist template updated' : 'Checklist template saved');
  };

  const handleDeleteTemplate = async (templateId: string) => {
    const res = await fetch(
      `/api/v1/household/${encodeURIComponent(familyId)}/templates/${encodeURIComponent(templateId)}`,
      {
        method: 'DELETE',
        headers: getHeaders(),
      }
    );
    if (!res.ok) throw new Error('Failed to delete template');
    await notifySync();
    showToast('Checklist template removed');
  };

  const handleSaveCurrentChecklistAsTemplate = async (
    domain: 'CHORE' | 'ROUTINE' | 'MAINTENANCE',
    name: string,
    category: string,
    steps: { text: string }[]
  ) => {
    const cleanItems = steps.map((s) => String(s.text || '').trim()).filter(Boolean);
    if (cleanItems.length === 0) {
      showToast('Add at least one checklist step before saving as a template', 'error');
      return;
    }
    await handleSaveTemplate({
      name: `${name || 'Checklist'} Template`,
      domain,
      category: category || 'GENERAL',
      items: cleanItems,
    });
  };

  // Submit Unified Entity Modal
  const handleEntityFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityModal) return;
    setFormError(null);
    setFormSubmitting(true);

    try {
      const { type, mode, record, parentAsset } = entityModal;
      const base = `/api/v1/household/${encodeURIComponent(familyId)}`;
      let url = '';
      const method = mode === 'CREATE' ? 'POST' : 'PUT';
      let payload: any = {};

      if (type === 'MEAL') {
        if (!formData.recipeId && !formData.customMealTitle?.trim()) {
          throw new Error('Select a linked recipe or enter a custom meal title.');
        }
        url = mode === 'CREATE' ? `${base}/meals` : `${base}/meals/${encodeURIComponent(record.id)}`;
        payload = {
          planDate: parseDateISOToEpoch(formData.date),
          mealType: formData.mealType,
          recipeId: formData.recipeId || undefined,
          customMealTitle: formData.customMealTitle?.trim() || undefined,
          servings: Math.max(1, Number(formData.servings) || 4),
          notes: formData.notes?.trim() || undefined,
          imageUri: formData.imageUri || undefined,
          attachments: formData.attachments || [],
        };
      } else if (type === 'RECIPE') {
        if (!formData.title?.trim()) throw new Error('Recipe title is required.');
        const cleanIngredients = (formData.ingredients || [])
          .filter((i: any) => i.itemName?.trim())
          .map((i: any) => ({
            itemName: i.itemName.trim(),
            quantity: Math.max(0.05, Number(i.quantity) || 1),
            unit: i.unit?.trim() || 'item',
          }));
        if (cleanIngredients.length === 0) throw new Error('Add at least one ingredient.');
        const cleanInstructions = (formData.instructions || [])
          .map((s: string) => String(s || '').trim())
          .filter(Boolean);
        if (cleanInstructions.length === 0) throw new Error('Add at least one preparation step.');

        url = mode === 'CREATE' ? `${base}/recipes` : `${base}/recipes/${encodeURIComponent(record.id)}`;
        payload = {
          title: formData.title.trim(),
          description: formData.description?.trim() || undefined,
          category: formData.category,
          difficulty: formData.difficulty,
          prepTimeMinutes: Math.max(0, Number(formData.prepTimeMinutes) || 0),
          cookTimeMinutes: Math.max(0, Number(formData.cookTimeMinutes) || 0),
          servings: Math.max(1, Number(formData.servings) || 4),
          familyRating: Math.min(5, Math.max(1, Number(formData.familyRating) || 5)),
          isFavorite: Boolean(formData.isFavorite),
          dietaryNotes: formData.dietaryNotes?.trim() || undefined,
          ingredients: cleanIngredients,
          instructions: cleanInstructions,
          imageUri: formData.imageUri || undefined,
          attachments: formData.attachments || [],
        };
      } else if (type === 'PANTRY') {
        if (!formData.itemName?.trim()) throw new Error('Item name is required.');
        url = mode === 'CREATE' ? `${base}/pantry` : `${base}/pantry/${encodeURIComponent(record.id)}`;
        payload = {
          itemName: formData.itemName.trim(),
          category: formData.category,
          storageLocation: formData.storageLocation,
          quantity: Math.max(0, Number(formData.quantity) || 0),
          unit: formData.unit?.trim() || 'item',
          minThreshold: Math.max(0, Number(formData.minThreshold) || 0),
          expiryDate: formData.expiryDate ? parseDateISOToEpoch(formData.expiryDate) : undefined,
          notes: formData.notes?.trim() || undefined,
          imageUri: formData.imageUri || undefined,
          attachments: formData.attachments || [],
        };
      } else if (type === 'GROCERY') {
        if (!formData.itemName?.trim()) throw new Error('Grocery item name is required.');
        url = mode === 'CREATE' ? `${base}/groceries` : `${base}/groceries/${encodeURIComponent(record.id)}`;
        payload = {
          itemName: formData.itemName.trim(),
          category: formData.category,
          quantity: Math.max(0.1, Number(formData.quantity) || 1),
          unit: formData.unit?.trim() || 'item',
          notes: formData.notes?.trim() || undefined,
        };
      } else if (type === 'CHORE') {
        if (!formData.title?.trim()) throw new Error('Chore title is required.');
        url = mode === 'CREATE' ? `${base}/chores` : `${base}/chores/${encodeURIComponent(record.id)}`;
        payload = {
          title: formData.title.trim(),
          description: formData.description?.trim() || undefined,
          zone: formData.zone,
          frequency: formData.frequency,
          rewardPoints: Math.max(0, Number(formData.rewardPoints) || 10),
          nextDueDate: parseDateISOToEpoch(formData.nextDueDate),
          assignedMemberId: formData.assignedMemberId || activeMemberId,
          checklist: (formData.checklist || [])
            .filter((s: any) => s.text?.trim())
            .map((s: any, idx: number) => ({
              id: s.id || `step-${idx + 1}`,
              text: s.text.trim(),
              isDone: Boolean(s.isDone),
            })),
          imageUri: formData.imageUri || undefined,
          attachments: formData.attachments || [],
        };
      } else if (type === 'WARDROBE') {
        if (!formData.itemName?.trim()) throw new Error('Garment name is required.');
        url = mode === 'CREATE' ? `${base}/wardrobe` : `${base}/wardrobe/${encodeURIComponent(record.id)}`;
        payload = {
          itemName: formData.itemName.trim(),
          memberId: formData.memberId,
          category: formData.category,
          season: formData.season,
          color: formData.color?.trim() || 'Neutral',
          isClean: Boolean(formData.isClean),
          notes: formData.notes?.trim() || undefined,
          imageUri: formData.imageUri || undefined,
          attachments: formData.attachments || [],
        };
      } else if (type === 'OUTFIT') {
        if (!formData.outfitName?.trim()) throw new Error('Outfit name is required.');
        url = mode === 'CREATE' ? `${base}/outfits` : `${base}/outfits/${encodeURIComponent(record.id)}`;
        payload = {
          outfitName: formData.outfitName.trim(),
          memberId: formData.memberId,
          occasion: formData.occasion,
          planDate: formData.planDate || todayISO,
          notes: formData.notes?.trim() || undefined,
          itemIds: formData.itemIds || [],
          imageUri: formData.imageUri || undefined,
          attachments: formData.attachments || [],
        };
      } else if (type === 'ASSET') {
        if (!formData.name?.trim()) throw new Error('Equipment or asset name is required.');
        url = mode === 'CREATE' ? `${base}/assets` : `${base}/assets/${encodeURIComponent(record.id)}`;
        payload = {
          name: formData.name.trim(),
          category: formData.category,
          location: formData.location?.trim() || 'Home',
          modelNumber: formData.modelNumber?.trim() || undefined,
          serialNumber: formData.serialNumber?.trim() || undefined,
          purchaseDate: formData.purchaseDate ? parseDateISOToEpoch(formData.purchaseDate) : undefined,
          purchasePriceCents: Math.round(Math.max(0, Number(formData.purchasePriceDollars) || 0) * 100),
          warrantyExpiration: formData.warrantyExpiration
            ? parseDateISOToEpoch(formData.warrantyExpiration)
            : undefined,
          maintenanceFrequencyMonths: Math.max(1, Number(formData.maintenanceFrequencyMonths) || 6),
          nextMaintenanceDate: formData.nextMaintenanceDate
            ? parseDateISOToEpoch(formData.nextMaintenanceDate)
            : undefined,
          description: formData.description?.trim() || undefined,
          imageUri: formData.imageUri || undefined,
          attachments: formData.attachments || [],
        };
      } else if (type === 'MAINTENANCE') {
        if (!formData.notes?.trim()) throw new Error('Service summary is required.');
        const targetAssetId = parentAsset?.id || record?.assetId;
        url =
          mode === 'CREATE'
            ? `${base}/assets/${encodeURIComponent(targetAssetId)}/maintenance`
            : `${base}/assets/${encodeURIComponent(targetAssetId)}/maintenance/${encodeURIComponent(record.id)}`;
        payload = {
          notes: formData.notes.trim(),
          maintenanceDate: parseDateISOToEpoch(formData.maintenanceDate),
          performedBy: formData.performedBy?.trim() || 'Household',
          costCents: Math.round(Math.max(0, Number(formData.costDollars) || 0) * 100),
          nextDueDate: formData.nextDueDate ? parseDateISOToEpoch(formData.nextDueDate) : undefined,
          checklist: (formData.checklist || [])
            .filter((s: any) => s.text?.trim())
            .map((s: any, idx: number) => ({
              id: s.id || `mstep-${idx + 1}`,
              text: s.text.trim(),
              isDone: Boolean(s.isDone),
            })),
          attachments: formData.attachments || [],
        };
      }

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Failed to save changes');
      }

      setEntityModal(null);
      await notifySync();
      showToast(mode === 'CREATE' ? 'Record added to household database' : 'Changes saved');
    } catch (err: any) {
      setFormError(err.message || 'Could not save record');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Delete confirmation handler
  const requestDelete = (title: string, subtitle: string, endpoint: string) => {
    setDeleteTarget({
      title,
      subtitle,
      onConfirm: async () => {
        const res = await fetch(`/api/v1/household/${encodeURIComponent(familyId)}${endpoint}`, {
          method: 'DELETE',
          headers: getHeaders(),
        });
        if (!res.ok) {
          showToast('Failed to delete item', 'error');
          return;
        }
        await notifySync();
        showToast(`Deleted "${title}"`);
      },
    });
  };

  // Quick Direct Actions
  const handleAutoFillWeekMeals = async () => {
    const monday = getStartOfWeek(weekOffset);
    const res = await fetch(`/api/v1/household/${encodeURIComponent(familyId)}/meals/batch-schedule-week`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ startEpoch: monday.getTime() }),
    });
    if (res.ok) {
      await notifySync();
      showToast('Auto-filled weekly meal plan from family recipes');
    }
  };

  const handleSyncMealsToGroceries = async () => {
    const res = await fetch(`/api/v1/household/${encodeURIComponent(familyId)}/workflow/sync-meals-to-groceries`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (res.ok) {
      const json = await res.json();
      await notifySync();
      showToast(`Synced ${json.itemsAddedOrUpdated ?? 0} meal ingredients to Groceries`);
    }
  };

  const handleToggleRecipeFavorite = async (recipe: any) => {
    await fetch(`/api/v1/household/${encodeURIComponent(familyId)}/recipes/${encodeURIComponent(recipe.id)}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ isFavorite: !recipe.isFavorite }),
    });
    await notifySync();
  };

  const handleSyncRecipeIngredientsToGroceries = async (recipe: any, scaleFactor: number) => {
    for (const ing of recipe.ingredients || []) {
      const qty = Math.round(Number(ing.quantity || 1) * scaleFactor * 100) / 100;
      await fetch(`/api/v1/household/${encodeURIComponent(familyId)}/groceries`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          itemName: ing.itemName || ing.name,
          category: 'PANTRY',
          quantity: qty,
          unit: ing.unit || 'item',
        }),
      });
    }
    await notifySync();
    showToast(`Added ${(recipe.ingredients || []).length} scaled ingredients to Groceries`);
  };

  const handleAdjustPantryQty = async (item: any, delta: number) => {
    const endpoint = delta < 0 ? 'consume' : 'restock';
    await fetch(
      `/api/v1/household/${encodeURIComponent(familyId)}/pantry/${encodeURIComponent(item.id)}/${endpoint}`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ amount: Math.abs(delta) }),
      }
    );
    await notifySync();
  };

  const handleAddLocation = async (location: string) => {
    await fetch(`/api/v1/household/${encodeURIComponent(familyId)}/pantry/locations`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ location }),
    });
    await notifySync();
  };

  const handleRemoveLocation = async (location: string) => {
    await fetch(
      `/api/v1/household/${encodeURIComponent(familyId)}/pantry/locations/${encodeURIComponent(location)}`,
      {
        method: 'DELETE',
        headers: getHeaders(),
      }
    );
    await notifySync();
  };

  const handleAddCategory = async (category: string) => {
    await fetch(`/api/v1/household/${encodeURIComponent(familyId)}/pantry/categories`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ category }),
    });
    await notifySync();
  };

  const handleRemoveCategory = async (category: string) => {
    await fetch(
      `/api/v1/household/${encodeURIComponent(familyId)}/pantry/categories/${encodeURIComponent(category)}`,
      {
        method: 'DELETE',
        headers: getHeaders(),
      }
    );
    await notifySync();
  };

  const handleToggleGroceryPurchased = async (item: any, restockPantry = false) => {
    if (restockPantry && !item.isPurchased) {
      await fetch(
        `/api/v1/household/${encodeURIComponent(familyId)}/groceries/${encodeURIComponent(item.id)}/purchase`,
        {
          method: 'POST',
          headers: getHeaders(),
        }
      );
      await notifySync();
      showToast(`Purchased & restocked "${item.itemName}" to Pantry`);
    } else {
      await fetch(`/api/v1/household/${encodeURIComponent(familyId)}/groceries/${encodeURIComponent(item.id)}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ isPurchased: !item.isPurchased }),
      });
      await notifySync();
    }
  };

  const handleSyncLowPantryToGroceries = async () => {
    const res = await fetch(
      `/api/v1/household/${encodeURIComponent(familyId)}/workflow/sync-pantry-low-stock-to-groceries`,
      {
        method: 'POST',
        headers: getHeaders(),
      }
    );
    if (res.ok) {
      const json = await res.json();
      await notifySync();
      showToast(`Synced ${json.addedLowStockCount ?? 0} low-stock pantry items to Groceries`);
    }
  };

  const handleClearPurchasedGroceries = async () => {
    await fetch(`/api/v1/household/${encodeURIComponent(familyId)}/groceries/clear-purchased`, {
      method: 'POST',
      headers: getHeaders(),
    });
    await notifySync();
    showToast('Cleared purchased items from shopping list');
  };

  const handleToggleChoreStep = async (chore: any, stepIdx: number) => {
    const nextChecklist = (chore.checklist || []).map((s: any, idx: number) =>
      idx === stepIdx ? { ...s, isDone: !s.isDone } : s
    );
    await fetch(`/api/v1/household/${encodeURIComponent(familyId)}/chores/${encodeURIComponent(chore.id)}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ checklist: nextChecklist }),
    });
    await notifySync();
  };

  const handleCompleteOrReopenChore = async (chore: any) => {
    if (chore.isCompleted) {
      await fetch(`/api/v1/household/${encodeURIComponent(familyId)}/chores/${encodeURIComponent(chore.id)}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ isCompleted: false }),
      });
      await notifySync();
      showToast(`Reopened "${chore.title}"`);
    } else {
      await fetch(
        `/api/v1/household/${encodeURIComponent(familyId)}/chores/${encodeURIComponent(chore.id)}/complete`,
        {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ completedByMemberId: chore.assignedMemberId || activeMemberId }),
        }
      );
      await notifySync();
      showToast(`Completed "${chore.title}" (+${chore.rewardPoints || 0} pts)`);
    }
  };

  const handleToggleWardrobeClean = async (item: any) => {
    await fetch(`/api/v1/household/${encodeURIComponent(familyId)}/wardrobe/${encodeURIComponent(item.id)}/clean`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ isClean: !item.isClean }),
    });
    await notifySync();
  };

  const handleWashAllDirtyLaundry = async () => {
    const res = await fetch(`/api/v1/household/${encodeURIComponent(familyId)}/wardrobe/laundry-cycle`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (res.ok) {
      await notifySync();
      showToast('All laundry items marked clean & ready to wear');
    }
  };

  const handleToggleMaintenanceChecklistStep = async (asset: any, record: any, stepIdx: number) => {
    const nextChecklist = (record.checklist || []).map((s: any, idx: number) =>
      idx === stepIdx ? { ...s, isDone: !s.isDone } : s
    );
    await fetch(
      `/api/v1/household/${encodeURIComponent(familyId)}/assets/${encodeURIComponent(asset.id)}/maintenance/${encodeURIComponent(record.id)}`,
      {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ checklist: nextChecklist }),
      }
    );
    await notifySync();
  };

  // Computed Week Days for Meal Planner
  const weekDays = useMemo(() => {
    const monday = getStartOfWeek(weekOffset);
    return Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      return {
        iso: formatDateISO(d),
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        formatted: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      };
    });
  }, [weekOffset]);

  // Filtered & Sorted Lists
  const filteredRecipes = useMemo(() => {
    return recipes
      .filter((r) => {
        if (recipeCategoryFilter !== 'ALL' && r.category !== recipeCategoryFilter) return false;
        if (recipeDifficultyFilter !== 'ALL' && r.difficulty !== recipeDifficultyFilter) return false;
        if (recipeFavoritesOnly && !r.isFavorite) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = r.title?.toLowerCase().includes(q);
          const matchDesc = r.description?.toLowerCase().includes(q);
          const matchIng = (r.ingredients || []).some((i: any) =>
            (i.itemName || i.name || '').toLowerCase().includes(q)
          );
          if (!matchTitle && !matchDesc && !matchIng) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (recipeSort === 'title') return (a.title || '').localeCompare(b.title || '');
        if (recipeSort === 'time') {
          return (
            (a.prepTimeMinutes || 0) +
            (a.cookTimeMinutes || 0) -
            ((b.prepTimeMinutes || 0) + (b.cookTimeMinutes || 0))
          );
        }
        return (b.familyRating || 0) - (a.familyRating || 0);
      });
  }, [recipes, recipeCategoryFilter, recipeDifficultyFilter, recipeFavoritesOnly, searchQuery, recipeSort]);

  const filteredPantry = useMemo(() => {
    return pantry
      .filter((p) => {
        if (pantryLocationFilter !== 'ALL' && p.storageLocation !== pantryLocationFilter) return false;
        if (pantryCategoryFilter !== 'ALL' && p.category !== pantryCategoryFilter) return false;
        if (pantryStatusFilter === 'LOW_STOCK' && !p.isLowStock) return false;
        if (pantryStatusFilter === 'EXPIRING_SOON' && p.expiryStatus !== 'EXPIRING_SOON') return false;
        if (pantryStatusFilter === 'EXPIRED' && p.expiryStatus !== 'EXPIRED') return false;
        if (searchQuery.trim() && !p.itemName?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => {
        if (pantrySort === 'quantity') return Number(a.quantity) - Number(b.quantity);
        if (pantrySort === 'expiry') return Number(a.expiryDate || 9e15) - Number(b.expiryDate || 9e15);
        return (a.itemName || '').localeCompare(b.itemName || '');
      });
  }, [pantry, pantryLocationFilter, pantryCategoryFilter, pantryStatusFilter, searchQuery, pantrySort]);

  const filteredGroceries = useMemo(() => {
    return groceries
      .filter((g) => {
        if (groceryCategoryFilter !== 'ALL' && g.category !== groceryCategoryFilter) return false;
        if (groceryStatusFilter === 'TO_BUY' && g.isPurchased) return false;
        if (groceryStatusFilter === 'PURCHASED' && !g.isPurchased) return false;
        if (searchQuery.trim() && !g.itemName?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.isPurchased !== b.isPurchased) return a.isPurchased ? 1 : -1;
        if (grocerySort === 'name') return (a.itemName || '').localeCompare(b.itemName || '');
        if (grocerySort === 'quantity') return Number(b.quantity) - Number(a.quantity);
        return (a.category || '').localeCompare(b.category || '');
      });
  }, [groceries, groceryCategoryFilter, groceryStatusFilter, searchQuery, grocerySort]);

  const filteredChores = useMemo(() => {
    return chores
      .filter((c) => {
        if (choreZoneFilter !== 'ALL' && c.zone !== choreZoneFilter) return false;
        if (choreStatusFilter === 'PENDING' && c.isCompleted) return false;
        if (choreStatusFilter === 'COMPLETED' && !c.isCompleted) return false;
        if (choreMemberFilter !== 'ALL' && c.assignedMemberId !== choreMemberFilter) return false;
        if (searchQuery.trim() && !c.title?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => {
        if (choreSort === 'points') return Number(b.rewardPoints || 0) - Number(a.rewardPoints || 0);
        if (choreSort === 'title') return (a.title || '').localeCompare(b.title || '');
        return Number(a.nextDueDate || 0) - Number(b.nextDueDate || 0);
      });
  }, [chores, choreZoneFilter, choreStatusFilter, choreMemberFilter, searchQuery, choreSort]);

  const filteredWardrobe = useMemo(() => {
    return wardrobe
      .filter((w) => {
        if (wardrobeSeasonFilter !== 'ALL' && w.season !== wardrobeSeasonFilter) return false;
        if (wardrobeMemberFilter !== 'ALL' && w.memberId !== wardrobeMemberFilter) return false;
        if (wardrobeStatusFilter === 'CLEAN' && !w.isClean) return false;
        if (wardrobeStatusFilter === 'LAUNDRY' && w.isClean) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          if (!w.itemName?.toLowerCase().includes(q) && !w.color?.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.itemName || '').localeCompare(b.itemName || ''));
  }, [wardrobe, wardrobeSeasonFilter, wardrobeMemberFilter, wardrobeStatusFilter, searchQuery]);

  const filteredAssets = useMemo(() => {
    return assets
      .filter((a) => {
        if (assetCategoryFilter !== 'ALL' && a.category !== assetCategoryFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          if (
            !a.name?.toLowerCase().includes(q) &&
            !a.modelNumber?.toLowerCase().includes(q) &&
            !a.location?.toLowerCase().includes(q)
          ) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (assetSort === 'name') return (a.name || '').localeCompare(b.name || '');
        if (assetSort === 'price') return Number(b.purchasePriceCents || 0) - Number(a.purchasePriceCents || 0);
        return Number(a.nextMaintenanceDate || 9e15) - Number(b.nextMaintenanceDate || 9e15);
      });
  }, [assets, assetCategoryFilter, searchQuery, assetSort]);

  const navItems: { id: SubTab; label: string; icon: React.ComponentType<any>; count: number }[] = [
    { id: 'meals', label: 'Meal Plan', icon: Utensils, count: meals.length },
    { id: 'recipes', label: 'Recipes', icon: BookOpen, count: recipes.length },
    { id: 'pantry', label: 'Pantry', icon: Package, count: pantry.length },
    {
      id: 'groceries',
      label: 'Groceries',
      icon: ShoppingCart,
      count: groceries.filter((g) => !g.isPurchased).length,
    },
    { id: 'chores', label: 'Chores', icon: CheckSquare, count: chores.filter((c) => !c.isCompleted).length },
    { id: 'wardrobe', label: 'Wardrobe', icon: Shirt, count: wardrobe.length },
    { id: 'assets', label: 'Equipment', icon: Wrench, count: assets.length },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Feedback Banner */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg border flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 ${
            toast.type === 'error'
              ? 'bg-rose-950 text-white border-rose-800'
              : 'bg-slate-900 text-white border-slate-800'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Clean Minimalist Sub-Navigation Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = subTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectTab(item.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                  active
                    ? 'bg-emerald-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] tabular-nums ${
                    active ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {item.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setTemplateDomainFilter(
                subTab === 'assets' ? 'MAINTENANCE' : subTab === 'chores' ? 'CHORE' : 'ALL'
              );
              setTemplateApplyCallback(undefined);
              setShowTemplateModal(true);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5"
          >
            <ListChecks className="w-3.5 h-3.5 text-emerald-700" />
            <span>Checklist Templates ({checklistTemplates.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setShowPrintModal(true)}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            title="Print / Export Household Sheet"
          >
            <Printer className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => fetchHouseholdData()}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            title="Refresh household state"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center justify-between text-xs text-rose-800">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchHouseholdData()}
            className="px-3 py-1 rounded-lg bg-white border border-rose-200 font-semibold text-rose-700 hover:bg-rose-100"
          >
            Retry
          </button>
        </div>
      )}

      {/* =====================================================================
          1. MEAL PLAN SUB-PAGE (Focused 7-Day Grid, zero duplicate lists)
         ===================================================================== */}
      {subTab === 'meals' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Weekly Meal Schedule</h2>
              <p className="text-xs text-slate-500">
                Plan family breakfasts, lunches, and dinners and sync missing ingredients to groceries.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center bg-slate-100 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setWeekOffset((w) => w - 1)}
                  className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900"
                  title="Previous Week"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setWeekOffset(0)}
                  className="px-2.5 py-1 text-xs font-bold text-slate-700 hover:text-slate-900"
                >
                  {weekOffset === 0 ? 'This Week' : weekOffset > 0 ? `+${weekOffset}w` : `${weekOffset}w`}
                </button>
                <button
                  type="button"
                  onClick={() => setWeekOffset((w) => w + 1)}
                  className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900"
                  title="Next Week"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <select
                value={mealTypeFilter}
                onChange={(e) => setMealTypeFilter(e.target.value as any)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
              >
                <option value="ALL">All Meal Slots</option>
                <option value="BREAKFAST">Breakfast Only</option>
                <option value="LUNCH">Lunch Only</option>
                <option value="DINNER">Dinner Only</option>
                <option value="SNACK">Snacks Only</option>
              </select>

              <button
                type="button"
                onClick={handleAutoFillWeekMeals}
                className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Auto-Fill Week
              </button>

              <button
                type="button"
                onClick={handleSyncMealsToGroceries}
                className="px-3.5 py-2 rounded-xl border border-emerald-200 bg-emerald-50/70 text-emerald-900 hover:bg-emerald-100 text-xs font-semibold flex items-center gap-1.5"
              >
                <ShoppingCart className="w-3.5 h-3.5" /> Sync Ingredients to Groceries
              </button>

              <button
                type="button"
                onClick={() => openEntityModal('MEAL', 'CREATE')}
                className="px-4 py-2 rounded-xl bg-emerald-800 text-white hover:bg-emerald-900 text-xs font-semibold flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" /> Schedule Meal
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
            {weekDays.map((day) => {
              const isToday = day.iso === todayISO;
              const dayMeals = meals
                .filter((m) => {
                  const mealIso = formatEpochDate(m.planDate);
                  return mealIso === day.iso && (mealTypeFilter === 'ALL' || m.mealType === mealTypeFilter);
                })
                .sort((a, b) => {
                  const order: Record<string, number> = { BREAKFAST: 1, LUNCH: 2, DINNER: 3, SNACK: 4 };
                  return (order[a.mealType] || 9) - (order[b.mealType] || 9);
                });

              return (
                <div
                  key={day.iso}
                  className={`rounded-2xl border p-3.5 flex flex-col min-h-[260px] transition-all ${
                    isToday ? 'bg-emerald-50/30 border-emerald-400 shadow-xs' : 'bg-white border-slate-200/90'
                  }`}
                >
                  <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-100">
                    <div>
                      <span
                        className={`text-xs font-extrabold uppercase tracking-wider block ${
                          isToday ? 'text-emerald-800' : 'text-slate-700'
                        }`}
                      >
                        {day.dayName}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium tabular-nums">{day.formatted}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => openEntityModal('MEAL', 'CREATE', { date: day.iso, mealType: 'DINNER' })}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-800 hover:bg-emerald-50"
                      title={`Add meal for ${day.dayName}`}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex-1 space-y-2.5">
                    {dayMeals.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => openEntityModal('MEAL', 'CREATE', { date: day.iso, mealType: 'DINNER' })}
                        className="w-full h-28 rounded-xl border border-dashed border-slate-200 hover:border-emerald-300 text-slate-400 hover:text-emerald-700 text-xs font-medium flex flex-col items-center justify-center gap-1 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Meal</span>
                      </button>
                    ) : (
                      dayMeals.map((meal) => {
                        const linkedRecipe = recipes.find((r) => r.id === meal.recipeId);
                        const title = linkedRecipe?.title || meal.customMealTitle || 'Planned Meal';
                        return (
                          <div
                            key={meal.id}
                            className="p-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 shadow-2xs transition-all space-y-2"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider">
                                {meal.mealType}
                              </span>
                              <div className="flex items-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => openEntityModal('MEAL', 'EDIT', meal)}
                                  className="p-1 text-slate-400 hover:text-slate-700"
                                  title="Edit Meal"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    requestDelete(
                                      title,
                                      `Remove "${title}" from ${day.dayName}?`,
                                      `/meals/${encodeURIComponent(meal.id)}`
                                    )
                                  }
                                  className="p-1 text-slate-400 hover:text-rose-600"
                                  title="Remove Meal"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            <div>
                              <button
                                type="button"
                                onClick={() =>
                                  linkedRecipe ? setScalerRecipe(linkedRecipe) : openEntityModal('MEAL', 'EDIT', meal)
                                }
                                className="text-left text-xs font-bold leading-snug text-slate-900 hover:text-emerald-800"
                              >
                                {title}
                              </button>
                              <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                                {meal.servings || 4} servings {meal.notes ? `• ${meal.notes}` : ''}
                              </p>
                            </div>

                            <AttachmentBadgeList
                              imageUri={meal.imageUri}
                              attachments={meal.attachments}
                              onPreview={setPreviewAttachment}
                            />
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          2. RECIPES SUB-PAGE
         ===================================================================== */}
      {subTab === 'recipes' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative min-w-[220px] flex-1 max-w-xs">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search recipes or ingredients..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <select
                value={recipeCategoryFilter}
                onChange={(e) => setRecipeCategoryFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
              >
                <option value="ALL">All Categories</option>
                <option value="BREAKFAST">Breakfast</option>
                <option value="LUNCH">Lunch</option>
                <option value="DINNER">Dinner</option>
                <option value="DESSERT">Dessert</option>
                <option value="SNACK">Snack</option>
              </select>

              <select
                value={recipeDifficultyFilter}
                onChange={(e) => setRecipeDifficultyFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
              >
                <option value="ALL">All Difficulties</option>
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>

              <button
                type="button"
                onClick={() => setRecipeFavoritesOnly((v) => !v)}
                className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 ${
                  recipeFavoritesOnly
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Star className={`w-3.5 h-3.5 ${recipeFavoritesOnly ? 'fill-amber-400 text-amber-500' : ''}`} />
                <span>Favorites</span>
              </button>

              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <ArrowUpDown className="w-3.5 h-3.5" />
                <select
                  value={recipeSort}
                  onChange={(e) => setRecipeSort(e.target.value as any)}
                  className="px-2.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
                >
                  <option value="rating">Sort: Highest Rated</option>
                  <option value="time">Sort: Quickest Total Time</option>
                  <option value="title">Sort: Alphabetical</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={() => openEntityModal('RECIPE', 'CREATE')}
              className="px-4 py-2 rounded-xl bg-emerald-800 text-white hover:bg-emerald-900 text-xs font-semibold flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> New Recipe
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRecipes.map((recipe) => {
              const totalMinutes = (recipe.prepTimeMinutes || 0) + (recipe.cookTimeMinutes || 0);
              return (
                <div
                  key={recipe.id}
                  className="bg-white rounded-2xl border border-slate-200/90 p-5 flex flex-col justify-between hover:border-slate-300 transition-all shadow-2xs"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-[10px] font-bold uppercase tracking-wider">
                            {recipe.category}
                          </span>
                          <span className="text-[11px] text-slate-400 font-semibold tabular-nums">
                            {totalMinutes} min • {recipe.servings} srv
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-slate-900 mt-1">{recipe.title}</h3>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleRecipeFavorite(recipe)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 cursor-pointer"
                          title="Toggle favorite"
                        >
                          <Star
                            className={`w-4 h-4 ${recipe.isFavorite ? 'fill-amber-400 text-amber-500' : ''}`}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenPrintDoc ? onOpenPrintDoc('RECIPE_CARD', recipe.id) : setScalerRecipe(recipe)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-[#C39A60] hover:bg-amber-50 transition-colors cursor-pointer"
                          title="Print Recipe Card"
                          aria-label="Print Recipe Card"
                        >
                          <Printer className="w-4 h-4 text-[#C39A60]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEntityModal('RECIPE', 'EDIT', recipe)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                          title="Edit recipe"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            requestDelete(
                              recipe.title,
                              'This removes the recipe from your family cookbook.',
                              `/recipes/${encodeURIComponent(recipe.id)}`
                            )
                          }
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          title="Delete recipe"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {recipe.description && (
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{recipe.description}</p>
                    )}

                    <AttachmentBadgeList
                      imageUri={recipe.imageUri}
                      attachments={recipe.attachments}
                      onPreview={setPreviewAttachment}
                    />
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500 font-medium tabular-nums">
                      {(recipe.ingredients || []).length} ingredients • {(recipe.instructions || []).length} steps
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setScalerRecipe(recipe)}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold"
                      >
                        Cook & Scale
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          openEntityModal('MEAL', 'CREATE', {
                            recipeId: recipe.id,
                            servings: recipe.servings || 4,
                            mealType: recipe.category === 'BREAKFAST' ? 'BREAKFAST' : 'DINNER',
                          })
                        }
                        className="px-2.5 py-1.5 rounded-lg border border-emerald-200 text-emerald-800 hover:bg-emerald-50 text-xs font-semibold"
                      >
                        + Plan
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          3. PANTRY SUB-PAGE
         ===================================================================== */}
      {subTab === 'pantry' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative min-w-[200px] flex-1 max-w-xs">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search pantry & fridge..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <select
                value={pantryLocationFilter}
                onChange={(e) => setPantryLocationFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
              >
                <option value="ALL">All Locations</option>
                {allPantryLocations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>

              <select
                value={pantryCategoryFilter}
                onChange={(e) => setPantryCategoryFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
              >
                <option value="ALL">All Categories</option>
                {allPantryCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <select
                value={pantryStatusFilter}
                onChange={(e) => setPantryStatusFilter(e.target.value as any)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
              >
                <option value="ALL">All Stock Levels</option>
                <option value="LOW_STOCK">Low Stock Only</option>
                <option value="EXPIRING_SOON">Expiring Soon</option>
                <option value="EXPIRED">Expired</option>
              </select>

              <select
                value={pantrySort}
                onChange={(e) => setPantrySort(e.target.value as any)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
              >
                <option value="name">Sort: Item Name</option>
                <option value="quantity">Sort: Lowest Quantity</option>
                <option value="expiry">Sort: Expiry Date</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowTaxonomyModal(true)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5"
              >
                <FolderCog className="w-3.5 h-3.5" /> Locations & Categories
              </button>
              <button
                type="button"
                onClick={() => openEntityModal('PANTRY', 'CREATE')}
                className="px-4 py-2 rounded-xl bg-emerald-800 text-white hover:bg-emerald-900 text-xs font-semibold flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add Pantry Item
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPantry.map((item) => {
              const expDateStr = formatEpochDate(item.expiryDate);
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-slate-200/90 p-5 flex flex-col justify-between hover:border-slate-300 transition-all shadow-2xs"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold uppercase">
                            {item.storageLocation || 'Main Pantry'}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-slate-50 text-slate-500 text-[10px] font-semibold uppercase">
                            {item.category}
                          </span>
                          {item.isLowStock && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-bold uppercase">
                              Low Stock
                            </span>
                          )}
                          {item.expiryStatus === 'EXPIRED' && (
                            <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px] font-bold uppercase">
                              Expired
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-bold text-slate-900 mt-1.5">{item.itemName}</h3>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEntityModal('PANTRY', 'EDIT', item)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            requestDelete(
                              item.itemName,
                              'Remove this item from household inventory.',
                              `/pantry/${encodeURIComponent(item.id)}`
                            )
                          }
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {expDateStr && (
                      <p className="text-xs text-slate-500 tabular-nums">
                        Expires: <span className="font-semibold text-slate-700">{expDateStr}</span>
                      </p>
                    )}

                    <AttachmentBadgeList
                      imageUri={item.imageUri}
                      attachments={item.attachments}
                      onPreview={setPreviewAttachment}
                    />
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-lg font-extrabold text-slate-900 tabular-nums">
                        {item.quantity} {item.unit}
                      </span>
                      <span className="text-[11px] text-slate-400 block tabular-nums">
                        Min threshold: {item.minThreshold} {item.unit}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleAdjustPantryQty(item, -1)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 tabular-nums"
                      >
                        -1 Use
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdjustPantryQty(item, 1)}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900 hover:bg-emerald-100 tabular-nums"
                      >
                        +1 Restock
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          4. GROCERIES SUB-PAGE
         ===================================================================== */}
      {subTab === 'groceries' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative min-w-[200px] flex-1 max-w-xs">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search shopping list..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <select
                value={groceryCategoryFilter}
                onChange={(e) => setGroceryCategoryFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
              >
                <option value="ALL">All Aisles</option>
                {allPantryCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <select
                value={groceryStatusFilter}
                onChange={(e) => setGroceryStatusFilter(e.target.value as any)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
              >
                <option value="ALL">All Items</option>
                <option value="TO_BUY">To Buy ({groceries.filter((g) => !g.isPurchased).length})</option>
                <option value="PURCHASED">Purchased ({groceries.filter((g) => g.isPurchased).length})</option>
              </select>

              <select
                value={grocerySort}
                onChange={(e) => setGrocerySort(e.target.value as any)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
              >
                <option value="category">Sort: Store Aisle</option>
                <option value="name">Sort: Alphabetical</option>
                <option value="quantity">Sort: Quantity</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSyncLowPantryToGroceries}
                className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
              >
                + Sync Low Stock
              </button>
              <button
                type="button"
                onClick={handleSyncMealsToGroceries}
                className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
              >
                + Sync Meal Plan
              </button>
              {groceries.some((g) => g.isPurchased) && (
                <button
                  type="button"
                  onClick={handleClearPurchasedGroceries}
                  className="px-3 py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold"
                >
                  Clear Purchased
                </button>
              )}
              <button
                type="button"
                onClick={() => openEntityModal('GROCERY', 'CREATE')}
                className="px-4 py-2 rounded-xl bg-emerald-800 text-white hover:bg-emerald-900 text-xs font-semibold flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add Item
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/90 divide-y divide-slate-100 overflow-hidden">
            {filteredGroceries.length === 0 ? (
              <div className="p-10 text-center">
                <ShoppingCart className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700">Your shopping list is clear</p>
                <p className="text-xs text-slate-500 mt-1">
                  Add items directly or sync from your weekly Meal Plan and Low-Stock Pantry.
                </p>
              </div>
            ) : (
              filteredGroceries.map((item) => (
                <div
                  key={item.id}
                  className={`px-5 py-3.5 flex items-center justify-between gap-4 transition-colors ${
                    item.isPurchased ? 'bg-slate-50/70' : 'hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleToggleGroceryPurchased(item, false)}
                      className="text-slate-400 hover:text-emerald-700 shrink-0"
                    >
                      {item.isPurchased ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </button>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-sm font-bold ${
                            item.isPurchased ? 'line-through text-slate-400' : 'text-slate-900'
                          }`}
                        >
                          {item.itemName}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold uppercase">
                          {item.category}
                        </span>
                      </div>
                      {item.notes && <p className="text-xs text-slate-500 truncate mt-0.5">{item.notes}</p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-bold text-slate-800 tabular-nums">
                      {item.quantity} {item.unit}
                    </span>
                    {!item.isPurchased && (
                      <button
                        type="button"
                        onClick={() => handleToggleGroceryPurchased(item, true)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 hover:bg-emerald-100 text-[11px] font-semibold"
                        title="Mark purchased and automatically add to Pantry"
                      >
                        Buy & Restock Pantry
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openEntityModal('GROCERY', 'EDIT', item)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        requestDelete(
                          item.itemName,
                          'Remove from shopping list.',
                          `/groceries/${encodeURIComponent(item.id)}`
                        )
                      }
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          5. CHORES SUB-PAGE (With Reusable Checklist Templates)
         ===================================================================== */}
      {subTab === 'chores' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative min-w-[200px] flex-1 max-w-xs">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search chores & routines..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <select
                value={choreZoneFilter}
                onChange={(e) => setChoreZoneFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
              >
                <option value="ALL">All Zones</option>
                <option value="KITCHEN">Kitchen</option>
                <option value="LIVING_ROOM">Living Room</option>
                <option value="BEDROOMS">Bedrooms</option>
                <option value="BATHROOMS">Bathrooms</option>
                <option value="OUTDOORS">Outdoors</option>
                <option value="GENERAL">General</option>
              </select>

              <select
                value={choreStatusFilter}
                onChange={(e) => setChoreStatusFilter(e.target.value as any)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending / Due</option>
                <option value="COMPLETED">Completed</option>
              </select>

              <select
                value={choreMemberFilter}
                onChange={(e) => setChoreMemberFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
              >
                <option value="ALL">All Family Members</option>
                {FAMILY_MEMBERS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>

              <select
                value={choreSort}
                onChange={(e) => setChoreSort(e.target.value as any)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
              >
                <option value="dueDate">Sort: Due Date</option>
                <option value="points">Sort: Reward Points</option>
                <option value="title">Sort: Title</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowChoreHistoryModal(true)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5"
              >
                <History className="w-3.5 h-3.5" /> Completion Log ({choreHistory.length})
              </button>
              <button
                type="button"
                onClick={() => openEntityModal('CHORE', 'CREATE')}
                className="px-4 py-2 rounded-xl bg-emerald-800 text-white hover:bg-emerald-900 text-xs font-semibold flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> New Chore
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredChores.map((chore) => {
              const completedSteps = (chore.checklist || []).filter((s: any) => s.isDone).length;
              const totalSteps = (chore.checklist || []).length;
              const dueStr = formatEpochDate(chore.nextDueDate);

              return (
                <div
                  key={chore.id}
                  className="bg-white rounded-2xl border border-slate-200/90 p-5 flex flex-col justify-between hover:border-slate-300 transition-all shadow-2xs"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold uppercase">
                            {chore.zone}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-[10px] font-bold tabular-nums">
                            +{chore.rewardPoints || 0} pts
                          </span>
                          <span className="text-[11px] text-slate-400 font-medium">{chore.frequency}</span>
                        </div>
                        <h3
                          className={`text-base font-bold mt-1.5 ${
                            chore.isCompleted ? 'line-through text-slate-400' : 'text-slate-900'
                          }`}
                        >
                          {chore.title}
                        </h3>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEntityModal('CHORE', 'EDIT', chore)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            requestDelete(
                              chore.title,
                              'Remove this chore from the family schedule.',
                              `/chores/${encodeURIComponent(chore.id)}`
                            )
                          }
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500">
                      Assigned:{' '}
                      <span className="font-semibold text-slate-800">{getMemberName(chore.assignedMemberId)}</span> •
                      Due <span className="font-semibold tabular-nums">{dueStr || 'Today'}</span>
                    </p>

                    {totalSteps > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-slate-100">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold">
                          <span>Checklist Steps</span>
                          <span className="tabular-nums">
                            {completedSteps}/{totalSteps}
                          </span>
                        </div>
                        <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                          {(chore.checklist || []).map((step: any, idx: number) => (
                            <button
                              key={step.id || idx}
                              type="button"
                              onClick={() => handleToggleChoreStep(chore, idx)}
                              className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-xs flex items-center gap-2 transition-colors ${
                                step.isDone
                                  ? 'bg-emerald-50/50 border-emerald-200 text-slate-400 line-through'
                                  : 'bg-slate-50/70 border-slate-200/80 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              {step.isDone ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              ) : (
                                <Circle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              )}
                              <span className="truncate">{step.text}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <AttachmentBadgeList
                      imageUri={chore.imageUri}
                      attachments={chore.attachments}
                      onPreview={setPreviewAttachment}
                    />
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => handleCompleteOrReopenChore(chore)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
                        chore.isCompleted
                          ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          : 'bg-emerald-800 text-white hover:bg-emerald-900'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{chore.isCompleted ? 'Reopen Chore' : 'Complete & Claim'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          6. WARDROBE & OUTFITS SUB-PAGE
         ===================================================================== */}
      {subTab === 'wardrobe' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Planned Outfits & Lookbook</h3>
                <p className="text-xs text-slate-500">Coordinate school, event, and travel outfits by family member</p>
              </div>
              <button
                type="button"
                onClick={() => openEntityModal('OUTFIT', 'CREATE')}
                className="px-3.5 py-2 rounded-xl bg-emerald-800 text-white hover:bg-emerald-900 text-xs font-semibold flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Plan Outfit
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {outfits.map((outfit) => {
                const items = wardrobe.filter((w) => (outfit.itemIds || []).includes(w.id));
                return (
                  <div
                    key={outfit.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 text-[10px] font-bold uppercase">
                            {outfit.occasion}
                          </span>
                          <h4 className="text-sm font-bold text-slate-900 mt-1">{outfit.outfitName}</h4>
                          <p className="text-xs text-slate-500">
                            {getMemberName(outfit.memberId)} {outfit.planDate ? `• ${outfit.planDate}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEntityModal('OUTFIT', 'EDIT', outfit)}
                            className="p-1 text-slate-400 hover:text-slate-700"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              requestDelete(
                                outfit.outfitName,
                                'Delete this planned outfit.',
                                `/outfits/${encodeURIComponent(outfit.id)}`
                              )
                            }
                            className="p-1 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1 mt-2.5">
                        {items.map((w) => (
                          <span
                            key={w.id}
                            className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-medium text-slate-700"
                          >
                            {w.itemName}
                          </span>
                        ))}
                      </div>
                    </div>

                    <AttachmentBadgeList
                      imageUri={outfit.imageUri}
                      attachments={outfit.attachments}
                      onPreview={setPreviewAttachment}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative min-w-[200px] flex-1 max-w-xs">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search garments or colors..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <select
                value={wardrobeMemberFilter}
                onChange={(e) => setWardrobeMemberFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
              >
                <option value="ALL">All Family Members</option>
                {FAMILY_MEMBERS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>

              <select
                value={wardrobeSeasonFilter}
                onChange={(e) => setWardrobeSeasonFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
              >
                <option value="ALL">All Seasons</option>
                <option value="ALL_SEASON">All Season</option>
                <option value="SPRING">Spring</option>
                <option value="SUMMER">Summer</option>
                <option value="FALL">Fall</option>
                <option value="WINTER">Winter</option>
              </select>

              <select
                value={wardrobeStatusFilter}
                onChange={(e) => setWardrobeStatusFilter(e.target.value as any)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
              >
                <option value="ALL">Clean & In Laundry</option>
                <option value="CLEAN">Clean Only</option>
                <option value="LAUNDRY">In Laundry Basket</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              {wardrobe.some((w) => !w.isClean) && (
                <button
                  type="button"
                  onClick={handleWashAllDirtyLaundry}
                  className="px-3.5 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 text-xs font-semibold"
                >
                  Wash All Laundry ({wardrobe.filter((w) => !w.isClean).length})
                </button>
              )}
              <button
                type="button"
                onClick={() => openEntityModal('WARDROBE', 'CREATE')}
                className="px-4 py-2 rounded-xl bg-emerald-800 text-white hover:bg-emerald-900 text-xs font-semibold flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add Garment
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredWardrobe.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200/90 p-5 flex flex-col justify-between hover:border-slate-300 transition-all shadow-2xs"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold uppercase">
                          {item.category}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-50 text-slate-500 text-[10px] font-semibold">
                          {item.season?.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mt-1">{item.itemName}</h3>
                      <p className="text-xs text-slate-500">
                        {getMemberName(item.memberId)} {item.color ? `• ${item.color}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEntityModal('WARDROBE', 'EDIT', item)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          requestDelete(
                            item.itemName,
                            'Remove this garment from wardrobe.',
                            `/wardrobe/${encodeURIComponent(item.id)}`
                          )
                        }
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <AttachmentBadgeList
                    imageUri={item.imageUri}
                    attachments={item.attachments}
                    onPreview={setPreviewAttachment}
                  />
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                      item.isClean ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {item.isClean ? 'Clean & Ready' : 'In Laundry'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleToggleWardrobeClean(item)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {item.isClean ? 'Mark Worn / Dirty' : 'Mark Washed'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =====================================================================
          7. EQUIPMENT & HOME ASSETS SUB-PAGE
         ===================================================================== */}
      {subTab === 'assets' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative min-w-[220px] flex-1 max-w-xs">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search equipment, model, location..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <select
                value={assetCategoryFilter}
                onChange={(e) => setAssetCategoryFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
              >
                <option value="ALL">All Categories</option>
                <option value="APPLIANCES">Appliances</option>
                <option value="HVAC">HVAC</option>
                <option value="PLUMBING">Plumbing</option>
                <option value="ELECTRICAL">Electrical</option>
                <option value="ELECTRONICS">Electronics</option>
                <option value="VEHICLES">Vehicles</option>
                <option value="TOOLS">Tools & Outdoor</option>
                <option value="FURNITURE">Furniture</option>
              </select>

              <select
                value={assetSort}
                onChange={(e) => setAssetSort(e.target.value as any)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
              >
                <option value="nextMaintenance">Sort: Next Maintenance Due</option>
                <option value="price">Sort: Purchase Value</option>
                <option value="name">Sort: Equipment Name</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => openEntityModal('ASSET', 'CREATE')}
              className="px-4 py-2 rounded-xl bg-emerald-800 text-white hover:bg-emerald-900 text-xs font-semibold flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Register Equipment
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAssets.map((asset) => {
              const assetLogs = assetMaintenance.filter((m) => m.assetId === asset.id);
              const nextDueStr = formatEpochDate(asset.nextMaintenanceDate);
              const warrantyStr = formatEpochDate(asset.warrantyExpiration);
              const isOverdue = nextDueStr && nextDueStr < todayISO;
              return (
                <div
                  key={asset.id}
                  className="bg-white rounded-2xl border border-slate-200/90 p-5 flex flex-col justify-between hover:border-slate-300 transition-all shadow-2xs"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold uppercase">
                            {asset.category}
                          </span>
                          {asset.location && (
                            <span className="px-2 py-0.5 rounded bg-slate-50 text-slate-500 text-[10px] font-semibold">
                              {asset.location}
                            </span>
                          )}
                          {isOverdue && (
                            <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold uppercase">
                              Service Due
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-bold text-slate-900 mt-1.5">{asset.name}</h3>
                        <p className="text-xs text-slate-500">
                          {asset.modelNumber || 'Home System'}{' '}
                          {asset.serialNumber ? `• SN: ${asset.serialNumber}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEntityModal('ASSET', 'EDIT', asset)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            requestDelete(
                              asset.name,
                              'Remove this equipment from your household registry.',
                              `/assets/${encodeURIComponent(asset.id)}`
                            )
                          }
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-slate-50">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Next Service</span>
                        <span className="font-bold text-slate-800 tabular-nums">{nextDueStr || 'None'}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Warranty Until</span>
                        <span className="font-bold text-slate-800 tabular-nums">{warrantyStr || 'N/A'}</span>
                      </div>
                    </div>

                    <AttachmentBadgeList
                      imageUri={asset.imageUri}
                      attachments={asset.attachments}
                      onPreview={setPreviewAttachment}
                    />
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setServiceDrawerAsset(asset)}
                      className="text-xs font-bold text-slate-700 hover:text-emerald-800"
                    >
                      Service History ({assetLogs.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => openEntityModal('MAINTENANCE', 'CREATE', undefined, asset)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 hover:bg-emerald-100 text-xs font-bold"
                    >
                      + Log Service
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          UNIFIED CRUD MODAL FOR ALL HOUSEHOLD ENTITIES
         ===================================================================== */}
      {entityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <h3 className="text-base font-bold text-slate-900">
                {entityModal.mode === 'CREATE' ? 'Add' : 'Edit'} {entityModal.type}
              </h3>
              <button
                type="button"
                onClick={() => setEntityModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEntityFormSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
                  {formError}
                </div>
              )}

              {/* MEAL FORM */}
              {entityModal.type === 'MEAL' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
                      <input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Meal Slot</label>
                      <select
                        value={formData.mealType}
                        onChange={(e) => setFormData({ ...formData, mealType: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
                      >
                        <option value="BREAKFAST">Breakfast</option>
                        <option value="LUNCH">Lunch</option>
                        <option value="DINNER">Dinner</option>
                        <option value="SNACK">Snack</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Servings</label>
                      <input
                        type="number"
                        min={1}
                        value={formData.servings}
                        onChange={(e) => setFormData({ ...formData, servings: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Link Family Recipe</label>
                    <select
                      value={formData.recipeId}
                      onChange={(e) => setFormData({ ...formData, recipeId: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
                    >
                      <option value="">-- Custom / Non-Recipe Meal --</option>
                      {recipes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.title} ({r.servings} srv)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Custom Meal Title (if not using a saved recipe)
                    </label>
                    <input
                      type="text"
                      value={formData.customMealTitle}
                      onChange={(e) => setFormData({ ...formData, customMealTitle: e.target.value })}
                      placeholder="e.g., Taco Tuesday Night or Takeout Pizza"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                    />
                  </div>

                  <AttachmentUploader
                    imageUri={formData.imageUri}
                    attachments={formData.attachments || []}
                    onChange={(nextUri, nextAtts) =>
                      setFormData({ ...formData, imageUri: nextUri, attachments: nextAtts })
                    }
                  />
                </>
              )}

              {/* RECIPE FORM */}
              {entityModal.type === 'RECIPE' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Recipe Title *</label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                        <select
                          value={formData.category}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
                        >
                          <option value="BREAKFAST">Breakfast</option>
                          <option value="LUNCH">Lunch</option>
                          <option value="DINNER">Dinner</option>
                          <option value="DESSERT">Dessert</option>
                          <option value="SNACK">Snack</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Difficulty</label>
                        <select
                          value={formData.difficulty}
                          onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
                        >
                          <option value="EASY">Easy</option>
                          <option value="MEDIUM">Medium</option>
                          <option value="HARD">Hard</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Prep (mins)</label>
                      <input
                        type="number"
                        min={0}
                        value={formData.prepTimeMinutes}
                        onChange={(e) => setFormData({ ...formData, prepTimeMinutes: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Cook (mins)</label>
                      <input
                        type="number"
                        min={0}
                        value={formData.cookTimeMinutes}
                        onChange={(e) => setFormData({ ...formData, cookTimeMinutes: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Servings</label>
                      <input
                        type="number"
                        min={1}
                        value={formData.servings}
                        onChange={(e) => setFormData({ ...formData, servings: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Short Description</label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">Ingredients</label>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            ingredients: [
                              ...(formData.ingredients || []),
                              { itemName: '', quantity: 1, unit: 'item' },
                            ],
                          })
                        }
                        className="text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                      >
                        + Add Ingredient
                      </button>
                    </div>
                    {(formData.ingredients || []).map((ing: any, idx: number) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                        <input
                          type="text"
                          placeholder="Ingredient"
                          value={ing.itemName}
                          onChange={(e) => {
                            const next = [...formData.ingredients];
                            next[idx] = { ...next[idx], itemName: e.target.value };
                            setFormData({ ...formData, ingredients: next });
                          }}
                          className="col-span-6 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200"
                        />
                        <input
                          type="number"
                          step="0.25"
                          placeholder="Qty"
                          value={ing.quantity}
                          onChange={(e) => {
                            const next = [...formData.ingredients];
                            next[idx] = { ...next[idx], quantity: e.target.value };
                            setFormData({ ...formData, ingredients: next });
                          }}
                          className="col-span-2 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200"
                        />
                        <input
                          type="text"
                          placeholder="Unit"
                          value={ing.unit}
                          onChange={(e) => {
                            const next = [...formData.ingredients];
                            next[idx] = { ...next[idx], unit: e.target.value };
                            setFormData({ ...formData, ingredients: next });
                          }}
                          className="col-span-3 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              ingredients: formData.ingredients.filter((_: any, i: number) => i !== idx),
                            })
                          }
                          className="col-span-1 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">Preparation Steps</label>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, instructions: [...(formData.instructions || []), ''] })
                        }
                        className="text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                      >
                        + Add Step
                      </button>
                    </div>
                    {(formData.instructions || []).map((step: string, idx: number) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 w-5">{idx + 1}.</span>
                        <input
                          type="text"
                          value={step}
                          onChange={(e) => {
                            const next = [...formData.instructions];
                            next[idx] = e.target.value;
                            setFormData({ ...formData, instructions: next });
                          }}
                          placeholder={`Step ${idx + 1}`}
                          className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              instructions: formData.instructions.filter((_: any, i: number) => i !== idx),
                            })
                          }
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <AttachmentUploader
                    imageUri={formData.imageUri}
                    attachments={formData.attachments || []}
                    onChange={(nextUri, nextAtts) =>
                      setFormData({ ...formData, imageUri: nextUri, attachments: nextAtts })
                    }
                  />
                </>
              )}

              {/* PANTRY FORM */}
              {entityModal.type === 'PANTRY' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Item Name *</label>
                      <input
                        type="text"
                        value={formData.itemName}
                        onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Storage Location</label>
                        <select
                          value={formData.storageLocation}
                          onChange={(e) => setFormData({ ...formData, storageLocation: e.target.value })}
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
                        >
                          {allPantryLocations.map((loc) => (
                            <option key={loc} value={loc}>
                              {loc}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                        <select
                          value={formData.category}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
                        >
                          {allPantryCategories.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Quantity</label>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Unit</label>
                      <input
                        type="text"
                        value={formData.unit}
                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Min Alert Qty</label>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.minThreshold}
                        onChange={(e) => setFormData({ ...formData, minThreshold: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Expiry Date</label>
                      <input
                        type="date"
                        value={formData.expiryDate}
                        onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                      />
                    </div>
                  </div>

                  <AttachmentUploader
                    imageUri={formData.imageUri}
                    attachments={formData.attachments || []}
                    onChange={(nextUri, nextAtts) =>
                      setFormData({ ...formData, imageUri: nextUri, attachments: nextAtts })
                    }
                  />
                </>
              )}

              {/* GROCERY FORM */}
              {entityModal.type === 'GROCERY' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Item Name *</label>
                    <input
                      type="text"
                      value={formData.itemName}
                      onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Store Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
                    >
                      {allPantryCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Quantity</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Unit</label>
                    <input
                      type="text"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
                    <input
                      type="text"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                    />
                  </div>
                </div>
              )}

              {/* CHORE FORM (With Checklist Templates) */}
              {entityModal.type === 'CHORE' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Chore Title *</label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Zone</label>
                        <select
                          value={formData.zone}
                          onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
                        >
                          <option value="KITCHEN">Kitchen</option>
                          <option value="LIVING_ROOM">Living Room</option>
                          <option value="BEDROOMS">Bedrooms</option>
                          <option value="BATHROOMS">Bathrooms</option>
                          <option value="OUTDOORS">Outdoors</option>
                          <option value="GENERAL">General</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Frequency</label>
                        <select
                          value={formData.frequency}
                          onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
                        >
                          <option value="DAILY">Daily</option>
                          <option value="WEEKLY">Weekly</option>
                          <option value="BIWEEKLY">Biweekly</option>
                          <option value="MONTHLY">Monthly</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Assigned Member</label>
                      <select
                        value={formData.assignedMemberId}
                        onChange={(e) => setFormData({ ...formData, assignedMemberId: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
                      >
                        {FAMILY_MEMBERS.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Due Date</label>
                      <input
                        type="date"
                        value={formData.nextDueDate}
                        onChange={(e) => setFormData({ ...formData, nextDueDate: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Reward Points</label>
                      <input
                        type="number"
                        value={formData.rewardPoints}
                        onChange={(e) => setFormData({ ...formData, rewardPoints: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                      />
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-700">Reusable Checklist Steps</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setTemplateDomainFilter('CHORE');
                            setTemplateApplyCallback(() => (tpl: ChecklistTemplate) => {
                              setFormData((prev: any) => ({
                                ...prev,
                                title: prev.title || tpl.name,
                                checklist: tpl.items.map((itemText, i) => ({
                                  id: `step-${Date.now()}-${i}`,
                                  text: itemText,
                                  isDone: false,
                                })),
                              }));
                            });
                            setShowTemplateModal(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 text-[11px] font-bold hover:bg-emerald-200 flex items-center gap-1"
                        >
                          <ListChecks className="w-3.5 h-3.5" /> Load Template
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleSaveCurrentChecklistAsTemplate(
                              'CHORE',
                              formData.title,
                              formData.zone,
                              formData.checklist || []
                            )
                          }
                          className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-700 text-[11px] font-semibold hover:bg-slate-100 flex items-center gap-1"
                        >
                          <BookmarkPlus className="w-3.5 h-3.5" /> Save as Template
                        </button>
                      </div>
                    </div>

                    {(formData.checklist || []).map((step: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={step.text}
                          onChange={(e) => {
                            const next = [...formData.checklist];
                            next[idx] = { ...next[idx], text: e.target.value };
                            setFormData({ ...formData, checklist: next });
                          }}
                          placeholder={`Checklist step ${idx + 1}`}
                          className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              checklist: formData.checklist.filter((_: any, i: number) => i !== idx),
                            })
                          }
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          checklist: [
                            ...(formData.checklist || []),
                            { id: `step-${Date.now()}`, text: '', isDone: false },
                          ],
                        })
                      }
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                    >
                      + Add Step
                    </button>
                  </div>

                  <AttachmentUploader
                    imageUri={formData.imageUri}
                    attachments={formData.attachments || []}
                    onChange={(nextUri, nextAtts) =>
                      setFormData({ ...formData, imageUri: nextUri, attachments: nextAtts })
                    }
                  />
                </>
              )}

              {/* WARDROBE FORM */}
              {entityModal.type === 'WARDROBE' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Garment Name *</label>
                      <input
                        type="text"
                        value={formData.itemName}
                        onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Family Member</label>
                      <select
                        value={formData.memberId}
                        onChange={(e) => setFormData({ ...formData, memberId: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
                      >
                        {FAMILY_MEMBERS.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
                      >
                        <option value="TOPS">Tops</option>
                        <option value="BOTTOMS">Bottoms</option>
                        <option value="DRESSES">Dresses</option>
                        <option value="OUTERWEAR">Outerwear</option>
                        <option value="SHOES">Shoes</option>
                        <option value="ACCESSORIES">Accessories</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Season</label>
                      <select
                        value={formData.season}
                        onChange={(e) => setFormData({ ...formData, season: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
                      >
                        <option value="ALL_SEASON">All Season</option>
                        <option value="SPRING">Spring</option>
                        <option value="SUMMER">Summer</option>
                        <option value="FALL">Fall</option>
                        <option value="WINTER">Winter</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Color</label>
                      <input
                        type="text"
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
                      <input
                        type="text"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                      />
                    </div>
                  </div>

                  <AttachmentUploader
                    imageUri={formData.imageUri}
                    attachments={formData.attachments || []}
                    onChange={(nextUri, nextAtts) =>
                      setFormData({ ...formData, imageUri: nextUri, attachments: nextAtts })
                    }
                  />
                </>
              )}

              {/* OUTFIT FORM */}
              {entityModal.type === 'OUTFIT' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Outfit Name *</label>
                      <input
                        type="text"
                        value={formData.outfitName}
                        onChange={(e) => setFormData({ ...formData, outfitName: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Family Member</label>
                      <select
                        value={formData.memberId}
                        onChange={(e) => setFormData({ ...formData, memberId: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
                      >
                        {FAMILY_MEMBERS.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Planned Date</label>
                      <input
                        type="date"
                        value={formData.planDate}
                        onChange={(e) => setFormData({ ...formData, planDate: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Select Wardrobe Garments</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-2 border border-slate-200 rounded-xl">
                      {wardrobe.map((w) => {
                        const checked = (formData.itemIds || []).includes(w.id);
                        return (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => {
                              const current = formData.itemIds || [];
                              setFormData({
                                ...formData,
                                itemIds: checked
                                  ? current.filter((id: string) => id !== w.id)
                                  : [...current, w.id],
                              });
                            }}
                            className={`p-2 rounded-lg border text-left text-xs transition-colors ${
                              checked
                                ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold'
                                : 'bg-white border-slate-200 text-slate-700'
                            }`}
                          >
                            <div className="truncate">{w.itemName}</div>
                            <div className="text-[10px] text-slate-400">{getMemberShortName(w.memberId)}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <AttachmentUploader
                    imageUri={formData.imageUri}
                    attachments={formData.attachments || []}
                    onChange={(nextUri, nextAtts) =>
                      setFormData({ ...formData, imageUri: nextUri, attachments: nextAtts })
                    }
                  />
                </>
              )}

              {/* ASSET FORM */}
              {entityModal.type === 'ASSET' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Equipment Name *</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
                      >
                        <option value="APPLIANCES">Appliances</option>
                        <option value="HVAC">HVAC</option>
                        <option value="PLUMBING">Plumbing</option>
                        <option value="ELECTRICAL">Electrical</option>
                        <option value="ELECTRONICS">Electronics</option>
                        <option value="VEHICLES">Vehicles</option>
                        <option value="TOOLS">Tools & Outdoor</option>
                        <option value="FURNITURE">Furniture</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Location / Room</label>
                      <input
                        type="text"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Model Number</label>
                      <input
                        type="text"
                        value={formData.modelNumber}
                        onChange={(e) => setFormData({ ...formData, modelNumber: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Serial Number</label>
                      <input
                        type="text"
                        value={formData.serialNumber}
                        onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Purchase Price ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.purchasePriceDollars}
                        onChange={(e) => setFormData({ ...formData, purchasePriceDollars: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Next Service Date</label>
                      <input
                        type="date"
                        value={formData.nextMaintenanceDate}
                        onChange={(e) => setFormData({ ...formData, nextMaintenanceDate: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Warranty Expiry</label>
                      <input
                        type="date"
                        value={formData.warrantyExpiration}
                        onChange={(e) => setFormData({ ...formData, warrantyExpiration: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                      />
                    </div>
                  </div>

                  <AttachmentUploader
                    imageUri={formData.imageUri}
                    attachments={formData.attachments || []}
                    onChange={(nextUri, nextAtts) =>
                      setFormData({ ...formData, imageUri: nextUri, attachments: nextAtts })
                    }
                    label="Equipment Photo, Warranty PDF & Manuals"
                  />
                </>
              )}

              {/* MAINTENANCE SERVICE RECORD FORM */}
              {entityModal.type === 'MAINTENANCE' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Service Summary *</label>
                      <input
                        type="text"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="e.g., 6-Month HVAC Filter & Coil Inspection"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Performed By</label>
                      <input
                        type="text"
                        value={formData.performedBy}
                        onChange={(e) => setFormData({ ...formData, performedBy: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Service Date</label>
                      <input
                        type="date"
                        value={formData.maintenanceDate}
                        onChange={(e) => setFormData({ ...formData, maintenanceDate: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Service Cost ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.costDollars}
                        onChange={(e) => setFormData({ ...formData, costDollars: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                      />
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">Maintenance Inspection Checklist</span>
                      <button
                        type="button"
                        onClick={() => {
                          setTemplateDomainFilter('MAINTENANCE');
                          setTemplateApplyCallback(() => (tpl: ChecklistTemplate) => {
                            setFormData((prev: any) => ({
                              ...prev,
                              notes: prev.notes || tpl.name,
                              checklist: tpl.items.map((itemText, i) => ({
                                id: `mstep-${Date.now()}-${i}`,
                                text: itemText,
                                isDone: false,
                              })),
                            }));
                          });
                          setShowTemplateModal(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 text-[11px] font-bold hover:bg-emerald-200 flex items-center gap-1"
                      >
                        <ListChecks className="w-3.5 h-3.5" /> Load Maintenance Template
                      </button>
                    </div>
                    {(formData.checklist || []).map((step: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={step.text}
                          onChange={(e) => {
                            const next = [...formData.checklist];
                            next[idx] = { ...next[idx], text: e.target.value };
                            setFormData({ ...formData, checklist: next });
                          }}
                          className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              checklist: formData.checklist.filter((_: any, i: number) => i !== idx),
                            })
                          }
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          checklist: [
                            ...(formData.checklist || []),
                            { id: `mstep-${Date.now()}`, text: '', isDone: false },
                          ],
                        })
                      }
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                    >
                      + Add Inspection Step
                    </button>
                  </div>

                  <AttachmentUploader
                    attachments={formData.attachments || []}
                    onChange={(_nextUri, nextAtts) => setFormData({ ...formData, attachments: nextAtts })}
                    label="Service Receipts, Invoices & Photos"
                  />
                </>
              )}

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEntityModal(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-800 text-white text-xs font-bold hover:bg-emerald-900 disabled:opacity-50"
                >
                  {formSubmitting ? 'Saving...' : entityModal.mode === 'CREATE' ? 'Create Record' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Chore Completion History Modal */}
      {showChoreHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <h3 className="text-base font-bold text-slate-900">Chore Completion History</h3>
              <button
                type="button"
                onClick={() => setShowChoreHistoryModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 max-h-[65vh] overflow-y-auto divide-y divide-slate-100">
              {choreHistory.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">No chore completions logged yet.</p>
              ) : (
                choreHistory.map((log: any) => {
                  const choreObj = chores.find((c) => c.id === log.choreId);
                  return (
                    <div key={log.id} className="py-3 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-900">
                          {log.choreTitle || choreObj?.title || 'Completed Household Chore'}
                        </p>
                        <p className="text-slate-500">
                          Completed by {getMemberName(log.completedByMemberId)} •{' '}
                          {new Date(log.completedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-bold tabular-nums">
                        +{log.pointsEarned || 0} pts
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Shared Drawers & Modals */}
      <RecipeScalerDrawer
        recipe={scalerRecipe}
        onClose={() => setScalerRecipe(null)}
        onEdit={(r) => openEntityModal('RECIPE', 'EDIT', r)}
        onSyncIngredientsToGrocery={handleSyncRecipeIngredientsToGroceries}
        onPreviewAttachment={setPreviewAttachment}
        onPrintRecipe={(rId) => onOpenPrintDoc?.('RECIPE_CARD', rId)}
      />

      <AssetServiceHistoryDrawer
        asset={serviceDrawerAsset ? assets.find((a) => a.id === serviceDrawerAsset.id) || serviceDrawerAsset : null}
        maintenanceRecords={assetMaintenance}
        onClose={() => setServiceDrawerAsset(null)}
        onAddServiceRecord={(asset) => openEntityModal('MAINTENANCE', 'CREATE', undefined, asset)}
        onEditServiceRecord={(asset, rec) => openEntityModal('MAINTENANCE', 'EDIT', rec, asset)}
        onDeleteServiceRecord={(assetId, recId, title) =>
          requestDelete(
            title,
            'Remove this maintenance service log.',
            `/assets/${encodeURIComponent(assetId)}/maintenance/${encodeURIComponent(recId)}`
          )
        }
        onToggleServiceChecklistStep={handleToggleMaintenanceChecklistStep}
        onPreviewAttachment={setPreviewAttachment}
      />

      <PantryTaxonomyModal
        isOpen={showTaxonomyModal}
        onClose={() => setShowTaxonomyModal(false)}
        customLocations={customLocations}
        customCategories={customCategories}
        onAddLocation={handleAddLocation}
        onRemoveLocation={handleRemoveLocation}
        onAddCategory={handleAddCategory}
        onRemoveCategory={handleRemoveCategory}
      />

      <TemplateManagerModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        templates={checklistTemplates}
        defaultDomainFilter={templateDomainFilter}
        onSaveTemplate={handleSaveTemplate}
        onDeleteTemplate={handleDeleteTemplate}
        onApplyTemplate={templateApplyCallback}
      />

      <AttachmentPreviewModal attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} />

      <DeleteConfirmModal target={deleteTarget} onClose={() => setDeleteTarget(null)} />

      <PrintOperationsModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        weekDayDates={weekDays}
        meals={meals}
        recipes={recipes}
        groceries={groceries}
        chores={chores}
        pantry={pantry}
        outfits={outfits}
        assets={assets}
      />
    </div>
  );
};

export default Stage2HouseholdExperience;
