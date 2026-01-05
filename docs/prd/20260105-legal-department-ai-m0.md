# Legal Department AI - Milestone 0: Foundation & Infrastructure

**PRD Created:** 2026-01-05
**Status:** Draft
**Priority:** P1 (Foundation - Must Complete First)
**Parent PRD:** [20260105-comprehensive-legal-department-ai.md](./20260105-comprehensive-legal-department-ai.md)

---

## Executive Summary

Milestone 0 establishes the complete architectural foundation for the Legal Department AI multi-agent system. **No feature development happens until M0 is complete.** This milestone ensures:

1. **Transport types are used correctly** - Frontend calls API, API calls LangGraph (never direct)
2. **ExecutionContext flows end-to-end** - From frontend through API runner to LangGraph and back
3. **Database schema exists** - Legal-specific tables for domain state
4. **Multimodal input works** - PDF, DOCX, images, scanned documents
5. **All patterns established** - So subsequent milestones just add features

**Demo Value:** "Upload any document - PDF, Word, or photo of a contract - and watch the full system respond. Original document stored securely, text extracted, and ready for legal analysis."

---

## Critical Architecture Rules

These rules are **non-negotiable** and must be followed throughout all Legal Department AI development:

| Rule | Why |
|------|-----|
| **Task execution** goes through API via A2A transport types | Centralized routing, auth, ExecutionContext flow, observability |
| API creates the API Agent Runner which calls LangGraph via HTTP | Centralized routing, auth, and logging |
| ExecutionContext is created by frontend, flows through API runner, arrives at LangGraph intact | Observability, tenant isolation, LLM routing |
| Tasks and conversations are managed by API (not LangGraph) | Single source of truth for conversation state |
| LangGraph stores domain-specific state in `law` schema | Legal analysis, specialist outputs, document extractions |
| LLM calls go through API's `/llm/generate` endpoint | Token tracking, observability, provider routing |
| Original documents are stored in Supabase Storage | Demo-grade retention (re-run extraction, attorney review). **Not compliance-grade audit logging** for the demo |

**Frontend CAN call LangGraph directly for read-only domain data:**

| Direct to LangGraph (OK) | Through API A2A (Required) |
|--------------------------|---------------------------|
| Get list of playbooks | Analyze document |
| Get document type options | Run specialist agents |
| Get analysis history for display | Submit HITL approval |
| Get specialist descriptions | Any task needing ExecutionContext |
| Any read-only `law.*` data | Creating/updating records |

LangGraph should expose simple REST endpoints for these data queries:
- `GET /legal-department/playbooks`
- `GET /legal-department/specialists`
- `GET /legal-department/document-types`
- `GET /legal-department/analysis/:id` (read-only history)

---

## Alignment with Parent PRD (M0)

This PRD is the **detailed** implementation spec for Milestone 0 and must remain consistent with the parent PRD’s M0 scope in `20260105-comprehensive-legal-department-ai.md`.

- If a conflict exists: prioritize **A2A transport compliance**, **ExecutionContext end-to-end**, and the parent PRD’s **demo (non-production)** framing.

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Vue.js)                               │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ LegalDepartmentConversation.vue                                     │    │
│  │   └── legalDepartmentService.ts (direct fetch to API A2A endpoint)  │    │
│  │         └── Creates A2ATaskRequest with ExecutionContext            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ▼ POST /agent-to-agent/:org/legal-department/tasks
                                   │ (A2ATaskRequest with ExecutionContext)
┌──────────────────────────────────┴──────────────────────────────────────────┐
│                              API (NestJS)                                    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ TasksController                                                      │    │
│  │   └── AgentModeRouter                                                │    │
│  │         └── Looks up agent_type = 'api' from agents table            │    │
│  │               └── ApiAgentRunner.execute()                           │    │
│  │                     └── HTTP POST to LangGraph endpoint              │    │
│  │                           (forwards ExecutionContext in body)        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ /llm/generate endpoint (LLM Service)                                    │    │
│  │   └── Receives ExecutionContext                                      │    │
│  │   └── Routes to provider (Anthropic, OpenAI, Ollama, Google)        │    │
│  │   └── Tracks tokens, logs observability events                       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ▼ POST ${LANGGRAPH_URL}/legal-department/analyze
                                   │ (Request body includes ExecutionContext)
