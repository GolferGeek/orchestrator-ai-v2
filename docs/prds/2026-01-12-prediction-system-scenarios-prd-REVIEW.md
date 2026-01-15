# PRD Review: Prediction System Scenarios

**Review Date:** 2026-01-12
**Reviewer:** AI Assistant
**Document:** `2026-01-12-prediction-system-scenarios-prd.md`

---

## Executive Summary

The PRD is **comprehensive and well-structured** but has several **consistency issues** that need addressing, particularly around API parameter naming conventions. The document is approximately **85% complete** with clear gaps identified in testing coverage and some implementation details.

**Overall Assessment:** ✅ **Good** - Needs minor corrections for consistency

---

## Critical Issues (Must Fix)

### 1. API Parameter Naming Inconsistency ⚠️ **HIGH PRIORITY**

**Problem:** The document states handlers use `camelCase` but examples are inconsistent.

**Location:** Lines 67-75, 193, 242-243, 283-284

**Current State:**
- Line 67-75: Documents that handlers use `camelCase`, payloads use `snake_case`
- Line 193: Uses `"universe_id"` (snake_case) ❌
- Line 242-243: Uses `"universeId"`, `"targetId"` (camelCase) ✅
- Line 283-284: Uses `"universeId"`, `"targetId"` (camelCase) ✅

**Fix Required:**
```typescript
// Line 193 - WRONG:
"universe_id": "<universe-id>",

// Should be:
"universeId": "<universe-id>",
```

**Recommendation:** Standardize all API examples to use `camelCase` for handler params as documented. The conversion to `snake_case` happens automatically at the service layer.

---

## Consistency Issues

### 2. Status Indicator Inconsistencies

**Issue:** Some items marked "✅ Implemented" still have "Remaining Work" items that seem critical.

**Examples:**
- **Line 173:** `✅ Implemented` but "E2E test for universe creation" is missing
- **Line 205:** `✅ Implemented` but "E2E test for target creation" is missing
- **Line 352:** `✅ Implemented` but only "✅ List only" - suggests partial implementation

**Recommendation:** 
- Use `⚠️ Partial` when core functionality exists but tests/documentation are missing
- Or clarify that "Implemented" means "code exists" and "Remaining Work" is for polish/testing

### 3. Missing Handler Action Documentation

**Issue:** Some handler actions mentioned in scenarios aren't in the Appendix.

**Examples:**
- `source-seen-items.list` and `source-seen-items.stats` mentioned in line 452 but not in Appendix
- `signals.handler` actions mentioned but not documented in Appendix
- `predictor.handler` actions referenced but not listed

**Recommendation:** Add a "Source Seen Items Handler" section to Appendix or note that handler doesn't exist yet.

### 4. Terminology Inconsistencies

**Issue:** Mixed use of terms across document.

**Examples:**
- "Predictor" vs "Predictor Queue" (lines 581-592)
- "Signal" vs "Signal Fingerprint" (lines 566-578)
- "Analyst" vs "Analyst Persona" (lines 346-357)

**Recommendation:** Standardize terminology in a glossary section or use consistent terms throughout.

---

## Completeness Gaps

### 5. Missing API Examples

**Issue:** Some scenarios lack API examples where they would be helpful.

**Missing Examples:**
- **Section 1.8** (Add/Configure Analysts) - No API example
- **Section 2.2** (See New Articles) - No API example
- **Section 2.3** (Watch Signals) - No API example
- **Section 4.1** (Review Queue) - No API example

**Recommendation:** Add API examples for all user-facing operations, even if handlers don't exist yet.

### 6. Incomplete Runner Documentation

**Issue:** Two runners are marked as "⚠️ Undocumented" but have some details.

**Location:** Lines 1001-1023

**Current State:**
- `expiration.runner` - Has description but marked undocumented
- `outcome-tracking.runner` - Has description but marked undocumented

**Recommendation:** Either:
- Move details to main runner table, or
- Create separate "Undocumented Runners" section with full details

### 7. Missing Error Scenarios

**Issue:** Error handling section (lines 1026-1074) is good but could be more comprehensive.

**Missing:**
- What happens when LLM service is down?
- What happens when database connection fails?
- What happens when Firecrawl quota is exceeded?
- What happens when prediction generation times out?

**Recommendation:** Expand error handling section with more failure modes.

### 8. Test Coverage Details

**Issue:** Test coverage summary (lines 1077-1107) is good but lacks specifics.

**Missing:**
- Which specific E2E tests exist? (14 tests but which ones?)
- What's the test data strategy?
- How are test scenarios isolated from production?

**Recommendation:** Add a "Test Coverage Details" subsection listing actual test files.

---

## Minor Issues

### 9. Formatting Inconsistencies

**Issue:** Some sections use tables, others use lists.

**Examples:**
- Phase 1 uses detailed tables with status columns
- Phase 3.3-3.8 uses a condensed table format
- Phase 4.2-4.9 uses a condensed table format

**Recommendation:** Standardize format - either all detailed tables or all condensed with consistent columns.

### 10. Cross-Reference Issues

**Issue:** Some sections reference other sections that could be linked.

**Examples:**
- Line 117: References frontend routes but no links
- Line 134: References UI components but no file paths
- Line 464: References ObservabilityEventsService but no link to implementation

**Recommendation:** Add markdown links to referenced sections/files where possible.

### 11. Date/Version Inconsistencies

**Issue:** Document has version 1.1 but last updated date is 2026-01-12.

**Recommendation:** Ensure version increments when significant changes are made.

---

## Strengths

✅ **Excellent Structure:** Well-organized by phases
✅ **Clear Status Tracking:** Status indicators help identify gaps
✅ **Comprehensive Handler Reference:** Appendix is very useful
✅ **Good Architecture Overview:** Entity hierarchy is clear
✅ **Real-world Considerations:** Storage strategy, error handling included
✅ **Implementation Priorities:** Sprint breakdown is helpful

---

## Recommendations Summary

### High Priority (Fix Before Demo)
1. ✅ Fix API parameter naming inconsistency (line 193)
2. ✅ Standardize status indicators (clarify "Implemented" vs "Complete")
3. ✅ Add missing API examples for key scenarios

### Medium Priority (Polish)
4. ⚠️ Add missing handler actions to Appendix
5. ⚠️ Expand error handling scenarios
6. ⚠️ Standardize terminology in glossary

### Low Priority (Nice to Have)
7. 📝 Add cross-references with markdown links
8. 📝 Standardize table formats across phases
9. 📝 Add test coverage details section

---

## Specific Line-by-Line Fixes

### Line 193 - Fix API Parameter
```diff
-      "universe_id": "<universe-id>",
+      "universeId": "<universe-id>",
```

### Line 447 - Clarify Status
```diff
- | ✅ Repository exists | ❌ No handler | ❌ No service | ✅ source-seen-item.repository | ❌ Missing |
+ | ⚠️ Partial | ❌ No handler | ❌ No service | ✅ source-seen-item.repository | ❌ Missing |
```

### Line 452 - Add to Appendix
Add new section after line 1257:
```markdown
### Source Seen Items Handler
- `source-seen-items.list` - List seen items for source/target
- `source-seen-items.stats` - Get deduplication statistics
- `source-seen-items.get` - Get seen item by ID
```

---

## Conclusion

The PRD is **production-ready** with minor fixes. The main issues are:
1. **API naming inconsistency** (easy fix)
2. **Status indicator clarity** (documentation fix)
3. **Missing examples** (content addition)

Once these are addressed, the document will be **excellent** for guiding implementation and demo preparation.

**Estimated Fix Time:** 1-2 hours
