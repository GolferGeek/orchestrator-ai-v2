import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  UserCreateDto,
  UserLoginDto,
  TokenResponseDto,
  AuthenticatedUserResponseDto,
  SupabaseAuthUserDto,
  UserProfileDto,
} from './dto/auth.dto';
import {
  CreateUserDto,
  CreateUserResponseDto,
} from './dto/admin-user-management.dto';
import { getTableName } from '../supabase/supabase.config';

/**
 * Database record type for users table
 * Note: Roles and permissions are managed via RBAC tables, not stored here
 */
interface UserDbRecord {
  id: string;
  email: string;
  display_name: string;
  organization_slug?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async signup(userCreateDto: UserCreateDto): Promise<TokenResponseDto> {
    try {
      const supabaseClient = this.supabaseService.getAnonClient();

      // Create user in Supabase Auth
      const { data: authResponse, error } = await supabaseClient.auth.signUp({
        email: userCreateDto.email,
        password: userCreateDto.password,
        options: {
          data: {
            display_name:
              userCreateDto.displayName || userCreateDto.email.split('@')[0],
          },
        },
      });

      if (error) {
        throw new BadRequestException(
          error.message ||
            'Error during signup. User might already exist or invalid input.',
        );
      }

      // Handle successful signup with session
      if (authResponse.user && authResponse.session?.access_token) {
        return {
          accessToken: authResponse.session.access_token,
          refreshToken: authResponse.session.refresh_token || undefined,
          tokenType: 'bearer',
          expiresIn: authResponse.session.expires_in || undefined,
        };
      }

      // User created but no session (email confirmation required)
      if (authResponse.user && !authResponse.session) {
        throw new HttpException(
          'User created successfully. Please check your email to confirm your account before logging in.',
          HttpStatus.ACCEPTED, // 202 Accepted
        );
      }

      // Unexpected response
      throw new BadRequestException(
        'Could not create user or establish session.',
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'An unexpected error occurred during signup.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async login(userLoginDto: UserLoginDto): Promise<TokenResponseDto> {
    try {
      const supabaseClient = this.supabaseService.getAnonClient();

      const { data: authResponse, error } =
        await supabaseClient.auth.signInWithPassword({
          email: userLoginDto.email,
          password: userLoginDto.password,
        });

      if (error) {
        throw new UnauthorizedException(
          error.message || 'Invalid login credentials.',
        );
      }

      if (!authResponse.session?.access_token) {
        throw new BadRequestException(
          'Login succeeded but no session or token received.',
        );
      }

      return {
        accessToken: authResponse.session.access_token,
        refreshToken: authResponse.session.refresh_token || undefined,
        tokenType: 'bearer',
        expiresIn: authResponse.session.expires_in || undefined,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'An unexpected error occurred during login.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async logout(token: string): Promise<void> {
    try {
      // Create an authenticated client with the user's token
      const authenticatedClient =
        this.supabaseService.createAuthenticatedClient(token);

      const { error } = await authenticatedClient.auth.signOut();

      if (error) {
        throw new BadRequestException(error.message || 'Error during logout.');
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'An unexpected error occurred during logout.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async refreshToken(refreshToken: string): Promise<TokenResponseDto> {
    try {
      const supabaseClient = this.supabaseService.getAnonClient();

      // Use Supabase's session refresh functionality
      const { data: authResponse, error } =
        await supabaseClient.auth.refreshSession({
          refresh_token: refreshToken,
        });

      if (error) {
        throw new UnauthorizedException(
          error.message || 'Invalid or expired refresh token',
        );
      }

      if (!authResponse.session) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      return {
        accessToken: authResponse.session.access_token,
        refreshToken: authResponse.session.refresh_token || undefined,
        tokenType: 'bearer',
        expiresIn: authResponse.session.expires_in || undefined,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'An unexpected error occurred during token refresh.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getCurrentUser(
    currentAuthUser: SupabaseAuthUserDto,
    _token: string,
  ): Promise<AuthenticatedUserResponseDto> {
    try {
      // Use service role client to bypass RLS issues temporarily
      const serviceClient = this.supabaseService.getServiceClient();

      // Get user profile from users table
      const { data: userData } = await serviceClient
        .from(getTableName('users'))
        .select('id, email, display_name, organization_slug, created_at')
        .eq('id', currentAuthUser.id)
        .single();

      if (!userData) {
        throw new HttpException(
          'User profile not found.',
          HttpStatus.FORBIDDEN,
        );
      }

      // Get user's organizations from RBAC
      // Define proper type for RPC response
      interface UserOrgRpcResult {
        organization_slug: string;
        organization_name: string;
        role_name: string;
        is_global: boolean;
      }
      const { data: userOrgs, error: orgsError } = (await serviceClient.rpc(
        'rbac_get_user_organizations',
        { p_user_id: currentAuthUser.id },
      )) as {
        data: UserOrgRpcResult[] | null;
        error: { message: string } | null;
      };

      if (orgsError) {
        this.logger.warn('Failed to get user organizations:', orgsError);
      }

      // Extract unique organization slugs
      const organizationAccess = userOrgs
        ? [...new Set(userOrgs.map((o) => o.organization_slug))]
        : [];

      // If user has no organizations, use their default org or 'demo-org'
      if (organizationAccess.length === 0) {
        if (userData.organization_slug) {
          organizationAccess.push(userData.organization_slug as string);
        } else {
          organizationAccess.push('demo-org');
        }
      }

      // Get user's roles from RBAC (extract from userOrgs which includes role_name)
      // userOrgs returns: organization_slug, organization_name, role_name, is_global
      const roles = userOrgs
        ? [...new Set(userOrgs.map((o) => o.role_name))]
        : ['member'];

      return {
        id: currentAuthUser.id,
        email: currentAuthUser.email,
        displayName: userData.display_name as string,
        roles,
        organizationAccess,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Error fetching user profile:', error);
      throw new HttpException(
        'Could not fetch user profile.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async validateUser(token: string): Promise<SupabaseAuthUserDto> {
    try {
      const supabaseClient = this.supabaseService.getAnonClient();
      const {
        data: { user },
        error,
      } = await supabaseClient.auth.getUser(token);

      if (error || !user) {
        throw new UnauthorizedException('Invalid token');
      }

      return {
        id: user.id,
        email: user.email,
        aud: user.aud,
        role: user.role,
        appMetadata: user.app_metadata,
        userMetadata: user.user_metadata,
        emailConfirmedAt: user.email_confirmed_at
          ? new Date(user.email_confirmed_at)
          : undefined,
        confirmedAt: user.confirmed_at
          ? new Date(user.confirmed_at)
          : undefined,
        lastSignInAt: user.last_sign_in_at
          ? new Date(user.last_sign_in_at)
          : undefined,
        createdAt: user.created_at ? new Date(user.created_at) : undefined,
        updatedAt: user.updated_at ? new Date(user.updated_at) : undefined,
        identities: user.identities,
      };
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  /**
   * Get user profile - basic info only, roles come from RBAC
   */
  async getUserProfile(userId: string): Promise<UserProfileDto | null> {
    try {
      const serviceClient = this.supabaseService.getServiceClient();

      const { data: result, error } = await serviceClient
        .from(getTableName('users'))
        .select(
          'id, email, display_name, organization_slug, status, created_at, updated_at',
        )
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        throw new Error(`Database error: ${error.message}`);
      }

      const data = result as UserDbRecord | null;
      if (!data) {
        return null;
      }

      // Get roles from RBAC
      const { data: userOrgs } = (await serviceClient.rpc(
        'rbac_get_user_organizations',
        { p_user_id: userId },
      )) as {
        data: Array<{
          organization_slug: string;
          role_name: string;
        }> | null;
      };

      const roles = userOrgs
        ? [...new Set(userOrgs.map((o) => o.role_name))]
        : ['member'];

      const organizationAccess = userOrgs
        ? [...new Set(userOrgs.map((o) => o.organization_slug))]
        : [];

      return {
        id: data.id,
        email: data.email,
        displayName: data.display_name,
        roles,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        organizationAccess,
      };
    } catch {
      throw new HttpException(
        'Could not fetch user profile.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get user's organization access from RBAC
   */
  async getOrganizationAccessForUser(userId: string): Promise<string[]> {
    const serviceClient = this.supabaseService.getServiceClient();

    const { data: userOrgs, error } = (await serviceClient.rpc(
      'rbac_get_user_organizations',
      { p_user_id: userId },
    )) as {
      data: Array<{ organization_slug: string }> | null;
      error: { message: string } | null;
    };

    if (error) {
      throw new HttpException(
        'Could not fetch user organizations.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const organizations = userOrgs
      ? [...new Set(userOrgs.map((o) => o.organization_slug))]
      : [];

    if (organizations.length === 0) {
      throw new HttpException(
        'No organization access configured for this user.',
        HttpStatus.FORBIDDEN,
      );
    }

    return organizations;
  }

  /**
   * Create new user (admin only)
   * Creates auth user, profile record, and assigns default RBAC role
   */
  async createUser(
    createUserDto: CreateUserDto,
    adminUserId: string,
  ): Promise<CreateUserResponseDto> {
    try {
      const serviceClient = this.supabaseService.getServiceClient();

      // Create user in Supabase Auth using Admin API
      const { data: authUser, error: authError } =
        await serviceClient.auth.admin.createUser({
          email: createUserDto.email,
          password: createUserDto.password,
          email_confirm: createUserDto.emailConfirm !== false,
          user_metadata: {
            display_name: createUserDto.displayName || '',
          },
        });

      if (authError) {
        throw new Error(`Failed to create auth user: ${authError.message}`);
      }

      if (!authUser.user) {
        throw new Error('Auth user creation returned no user data');
      }

      // Create user profile record (roles are managed via RBAC)
      const defaultOrg = createUserDto.organizationAccess?.[0] || 'demo-org';
      const { error: profileError } = await serviceClient
        .from(getTableName('users'))
        .insert({
          id: authUser.user.id,
          email: createUserDto.email,
          display_name: createUserDto.displayName || null,
          organization_slug: defaultOrg,
          status: 'active',
        })
        .select()
        .single();

      if (profileError) {
        await serviceClient.auth.admin.deleteUser(authUser.user.id);
        throw new Error(
          `Failed to create user profile: ${profileError.message}`,
        );
      }

      // Assign RBAC roles for each organization
      const roles = createUserDto.roles || ['member'];
      const orgs = createUserDto.organizationAccess?.length
        ? createUserDto.organizationAccess
        : ['demo-org'];

      // Get role IDs
      const { data: roleData } = await serviceClient
        .from('rbac_roles')
        .select('id, name')
        .in('name', roles);

      if (roleData) {
        const typedRoleData = roleData as Array<{ id: string; name: string }>;
        for (const org of orgs) {
          for (const role of typedRoleData) {
            await serviceClient.from('rbac_user_org_roles').insert({
              user_id: authUser.user.id,
              organization_slug: org,
              role_id: role.id,
              assigned_by: adminUserId,
            });
          }
        }
      }

      return {
        id: authUser.user.id,
        email: createUserDto.email,
        displayName: createUserDto.displayName,
        roles,
        emailConfirmationRequired: !authUser.user.email_confirmed_at,
        message: 'User created successfully',
        organizationAccess: orgs,
      };
    } catch (error) {
      throw new Error(
        `Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get all users (admin only)
   */
  async getAllUsers(_adminUserId: string): Promise<unknown[]> {
    try {
      const serviceClient = this.supabaseService.getServiceClient();

      const { data: users, error } = await serviceClient
        .from(getTableName('users'))
        .select(
          'id, email, display_name, organization_slug, status, created_at',
        )
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch users: ${error.message}`);
      }

      return users || [];
    } catch (error) {
      throw new Error(
        `Failed to get all users: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get user by ID (admin only)
   */
  async getUserById(userId: string, _adminUserId: string): Promise<unknown> {
    try {
      const serviceClient = this.supabaseService.getServiceClient();

      const { data: user, error } = await serviceClient
        .from(getTableName('users'))
        .select(
          'id, email, display_name, organization_slug, status, created_at',
        )
        .eq('id', userId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch user: ${error.message}`);
      }

      if (!user) {
        throw new Error('User not found');
      }

      return user;
    } catch (error) {
      throw new Error(
        `Failed to get user by ID: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Delete user (admin only)
   * Removes user from auth, profile, and all RBAC assignments
   */
  async deleteUser(
    userId: string,
    adminUserId: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const serviceClient = this.supabaseService.getServiceClient();

      // Prevent self-deletion
      if (userId === adminUserId) {
        throw new BadRequestException('You cannot delete your own account');
      }

      // Check if user exists in public.users (may not exist if only in auth.users)
      const { data: existingUser, error: checkError } = await serviceClient
        .from(getTableName('users'))
        .select('id, email')
        .eq('id', userId)
        .single();

      // If user doesn't exist in public.users, try to get email from auth.users
      let userEmail = '';
      if (checkError || !existingUser) {
        // User might only exist in auth.users, try to get email from there
        const { data: authUser, error: authUserError } =
          await serviceClient.auth.admin.getUserById(userId);

        if (authUserError || !authUser?.user) {
          throw new BadRequestException(
            'User not found in auth.users or public.users',
          );
        }

        userEmail = authUser.user.email || userId;
        this.logger.warn(
          `User ${userId} exists in auth.users but not in public.users. Will delete from auth.users only.`,
        );
      } else {
        userEmail = (existingUser as { email: string }).email;
      }

      // Delete RBAC audit log entries where user is actor or target
      // These constraints don't cascade, so we must delete them explicitly
      await serviceClient
        .from('rbac_audit_log')
        .delete()
        .or(`actor_id.eq.${userId},target_user_id.eq.${userId}`);

      // Update RBAC assignments where user is assigned_by (set to NULL)
      // This constraint doesn't cascade, so we must update it explicitly
      await serviceClient
        .from('rbac_user_org_roles')
        .update({ assigned_by: null })
        .eq('assigned_by', userId);

      // Delete RBAC assignments for this user (cascade should handle this, but explicit is better)
      await serviceClient
        .from('rbac_user_org_roles')
        .delete()
        .eq('user_id', userId);

      // Delete from Supabase Auth FIRST (before deleting from public.users)
      // This ensures foreign key constraints don't prevent deletion.
      // Note: Deleting from auth.users will cascade delete from public.users
      // due to the foreign key constraint (ON DELETE CASCADE)
      const { error: authError } =
        await serviceClient.auth.admin.deleteUser(userId);

      if (authError) {
        // Log the full error for debugging
        this.logger.error(
          `Failed to delete auth user ${userId}: ${authError.message}`,
          authError,
        );

        // If it's a database constraint error, provide more helpful message
        const errorMessage = authError.message || 'Unknown error';
        if (
          errorMessage.includes('Database error') ||
          errorMessage.includes('constraint')
        ) {
          throw new Error(
            `Failed to delete auth user: ${errorMessage}. ` +
              `This may be due to foreign key constraints or active sessions. ` +
              `Try deleting through Supabase dashboard or ensure all user data is cleaned up first.`,
          );
        }

        throw new Error(
          `Failed to delete auth user: ${errorMessage}. User may still exist in auth.users.`,
        );
      }

      // Attempt to delete user profile from public.users (only if it exists)
      // This should already be deleted by cascade, but we try anyway for cleanup
      // If it fails, it's likely because it was already cascade-deleted or never existed, which is fine
      if (existingUser) {
        const { error: profileError } = await serviceClient
          .from(getTableName('users'))
          .delete()
          .eq('id', userId);

        if (profileError) {
          // This is expected if cascade deletion already removed the record
          // Log at debug level since this is normal behavior
          this.logger.debug(
            `User profile ${userId} may have been cascade-deleted: ${profileError.message}`,
          );
        }
      }

      return {
        success: true,
        message: `User ${userEmail} deleted successfully`,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Change user password (admin only)
   * Allows admin to set a new password for any user
   */
  async changeUserPassword(
    userId: string,
    newPassword: string,
    _adminUserId: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const serviceClient = this.supabaseService.getServiceClient();

      // Update password using Admin API
      const { error } = await serviceClient.auth.admin.updateUserById(userId, {
        password: newPassword,
      });

      if (error) {
        throw new Error(`Failed to update password: ${error.message}`);
      }

      return {
        success: true,
        message: 'Password updated successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to change password: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Initiate password reset
   * Sends password reset email to user
   */
  async initiatePasswordReset(
    email: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const supabaseClient = this.supabaseService.getAnonClient();

      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:8100'}/reset-password`,
      });

      if (error) {
        throw new Error(`Failed to send reset email: ${error.message}`);
      }

      return {
        success: true,
        message: 'Password reset email sent',
      };
    } catch {
      // Don't leak information about whether email exists
      this.logger.warn(`Password reset attempted for: ${email}`);
      return {
        success: true,
        message: 'If the email exists, a password reset link has been sent',
      };
    }
  }
}
