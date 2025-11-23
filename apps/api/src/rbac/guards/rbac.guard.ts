import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacService } from '../rbac.service';
import {
  PERMISSION_KEY,
  RESOURCE_PARAM_KEY,
} from '../decorators/require-permission.decorator';

/**
 * Request user type from JWT authentication
 */
interface RequestUser {
  id: string;
  email?: string;
}

/**
 * Typed request interface for HTTP requests with auth
 */
interface TypedRequest {
  user?: RequestUser;
  headers: Record<string, string | undefined>;
  query: Record<string, string | undefined>;
  body: Record<string, string | undefined>;
  params: Record<string, string | undefined>;
  organizationSlug?: string;
}

/**
 * Guard to enforce permission-based access control
 *
 * This guard works in conjunction with the @RequirePermission() decorator
 * to ensure users have the required permissions to access protected endpoints.
 *
 * The organization slug is read from:
 * 1. x-organization-slug header
 * 2. organizationSlug query parameter
 * 3. organizationSlug in request body
 *
 * @example
 * ```typescript
 * @RequirePermission('rag:write')
 * @Post('documents')
 * async uploadDocument() {
 *   // Only users with 'rag:write' permission can access this
 * }
 * ```
 */
@Injectable()
export class RbacGuard implements CanActivate {
  private readonly logger = new Logger(RbacGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required permission from route metadata
    const permission = this.reflector.getAllAndOverride<string>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no permission is specified, allow access
    if (!permission) {
      return true;
    }

    const request = context.switchToHttp().getRequest<TypedRequest>();
    const user = request.user;

    this.logger.debug(
      `[RbacGuard] request.user: ${user ? JSON.stringify({ id: user.id, email: user.email }) : 'undefined'}`,
    );

    // Ensure user is authenticated (should be handled by JwtAuthGuard first)
    if (!user || !user.id) {
      this.logger.warn(
        '[RbacGuard] No user found on request - JwtAuthGuard may not have run first',
      );
      throw new ForbiddenException('Authentication required');
    }

    // Get organization slug from request (use '*' for global/admin endpoints)
    const orgSlug = this.getOrganizationSlug(request) || '*';

    this.logger.debug(
      `[RbacGuard] Checking permission: user=${user.id}, org=${orgSlug}, permission=${permission}`,
    );

    // Check for resource-specific permission
    const resourceParam = this.reflector.get<string>(
      RESOURCE_PARAM_KEY,
      context.getHandler(),
    );
    const resourceId = resourceParam
      ? request.params[resourceParam]
      : undefined;

    // Check permission
    const hasAccess = await this.rbacService.hasPermission(
      user.id,
      orgSlug,
      permission,
      undefined,
      resourceId,
    );

    this.logger.debug(
      `[RbacGuard] Permission check result: hasAccess=${hasAccess}`,
    );

    if (!hasAccess) {
      this.logger.warn(
        `Permission denied: user=${user.id}, org=${orgSlug}, permission=${permission}`,
      );
      throw new ForbiddenException(`Permission denied: ${permission}`);
    }

    // Add organization slug to request for use in controllers
    request.organizationSlug = orgSlug;

    return true;
  }

  /**
   * Extract organization slug from request
   * Priority: header > query > body
   */
  private getOrganizationSlug(request: TypedRequest): string | undefined {
    return (
      request.headers['x-organization-slug'] ||
      request.query.organizationSlug ||
      request.body.organizationSlug ||
      undefined
    );
  }
}
