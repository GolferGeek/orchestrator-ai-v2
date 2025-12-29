# Security Audit Report: Authentication, Authorization, and PII Processing

**Date:** 2025-12-29
**Refactoring ID:** security-audit
**Priority:** CRITICAL
**Audited Components:** Auth Guards, API Key Guard, PII Services

---

## Executive Summary

This audit examined critical security components responsible for authentication, authorization, and PII (Personally Identifiable Information) processing. The audit identified several areas requiring immediate attention:

- **CRITICAL**: Auth guards (jwt-auth.guard.ts, roles.guard.ts) have minimal test coverage (0-17%)
- **CRITICAL**: PII processing services have extremely low test coverage (3-8%)
- **GOOD**: API key guard has adequate test coverage (84.5% lines, 69.79% branches)
- **Multiple security vulnerabilities** identified requiring tests before remediation

---

## Issue api-032: Auth Guards Need Comprehensive Testing

**File:** `/Users/golfergeek/projects/golfergeek/orchestrator-ai-v2/apps/api/src/auth/guards/jwt-auth.guard.ts`
**Priority:** HIGH
**Current Coverage:**
- Lines: 15.15% (10/66)
- Functions: 20% (1/5)
- Statements: 17.64% (12/68)
- Branches: 0% (0/60)

### Security Findings

#### 1. Token Extraction Vulnerabilities

**Location:** Lines 155-182

**Issue:** No validation of malformed tokens or injection attempts

```typescript
private extractBearerToken(request: AuthenticatedRequest): string | null {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  return token || null;
}
```

**Vulnerabilities:**
- No validation for malformed Bearer tokens
- No check for overly long tokens (DoS attack vector)
- No sanitization of token strings
- Could accept tokens with embedded nulls or special characters

**Attack Vectors:**
- Bypass: `Bearer \x00malicious-token`
- DoS: `Bearer ` + 1MB of 'A's
- Injection: `Bearer token-with-sql-injection-attempt`

#### 2. API Key Authentication Bypass Risk

**Location:** Lines 46-70

**Issue:** Test API key authentication has weak validation

```typescript
const testApiKey = request.headers['x-test-api-key'] as string;
const configuredTestKey = process.env.TEST_API_SECRET_KEY;

if (configuredTestKey && testApiKey && testApiKey === configuredTestKey) {
  // Creates user without proper validation
  request.user = {
    id: devUserId,
    email: devEmail,
    // ... minimal validation
  };
  return true;
}
```

**Vulnerabilities:**
- Simple string comparison (not constant-time)
- No rate limiting on failed attempts
- Test key could be leaked in logs
- No audit trail for test key usage
- Weak user object construction

**Attack Vectors:**
- Timing attack to discover test key
- Brute force with no rate limiting
- Test key left enabled in production

#### 3. Stream Token Backward Compatibility Issues

**Location:** Lines 114-148

**Issue:** Multiple fallback mechanisms create security confusion

```typescript
// Try as JWT first
if (queryToken && !bearerToken) {
  try {
    const claims = this.streamTokenService.verifyToken(queryToken);
    // ... falls back to stream token
  } catch {
    // Not a stream token, that's fine - it's a regular JWT
  }
}
```

**Vulnerabilities:**
- Silent failure on invalid tokens
- Multiple authentication paths increase attack surface
- No logging of authentication method used
- Difficult to audit which auth path was taken

#### 4. Error Handling Exposes Information

**Location:** Lines 128-149

**Issue:** Error messages could leak information

```typescript
this.logger.warn('Token validation failed', {
  reason: (error as Error)?.message,
  source: bearerToken ? 'header' : 'query',
});
```

**Vulnerabilities:**
- Error messages may leak token format details
- Source information helps attackers refine attacks
- No generic error response to clients

### Required Test Cases

**Before any fixes can be made, comprehensive tests must cover:**

#### Token Validation Tests:
- [ ] Malformed Bearer token format (missing space, extra spaces, etc.)
- [ ] Oversized tokens (DoS protection)
- [ ] Tokens with null bytes or special characters
- [ ] Empty tokens after trimming
- [ ] Tokens with SQL injection attempts
- [ ] Tokens with XSS payloads

