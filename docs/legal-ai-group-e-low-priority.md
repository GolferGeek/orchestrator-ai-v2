# Legal Department AI - Group E: Low Priority Polish

**Priority:** LOW
**Issues:** #6 (PNG Support Verification) + #9 (Non-Document Legal Questions)
**Scope:** Verification + LangGraph echo node

---

## Overview

Verify existing PNG/image support works end-to-end, and improve the quality of responses to legal questions asked without uploading a document.

---

## Issue #6: PNG/Image Support (Verification Only)

### Problem

PNG support is implemented but untested. Need to verify it works end-to-end.

### Current Implementation

- UI accepts: PNG, JPG, JPEG, WEBP, GIF
- Backend uses Vision API (gpt-4-vision-preview) for text extraction
- OCR fallback if Vision fails
- Legal metadata extraction runs on extracted text

### Verification Steps

1. Create or obtain a PNG image of a legal document (contract, agreement, etc.)
2. Upload via the Legal Department AI interface
3. Verify:
   - Upload succeeds without errors
   - Text is extracted from the image
   - Analysis runs on the extracted text
   - Results display correctly (findings, risks, recommendations)
   - PDF export works with image-based analysis

### Files (Reference Only - No Changes Expected)

- `apps/web/src/views/agents/legal-department/components/DocumentUpload.vue`
- `apps/api/src/agent2agent/services/document-processing.service.ts`
- `apps/api/src/agent2agent/services/vision-extraction.service.ts`

### Expected Outcome

- If everything works: Document the success, no code changes needed
- If issues found: Document the issues for a future fix

---

## Issue #9: Non-Document Legal Questions

### Problem

When asking a legal question without a document:
- Just a basic LLM call with generic prompt
- No RAG or knowledge base
- No legal research capability
- Still takes 3-11 seconds due to LLM latency

### Solution (V1 - Smarter Prompting)

Improve the system prompt in echo node to provide better legal responses:

1. **Add legal reasoning frameworks**
   - IRAC (Issue, Rule, Analysis, Conclusion)
   - Consideration of multiple jurisdictions where relevant

2. **Include common legal definitions**
   - Contract terminology
   - Corporate law basics
   - Intellectual property concepts
   - Privacy/data protection terms

3. **Structure responses with citations**
   - Reference general legal principles
   - Cite common law concepts where applicable
   - Note jurisdictional variations

4. **Acknowledge limitations appropriately**
   - "This is general information, not legal advice"
   - "Consult a licensed attorney for specific situations"
   - "Laws vary by jurisdiction"

### Implementation

Update the system prompt in `echo.node.ts`:

```typescript
const systemPrompt = `You are a legal assistant providing general legal information.

IMPORTANT DISCLAIMERS:
- This is general legal information, not legal advice
- Laws vary by jurisdiction - always verify local requirements
- For specific legal matters, consult a licensed attorney

RESPONSE STRUCTURE:
1. Identify the legal issue or question
2. Explain relevant legal principles
3. Discuss common considerations or factors
4. Note any jurisdictional variations
5. Provide practical next steps if applicable

LEGAL FRAMEWORKS TO APPLY:
- Contract Law: offer, acceptance, consideration, capacity, legality
- Corporate Law: fiduciary duties, liability, governance
- IP Law: copyright, trademark, patent, trade secrets
- Privacy Law: consent, data minimization, purpose limitation
- Employment Law: at-will vs. cause, discrimination, wage/hour

When uncertain, acknowledge limitations rather than speculate.`;
```

### File to Modify

- `apps/langgraph/src/agents/legal-department/nodes/echo.node.ts`

### Solution (V2 - Future - RAG)

Deferred to future work:
- Build curated legal knowledge base
- User will work on content sourcing separately
- Integrate with existing RAG infrastructure

---

## Dependencies

- Neither issue depends on other issues
- Both can be done independently
- Can be deferred if higher priority work takes precedence

---

## Testing Plan

### PNG Support (#6)

1. Obtain a PNG image of a contract (can screenshot a test document)
2. Navigate to Legal Department AI
3. Upload the PNG image
4. Wait for processing to complete
5. Verify:
   - [ ] No upload errors
   - [ ] Text extraction message appears
   - [ ] Analysis results display
   - [ ] Findings/risks/recommendations are relevant to the document
   - [ ] PDF export works

### Non-Document Questions (#9)

Test with various legal questions without uploading a document:

1. **Contract question**: "What makes a contract legally binding?"
   - Verify response covers offer, acceptance, consideration, capacity, legality
   - Verify disclaimer is included

2. **IP question**: "What's the difference between copyright and trademark?"
   - Verify accurate definitions
   - Verify practical examples

3. **Employment question**: "Can I be fired without cause?"
   - Verify at-will employment explanation
   - Verify jurisdictional caveat (varies by state/country)

4. **Vague question**: "Is this legal?"
   - Verify graceful handling
   - Verify request for clarification or general guidance

---

## Architecture Notes

- Echo node handles non-document queries
- Keep response latency in mind - prompt shouldn't be so long it adds significant tokens
- Balance comprehensiveness with response time
- RAG integration (V2) will require separate infrastructure work
