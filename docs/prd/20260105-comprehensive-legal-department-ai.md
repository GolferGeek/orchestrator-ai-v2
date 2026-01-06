# Comprehensive Legal Department AI (Multi-Agent System)

**PRD Created:** 2026-01-05
**Status:** Draft
**Priority:** P2

## Overview

A multi-agent AI system that provides comprehensive legal department capabilities through specialized agents coordinated by a Chief Legal Officer (CLO) agent. Each specialist agent handles a specific legal domain, enabling firms to automate routine legal operations while maintaining attorney oversight.

## Demo vs Production Scope

**This is a DEMO workflow** designed to demonstrate value and architectural patterns. It is NOT a production-ready legal system.

### Demo Goals

| Goal | Why It Matters |
|------|----------------|
| Show multi-agent orchestration | Prove the CLO → Specialist pattern works |
| Demonstrate document ingestion | Show we can process real contracts |
| Highlight local LLM capability | Key differentiator vs cloud solutions |
| Prove HITL works | Critical for legal use cases |
| Generate impressive output | Sales demos, investor presentations |

### What We Build (Demo)

- **8 specialist agents** (Contract, Compliance, IP, Privacy, Employment, Corporate, Litigation, Real Estate)
- **CLO orchestrator** with intelligent routing
- **Multi-modal document input** (PDF, DOCX, images via vision model, scanned docs via OCR)
- **2 scenarios per specialist** (16 total + 4 system scenarios = 20)
- **Custom conversation pane** (document upload + specialist progress + results)
- **Happy path focus** (clean documents, clear requests)

### What Customers Extend (Production)

| Demo Limitation | Production Extension |
|-----------------|---------------------|
| 2 scenarios per specialist | 10-50+ scenarios per specialist for firm needs |
| Generic playbooks | Firm-specific playbooks with custom rules |
| PDF, DOCX, images, scanned docs | Email (EML/MSG), spreadsheets (XLSX), multi-file ZIP |
| Basic routing | ML-based classification, confidence scoring |
| Custom pane (basic) | Full custom pane with matter management |
| English only | Multi-language support |
| Generic prompts | Firm-specific training, fine-tuning |
| No integrations | Matter management, DMS, billing systems |

### Success Criteria for Demo

1. Upload a contract (PDF, DOCX, or image) → Get structured analysis in < 60 seconds
2. CLO correctly routes to Contract agent
3. Extracts 80%+ of key clauses from clean NDA
4. Flags at least one "risk" that makes sense
5. HITL checkpoint works (attorney can approve/reject)
6. Scanned document (image) is processed via vision model
7. Looks impressive in a 5-minute demo

### Explicit Non-Goals (for Demo)

- Production-grade accuracy
- All contract types
- Complex multi-agent synthesis
- Integration with external systems
- Multi-language support
- Audit trails / compliance logging
- User management / access control

## Milestone-Based Development Plan

**Philosophy:** Each milestone delivers demonstrable value. Limited scenarios per specialist (max 10 total for demo). Customers extend with their own scenarios.

### Milestone Overview

| Milestone | Deliverable | Demo Value |
|-----------|-------------|------------|
| **M0** | **Foundation + Multimodal Input** | "Upload any document - PDF, Word, or photo" |
| M1 | Legal document intelligence | "It knows it's an NDA with signatures" |
| M2 | Contract Agent + 2 scenarios | "It analyzes NDAs" |
| M3 | CLO routing works | "It routes to the right specialist" |
| M4 | Compliance Agent + 2 scenarios | "It checks firm policies" |
| M5 | IP Agent + 2 scenarios | "It understands licensing" |
| M6 | Privacy Agent + 2 scenarios | "It knows GDPR/CCPA" |
| M7 | Employment Agent + 2 scenarios | "It handles HR matters" |
| M8 | Corporate Agent + 2 scenarios | "It manages governance" |
| M9 | Litigation Agent + 2 scenarios | "It supports case work" |
| M10 | Real Estate Agent + 2 scenarios | "It reviews leases" |
| M11 | Multi-agent flow | "It coordinates all specialists" |
| M12 | HITL checkpoint | "Attorney stays in control" |
| M13 | Report generation | "Beautiful output" |

**Total: 8 specialists × 2 scenarios = 16 scenarios for demo**

**M0 includes:** Database schema, agent registration, transport types, ExecutionContext flow, LLM service integration, observability, conversation pane scaffold, AND multimodal document processing (PDF, DOCX, images via vision model, OCR fallback).

---

### Milestone 0: Foundation & Infrastructure
**Goal:** Set up the complete architectural foundation before any feature development

This milestone is critical. It ensures:
1. **Transport types are used correctly** - Frontend calls API, API calls LangGraph (never direct)
2. **ExecutionContext flows end-to-end** - From frontend through API runner to LangGraph and back
3. **Database schema exists** - Legal-specific tables for state not covered by API
4. **All patterns established** - So subsequent milestones just add features

**CRITICAL ARCHITECTURE RULES:**
- Frontend **NEVER** calls LangGraph directly - always goes through API via transport types
- API creates the API Agent Runner which calls LangGraph via HTTP
- ExecutionContext is created by frontend, flows through API runner, arrives at LangGraph intact
- Tasks and conversations are managed by API (not LangGraph)
- LangGraph only stores domain-specific state (legal analysis, outputs, etc.)

---

#### 0.1 Database Schema (`law` schema)

**Why:** Complex workflows need domain-specific tables for state that doesn't fit in generic API tables. The API handles conversations/tasks/deliverables, but legal-specific data (analysis results, specialist outputs, playbooks) needs its own schema.

**Deliverables:**
- [ ] Create migration: `apps/api/supabase/migrations/YYYYMMDD_create_law_schema.sql`
- [ ] Create `law` schema with tables for:
  - `law.analysis_tasks` - Legal analysis task tracking
  - `law.specialist_outputs` - Per-specialist analysis results
  - `law.playbooks` - Configurable rules (term limits, jurisdiction preferences)
  - `law.document_extractions` - Extracted clauses/entities from documents
- [ ] Add RLS policies for org-based access
- [ ] Add service role bypass policies
- [ ] Seed initial playbook data for demo

