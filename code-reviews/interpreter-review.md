# Interpreter Code Review (src/interpreter.ts)

This review highlights two priority refactorings to improve correctness and maintainability in the interpreter.

## 1) Fix union operator handling in binary evaluation (correctness)

- Problem: In `evaluateBinary`, the special-case for `operator === '|'` looks up the evaluator via `this.operationEvaluators.get('union')`. The map is keyed by operator symbols (e.g., `'|'`), not names, so the lookup always fails and the fallback path concatenates arrays without de-duplication.
- Impact: Incorrect semantics for `|` (should be union with duplicate elimination per equals semantics), potential subtle downstream errors in pipelines and set logic.
- Refactor:
  - Use the symbol key: `this.operationEvaluators.get('|')` and call it with `leftResult.value` and `rightResult.value`.
  - Remove or demote the incorrect fallback; if an evaluator is unexpectedly missing, surface a clear error rather than silently producing a wrong result.
  - Keep the existing context isolation for left/right (each side evaluated with the original context), then delegate merging to the operator evaluator.
- Acceptance: Expressions using `|` produce de-duplicated results consistent with operator tests; no fallback concatenation occurs; union tests (including nested unions and pipelines) pass.

## 2) Centralize empty-propagation and avoid duplicate argument evaluation for functions (correctness + performance)

- Problems:
  - `evaluateFunction` implements empty-propagation by pre-evaluating arguments and checking emptiness using only the first signature (`signatures?.[0]`), and hard-codes a special case for `substring` parameter index 1.
  - This is brittle with overloaded signatures and leads to double evaluation (pre-check and then inside the function evaluator) and potential misapplication of empty-propagation rules.
- Impact: Performance overhead from redundant evaluations; incorrect behavior for functions with multiple signatures or parameter-specific propagation rules.
- Refactor:
  - Move propagation metadata to the registry per-parameter (e.g., `propagatesEmpty: boolean` or `skipEmptyCheck: boolean` on parameters) and provide a helper on `Registry` that returns the applicable signature for a call-shape.
  - In `evaluateFunction`, determine the applicable signature (based on arg count/kinds) and apply parameter-level propagation rules without evaluating non-expression arguments twice. Pass unevaluated args and a single `evaluate` callback to the function evaluator to control evaluation precisely.
  - Remove hard-coded `substring` exception; encode via parameter metadata.
- Acceptance: No double evaluation in hot paths (confirmed by instrumentation or tracing); functions follow parameter-level rules; substring and other edge-case functions behave correctly without special-casing.

---

Additional nice-to-haves (lower priority):
- Replace dynamic imports of `./temporal` inside tight loops with a module-level import or a lazily-initialized singleton to avoid repeated loader overhead.
- Extract helpers for FHIR resource boxing and choice-type handling to reduce duplication in `evaluateIdentifier` and improve readability.
- Cache `modelProvider.getType(resourceType)` lookups within an evaluation pass.
