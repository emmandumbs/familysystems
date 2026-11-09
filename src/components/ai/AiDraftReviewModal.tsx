import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckCircle,
  X,
  Trash2,
  Edit2,
  Calendar,
  Clock,
  Users,
  AlertCircle,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Plus,
} from 'lucide-react';

export interface DraftMealItem {
  id: string;
  dayOfWeek: string;
  mealType: string;
  recipeTitle: string;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  servings: number;
  dietaryTags?: string[];
  ingredients: string[];
  instructions: string[];
}

export interface DraftTaskItem {
  title: string;
  priority: string;
  estimatedHours: number;
  checklist: string[];
}

export interface DraftProjectItem {
  id?: string;
  title: string;
  description: string;
  milestones: Array<{ title: string; targetWeek?: number }>;
  tasks: DraftTaskItem[];
}

export interface AiDraftPayload {
  isAiDraft: boolean;
  requiresHumanApproval: boolean;
  planDays?: DraftMealItem[];
  goalTitle?: string;
  targetCategory?: string;
  suggestedTimelineWeeks?: number;
  projects?: DraftProjectItem[];
  complianceNotice?: string;
  provider?: string;
}

export interface AiDraftReviewModalProps {
  isOpen: boolean;
  type?: 'MEAL_PLAN' | 'GOAL_BREAKDOWN';
  mode?: 'meal_plan' | 'goal_breakdown';
  draft?: AiDraftPayload | null;
  familyId?: string;
  userRole?: string;
  onClose: () => void;
  onApproveAndSave?: (finalData: AiDraftPayload) => Promise<void>;
  onApprove?: (finalData?: any) => void;
  isSaving?: boolean;
}

