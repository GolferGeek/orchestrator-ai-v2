# Legal Department AI - M0 Setup Guide

**Milestone**: M0 - Foundation & Infrastructure
**Last Updated**: 2026-01-06

---

## Overview

This guide provides complete setup instructions for Legal Department AI Milestone 0. M0 establishes the architectural foundation with no feature development - only infrastructure.

### What M0 Includes

✅ Multimodal document upload (PDF, DOCX, images)
✅ Database schema (law.*) with RLS policies
✅ Supabase Storage bucket for original documents
✅ Agent registration in database
✅ LangGraph project structure with echo node
✅ ExecutionContext integration throughout stack
✅ LLM service integration via API
✅ Observability integration
✅ Vue.js conversation pane
✅ Document processing infrastructure
✅ Integration tests
✅ Transport types verification

### What M0 Does NOT Include

❌ Legal analysis features (CLO routing, specialists, synthesis)
❌ Production-grade audit logging
❌ Playbook configuration UI
❌ Advanced HITL workflows
❌ Multi-document comparison
❌ Legal metadata extraction

---

## Prerequisites

### Required Software

- **Node.js**: v20.x or later
- **npm**: v10.x or later
- **Docker Desktop**: Latest version
- **Supabase CLI**: Latest version
- **PostgreSQL client** (optional, for database inspection)

### Required Services

- **Supabase** (local instance via Docker)
- **API Server** (NestJS on port 6100)
- **LangGraph Server** (FastAPI on port 8200)
- **Web App** (Vue.js on port 8100)

### Environment Variables

Create/update `.env` files in each app directory:

#### apps/api/.env
```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# LangGraph
LANGGRAPH_BASE_URL=http://localhost:8200

# Vision Model
VISION_MODEL=gpt-4-vision-preview
VISION_PROVIDER=openai
OLLAMA_BASE_URL=http://localhost:11434  # If using Ollama

# LLM Configuration
ANTHROPIC_API_KEY=your-anthropic-key
OPENAI_API_KEY=your-openai-key

# Storage
MEDIA_STORAGE_BUCKET=media
LEGAL_DOCUMENTS_BUCKET=legal-documents
```

#### apps/langgraph/.env
```bash
# API Integration
API_BASE_URL=http://localhost:6100

# LLM Service (via API)
# LangGraph calls API's /llm/generate endpoint, not direct providers

# Database (for checkpointer)
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
```

#### apps/web/.env
```bash
VITE_API_BASE_URL=http://localhost:6100
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## Installation

### 1. Clone Repository

```bash
git clone <repo-url>
cd orchestrator-ai-v2
```

### 2. Install Dependencies

```bash
# Root dependencies
npm install

# API dependencies
cd apps/api
npm install

# LangGraph dependencies
cd apps/langgraph
npm install  # or uv sync if using uv

# Web dependencies
cd apps/web
npm install
```

### 3. Database Setup

#### Start Supabase

```bash
cd apps/api
npx supabase start
```

This will:
- Start PostgreSQL on port 54322
- Start Supabase Studio on port 54323
- Display your `ANON_KEY` and `SERVICE_ROLE_KEY`

#### Apply Migrations

```bash
# Apply all migrations (includes law schema and storage bucket)
npx supabase db reset

# Or apply migrations incrementally
cd supabase/migrations
for file in *.sql; do
  docker exec -i supabase_db_api-dev psql -U postgres -d postgres < "$file"
done
```

#### Verify Schema

```bash
# Check law schema tables
docker exec -it supabase_db_api-dev psql -U postgres -d postgres -c "\dt law.*"

# Check storage bucket
docker exec -it supabase_db_api-dev psql -U postgres -d postgres -c "SELECT id, name FROM storage.buckets WHERE id = 'legal-documents';"

