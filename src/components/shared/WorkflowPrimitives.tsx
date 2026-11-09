import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Lock,
  Loader2,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';

export interface PageHeaderProps {
  badge?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  badge,
  title,
  subtitle,
  actions,
  icon,
}) => (
  <div className="rounded-3xl bg-gradient-to-br from-[#173D35] via-[#13322B] to-[#0E2620] text-[#F7F4EC] p-6 sm:p-7 shadow-xl border border-[#C39A60]/30 relative overflow-hidden">
    <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <div className="space-y-1.5">
        {badge && (
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#C39A60]/20 border border-[#C39A60]/40 text-[#E5C388] text-[11px] font-bold uppercase tracking-wider">
            {icon}
            <span>{badge}</span>
          </div>
        )}
        <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-white">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs sm:text-sm text-emerald-100/80 max-w-2xl leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5 shrink-0">{actions}</div>}
    </div>
  </div>
);

export interface SummaryCardProps {
  label: string;
  value: React.ReactNode;
  subValue?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: 'default' | 'emerald' | 'gold' | 'amber' | 'rose';
  onClick?: () => void;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
  label,
  value,
  subValue,
  icon,
  tone = 'default',
  onClick,
}) => {
  const toneClasses: Record<string, string> = {
    default: 'bg-white border-stone-200/80 text-stone-900',
    emerald: 'bg-emerald-50/70 border-emerald-200 text-emerald-950',
    gold: 'bg-[#FAF6EE] border-[#C39A60]/40 text-stone-900',
    amber: 'bg-amber-50/70 border-amber-200 text-amber-950',
    rose: 'bg-rose-50/70 border-rose-200 text-rose-950',
  };

  return (
    <div
      onClick={onClick}
      className={`p-4 sm:p-5 rounded-2xl border shadow-xs transition-all ${toneClasses[tone]} ${
        onClick ? 'cursor-pointer hover:shadow-md hover:border-[#C39A60]' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
          {label}
        </span>
        {icon && <div className="text-[#173D35] shrink-0">{icon}</div>}
      </div>
      <div className="text-xl sm:text-2xl font-serif font-bold tracking-tight">{value}</div>
      {subValue && <div className="text-xs text-stone-500 mt-1">{subValue}</div>}
    </div>
  );
};

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  actionLabel,
  onAction,
}) => (
  <div className="rounded-2xl border border-dashed border-stone-300 bg-[#FAF8F3] p-8 text-center space-y-3">
    {icon && (
      <div className="w-12 h-12 rounded-2xl bg-[#173D35]/10 text-[#173D35] flex items-center justify-center mx-auto">
        {icon}
      </div>
    )}
    <h4 className="text-base font-serif font-bold text-stone-800">{title}</h4>
    <p className="text-xs text-stone-600 max-w-md mx-auto leading-relaxed">{description}</p>
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#173D35] hover:bg-[#123029] text-[#F7F4EC] text-xs font-semibold shadow-xs transition-colors cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5 text-[#E5C388]" />
        <span>{actionLabel}</span>
      </button>
    )}
  </div>
);

export interface RecordListProps<T> {
  items: T[];
  keyExtractor: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
  emptyTitle: string;
  emptyDescription: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  className?: string;
}

export function RecordList<T>({
  items,
  keyExtractor,
  renderItem,
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  onEmptyAction,
  className = 'space-y-2.5',
}: RecordListProps<T>) {
  if (!items || items.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
      />
    );
  }
  return (
    <div className={className}>
      {items.map((item) => (
        <React.Fragment key={keyExtractor(item)}>{renderItem(item)}</React.Fragment>
      ))}
    </div>
  );
}

export interface FormDrawerProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}

export const FormDrawer: React.FC<FormDrawerProps> = ({
  isOpen,
  title,
  subtitle,
  onClose,
  children,
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-stone-950/60 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-[#F7F4EC] h-full shadow-2xl border-l border-stone-200 flex flex-col overflow-hidden">
        <div className="px-6 py-4 bg-[#173D35] text-[#F7F4EC] flex items-center justify-between border-b border-[#C39A60]/30">
          <div>
            <h3 className="text-base font-serif font-bold text-white">{title}</h3>
            {subtitle && <p className="text-xs text-emerald-100/80">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            aria-label="Close drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
};

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl bg-white border border-stone-200 shadow-2xl p-6 space-y-4">
        <div className="flex items-start space-x-3">
          <div
            className={`p-2 rounded-xl shrink-0 ${
              variant === 'danger' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-[#173D35]'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-serif font-bold text-stone-900">{title}</h3>
            <p className="text-xs text-stone-600 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-100 text-xs font-semibold cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-white text-xs font-semibold cursor-pointer ${
              variant === 'danger'
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-[#173D35] hover:bg-[#123029]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export const LoadingState: React.FC<{ label?: string }> = ({
  label = 'Synchronizing family workspace...',
}) => (
  <div className="rounded-2xl bg-white border border-stone-200/80 p-10 flex flex-col items-center justify-center space-y-3 text-stone-600">
    <Loader2 className="w-6 h-6 animate-spin text-[#173D35]" />
    <p className="text-xs font-medium">{label}</p>
  </div>
);

export const ErrorState: React.FC<{
  title?: string;
  message: string;
  onRetry?: () => void;
}> = ({ title = 'Unable to load section', message, onRetry }) => (
  <div className="rounded-2xl bg-rose-50 border border-rose-200 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div className="flex items-start space-x-3">
      <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
      <div>
        <h4 className="text-sm font-bold text-rose-950">{title}</h4>
        <p className="text-xs text-rose-800 mt-0.5">{message}</p>
      </div>
    </div>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold shrink-0 cursor-pointer"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span>Retry</span>
      </button>
    )}
  </div>
);

export const PermissionGate: React.FC<{
  allowed: boolean;
  requiredRoleLabel?: string;
  fallbackMessage?: string;
  children: React.ReactNode;
}> = ({
  allowed,
  requiredRoleLabel = 'Authorized Adult Member',
  fallbackMessage = 'This area is restricted by your family role permissions.',
  children,
}) => {
  if (allowed) return <>{children}</>;
  return (
    <div className="rounded-2xl bg-stone-100 border border-stone-200/90 p-6 flex items-center space-x-3 text-stone-700">
      <div className="p-2.5 rounded-xl bg-stone-200 text-stone-700 shrink-0">
        <Lock className="w-4 h-4" />
      </div>
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-stone-800">
          Role-Restricted Section ({requiredRoleLabel})
        </h4>
        <p className="text-xs text-stone-600 mt-0.5">{fallbackMessage}</p>
      </div>
    </div>
  );
};

export interface ActivityHistoryItem {
  id: string;
  title: string;
  subtitle?: string;
  timestamp: number | string;
  actorName?: string;
  status?: 'SUCCESS' | 'INFO' | 'WARNING';
}

export const ActivityHistory: React.FC<{
  items: ActivityHistoryItem[];
  emptyMessage?: string;
}> = ({ items, emptyMessage = 'No recent activity recorded yet.' }) => {
  if (!items || items.length === 0) {
    return (
      <div className="rounded-xl bg-stone-50 border border-stone-200/70 p-4 text-xs text-stone-500 text-center">
        {emptyMessage}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((entry) => (
        <div
          key={entry.id}
          className="p-3 rounded-xl bg-white border border-stone-200/80 flex items-center justify-between gap-3 text-xs"
        >
          <div className="flex items-center space-x-2.5 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-stone-800 truncate">{entry.title}</p>
              {entry.subtitle && <p className="text-[11px] text-stone-500 truncate">{entry.subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center space-x-1 text-[11px] text-stone-500 shrink-0">
            <Clock className="w-3 h-3" />
            <span>
              {typeof entry.timestamp === 'number'
                ? new Date(entry.timestamp).toLocaleDateString()
                : entry.timestamp}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};
