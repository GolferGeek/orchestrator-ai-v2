---
name: prediction-test-auth-skill
description: "Authenticate with the prediction API using environment credentials. Gets JWT token for subsequent API calls."
allowed-tools: Bash, Read
category: "testing"
type: "utility"
---

# Prediction Test Auth Skill

Handles authentication for prediction system testing.

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
curl -X POST http://localhost:6100/agent-to-agent/finance/us-tech-stocks-2025/tasks \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '...'
```
