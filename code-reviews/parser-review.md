**Parser Code Review**

- Scope: `src/parser.ts`
- Goal: identify two high‑impact refactorings to improve maintainability, correctness, and performance without changing public behavior.

**Priority Refactoring 1: Replace CommonJS `require` with ES module import for temporal literals**

- Problem:
  - `createTemporalLiteralNode` uses `require('./temporal')` to load `parseTemporalLiteral` at runtime (lines ~800–810).
  - Violates project guidelines (ES modules only), complicates bundling and static analysis, and weakens type safety.
  - Mixed module systems appear elsewhere, but inside the parser this is easy to remove and has clear benefits.
- Refactor:
  - Move to a static import at top of the file: `import { parseTemporalLiteral } from './temporal';`
  - Use directly in `createTemporalLiteralNode` without dynamic loading.
  - If circular‑dependency concerns arise, alternatively accept a parser option `temporal?: { parseTemporalLiteral: (s: string) => any }` and default it via the static import.
- Benefits:
  - Conforms to repo’s ES module policy; improves type checking and editor tooling.
  - Avoids runtime `require` in ESM/bundled environments; improves tree‑shaking.
  - Simplifies error surfacing (typed import) and removes an unnecessary runtime boundary.
- Notes:
  - `src/temporal.ts` imports only `Errors` and does not depend on the parser, so a static import here should be safe.
  - Add a focused test: `@2020`/`@2020-01`/`@T12:30:00.123` literals parse to TemporalLiteralNode with correct `valueType` and parsed `value`.

**Priority Refactoring 2: Eliminate O(n²) token scans during LSP enrichment; use node ranges**

- Problem:
  - LSP enrichment in node creators repeatedly scans `this.tokens` to find `startToken`/`endToken` by matching offsets (e.g., `createBinaryNode`, `createUnaryNode`, `createFunctionNode`, `createIndexNode`, `createMembershipTestNode`, `createTypeCastNode`).
  - Each creation performs `Array.find` over the full token list, turning parse time into O(nodes × tokens) and adding complexity.
  - `enrichNodeForLSP` accepts start/end tokens just to slice `node.raw`, despite `range` already being computed from child nodes/tokens.
- Refactor:
  - Change `enrichNodeForLSP(node)` to derive `raw` from `node.range` only: `node.raw = input.slice(node.range.start.offset, node.range.end.offset)`.
  - Remove the `startToken`/`endToken` parameters from `enrichNodeForLSP` and all callers; stop scanning tokens in creators.
  - Keep parent/children wiring in creators (already present) and drop the unused `currentParent` field, which is never set.
- Benefits:
  - Reduces complexity and avoids repeated linear scans over tokens (noticeable for long expressions).
  - Centralizes source slicing logic; callers no longer need token context to enrich nodes.
  - Makes node creation functions smaller and easier to reason about.
- Notes:
  - Ensure all node `.range` values are accurate before enrichment (they already are computed via tokens/child nodes).
  - Add a simple benchmark expression with many nested operations to confirm reduced parse time and identical AST/LSP metadata.

**Non‑blocking observations**

- `checkCursor()` and `isBinaryOperatorToken()/isKeywordAllowedAsMember()` are unused; remove or integrate where intended to reduce surface area.
- `preserveTrivia` path filters hidden‑channel tokens out immediately; capturing trivia later will need a different approach (record trivia spans before filtering).

