## Public API Review: src/index.ts

- Bold: Boxing consistency and variable handling
  - Issue: `evaluate()` sets `$this` to `boxedInput` but still calls `Interpreter.evaluate(...)` with raw `input`, and `%context`/`%resource`/`%rootResource` are initialized from raw `input`. Variables are not boxed when a `modelProvider` is present. This yields mixed raw/boxed states and can drop `typeInfo` for root and variable values.
  - Improve: Pass boxed values end-to-end; unbox only at the API boundary.
    - Create the context with `boxedInput`: `RuntimeContextManager.create(boxedInput)` so system vars carry typeInfo.
    - Set `$this` to `boxedInput` (already done) and also pass `boxedInput` as `input` to `Interpreter.evaluate(...)` for consistent root typing.
    - When `modelProvider` exists, box variable values that look like FHIR resources (per element if arrays) using `modelProvider.getType(resourceType)`; leave primitives as-is (interpreter will box them without typeInfo).
    - Keep return path the same: unbox results and format temporals before returning from `evaluate()`.
  - Rationale: Preserves `typeInfo` for `is`/`as` and model-aware navigation, and keeps `%context`/`%resource`/user vars consistent with the root input.
  - Example changes:
    - `const context = RuntimeContextManager.create(boxedInput);`
    - `const result = await interpreter.evaluate(analysisResult.ast, boxedInput, context);`
    - Variables: if value has `resourceType`, `const ti = await modelProvider.getType(value.resourceType); ctx = setVariable(ctx, key, box(value, ti));`
  - Status: Implemented in `src/index.ts`; tests in `test/index/index.boxing.test.ts` validate root vs variable parity and primitives.

- Bold: Error handling and diagnostics consistency
  - Issue: `evaluate()` filters diagnostics using `severity === 1` (magic number) and mixes thrown types (`FHIRPathError` vs `Error`). Parse error mapping relies on brittle message parsing (`includes('Unexpected token')`).
  - Improve: Use `DiagnosticSeverity.Error`, avoid message parsing, and standardize on `FHIRPathError` with `ErrorCodes` for both parse and analysis failures.
  - Example:
    - `const errors = analysisResult.diagnostics.filter(d => d.severity === DiagnosticSeverity.Error);`
    - Map parser errors to structured codes (extend parser to emit codes if needed) and throw `new FHIRPathError(code, message, range)` consistently.
  - Status: Implemented
    - `src/index.ts`: uses `DiagnosticSeverity.Error`; always throws `FHIRPathError` (defaults to `FP6005` if code missing).
    - `src/analyzer.ts`: added missing codes for unknown node type (`FP1006`), error nodes and invalid function name (`FP5003`).
    - Tests: `test/index/index.errors.test.ts`; updated expectations in `test-cases/errors/variable-errors.json` (redefinition → `FP6009`).

- Bold: Move orchestration into core (Interpreter/Analyzer)
  - Issue: `index.ts` orchestrates parse → analyze → interpret, context bootstrapping (temporal caches, `$this`, variables), boxing policy, and parse-error mapping. This couples policy with the public surface and violates single-responsibility.
  - Improve: Shift orchestration to core components and keep `index.ts` as a thin facade.
    - Interpreter: add `evaluateExpression()` that performs parse → analyze → interpret and owns runtime bootstrapping (boxing, temporal caches, `$this`).
    - Analyzer: add `analyzeExpression()` that parses with optional error recovery and returns `AnalysisResult` with structured diagnostics.
    - RuntimeContextManager: add `bootstrapContext(input, { modelProvider, variables, now })` to centralize context creation and temporal caching.
    - Parser/Errors: emit structured parse error codes; avoid message parsing downstream.
  - Execution plan:
    1) Add `RuntimeContextManager.bootstrapContext(input, { modelProvider, variables, now })` and move temporal caching + `$this` there.
    2) Consolidate boxing policy into `bootstrapContext` (box root and variable FHIR resources when `modelProvider` exists).
    3) Implement `Analyzer.analyzeExpression(expr, opts)` using `Parser` and returning `AnalysisResult` (support `errorRecovery`).
    4) Implement `Interpreter.evaluateExpression(expr, opts)` that calls analyzer’s method, builds context via `bootstrapContext`, then `evaluate()`; unbox/format output if requested.
    5) Refactor `index.ts`:
       - `evaluate()` delegates to `Interpreter.evaluateExpression()`; keep signature and output formatting for backward compatibility.
       - `analyze()` delegates to `Analyzer.analyzeExpression()` and uses `DiagnosticSeverity.Error`.
    6) Standardize error throwing to `FHIRPathError` with `ErrorCodes` for both parse and analysis paths.
    7) Add tests: context bootstrap (temporal caches stable), boxed variables, and delegation from `index.ts`.
  - Status: Pending — plan agreed; not yet executed. Index remains the orchestration façade until core APIs are introduced.
