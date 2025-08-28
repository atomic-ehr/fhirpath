# Code Review: src/completion-provider.ts

## Summary
- Provides context-aware completions via parser + analyzer + registry + modelProvider.
- Solid foundation using registry; however, some logic is hardcoded and type-unsafe, leading to brittle behavior and duplicated code.

## Priority Refactor 1: Signature-driven argument completions (remove hardcoded heuristics)
- Problem:
  - `getArgumentCompletions()` relies on a hardcoded `lambdaFunctions` list and inspects only `signatures[0]` to derive behavior.
  - Type-reference parameters are detected via `signatures[0].parameters[argIndex].typeReference`, ignoring overloads and optional params.
  - This causes incorrect suggestions for functions with multiple signatures and duplicated maintenance when registry changes.
- Refactor:
  - Make argument resolution signature-aware across all overloads:
    - For current `argumentIndex`, scan all `definition.signatures` and merge expected parameter kinds: `typeReference`, `lambda`, `scalar`.
    - If any signature expects a `typeReference` at this index → call `getTypeCompletions()`.
    - If any signature expects a lambda → provide `$this/$index` and element properties for the correct item type, derived from `typeBeforeCursor` (respecting collection/singleton).
    - Otherwise fall back to variables and general items.
  - Prefer a helper, e.g. `getExpectedParamKinds(def, argIndex, ctxType): {typeRef: boolean; lambda: boolean;}` that accounts for optional params and variadics.
  - Use the registry to detect lambda/closure-like params (e.g., parameter shape or a flag), not a hardcoded name list.
- Benefits:
  - Correct behavior for overloaded functions; eliminates name-based special cases.
  - Lower maintenance cost when registry evolves; improves accuracy and UX.

## Priority Refactor 2: Consolidate builders + fix insertText and applicability inconsistencies
- Problems:
  - `insertText` always appends `()` even when a function has no parameters; the ternary `hasParams ? '()' : '()'` is a bug.
  - Duplicate logic to add functions (general vs type-specific) and variables (argument vs index contexts).
  - Operator applicability ignores collection-ness, while function applicability accounts for `[]` (inconsistent and potentially wrong for collection operators).
  - Multiple `modelProvider.getElements(typeName)` calls without memoization inside a single request.
- Refactor:
  - Extract small helpers to centralize item creation and de-duplication:
    - `buildFunctionItems(funcDefs, ctxType)` → computes applicability, correct `insertText` (parentheses only if any signature requires params), optional snippet placeholder.
    - `buildVariableItems(variables)` → adds `$this`, `$index`, and `%user` consistently.
    - `buildElementItems(typeName, modelProvider, cache)` → returns property items; cache results per `typeName` within a request.
  - Unify function aggregation: collect from `registry.listFunctions()` and `registry.getFunctionsForType(type)` first, then pass through `buildFunctionItems()` and a single de-dup by label.
  - Align operator applicability to consider collections similar to functions (append `[]` when `singleton === false`).
- Benefits:
  - Fixes incorrect `insertText`, provides consistent UX.
  - Reduces code duplication and future bugs; improves performance via lightweight memoization.
  - Clearer, testable units for completion building and ranking.

## Nice-to-have (non-blocking)
- Improve filtering beyond `startsWith` with simple fuzzy matching; keep deterministic ranking via `sortText` + kind priority.
- Replace `any` usages (e.g., cursor `partialText`) with precise types/guards and surface minimal diagnostics instead of swallowing all errors.

