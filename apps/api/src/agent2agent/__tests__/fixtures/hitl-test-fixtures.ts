import * as jwt from 'jsonwebtoken';

/**
 * HITL Test Fixtures
 * Creates deterministic test data for E2E tests.
 *
 * Note: This is a simplified version for test scaffolding.
 * Full database operations would require proper setup with the app's
 * existing database connection patterns.
 */
export class HitlTestFixtures {
  /**
   * Generate test user credentials
   */
  async seedTestUser(): Promise<{
    userId: string;
    orgSlug: string;
    authToken: string;
  }> {
    const userId = 'test-user-' + Date.now();
    const orgSlug = 'demo';

    // Generate test auth token (JWT)
    const authToken = this.generateTestToken(userId);

    return { userId, orgSlug, authToken };
  }

  /**
   * Cleanup placeholder - actual cleanup would use database connection
   */
  async cleanup(_userId: string): Promise<void> {
    // In actual implementation, this would clean up test data
    // from conversations, tasks, deliverables, etc.
  }

  private generateTestToken(userId: string): string {
    // Use test JWT secret or Supabase test token generation
    // This should match your auth setup
    return jwt.sign(
      { sub: userId, role: 'authenticated' },
      process.env.SUPABASE_JWT_SECRET || 'test-secret',
      { expiresIn: '1h' },
    );
  }
}