# Check agent registration
docker exec -it supabase_db_api-dev psql -U postgres -d postgres -c "SELECT slug, name, agent_type FROM public.agents WHERE slug = 'legal-department';"
```

Expected output:
- 5 tables in law schema
- legal-documents bucket exists
- legal-department agent registered

### 4. Seed Data (Optional)

```bash
cd apps/api
npx supabase db seed
```

This will create:
- Test organizations
- Test users
- Sample agents

---

## Running the Application

### Development Mode

Start all services in separate terminals:

#### Terminal 1: Supabase
```bash
cd apps/api
npx supabase start
```

Keep this running. Supabase Studio available at http://localhost:54323

#### Terminal 2: API Server
```bash
cd apps/api
npm run start:dev
```

API will be available at http://localhost:6100

#### Terminal 3: LangGraph Server
```bash
cd apps/langgraph
npm run start:dev
```

LangGraph will be available at http://localhost:8200

#### Terminal 4: Web App
```bash
cd apps/web
npm run dev
```

Web app will be available at http://localhost:8100

### Verify Services

```bash
# Check API health
curl http://localhost:6100/health

# Check LangGraph health
curl http://localhost:8200/health

# Check Web app
# Open browser to http://localhost:8100
```

---

## Testing

### Run All Tests

```bash
cd apps/api
npm run test:e2e -- legal-department
```

### Run Specific Test Suites

```bash
# Transport types verification
npm run test:e2e -- legal-department/transport-types

# ExecutionContext flow
npm run test:e2e -- legal-department/execution-context

# Document upload
npm run test:e2e -- legal-department/document-upload

# Document extraction
npm run test:e2e -- legal-department/document-extraction

# Full integration
npm run test:e2e -- legal-department/integration

# Observability
npm run test:e2e -- legal-department/observability
```

### Test Requirements

**IMPORTANT**: Tests require all services running:
- ✅ Supabase (database + storage)
- ✅ API Server (port 6100)
- ✅ LangGraph Server (port 8200)

Tests follow **e2e-testing-skill** principles:
- ❌ NO MOCKING
- ✅ Real database
- ✅ Real API calls
- ✅ Real authentication
- ✅ Real storage operations

---

## Architecture Overview

### Request Flow

```
Frontend (Vue.js)
    ↓ (POST /api/v1/tasks with FormData)
API Server (NestJS)
    ↓ (Process files, extract text)
    ↓ (POST to LangGraph endpoint)
