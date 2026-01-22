import { DatabaseService } from '../database/database.service';
import type { Theme, ThemeSearchQuery, ApiResponse } from '../types';
interface ThemeInput {
    name?: unknown;
    displayName?: unknown;
    description?: unknown;
    colors?: unknown;
    isPublic?: unknown;
    tags?: unknown;
    authorId?: unknown;
    authorName?: unknown;
}
interface ThemeExportData {
    version: string;
    theme: Partial<Theme>;
    exportedAt: string;
    exportedBy: string;
}
interface ThemeImportData {
    theme?: ThemeInput & {
        authorName?: string;
    };
    version?: string;
}
interface ThemeStats {
    totalThemes: number;
    publicThemes: number;
    privateThemes: number;
    totalDownloads: number;
    averageRating: number;
}
export declare class ThemesService {
    private readonly databaseService;
    private readonly logger;
    constructor(databaseService: DatabaseService);
    private generateId;
    private validateTheme;
    private isValidColor;
    private sanitizeTheme;
    createTheme(themeData: ThemeInput): Promise<ApiResponse<Theme>>;
    updateThemeById(id: string, updates: ThemeInput): Promise<ApiResponse<Theme>>;
    getThemeById(id: string): Promise<ApiResponse<Theme>>;
    searchThemes(query: ThemeSearchQuery): Promise<ApiResponse<Theme[]>>;
    deleteThemeById(id: string, authorId?: string): Promise<ApiResponse<void>>;
    exportThemeById(id: string): Promise<ApiResponse<ThemeExportData>>;
    importTheme(importData: ThemeImportData, authorId?: string): Promise<ApiResponse<Theme>>;
    getThemeStats(): Promise<ApiResponse<ThemeStats>>;
}
export {};
