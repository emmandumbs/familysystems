import React, { useState, useEffect } from 'react';
import { Shield, Smartphone, Monitor, Globe, LogOut, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

export interface ActiveSession {
  id: string;
  deviceName: string;
  platform: string;
  lastActiveAt: number;
  createdAt: number;
  expiresAt: number;
  isRevoked: boolean;
  revokedAt?: number;
  isCurrent?: boolean;
}

export interface ActiveSessionsManagerProps {
  sessionToken?: string;
  onSessionRevoked?: () => void;
}

export const ActiveSessionsManager: React.FC<ActiveSessionsManagerProps> = ({
  sessionToken,
  onSessionRevoked,
}) => {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState<boolean>(false);

  const fetchSessions = async () => {
    if (!sessionToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/auth/sessions', {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });
      if (!res.ok) {
        throw new Error(`Failed to load sessions (HTTP ${res.status})`);
      }
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (err: any) {
      setError(err.message || 'Error loading active sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [sessionToken]);

  const handleRevokeSession = async (sessionId: string) => {
    if (!sessionToken) return;
    setRevokingId(sessionId);
    setError(null);
    setActionSuccess(null);
    try {
      const res = await fetch(`/api/v1/auth/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });
      if (!res.ok) {
        throw new Error(`Failed to revoke session (HTTP ${res.status})`);
      }
      setActionSuccess('Device session revoked successfully.');
      await fetchSessions();
      if (onSessionRevoked) onSessionRevoked();
    } catch (err: any) {
      setError(err.message || 'Error revoking session');
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAllOtherSessions = async () => {
    if (!sessionToken) return;
    setRevokingOthers(true);
    setError(null);
    setActionSuccess(null);
    try {
      const res = await fetch('/api/v1/auth/sessions/revoke-others', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        throw new Error(`Failed to revoke other sessions (HTTP ${res.status})`);
      }
      const data = await res.json();
      setActionSuccess(`Successfully revoked ${data.revokedCount || 0} other device session(s).`);
      await fetchSessions();
      if (onSessionRevoked) onSessionRevoked();
    } catch (err: any) {
      setError(err.message || 'Error revoking other sessions');
    } finally {
      setRevokingOthers(false);
    }
  };

  const activeSessionsList = sessions.filter((s) => !s.isRevoked);
  const revokedSessionsList = sessions.filter((s) => s.isRevoked);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-lg">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">Active Device & Session Management</h3>
            <p className="text-xs text-slate-500">
              Track and manage all devices currently authenticated to your FamilyOS account.
            </p>
          </div>
        </div>
        <button
          onClick={fetchSessions}
          disabled={loading}
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors"
          title="Refresh active sessions"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {actionSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Active Device Sessions ({activeSessionsList.length})
          </h4>
          {activeSessionsList.length > 1 && (
            <button
              onClick={handleRevokeAllOtherSessions}
              disabled={revokingOthers}
              className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{revokingOthers ? 'Revoking...' : 'Sign Out All Other Devices'}</span>
            </button>
          )}
        </div>

        {activeSessionsList.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-2">No active sessions found.</p>
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
            {activeSessionsList.map((session) => {
              const isAndroid = session.platform?.toLowerCase().includes('android');
              const isCurrent = session.isCurrent;

              return (
                <div
                  key={session.id}
                  className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-center space-x-3.5">
                    <div className="p-2 bg-slate-100 text-slate-700 rounded-lg">
                      {isAndroid ? <Smartphone className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-slate-900">
                          {session.deviceName || 'Authorized Device'}
                        </span>
                        {isCurrent && (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                            Current Session
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center space-x-2">
                        <span>Platform: {session.platform || 'Web'}</span>
                        <span>·</span>
                        <span>
                          Active:{' '}
                          {session.lastActiveAt
                            ? new Date(session.lastActiveAt * 1000).toLocaleString()
                            : 'Just now'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {!isCurrent && (
                    <button
                      onClick={() => handleRevokeSession(session.id)}
                      disabled={revokingId === session.id}
                      className="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-red-50 hover:text-red-700 hover:border-red-200 border border-slate-200 rounded-lg text-xs font-medium transition-colors"
                    >
                      {revokingId === session.id ? 'Revoking...' : 'Revoke Session'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {revokedSessionsList.length > 0 && (
        <div className="pt-4 border-t border-slate-100 space-y-2">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Recently Revoked Sessions ({revokedSessionsList.length})
          </h4>
          <div className="space-y-1.5">
            {revokedSessionsList.map((session) => (
              <div
                key={session.id}
                className="p-3 bg-slate-50/80 rounded-lg text-xs text-slate-500 flex items-center justify-between"
              >
                <div className="flex items-center space-x-2">
                  <Globe className="w-4 h-4 text-slate-400" />
                  <span>{session.deviceName || session.id}</span>
                  <span>({session.platform})</span>
                </div>
                <span className="text-[11px] text-slate-400">
                  Revoked{' '}
                  {session.revokedAt ? new Date(session.revokedAt * 1000).toLocaleDateString() : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