┌──────────────────────────────────┴──────────────────────────────────────────┐
│                            LANGGRAPH (Express)                               │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ /legal-department/analyze endpoint                                   │    │
│  │   └── Extracts ExecutionContext from request body                   │    │
│  │   └── Invokes LegalDepartmentGraph                                  │    │
│  │         └── State includes ExecutionContext                         │    │
│  │         └── Nodes use LLMHttpClientService (calls API's /llm/generate)  │    │
│  │         └── Nodes use ObservabilityService (calls API)              │    │
│  │         └── Results stored in law.* tables                          │    │
│  │   └── Returns result                                                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ▼ Response
┌──────────────────────────────────┴──────────────────────────────────────────┐
│                              API (NestJS)                                    │
│                                                                              │
│  ApiAgentRunner receives response                                           │
│    └── Creates deliverable record                                           │
│    └── Updates task status                                                  │
│    └── Returns A2ATaskResponse to frontend                                  │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ▼ A2ATaskResponse
┌──────────────────────────────────┴──────────────────────────────────────────┐
│                              FRONTEND (Vue.js)                               │
│                                                                              │
│  legalDepartmentService receives response                                   │
│    └── Updates UI state                                                     │
│    └── Displays results in conversation pane                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Deliverables

### 0.1 Multimodal Support in A2A Transport

**Why:** File uploads need to flow through the existing A2A transport types. To maintain **strict A2A conformance**, files are sent as base64 in metadata - the transport remains pure JSON.

**Key Principle:**
1. Frontend converts files to base64 and puts them in `metadata.files[]`
2. API processes the base64 files (stores originals, extracts text)
3. API replaces `metadata.files[]` with `metadata.extractedDocuments[]`
4. Agent receives clean extracted text - never sees raw file data

**Deliverables:**
- [ ] Define `metadata.files[]` structure for incoming base64 files
- [ ] Add `DocumentProcessingService` to API that handles base64 → storage → extraction
- [ ] Replace `metadata.files` with `metadata.extractedDocuments` after processing
- [ ] Update transport types documentation (not the types themselves - metadata is already `Record<string, unknown>`)
- [ ] Add ENV configuration for vision model

**A2A Transport Structure (from transport-types):**

`metadata` is a **standard field** in `TaskRequestParams` - it's a sibling to `payload`, not something we're adding:

```typescript
// FROM: apps/transport-types/request/task-request.types.d.ts
// This is the EXISTING A2A standard - we're using it as designed

interface A2ATaskRequest {
  jsonrpc: '2.0';
  id: string | number | null;
  method: string;
  params: TaskRequestParams;
}

interface TaskRequestParams {
  context: ExecutionContext;           // Required
  mode: AgentTaskMode;                 // Required
  payload: {                           // Required - action-specific params
    action: string;
    [key: string]: any;
  };
  userMessage: string;                 // Required
  messages?: TaskMessage[];            // Optional - conversation history
  metadata: Record<string, any>;       // ← STANDARD FIELD - files go here
  // ... other optional fields
}
```

**File Upload Structure (what goes in `metadata`):**

```typescript
// ============================================================================
// INCOMING: What frontend sends in metadata.files (base64 encoded)
// ============================================================================
interface FileUpload {
  filename: string;
  mimeType: string;
  base64Data: string;  // Base64 encoded file content
}

// Frontend sends:
// params.metadata.files = [FileUpload, FileUpload, ...]

// ============================================================================
// OUTGOING: What API transforms metadata to (extracted text, no base64)
// ============================================================================
interface ExtractedDocument {
  // Original file info
  filename: string;
  mimeType: string;
  fileSizeBytes: number;

  // Storage location (for retrieving original)
  storagePath: string;          // Path in Supabase Storage

  // Extraction results
  extractedText: string;        // The actual text content
  extractionMethod: 'pdf_text' | 'docx_parse' | 'vision_model' | 'ocr' | 'direct_read';
  confidence: number;           // 0.0 - 1.0

  // Optional
  pageCount?: number;
  warnings?: string[];
}

// API transforms to:
// params.metadata.extractedDocuments = [ExtractedDocument, ExtractedDocument, ...]
// (and deletes params.metadata.files)
```

**Key Point:** We're using the A2A `metadata` field as designed - this is fully compliant with the transport types standard.

**Request Flow (Pure JSON - A2A Compliant):**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                        │
│                                                                              │
│  1. User selects files                                                       │
│  2. Frontend converts each file to base64                                   │
│  3. Sends full A2ATaskRequest (JSON-RPC 2.0):                               │
│     {                                                                        │
│       jsonrpc: "2.0",                                                       │
│       id: "req-123",                                                        │
│       method: "build.create",                                               │
│       params: {                          // ← TaskRequestParams              │
│         context: ExecutionContext,                                          │
│         mode: "build",                                                      │
│         payload: { action: "create" },                                      │
│         userMessage: "Review these contracts",                              │
│         metadata: {                      // ← Standard A2A field            │
│           files: [                       // ← Files go here as base64       │
│             { filename: "contract.pdf", mimeType: "application/pdf",        │
│               base64Data: "JVBERi0xLjQK..." },                              │
│             { filename: "amendment.docx", mimeType: "application/vnd...",   │
│               base64Data: "UEsDBBQAAAA..." }                                │
│           ]                                                                 │
│         }                                                                   │
│       }                                                                     │
│     }                                                                       │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ▼ POST /agent-to-agent/:org/:agent/tasks
                                   │ Content-Type: application/json  ← Pure JSON!
┌──────────────────────────────────┴──────────────────────────────────────────┐
│                              API (NestJS)                                    │
│                                                                              │
│  TasksController                                                             │
│    │                                                                        │
│    ├── 1. Check if params.metadata.files exists                            │
│    │                                                                        │
│    ├── 2. For each file in params.metadata.files:                          │
│    │      a. Decode base64 to buffer                                       │
│    │      b. Store original in Supabase Storage                            │
│    │      c. Extract text (PDF/DOCX/vision/OCR)                            │
│    │      d. Build ExtractedDocument object                                │
│    │                                                                        │
│    ├── 3. Transform params.metadata:                                       │
│    │      - DELETE params.metadata.files (remove base64 data)              │
│    │      - ADD params.metadata.extractedDocuments = [...]                 │
│    │                                                                        │
│    └── 4. Forward to AgentModeRouter → Agent Runner                        │
│           (clean JSON, no base64, just extracted text)                     │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ▼ Agent receives clean A2ATaskRequest
                                   │ with extractedDocuments in params.metadata
┌──────────────────────────────────┴──────────────────────────────────────────┐
│                              AGENT (LangGraph, etc.)                         │
│                                                                              │
│  // Agent accesses extracted text from params.metadata                      │
│  const docs = request.params.metadata?.extractedDocuments || [];            │
│  const documentText = docs.map(d => d.extractedText).join('\n\n');          │
│                                                                              │
│  // Agent never sees base64 data or raw files                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Why Base64 in Metadata:**

| Concern | Solution |
|---------|----------|
| A2A conformance | Transport stays pure JSON - no multipart |
| File size overhead | Base64 adds ~33%, but legal docs typically <10MB |
| Large files | Can add size limit (e.g., 10MB per file, 50MB total) |
| Memory | API streams base64 decode, doesn't hold full payload |

**Vision Model Configuration:**

```bash
# .env configuration for vision model

# Vision model for document extraction (images, scanned documents)
# Options: llava:7b, llava:13b, llava:34b, qwen2-vl:7b
# IMPORTANT: Must be explicitly set. No silent defaults.
VISION_MODEL=<required>

# Vision model provider (currently only Ollama supported)
VISION_PROVIDER=ollama

# Ollama base URL (for vision model calls)
# IMPORTANT: Must be explicitly set. No silent defaults.
OLLAMA_BASE_URL=<required>
```

**Fail-fast requirement:** If `VISION_MODEL`, `VISION_PROVIDER`, or `OLLAMA_BASE_URL` are missing, the API must fail with a clear error message explaining what to configure. Do not fallback to a default model/provider.

**Vision Model Options:**

| Model | Size | VRAM | Speed | Quality | Best For |
|-------|------|------|-------|---------|----------|
| `llava:7b` | 4.5GB | ~8GB | Fast | Good | Quick extraction, simple docs |
| `llava:13b` | 8GB | ~16GB | Medium | Better | Most documents |
| `llava:34b` | 20GB | ~40GB | Slow | Best | Complex/dense documents, **demo default** |
| `qwen2-vl:7b` | 4.5GB | ~8GB | Fast | Good | Multilingual, tables |

**Pull the default model:**
```bash
ollama pull llava:34b
```

**API Document Processing Service:**

```typescript
// apps/api/src/services/document-processing.service.ts

import { Injectable } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { PdfExtractorService } from '../rag/extractors/pdf-extractor.service';
import { DocxExtractorService } from '../rag/extractors/docx-extractor.service';
import { VisionExtractionService } from './vision-extraction.service';
import { OCRExtractionService } from './ocr-extraction.service';
import { ExecutionContext } from '@orchestrator-ai/transport-types';

export interface ExtractedDocument {
  filename: string;
  mimeType: string;
  fileSizeBytes: number;
  storagePath: string;
  extractedText: string;
  extractionMethod: 'pdf_text' | 'docx_parse' | 'vision_model' | 'ocr' | 'direct_read';
  confidence: number;
  pageCount?: number;
  warnings?: string[];
}

@Injectable()
export class DocumentProcessingService {
  constructor(
    private supabase: SupabaseService,
    private pdfExtractor: PdfExtractorService,
    private docxExtractor: DocxExtractorService,
    private visionExtractor: VisionExtractionService,
    private ocrExtractor: OCRExtractionService,
  ) {}

  /**
   * Process uploaded files: store and extract text
   * Called by TasksController before forwarding to agent
   */
  async processUploadedFiles(
    context: ExecutionContext,
    files: Express.Multer.File[],
    storageBucket: string = 'legal-documents',
  ): Promise<ExtractedDocument[]> {
    const results: ExtractedDocument[] = [];

    for (const file of files) {
      // 1. Store original in Supabase Storage
      const storagePath = `${context.orgSlug}/${context.conversationId}/${Date.now()}-${file.originalname}`;

      await this.supabase.storage
        .from(storageBucket)
        .upload(storagePath, file.buffer, {
          contentType: file.mimetype,
        });

      // 2. Extract text based on file type
      const extraction = await this.extractText(context, file);

      // 3. Build result
      results.push({
        filename: file.originalname,
        mimeType: file.mimetype,
        fileSizeBytes: file.size,
        storagePath,
        extractedText: extraction.text,
        extractionMethod: extraction.method,
        confidence: extraction.confidence,
        pageCount: extraction.pageCount,
        warnings: extraction.warnings,
      });
    }

    return results;
  }

  private async extractText(
    context: ExecutionContext,
    file: Express.Multer.File,
  ): Promise<{
    text: string;
    method: ExtractedDocument['extractionMethod'];
    confidence: number;
    pageCount?: number;
    warnings?: string[];
  }> {
    const { mimetype, buffer, originalname } = file;

    // PDF
    if (mimetype === 'application/pdf') {
      const pdfResult = await this.pdfExtractor.extract(buffer);

      // Check if PDF has text (not scanned)
      if (pdfResult.text.trim().length > 100) {
        return {
          text: pdfResult.text,
          method: 'pdf_text',
          confidence: 0.95,
          pageCount: pdfResult.pageCount,
        };
      }

      // Scanned PDF - use vision model
      return this.extractWithVision(context, buffer, mimetype, originalname);
    }

    // DOCX
    if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mimetype === 'application/msword') {
      const docxResult = await this.docxExtractor.extract(buffer);
      return {
        text: docxResult.text,
        method: 'docx_parse',
        confidence: 0.98,
      };
    }

    // Images
    if (mimetype.startsWith('image/')) {
      return this.extractWithVision(context, buffer, mimetype, originalname);
    }

    // Plain text
    if (mimetype === 'text/plain' || mimetype === 'text/markdown') {
      return {
        text: buffer.toString('utf-8'),
        method: 'direct_read',
        confidence: 1.0,
      };
    }

    throw new Error(`Unsupported file type: ${mimetype}`);
  }

  private async extractWithVision(
    context: ExecutionContext,
    buffer: Buffer,
    mimetype: string,
    filename: string,
  ): Promise<{
    text: string;
    method: 'vision_model' | 'ocr';
    confidence: number;
    pageCount?: number;
    warnings?: string[];
  }> {
    try {
      const result = await this.visionExtractor.extract(context, buffer, mimetype, filename);
      return {
        text: result.text,
        method: 'vision_model',
        confidence: result.confidence,
        pageCount: result.pageCount,
        warnings: result.warnings,
      };
    } catch (error) {
      // Fallback to OCR
      console.warn('Vision extraction failed, using OCR fallback:', error);
      const ocrResult = await this.ocrExtractor.extract(buffer);
      return {
        text: ocrResult.text,
        method: 'ocr',
        confidence: ocrResult.confidence,
        warnings: ['Vision model unavailable, used OCR fallback'],
      };
    }
  }
}
```

**Updated TasksController (excerpt):**

```typescript
// In TasksController - handling multipart/form-data

@Post(':org/:agent/tasks')
@UseInterceptors(FilesInterceptor('files'))
async createTask(
  @Param('org') org: string,
  @Param('agent') agent: string,
  @Body('request') requestJson: string,
  @UploadedFiles() files: Express.Multer.File[],
) {
  const request = JSON.parse(requestJson) as A2ATaskRequest;

  // Process files if present
  if (files && files.length > 0) {
    const extractedDocs = await this.documentProcessing.processUploadedFiles(
      request.context,
      files,
    );

    // Add to metadata
    request.metadata = {
      ...request.metadata,
      extractedDocuments: extractedDocs,
    };
  }

  // Forward to agent (now with extracted text in metadata)
  return this.agentModeRouter.route(request);
}
```

**Why This Approach:**

| Benefit | Explanation |
|---------|-------------|
| **A2A compliant** | Metadata is already `Record<string, unknown>` - no type changes needed |
| **Agent agnostic** | ANY agent can now receive file uploads, not just Legal Department |
| **Clean separation** | API handles messy file stuff, agents get clean text |
| **Reusable** | Document processing service used by any agent that needs files |
| **Testable** | Can test extraction separately from agent logic |

---

### 0.2 Database Schema (`law` schema)

**Why:** Complex workflows need domain-specific tables for state that doesn't fit in generic API tables. The API handles conversations/tasks/deliverables, but legal-specific data (analysis results, specialist outputs, playbooks, document extractions) needs its own schema.

**Deliverables:**
- [ ] Create migration: `apps/api/supabase/migrations/YYYYMMDD_create_law_schema.sql`
- [ ] Create `law` schema with all required tables
- [ ] Add RLS policies for org-based access
- [ ] Add service role bypass policies
- [ ] Seed initial playbook data for demo

**Complete Schema SQL:**

```sql
-- =============================================================================
-- LEGAL DEPARTMENT AI SCHEMA
-- =============================================================================
-- Multi-agent legal analysis system with:
-- - CLO orchestrator routing to specialist agents
-- - Document extraction with multimodal support (PDF, DOCX, vision, OCR)
-- - Original document storage in Supabase Storage
-- - Specialist outputs and risk analysis
-- - Firm-configurable playbooks
-- - Demo-grade history (NOT compliance-grade audit logging)
-- Created: 2026-01-05
-- =============================================================================

-- Create law schema
CREATE SCHEMA IF NOT EXISTS law;

-- =============================================================================
-- ANALYSIS TASKS
-- =============================================================================
-- Main execution record for each legal analysis request
-- Links to API's tasks/conversations but stores legal-specific state
-- =============================================================================

CREATE TABLE law.analysis_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Links to API's task/conversation system
    task_id UUID NOT NULL,              -- FK to API's tasks table
    conversation_id UUID NOT NULL,      -- FK to conversations
    organization_slug TEXT NOT NULL,
    user_id UUID,                       -- User who initiated

    -- Analysis metadata
    document_type TEXT,                 -- 'nda', 'msa', 'employment', 'lease', etc.
    user_request TEXT,                  -- Original user request text

    -- CLO routing decisions
    clo_routing JSONB,                  -- { selectedSpecialists: [], reasoning: "" }

    -- Status tracking
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending',           -- Awaiting processing
        'extracting',        -- Document extraction in progress
        'routing',           -- CLO determining specialists
        'analyzing',         -- Specialists working
        'synthesizing',      -- Combining specialist outputs
        'awaiting_approval', -- HITL checkpoint
        'completed',         -- Analysis complete
        'failed'             -- Error occurred
    )),

    -- Results
    risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    synthesized_report TEXT,            -- Final combined report

    -- HITL
    approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN (
        'pending', 'approved', 'rejected', 'changes_requested'
    )),
    approver_id UUID,                   -- Attorney who approved
    approval_notes TEXT,
    approved_at TIMESTAMPTZ,

    -- Error tracking
    error_message TEXT,

    -- Timestamps
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_analysis_tasks_org ON law.analysis_tasks(organization_slug);
CREATE INDEX idx_analysis_tasks_task ON law.analysis_tasks(task_id);
CREATE INDEX idx_analysis_tasks_conversation ON law.analysis_tasks(conversation_id);
CREATE INDEX idx_analysis_tasks_status ON law.analysis_tasks(status);
CREATE INDEX idx_analysis_tasks_user ON law.analysis_tasks(user_id);

-- =============================================================================
-- DOCUMENT EXTRACTIONS
-- =============================================================================
-- Stores extracted text and metadata from uploaded documents
-- Original documents stored in Supabase Storage, referenced here
-- =============================================================================

CREATE TABLE law.document_extractions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_task_id UUID NOT NULL REFERENCES law.analysis_tasks(id) ON DELETE CASCADE,

    -- Original file reference (Supabase Storage)
    original_filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,         -- Path in Supabase Storage bucket
    file_type TEXT NOT NULL CHECK (file_type IN (
        'pdf',           -- Native PDF with text layer
        'pdf_scanned',   -- PDF that's actually images (requires vision/OCR)
        'docx',          -- Microsoft Word
        'doc',           -- Legacy Word
        'image',         -- PNG, JPG, JPEG, TIFF
        'txt',           -- Plain text
        'md'             -- Markdown
    )),
    file_size_bytes INTEGER,
    mime_type TEXT,                     -- 'application/pdf', 'image/png', etc.

    -- Extraction results
    page_count INTEGER,
    extraction_method TEXT NOT NULL CHECK (extraction_method IN (
        'pdf_text',      -- Direct PDF text extraction
        'docx_parse',    -- DOCX XML parsing
        'vision_model',  -- LLaVA, Qwen-VL, etc.
        'ocr',           -- Tesseract fallback
        'direct_read'    -- Plain text files
    )),
    extracted_text TEXT NOT NULL,

    -- Quality metrics
    confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),
    extraction_warnings TEXT[],         -- Any issues during extraction

    -- Processing metadata
    metadata JSONB,                     -- Vision model used, processing time, etc.

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_document_extractions_task ON law.document_extractions(analysis_task_id);
CREATE INDEX idx_document_extractions_storage ON law.document_extractions(storage_path);
CREATE INDEX idx_document_extractions_type ON law.document_extractions(file_type);

-- =============================================================================
-- SPECIALIST OUTPUTS
-- =============================================================================
-- One record per specialist agent invoked during analysis
-- Stores the specialist's findings, risks, and recommendations
-- =============================================================================

CREATE TABLE law.specialist_outputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_task_id UUID NOT NULL REFERENCES law.analysis_tasks(id) ON DELETE CASCADE,

    -- Specialist identification
    specialist_slug TEXT NOT NULL CHECK (specialist_slug IN (
        'contract',
        'compliance',
        'ip',
        'privacy',
        'employment',
        'corporate',
        'litigation',
        'real_estate'
    )),

    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'processing', 'completed', 'failed', 'skipped'
    )),

    -- Analysis output
    extracted_data JSONB,               -- Specialist-specific structured extraction
    risk_flags JSONB,                   -- Array of { level, description, recommendation }
    recommendations JSONB,              -- Array of action items
    summary TEXT,                       -- Plain text summary

    -- Quality
    confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),

    -- LLM usage
    llm_metadata JSONB,                 -- { provider, model, tokensUsed, latencyMs }

    -- Error tracking
    error_message TEXT,

    -- Timestamps
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_specialist_outputs_task ON law.specialist_outputs(analysis_task_id);
CREATE INDEX idx_specialist_outputs_specialist ON law.specialist_outputs(specialist_slug);
CREATE INDEX idx_specialist_outputs_status ON law.specialist_outputs(status);

-- =============================================================================
-- PLAYBOOKS
-- =============================================================================
-- Firm-configurable rules for analysis
-- Define what's acceptable, what to flag, threshold values
-- =============================================================================

CREATE TABLE law.playbooks (
    slug TEXT PRIMARY KEY,
    organization_slug TEXT NOT NULL,

    -- Playbook metadata
    name TEXT NOT NULL,
    description TEXT,
    document_type TEXT NOT NULL,        -- 'nda', 'msa', 'employment', etc.
    specialist_slug TEXT NOT NULL,      -- Which specialist uses this playbook

    -- Rules
    rules JSONB NOT NULL,               -- Firm's acceptable terms, flags, thresholds
    /*
    Example rules for NDA:
    {
        "termLimits": {
            "maxYears": 5,
            "warningYears": 3
        },
        "jurisdictions": {
            "acceptable": ["Delaware", "New York", "California"],
            "requiresApproval": ["International"],
            "prohibited": []
        },
        "confidentialityPeriod": {
            "minYears": 2,
            "maxYears": 10
        },
        "requiredClauses": [
            "mutual_obligations",
            "return_of_materials",
            "no_reverse_engineering"
        ],
        "prohibitedClauses": [
            "unlimited_liability",
            "exclusive_jurisdiction_foreign"
        ]
    }
    */

    -- Status
    is_active BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_playbooks_org ON law.playbooks(organization_slug);
CREATE INDEX idx_playbooks_doc_type ON law.playbooks(document_type);
CREATE INDEX idx_playbooks_specialist ON law.playbooks(specialist_slug);
CREATE INDEX idx_playbooks_active ON law.playbooks(is_active) WHERE is_active = true;

-- =============================================================================
-- EXECUTION QUEUE (Optional - for future complex orchestration)
-- =============================================================================
-- Track step-by-step execution for reconnection capability
-- Useful for long-running analyses or debugging
-- =============================================================================

CREATE TABLE law.execution_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_task_id UUID NOT NULL REFERENCES law.analysis_tasks(id) ON DELETE CASCADE,

    -- Step identification
    step_type TEXT NOT NULL CHECK (step_type IN (
        'document_upload',
        'document_extraction',
        'clo_routing',
        'specialist_analysis',
        'synthesis',
        'hitl_checkpoint',
        'report_generation'
    )),
    step_name TEXT NOT NULL,            -- Human-readable description
    sequence INTEGER NOT NULL,          -- Execution order

    -- Dependencies
    depends_on UUID[],                  -- Array of step IDs that must complete first

    -- Execution
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'processing', 'completed', 'failed', 'skipped'
    )),
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,

    -- Timestamps
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_execution_steps_task ON law.execution_steps(analysis_task_id);
CREATE INDEX idx_execution_steps_status ON law.execution_steps(status);
CREATE INDEX idx_execution_steps_sequence ON law.execution_steps(analysis_task_id, sequence);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to get analysis progress
CREATE OR REPLACE FUNCTION law.get_analysis_progress(p_analysis_task_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    specialist_progress JSONB;
BEGIN
    -- Get specialist progress
    SELECT jsonb_agg(
        jsonb_build_object(
            'specialist', specialist_slug,
            'status', status,
            'hasOutput', extracted_data IS NOT NULL
        )
    ) INTO specialist_progress
    FROM law.specialist_outputs
    WHERE analysis_task_id = p_analysis_task_id;

    -- Build full progress object
    SELECT jsonb_build_object(
        'status', at.status,
        'riskLevel', at.risk_level,
        'specialists', COALESCE(specialist_progress, '[]'::jsonb),
        'hasReport', at.synthesized_report IS NOT NULL,
        'approvalStatus', at.approval_status
    ) INTO result
    FROM law.analysis_tasks at
    WHERE at.id = p_analysis_task_id;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE law.analysis_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE law.document_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE law.specialist_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE law.playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE law.execution_steps ENABLE ROW LEVEL SECURITY;

-- Analysis tasks: viewable by org members
CREATE POLICY "analysis_tasks_org_read" ON law.analysis_tasks
    FOR SELECT USING (
        organization_slug IN (
            SELECT organization_slug FROM public.rbac_user_org_roles
            WHERE user_id = auth.uid()
        )
    );

-- Analysis tasks: insertable by org members
CREATE POLICY "analysis_tasks_org_insert" ON law.analysis_tasks
    FOR INSERT WITH CHECK (
        organization_slug IN (
            SELECT organization_slug FROM public.rbac_user_org_roles
            WHERE user_id = auth.uid()
        )
    );

-- Analysis tasks: updatable by owner or org admin
CREATE POLICY "analysis_tasks_update" ON law.analysis_tasks
    FOR UPDATE USING (
        user_id = auth.uid() OR
        organization_slug IN (
            SELECT organization_slug FROM public.rbac_user_org_roles
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

-- Document extractions: viewable if parent task is viewable
CREATE POLICY "document_extractions_read" ON law.document_extractions
    FOR SELECT USING (
        analysis_task_id IN (
            SELECT id FROM law.analysis_tasks
            WHERE organization_slug IN (
                SELECT organization_slug FROM public.rbac_user_org_roles
                WHERE user_id = auth.uid()
            )
        )
    );

-- Specialist outputs: viewable if parent task is viewable
CREATE POLICY "specialist_outputs_read" ON law.specialist_outputs
    FOR SELECT USING (
        analysis_task_id IN (
            SELECT id FROM law.analysis_tasks
            WHERE organization_slug IN (
                SELECT organization_slug FROM public.rbac_user_org_roles
                WHERE user_id = auth.uid()
            )
        )
    );

-- Playbooks: viewable by org members
CREATE POLICY "playbooks_org_read" ON law.playbooks
    FOR SELECT USING (
        organization_slug IN (
            SELECT organization_slug FROM public.rbac_user_org_roles
            WHERE user_id = auth.uid()
        )
    );

-- Playbooks: manageable by org admins
CREATE POLICY "playbooks_org_admin" ON law.playbooks
    FOR ALL USING (
        organization_slug IN (
            SELECT organization_slug FROM public.rbac_user_org_roles
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

-- Execution steps: viewable if parent task is viewable
CREATE POLICY "execution_steps_read" ON law.execution_steps
    FOR SELECT USING (
        analysis_task_id IN (
            SELECT id FROM law.analysis_tasks
            WHERE organization_slug IN (
                SELECT organization_slug FROM public.rbac_user_org_roles
                WHERE user_id = auth.uid()
            )
        )
    );

-- =============================================================================
-- SERVICE ROLE BYPASS (for backend operations)
-- =============================================================================

CREATE POLICY "service_role_analysis_tasks" ON law.analysis_tasks
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_document_extractions" ON law.document_extractions
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_specialist_outputs" ON law.specialist_outputs
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_playbooks" ON law.playbooks
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_execution_steps" ON law.execution_steps
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================================================
-- LOG SUCCESS
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Successfully created law schema with tables: analysis_tasks, document_extractions, specialist_outputs, playbooks, execution_steps';
END $$;
```

---

### 0.3 Supabase Storage Setup

**Why:** Original documents must be stored for **demo-grade retention**: re-extraction if models improve and attorney review of the source document. This is not positioned as legal-hold/compliance-grade retention in the demo.

**Deliverables:**
- [ ] Create `legal-documents` private storage bucket
- [ ] Configure RLS policies for org-scoped access
- [ ] Create signed URL generation function

**Storage Bucket Setup SQL:**

```sql
-- =============================================================================
-- LEGAL DOCUMENTS STORAGE BUCKET
-- =============================================================================

-- Create private bucket for legal documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'legal-documents',
    'legal-documents',
    false,  -- Private bucket
    52428800,  -- 50MB max file size
    ARRAY[
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/png',
        'image/jpeg',
        'image/tiff',
        'text/plain',
        'text/markdown'
    ]
);

-- =============================================================================
-- RLS POLICIES FOR STORAGE
-- =============================================================================

-- Policy: Org members can read their org's documents
CREATE POLICY "legal_documents_read" ON storage.objects
FOR SELECT USING (
    bucket_id = 'legal-documents'
    AND (storage.foldername(name))[1] IN (
        SELECT organization_slug FROM public.rbac_user_org_roles
        WHERE user_id = auth.uid()
    )
);

-- Policy: Org members can upload to their org's folder
CREATE POLICY "legal_documents_insert" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'legal-documents'
    AND (storage.foldername(name))[1] IN (
        SELECT organization_slug FROM public.rbac_user_org_roles
        WHERE user_id = auth.uid()
    )
);

-- Policy: Org admins can delete documents
CREATE POLICY "legal_documents_delete" ON storage.objects
FOR DELETE USING (
    bucket_id = 'legal-documents'
    AND (storage.foldername(name))[1] IN (
        SELECT organization_slug FROM public.rbac_user_org_roles
        WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
);

-- Service role bypass for backend operations
CREATE POLICY "legal_documents_service_role" ON storage.objects
FOR ALL TO service_role
USING (bucket_id = 'legal-documents')
WITH CHECK (bucket_id = 'legal-documents');
```

**Storage Path Convention:**

```
legal-documents/
├── {org_slug}/
│   ├── {conversation_id}/
│   │   ├── {document_id}/
│   │   │   ├── original.pdf
│   │   │   ├── original.docx
│   │   │   └── page_1.png (if image)
```

**TypeScript Interface:**

```typescript
interface DocumentStorageInfo {
  // Path in Supabase Storage
  // Pattern: {org_slug}/{conversation_id}/{document_id}/{filename}
  storagePath: string;

  // Original filename as uploaded
  originalFilename: string;

  // MIME type
  mimeType: string;

  // File size in bytes
  fileSizeBytes: number;

  // Signed URL for temporary access (1 hour default)
  signedUrl?: string;
}
```

---

### 0.4 Agent Registration in Database

**Why:** The API needs to know this agent exists to route requests correctly.

**Deliverables:**
- [ ] Add `legal-department` to `agents` table
- [ ] Set `agent_type = 'api'` (API runner invokes LangGraph)
- [ ] Configure `execution_capabilities`
- [ ] Set `config.api.url` to LangGraph endpoint
- [ ] Create seed SQL file

**Seed SQL:**

```sql
-- =============================================================================
-- LEGAL DEPARTMENT AGENT REGISTRATION
-- =============================================================================

INSERT INTO agents (
    slug,
    name,
    description,
    agent_type,
    execution_capabilities,
    config,
    is_active,
    created_at
) VALUES (
    'legal-department',
    'Legal Department AI',
    'Multi-agent legal analysis system with CLO orchestration, 8 specialist agents, and HITL approval workflow. Supports PDF, DOCX, and image document input via vision models.',
    'api',
    '{
        "can_build": true,
        "can_converse": false,
        "can_plan": false
    }'::jsonb,
    '{
        "api": {
            "endpoint": "/legal-department/analyze",
            "method": "POST",
            "timeout": 120000
        },
        "ui": {
            "customPane": true,
            "paneComponent": "LegalDepartmentConversation"
        },
        "features": {
            "documentUpload": true,
            "multimodalInput": true,
            "hitlCheckpoint": true,
            "progressTracking": true
        }
    }'::jsonb,
    true,
    NOW()
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    agent_type = EXCLUDED.agent_type,
    execution_capabilities = EXCLUDED.execution_capabilities,
    config = EXCLUDED.config,
    is_active = EXCLUDED.is_active;
```

---

### 0.5 LangGraph Project Setup

**Why:** The graph needs proper structure following existing patterns.

**Deliverables:**
- [ ] Create `apps/langgraph/src/agents/legal-department/` directory structure
- [ ] Set up graph entry point
- [ ] Define state interface
- [ ] Create HTTP endpoint
- [ ] Configure Postgres checkpointer

**Directory Structure:**

```
apps/langgraph/src/agents/legal-department/
├── index.ts                          # Exports
├── legal-department.graph.ts         # Main graph definition
├── legal-department.state.ts         # State interface
├── legal-department.types.ts         # Type definitions
├── legal-department.endpoint.ts      # HTTP endpoint handler
├── legal-department.factory.ts       # Graph factory with dependencies
├── nodes/
│   ├── index.ts
│   ├── document-intake.node.ts       # Receives document, validates
│   └── echo.node.ts                  # Simple test node for M0
├── services/
│   ├── index.ts
│   ├── document-storage.service.ts   # Supabase Storage operations
│   └── document-extraction.service.ts # Text extraction orchestration
├── tools/
│   └── index.ts
└── prompts/
    └── index.ts
```

**State Interface (`legal-department.state.ts`):**

```typescript
import { ExecutionContext } from '@orchestrator-ai/transport-types';

/**
 * Document metadata from upload (M0 basic extraction)
 */
export interface DocumentMetadata {
  originalFilename: string;
  storagePath: string;
  mimeType: string;
  fileSizeBytes: number;
  pageCount?: number;
  extractionMethod: 'pdf_text' | 'docx_parse' | 'vision_model' | 'ocr' | 'direct_read';
  extractionConfidence: number;
}

/**
 * Legal-specific document metadata (M1 will populate this)
 * M0 leaves this empty - M1 adds legal document intelligence
 */
export interface LegalDocumentMetadata {
  documentType: 'contract' | 'pleading' | 'correspondence' | 'memo' | 'unknown';
  detectedSections: string[];        // ['preamble', 'definitions', 'terms', 'signatures']
  hasSignatures: boolean;
  dates: {
    documentDate?: string;           // ISO date string
    effectiveDate?: string;
    expirationDate?: string;
  };
  parties: string[];                 // Preliminary party extraction
  extractionConfidence: number;      // 0.0-1.0 for legal metadata quality
}

/**
 * Combined document info - supports multiple documents
 */
export interface DocumentInfo {
  // Basic extraction (M0)
  metadata: DocumentMetadata;
  extractedText: string;

  // Legal intelligence (M1 - null until M1 runs)
  legalMetadata?: LegalDocumentMetadata;
}

/**
 * Output from a specialist agent
 */
export interface SpecialistOutput {
  specialistSlug: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  extractedData?: Record<string, unknown>;
  riskFlags?: Array<{
    level: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    recommendation: string;
  }>;
  recommendations?: string[];
  summary?: string;
  confidence?: number;
  llmMetadata?: {
    provider: string;
    model: string;
    tokensUsed: number;
    latencyMs: number;
  };
  errorMessage?: string;
}

/**
 * Main state for Legal Department graph
 */
export interface LegalDepartmentState {
  // =========================================================================
  // ExecutionContext - passed through unchanged from frontend
  // =========================================================================
  context: ExecutionContext;

  // =========================================================================
  // Input (populated from request)
  // =========================================================================

  /**
   * All uploaded documents with extracted text
   * Supports multiple documents (e.g., "compare these two contracts")
   * M0 populates metadata + extractedText
   * M1 adds legalMetadata to each document
   */
  documents: DocumentInfo[];

  /** Original user request/question */
  userRequest: string;

  // =========================================================================
  // Convenience accessors (for backward compatibility / simple cases)
  // =========================================================================

  /** Primary document text (first document) - convenience for single-doc flows */
  get primaryDocumentText(): string;

  /** Primary document metadata - convenience for single-doc flows */
  get primaryDocumentMetadata(): DocumentMetadata;

  // =========================================================================
  // CLO Routing (populated by CLO orchestrator)
  // =========================================================================

  /** Detected document type (nda, msa, employment, etc.) */
  documentType: string;

  /** Which specialists should analyze this document */
  selectedSpecialists: string[];

  /** CLO's reasoning for routing decision */
  routingReasoning?: string;

  // =========================================================================
  // Specialist Outputs (populated as specialists complete)
  // =========================================================================

  /** Map of specialist slug to output */
  specialistOutputs: Record<string, SpecialistOutput>;

  // =========================================================================
  // Synthesis (populated after all specialists complete)
  // =========================================================================

  /** Combined report from all specialists */
  synthesizedReport: string;

  /** Overall risk level */
  riskLevel: 'low' | 'medium' | 'high' | 'critical';

  /** Key findings across all specialists */
  keyFindings: string[];

  /** Action items for attorney */
  actionItems: string[];

  // =========================================================================
  // HITL (Human-in-the-Loop)
  // =========================================================================

  /** Is graph paused awaiting attorney approval? */
  awaitingApproval: boolean;

  /** Current approval status */
  approvalStatus: 'pending' | 'approved' | 'rejected' | 'changes_requested';

  /** Feedback from attorney if changes requested */
  approvalNotes?: string;

  // =========================================================================
  // Error Tracking
  // =========================================================================

  /** Any errors during processing */
  errors: string[];
}

/**
 * Initial state factory
 */
export function createInitialState(
  context: ExecutionContext,
  documents: DocumentInfo[],
  userRequest: string,
): LegalDepartmentState {
  return {
    context,
    documents,
    userRequest,

    // Convenience getters
    get primaryDocumentText() {
      return this.documents[0]?.extractedText ?? '';
    },
    get primaryDocumentMetadata() {
      return this.documents[0]?.metadata;
    },

    // CLO routing (empty until CLO runs)
    documentType: '',
    selectedSpecialists: [],
    specialistOutputs: {},

    // Synthesis (empty until synthesis runs)
    synthesizedReport: '',
    riskLevel: 'low',
    keyFindings: [],
    actionItems: [],

    // HITL
    awaitingApproval: false,
    approvalStatus: 'pending',

    // Errors
    errors: [],
  };
}
```

**HTTP Endpoint (`legal-department.endpoint.ts`):**

```typescript
import { Request, Response } from 'express';
import { ExecutionContext, isExecutionContext } from '@orchestrator-ai/transport-types';
import { createLegalDepartmentGraph } from './legal-department.graph';
import { LLMHttpClientService } from '../../services/llm-http-client.service';
import { ObservabilityService } from '../../services/observability.service';
import { PostgresCheckpointerService } from '../../services/postgres-checkpointer.service';
import { createInitialState } from './legal-department.state';

/**
 * Request from API - mirrors A2A metadata.extractedDocuments structure
 */
interface AnalyzeRequest {
  context: ExecutionContext;
  documents: Array<{
    filename: string;
    mimeType: string;
    fileSizeBytes: number;
    storagePath: string;
    extractedText: string;
    extractionMethod: string;
    confidence: number;
    pageCount?: number;
    warnings?: string[];
  }>;
  userRequest: string;
}

export async function handleAnalyzeRequest(
  req: Request,
  res: Response,
  llmClient: LLMHttpClientService,
  observability: ObservabilityService,
  checkpointer: PostgresCheckpointerService,
): Promise<void> {
  const body = req.body as AnalyzeRequest;

  // Validate ExecutionContext
  if (!isExecutionContext(body.context)) {
    res.status(400).json({
      error: 'Invalid ExecutionContext',
      message: 'Request must include valid ExecutionContext with all required fields',
    });
    return;
  }

  const { context, documents, userRequest } = body;

  // Convert API documents to internal DocumentInfo format
  const documentInfos: DocumentInfo[] = documents.map(doc => ({
    metadata: {
      originalFilename: doc.filename,
      storagePath: doc.storagePath,
      mimeType: doc.mimeType,
      fileSizeBytes: doc.fileSizeBytes,
      pageCount: doc.pageCount,
      extractionMethod: doc.extractionMethod as DocumentMetadata['extractionMethod'],
      extractionConfidence: doc.confidence,
    },
    extractedText: doc.extractedText,
    // legalMetadata: undefined - M1 will populate this
  }));

  try {
    // Log graph start
    await observability.log(context, 'legal.graph.started', {
      documentCount: documents.length,
      totalSize: documents.reduce((sum, d) => sum + d.fileSizeBytes, 0),
      userRequest: userRequest.substring(0, 200),
    });

    // Create graph
    const graph = createLegalDepartmentGraph(llmClient, observability, checkpointer);

    // Create initial state with all documents
    const initialState = createInitialState(
      context,
      documentInfos,
      userRequest,
    );

    // Execute graph
    const result = await graph.invoke(initialState, {
      configurable: {
        thread_id: context.taskId,
      },
    });

    // Log completion
    await observability.log(context, 'legal.graph.completed', {
      riskLevel: result.riskLevel,
      specialistsInvoked: Object.keys(result.specialistOutputs),
    });

    // Return result
    res.json({
      success: true,
      result: {
        synthesizedReport: result.synthesizedReport,
        riskLevel: result.riskLevel,
        keyFindings: result.keyFindings,
        actionItems: result.actionItems,
        specialistOutputs: result.specialistOutputs,
        awaitingApproval: result.awaitingApproval,
      },
    });
  } catch (error) {
    // Log error
    await observability.log(context, 'legal.graph.error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
```

---

### 0.6 ExecutionContext Integration

**Why:** ExecutionContext must flow through the entire system unchanged.

**Deliverables:**
- [ ] State includes full ExecutionContext
- [ ] Context extracted from HTTP request body
- [ ] Context available in every node
- [ ] Context passed to LLM service calls
- [ ] Context passed to observability calls

**Pattern for Node Implementation:**

```typescript
import { LegalDepartmentState } from '../legal-department.state';
import { LLMHttpClientService } from '../../../services/llm-http-client.service';
import { ObservabilityService } from '../../../services/observability.service';

export function createEchoNode(
  llmClient: LLMHttpClientService,
  observability: ObservabilityService,
) {
  return async (state: LegalDepartmentState): Promise<Partial<LegalDepartmentState>> => {
    const { context, documentText } = state;

    // Log node entry with ExecutionContext
    await observability.log(context, 'legal.node.entered', { node: 'echo' });

    // Make LLM call with ExecutionContext
    const response = await llmClient.chat({
      context,  // ExecutionContext flows to LLM service
      messages: [
        {
          role: 'system',
          content: 'You are a legal document echo assistant. Summarize the document briefly.',
        },
        {
          role: 'user',
          content: `Summarize this document:\n\n${documentText.substring(0, 2000)}...`,
        },
      ],
      callerName: 'legal-department-echo',
    });

    // Log node completion
    await observability.log(context, 'legal.node.completed', {
      node: 'echo',
      tokensUsed: response.usage?.totalTokens,
    });

    return {
      synthesizedReport: response.content,
      riskLevel: 'low',
    };
  };
}
```

---

### 0.7 LLM Service Integration

**Why:** LangGraph must call API's LLM service, not providers directly.

**Deliverables:**
- [ ] Use existing `LLMHttpClientService`
- [ ] All LLM calls go through API's `/llm/generate` endpoint
- [ ] ExecutionContext included in every request
- [ ] Token usage tracked

**LLMHttpClientService Usage:**

```typescript
import { LLMHttpClientService } from '../../services/llm-http-client.service';
import { ExecutionContext } from '@orchestrator-ai/transport-types';

// Create client (done once in factory)
const llmClient = new LLMHttpClientService({
  baseUrl: process.env.API_BASE_URL || 'http://localhost:6100',
});

// Use in node
const response = await llmClient.chat({
  context: state.context,  // ExecutionContext
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ],
  callerName: 'legal-department-clo',  // For logging/debugging
  options: {
    temperature: 0.2,  // Low temp for legal analysis
    maxTokens: 4000,
  },
});

// Response includes
// - content: string (the LLM response)
// - usage: { promptTokens, completionTokens, totalTokens }
// - model: string (which model was used)
// - provider: string (which provider)
```

---

### 0.8 Observability Integration

**Why:** Track execution for debugging and monitoring.

**Deliverables:**
- [ ] Use existing `ObservabilityService`
- [ ] Log events via API endpoint
- [ ] ExecutionContext included in every event

**Events to Log:**

| Event | When | Data |
|-------|------|------|
| `legal.graph.started` | Graph execution begins | documentType, documentSize, userRequest (truncated) |
| `legal.node.entered` | Node processing starts | node name |
| `legal.node.completed` | Node processing ends | node name, duration, tokensUsed |
| `legal.specialist.started` | Specialist begins analysis | specialist slug |
| `legal.specialist.completed` | Specialist finishes | specialist slug, confidence, riskCount |
| `legal.llm.called` | LLM invocation | callerName, model, tokenCount |
| `legal.document.stored` | Original document saved | storagePath, fileSize |
| `legal.document.extracted` | Text extraction complete | method, confidence, pageCount |
| `legal.hitl.awaiting` | Waiting for attorney | analysisTaskId |
| `legal.hitl.approved` | Attorney approved | approverId |
| `legal.graph.completed` | Graph execution complete | riskLevel, specialistsInvoked, totalDuration |
| `legal.graph.error` | Error occurred | error message, node where failed |

**ObservabilityService Usage:**

```typescript
import { ObservabilityService } from '../../services/observability.service';

// Create service (done once in factory)
const observability = new ObservabilityService({
  baseUrl: process.env.API_BASE_URL || 'http://localhost:6100',
});

// Log event
await observability.log(
  context,           // ExecutionContext
  'legal.node.completed',  // Event name
  {                  // Event data
    node: 'echo',
    duration: 1250,
    tokensUsed: 500,
  },
);
```

---

### 0.9 Conversation Pane Scaffold

**Why:** Need UI to test the full flow.

**Deliverables:**
- [ ] Create view directory structure
- [ ] Basic view component
- [ ] Conversation pane component
- [ ] Wire up to agent routing
- [ ] Use direct `fetch()` calls to the API A2A endpoint (no frontend orchestrator helper in M0)

**Directory Structure:**

```
apps/web/src/views/agents/legal-department/
├── index.ts                           # Exports
├── LegalDepartmentView.vue            # Main view (wrapper)
├── LegalDepartmentConversation.vue    # Conversation pane
├── legalDepartmentService.ts          # API calls via direct fetch to A2A endpoint
├── legalDepartmentTypes.ts            # TypeScript types
└── components/
    ├── DocumentUpload.vue             # File upload with drag-drop
    ├── AnalysisProgress.vue           # Progress tracking
    ├── SpecialistCard.vue             # Individual specialist output
    └── ResultsDisplay.vue             # Final results
```

**Service Pattern (`legalDepartmentService.ts`):**

```typescript
import { useExecutionContextStore } from '@/stores/executionContextStore';
import type { AnalysisResult } from './legalDepartmentTypes';

/**
 * Service for Legal Department AI interactions
 * All requests go through the API A2A endpoint (frontend never calls LangGraph directly).
 *
 * M0 decision: file uploads go through the existing A2A tasks endpoint as
 * `multipart/form-data`. The API stores + extracts documents and then the
 * API Agent Runner makes a **direct HTTP call** to the LangGraph router
 * (`/legal-department/analyze`) with `metadata.extractedDocuments`.
 */
export const legalDepartmentService = {
  /**
   * Upload a document and start analysis
   */
  async analyzeDocument(
    files: File[],
    userRequest: string,
  ): Promise<AnalysisResult> {
    const contextStore = useExecutionContextStore();
    const formData = new FormData();

    for (const file of files) {
      // IMPORTANT: field name must match FilesInterceptor('files')
      formData.append('files', file);
    }

    formData.append('request', JSON.stringify({
      context: contextStore.executionContext,
      userMessage: userRequest,
      metadata: {},
    }));

    // Direct call to the API A2A endpoint (NOT to LangGraph)
    // NOTE: do not set Content-Type; the browser will add the multipart boundary.
    const response = await fetch(
      `/agent-to-agent/${encodeURIComponent(contextStore.orgSlug)}/legal-department/tasks`,
      {
        method: 'POST',
        headers: {
          // Use whatever auth header pattern the app already uses for A2A calls
          // Authorization: `Bearer ${authToken}`,
        },
        body: formData,
      },
    );

    if (!response.ok) {
      throw new Error(`Legal Department A2A request failed: ${response.status}`);
    }

    return (await response.json()) as AnalysisResult;
  },

  /**
   * Get signed URL for document preview
   */
  async getDocumentUrl(storagePath: string): Promise<string> {
    const response = await fetch(`/api/legal-department/document-url?path=${encodeURIComponent(storagePath)}`);
    const { signedUrl } = await response.json();
    return signedUrl;
  },

  /**
   * Submit HITL approval decision
   */
  async submitApproval(
    analysisTaskId: string,
    decision: 'approved' | 'rejected' | 'changes_requested',
    notes?: string,
  ): Promise<void> {
    await fetch('/api/legal-department/approval', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysisTaskId, decision, notes }),
    });
  },
};
```

**Basic Conversation Pane (`LegalDepartmentConversation.vue`):**

```vue
<template>
  <div class="legal-department-conversation">
    <!-- Document Upload Section -->
    <section class="upload-section" v-if="!analysisStarted">
      <DocumentUpload
        @file-selected="handleFileSelected"
        :accepted-types="acceptedFileTypes"
      />

      <div class="request-input">
        <label>What would you like to analyze?</label>
        <textarea
          v-model="userRequest"
          placeholder="e.g., Review this NDA and flag any unusual terms"
        />
      </div>

      <button
        @click="startAnalysis"
        :disabled="!selectedFile || !userRequest"
      >
        Start Analysis
      </button>
    </section>

    <!-- Progress Section -->
    <section class="progress-section" v-if="analysisStarted && !analysisComplete">
      <AnalysisProgress :status="analysisStatus" />
    </section>

    <!-- Results Section -->
    <section class="results-section" v-if="analysisComplete">
      <ResultsDisplay :result="analysisResult" />

      <!-- HITL Actions -->
      <div class="hitl-actions" v-if="awaitingApproval">
        <button @click="submitApproval('approved')">Approve</button>
        <button @click="submitApproval('changes_requested')">Request Changes</button>
        <button @click="submitApproval('rejected')">Reject</button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import DocumentUpload from './components/DocumentUpload.vue';
import AnalysisProgress from './components/AnalysisProgress.vue';
import ResultsDisplay from './components/ResultsDisplay.vue';
import { legalDepartmentService } from './legalDepartmentService';

const selectedFile = ref<File | null>(null);
const userRequest = ref('');
const analysisStarted = ref(false);
const analysisComplete = ref(false);
const analysisStatus = ref<string>('pending');
const analysisResult = ref<any>(null);
const awaitingApproval = computed(() => analysisResult.value?.awaitingApproval);

const acceptedFileTypes = [
  '.pdf',
  '.docx',
  '.doc',
  '.png',
  '.jpg',
  '.jpeg',
  '.tiff',
  '.txt',
  '.md',
];

function handleFileSelected(file: File) {
  selectedFile.value = file;
}

async function startAnalysis() {
  if (!selectedFile.value || !userRequest.value) return;

  analysisStarted.value = true;
  analysisStatus.value = 'uploading';

  try {
    const result = await legalDepartmentService.analyzeDocument(
      selectedFile.value,
      userRequest.value,
    );

    analysisResult.value = result;
    analysisComplete.value = true;
  } catch (error) {
    analysisStatus.value = 'error';
    console.error('Analysis failed:', error);
  }
}

async function submitApproval(decision: 'approved' | 'rejected' | 'changes_requested') {
  await legalDepartmentService.submitApproval(
    analysisResult.value.analysisTaskId,
    decision,
  );
}
</script>
```

---

### 0.10 Transport Types Verification

**Why:** Ensure A2A protocol compliance.

**Deliverables:**
- [ ] Frontend uses `A2ATaskRequest` structure
- [ ] API returns `A2ATaskResponse` structure
- [ ] ExecutionContext matches transport types interface exactly
- [ ] No custom fields added to transport payloads

**Verification Tests:**

```typescript
// tests/legal-department/transport-types.test.ts

import { isExecutionContext } from '@orchestrator-ai/transport-types';

describe('Legal Department Transport Types', () => {
  it('should create valid ExecutionContext', () => {
    const context = {
      orgSlug: 'test-org',
      userId: 'user-123',
      conversationId: 'conv-456',
      taskId: 'task-789',
      planId: '00000000-0000-0000-0000-000000000000',
      deliverableId: 'del-012',
      agentSlug: 'legal-department',
      agentType: 'api',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    };

    expect(isExecutionContext(context)).toBe(true);
  });

  it('should reject incomplete ExecutionContext', () => {
    const badContext = {
      orgSlug: 'test-org',
      userId: 'user-123',
      // missing required fields
    };

    expect(isExecutionContext(badContext)).toBe(false);
  });
});
```

---

### 0.11 Multimodal Document Processing Infrastructure

**Note:** This section overlaps with **0.1 Multimodal Support in A2A Transport**. If any conflict exists, **0.1 is the source of truth**.

**Why:** Legal workflows start with documents, not prompts. Must handle PDF, DOCX, images, and scanned documents from day one.

**Deliverables:**
- [ ] Document upload endpoint
- [ ] File type detection service
- [ ] PDF text extraction (existing service)
- [ ] DOCX text extraction (existing service)
- [ ] Vision model integration for images/scanned docs
- [ ] OCR fallback service
- [ ] Unified document processing pipeline
- [ ] Store original in Supabase Storage before processing

**Document Processing Flow:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DOCUMENT PROCESSING PIPELINE                       │
└─────────────────────────────────────────────────────────────────────────────┘

[File Upload from Frontend]
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. STORAGE                                                                   │
│    - Upload to Supabase Storage: legal-documents/{org}/{conv}/{doc}/{file}  │
│    - Store metadata in law.document_extractions (partial record)            │
│    - Return storage_path                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. FILE TYPE DETECTION                                                       │
│    - Check MIME type                                                         │
│    - Verify file signature (magic bytes)                                     │
│    - Detect if PDF has text layer (native vs scanned)                       │
└─────────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────────────┐
│   PDF       │  PDF        │   DOCX      │   Image     │   Plain Text        │
│   (native)  │  (scanned)  │   / DOC     │   / TIFF    │   / Markdown        │
│             │             │             │             │                     │
│     │       │     │       │     │       │     │       │       │             │
│     ▼       │     ▼       │     ▼       │     ▼       │       ▼             │
│ ┌───────┐   │ ┌───────┐   │ ┌───────┐   │ ┌───────┐   │   ┌─────────┐       │
│ │PDF    │   │ │Vision │   │ │DOCX   │   │ │Vision │   │   │Direct   │       │
│ │Extract│   │ │Model  │   │ │Parser │   │ │Model  │   │   │Read     │       │
│ │Service│   │ │       │   │ │       │   │ │       │   │   │         │       │
│ └───┬───┘   │ └───┬───┘   │ └───┬───┘   │ └───┬───┘   │   └────┬────┘       │
│     │       │     │       │     │       │     │       │        │            │
│     │       │     │ ┌─────│─────│───────│─────│───────│────────│            │
│     │       │     │ │     │     │       │     │       │                     │
│     │       │     ▼ ▼     │     │       │     │       │                     │
│     │       │ ┌───────┐   │     │       │     │       │                     │
│     │       │ │OCR    │   │     │       │     │       │                     │
│     │       │ │Fallback│  │     │       │     │       │                     │
│     │       │ └───┬───┘   │     │       │     │       │                     │
└─────┼───────┴─────┼───────┴─────┼───────┴─────┼───────┴─────────┼───────────┘
      │             │             │             │                 │
      └─────────────┴─────────────┴─────────────┴─────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. EXTRACTION RESULT                                                         │
│    - Unified text output                                                     │
│    - Confidence score                                                        │
│    - Extraction method used                                                  │
│    - Page count (if applicable)                                             │
│    - Any warnings                                                            │
└─────────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. DATABASE UPDATE                                                           │
│    - Update law.document_extractions with:                                   │
│      - extracted_text                                                        │
│      - extraction_method                                                     │
│      - confidence                                                            │
│      - page_count                                                            │
│      - metadata (processing details)                                         │
└─────────────────────────────────────────────────────────────────────────────┘
            │
            ▼
[Return to LangGraph for Analysis]
```

**Vision Model Service (`vision-extraction.service.ts`):**

```typescript
import { ExecutionContext } from '@orchestrator-ai/transport-types';
import { LLMHttpClientService } from '../../services/llm-http-client.service';

export interface VisionExtractionResult {
  text: string;
  confidence: number;
  pageCount?: number;
  metadata: {
    model: string;
    provider: string;
    processingTimeMs: number;
    tokensUsed: number;
  };
  warnings?: string[];
}

export class VisionExtractionService {
  constructor(private llmClient: LLMHttpClientService) {}

  /**
   * Extract text from an image using a vision model
   */
  async extractFromImage(
    context: ExecutionContext,
    imageBuffer: Buffer,
    mimeType: string,
    originalFilename: string,
  ): Promise<VisionExtractionResult> {
    const startTime = Date.now();
    const base64Image = imageBuffer.toString('base64');

    try {
      // Call vision model through API's LLM service
      const response = await this.llmClient.chat({
        context: {
          ...context,
          // Override to use vision-capable model
          provider: 'ollama',
          model: 'llava:13b',  // or 'qwen2-vl:7b'
        },
        messages: [
          {
            role: 'system',
            content: `You are a document text extraction assistant. Extract ALL text from the provided image exactly as it appears. Maintain the original structure, paragraphs, and formatting. Include any headers, footers, page numbers, and marginalia. If text is unclear or partially visible, indicate this with [unclear] or [partial].`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                },
              },
              {
                type: 'text',
                text: `Extract all text from this document image (${originalFilename}). Preserve the document structure.`,
              },
            ],
          },
        ],
        callerName: 'legal-department-vision-extraction',
      });

      const processingTimeMs = Date.now() - startTime;

      return {
        text: response.content,
        confidence: this.estimateConfidence(response.content),
        metadata: {
          model: response.model,
          provider: response.provider,
          processingTimeMs,
          tokensUsed: response.usage?.totalTokens || 0,
        },
      };
    } catch (error) {
      throw new Error(`Vision extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract text from a scanned PDF (multi-page)
   */
  async extractFromScannedPdf(
    context: ExecutionContext,
    pdfBuffer: Buffer,
    originalFilename: string,
  ): Promise<VisionExtractionResult> {
    // Convert PDF pages to images (using pdf-to-img or similar)
    const pageImages = await this.pdfToImages(pdfBuffer);
    const pageTexts: string[] = [];
    const warnings: string[] = [];
    let totalTokens = 0;
    const startTime = Date.now();

    for (let i = 0; i < pageImages.length; i++) {
      try {
        const result = await this.extractFromImage(
          context,
          pageImages[i].buffer,
          'image/png',
          `${originalFilename} - Page ${i + 1}`,
        );
        pageTexts.push(`--- Page ${i + 1} ---\n${result.text}`);
        totalTokens += result.metadata.tokensUsed;
      } catch (error) {
        warnings.push(`Page ${i + 1} extraction failed: ${error instanceof Error ? error.message : 'Unknown'}`);
        pageTexts.push(`--- Page ${i + 1} ---\n[EXTRACTION FAILED]`);
      }
    }

    return {
      text: pageTexts.join('\n\n'),
      confidence: this.estimateConfidence(pageTexts.join('')),
      pageCount: pageImages.length,
      metadata: {
        model: 'llava:13b',
        provider: 'ollama',
        processingTimeMs: Date.now() - startTime,
        tokensUsed: totalTokens,
      },
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  private estimateConfidence(text: string): number {
    // Simple heuristic: penalize for [unclear], [partial], short text, etc.
    let confidence = 0.95;

    const unclearCount = (text.match(/\[unclear\]/gi) || []).length;
    const partialCount = (text.match(/\[partial\]/gi) || []).length;

    confidence -= unclearCount * 0.05;
    confidence -= partialCount * 0.03;

    if (text.length < 100) confidence -= 0.2;
    if (text.includes('[EXTRACTION FAILED]')) confidence -= 0.3;

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  private async pdfToImages(pdfBuffer: Buffer): Promise<Array<{ buffer: Buffer; page: number }>> {
    // Implementation would use pdf-to-img or similar library
    // For M0, this is a placeholder
    throw new Error('PDF to image conversion not yet implemented');
  }
}
```

**OCR Fallback Service (`ocr-extraction.service.ts`):**

```typescript
import Tesseract from 'tesseract.js';

export interface OCRExtractionResult {
  text: string;
  confidence: number;
  metadata: {
    processingTimeMs: number;
    wordsDetected: number;
  };
}

export class OCRExtractionService {
  /**
   * Extract text using Tesseract OCR (fallback when vision model unavailable)
   */
  async extractFromImage(
    imageBuffer: Buffer,
    language: string = 'eng',
  ): Promise<OCRExtractionResult> {
    const startTime = Date.now();

    const result = await Tesseract.recognize(
      imageBuffer,
      language,
      {
        logger: () => {}, // Suppress logging
      },
    );

    return {
      text: result.data.text,
      confidence: result.data.confidence / 100,  // Tesseract returns 0-100
      metadata: {
        processingTimeMs: Date.now() - startTime,
        wordsDetected: result.data.words.length,
      },
    };
  }
}
```

**Unified Document Processor (`document-processor.service.ts`):**

```typescript
import { ExecutionContext } from '@orchestrator-ai/transport-types';
import { VisionExtractionService } from './vision-extraction.service';
import { OCRExtractionService } from './ocr-extraction.service';
import { PdfExtractorService } from '../../../rag/extractors/pdf-extractor.service';
import { DocxExtractorService } from '../../../rag/extractors/docx-extractor.service';

export interface ProcessedDocument {
  text: string;
  method: 'pdf_text' | 'docx_parse' | 'vision_model' | 'ocr' | 'direct_read';
  confidence: number;
  pageCount?: number;
  metadata: Record<string, unknown>;
  warnings?: string[];
}

export class DocumentProcessorService {
  constructor(
    private visionService: VisionExtractionService,
    private ocrService: OCRExtractionService,
    private pdfService: PdfExtractorService,
    private docxService: DocxExtractorService,
  ) {}

  /**
   * Process any supported document type
   */
  async processDocument(
    context: ExecutionContext,
    buffer: Buffer,
    mimeType: string,
    filename: string,
  ): Promise<ProcessedDocument> {
    // Determine file type and processing method
    if (mimeType === 'application/pdf') {
      return this.processPdf(context, buffer, filename);
    }

    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mimeType === 'application/msword') {
      return this.processDocx(buffer, filename);
    }

    if (mimeType.startsWith('image/')) {
      return this.processImage(context, buffer, mimeType, filename);
    }

    if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
      return this.processPlainText(buffer, filename);
    }

    throw new Error(`Unsupported file type: ${mimeType}`);
  }

  private async processPdf(
    context: ExecutionContext,
    buffer: Buffer,
    filename: string,
  ): Promise<ProcessedDocument> {
    // First, try native text extraction
    const nativeResult = await this.pdfService.extract(buffer);

    // Check if PDF has meaningful text (not just whitespace)
    const hasText = nativeResult.text.trim().length > 100;

    if (hasText) {
      return {
        text: nativeResult.text,
        method: 'pdf_text',
        confidence: 0.95,
        pageCount: nativeResult.pageCount,
        metadata: { extractedNatively: true },
      };
    }

    // PDF is likely scanned - use vision model
    try {
      const visionResult = await this.visionService.extractFromScannedPdf(
        context,
        buffer,
        filename,
      );

      return {
        text: visionResult.text,
        method: 'vision_model',
        confidence: visionResult.confidence,
        pageCount: visionResult.pageCount,
        metadata: visionResult.metadata,
        warnings: visionResult.warnings,
      };
    } catch (error) {
      // Fall back to OCR
      console.warn('Vision extraction failed, falling back to OCR:', error);
      return this.fallbackToOcr(buffer, filename);
    }
  }

  private async processDocx(
    buffer: Buffer,
    filename: string,
  ): Promise<ProcessedDocument> {
    const result = await this.docxService.extract(buffer);

    return {
      text: result.text,
      method: 'docx_parse',
      confidence: 0.98,
      metadata: { paragraphCount: result.paragraphCount },
    };
  }

  private async processImage(
    context: ExecutionContext,
    buffer: Buffer,
    mimeType: string,
    filename: string,
  ): Promise<ProcessedDocument> {
    try {
      const result = await this.visionService.extractFromImage(
        context,
        buffer,
        mimeType,
        filename,
      );

      return {
        text: result.text,
        method: 'vision_model',
        confidence: result.confidence,
        metadata: result.metadata,
        warnings: result.warnings,
      };
    } catch (error) {
      console.warn('Vision extraction failed, falling back to OCR:', error);
      const ocrResult = await this.ocrService.extractFromImage(buffer);

      return {
        text: ocrResult.text,
        method: 'ocr',
        confidence: ocrResult.confidence,
        metadata: ocrResult.metadata,
      };
    }
  }

  private processPlainText(
    buffer: Buffer,
    filename: string,
  ): ProcessedDocument {
    return {
      text: buffer.toString('utf-8'),
      method: 'direct_read',
      confidence: 1.0,
      metadata: { filename },
    };
  }

  private async fallbackToOcr(
    buffer: Buffer,
    filename: string,
  ): Promise<ProcessedDocument> {
    // For PDF OCR fallback, we'd need to convert to images first
    // This is a simplified version
    const ocrResult = await this.ocrService.extractFromImage(buffer);

    return {
      text: ocrResult.text,
      method: 'ocr',
      confidence: ocrResult.confidence,
      metadata: ocrResult.metadata,
      warnings: ['Used OCR fallback - vision model was unavailable'],
    };
  }
}
```

**Supported File Types:**

| Type | Extension | MIME Type | Processing Method |
|------|-----------|-----------|-------------------|
| PDF (native text) | .pdf | application/pdf | PdfExtractorService |
| PDF (scanned) | .pdf | application/pdf | Vision model → OCR fallback |
| Word | .docx | application/vnd.openxmlformats-officedocument.wordprocessingml.document | DocxExtractorService |
| Legacy Word | .doc | application/msword | DocxExtractorService |
| PNG | .png | image/png | Vision model → OCR fallback |
| JPEG | .jpg, .jpeg | image/jpeg | Vision model → OCR fallback |
| TIFF | .tiff, .tif | image/tiff | Vision model → OCR fallback |
| Plain text | .txt | text/plain | Direct read |
| Markdown | .md | text/markdown | Direct read |

---

### 0.12 Integration Tests

**Why:** Prove the full flow works before building features.

**Deliverables:**
- [ ] Test: Frontend → API → LangGraph → API → Frontend flow
- [ ] Test: ExecutionContext arrives with all fields
- [ ] Test: LLM service is called correctly
- [ ] Test: Observability events are logged
- [ ] Test: Response returns correctly
- [ ] Test: Conversation pane renders
- [ ] Test: PDF upload extracts text
- [ ] Test: Image upload processed via vision model
- [ ] Test: Original document stored in Supabase Storage
- [ ] Test: Signed URL generated for document retrieval

**Test File (`tests/legal-department/integration.test.ts`):**

```typescript
import { describe, it, expect, beforeAll } from '@jest/globals';
import { isExecutionContext } from '@orchestrator-ai/transport-types';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:6100';
const LANGGRAPH_URL = process.env.LANGGRAPH_URL || 'http://localhost:6200';

describe('Legal Department AI - M0 Integration', () => {
  let authToken: string;
  let orgSlug: string;
  let conversationId: string;

  beforeAll(async () => {
    // Setup auth and create conversation
    // ... (implementation depends on auth setup)
  });

  describe('ExecutionContext Flow', () => {
    it('should create valid ExecutionContext on frontend', async () => {
      const context = {
        orgSlug,
        userId: 'test-user',
        conversationId,
        taskId: 'test-task',
        planId: '00000000-0000-0000-0000-000000000000',
        deliverableId: 'test-deliverable',
        agentSlug: 'legal-department',
        agentType: 'api',
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
      };

      expect(isExecutionContext(context)).toBe(true);
    });

    it('should pass ExecutionContext through API to LangGraph', async () => {
      // This test would verify the context arrives intact at LangGraph
      const response = await fetch(`${LANGGRAPH_URL}/legal-department/health`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: {
            orgSlug,
            userId: 'test-user',
            conversationId,
            taskId: 'test-task',
            planId: '00000000-0000-0000-0000-000000000000',
            deliverableId: 'test-deliverable',
            agentSlug: 'legal-department',
            agentType: 'api',
            provider: 'anthropic',
            model: 'claude-sonnet-4-20250514',
          },
        }),
      });

      expect(response.ok).toBe(true);
    });
  });

  describe('Document Upload & Storage', () => {
    it('should upload document to Supabase Storage', async () => {
      const file = new Blob(['Test PDF content'], { type: 'application/pdf' });
      const formData = new FormData();
      formData.append('file', file, 'test.pdf');

      const response = await fetch(`${API_BASE_URL}/legal-department/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'X-Org-Slug': orgSlug,
          'X-Conversation-Id': conversationId,
        },
        body: formData,
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.storagePath).toMatch(new RegExp(`^${orgSlug}/${conversationId}/`));
    });

    it('should generate signed URL for document retrieval', async () => {
      const storagePath = `${orgSlug}/${conversationId}/test-doc/test.pdf`;

      const response = await fetch(
        `${API_BASE_URL}/legal-department/document-url?path=${encodeURIComponent(storagePath)}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.signedUrl).toContain('token=');
    });
  });

  describe('Document Extraction', () => {
    it('should extract text from PDF', async () => {
      const storagePath = `${orgSlug}/${conversationId}/test-doc/test.pdf`;

      const response = await fetch(`${API_BASE_URL}/legal-department/extract`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ storagePath }),
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.text).toBeDefined();
      expect(result.method).toMatch(/pdf_text|vision_model|ocr/);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should extract text from image using vision model', async () => {
      // Upload image first
      const imageBuffer = await fetch('test-fixtures/contract-scan.png').then(r => r.arrayBuffer());
      const formData = new FormData();
      formData.append('file', new Blob([imageBuffer], { type: 'image/png' }), 'contract.png');

      const uploadResponse = await fetch(`${API_BASE_URL}/legal-department/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'X-Org-Slug': orgSlug,
          'X-Conversation-Id': conversationId,
        },
        body: formData,
      });

      const { storagePath } = await uploadResponse.json();

      // Extract
      const extractResponse = await fetch(`${API_BASE_URL}/legal-department/extract`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ storagePath }),
      });

      expect(extractResponse.ok).toBe(true);
      const result = await extractResponse.json();
      expect(result.method).toBe('vision_model');
    });
  });

  describe('Full Analysis Flow', () => {
    it('should complete echo analysis successfully', async () => {
      // This tests the M0 echo node - just proves the pipeline works
      const response = await fetch(`${API_BASE_URL}/agent-to-agent/${orgSlug}/legal-department/tasks`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          context: {
            orgSlug,
            userId: 'test-user',
            conversationId,
            taskId: `task-${Date.now()}`,
            planId: '00000000-0000-0000-0000-000000000000',
            deliverableId: `del-${Date.now()}`,
            agentSlug: 'legal-department',
            agentType: 'api',
            provider: 'anthropic',
            model: 'claude-sonnet-4-20250514',
          },
          userMessage: JSON.stringify({
            type: 'legal-analysis-request',
            documentText: 'This is a Non-Disclosure Agreement between Party A and Party B...',
            documentMetadata: {
              originalFilename: 'test-nda.pdf',
              storagePath: `${orgSlug}/${conversationId}/test/test-nda.pdf`,
              mimeType: 'application/pdf',
              fileSizeBytes: 12345,
              extractionMethod: 'pdf_text',
              extractionConfidence: 0.95,
            },
            userRequest: 'Review this NDA',
          }),
        }),
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.result.synthesizedReport).toBeDefined();
    });
  });

  describe('Observability', () => {
    it('should log graph events', async () => {
      // After running analysis, check that events were logged
      const response = await fetch(
        `${API_BASE_URL}/observability/events?conversationId=${conversationId}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      const events = await response.json();
      const eventNames = events.map((e: any) => e.event);

      expect(eventNames).toContain('legal.graph.started');
      expect(eventNames).toContain('legal.node.entered');
      expect(eventNames).toContain('legal.graph.completed');
    });
  });
});
```

---

## Acceptance Criteria

Before M0 can be considered complete, ALL of the following must be verified:

| # | Criterion | How to Verify |
|---|-----------|---------------|
| 1 | Build passes | `npm run build` succeeds for all apps |
| 2 | **Multimodal A2A works** | POST multipart/form-data with files to A2A endpoint succeeds |
| 3 | **Multiple files supported** | Upload 2+ files → all appear in `metadata.extractedDocuments` |
| 4 | **extractedDocuments in metadata** | Agent receives `metadata.extractedDocuments[]` with all fields |
| 5 | `law` schema created | `\dt law.*` shows all tables in Postgres |
| 6 | Storage bucket exists | `legal-documents` bucket in Supabase Storage |
| 7 | Agent registered | `SELECT * FROM agents WHERE slug = 'legal-department'` returns row |
| 8 | Full flow works | Integration test passes: Frontend → API → LangGraph → Response → Frontend |
| 9 | ExecutionContext verified | All 10 fields present at LangGraph endpoint |
| 10 | LLM routing verified | LangGraph calls API's `/llm/generate`, not direct providers |
| 11 | Observability verified | Events logged to observability system |
| 12 | UI loads | Conversation pane renders with document upload |
| 13 | PDF extraction works | Upload PDF → text extracted → arrives at LangGraph |
| 14 | Vision model works | Upload a scanned document **as an image** → vision model extracts text |
| 15 | Document storage works | Original file in Supabase Storage, signed URL retrievable |
| 16 | Database records created | `law.analysis_tasks` and `law.document_extractions` populated |

---

## Demo Script

After M0 completion, this demo should work:

1. **Navigate to Legal Department AI** in web app
2. **Upload a contract PDF** (drag-drop or file picker)
3. **See upload progress** - file stored in Supabase Storage
4. **See extraction progress** - text extracted from PDF
5. **Enter request**: "Review this contract"
6. **See analysis start** - ExecutionContext flows to LangGraph
7. **See echo response** - LLM summarizes the document
8. **Verify in database** - Records in `law.analysis_tasks` and `law.document_extractions`
9. **Verify signed URL** - Can retrieve original document from storage

**Demo talking points:**

- "The plumbing works end-to-end"
- "Original documents are stored securely for re-processing and review (demo-grade retention)"
- "We can upload any format - PDF, Word, or even photos of contracts"
- "ExecutionContext flows through the entire system for observability"
- "All LLM calls go through our central service for tracking"
- "Now we build legal analysis features on solid infrastructure"

---

## Files to Create

| File | Purpose |
|------|---------|
| `apps/api/supabase/migrations/YYYYMMDD_create_law_schema.sql` | Database schema |
| `apps/api/supabase/migrations/YYYYMMDD_create_legal_documents_bucket.sql` | Storage bucket |
| `apps/api/supabase/seed/legal-department-agent.sql` | Agent registration |
| `apps/langgraph/src/agents/legal-department/index.ts` | Exports |
| `apps/langgraph/src/agents/legal-department/legal-department.graph.ts` | Graph definition |
| `apps/langgraph/src/agents/legal-department/legal-department.state.ts` | State interface |
| `apps/langgraph/src/agents/legal-department/legal-department.types.ts` | Type definitions |
| `apps/langgraph/src/agents/legal-department/legal-department.endpoint.ts` | HTTP endpoint |
| `apps/langgraph/src/agents/legal-department/legal-department.factory.ts` | Factory with DI |
| `apps/langgraph/src/agents/legal-department/nodes/index.ts` | Node exports |
| `apps/langgraph/src/agents/legal-department/nodes/echo.node.ts` | Echo test node |
| `apps/langgraph/src/agents/legal-department/services/document-storage.service.ts` | Storage operations |
| `apps/langgraph/src/agents/legal-department/services/document-extraction.service.ts` | Extraction orchestration |
| `apps/langgraph/src/agents/legal-department/services/vision-extraction.service.ts` | Vision model extraction |
| `apps/langgraph/src/agents/legal-department/services/ocr-extraction.service.ts` | OCR fallback |
| `apps/web/src/views/agents/legal-department/index.ts` | View exports |
| `apps/web/src/views/agents/legal-department/LegalDepartmentView.vue` | Main view |
| `apps/web/src/views/agents/legal-department/LegalDepartmentConversation.vue` | Conversation pane |
| `apps/web/src/views/agents/legal-department/legalDepartmentService.ts` | API service |
| `apps/web/src/views/agents/legal-department/legalDepartmentTypes.ts` | TypeScript types |
| `apps/web/src/views/agents/legal-department/components/DocumentUpload.vue` | File upload |
| `apps/web/src/views/agents/legal-department/components/AnalysisProgress.vue` | Progress display |
| `apps/web/src/views/agents/legal-department/components/ResultsDisplay.vue` | Results display |
| `tests/legal-department/integration.test.ts` | Integration tests |
| `tests/legal-department/transport-types.test.ts` | Transport type tests |

---

## Dependencies

**Existing (no new installs needed):**
- `@orchestrator-ai/transport-types` - ExecutionContext, A2A types
- `@langchain/langgraph` - Graph framework
- Supabase client - Storage operations
- Existing PDF/DOCX extractors

**New Dependencies:**
- `tesseract.js` - OCR fallback (already in package.json for RAG)
- Vision model access via Ollama (LLaVA or Qwen-VL)

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Vision model not available | OCR fallback with Tesseract |
| Large PDF processing time | Progress indicators, async processing |
| Storage quota limits | File size limits in bucket config (50MB) |
| Context lost in flow | Integration tests verify ExecutionContext at each step |
| LLM routing broken | Tests verify calls go through API's `/llm/generate` |

---

## Next Milestone

After M0 completes, M1 (Legal Document Processing Enhancement) adds:
- Legal document type detection
- Section/clause boundary detection
- Signature block detection
- Date extraction
- Party name extraction
- Confidence scoring improvements

**M0 → M1 Handoff:**

| What M0 Provides | What M1 Adds |
|------------------|--------------|
| `documents[].metadata` (basic extraction info) | `documents[].legalMetadata` (legal intelligence) |
| `documents[].extractedText` (raw text) | Section boundaries in text |
| `extractionMethod` (how text was extracted) | `documentType` (contract, pleading, etc.) |
| `extractionConfidence` (extraction quality) | `legalMetadata.extractionConfidence` (legal detection quality) |
| Multimodal input (PDF, DOCX, images) | Legal-aware processing of each format |
| Multiple document support | Cross-document comparison capability |

**State Extensibility:**
- M0's `DocumentInfo` interface includes optional `legalMetadata?: LegalDocumentMetadata`
- M1 creates a node that populates `legalMetadata` for each document
- Specialists (M2+) can access both raw text AND legal metadata

M0's multimodal foundation + M1's legal intelligence = ready for specialist agents in M2+.

### M1 Entry Criteria (must be true before starting M1 planning)

- M0 acceptance criteria met (table above)
- Frontend upload path is stable: base64 files in `params.metadata.files` works from the Legal Department pane
- No duplicate upload patterns: avoid separate `/api/legal-department/upload|extract` flows unless explicitly required
- `documents[].legalMetadata` exists as an optional placeholder and remains unused in M0, ready for M1 population

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-05 | Initial M0 PRD created |
| 2026-01-05 | Added section 0.1 Multimodal Support in A2A Transport - extends existing metadata rather than creating new transport types |
| 2026-01-05 | Added vision model ENV configuration (default: llava:34b for demo quality) |
| 2026-01-05 | Renumbered sections 0.2-0.12 |
| 2026-01-05 | Updated state to support multiple documents (`documents: DocumentInfo[]` instead of singular) |
| 2026-01-05 | Added `LegalDocumentMetadata` interface as placeholder for M1 (M0 leaves it empty) |
| 2026-01-05 | Added M0 → M1 Handoff table clarifying what each milestone provides |
| 2026-01-05 | Clarified A2A conformance: `metadata` is a standard field in `TaskRequestParams`, files go in `params.metadata.files` as base64 |
| 2026-01-05 | Updated diagrams to show full JSON-RPC 2.0 structure with `params.metadata` |
| 2026-01-05 | Fixed endpoint name: `/llm/generate` not `/llm/chat` |
| 2026-01-05 | Changed hardcoded localhost:6200 to use `LANGGRAPH_URL` ENV variable |
| 2026-01-05 | Clarified frontend CAN call LangGraph directly for read-only domain data queries |
