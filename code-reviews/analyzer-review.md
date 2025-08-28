# Analyzer (src/analyzer.ts) — Code Review

## Summary

- The analyzer is feature-rich and aligns with the registry/type-compat design, but contains duplicated validation logic, a few correctness risks (notably around `|` and expression-parameter context), and opportunities to simplify via helper utilities and signature-driven flows.
- Key improvements: unify signature/param checks, fix expression-parameter context, compute proper union result types, centralize union/type utilities, and make completion (cursor) expectations signature-aware.

## Code Duplication

- Argument/type checks repeated (3 places):
  - analyzeFunction: “no matching signature” branches replicate parameter checking and diagnostics generation (lines ~414–520 and ~555–606).
  - Same comparison logic (type/singleton matches, empty propagation warnings) appears multiple times.
  - Recommendation: extract helpers:
    - `formatType(t: TypeInfo): string`
    - `checkParamTypes(sig, argTypes, nodes, opts): Diagnostic[]`
    - `isEmptyCollection(t: TypeInfo): boolean`

- Union-type validation repeated:
  - In analyzeFunction (pre-custom analyze) for `ofType/is/as`, in analyzeMembershipTest, and analyzeTypeCast.
  - All repeat “is union + choices + check target in choices” and build an “Available types: …” message.
  - Recommendation: utilities:
    - `isUnion(mc): mc is {isUnion: true; choices: any[]}`
    - `validateUnionChoice(choices, target, node, code): Diagnostic | null`

- Literal typing duplication:
  - analyzeLiteral, analyzeTemporalLiteral, and inferValueType duplicate mappings for scalar kinds.
  - Recommendation: centralize with a `literalValueTypeToTypeInfo(valueType, value)` map.

- Primitive types array duplication:
  - Same list in analyzeMembershipTest and analyzeTypeCast.
  - Recommendation: `const PRIMITIVE_TYPES = [...]` in module scope.

## Logical/Correctness Issues

- Union operator `|` result typing (analyzeBinary):
  - Current: returns left operand’s type with `singleton: false`, ignoring right’s element type entirely.
  - Expected: union of element types from both sides (promote Integer→Decimal, or resolve common supertype via registry/model where possible).
  - Risk: downstream inference ignores values contributed by right side.

- Expression-parameter context (where/select-like):
  - Current: for `param.expression === true`, sets `$this` to item singleton but does not update `context.inputType` to the item type before analyzing the expression.
  - Expected: expression parameters evaluate with the item as the input (root) context; model navigation should use the item type.
  - Fix: `const exprContext = context.withInputType(itemType).withSystemVariable('$this', itemType).withSystemVariable('$index', Integer)`.

- Argument count check uses only first signature:
  - Current: required/max computed from `signatures[0]`.
  - Issue: functions with overloads will be mis-reported as wrong-arity.
  - Fix: compute min required and max across all signatures, or better, attempt to find any matching signature by arity first.

- Unary operator result typing:
  - Current: uses first signature and returns `sig.result` (or operand type) directly.
  - More robust: resolve via `resolveResultType` (like binary) to support symbolic results (e.g., `'inputType'`).

- “Empty propagation” conflates Any[] with definitely empty:
  - Current: treats `type === 'Any' && !singleton` as empty in multiple places.
  - Issue: unknown collections aren’t necessarily empty; this can prematurely short-circuit with “result is empty”.
  - Fix: rely only on `isEmpty === true` to mean definite emptiness; treat `Any[]` as unknown.

- Cursor expectedType not signature-aware:
  - For binary right-hand cursor and function argument cursor, `expectedType` is often left undefined or only set for index context.
  - Improvement: derive `expectedType` by attempting signature resolution using the known sides and argument index.

- Identifier unknown property typing:
  - When property missing on a concrete non-union type, code returns `Any[]` with a warning.
  - FHIRPath semantics for unknown property access are empty collection. Prefer `isEmpty: true` to propagate emptiness deterministically.

## Design/Structure

- analyzeFunction is long and mixes concerns:
  - Suggest break down into helpers: `validateArity`, `collectArgTypes`, `resolveSignature`, `reportParamMismatches`, `handleEmptyPropagation`, `inferResultType`.
  - Move permissive behavior (e.g., `anyTrue/anyFalse`) to registry flags instead of hardcoding by name.

- Special-casing of `|` and `.`:
  - Keep `.` special (context flow), but for `|` compute a proper union element type while ensuring no scope leakage (fork context for both sides, return original context).
  - Optionally annotate in registry an operator behavior flag (e.g., “no-scope-merge”) to remove code-level special cases.

- ModelProvider usage for user variables:
  - inferValueType returns `Any` for objects; if a user variable looks like a FHIR resource (has `resourceType`), attempt `modelProvider.getType(resourceType)`.

- Consistency: use `NodeType.*` everywhere instead of string literals (style/consistency, not a bug).

## Concrete Recommendations

- Introduce utilities:
  - `formatType(t)` and `isEmptyCollection(t)`.
  - Union helpers: `isUnion(mc)`, `unionChoicesContain(choices, target)`, `validateUnionChoice(...)`.
  - Parameter/type checking: `checkParamTypes(sig, argTypes, nodes, {warnOnSingletonOnly, allowEmptyPropagation})`.

- Fix expression-parameter analysis:
  - Update input type for expression parameters: `context.withInputType(itemType)` before analyzing arg.

- Improve arity validation:
  - Compute min/max across all signatures, or pre-filter signatures by arity before type matching.

- Use `resolveResultType` for unary operators.

- Correct union `|` typing:
  - Merge left/right element types with promotion (Integer→Decimal) like in collection element inference.
  - Preserve original context (no variable leakage) while still deriving accurate result type.

- Treat unknown property as empty collection when safe:
  - On concrete non-union model types, return `{type: 'Any', singleton: false, isEmpty: true}` and a warning.

- Cursor expected type:
  - For binary: if right is cursor, use operator signatures with known left to propose expected RHS type.
  - For functions: when functionCall is identified, use signature and argument index to populate `expectedType`.

## Suggested Tests

- Union typing:
  - `('1' | 2).toString()` type inference should reflect union of String/Integer → String after `toString`.
  - `1 | 2.0` → Decimal.

- Expression parameters:
  - `Patient.name.where(use = 'official').given` should type-check property access inside where against the name element type, not the original input.

- Arity across overloads:
  - Functions with multiple signatures (e.g., `substring`) should not produce arity errors when one overload applies.

- Unknown property emptiness:
  - On a concrete `Patient`, `Patient.foo` should produce empty-collection typing with a warning.

## Quick Wins (Low-Risk)

- Centralize PRIMITIVE_TYPES and literal value-type mapping.
- Replace string node type checks with `NodeType` constants for consistency.
- Switch unary operator result typing to `resolveResultType`.
- Add helpers for formatting types and singleton suffixes in diagnostics.

## Larger Refactors (High-Value)

- Extract analyzeFunction subroutines to reduce duplication and clarify control flow.
- Rework union operator typing and empty-propagation logic to avoid treating `Any[]` as empty.
- Make cursor completion expected types signature-driven.

