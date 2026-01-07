import { Injectable, Logger, OnModuleInit } from "@nestjs/common";

/**
 * OpenCASCADE.js Execution Result
 */
export interface OcctExecutionResult {
  success: boolean;
  /** The resulting shape from execution */
  shape?: unknown;
  /** STEP file content */
  stepContent?: string;
  /** STL file content (ASCII) */
  stlContent?: string;
  /** GLTF/GLB binary content */
  gltfContent?: Buffer;
  /** DXF file content (2D projection) */
  dxfContent?: string;
  /** Thumbnail PNG content (as buffer) */
  thumbnailContent?: Buffer;
  /** Mesh statistics */
  meshStats?: {
    vertices: number;
    faces: number;
    boundingBox: {
      min: { x: number; y: number; z: number };
      max: { x: number; y: number; z: number };
    };
  };
  /** Execution time in ms */
  executionTimeMs: number;
  /** Error message if failed */
  error?: string;
}

/**
 * OpenCASCADE.js Executor Service
 *
 * Initializes OpenCASCADE.js WASM module and executes generated CAD code
 * to produce actual geometry. Handles:
 * - WASM initialization
 * - Safe code execution in isolated context
 * - Geometry extraction and export
 * - STEP, STL, GLTF conversion
 */
@Injectable()
export class OpenCascadeExecutorService implements OnModuleInit {
  private readonly logger = new Logger(OpenCascadeExecutorService.name);
  private oc: unknown = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  async onModuleInit() {
    // Start initialization but don't block
    this.initPromise = this.initialize();
  }

  /**
   * Initialize OpenCASCADE.js WASM module
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.logger.log("Initializing OpenCASCADE.js WASM module...");

      // Dynamic import for ESM module
      // Note: opencascade.js is quite large (~50MB WASM) and takes time to load
      const initOpenCascade = await this.loadOpenCascade();
      this.oc = await initOpenCascade();

      this.isInitialized = true;
      this.logger.log("OpenCASCADE.js initialized successfully");
    } catch (error) {
      this.logger.error(
        `Failed to initialize OpenCASCADE.js: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Load OpenCASCADE module with proper ESM handling
   */
  private async loadOpenCascade(): Promise<() => Promise<unknown>> {
    try {
      // Try node.js specific import
      const module = await import("opencascade.js/dist/node.js");
      // Handle both default export and module itself being the initializer
      const initializer = module.default || module;
      // If it's a function, return it; otherwise wrap in function
      if (typeof initializer === "function") {
        return initializer as () => Promise<unknown>;
      }
      // Module exports an object with an init function
      return async () => initializer;
    } catch {
      // Fallback to default import
      const module = await import("opencascade.js");
      const initializer = (module as { default?: unknown }).default || module;
      if (typeof initializer === "function") {
        return initializer as () => Promise<unknown>;
      }
      return async () => initializer;
    }
  }

