**Summary**
- Purpose: Pratt/precedence parser for FHIRPath with optional LSP/cursor features.
- Scope reviewed: `src/parser.ts` (token stream setup, precedence loop, primary/postfix parsing, error handling, cursor/LSP hooks).

**Strengths**
- Clear precedence-climbing core; uses registry for precedence/associativity.
- Good separation for AST node factory helpers; ranges computed consistently.
- Error recovery gates on LSP mode with synchronization tokens.

**Priority Refactor #1: Unify postfix/call parsing and remove brittle startToken logic**
- Issue: Function-call handling is duplicated in two places with fragile start token math:
  - In `parseExpressionWithPrecedence` for standalone calls after an identifier (`LPAREN` after `Identifier/TypeOrIdentifier`).
  - In `parseInvocation` for calls after `.`.
  - Both compute a `startToken` via `this.tokens[this.current - args.length - 2]`, but `createFunctionNode` ignores this parameter and derives range from nodes, making the calculation dead and misleading.
- Risks today:
  - Inconsistent behavior between the two paths (cursor handling, error recovery) and potential off‑by‑one regressions.
  - Confusing dead parameter (`startToken`) and unnecessary token arithmetic.
- Refactor plan:
  - Extract a single `parsePostfixChain(left: ASTNode): ASTNode` that loops to handle `[]`, `()` (calls), and `.` (member/call) uniformly, including cursor cases.
  - Remove the `startToken` parameter from `createFunctionNode` and all call sites; rely on `getRangeFromNodes(name, lastArgOrName)` for ranges.
  - Delete the brittle `this.tokens[this.current - args.length - 2]` code.
- Expected impact:
  - Less duplication and clearer control flow; fewer subtle token index bugs.
  - Easier to extend with new postfix forms (e.g., future argument styles) and to test.

**Priority Refactor #2: Centralize cursor/LSP handling to reduce hot‑path branching**
- Issue: Cursor logic is interleaved across hot paths (`parseExpressionWithPrecedence`, `parsePrimary`, `parseInvocation`, `parseArgumentList`, index parsing). This mixes concerns despite an existing LSP augmentor.
- Pain points:
  - Many `if (peek().type === CURSOR)` branches complicate reasoning and maintenance.
  - `injectCursorToken` ignores mid‑token cursor positions, while ad‑hoc checks (e.g., `cursorPosition === token.end`) handle only a subset of cases.
- Refactor plan:
  - Introduce a small `CursorAwareTokenStream` that:
    - Injects a virtual cursor token with awareness of mid‑token positions (splitting identifiers when helpful), and
    - Exposes helpers like `atCursorIn(Index|Args|IdentifierEnd)` to consolidate decisions.
  - Move cursor-node construction behind a `CursorNodeFactory` used only where needed; eliminate scattered inline `createCursor*Node` calls from parse methods where augmentor or factory can synthesize them post‑parse.
  - Keep parser core mode‑agnostic; gate cursor behavior at the token stream/factory boundary.
- Expected impact:
  - Cleaner, faster hot paths with fewer branches; easier to maintain.
  - More consistent cursor behavior (incl. mid‑token), aligning LSP features without polluting core parse logic.

**Nice‑to‑Have (lower priority)**
- Standardize on `advance()` instead of mixing `this.current++` for consistency, or encapsulate both behind a single fast path.
- Consider deferring type/identifier disambiguation (now based on initial uppercase) to later analysis to avoid premature classification.

**Suggested Tasks**
- Implement `parsePostfixChain` and update callers; delete `startToken` param and brittle index math.
- Create `CursorAwareTokenStream` + `CursorNodeFactory`; replace scattered cursor branches; update tests for cursor scenarios.
- Run `bun tsc --noEmit` and `bun run test` to validate; add focused tests for calls, indexing, and cursor positions (start, mid‑token, after comma).

