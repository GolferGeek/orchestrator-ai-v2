# Engineering CAD Agent PRD - Review & Recommendations

**Review Date:** 2025-12-29  
**Reviewer:** AI Assistant  
**Status:** Comprehensive Review Complete

---

## Executive Summary

The PRD is **well-structured and follows the Marketing Swarm pattern effectively**. However, several critical areas need clarification and expansion to ensure successful implementation. The document is **~70% complete** - strong on architecture and schema, but needs more detail on security, error handling, API contracts, and operational concerns.

---

## Strengths ✅

1. **Clear Architecture Pattern** - Excellent alignment with Marketing Swarm
2. **Comprehensive Schema Design** - Well-thought-out table structure with proper relationships
3. **A2A Protocol Compliance** - Proper attention to standards
4. **Technology Decisions Documented** - OpenCASCADE.js choice is well-justified
5. **Separation of Concerns** - Backend execution vs frontend viewing is clear

---

## Critical Gaps & Recommendations 🔴

### 1. Security & Code Execution Safety

**Issue:** Executing user-generated code is a **major security risk**. The PRD doesn't address:
- Sandboxing strategy
- Resource limits (CPU, memory, execution time)
- Malicious code detection
- File system access restrictions

**Recommendation:** Add Section 10: Security & Sandboxing

```markdown
## 10. Security & Code Execution Safety

### 10.1 Sandboxing Strategy
- **Option A (Recommended):** Use Node.js `vm2` or `isolated-vm` for code execution
- **Option B:** Docker container per execution (more secure, slower)
- **Option C:** Deno with permissions (if switching runtime)

### 10.2 Resource Limits
- **Execution Timeout:** 60 seconds max per code execution
- **Memory Limit:** 512MB per execution
- **CPU Limit:** Single core, throttled
- **File System:** Read-only except for temp output directory

### 10.3 Code Validation
- **Pre-execution checks:**
  - No `require()` or `import()` of external modules (except OpenCASCADE.js)
  - No `process`, `fs`, `child_process`, `http` access
  - AST parsing to detect dangerous patterns
- **Whitelist approach:** Only allow OpenCASCADE.js API calls

### 10.4 Error Handling
- **Malicious code detection:** Pattern matching for dangerous operations
- **Graceful degradation:** If code fails validation, return error to user
- **Audit logging:** Log all code execution attempts (success/failure)
```

### 2. API Endpoint Specifications

**Issue:** Section 7 mentions A2A protocol but doesn't specify:
- Exact endpoint URLs
- Request/response schemas
- Error response formats
- Authentication requirements

**Recommendation:** Add Section 7.4: API Endpoints

```markdown
### 7.4 API Endpoints

#### POST `/api/agent2agent/tasks` (Create CAD Drawing)
**Request:**
```json
{
  "agentSlug": "cad-agent",
  "mode": "build",
  "content": "Design a rocket nozzle with 50mm throat diameter",
  "context": {
    "projectId": "uuid",
    "constraints": {
      "units": "mm",
      "min_wall_thickness": 3,
      "material": "6061-T6"
    }
  }
}
```

**Response:**
```json
{
  "taskId": "uuid",
  "streamId": "uuid",
  "status": "pending"
}
```

#### GET `/api/agent2agent/stream/{streamId}` (SSE Stream)
Returns Server-Sent Events with progress updates.

#### GET `/api/engineering/drawings/{drawingId}` (Get Drawing Details)
Returns drawing metadata, code, and output file URLs.

#### GET `/api/engineering/drawings/{drawingId}/download/{format}` (Download File)
Downloads STEP, STL, or GLTF file.
```

### 3. SSE Event Schema

**Issue:** Section 7.3 mentions SSE events but doesn't specify the exact event structure.

**Recommendation:** Add Section 7.5: SSE Event Schema

```markdown
### 7.5 SSE Event Schema

Based on existing `StreamingService` pattern, events follow this structure:

#### Progress Event (`agent.stream.chunk`)
```json
{
  "context": {
    "orgSlug": "engineering",
    "userId": "user-uuid",
    "conversationId": "conv-uuid",
    "taskId": "task-uuid",
    "agentSlug": "cad-agent"
  },
  "streamId": "task-uuid",
  "mode": "build",
  "userMessage": "Design a rocket nozzle...",
  "timestamp": "2025-12-29T10:30:00.000Z",
  "chunk": {
    "type": "progress",
    "content": "Generating CAD code...",
    "metadata": {
      "step": "llm_generation",
      "progress": 25,
      "status": "in_progress",
      "drawingId": "drawing-uuid",
      "sequence": 1,
      "totalSteps": 8
    }
  }
}
```

#### Step-Specific Events
- `llm_started` - LLM generation begins
- `llm_completed` - Code generated successfully
- `code_validation_started` - Validating code syntax
- `code_validation_completed` - Code validated
- `execution_started` - Running OpenCASCADE.js
- `execution_completed` - Geometry created
- `export_started` - Exporting to STEP/STL/GLTF
- `export_completed` - Files saved to storage
- `error` - Error occurred at any step
```

### 4. Error Handling & Retry Strategy

