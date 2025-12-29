# Test Requirements: PII Processing Services

**Components:** PII Service, Dictionary Pseudonymizer, Pattern Redaction
**Files:**
- `/apps/api/src/llms/pii/pii.service.ts`
- `/apps/api/src/llms/pii/dictionary-pseudonymizer.service.ts`
- `/apps/api/src/llms/pii/pattern-redaction.service.ts`

**Priority:** CRITICAL
**Target Coverage:**
- Lines: 85%+
- Branches: 80%+
- Functions: 85%+
- Critical Security Paths: 100%

---

## PII Service Test Requirements

### Test File Location
`/apps/api/src/llms/pii/pii.service.spec.ts`

### Required Test Suites

#### 1. PII Detection Tests

**Purpose:** Verify PII detection is accurate and secure

```typescript
describe('PII Detection', () => {
  describe('Valid PII Detection', () => {
    it('should detect PII using PIIPatternService')
    it('should convert pattern matches to metadata format')
    it('should include all match details (type, severity, confidence)')
    it('should calculate data type summaries correctly')
    it('should calculate severity breakdowns correctly')
  });

  describe('Match Validation', () => {
    it('should validate match start indices are within bounds')
    it('should validate match end indices are within bounds')
    it('should validate start index < end index')
    it('should reject negative indices')
    it('should reject indices exceeding prompt length')
    it('should handle overlapping matches')
  });

  describe('Detection Edge Cases', () => {
    it('should handle empty prompts')
    it('should handle prompts with no PII')
    it('should handle prompts with only whitespace')
    it('should handle very long prompts')
    it('should handle prompts with special characters')
    it('should handle unicode in prompts')
  });
});
```

#### 2. Showstopper Detection Tests

**Purpose:** Verify showstopper PII blocks requests

```typescript
describe('Showstopper Detection', () => {
  describe('Showstopper Blocking', () => {
    it('should immediately block when showstopper PII detected')
    it('should set showstopperDetected flag to true')
    it('should set policyDecision.blocked to true')
    it('should include all showstopper types in metadata')
    it('should not create pseudonym instructions for showstoppers')
    it('should return early without further processing')
  });

  describe('Showstopper Types', () => {
    it('should block SSN (Social Security Number)')
    it('should block credit card numbers')
    it('should block other showstopper PII types')
    it('should handle multiple showstopper types')
  });

  describe('Showstopper Messages', () => {
    it('should generate user-friendly showstopper message')
    it('should indicate which types were detected')
    it('should not leak actual PII values')
    it('should provide actionable guidance')
  });

  describe('Timing Security', () => {
    it('should not have different timing for showstopper vs non-showstopper')
    it('should prevent timing-based PII probing')
  });
});
```

#### 3. Local Provider Tests

**Purpose:** Verify local provider bypass is secure

```typescript
describe('Local Provider Handling', () => {
  describe('Provider Detection', () => {
    it('should detect Ollama from providerName option')
    it('should detect Ollama from provider option')
    it('should be case-insensitive for provider name')
    it('should skip PII processing for local providers')
  });

  describe('Local Provider Security', () => {
    it('should validate request actually goes to local provider')
    it('should not accept spoofed provider names')
    it('should audit local provider bypasses')
    it('should verify provider configuration')
  });

  describe('Local Provider Metadata', () => {
    it('should return minimal metadata for local providers')
    it('should indicate no PII processing was done')
    it('should set policyDecision.allowed to true')
    it('should document reason for bypass')
  });
});
```

#### 4. External Provider Tests

**Purpose:** Verify external provider handling

```typescript
describe('External Provider Handling', () => {
  describe('PII Processing', () => {
    it('should process PII for external providers')
    it('should create pseudonym instructions')
    it('should include request ID in instructions')
    it('should set correct processing flow')
  });

  describe('Pseudonym Instructions', () => {
    it('should create instructions for flaggable PII')
    it('should not create instructions for info-level PII')
    it('should include target matches')
    it('should include context information')
  });

  describe('External Provider Messages', () => {
    it('should generate appropriate user messages')
    it('should indicate what will be pseudonymized')
    it('should explain protection measures')
  });
});
```

#### 5. Error Handling Tests

**Purpose:** Verify error handling is secure (fail-closed)

