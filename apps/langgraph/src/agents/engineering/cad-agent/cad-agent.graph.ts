import { StateGraph, END } from "@langchain/langgraph";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import {
  CadAgentStateAnnotation,
  CadAgentState,
  CadConstraints,
} from "./cad-agent.state";
import { CadDbService } from "./services/cad-db.service";
import { CadStorageService, CadFileFormat } from "./services/cad-storage.service";
import { LLMHttpClientService } from "../../../services/llm-http-client.service";
import { ObservabilityService } from "../../../services/observability.service";
import { PostgresCheckpointerService } from "../../../persistence/postgres-checkpointer.service";

const AGENT_SLUG = "cad-agent";
const MAX_GENERATION_ATTEMPTS = 3;

/**
 * Create the CAD Agent graph
 *
 * Flow:
 * 1. Start → Initialize workflow
 * 2. Apply Constraints → Inject project constraints
 * 3. Generate Code → Generate OpenCASCADE.js code using LLM
 * 4. Validate Code → Validate TypeScript/JS code
 * 5. Execute CAD → Execute OpenCASCADE.js code (PLACEHOLDER)
 * 6. Export Files → Export to multiple formats (PLACEHOLDER)
 * 7. Handle Error → Handle errors
 */
export function createCadAgentGraph(
  llmClient: LLMHttpClientService,
  observability: ObservabilityService,
  checkpointer: PostgresCheckpointerService,
  cadDbService: CadDbService,
  cadStorageService: CadStorageService,
) {
  // Node: Initialize workflow
  async function startNode(
    state: CadAgentState,
  ): Promise<Partial<CadAgentState>> {
    const ctx = state.executionContext;

    await observability.emitStarted(
      ctx,
      ctx.taskId,
      `Starting CAD generation for: ${state.userMessage}`,
    );

    return {
      status: "generating",
      startedAt: Date.now(),
      messages: [new HumanMessage(state.userMessage)],
    };
  }

  // Node: Apply constraints to enhance prompt
  async function applyConstraintsNode(
    state: CadAgentState,
  ): Promise<Partial<CadAgentState>> {
    const ctx = state.executionContext;

    await observability.emitProgress(ctx, ctx.taskId, "Applying constraints", {
      step: "apply_constraints",
      progress: 10,
    });

    try {
      // Get effective constraints from DB or state
      let effectiveConstraints: CadConstraints;

      if (state.drawingId) {
        // Get constraints from database
        effectiveConstraints = await cadDbService.getEffectiveConstraints(
          state.drawingId,
        );

        // Log execution step
        await cadDbService.logStep({
          drawingId: state.drawingId,
          stepType: "constraints_applied",
          message: "Applied constraints from database",
          details: { constraints: effectiveConstraints },
        });
      } else {
        // Use constraints from state
        effectiveConstraints = state.constraints;
      }

      // Create enhanced prompt that includes constraints
      const constraintPrompt = buildConstraintPrompt(effectiveConstraints);
      const enhancedPrompt = `${state.userMessage}\n\n${constraintPrompt}`;

      return {
        constraints: effectiveConstraints,
        userMessage: enhancedPrompt,
        messages: [
          ...state.messages,
          new AIMessage(
            `Applied constraints: ${JSON.stringify(effectiveConstraints, null, 2)}`,
          ),
        ],
      };
    } catch (error) {
      return {
        error: `Failed to apply constraints: ${error instanceof Error ? error.message : String(error)}`,
        status: "failed",
      };
    }
  }

  // Node: Generate OpenCASCADE.js code using LLM
  async function generateCodeNode(
    state: CadAgentState,
  ): Promise<Partial<CadAgentState>> {
    const ctx = state.executionContext;

    await observability.emitProgress(
      ctx,
      ctx.taskId,
      "Generating OpenCASCADE.js code",
      { step: "generate_code", progress: 30 },
    );

    // Log LLM start
    if (state.drawingId) {
      await cadDbService.logStep({
        drawingId: state.drawingId,
        stepType: "llm_started",
        message: "Starting LLM code generation",
      });
    }

    // Build system prompt for OpenCASCADE.js code generation
    const systemPrompt = buildOpenCascadeSystemPrompt(state.constraints);

    try {
      // Call LLM via llmClient.callLLM() with ExecutionContext
      const llmResponse = await llmClient.callLLM({
        context: ctx, // Full ExecutionContext
        systemMessage: systemPrompt,
        userMessage: state.userMessage,
        temperature: 0.7,
        maxTokens: 4000,
        callerName: AGENT_SLUG,
      });

      // Extract code from response
      const generatedCode = extractCodeFromResponse(llmResponse.text);

      // Save generated code to DB
      if (state.drawingId) {
        await cadDbService.saveGeneratedCode({
          drawingId: state.drawingId,
          code: generatedCode,
          codeType: "opencascade-js",
          llmProvider: ctx.provider,
          llmModel: ctx.model,
          promptTokens: llmResponse.usage?.promptTokens,
          completionTokens: llmResponse.usage?.completionTokens,
          attemptNumber: state.codeAttempt + 1,
        });

        // Log LLM completion
        await cadDbService.logStep({
          drawingId: state.drawingId,
          stepType: "llm_completed",
          message: "LLM code generation completed",
          details: {
            codeLength: generatedCode.length,
            promptTokens: llmResponse.usage?.promptTokens,
            completionTokens: llmResponse.usage?.completionTokens,
            cost: llmResponse.usage?.cost,
          },
        });
      }

      return {
        generatedCode,
        codeAttempt: state.codeAttempt + 1,
        status: "validating",
        messages: [
          ...state.messages,
          new AIMessage(
            `Generated OpenCASCADE.js code (${generatedCode.length} chars)`,
          ),
        ],
      };
    } catch (error) {
      return {
        error: `Failed to generate code: ${error instanceof Error ? error.message : String(error)}`,
        status: "failed",
      };
    }
  }

  // Node: Validate TypeScript/JS code
  async function validateCodeNode(
    state: CadAgentState,
  ): Promise<Partial<CadAgentState>> {
    const ctx = state.executionContext;

    await observability.emitProgress(ctx, ctx.taskId, "Validating code", {
      step: "validate_code",
      progress: 50,
    });

    if (!state.generatedCode) {
      return {
        error: "No code to validate",
        status: "failed",
      };
    }

    // Check for basic syntax and required OpenCASCADE patterns
    const validationErrors = validateOpenCascadeCode(state.generatedCode);
    const isValid = validationErrors.length === 0;

    // Update code validation in DB
    if (state.drawingId) {
      const latestCode = await cadDbService.getLatestCode(state.drawingId);
      if (latestCode) {
        await cadDbService.updateCodeValidation(
          latestCode.id,
          isValid,
          validationErrors,
        );
      }

      // Log validation result
      await cadDbService.logStep({
        drawingId: state.drawingId,
        stepType: "code_validation",
        message: isValid ? "Code validation passed" : "Code validation failed",
        details: {
          isValid,
          validationErrors,
          attempt: state.codeAttempt,
        },
      });
    }

    return {
      isCodeValid: isValid,
      validationErrors,
      status: isValid ? "executing" : "validating",
      executionStatus: isValid ? "executing" : "pending",
      messages: [
        ...state.messages,
        new AIMessage(
          isValid
            ? "Code validation passed"
            : `Code validation failed: ${validationErrors.join(", ")}`,
        ),
      ],
    };
  }

  // Node: Execute OpenCASCADE.js code (PLACEHOLDER for now)
  async function executeCadNode(
    state: CadAgentState,
  ): Promise<Partial<CadAgentState>> {
    const ctx = state.executionContext;

    await observability.emitProgress(ctx, ctx.taskId, "Executing CAD code", {
      step: "execute_cad",
      progress: 70,
    });

    // Log execution start
    if (state.drawingId) {
      await cadDbService.logStep({
        drawingId: state.drawingId,
        stepType: "execution_started",
        message: "Starting CAD code execution (PLACEHOLDER)",
      });
    }

    try {
      // PLACEHOLDER: For now, just log that execution would happen
      // In future: Use opencascade.js WASM to run code
      const executionTimeMs = 100; // Placeholder timing

      // Log execution completion
      if (state.drawingId) {
        await cadDbService.logStep({
          drawingId: state.drawingId,
          stepType: "execution_completed",
          message: "CAD code execution completed (PLACEHOLDER)",
          details: { executionTimeMs },
        });
      }

      return {
        executionStatus: "completed",
        executionTimeMs,
        status: "exporting",
        messages: [
          ...state.messages,
          new AIMessage(
            "CAD code execution completed (PLACEHOLDER - actual execution not yet implemented)",
          ),
        ],
      };
    } catch (error) {
      return {
        executionStatus: "failed",
        executionError: error instanceof Error ? error.message : String(error),
        error: `CAD execution failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  // Node: Export to multiple formats
  async function exportFilesNode(
    state: CadAgentState,
  ): Promise<Partial<CadAgentState>> {
    const ctx = state.executionContext;

    await observability.emitProgress(ctx, ctx.taskId, "Exporting files", {
      step: "export_files",
      progress: 90,
    });

    try {
      // Get project ID from state or database
      let projectId = state.projectId;
      if (!projectId && state.drawingId) {
        const drawing = await cadDbService.getDrawing(state.drawingId);
        projectId = drawing?.project_id;
      }

      if (!projectId || !state.drawingId) {
        throw new Error("Missing projectId or drawingId for file export");
      }

      // Generate placeholder CAD file content
      // TODO: In future, these will be actual CAD files from OpenCASCADE execution
      const generatedCode = state.generatedCode || "// No code generated";
      const placeholderStepContent = generatePlaceholderStep(
        state.userMessage,
        generatedCode,
      );
      const placeholderStlContent = generatePlaceholderStl(state.userMessage);
      const placeholderGltfContent = generatePlaceholderGltf(state.userMessage);

      // Upload files to Supabase Storage
      const outputs: Record<string, string> = {};
      const formats: CadFileFormat[] = ["step", "stl", "gltf"];

      for (const format of formats) {
        let fileContent: Buffer;

        switch (format) {
          case "step":
            fileContent = Buffer.from(placeholderStepContent, "utf-8");
            break;
          case "stl":
            fileContent = Buffer.from(placeholderStlContent, "utf-8");
            break;
          case "gltf":
            fileContent = Buffer.from(placeholderGltfContent, "utf-8");
            break;
          default:
            continue;
        }

        // Upload to storage
        const storageResult = await cadStorageService.storeFile(
          fileContent,
          ctx,
          projectId,
          state.drawingId,
          format,
        );

        outputs[format] = storageResult.publicUrl;

        // Save metadata to database
        await cadDbService.saveCadOutput({
          drawingId: state.drawingId,
          format,
          storagePath: storageResult.storagePath,
          fileSizeBytes: storageResult.sizeBytes,
          meshStats:
            format === "gltf"
              ? {
                  vertices: 8, // Placeholder cube stats
                  faces: 12,
                  boundingBox: {
                    min: { x: -5, y: -5, z: -5 },
                    max: { x: 5, y: 5, z: 5 },
                  },
                }
              : undefined,
        });
      }

      // Log export completion
      await cadDbService.logStep({
        drawingId: state.drawingId,
        stepType: "export_completed",
        message: "File export completed - files stored in Supabase",
        details: { outputs },
      });

      // Update drawing status to completed
      await cadDbService.completeDrawing(state.drawingId);

      const duration = Date.now() - state.startedAt;

      await observability.emitCompleted(ctx, ctx.taskId, { outputs }, duration);

      return {
        outputs: {
          step: outputs.step,
          stl: outputs.stl,
          gltf: outputs.gltf,
        },
        meshStats: {
          vertices: 8,
          faces: 12,
          boundingBox: {
            min: { x: -5, y: -5, z: -5 },
            max: { x: 5, y: 5, z: 5 },
          },
        },
        status: "completed",
        completedAt: Date.now(),
        messages: [
          ...state.messages,
          new AIMessage(
            `Files exported successfully to Supabase Storage: STEP, STL, GLTF`,
          ),
        ],
      };
    } catch (error) {
      return {
        error: `Failed to export files: ${error instanceof Error ? error.message : String(error)}`,
        status: "failed",
      };
    }
  }

  // Node: Handle errors
  async function handleErrorNode(
    state: CadAgentState,
  ): Promise<Partial<CadAgentState>> {
    const ctx = state.executionContext;

    const duration = Date.now() - state.startedAt;

    await observability.emitFailed(
      ctx,
      ctx.taskId,
      state.error || "Unknown error",
      duration,
    );

    // Update drawing status to failed
    if (state.drawingId) {
      await cadDbService.updateDrawingStatus(
        state.drawingId,
        "failed",
        state.error,
      );
    }

    return {
      status: "failed",
      completedAt: Date.now(),
    };
  }

  // Build the graph
  const graph = new StateGraph(CadAgentStateAnnotation)
    .addNode("start", startNode)
    .addNode("apply_constraints", applyConstraintsNode)
    .addNode("generate_code", generateCodeNode)
    .addNode("validate_code", validateCodeNode)
    .addNode("execute_cad", executeCadNode)
    .addNode("export_files", exportFilesNode)
    .addNode("handle_error", handleErrorNode)
    // Edges
    .addEdge("__start__", "start")
    .addEdge("start", "apply_constraints")
    .addConditionalEdges("apply_constraints", (state) => {
      if (state.error) return "handle_error";
      return "generate_code";
    })
    .addConditionalEdges("generate_code", (state) => {
      if (state.error) return "handle_error";
      return "validate_code";
    })
    .addConditionalEdges("validate_code", (state) => {
      // If code is invalid
      if (!state.isCodeValid) {
        // If we've hit max attempts, give up
        if (state.codeAttempt >= MAX_GENERATION_ATTEMPTS) {
          return "handle_error";
        }
        // Otherwise, retry generation
        return "generate_code";
      }
      // Code is valid, proceed to execution
      return "execute_cad";
    })
    .addConditionalEdges("execute_cad", (state) => {
      if (state.error || state.executionStatus === "failed") {
        return "handle_error";
      }
      return "export_files";
    })
    .addEdge("export_files", END)
    .addEdge("handle_error", END);

  // Compile with checkpointer
  return graph.compile({
    checkpointer: checkpointer.getSaver(),
  });
}

export type CadAgentGraph = ReturnType<typeof createCadAgentGraph>;

/**
 * Build constraint prompt from CAD constraints
 */
function buildConstraintPrompt(constraints: CadConstraints): string {
  const parts: string[] = [];

  if (constraints.units) {
    parts.push(`Units: ${constraints.units}`);
  }

  if (constraints.material) {
    parts.push(`Material: ${constraints.material}`);
  }

  if (constraints.manufacturing_method) {
    parts.push(`Manufacturing Method: ${constraints.manufacturing_method}`);
  }

  if (constraints.tolerance_class) {
    parts.push(`Tolerance Class: ${constraints.tolerance_class}`);
  }

  if (constraints.wall_thickness_min !== undefined) {
    parts.push(`Minimum Wall Thickness: ${constraints.wall_thickness_min}`);
  }

  if (parts.length === 0) {
    return "Design Constraints: None specified";
  }

  return `Design Constraints:\n${parts.map((p) => `- ${p}`).join("\n")}`;
}

/**
 * Build OpenCASCADE.js system prompt with API hints
 */
function buildOpenCascadeSystemPrompt(constraints: CadConstraints): string {
  return `You are an expert CAD engineer specializing in OpenCASCADE.js.

Your task is to generate TypeScript/JavaScript code using the OpenCASCADE.js library to create 3D CAD models.

**OpenCASCADE.js API Hints:**

Basic Primitives:
- oc.MakeBox(x, y, z) - Create a box
- oc.MakeCylinder(radius, height) - Create a cylinder
- oc.MakeSphere(radius) - Create a sphere
- oc.MakeCone(radius1, radius2, height) - Create a cone

Boolean Operations:
- oc.BRepAlgoAPI_Fuse(shape1, shape2) - Union/combine shapes
- oc.BRepAlgoAPI_Cut(shape1, shape2) - Subtract shape2 from shape1
- oc.BRepAlgoAPI_Common(shape1, shape2) - Intersection of shapes

Transformations:
- oc.Translate(shape, x, y, z) - Move shape
- oc.Rotate(shape, axis, angle) - Rotate shape
- oc.Scale(shape, factor) - Scale shape

Features:
- oc.BRepFilletAPI_MakeFillet(shape, radius) - Add fillets/rounds to edges
- oc.BRepFilletAPI_MakeChamfer(shape, distance) - Add chamfers to edges
- oc.BRepPrimAPI_MakePrism(face, vector) - Extrude a face

Export:
- oc.WriteSTEP(shape, filename) - Export to STEP format
- oc.WriteSTL(shape, filename) - Export to STL format

**Common CAD Patterns:**

1. Create base shape (box, cylinder, etc.)
2. Apply transformations (translate, rotate)
3. Add features (fillets, chamfers, holes via boolean cuts)
4. Combine multiple shapes (boolean union/subtract)
5. Export to desired format

**Code Requirements:**

1. Return ONLY TypeScript/JavaScript code wrapped in \`\`\`typescript or \`\`\`javascript code blocks
2. Use OpenCASCADE.js API (assume \`oc\` is the initialized OpenCASCADE instance)
3. Include a main function that creates and returns the shape
4. Add comments explaining each step
5. Follow these constraints:
${buildConstraintPrompt(constraints)}

**Example Code Structure:**

\`\`\`typescript
// Import types (if using TypeScript)
import type { TopoDS_Shape } from "opencascade.js";

// Main function to create the CAD model
function createModel(oc: any): TopoDS_Shape {
  // Step 1: Create base shape
  const box = new oc.BRepPrimAPI_MakeBox(10, 10, 10).Shape();

  // Step 2: Create feature (e.g., hole)
  const cylinder = new oc.BRepPrimAPI_MakeCylinder(2, 15).Shape();

  // Step 3: Boolean operation (cut hole)
  const result = new oc.BRepAlgoAPI_Cut(box, cylinder).Shape();

  // Step 4: Add fillets
  const fillet = new oc.BRepFilletAPI_MakeFillet(result);
  // ... add edges to fillet

  return fillet.Shape();
}

// Export function
export { createModel };
\`\`\`

Generate clean, well-commented OpenCASCADE.js code that follows best practices.`;
}

/**
 * Extract code from LLM response (handles markdown code blocks)
 */
function extractCodeFromResponse(response: string): string {
  // Try to extract code from markdown code blocks
  const codeBlockMatch = response.match(
    /```(?:typescript|javascript|ts|js)?\n([\s\S]*?)\n```/,
  );

  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // If no code block found, return the whole response
  return response.trim();
}

/**
 * Validate OpenCASCADE.js code for basic syntax and required patterns
 */
function validateOpenCascadeCode(code: string): string[] {
  const errors: string[] = [];

  // Check for basic patterns that should be present
  if (!code.includes("oc.") && !code.includes("new oc.")) {
    errors.push(
      "Code does not appear to use OpenCASCADE.js API (missing 'oc.' references)",
    );
  }

  // Check for common shape creation patterns
  const hasShapeCreation =
    code.includes("MakeBox") ||
    code.includes("MakeCylinder") ||
    code.includes("MakeSphere") ||
    code.includes("MakeCone") ||
    code.includes("MakePrism");

  if (!hasShapeCreation) {
    errors.push(
      "Code does not appear to create any shapes (missing MakeBox, MakeCylinder, etc.)",
    );
  }

  // Check for function or export structure
  const hasFunction =
    code.includes("function") || code.includes("export") || code.includes("=>");

  if (!hasFunction) {
    errors.push("Code should define a function or export structure");
  }

  // Check for basic syntax errors (very simple check)
  const openBraces = (code.match(/{/g) || []).length;
  const closeBraces = (code.match(/}/g) || []).length;

  if (openBraces !== closeBraces) {
    errors.push("Mismatched curly braces");
  }

  const openParens = (code.match(/\(/g) || []).length;
  const closeParens = (code.match(/\)/g) || []).length;

  if (openParens !== closeParens) {
    errors.push("Mismatched parentheses");
  }

  return errors;
}

/**
 * Generate a placeholder STEP file content
 * STEP files are ISO 10303 format for CAD data exchange
 * This generates a minimal valid STEP file with a placeholder cube
 */
function generatePlaceholderStep(prompt: string, code: string): string {
  const timestamp = new Date().toISOString();
  return `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('CAD Agent Generated Model - Placeholder'), '2;1');
FILE_NAME('model.step', '${timestamp}', ('CAD Agent'), ('Orchestrator AI'), '', 'OpenCASCADE', '');
FILE_SCHEMA(('AUTOMOTIVE_DESIGN'));
ENDSEC;
DATA;
/* Placeholder STEP content for: ${prompt.replace(/'/g, "''")} */
/* Generated code: */
${code
  .split("\n")
  .map((line) => `/* ${line} */`)
  .join("\n")}
/* This is a placeholder file - actual geometry will be generated when OpenCASCADE.js execution is implemented */
#1 = SHAPE_DEFINITION_REPRESENTATION(#2,#10);
#2 = PRODUCT_DEFINITION_SHAPE('','',#3);
#3 = PRODUCT_DEFINITION('design','',#4,#9);
#4 = PRODUCT_DEFINITION_FORMATION('','',#5);
#5 = PRODUCT('Placeholder Model','Placeholder Model','',(#6));
#6 = MECHANICAL_CONTEXT('',#7,'mechanical');
#7 = APPLICATION_CONTEXT('automotive_design');
#8 = APPLICATION_PROTOCOL_DEFINITION('','automotive_design',2000,#7);
#9 = PRODUCT_DEFINITION_CONTEXT('part_definition',#7,'design');
#10 = ADVANCED_BREP_SHAPE_REPRESENTATION('Placeholder',(#11,#15),#46);
ENDSEC;
END-ISO-10303-21;`;
}

/**
 * Generate a placeholder STL file content
 * STL is a simple triangular mesh format
 * This generates an ASCII STL with a simple cube
 */
function generatePlaceholderStl(prompt: string): string {
  return `solid PlaceholderCube
  facet normal 0 0 -1
    outer loop
      vertex 0 0 0
      vertex 10 0 0
      vertex 10 10 0
    endloop
  endfacet
  facet normal 0 0 -1
    outer loop
      vertex 0 0 0
      vertex 10 10 0
      vertex 0 10 0
    endloop
  endfacet
  facet normal 0 0 1
    outer loop
      vertex 0 0 10
      vertex 10 10 10
      vertex 10 0 10
    endloop
  endfacet
  facet normal 0 0 1
    outer loop
      vertex 0 0 10
      vertex 0 10 10
      vertex 10 10 10
    endloop
  endfacet
  facet normal 0 -1 0
    outer loop
      vertex 0 0 0
      vertex 10 0 10
      vertex 10 0 0
    endloop
  endfacet
  facet normal 0 -1 0
    outer loop
      vertex 0 0 0
      vertex 0 0 10
      vertex 10 0 10
    endloop
  endfacet
  facet normal 0 1 0
    outer loop
      vertex 0 10 0
      vertex 10 10 0
      vertex 10 10 10
    endloop
  endfacet
  facet normal 0 1 0
    outer loop
      vertex 0 10 0
      vertex 10 10 10
      vertex 0 10 10
    endloop
  endfacet
  facet normal -1 0 0
    outer loop
      vertex 0 0 0
      vertex 0 10 0
      vertex 0 10 10
    endloop
  endfacet
  facet normal -1 0 0
    outer loop
      vertex 0 0 0
      vertex 0 10 10
      vertex 0 0 10
    endloop
  endfacet
  facet normal 1 0 0
    outer loop
      vertex 10 0 0
      vertex 10 10 10
      vertex 10 10 0
    endloop
  endfacet
  facet normal 1 0 0
    outer loop
      vertex 10 0 0
      vertex 10 0 10
      vertex 10 10 10
    endloop
  endfacet
endsolid PlaceholderCube
`;
}

/**
 * Generate a placeholder GLTF file content
 * GLTF (GL Transmission Format) is a JSON-based 3D model format
 * This generates a minimal valid GLTF with a simple triangle
 */
function generatePlaceholderGltf(prompt: string): string {
  // Generate binary buffer data for a simple cube (8 vertices, 12 triangles)
  const cubeBufferData = generateCubeBufferData();

  const gltf = {
    asset: {
      version: "2.0",
      generator: "CAD Agent - Orchestrator AI",
      extras: {
        prompt,
        placeholder: true,
        note: "This is a placeholder cube - actual geometry will be generated when OpenCASCADE.js execution is implemented",
      },
    },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [
      {
        mesh: 0,
        name: "PlaceholderCube",
      },
    ],
    meshes: [
      {
        primitives: [
          {
            attributes: {
              POSITION: 0,
            },
            indices: 1,
            mode: 4, // TRIANGLES
          },
        ],
      },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126, // FLOAT
        count: 8,
        type: "VEC3",
        max: [5, 5, 5],
        min: [-5, -5, -5],
      },
      {
        bufferView: 1,
        componentType: 5123, // UNSIGNED_SHORT
        count: 36,
        type: "SCALAR",
      },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 96 }, // 8 vertices * 3 floats * 4 bytes
      { buffer: 0, byteOffset: 96, byteLength: 72 }, // 36 indices * 2 bytes
    ],
    buffers: [
      {
        uri: cubeBufferData.uri,
        byteLength: cubeBufferData.byteLength,
      },
    ],
  };

  return JSON.stringify(gltf, null, 2);
}

/**
 * Generate binary buffer data for a cube as base64 data URI
 */
function generateCubeBufferData(): { uri: string; byteLength: number } {
  // 8 vertices of a cube centered at origin with size 10 (-5 to 5)
  const vertices = new Float32Array([
    -5, -5, -5, // 0: back-bottom-left
    5, -5, -5, // 1: back-bottom-right
    5, 5, -5, // 2: back-top-right
    -5, 5, -5, // 3: back-top-left
    -5, -5, 5, // 4: front-bottom-left
    5, -5, 5, // 5: front-bottom-right
    5, 5, 5, // 6: front-top-right
    -5, 5, 5, // 7: front-top-left
  ]);

  // 12 triangles (36 indices) for cube faces
  const indices = new Uint16Array([
    // Back face
    0, 2, 1, 0, 3, 2,
    // Front face
    4, 5, 6, 4, 6, 7,
    // Left face
    0, 4, 7, 0, 7, 3,
    // Right face
    1, 2, 6, 1, 6, 5,
    // Bottom face
    0, 1, 5, 0, 5, 4,
    // Top face
    3, 7, 6, 3, 6, 2,
  ]);

  // Combine into single buffer
  const vertexBytes = new Uint8Array(vertices.buffer);
  const indexBytes = new Uint8Array(indices.buffer);

  const totalLength = vertexBytes.length + indexBytes.length;
  const combined = new Uint8Array(totalLength);
  combined.set(vertexBytes, 0);
  combined.set(indexBytes, vertexBytes.length);

  // Convert to base64
  const base64 = Buffer.from(combined).toString("base64");

  return {
    uri: `data:application/octet-stream;base64,${base64}`,
    byteLength: totalLength,
  };
}
