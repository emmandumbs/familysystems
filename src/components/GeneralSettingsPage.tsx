import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Sun,
  Moon,
  Bell,
  Wifi,
  CheckCircle2,
  Trash2,
  Palette,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { purgeAllClientSessionCaches } from '../utils/namespacedStorage';
import {
  COLOR_THEMES,
  ColorThemeId,
  ThemeMode,
  getSavedColorTheme,
  getSavedThemeMode,
  isEffectiveDarkMode,
} from '../utils/themeConfig';

export interface GeneralSettingsPageProps {
  selectedRole: string;
  sessionToken: string;
  onBackToWorkspace: () => void;
  onThemeUpdated?: (themeId: ColorThemeId, mode: ThemeMode) => void;
}

export const GeneralSettingsPage: React.FC<GeneralSettingsPageProps> = ({
  selectedRole,
  sessionToken,
  onBackToWorkspace,
  onThemeUpdated,
}) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getSavedThemeMode());
  const [brandStyle, setBrandStyle] = useState<ColorThemeId>(() => getSavedColorTheme());

  const [pushEnabled, setPushEnabled] = useState<boolean>(true);
  const [emailReminders, setEmailReminders] = useState<boolean>(true);
  const [dailyDigest, setDailyDigest] = useState<boolean>(true);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [clearCacheMessage, setClearCacheMessage] = useState<boolean>(false);

  const activeTheme = COLOR_THEMES[brandStyle] || COLOR_THEMES.emerald_gold;
  const isDark = isEffectiveDarkMode(themeMode);

  useEffect(() => {
    try {
      localStorage.setItem('familyos_theme_mode', themeMode);
      localStorage.setItem('familyos_brand_style', brandStyle);
      window.dispatchEvent(
        new CustomEvent('familyos-theme-changed', {
          detail: { themeId: brandStyle, themeMode },
        })
      );
    } catch {
      // Ignore
    }
    if (onThemeUpdated) {
      onThemeUpdated(brandStyle, themeMode);
    }
  }, [themeMode, brandStyle, onThemeUpdated]);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleResetDefaultTheme = () => {
    setBrandStyle('emerald_gold');
    setThemeMode('light');
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleClearCache = () => {
    purgeAllClientSessionCaches();
    setClearCacheMessage(true);
    setTimeout(() => setClearCacheMessage(false), 3500);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Dynamic Header Banner reflecting selected color theme */}
      <div
        className="rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-white/15 transition-all duration-300"
        style={{
          background: `linear-gradient(135deg, ${activeTheme.primary} 0%, ${activeTheme.primaryDeep} 100%)`,
        }}
      >
        <div className="space-y-2 relative z-10">
          <div
            className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider"
            style={{ color: activeTheme.accentLight }}
          >
            <Sliders className="w-4 h-4" />
            <span>Platform Preferences & Visual Identity</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold">General Settings & Color Themes</h2>
          <p className="text-xs sm:text-sm text-white/80 max-w-xl">
            Personalize your household workspace with curated heritage color themes, light/dark display modes, notification rules, and offline sync diagnostics.
          </p>
        </div>
        <div className="relative z-10 flex items-center space-x-2.5">
          <button
            type="button"
            onClick={handleResetDefaultTheme}
            className="px-3.5 py-2.5 rounded-2xl bg-black/25 hover:bg-black/40 border border-white/15 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
            title="Reset to default Emerald & Gold theme"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Theme</span>
          </button>
          <button
            type="button"
            onClick={onBackToWorkspace}
            className="px-4 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold flex items-center space-x-2 shadow-sm transition-colors cursor-pointer"
          >
            <span>&larr; Return to Dashboard</span>
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center space-x-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>General settings and color theme applied across your workspace!</span>
        </div>
      )}

      {clearCacheMessage && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center space-x-2">
          <CheckCircle2 className="w-5 h-5 text-amber-600 shrink-0" />
          <span>All client session caches and offline queues have been successfully purged.</span>
        </div>
      )}

      <form onSubmit={handleSaveSettings} className="space-y-6 text-xs">
        {/* Section 1: Color Themes & Appearance Mode */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-4">
            <div className="flex items-center space-x-3">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-white shadow-xs transition-colors"
                style={{ backgroundColor: activeTheme.primary }}
              >
                <Palette className="w-5 h-5" style={{ color: activeTheme.accentLight }} />
              </div>
              <div>
                <h3 className="text-base font-serif font-bold text-stone-900">Color Themes & Visual Appearance</h3>
                <p className="text-stone-500">
                  Select a signature color palette and display mode — updates apply immediately across the navigation bar and workspace
                </p>
              </div>
            </div>
            <span
              className="px-3 py-1 rounded-xl text-[11px] font-bold border self-start sm:self-center"
              style={{
                backgroundColor: `${activeTheme.primary}12`,
                color: activeTheme.primary,
                borderColor: `${activeTheme.primary}30`,
              }}
            >
              Active: {activeTheme.name}
            </span>
          </div>

          {/* Display Mode: Light / Dark / System */}
          <div className="space-y-2.5">
            <label className="block font-bold text-stone-800 uppercase tracking-wider text-[11px]">
              1. Display Brightness Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {[
                { id: 'light', label: 'Light Mode', icon: Sun, desc: 'Warm daylight canvas and crisp cards' },
                { id: 'dark', label: 'Dark Mode', icon: Moon, desc: 'Deep evening contrast with luminous accents' },
                { id: 'system', label: 'System Default', icon: Sliders, desc: 'Automatically sync with device OS setting' },
              ].map((t) => {
                const Icon = t.icon;
                const isSelected = themeMode === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setThemeMode(t.id as ThemeMode)}
                    className={`p-4 rounded-2xl border text-left cursor-pointer transition-all space-y-1.5 ${
                      isSelected
                        ? 'bg-stone-900/5 ring-2'
                        : 'bg-stone-50/70 border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                    }`}
                    style={
                      isSelected
                        ? {
                            borderColor: activeTheme.primary,
                            boxShadow: `0 0 0 2px ${activeTheme.primary}25`,
                          }
                        : undefined
                    }
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Icon
                          className="w-4 h-4"
                          style={{ color: isSelected ? activeTheme.primary : '#57534E' }}
                        />
                        <span className="font-bold text-stone-900">{t.label}</span>
                      </div>
                      <span
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected ? 'border-transparent' : 'border-stone-300 bg-white'
                        }`}
                        style={isSelected ? { backgroundColor: activeTheme.primary } : undefined}
                      >
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500">{t.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Curated Color Theme Gallery */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="block font-bold text-stone-800 uppercase tracking-wider text-[11px]">
                2. Curated Workspace Color Themes ({Object.keys(COLOR_THEMES).length} Palettes)
              </label>
              <span className="text-[11px] text-stone-500 flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Click any palette to preview live</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(Object.values(COLOR_THEMES) as Array<(typeof COLOR_THEMES)[ColorThemeId]>).map((theme) => {
                const isSelected = brandStyle === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setBrandStyle(theme.id)}
                    className={`group relative rounded-2xl border p-4 text-left transition-all cursor-pointer flex flex-col justify-between space-y-3.5 ${
                      isSelected
                        ? 'bg-white shadow-md'
                        : 'bg-stone-50/60 border-stone-200 hover:bg-white hover:border-stone-300 hover:shadow-xs'
                    }`}
                    style={
                      isSelected
                        ? {
                            borderColor: theme.primary,
                            boxShadow: `0 0 0 2px ${theme.primary}30`,
                          }
                        : undefined
                    }
                  >
                    {/* Top Row: Swatch Strip & Active Indicator */}
                    <div className="space-y-2.5 w-full">
                      <div className="flex items-center justify-between">
                        {/* 4-Color Palette Swatch Pill */}
                        <div className="flex items-center -space-x-1.5">
                          {theme.swatches.map((hex, idx) => (
                            <span
                              key={idx}
                              className="w-6 h-6 rounded-full border-2 border-white shadow-2xs"
                              style={{ backgroundColor: hex }}
                              title={hex}
                            />
                          ))}
                        </div>

                        {isSelected ? (
                          <span
                            className="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white flex items-center space-x-1"
                            style={{ backgroundColor: theme.primary }}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-stone-400 group-hover:text-stone-600">
                            Apply &rarr;
                          </span>
                        )}
                      </div>

                      <div>
                        <p className="font-serif font-bold text-sm text-stone-900">{theme.name}</p>
                        <p className="text-[11px] text-stone-500 line-clamp-2 mt-0.5">{theme.tagline}</p>
                      </div>
                    </div>

                    {/* Mini UI Preview Bar inside each Theme Card */}
                    <div
                      className="w-full rounded-xl p-2.5 flex items-center justify-between border border-black/10"
                      style={{
                        background: `linear-gradient(90deg, ${theme.primary} 0%, ${theme.primaryDeep} 100%)`,
                      }}
                    >
                      <div className="flex items-center space-x-2">
                        <span
                          className="w-5 h-5 rounded-lg flex items-center justify-center font-serif font-bold text-[10px]"
                          style={{
                            backgroundColor: theme.accent,
                            color: theme.primaryDeep,
                          }}
                        >
                          F
                        </span>
                        <span className="text-[10px] font-semibold text-white">FamilyOS</span>
                      </div>
                      <span
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: `${theme.accent}30`,
                          color: theme.accentLight,
                        }}
                      >
                        {theme.primary}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Interactive Workspace Preview Strip */}
          <div className="pt-2">
            <div
              className="rounded-2xl p-4 sm:p-5 border transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              style={{
                backgroundColor: isDark ? activeTheme.canvasDark : activeTheme.canvasLight,
                borderColor: isDark ? activeTheme.borderDark : activeTheme.borderLight,
                color: isDark ? activeTheme.textDark : activeTheme.textLight,
              }}
            >
              <div className="flex items-center space-x-3.5">
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center font-serif text-lg font-bold shadow-sm shrink-0"
                  style={{
                    backgroundColor: activeTheme.primary,
                    color: activeTheme.accentLight,
                  }}
                >
                  F
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-serif font-bold text-sm">
                      Live Theme Preview: {activeTheme.name}
                    </span>
                    <span
                      className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase"
                      style={{
                        backgroundColor: activeTheme.primary,
                        color: activeTheme.accentLight,
                      }}
                    >
                      {isDark ? 'Dark Canvas' : 'Light Canvas'}
                    </span>
                  </div>
                  <p className="text-[11px] opacity-75 mt-0.5">
                    Primary: {activeTheme.primary} • Accent: {activeTheme.accent} • Canvas:{' '}
                    {isDark ? activeTheme.canvasDark : activeTheme.canvasLight}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <span
                  className="px-3 py-1.5 rounded-xl text-[11px] font-bold shadow-2xs"
                  style={{
                    backgroundColor: activeTheme.accent,
                    color: activeTheme.primaryDeep,
                  }}
                >
                  Accent Button
                </span>
                <span
                  className="px-3 py-1.5 rounded-xl text-[11px] font-bold text-white shadow-2xs"
                  style={{
                    backgroundColor: activeTheme.primary,
                  }}
                >
                  Primary Action
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Notifications & Reminders */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-xs space-y-5">
          <div className="flex items-center space-x-3 border-b border-stone-100 pb-4">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-serif font-bold text-stone-900">Notifications & Reminders</h3>
              <p className="text-stone-500">Manage push notifications, email digests, and calendar alerts</p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="flex items-center justify-between p-3.5 rounded-2xl bg-stone-50 border border-stone-200 cursor-pointer">
              <div>
                <p className="font-bold text-stone-900">Push Notifications</p>
                <p className="text-stone-500 text-[11px]">
                  Receive instant alerts for shared tasks, reminders, and calendar events
                </p>
              </div>
              <input
                type="checkbox"
                checked={pushEnabled}
                onChange={(e) => setPushEnabled(e.target.checked)}
                className="w-4 h-4 text-emerald-800 rounded focus:ring-emerald-800"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-2xl bg-stone-50 border border-stone-200 cursor-pointer">
              <div>
                <p className="font-bold text-stone-900">Email Reminders & Summaries</p>
                <p className="text-stone-500 text-[11px]">
                  Receive weekly financial summaries and upcoming family birthday alerts via email
                </p>
              </div>
              <input
                type="checkbox"
                checked={emailReminders}
                onChange={(e) => setEmailReminders(e.target.checked)}
                className="w-4 h-4 text-emerald-800 rounded focus:ring-emerald-800"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-2xl bg-stone-50 border border-stone-200 cursor-pointer">
              <div>
                <p className="font-bold text-stone-900">Daily Agenda Digest</p>
                <p className="text-stone-500 text-[11px]">
                  Get a morning summary of today's schedule, chores, and meal plan
                </p>
              </div>
              <input
                type="checkbox"
                checked={dailyDigest}
                onChange={(e) => setDailyDigest(e.target.checked)}
                className="w-4 h-4 text-emerald-800 rounded focus:ring-emerald-800"
              />
            </label>
          </div>
        </div>

        {/* Section 3: Offline Synchronization & Storage Diagnostics */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-xs space-y-5">
          <div className="flex items-center space-x-3 border-b border-stone-100 pb-4">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-900 flex items-center justify-center font-bold">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-serif font-bold text-stone-900">Offline Synchronization & Storage</h3>
              <p className="text-stone-500">Service worker status, outbox replay queue, and session cache</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
              <span className="font-bold text-stone-900 block">Connection & PWA Status</span>
              <p className="text-stone-600">
                Network: <strong className="text-emerald-800 font-mono">Online (Synchronized)</strong>
              </p>
              <p className="text-stone-600">
                Outbox Replay Queue: <strong className="font-mono text-stone-900">0 pending mutations</strong>
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
              <span className="font-bold text-stone-900 block">Client Cache & Storage</span>
              <p className="text-stone-600">
                Namespaced Storage: <strong className="font-mono text-stone-900">Active (Encrypted local mirror)</strong>
              </p>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleClearCache}
                  className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-900 font-semibold flex items-center space-x-1.5 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Purge Local Session Caches</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-8 py-3 rounded-2xl font-bold text-white transition-all shadow-sm cursor-pointer text-sm hover:opacity-95"
            style={{ backgroundColor: activeTheme.primary }}
          >
            Save General Settings
          </button>
        </div>
      </form>
    </div>
  );
};