#### API Key Authentication Tests:
- [ ] Timing attack resistance verification
- [ ] Rate limiting on failed API key attempts
- [ ] API key not logged in error messages
- [ ] Audit trail creation for API key usage
- [ ] API key disabled in production environments
- [ ] Invalid API key format handling

#### Token Expiration Tests:
- [ ] Expired JWT rejection
- [ ] Token with future expiration
- [ ] Token with invalid expiration format
- [ ] Token expiration edge cases (exactly at boundary)

#### Stream Token Tests:
- [ ] Valid stream token acceptance
- [ ] Invalid stream token rejection
- [ ] JWT vs stream token disambiguation
- [ ] Stream token without proper claims
- [ ] Audit logging for each auth method

#### Error Handling Tests:
- [ ] Generic error messages to clients
- [ ] No sensitive info in error responses
- [ ] Proper logging without token values
- [ ] Rate limiting on authentication errors

#### Integration Tests:
- [ ] Multiple authentication methods in sequence
- [ ] Fallback behavior verification
- [ ] Request flow with each auth method
- [ ] Security headers validation

---

## Issue api-032: Roles Guard Security Audit

**File:** `/Users/golfergeek/projects/golfergeek/orchestrator-ai-v2/apps/api/src/auth/guards/roles.guard.ts`
**Priority:** HIGH
**Current Coverage:**
- Lines: 0% (0/40)
- Functions: 0% (0/6)
- Statements: 0% (0/43)
- Branches: 0% (0/14)

### Security Findings

#### 1. Role Bypass Through Missing User Profile

**Location:** Lines 76-88

**Issue:** Weak validation of authenticated user

```typescript
const user = request.user;

if (!user || !user.id) {
  throw new ForbiddenException('Authentication required');
}
```

**Vulnerabilities:**
- Only checks for `user.id`, not full user object validation
- No verification that user came from proper authentication
- Could be bypassed by injecting minimal user object upstream

**Attack Vectors:**
- Middleware injection: Add `request.user = { id: 'attacker' }`
- Race condition: Modify user object between guards
- Type confusion: Pass non-string user.id

#### 2. Database Query Injection Risk

**Location:** Lines 119-138

**Issue:** Direct user ID usage in database query

```typescript
private async getUserProfile(userId: string): Promise<UserProfile | null> {
  const { data: result, error } = await this.supabaseService
    .getServiceClient()
    .from('users')
    .select('id, email, display_name, roles, created_at, updated_at')
    .eq('id', userId)  // Direct parameter usage
    .single();
```

**Vulnerabilities:**
- No validation of userId format
- Could accept malformed UUIDs
- No rate limiting on profile queries
- Service client bypasses RLS (noted in comment but risky)

**Attack Vectors:**
- Pass non-UUID as userId
- Pass SQL injection attempts in userId
- DoS through repeated profile lookups
- Privilege escalation by bypassing RLS

#### 3. Implicit Role Assignment

**Location:** Lines 143-159

**Issue:** Automatic role assignment could be exploited

```typescript
private userHasAnyRole(userRoles: string[], requiredRoles: UserRole[]): boolean {
  if (!userRoles || userRoles.length === 0) {
    // If user has no roles, they only have implicit 'user' role
    userRoles = [UserRole.USER];
  }
  // ...
}
```

**Vulnerabilities:**
- Implicit role assignment could bypass restrictions
- No audit of implicit role grants
- Could allow access to endpoints requiring 'user' role by default
- Role validation happens after implicit assignment

**Attack Vectors:**
- Create user with no roles
- Access 'user' role protected endpoints
- Exploit difference between explicit and implicit roles

#### 4. Role Validation Logic Issues

**Location:** Lines 153-158

**Issue:** Role validation uses filter which could hide invalid roles

```typescript
const validUserRoles = userRoles.filter((role) => isValidUserRole(role));

return requiredRoles.some((requiredRole) =>
  validUserRoles.includes(requiredRole),
);
```

**Vulnerabilities:**
- Invalid roles silently filtered out (no error/warning)
- User could have invalid roles in database
- No audit of filtered roles
- Could bypass checks if all roles are invalid

### Required Test Cases

**Before any fixes can be made, comprehensive tests must cover:**

