// Theme type definitions

export type ThemeName = 'light' | 'dark' | 'modern' | 'custom' | string;

export interface ThemeColors {
  primary: string;
  primaryHover: string;
  primaryLight: string;
  primaryDark: string;
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgQuaternary: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textQuaternary: string;
  borderPrimary: string;
  borderSecondary: string;
  borderTertiary: string;
  accentSuccess: string;
  accentWarning: string;
  accentError: string;
  accentInfo: string;
  shadow: string;
  shadowLg: string;
  hoverBg: string;
  activeBg: string;
  focusRing: string;
}

export interface PredefinedTheme {
  name: ThemeName;
  displayName: string;
  colors: ThemeColors;
  description?: string;
  cssClass?: string;
  preview?: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

export interface CustomTheme extends PredefinedTheme {
  id?: string;
  authorId?: string;
  createdAt?: number | string;
  updatedAt?: number | string;
  isCustom?: boolean;
  isPublic?: boolean;
  tags?: string[];
}

export interface ThemeState {
  currentTheme: ThemeName;
  customTheme?: CustomTheme | null;
  customThemes?: CustomTheme[];
  isCustomTheme?: boolean;
  isLoading?: boolean;
  error?: string | null;
}

export interface ThemeManagerState {
  themes?: Record<ThemeName, PredefinedTheme>;
  customThemes?: CustomTheme[];
  currentTheme?: ThemeName;
  isOpen?: boolean;
  previewTheme?: ThemeName | string | null;
  editingTheme?: CustomTheme | null;
  activeTab?: string;
}

export interface CreateThemeFormData {
  name: string;
  displayName: string;
  baseTheme: ThemeName;
  colors: Partial<ThemeColors>;
  description?: string;
  isPublic?: boolean;
  tags?: string[];
}

export interface ThemeValidationResult {
  valid?: boolean;
  isValid?: boolean; // Alias for valid
  errors: string[];
  warnings?: string[];
}

export interface ThemeImportExport {
  version: string;
  theme: CustomTheme;
  exportedAt?: string;
  exportedBy?: string;
}

export interface ThemeApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// Constants
export const PREDEFINED_THEME_NAMES: string[] = ['light', 'dark', 'modern'];

export const COLOR_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
export const RGBA_REGEX = /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\)$/;
