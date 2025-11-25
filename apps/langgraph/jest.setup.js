/**
 * Jest setup file for LangGraph tests
 *
 * Configures the test environment and global mocks.
 */

// Load root .env file for E2E tests
const path = require('path');
const dotenv = require('dotenv');

// Load from root project .env
const rootEnvPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: rootEnvPath });

// Increase timeout for slower tests
jest.setTimeout(30000);

// Mock console.log/warn/error to reduce noise in tests
// Uncomment if you want quieter test output:
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   warn: jest.fn(),
// };

// Global test utilities
global.testUtils = {
  // Generate a unique task ID for tests
  generateTaskId: () => `test-task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,

  // Generate a unique thread ID for tests
  generateThreadId: () => `test-thread-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,

  // Test user ID (from .env)
  testUserId: process.env.SUPABASE_TEST_USERID || 'b29a590e-b07f-49df-a25b-574c956b5035',

  // Wait helper
  wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};
