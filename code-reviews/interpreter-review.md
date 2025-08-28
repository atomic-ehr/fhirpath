# Interpreter (`src/interpreter.ts`) — Code Review

## Summary
- The interpreter is clear and well-structured with focused evaluators and useful helpers.
- Two refactorings stand out as highest impact: removing a module cycle and centralizing operator/function invocation rules.

## Priority Refactorings

1) Extract `RuntimeContextManager` to its own module (break cycle)
- Problem: Operations (e.g., `where-function.ts`) import `RuntimeContextManager` from `../interpreter`, while `interpreter.ts` imports from `./operations`. This forms a module cycle that can cause subtle init‑order bugs and hinders reuse.
- Refactor: Move `RuntimeContextManager` into `src/runtime-context.ts` and re-export types from there.
  - Update imports in operations to `import { RuntimeContextManager } from '../runtime-context'`.
  - Update `interpreter.ts` to import from `./runtime-context`.
- Benefits: Eliminates cycle, makes the context API reusable by compiler/tools, shrinks interpreter surface, reduces risk of partially initialized exports.

2) Centralize invocation semantics for operators/functions (empty propagation + short‑circuit)
- Problem: Evaluation rules are spread across `evaluateBinary` and `evaluateFunction` (e.g., empty propagation, memoization, special cases for `.` and `|`). Binary evaluation eagerly evaluates both operands, missing short‑circuit for logical operators (`and`, `or`, `implies`) and duplicating policy logic.
- Refactor: Introduce a small invocation layer (e.g., `invokeOperator`/`invokeFunction`) that:
  - Applies empty‑propagation using registry metadata once.
  - Supports short‑circuit for logical operators (deterministic evaluation of right side only when needed).
  - Provides a uniform memoized argument evaluator for functions and expression parameters.
  - Keeps special sequencing (`.`) and scope isolation (`|`) as dedicated cases delegating into the common path.
- Benefits: Consistent semantics, fewer bugs from duplicated rules, performance gains (avoid unnecessary right‑side eval), clearer hotspots for policy changes.

## Rationale & Notes
- Cyclic dependency is the most structural risk; breaking it improves reliability and composability.
- Unifying invocation semantics de‑duplicates logic and enables future improvements (e.g., registry flags for lazy operands) without touching multiple sites.
- Keep the current operator/function signatures stable initially; start with targeted short‑circuit in the interpreter for `and`/`or`/`implies`, then generalize via registry if needed.

## Suggested Implementation Plan
- Step 1: Extract `RuntimeContextManager` and update imports (no behavior change). Add a focused test around `%`/`$` vars and iterator context to ensure parity.
- Step 2: Add `invokeOperator`/`invokeFunction` utilities in `interpreter.ts` (internal), refactor callers to use them. Implement short‑circuit for logical operators and centralize empty propagation.
- Step 3: Optional follow‑ups
  - Consolidate property access boxing/reboxing (array vs single) into one helper to reduce duplication.
  - Add light registry metadata for lazy evaluation to avoid hardcoding operator symbols in the interpreter.

## Risks
- Operator short‑circuit must respect FHIRPath three‑valued logic (true/false/empty); add tests for `and`/`or`/`implies` with empty operands.
- Moving `RuntimeContextManager` requires updating many imports; do it in one PR with CI to catch misses.

