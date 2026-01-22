# Legal Department AI - M0 Validation Checklist

**Date**: 2026-01-06
**Milestone**: M0 - Foundation & Infrastructure
**Status**: Ready for Validation

---

## Acceptance Criteria Verification

This document provides a checklist for verifying all 16 acceptance criteria from the M0 PRD.

### Build & Infrastructure

#### ✅ 1. Build passes
**Criterion**: `npm run build` succeeds for all apps

**How to verify**:
```bash
# API app
cd apps/api
npm run build

# LangGraph app
cd apps/langgraph
npm run build

# Web app
cd apps/web
npm run build
```

**Expected result**: All builds complete without errors

**Status**: ⬜ Not Verified

---

#### ✅ 2. Multimodal A2A works
**Criterion**: POST multipart/form-data with files to A2A endpoint succeeds

**How to verify**:
```bash
# Run transport types test
cd apps/api
npm run test:e2e -- legal-department/transport-types
```

**Expected result**: Tests pass showing files uploaded via A2A protocol

**Status**: ⬜ Not Verified

---

#### ✅ 3. Multiple files supported
**Criterion**: Upload 2+ files → all appear in `metadata.extractedDocuments`

**How to verify**:
```bash
# Run document upload test with multiple files
cd apps/api
npm run test:e2e -- legal-department/document-upload
```

**Expected result**: Test shows multiple files processed and stored in metadata

**Status**: ⬜ Not Verified

---

#### ✅ 4. extractedDocuments in metadata
**Criterion**: Agent receives `metadata.extractedDocuments[]` with all fields

**How to verify**:
```bash
# Run integration test
cd apps/api
npm run test:e2e -- legal-department/integration
```

**Expected result**: LangGraph agent receives metadata.extractedDocuments with:
- `documentId`
- `filename`
- `url` (signed URL)
- `extractedText`
- `extractionMethod`

**Status**: ⬜ Not Verified

---

### Database & Storage

#### ✅ 5. law schema created
**Criterion**: `\dt law.*` shows all tables in Postgres

**How to verify**:
```bash
docker exec -it supabase_db_api-dev psql -U postgres -d postgres -c "\dt law.*"
```

**Expected tables**:
- `law.analysis_tasks`
- `law.document_extractions`
- `law.specialist_outputs`
- `law.playbooks`
- `law.execution_steps`

**Status**: ⬜ Not Verified

---

#### ✅ 6. Storage bucket exists
**Criterion**: `legal-documents` bucket in Supabase Storage

**How to verify**:
```bash
docker exec -it supabase_db_api-dev psql -U postgres -d postgres -c "SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id = 'legal-documents';"
```

**Expected result**:
- Bucket name: `legal-documents`
- Public: `false`
- File size limit: `52428800` (50MB)

**Status**: ⬜ Not Verified

---

#### ✅ 7. Agent registered
**Criterion**: `SELECT * FROM agents WHERE slug = 'legal-department'` returns row

**How to verify**:
```bash
docker exec -it supabase_db_api-dev psql -U postgres -d postgres -c "SELECT slug, name, agent_type, department FROM public.agents WHERE slug = 'legal-department';"
```

**Expected result**:
- Slug: `legal-department`
- Name: `Legal Department AI`
- Type: `langgraph`
- Department: `legal`

**Status**: ⬜ Not Verified

---

### Integration & Flow

#### ✅ 8. Full flow works
**Criterion**: Integration test passes: Frontend → API → LangGraph → Response → Frontend

**How to verify**:
```bash
cd apps/api
npm run test:e2e -- legal-department/integration
```

**Expected result**: All integration tests pass showing complete flow

**Status**: ⬜ Not Verified

---

#### ✅ 9. ExecutionContext verified
**Criterion**: All 10 fields present at LangGraph endpoint

**How to verify**:
```bash
cd apps/api
npm run test:e2e -- legal-department/execution-context
```