#### Role Authorization Tests:
- [ ] User with required role granted access
- [ ] User without required role denied access
- [ ] User with multiple roles (some valid, some not)
- [ ] User with no roles gets implicit 'user' role
- [ ] Admin role access to admin-only endpoint
- [ ] Invalid role strings in database

#### User Profile Validation Tests:
- [ ] Missing user object in request
- [ ] User object with only ID (minimal object)
- [ ] User object with malformed ID
- [ ] User profile not found in database
- [ ] Database error handling
- [ ] User profile with null/undefined roles

#### Database Security Tests:
- [ ] UUID validation for user ID
- [ ] Non-UUID user ID rejection
- [ ] SQL injection attempts in user ID
- [ ] Rate limiting on profile queries
- [ ] Service client RLS bypass is necessary
- [ ] Concurrent profile lookups

#### Role Bypass Prevention Tests:
- [ ] Cannot inject user object upstream
- [ ] Cannot modify user object between guards
- [ ] Cannot use type confusion on user.id
- [ ] Cannot exploit implicit role assignment
- [ ] Role validation before implicit assignment

#### Integration Tests:
- [ ] Full request flow with role check
- [ ] Multiple guards in sequence
- [ ] Role decorator combinations
- [ ] Error handling across guards

---

## Issue api-037: API Key Guard Security Analysis

**File:** `/Users/golfergeek/projects/golfergeek/orchestrator-ai-v2/apps/api/src/agent2agent/guards/api-key.guard.ts`
**Priority:** MEDIUM (has good test coverage but some gaps)
**Current Coverage:**
- Lines: 84.5% (120/142) ✓ ADEQUATE
- Functions: 94.44% (17/18) ✓ ADEQUATE
- Statements: 84.61% (121/143) ✓ ADEQUATE
- Branches: 69.79% (67/96) ⚠ BELOW THRESHOLD

### Security Findings

#### 1. GOOD: Timing-Safe Comparison

**Location:** Lines 266-284

**Status:** SECURE - Uses constant-time comparison

```typescript
private safeCompare(expected: string, stored: string, encoding: BufferEncodingOption): boolean {
  try {
    const expectedBuffer = this.toBuffer(expected, encoding);
    const storedBuffer = this.toBuffer(stored, encoding);
    if (expectedBuffer.length !== storedBuffer.length) {
      return false;
    }
    return timingSafeEqual(expectedBuffer, storedBuffer);
  } catch (error) {
    // Error handling
  }
}
```

**Analysis:**
- ✓ Uses `timingSafeEqual` from crypto module
- ✓ Compares buffer lengths first
- ✓ Proper error handling
- ✓ Protected against timing attacks

#### 2. GOOD: Rate Limiting Implementation

**Location:** Lines 300-339

**Status:** SECURE - Proper rate limiting with configurable thresholds

```typescript
private enforceRateLimit(orgSlug: string, fingerprint: string, aliases: string[]) {
  if (!this.rateLimit || this.rateLimit <= 0) {
    return;
  }
  // ... rate limit logic
}
```

**Analysis:**
- ✓ Per-key rate limiting
- ✓ Configurable limits via environment
- ✓ Proper reset windows
- ✓ Returns retry-after header

#### 3. ISSUE: Cache Invalidation Gaps

**Location:** Lines 26-33, 144-173

**Issue:** Credential cache could serve stale credentials

```typescript
private readonly credentialCache = new Map<
  string,
  { record: OrganizationCredentialRecord; expiresAt: number }
>();
```

**Vulnerabilities:**
- Cache TTL is fixed (5 minutes default)
- No cache invalidation on credential rotation
- Stale credentials could be used after revocation
- No distributed cache for multi-instance deployments

**Attack Vectors:**
- Rotate API key, old key still works for up to 5 minutes
- Multiple API instances have different cache states
- Credential revocation not immediately effective

#### 4. ISSUE: Algorithm Validation Could Be Stricter

**Location:** Lines 196-214

**Issue:** Only supports sha256 and sha512, but validation is permissive