**Schema Pattern (following marketing schema):**
```sql
CREATE SCHEMA IF NOT EXISTS law;

-- Analysis tasks (links to API's tasks table)
CREATE TABLE law.analysis_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL,           -- FK to API's tasks table
    conversation_id UUID NOT NULL,   -- FK to conversations
    organization_slug TEXT NOT NULL,
    document_type TEXT,              -- 'nda', 'msa', 'employment', etc.
    status TEXT DEFAULT 'pending',
    clo_routing JSONB,               -- Which specialists were invoked
    risk_level TEXT,                 -- 'low', 'medium', 'high', 'critical'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Specialist outputs (one per specialist invoked)
CREATE TABLE law.specialist_outputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_task_id UUID REFERENCES law.analysis_tasks(id),
    specialist_slug TEXT NOT NULL,   -- 'contract', 'compliance', 'ip', etc.
    status TEXT DEFAULT 'pending',
    extracted_data JSONB,            -- Specialist-specific structured output
    risk_flags JSONB,                -- Array of risk items
    confidence FLOAT,
    llm_metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Playbooks (firm-configurable rules)
CREATE TABLE law.playbooks (
    slug TEXT PRIMARY KEY,
    organization_slug TEXT NOT NULL,
    document_type TEXT NOT NULL,     -- 'nda', 'msa', etc.
    rules JSONB NOT NULL,            -- Firm's acceptable terms, flags
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

#### 0.2 Agent Registration in Database

**Why:** The API needs to know this agent exists to route requests correctly.

**Deliverables:**
- [ ] Add `legal-department` to `agents` table
- [ ] Set `agent_type = 'api'` (API runner invokes LangGraph)
- [ ] Configure `execution_capabilities` (can_build=true, can_converse=false for now)
- [ ] Set `config.api.url` to LangGraph endpoint
- [ ] Create seed SQL file

**Seed Pattern:**
```sql
INSERT INTO agents (
    slug, name, description, agent_type,
    execution_capabilities, config, is_active
) VALUES (
    'legal-department',
    'Legal Department AI',
    'Multi-agent legal analysis with CLO orchestration',
    'api',
    '{"can_build": true, "can_converse": false, "can_plan": false}',
    '{
        "api": {
            "url": "http://localhost:6200/legal-department/analyze",
            "method": "POST"
        }
    }',
    true
);
```

---

#### 0.3 API Agent Runner Integration

**Why:** API Agent Runner is the bridge between frontend and LangGraph. It must properly forward ExecutionContext.

**Deliverables:**
- [ ] Verify `api-agent-runner.service.ts` properly forwards ExecutionContext to LangGraph
- [ ] Add any legal-specific handling if needed (likely none - generic runner works)
- [ ] Test that ExecutionContext arrives intact at LangGraph endpoint

**Data Flow:**
```
Frontend (Vue)
    ↓ POST /agent-to-agent/:org/legal-department/tasks
    ↓ (transport types: A2ATaskRequest with ExecutionContext)
API (NestJS)
    ↓ TasksController → AgentModeRouter → ApiAgentRunner
    ↓ ApiAgentRunner.execute() → HTTP POST to LangGraph
    ↓ (forwards ExecutionContext in request body)
LangGraph (Express)
    ↓ /legal-department/analyze endpoint
    ↓ Extracts ExecutionContext, invokes graph
    ↓ Returns result
API
    ↓ Creates deliverable, updates task
    ↓ Returns A2ATaskResponse
Frontend
    ↓ Displays results
```

---

#### 0.4 LangGraph Project Setup

**Why:** The graph itself needs proper structure following existing patterns.

**Deliverables:**
- [ ] Create `apps/langgraph/src/agents/legal-department/` directory
- [ ] Set up graph entry point (`legal-department.graph.ts`)
- [ ] Define state interface (`legal-department.state.ts`)
- [ ] Create HTTP endpoint (`/legal-department/analyze`)
- [ ] Configure Postgres checkpointer for persistence

**Structure:**
```
apps/langgraph/src/agents/legal-department/
├── legal-department.graph.ts      # Main graph definition
├── legal-department.state.ts      # State interface
├── legal-department.types.ts      # Type definitions
├── legal-department.endpoint.ts   # HTTP endpoint handler
├── nodes/
│   ├── index.ts
│   └── echo.node.ts              # Simple test node for M0
├── tools/
│   └── index.ts
└── prompts/
    └── index.ts
```

---

#### 0.5 ExecutionContext Integration

**Why:** ExecutionContext must flow through the entire system unchanged.

**Deliverables:**
- [ ] State includes full ExecutionContext (imported from `@orchestrator-ai/transport-types`)
- [ ] Context extracted from HTTP request body in endpoint
- [ ] Context available in every node
- [ ] Context passed to LLM service calls
- [ ] Context passed to observability calls

**State Pattern:**
```typescript
import { ExecutionContext } from '@orchestrator-ai/transport-types';

interface LegalDepartmentState {
  // ExecutionContext - passed through unchanged
  context: ExecutionContext;

  // Input (populated from request)
  documentText: string;
  documentMetadata: DocumentMetadata;
  userRequest: string;

  // Routing (populated by CLO)
  documentType: string;
  selectedSpecialists: string[];

  // Specialist outputs (populated as specialists complete)
  specialistOutputs: Record<string, SpecialistOutput>;

  // Final output
  synthesizedReport: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';

  // HITL
  awaitingApproval: boolean;
  approvalStatus: 'pending' | 'approved' | 'rejected' | 'changes_requested';
}
```

---

#### 0.6 LLM Service Integration

**Why:** LangGraph must call API's LLM service, not providers directly.

**Deliverables:**
- [ ] Use existing `LLMHttpClientService` in LangGraph
- [ ] All LLM calls go through `http://localhost:6100/llm/chat`
- [ ] ExecutionContext included in every LLM request
- [ ] Token usage tracked via API

**Pattern (from marketing-swarm):**
```typescript
import { LLMHttpClientService } from '../../services/llm-http-client.service';

// In graph creation
export function createLegalDepartmentGraph(
  llmClient: LLMHttpClientService,
  observability: ObservabilityService,
  checkpointer: PostgresCheckpointerService,
) {
  // Use llmClient for all LLM calls
  const response = await llmClient.chat({
    context: state.context,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    callerName: 'legal-department-clo',
  });
}
```

---

#### 0.7 Observability Integration

**Why:** Track execution for debugging and monitoring.

**Deliverables:**
- [ ] Use existing `ObservabilityService` in LangGraph
- [ ] Log events via API endpoint (not direct database)
- [ ] ExecutionContext included in every event

**Events to Track:**
- `legal.graph.started` - Graph execution begins
- `legal.node.entered` - Each node entry
- `legal.node.completed` - Each node completion
- `legal.llm.called` - LLM invocation
- `legal.graph.completed` - Graph execution complete
- `legal.graph.error` - Error occurred

---

#### 0.8 Conversation Pane Scaffold

**Why:** Need UI to test the full flow.

**Deliverables:**
- [ ] Create `apps/web/src/views/agents/legal-department/` directory
- [ ] Set up basic view component (`LegalDepartmentView.vue`)
- [ ] Create conversation pane component (`LegalDepartmentConversation.vue`)
- [ ] Wire up to agent routing (agent slug → view mapping)
- [ ] Basic layout with placeholder sections
- [ ] Use A2A orchestrator for API calls (same pattern as marketing-swarm)