**Expected fields in ExecutionContext**:
1. `orgSlug`
2. `userId`
3. `conversationId`
4. `taskId`
5. `planId` (optional)
6. `deliverableId` (optional)
7. `agentSlug`
8. `agentType`
9. `provider`
10. `model`

**Status**: ⬜ Not Verified

---

#### ✅ 10. LLM routing verified
**Criterion**: LangGraph calls API's `/llm/generate`, not direct providers

**How to verify**:
```bash
cd apps/api
npm run test:e2e -- legal-department/integration

# Check LangGraph logs for LLM service calls
cd apps/langgraph
# Look for logs showing HTTP calls to API's /llm/generate endpoint
```

**Expected result**: LangGraph uses LLMHttpClientService, not direct Anthropic/OpenAI SDKs

**Status**: ⬜ Not Verified

---

#### ✅ 11. Observability verified
**Criterion**: Events logged to observability system

**How to verify**:
```bash
cd apps/api
npm run test:e2e -- legal-department/observability
```

**Expected result**: Tests pass showing:
- Progress events emitted
- Events stored in database
- ExecutionContext included in all events

**Status**: ⬜ Not Verified

---

### Frontend

#### ✅ 12. UI loads
**Criterion**: Conversation pane renders with document upload

**How to verify**:
1. Start web app: `cd apps/web && npm run dev`
2. Navigate to `/app/agents/legal-department`
3. Verify page loads with:
   - Document upload drag-drop zone
   - File type indicators (PDF, DOCX, images)
   - Upload button

**Expected result**: UI renders without errors

**Status**: ⬜ Not Verified

---

### Document Processing

#### ✅ 13. PDF extraction works
**Criterion**: Upload PDF → text extracted → arrives at LangGraph

**How to verify**:
```bash
cd apps/api
npm run test:e2e -- legal-department/document-extraction
```

**Expected result**: PDF text extraction test passes, text arrives at LangGraph

**Status**: ⬜ Not Verified

---

#### ✅ 14. Vision model works
**Criterion**: Upload a scanned document **as an image** → vision model extracts text

**How to verify**:
```bash
cd apps/api
npm run test:e2e -- legal-department/document-extraction
```

**Expected result**: Vision extraction test passes with image file

**Status**: ⬜ Not Verified

---

#### ✅ 15. Document storage works
**Criterion**: Original file in Supabase Storage, signed URL retrievable

**How to verify**:
```bash
cd apps/api
npm run test:e2e -- legal-department/document-upload
```

**Expected result**:
- File uploaded to storage
- Storage path follows pattern: `legal-documents/{orgSlug}/{conversationId}/{taskId}/{uuid}_{filename}`
- Signed URL generated successfully

**Status**: ⬜ Not Verified

---

#### ✅ 16. Database records created
**Criterion**: `law.analysis_tasks` and `law.document_extractions` populated

**How to verify**:
```bash
# After running integration test
docker exec -it supabase_db_api-dev psql -U postgres -d postgres -c "SELECT COUNT(*) FROM law.analysis_tasks;"
docker exec -it supabase_db_api-dev psql -U postgres -d postgres -c "SELECT COUNT(*) FROM law.document_extractions;"
```

**Expected result**: Records exist in both tables

**Status**: ⬜ Not Verified

---

## Demo Script

After verifying all acceptance criteria, run this demo:

### Setup

1. **Start all services**:
   ```bash
   # Terminal 1: Supabase
   cd apps/api && npx supabase start

   # Terminal 2: API
   cd apps/api && npm run start:dev

   # Terminal 3: LangGraph
   cd apps/langgraph && npm run start:dev

   # Terminal 4: Web
   cd apps/web && npm run dev
   ```

2. **Prepare test documents**:
   - Sample contract PDF
   - Sample scanned contract image (PNG/JPG)
   - Sample Word document (DOCX)

### Demo Steps

#### Step 1: Navigate to Legal Department AI
- Open browser to `http://localhost:8100`
- Login as test user
- Navigate to `/app/agents/legal-department`

**Expected**: Page loads with upload interface

---

#### Step 2: Upload a contract PDF
- Drag PDF into upload zone (or click to browse)
- Select sample contract PDF