```typescript
private normalizeAlgorithm(value: unknown): string | null {
  // ... normalization logic
  switch (normalized) {
    case 'sha256':
    case 'sha512':
      return normalized;
    default:
      this.logger.warn(`Unsupported hash algorithm "${value}" ...`);
      return null;  // Rejects unsupported algorithms
  }
}
```

**Vulnerabilities:**
- Returns null for unsupported algorithms, could default to insecure comparison
- No explicit validation of algorithm strength
- Could accept deprecated hash algorithms in future

#### 5. ISSUE: Logging Could Leak Sensitive Info

**Location:** Lines 341-365

**Issue:** Logging includes fingerprints and aliases

```typescript
private logAttempt(params: { ... }) {
  const payload = {
    event: 'agent_api_key_check',
    organization: params.orgSlug ?? 'global',
    alias: params.alias ?? ApiKeyGuard.DEFAULT_ALIAS,
    fingerprint: params.fingerprint,  // Includes hash of API key
    status: params.status,
    timestamp: new Date().toISOString(),
    ...(params.extra ?? {}),
  };
}
```

**Vulnerabilities:**
- Fingerprint includes API key material (hashed but still sensitive)
- Logs could be compromised, exposing patterns
- No log rotation or secure log storage enforced
- Organization slugs in logs could leak customer info

### Required Additional Test Cases

**Tests needed to achieve 70%+ branch coverage:**

#### Cache Edge Cases:
- [ ] Cache expiry at exact TTL boundary
- [ ] Credential rotation during cache validity
- [ ] Multiple instances with different cache states
- [ ] Cache invalidation on credential update
- [ ] Cache miss vs cache hit behavior

#### Error Handling Branches:
- [ ] Database errors during lookup
- [ ] Invalid encryption metadata formats
- [ ] Malformed buffer encodings
- [ ] Hash computation failures
- [ ] Invalid configuration values

#### Algorithm Validation:
- [ ] Unsupported hash algorithm rejection
- [ ] Null/undefined algorithm handling
- [ ] Case sensitivity in algorithm names
- [ ] Empty string algorithm
- [ ] Algorithm with whitespace

#### Rate Limiting Edge Cases:
- [ ] Rate limit exactly at threshold
- [ ] Rate limit reset at window boundary
- [ ] Concurrent requests at rate limit
- [ ] Rate limit with zero limit configured
- [ ] Rate limit with negative limit

#### Logging Security:
- [ ] No API keys in logs
- [ ] Fingerprints properly hashed
- [ ] Log levels appropriate for events
- [ ] No PII in error logs

---

## Issue api-029: PII Processing Services Security Audit

### PII Service Analysis

**File:** `/Users/golfergeek/projects/golfergeek/orchestrator-ai-v2/apps/api/src/llms/pii/pii.service.ts`
**Priority:** HIGH
**Current Coverage:**
- Lines: 5.68% (5/88)
- Functions: 0% (0/24)
- Statements: 7.52% (7/93)
- Branches: 0% (0/40)

#### Security Findings

#### 1. CRITICAL: No Validation of PII Detection Results

**Location:** Lines 148-159

**Issue:** Trusts PIIPatternService results without validation

```typescript
const detectionResult = await this.piiPatternService.detectPII(prompt, {
  minConfidence: 0.8,
  maxMatches: 100,
});

const convertedMatches = this.convertPIIMatches(detectionResult.matches);
```

**Vulnerabilities:**
- No validation of match indices (startIndex, endIndex)
- No bounds checking on matches array
- Could have overlapping matches
- No validation of confidence scores
- maxMatches could be exceeded

**Attack Vectors:**
- Malicious PII pattern service could return invalid indices
- Out-of-bounds access on prompt string
- DoS by returning huge match arrays
- False positives causing incorrect blocking

#### 2. ISSUE: Showstopper Detection Logic

**Location:** Lines 161-224

**Issue:** Early exit could leak information about PII types

```typescript
const showstopperMatches = convertedMatches.filter(
  (match) => match.severity === 'showstopper',
);

if (showstopperMatches.length > 0) {
  this.logger.warn(
    `🛑 [PII-SERVICE] SHOWSTOPPER DETECTED - Immediate blocking`,
  );
  // Returns detailed info about PII types found
  return { metadata, originalPrompt: prompt };
}
```

