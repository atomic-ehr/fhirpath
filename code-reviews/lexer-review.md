**Lexer Review**

- Summary: Lexer is functional and readable, but it exposes unused token kinds and carries duplicated position-tracking paths. Two focused refactors will reduce ambiguity, improve correctness for core literals, and simplify maintenance.

**Priority Refactorings**

- Bold: Implement Quantity literals (`TokenType.QUANTITY`)
  - Problem: `TokenType.QUANTITY` is defined but never produced; quantities like `5 'mg'` are part of FHIRPath and are used elsewhere in the project (see `quantity-value.ts`). Currently, such input lexes as `NUMBER`, `WHITESPACE`, `STRING`, leaving the parser to stitch them or fail inconsistently.
  - Impact: Enables correct parsing of UCUM quantities and removes ambiguity around how the parser should recognize quantities. Aligns lexer with enum and downstream expectations.
  - Scope: Extend `readNumber()` (or a new `readQuantity()`) to detect an immediate unit string after an optional single space: `[number] [ ]?['unit']` (single quotes per spec). Produce a single `QUANTITY` token with the raw span (from number start through closing quote). Leave interpretation of numeric precision and UCUM validation to later phases.
  - Edge cases: Block when unit is not a single-quoted literal; do not consume if the `'` starts a different string expression. Ensure decimals (e.g., `5.0 'mg'`) and no-space form `5'mg'` parse. Avoid consuming method dots (e.g., `5.toString()`), mirroring the existing decimal guard.
  - Acceptance: Inputs like `5 'mg'`, `0.25 'g'`, and `5'mg'` yield a single `QUANTITY` token; others remain unchanged. Add tests under `./test/lexer-quantity.test.ts` and JSON test-cases as applicable.

- Bold: Unify position tracking; remove unused LSP counters
  - Problem: The lexer maintains both: (1) precomputed `lineOffsets` used by `offsetToPosition()` for ranges, and (2) incremental `lspLine`/`lspCharacter` counters updated in `advance()`—but the latter are never used. This duplication adds cognitive load and runtime overhead without benefit.
  - Impact: Simplifies the code and avoids unnecessary updates on every character advance. Reduces confusion about the source of truth for positions.
  - Approach: Keep the existing, efficient `lineOffsets` + `offsetToPosition()` path and remove `lspLine`/`lspCharacter` fields and their updates. Retain legacy 1-based `line`/`column` for token metadata if still required by callers. Optionally, standardize error reporting to consistently include `line`/`column`.
  - Steps:
    - Delete `lspLine`/`lspCharacter` fields and associated updates in `advance()`.
    - Clarify comments in `createToken()` that LSP `range` is derived from offsets via `offsetToPosition()`.
    - Add a helper for error creation that embeds `line`/`column` when available to improve diagnostics.
  - Acceptance: No behavior change in token ranges; reduced code paths for position handling; improved error messages.

**Notes / Follow-ups (non-blocking)**

- Bold: DRY identifier scanning: `readIdentifier()`, `$` identifiers, and `%identifier` duplicate the same character-class loops; extract a shared helper to reduce divergence and future bugs.
- Bold: Remove or repurpose `TokenType.TEMPORAL_LITERAL`: it’s defined but not emitted. Either delete it or document/intend its use in parsing to unify date/time variants.

