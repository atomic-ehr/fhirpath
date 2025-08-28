# Parser (src/parser.ts) — Code Review

Scope: FHIRPath parser with LSP/editor features, cursor-aware parsing, trivia preservation, AST building, and pretty-print helpers.

Overall: The file mixes multiple concerns (parsing, AST building, LSP augmentation, cursor/completion logic, pretty printing). It largely works, but there are two high‑impact areas to refactor for correctness and maintainability.

## Priority Refactoring 1 — Type‑safe, coherent error handling (remove unsound `any` paths)

- Problem: `handleError(message, token): never` is used in contexts that expect non‑AST values (e.g., `Token` in `consume`). Call sites coerce the `never` into unrelated types via `as any`, e.g.:
  - In `consume(...)`: `return this.handleError(message, token) as any;` (returns an `ErrorNode` at runtime in LSP recovery, where a `Token` is expected).
  - Multiple parse methods assume the returned value won’t be used; that’s brittle and can crash if downstream accesses token fields.
- Consequences:
  - Runtime unsoundness when error recovery is enabled (`LSP` + `errorRecovery`). A `Token` path may receive an object shaped like `ErrorNode`.
  - TypeScript is silenced with `as any`, masking real bugs and complicating future changes.
  - Error reporting control flow is hard to reason about; some places throw, others “return” a never/any.
- Recommendations:
  - Split responsibilities explicitly:
    - `reportError(message: string, token?: Token): void` — records error (and maybe range) in `this.errors` when in LSP mode; does nothing in simple mode.
    - `throwSyntax(message: string, token?: Token): never` — throws the correct `Errors.*` exception in simple mode.
  - Make `handleError` a thin, type‑safe dispatcher that either calls `reportError` and returns (no value), or calls `throwSyntax`.
  - Rework `consume(type, message): Token` to be type‑safe:
    - If `check(type)` true → `advance()`.
    - Else if `errorRecovery` → `reportError(message, peek())` and return a synthetic zero‑width token of the requested `type` (similar to current EOF case). This keeps the return type correct and the parser advancing predictably.
    - Else → `throwSyntax(message, peek())`.
  - Remove all `as any` around error flows. Ensure every place that expects a `Token` receives a `Token` (synthetic when recovering), and every place that expects an `ASTNode` either throws or explicitly builds an `ErrorNode` at the AST layer.
  - Optional: introduce an explicit `ErrorNode` injection point for productions that can continue building the AST under recovery; keep token‑level APIs free from AST values.
- Benefits:
  - Eliminates a class of runtime bugs under LSP recovery.
  - Restores type safety and clarifies control flow.
  - Makes future changes safer (no hidden `any` traps).

## Priority Refactoring 2 — Separate core parsing from LSP/editor augmentation

- Problem: The parser interleaves core parsing with LSP/editor concerns:
  - Cursor token injection (`injectCursorToken`), cursor‑specific transforms (`transformOfTypeCursorNodes`), autocomplete scaffolding (`getCompletions`, `getExpectedTokens`), pretty printing (`pprint`), trivia computation (`computeTriviaSpans`, `populateTrivia`), node indexing (`enrichNodeForLSP`), and parent/children wiring.
  - Frequent branching on `this.mode === 'lsp'` scatters policy through nearly every builder.
  - Cursor is handled both by injecting a `CURSOR` token and by direct `cursorPosition` checks (e.g., `parseInvocation`), leading to two different strategies in one code path.
- Consequences:
  - Cognitive load: the file is long and harder to maintain; correctness and performance tuning are harder.
  - Cursor/LSP behavior bleeds into core productions and precedence climbing; increases risk of subtle parsing bugs.
  - Testing core parsing separate from editor behavior is harder.
- Recommendations:
  - Extract an `LspAugmentor` (or `AstAugmentor`) that enriches a finished AST:
    - IDs, raw slices, parent/children arrays, trivia decoration, node/identifier indexes.
    - Optionally applies `transformOfTypeCursorNodes` as a post‑parse AST transform.
  - Keep `Parser` focused on: token stream → AST, precedence climbing, building nodes. Remove LSP branches from node builders; builders should not mutate indexes or parent/children.
  - Normalize cursor handling to a single strategy:
    - Prefer always injecting a `CURSOR` token and remove the special “`cursorPosition === token.end`” branch in `parseInvocation`.
  - Move editor helpers (`getExpectedTokens`, `getCompletions`, `findNodeAtPosition`) next to the augmentor or into a separate `lsp/` module.
  - Relocate `pprint` to a separate utility file (pure pretty‑printer) to keep the parser cohesive.
- Benefits:
  - Smaller, simpler parser; easier to reason about and optimize.
  - Editor features become composable and testable independently.
  - Cursor behavior becomes consistent, reducing edge‑case bugs.

## Notable Smaller Issues (quick wins)

- Unused parameters: `createFunctionNode(..., startToken)` and `createIndexNode(..., startToken)` never use `startToken`. Remove the parameter and simplify call sites.
- Binary‑with‑cursor operator: `parseExpressionWithPrecedence` creates a binary node when encountering `TokenType.CURSOR`, but the operator comes from the cursor token (`''`). Consider a dedicated partial node (e.g., `PartialBinary` with missing operator) or represent this as an `ErrorNode` with preserved left context to avoid empty operator strings.
- Hardcoded unary precedence: unary `+`/`-` use `registry.getPrecedence('*')` as a proxy. Prefer explicit unary precedence from the registry to avoid coupling to `*`.
- `calendarUnits` array in `parsePrimary` is reallocated on each call. Hoist to a module‑level `Set<string>` for clarity and micro‑perf.

## Suggested Migration Plan

1) Introduce `reportError` and `throwSyntax`; refactor `consume` and call sites to remove `as any` flows. Keep behavior identical under tests; add synthetic tokens for recovery.
2) Extract `pprint` to `src/utils/pprint.ts` and re‑export from index to avoid breaking callers.
3) Create `src/lsp/augmentor.ts` to house: `enrichNodeForLSP`, trivia population, node/identifier indexes, and cursor AST transforms; update `parseLSP` to: parse → augment → compute cursor context.
4) Normalize cursor handling to injected token only; remove `cursorPosition === token.end` special‑case.
5) Remove unused params from `createFunctionNode`/`createIndexNode` and update call sites.

This sequence minimizes risk while steadily improving type safety and cohesion.

