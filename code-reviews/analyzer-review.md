# Analyzer.ts Code Review

## Priority Refactorings

1) Robust arity and overload handling for functions
- Problem: `validateArity()` only checks the first signature and reports errors based on it. Many FHIRPath functions have multiple overloads (different required/optional counts). This yields false diagnostics when another signature would match. `analyzeArguments()` also reads parameter shapes (e.g., `expression`) from only the first signature, which can cause incorrect argument-context evaluation and cursor hints.
- Impact: Incorrect error/warning messages for valid calls; degraded DX for completions and guidance; potential cascading mis-typing in later steps (signature mismatch → wrong result type inference).
- Refactor:
  - Replace current arity check with an overload-aware approach: compute all candidate signatures where `requiredCount ≤ actualCount ≤ maxCount`. Only emit a wrong-arity diagnostic if no signature matches on arity alone.
  - Defer strict parameter diagnostics until after `matchFunctionSignature()`; when there’s no match, check the parameter types against the most compatible arity-matching signature to produce precise messages.
  - Optionally, drive `analyzeArguments()` using the union of candidate signatures: for each argument index, if any candidate marks `expression` for that index, evaluate in expression-context; otherwise use `$this` context. This avoids misclassifying expression parameters due to looking only at the first signature.
- Outline:
  - Add helper `getArityCandidates(funcDef, actualCount): FunctionSignature[]`.
  - In `analyzeFunction()`: compute candidates → analyze args → run `matchFunctionSignature()` across candidates → if none match, emit consolidated diagnostics (expected counts/types) and return `Any`.
  - Keep result inference unchanged; it already uses `matchFunctionSignature()`.
- Tests: Add cases for multi-arity functions (e.g., `substring`, `replaceMatches`, `iif`) verifying no spurious arity errors and correct result typing across overloads.

2) Accurate result typing for the union operator (`|`)
- Problem: `analyzeBinary()` returns the left operand’s type (with `singleton: false`) for `|`, ignoring the right operand. This loses information and can be wrong when sides differ. Examples: `Integer[] | Decimal[]` should be `Decimal[]`; `String[] | Integer[]` should degrade to `Any[]` for analysis; identical sides should keep their element type.
- Impact: Downstream analyses (e.g., `ofType`, `is`, `as`, function argument checks) receive incomplete/incorrect types, producing misleading diagnostics and weaker tooling.
- Refactor:
  - In the `|` branch, analyze both sides (already done), then merge element types:
    - If `left.type === right.type` → keep that element type.
    - If `Integer`/`Decimal` mix → promote to `Decimal`.
    - Else → use `Any`.
  - Always return collection (`singleton: false`). Preserve `namespace/name` if both sides match; otherwise omit them.
  - Keep context isolation as today (no variable leakage across branches).
- Outline:
  - Add `mergeCollectionElementTypes(a: TypeInfo, b: TypeInfo): TypeInfo` in `analysis/utils.ts` or within `Analyzer`.
  - Use it to compute the union result type in `analyzeBinary()`.
  - Consider tagging with `isEmpty` when both inputs are empty.
- Tests: Add tests for homogeneous unions, integer/decimal promotion, and heterogeneous unions falling back to `Any[]`.

## Nice-to-Haves
- DRY primitive checks: extract a shared `PRIMITIVE_TYPES` constant (used in `analyzeMembershipTest` and `analyzeTypeCast`).
- Prefer `typeReference` over function-name heuristics for type-parameters in `analyzeArguments()`.
- Replace `any` with `unknown` in `inferValueType()` per project guide; add narrowings.

## Expected Benefits
- Fewer false-positive diagnostics and better overload awareness.
- More precise type flow through unions, improving follow-on checks and completions.
- Cleaner, more maintainable analyzer logic with clearer responsibilities.