**Issue:** No specification for:
- What happens when LLM generates invalid code?
- What happens when code execution fails?
- Retry logic for transient failures
- User feedback on errors

**Recommendation:** Add Section 11: Error Handling

```markdown
## 11. Error Handling & Recovery

### 11.1 Error Categories

| Error Type | Example | Recovery Strategy |
|------------|---------|-------------------|
| **LLM Generation Failure** | Model timeout, invalid response | Retry with same prompt (max 2 retries) |
| **Code Validation Failure** | Syntax errors, dangerous operations | Return error to user, suggest prompt refinement |
| **Execution Failure** | Runtime error, memory limit | Log error, return partial results if available |
| **Export Failure** | File format error, storage quota | Retry export (max 3 retries), fallback to GLTF only |

### 11.2 User Feedback
- **Validation errors:** Show specific error message + suggested fixes
- **Execution errors:** Show error message + code snippet that failed
- **Timeout errors:** Suggest simplifying the design or breaking into parts

### 11.3 Retry Logic
- **LLM failures:** Exponential backoff (1s, 2s, 4s)
- **Export failures:** Immediate retry (3 attempts)
- **No retry:** Code validation failures (user must fix prompt)
```

### 5. Storage & File Management

**Issue:** Mentions Supabase Storage but doesn't specify:
- Bucket structure
- File naming conventions
- Cleanup policies
- File size limits

**Recommendation:** Add Section 12: Storage Strategy

```markdown
## 12. Storage & File Management

### 12.1 Supabase Storage Structure
```
engineering/
├── projects/{projectId}/
│   └── drawings/{drawingId}/
│       ├── model.step
│       ├── model.stl
│       ├── model.gltf
│       └── thumbnail.png
```

### 12.2 File Naming Convention
- **Format:** `{drawingId}-v{version}.{ext}`
- **Example:** `abc123-v1.step`, `abc123-v1.gltf`

### 12.3 File Size Limits
- **STEP files:** Max 50MB
- **STL files:** Max 100MB (larger due to mesh format)
- **GLTF files:** Max 10MB (for web viewing)
- **Thumbnails:** Max 500KB (PNG, 512x512)

### 12.4 Cleanup Policy
- **Active drawings:** Keep all versions
- **Archived projects:** Keep latest version only, delete older versions after 90 days
- **Failed drawings:** Delete after 7 days
```

### 6. Performance & Scalability

**Issue:** No performance targets or scalability considerations.

**Recommendation:** Add Section 13: Performance Requirements

```markdown
## 13. Performance Requirements

### 13.1 Execution Time Targets
- **LLM generation:** < 30 seconds (qwen2.5-coder)
- **Code execution:** < 60 seconds (OpenCASCADE.js)
- **File export:** < 10 seconds per format
- **Total end-to-end:** < 2 minutes for simple designs

### 13.2 Scalability Considerations
- **Concurrent executions:** Support 10 simultaneous CAD generations
- **Queue management:** Use task queue (Bull/BullMQ) for high load
- **Resource pooling:** Reuse OpenCASCADE.js WASM instances where possible

### 13.3 Caching Strategy
- **Generated code:** Cache for 24 hours (same prompt + constraints = same code)
- **Geometry files:** Cache indefinitely (immutable)
- **Thumbnails:** Generate on-demand, cache for 7 days
```

### 7. Testing Strategy

**Issue:** No testing approach specified.

**Recommendation:** Add Section 14: Testing Strategy

```markdown
## 14. Testing Strategy

### 14.1 Unit Tests
- **Code validation logic:** Test AST parsing, whitelist checking
- **Constraint injection:** Test prompt building with various constraints
- **File export:** Test STEP/STL/GLTF generation

### 14.2 Integration Tests
- **End-to-end workflow:** Prompt → Code → Execute → Export
- **Error scenarios:** Invalid code, execution failures, storage errors
- **SSE streaming:** Verify events are emitted correctly

### 14.3 Test CAD Models
Create a library of test prompts:
- **Simple:** "Create a cube with 10mm sides"
- **Medium:** "Design a bracket with 3 mounting holes"
- **Complex:** "Generate a rocket nozzle with 50mm throat, 15° expansion angle"

### 14.4 Performance Tests
- **Load testing:** 10 concurrent CAD generations
- **Memory profiling:** Ensure no memory leaks in OpenCASCADE.js
- **Timeout testing:** Verify timeouts work correctly
```

### 8. Constraints Injection Format

**Issue:** Section 5.2 lists constraints but doesn't specify how they're injected into prompts.

**Recommendation:** Expand Section 6.2: System Prompt Strategy

```markdown
### 6.2 System Prompt Strategy

#### Base System Prompt Template
```
You are a CAD code generation assistant. Generate OpenCASCADE.js code to create 3D geometry.

CONSTRAINTS:
- Units: {units}
- Material: {material}
- Minimum wall thickness: {min_wall_thickness}mm
- Manufacturing method: {manufacturing_method}
- Tolerance class: {tolerance_class}

REQUIREMENTS:
1. Use only OpenCASCADE.js API (no external imports)
2. Export geometry as STEP, STL, and GLTF formats
3. Ensure all dimensions match user specifications exactly
4. Apply appropriate fillets/chamfers based on manufacturing method