**UI Structure:**
```
apps/web/src/views/agents/legal-department/
├── LegalDepartmentView.vue           # Main view
├── LegalDepartmentConversation.vue   # Conversation pane
├── legalDepartmentService.ts         # API calls via A2A orchestrator
└── components/
    ├── DocumentUpload.vue            # File upload (placeholder)
    ├── AnalysisProgress.vue          # Progress display (placeholder)
    └── ResultsDisplay.vue            # Results (placeholder)
```

**Service Pattern (from marketingSwarmService):**
```typescript
import { a2aOrchestrator } from '@/services/agent2agent/orchestrator/a2a-orchestrator';
import { useExecutionContextStore } from '@/stores/executionContextStore';

// All API calls go through A2A orchestrator
const result = await a2aOrchestrator.execute('build.create', {
  userMessage: JSON.stringify({
    type: 'legal-analysis-request',
    documentText,
    request: userRequest,
  }),
});
```

---

#### 0.9 Transport Types Verification

**Why:** Ensure we're using transport types correctly for A2A compliance.

**Deliverables:**
- [ ] Frontend uses `A2ATaskRequest` structure
- [ ] API returns `A2ATaskResponse` structure
- [ ] ExecutionContext follows `@orchestrator-ai/transport-types` interface exactly
- [ ] No custom fields added to transport payloads

---

#### 0.10 Multimodal Document Processing Infrastructure

**Why:** Legal workflows start with documents, not prompts. Must handle PDF, DOCX, images, and scanned documents from day one.

**Deliverables:**
- [ ] Document upload endpoint (accepts multiple file types)
- [ ] **Supabase Storage bucket** (`legal-documents`) for original files
- [ ] **Store original document** before processing (audit trail, re-extraction)
- [ ] File type detection service
- [ ] PDF text extraction (using existing `PdfExtractorService`)
- [ ] DOCX text extraction (using existing `DocxExtractorService`)
- [ ] Vision model integration for images/scanned docs (local LLaVA or Qwen-VL)
- [ ] OCR fallback service (Tesseract) for when vision model unavailable
- [ ] Unified document processing pipeline
- [ ] **Signed URL generation** for attorney review of original document

**Document Processing Flow:**
```
[File Upload]
      ↓
[File Type Detection]
      ↓
┌─────┴─────────────┬─────────────┬─────────────┐
│                   │             │             │
PDF              DOCX         Image        Scanned PDF
 │                  │             │             │
 ↓                  ↓             ↓             ↓
[PDF            [DOCX        [Vision       [PDF Extract
 Extractor]     Extractor]    Model]        + Vision]
 │                  │             │             │
 └──────────┬───────┴─────────────┴─────────────┘
            ↓
    [Unified Text + Metadata]
            ↓
    [Store in law.document_extractions]
            ↓
    [Pass to LangGraph State]
```

**Vision Model Setup:**
```typescript
// Local vision model for images/scanned documents
interface VisionService {
  // Extract text from image using local vision model
  extractTextFromImage(
    context: ExecutionContext,
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<{
    text: string;
    confidence: number;
    metadata: {
      model: string;
      processingTime: number;
    };
  }>;
}

// Implementation uses Ollama with LLaVA or Qwen-VL
// Falls back to Tesseract OCR if vision model unavailable
```

**Supported File Types (Demo):**
| Type | Extension | Processing |
|------|-----------|------------|
| PDF (native text) | .pdf | PdfExtractorService |
| PDF (scanned) | .pdf | Vision model + OCR fallback |
| Word | .docx, .doc | DocxExtractorService |
| Images | .png, .jpg, .jpeg, .tiff | Vision model |
| Plain text | .txt, .md | Direct read |

**Document Storage (Supabase Storage):**

Original documents MUST be stored for:
- Re-processing if extraction improves
- Audit trail / compliance
- Attorney review of source document
- Multi-page context when needed

```typescript
// Storage bucket structure
// Bucket: 'legal-documents' (private, org-scoped)

interface DocumentStoragePath {
  // Pattern: {org_slug}/{conversation_id}/{document_id}/{filename}
  // Example: acme-corp/conv-123/doc-456/vendor-agreement.pdf
  path: string;

  // Supabase storage URL (signed, time-limited for access)
  signedUrl: string;

  // Public URL (only if explicitly made public - usually NOT for legal docs)
  publicUrl?: string;
}
```

**Storage Flow:**
```
[File Upload]
      ↓
[Store Original in Supabase Storage]
      ↓
[Get storage_path]
      ↓
[Process for text extraction]
      ↓
[Store extraction result + storage_path reference]
```

**Database Table for Extractions:**
```sql
CREATE TABLE law.document_extractions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_task_id UUID REFERENCES law.analysis_tasks(id),

    -- Original file reference
    original_filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,        -- Supabase storage path
    file_type TEXT NOT NULL,           -- 'pdf', 'docx', 'image', 'scanned_pdf'
    file_size_bytes INTEGER,
    mime_type TEXT,                    -- 'application/pdf', 'image/png', etc.

    -- Extraction results
    page_count INTEGER,
    extraction_method TEXT NOT NULL,   -- 'pdf_extract', 'docx_extract', 'vision', 'ocr'
    extracted_text TEXT NOT NULL,
    confidence FLOAT,                  -- 0.0-1.0 for vision/OCR

    -- Metadata
    metadata JSONB,                    -- Processing details, vision model used, etc.
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for finding documents by storage path
CREATE INDEX idx_document_extractions_storage ON law.document_extractions(storage_path);
```

**Supabase Storage Bucket Setup:**
```sql
-- Create private bucket for legal documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('legal-documents', 'legal-documents', false);

-- RLS policy: Only org members can access their org's documents
CREATE POLICY "legal_documents_org_access" ON storage.objects
FOR ALL USING (
    bucket_id = 'legal-documents'
    AND (storage.foldername(name))[1] IN (
        SELECT organization_slug FROM public.rbac_user_org_roles
        WHERE user_id = auth.uid()
    )
);
```

**Why Store Originals:**
| Reason | Benefit |
|--------|---------|
| Re-extraction | Vision models improve; can re-process without re-upload |
| Audit trail | Prove what document was analyzed |
| Attorney review | Click to view original alongside AI analysis |
| Multi-page context | May need to re-read specific pages |
| Legal hold | Required for litigation; can't just store extracted text |

---

#### 0.11 Integration Test

**Why:** Prove the full flow works before building features.

