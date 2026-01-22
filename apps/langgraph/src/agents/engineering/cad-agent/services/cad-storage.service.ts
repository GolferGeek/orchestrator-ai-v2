import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { ExecutionContext } from "@orchestrator-ai/transport-types";

/**
 * Result of storing a CAD file
 */
export interface StoredCadFileResult {
  /** Storage path within bucket */
  storagePath: string;
  /** Public URL to access the file */
  publicUrl: string;
  /** File size in bytes */
  sizeBytes: number;
  /** MIME type */
  mimeType: string;
}

/**
 * CAD file format types
 */
export type CadFileFormat = "step" | "stl" | "gltf" | "dxf" | "thumbnail";

/**
 * CAD Storage Service
 *
 * Handles storage of CAD output files (STEP, STL, GLTF, DXF, thumbnails)
 * to Supabase Storage.
 *
 * Storage Structure:
 * ```
 * cad-outputs/
 *   {orgSlug}/
 *     {projectId}/
 *       {drawingId}/
 *         model.step
 *         model.stl
 *         model.gltf
 *         model.dxf
 *         thumbnail.png
 * ```
 *
 * ExecutionContext Flow:
 * - Uses context.orgSlug for organization path
 * - Uses projectId for project path
 * - Uses drawingId (which equals taskId) for drawing path
 */