**Vulnerabilities:**
- Error message indicates which PII types were found
- Could be used to probe for specific PII patterns
- Timing differences between showstopper and non-showstopper
- Original prompt returned in metadata (could be logged)

**Attack Vectors:**
- Probe for specific PII patterns by observing responses
- Use timing analysis to detect PII presence
- Harvest PII detection logic

#### 3. CRITICAL: Local Provider Bypass

**Location:** Lines 93-141

**Issue:** Local provider detection could be spoofed

```typescript
const isLocalProvider =
  (options.providerName as string | undefined)?.toLowerCase() === 'ollama' ||
  (options.provider as string | undefined)?.toLowerCase() === 'ollama';

if (isLocalProvider) {
  // Skip ALL PII processing
  return { metadata: localMetadata, originalPrompt: prompt };
}
```

**Vulnerabilities:**
- Simple string comparison, no authentication
- Could be spoofed by setting providerName = 'ollama'
- No validation that request actually goes to local provider
- Bypasses all PII protection

**Attack Vectors:**
- Set provider to 'ollama' but route to external provider
- Leak PII to external services by spoofing local provider
- Bypass PII policies entirely

#### 4. ISSUE: Error Handling Allows Requests

**Location:** Lines 237-280

**Issue:** On error, allows request without PII protection

```typescript
} catch (error) {
  // On error, return metadata indicating failure but allow request
  const errorMetadata: PIIProcessingMetadata = {
    piiDetected: false,
    showstopperDetected: false,
    // ...
    policyDecision: {
      allowed: true,  // ALLOWS REQUEST
      blocked: false,
      // ...
    }
  };
  return { metadata: errorMetadata, originalPrompt: prompt };
}
```

**Vulnerabilities:**
- Fail-open policy could leak PII on errors
- Attacker could trigger errors to bypass PII protection
- No audit of failed PII checks
- Could lead to PII exposure

**Attack Vectors:**
- Trigger errors in PII detection service
- Bypass PII protection via error conditions
- Send PII during service outages

### Dictionary Pseudonymizer Service Analysis

**File:** `/Users/golfergeek/projects/golfergeek/orchestrator-ai-v2/apps/api/src/llms/pii/dictionary-pseudonymizer.service.ts`
**Priority:** HIGH
**Current Coverage:**
- Lines: 3.33% (3/90)
- Functions: 0% (0/10)
- Statements: 5.15% (5/97)
- Branches: 0% (0/39)

#### Security Findings

#### 1. CRITICAL: Case-Insensitive Replacement Security Issue

**Location:** Lines 199-214

**Issue:** Case-insensitive regex could cause incorrect replacements

```typescript
const regex = new RegExp(this.escapeRegex(entry.originalValue), 'gi');
const matches = processedText.match(regex);

if (matches && matches.length > 0) {
  processedText = processedText.replace(regex, entry.pseudonym);
  mappings.push(entry);
}
```

**Vulnerabilities:**
- Case-insensitive matching could replace unintended text
- No word boundary checking
- Could replace partial words
- Pseudonym format not validated

**Attack Vectors:**
- "John" matches "johnny", "johnathan", etc.
- Partial word replacements corrupt text
- Context loss through over-aggressive replacement

**Example:**
```
Original: "Johnson Medical Center"
Dictionary: { "Johnson": "PERSON_1" }
Result: "PERSON_1 Medical Center" (incorrect)
```

#### 2. ISSUE: Dictionary Merge Logic Could Be Exploited

**Location:** Lines 112-156

**Issue:** Complex merge logic with priority levels

```typescript
const byOriginal: Record<string, { pseudonym: string; src: 'agent' | 'org' | 'global'; row: Record<string, unknown> }> = {};

for (const row of merged) {
  // Complex priority logic
  const rank = (s: 'agent' | 'org' | 'global') =>
    s === 'agent' ? 3 : s === 'org' ? 2 : 1;

  if (rank(src) > rank(existing.src)) {
    // Override with higher priority
    byOriginal[key] = { pseudonym: r.pseudonym as string, src, row: row };
  }
}
```

**Vulnerabilities:**
- No validation of override conflicts
- Could have competing definitions
- No audit of overrides
- Warning logged but not enforced