**Deliverables:**
- [ ] Test: Frontend → API → LangGraph → API → Frontend flow works
- [ ] Test: ExecutionContext arrives at LangGraph with all fields
- [ ] Test: LLM service is called (not direct provider)
- [ ] Test: Observability events are logged
- [ ] Test: Response returns to frontend correctly
- [ ] Test: Conversation pane renders
- [ ] Test: PDF upload extracts text correctly
- [ ] Test: Image upload processed via vision model
- [ ] Test: **Original document stored in Supabase Storage**
- [ ] Test: **Signed URL generated for document retrieval**

**Simple Echo Test:**
```typescript
// LangGraph echo node for M0 testing
async function echoNode(state: LegalDepartmentState) {
  // Log that we received the context
  await observability.log(state.context, 'legal.node.entered', { node: 'echo' });

  // Make a simple LLM call to prove the pattern works
  const response = await llmClient.chat({
    context: state.context,
    messages: [
      { role: 'system', content: 'You are a test assistant.' },
      { role: 'user', content: `Echo this document content: ${state.documentText.substring(0, 500)}...` },
    ],
    callerName: 'legal-department-echo',
  });

  return {
    ...state,
    synthesizedReport: response.content,
  };
}
```

---

#### Acceptance Criteria for M0

1. **Build passes:** `npm run build` succeeds with all new code
2. **Database ready:** `law` schema created with all tables (including `document_extractions`)
3. **Storage ready:** `legal-documents` bucket created with RLS policies
4. **Agent registered:** `legal-department` appears in agents table
5. **Full flow works:** Frontend POST → API → LangGraph → Response → Frontend display
6. **ExecutionContext verified:** All fields present at LangGraph
7. **LLM routing verified:** Calls go through API's `/llm/chat`, not direct
8. **Observability verified:** Events logged for graph execution
9. **UI loads:** Conversation pane renders with document upload
10. **PDF extraction works:** Upload PDF → extracted text arrives at LangGraph
11. **Vision model works:** Upload image → vision model extracts text
12. **Document storage works:** Original file stored in Supabase Storage, signed URL retrievable

**Demo:** "The plumbing works - upload any document (PDF, Word, or photo of a contract), original is stored securely, text gets extracted, ExecutionContext flows end-to-end. Now we build legal analysis features on solid ground."

---

### Milestone 1: Legal Document Processing Enhancement
**Goal:** Add legal-specific document processing on top of M0's multimodal foundation

**Note:** M0 provides basic PDF/DOCX/image extraction. M1 adds legal document intelligence.

**Deliverables:**
- [ ] Legal document type detection (contract, pleading, correspondence, etc.)
- [ ] Section/clause boundary detection
- [ ] Signature block detection
- [ ] Date extraction and normalization
- [ ] Party name extraction (preliminary)
- [ ] Confidence scoring for extraction quality
- [ ] Handle multi-page documents with context continuity

**Legal-Specific Processing:**
```typescript
interface LegalDocumentMetadata {
  documentType: 'contract' | 'pleading' | 'correspondence' | 'memo' | 'unknown';
  detectedSections: string[];        // ['preamble', 'definitions', 'terms', 'signatures']
  hasSignatures: boolean;
  dates: {
    documentDate?: Date;
    effectiveDate?: Date;
    expirationDate?: Date;
  };
  parties: string[];                 // Preliminary party extraction
  pageCount: number;
  extractionConfidence: number;      // 0.0-1.0
}
```

**Demo:** "Upload a contract → System identifies it as an NDA, finds the signature blocks, extracts dates, and prepares it for specialist analysis"

---

### Milestone 2: Contract Agent (First Specialist)
**Goal:** Analyze an NDA and extract key clauses

**Scenarios (2 for M2):**

| # | Scenario | Input | Expected Output |
|---|----------|-------|-----------------|
| C1 | Standard NDA Review | Clean mutual NDA PDF | Extracts: term, confidentiality period, governing law |
| C2 | One-sided NDA Flag | NDA with no mutual obligations | Flags: "One-sided agreement - disclosing party only" |

**Deliverables:**
- [ ] Contract Agent registered in database
- [ ] NDA clause extraction prompt
- [ ] Basic playbook (acceptable vs flag)
- [ ] Structured output format
- [ ] C1 scenario passes
- [ ] C2 scenario passes

**Demo:** "Upload NDA → See clause breakdown → Notice the risk flag"

---

### Milestone 3: CLO Routing
**Goal:** CLO agent correctly identifies contract type and routes

**Scenarios (2 for M3):**

| # | Scenario | Input | Expected Routing |
|---|----------|-------|------------------|
| R1 | NDA Detection | "Review this NDA" + NDA PDF | Routes to Contract Agent |
| R2 | Unknown Type | "Review this document" + random PDF | Routes to Contract Agent with "unclassified" flag |

**Deliverables:**
- [ ] CLO Agent registered
- [ ] Classification prompt (contract types)
- [ ] Routing logic (keyword + content-based)
- [ ] R1 scenario passes
- [ ] R2 scenario passes

**Demo:** "I don't tell it what kind of contract - it figures it out"

---

### Milestone 4: Compliance Agent (Second Specialist)
**Goal:** Check document against firm policies

**Scenarios (2 for M4):**

| # | Scenario | Input | Expected Output |
|---|----------|-------|-----------------|
| P1 | Policy Compliance Check | NDA with 10-year term | Flags: "Term exceeds firm maximum (5 years)" |
| P2 | Jurisdiction Check | NDA with foreign governing law | Flags: "Non-US jurisdiction requires partner approval" |

**Deliverables:**
- [ ] Compliance Agent registered
- [ ] Firm policy playbook (term limits, jurisdictions)
- [ ] Policy comparison prompt
- [ ] P1 scenario passes
- [ ] P2 scenario passes

**Demo:** "It doesn't just read the contract - it knows our firm's rules"

---

### Milestone 5: IP Agent
**Goal:** Analyze intellectual property provisions and licensing terms

**Scenarios (2 for M5):**

| # | Scenario | Input | Expected Output |
|---|----------|-------|-----------------|
| IP1 | IP Ownership Clause | Contract with IP provisions | Flags: "Work-for-hire not specified - IP ownership unclear" |
| IP2 | License Scope Analysis | Software license agreement | Extracts: grant type, territory, exclusivity, sublicense rights |

**Deliverables:**
- [ ] IP Agent registered in database
- [ ] IP clause extraction prompt
- [ ] License analysis playbook
- [ ] IP1 scenario passes
- [ ] IP2 scenario passes

**Demo:** "It catches the IP ownership gap that could cost millions"

---

### Milestone 6: Privacy Agent
**Goal:** Check data protection and privacy compliance

**Scenarios (2 for M6):**

