**Topic**
- Defer type/identifier disambiguation from parser to analysis.

**Current Behavior**
- Parser classifies names by first character: uppercase → `TypeOrIdentifier`, else `Identifier`.
- Type context is later re-validated in analyzer/interpreter, with many `Identifier | TypeOrIdentifier` checks.

**Problems**
- False positives: uppercase resource/property names treated as types when used as values/members.
- i18n/escaping: non-ASCII and backtick-delimited names bypass the heuristic.
- LSP duplication: every feature needs to handle both node kinds; cursor handling is noisier.
- Premature semantics: grammar position (after `is`/`as`/`ofType`) is the real type signal, not casing.

**Proposal**
- Parser always emits `Identifier` for names unless grammar requires a type.
- Treat type-required positions explicitly:
  - `is`/`as`: store the target type name (or a dedicated `TypeReferenceNode`).
  - Functions with type parameters (e.g., `ofType`): mark those params via registry (`typeReference: true`).
- Analyzer resolves whether a name denotes a type, property, or function using:
  - Syntactic slot (operator/function signature context).
  - Registry metadata (`typeReference` on parameters).
  - Model provider (is this a known type?).

**Spec Alignment (FHIRPath.g4)**
- Grammar has no lexical “type” token; `identifier` covers names and reserved words.
- Types only appear in `typeSpecifier` slots (after `is`/`as` and type-taking function params).
- The common pattern `A.b.c` with `A` as a type is a semantic convention (chain-start), not a distinct AST node kind.

**Do We Need `TypeOrIdentifier`?**
- No. It is a casing heuristic not present in the spec and causes:
  - i18n/escaped-identifier issues.
  - Dual-kind handling (`Identifier | TypeOrIdentifier`) across parser/analyzer/LSP.
  - False positives when uppercase properties/members exist.
- Context (slot + chain position) and the model provider provide robust disambiguation.

**Chain-Start Semantics (Analyzer)**
- When analyzing the head of a navigation chain:
  - Try `modelProvider.getElementType(inputType, name)` (normal member access).
  - If that fails and `modelProvider.getType(name)` succeeds, treat the head as a type selector and set the chain’s input type accordingly.
- Head detection: identifier is the leftmost term of the expression/parenthesized subexpression, or the left side right after a `|` union.
- This preserves `Patient.name`-style expressions without relying on casing or a special node type.

**Interpreter Compatibility**
- Allow a root `Identifier` matching a known type to act as a type filter on input (preserves current `TypeOrIdentifier` behavior without requiring that AST kind).

**AST Impact**
- Parser: `createIdentifierNode` → always `NodeType.Identifier`.
- Optional: introduce `TypeReferenceNode` for clarity in explicit type positions.
- Deprecate producing `TypeOrIdentifier` from parser output (keep type for back-compat if needed).

**Migration Plan**
- Phase 1 (No API break):
  - Parser: stop emitting `TypeOrIdentifier`; keep `Identifier` only.
  - Keep membership/type-cast targetType as string (unchanged shape), analyzer validates via model provider.
  - Analyzer: where expecting a type, resolve `Identifier`/string to a type; update `analyzeIdentifier` to not rely on casing.
  - Registry: ensure `typeReference: true` on functions like `ofType` and consumers use it.
  - Analyzer: implement chain-start rule above; keep behavior for `A.b.c` with `A` as a known type.
  - Interpreter: accept head `Identifier` as type filter for backward-compatible runtime semantics.
  - LSP: drive completions by context (after `.` → members; after `is/as/ofType(` → types; at expression start → members + types).
  - Tests: update assertions that expect `TypeOrIdentifier` to accept `Identifier`; keep behavioral tests (e.g., `Patient.name`) unchanged.
- Phase 2 (Optional cleanup):
  - Add `TypeReferenceNode`; use it in explicit type slots; simplify analyzer branches.
  - Deprecate `NodeType.TypeOrIdentifier` in types and docs.

**Risks & Mitigations**
- Breakage in code/tests matching `TypeOrIdentifier`:
  - Mitigate by supporting both during transition and updating tests.
- Slight analyzer overhead from lookups:
  - Cache model provider queries; impact is negligible vs. clarity gains.

**Benefits**
- Clearer AST, fewer special cases across parser/LSP/interpreter.
- Robust across locales and escaped identifiers.
- Context-driven LSP suggestions and cursor handling.

**Decision**
- Proceed with the change. Use Phase 1 to avoid API breaks and preserve user-facing behavior; follow with Phase 2 cleanup once downstreams are updated.

**Success Criteria**
- All parser/analyzer tests pass with `Identifier`-only names.
- Reduced `Identifier | TypeOrIdentifier` branching in codebase.
- LSP completions depend on syntactic context, not casing.
