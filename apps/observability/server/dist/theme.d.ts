import type { Theme, ThemeSearchQuery, ApiResponse, ThemeExportData, ThemeStats } from './types.js';
export declare function createTheme(themeData: unknown): Promise<ApiResponse<Theme>>;
export declare function updateThemeById(id: string, updates: unknown): Promise<ApiResponse<Theme>>;
export declare function getThemeById(id: string): Promise<ApiResponse<Theme>>;
export declare function searchThemes(query: ThemeSearchQuery): Promise<ApiResponse<Theme[]>>;
export declare function deleteThemeById(id: string, authorId?: string): Promise<ApiResponse<void>>;
export declare function exportThemeById(id: string): Promise<ApiResponse<ThemeExportData>>;
export declare function importTheme(importData: unknown, authorId?: string): Promise<ApiResponse<Theme>>;
export declare function getThemeStats(): Promise<ApiResponse<ThemeStats>>;
