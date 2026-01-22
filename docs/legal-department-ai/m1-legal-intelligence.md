# Legal Department AI - M1: Legal Document Intelligence

**Milestone:** M1
**Status:** ✅ Implementation Complete
**Date:** 2026-01-07

## Overview

M1 adds legal-specific document intelligence on top of M0's multimodal foundation. The system can now detect document types, extract sections/clauses, identify signatures, extract dates and parties, and provide confidence scoring for all extractions.

## What M1 Delivers

### Core Capabilities

1. **Document Type Classification**
   - Automatically classifies legal documents into types: contract, NDA, MSA, pleading, motion, correspondence, etc.
   - Provides confidence scores and alternative classifications
   - Uses LLM-based semantic analysis with fallback heuristics

2. **Section & Clause Detection**
   - Identifies document structure (preamble, recitals, definitions, terms, signatures)
   - Detects clause boundaries within sections
   - Supports hierarchical structure (nested sections)
   - Hybrid approach: pattern matching + LLM semantic analysis

3. **Signature Detection**
   - Finds signature blocks throughout documents
   - Extracts party names, signer names, titles, and dates
   - Determines execution status (signed vs unsigned)
   - Multiple detection strategies (keywords, visual patterns, positioning)

4. **Date Extraction & Normalization**
   - Extracts dates and classifies by type (effective date, expiration date, signature date, etc.)
   - Normalizes all dates to ISO 8601 format
   - Handles relative dates ("30 days after effective date")
   - Identifies primary dates (document, effective, expiration)

5. **Party Extraction**
   - Identifies contracting parties from documents
   - Classifies party types (individual, corporation, LLC, partnership, etc.)
   - Extracts party roles (buyer/seller, lessor/lessee, plaintiff/defendant)
   - Preliminary extraction - specialists will refine in M2+

6. **Confidence Scoring**
   - Multi-factor confidence scoring for all extractions
   - Weighted algorithm based on text quality, extraction method, completeness, pattern matching
   - Confidence levels: high (0.8+), medium (0.6-0.8), low (0.4-0.6), very-low (<0.4)
   - Quality warnings for low-confidence extractions

7. **Multi-Page Document Support**
   - Full document text passed to extraction services
   - Context continuity maintained across pages
   - All legal metadata aggregated at document level

## Architecture

### Services (API)

All services located in `apps/api/src/agent2agent/services/`:

1. **LegalMetadataService** - Orchestrates all legal extraction tasks
2. **DocumentTypeClassificationService** - LLM-based document classification
3. **SectionDetectionService** - Section and clause boundary detection
4. **SignatureDetectionService** - Signature block detection
5. **DateExtractionService** - Date extraction and normalization
6. **PartyExtractionService** - Party identification
7. **ConfidenceScoringService** - Extraction quality scoring

### Prompts (API)

All prompts located in `apps/api/src/agent2agent/prompts/`:

1. **document-type-classification.prompt.ts** - 14 document types with classification criteria
2. **section-detection.prompt.ts** - 16 section types with hierarchical structure
3. **signature-detection.prompt.ts** - Corporate, individual, and notarized signatures
4. **date-extraction.prompt.ts** - 13 date types with normalization rules
5. **party-extraction.prompt.ts** - Party types, roles, and identifiers

### Database Schema

Migration: `apps/api/supabase/migrations/20260107000001_add_legal_metadata_to_document_extractions.sql`

Added 15 columns to `law.document_extractions`:
- `document_type` (TEXT) - Classified type
- `document_type_confidence` (DECIMAL) - Classification confidence
- `detected_sections` (JSONB) - Section hierarchy
- `has_signatures` (BOOLEAN) - Whether signed
- `signature_blocks` (JSONB) - Signature information
- `extracted_dates` (JSONB) - Date information
- `extracted_parties` (JSONB) - Party information
- `extracted_amounts` (JSONB) - Financial terms
- `detected_clauses` (JSONB) - Legal clauses
- `extracted_jurisdiction` (JSONB) - Governing law info
- `document_language` (TEXT) - Detected language
- `language_confidence` (DECIMAL) - Language detection confidence
- `has_redactions` (BOOLEAN) - Whether redacted
- `redaction_regions` (JSONB) - Redaction locations
- `extraction_confidence` (DECIMAL) - Overall confidence

Added 9 indexes (4 B-tree, 5 GIN) for query performance.

### Data Flow