| # | Scenario | Input | Expected Output |
|---|----------|-------|-----------------|
| PV1 | DPA Review | Data Processing Agreement | Extracts: data types, retention periods, subprocessors |
| PV2 | Cross-Border Transfer | Contract with EU data provisions | Flags: "No SCCs or adequacy decision for EU data transfer" |

**Deliverables:**
- [ ] Privacy Agent registered in database
- [ ] GDPR/CCPA compliance prompts
- [ ] Data protection playbook
- [ ] PV1 scenario passes
- [ ] PV2 scenario passes

**Demo:** "It spots the GDPR violation before the regulators do"

---

### Milestone 7: Employment Agent
**Goal:** Review employment-related documents and flag HR risks

**Scenarios (2 for M7):**

| # | Scenario | Input | Expected Output |
|---|----------|-------|-----------------|
| E1 | Offer Letter Review | Employment offer letter | Extracts: compensation, benefits, at-will status, start date |
| E2 | Non-Compete Analysis | Employment agreement with non-compete | Flags: "Non-compete likely unenforceable in California" |

**Deliverables:**
- [ ] Employment Agent registered in database
- [ ] Employment document prompts
- [ ] State-by-state enforceability playbook
- [ ] E1 scenario passes
- [ ] E2 scenario passes

**Demo:** "It knows California non-competes are toast"

---

### Milestone 8: Corporate Agent
**Goal:** Handle corporate governance and entity management

**Scenarios (2 for M8):**

| # | Scenario | Input | Expected Output |
|---|----------|-------|-----------------|
| CG1 | Resolution Review | Board resolution draft | Flags: "Missing quorum statement" |
| CG2 | Annual Compliance | Entity information | Flags: "Annual report due in 30 days - Delaware" |

**Deliverables:**
- [ ] Corporate Agent registered in database
- [ ] Governance document prompts
- [ ] State compliance calendar
- [ ] CG1 scenario passes
- [ ] CG2 scenario passes

**Demo:** "It tracks your corporate housekeeping so you don't miss deadlines"

---

### Milestone 9: Litigation Agent
**Goal:** Support litigation workflow and deadline tracking

**Scenarios (2 for M9):**

| # | Scenario | Input | Expected Output |
|---|----------|-------|-----------------|
| L1 | Complaint Analysis | Opposing party's complaint | Extracts: claims, parties, relief sought, key allegations |
| L2 | Deadline Calculation | Case filing information | Calculates: answer deadline, discovery cutoff, pretrial dates |

**Deliverables:**
- [ ] Litigation Agent registered in database
- [ ] Pleading analysis prompts
- [ ] FRCP deadline calculator
- [ ] L1 scenario passes
- [ ] L2 scenario passes

**Demo:** "It reads the complaint and tells you exactly when you need to respond"

---

### Milestone 10: Real Estate Agent
**Goal:** Review real estate documents and transactions

**Scenarios (2 for M10):**

| # | Scenario | Input | Expected Output |
|---|----------|-------|-----------------|
| RE1 | Lease Review | Commercial lease agreement | Extracts: term, rent, CAM charges, renewal options, exclusives |
| RE2 | Title Exception | Title commitment | Flags: "Schedule B-II exception #4 requires payoff letter" |

**Deliverables:**
- [ ] Real Estate Agent registered in database
- [ ] Lease analysis prompts
- [ ] Title review playbook
- [ ] RE1 scenario passes
- [ ] RE2 scenario passes

**Demo:** "It pulls out every lease term and flags title issues"

---

### Milestone 11: Multi-Agent Flow
**Goal:** CLO routes to multiple agents, collects results

**Scenarios (1 for M11):**

| # | Scenario | Input | Expected Flow |
|---|----------|-------|---------------|
| MA1 | Multi-Domain Review | Vendor SaaS agreement | CLO → Contract + Privacy + IP → Combined output |

**Deliverables:**
- [ ] CLO can invoke multiple specialists in parallel
- [ ] Results aggregated from all invoked agents
- [ ] Combined output structure with per-agent sections
- [ ] MA1 scenario passes

**Demo:** "One document, three specialists, unified answer in seconds"

---

### Milestone 12: HITL Checkpoint
**Goal:** Attorney can review and approve/reject before final output

**Scenarios (1 for M12):**

| # | Scenario | Input | Expected Flow |
|---|----------|-------|---------------|
| H1 | Attorney Approval | Any analysis output | Pause → Show to attorney → Approve/Reject/Modify |

**Deliverables:**
- [ ] HITL interrupt point in graph
- [ ] Review UI (can be simple)
- [ ] Approve/Reject/Request Changes actions
- [ ] H1 scenario passes

**Demo:** "The AI doesn't send anything without attorney sign-off"

---

### Milestone 13: Report Generation
**Goal:** Generate polished, exportable report

**Scenarios (1 for M13):**

| # | Scenario | Input | Expected Output |
|---|----------|-------|-----------------|
| O1 | Executive Summary | Completed multi-agent analysis | PDF/Markdown report with summary, findings, recommendations |

**Deliverables:**
- [ ] Report template
- [ ] Synthesis prompt (combine all agent outputs)
- [ ] Export to Markdown/PDF
- [ ] Risk matrix visualization
- [ ] O1 scenario passes

**Demo:** "Here's the report you'd send to the client - from 8 specialists"

---

### Scenario Summary (16 Total for Demo)

| Agent | Scenarios | Description |
|-------|-----------|-------------|
| **Contract** | C1, C2 | NDA extraction, one-sided flag |
| **Compliance** | P1, P2 | Term limit, jurisdiction check |
| **IP** | IP1, IP2 | Ownership clause, license scope |
| **Privacy** | PV1, PV2 | DPA review, cross-border transfer |
| **Employment** | E1, E2 | Offer letter, non-compete analysis |
| **Corporate** | CG1, CG2 | Resolution review, annual compliance |
| **Litigation** | L1, L2 | Complaint analysis, deadline calculation |
| **Real Estate** | RE1, RE2 | Lease review, title exception |
| **CLO Routing** | R1, R2 | Document classification, unknown handling |
| **Multi-Agent** | MA1 | Multi-domain coordination |
| **HITL** | H1 | Attorney approval |
| **Report** | O1 | Executive summary generation |

**Total: 8 specialists × 2 scenarios + 4 system scenarios = 20 demo scenarios**

### Customer Extension Framework

After demo, customers add their own scenarios:

```yaml
# Example: Customer adds MSA scenarios
scenarios:
  - id: MSA-1
    name: "MSA Payment Terms"
    agent: contract
    input_type: msa
    checks:
      - payment_terms_present
      - net_30_or_better
    flags:
      - "Payment terms exceed Net 60"

  - id: MSA-2
    name: "MSA Indemnification"
    agent: contract
    input_type: msa
    checks:
      - mutual_indemnification
      - carve_outs_present
    flags:
      - "One-sided indemnification"
```

