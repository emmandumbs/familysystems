import React, { useState } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, AlertCircle, CloudOff } from 'lucide-react';
import { useOfflineStatus } from '../hooks/useOfflineStatus';

export const OfflineStatusHeader: React.FC = () => {
  const { isOnline, pendingCount, isSyncing, lastSyncedAt, lastSyncError, syncNow } = useOfflineStatus();
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);

  const handleManualSync = async () => {
    const result = await syncNow();
    if (result.processed > 0 && result.errors === 0) {
      setShowSyncSuccess(true);
      setTimeout(() => setShowSyncSuccess(false), 3500);
    }
  };

  return (
    <div className="flex items-center space-x-2">
      {/* Network Status Badge */}
      <div
        className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-xl text-xs font-medium border transition-colors ${
          isOnline
            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/40'
            : 'bg-amber-950/80 text-amber-200 border-amber-600/60 animate-pulse'
        }`}
        title={
          isOnline
            ? `Online & Connected. Last synced: ${
                lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString() : 'Recently'
              }`
            : 'Offline Mode active. All records are saved to device storage and will sync automatically upon reconnection.'
        }
      >
        {isOnline ? (
          <>
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <WifiOff className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-semibold text-[11px]">Offline Mode</span>
          </>
        )}
      </div>

      {/* Outbox Pending Actions Badge & Sync Button */}
      {pendingCount > 0 && (
        <button
          type="button"
          onClick={handleManualSync}
          disabled={isSyncing || !isOnline}
          className={`flex items-center space-x-1 px-2.5 py-1 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer border ${
            isOnline
              ? 'bg-[#C39A60] hover:bg-[#b08850] text-[#0A1E19] border-[#E7D1AA]/60'
              : 'bg-stone-800 text-stone-300 border-stone-700 cursor-not-allowed opacity-90'
          }`}
          title={
            isOnline
              ? `Click to sync ${pendingCount} offline changes now`
              : `${pendingCount} changes stored safely on this device. Will sync once reconnected.`
          }
        >
          <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>
            {pendingCount} {pendingCount === 1 ? 'change' : 'changes'}
          </span>
          {isOnline && <span className="hidden sm:inline">&bull; Sync</span>}
        </button>
      )}

      {/* Temporary Sync Success Toast Pill */}
      {showSyncSuccess && (
        <div className="flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-emerald-900/90 text-emerald-200 text-[11px] font-medium border border-emerald-600 animate-fade-in">
          <CheckCircle2 className="w-3 h-3 text-emerald-300" />
          <span>Synced!</span>
        </div>
      )}

      {/* Offline Error Warning if any */}
      {lastSyncError && isOnline && (
        <div
          className="flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-rose-950/80 text-rose-300 text-[11px] border border-rose-800"
          title={lastSyncError}
        >
          <AlertCircle className="w-3 h-3 text-rose-400" />
          <span className="hidden lg:inline truncate max-w-[120px]">Sync issue</span>
        </div>
      )}
    </div>
  );
};

export const OfflineBanner: React.FC = () => {
  const { isOnline, pendingCount } = useOfflineStatus();

  if (isOnline) return null;

  return (
    <aside
      aria-label="Offline Mode Notification"
      className="bg-amber-600 text-amber-950 px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-inner transition-all border-b border-amber-700"
    >
      <div className="flex items-center space-x-2">
        <CloudOff className="w-4 h-4 text-amber-950 shrink-0" />
        <span>
          <strong>Offline Mode Active:</strong> You are disconnected from the network. You can continue adding and editing recipes, meals, chores, inventories, and notes—everything is saved locally on your device and will auto-sync when you reconnect.
        </span>
      </div>
      {pendingCount > 0 && (
        <span className="ml-3 px-2 py-0.5 rounded-full bg-amber-900 text-amber-100 text-[11px] shrink-0 font-mono">
          {pendingCount} pending {pendingCount === 1 ? 'action' : 'actions'}
        </span>
      )}
    </aside>
  );
};
