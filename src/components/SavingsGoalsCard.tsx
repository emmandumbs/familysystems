import React from 'react';
import { CheckCircle2, Edit3, Trash2, Plus } from 'lucide-react';
import { formatCents, toBigIntOrZero } from '../utils/financeFormatting';

export interface ContributionItem {
  id: string;
  amountCents?: number;
  amountCentsDecimal?: string;
  notes?: string;
  contributedBy?: string;
  contributedAt?: string | number;
}

export interface SavingsGoal {
  id: string;
  title: string;
  targetCents?: number;
  targetCentsDecimal?: string;
  currentCents?: number;
  currentCentsDecimal?: string;
  targetDate?: string | number | null;
  isCompleted?: boolean;
  progressPercentage?: number;
  suggestedMonthlyContributionCents?: number;
  suggestedMonthlyContributionCentsDecimal?: string;
  plannedMonthlyContributionCents?: number;
  plannedMonthlyContributionCentsDecimal?: string;
  linkedAccountId?: string | null;
  contributions?: ContributionItem[];
}

export interface SavingsGoalsCardProps {
  goal: SavingsGoal;
  brandBorder: string;
  onCheckOff: (goal: SavingsGoal) => void;
  onEdit?: (goal: SavingsGoal) => void;
  onDelete?: (goal: SavingsGoal) => void;
  linkedAccountName?: string;
}

export const SavingsGoalsCard: React.FC<SavingsGoalsCardProps> = ({
  goal,
  brandBorder,
  onCheckOff,
  onEdit,
  onDelete,
  linkedAccountName,
}) => {
  const targetBig = toBigIntOrZero(goal.targetCentsDecimal, goal.targetCents);
  const currentBig = toBigIntOrZero(goal.currentCentsDecimal, goal.currentCents);
  const pct =
    goal.progressPercentage ??
    (targetBig > 0n ? Math.min(100, Number((currentBig * 100n) / targetBig)) : 0);
  const remainingBig = targetBig > currentBig ? targetBig - currentBig : 0n;
  const isCompleted = Boolean(goal.isCompleted || (targetBig > 0n && currentBig >= targetBig));
  const contribs = goal.contributions || [];

  return (
    <div
      className="rounded-2xl p-5 bg-white border flex flex-col justify-between gap-4 shadow-xs transition-all hover:shadow-md"
      style={{ borderColor: brandBorder }}
    >
      <div className="space-y-4">
        {/* Card Header */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
              <span
                className={`inline-flex items-center gap-1 font-semibold ${
                  isCompleted ? 'text-emerald-800' : 'text-stone-600'
                }`}
              >
                {isCompleted ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                    Goal Reached
                  </>
                ) : (
                  'Active Reserve Goal'
                )}
              </span>
              {goal.targetDate && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Target {new Date(goal.targetDate).toLocaleDateString()}</span>
                </>
              )}
              {linkedAccountName && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{linkedAccountName}</span>
                </>
              )}
            </div>
            <h3 className="text-lg font-serif font-bold text-stone-900 tracking-tight">{goal.title}</h3>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onCheckOff(goal)}
              className="px-3 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold inline-flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Deposit</span>
            </button>
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(goal)}
                title={`Edit ${goal.title}`}
                aria-label={`Edit ${goal.title}`}
                className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(goal)}
                title={`Delete ${goal.title}`}
                aria-label={`Delete ${goal.title}`}
                className="p-1.5 rounded-lg text-stone-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Saved vs Target Figures */}
        <div className="flex items-baseline justify-between gap-2 pt-1">
          <div>
            <span className="text-[11px] text-stone-500 block">Current Saved</span>
            <span className="text-xl font-mono font-bold text-emerald-900">
              {formatCents(goal.currentCentsDecimal ?? goal.currentCents)}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-stone-500 block">Target Reserve ({pct}%)</span>
            <span className="text-sm font-mono font-semibold text-stone-700">
              {formatCents(goal.targetCentsDecimal ?? goal.targetCents)}
            </span>
          </div>
        </div>

        {/* Goal Progress Bar */}
        <div className="w-full h-2.5 rounded-full bg-stone-100 border border-stone-200/80 p-0.5 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-700 transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
          />
        </div>

        {/* Compact Monthly Installment Metrics */}
        <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
          <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/80">
            <span className="text-[10px] text-stone-500 block">Remaining</span>
            <span className="font-mono font-bold text-stone-900">
              {formatCents(remainingBig)}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/80">
            <span className="text-[10px] text-stone-500 block">Planned / Mo</span>
            <span className="font-mono font-bold text-stone-900">
              {formatCents(
                goal.plannedMonthlyContributionCentsDecimal ??
                  goal.plannedMonthlyContributionCents ??
                  0
              )}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200/80">
            <span className="text-[10px] text-amber-900 block">Suggested / Mo</span>
            <span className="font-mono font-bold text-amber-950">
              {formatCents(
                goal.suggestedMonthlyContributionCentsDecimal ??
                  goal.suggestedMonthlyContributionCents ??
                  0
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Recorded Contribution History */}
      <div className="pt-3 border-t border-stone-100 space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-stone-700 text-[11px]">
            Recent Deposits ({contribs.length})
          </span>
          {!linkedAccountName && goal.linkedAccountId && (
            <span className="text-[11px] text-stone-400 font-mono">
              Acct: {goal.linkedAccountId}
            </span>
          )}
        </div>
        {contribs.length === 0 ? (
          <p className="text-stone-400 text-[11px]">No deposits recorded yet.</p>
        ) : (
          <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
            {contribs.map((c: any) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between py-1.5 px-2.5 rounded-lg bg-stone-50 border border-stone-200/70 text-[11px]"
              >
                <div className="truncate max-w-[70%]">
                  <span className="font-medium text-stone-800">{c.notes || 'Savings deposit'}</span>
                  <span className="text-stone-500 ml-1.5">
                    · {c.contributedAt ? new Date(c.contributedAt).toLocaleDateString() : 'Recent'}
                  </span>
                </div>
                <span className="font-mono font-bold text-emerald-800">
                  +{formatCents(c.amountCentsDecimal ?? c.amountCents)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