Customers can add 50-100+ scenarios per agent for their specific needs.

---

## All 8 Specialists - Reference

All specialists are built for demo with 2 scenarios each. This section documents their full capabilities for customer extension.

### Intellectual Property Agent

**Domain:** Patents, trademarks, copyrights, licensing, trade secrets

**Example Scenarios (customer would implement):**

| # | Scenario | Input | Expected Output |
|---|----------|-------|-----------------|
| IP1 | IP Ownership Clause | Contract with IP provisions | Flags: "Work-for-hire not specified" |
| IP2 | License Scope | Software license agreement | Extracts: grant type, territory, exclusivity |
| IP3 | Non-Compete Review | Employment agreement | Flags: "Non-compete exceeds 2 years" |
| IP4 | Trade Secret Protection | NDA | Assesses: adequacy of trade secret definitions |

**Knowledge Sources:**
- Patent/trademark databases
- Firm's IP portfolio records
- Standard IP clause library

---

### Privacy/Data Protection Agent

**Domain:** GDPR, CCPA, data processing, privacy policies, breach response

**Example Scenarios (customer would implement):**

| # | Scenario | Input | Expected Output |
|---|----------|-------|-----------------|
| PV1 | DPA Review | Data Processing Agreement | Extracts: data types, retention, subprocessors |
| PV2 | GDPR Compliance | Privacy policy | Flags: "Missing right to erasure" |
| PV3 | Cross-Border Transfer | Contract with EU data | Flags: "No SCCs or adequacy decision" |
| PV4 | Breach Notification | Incident report | Generates: notification timeline, required actions |

**Knowledge Sources:**
- GDPR/CCPA regulations
- Firm's DPA templates
- Data inventory records

---

### Employment Law Agent

**Domain:** Employment agreements, policies, terminations, discrimination, benefits

**Example Scenarios (customer would implement):**

| # | Scenario | Input | Expected Output |
|---|----------|-------|-----------------|
| E1 | Offer Letter Review | Employment offer | Extracts: compensation, benefits, at-will status |
| E2 | Termination Risk | Termination request | Assesses: discrimination risk, documentation adequacy |
| E3 | Non-Compete Analysis | Employment agreement | Flags: "Non-compete unenforceable in California" |
| E4 | Handbook Compliance | Employee handbook | Flags: "Missing FMLA policy" |

**Knowledge Sources:**
- State employment laws
- Firm's employment templates
- EEOC guidelines

---

### Corporate Governance Agent

**Domain:** Board resolutions, bylaws, minutes, entity management, filings

**Example Scenarios (customer would implement):**

| # | Scenario | Input | Expected Output |
|---|----------|-------|-----------------|
| CG1 | Resolution Drafting | Board action request | Generates: draft resolution with recitals |
| CG2 | Annual Compliance | Entity list | Flags: "Annual report due in 30 days" |
| CG3 | Subsidiary Check | Corporate structure | Identifies: missing authorizations |
| CG4 | Minutes Review | Board minutes draft | Flags: "Quorum not documented" |

**Knowledge Sources:**
- State corporate statutes
- Firm's corporate records
- Secretary of State databases

---

### Litigation Support Agent

**Domain:** Pleadings, discovery, deadlines, case strategy

**Example Scenarios (customer would implement):**

| # | Scenario | Input | Expected Output |
|---|----------|-------|-----------------|
| L1 | Complaint Analysis | Opposing complaint | Extracts: claims, parties, relief sought |
| L2 | Deadline Calculation | Case filing | Calculates: response deadline, discovery cutoff |
| L3 | Discovery Review | Document set | Identifies: privileged, responsive, hot documents |
| L4 | Motion Research | Legal issue | Generates: relevant case citations, arguments |

**Knowledge Sources:**
- Court rules (FRCP, local)
- Case law databases
- Firm's brief bank

---

### Real Estate Agent

**Domain:** Purchase agreements, leases, title, closings

**Example Scenarios (customer would implement):**

| # | Scenario | Input | Expected Output |
|---|----------|-------|-----------------|
| RE1 | Lease Review | Commercial lease | Extracts: term, rent, CAM, renewal options |
| RE2 | Title Review | Title commitment | Flags: "Schedule B exception requires clearance" |
| RE3 | Purchase Agreement | Asset purchase | Extracts: purchase price, contingencies, closing date |
| RE4 | Closing Checklist | Transaction docs | Generates: closing checklist with status |

**Knowledge Sources:**
- Standard lease forms
- Title requirements by state
- Firm's closing checklists

---

### Specialist Summary

| Specialist | Domain | Milestone | Demo Scenarios | Extension Examples |
|------------|--------|-----------|----------------|-------------------|
| **Contract** | General contracts, NDAs | M2 | C1, C2 | +2 more in reference |
| **Compliance** | Firm policies | M4 | P1, P2 | +2 more in reference |
| **IP** | Patents, trademarks, licensing | M5 | IP1, IP2 | +2 more in reference |
| **Privacy** | GDPR, CCPA, data protection | M6 | PV1, PV2 | +2 more in reference |
| **Employment** | HR, terminations, benefits | M7 | E1, E2 | +2 more in reference |
| **Corporate** | Governance, entities, filings | M8 | CG1, CG2 | +2 more in reference |
| **Litigation** | Pleadings, discovery, deadlines | M9 | L1, L2 | +2 more in reference |
| **Real Estate** | Leases, purchases, closings | M10 | RE1, RE2 | +2 more in reference |

**Total specialists:** 8 (all built for demo)
**Demo scenarios:** 16 specialist + 4 system = 20 total
**Extension examples:** 16 more documented for customer reference

## Problem Statement

- Legal departments handle diverse tasks requiring different expertise
- No single AI can be expert in all legal domains
- Generic legal AI lacks firm-specific knowledge
- Coordination between specialists is manual and error-prone
- SaaS multi-agent solutions require sending all data to cloud providers

## Competitive Advantage

- **Self-hosted**: All legal analysis stays inside the firewall
- **Customizable agents**: Each specialist can be trained on firm-specific knowledge
- **Coordinated workflow**: CLO agent routes and coordinates specialist work
- **Local LLMs**: No external API dependencies for sensitive matters
- **Modular**: Add new specialist agents as needed

## Agent Architecture

### CLO Agent (Orchestrator)

**Role:** Strategic oversight, task routing, and coordination

**Capabilities:**
- Analyze incoming requests
- Determine which specialist(s) needed
- Route tasks to appropriate agents
- Coordinate multi-agent workflows
- Synthesize specialist outputs
- Escalate to human attorneys when needed

### Specialist Agents

