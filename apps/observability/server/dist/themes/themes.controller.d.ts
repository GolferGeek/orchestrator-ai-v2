import { Response } from 'express';
import { ThemesService } from './themes.service';
import type { ThemeColors, ThemeStats, ApiResponse } from '../types';
interface CreateThemeDto {
    name: string;
    displayName: string;
    description?: string;
    colors: ThemeColors;
    isPublic: boolean;
    tags?: string[];
    authorId?: string;
    authorName?: string;
}
interface UpdateThemeDto {
    displayName?: string;
    description?: string;
    colors?: ThemeColors;
    isPublic?: boolean;
    tags?: string[];
    authorName?: string;
}
interface ImportThemeDto {
    theme: Record<string, unknown>;
    version?: string;
    exportedAt?: string;
    exportedBy?: string;
}
export declare class ThemesController {
    private readonly themesService;
    constructor(themesService: ThemesService);
    createTheme(themeData: CreateThemeDto, res: Response): Promise<Response<any, Record<string, any>>>;
    searchThemes(query?: string, isPublic?: string, authorId?: string, sortBy?: 'name' | 'created' | 'updated' | 'downloads' | 'rating', sortOrder?: 'asc' | 'desc', limit?: string, offset?: string): Promise<ApiResponse<import("../types").Theme[]>>;
    getStats(): Promise<ApiResponse<ThemeStats>>;
    getTheme(id: string, res: Response): Promise<Response<any, Record<string, any>>>;
    updateTheme(id: string, updates: UpdateThemeDto, res: Response): Promise<Response<any, Record<string, any>>>;
    deleteTheme(id: string, res: Response, authorId?: string): Promise<Response<any, Record<string, any>>>;
    exportTheme(id: string, res: Response): Promise<Response<any, Record<string, any>>>;
    importTheme(importData: ImportThemeDto, res: Response, authorId?: string): Promise<Response<any, Record<string, any>>>;
}
export {};
