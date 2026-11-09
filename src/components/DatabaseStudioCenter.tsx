import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Database,
  Search,
  Plus,
  Edit2,
  Trash2,
  Copy,
  Download,
  Upload,
  RefreshCw,
  X,
  Check,
  AlertCircle,
  FileJson,
  Layers,
  Table as TableIcon,
  LayoutGrid,
  Shield,
  Eye,
  Calendar,
  DollarSign,
  Tag,
  Clock,
  Sparkles,
} from 'lucide-react';
import { DATABASE_TABLES_REGISTRY, TableDefinition, FieldDefinition } from '../shared/databaseStudioSchema';

export interface DatabaseStudioCenterProps {
  selectedRole: string;
  sessionToken: string;
  familyId?: string;
  actorUserId?: string;
  actorMemberId?: string;
  actorDisplayName?: string;
  activeSubPage?: string;
  onSelectSubPage?: (subId: string) => void;
}

const CATEGORIES = [
  'All Databases',
  'Core Governance',
  'Money & Stewardship',
  'Household Operations',
  'Planner & Routines',
  'Goals & Projects',
  'Relationships',
  'Parenting & Growth',
  'Life Management',
  'Synchronized Entities',
] as const;

export const DatabaseStudioCenter: React.FC<DatabaseStudioCenterProps> = ({
  selectedRole,
  sessionToken,
  familyId = '',
  actorDisplayName = 'Authorized Admin',
}) => {
  const resolvedFamilyId = familyId || '';
  const [activeCategory, setActiveCategory] = useState<string>('All Databases');
  const [selectedTableId, setSelectedTableId] = useState<string>('members');
  const [tablesMeta, setTablesMeta] = useState<Array<TableDefinition & { recordCount: number }>>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'table' | 'cards' | 'json'>('table');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const [viewingRecord, setViewingRecord] = useState<any | null>(null);
  const [deleteConfirmRecord, setDeleteConfirmRecord] = useState<any | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);

  // Form Editor State
  const [formFields, setFormFields] = useState<Record<string, any>>({});
  const [rawJsonText, setRawJsonText] = useState<string>('{}');
  const [useRawJsonMode, setUseRawJsonMode] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [importJsonText, setImportJsonText] = useState<string>('[\n  {\n    "title": "Sample Record"\n  }\n]');

  const activeTable = useMemo(() => {
    return tablesMeta.find((t) => t.id === selectedTableId) || DATABASE_TABLES_REGISTRY.find((t) => t.id === selectedTableId) || DATABASE_TABLES_REGISTRY[0];
  }, [tablesMeta, selectedTableId]);

  const filteredTables = useMemo(() => {
    const list = tablesMeta.length > 0 ? tablesMeta : DATABASE_TABLES_REGISTRY.map((t) => ({ ...t, recordCount: 0 }));
    if (activeCategory === 'All Databases') return list;
    return list.filter((t) => t.category === activeCategory);
  }, [tablesMeta, activeCategory]);

  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;
    const q = searchQuery.toLowerCase();
    return records.filter((r) => JSON.stringify(r).toLowerCase().includes(q));
  }, [records, searchQuery]);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback(null);
    }, 5000);
  };

  // 1. Fetch Metadata and Counts
  const fetchMetadata = useCallback(async () => {
    if (!sessionToken || !resolvedFamilyId) return;
    try {
      const res = await fetch(`/api/v1/database/${encodeURIComponent(resolvedFamilyId)}/meta`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.tables)) {
          setTablesMeta(data.tables);
        }
      }
    } catch {
      // Fallback
    }
  }, [sessionToken, resolvedFamilyId]);

  // 2. Fetch Records for Selected Table
  const fetchTableRecords = useCallback(
    async (tableId: string) => {
      if (!sessionToken || !resolvedFamilyId) return;
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/v1/database/${encodeURIComponent(resolvedFamilyId)}/table/${encodeURIComponent(tableId)}`,
          {
            headers: { Authorization: `Bearer ${sessionToken}` },
          }
        );
        if (res.ok) {
          const data = await res.json();
          setRecords(Array.isArray(data.records) ? data.records : []);
        } else {
          showNotification('error', `Could not fetch records for ${tableId}.`);
        }
      } catch (err: any) {
        showNotification('error', err?.message || 'Failed to load records.');
      } finally {
        setIsLoading(false);
      }
    },
    [sessionToken, resolvedFamilyId]
  );

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  useEffect(() => {
    if (selectedTableId) {
      fetchTableRecords(selectedTableId);
    }
  }, [selectedTableId, fetchTableRecords]);

  // Open Add Modal
  const handleOpenAddModal = () => {
    const initial: Record<string, any> = {};
    activeTable.fields.forEach((f) => {
      initial[f.name] = f.defaultValue !== undefined ? f.defaultValue : f.type === 'boolean' ? false : f.type === 'number' ? 0 : '';
    });
    setFormFields(initial);
    setRawJsonText(JSON.stringify(initial, null, 2));
    setUseRawJsonMode(false);
    setFormError(null);
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (rec: any) => {
    setEditingRecord(rec);
    const initial: Record<string, any> = { ...rec };
    setFormFields(initial);
    setRawJsonText(JSON.stringify(initial, null, 2));
    setUseRawJsonMode(false);
    setFormError(null);
  };

  // Save Add
  const handleSaveAdd = async () => {
    setFormError(null);
    let payloadToSave: Record<string, any>;
    if (useRawJsonMode) {
      try {
        payloadToSave = JSON.parse(rawJsonText);
      } catch (err: any) {
        setFormError(`Invalid JSON format: ${err.message}`);
        return;
      }
    } else {
      payloadToSave = { ...formFields };
    }

    try {
      const res = await fetch(
        `/api/v1/database/${encodeURIComponent(resolvedFamilyId)}/table/${encodeURIComponent(activeTable.id)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({ data: payloadToSave }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setFormError(err.message || 'Failed to add record.');
        return;
      }
      const data = await res.json();
      showNotification('success', data.message || `Added record to ${activeTable.name}.`);
      setIsAddModalOpen(false);
      await fetchTableRecords(activeTable.id);
      void fetchMetadata();
    } catch (err: any) {
      setFormError(err.message || 'Network error.');
    }
  };

  // Save Edit
  const handleSaveEdit = async () => {
    if (!editingRecord) return;
    setFormError(null);
    let payloadToSave: Record<string, any>;
    if (useRawJsonMode) {
      try {
        payloadToSave = JSON.parse(rawJsonText);
      } catch (err: any) {
        setFormError(`Invalid JSON format: ${err.message}`);
        return;
      }
    } else {
      payloadToSave = { ...formFields };
    }

    try {
      const res = await fetch(
        `/api/v1/database/${encodeURIComponent(resolvedFamilyId)}/table/${encodeURIComponent(activeTable.id)}/${encodeURIComponent(editingRecord.id)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({ data: payloadToSave }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setFormError(err.message || 'Failed to update record.');
        return;
      }
      const data = await res.json();
      showNotification('success', data.message || `Updated record in ${activeTable.name}.`);
      setEditingRecord(null);
      await fetchTableRecords(activeTable.id);
      void fetchMetadata();
    } catch (err: any) {
      setFormError(err.message || 'Network error.');
    }
  };

  // Delete Record
  const handleExecuteDelete = async () => {
    if (!deleteConfirmRecord) return;
    try {
      const res = await fetch(
        `/api/v1/database/${encodeURIComponent(resolvedFamilyId)}/table/${encodeURIComponent(activeTable.id)}/${encodeURIComponent(deleteConfirmRecord.id)}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showNotification('error', err.message || 'Failed to delete record.');
        return;
      }
      showNotification('success', `Deleted record ${deleteConfirmRecord.id} from ${activeTable.name}.`);
      setDeleteConfirmRecord(null);
      await fetchTableRecords(activeTable.id);
      void fetchMetadata();
    } catch (err: any) {
      showNotification('error', err.message || 'Network error.');
    }
  };

  // Duplicate / Clone Record
  const handleDuplicateRecord = async (rec: any) => {
    const clone = { ...rec };
    delete clone.id;
    clone.title = clone.title ? `${clone.title} (Copy)` : clone.name ? `${clone.name} (Copy)` : 'Copy';
    try {
      const res = await fetch(
        `/api/v1/database/${encodeURIComponent(resolvedFamilyId)}/table/${encodeURIComponent(activeTable.id)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({ data: clone }),
        }
      );
      if (res.ok) {
        showNotification('success', `Cloned record into ${activeTable.name}.`);
        await fetchTableRecords(activeTable.id);
        void fetchMetadata();
      }
    } catch {
      showNotification('error', 'Duplicate failed.');
    }
  };

  // Export JSON
  const handleExportJson = () => {
    const jsonStr = JSON.stringify(records, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `familyos-${activeTable.id}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('success', `Exported ${records.length} records from ${activeTable.name}.`);
  };

  // Batch Import JSON
  const handleExecuteBatchImport = async () => {
    try {
      const parsed = JSON.parse(importJsonText);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const res = await fetch(
        `/api/v1/database/${encodeURIComponent(resolvedFamilyId)}/table/${encodeURIComponent(activeTable.id)}/batch-import`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({ records: arr }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showNotification('error', err.message || 'Import failed.');
        return;
      }
      const data = await res.json();
      showNotification('success', data.message || `Imported records into ${activeTable.name}.`);
      setIsImportModalOpen(false);
      await fetchTableRecords(activeTable.id);
      void fetchMetadata();
    } catch (err: any) {
      showNotification('error', `Invalid JSON: ${err.message}`);
    }
  };

  // Synchronize form fields to JSON text when switching modes
  const handleToggleRawMode = () => {
    if (!useRawJsonMode) {
      setRawJsonText(JSON.stringify(formFields, null, 2));
      setUseRawJsonMode(true);
    } else {
      try {
        const parsed = JSON.parse(rawJsonText);
        setFormFields(parsed);
        setUseRawJsonMode(false);
        setFormError(null);
      } catch (err: any) {
        setFormError(`Cannot switch to fields view. Invalid JSON: ${err.message}`);
      }
    }
  };

  const totalAllRecords = useMemo(() => {
    return tablesMeta.reduce((acc, t) => acc + (t.recordCount || 0), 0);
  }, [tablesMeta]);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-semibold shadow-xs ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : 'bg-rose-50 border-rose-200 text-rose-950'
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedback.type === 'success' ? <Check className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 hover:bg-black/5 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Hero Header */}
      <div className="rounded-3xl p-6 sm:p-8 bg-[#173D35] text-white shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-[#C39A60]/20 border border-[#C39A60]/50 flex items-center justify-center shrink-0">
              <Database className="w-7 h-7 text-[#E5C388]" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs text-[#E5C388] font-mono uppercase tracking-wider">
                <span>Database Studio & Management Center</span>
                <span>•</span>
                <span>Role: {selectedRole}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-white mt-1">
                Full Database Access & Field Editor
              </h1>
              <p className="text-xs sm:text-sm text-emerald-100/80 max-w-2xl mt-1">
                Add, inspect, full-edit, and delete records across all 30+ FamilyOS databases with live Cloud Firestore synchronization and optimistic locking.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void fetchMetadata();
                void fetchTableRecords(activeTable.id);
                showNotification('success', 'Database synced with latest records.');
              }}
              className="py-2 px-3.5 rounded-xl font-bold bg-white/10 hover:bg-white/20 text-white border border-white/15 text-xs flex items-center space-x-2 transition-all cursor-pointer"
              title="Refresh tables and records"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sync</span>
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              className="py-2 px-3.5 rounded-xl font-bold bg-[#C39A60] hover:bg-[#d4ab71] text-[#173D35] text-xs flex items-center space-x-2 transition-all cursor-pointer shadow-xs"
              title="Export currently selected table as JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Table</span>
            </button>
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="py-2 px-3.5 rounded-xl font-bold bg-white/15 hover:bg-white/25 text-white border border-white/20 text-xs flex items-center space-x-2 transition-all cursor-pointer"
              title="Batch import JSON records into selected table"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import JSON</span>
            </button>
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="py-2 px-4 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white text-xs flex items-center space-x-2 transition-all cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add Record</span>
            </button>
          </div>
        </div>

        {/* Standalone Database Studio Notice */}
        <div className="pt-3 border-t border-white/15 flex items-start space-x-3 text-xs text-emerald-100/90">
          <Sparkles className="w-4 h-4 text-[#E5C388] shrink-0 mt-0.5" />
          <p>
            <strong className="text-white">Standalone Developer & Admin Database Console:</strong> Everyday records and forms (Finances, Budgets, Meals, Chores, Calendar Events, Goals, Relationships, and Admin Settings) are directly accessible and managed in their respective dedicated system pages in the sidebar. This Database Studio exists solely as a standalone advanced database console for direct table inspection, batch import/export, and raw record management.
          </p>
        </div>

        {/* Database Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-white/10">
          <div className="bg-black/20 rounded-2xl p-3 border border-white/10">
            <p className="text-[10px] text-emerald-200/70 font-semibold uppercase">Total Tables</p>
            <p className="text-xl font-bold font-serif text-white">{DATABASE_TABLES_REGISTRY.length} Tables</p>
          </div>
          <div className="bg-black/20 rounded-2xl p-3 border border-white/10">
            <p className="text-[10px] text-emerald-200/70 font-semibold uppercase">Total Stored Records</p>
            <p className="text-xl font-bold font-serif text-[#E5C388]">{totalAllRecords} Records</p>
          </div>
          <div className="bg-black/20 rounded-2xl p-3 border border-white/10">
            <p className="text-[10px] text-emerald-200/70 font-semibold uppercase">Active Table</p>
            <p className="text-sm font-bold text-white truncate">{activeTable.name}</p>
            <p className="text-[10px] text-emerald-200/60 font-mono">{records.length} records</p>
          </div>
          <div className="bg-black/20 rounded-2xl p-3 border border-white/10">
            <p className="text-[10px] text-emerald-200/70 font-semibold uppercase">Storage Engine</p>
            <div className="flex items-center space-x-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold text-white">JSON + Firestore Mirror</span>
            </div>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
              activeCategory === cat
                ? 'bg-[#173D35] text-white shadow-xs'
                : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Tables Selection Grid / Carousel */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
        {filteredTables.map((t) => {
          const isSelected = t.id === selectedTableId;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedTableId(t.id)}
              className={`p-3 rounded-2xl text-left border transition-all cursor-pointer relative overflow-hidden ${
                isSelected
                  ? 'bg-emerald-50 border-emerald-800 ring-2 ring-emerald-800/20 shadow-xs'
                  : 'bg-white border-stone-200 hover:border-emerald-700/50 hover:bg-stone-50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-stone-400 truncate">
                  {t.category.split(' ')[0]}
                </span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    isSelected ? 'bg-emerald-800 text-white' : 'bg-stone-100 text-stone-700'
                  }`}
                >
                  {t.recordCount ?? 0}
                </span>
              </div>
              <p className={`text-xs font-bold truncate ${isSelected ? 'text-emerald-950 font-serif' : 'text-stone-800'}`}>
                {t.name}
              </p>
              <p className="text-[10px] text-stone-500 font-mono truncate mt-0.5">{t.id}</p>
            </button>
          );
        })}
      </div>

      {/* Main Records Studio Card */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-xs overflow-hidden">
        {/* Table Header Bar */}
        <div className="p-4 sm:p-5 border-b border-stone-100 bg-stone-50/60 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-serif font-bold text-stone-900">{activeTable.name}</h2>
              <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-stone-200 text-stone-700">
                table: {activeTable.id}
              </span>
              <span className="text-xs text-stone-500">({filteredRecords.length} records)</span>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">{activeTable.description}</p>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            {/* Search Box */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={`Search ${activeTable.name}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-800/20"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center p-0.5 bg-stone-200/70 rounded-xl border border-stone-300/60">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs cursor-pointer ${
                  viewMode === 'table' ? 'bg-white text-stone-900 font-bold shadow-2xs' : 'text-stone-600 hover:text-stone-900'
                }`}
                title="Table View"
              >
                <TableIcon className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-lg text-xs cursor-pointer ${
                  viewMode === 'cards' ? 'bg-white text-stone-900 font-bold shadow-2xs' : 'text-stone-600 hover:text-stone-900'
                }`}
                title="Cards View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('json')}
                className={`p-1.5 rounded-lg text-xs cursor-pointer ${
                  viewMode === 'json' ? 'bg-white text-stone-900 font-bold shadow-2xs' : 'text-stone-600 hover:text-stone-900'
                }`}
                title="Raw JSON View"
              >
                <FileJson className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="p-12 text-center text-stone-400 flex flex-col items-center justify-center space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-800" />
            <p className="text-xs font-semibold">Loading records from authoritative database...</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredRecords.length === 0 && (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto text-stone-400">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-stone-800">No records found</p>
              <p className="text-xs text-stone-500 max-w-sm mx-auto mt-0.5">
                {searchQuery
                  ? `No entries match "${searchQuery}". Clear your search query.`
                  : `Table "${activeTable.name}" has no records yet. Click "Add Record" to create the first record.`}
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="py-2 px-4 rounded-xl font-bold bg-[#173D35] hover:bg-emerald-950 text-white text-xs cursor-pointer"
            >
              ➕ Add First Record
            </button>
          </div>
        )}

        {/* TABLE VIEW */}
        {!isLoading && filteredRecords.length > 0 && viewMode === 'table' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-stone-600 font-semibold">
                  <th className="py-2.5 px-4 font-mono text-[11px]">ID</th>
                  {activeTable.fields.slice(0, 5).map((f) => (
                    <th key={f.name} className="py-2.5 px-4 font-serif text-stone-800">
                      {f.label}
                    </th>
                  ))}
                  <th className="py-2.5 px-4 font-mono text-[11px]">Version</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-sans">
                {filteredRecords.map((rec) => {
                  return (
                    <tr key={rec.id} className="hover:bg-emerald-50/40 transition-colors group">
                      <td className="py-3 px-4 font-mono text-stone-700 font-bold max-w-[130px] truncate" title={rec.id}>
                        {rec.id}
                      </td>
                      {activeTable.fields.slice(0, 5).map((f) => {
                        const val = rec[f.name];
                        let rendered: React.ReactNode = String(val ?? '—');
                        if (typeof val === 'boolean') {
                          rendered = (
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                val ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-600'
                              }`}
                            >
                              {val ? 'Yes' : 'No'}
                            </span>
                          );
                        } else if (f.type === 'number' && f.name.toLowerCase().includes('cents')) {
                          rendered = (
                            <span className="font-mono font-semibold text-emerald-900">
                              ${((val || 0) / 100).toFixed(2)}
                            </span>
                          );
                        } else if (typeof val === 'object' && val !== null) {
                          rendered = (
                            <span className="font-mono text-[10px] text-stone-500 truncate max-w-[120px] inline-block">
                              {JSON.stringify(val)}
                            </span>
                          );
                        }
                        return (
                          <td key={f.name} className="py-3 px-4 text-stone-800 max-w-[180px] truncate">
                            {rendered}
                          </td>
                        );
                      })}
                      <td className="py-3 px-4 font-mono text-[11px] text-stone-500">
                        v{rec.version || 1}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setViewingRecord(rec)}
                          className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 cursor-pointer"
                          title="Inspect Record Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(rec)}
                          className="p-1.5 rounded-lg text-emerald-800 hover:text-emerald-950 hover:bg-emerald-100/60 cursor-pointer"
                          title="Full Edit Record"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicateRecord(rec)}
                          className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 cursor-pointer"
                          title="Duplicate / Clone Record"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmRecord(rec)}
                          className="p-1.5 rounded-lg text-rose-600 hover:text-rose-800 hover:bg-rose-50 cursor-pointer"
                          title="Delete Record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* CARDS VIEW */}
        {!isLoading && filteredRecords.length > 0 && viewMode === 'cards' && (
          <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRecords.map((rec) => (
              <div
                key={rec.id}
                className="bg-white rounded-2xl p-4 border border-stone-200 hover:border-emerald-700/60 transition-all shadow-2xs space-y-3 relative group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold bg-stone-100 px-2 py-0.5 rounded text-stone-700 truncate max-w-[150px]">
                    {rec.id}
                  </span>
                  <span className="text-[10px] font-mono text-stone-400">v{rec.version || 1}</span>
                </div>

                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-stone-900 font-serif line-clamp-1">
                    {rec.title || rec.name || rec.displayName || rec.mealName || rec.destination || rec.symbol || 'Untitled Record'}
                  </h3>
                  {rec.description && <p className="text-xs text-stone-500 line-clamp-2">{rec.description}</p>}
                </div>

                <div className="space-y-1 pt-2 border-t border-stone-100 text-[11px] text-stone-600">
                  {activeTable.fields.slice(0, 3).map((f) => (
                    <div key={f.name} className="flex justify-between items-center">
                      <span className="text-stone-400">{f.label}:</span>
                      <span className="font-semibold text-stone-800 truncate max-w-[140px]">
                        {typeof rec[f.name] === 'boolean'
                          ? rec[f.name] ? 'Yes' : 'No'
                          : String(rec[f.name] ?? '—')}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setViewingRecord(rec)}
                    className="text-[11px] font-bold text-stone-600 hover:text-stone-900 cursor-pointer flex items-center space-x-1"
                  >
                    <Eye className="w-3 h-3" />
                    <span>View Details</span>
                  </button>

                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(rec)}
                      className="p-1.5 rounded-lg text-emerald-800 hover:bg-emerald-50 cursor-pointer"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicateRecord(rec)}
                      className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-50 cursor-pointer"
                      title="Duplicate"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmRecord(rec)}
                      className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* RAW JSON VIEW */}
        {!isLoading && filteredRecords.length > 0 && viewMode === 'json' && (
          <div className="p-4 bg-stone-900 text-emerald-400 font-mono text-xs overflow-x-auto max-h-[500px] rounded-b-3xl">
            <pre>{JSON.stringify(filteredRecords, null, 2)}</pre>
          </div>
        )}
      </div>

      {/* MODAL: ADD RECORD */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 border border-stone-200 shadow-2xl max-h-[90vh] flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-900 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-serif font-bold text-stone-900">
                    Add New Record: {activeTable.name}
                  </h3>
                  <p className="text-[11px] text-stone-500">Database table: {activeTable.id}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleToggleRawMode}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 cursor-pointer"
                >
                  {useRawJsonMode ? 'Form Builder Mode' : 'Raw JSON Mode'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-stone-100 text-stone-400 hover:text-stone-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 font-semibold">
                {formError}
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {!useRawJsonMode ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {activeTable.fields.map((f) => (
                    <div key={f.name} className="space-y-1">
                      <label className="text-xs font-bold text-stone-700 block">
                        {f.label} {f.required && <span className="text-rose-600">*</span>}
                      </label>

                      {f.type === 'select' ? (
                        <select
                          value={formFields[f.name] ?? f.defaultValue ?? ''}
                          onChange={(e) => setFormFields({ ...formFields, [f.name]: e.target.value })}
                          className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-800/20"
                        >
                          {(f.options || []).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : f.type === 'boolean' ? (
                        <div className="flex items-center space-x-2 pt-1">
                          <input
                            type="checkbox"
                            id={`add-${f.name}`}
                            checked={Boolean(formFields[f.name])}
                            onChange={(e) => setFormFields({ ...formFields, [f.name]: e.target.checked })}
                            className="w-4 h-4 rounded text-emerald-800 focus:ring-emerald-800"
                          />
                          <label htmlFor={`add-${f.name}`} className="text-xs text-stone-700 cursor-pointer">
                            Enabled / Active
                          </label>
                        </div>
                      ) : f.type === 'number' ? (
                        <input
                          type="number"
                          value={formFields[f.name] ?? ''}
                          onChange={(e) => setFormFields({ ...formFields, [f.name]: Number(e.target.value) })}
                          className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-800/20"
                        />
                      ) : f.type === 'date' ? (
                        <input
                          type="date"
                          value={formFields[f.name] ?? ''}
                          onChange={(e) => setFormFields({ ...formFields, [f.name]: e.target.value })}
                          className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-800/20"
                        />
                      ) : (
                        <input
                          type="text"
                          value={formFields[f.name] ?? ''}
                          onChange={(e) => setFormFields({ ...formFields, [f.name]: e.target.value })}
                          className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-800/20"
                        />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-700 block">
                    Full JSON Payload Specification
                  </label>
                  <textarea
                    rows={12}
                    value={rawJsonText}
                    onChange={(e) => setRawJsonText(e.target.value)}
                    className="w-full p-3 font-mono text-xs bg-stone-900 text-emerald-400 rounded-xl focus:ring-2 focus:ring-emerald-800"
                  />
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-stone-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAdd}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-[#173D35] hover:bg-emerald-950 text-white shadow-xs cursor-pointer"
              >
                Save Record to Database
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: FULL EDIT RECORD */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 border border-stone-200 shadow-2xl max-h-[90vh] flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-serif font-bold text-stone-900">
                    Full Edit Record: {editingRecord.id}
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    Table: {activeTable.name} • Current Version: v{editingRecord.version || 1}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleToggleRawMode}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 cursor-pointer"
                >
                  {useRawJsonMode ? 'Form Builder Mode' : 'Raw JSON Mode'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="p-1.5 rounded-xl hover:bg-stone-100 text-stone-400 hover:text-stone-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 font-semibold">
                {formError}
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {!useRawJsonMode ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1 sm:col-span-2 bg-stone-50 p-2.5 rounded-xl border border-stone-200 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-stone-700">Record ID:</span>{' '}
                      <span className="font-mono text-stone-900 font-bold">{editingRecord.id}</span>
                    </div>
                    <div className="text-stone-500 text-[11px]">
                      Updated: {editingRecord.updatedAt ? new Date(editingRecord.updatedAt).toLocaleTimeString() : 'Recently'}
                    </div>
                  </div>

                  {activeTable.fields.map((f) => (
                    <div key={f.name} className="space-y-1">
                      <label className="text-xs font-bold text-stone-700 block">{f.label}</label>

                      {f.type === 'select' ? (
                        <select
                          value={formFields[f.name] ?? ''}
                          onChange={(e) => setFormFields({ ...formFields, [f.name]: e.target.value })}
                          className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-800/20"
                        >
                          {(f.options || []).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : f.type === 'boolean' ? (
                        <div className="flex items-center space-x-2 pt-1">
                          <input
                            type="checkbox"
                            id={`edit-${f.name}`}
                            checked={Boolean(formFields[f.name])}
                            onChange={(e) => setFormFields({ ...formFields, [f.name]: e.target.checked })}
                            className="w-4 h-4 rounded text-emerald-800 focus:ring-emerald-800"
                          />
                          <label htmlFor={`edit-${f.name}`} className="text-xs text-stone-700 cursor-pointer">
                            Active / True
                          </label>
                        </div>
                      ) : f.type === 'number' ? (
                        <input
                          type="number"
                          value={formFields[f.name] ?? ''}
                          onChange={(e) => setFormFields({ ...formFields, [f.name]: Number(e.target.value) })}
                          className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-800/20"
                        />
                      ) : f.type === 'date' ? (
                        <input
                          type="date"
                          value={formFields[f.name] ?? ''}
                          onChange={(e) => setFormFields({ ...formFields, [f.name]: e.target.value })}
                          className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-800/20"
                        />
                      ) : (
                        <input
                          type="text"
                          value={formFields[f.name] ?? ''}
                          onChange={(e) => setFormFields({ ...formFields, [f.name]: e.target.value })}
                          className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-800/20"
                        />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-700 block">
                    Full JSON Payload Editor
                  </label>
                  <textarea
                    rows={12}
                    value={rawJsonText}
                    onChange={(e) => setRawJsonText(e.target.value)}
                    className="w-full p-3 font-mono text-xs bg-stone-900 text-emerald-400 rounded-xl focus:ring-2 focus:ring-emerald-800"
                  />
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-stone-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-[#173D35] hover:bg-emerald-950 text-white shadow-xs cursor-pointer"
              >
                Save Changes to Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: INSPECT RECORD DETAILS */}
      {viewingRecord && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 border border-stone-200 shadow-2xl max-h-[90vh] flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-stone-100 text-stone-800 flex items-center justify-center">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-serif font-bold text-stone-900">Record Inspection</h3>
                  <p className="text-[11px] font-mono text-stone-500">{viewingRecord.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingRecord(null)}
                className="p-1.5 rounded-xl hover:bg-stone-100 text-stone-400 hover:text-stone-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 space-y-2">
                <p className="font-bold text-stone-700 uppercase tracking-wider text-[10px]">Formatted Properties</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(viewingRecord).map(([key, val]) => (
                    <div key={key} className="p-2 bg-white rounded-lg border border-stone-100">
                      <span className="font-mono text-[10px] text-stone-400 block">{key}</span>
                      <span className="font-semibold text-stone-800 truncate block">
                        {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <p className="font-bold text-stone-700 uppercase tracking-wider text-[10px]">Raw JSON Document</p>
                <pre className="p-3 bg-stone-900 text-emerald-400 font-mono text-[11px] rounded-xl overflow-x-auto max-h-56">
                  {JSON.stringify(viewingRecord, null, 2)}
                </pre>
              </div>
            </div>

            <div className="pt-3 border-t border-stone-200 flex justify-between items-center">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(viewingRecord, null, 2));
                  showNotification('success', 'Copied raw JSON to clipboard.');
                }}
                className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-semibold text-stone-700 hover:bg-stone-50 flex items-center space-x-1 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy JSON</span>
              </button>

              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    const rec = viewingRecord;
                    setViewingRecord(null);
                    handleOpenEditModal(rec);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#173D35] text-white hover:bg-emerald-950 cursor-pointer"
                >
                  Edit Record
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DELETE CONFIRMATION */}
      {deleteConfirmRecord && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-stone-200 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-serif font-bold text-stone-900">Delete Record Permanently?</h3>
              <p className="text-xs text-stone-500">
                Are you sure you want to delete record <span className="font-mono font-bold text-stone-800">{deleteConfirmRecord.id}</span> from {activeTable.name}?
              </p>
            </div>

            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-700 space-y-1">
              <p className="font-bold">Record Summary:</p>
              <p className="truncate text-stone-600 font-mono">
                {JSON.stringify(deleteConfirmRecord).slice(0, 120)}...
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmRecord(null)}
                className="w-full py-2.5 rounded-xl border border-stone-200 text-xs font-bold text-stone-700 hover:bg-stone-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BATCH IMPORT JSON */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 border border-stone-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-[#C39A60]/20 text-[#173D35] flex items-center justify-center">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-serif font-bold text-stone-900">
                    Import JSON into {activeTable.name}
                  </h3>
                  <p className="text-[11px] text-stone-500">Upload or paste an array of records</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-stone-100 text-stone-400 hover:text-stone-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-700 block">
                JSON Array of Records:
              </label>
              <textarea
                rows={10}
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
                className="w-full p-3 font-mono text-xs bg-stone-900 text-emerald-400 rounded-xl focus:ring-2 focus:ring-emerald-800"
              />
              <p className="text-[11px] text-stone-500">
                Records will be validated and inserted or updated by ID into {activeTable.name}.
              </p>
            </div>

            <div className="pt-3 border-t border-stone-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteBatchImport}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-[#173D35] hover:bg-emerald-950 text-white shadow-xs cursor-pointer"
              >
                Execute Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
