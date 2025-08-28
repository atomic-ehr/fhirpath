**Analyzer (src/analyzer.ts) – Code Review**

- **Scope:** Static analysis of `src/analyzer.ts`
- **Goal:** Identify two priority refactorings to reduce complexity and duplication while improving correctness and maintainability.

**Priority 1: Decompose analyzeFunction into cohesive helpers**
- **Problem:** `analyzeFunction` mixes responsibilities: resolution, arity checks, special union-type validations (ofType/is/as), argument analysis with differing contexts, signature matching, empty-propagation, result inference, and ad‑hoc special cases (e.g., `where`). This inflates cognitive complexity and makes behavior hard to reason about and test.
- **Symptoms (examples):**
  - Argument analysis loop handles three branches (type reference vs expression vs normal) and multiple early returns for cursor mode.
  - Duplicated checks for empty input/args and signature‑based validation.
  - Interleaved diagnostics construction with control flow.
- **Refactoring Plan:** Extract well‑named helpers and linearize control flow.
  - `resolveFunctionDefinition(node): FunctionDefinition | Diagnostic[]`
  - `validateArity(funcDef, node): Diagnostic[]`
  - `analyzeArguments(funcDef, node, context): { argTypes: TypeInfo[], diags: Diagnostic[] }`
  - `checkTypeSpecificRules(funcDef, node, context, argTypes): Diagnostic[]` (handles ofType/is/as pre‑analysis validation)
  - `matchSignature(funcDef, inputType, argTypes): FunctionSignature | null`
  - `diagnoseSignatureMismatch(funcDef, inputType, argTypes, node): Diagnostic[]`
  - `propagatesEmpty(funcDef, inputType, argTypes): boolean` (uses utils, see Priority 2)
  - `inferResultType(funcDef, node, context, argTypes, matchingSig): TypeInfo`
  - Keep the top‑level method as a thin orchestration that calls the helpers in order and returns early on cursor stop/empty propagation.
- **Benefits:**
  - Lower cognitive complexity, easier to test each rule in isolation.
  - Clearer error paths; simpler to add functions/signatures without regressions.
  - Enables reuse from operation‑specific analyzers if needed.
- **Acceptance Criteria:**
  - `analyzeFunction` < ~60 LOC, primarily orchestration.
  - New helpers covered by unit tests for: arity errors, empty propagation, signature mismatch, permissive boolean functions, and type‑reference params.
  - No behavior regressions in existing tests (`bun run test`).

**Priority 2: Centralize union/emptiness/type-check logic**
- **Problem:** Repeated patterns for union‑type handling and emptiness checks cause inconsistency and drift.
  - Union checks repeated in `analyzeFunction` (ofType/is/as), `analyzeMembershipTest`, and `analyzeTypeCast`.
  - Emptiness detection is hand‑rolled (`type === 'Any' && !singleton` / `isEmpty`) despite `isEmptyCollection` utility being available.
  - Diagnostics sometimes hand‑crafted; others use `Errors` factory → inconsistent codes/messages.
- **Refactoring Plan:** Move common logic into `analysis/utils` and use consistently.
  - Add `isUnionType(type: TypeInfo): boolean` and `getUnionChoices(type: TypeInfo): string[]`.
  - Add `validateUnionChoice(type: TypeInfo, target: string, nodeRange, code): Diagnostic | null` to build a warning for invalid union member checks/casts.
  - Replace all manual emptiness tests with `isEmptyCollection(type)`.
  - Prefer `toDiagnostic(Errors.*)` for standardized diagnostics where applicable (e.g., unknown operator/function/property) to unify codes and phrasing.
- **Touchpoints:**
  - `analyzeFunction` (pre‑analysis for ofType/is/as), `analyzeMembershipTest`, `analyzeTypeCast`, `analyzeIdentifier` (unknown property warnings).
- **Benefits:**
  - Single source of truth for union semantics and “empty propagates” logic.
  - Consistent diagnostics across analyzer paths; easier to evolve.
- **Acceptance Criteria:**
  - No direct `type === 'Any' && !singleton` checks remain; use `isEmptyCollection`.
  - All union presence warnings use the shared helper; messages and codes are uniform.
  - `NodeType` enum used consistently (avoid raw string literals like `'TypeOrIdentifier'`).

**Quick Wins (Optional, post‑priority):**
- Add a small `safeAnalyze(node, ctx)` wrapper that merges diagnostics and short‑circuits on `stoppedAtCursor`, removing repeated early returns.
- Use a tiny formatter for type names (`formatType`) everywhere to avoid hand‑built strings.

