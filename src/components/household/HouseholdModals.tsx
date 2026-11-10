import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Wrench,
  Edit2,
  CheckCircle2,
  Circle,
  ChefHat,
  Printer,
} from 'lucide-react';
import {
  HouseholdAttachment,
  AttachmentBadgeList,
} from './HouseholdSharedComponents';

export function formatEpochDate(epoch?: number): string {
  if (!epoch) return '';
  const d = new Date(Number(epoch));
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export const RecipeScalerDrawer: React.FC<{
  recipe: any | null;
  onClose: () => void;
  onEdit: (recipe: any) => void;
  onSyncIngredientsToGrocery: (recipe: any, scaleFactor: number) => Promise<void>;
  onPreviewAttachment: (att: HouseholdAttachment) => void;
  onPrintRecipe?: (recipeId: string) => void;
}> = ({ recipe, onClose, onEdit, onSyncIngredientsToGrocery, onPreviewAttachment, onPrintRecipe }) => {
  const [targetServings, setTargetServings] = useState<number>(recipe?.servings || 4);
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({});
  const [syncing, setSyncing] = useState(false);

  React.useEffect(() => {
    if (recipe) {
      setTargetServings(recipe.servings || 4);
      setCheckedSteps({});
    }
  }, [recipe]);

  if (!recipe) return null;

  const baseServings = Math.max(1, Number(recipe.servings) || 4);
  const scaleFactor = targetServings / baseServings;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-xl h-full shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <ChefHat className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 truncate">{recipe.title}</h3>
              <p className="text-xs text-slate-500">
                {recipe.category} • {recipe.difficulty || 'MEDIUM'} •{' '}
                {(recipe.prepTimeMinutes || 0) + (recipe.cookTimeMinutes || 0)} min total
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPrintRecipe ? onPrintRecipe(recipe.id) : window.print()}
              className="p-1.5 rounded-lg border border-slate-200 text-[#C39A60] hover:bg-amber-50 transition-colors cursor-pointer"
              title="Print Recipe Card"
              aria-label="Print Recipe Card"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(recipe);
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-1.5"
            >
              <Edit2 className="w-3.5 h-3.5" /> Edit
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {recipe.imageUri && (
            <div className="rounded-xl overflow-hidden border border-slate-200 max-h-52 bg-slate-100">
              <img src={recipe.imageUri} alt={recipe.title} className="w-full h-48 object-cover" />
            </div>
          )}

          {recipe.description && (
            <p className="text-sm text-slate-600 leading-relaxed">{recipe.description}</p>
          )}

          {/* Portion Scaler Bar */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-900">Portion Scaler</p>
              <p className="text-xs text-emerald-700">Automatically scales ingredient quantities</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTargetServings(Math.max(1, targetServings - 1))}
                className="w-8 h-8 rounded-lg bg-white border border-emerald-300 font-bold text-emerald-900 hover:bg-emerald-100"
              >
                -
              </button>
              <span className="px-3 py-1 rounded-lg bg-white border border-emerald-200 text-sm font-bold text-emerald-950 tabular-nums">
                {targetServings} servings
              </span>
              <button
                type="button"
                onClick={() => setTargetServings(Math.min(30, targetServings + 1))}
                className="w-8 h-8 rounded-lg bg-white border border-emerald-300 font-bold text-emerald-900 hover:bg-emerald-100"
              >
                +
              </button>
            </div>
          </div>

          {/* Scaled Ingredients */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Ingredients ({(recipe.ingredients || []).length})
              </h4>
              <button
                type="button"
                disabled={syncing}
                onClick={async () => {
                  setSyncing(true);
                  try {
                    await onSyncIngredientsToGrocery(recipe, scaleFactor);
                  } finally {
                    setSyncing(false);
                  }
                }}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                {syncing ? 'Adding to Groceries...' : 'Send Ingredients to Groceries'}
              </button>
            </div>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {(recipe.ingredients || []).map((ing: any, idx: number) => {
                const scaledQty = Math.round(Number(ing.quantity || 0) * scaleFactor * 100) / 100;
                const ingName = ing.itemName || ing.name || 'Ingredient';
                return (
                  <div key={ing.id || idx} className="px-4 py-2.5 flex items-center justify-between text-sm bg-white">
                    <span className="font-medium text-slate-800">{ingName}</span>
                    <span className="font-bold text-slate-900 tabular-nums">
                      {scaledQty} {ing.unit}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Interactive Cooking Steps */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Preparation Steps ({(recipe.instructions || []).length})
            </h4>
            <div className="space-y-2">
              {(recipe.instructions || []).map((step: any, idx: number) => {
                const done = !!checkedSteps[idx];
                const text = typeof step === 'string' ? step : step.instructionText || '';
                return (
                  <button
                    key={step.id || idx}
                    type="button"
                    onClick={() => setCheckedSteps((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 ${
                      done
                        ? 'bg-emerald-50/50 border-emerald-200 text-slate-400 line-through'
                        : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                        done ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="text-sm leading-relaxed">{text}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {recipe.attachments && recipe.attachments.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Attached Recipe Cards & Photos
              </h4>
              <AttachmentBadgeList
                imageUri={recipe.imageUri}
                attachments={recipe.attachments}
                onPreview={onPreviewAttachment}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const AssetServiceHistoryDrawer: React.FC<{
  asset: any | null;
  maintenanceRecords: any[];
  onClose: () => void;
  onAddServiceRecord: (asset: any) => void;
  onEditServiceRecord: (asset: any, record: any) => void;
  onDeleteServiceRecord: (assetId: string, recordId: string, title: string) => void;
  onToggleServiceChecklistStep: (asset: any, record: any, stepIndex: number) => Promise<void>;
  onPreviewAttachment: (att: HouseholdAttachment) => void;
}> = ({
  asset,
  maintenanceRecords,
  onClose,
  onAddServiceRecord,
  onEditServiceRecord,
  onDeleteServiceRecord,
  onToggleServiceChecklistStep,
  onPreviewAttachment,
}) => {
  if (!asset) return null;

  const logs = maintenanceRecords
    .filter((r) => r.assetId === asset.id)
    .sort((a, b) => Number(b.maintenanceDate || 0) - Number(a.maintenanceDate || 0));

  const totalSpentCents = logs.reduce((acc, r) => acc + (Number(r.costCents) || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-2xl h-full shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <Wrench className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 truncate">{asset.name} — Service & Warranty Log</h3>
              <p className="text-xs text-slate-500">
                {asset.modelNumber || asset.category} {asset.serialNumber ? `• SN: ${asset.serialNumber}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onAddServiceRecord(asset)}
              className="px-3 py-1.5 rounded-lg bg-emerald-800 text-white text-xs font-semibold hover:bg-emerald-900 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Log Service
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Asset KPI strip */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                Purchase Price
              </span>
              <span className="text-base font-bold text-slate-900 tabular-nums mt-0.5 block">
                ${((asset.purchasePriceCents || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                Next Maintenance
              </span>
              <span className="text-base font-bold text-slate-900 tabular-nums mt-0.5 block">
                {formatEpochDate(asset.nextMaintenanceDate) || 'Not set'}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                Total Service Spend
              </span>
              <span className="text-base font-bold text-emerald-800 tabular-nums mt-0.5 block">
                ${(totalSpentCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {asset.attachments && asset.attachments.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Manuals, Receipts & Warranty Documents
              </p>
              <AttachmentBadgeList
                imageUri={asset.imageUri}
                attachments={asset.attachments}
                onPreview={onPreviewAttachment}
              />
            </div>
          )}

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Maintenance History ({logs.length} records)
            </h4>

            {logs.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Wrench className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No service records logged yet</p>
                <p className="text-xs text-slate-500 mt-1">
                  Keep track of inspections, filter replacements, and technician receipts.
                </p>
              </div>
            ) : (
              logs.map((rec) => {
                const dateStr = formatEpochDate(rec.maintenanceDate);
                return (
                  <div
                    key={rec.id}
                    className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            {rec.notes || 'Scheduled Maintenance Service'}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold tabular-nums">
                            {dateStr}
                          </span>
                          {rec.costCents > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-[11px] font-bold tabular-nums">
                              ${(rec.costCents / 100).toFixed(2)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Performed by:{' '}
                          <span className="font-medium text-slate-700">{rec.performedBy || 'Household'}</span>
                          {rec.nextDueDate ? ` • Next Due: ${formatEpochDate(rec.nextDueDate)}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onEditServiceRecord(asset, rec)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                          title="Edit service record"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onDeleteServiceRecord(asset.id, rec.id, rec.notes || 'Service Record')
                          }
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          title="Delete service record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {Array.isArray(rec.checklist) && rec.checklist.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 space-y-1.5">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Inspection Checklist ({rec.checklist.filter((s: any) => s.isDone).length}/
                          {rec.checklist.length})
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {rec.checklist.map((step: any, idx: number) => (
                            <button
                              key={step.id || idx}
                              type="button"
                              onClick={() => onToggleServiceChecklistStep(asset, rec, idx)}
                              className={`text-left px-2.5 py-1.5 rounded-lg border text-xs flex items-center gap-2 transition-colors ${
                                step.isDone
                                  ? 'bg-emerald-50/60 border-emerald-200 text-slate-500 line-through'
                                  : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100'
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

                    {rec.attachments && rec.attachments.length > 0 && (
                      <AttachmentBadgeList attachments={rec.attachments} onPreview={onPreviewAttachment} />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const PantryTaxonomyModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  customLocations: string[];
  customCategories: string[];
  onAddLocation: (loc: string) => Promise<void>;
  onRemoveLocation: (loc: string) => Promise<void>;
  onAddCategory: (cat: string) => Promise<void>;
  onRemoveCategory: (cat: string) => Promise<void>;
}> = ({
  isOpen,
  onClose,
  customLocations,
  customCategories,
  onAddLocation,
  onRemoveLocation,
  onAddCategory,
  onRemoveCategory,
}) => {
  const [newLoc, setNewLoc] = useState('');
  const [newCat, setNewCat] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div>
            <h3 className="text-base font-bold text-slate-900">Storage Locations & Categories</h3>
            <p className="text-xs text-slate-500">Customize where and how your household organizes inventory</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Locations */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              Storage Locations ({customLocations.length})
            </label>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {customLocations.map((loc) => (
                <span
                  key={loc}
                  className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-1.5"
                >
                  {loc}
                  <button
                    type="button"
                    disabled={saving}
                    onClick={async () => {
                      setSaving(true);
                      try {
                        await onRemoveLocation(loc);
                      } finally {
                        setSaving(false);
                      }
                    }}
                    className="text-emerald-600 hover:text-rose-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newLoc}
                onChange={(e) => setNewLoc(e.target.value)}
                placeholder="e.g., Garage Freezer, Wine Rack..."
                className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                disabled={saving || !newLoc.trim()}
                onClick={async () => {
                  setSaving(true);
                  try {
                    await onAddLocation(newLoc.trim());
                    setNewLoc('');
                  } finally {
                    setSaving(false);
                  }
                }}
                className="px-3.5 py-2 rounded-lg bg-emerald-800 text-white text-xs font-semibold hover:bg-emerald-900 disabled:opacity-50"
              >
                Add Location
              </button>
            </div>
          </div>

          {/* Categories */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              Pantry & Grocery Categories ({customCategories.length})
            </label>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {customCategories.map((cat) => (
                <span
                  key={cat}
                  className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-1.5"
                >
                  {cat}
                  <button
                    type="button"
                    disabled={saving}
                    onClick={async () => {
                      setSaving(true);
                      try {
                        await onRemoveCategory(cat);
                      } finally {
                        setSaving(false);
                      }
                    }}
                    className="text-emerald-600 hover:text-rose-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                placeholder="e.g., BABY SUPPLIES, PET FOOD..."
                className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                disabled={saving || !newCat.trim()}
                onClick={async () => {
                  setSaving(true);
                  try {
                    await onAddCategory(newCat.trim().toUpperCase());
                    setNewCat('');
                  } finally {
                    setSaving(false);
                  }
                }}
                className="px-3.5 py-2 rounded-lg bg-emerald-800 text-white text-xs font-semibold hover:bg-emerald-900 disabled:opacity-50"
              >
                Add Category
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
