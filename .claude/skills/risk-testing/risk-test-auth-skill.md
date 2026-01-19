---
name: risk-test-auth-skill
description: "Authenticate with the risk analysis API using environment credentials. Gets JWT token for subsequent API calls."
allowed-tools: Bash, Read
category: "testing"
type: "utility"
---

# Risk Test Auth Skill

Handles authentication for risk analysis system testing.

## Purpose

1. Read credentials from environment variables
2. Authenticate with the API
3. Extract and return JWT token and user ID

## Environment Variables

```bash
SUPABASE_TEST_USER     # Email address
SUPABASE_TEST_PASSWORD # Password
```

These are typically in the root `.env` file.

## Authentication Steps

### Step 1: Read Credentials

```bash
# From root .env file
grep -E "^SUPABASE_TEST_USER=" .env | cut -d'=' -f2
grep -E "^SUPABASE_TEST_PASSWORD=" .env | cut -d'=' -f2
```

### Step 2: Login

```bash
curl -s -X POST http://localhost:6100/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}"
```

### Step 3: Extract Token

Response format:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": "...", "email": "..." }
}
```

Extract with jq:
```bash
echo "$RESPONSE" | jq -r '.accessToken'
echo "$RESPONSE" | jq -r '.user.id'
```

## Complete Auth Script

```bash
# Read credentials
EMAIL=$(grep -E "^SUPABASE_TEST_USER=" .env | cut -d'=' -f2)
PASSWORD=$(grep -E "^SUPABASE_TEST_PASSWORD=" .env | cut -d'=' -f2)

# Login
RESPONSE=$(curl -s -X POST http://localhost:6100/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")

# Extract token
TOKEN=$(echo "$RESPONSE" | jq -r '.accessToken')
USER_ID=$(echo "$RESPONSE" | jq -r '.user.id')

# Verify
if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
  echo "AUTH SUCCESS"
  echo "TOKEN: ${TOKEN:0:50}..."
  echo "USER_ID: $USER_ID"

  # Save for later use
  echo "export TOKEN=\"$TOKEN\"" > /tmp/risk_test_auth.env
  echo "export USER_ID=\"$USER_ID\"" >> /tmp/risk_test_auth.env
else
  echo "AUTH FAILED"
  echo "$RESPONSE"
fi
```

## Verify Health First

Before authenticating, verify API is running:

```bash
curl -s http://localhost:6100/health
```

Expected: `{"status":"ok"}` or similar

## Usage

After authentication, use the token in all subsequent requests:

```bash
source /tmp/risk_test_auth.env

curl -X POST http://localhost:6100/agent-to-agent/finance/investment-risk-agent/tasks \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '...'
```

## Test Sequence

1. **Health check** - Verify API running
2. **Login** - Get token
3. **Verify token** - Make test call to scopes.list
4. **Save credentials** - Store in /tmp/risk_test_auth.env

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "null" token | Check credentials in .env |
| Connection refused | API not running on port 6103 |
| 401 Unauthorized | Token expired, re-authenticate |
| Empty USER_ID | Check .env has correct password |