**Attack Vectors:**
- Define conflicting dictionary entries
- Override global entries with org/agent entries
- Create confusion in pseudonymization

#### 3. CRITICAL: Reversal Could Fail Silently

**Location:** Lines 233-271

**Issue:** Reversal doesn't validate success

```typescript
async reversePseudonyms(text: string, mappings: DictionaryPseudonymMapping[]): Promise<DictionaryReversalResult> {
  let reversalCount = 0;

  for (const mapping of mappings) {
    const regex = new RegExp(this.escapeRegex(mapping.pseudonym), 'gi');
    const matches = processedText.match(regex);

    if (matches && matches.length > 0) {
      processedText = processedText.replace(regex, mapping.originalValue);
      reversalCount += matches.length;
    }
  }

  return Promise.resolve({ originalText: processedText, reversalCount, processingTimeMs });
}
```

**Vulnerabilities:**
- No validation that all pseudonyms were reversed
- Silent failure if pseudonyms not found
- Could return partial reversals
- No check for unreversed pseudonyms

**Attack Vectors:**
- LLM modifies pseudonyms in response
- Partial reversals leak pseudonym placeholders
- Users see "[PERSON_1]" instead of real names

#### 4. ISSUE: Cache Could Serve Stale Dictionary

**Location:** Lines 40-63

**Issue:** Fixed TTL cache with no invalidation

```typescript
private dictionaryCache: DictionaryPseudonymMapping[] | null = null;
private cacheExpiry: number = 0;
private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

private async loadDictionary(options?: {...}): Promise<DictionaryPseudonymMapping[]> {
  const now = Date.now();

  if (this.dictionaryCache && now < this.cacheExpiry) {
    return this.dictionaryCache;  // Return cached
  }
  // ... load from DB
}
```

**Vulnerabilities:**
- Dictionary updates not immediately effective
- Could use old pseudonyms for up to 5 minutes
- No cache invalidation API
- Multiple instances have inconsistent caches

### Pattern Redaction Service Analysis

**File:** `/Users/golfergeek/projects/golfergeek/orchestrator-ai-v2/apps/api/src/llms/pii/pattern-redaction.service.ts`
**Priority:** HIGH
**Current Coverage:**
- Lines: 5.63% (4/71)
- Functions: 0% (0/8)
- Statements: 8.21% (6/73)
- Branches: 0% (0/25)

#### Security Findings

#### 1. CRITICAL: Index Manipulation Vulnerability

**Location:** Lines 96-137

**Issue:** Complex index-based string manipulation

```typescript
const sortedMatches = [...matchesToRedact].sort(
  (a, b) => b.startIndex - a.startIndex,
);

for (const match of sortedMatches) {
  processedText =
    processedText.substring(0, match.startIndex) +
    replacement +
    processedText.substring(match.endIndex);
}
```

**Vulnerabilities:**
- No bounds checking on startIndex/endIndex
- Could have negative indices
- Could exceed string length
- Overlapping matches not handled

**Attack Vectors:**
- Invalid match indices corrupt text
- Out-of-bounds access crashes service
- Overlapping matches cause double-redaction

#### 2. ISSUE: Redaction Placeholder Could Be Guessed

**Location:** Lines 113-120

**Issue:** Predictable placeholder format

```typescript
const baseReplacement = replacementMap[dataType] || `[${dataType.toUpperCase()}_REDACTED]`;

const replacement = instanceNumber > 1
  ? `${baseReplacement}_${instanceNumber}`
  : baseReplacement;
```

**Vulnerabilities:**
- Format is predictable: [TYPE_REDACTED_N]
- LLM could reconstruct redacted data
- Pattern-based attacks on placeholders

**Attack Vectors:**
- LLM trained on redaction patterns
- Reverse-engineer original values
- Placeholder injection in prompts

#### 3. CRITICAL: Reversal Ordering Issues

**Location:** Lines 173-198

**Issue:** Reversal sorts by length, not original order

```typescript
const sortedMappings = [...mappings].sort(
  (a, b) => b.redactedValue.length - a.redactedValue.length,
);
```

**Vulnerabilities:**
- Could reverse in wrong order
- Partial matches could cause incorrect reversal
- No validation of reversal order