export const AiDraftReviewModal: React.FC<AiDraftReviewModalProps> = ({
  isOpen,
  type,
  mode,
  draft,
  familyId,
  userRole = 'MEMBER',
  onClose,
  onApproveAndSave,
  onApprove,
  isSaving = false,
}) => {
  const effectiveType: 'MEAL_PLAN' | 'GOAL_BREAKDOWN' =
    type || (mode === 'goal_breakdown' ? 'GOAL_BREAKDOWN' : 'MEAL_PLAN');

  const [activeDraft, setActiveDraft] = useState<AiDraftPayload | null>(draft || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Sync draft prop if passed
  useEffect(() => {
    if (draft) {
      setActiveDraft(draft);
      setEditedDays(draft.planDays || []);
      setEditedProjects(draft.projects || []);
    }
  }, [draft]);

  // Local editable copy of the draft
  const [editedDays, setEditedDays] = useState<DraftMealItem[]>(draft?.planDays || []);
  const [editedProjects, setEditedProjects] = useState<DraftProjectItem[]>(draft?.projects || []);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleFetchDraft = async () => {
    if (!familyId) return;
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const endpoint =
        effectiveType === 'MEAL_PLAN'
          ? `/api/v1/ai/${encodeURIComponent(familyId)}/meal-plan-draft`
          : `/api/v1/ai/${encodeURIComponent(familyId)}/goal-breakdown-draft`;

      const body =
        effectiveType === 'MEAL_PLAN'
          ? { numberOfDays: 7, consentConfirmed: true }
          : { goalTitle: 'Family Summer Adventure & Health Routine', consentConfirmed: true };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `AI draft generation failed (${res.status})`);
      }

      const data = await res.json();
      setActiveDraft(data);
      if (data.planDays) setEditedDays(data.planDays);
      if (data.projects) setEditedProjects(data.projects);
    } catch (err: any) {
      setGenerateError(err.message || 'Error generating AI draft');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  const handleMealTitleChange = (idx: number, newTitle: string) => {
    const updated = [...editedDays];
    updated[idx] = { ...updated[idx], recipeTitle: newTitle };
    setEditedDays(updated);
  };

  const handleRemoveMeal = (idx: number) => {
    setEditedDays(editedDays.filter((_, i) => i !== idx));
  };

  const handleRemoveProject = (projIdx: number) => {
    setEditedProjects(editedProjects.filter((_, i) => i !== projIdx));
  };

  const handleRemoveTask = (projIdx: number, taskIdx: number) => {
    const updated = [...editedProjects];
    updated[projIdx] = {
      ...updated[projIdx],
      tasks: updated[projIdx].tasks.filter((_, i) => i !== taskIdx),
    };
    setEditedProjects(updated);
  };

  const handleApprove = async () => {
    const finalPayload: AiDraftPayload = {
      ...(activeDraft || {}),
      isAiDraft: true,
      requiresHumanApproval: false,
      planDays: effectiveType === 'MEAL_PLAN' ? editedDays : undefined,
      projects: effectiveType === 'GOAL_BREAKDOWN' ? editedProjects : undefined,
    };
    if (onApproveAndSave) {
      await onApproveAndSave(finalPayload);
    } else if (onApprove) {
      onApprove(finalPayload);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div
        className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-[#A8BDAA]/40"
        style={{ backgroundColor: '#F7F4EC' }}
      >
        {/* Header */}
        <div className="px-6 py-5 bg-[#173D35] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-[#C39A60]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold tracking-wide">
                  {effectiveType === 'MEAL_PLAN' ? 'AI Meal Plan Draft' : 'AI Goal Strategy Breakdown'}
                </h3>
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-[#C39A60] text-[#173D35]">
                  AI DRAFT
                </span>
              </div>
              <p className="text-xs text-[#A8BDAA]">Human-in-the-Loop Review • Uncommitted Draft</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Human-in-the-loop Guardrail Notice */}
        <div className="px-6 py-3 bg-[#E7D1AA]/40 border-b border-[#C39A60]/30 flex items-center gap-2.5 text-xs text-[#173D35]">
          <ShieldCheck className="w-4 h-4 text-[#2D6A4F] shrink-0" />
          <p>
            <strong>Mandatory Human Approval Gate:</strong> This draft was generated with privacy-sanitized
            context. It is <strong>never committed</strong> to your family schedule until you click &quot;Approve & Save&quot;.
          </p>
        </div>

        {/* Body content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {!activeDraft ? (
            <div className="py-12 text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-[#173D35]/10 text-[#173D35] flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-[#C39A60]" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-stone-900">
                  Generate AI {effectiveType === 'MEAL_PLAN' ? 'Meal Plan' : 'Goal Strategy Breakdown'}
                </h4>
                <p className="text-xs text-stone-500 max-w-md mx-auto mt-1">
                  Synthesizes family preferences and schedules using Gemini 2.5 with zero PII exposure and human review before saving.
                </p>
              </div>
              {generateError && (
                <div className="p-3 bg-rose-50 text-rose-800 text-xs rounded-xl max-w-md mx-auto border border-rose-200">
                  {generateError}
                </div>
              )}
              <button
                type="button"
                onClick={handleFetchDraft}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#173D35] text-white text-xs font-bold hover:bg-[#112d27] cursor-pointer disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Generating Draft...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-[#C39A60]" />
                    <span>Generate New Draft</span>
                  </>
                )}
              </button>
            </div>
          ) : effectiveType === 'MEAL_PLAN' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#4F635D]">
                  Suggested Days ({editedDays.length})
                </span>
                <span className="text-xs text-[#4F635D]">
                  Click to inspect ingredients & instructions
                </span>
              </div>

              {editedDays.length === 0 ? (
                <div className="text-center py-8 text-[#4F635D]">
                  All meals removed from this draft. Discard or request another.
                </div>
              ) : (
                editedDays.map((meal, idx) => {
                  const isExpanded = expandedIndex === idx;
                  return (
                    <div
                      key={meal.id || idx}
                      className="bg-white rounded-xl border border-[#A8BDAA]/30 overflow-hidden shadow-xs transition-all"
                    >
                      <div
                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-[#F7F4EC]/50"
                        onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#173D35]/10 text-[#173D35] flex items-center justify-center font-bold text-xs">
                            {meal.dayOfWeek.slice(0, 3).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-[#6B8A6E] uppercase">
                                {meal.mealType}
                              </span>
                              <span className="text-xs text-neutral-400">•</span>
                              <span className="text-xs text-[#4F635D]">
                                {meal.prepTimeMinutes + meal.cookTimeMinutes} min
                              </span>
                              <span className="text-xs text-neutral-400">•</span>
                              <span className="text-xs text-[#4F635D]">{meal.servings} servings</span>
                            </div>
                            <input
                              type="text"
                              value={meal.recipeTitle}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => handleMealTitleChange(idx, e.target.value)}
                              className="font-medium text-[#11231E] text-sm bg-transparent border-b border-transparent hover:border-[#A8BDAA] focus:border-[#173D35] focus:outline-hidden mt-0.5"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleRemoveMeal(idx)}
                            className="p-1.5 text-neutral-400 hover:text-[#BC4749] transition-colors"
                            title="Discard this meal suggestion"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                            className="p-1.5 text-neutral-400 hover:text-[#173D35]"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="px-4 pb-4 pt-1 bg-[#F7F4EC]/30 border-t border-[#A8BDAA]/20 text-xs text-[#4F635D] space-y-3">
                          <div>
                            <span className="font-semibold text-[#11231E] block mb-1">Ingredients:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {meal.ingredients.map((ing, ingIdx) => (
                                <span
                                  key={ingIdx}
                                  className="px-2 py-0.5 rounded-md bg-white border border-[#A8BDAA]/30 text-[#173D35]"
                                >
                                  {ing}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <span className="font-semibold text-[#11231E] block mb-1">Instructions:</span>
                            <ol className="list-decimal pl-4 space-y-1">
                              {meal.instructions.map((step, stepIdx) => (
                                <li key={stepIdx}>{step}</li>
                              ))}
                            </ol>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-xl border border-[#A8BDAA]/30 flex items-center justify-between">
                <div>
                  <span className="text-xs text-[#6B8A6E] uppercase font-bold">Goal Target</span>
                  <h4 className="text-base font-semibold text-[#11231E]">
                    {activeDraft?.goalTitle || 'Family Goal Strategy'}
                  </h4>
                </div>
                <div className="text-right">
                  <span className="text-xs text-[#6B8A6E] block">Target Timeline</span>
                  <span className="text-xs font-bold text-[#173D35]">
                    {activeDraft?.suggestedTimelineWeeks || 8} Weeks
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#4F635D]">
                  Proposed Project Phases ({editedProjects.length})
                </span>

                {editedProjects.map((proj, pIdx) => (
                  <div
                    key={proj.id || pIdx}
                    className="bg-white rounded-xl border border-[#A8BDAA]/30 p-4 space-y-3 shadow-xs"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h5 className="font-semibold text-[#11231E] text-sm">{proj.title}</h5>
                        <p className="text-xs text-[#4F635D] mt-0.5">{proj.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveProject(pIdx)}
                        className="text-neutral-400 hover:text-[#BC4749] p-1"
                        title="Discard project phase"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {proj.milestones.length > 0 && (
                      <div className="bg-[#F7F4EC] p-2.5 rounded-lg border border-[#A8BDAA]/20">
                        <span className="text-[11px] font-bold text-[#173D35] block mb-1 uppercase tracking-wider">
                          Key Milestones
                        </span>
                        <ul className="space-y-1">
                          {proj.milestones.map((m, mIdx) => (
                            <li key={mIdx} className="text-xs text-[#4F635D] flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#C39A60]" />
                              {m.title} {m.targetWeek ? `(Week ${m.targetWeek})` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-[#173D35] block uppercase tracking-wider">
                        Actionable Tasks ({proj.tasks.length})
                      </span>
                      {proj.tasks.map((task, tIdx) => (
                        <div
                          key={tIdx}
                          className="p-2.5 rounded-lg bg-neutral-50 border border-neutral-200 text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-[#11231E]">{task.title}</span>
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-sm bg-[#173D35]/10 text-[#173D35]">
                                {task.priority}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveTask(pIdx, tIdx)}
                                className="text-neutral-400 hover:text-[#BC4749]"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          {task.checklist && task.checklist.length > 0 && (
                            <ul className="list-disc pl-4 text-neutral-600 text-[11px] space-y-0.5">
                              {task.checklist.map((step, sIdx) => (
                                <li key={sIdx}>{step}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white border-t border-[#A8BDAA]/30 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[#4F635D] hover:bg-[#F7F4EC] transition-colors"
          >
            Discard All & Cancel
          </button>

          <button
            type="button"
            onClick={handleApprove}
            disabled={isSaving || (effectiveType === 'MEAL_PLAN' ? editedDays.length === 0 : editedProjects.length === 0)}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#173D35] hover:bg-[#11231E] disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
          >
            <CheckCircle className="w-4 h-4 text-[#A8BDAA]" />
            {isSaving ? 'Committing Draft...' : 'Approve & Save to Household'}
          </button>
        </div>
      </div>
    </div>
  );
};
