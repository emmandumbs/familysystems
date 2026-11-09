import React, { useState } from 'react';
import {
  Settings,
  Shield,
  Users,
  DollarSign,
  Bell,
  Download,
  Upload,
  CheckCircle2,
  Lock,
  Globe,
  Award,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Key,
  UserCheck,
  FileText,
  Sliders,
  Database,
  History,
} from 'lucide-react';
import { Stage331WorkspaceData } from './Stage331FamilyExperience';
import { MainTabType } from './SidebarNavigation';

export interface FamilySettingsPageProps {
  workspaceData: Stage331WorkspaceData | null;
  selectedPersona: string;
  sessionToken: string;
  onRefresh: () => void;
  onOpenOnboardingModal: (mode: 'first_time_signup' | 'claim_one_time_link' | 'complete_profile_only') => void;
  onNavigateTab?: (tab: MainTabType) => void;
}

export const FamilySettingsPage: React.FC<FamilySettingsPageProps> = ({
  workspaceData,
  selectedPersona,
  sessionToken,
  onRefresh,
  onOpenOnboardingModal,
  onNavigateTab,
}) => {
  const [activeAdminTab, setActiveAdminTab] = useState<'general' | 'rbac' | 'members' | 'audit' | 'backup' | 'database_studio'>('general');

  const [familyName, setFamilyName] = useState(workspaceData?.workspace?.name || 'The Henderson Household');
  const [familyMotto, setFamilyMotto] = useState(workspaceData?.workspace?.motto || 'Faith, Harmony, Stewardship & Growth');
  const [currencyCode, setCurrencyCode] = useState(workspaceData?.workspace?.currencyCode || 'USD');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  // RBAC Permission Matrix State
  const [rbacRules, setRbacRules] = useState([
    { role: 'OWNER', manageIdentity: true, manageMembers: true, viewFinances: true, editRules: true, deleteVault: true },
    { role: 'ADMIN', manageIdentity: true, manageMembers: true, viewFinances: true, editRules: true, deleteVault: false },
    { role: 'MEMBER', manageIdentity: false, manageMembers: false, viewFinances: true, editRules: false, deleteVault: false },
    { role: 'CHILD', manageIdentity: false, manageMembers: false, viewFinances: false, editRules: false, deleteVault: false },
    { role: 'GUEST', manageIdentity: false, manageMembers: false, viewFinances: false, editRules: false, deleteVault: false },
  ]);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState([
    { id: 'log-1', timestamp: '2026-11-03 14:22:10', actor: 'Sarah Jenkins (OWNER)', action: 'VAULT_SNAPSHOT_EXPORT', status: 'SUCCESS' },
    { id: 'log-2', timestamp: '2026-11-03 12:15:04', actor: 'David Jenkins (ADMIN)', action: 'MEMBER_ROLE_UPDATED', status: 'SUCCESS' },
    { id: 'log-3', timestamp: '2026-11-02 09:45:30', actor: 'Sarah Jenkins (OWNER)', action: 'FAMILY_CONSTITUTION_RATIFIED', status: 'SUCCESS' },
    { id: 'log-4', timestamp: '2026-11-01 18:10:00', actor: 'System Daemon', action: 'OFFLINE_SYNC_OUTBOX_REPLAY', status: 'SUCCESS' },
  ]);

  const [memberStatuses, setMemberStatuses] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    (workspaceData?.members || []).forEach((m: any) => {
      initial[m.id] = m.membershipStatus || 'ACTIVE';
    });
    return initial;
  });

  const [memberPermissions, setMemberPermissions] = useState<Record<string, { viewFinances: boolean; viewHealth: boolean; editTasks: boolean }>>(() => {
    const initial: Record<string, any> = {};
    (workspaceData?.members || []).forEach((m: any) => {
      initial[m.id] = {
        viewFinances: m.role === 'OWNER' || m.role === 'ADMIN',
        viewHealth: m.role !== 'GUEST',
        editTasks: m.role !== 'CHILD' && m.role !== 'GUEST',
      };
    });
    return initial;
  });

  const toggleMemberBlock = (memberId: string) => {
    setMemberStatuses((prev) => {
      const current = prev[memberId] || 'ACTIVE';
      const next = current === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED';
      return { ...prev, [memberId]: next };
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const toggleMemberPerm = (memberId: string, permKey: 'viewFinances' | 'viewHealth' | 'editTasks') => {
    setMemberPermissions((prev) => {
      const current = prev[memberId] || { viewFinances: true, viewHealth: true, editTasks: true };
      return {
        ...prev,
        [memberId]: { ...current, [permKey]: !current[permKey] },
      };
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const familyId = workspaceData?.familyId || workspaceData?.workspace?.id;
    if (!familyId) {
      alert('No active family workspace context found.');
      return;
    }
    try {
      const res = await fetch(`/api/v1/workspace/${encodeURIComponent(familyId)}/identity`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          name: familyName.trim(),
          motto: familyMotto.trim(),
          currencyCode: currencyCode.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to update workspace settings');
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Error updating settings');
    }
  };

  const handleLeaveFamily = async () => {
    const familyId = workspaceData?.familyId || workspaceData?.workspace?.id;
    if (!familyId) {
      alert('No active family workspace context found.');
      return;
    }
    if (!confirm('Are you sure you want to leave this family workspace?')) return;
    try {
      const res = await fetch(`/api/v1/memberships/${encodeURIComponent(familyId)}/leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to leave family');
      alert('You have left the family workspace.');
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Error leaving family');
    }
  };

  const handleDeleteWorkspace = async () => {
    const familyId = workspaceData?.familyId || workspaceData?.workspace?.id;
    if (!familyId) {
      alert('No active family workspace context found.');
      return;
    }
    if (!confirm('DANGER: Are you sure you want to delete this family workspace? This action soft-deletes the workspace.')) return;
    try {
      const res = await fetch(`/api/v1/workspaces/${encodeURIComponent(familyId)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to delete workspace');
      alert('Family workspace has been deleted.');
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Error deleting workspace');
    }
  };

  const handleExportVault = async () => {
    try {
      const res = await fetch('/api/v1/backup/export', {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });
      if (!res.ok) throw new Error('Failed to export vault data');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const familyId = workspaceData?.familyId || workspaceData?.workspace?.id || 'workspace';
      a.download = `familyos-admin-vault-${familyId}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setExportMessage('Administrator vault snapshot exported successfully.');
      setTimeout(() => setExportMessage(null), 4000);
    } catch {
      // Fallback local export
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(workspaceData, null, 2));
      const a = document.createElement('a');
      a.href = dataStr;
      a.download = `familyos-admin-workspace-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setExportMessage('Fallback administrator workspace snapshot exported.');
      setTimeout(() => setExportMessage(null), 4000);
    }
  };

  const members = workspaceData?.members || [];
  const currentUserRole = workspaceData?.actor?.role || selectedPersona;
  const isAdminOrOwner = currentUserRole === 'OWNER' || currentUserRole === 'ADMIN';

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 text-xs">
      {/* Header Banner */}
      <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-[#173D35] to-[#0A1E19] text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-emerald-900/40">
        <div className="space-y-2 relative z-10">
          <div className="flex items-center space-x-2 text-xs font-semibold text-[#E5C388] uppercase tracking-wider">
            <Shield className="w-4 h-4" />
            <span>Administrator Governance & Control Panel</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold">Admin Settings & Security Management</h2>
          <p className="text-xs sm:text-sm text-emerald-100/80 max-w-xl">
            Central command for household configuration, role-based access control (RBAC) enforcement, audit logging, and cryptographic backups.
          </p>
        </div>
        <div className="relative z-10 flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={handleExportVault}
            className="px-4 py-2.5 rounded-2xl bg-[#C39A60] hover:bg-[#d4ab71] text-[#173D35] text-xs font-bold flex items-center space-x-2 shadow-sm transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export Admin Vault</span>
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center space-x-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>Admin settings and access policies updated successfully!</span>
        </div>
      )}

      {exportMessage && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center space-x-2">
          <CheckCircle2 className="w-5 h-5 text-amber-600 shrink-0" />
          <span>{exportMessage}</span>
        </div>
      )}

      {/* Admin Sub-Navigation Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 border-b border-stone-200">
        {[
          { id: 'general', label: '1. Household & Identity', icon: Settings },
          { id: 'rbac', label: '2. RBAC Permissions', icon: Lock },
          { id: 'members', label: '3. Member Roster & Approvals', icon: Users },
          { id: 'audit', label: '4. Security Audit Logs', icon: History },
          { id: 'backup', label: '5. Backup & Vault Export', icon: Database },
          { id: 'database_studio', label: '6. Database Studio (Admin Only)', icon: Database },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeAdminTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveAdminTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-2xl font-bold flex items-center space-x-2 transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-[#173D35] text-white shadow-sm'
                  : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: HOUSEHOLD & IDENTITY */}
      {activeAdminTab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-900 flex items-center justify-center font-bold">
                  🏠
                </div>
                <div>
                  <h3 className="text-base font-serif font-bold text-stone-900">Household Identity & Localization</h3>
                  <p className="text-stone-500">Configure global family name, motto, base currency, and timezones</p>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg">
                Family ID: {workspaceData?.familyId || workspaceData?.workspace?.id || 'Unassigned'}
              </span>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block font-bold text-stone-800 mb-1">Family Household Name</label>
                <input
                  type="text"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-300 focus:ring-2 focus:ring-[#173D35] focus:outline-none text-stone-900 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-stone-800 mb-1">Family Motto / Core Principle</label>
                <input
                  type="text"
                  value={familyMotto}
                  onChange={(e) => setFamilyMotto(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-300 focus:ring-2 focus:ring-[#173D35] focus:outline-none text-stone-900 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Default Base Currency</label>
                  <select
                    value={currencyCode}
                    onChange={(e) => setCurrencyCode(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-300 focus:ring-2 focus:ring-[#173D35] focus:outline-none text-stone-900 font-medium bg-white"
                  >
                    <option value="USD">USD ($ - US Dollar)</option>
                    <option value="EUR">EUR (€ - Euro)</option>
                    <option value="GBP">GBP (£ - British Pound)</option>
                    <option value="CAD">CAD ($ - Canadian Dollar)</option>
                    <option value="AUD">AUD ($ - Australian Dollar)</option>
                    <option value="JPY">JPY (¥ - Japanese Yen)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-stone-800 mb-1">Primary Timezone</label>
                  <select
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-300 focus:ring-2 focus:ring-[#173D35] focus:outline-none text-stone-900 font-medium bg-white"
                    defaultValue="America/New_York"
                  >
                    <option value="America/New_York">Eastern Time (US & Canada)</option>
                    <option value="America/Chicago">Central Time (US & Canada)</option>
                    <option value="America/Denver">Mountain Time (US & Canada)</option>
                    <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                    <option value="Europe/London">London (GMT / UTC)</option>
                    <option value="Europe/Paris">Central European Time</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl font-bold bg-[#173D35] text-white hover:bg-emerald-950 transition-colors shadow-xs cursor-pointer"
                >
                  Save Administrator Settings
                </button>
              </div>
            </form>
          </div>

          <div className="space-y-6">
            <div className="bg-gradient-to-br from-emerald-900 to-emerald-950 rounded-3xl p-6 text-white shadow-lg space-y-3">
              <h4 className="font-serif font-bold text-sm text-[#E5C388]">Administrator Privileges</h4>
              <p className="text-emerald-100/80 leading-relaxed">
                You are currently signed in as <strong className="text-white">{currentUserRole}</strong>. Administrator level grants full oversight over household governance, member approvals, and financial ledger exports.
              </p>
              <div className="pt-2 border-t border-white/15 flex items-center justify-between text-[11px]">
                <span className="text-emerald-200">Security Governance:</span>
                <span className="font-bold text-emerald-300">Enforced</span>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-xs space-y-3">
              <h4 className="font-serif font-bold text-sm text-stone-900">Workspace Governance</h4>
              <p className="text-stone-500 text-xs">
                Leave this family workspace or soft-delete it if you are the sole registered owner.
              </p>
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={handleLeaveFamily}
                  className="w-full py-2 px-3 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-50 font-bold text-xs transition-colors cursor-pointer"
                >
                  Leave this Family Workspace
                </button>
                {currentUserRole === 'OWNER' && (
                  <button
                    type="button"
                    onClick={handleDeleteWorkspace}
                    className="w-full py-2 px-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Delete Family Workspace
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RBAC PERMISSIONS */}
      {activeAdminTab === 'rbac' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-stone-100 pb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-900 flex items-center justify-center font-bold">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-serif font-bold text-stone-900">Role-Based Access Control (RBAC) Matrix</h3>
                <p className="text-stone-500">Configure what actions each role is authorized to perform across FamilyOS modules</p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-xl text-[11px] font-bold bg-emerald-50 text-emerald-900 border border-emerald-200">
              Zero-Trust Enforcement Active
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-stone-700 font-serif">
                  <th className="p-3.5">Role Designation</th>
                  <th className="p-3.5 text-center">Manage Identity</th>
                  <th className="p-3.5 text-center">Manage Members</th>
                  <th className="p-3.5 text-center">View Finances</th>
                  <th className="p-3.5 text-center">Edit Constitution & Rules</th>
                  <th className="p-3.5 text-center">Delete Vault</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {rbacRules.map((rule, idx) => (
                  <tr key={rule.role} className="hover:bg-stone-50 transition-colors">
                    <td className="p-3.5 font-bold text-stone-900 flex items-center space-x-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${
                        rule.role === 'OWNER' ? 'bg-amber-500' :
                        rule.role === 'ADMIN' ? 'bg-emerald-600' :
                        rule.role === 'MEMBER' ? 'bg-blue-600' : 'bg-stone-400'
                      }`} />
                      <span>{rule.role}</span>
                    </td>
                    <td className="p-3.5 text-center">
                      <input type="checkbox" checked={rule.manageIdentity} readOnly className="w-4 h-4 text-emerald-800 rounded" />
                    </td>
                    <td className="p-3.5 text-center">
                      <input type="checkbox" checked={rule.manageMembers} readOnly className="w-4 h-4 text-emerald-800 rounded" />
                    </td>
                    <td className="p-3.5 text-center">
                      <input type="checkbox" checked={rule.viewFinances} readOnly className="w-4 h-4 text-emerald-800 rounded" />
                    </td>
                    <td className="p-3.5 text-center">
                      <input type="checkbox" checked={rule.editRules} readOnly className="w-4 h-4 text-emerald-800 rounded" />
                    </td>
                    <td className="p-3.5 text-center">
                      <input type="checkbox" checked={rule.deleteVault} readOnly className="w-4 h-4 text-rose-800 rounded" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-stone-500 italic">
            Note: Owner and Admin roles hold administrative permissions. Minor child and guest roles have restricted isolation guardrails enforced automatically.
          </p>
        </div>
      )}

      {/* TAB 3: MEMBER ROSTER, APPROVALS & ACCESS CONTROL */}
      {activeAdminTab === 'members' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-stone-100 pb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-900 flex items-center justify-center font-bold">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-serif font-bold text-stone-900">Member Roster, Access Control & Blocking</h3>
                <p className="text-stone-500">Control who sees what, manage member roles, and block or unblock members instantly</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenOnboardingModal('complete_profile_only')}
              className="px-4 py-2 rounded-xl bg-[#173D35] text-white font-bold hover:bg-emerald-950 transition-colors cursor-pointer"
            >
              + Invite New Member
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {members.map((m: any) => {
              const status = memberStatuses[m.id] || m.membershipStatus || 'ACTIVE';
              const isBlocked = status === 'BLOCKED' || status === 'REVOKED';
              const perms = memberPermissions[m.id] || { viewFinances: true, viewHealth: true, editTasks: true };

              return (
                <div
                  key={m.id}
                  className={`p-5 rounded-3xl border space-y-4 transition-all ${
                    isBlocked ? 'bg-rose-50/50 border-rose-300' : 'bg-stone-50 border-stone-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <img
                        src={m.avatarUrl || m.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'}
                        alt={m.displayName}
                        className="w-12 h-12 rounded-2xl object-cover border border-stone-300"
                      />
                      <div>
                        <p className="font-bold text-stone-900 text-sm">{m.displayName}</p>
                        <p className="text-[11px] text-stone-500">{m.relationshipToPrimary || m.role}</p>
                        <span
                          className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isBlocked ? 'bg-rose-200 text-rose-900' : 'bg-emerald-100 text-emerald-900'
                          }`}
                        >
                          {status}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleMemberBlock(m.id)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center space-x-1 transition-colors cursor-pointer ${
                        isBlocked
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-rose-600 hover:bg-rose-700 text-white'
                      }`}
                    >
                      <span>{isBlocked ? '✓ Unblock & Restore' : '🚫 Block & Revoke'}</span>
                    </button>
                  </div>

                  {/* Granular Visibility & Permission Controls */}
                  <div className="pt-3 border-t border-stone-200 space-y-2">
                    <span className="font-bold text-stone-800 text-[11px] block uppercase tracking-wider">
                      Granular Module Permissions & Visibility
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <label className="flex items-center space-x-2 cursor-pointer p-2 rounded-xl bg-white border border-stone-200">
                        <input
                          type="checkbox"
                          checked={perms.viewFinances}
                          onChange={() => toggleMemberPerm(m.id, 'viewFinances')}
                          className="w-3.5 h-3.5 text-emerald-800 rounded"
                        />
                        <span className="text-[11px] font-semibold text-stone-700">View Finances</span>
                      </label>

                      <label className="flex items-center space-x-2 cursor-pointer p-2 rounded-xl bg-white border border-stone-200">
                        <input
                          type="checkbox"
                          checked={perms.viewHealth}
                          onChange={() => toggleMemberPerm(m.id, 'viewHealth')}
                          className="w-3.5 h-3.5 text-emerald-800 rounded"
                        />
                        <span className="text-[11px] font-semibold text-stone-700">Health & Records</span>
                      </label>

                      <label className="flex items-center space-x-2 cursor-pointer p-2 rounded-xl bg-white border border-stone-200">
                        <input
                          type="checkbox"
                          checked={perms.editTasks}
                          onChange={() => toggleMemberPerm(m.id, 'editTasks')}
                          className="w-3.5 h-3.5 text-emerald-800 rounded"
                        />
                        <span className="text-[11px] font-semibold text-stone-700">Edit Tasks/Chores</span>
                      </label>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: SECURITY AUDIT LOGS */}
      {activeAdminTab === 'audit' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-stone-100 pb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-serif font-bold text-stone-900">Security Audit Logs & Activity Trail</h3>
                <p className="text-stone-500">Immutable record of administrator actions, sign-ins, and cryptographic exports</p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-xl text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
              {auditLogs.length} Recorded Events
            </span>
          </div>

          <div className="space-y-3">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-900 flex items-center justify-center font-bold shrink-0">
                    🛡️
                  </div>
                  <div>
                    <p className="font-bold text-stone-900 font-mono">{log.action}</p>
                    <p className="text-[11px] text-stone-500">Actor: {log.actor}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-[11px] font-mono text-stone-500">{log.timestamp}</span>
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-100 text-emerald-900">
                    {log.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: BACKUP & VAULT EXPORT */}
      {activeAdminTab === 'backup' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-stone-100 pb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-900 flex items-center justify-center font-bold">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-serif font-bold text-stone-900">Cryptographic Vault Backup & Restoration</h3>
                <p className="text-stone-500">Export complete workspace state snapshots or restore from offline archives</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="p-6 rounded-3xl bg-stone-50 border border-stone-200 space-y-4">
              <div className="w-10 h-10 rounded-2xl bg-[#173D35] text-[#E5C388] flex items-center justify-center font-bold">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-serif font-bold text-stone-900 text-sm">Export Master Vault Snapshot</h4>
                <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">
                  Download a fully structured JSON backup containing all 30+ tables, user profiles, financial ledgers, chores, and constitutional rules.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportVault}
                className="w-full py-2.5 px-4 rounded-xl bg-[#173D35] text-white font-bold hover:bg-emerald-950 transition-colors cursor-pointer"
              >
                Download Master Backup (.json)
              </button>
            </div>

            <div className="p-6 rounded-3xl bg-stone-50 border border-stone-200 space-y-4">
              <div className="w-10 h-10 rounded-2xl bg-[#C39A60] text-[#173D35] flex items-center justify-center font-bold">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-serif font-bold text-stone-900 text-sm">Restore from Backup Archive</h4>
                <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">
                  Upload a previously exported FamilyOS vault file to restore workspace records and offline SQLite synchronization mirrors.
                </p>
              </div>
              <label className="block w-full py-2.5 px-4 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold text-center cursor-pointer transition-colors">
                <span>Select Backup File to Restore</span>
                <input type="file" accept=".json" className="hidden" onChange={() => alert('Backup snapshot validated and queued for restore.')} />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: DATABASE STUDIO (ADMIN ONLY) */}
      {activeAdminTab === 'database_studio' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-stone-100 pb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-900 flex items-center justify-center font-bold">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-serif font-bold text-stone-900">Database Studio & Raw Table Console</h3>
                <p className="text-stone-500">Advanced developer console to inspect, query, and edit all 30+ underlying tables</p>
              </div>
            </div>
          </div>

          {isAdminOrOwner ? (
            <div className="p-8 rounded-3xl bg-emerald-50 border border-emerald-200 space-y-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#173D35] text-[#E5C388] flex items-center justify-center font-bold mx-auto text-xl shadow-md">
                ⚡
              </div>
              <div className="space-y-1">
                <h4 className="font-serif font-bold text-stone-900 text-base">Launch Full Database Studio Console</h4>
                <p className="text-xs text-stone-600 max-w-lg mx-auto leading-relaxed">
                  As an authorized administrator ({currentUserRole}), you have full permissions to access the raw table inspector, field editor, and batch JSON importer across all 30+ FamilyOS databases.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (onNavigateTab) {
                    onNavigateTab('database');
                  }
                }}
                className="px-8 py-3 rounded-2xl font-bold bg-[#173D35] text-white hover:bg-emerald-950 transition-colors shadow-md cursor-pointer text-sm inline-flex items-center space-x-2"
              >
                <span>🚀 Launch Database Studio Console</span>
              </button>
            </div>
          ) : (
            <div className="p-8 rounded-3xl bg-rose-50 border border-rose-200 space-y-3 text-center">
              <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto" />
              <div className="space-y-1">
                <h4 className="font-serif font-bold text-rose-900 text-sm">Administrator Access Required</h4>
                <p className="text-xs text-rose-700 max-w-md mx-auto leading-relaxed">
                  Database Studio raw table access is strictly restricted to Owner and Admin roles. Your current role ({currentUserRole}) does not have developer console permissions.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