```
1. User uploads document → Controller
2. DocumentProcessingService extracts text (vision/OCR)
3. LegalMetadataService analyzes text
   - DocumentTypeClassificationService
   - SectionDetectionService
   - SignatureDetectionService
   - DateExtractionService
   - PartyExtractionService
   - ConfidenceScoringService
4. Metadata stored in law.document_extractions
5. Metadata passed to LangGraph in state
6. LangGraph echo node receives metadata
7. Frontend displays metadata in UI
```

### LangGraph Integration

- **State Interface:** `LegalDepartmentState` includes `legalMetadata` field
- **Echo Node:** Formats and displays metadata in responses
- **File:** `apps/langgraph/src/agents/legal-department/`

### Frontend Display

- **Types:** `apps/web/src/views/agents/legal-department/legalDepartmentTypes.ts`
- **Component:** `DocumentMetadataDisplay.vue` - Comprehensive metadata display
- **Integration:** `ResultsDisplay.vue` - Shows metadata in results

## Usage

### Upload a Document

1. Navigate to Legal Department AI in the web UI
2. Upload a PDF or DOCX legal document
3. Submit for analysis
4. System extracts text using vision/OCR
5. Legal metadata automatically extracted
6. Results display shows:
   - Document type
   - Detected sections
   - Signature information
   - Key dates
   - Identified parties
   - Confidence scores

### API Integration

```typescript
// Document processing automatically includes legal metadata
const result = await documentProcessingService.processDocument({
  file,
  taskId,
  userId,
  orgSlug,
  conversationId,
});

// Legal metadata available in result
const metadata = result.legalMetadata;
console.log('Document Type:', metadata.documentType.type);
console.log('Sections:', metadata.sections.sections.length);
console.log('Has Signatures:', metadata.signatures.signatures.length > 0);
console.log('Confidence:', metadata.confidence.overall);
```

### Database Queries

```sql
-- Find all contracts with high confidence
SELECT * FROM law.document_extractions
WHERE document_type = 'contract'
AND extraction_confidence > 0.8;

-- Find all signed NDAs
SELECT * FROM law.document_extractions
WHERE document_type = 'nda'
AND has_signatures = true;

-- Find documents expiring soon
SELECT * FROM law.document_extractions
WHERE extracted_dates @> '[{"type": "expiration_date"}]'::jsonb;

-- Find all documents from a specific party
SELECT * FROM law.document_extractions
WHERE extracted_parties @> '[{"name": "Acme Corp"}]'::jsonb;
```

## Testing

### Test Suite

All tests located in `apps/api/testing/test/legal-department/`:

1. **document-type-classification.e2e-spec.ts** - 8 tests (AC-1)
2. **section-detection.e2e-spec.ts** - 8 tests (AC-2)
3. **signature-detection.e2e-spec.ts** - 10 tests (AC-3)
4. **date-extraction.e2e-spec.ts** - 10 tests (AC-4)
5. **party-extraction.e2e-spec.ts** - 10 tests (AC-5)
6. **legal-metadata-pipeline.e2e-spec.ts** - 5 tests (AC-1 through AC-12)

**Total: 51 E2E test cases**

### Running Tests

```bash
# Run all M1 tests
cd apps/api/testing/test/legal-department
./run-m1-tests.sh

# Or run individual suites
cd apps/api
npm run test:e2e -- legal-department/document-type-classification.e2e-spec
npm run test:e2e -- legal-department/section-detection.e2e-spec
npm run test:e2e -- legal-department/signature-detection.e2e-spec
npm run test:e2e -- legal-department/date-extraction.e2e-spec
npm run test:e2e -- legal-department/party-extraction.e2e-spec
npm run test:e2e -- legal-department/legal-metadata-pipeline.e2e-spec
```

## Acceptance Criteria Status

- ✅ **AC-1:** Document type classification (contract, NDA, MSA, pleading, etc.)
- ✅ **AC-2:** Section detection (preamble, definitions, terms, signatures)
- ✅ **AC-3:** Signature block detection and party extraction
- ✅ **AC-4:** Date extraction and normalization (effective, expiration, signature)
- ✅ **AC-5:** Party name extraction (preliminary)
- ✅ **AC-6:** Confidence scoring for all extractions
- ✅ **AC-7:** Multi-page document handling with context continuity
- ✅ **AC-8:** Legal metadata stored in law.document_extractions
- ✅ **AC-9:** Legal metadata passed to LangGraph state
- ✅ **AC-10:** Frontend displays legal metadata
- ✅ **AC-11:** Unknown document types handled gracefully
- ✅ **AC-12:** All M1 tests created (51 test cases)