**Expected**:
- File appears in upload preview
- File size displayed
- Upload button enabled

---

#### Step 3: See upload progress
- Click "Start Analysis"

**Expected**:
- Upload progress indicator appears
- Progress bar shows file upload

---

#### Step 4: See extraction progress
**Expected**:
- Phase indicator shows "Extracting Content"
- Progress updates show text extraction

---

#### Step 5: Enter request
**Expected**:
- Analysis automatically starts with default message
- Or user can enter custom message: "Review this contract"

---

#### Step 6: See analysis start
**Expected**:
- Phase indicator shows "Analyzing Document"
- ExecutionContext flows to LangGraph
- Progress updates appear

---

#### Step 7: See echo response
**Expected**:
- LangGraph echo node responds
- LLM-generated summary appears
- Response includes document reference

---

#### Step 8: Verify in database
```bash
# Check analysis_tasks
docker exec -it supabase_db_api-dev psql -U postgres -d postgres -c "SELECT id, status, document_type FROM law.analysis_tasks ORDER BY created_at DESC LIMIT 5;"

# Check document_extractions
docker exec -it supabase_db_api-dev psql -U postgres -d postgres -c "SELECT id, original_filename, extraction_method, LENGTH(extracted_text) as text_length FROM law.document_extractions ORDER BY created_at DESC LIMIT 5;"
```

**Expected**:
- Record in `law.analysis_tasks` with status 'completed'
- Record in `law.document_extractions` with extracted text

---

#### Step 9: Verify signed URL
```bash
# Get storage path from document_extractions
docker exec -it supabase_db_api-dev psql -U postgres -d postgres -c "SELECT storage_path FROM law.document_extractions ORDER BY created_at DESC LIMIT 1;"

# Verify file exists in storage
# (Can check via Supabase Studio or API)
```

**Expected**:
- Original document stored in Supabase Storage
- Signed URL retrievable and valid

---

## Demo Talking Points

Use these points when demonstrating M0:

1. **"The plumbing works end-to-end"**
   - Frontend → API → LangGraph → Response
   - All transport types verified
   - ExecutionContext flows through entire system

2. **"Original documents are stored securely for re-processing and review"**
   - Documents in Supabase Storage with RLS policies
   - Org-based access control
   - Demo-grade retention (not compliance-grade yet)

3. **"We can upload any format - PDF, Word, or even photos of contracts"**
   - PDF text extraction working
   - DOCX parsing functional
   - Vision model extracts text from images
   - OCR fallback available

4. **"ExecutionContext flows through the entire system for observability"**
   - All 10 fields present
   - Backend only mutates taskId/deliverableId/planId
   - userId from JWT, never request body
   - Full context visible in all logs

5. **"All LLM calls go through our central service for tracking"**
   - LangGraph uses API's /llm/generate endpoint
   - No direct provider calls
   - Centralized usage tracking
   - Model configuration managed centrally

6. **"Now we build legal analysis features on solid infrastructure"**
   - Database schema ready for domain state
   - Multimodal input pipeline complete
   - Agent structure in place
   - Ready for M1 feature development

---

## Validation Status

**Last Updated**: 2026-01-06

### Summary
- Total Criteria: 16
- Verified: 0
- Not Verified: 16
- Blocked: 0

### Next Steps
1. Start all required services
2. Run build verification for all apps
3. Execute all integration tests
4. Run manual demo script
5. Verify all database records
6. Sign off on M0 completion

### Notes
- All infrastructure code is in place
- All tests are written and ready to run
- Demo script documented
- Ready for validation when services are started

---

## Approval

**Infrastructure Lead**: ________________  Date: __________

**Engineering Manager**: ________________  Date: __________

**Product Owner**: ________________  Date: __________

---

## References

- [M0 PRD](../prd/20260105-legal-department-ai-m0.md)
- [M0 Plan](../../plans/legal-department-ai-m0.plan.json)
- [Test Documentation](../../apps/api/testing/test/legal-department/README.md)
