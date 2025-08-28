# Interpreter Code Review (src/interpreter.ts)

This review highlights two high‑impact refactorings to improve correctness, maintainability, and performance while staying within the current architecture.

## 1) Extract Property Navigation + Boxing Logic from `evaluateIdentifier`

- Problem: `evaluateIdentifier` is large and multi‑purpose (choice type handling, resource re‑boxing, primitive extension navigation, date/time string conversion). It duplicates logic (e.g., temporal string conversion for array and scalar paths) and mixes concerns, making it hard to reason about and evolve.
- Evidence: Lines ~339–520 implement:
  - Choice type detection via key prefix scan, then model lookups.
  - Resource re‑boxing based on `resourceType` with/without model provider.
  - Temporal string conversion (duplicated for array/singleton branches).
  - Primitive extension navigation via `_${name}` elements.
- Risks/Issues:
  - Duplication: Temporal parsing appears twice (array branch and scalar branch).
  - Readability: Control flow with multiple nested conditions is hard to follow and test.
  - Extensibility: Adding new model‑aware behaviors (e.g., profiles) will increase complexity further.
- Refactoring Plan:
  - Extract helpers to a new `./src/navigator.ts` (or `./src/interpreter/navigator.ts`) and use them from `evaluateIdentifier`:
    - `getPrimitiveElement(item: object, prop: string): any | undefined`
    - `detectChoiceValues(item: object, base: string, modelProvider?): ChoiceHit[]` (returns value + type info + primitive element)
    - `reboxResource(value: any, singleton: boolean, modelProvider?): FHIRPathValue`
    - `maybeParseTemporal(value: any, expectedTypeInfo?, modelProvider?): any`
  - Replace inline logic with these helpers to remove duplication and keep `evaluateIdentifier` focused on traversal orchestration.
  - Import temporal parsing statically once (or lazy‑load with memoized import) to avoid repeated dynamic imports inside loops.
- Benefits:
  - Clear separation of concerns; easier to unit test each helper.
  - Fewer branches and early exits in `evaluateIdentifier`.
  - Reduced risk of subtle divergence (e.g., temporal parsing applied differently across branches).
- Acceptance Criteria:
  - `evaluateIdentifier` drops below ~50 lines and delegates to helpers.
  - No duplicated temporal parsing branches; single helper used in both array and scalar cases.
  - All existing tests pass; add targeted tests for choice navigation, primitive elements, and temporal conversions.

## 2) Make Binary Operator Evaluation Consistent and Faster

- Problem A (Consistency): Empty‑propagation rules are partially hard‑coded and partially registry‑driven. The current code includes a comment about `&` but only lists `'|'` in `collectionOperators`, creating drift risk with registry definitions.
- Evidence: Lines ~594–627:
  - Uses `registry.getOperatorDefinition(operator)` and checks `doesNotPropagateEmpty`.
  - Also keeps a local `collectionOperators = ['|']` list despite registry flags, with a comment mentioning `&` that isn’t included in the list.
- Refactoring A:
  - Remove the ad‑hoc `collectionOperators` list and rely exclusively on the registry’s `doesNotPropagateEmpty` flag as the single source of truth for propagation.
  - Ensure the registry metadata for all operators is correct (e.g., union `|`, string concat `&`, etc.).

- Problem B (Performance): For regular binary operators, left and right operands are evaluated with the same input/context but sequentially; they can be evaluated concurrently.
- Evidence: Lines ~598–599 evaluate left, then right sequentially.
- Refactoring B:
  - For non‑special binary operators (i.e., not `.` and not union `|` which has custom scoping), evaluate operands concurrently with `Promise.all`:
    - `const [leftResult, rightResult] = await Promise.all([this.evaluate(left, input, context), this.evaluate(right, input, context)]);`
  - Preserve existing special cases:
    - `.`: right uses left’s output/context (sequential by design).
    - `|`: left and right use the original context (keep current behavior for scoping), but results can still be computed in parallel safely since each uses the same `input`/`context`.
- Benefits:
  - Correctness: Single‑point control of empty propagation avoids discrepancies (e.g., missed `&`).
  - Performance: Parallel operand evaluation reduces latency for async subtrees.
- Acceptance Criteria:
  - No local hard‑coded operator exception lists; propagation logic derives from registry only.
  - Regular binary operands evaluated with `Promise.all`.
  - Special cases (`.` and `|`) retain their semantics; union branches may also use `Promise.all` since both use the same input/context.
  - Tests cover empty‑propagation semantics per operator and verify no regressions.

---

Notes:
- These refactors do not change public API. They clarify behavior, reduce duplication, and improve performance without altering semantics.
- After refactoring, consider adding lightweight unit tests for the new helpers and operator propagation behavior to prevent regressions.