**Attack Vectors:**
- Overlapping redacted values
- Incorrect reversal order corrupts text
- Nested redactions fail

### Required Test Cases for PII Services

**Before any fixes can be made, comprehensive tests must cover:**

#### PII Service Tests:
- [ ] Valid PII detection and metadata creation
- [ ] Showstopper PII immediate blocking
- [ ] Local provider bypass (with validation)
- [ ] External provider pseudonymization
- [ ] Invalid match indices handling
- [ ] Out-of-bounds match indices
- [ ] Empty prompt handling
- [ ] Null/undefined provider options
- [ ] Error handling (fail-closed, not fail-open)
- [ ] Audit logging for PII decisions
- [ ] Timing attack resistance
- [ ] Concurrent requests with same prompt

#### Dictionary Pseudonymizer Tests:
- [ ] Case-insensitive matching correctness
- [ ] Word boundary handling
- [ ] Partial word replacement prevention
- [ ] Multiple occurrences of same value
- [ ] Overlapping dictionary entries
- [ ] Dictionary merge priority logic
- [ ] Cache expiry and refresh
- [ ] Cache invalidation
- [ ] Reversal completeness validation
- [ ] Reversal failure detection
- [ ] Empty dictionary handling
- [ ] Malformed dictionary entries

#### Pattern Redaction Tests:
- [ ] Valid pattern detection and redaction
- [ ] Index bounds checking
- [ ] Negative index handling
- [ ] Overlapping pattern matches
- [ ] Multiple instances of same pattern
- [ ] Placeholder uniqueness
- [ ] Reversal order correctness
- [ ] Reversal completeness validation
- [ ] Empty text handling
- [ ] Invalid replacement map

#### Integration Tests:
- [ ] End-to-end PII processing flow
- [ ] Dictionary + pattern redaction together
- [ ] Pseudonymization + reversal round-trip
- [ ] Error propagation through stack
- [ ] Performance under load
- [ ] Concurrent processing

---

## Security Checklist Status

- [X] Token validation handles malformed tokens - NOT TESTED
- [X] Token validation handles expired tokens - NOT TESTED
- [X] Role checks cannot be bypassed - NOT TESTED
- [X] API keys are compared in constant time - TESTED ✓
- [X] PII is properly redacted before logging - NOT TESTED
- [X] No sensitive data in error messages - PARTIALLY TESTED

---

## Overall Assessment

### Test Coverage Summary

| Component | Lines | Functions | Statements | Branches | Status |
|-----------|-------|-----------|------------|----------|--------|
| jwt-auth.guard.ts | 15.15% | 20% | 17.64% | 0% | INADEQUATE |
| roles.guard.ts | 0% | 0% | 0% | 0% | INADEQUATE |
| api-key.guard.ts | 84.5% | 94.44% | 84.61% | 69.79% | ADEQUATE |
| pii.service.ts | 5.68% | 0% | 7.52% | 0% | INADEQUATE |
| dictionary-pseudonymizer.service.ts | 3.33% | 0% | 5.15% | 0% | INADEQUATE |
| pattern-redaction.service.ts | 5.63% | 0% | 8.21% | 0% | INADEQUATE |

### Critical Vulnerabilities Found

#### HIGH SEVERITY:
1. Test API key authentication bypass (jwt-auth.guard.ts)
2. Role validation can be bypassed (roles.guard.ts)
3. Local provider detection can be spoofed (pii.service.ts)
4. PII service fails open on errors (pii.service.ts)
5. Reversal can fail silently (dictionary-pseudonymizer.service.ts)
6. Index manipulation vulnerabilities (pattern-redaction.service.ts)

#### MEDIUM SEVERITY:
1. Token extraction doesn't validate format (jwt-auth.guard.ts)
2. Stream token fallback creates confusion (jwt-auth.guard.ts)
3. Service client bypasses RLS (roles.guard.ts)
4. Case-insensitive replacement issues (dictionary-pseudonymizer.service.ts)
5. Redaction placeholder predictability (pattern-redaction.service.ts)

#### LOW SEVERITY:
1. Error handling could leak information (jwt-auth.guard.ts)
2. Logging could expose patterns (api-key.guard.ts)
3. Cache invalidation gaps (api-key.guard.ts, dictionary-pseudonymizer.service.ts)