LangGraph Agent
    ↓ (Call API's /llm/generate for LLM)
API LLM Service
    ↓ (Call Anthropic/OpenAI)
LLM Provider
    ↓ (Response)
LangGraph Agent
    ↓ (Response)
API Server
    ↓ (Response)
Frontend
```

### ExecutionContext Flow

ExecutionContext is a capsule containing:
1. `orgSlug` - Organization identifier
2. `userId` - User identifier (from JWT, not request)
3. `conversationId` - Conversation identifier
4. `taskId` - Task identifier
5. `planId` - Plan identifier (optional)
6. `deliverableId` - Deliverable identifier (optional)
7. `agentSlug` - Agent identifier
8. `agentType` - Agent type
9. `provider` - LLM provider
10. `model` - LLM model

**Rules**:
- Frontend creates ExecutionContext
- Backend only mutates `taskId`, `deliverableId`, `planId`
- `userId` extracted from JWT (never from request body)
- Full context passed to all services (never cherry-picked)

### Storage Structure

Documents stored in Supabase Storage with this path pattern:
```
legal-documents/{orgSlug}/{conversationId}/{taskId}/{uuid}_{filename}
```

Example:
```
legal-documents/demo-org/conv-123/task-456/abc-def-789_contract.pdf
```

### Database Schema

**law.analysis_tasks** - Main execution records
- Links to API's tasks/conversations
- Stores legal-specific state
- Tracks CLO routing decisions
- Records HITL checkpoints

**law.document_extractions** - Extracted document content
- References original file in storage
- Stores extraction method (pdf_text, vision, ocr)
- Includes quality metrics

**law.specialist_outputs** - Specialist agent findings
- One record per specialist invocation
- Stores structured extraction
- Records risk flags and recommendations

**law.playbooks** - Firm-configurable rules
- Define acceptable terms
- Set flag thresholds
- Specify required/prohibited clauses

**law.execution_steps** - Step-by-step audit trail
- Supports reconnection capability
- Tracks dependencies
- Records input/output at each step

---

## Configuration

### Vision Model Setup

Legal Department AI supports multiple vision models for document extraction:

#### Option 1: OpenAI Vision (Default)
```bash
VISION_MODEL=gpt-4-vision-preview
VISION_PROVIDER=openai
OPENAI_API_KEY=your-key
```

#### Option 2: Ollama (Local)
```bash
VISION_MODEL=llava:latest
VISION_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
```

Start Ollama and pull vision model:
```bash
ollama pull llava
```

#### Option 3: Anthropic Claude
```bash
VISION_MODEL=claude-3-opus-20240229
VISION_PROVIDER=anthropic
ANTHROPIC_API_KEY=your-key
```

### OCR Fallback

If vision model fails, system falls back to OCR (Tesseract):
- Currently a placeholder in M0
- Will be implemented in future milestone
- Error thrown if vision fails for now

### Storage Limits

Configure in migration file or update directly:

```sql
-- Update file size limit (default 50MB)
UPDATE storage.buckets
SET file_size_limit = 104857600  -- 100MB
WHERE id = 'legal-documents';
```

### MIME Types

Allowed file types in legal-documents bucket:
- `application/pdf`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (DOCX)
- `application/msword` (DOC)
- `image/png`
- `image/jpeg`
- `image/jpg`
- `image/tiff`
- `text/plain`
- `text/markdown`

---

## Usage

### Access Legal Department AI

1. **Start all services** (see "Running the Application")

2. **Login to web app**:
   - Navigate to http://localhost:8100
   - Login with test credentials

3. **Navigate to Legal Department**:
   - Click menu → Agents → Legal Department AI
   - Or go directly to `/app/agents/legal-department`

### Upload Document

1. **Drag-drop or click to browse**
2. **Select file** (PDF, DOCX, or image)
3. **Configure analysis options**:
   - Extract key terms
   - Identify risks
   - Generate recommendations
4. **Click "Start Analysis"**

### View Results

Results displayed in three tabs:
- **Findings**: Legal terms and clauses identified
- **Risks**: Potential legal risks and liabilities
- **Recommendations**: Actionable suggestions

### Export Results

Click "Export Report" to download JSON with full analysis results.

---

## Troubleshooting

### Supabase won't start

**Issue**: Port conflicts

**Solution**:
```bash
# Stop Supabase
npx supabase stop

# Check for port conflicts
lsof -i :54322  # PostgreSQL
lsof -i :54323  # Studio
lsof -i :54321  # API

# Kill conflicting processes or change ports in config
```

### API server errors

**Issue**: Database connection failed

**Solution**:
```bash
# Verify Supabase is running
docker ps | grep supabase

# Check DATABASE_URL in .env matches Supabase
# Default: postgresql://postgres:postgres@localhost:54322/postgres
```

**Issue**: LangGraph not reachable

**Solution**:
```bash
# Verify LangGraph is running
curl http://localhost:8200/health

# Check LANGGRAPH_BASE_URL in API's .env
```

### LangGraph errors

**Issue**: API not reachable

**Solution**:
```bash
# Verify API is running
curl http://localhost:6100/health

# Check API_BASE_URL in LangGraph's .env
```

**Issue**: LLM calls failing

**Solution**:
- LangGraph should call API's /llm/generate endpoint
- Check API has valid LLM provider keys
- Verify no direct provider calls in LangGraph code

### Document upload fails

**Issue**: File size too large

**Solution**:
- Check bucket file_size_limit (default 50MB)
- Compress file or split into multiple uploads

**Issue**: MIME type not allowed

**Solution**:
- Check file extension matches allowed types
- Verify MIME type in bucket configuration

**Issue**: RLS policy blocks upload

**Solution**:
```bash
# Check user has access to organization
docker exec -it supabase_db_api-dev psql -U postgres -d postgres -c "SELECT * FROM public.rbac_user_org_roles WHERE user_id = 'your-user-id';"
```

### Vision extraction fails

**Issue**: Vision model not configured

**Solution**:
- Set VISION_MODEL and VISION_PROVIDER in API's .env
- Ensure corresponding API key is set
- If using Ollama, verify service is running

**Issue**: OCR fallback not working

**Solution**:
- OCR is a placeholder in M0
- Currently throws error
- Will be implemented in future milestone

### Tests failing

**Issue**: Services not running

**Solution**:
- Start Supabase, API, and LangGraph before running tests
- Tests require all services (NO MOCKING)

**Issue**: Database state conflicts

**Solution**:
```bash
# Reset database between test runs
npx supabase db reset
```

**Issue**: Port conflicts

**Solution**:
- Ensure no other services using ports 6100, 8200, 8100
- Check Supabase ports 54321-54323

---

## Development Tips

### Watch Mode

Run services in watch mode for auto-reload:

```bash
# API (NestJS)
cd apps/api
npm run start:dev  # Already in watch mode

# LangGraph (FastAPI with uvicorn)
cd apps/langgraph
npm run start:dev  # Configured with --reload

# Web (Vite)
cd apps/web
npm run dev  # HMR enabled
```

### Database Inspection

**Supabase Studio** (recommended):
- Open http://localhost:54323
- Navigate to Table Editor → law schema

**psql CLI**:
```bash
docker exec -it supabase_db_api-dev psql -U postgres -d postgres

# Useful queries
\dt law.*                          -- List all law tables
SELECT * FROM law.analysis_tasks;  -- View analysis tasks
SELECT * FROM law.document_extractions;  -- View extractions
```

### Log Monitoring

```bash
# API logs
cd apps/api
npm run start:dev
# Watch console output

# LangGraph logs
cd apps/langgraph
npm run start:dev
# Watch console output

# Database logs
docker logs -f supabase_db_api-dev
```

### Debugging

**API Debugging**:
- VS Code: Use "Debug API" launch configuration
- Or: `npm run start:debug` then attach debugger on port 9229

**LangGraph Debugging**:
- Add breakpoint() in Python code
- Or: Use VS Code Python debugger

**Frontend Debugging**:
- Browser DevTools
- Vue DevTools extension
- Network tab for API calls

---

## Next Steps

After completing M0 setup:

1. ✅ **Verify all acceptance criteria** - See [M0 Validation](./m0-validation.md)
2. ✅ **Run demo script** - Verify end-to-end flow
3. ✅ **Review test coverage** - All tests should pass
4. 🚀 **Ready for M1** - Begin feature development

### M1 Preview

Milestone 1 will add:
- CLO (Chief Legal Officer) routing agent
- Specialist agents (contract, compliance, IP, privacy)
- Synthesis agent for combining specialist outputs
- Risk assessment algorithms
- Playbook configuration
- Enhanced HITL workflows

M0 provides the solid foundation to build these features on.

---

## Support

For issues or questions:
1. Check this documentation
2. Review [M0 Validation](./m0-validation.md)
3. Check [Test Documentation](../../apps/api/testing/test/legal-department/README.md)
4. Review [M0 PRD](../prd/20260105-legal-department-ai-m0.md)

---

## References

- [M0 PRD](../prd/20260105-legal-department-ai-m0.md)
- [M0 Plan](../../plans/legal-department-ai-m0.plan.json)
- [M0 Validation](./m0-validation.md)
- [Test Documentation](../../apps/api/testing/test/legal-department/README.md)
- [ExecutionContext Skill](../../.claude/skills/execution-context-skill/SKILL.md)
- [Transport Types Skill](../../.claude/skills/transport-types-skill/SKILL.md)
- [E2E Testing Skill](../../.claude/skills/e2e-testing-skill/SKILL.md)
