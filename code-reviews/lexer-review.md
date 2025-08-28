**Lexer Code Review**

- Scope: `src/lexer.ts`
- Goal: identify two high‑impact refactorings to improve maintainability and correctness without changing public behavior.

**Priority Refactoring 1: Unify quoted scanning (DRY up string/delimited/env parsing)**

- Problem: Quote/escape handling is duplicated in multiple places:
  - `readString()` (lines ~560–606)
  - `readDelimitedIdentifier()` (lines ~408–446)
  - `readEnvironmentVariable()` backtick and single‑quote branches (lines ~430–497)
  - Quantity unit scan in `readNumber()` calls `readString()` but advances via ad‑hoc loop first (lines ~506–545)
- Risks today: Divergent escape handling, inconsistent error messages, harder to fix edge cases (unterminated, CR/LF handling, value slicing). Creates throwaway tokens for units in quantities.
- Refactor:
  - Introduce a single helper `scanQuoted(opts)` used by all call sites.
    - Options: `quote: "'" | '"' | '`'`, `allowEscapes: boolean`, `includeDelimitersInValue: boolean`.
    - Returns `{ start: number, end: number, raw: string }` (raw includes/excludes quotes based on option).
  - Reimplement:
    - `readString` → uses `scanQuoted({quote, allowEscapes: true, includeDelimitersInValue: true})`.
    - `readDelimitedIdentifier` → uses backtick flavor with same helper.
    - `readEnvironmentVariable` → `%` prefix + quoted branch uses helper; simple `%identifier` path unchanged.
    - `readNumber` (Quantity) → call helper directly instead of creating a temporary STRING token; construct QUANTITY token from `start..end`.
  - Keep token.value format unchanged (preserve delimiters for backward compatibility).
- Benefits: Single source of truth for quoting/escaping, fewer branches, easier fixes, less chance of regressions in one path. Reduces ~100+ lines of duplicated logic.

**Priority Refactoring 2: Centralize operator lexing with a greedy matcher**

- Problem: `nextToken()` handles symbol operators via a long switch with repeated `advance()` and `createToken()` blocks (lines ~233–357). Multi‑char combos (`<=`, `>=`, `!=`, `!~`) are special‑cased, and `'!'` erroring is embedded here. This is brittle and makes adding/updating operators error‑prone.
- Refactor:
  - Add `readOperator()` that greedily matches the longest valid operator from a predefined set.
    - Define `const OPERATORS = ['!=','!~','<=','>=','+','-','*','/','<','>','=','~','|','&']` sorted by length desc.
    - Important: handle `//` and `/* ... */` comment detection before calling `readOperator()` when current char is `/` (to preserve existing comment behavior).
    - Keep structural tokens (`. , ( ) [ ] { }`) out of this matcher; `.` remains `DOT`.
    - On `'!'` with no valid continuation, throw the same error as today for consistency.
  - Replace individual operator cases in `nextToken()` with a single branch calling `readOperator()` when current char is one of the operator starters.
- Benefits: Clear, declarative operator coverage; easier to maintain and extend; consistent error paths; fewer branches inside `nextToken()`.
- Notes: Add unit tests for edge cases around `'/'` (comments vs division), `'!'` vs `'!='`/`'!~'`, and boundary conditions adjacent to identifiers and numbers.

**Non‑blocking observations**

- Error messages could include line:column for faster debugging (e.g., `Lexer error at 12:5: ...`). Current messages sometimes include only absolute position.
- Consider fast path: only build `lineOffsets` when `trackPosition` is true (already done) and possibly gate creation of `range` behind a separate option if not needed by consumers.

**Regression Safety**

- Preserve token `.value` semantics (e.g., keep quotes in STRING/ENV var/delimited identifier values) to avoid breaking parser/consumers.
- Add focused tests for: quoted env vars, backtick identifiers with escapes, quantity literals with/without spaces, and all symbol operators.