---

## Recommendations

### Immediate Actions (Before ANY Code Changes):

1. **DO NOT MAKE CHANGES** to security-critical code without adequate test coverage
2. **WRITE COMPREHENSIVE TESTS** covering all identified vulnerabilities
3. **ACHIEVE MINIMUM COVERAGE**:
   - Lines: 75%+
   - Branches: 70%+
   - Functions: 75%+
   - Critical paths: 85%+

### Priority Order for Test Development:

1. **Priority 1 (CRITICAL)**: Auth guards (jwt-auth, roles)
   - These protect all endpoints
   - Vulnerabilities affect entire API
   - Target: 90%+ coverage on critical paths

2. **Priority 2 (HIGH)**: PII Service
   - Controls PII detection and blocking
   - Errors could leak sensitive data
   - Target: 85%+ coverage

3. **Priority 3 (HIGH)**: Dictionary Pseudonymizer
   - Handles actual PII data
   - Reversal failures expose pseudonyms
   - Target: 85%+ coverage

4. **Priority 4 (MEDIUM)**: Pattern Redaction Service
   - Secondary PII protection layer
   - Less critical with proper detection
   - Target: 80%+ coverage

### Test Development Approach:

1. Start with **happy path tests** (basic functionality)
2. Add **negative tests** (invalid inputs, error conditions)
3. Add **security tests** (attack vectors, bypass attempts)
4. Add **edge case tests** (boundary conditions, race conditions)
5. Add **integration tests** (full request flows)

### After Tests Are Written:

1. Run full test suite and verify coverage
2. Review test quality (not just quantity)
3. Get security review of test cases
4. Then and only then, implement fixes
5. Verify fixes with tests
6. Run security regression tests

---

## Files Requiring Immediate Attention

### Cannot Be Modified Until Tests Exist:

1. `/Users/golfergeek/projects/golfergeek/orchestrator-ai-v2/apps/api/src/auth/guards/jwt-auth.guard.ts`
2. `/Users/golfergeek/projects/golfergeek/orchestrator-ai-v2/apps/api/src/auth/guards/roles.guard.ts`
3. `/Users/golfergeek/projects/golfergeek/orchestrator-ai-v2/apps/api/src/llms/pii/pii.service.ts`
4. `/Users/golfergeek/projects/golfergeek/orchestrator-ai-v2/apps/api/src/llms/pii/dictionary-pseudonymizer.service.ts`
5. `/Users/golfergeek/projects/golfergeek/orchestrator-ai-v2/apps/api/src/llms/pii/pattern-redaction.service.ts`

### Can Be Improved (Has Adequate Coverage):

1. `/Users/golfergeek/projects/golfergeek/orchestrator-ai-v2/apps/api/src/agent2agent/guards/api-key.guard.ts`
   - Current: 84.5% lines, 69.79% branches
   - Needs: Branch coverage improvements (target 75%+)
   - Focus: Edge cases and error handling paths

---

## Next Steps

1. **Create Test Files**:
   - `jwt-auth.guard.spec.ts`
   - `roles.guard.spec.ts`
   - `pii.service.spec.ts`
   - `dictionary-pseudonymizer.service.spec.ts`
   - `pattern-redaction.service.spec.ts`

2. **Implement Test Cases** (see detailed test requirements above)

3. **Verify Coverage** meets thresholds

4. **Get Security Review** of test cases

5. **Then Implement Fixes** for identified vulnerabilities

6. **Verify Fixes** with tests

7. **Run Security Regression Suite**

---

## Conclusion

This audit identified multiple critical security vulnerabilities in authentication, authorization, and PII processing components. However, the extremely low test coverage (0-17% for most components) prevents safe remediation of these issues.

**The immediate priority is test development, not bug fixes.** Once adequate test coverage exists, the identified vulnerabilities can be addressed safely with confidence that fixes don't introduce regressions.

The API key guard serves as a good example of adequate testing - it has high coverage and can be safely modified. The other components must reach similar coverage levels before changes can be made.

---

**Report Generated:** 2025-12-29
**Next Review:** After test coverage reaches thresholds