#### 1. Contract Agent
- Contract review and analysis
- Clause extraction and comparison
- Risk identification
- Draft generation from templates
- Redlining suggestions

#### 2. Compliance Agent
- Regulatory monitoring
- Policy compliance checks
- Audit preparation
- Compliance reporting
- Risk assessment

#### 3. Intellectual Property Agent
- Trademark searches
- Patent landscape analysis
- IP portfolio management
- Infringement risk assessment
- Licensing review

#### 4. Privacy/Data Protection Agent
- Privacy policy review
- GDPR/CCPA compliance
- Data processing agreement review
- Privacy impact assessments
- Breach response guidance

#### 5. Corporate Governance Agent
- Board resolution drafting
- Corporate minutes
- Entity management
- Annual compliance tracking
- Subsidiary management

#### 6. Employment Law Agent
- Employment agreement review
- Policy compliance (harassment, discrimination)
- Termination risk assessment
- Handbook updates
- Leave/accommodation guidance

## System Architecture

### Orchestration Pattern

```
                        [User Request]
                              ↓
                      [CLO Agent]
                     /     |      \
                    /      |       \
           [Analyze] [Classify] [Route]
                              ↓
                    [Select Specialist(s)]
                   /          |          \
            Contract    Compliance    Employment
               ↓              ↓            ↓
          [Execute]     [Execute]    [Execute]
               \              |            /
                \             |           /
                 →  [CLO Synthesizes]  ←
                          ↓
                   [HITL Review]
                          ↓
                   [Final Output]
```

### Multi-Agent Coordination

For complex requests requiring multiple specialists:

```
Request: "Review this vendor agreement for a SaaS product that will process employee data"

CLO Routes to:
├── Contract Agent → Agreement terms analysis
├── Privacy Agent → Data processing review
├── IP Agent → IP/license terms review
└── Employment Agent → Employee data handling

CLO Synthesizes → Unified risk report
```

## Agent Configuration

### CLO Agent

```yaml
agent:
  slug: legal-clo
  name: Chief Legal Officer Agent
  type: orchestrator

  capabilities:
    - task_classification
    - agent_routing
    - multi_agent_coordination
    - synthesis
    - escalation

  routing_rules:
    contract_keywords: [agreement, contract, NDA, MSA, terms]
    compliance_keywords: [regulation, compliance, audit, policy]
    ip_keywords: [patent, trademark, copyright, license, IP]
    privacy_keywords: [GDPR, CCPA, privacy, data protection, PII]
    corporate_keywords: [board, resolution, minutes, governance, subsidiary]
    employment_keywords: [employee, termination, harassment, handbook, leave]

  escalation_triggers:
    - high_risk_score
    - low_confidence
    - multi_jurisdictional
    - litigation_involved
    - regulatory_investigation
```

### Specialist Agent Template

```yaml
agent:
  slug: legal-contract-specialist
  name: Contract Specialist Agent
  type: specialist

  domain: contracts

  capabilities:
    - clause_extraction
    - risk_analysis
    - playbook_comparison
    - draft_generation
    - redlining

  knowledge_sources:
    - collection: contract-playbooks
    - collection: contract-templates
    - collection: past-contracts

  llm:
    provider: ollama
    model: legal-specialist-7b
    temperature: 0.2
```

## Workflow Examples

### Example 1: Simple Contract Review

```
User: "Review this NDA from Acme Corp"

1. CLO receives request
2. CLO classifies: Contract matter
3. CLO routes to: Contract Agent
4. Contract Agent:
   - Extracts clauses
   - Compares to playbook
   - Identifies risks
   - Generates report
5. CLO reviews output
6. HITL checkpoint (if needed)
7. Return analysis to user
```

### Example 2: Complex Multi-Domain Request

```
User: "We're acquiring a tech startup. What legal issues should we consider?"

1. CLO receives request
2. CLO classifies: Multi-domain M&A matter
3. CLO routes to multiple specialists:

   Contract Agent:
   - Acquisition agreement structure
   - Rep & warranty analysis

   IP Agent:
   - IP due diligence checklist
   - Patent/trademark review

   Employment Agent:
   - Employee transition issues
   - Key employee retention

   Corporate Agent:
   - Entity structure
   - Board approval requirements

   Compliance Agent:
   - Regulatory approvals needed
   - Hart-Scott-Rodino filing

4. CLO synthesizes all inputs
5. Generates comprehensive M&A checklist
6. HITL checkpoint with M&A partner
7. Return to user
```

## Implementation Phases

### Phase 1: Foundation
- CLO orchestrator agent
- Contract specialist agent
- Basic routing logic
- Single-agent workflows

### Phase 2: Expansion
- Add Compliance agent
- Add Employment agent
- Multi-agent coordination
- Improved routing

### Phase 3: Full Suite
- Add IP agent
- Add Privacy agent
- Add Corporate agent
- Complex workflow support

### Phase 4: Enhancement
- Learning from feedback
- Custom agent creation
- External data integration
- Advanced analytics

## Custom Conversation Pane Requirement

**This system requires a custom conversation pane** - it cannot fit in the default conversation UI.

### Why Default Pane Won't Work

| Feature Needed | Default Pane | Custom Pane |
|----------------|--------------|-------------|
| Agent routing visualization | No | Yes |
| Multiple specialist outputs | No | Yes |
| Synthesis view | No | Yes |
| HITL checkpoints per agent | No | Yes |
| Progress across agents | No | Yes |
| Domain-specific inputs | No | Yes |
| Document upload integration | Limited | Yes |

### UI Design

```
┌─────────────────────────────────────────────────────────┐
│  Legal Department AI                                    │
├─────────────────────────────────────────────────────────┤
│  [Request Input]                                        │
│  ┌─────────────────────────────────────────────────────┐│
│  │ "Review this vendor agreement for SaaS product..."  ││
│  │ [+ Attach Document]                                 ││
│  └─────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────┤
│  CLO Routing                                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Contract │ │ Privacy  │ │   IP     │ │Employment│   │
│  │    ✓     │ │    ⏳    │ │    ○     │ │    ○     │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
├─────────────────────────────────────────────────────────┤
│  Specialist Outputs                    [Tabs/Accordion] │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Contract Agent                              [Done]  ││
│  │ • Term: 3 years (acceptable)                        ││
│  │ • Liability cap: $100K (FLAG: below standard)       ││
│  │ • Indemnification: Mutual (acceptable)              ││
│  └─────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────┐│
│  │ Privacy Agent                            [Running]  ││
│  │ • Analyzing data processing terms...                ││
│  └─────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────┤
│  Synthesized Report                    [After all done] │
│  ┌─────────────────────────────────────────────────────┐│
│  │ ## Executive Summary                                ││
│  │ Risk Level: MEDIUM                                  ││
│  │ Key Issues: 3 flags identified                      ││
│  │ Recommendation: Negotiate liability cap             ││
│  └─────────────────────────────────────────────────────┘│
│  [Approve] [Request Changes] [Escalate to Attorney]     │
└─────────────────────────────────────────────────────────┘
```