```typescript
describe('Error Handling', () => {
  describe('Detection Errors', () => {
    it('should handle PIIPatternService errors')
    it('should fail CLOSED on detection errors (block request)')
    it('should log errors without PII')
    it('should return error metadata structure')
  });

  describe('Error Security', () => {
    it('should NEVER fail open (allow PII on error)')
    it('should audit all error conditions')
    it('should not leak error details to clients')
    it('should retry on transient errors')
  });

  describe('Error Scenarios', () => {
    it('should handle null/undefined prompt')
    it('should handle invalid options')
    it('should handle malformed detection results')
    it('should handle database connection errors')
  });
});
```

#### 6. Metadata Generation Tests

**Purpose:** Verify metadata structure is correct

```typescript
describe('Metadata Generation', () => {
  describe('Detection Results', () => {
    it('should include total match count')
    it('should include all flagged matches')
    it('should include data type summary')
    it('should include severity breakdown')
  });

  describe('Policy Decisions', () => {
    it('should set allowed flag correctly')
    it('should set blocked flag correctly')
    it('should include violations list')
    it('should include reasoning path')
    it('should indicate context (local/external)')
  });

  describe('User Messages', () => {
    it('should generate summary message')
    it('should include details list')
    it('should include actions taken')
    it('should set isBlocked flag correctly')
  });

  describe('Processing Flow', () => {
    it('should track processing steps')
    it('should include timestamps')
    it('should indicate final flow state')
  });
});
```

#### 7. Integration Tests

**Purpose:** Verify full PII processing flow

```typescript
describe('Integration Tests', () => {
  it('should integrate with PIIPatternService')
  it('should integrate with SupabaseService')
  it('should handle complete detection to decision flow')
  it('should work with CentralizedRoutingService')
  it('should handle concurrent PII checks')
  it('should maintain performance under load')
});
```

---

## Dictionary Pseudonymizer Service Test Requirements

### Test File Location
`/apps/api/src/llms/pii/dictionary-pseudonymizer.service.spec.ts`

### Required Test Suites

#### 1. Dictionary Loading Tests

**Purpose:** Verify dictionary loading is secure

```typescript
describe('Dictionary Loading', () => {
  describe('Valid Dictionary Loading', () => {
    it('should load active dictionary entries from database')
    it('should filter by organization slug when provided')
    it('should filter by agent slug when provided')
    it('should handle global entries')
    it('should cache loaded entries')
  });

  describe('Dictionary Priority', () => {
    it('should prefer agent-scoped over org-scoped entries')
    it('should prefer org-scoped over global entries')
    it('should merge entries with correct precedence')
    it('should warn on conflicting overrides')
    it('should audit priority decisions')
  });

  describe('Cache Management', () => {
    it('should cache entries for configured TTL')
    it('should expire cache after TTL')
    it('should invalidate cache on clearCache()')
    it('should handle concurrent cache access')
  });

  describe('Dictionary Validation', () => {
    it('should reject null original_value entries')
    it('should reject null pseudonym entries')
    it('should validate data_type is present')
    it('should handle malformed database entries')
  });
});
```

#### 2. Pseudonymization Tests

**Purpose:** Verify text pseudonymization is correct

```typescript
describe('Pseudonymization', () => {
  describe('Basic Replacement', () => {
    it('should replace original values with pseudonyms')
    it('should handle case-insensitive matching')
    it('should replace all occurrences of same value')
    it('should preserve text structure around replacements')
  });

  describe('Word Boundary Handling', () => {
    it('should NOT replace partial word matches')
    it('should handle word boundaries correctly')
    it('should not replace "John" in "Johnson"')
    it('should not replace "John" in "St. Johns"')
  });

  describe('Multiple Replacements', () => {
    it('should handle multiple different values in text')
    it('should handle multiple occurrences of same value')
    it('should maintain mapping for each replacement')
    it('should process in correct order')
  });

  describe('Edge Cases', () => {
    it('should handle empty text')
    it('should handle text with no matches')
    it('should handle very long text')
    it('should handle special characters in values')
    it('should handle unicode characters')
  });
});
```

#### 3. Reversal Tests

**Purpose:** Verify pseudonym reversal is complete

