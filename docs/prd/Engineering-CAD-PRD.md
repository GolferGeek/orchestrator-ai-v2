# Engineering CAD Agent - Product Requirements Document

**Status:** DRAFT - Discussion Phase
**Organization:** Engineering
**Agent Name:** CAD Agent
**Created:** 2025-12-29

---

## 1. Overview

The CAD Agent generates **parametric 3D CAD models** from natural language descriptions. It uses an LLM to generate code (not meshes), which is then executed to produce precise, dimensionally accurate geometry suitable for engineering applications (aerospace, mechanical, etc.).

### 1.1 Core Concept: Code-as-CAD

Instead of generating "blobby" 3D meshes (like game asset generators), this agent generates **executable code** that builds parametric geometry. This ensures:
- **Precision**: Exact dimensions, not visual approximations
- **Editability**: Users can say "make the nozzle throat 12mm instead of 10mm"
- **Engineering formats**: Output STEP, DXF, STL files

### 1.2 Technology Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| **LLM** | `qwen2.5-coder` via Ollama | Best local coding model for CAD scripts |
| **CAD Engine** | [OpenCASCADE.js](https://ocjs.org/) | TypeScript/WASM port of OpenCascade CAD kernel |

**Decision:** OpenCASCADE.js in Node.js (LangGraph). All AI and CAD execution happens server-side. Frontend only displays pre-computed geometry.

---

## 2. Architecture Pattern (Based on Marketing Swarm)

### 2.1 Key Components Required

| Component | Location | Purpose |
|-----------|----------|---------|
| Schema Migration | `supabase/migrations/` | Create `engineering` schema with tables |
| Agent Registration | `supabase/seeds/` | Register agent with `hasCustomUI: true` metadata |
| Custom UI Component | `apps/web/src/views/agents/cad-agent/` | Agent-specific interface |
| Custom UI Tab | `apps/web/src/components/custom-ui/CadAgentTab.vue` | Embedded tab view |
| ConversationView Update | `apps/web/src/components/ConversationView.vue` | Route to custom component |
| LangGraph Workflow | `apps/langgraph/src/agents/engineering/cad-agent/` | Agent execution logic |
| API Endpoints | `apps/api/src/` | CAD Agent specific endpoints |

### 2.2 LangGraph Directory Structure (NEW PATTERN)

Organizing by organization first:
```
apps/langgraph/src/agents/
├── data-analyst/           # Existing
├── extended-post-writer/   # Existing
├── marketing-swarm/        # Existing
└── engineering/            # NEW: Organization folder
    └── cad-agent/          # Agent within org
```

### 2.3 Agent Metadata Pattern

```sql
metadata: {
  "hasCustomUI": true,
  "customUIComponent": "cad-agent"
}
```

---

## 3. User & Organization Setup

### 3.1 New User
- **Email:** josh@orchestratorai.io
- **Role:** Super User (RBAC)
- **Organization:** Engineering

### 3.2 New Organization
- **Name:** Engineering
- **Slug:** `engineering`
- **First Agent:** CAD Agent

---

## 4. Proposed Schema: `engineering`

### 4.1 Table Design

```sql
CREATE SCHEMA IF NOT EXISTS engineering;

-- 1. PROJECTS: Container for related CAD work
CREATE TABLE engineering.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  conversation_id UUID REFERENCES public.conversations(id),
  name TEXT NOT NULL,
  description TEXT,

  -- Project-level config (like Marketing Swarm's interview answers)
  config_json JSONB DEFAULT '{}'::jsonb,
  -- e.g., { "units": "mm", "material": "aluminum", "min_wall_thickness": "3mm" }

  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- 2. DRAWINGS: Individual CAD instances within a project
CREATE TABLE engineering.drawings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES engineering.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,

  -- The prompt that generated this drawing
  prompt TEXT NOT NULL,

  -- Engineering constraints injected into LLM prompt
  constraints_json JSONB DEFAULT '{}'::jsonb,
  -- e.g., { "wall_thickness_min": "3mm", "material": "6061-T6" }

  -- Version tracking
  version INTEGER DEFAULT 1,
  parent_drawing_id UUID REFERENCES engineering.drawings(id),

  -- Link to execution context (from LangGraph ExecutionContext)
  task_id UUID REFERENCES public.tasks(id),
  conversation_id UUID REFERENCES public.conversations(id),

  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'generating', 'validating', 'completed', 'failed', 'superseded'
  )),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. GENERATED_CODE: The LLM-generated CAD scripts
CREATE TABLE engineering.generated_code (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drawing_id UUID NOT NULL REFERENCES engineering.drawings(id) ON DELETE CASCADE,

  -- Which syntax/library was used
  code_type TEXT NOT NULL DEFAULT 'opencascade-js' CHECK (code_type IN ('opencascade-js')),

  -- The actual generated code
  code_content TEXT NOT NULL,

  -- LLM that generated it
  model_provider TEXT NOT NULL,  -- 'ollama'
  model_name TEXT NOT NULL,      -- 'qwen2.5-coder'

  -- Execution results
  execution_status TEXT DEFAULT 'pending' CHECK (execution_status IN (
    'pending', 'running', 'success', 'error'
  )),
  execution_error TEXT,
  execution_time_ms INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CAD_OUTPUTS: The actual geometry files produced
CREATE TABLE engineering.cad_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_code_id UUID NOT NULL REFERENCES engineering.generated_code(id) ON DELETE CASCADE,
  drawing_id UUID NOT NULL REFERENCES engineering.drawings(id) ON DELETE CASCADE,

  -- Output format
  format TEXT NOT NULL CHECK (format IN ('step', 'stl', 'dxf', 'obj', 'gltf', '3mf')),

  -- File storage (could be Supabase Storage path or base64 for small files)
  file_path TEXT,
  file_size_bytes INTEGER,

  -- Geometry metadata
  geometry_stats JSONB DEFAULT '{}'::jsonb,
  -- e.g., { "vertices": 1234, "faces": 567, "bounding_box": {...} }

  -- Thumbnail for UI preview
  thumbnail_path TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. EXECUTION_LOG: Audit trail (like Marketing Swarm's execution_queue)
CREATE TABLE engineering.execution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drawing_id UUID NOT NULL REFERENCES engineering.drawings(id) ON DELETE CASCADE,

  step_type TEXT NOT NULL CHECK (step_type IN (
    'prompt_received', 'constraints_applied', 'llm_started', 'llm_completed',
    'code_validation', 'execution_started', 'execution_completed',
    'export_started', 'export_completed', 'error'
  )),

  step_data JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. PART_LIBRARY: Reusable components (optional, for future)
CREATE TABLE engineering.part_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),

  name TEXT NOT NULL,
  description TEXT,
  category TEXT,  -- 'fasteners', 'bearings', 'airfoils', etc.

  -- The template code for this part
  code_template TEXT NOT NULL,
  code_type TEXT NOT NULL,

  -- Configurable parameters
  parameters_schema JSONB NOT NULL,
  -- e.g., { "bore_diameter": { "type": "number", "unit": "mm", "default": 50 } }

  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);
```

### 4.2 Table Summary

| Table | Purpose | Similar to Marketing |
|-------|---------|---------------------|
| `projects` | Container for related CAD work | `swarm_tasks` |
| `drawings` | Individual CAD instances with versioning | `outputs` |
| `generated_code` | LLM-generated scripts | N/A (new pattern) |
| `cad_outputs` | Exported geometry files (STEP, STL) | `outputs.content` |
| `execution_log` | Step-by-step audit trail | `execution_queue` |
| `part_library` | Reusable component templates | `content_types` |

---

## 5. Custom UI Requirements

### 5.1 Three-Tab Pattern (Like Marketing Swarm)

| Tab | Purpose | Components |
|-----|---------|------------|
| **Config** | Project setup & constraints | Units, material, tolerances, etc. |
| **Progress** | Real-time generation status | SSE stream showing LLM → Code → Execute → Export |
| **Deliverables** | 3D viewer + file downloads | Three.js/BabylonJS viewer, STEP/STL downloads |

### 5.2 Config Screen Questions

Engineering constraints to inject into prompts:
1. **Units** - mm, inches, etc.
2. **Material** - Aluminum 6061, Steel, Titanium (affects min wall thickness)
3. **Manufacturing method** - 3D print, CNC, casting (affects geometry rules)
4. **Tolerance class** - Loose, standard, precision
5. **Default wall thickness** - Minimum allowed

### 5.3 Deliverables Pane

- **3D Viewer**: Interactive WebGL viewer (Three.js or BabylonJS loading GLTF)
- **Download buttons**: STEP, STL, DXF formats
- **Code view**: Show the generated script (editable for power users?)
- **Version history**: Compare iterations

---

## 6. LLM Configuration

### 6.1 Default Model

Need to add `qwen2.5-coder` to the models table:

```sql
INSERT INTO public.llm_models (
  model_name, provider_name, display_name, model_type, model_version,
  context_window, max_output_tokens, model_tier, speed_tier, capabilities
) VALUES (
  'qwen2.5-coder:7b', 'ollama', 'Qwen 2.5 Coder 7B', 'code-generation', '2.5',
  32768, 8192, 'local', 'fast',
  '["code-generation", "chat", "cad-scripting"]'::jsonb
);
```

### 6.2 System Prompt Strategy

Include CAD library documentation in system prompt so model doesn't hallucinate syntax:
- OpenCASCADE.js API reference
- Common patterns for extrusions, booleans, fillets
- Export format requirements

---

## 7. Architecture: A2A Protocol Compliance

### 7.1 Agent Registration

The CAD Agent is a proper agent in the `public.agents` table:

```sql
INSERT INTO public.agents (
  name, slug, description, agent_type, org_id,
  metadata, is_active
) VALUES (
  'CAD Agent',
  'cad-agent',
  'Generate parametric 3D CAD models from natural language',
  'langgraph',
  (SELECT id FROM public.organizations WHERE slug = 'engineering'),
  '{
    "hasCustomUI": true,
    "customUIComponent": "cad-agent",
    "capabilities": ["cad-generation", "step-export", "stl-export"]
  }'::jsonb,
  true
);
```

### 7.2 A2A Request/Response Flow

All requests follow the A2A JSON-RPC protocol:

```typescript
// REQUEST (standard A2A format)
{
  "jsonrpc": "2.0",
  "method": "agent/execute",
  "params": {
    "agentSlug": "cad-agent",
    "prompt": "Design a rocket nozzle with 50mm throat diameter",
    "context": {
      "projectId": "uuid",
      "constraints": { "units": "mm", "min_wall_thickness": 3 }
    }
  },
  "id": "request-123"
}

// RESPONSE (standard A2A format with deliverable + CAD metadata)
{
  "jsonrpc": "2.0",
  "result": {
    "content": "Generated rocket nozzle with 50mm throat diameter...",
    "deliverable": {
      "id": "deliverable-uuid",
      "version": 1,
      "type": "cad-model"
    },
    "metadata": {
      "drawingId": "uuid",
      "outputs": {
        "gltf": "https://storage.../drawings/uuid/model.gltf",
        "step": "https://storage.../drawings/uuid/model.step",
        "stl": "https://storage.../drawings/uuid/model.stl"
      },
      "geometryStats": {
        "vertices": 1234,
        "faces": 567,
        "boundingBox": { "x": 100, "y": 100, "z": 150 }
      },
      "generatedCode": "// OpenCASCADE.js code..."
    }
  },
  "id": "request-123"
}
```

### 7.3 Deliverables & Versioning

**Separation of concerns:**
- **`engineering.*` tables** = Mutable working state (where edits happen)
- **`public.deliverables`** = Immutable snapshots (what the user sees, with versions)

**Workflow:**
1. User requests a CAD model → create `engineering.drawing` + `generated_code`
2. Execute code → store files in `cad_outputs`
3. Create deliverable with `content_type = 'cad-model'` and metadata (file paths, geometry stats)
4. User requests revision → update engineering tables → re-execute → **new deliverable version**

No versioning inside engineering tables - the deliverables system handles that.

The custom UI component reads `metadata.outputs.gltf` and loads it in Three.js.

### 7.3 Design Principle

**All AI and CAD execution happens on the backend.** The frontend is just a viewer.

This ensures:
- Consistent environment (no "works on my machine" issues)
- Reusable API (Vue, Mac app, mobile - any client can call the same backend)
- Matches existing pattern (all AI in LangGraph/API, not frontend)
- **A2A protocol compliance** - standard request/response format

### 7.2 Execution Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   BACKEND (LangGraph Node.js)                │
│                                                              │
│  [1] Receive prompt from API                                 │
│                    ↓                                         │
│  [2] Apply project constraints from config_json              │
│      → "Ensure wall thickness >= 3mm, material: Inconel"     │
│                    ↓                                         │
│  [3] Send to Ollama (qwen2.5-coder)                          │
│      → Returns OpenCASCADE.js code block                     │
│                    ↓                                         │
│  [4] Validate code (TypeScript syntax check)                 │
│                    ↓                                         │
│  [5] Execute code (OpenCASCADE.js WASM in Node.js)           │
│                    ↓                                         │
│  [6] Export geometry files (STEP, STL, GLTF)                 │
│                    ↓                                         │
│  [7] Store files in Supabase Storage                         │
│                    ↓                                         │
│  [8] Send SSE events for progress + completion               │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│              FRONTEND (Vue / Mac App / Any Client)           │
│                                                              │
│  - Calls API to start generation                             │
│  - Listens to SSE for progress updates                       │
│  - Loads GLTF URL in Three.js viewer (display only)          │
│  - Provides download buttons for STEP/STL files              │
│                                                              │
│  ** No AI, no CAD logic, no code execution **                │
└─────────────────────────────────────────────────────────────┘
```

### 7.3 Example Workflow

```
User Prompt: "Design a rocket nozzle with 50mm throat diameter"

Backend:
  [1] prompt_received      → Log to execution_log
  [2] constraints_applied  → Inject "wall_thickness >= 3mm"
  [3] llm_started          → SSE event to frontend
  [4] llm_completed        → Store code in generated_code table
  [5] code_validation      → TypeScript parse check
  [6] execution_started    → SSE event
  [7] execution_completed  → Geometry created
  [8] export_completed     → STEP, STL, GLTF saved to storage

Frontend:
  - Receives SSE: "llm_started" → show spinner
  - Receives SSE: "execution_completed" → load GLTF in viewer
  - User clicks "Download STEP" → fetches file from storage
```

---

## 8. Resolved & Open Questions

### 8.1 Resolved

| Question | Decision |
|----------|----------|
| CAD Engine? | **OpenCASCADE.js** - Most powerful, TypeScript native |
| Where does code execute? | **LangGraph Node.js** - All AI/CAD server-side |
| LangGraph directory structure? | **By organization** - `agents/engineering/cad-agent/` |

### 8.2 Still Open

1. **Assembly support?**
   - Can the agent combine multiple drawings into an assembly?
   - How do parts reference each other?

2. **3D Viewer library?**
   - Three.js vs BabylonJS for GLTF display?

---

## 9. Storage Strategy

### 9.1 Supabase Storage Bucket

Create a new bucket for CAD files:

```sql
-- Create the engineering bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('engineering', 'engineering', true);
```

### 9.2 File Structure

```
engineering/
├── projects/{projectId}/
│   └── drawings/{drawingId}/
│       ├── model.step      -- Engineering format
│       ├── model.stl       -- Mesh format
│       ├── model.gltf      -- Web viewer format
│       └── thumbnail.png   -- UI preview
```

### 9.3 File Path Convention

Store paths in `engineering.cad_outputs.file_path`:
- `engineering/projects/{projectId}/drawings/{drawingId}/model.{format}`

The deliverable metadata will contain the full URLs for the frontend to fetch.

---

## 10. Implementation Phases

### Phase 1: Foundation
- [ ] Create `engineering` schema with tables
- [ ] Create `engineering` storage bucket
- [ ] Register CAD Agent with custom UI metadata
- [ ] Create user josh@orchestratorai.io with Engineering org
- [ ] Add `qwen2.5-coder` to models table
- [ ] Basic LangGraph workflow structure

### Phase 2: Core Agent
- [ ] Prompt → Code generation pipeline
- [ ] OpenCASCADE.js/JSCAD execution
- [ ] STEP/STL export
- [ ] Basic UI (config + deliverables)

### Phase 3: Polish
- [ ] Real-time progress streaming
- [ ] 3D viewer integration
- [ ] Version comparison
- [ ] Part library

---

## Appendix A: Reference Files

Key files to reference from Marketing Swarm pattern:

- [Marketing Schema Migration](../../apps/api/supabase/migrations/20251211000001_create_marketing_swarm_schema.sql)
- [Marketing Swarm Agent Seed](../../apps/api/supabase/archive/seeds/07_marketing_swarm_agent.sql)
- [ConversationView.vue](../../apps/web/src/components/ConversationView.vue) - Lines 432-444 for custom UI routing
- [MarketingSwarmTab.vue](../../apps/web/src/components/custom-ui/MarketingSwarmTab.vue)
- [AgentsStore.ts](../../apps/web/src/stores/agentsStore.ts) - Lines 136-147 for metadata normalization
- [Ollama Models Migration](../../apps/api/supabase/migrations/20251205000001_add_ollama_cloud_models.sql)

## Appendix B: External Resources

- [OpenCASCADE.js](https://ocjs.org/) - TypeScript/WASM CAD kernel
- [OpenCASCADE.js GitHub](https://github.com/donalffons/opencascade.js/)
- [Qwen2.5-Coder](https://ollama.com/library/qwen2.5-coder) - Recommended LLM
