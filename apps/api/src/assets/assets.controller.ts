import {
  Controller,
  Get,
  Param,
  Req,
  Res,
  NotFoundException,
  Post,
  Body,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AssetsService } from './assets.service';
import { SupabaseService } from '@/supabase/supabase.service';

@Controller('assets')
export class AssetsController {
  private readonly logger = new Logger(AssetsController.name);

  constructor(
    private readonly assets: AssetsService,
    private readonly supabaseService: SupabaseService,
  ) {}

  /**
   * Proxy endpoint for Supabase Storage files.
   * Allows the browser to fetch storage files through the API instead of
   * directly hitting Supabase (which may not be reachable from the browser).
   *
   * URL pattern: /assets/storage/:bucket/path/to/file.ext
   */
  @Get('storage/:bucket/*')
  async proxyStorage(
    @Param('bucket') bucket: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // Extract the full path after /storage/:bucket/
    const fullUrl = req.originalUrl;
    const storagePrefix = `/assets/storage/${bucket}/`;
    const objectPath = fullUrl.substring(fullUrl.indexOf(storagePrefix) + storagePrefix.length);

    if (!objectPath) {
      throw new NotFoundException('Storage path required');
    }

    this.logger.debug(`Storage proxy: bucket=${bucket}, path=${objectPath}`);

    try {
      const client = this.supabaseService.getServiceClient();
      const { data, error } = await client.storage
        .from(bucket)
        .download(objectPath);

      if (error || !data) {
        this.logger.warn(`Storage proxy failed: ${error?.message || 'no data'}`);
        throw new NotFoundException('File not found in storage');
      }

      // Convert Blob to Buffer
      const arrayBuffer = await data.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Infer content type from file extension
      const ext = objectPath.split('.').pop()?.toLowerCase() || '';
      const mimeMap: Record<string, string> = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp',
        gltf: 'model/gltf+json',
        glb: 'model/gltf-binary',
        stl: 'model/stl',
        step: 'application/step',
        dxf: 'application/dxf',
        json: 'application/json',
        pdf: 'application/pdf',
      };
      const contentType = mimeMap[ext] || 'application/octet-stream';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(buffer);
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      this.logger.error(`Storage proxy error: ${err instanceof Error ? err.message : String(err)}`);
      throw new NotFoundException('File not found');
    }
  }

  @Get(':id')
  async stream(@Param('id') id: string, @Res() res: Response) {
    try {
      await this.assets.streamByIdOrRedirect(id, res);
    } catch {
      throw new NotFoundException('Asset not found');
    }
  }

  // Test/helper endpoint: register an existing local file (relative to IMAGE_STORAGE_DIR)
  @Post('register-local')
  async registerLocal(
    @Body() body: { path: string; mime?: string; size?: number },
  ) {
    if (!body?.path) {
      throw new NotFoundException('path is required');
    }
    const mime = body.mime || this.inferMime(body.path);
    const rec = await this.assets.registerLocalPath({
      path: body.path,
      mime,
      size: body.size,
    });
    return { success: true, id: rec.id, url: `/assets/${rec.id}` };
  }

  // Test/helper endpoint: register an external URL as metadata-only asset
  @Post('register-external')
  async registerExternal(@Body() body: { url: string; mime?: string }) {
    if (!body?.url) {
      throw new NotFoundException('url is required');
    }
    const rec = await this.assets.registerExternal({
      url: body.url,
      mime: body.mime,
    });
    return { success: true, id: rec.id, url: `/assets/${rec.id}` };
  }

  private inferMime(path: string): string {
    const p = path.toLowerCase();
    if (p.endsWith('.png')) return 'image/png';
    if (p.endsWith('.jpg') || p.endsWith('.jpeg')) return 'image/jpeg';
    if (p.endsWith('.webp')) return 'image/webp';
    if (p.endsWith('.gif')) return 'image/gif';
    return 'application/octet-stream';
  }
}