USER REQUEST: {user_prompt}
```

#### Constraint Injection Logic
```typescript
function buildPrompt(userPrompt: string, constraints: ProjectConstraints): string {
  const constraintText = `
CONSTRAINTS:
- Units: ${constraints.units}
- Material: ${constraints.material}
- Minimum wall thickness: ${constraints.minWallThickness}mm
- Manufacturing method: ${constraints.manufacturingMethod}
- Tolerance class: ${constraints.toleranceClass}
  `;
  
  return SYSTEM_PROMPT_TEMPLATE
    .replace('{units}', constraints.units)
    .replace('{material}', constraints.material)
    // ... etc
    .replace('{user_prompt}', userPrompt);
}
```
```

### 9. Version Comparison Feature

**Issue:** Section 5.3 mentions "Version history: Compare iterations" but doesn't specify how.

**Recommendation:** Add Section 5.4: Version Comparison

```markdown
### 5.4 Version Comparison

**UI Requirements:**
- **Side-by-side viewer:** Show two GLTF models side-by-side
- **Diff visualization:** Highlight geometry differences (added/removed faces)
- **Metadata comparison:** Show changed dimensions, constraints
- **Code diff:** Show generated code differences (syntax-highlighted)

**Implementation:**
- Use Three.js to load both GLTF models
- Calculate geometric differences using OpenCASCADE.js comparison tools
- Display diff as colored overlay (green = added, red = removed)
```

### 10. Missing Indexes & Performance Optimization

**Issue:** Schema doesn't specify database indexes.

**Recommendation:** Add to Section 4.1: Database Indexes

```sql
-- Performance indexes
CREATE INDEX idx_drawings_project_id ON engineering.drawings(project_id);
CREATE INDEX idx_drawings_status ON engineering.drawings(status);
CREATE INDEX idx_drawings_conversation_id ON engineering.drawings(conversation_id);
CREATE INDEX idx_generated_code_drawing_id ON engineering.generated_code(drawing_id);
CREATE INDEX idx_cad_outputs_drawing_id ON engineering.cad_outputs(drawing_id);
CREATE INDEX idx_execution_log_drawing_id ON engineering.execution_log(drawing_id);
CREATE INDEX idx_execution_log_step_type ON engineering.execution_log(step_type);
```

---

## Consistency Issues ⚠️

### 1. Section Numbering Duplication
- **Issue:** Section 7 has multiple "7.2" and "7.3" subsections
- **Fix:** Renumber sections 7.2-7.5 sequentially

### 2. Missing RLS Policies
- **Issue:** Schema doesn't include Row Level Security policies
- **Recommendation:** Add RLS policies matching Marketing Swarm pattern:
```sql
-- Enable RLS on all tables
ALTER TABLE engineering.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE engineering.drawings ENABLE ROW LEVEL SECURITY;
-- ... etc

-- Policy: Users can only access their org's projects
CREATE POLICY "Users can view projects in their org"
  ON engineering.projects FOR SELECT
  USING (
    org_id IN (
      SELECT organization_id FROM public.user_organizations 
      WHERE user_id = auth.uid()
    )
  );
```

### 3. Deliverable Content Type
- **Issue:** Section 7.3 mentions `content_type = 'cad-model'` but this needs to be registered
- **Recommendation:** Add to Phase 1:
```sql
INSERT INTO public.content_types (name, display_name, description)
VALUES ('cad-model', 'CAD Model', '3D CAD geometry files');
```

---

## Nice-to-Have Enhancements 💡

1. **Assembly Support** (Future Phase)
   - Add `engineering.assemblies` table
   - Support multi-part assemblies with constraints

2. **Part Library Integration**
   - Allow users to save successful designs as reusable parts
   - Template system for common components

3. **Collaborative Editing**
   - Multiple users working on same project
   - Real-time updates via WebSockets

4. **CAD Format Conversion**
   - Support importing existing STEP files
   - Convert between formats (STEP → STL → OBJ)

5. **AI-Powered Suggestions**
   - Suggest improvements based on manufacturing constraints
   - Detect potential design flaws

---

## Implementation Priority

### Phase 1 (Critical - Must Have)
1. ✅ Schema with RLS policies
2. ✅ Security & sandboxing
3. ✅ Basic API endpoints
4. ✅ Error handling
5. ✅ Storage structure

### Phase 2 (Important - Should Have)
1. SSE event schema
2. Performance optimization
3. Testing strategy
4. Constraints injection
5. File management

### Phase 3 (Nice - Could Have)
1. Version comparison
2. Part library
3. Assembly support
4. Advanced features

---

## Conclusion

The PRD provides a **solid foundation** but needs **critical security and operational details** before implementation can begin safely. The recommended additions will:

1. **Ensure security** - Protect against malicious code execution
2. **Clarify contracts** - Define exact API and event schemas
3. **Enable testing** - Provide clear test strategy
4. **Improve UX** - Better error handling and feedback

**Recommendation:** Address all Critical Gaps (Sections 10-14) before starting Phase 1 implementation.