### UI Components Needed

1. **Request Input Panel**
   - Text input for legal question/request
   - Document upload (drag-and-drop)
   - Matter/client selector (optional)
   - Priority selector

2. **Routing Visualization**
   - CLO decision display
   - Specialist agent cards with status
   - Visual progress indicators
   - Routing explanation (why these agents?)

3. **Specialist Output Panels**
   - Tabbed or accordion layout
   - Per-agent results display
   - Risk flags with severity
   - Confidence indicators
   - Individual HITL controls per agent

4. **Synthesis Panel**
   - Executive summary
   - Combined risk matrix
   - Unified recommendations
   - Conflict resolution (if specialists disagree)

5. **Action Bar**
   - Approve/Accept
   - Request re-analysis
   - Escalate to human attorney
   - Export report
   - Save to matter

### Reference Implementation

Similar to Marketing Swarm conversation pane:
- [SwarmConfigForm.vue](apps/web/src/views/agents/marketing-swarm/components/SwarmConfigForm.vue)
- [SwarmProgress.vue](apps/web/src/views/agents/marketing-swarm/components/SwarmProgress.vue)
- [SwarmResults.vue](apps/web/src/views/agents/marketing-swarm/components/SwarmResults.vue)

### Simplified v1 Option

For initial development, a simplified version could work in the default pane:
- Single specialist at a time (no orchestration)
- User manually selects which specialist to use
- No synthesis (just individual agent outputs)
- Basic HITL via standard conversation flow

This would allow testing individual specialists before building the full orchestration UI.

## Multi-Modal Input Requirements

**Legal workflows typically start with documents, not text prompts.** The system must handle various input types.

### Primary Input Types

| Input Type | Examples | Processing Needed |
|------------|----------|-------------------|
| **PDF Documents** | Contracts, court filings, agreements | Text extraction, OCR for scans |
| **Word Documents** | Draft agreements, memos, letters | DOCX parsing |
| **Images** | Signed contracts, handwritten notes, photos of documents | Vision model / OCR |
| **Scanned Documents** | Older records, faxes, filed court documents | OCR + cleanup |
| **Email** | Correspondence, attached documents | Email parsing + attachment handling |
| **Spreadsheets** | Financial data, asset lists, schedules | Table extraction |

### Vision Model Requirements

For scanned/image documents:
- **Local vision model**: LLaVA, Qwen-VL, or similar
- **OCR fallback**: Tesseract or similar for text extraction
- **Table extraction**: For financial statements, schedules
- **Handwriting recognition**: For signatures, annotations, notes
- **Multi-page handling**: Stitch context across pages

### Input Processing Pipeline

```
[User Upload]
      ↓
[File Type Detection]
      ↓
┌─────┴─────┐
│           │
PDF      Image/Scan      DOCX      Email
 │           │             │         │
 ↓           ↓             ↓         ↓
[Text     [Vision       [DOCX    [Parse +
Extract]   Model/OCR]   Parse]   Attachments]
 │           │             │         │
 └─────┬─────┴─────────────┴─────────┘
       ↓
[Unified Text + Metadata]
       ↓
[CLO Agent Processing]
```

### Supported File Formats

**Must Have (v1):**
- PDF (native text + scanned)
- DOCX/DOC
- Images (PNG, JPG, TIFF)
- Plain text (TXT, MD)

**Should Have (v2):**
- Email (EML, MSG)
- Spreadsheets (XLSX, CSV)
- Multi-file uploads (ZIP)
- HTML (web pages, email exports)

**Nice to Have (v3):**
- Audio (voicemail, recorded calls) → transcription
- Video (depositions) → transcription
- Handwritten documents → specialized OCR

### Quality Considerations

| Challenge | Solution |
|-----------|----------|
| Poor scan quality | Image preprocessing, confidence scoring |
| Multi-column layouts | Layout analysis before extraction |
| Tables and forms | Specialized table extraction |
| Legal formatting (numbered paragraphs) | Structure preservation |
| Redacted sections | Detection and flagging |
| Mixed languages | Language detection per section |

### Existing Infrastructure

We can leverage:
- **RAG document extractors**: [PdfExtractorService](apps/api/src/rag/extractors/pdf-extractor.service.ts), [DocxExtractorService](apps/api/src/rag/extractors/docx-extractor.service.ts)
- **Embedding service**: For document similarity/classification
- **Document processor**: [DocumentProcessorService](apps/api/src/rag/document-processor.service.ts)

### New Components Needed

1. **Vision model integration** - For scanned documents and images
2. **OCR service** - Fallback for text extraction
3. **Table extractor** - For financial documents
4. **Email parser** - For correspondence
5. **Quality scorer** - Confidence in extraction quality
6. **Multi-file handler** - Process related documents together

## Technical Requirements

### LangGraph Implementation

Each specialist as a subgraph that can be invoked by CLO:

```typescript
interface LegalAgentState {
  request: string;
  classification: string[];
  assignedAgents: string[];
  agentOutputs: Record<string, AgentOutput>;
  synthesizedResponse: string;
  confidenceScore: number;
  requiresHumanReview: boolean;
}
```

### Knowledge Base Requirements

Each specialist needs:
- RAG collection with domain-specific documents
- Playbooks/checklists for common tasks
- Template library
- Historical matter data (anonymized)

## Success Metrics

- 80%+ of routine legal questions handled without escalation
- 90%+ routing accuracy by CLO
- 50% reduction in response time for common requests
- Attorney satisfaction with agent recommendations
- Reduction in outside counsel spend for routine matters

## Disclaimers

**CRITICAL:** This system provides legal information and templates, NOT legal advice. All outputs must be reviewed by qualified attorneys. The system does not create attorney-client privilege.

## Open Questions

1. How to handle conflicts between specialist recommendations?
2. Liability model for AI-assisted legal work?
3. Training data sources for domain-specific knowledge?
4. Integration with matter management systems?
5. Multi-jurisdictional capability requirements?

## Next Steps

1. [ ] Build CLO orchestrator agent
2. [ ] Build Contract specialist (first specialist)
3. [ ] Implement routing logic
4. [ ] Build single-agent workflow
5. [ ] Add second specialist (Compliance or Employment)
6. [ ] Implement multi-agent coordination
7. [ ] Build synthesis capability
8. [ ] Add remaining specialists
9. [ ] Test complex multi-agent workflows
10. [ ] Build monitoring and feedback system