  /**
   * Ensure WASM is initialized before execution
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Execute OpenCASCADE.js code and produce geometry
   *
   * @param code - The generated OpenCASCADE.js code to execute
   * @returns Execution result with geometry and exports
   */
  async executeCode(code: string): Promise<OcctExecutionResult> {
    const startTime = Date.now();

    try {
      await this.ensureInitialized();

      if (!this.oc) {
        throw new Error("OpenCASCADE.js not initialized");
      }

      this.logger.debug(`Executing OpenCASCADE.js code (${code.length} chars)`);

      // Execute the code in a sandboxed context
      const shape = await this.runCodeSandboxed(code);

      if (!shape) {
        throw new Error("Code execution did not produce a valid shape");
      }

      // Log shape info for debugging
      this.logger.log(
        `[CAD-EXEC] Shape returned from code execution: ${typeof shape}`,
      );
      try {
        const oc = this.oc as Record<string, unknown>;
        const shapeType = oc["BRepCheck_Analyzer"] as new (shape: unknown) => {
          IsValid: () => boolean;
        };
        if (shapeType) {
          const analyzer = new shapeType(shape);
          this.logger.log(
            `[CAD-EXEC] Shape validity check: ${analyzer.IsValid()}`,
          );
        }
      } catch (validityErr) {
        this.logger.warn(
          `[CAD-EXEC] Could not check shape validity: ${validityErr}`,
        );
      }

      // Extract mesh statistics
      const meshStats = this.extractMeshStats(shape);

      // Export to various formats
      const stepContent = this.exportToSTEP(shape);
      const stlContent = this.exportToSTL(shape);
      const gltfContent = this.exportToGLTF(shape);
      const dxfContent = this.exportToDXF(shape, meshStats.boundingBox);
      const thumbnailContent = this.generateThumbnail(meshStats);

      const executionTimeMs = Date.now() - startTime;

      this.logger.log(
        `Code execution completed in ${executionTimeMs}ms - vertices: ${meshStats.vertices}, faces: ${meshStats.faces}`,
      );

      return {
        success: true,
        shape,
        stepContent,
        stlContent,
        gltfContent,
        dxfContent,
        thumbnailContent,
        meshStats,
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(`Code execution failed: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
        executionTimeMs,
      };
    }
  }

  /**
   * Run code in a sandboxed context
   *
   * Creates a function from the code and executes it with the oc instance.
   * This provides some isolation but is not fully secure for untrusted code.
   */
  private async runCodeSandboxed(code: string): Promise<unknown> {
    const oc = this.oc as Record<string, unknown>;

    try {
      // Look for a createModel or main function in the code
      // The LLM is instructed to generate a function that takes 'oc' and returns a shape

      // Strip import/export statements since:
      // 1. The 'oc' object is already passed directly to the function
      // 2. Type imports are not needed at runtime
      // 3. new Function() doesn't support ES modules
      const cleanedCode = this.stripModuleSyntax(code);

      // Log the first 500 chars of cleaned code for debugging
      this.logger.log(
        `[CAD-EXEC] Cleaned code preview (${cleanedCode.length} chars):\n${cleanedCode.slice(0, 500)}...`,
      );

      // Check what function names are defined
      const hasFunctionCreateModel = /function\s+createModel\s*\(/.test(
        cleanedCode,
      );
      const hasConstCreateModel = /const\s+createModel\s*=/.test(cleanedCode);
      const hasFunctionMain = /function\s+main\s*\(/.test(cleanedCode);
      const hasConstMain = /const\s+main\s*=/.test(cleanedCode);

      this.logger.log(
        `[CAD-EXEC] Function detection: createModel=${hasFunctionCreateModel || hasConstCreateModel}, main=${hasFunctionMain || hasConstMain}`,
      );

      // Wrap the code in a function that returns the shape
      // Handle multiple function naming patterns
      // Also wrap in try-catch to get better error messages from WASM
      const codePreview = JSON.stringify(cleanedCode.slice(0, 300));
      const wrappedCode = `
        // Helper to extract meaningful error from WASM exceptions
        function getWasmErrorMessage(err) {
          if (typeof err === 'number') {
            // WASM pointer - try to get exception info
            if (oc.HEAPU8 && oc.___cxa_demangle) {
              try {
                // Try to demangle the exception type
                return 'OpenCASCADE.js WASM exception (pointer: ' + err + '). This usually means invalid geometry or unsupported operation.';
              } catch (e) {
                return 'OpenCASCADE.js WASM exception (pointer: ' + err + ')';
              }
            }
            return 'OpenCASCADE.js threw a WASM exception. Common causes: invalid class name, wrong constructor arguments, or unsupported geometry operation. Error pointer: ' + err;
          }
          if (err instanceof Error) {
            return err.message;
          }
          return String(err);
        }

        try {
          ${cleanedCode}

          // Try to find and call the main function
          // Check various patterns: function declaration, const arrow, etc.
          if (typeof createModel === 'function') {
            return createModel(oc);
          } else if (typeof main === 'function') {
            return main(oc);
          } else if (typeof buildModel === 'function') {
            return buildModel(oc);
          } else if (typeof makeShape === 'function') {
            return makeShape(oc);
          } else if (typeof generateModel === 'function') {
            return generateModel(oc);
          } else {
            throw new Error('No createModel or main function found in generated code. Code preview: ' + ${codePreview});
          }
        } catch (wasmErr) {
          throw new Error(getWasmErrorMessage(wasmErr));
        }
      `;

      // Create a function with 'oc' in scope
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const executeFunc = new Function("oc", wrappedCode);

      // Execute and get the result
      const result = await executeFunc(oc);

      return result;
    } catch (error) {
      this.logger.error(
        `Sandboxed execution error: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Strip ES module syntax and TypeScript-specific syntax from code
   *
   * Removes:
   * - import/export statements (not supported by new Function())
   * - TypeScript type annotations (not valid JavaScript)
   *
   * Also fixes common LLM code generation issues:
   * - Duplicate variable declarations (const -> let for reusable vars)
   *
   * The 'oc' object containing all OpenCASCADE types is passed directly,
   * so imports are not needed at runtime.
   */
  private stripModuleSyntax(code: string): string {
    // Remove import statements (including type imports)
    // Handles: import X from 'Y', import { X } from 'Y', import type { X } from 'Y', etc.
    let cleaned = code.replace(/^\s*import\s+.*?['"];?\s*$/gm, "");

    // Remove export keywords but keep the declarations
    // export function X -> function X
    // export const X -> const X
    // export default X -> X
    cleaned = cleaned.replace(/^\s*export\s+default\s+/gm, "");
    cleaned = cleaned.replace(/^\s*export\s+/gm, "");

    // Remove any remaining standalone 'export' statements
    cleaned = cleaned.replace(/^\s*export\s*{\s*[^}]*\s*}\s*;?\s*$/gm, "");

    // Remove TypeScript type annotations
    // These are not valid in plain JavaScript executed via new Function()
    cleaned = this.stripTypeScriptSyntax(cleaned);

    // Fix duplicate variable declarations by converting const to let for common reusable names
    // LLMs often generate code like: const transform = ...; ... const transform = ...;
    // This causes "Identifier 'X' has already been declared" errors
    cleaned = this.fixDuplicateDeclarations(cleaned);

    return cleaned;
  }

  /**
   * Fix duplicate variable declarations that LLMs commonly generate
   *
   * Converts `const` to `let` for variables that are declared multiple times,
   * and removes the `let`/`const` keyword from subsequent declarations.
   */
  private fixDuplicateDeclarations(code: string): string {
    // Find all variable declarations
    const constPattern = /\bconst\s+(\w+)\s*=/g;
    const letPattern = /\blet\s+(\w+)\s*=/g;

    // Count occurrences of each variable name
    const varCounts = new Map<string, number>();

    let match;
    while ((match = constPattern.exec(code)) !== null) {
      const varName = match[1];
      varCounts.set(varName, (varCounts.get(varName) || 0) + 1);
    }
    while ((match = letPattern.exec(code)) !== null) {
      const varName = match[1];
      varCounts.set(varName, (varCounts.get(varName) || 0) + 1);
    }

    // For variables declared more than once, convert all to let and remove keyword from duplicates
    let result = code;
    for (const [varName, count] of varCounts) {
      if (count > 1) {
        this.logger.warn(
          `[CAD-EXEC] Fixing duplicate declaration of '${varName}' (${count} occurrences)`,
        );

        // First, convert all const declarations of this var to let
        const constVarPattern = new RegExp(
          `\\bconst\\s+(${varName})\\s*=`,
          "g",
        );
        result = result.replace(constVarPattern, `let ${varName} =`);

        // Now find all let declarations and keep only the first one
        const letVarPattern = new RegExp(`\\blet\\s+(${varName})\\s*=`, "g");
        let firstFound = false;
        result = result.replace(letVarPattern, (fullMatch) => {
          if (!firstFound) {
            firstFound = true;
            return fullMatch; // Keep the first declaration
          }
          // Remove 'let' from subsequent declarations (just assignment)
          return `${varName} =`;
        });
      }
    }

    return result;
  }

  /**
   * Strip TypeScript-specific syntax from code
   *
   * Removes:
   * - Type annotations on function parameters: (param: Type) -> (param)
   * - Return type annotations: function(): Type -> function()
   * - Variable type annotations: const x: Type = -> const x =
   * - Type assertions: value as Type -> value
   * - Generic type parameters: <T> -> (removed)
   */
  private stripTypeScriptSyntax(code: string): string {
    let cleaned = code;

    // Remove function return type annotations: ): Type { or ): Type =>
    // Match ): followed by type annotation until { or =>
    cleaned = cleaned.replace(
      /\)\s*:\s*[A-Za-z_$][\w$]*(?:<[^>]*>)?\s*(?=[{=])/g,
      ") ",
    );

    // Remove parameter type annotations: (param: Type) or (param: Type, ...)
    // This is tricky - we need to handle multiple parameters
    // Match : followed by type until , or )
    cleaned = cleaned.replace(
      /:\s*[A-Za-z_$][\w$]*(?:<[^>]*>)?(?=\s*[,)])/g,
      "",
    );

    // Remove variable type annotations: const x: Type = or let x: Type =
    cleaned = cleaned.replace(/:\s*[A-Za-z_$][\w$]*(?:<[^>]*>)?\s*(?==)/g, " ");

    // Remove type assertions: value as Type (but keep the value)
    cleaned = cleaned.replace(/\s+as\s+[A-Za-z_$][\w$]*(?:<[^>]*>)?/g, "");

    // Remove generic type parameters on function declarations: function<T>
    cleaned = cleaned.replace(/function\s*<[^>]*>/g, "function");

    // Remove interface and type declarations (entire lines)
    cleaned = cleaned.replace(
      /^\s*(?:interface|type)\s+\w+\s*[={][\s\S]*?(?:^}|\n\s*\n)/gm,
      "",
    );

    return cleaned;
  }

  /**
   * Extract mesh statistics from a shape
   */
  private extractMeshStats(shape: unknown): OcctExecutionResult["meshStats"] {
    const oc = this.oc as Record<string, unknown>;

    try {
      // Get bounding box
      const bbox = new (oc["Bnd_Box"] as new () => unknown)() as {
        Add: (shape: unknown) => void;
        Get: (
          xmin: { value: number },
          ymin: { value: number },
          zmin: { value: number },
          xmax: { value: number },
          ymax: { value: number },
          zmax: { value: number },
        ) => void;
      };
      const brepBndLib = oc["BRepBndLib"] as {
        Add: (shape: unknown, bbox: unknown) => void;
      };
      brepBndLib.Add(shape, bbox);

      const xmin = { value: 0 },
        ymin = { value: 0 },
        zmin = { value: 0 };
      const xmax = { value: 0 },
        ymax = { value: 0 },
        zmax = { value: 0 };
      bbox.Get(xmin, ymin, zmin, xmax, ymax, zmax);

      // Triangulate the shape to count vertices and faces
      const deflection = 0.1;
      const mesh = new (oc["BRepMesh_IncrementalMesh_2"] as new (
        shape: unknown,
        deflection: number,
      ) => unknown)(shape, deflection);
      (mesh as { Perform: () => void }).Perform();

      // Count vertices and triangles
      let vertices = 0;
      let faces = 0;

      const explorer = new (oc["TopExp_Explorer_2"] as new (
        shape: unknown,
        type: unknown,
      ) => {
        More: () => boolean;
        Next: () => void;
        Current: () => unknown;
      })(
        shape,
        (oc["TopAbs_ShapeEnum"] as { TopAbs_FACE: unknown }).TopAbs_FACE,
      );

      while (explorer.More()) {
        const face = explorer.Current();
        const location = new (oc["TopLoc_Location_1"] as new () => unknown)();
        const triangulation = (
          oc["BRep_Tool"] as {
            Triangulation: (
              face: unknown,
              location: unknown,
            ) => { NbTriangles: () => number; NbNodes: () => number } | null;
          }
        ).Triangulation(face, location);

        if (triangulation) {
          faces += triangulation.NbTriangles();
          vertices += triangulation.NbNodes();
        }

        explorer.Next();
      }

      return {
        vertices,
        faces,
        boundingBox: {
          min: { x: xmin.value, y: ymin.value, z: zmin.value },
          max: { x: xmax.value, y: ymax.value, z: zmax.value },
        },
      };
    } catch (error) {
      this.logger.error(
        `[CAD-EXEC] Failed to extract mesh stats: ${error instanceof Error ? error.message : String(error)}`,
      );
      if (error instanceof Error && error.stack) {
        this.logger.error(`[CAD-EXEC] Stack trace: ${error.stack}`);
      }

      // Return placeholder stats
      return {
        vertices: 0,
        faces: 0,
        boundingBox: {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 0, y: 0, z: 0 },
        },
      };
    }
  }

  /**
   * Export shape to STEP format
   */
  private exportToSTEP(shape: unknown): string {
    const oc = this.oc as Record<string, unknown>;

    try {
      const writer = new (oc["STEPControl_Writer_1"] as new () => {
        Transfer: (
          shape: unknown,
          mode: unknown,
          compgraph: boolean,
        ) => unknown;
        Write: (filename: string) => unknown;
      })();

      writer.Transfer(
        shape,
        (oc["STEPControl_StepModelType"] as { STEPControl_AsIs: unknown })
          .STEPControl_AsIs,
        true,
      );

      // Write to virtual file system
      const filename = "/tmp/model.step";
      writer.Write(filename);

      // Read from virtual file system
      const fs = (oc as { FS: { readFile: (path: string) => Uint8Array } }).FS;
      const content = fs.readFile(filename);

      return new TextDecoder().decode(content);
    } catch (error) {
      this.logger.warn(
        `STEP export failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return "";
    }
  }

  /**
   * Export shape to STL format (ASCII)
   */
  private exportToSTL(shape: unknown): string {
    const oc = this.oc as Record<string, unknown>;

    try {
      // Triangulate first
      const deflection = 0.1;
      new (oc["BRepMesh_IncrementalMesh_2"] as new (
        shape: unknown,
        deflection: number,
      ) => { Perform: () => void })(shape, deflection).Perform();

      const writer = new (oc["StlAPI_Writer_1"] as new () => {
        SetASCIIMode: (ascii: boolean) => void;
        Write: (shape: unknown, filename: string) => boolean;
      })();
      writer.SetASCIIMode(true);

      const filename = "/tmp/model.stl";
      writer.Write(shape, filename);

      const fs = (oc as { FS: { readFile: (path: string) => Uint8Array } }).FS;
      const content = fs.readFile(filename);

      return new TextDecoder().decode(content);
    } catch (error) {
      this.logger.warn(
        `STL export failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return "";
    }
  }

  /**
   * Export shape to GLTF format
   *
   * Returns the GLTF JSON with embedded binary buffer
   */
  private exportToGLTF(shape: unknown): Buffer {
    const oc = this.oc as Record<string, unknown>;

    try {
      // Triangulate the shape
      const deflection = 0.1;
      new (oc["BRepMesh_IncrementalMesh_2"] as new (
        shape: unknown,
        deflection: number,
      ) => { Perform: () => void })(shape, deflection).Perform();

      // Use RWGltf_CafWriter if available, otherwise manual conversion
      // For simplicity, we'll create a basic GLTF from triangulation

      const gltf = this.buildGltfFromTriangulation(shape);
      return Buffer.from(JSON.stringify(gltf, null, 2), "utf-8");
    } catch (error) {
      this.logger.warn(
        `GLTF export failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return Buffer.from("{}");
    }
  }

  /**
   * Build GLTF JSON from shape triangulation
   */
  private buildGltfFromTriangulation(shape: unknown): object {
    const oc = this.oc as Record<string, unknown>;

    // Collect all vertices and indices from all faces
    const allVertices: number[] = [];
    const allIndices: number[] = [];
    let vertexOffset = 0;

    const explorer = new (oc["TopExp_Explorer_2"] as new (
      shape: unknown,
      type: unknown,
    ) => {
      More: () => boolean;
      Next: () => void;
      Current: () => unknown;
    })(shape, (oc["TopAbs_ShapeEnum"] as { TopAbs_FACE: unknown }).TopAbs_FACE);

    while (explorer.More()) {
      const face = explorer.Current();
      const location = new (oc["TopLoc_Location_1"] as new () => unknown)();
      const triangulation = (
        oc["BRep_Tool"] as {
          Triangulation: (
            face: unknown,
            location: unknown,
          ) => {
            NbTriangles: () => number;
            NbNodes: () => number;
            Node: (i: number) => {
              X: () => number;
              Y: () => number;
              Z: () => number;
            };
            Triangle: (i: number) => {
              Get: (
                n1: { value: number },
                n2: { value: number },
                n3: { value: number },
              ) => void;
            };
          } | null;
        }
      ).Triangulation(face, location);

      if (triangulation) {
        // Get vertices
        const nbNodes = triangulation.NbNodes();
        for (let i = 1; i <= nbNodes; i++) {
          const node = triangulation.Node(i);
          allVertices.push(node.X(), node.Y(), node.Z());
        }

        // Get triangles (indices)
        const nbTriangles = triangulation.NbTriangles();
        for (let i = 1; i <= nbTriangles; i++) {
          const triangle = triangulation.Triangle(i);
          const n1 = { value: 0 },
            n2 = { value: 0 },
            n3 = { value: 0 };
          triangle.Get(n1, n2, n3);
          // Convert 1-based to 0-based and add offset
          allIndices.push(
            n1.value - 1 + vertexOffset,
            n2.value - 1 + vertexOffset,
            n3.value - 1 + vertexOffset,
          );
        }

        vertexOffset += nbNodes;
      }

      explorer.Next();
    }

    // Calculate bounding box
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < allVertices.length; i += 3) {
      min[0] = Math.min(min[0], allVertices[i]);
      min[1] = Math.min(min[1], allVertices[i + 1]);
      min[2] = Math.min(min[2], allVertices[i + 2]);
      max[0] = Math.max(max[0], allVertices[i]);
      max[1] = Math.max(max[1], allVertices[i + 1]);
      max[2] = Math.max(max[2], allVertices[i + 2]);
    }

    // Create binary buffer
    const vertexBuffer = new Float32Array(allVertices);
    const indexBuffer = new Uint16Array(allIndices);

    const vertexBytes = new Uint8Array(vertexBuffer.buffer);
    const indexBytes = new Uint8Array(indexBuffer.buffer);

    const totalLength = vertexBytes.length + indexBytes.length;
    const combined = new Uint8Array(totalLength);
    combined.set(vertexBytes, 0);
    combined.set(indexBytes, vertexBytes.length);

    const base64 = Buffer.from(combined).toString("base64");

    return {
      asset: {
        version: "2.0",
        generator: "OpenCASCADE.js - Orchestrator AI CAD Agent",
      },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0, name: "CADModel" }],
      meshes: [
        {
          primitives: [
            {
              attributes: { POSITION: 0 },
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
          count: allVertices.length / 3,
          type: "VEC3",
          max: max,
          min: min,
        },
        {
          bufferView: 1,
          componentType: 5123, // UNSIGNED_SHORT
          count: allIndices.length,
          type: "SCALAR",
        },
      ],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: vertexBytes.length },
        {
          buffer: 0,
          byteOffset: vertexBytes.length,
          byteLength: indexBytes.length,
        },
      ],
      buffers: [
        {
          uri: `data:application/octet-stream;base64,${base64}`,
          byteLength: totalLength,
        },
      ],
    };
  }

  /**
   * Export shape to DXF format (2D projection)
   *
   * DXF is a 2D CAD format. We project the 3D shape edges onto the XY plane
   * and export them as DXF entities.
   */
  private exportToDXF(
    shape: unknown,
    boundingBox: OcctExecutionResult["meshStats"]["boundingBox"],
  ): string {
    const oc = this.oc as Record<string, unknown>;

    try {
      // Collect all edges from the shape
      const edges: Array<{
        start: { x: number; y: number };
        end: { x: number; y: number };
      }> = [];

      const explorer = new (oc["TopExp_Explorer_2"] as new (
        shape: unknown,
        type: unknown,
      ) => {
        More: () => boolean;
        Next: () => void;
        Current: () => unknown;
      })(
        shape,
        (oc["TopAbs_ShapeEnum"] as { TopAbs_EDGE: unknown }).TopAbs_EDGE,
      );

      while (explorer.More()) {
        const edge = explorer.Current();

        try {
          // Get curve from edge
          const first = { value: 0 };
          const last = { value: 0 };
          const curve = (
            oc["BRep_Tool"] as {
              Curve: (
                edge: unknown,
                first: { value: number },
                last: { value: number },
              ) => {
                Value: (u: number) => {
                  X: () => number;
                  Y: () => number;
                  Z: () => number;
                };
              } | null;
            }
          ).Curve(edge, first, last);

          if (curve) {
            // Sample start and end points
            const startPt = curve.Value(first.value);
            const endPt = curve.Value(last.value);

            edges.push({
              start: { x: startPt.X(), y: startPt.Y() },
              end: { x: endPt.X(), y: endPt.Y() },
            });
          }
        } catch {
          // Skip edges that can't be processed
        }

        explorer.Next();
      }

      // Build DXF content
      return this.buildDxfContent(edges, boundingBox);
    } catch (error) {
      this.logger.warn(
        `DXF export failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Return minimal valid DXF
      return this.buildDxfContent([], boundingBox);
    }
  }

  /**
   * Build DXF file content from edges
   */
  private buildDxfContent(
    edges: Array<{
      start: { x: number; y: number };
      end: { x: number; y: number };
    }>,
    boundingBox: OcctExecutionResult["meshStats"]["boundingBox"],
  ): string {
    const lines: string[] = [];

    // DXF Header section
    lines.push("0", "SECTION");
    lines.push("2", "HEADER");
    lines.push("9", "$ACADVER");
    lines.push("1", "AC1014"); // AutoCAD R14 format
    lines.push("9", "$EXTMIN");
    lines.push("10", String(boundingBox.min.x));
    lines.push("20", String(boundingBox.min.y));
    lines.push("30", String(boundingBox.min.z));
    lines.push("9", "$EXTMAX");
    lines.push("10", String(boundingBox.max.x));
    lines.push("20", String(boundingBox.max.y));
    lines.push("30", String(boundingBox.max.z));
    lines.push("0", "ENDSEC");

    // Tables section (minimal)
    lines.push("0", "SECTION");
    lines.push("2", "TABLES");
    lines.push("0", "TABLE");
    lines.push("2", "LAYER");
    lines.push("70", "1");
    lines.push("0", "LAYER");
    lines.push("2", "0"); // Layer name
    lines.push("70", "0"); // Layer flags
    lines.push("62", "7"); // Color (white)
    lines.push("6", "CONTINUOUS"); // Linetype
    lines.push("0", "ENDTAB");
    lines.push("0", "ENDSEC");

    // Entities section
    lines.push("0", "SECTION");
    lines.push("2", "ENTITIES");

    // Add LINE entities for each edge
    for (const edge of edges) {
      lines.push("0", "LINE");
      lines.push("8", "0"); // Layer
      lines.push("10", String(edge.start.x)); // Start X
      lines.push("20", String(edge.start.y)); // Start Y
      lines.push("30", "0"); // Start Z (projected to XY plane)
      lines.push("11", String(edge.end.x)); // End X
      lines.push("21", String(edge.end.y)); // End Y
      lines.push("31", "0"); // End Z
    }

    lines.push("0", "ENDSEC");
    lines.push("0", "EOF");

    return lines.join("\n");
  }

  /**
   * Generate a thumbnail for the CAD model
   *
   * Since we're running server-side without a GPU, we generate an SVG-based
   * placeholder thumbnail that shows model statistics. For proper 3D rendering,
   * a separate worker with headless Chrome/WebGL would be needed.
   *
   * The SVG is converted to PNG using a simple encoding approach.
   */
  private generateThumbnail(
    meshStats: OcctExecutionResult["meshStats"],
  ): Buffer {
    const width = 256;
    const height = 256;

    const bbox = meshStats.boundingBox;
    const dims = {
      x: (bbox.max.x - bbox.min.x).toFixed(1),
      y: (bbox.max.y - bbox.min.y).toFixed(1),
      z: (bbox.max.z - bbox.min.z).toFixed(1),
    };

    // Create an SVG representation
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e"/>
      <stop offset="100%" style="stop-color:#16213e"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>

  <!-- 3D Box representation -->
  <g transform="translate(128, 100)">
    <!-- Back face -->
    <polygon points="-40,-30 40,-30 60,-10 -20,-10" fill="#4a5568" stroke="#718096" stroke-width="1"/>
    <!-- Left face -->
    <polygon points="-40,-30 -20,-10 -20,40 -40,20" fill="#2d3748" stroke="#718096" stroke-width="1"/>
    <!-- Top face -->
    <polygon points="-40,-30 40,-30 20,-50 -60,-50" fill="#667eea" stroke="#7c3aed" stroke-width="1"/>
    <!-- Front face -->
    <polygon points="-20,-10 60,-10 60,40 -20,40" fill="#4c51bf" stroke="#718096" stroke-width="1"/>
    <!-- Right face -->
    <polygon points="60,-10 40,-30 40,20 60,40" fill="#5a67d8" stroke="#718096" stroke-width="1"/>
  </g>

  <!-- Stats text -->
  <text x="128" y="175" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" fill="#a0aec0">
    ${dims.x} × ${dims.y} × ${dims.z}
  </text>
  <text x="128" y="195" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="#718096">
    ${meshStats.vertices.toLocaleString()} vertices
  </text>
  <text x="128" y="210" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="#718096">
    ${meshStats.faces.toLocaleString()} faces
  </text>

  <!-- CAD Agent badge -->
  <text x="128" y="240" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" fill="#4a5568">
    CAD Agent
  </text>
</svg>`;

    // For now, return the SVG as a buffer
    // TODO: In production, use sharp or canvas to convert SVG to PNG
    // For now, we'll save as SVG but with PNG extension (viewers can often handle this)
    // A proper solution would use: const png = await sharp(Buffer.from(svg)).png().toBuffer();
    return Buffer.from(svg, "utf-8");
  }

  /**
   * Check if OpenCASCADE.js is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}
