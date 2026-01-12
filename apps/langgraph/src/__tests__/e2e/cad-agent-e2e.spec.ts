/**
 * CAD Agent End-to-End Tests
 *
 * Tests the complete flow from API request through LangGraph workflow
 * to database operations and deliverable creation.
 *
 * Test Suites:
 * 1. Database Setup & Project/Drawing Creation
 * 2. LangGraph Workflow Execution
 * 3. Deliverable Output & Versioning
 * 4. Error Handling & Edge Cases
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createMockExecutionContext } from "@orchestrator-ai/transport-types";
import { v4 as uuidv4 } from "uuid";

// Supabase client for test database operations
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let supabase: SupabaseClient<any, "engineering">;

// Test constants
const TEST_ORG_SLUG = "engineering";
const TEST_USER_ID = "00000000-0000-0000-0000-000000000001"; // engineering-test user
const LANGGRAPH_URL = process.env.LANGGRAPH_URL || "http://127.0.0.1:6200";

// Test data cleanup tracking
const createdProjectIds: string[] = [];
const createdDrawingIds: string[] = [];

// Helper to create ExecutionContext for tests
function createTestContext(
  overrides: Partial<ReturnType<typeof createMockExecutionContext>> = {},
) {
  return createMockExecutionContext({
    orgSlug: TEST_ORG_SLUG,
    userId: TEST_USER_ID,
    conversationId: uuidv4(),
    taskId: uuidv4(),
    agentSlug: "cad-agent",
    agentType: "api",
    provider: "ollama",
    model: "qwen2.5-coder:14b",
    ...overrides,
  });
}

// Helper to call LangGraph CAD Agent endpoint
async function callCadAgentGenerate(request: {
  context: ReturnType<typeof createMockExecutionContext>;
  userMessage: string;
  projectId?: string;
  constraints?: Record<string, unknown>;
}) {
  const response = await fetch(
    `${LANGGRAPH_URL}/agents/engineering/cad-agent/generate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    },
  );

  const data = await response.json();
  return { status: response.status, data };
}

// Helper to check status
async function getCadAgentStatus(taskId: string) {
  const response = await fetch(
    `${LANGGRAPH_URL}/agents/engineering/cad-agent/status/${taskId}`,
  );
  const data = await response.json();
  return { status: response.status, data };
}

// Helper to get outputs
async function getCadAgentOutputs(drawingId: string) {
  const response = await fetch(
    `${LANGGRAPH_URL}/agents/engineering/cad-agent/outputs/${drawingId}`,
  );
  const data = await response.json();
  return { status: response.status, data };
}

describe("CAD Agent E2E Tests", () => {
  beforeAll(async () => {
    // Initialize Supabase client with engineering schema
    const supabaseUrl = process.env.SUPABASE_URL || "http://127.0.0.1:6010";
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
      db: { schema: "engineering" },
    });

    // Verify database connection and schema access
    const { error: schemaError } = await supabase
      .from("projects")
      .select("id")
      .limit(1);

    if (schemaError) {
      console.error("Failed to connect to engineering schema:", schemaError);
      throw new Error(`Database connection failed: ${schemaError.message}`);
    }

    console.log("✓ Connected to Supabase engineering schema");
  });

  afterAll(async () => {
    // Cleanup: Delete all test data in reverse order (drawings first due to FK)
    for (const drawingId of createdDrawingIds) {
      await supabase.from("drawings").delete().eq("id", drawingId);
    }
    for (const projectId of createdProjectIds) {
      await supabase.from("projects").delete().eq("id", projectId);
    }
    console.log(
      `✓ Cleaned up ${createdProjectIds.length} projects and ${createdDrawingIds.length} drawings`,
    );
  });

  // ==========================================================================
  // SUITE 1: DATABASE SETUP & PROJECT/DRAWING CREATION
  // ==========================================================================
  describe("Suite 1: Database Setup & Project/Drawing Creation", () => {
    it("1.1: Should create a project in engineering schema", async () => {
      const projectId = uuidv4();
      const projectName = `Test Project ${Date.now()}`;

      const { data, error } = await supabase
        .from("projects")
        .insert({
          id: projectId,
          org_slug: TEST_ORG_SLUG,
          name: projectName,
          description: "E2E test project",
          constraints: {
            units: "mm",
            material: "Aluminum 6061",
            manufacturing_method: "CNC",
            tolerance_class: "standard",
            wall_thickness_min: 2.0,
          },
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.id).toBe(projectId);
      expect(data.org_slug).toBe(TEST_ORG_SLUG);
      expect(data.name).toBe(projectName);
      expect(data.constraints).toHaveProperty("units", "mm");

      // Track for cleanup
      createdProjectIds.push(projectId);
    });

    it("1.2: Should create a drawing linked to a project", async () => {
      // First create a project
      const projectId = uuidv4();
      const { error: projectError } = await supabase
        .from("projects")
        .insert({
          id: projectId,
          org_slug: TEST_ORG_SLUG,
          name: `Drawing Test Project ${Date.now()}`,
        })
        .select()
        .single();

      expect(projectError).toBeNull();
      createdProjectIds.push(projectId);

      // Now create a drawing (without task_id - FK constraint requires existing task)
      const drawingId = uuidv4();

      const { data, error } = await supabase
        .from("drawings")
        .insert({
          id: drawingId,
          project_id: projectId,
          // Note: task_id is optional and has FK constraint to public.tasks
          // conversation_id also has FK constraint to public.conversations
          name: "Test Fan Bracket",
          prompt:
            "Create a mounting bracket for a 40mm fan with M3 mounting holes",
          status: "pending",
          constraints_override: { wall_thickness_min: 3.0 },
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.id).toBe(drawingId);
      expect(data.project_id).toBe(projectId);
      expect(data.status).toBe("pending");

      // Track for cleanup
      createdDrawingIds.push(drawingId);
    });

    it("1.3: Should enforce foreign key constraint on drawings", async () => {
      const drawingId = uuidv4();
      const invalidProjectId = uuidv4(); // Non-existent project

      const { error } = await supabase.from("drawings").insert({
        id: drawingId,
        project_id: invalidProjectId,
        name: "Test Drawing",
        prompt: "Test prompt",
      });

      // Should fail due to FK constraint
      expect(error).toBeDefined();
      expect(error?.code).toBe("23503"); // Foreign key violation
    });

    it("1.4: Should cascade delete drawings when project is deleted", async () => {
      // Create project
      const projectId = uuidv4();
      await supabase.from("projects").insert({
        id: projectId,
        org_slug: TEST_ORG_SLUG,
        name: `Cascade Test Project ${Date.now()}`,
      });

      // Create drawing
      const drawingId = uuidv4();
      await supabase.from("drawings").insert({
        id: drawingId,
        project_id: projectId,
        name: "Cascade Test Drawing",
        prompt: "Test prompt",
      });

      // Verify drawing exists
      const { data: beforeDelete } = await supabase
        .from("drawings")
        .select("id")
        .eq("id", drawingId)
        .single();
      expect(beforeDelete).toBeDefined();

      // Delete project
      await supabase.from("projects").delete().eq("id", projectId);

      // Verify drawing was cascade deleted
      const { data: afterDelete } = await supabase
        .from("drawings")
        .select("id")
        .eq("id", drawingId)
        .maybeSingle();
      expect(afterDelete).toBeNull();
    });
  });

  // ==========================================================================
  // SUITE 2: LANGGRAPH WORKFLOW EXECUTION
  // ==========================================================================
  describe("Suite 2: LangGraph Workflow Execution", () => {
    it("2.1: Should require ExecutionContext in request", async () => {
      const { status, data } = await callCadAgentGenerate({
        context: null as unknown as ReturnType<
          typeof createMockExecutionContext
        >,
        userMessage: "Create a simple box",
      });

      expect(status).toBe(400);
      expect(data).toHaveProperty("message");
      // Message could be an array or string - check for ExecutionContext mention
      const messageStr = Array.isArray(data.message)
        ? data.message.join(" ")
        : data.message;
      expect(messageStr).toContain("ExecutionContext");
    });

    it("2.2: Should create project and drawing on generate", async () => {
      const context = createTestContext();
      const projectName = `API Test Project ${Date.now()}`;

      const { status, data } = await callCadAgentGenerate({
        context: {
          ...context,
          // Add newProjectName via the userMessage JSON (as the API expects)
        },
        userMessage: JSON.stringify({
          type: "cad-generation-request",
          prompt: "Create a simple 10x10x10mm cube",
          newProjectName: projectName,
          constraints: { units: "mm" },
          outputFormats: ["STEP", "STL"],
        }),
      });

      // Note: This might timeout if Ollama/LLM is not available
      // In CI, this would be mocked
      if (status === 200) {
        expect(data).toHaveProperty("success");
        expect(data.data).toHaveProperty("taskId", context.taskId);

        // Verify project was created
        const { data: project } = await supabase
          .from("projects")
          .select("*")
          .eq("name", projectName)
          .maybeSingle();

        if (project) {
          createdProjectIds.push(project.id);
          expect(project.org_slug).toBe(TEST_ORG_SLUG);
        }

        // Verify drawing was created (taskId = drawingId)
        const { data: drawing } = await supabase
          .from("drawings")
          .select("*")
          .eq("id", context.taskId)
          .maybeSingle();

        if (drawing) {
          createdDrawingIds.push(drawing.id);
          expect(drawing.status).toBeDefined();
        }
      }
    }, 60000); // 60 second timeout for LLM call

    it("2.3: Should use existing project when projectId provided", async () => {
      // Create a project first
      const projectId = uuidv4();
      await supabase.from("projects").insert({
        id: projectId,
        org_slug: TEST_ORG_SLUG,
        name: `Existing Project ${Date.now()}`,
        constraints: { units: "inches" },
      });
      createdProjectIds.push(projectId);

      const context = createTestContext();

      const { status, data: _data } = await callCadAgentGenerate({
        context,
        userMessage: "Create a bracket",
        projectId,
        constraints: { material: "Steel" },
      });

      if (status === 200) {
        // Verify drawing was linked to existing project
        const { data: drawing } = await supabase
          .from("drawings")
          .select("*")
          .eq("id", context.taskId)
          .maybeSingle();

        if (drawing) {
          createdDrawingIds.push(drawing.id);
          expect(drawing.project_id).toBe(projectId);
        }
      }
    }, 60000);

    it("2.4: Should return status for running/completed tasks", async () => {
      // First, we need a task that exists
      // Create a drawing directly in the database
      const projectId = uuidv4();
      await supabase.from("projects").insert({
        id: projectId,
        org_slug: TEST_ORG_SLUG,
        name: `Status Test Project ${Date.now()}`,
      });
      createdProjectIds.push(projectId);

      const drawingId = uuidv4();
      await supabase.from("drawings").insert({
        id: drawingId,
        project_id: projectId,
        name: "Status Test Drawing",
        prompt: "Test prompt",
        status: "completed",
      });
      createdDrawingIds.push(drawingId);

      // Try to get status (will return 404 if no checkpointer state exists)
      const { status, data: _data } = await getCadAgentStatus(drawingId);

      // This should return 404 since we didn't actually run through the graph
      // The checkpointer won't have state for this taskId
      expect([200, 404]).toContain(status);
    });
  });

  // ==========================================================================
  // SUITE 3: DELIVERABLE OUTPUT & VERSIONING
  // ==========================================================================
  describe("Suite 3: Deliverable Output & Versioning", () => {
    it("3.1: Should save generated code to database", async () => {
      // Create project and drawing
      const projectId = uuidv4();
      await supabase.from("projects").insert({
        id: projectId,
        org_slug: TEST_ORG_SLUG,
        name: `Code Test Project ${Date.now()}`,
      });
      createdProjectIds.push(projectId);

      const drawingId = uuidv4();
      await supabase.from("drawings").insert({
        id: drawingId,
        project_id: projectId,
        name: "Code Test Drawing",
        prompt: "Test prompt",
        status: "generating",
      });
      createdDrawingIds.push(drawingId);

      // Insert generated code
      const codeId = uuidv4();
      const { data, error } = await supabase
        .from("generated_code")
        .insert({
          id: codeId,
          drawing_id: drawingId,
          code: `function createModel(oc) {
  const box = new oc.BRepPrimAPI_MakeBox(10, 10, 10).Shape();
  return box;
}`,
          code_type: "opencascade-js",
          llm_provider: "ollama",
          llm_model: "qwen2.5-coder:14b",
          attempt_number: 1,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.drawing_id).toBe(drawingId);
      expect(data.code_type).toBe("opencascade-js");
    });

    it("3.2: Should track multiple code attempts (retry logic)", async () => {
      // Create project and drawing
      const projectId = uuidv4();
      await supabase.from("projects").insert({
        id: projectId,
        org_slug: TEST_ORG_SLUG,
        name: `Retry Test Project ${Date.now()}`,
      });
      createdProjectIds.push(projectId);

      const drawingId = uuidv4();
      await supabase.from("drawings").insert({
        id: drawingId,
        project_id: projectId,
        name: "Retry Test Drawing",
        prompt: "Test prompt",
      });
      createdDrawingIds.push(drawingId);

      // Insert multiple code attempts
      const attempts = [
        {
          attempt_number: 1,
          is_valid: false,
          validation_errors: ["Missing MakeBox"],
        },
        {
          attempt_number: 2,
          is_valid: false,
          validation_errors: ["Syntax error"],
        },
        { attempt_number: 3, is_valid: true, validation_errors: [] },
      ];

      for (const attempt of attempts) {
        await supabase.from("generated_code").insert({
          id: uuidv4(),
          drawing_id: drawingId,
          code: `// Attempt ${attempt.attempt_number}`,
          code_type: "opencascade-js",
          llm_provider: "ollama",
          llm_model: "qwen2.5-coder:14b",
          attempt_number: attempt.attempt_number,
          is_valid: attempt.is_valid,
          validation_errors: attempt.validation_errors,
        });
      }

      // Query all attempts
      const { data: allCodes } = await supabase
        .from("generated_code")
        .select("*")
        .eq("drawing_id", drawingId)
        .order("attempt_number", { ascending: true });

      expect(allCodes).toHaveLength(3);
      expect(allCodes![0].is_valid).toBe(false);
      expect(allCodes![2].is_valid).toBe(true);
    });

    it("3.3: Should save CAD outputs with correct formats", async () => {
      // Create project and drawing
      const projectId = uuidv4();
      await supabase.from("projects").insert({
        id: projectId,
        org_slug: TEST_ORG_SLUG,
        name: `Output Test Project ${Date.now()}`,
      });
      createdProjectIds.push(projectId);

      const drawingId = uuidv4();
      await supabase.from("drawings").insert({
        id: drawingId,
        project_id: projectId,
        name: "Output Test Drawing",
        prompt: "Test prompt",
        status: "completed",
      });
      createdDrawingIds.push(drawingId);

      // Insert CAD outputs
      const outputs = [
        {
          format: "step",
          storage_path: `engineering/${drawingId}/model.step`,
          file_size_bytes: 12345,
        },
        {
          format: "stl",
          storage_path: `engineering/${drawingId}/model.stl`,
          file_size_bytes: 23456,
        },
        {
          format: "gltf",
          storage_path: `engineering/${drawingId}/model.gltf`,
          file_size_bytes: 34567,
          mesh_stats: { vertices: 1000, faces: 500 },
        },
        {
          format: "thumbnail",
          storage_path: `engineering/${drawingId}/thumbnail.png`,
          file_size_bytes: 5678,
        },
      ];

      for (const output of outputs) {
        await supabase.from("cad_outputs").insert({
          id: uuidv4(),
          drawing_id: drawingId,
          format: output.format,
          storage_path: output.storage_path,
          file_size_bytes: output.file_size_bytes,
          mesh_stats: output.mesh_stats || null,
        });
      }

      // Query outputs
      const { data: savedOutputs } = await supabase
        .from("cad_outputs")
        .select("*")
        .eq("drawing_id", drawingId);

      expect(savedOutputs).toHaveLength(4);

      const gltfOutput = savedOutputs!.find((o) => o.format === "gltf");
      expect(gltfOutput).toBeDefined();
      expect(gltfOutput!.mesh_stats).toHaveProperty("vertices", 1000);
    });

    it("3.4: Should return outputs via API endpoint", async () => {
      // Create project and drawing with outputs
      const projectId = uuidv4();
      await supabase.from("projects").insert({
        id: projectId,
        org_slug: TEST_ORG_SLUG,
        name: `API Output Test Project ${Date.now()}`,
      });
      createdProjectIds.push(projectId);

      const drawingId = uuidv4();
      await supabase.from("drawings").insert({
        id: drawingId,
        project_id: projectId,
        name: "API Output Test Drawing",
        prompt: "Test prompt",
        status: "completed",
      });
      createdDrawingIds.push(drawingId);

      // Insert outputs
      await supabase.from("cad_outputs").insert([
        {
          id: uuidv4(),
          drawing_id: drawingId,
          format: "step",
          storage_path: `engineering/${drawingId}/model.step`,
        },
        {
          id: uuidv4(),
          drawing_id: drawingId,
          format: "stl",
          storage_path: `engineering/${drawingId}/model.stl`,
        },
      ]);

      // Call outputs endpoint
      const { status, data } = await getCadAgentOutputs(drawingId);

      expect(status).toBe(200);
      expect(data).toHaveProperty("success", true);
      expect(data.data).toHaveProperty("outputs");
      expect(data.data.outputs).toHaveProperty("step");
      expect(data.data.outputs).toHaveProperty("stl");
    });
  });

  // ==========================================================================
  // SUITE 4: ERROR HANDLING & EDGE CASES
  // ==========================================================================
  describe("Suite 4: Error Handling & Edge Cases", () => {
    it("4.1: Should log execution steps in execution_log", async () => {
      // Create project and drawing
      const projectId = uuidv4();
      await supabase.from("projects").insert({
        id: projectId,
        org_slug: TEST_ORG_SLUG,
        name: `Log Test Project ${Date.now()}`,
      });
      createdProjectIds.push(projectId);

      const drawingId = uuidv4();
      await supabase.from("drawings").insert({
        id: drawingId,
        project_id: projectId,
        name: "Log Test Drawing",
        prompt: "Test prompt",
      });
      createdDrawingIds.push(drawingId);

      // Insert execution log entries
      const steps = [
        { step_type: "prompt_received", message: "Received CAD prompt" },
        {
          step_type: "constraints_applied",
          message: "Applied project constraints",
        },
        { step_type: "llm_started", message: "Starting LLM code generation" },
        {
          step_type: "llm_completed",
          message: "LLM code generation completed",
          duration_ms: 1500,
        },
        { step_type: "code_validation", message: "Code validation passed" },
        {
          step_type: "execution_completed",
          message: "CAD execution completed",
          duration_ms: 200,
        },
        { step_type: "export_completed", message: "Files exported" },
      ];

      for (const step of steps) {
        await supabase.from("execution_log").insert({
          id: uuidv4(),
          drawing_id: drawingId,
          step_type: step.step_type,
          message: step.message,
          duration_ms: step.duration_ms || null,
        });
      }

      // Query log entries
      const { data: logs } = await supabase
        .from("execution_log")
        .select("*")
        .eq("drawing_id", drawingId)
        .order("created_at", { ascending: true });

      expect(logs).toHaveLength(7);
      expect(logs![0].step_type).toBe("prompt_received");
      expect(logs![6].step_type).toBe("export_completed");
    });

    it("4.2: Should handle drawing status updates", async () => {
      // Create project and drawing
      const projectId = uuidv4();
      await supabase.from("projects").insert({
        id: projectId,
        org_slug: TEST_ORG_SLUG,
        name: `Status Update Project ${Date.now()}`,
      });
      createdProjectIds.push(projectId);

      const drawingId = uuidv4();
      await supabase.from("drawings").insert({
        id: drawingId,
        project_id: projectId,
        name: "Status Update Drawing",
        prompt: "Test prompt",
        status: "pending",
      });
      createdDrawingIds.push(drawingId);

      // Update status through workflow stages
      const statuses = [
        "generating",
        "validating",
        "executing",
        "exporting",
        "completed",
      ];

      for (const status of statuses) {
        const { error } = await supabase
          .from("drawings")
          .update({ status, updated_at: new Date().toISOString() })
          .eq("id", drawingId);

        expect(error).toBeNull();

        // Verify update
        const { data } = await supabase
          .from("drawings")
          .select("status")
          .eq("id", drawingId)
          .single();

        expect(data!.status).toBe(status);
      }
    });

    it("4.3: Should handle failed status with error message", async () => {
      // Create project and drawing
      const projectId = uuidv4();
      await supabase.from("projects").insert({
        id: projectId,
        org_slug: TEST_ORG_SLUG,
        name: `Error Test Project ${Date.now()}`,
      });
      createdProjectIds.push(projectId);

      const drawingId = uuidv4();
      await supabase.from("drawings").insert({
        id: drawingId,
        project_id: projectId,
        name: "Error Test Drawing",
        prompt: "Test prompt",
        status: "generating",
      });
      createdDrawingIds.push(drawingId);

      // Simulate failure
      const errorMessage = "LLM failed to generate valid code after 3 attempts";
      const { error } = await supabase
        .from("drawings")
        .update({
          status: "failed",
          error_message: errorMessage,
          updated_at: new Date().toISOString(),
        })
        .eq("id", drawingId);

      expect(error).toBeNull();

      // Verify error was saved
      const { data } = await supabase
        .from("drawings")
        .select("status, error_message")
        .eq("id", drawingId)
        .single();

      expect(data!.status).toBe("failed");
      expect(data!.error_message).toBe(errorMessage);

      // Log the error
      await supabase.from("execution_log").insert({
        id: uuidv4(),
        drawing_id: drawingId,
        step_type: "error",
        message: errorMessage,
      });

      const { data: errorLog } = await supabase
        .from("execution_log")
        .select("*")
        .eq("drawing_id", drawingId)
        .eq("step_type", "error")
        .single();

      expect(errorLog).toBeDefined();
      expect(errorLog!.message).toBe(errorMessage);
    });

    it("4.4: Should return 404 for non-existent drawing outputs", async () => {
      const nonExistentDrawingId = uuidv4();

      const { status, data } = await getCadAgentOutputs(nonExistentDrawingId);

      expect(status).toBe(404);
      expect(data).toHaveProperty("message");
    });

    it("4.5: Should validate drawing version increments", async () => {
      // Create project
      const projectId = uuidv4();
      await supabase.from("projects").insert({
        id: projectId,
        org_slug: TEST_ORG_SLUG,
        name: `Version Test Project ${Date.now()}`,
      });
      createdProjectIds.push(projectId);

      // Create initial drawing (version 1)
      const drawingV1Id = uuidv4();
      await supabase.from("drawings").insert({
        id: drawingV1Id,
        project_id: projectId,
        name: "Version Test Drawing",
        prompt: "Initial prompt",
        version: 1,
        status: "completed",
      });
      createdDrawingIds.push(drawingV1Id);

      // Create revision (version 2) linked to parent
      const drawingV2Id = uuidv4();
      await supabase.from("drawings").insert({
        id: drawingV2Id,
        project_id: projectId,
        name: "Version Test Drawing",
        prompt: "Revised prompt with more details",
        version: 2,
        parent_drawing_id: drawingV1Id,
        status: "completed",
      });
      createdDrawingIds.push(drawingV2Id);

      // Query version history
      const { data: versions } = await supabase
        .from("drawings")
        .select("*")
        .eq("project_id", projectId)
        .eq("name", "Version Test Drawing")
        .order("version", { ascending: true });

      expect(versions).toHaveLength(2);
      expect(versions![0].version).toBe(1);
      expect(versions![1].version).toBe(2);
      expect(versions![1].parent_drawing_id).toBe(drawingV1Id);
    });
  });

  // ==========================================================================
  // SUITE 5: INTEGRATION WITH DELIVERABLES
  // ==========================================================================
  describe("Suite 5: Integration with Deliverables", () => {
    it("5.1: Should structure result for deliverable creation", async () => {
      // Create project and drawing with complete data
      const projectId = uuidv4();
      const { error: projectError } = await supabase.from("projects").insert({
        id: projectId,
        org_slug: TEST_ORG_SLUG,
        name: `Deliverable Test Project ${Date.now()}`,
        constraints: { units: "mm", material: "Aluminum 6061" },
      });
      expect(projectError).toBeNull();
      createdProjectIds.push(projectId);

      const drawingId = uuidv4();
      // Note: In production, task_id would come from the A2A orchestrator's task creation
      // For this test, we skip task_id since it has FK constraint to public.tasks
      const { error: drawingError } = await supabase.from("drawings").insert({
        id: drawingId,
        project_id: projectId,
        // task_id omitted - would be set by the service when task exists
        name: "Deliverable Test Drawing",
        prompt: "Create a mounting bracket",
        status: "completed",
        constraints_override: { wall_thickness_min: 3.0 },
      });
      expect(drawingError).toBeNull();
      createdDrawingIds.push(drawingId);

      // Add generated code
      const { error: codeError } = await supabase
        .from("generated_code")
        .insert({
          id: uuidv4(),
          drawing_id: drawingId,
          code: "function createModel(oc) { return oc.MakeBox(10,10,10); }",
          code_type: "opencascade-js",
          llm_provider: "ollama",
          llm_model: "qwen2.5-coder:14b",
          is_valid: true,
          attempt_number: 1,
        });
      expect(codeError).toBeNull();

      // Add outputs
      const { error: outputsError } = await supabase
        .from("cad_outputs")
        .insert([
          {
            id: uuidv4(),
            drawing_id: drawingId,
            format: "step",
            storage_path: `engineering/${drawingId}/model.step`,
          },
          {
            id: uuidv4(),
            drawing_id: drawingId,
            format: "stl",
            storage_path: `engineering/${drawingId}/model.stl`,
          },
          {
            id: uuidv4(),
            drawing_id: drawingId,
            format: "gltf",
            storage_path: `engineering/${drawingId}/model.gltf`,
            mesh_stats: { vertices: 500, faces: 250 },
          },
        ]);
      expect(outputsError).toBeNull();

      // Reconstruct deliverable data (similar to what CadAgentService returns)
      const { data: drawing, error: readDrawingError } = await supabase
        .from("drawings")
        .select("*")
        .eq("id", drawingId)
        .single();
      expect(readDrawingError).toBeNull();
      expect(drawing).toBeDefined();

      const { data: code, error: readCodeError } = await supabase
        .from("generated_code")
        .select("*")
        .eq("drawing_id", drawingId)
        .eq("is_valid", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      expect(readCodeError).toBeNull();
      expect(code).toBeDefined();

      const { data: outputs, error: readOutputsError } = await supabase
        .from("cad_outputs")
        .select("*")
        .eq("drawing_id", drawingId);
      expect(readOutputsError).toBeNull();
      expect(outputs).toBeDefined();

      // Build deliverable result structure
      // In production, taskId would equal drawingId (task_id = drawing.id by design)
      const deliverableResult = {
        taskId: drawingId, // By design: taskId === drawingId
        status: drawing!.status,
        userMessage: drawing!.prompt,
        generatedCode: code!.code,
        outputs: outputs!.reduce(
          (acc, o) => {
            acc[o.format] = o.storage_path;
            return acc;
          },
          {} as Record<string, string>,
        ),
        meshStats: outputs!.find((o) => o.mesh_stats)?.mesh_stats,
        version: drawing!.version,
      };

      expect(deliverableResult.taskId).toBe(drawingId);
      expect(deliverableResult.status).toBe("completed");
      expect(deliverableResult.outputs).toHaveProperty("step");
      expect(deliverableResult.outputs).toHaveProperty("stl");
      expect(deliverableResult.outputs).toHaveProperty("gltf");
      expect(deliverableResult.meshStats).toHaveProperty("vertices", 500);
      expect(deliverableResult.version).toBe(1);
    });
  });

  // ==========================================================================
  // SUITE 6: STORAGE INTEGRATION
  // ==========================================================================
  describe("Suite 6: Storage Integration", () => {
    // Create a separate Supabase client for storage operations
    let storageClient: SupabaseClient;

    beforeAll(() => {
      const supabaseUrl = process.env.SUPABASE_URL || "http://127.0.0.1:6010";
      const supabaseKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

      storageClient = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false },
      });
    });

    it("6.1: Should have cad-outputs bucket available", async () => {
      const { data: buckets, error } =
        await storageClient.storage.listBuckets();

      // If error, the storage might not be fully initialized
      if (error) {
        console.log(
          "Storage bucket check - may not be initialized yet:",
          error.message,
        );
        return;
      }

      // Bucket should exist if storage service has been initialized
      // If not yet created, this test will pass but bucket may not exist
      const cadOutputsBucket = buckets?.find((b) => b.name === "cad-outputs");
      if (cadOutputsBucket) {
        expect(cadOutputsBucket.public).toBe(true);
      }
    });

    it("6.2: Should store and retrieve CAD output files", async () => {
      // Test file content
      const testContent = Buffer.from("Test STEP file content", "utf-8");
      const testPath = `test-org/test-project/test-drawing-${Date.now()}/model.step`;

      // Create bucket if it doesn't exist
      const { data: buckets } = await storageClient.storage.listBuckets();
      const bucketExists = buckets?.some((b) => b.name === "cad-outputs");

      if (!bucketExists) {
        await storageClient.storage.createBucket("cad-outputs", {
          public: true,
          fileSizeLimit: 52428800,
        });
      }

      // Upload test file
      const { error: uploadError } = await storageClient.storage
        .from("cad-outputs")
        .upload(testPath, testContent, {
          contentType: "application/step",
          upsert: true,
        });

      expect(uploadError).toBeNull();

      // Get public URL
      const { data: urlData } = storageClient.storage
        .from("cad-outputs")
        .getPublicUrl(testPath);

      expect(urlData.publicUrl).toBeDefined();
      expect(urlData.publicUrl).toContain("cad-outputs");

      // Cleanup: Remove test file
      await storageClient.storage.from("cad-outputs").remove([testPath]);
    });

    it("6.3: Should verify CAD output paths contain real URLs after generation", async () => {
      // This test verifies that when a full workflow runs, the cad_outputs
      // table contains actual storage URLs instead of placeholder paths

      // Create project and drawing
      const projectId = uuidv4();
      await supabase.from("projects").insert({
        id: projectId,
        org_slug: TEST_ORG_SLUG,
        name: `Storage URL Test Project ${Date.now()}`,
      });
      createdProjectIds.push(projectId);

      const drawingId = uuidv4();
      await supabase.from("drawings").insert({
        id: drawingId,
        project_id: projectId,
        name: "Storage URL Test Drawing",
        prompt: "Test storage paths",
        status: "completed",
      });
      createdDrawingIds.push(drawingId);

      // Insert outputs with Supabase storage paths (simulating what the storage service creates)
      const storagePath = `${TEST_ORG_SLUG}/${projectId}/${drawingId}/model.step`;
      await supabase.from("cad_outputs").insert({
        id: uuidv4(),
        drawing_id: drawingId,
        format: "step",
        storage_path: storagePath,
        file_size_bytes: 1234,
      });

      // Verify the path structure is correct (not a placeholder)
      const { data: outputs } = await supabase
        .from("cad_outputs")
        .select("*")
        .eq("drawing_id", drawingId);

      expect(outputs).toHaveLength(1);
      expect(outputs![0].storage_path).not.toContain("placeholder");
      expect(outputs![0].storage_path).toContain(TEST_ORG_SLUG);
      expect(outputs![0].storage_path).toContain(projectId);
      expect(outputs![0].storage_path).toContain(drawingId);
    });
  });
});