```typescript
describe('Reversal', () => {
  describe('Basic Reversal', () => {
    it('should reverse all pseudonyms back to originals')
    it('should handle case-insensitive reversal')
    it('should reverse all occurrences')
    it('should return original text structure')
  });

  describe('Reversal Validation', () => {
    it('should validate all pseudonyms were reversed')
    it('should detect unreversed pseudonyms')
    it('should throw error if reversal incomplete')
    it('should audit reversal failures')
  });

  describe('LLM-Modified Pseudonyms', () => {
    it('should handle LLM changing pseudonym case')
    it('should detect if LLM modified pseudonym')
    it('should warn about unreversed placeholders')
    it('should not leave [PERSON_1] in output')
  });

  describe('Reversal Edge Cases', () => {
    it('should handle empty text')
    it('should handle text with no pseudonyms')
    it('should handle partial matches')
    it('should handle overlapping pseudonyms')
  });
});
```

#### 4. Round-Trip Tests

**Purpose:** Verify pseudonymization + reversal preserves data

```typescript
describe('Round-Trip Tests', () => {
  describe('Perfect Round-Trip', () => {
    it('should preserve text through pseudonymize + reverse')
    it('should preserve all original values')
    it('should preserve text structure')
    it('should preserve special characters')
  });

  describe('LLM Simulation', () => {
    it('should handle LLM modifying surrounding text')
    it('should reverse even when context changes')
    it('should detect when reversal is impossible')
  });

  describe('Performance', () => {
    it('should handle large texts efficiently')
    it('should handle many pseudonyms efficiently')
    it('should complete within reasonable time')
  });
});
```

#### 5. Security Tests

**Purpose:** Verify pseudonymization is secure

```typescript
describe('Security Tests', () => {
  describe('PII Protection', () => {
    it('should never log original PII values')
    it('should never log pseudonyms in insecure contexts')
    it('should protect mapping data')
    it('should clear sensitive data after use')
  });

  describe('Injection Protection', () => {
    it('should escape regex special characters')
    it('should not allow regex injection')
    it('should validate all input strings')
  });

  describe('Cache Security', () => {
    it('should not cache sensitive PII')
    it('should only cache structure, not values')
    it('should clear cache on rotation')
  });
});
```

---

## Pattern Redaction Service Test Requirements

### Test File Location
`/apps/api/src/llms/pii/pattern-redaction.service.spec.ts`

### Required Test Suites

#### 1. Pattern Detection Tests

**Purpose:** Verify pattern-based PII detection

```typescript
describe('Pattern Detection', () => {
  describe('Valid Detection', () => {
    it('should detect PII patterns using PIIPatternService')
    it('should filter showstoppers when excludeShowstoppers=true')
    it('should include showstoppers when excludeShowstoppers=false')
    it('should respect minConfidence threshold')
    it('should respect maxMatches limit')
  });

  describe('Pattern Types', () => {
    it('should detect email patterns')
    it('should detect phone patterns')
    it('should detect SSN patterns')
    it('should detect custom patterns')
  });
});
```

#### 2. Redaction Tests

**Purpose:** Verify redaction is correct

```typescript
describe('Redaction', () => {
  describe('Basic Redaction', () => {
    it('should redact detected patterns')
    it('should use replacement values from database')
    it('should use default format when no replacement configured')
    it('should create unique placeholders for multiple instances')
  });

  describe('Index Handling', () => {
    it('should process matches from end to start (reverse order)')
    it('should handle correct string indices')
    it('should not corrupt text with wrong indices')
    it('should validate all indices are in bounds')
  });

  describe('Placeholder Format', () => {
    it('should use [TYPE_REDACTED] format')
    it('should add _N suffix for multiple instances')
    it('should ensure uniqueness of placeholders')
    it('should use configured replacement when available')
  });

  describe('Index Validation', () => {
    it('should reject negative start indices')
    it('should reject negative end indices')
    it('should reject indices exceeding text length')
    it('should reject start index >= end index')
    it('should handle overlapping patterns')
  });
});
```

#### 3. Reversal Tests

**Purpose:** Verify redaction reversal is complete

```typescript
describe('Reversal', () => {
  describe('Basic Reversal', () => {
    it('should reverse all redactions back to originals')
    it('should process in correct order (longest first)')
    it('should handle multiple instances correctly')
    it('should preserve text structure')
  });

  describe('Reversal Validation', () => {
    it('should validate all redactions were reversed')
    it('should count reversal operations')
    it('should detect unreversed redactions')
    it('should throw error if reversal incomplete')
  });

  describe('LLM-Modified Redactions', () => {
    it('should detect if LLM changed redaction placeholder')
    it('should warn about unreversed placeholders')
    it('should not leave [EMAIL_REDACTED] in output')
  });
});
```

