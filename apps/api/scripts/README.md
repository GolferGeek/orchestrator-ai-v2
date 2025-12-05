# Standalone Test Scripts

This directory contains standalone test scripts that can be run manually outside of the Jest test framework.

## User Management Test Script

**File:** `test-user-management.ts`

A comprehensive standalone test for user management functionality.

### Usage

```bash
ADMIN_PASSWORD=your-password ts-node scripts/test-user-management.ts
```

Or with custom API URL:

```bash
API_BASE_URL=http://localhost:6100 ADMIN_PASSWORD=your-password ts-node scripts/test-user-management.ts
```

### What It Tests

The script performs a complete user lifecycle test:

1. **Authentication** - Logs in as admin user
2. **Create User** - Creates a test user with:
   - Email: `golfer@orchestratorai.io`
   - Password: `Golfer123!`
   - Display Name: `Golfer`
   - Role: `member`
   - Organization: `demo-org`
   - Email Confirmation: `false`
3. **Change Role** - Assigns `admin` role to the user
4. **Delete User** - Removes the test user
5. **Verify Deletion** - Confirms user no longer exists

### Environment Variables

- `ADMIN_EMAIL` (optional): Admin email (default: golfergeek@orchestratorai.io)
- `ADMIN_PASSWORD` (required): Admin password for authentication
- `API_BASE_URL` (optional): API base URL (default: http://localhost:6100)

### Output

The script provides detailed console output showing each step:

```
═══════════════════════════════════════════════════════
   User Management E2E Test
═══════════════════════════════════════════════════════
API Base URL: http://localhost:6100

🔐 Step 1: Authenticating as admin...
✅ Authentication successful
   Admin: golfergeek@orchestratorai.io

📝 Step 2: Creating test user...
✅ User created successfully
   ID: abc-123-def
   Email: golfer@orchestratorai.io
   Display Name: Golfer
   Roles: member
   Organizations: demo-org
   Email Confirmation Required: false

🔄 Step 3: Changing user role...
   Fetching current roles...
   Current roles: Member
   Assigning "admin" role...
✅ Role changed successfully
   New roles: Member, Admin

🗑️  Step 4: Deleting test user...
✅ User deleted successfully
   Message: User deleted successfully
   Verifying deletion...
✅ User deletion verified (user not found)

═══════════════════════════════════════════════════════
✅ All tests passed successfully!
═══════════════════════════════════════════════════════
```

### When to Use

Use this script when:
- You want to manually verify user management functionality
- You need to debug issues with user creation/deletion
- You want to test against a specific environment
- You need a quick smoke test before deployment

### Comparison with E2E Tests

| Feature | Standalone Script | E2E Tests |
|---------|------------------|-----------|
| Framework | None (raw TypeScript) | Jest |
| CI Integration | No | Yes |
| Assertions | Basic error handling | Comprehensive expect() |
| Output | Console logs | Test reporter |
| Coverage | Not tracked | Tracked |
| Speed | Fast | Slower (test framework overhead) |
| Use Case | Manual testing, debugging | Automated regression testing |

### Error Handling

The script includes comprehensive error handling:
- Network errors are caught and displayed with details
- Cleanup runs automatically on failure
- Exit codes: 0 for success, 1 for failure

### Cleanup

The script automatically cleans up after itself:
- If any step fails, the cleanup function runs
- The test user is deleted if it was created
- No manual cleanup needed

## Test Users Cleanup Script

**File:** `cleanup-test-users.ts`

A utility script to find and delete all test users from both `auth.users` and `public.users` tables.

### Usage

```bash
ts-node scripts/cleanup-test-users.ts
```

Or with custom API URL:

```bash
API_BASE_URL=http://localhost:6100 ts-node scripts/cleanup-test-users.ts
```

**Note:** The script automatically loads `SUPABASE_TEST_USER` and `SUPABASE_TEST_PASSWORD` from your root `.env` file. If these are not set, it will fall back to `ADMIN_PASSWORD`.

### What It Does

The script:
1. Authenticates as admin user
2. Fetches all users from all organizations
3. Identifies test users by email patterns:
   - `test-*@orchestratorai.io`
   - `*-test@orchestratorai.io`
   - `test*@orchestratorai.io`
   - `golfer@orchestratorai.io`
   - `duplicate-test@orchestratorai.io`
   - `weak-password@orchestratorai.io`
4. Deletes each test user using the admin API endpoint
5. Provides a summary of deleted users

### Environment Variables

- `SUPABASE_TEST_USER` (preferred): Test user email from root `.env` file
- `SUPABASE_TEST_PASSWORD` (preferred): Test user password from root `.env` file
- `ADMIN_PASSWORD` (fallback): Admin password if test user credentials are not available
- `API_BASE_URL` (optional): API base URL (default: http://localhost:6100)

The script automatically loads environment variables from the root `.env` file.

### Output

The script provides detailed console output:

```
═══════════════════════════════════════════════════════
   Test Users Cleanup Script
═══════════════════════════════════════════════════════
API Base URL: http://localhost:6100

🔐 Authenticating as admin...
✅ Authentication successful

📋 Fetching all users...
✅ Found 15 total users

🔍 Found 3 test user(s) to delete:

   - golfer@orchestratorai.io (abc-123-def)
   - test-golfer-1234567890@orchestratorai.io (xyz-789-ghi)
   - duplicate-test@orchestratorai.io (def-456-jkl)

🗑️  Deleting golfer@orchestratorai.io...
   ✅ Deleted successfully

🗑️  Deleting test-golfer-1234567890@orchestratorai.io...
   ✅ Deleted successfully

🗑️  Deleting duplicate-test@orchestratorai.io...
   ✅ Deleted successfully

═══════════════════════════════════════════════════════
   Cleanup Summary
═══════════════════════════════════════════════════════
Total test users found: 3
Successfully deleted: 3
Failed: 0
═══════════════════════════════════════════════════════
```

### When to Use

Use this script when:
- You need to clean up test users after running tests
- You want to remove orphaned test users from the database
- You need to clean up users that exist in `public.users` but not `auth.users` (or vice versa)
- You're preparing a clean database for testing

### Important Notes

- The script uses the admin API endpoint which properly deletes from both `auth.users` and `public.users`
- Users are deleted in the correct order (auth.users first, then public.users via cascade)
- The script will skip users that are already deleted (404 errors are treated as success)
- Make sure you have admin permissions before running this script

### Example Error Output

```
❌ User creation failed
   Status: 403
   Message: Request failed with status code 403
   Response: {
     "statusCode": 403,
     "message": "Permission denied: admin:users"
   }

═══════════════════════════════════════════════════════
❌ Test failed
═══════════════════════════════════════════════════════

🧹 Cleanup: Ensuring test user is deleted...
✅ User already deleted
```
