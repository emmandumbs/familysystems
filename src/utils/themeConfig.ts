export type ThemeMode = 'light' | 'dark' | 'system';

export type ColorThemeId =
  | 'emerald_gold'
  | 'royal_navy'
  | 'burgundy_rose'
  | 'minimal_sage'
  | 'midnight_slate'
  | 'terracotta_amber';

export interface ColorThemeDefinition {
  id: ColorThemeId;
  name: string;
  tagline: string;
  primary: string;
  primaryDark: string;
  primaryDeep: string;
  accent: string;
  accentLight: string;
  canvasLight: string;
  canvasDark: string;
  cardLight: string;
  cardDark: string;
  textLight: string;
  textDark: string;
  borderLight: string;
  borderDark: string;
  swatches: [string, string, string, string];
}

export const COLOR_THEMES: Record<ColorThemeId, ColorThemeDefinition> = {
  emerald_gold: {
    id: 'emerald_gold',
    name: 'Emerald Forest & Gold',
    tagline: 'Signature heritage estate green with warm polished gold accents',
    primary: '#173D35',
    primaryDark: '#12332C',
    primaryDeep: '#0E2822',
    accent: '#C39A60',
    accentLight: '#E5C388',
    canvasLight: '#F7F4EC',
    canvasDark: '#0D1B18',
    cardLight: '#FFFFFF',
    cardDark: '#142923',
    textLight: '#11231E',
    textDark: '#F0F7F4',
    borderLight: '#E2DCD0',
    borderDark: '#234239',
    swatches: ['#173D35', '#0E2822', '#C39A60', '#F7F4EC'],
  },
  royal_navy: {
    id: 'royal_navy',
    name: 'Royal Navy & Champagne',
    tagline: 'Maritime executive blue paired with crisp champagne gold',
    primary: '#13294B',
    primaryDark: '#0E1F38',
    primaryDeep: '#091526',
    accent: '#D4AF37',
    accentLight: '#F3E5AB',
    canvasLight: '#F4F6F9',
    canvasDark: '#0B1320',
    cardLight: '#FFFFFF',
    cardDark: '#132036',
    textLight: '#0F1E36',
    textDark: '#EDF2F7',
    borderLight: '#DAE2EC',
    borderDark: '#233654',
    swatches: ['#13294B', '#091526', '#D4AF37', '#F4F6F9'],
  },
  burgundy_rose: {
    id: 'burgundy_rose',
    name: 'Burgundy Heritage & Rose Gold',
    tagline: 'Rich manor house crimson with brushed rose gold highlights',
    primary: '#4A1525',
    primaryDark: '#380F1C',
    primaryDeep: '#260A13',
    accent: '#D9A07E',
    accentLight: '#F4D0B5',
    canvasLight: '#FAF5F5',
    canvasDark: '#1A0B10',
    cardLight: '#FFFFFF',
    cardDark: '#2B121A',
    textLight: '#2D0E18',
    textDark: '#FCEEEF',
    borderLight: '#EAD8D8',
    borderDark: '#47202C',
    swatches: ['#4A1525', '#260A13', '#D9A07E', '#FAF5F5'],
  },
  minimal_sage: {
    id: 'minimal_sage',
    name: 'Minimalist Sage & Linen',
    tagline: 'Calm botanical eucalyptus tones with organic warm linen',
    primary: '#2F483A',
    primaryDark: '#24382D',
    primaryDeep: '#1A2920',
    accent: '#A8BDAA',
    accentLight: '#D5E3D7',
    canvasLight: '#F5F6F3',
    canvasDark: '#121B16',
    cardLight: '#FFFFFF',
    cardDark: '#1C2A22',
    textLight: '#1B2A22',
    textDark: '#EBF0EC',
    borderLight: '#DCE2DD',
    borderDark: '#2C4235',
    swatches: ['#2F483A', '#1A2920', '#A8BDAA', '#F5F6F3'],
  },
  midnight_slate: {
    id: 'midnight_slate',
    name: 'Midnight Slate & Silver',
    tagline: 'Modern architectural obsidian with sterling silver contrast',
    primary: '#1E293B',
    primaryDark: '#151E2E',
    primaryDeep: '#0F172A',
    accent: '#94A3B8',
    accentLight: '#E2E8F0',
    canvasLight: '#F1F5F9',
    canvasDark: '#090D16',
    cardLight: '#FFFFFF',
    cardDark: '#161F30',
    textLight: '#0F172A',
    textDark: '#F8FAFC',
    borderLight: '#CBD5E1',
    borderDark: '#293548',
    swatches: ['#1E293B', '#0F172A', '#94A3B8', '#F1F5F9'],
  },
  terracotta_amber: {
    id: 'terracotta_amber',
    name: 'Warm Terracotta & Amber',
    tagline: 'Mediterranean earth sienna with sunlit amber warmth',
    primary: '#5C2C1E',
    primaryDark: '#472116',
    primaryDeep: '#33170F',
    accent: '#E09F5A',
    accentLight: '#F7CBA1',
    canvasLight: '#FDF8F4',
    canvasDark: '#1C100B',
    cardLight: '#FFFFFF',
    cardDark: '#2E1A12',
    textLight: '#2E160E',
    textDark: '#FDF3EC',
    borderLight: '#EBD9CC',
    borderDark: '#4D2B1E',
    swatches: ['#5C2C1E', '#33170F', '#E09F5A', '#FDF8F4'],
  },
};

export function getSavedColorTheme(): ColorThemeId {
  try {
    const saved = localStorage.getItem('familyos_brand_style');
    if (saved && saved in COLOR_THEMES) {
      return saved as ColorThemeId;
    }
  } catch {
    // Ignore
  }
  return 'emerald_gold';
}

export function getSavedThemeMode(): ThemeMode {
  try {
    const saved = localStorage.getItem('familyos_theme_mode');
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
  } catch {
    // Ignore
  }
  return 'light';
}

export function isEffectiveDarkMode(mode: ThemeMode): boolean {
  if (mode === 'dark') return true;
  if (mode === 'system' && typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}