@Injectable()
export class CadStorageService implements OnModuleInit {
  private readonly logger = new Logger(CadStorageService.name);
  private supabase: SupabaseClient;
  private readonly bucketName = "cad-outputs";

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || "http://127.0.0.1:6010";
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });
  }

  async onModuleInit() {
    await this.ensureBucketExists();
  }

  /**
   * Ensure the CAD outputs bucket exists
   */
  private async ensureBucketExists(): Promise<void> {
    try {
      // Check if bucket exists
      const { data: buckets, error: listError } =
        await this.supabase.storage.listBuckets();

      if (listError) {
        // Known issue: Supabase JS client may have SQL type mismatch in UNION query
        // This is non-critical - we'll try to create the bucket anyway
        this.logger.warn(
          `Failed to list buckets (known Supabase issue): ${listError.message}`,
        );
        this.logger.warn(
          "Attempting to create bucket anyway (will fail silently if it exists)",
        );

        // Try to create the bucket - if it exists, this will fail but that's OK
        const { error: createError } = await this.supabase.storage.createBucket(
          this.bucketName,
          {
            public: true, // CAD outputs should be publicly accessible
            fileSizeLimit: 52428800, // 50MB limit for CAD files
            allowedMimeTypes: [
              "application/step",
              "application/sla", // STL
              "model/stl",
              "model/gltf+json", // JSON-based GLTF
              "model/gltf-binary", // Binary GLB (for future use)
              "application/json", // Also allow generic JSON for GLTF
              "application/octet-stream", // Generic binary (for STEP/STL)
              "image/dxf",
              "application/dxf",
              "image/png",
              "image/jpeg",
            ],
          },
        );

        if (createError) {
          // If error contains "already exists", that's fine
          if (
            createError.message.toLowerCase().includes("already exists") ||
            createError.message.toLowerCase().includes("duplicate")
          ) {
            this.logger.log(`Storage bucket ${this.bucketName} already exists`);
          } else {
            this.logger.warn(
              `Could not verify or create bucket ${this.bucketName}: ${createError.message}`,
            );
            this.logger.warn(
              "Storage operations may fail if bucket doesn't exist",
            );
          }
        } else {
          this.logger.log(`Created storage bucket: ${this.bucketName}`);
        }
        return;
      }

      const bucketExists = buckets?.some((b) => b.name === this.bucketName);

      if (!bucketExists) {
        // Create the bucket
        const { error: createError } = await this.supabase.storage.createBucket(
          this.bucketName,
          {
            public: true, // CAD outputs should be publicly accessible
            fileSizeLimit: 52428800, // 50MB limit for CAD files
            allowedMimeTypes: [
              "application/step",
              "application/sla", // STL
              "model/stl",
              "model/gltf+json", // JSON-based GLTF
              "model/gltf-binary", // Binary GLB (for future use)
              "application/json", // Also allow generic JSON for GLTF
              "application/octet-stream", // Generic binary (for STEP/STL)
              "image/dxf",
              "application/dxf",
              "image/png",
              "image/jpeg",
            ],
          },
        );

        if (createError) {
          this.logger.error(
            `Failed to create bucket ${this.bucketName}: ${createError.message}`,
          );
        } else {
          this.logger.log(`Created storage bucket: ${this.bucketName}`);
        }
      } else {
        this.logger.log(`Storage bucket ${this.bucketName} already exists`);
      }
    } catch (error) {
      this.logger.warn(
        `Error ensuring bucket exists: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.logger.warn("CAD storage may not work correctly");
    }
  }

  /**
   * Get MIME type for CAD format
   */
  private getMimeType(format: CadFileFormat): string {
    const mimeTypes: Record<CadFileFormat, string> = {
      step: "application/step",
      stl: "model/stl",
      gltf: "model/gltf+json", // JSON-based GLTF (not binary GLB)
      dxf: "application/dxf",
      thumbnail: "image/png",
    };
    return mimeTypes[format];
  }

  /**
   * Get file extension for CAD format
   */
  private getExtension(format: CadFileFormat): string {
    const extensions: Record<CadFileFormat, string> = {
      step: "step",
      stl: "stl",
      gltf: "gltf", // JSON-based GLTF (not binary GLB)
      dxf: "dxf",
      thumbnail: "png",
    };
    return extensions[format];
  }

  /**
   * Build storage path from context and format
   */
  private buildStoragePath(
    orgSlug: string,
    projectId: string,
    drawingId: string,
    format: CadFileFormat,
  ): string {
    const extension = this.getExtension(format);
    const filename = format === "thumbnail" ? "thumbnail" : "model";
    return `${orgSlug}/${projectId}/${drawingId}/${filename}.${extension}`;
  }

  /**
   * Store a CAD output file
   *
   * @param data - File data as Buffer
   * @param context - ExecutionContext for organization info
   * @param projectId - Project ID
   * @param drawingId - Drawing ID (equals taskId)
   * @param format - CAD file format
   * @returns StoredCadFileResult with path and URL
   */
  async storeFile(
    data: Buffer,
    context: ExecutionContext,
    projectId: string,
    drawingId: string,
    format: CadFileFormat,
  ): Promise<StoredCadFileResult> {
    if (!context.orgSlug) {
      throw new Error("ExecutionContext.orgSlug is required for CAD storage");
    }
    const orgSlug = context.orgSlug;
    const storagePath = this.buildStoragePath(
      orgSlug,
      projectId,
      drawingId,
      format,
    );
    const mimeType = this.getMimeType(format);

    this.logger.log(
      `📦 [CAD-STORAGE] Storing ${format} file: ${storagePath} (${data.length} bytes)`,
    );

    // Upload to Supabase storage
    const { error: uploadError } = await this.supabase.storage
      .from(this.bucketName)
      .upload(storagePath, data, {
        contentType: mimeType,
        upsert: true, // Overwrite if exists (for re-exports)
      });

    if (uploadError) {
      this.logger.error(
        `📦 [CAD-STORAGE] Upload failed: ${uploadError.message}`,
      );
      throw new Error(`Failed to upload CAD file: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = this.supabase.storage
      .from(this.bucketName)
      .getPublicUrl(storagePath);

    const publicUrl = urlData.publicUrl;

    this.logger.log(`📦 [CAD-STORAGE] Uploaded successfully: ${publicUrl}`);

    return {
      storagePath,
      publicUrl,
      sizeBytes: data.length,
      mimeType,
    };
  }

  /**
   * Store multiple CAD output files
   *
   * @param files - Map of format to file data
   * @param context - ExecutionContext
   * @param projectId - Project ID
   * @param drawingId - Drawing ID
   * @returns Map of format to storage results
   */
  async storeFiles(
    files: Map<CadFileFormat, Buffer>,
    context: ExecutionContext,
    projectId: string,
    drawingId: string,
  ): Promise<Map<CadFileFormat, StoredCadFileResult>> {
    const results = new Map<CadFileFormat, StoredCadFileResult>();

    for (const [format, data] of files) {
      try {
        const result = await this.storeFile(
          data,
          context,
          projectId,
          drawingId,
          format,
        );
        results.set(format, result);
      } catch (error) {
        this.logger.error(
          `Failed to store ${format} file: ${error instanceof Error ? error.message : String(error)}`,
        );
        // Continue with other files even if one fails
      }
    }

    return results;
  }

  /**
   * Delete CAD output files for a drawing
   *
   * @param orgSlug - Organization slug
   * @param projectId - Project ID
   * @param drawingId - Drawing ID
   */
  async deleteDrawingFiles(
    orgSlug: string,
    projectId: string,
    drawingId: string,
  ): Promise<void> {
    const basePath = `${orgSlug}/${projectId}/${drawingId}`;

    // List all files in the drawing folder
    const { data: files, error: listError } = await this.supabase.storage
      .from(this.bucketName)
      .list(basePath);

    if (listError) {
      this.logger.error(`Failed to list files: ${listError.message}`);
      return;
    }

    if (files && files.length > 0) {
      const filePaths = files.map((f) => `${basePath}/${f.name}`);

      const { error: deleteError } = await this.supabase.storage
        .from(this.bucketName)
        .remove(filePaths);

      if (deleteError) {
        this.logger.error(`Failed to delete files: ${deleteError.message}`);
      } else {
        this.logger.log(
          `Deleted ${filePaths.length} files for drawing ${drawingId}`,
        );
      }
    }
  }

  /**
   * Get public URL for a stored file
   *
   * @param storagePath - Storage path
   * @returns Public URL
   */
  getPublicUrl(storagePath: string): string {
    const { data } = this.supabase.storage
      .from(this.bucketName)
      .getPublicUrl(storagePath);
    return data.publicUrl;
  }

  /**
   * Check if a file exists
   *
   * @param storagePath - Storage path
   * @returns True if file exists
   */
  async fileExists(storagePath: string): Promise<boolean> {
    // Extract the folder path and filename
    const parts = storagePath.split("/");
    const filename = parts.pop();
    const folderPath = parts.join("/");

    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .list(folderPath, {
        search: filename,
      });

    if (error) {
      return false;
    }

    return data.some((f) => f.name === filename);
  }

  /**
   * Get storage statistics for a drawing
   */
  async getDrawingStorageStats(
    orgSlug: string,
    projectId: string,
    drawingId: string,
  ): Promise<{ totalFiles: number; totalSizeBytes: number }> {
    const basePath = `${orgSlug}/${projectId}/${drawingId}`;

    const { data: files, error } = await this.supabase.storage
      .from(this.bucketName)
      .list(basePath);

    if (error || !files) {
      return { totalFiles: 0, totalSizeBytes: 0 };
    }

    const totalSizeBytes = files.reduce(
      (sum, f) => sum + (f.metadata?.size || 0),
      0,
    );

    return {
      totalFiles: files.length,
      totalSizeBytes,
    };
  }
}