## What's Next (M2)

M1 provides the foundation for specialist analysis. M2 will add:

1. **Contract Agent** - Specialist analysis for contracts
   - Obligation extraction
   - Risk clause identification
   - Compliance checks
   - Playbook comparison

2. **CLO Routing** - Chief Legal Officer routes to specialists
3. **Specialist Coordination** - Multiple agents working together
4. **HITL Workflows** - Human-in-the-loop for critical decisions
5. **Report Generation** - Comprehensive analysis reports

## Technical Notes

### ExecutionContext Pattern

All services follow the ExecutionContext capsule pattern:
- Full context (orgSlug, userId, conversationId, taskId, etc.) passed as one object
- No individual field passing
- Enables proper observability and LLM usage tracking

### LLM Integration

- All prompts use LLM service with automatic usage tracking
- Structured output with JSON schemas
- Low temperature (0.1) for consistent extraction
- Fallback to heuristics if LLM fails

### Performance

- Parallel execution of extraction services
- Individual failures don't block other extractions
- Graceful degradation
- Metadata extraction completes in 5-15 seconds for typical documents

### Error Handling

- Non-fatal errors logged but don't block processing
- Confidence scores reflect extraction quality
- Unknown documents classified as 'other' with low confidence
- Missing fields handled gracefully

## Files Created/Modified

### Services (7 new files)
- `apps/api/src/agent2agent/services/legal-metadata.service.ts`
- `apps/api/src/agent2agent/services/document-type-classification.service.ts`
- `apps/api/src/agent2agent/services/section-detection.service.ts`
- `apps/api/src/agent2agent/services/signature-detection.service.ts`
- `apps/api/src/agent2agent/services/date-extraction.service.ts`
- `apps/api/src/agent2agent/services/party-extraction.service.ts`
- `apps/api/src/agent2agent/services/confidence-scoring.service.ts`

### Prompts (6 new files)
- `apps/api/src/agent2agent/prompts/document-type-classification.prompt.ts`
- `apps/api/src/agent2agent/prompts/section-detection.prompt.ts`
- `apps/api/src/agent2agent/prompts/signature-detection.prompt.ts`
- `apps/api/src/agent2agent/prompts/date-extraction.prompt.ts`
- `apps/api/src/agent2agent/prompts/party-extraction.prompt.ts`
- `apps/api/src/agent2agent/prompts/index.ts`

### Database (1 migration)
- `apps/api/supabase/migrations/20260107000001_add_legal_metadata_to_document_extractions.sql`

### LangGraph (2 modified)
- `apps/langgraph/src/agents/legal-department/legal-department.state.ts`
- `apps/langgraph/src/agents/legal-department/nodes/echo.node.ts`

### Frontend (3 modified, 1 new)
- `apps/web/src/views/agents/legal-department/legalDepartmentTypes.ts`
- `apps/web/src/views/agents/legal-department/components/DocumentMetadataDisplay.vue` (new)
- `apps/web/src/views/agents/legal-department/components/ResultsDisplay.vue`

### Integration (3 modified)
- `apps/api/src/agent2agent/services/document-processing.service.ts`
- `apps/api/src/agent2agent/agent2agent.controller.ts`
- `apps/api/src/agent2agent/agent2agent.module.ts`

### Tests (6 new files + 2 docs)
- `apps/api/testing/test/legal-department/document-type-classification.e2e-spec.ts`
- `apps/api/testing/test/legal-department/section-detection.e2e-spec.ts`
- `apps/api/testing/test/legal-department/signature-detection.e2e-spec.ts`
- `apps/api/testing/test/legal-department/date-extraction.e2e-spec.ts`
- `apps/api/testing/test/legal-department/party-extraction.e2e-spec.ts`
- `apps/api/testing/test/legal-department/legal-metadata-pipeline.e2e-spec.ts`
- `apps/api/testing/test/legal-department/M1-TESTING-SUMMARY.md`
- `apps/api/testing/test/legal-department/fixtures/README.md`
- `apps/api/testing/test/legal-department/run-m1-tests.sh`

## Summary

M1 successfully adds comprehensive legal document intelligence to the Legal Department AI platform. The system can now automatically classify documents, extract structure, identify signatures and parties, extract dates, and provide confidence scoring - all preparing documents for specialist analysis in future milestones.

**Implementation Status: ✅ COMPLETE**
