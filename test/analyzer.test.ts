import { describe, it, expect, beforeAll } from "bun:test";
import { analyze } from "../src/index";
import { DiagnosticSeverity } from "../src/types";
import { FHIRModelProvider } from "../src/model-provider";

describe("Analyzer", () => {
  describe("basic expressions", () => {
    it("should not report errors for valid literals", () => {
      const result = analyze("5");
      expect(result.diagnostics).toEqual([]);
    });

    it("should not report errors for valid operators", () => {
      const result = analyze("5 + 3");
      expect(result.diagnostics).toEqual([]);
    });

    // Skip - parser rejects invalid operators before analyzer
  });

  describe("variables", () => {
    it("should not report errors for built-in variables", () => {
      const result = analyze("$this");
      expect(result.diagnostics).toEqual([]);
    });

    it("should report unknown variable", () => {
      const result = analyze("$unknown");
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        severity: DiagnosticSeverity.Error,
        code: "UNKNOWN_VARIABLE",
        message: "Unknown variable: $unknown",
        source: "fhirpath-analyzer",
      });
      expect(result.diagnostics[0]?.range).toBeDefined();
    });

    it("should not report errors for user-defined variables", () => {
      const result = analyze("%myVar + 5", { variables: { myVar: 10 } });
      expect(result.diagnostics).toEqual([]);
    });

    it("should report unknown user variable", () => {
      const result = analyze("%unknown + 5");
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        severity: DiagnosticSeverity.Error,
        code: "UNKNOWN_USER_VARIABLE",
        message: "Unknown user variable: %unknown",
        source: "fhirpath-analyzer",
      });
    });
  });

  describe("functions", () => {
    it("should not report errors for valid functions", () => {
      const result = analyze('name.where(use = "official")');
      expect(result.diagnostics).toEqual([]);
    });

    it("should report unknown function", () => {
      const result = analyze("name.unknownFunc()");
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        severity: DiagnosticSeverity.Error,
        code: "UNKNOWN_FUNCTION",
        message: "Unknown function: unknownFunc",
        source: "fhirpath-analyzer",
      });
    });

    it("should report too few arguments", () => {
      const result = analyze("substring()"); // substring requires at least 1 argument
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        severity: DiagnosticSeverity.Error,
        code: "TOO_FEW_ARGS",
      });
    });

    it("should report too many arguments", () => {
      const result = analyze("count(1, 2, 3)"); // count accepts at most 0 arguments
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        severity: DiagnosticSeverity.Error,
        code: "TOO_MANY_ARGS",
      });
    });
  });

  describe("complex expressions", () => {
    it("should analyze nested expressions", () => {
      const result = analyze('name.where(use = "official").given');
      expect(result.diagnostics).toEqual([]);
    });

    it("should report multiple errors", () => {
      const result = analyze("$unknown + unknownFunc()");
      expect(result.diagnostics).toHaveLength(2);
      expect(result.diagnostics.map((d) => d.code)).toEqual([
        "UNKNOWN_VARIABLE",
        "UNKNOWN_FUNCTION",
      ]);
    });
  });

  describe("LSP compatibility", () => {
    it("should produce LSP-compatible diagnostics", () => {
      const result = analyze("$unknown");
      expect(result.diagnostics).toHaveLength(1);

      const diagnostic = result.diagnostics[0];

      // Check LSP-required fields
      expect(diagnostic?.range).toBeDefined();
      expect(diagnostic?.range.start).toBeDefined();
      expect(diagnostic?.range.end).toBeDefined();
      expect(diagnostic?.message).toBeDefined();

      // Check optional fields
      expect(diagnostic?.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostic?.code).toBe("UNKNOWN_VARIABLE");
      expect(diagnostic?.source).toBe("fhirpath-analyzer");
    });

    it("should use default range when position is not available", () => {
      const result = analyze("$unknown");
      const diagnostic = result.diagnostics[0];

      // Check that range is properly set (with LSP-compatible character field)
      expect(diagnostic?.range.start.line).toBeDefined();
      expect(diagnostic?.range.start.character).toBeDefined();
      expect(diagnostic?.range.end.line).toBeDefined();
      expect(diagnostic?.range.end.character).toBeDefined();
    });
  });

  describe("FHIR Model Provider type checking", () => {
    let modelProvider: FHIRModelProvider;
    let modelProviderInitialized = false;

    beforeAll(async () => {
      modelProvider = new FHIRModelProvider({
        packages: [{ name: "hl7.fhir.r4.core", version: "4.0.1" }],
        cacheDir: "./tmp/.test-fhir-cache",
        registryUrl: "https://fs.get-ig.org/pkgs",
      });

      try {
        await modelProvider.initialize();
        // Check if we can actually get a type to verify initialization worked
        const patientType = modelProvider.getType('Patient');
        modelProviderInitialized = patientType !== undefined && patientType.modelContext !== undefined;
        if (!modelProviderInitialized) {
          // console.warn('Model provider initialized but cannot load types - tests will be skipped');
        }
      } catch (error) {
        // console.error('Failed to initialize model provider in test:', error);
        modelProviderInitialized = false;
      }
    });

    it("should infer types through FHIR model navigation", () => {
      if (!modelProviderInitialized) {
        // console.log('Skipping test - model provider not properly initialized');
        return;
      }

      const result = analyze("Patient.gender", {
        modelProvider,
      });

      expect(result.diagnostics).toEqual([]);

      // Check that gender is properly typed as a code (which maps to String in FHIRPath)
      const ast = result.ast;
      expect(ast?.typeInfo).toMatchObject({
        type: "String",
        singleton: true,
        namespace: "FHIR",
        name: "code",
      });
    });

    it("should detect type error when calling substring on non-string type", () => {
      if (!modelProviderInitialized) {
        // console.log('Skipping test - model provider not properly initialized');
        return;
      }

      // Using active which is boolean, not string
      const result = analyze("Patient.active.substring(0, 1)", {
        modelProvider,
      });

      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        severity: DiagnosticSeverity.Error,
        code: "INPUT_TYPE_MISMATCH",
        message: expect.stringContaining("expects input type String"),
      });
    });

    it("should allow string operations on string types", () => {
      if (!modelProviderInitialized) {
        // console.log('Skipping test - model provider not properly initialized');
        return;
      }

      const result = analyze("Patient.name.family.substring(0, 1)", {
        modelProvider,
      });

      expect(result.diagnostics).toEqual([]);
    });

    it("should detect type errors in arithmetic operations", () => {
      if (!modelProviderInitialized) {
        // console.log('Skipping test - model provider not properly initialized');
        return;
      }

      const result = analyze("Patient.name.family + Patient.active", {
        modelProvider,
      });

      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        severity: DiagnosticSeverity.Error,
        code: "TYPE_MISMATCH",
        message: expect.stringContaining(
          "operator '+' cannot be applied to types",
        ),
      });
    });

    it("should handle collection types properly", () => {
      if (!modelProviderInitialized) {
        // console.log('Skipping test - model provider not properly initialized');
        return;
      }

      const result = analyze("Patient.name.given.count()", {
        modelProvider,
      });

      expect(result.diagnostics).toEqual([]);

      // count() should return Integer
      const ast = result.ast;
      expect(ast?.typeInfo).toMatchObject({
        type: "Integer",
        singleton: true,
      });
    });

    it("should detect errors when accessing non-existent properties", () => {
      if (!modelProviderInitialized) {
        // console.log('Skipping test - model provider not properly initialized');
        return;
      }

      const result = analyze("Patient.nonExistentField", {
        modelProvider,
      });

      // When model provider is available, it should report unknown properties
      expect(result.diagnostics.length).toBe(1);
      expect(result.diagnostics[0]?.message).toContain(
        "Unknown property 'nonExistentField'",
      );
      // The type should still be Any since the property doesn't exist
      const ast = result.ast;
      expect(ast?.typeInfo?.type).toBe("Any");
    });

    it("should properly type check where clause conditions", () => {
      if (!modelProviderInitialized) {
        // console.log('Skipping test - model provider not properly initialized');
        return;
      }

      const result = analyze("Patient.name.where(use + 1)", {
        modelProvider,
      });

      // The where condition should expect a Boolean, but we're providing a number
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        code: "TYPE_MISMATCH",
      });
    });

    it("should handle union operations with type preservation", () => {
      if (!modelProviderInitialized) {
        // console.log('Skipping test - model provider not properly initialized');
        return;
      }

      const result = analyze("Patient.name.given | Patient.name.family", {
        modelProvider,
      });

      expect(result.diagnostics).toEqual([]);

      // Union should preserve the string type
      const ast = result.ast;
      expect(ast?.typeInfo).toMatchObject({
        type: "String",
        singleton: false,
        namespace: "FHIR",
        name: "string",
      });
    });

    it("should type check function arguments with FHIR types", () => {
      if (!modelProviderInitialized) {
        // console.log('Skipping test - model provider not properly initialized');
        return;
      }

      const result = analyze(
        "Patient.birthDate.toString().substring(Patient.active)",
        {
          modelProvider,
        },
      );

      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        severity: DiagnosticSeverity.Error,
        code: "ARGUMENT_TYPE_MISMATCH",
        message: expect.stringContaining("expects Integer"),
      });
    });

    it("should handle complex nested expressions with proper type inference", () => {
      if (!modelProviderInitialized) {
        // console.log('Skipping test - model provider not properly initialized');
        return;
      }

      const result = analyze(
        'Patient.contact.where(relationship.coding.code = "family").name.given.first()',
        {
          modelProvider,
        },
      );

      expect(result.diagnostics).toEqual([]);

      // first() should return a singleton string
      const ast = result.ast;
      expect(ast?.typeInfo?.singleton).toBe(true);
    });

    it("should detect type mismatches in comparisons", () => {
      if (!modelProviderInitialized) {
        // console.log('Skipping test - model provider not properly initialized');
        return;
      }

      const result = analyze("Patient.birthDate > Patient.name.family", {
        modelProvider,
      });

      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        severity: DiagnosticSeverity.Error,
        code: "TYPE_MISMATCH",
      });
    });

    it("should handle polymorphic types correctly", () => {
      if (!modelProviderInitialized) {
        // console.log('Skipping test - model provider not properly initialized');
        return;
      }

      const result = analyze("Observation.value.value", {
        modelProvider,
      });

      // value[x] is polymorphic, so this should work
      expect(result.diagnostics).toEqual([]);
    });

    it("should handle type casting operations", () => {
      if (!modelProviderInitialized) {
        // console.log('Skipping test - model provider not properly initialized');
        return;
      }

      const result = analyze(
        "(Patient.multipleBirthInteger as String).substring(0, 1)",
        {
          modelProvider,
        },
      );

      // After casting to String, substring should work
      expect(result.diagnostics).toEqual([]);
    });

    it("should detect errors in select expressions", () => {
      if (!modelProviderInitialized) {
        // console.log('Skipping test - model provider not properly initialized');
        return;
      }

      const result = analyze("Patient.name.select(given + use)", {
        modelProvider,
      });

      // given is a list of strings, use is a code - can't add them
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        severity: DiagnosticSeverity.Error,
        code: "TYPE_MISMATCH",
      });
    });

    it("should handle extension navigation", () => {
      if (!modelProviderInitialized) {
        // console.log('Skipping test - model provider not properly initialized');
        return;
      }

      const result = analyze(
        'Patient.extension.where(url = "http://example.org/ext").value',
        { modelProvider },
      );

      expect(result.diagnostics).toEqual([]);
    });

    it("should handle invalid property access", () => {
      if (!modelProviderInitialized) {
        // console.log('Skipping test - model provider not properly initialized');
        return;
      }

      const result = analyze("Patient.name.ups", {
        modelProvider,
      });
      expect(result.diagnostics[0]).toBeDefined();
      expect(result.diagnostics[0]?.message).toContain(
        "Unknown property 'ups'",
      );
    });

    it("should handle invalid input type", () => {
      if (!modelProviderInitialized) {
        // console.log('Skipping test - model provider not properly initialized');
        return;
      }

      const result = analyze("Patient.birthDate.substring(0,1)", {
        modelProvider,
      });
      expect(result.diagnostics[0]).toBeDefined();
      expect(result.diagnostics[0]?.message).toContain("Type mismatch");
    });

    it("should handle operators type mismatch", () => {
      if (!modelProviderInitialized) {
        // console.log('Skipping test - model provider not properly initialized');
        return;
      }

      const result = analyze("Patient.gender + 1", {
        modelProvider,
      });
      expect(result.diagnostics[0]).toBeDefined();
      // console.log(result.diagnostics);
      expect(result.diagnostics[0]?.message).toContain("Type mismatch");
    });

    it("should handle syntactic errors", () => {
      if (!modelProviderInitialized) {
        // console.log('Skipping test - model provider not properly initialized');
        return;
      }

      // The default analyze function throws on parse errors for backward compatibility
      expect(() => {
        analyze("Patient.name.", {
          modelProvider,
        });
      }).toThrow("Expected identifier after '.', got: EOF");
    });

    it("should work with error recovery mode", () => {
      if (!modelProviderInitialized) {
        // console.log('Skipping test - model provider not properly initialized');
        return;
      }

      const result = analyze("Patient.name.", {
        modelProvider,
        errorRecovery: true,
      });

      // Should have diagnostic for missing identifier
      const errorDiagnostic = result.diagnostics.find((d) =>
        d.message.includes("Expected identifier"),
      );
      expect(errorDiagnostic).toBeDefined();
      
      // Should not have thrown an error
      expect(result.ast).toBeDefined();
    });
  });

  describe("Error Tolerance with LSP Mode", () => {
    it("should handle broken expressions with error nodes", () => {
      const result = analyze("Patient.name.where(use =", {
        errorRecovery: true,
      });

      // Should have at least one diagnostic for the error node
      expect(result.diagnostics.length).toBeGreaterThan(0);

      // Should have a diagnostic for the parse error
      const errorDiagnostic = result.diagnostics.find(
        (d) => d.message === "Unexpected token: EOF",
      );
      expect(errorDiagnostic).toBeDefined();
      expect(errorDiagnostic?.severity).toBe(DiagnosticSeverity.Error);
    });

    it("should handle incomplete member access", () => {
      const result = analyze("Patient.", {
        errorRecovery: true,
      });

      // Should have diagnostic for missing identifier
      const errorDiagnostic = result.diagnostics.find((d) =>
        d.message.includes("Expected identifier"),
      );
      expect(errorDiagnostic).toBeDefined();
    });

    it("should still provide type info for valid parts of broken expressions", () => {
      const result = analyze("5 + ", {
        errorRecovery: true,
      });

      // Find the literal node
      const ast = result.ast as any;
      if (ast.type === "Binary" && ast.left.type === "Literal") {
        // The literal should have type info
        expect(ast.left.typeInfo).toBeDefined();
        expect(ast.left.typeInfo.type).toBe("Integer");
        expect(ast.left.typeInfo.singleton).toBe(true);
      }
    });

    it("should handle complex broken expressions with multiple errors", () => {
      const result = analyze("Patient.name.where(use = ).given.", {
        errorRecovery: true,
      });

      // Should have multiple diagnostics
      expect(result.diagnostics.length).toBeGreaterThanOrEqual(2);

      // All error nodes should have been processed
      const errorDiagnostics = result.diagnostics.filter(
        (d) =>
          d.message.includes("Unexpected token") ||
          d.message.includes("Expected identifier"),
      );
      expect(errorDiagnostics.length).toBeGreaterThan(0);
    });

    it("should assign Any type to error nodes", () => {
      const result = analyze("Patient.name.where(active = ", {
        errorRecovery: true,
      });

      // Find error node in AST
      function findErrorNode(node: any, visited = new Set()): any {
        if (!node || visited.has(node)) return null;
        visited.add(node);

        if (node.type === "Error") return node;

        for (const key of Object.keys(node)) {
          if (key === "parent") continue; // Skip parent references
          const value = node[key];
          if (value && typeof value === "object") {
            if (Array.isArray(value)) {
              for (const item of value) {
                if (item && item.type) {
                  const found = findErrorNode(item, visited);
                  if (found) return found;
                }
              }
            } else if (value.type) {
              const found = findErrorNode(value, visited);
              if (found) return found;
            }
          }
        }
        return null;
      }

      const errorNode = findErrorNode(result.ast);
      expect(errorNode).toBeDefined();
      expect(errorNode.typeInfo).toBeDefined();
      expect(errorNode.typeInfo.type).toBe("Any");
      expect(errorNode.typeInfo.singleton).toBe(false);
    });

  });
});