#### 4. Integration with Dictionary Tests

**Purpose:** Verify pattern + dictionary work together

```typescript
describe('Pattern + Dictionary Integration', () => {
  describe('Combined Processing', () => {
    it('should work with dictionary pseudonymization')
    it('should apply patterns before dictionary')
    it('should apply dictionary before patterns')
    it('should handle both in correct order')
  });

  describe('Reversal Order', () => {
    it('should reverse patterns before dictionary')
    it('should reverse dictionary before patterns')
    it('should handle correct reversal order')
  });
});
```

#### 5. Security Tests

**Purpose:** Verify redaction is secure

```typescript
describe('Security Tests', () => {
  describe('PII Protection', () => {
    it('should never log original PII values')
    it('should never log redacted values in insecure contexts')
    it('should protect mapping data')
  });

  describe('Placeholder Security', () => {
    it('should not use predictable placeholders')
    it('should not allow placeholder injection')
    it('should validate placeholder format')
  });

  describe('Index Security', () => {
    it('should validate all indices')
    it('should prevent buffer over-reads')
    it('should prevent buffer over-writes')
  });
});
```

---

## Cross-Service Integration Tests

### Test File Location
`/apps/api/src/llms/pii/__tests__/pii-integration.spec.ts`

### Required Test Suites

```typescript
describe('PII Service Integration', () => {
  describe('Full PII Flow', () => {
    it('should handle detection -> decision -> pseudonymization -> reversal')
    it('should maintain data integrity throughout flow')
    it('should handle errors at each stage')
  });

  describe('Service Coordination', () => {
    it('should coordinate PIIService + DictionaryPseudonymizer')
    it('should coordinate PIIService + PatternRedaction')
    it('should coordinate all three services')
  });

  describe('Edge Cases', () => {
    it('should handle no PII detected')
    it('should handle only showstoppers')
    it('should handle mixed severity PII')
    it('should handle very large texts')
  });

  describe('Performance', () => {
    it('should complete processing within SLA')
    it('should handle concurrent requests')
    it('should not leak memory')
  });

  describe('Error Recovery', () => {
    it('should recover from detection errors')
    it('should recover from database errors')
    it('should maintain security on errors')
  });
});
```

---

## Test Implementation Notes

### Mock Setup

Each test suite should properly mock:
- `PIIPatternService` for pattern detection
- `SupabaseService` for database operations
- Database responses for dictionary and patterns
- Time functions for cache testing

### PII Test Data

Create realistic but fake PII for testing:
- Email addresses: test@example.com
- Phone numbers: 555-0100 format
- Names: Test Person, Sample User
- SSN: 000-00-0000 format (invalid but pattern-matching)
- Never use real PII in tests

### Security Test Guidelines

1. **Test Data Protection**: Verify PII never logged
2. **Test Error Paths**: Ensure fail-closed behavior
3. **Test Edge Cases**: Boundary conditions, malformed data
4. **Test Integration**: Full flows, not just units

### Coverage Requirements

- All identified vulnerabilities must have tests
- All code branches must be covered
- All error paths must be tested
- All security-critical paths must have 100% coverage

### Test Quality Criteria

Tests must be:
- **Clear**: Easy to understand what they test
- **Isolated**: Independent of other tests
- **Realistic**: Use realistic but fake PII
- **Fast**: Run quickly in CI/CD
- **Comprehensive**: Cover all security scenarios

---

## Success Criteria

PII services can be modified only after:

1. All test suites implemented
2. Coverage meets thresholds:
   - Lines: 85%+
   - Branches: 80%+
   - Functions: 85%+
   - Critical paths: 100%
3. All tests passing
4. Security review of test cases completed
5. Test quality review completed
6. PII test data review completed

---

## Next Steps

1. Create test files with describe blocks
2. Create PII test data fixtures
3. Implement test cases in priority order
4. Run tests and verify coverage
5. Fix any gaps in coverage
6. Get security review
7. Then and only then, fix vulnerabilities
