**Title:** src/ and test/ Layout Review and Proposal

**Summary**
- Overall structure is close to the intended architecture, but top-level density and inconsistent naming in `src/operations/` and `test/` reduce discoverability.
- Two tracks proposed: a minimal, low‑churn plan for near‑term cleanup; and a longer‑term reorganization to fully align with the architecture.
- Prefer the minimal plan first; defer broader moves until there is bandwidth.

**Minimal Changes (Low Churn)**
- `src/lsp/`: move `completion-provider.ts` into this folder; update only local imports.
- `src/values/`: create and move value types only:
  - `temporal.ts`, `decimal-boundaries.ts`, `quantity-value.ts` → `src/values/`.
- `operations` naming fix (no recategorization):
  - Deprecate `operations/less-than.ts` by making it an alias re-export to `less-operator.ts` (or remove if unused); keep other files intact.
  - Keep existing `*-function.ts` / `*-operator.ts` suffix convention for now.
- `test/helpers/`: create and move `test/model-provider-singleton.ts` into `test/helpers/model-provider-singleton.ts`; update imports in affected tests.
- Do not change any other paths or filenames in this phase.

**Current Structure (high level)**
- Core at `src/` root: `parser.ts`, `lexer.ts`, `interpreter.ts`, `registry.ts`, `navigator.ts`, `errors.ts`, `types.ts`.
- Analysis/Analyzer: `src/analyzer.ts`, `src/analysis/{type-compat.ts, utils.ts}`.
- LSP-related: `src/lsp/{augmentor.ts,cursor-services.ts,trivia-indexer.ts}`, `completion-provider.ts` at root.
- Domain values/utilities: `temporal.ts`, `quantity-value.ts`, `decimal-boundaries.ts`, `boxing.ts`, `utils/pprint.ts`.
- Operations: many files in `src/operations/` mixing `*-function.ts`, `*-operator.ts`, plus a few inconsistencies (e.g., `less-than.ts`, `temporal-functions.ts`).
- Tests: flat in `test/` with 40+ files and `test/fixtures/`, helper `model-provider-singleton.ts` at root.

**Main Issues**
- Naming inconsistency in operations: mixed suffixes, one-off names (`less-than.ts`), and a catch‑all `temporal-functions.ts`.
- Top-level `src/` is crowded; analyzer/LSP/devtools and runtime/model helpers are mixed with core.
- Tests are flat; hard to see ownership (e.g., which tests belong to parser vs analyzer vs operations).
- Helper utilities in `test/` not grouped (e.g., `model-provider-singleton.ts`).

**Proposed src/ Structure (Longer‑Term)**
- `src/core/`
  - `lexer.ts`, `parser.ts`, `interpreter.ts`, `registry.ts`, `navigator.ts`, `errors.ts`, `types.ts`
- `src/runtime/`
  - `runtime-context.ts`, `scope-manager.ts`, `boxing.ts`
- `src/model/`
  - `model-provider.ts`
- `src/values/`
  - `temporal.ts`, `decimal-boundaries.ts`, `quantity-value.ts`
- `src/analyzer/`
  - `analyzer.ts`, `analysis/type-compat.ts`, `analysis/utils.ts` (moved under `analyzer/`)
- `src/lsp/`
  - `completion-provider.ts`, `augmentor.ts`, `cursor-services.ts`, `trivia-indexer.ts`
- `src/devtools/`
  - `inspect.ts`, `cursor-nodes.ts` (if primarily debug/inspection oriented)
- `src/operations/`
  - `arithmetic/`: `plus.ts`, `minus.ts`, `multiply.ts`, `div.ts`, `mod.ts`, `unary-plus.ts`, `unary-minus.ts`, `power.ts`
  - `logical/`: `and.ts`, `or.ts`, `xor.ts`, `implies.ts`, `not.ts`
  - `comparison/`: `equal.ts`, `not-equal.ts`, `equivalent.ts`, `not-equivalent.ts`, `greater.ts`, `greater-or-equal.ts`, `less.ts`, `less-or-equal.ts`
  - `collection/`: `union.ts` (operator+function), `intersect.ts`, `exclude.ts`, `contains.ts`, `subsetOf.ts`, `supersetOf.ts`, `distinct.ts`, `count.ts`, `isDistinct.ts`, `single.ts`, `first.ts`, `last.ts`, `tail.ts`, `take.ts`, `skip.ts`, `combine.ts`
  - `navigation/`: `dot.ts`, `children.ts`, `descendants.ts`, `select.ts`, `where.ts`, `ofType.ts`, `as.ts`, `is.ts`, `as-operator.ts`→`as.ts` (operator and function consolidated with internal branching)
  - `string/`: `length.ts`, `upper.ts`, `lower.ts`, `toChars.ts`, `indexOf.ts`, `lastIndexOf.ts`, `substring.ts`, `startsWith.ts`, `endsWith.ts`, `matches.ts`, `matchesFull.ts`, `replace.ts`, `replaceMatches.ts`, `split.ts`, `trim.ts`
  - `temporal/`: `yearOf.ts`, `monthOf.ts`, `dayOf.ts`, `hourOf.ts`, `minuteOf.ts`, `secondOf.ts`, `millisecondOf.ts`, `dateOf.ts`, `timeOf.ts`, `timezoneOffsetOf.ts`, `round.ts`, `ceiling.ts`, `floor.ts`, `truncate.ts` (replace `temporal-functions.ts` with discrete files)
  - `type/`: `convertsTo{Boolean,Decimal,Integer,Long,Quantity,String}.ts`, `to{Boolean,Decimal,Integer,String}.ts`, `iif.ts`, `defineVariable.ts`, `is.ts`
  - `set/`: `union.ts` (if not placed in collection), `intersect.ts`, `exclude.ts` (choose one category; avoid duplication)
  - Keep `operations/index.ts` as the registry aggregator; export categories for clarity.

Notes:
- Drop `-function`/`-operator` suffixes. Collisions where both exist (e.g., `as`) should be reconciled inside one module exporting multiple handlers or with sub-exports.
- Keep file names kebab-case or camelCase consistently; suggest kebab-case mapped from FHIRPath identifiers (e.g., `isDistinct` → `is-distinct.ts`) or camelCase to reflect function names. Pick one and apply globally; proposal above uses camelCase for fidelity with function names.

**Proposed test/ Structure (Longer‑Term)**
- Mirror `src/` for discoverability:
  - `test/core/`: `parser.test.ts`, `lexer.test.ts`, `interpreter.test.ts`, `registry.test.ts`
  - `test/analyzer/`: `analyzer.test.ts`, `type-disambiguation.test.ts`, `analyzer-cursor-mode.test.ts`, `analyzer-navigation.test.ts`
  - `test/lsp/`: `completion-provider*.test.ts`, `parser-lsp-*.test.ts`, `augmentation-lsp.test.ts`, `parser-trivia-capture.test.ts`
  - `test/runtime/`: `runtime-context.test.ts`, `system-variables.test.ts`, `singleton-error.test.ts`
  - `test/model/`: `model-provider.test.ts`
  - `test/values/`: `temporal*.test.ts`, `quantity-value.test.ts`, `decimal-boundaries`-related tests
  - `test/operations/` split by category mirroring `src/operations/`
  - `test/utils/`: `pprint` or helpers
- Move helpers and fixtures:
  - `test/helpers/`: `model-provider-singleton.ts`, common factories/mocks
  - Keep `test/fixtures/` for data files only (JSON samples, etc.)

**Rename/Move Highlights (When Doing Long‑Term Plan)**
- `src/completion-provider.ts` → `src/lsp/completion-provider.ts`
- `src/analyzer.ts` + `src/analysis/*` → `src/analyzer/{index.ts,type-compat.ts,utils.ts}` (or keep `analyzer.ts` and subfiles local)
- `src/inspect.ts` → `src/devtools/inspect.ts`
- `src/cursor-nodes.ts` → `src/devtools/cursor-nodes.ts` (if solely for inspection); if part of parser API, consider `src/core/ast/cursor-nodes.ts`
- `src/temporal.ts`, `src/quantity-value.ts`, `src/decimal-boundaries.ts` → `src/values/*`
- `src/runtime-context.ts`, `src/scope-manager.ts`, `src/boxing.ts` → `src/runtime/*`
- `src/model-provider.ts` → `src/model/model-provider.ts`
- `src/operations/less-than.ts` → `src/operations/comparison/less.ts` (align with others)
- `src/operations/temporal-functions.ts` → split into discrete files under `src/operations/temporal/`.

**Operations Naming Guideline (Target State)**
- One file per FHIRPath operation, named after the FHIRPath identifier.
- If both infix operator and function share semantics (e.g., `as`, `is`, `union`), colocate in a single module that registers both forms.
- Keep registration centralized in `operations/index.ts` with clear category exports to aid discovery and code owners.

**Test Naming Guideline (Target State)**
- Use the module name and focus area: `parser-error-recovery.test.ts` → remains under `test/core/`.
- For operations, prefer `test/operations/<category>/<op>.test.ts` (e.g., `test/operations/comparison/equivalent.test.ts`).
- Keep performance-specific tests grouped (e.g., `test/perf/comparison-performance.test.ts`).

**Migration Steps (Minimal First)**
- Phase A (Minimal):
  - Move `src/completion-provider.ts` → `src/lsp/completion-provider.ts`.
  - Create `src/values/` and move `temporal.ts`, `decimal-boundaries.ts`, `quantity-value.ts`.
  - Add `src/operations/less-than.ts` re-export alias to `./less-operator` or remove if unused.
  - Create `test/helpers/` and move `test/model-provider-singleton.ts` there; fix imports in tests.
- Phase B (Stabilize): run `bun tsc --noEmit` and `bun run test`; no other refactors.

**Migration Steps (Longer‑Term, Optional)**
- Group runtime/model/analyzer/devtools as outlined; split `temporal-functions.ts`; normalize operation filenames; mirror structure in `test/`.
- Introduce a temporary alias layer (barrel re-exports) for moved modules for one release, then remove.

**Risks / Notes**
- Large move touches many imports; tackle in small PRs by domain (lsp, analyzer, values, runtime, operations).
- Registry wiring must be validated after splitting/renaming operations; add a smoke test that enumerates registered ops and compares against spec list.

**Quick Wins (Do Now)**
- Move `completion-provider.ts` → `src/lsp/`.
- Create `src/values/` and move `temporal.ts`, `decimal-boundaries.ts`, `quantity-value.ts`.
- Add alias for `less-than.ts` or remove if unused (no broad renames).
- Create `test/helpers/` and move `model-provider-singleton.ts`.

**Outcome**
- Clear boundaries between core, runtime, analyzer, LSP, values, and operations.
- Consistent operation naming and categorization aiding maintenance and onboarding.
- Tests mirror source, reducing cognitive overhead and improving discoverability.

**Per-File Inventory (src/)**
- src/index.ts - category: API entry; usage: public API for evaluate/analyze; relationships: uses Parser, Analyzer, Interpreter, RuntimeContextManager, boxing, errors, temporal helpers; exports Parser/Interpreter.
- src/parser.ts - category: core/parser; usage: builds AST; relationships: uses lexer, registry precedence, types, errors; consumed by index/analyzer/tools.
- src/lexer.ts - category: core/lexer; usage: tokenization; relationships: used by parser.
- src/interpreter.ts - category: core/interpreter; usage: evaluates AST; relationships: uses registry operations, runtime-context, scope-manager, boxing, model-provider, navigator.
- src/registry.ts - category: core/registry; usage: op/function registry; relationships: imports all from operations/, used by parser (keywords), analyzer (signatures), interpreter (dispatch).
- src/navigator.ts - category: core/navigation; usage: property traversal; relationships: used by interpreter and some functions (children/descendants).
- src/errors.ts - category: core/errors; usage: error helpers; relationships: used across parser/analyzer/interpreter/index.
- src/types.ts - category: core/types; usage: AST/type system/signatures; relationships: imported widely (parser/analyzer/registry/interpreter).
- src/runtime-context.ts - category: runtime/context; usage: create/manage evaluation context/vars; relationships: used in index/interpreter.
- src/scope-manager.ts - category: runtime/scope; usage: scope handling; relationships: used by interpreter/runtime-context.
- src/boxing.ts - category: runtime/boxing; usage: box/unbox values with type info; relationships: used in index/interpreter/temporal/quantity.
- src/model-provider.ts - category: model/provider; usage: FHIR model types lookup; relationships: used by analyzer/interpreter/index, tests.
- src/temporal.ts - category: values/temporal; usage: construct/format FHIR date/time; relationships: used by index and temporal operations.
- src/quantity-value.ts - category: values/quantity; usage: quantity representation; relationships: used by quantity/compare operations.
- src/decimal-boundaries.ts - category: values/numeric; usage: decimal rounding helpers; relationships: used by round/floor/ceiling/truncate operations.
- src/comparison.ts - category: core/comparison; usage: equality/equivalence including quantities/strings; relationships: used by comparison/equality operators and tests.
- src/analyzer.ts - category: analyzer; usage: static/type flow analysis; relationships: uses registry, analysis/*, cursor-nodes, errors, types; used by index/tools.
- src/analysis/type-compat.ts - category: analyzer/typing; usage: match signatures, resolve result types; relationships: used by analyzer.
- src/analysis/utils.ts - category: analyzer/utils; usage: param validation, union handling; relationships: used by analyzer.
- src/lsp/augmentor.ts - category: lsp; usage: augment AST for LSP; relationships: works with parser/analyzer cursor mode.
- src/lsp/cursor-services.ts - category: lsp; usage: cursor-based completions/context; relationships: used by analyzer in cursor mode.
- src/lsp/trivia-indexer.ts - category: lsp; usage: trivia capture/indexing; relationships: used by parser/LSP tests.
- src/completion-provider.ts - category: lsp (to move); usage: type-aware completion provider; relationships: uses registry, analyzer results.
- src/cursor-nodes.ts - category: devtools/lsp; usage: cursor sentinel nodes; relationships: used by parser/analyzer LSP mode.
- src/inspect.ts - category: devtools; usage: debugging/inspection utilities; relationships: used by tools/inspect.ts.
- src/utils/pprint.ts - category: utils; usage: pretty-printing; relationships: used in debugging/tools.
- src/operations/index.ts - category: operations/registry; usage: re-exports all operations; relationships: imported by registry for auto-registration.
- src/operations/plus-operator.ts - category: operation/arithmetic (operator); usage: numeric addition; relationships: used by registry/interpreter.
- src/operations/unary-plus-operator.ts - category: operation/arithmetic (unary); usage: unary plus; relationships: registry/interpreter.
- src/operations/minus-operator.ts - category: operation/arithmetic (operator); usage: numeric subtraction; relationships: registry/interpreter.
- src/operations/unary-minus-operator.ts - category: operation/arithmetic (unary); usage: negate; relationships: registry/interpreter.
- src/operations/multiply-operator.ts - category: operation/arithmetic; usage: multiply; relationships: registry/interpreter.
- src/operations/divide-operator.ts - category: operation/arithmetic; usage: divide; relationships: registry/interpreter.
- src/operations/div-operator.ts - category: operation/arithmetic; usage: integer division; relationships: registry/interpreter.
- src/operations/mod-operator.ts - category: operation/arithmetic; usage: modulo; relationships: registry/interpreter.
- src/operations/equal-operator.ts - category: operation/equality; usage: =; relationships: comparison helpers.
- src/operations/not-equal-operator.ts - category: operation/equality; usage: !=; relationships: comparison helpers.
- src/operations/equivalent-operator.ts - category: operation/equality; usage: ~; relationships: deep equivalence utilities.
- src/operations/not-equivalent-operator.ts - category: operation/equality; usage: !~; relationships: deep equivalence.
- src/operations/less-operator.ts - category: operation/comparison; usage: <; relationships: comparison helpers.
- src/operations/greater-operator.ts - category: operation/comparison; usage: >; relationships: comparison helpers.
- src/operations/less-or-equal-operator.ts - category: operation/comparison; usage: <=; relationships: comparison helpers.
- src/operations/greater-or-equal-operator.ts - category: operation/comparison; usage: >=; relationships: comparison helpers.
- src/operations/and-operator.ts - category: operation/logical; usage: and; relationships: lazy evaluation in interpreter.
- src/operations/or-operator.ts - category: operation/logical; usage: or; relationships: lazy evaluation.
- src/operations/xor-operator.ts - category: operation/logical; usage: xor; relationships: interpreter.
- src/operations/implies-operator.ts - category: operation/logical; usage: implies; relationships: interpreter.
- src/operations/in-operator.ts - category: operation/membership; usage: in; relationships: collection checks.
- src/operations/contains-operator.ts - category: operation/membership; usage: contains (operator); relationships: collection checks.
- src/operations/dot-operator.ts - category: operation/navigation; usage: property access; relationships: navigator.
- src/operations/where-function.ts - category: operation/navigation (function); usage: filter; relationships: interpreter/navigator.
- src/operations/select-function.ts - category: operation/navigation; usage: projection; relationships: interpreter.
- src/operations/children-function.ts - category: operation/navigation; usage: children; relationships: navigator.
- src/operations/descendants-function.ts - category: operation/navigation; usage: descendants; relationships: navigator.
- src/operations/ofType-function.ts - category: operation/type; usage: filter by type; relationships: registry/type system.
- src/operations/as-operator.ts - category: operation/type (operator); usage: cast; relationships: type system.
- src/operations/is-operator.ts - category: operation/type (operator); usage: type test; relationships: type system.
- src/operations/as-function.ts - category: operation/type (function); usage: cast; relationships: type system.
- src/operations/is-function.ts - category: operation/type (function); usage: type test; relationships: type system.
- src/operations/union-operator.ts - category: operation/collection (operator); usage: union; relationships: set ops.
- src/operations/union-function.ts - category: operation/collection (function); usage: union; relationships: set ops.
- src/operations/combine-operator.ts - category: operation/collection (operator); usage: list concatenation; relationships: set ops.
- src/operations/combine-function.ts - category: operation/collection (function); usage: concatenation; relationships: set ops.
- src/operations/intersect-function.ts - category: operation/collection; usage: intersection; relationships: set ops.
- src/operations/exclude-function.ts - category: operation/collection; usage: difference; relationships: set ops.
- src/operations/contains-function.ts - category: operation/collection/string; usage: contains; relationships: string/collection helpers.
- src/operations/subsetOf-function.ts - category: operation/collection; usage: subset check; relationships: set ops.
- src/operations/supersetOf-function.ts - category: operation/collection; usage: superset check; relationships: set ops.
- src/operations/distinct-function.ts - category: operation/collection; usage: deduplicate; relationships: equality.
- src/operations/isDistinct-function.ts - category: operation/collection; usage: all elements unique; relationships: equality.
- src/operations/count-function.ts - category: operation/collection; usage: length; relationships: interpreter.
- src/operations/single-function.ts - category: operation/collection; usage: assert single; relationships: interpreter.
- src/operations/first-function.ts - category: operation/collection; usage: head; relationships: interpreter.
- src/operations/last-function.ts - category: operation/collection; usage: tail; relationships: interpreter.
- src/operations/tail-function.ts - category: operation/collection; usage: drop first; relationships: interpreter.
- src/operations/take-function.ts - category: operation/collection; usage: take N; relationships: interpreter.
- src/operations/skip-function.ts - category: operation/collection; usage: skip N; relationships: interpreter.
- src/operations/join-function.ts - category: operation/string; usage: join with separator; relationships: string utils.
- src/operations/replace-function.ts - category: operation/string; usage: replace substring; relationships: regex.
- src/operations/replaceMatches-function.ts - category: operation/string; usage: regex replace; relationships: regex.
- src/operations/indexOf-function.ts - category: operation/string; usage: indexOf; relationships: string.
- src/operations/lastIndexOf-function.ts - category: operation/string; usage: lastIndexOf; relationships: string.
- src/operations/substring-function.ts - category: operation/string; usage: substring; relationships: string.
- src/operations/matches-function.ts - category: operation/string; usage: regex test; relationships: regex.
- src/operations/matchesFull-function.ts - category: operation/string; usage: full regex match; relationships: regex.
- src/operations/toChars-function.ts - category: operation/string; usage: split to chars; relationships: string.
- src/operations/startsWith-function.ts - category: operation/string; usage: prefix test; relationships: string.
- src/operations/endsWith-function.ts - category: operation/string; usage: suffix test; relationships: string.
- src/operations/length-function.ts - category: operation/string/collection; usage: length; relationships: string/collection.
- src/operations/trim-function.ts - category: operation/string; usage: trim; relationships: string.
- src/operations/split-function.ts - category: operation/string; usage: split; relationships: string.
- src/operations/not-function.ts - category: operation/logical (function); usage: logical not; relationships: interpreter.
- src/operations/all-function.ts - category: operation/predicate; usage: all elements satisfy; relationships: analyzer/interpreter.
- src/operations/empty-function.ts - category: operation/predicate; usage: is empty; relationships: interpreter.
- src/operations/exists-function.ts - category: operation/predicate; usage: exists; relationships: interpreter.
- src/operations/allTrue-function.ts - category: operation/predicate; usage: all true; relationships: interpreter.
- src/operations/allFalse-function.ts - category: operation/predicate; usage: all false; relationships: interpreter.
- src/operations/anyTrue-function.ts - category: operation/predicate; usage: any true; relationships: interpreter.
- src/operations/anyFalse-function.ts - category: operation/predicate; usage: any false; relationships: interpreter.
- src/operations/iif-function.ts - category: operation/conditional; usage: ternary; relationships: interpreter.
- src/operations/defineVariable-function.ts - category: operation/utility; usage: define %var; relationships: runtime-context.
- src/operations/temporal-functions.ts - category: operation/temporal (bundle); usage: now/today/timeOfDay + to*/convertsTo*; relationships: temporal values.
- src/operations/dateOf-function.ts - category: operation/temporal; usage: extract date; relationships: temporal values.
- src/operations/timeOf-function.ts - category: operation/temporal; usage: extract time; relationships: temporal values.
- src/operations/yearOf-function.ts - category: operation/temporal; usage: component; relationships: temporal values.
- src/operations/monthOf-function.ts - category: operation/temporal; usage: component; relationships: temporal values.
- src/operations/dayOf-function.ts - category: operation/temporal; usage: component; relationships: temporal values.
- src/operations/hourOf-function.ts - category: operation/temporal; usage: component; relationships: temporal values.
- src/operations/minuteOf-function.ts - category: operation/temporal; usage: component; relationships: temporal values.
- src/operations/secondOf-function.ts - category: operation/temporal; usage: component; relationships: temporal values.
- src/operations/millisecondOf-function.ts - category: operation/temporal; usage: component; relationships: temporal values.
- src/operations/timezoneOffsetOf-function.ts - category: operation/temporal; usage: tz offset; relationships: temporal values.
- src/operations/lowBoundary-function.ts - category: operation/quantity; usage: quantity boundary; relationships: quantity/values.
- src/operations/highBoundary-function.ts - category: operation/quantity; usage: quantity boundary; relationships: quantity/values.
- src/operations/abs-function.ts - category: operation/math; usage: abs; relationships: numeric.
- src/operations/sqrt-function.ts - category: operation/math; usage: sqrt; relationships: numeric.
- src/operations/power-function.ts - category: operation/math; usage: power; relationships: numeric.
- src/operations/round-function.ts - category: operation/math/temporal; usage: round; relationships: decimal-boundaries.
- src/operations/floor-function.ts - category: operation/math; usage: floor; relationships: decimal-boundaries.
- src/operations/ceiling-function.ts - category: operation/math; usage: ceiling; relationships: decimal-boundaries.
- src/operations/truncate-function.ts - category: operation/math; usage: truncate; relationships: decimal-boundaries.
- src/operations/toInteger-function.ts - category: operation/type-conversion; usage: toInteger; relationships: types.
- src/operations/toDecimal-function.ts - category: operation/type-conversion; usage: toDecimal; relationships: types.
- src/operations/toString-function.ts - category: operation/type-conversion; usage: toString; relationships: types.
- src/operations/toBoolean-function.ts - category: operation/type-conversion; usage: toBoolean; relationships: types.
- src/operations/convertsToInteger-function.ts - category: operation/type-check; usage: can convert; relationships: types.
- src/operations/convertsToDecimal-function.ts - category: operation/type-check; usage: can convert; relationships: types.
- src/operations/convertsToString-function.ts - category: operation/type-check; usage: can convert; relationships: types.
- src/operations/convertsToBoolean-function.ts - category: operation/type-check; usage: can convert; relationships: types.
- src/operations/convertsToLong-function.ts - category: operation/type-check; usage: can convert; relationships: types.
- src/operations/convertsToQuantity-function.ts - category: operation/type-check; usage: can convert; relationships: quantity types.
- src/operations/length-function.ts - category: operation/string/collection; usage: length; relationships: interpreter.
- src/operations/less-than.ts - category: operation/comparison (inconsistent); usage: redundant alias; relationships: should map to less-operator.
- src/operations/trace-function.ts - category: operation/dev/utility; usage: debug tracing; relationships: inspect tooling.
- src/analysis and src/lsp directories listed above.

---

## Alternatives & Recommendation (Long-Term Reorg)

### Objectives
- Discoverability: Clear homes for core, analyzer, LSP, operations, values.
- Modularity: Isolate layers; enable optional features/tree-shaking.
- Stability: Minimize public API churn; support gradual migration.
- Performance: Keep hot paths shallow; avoid deep import chains.
- LSP-Friendly: Preserve trivia/positions; decouple analyzer/LSP.

### Alternatives
- Alt 1 — Layered Mono-Package (Baseline): `core/`, `runtime/`, `model/`, `values/`, `analyzer/`, `lsp/`, `devtools/`, `operations/`.
  - Pros: Simple build, easy refactors, minimal infra changes.
  - Cons: Single release unit; relies on tree-shaking for partial consumers.

- Alt 2 — Monorepo Multi-Package: `@fhirpath/{core,analyzer,lsp,operations-*,tools}`.
  - Pros: Strong boundaries, smaller installs, independent versioning.
  - Cons: Workspace overhead, cross-package refactor friction, version sync.

- Alt 3 — Plugin/Registry-Driven Ops: Core loads ops via registry; ops as optional packs.
  - Pros: Pluggable operation sets; minimal builds for targeted users.
  - Cons: Loader indirection; more complex tests/build; runtime wiring.

- Alt 4 — Virtual Structure via Barrels: Keep files, expose clean structure via barrels/exports.
  - Pros: Zero-churn imports; incremental internal reshaping; easy rollback.
  - Cons: Physical layout remains noisy; risk of drift vs “virtual” map.

- Alt 5 — Codegen-Centric Ops: Spec metadata → generate op stubs/registry/tests.
  - Pros: Consistent naming/signatures; cheap splits/renames; drift checks.
  - Cons: Generator maintenance; larger diffs for generated code.

- Alt 6 — Type/Value-Centric Slicing: Organize by domain (`numeric/`, `string/`, `temporal/`, `quantity/`).
  - Pros: Co-locates ops with helpers; domain ownership clarity.
  - Cons: Cross-cutting ops span domains; registry mapping broadens.

### Naming & Modules
- File names match FHIRPath identifiers; pick camelCase or kebab-case and enforce.
- One module per identifier exporting both operator/function variants when both exist.
- Keep `operations/index.ts` as the single registry export; category barrels optional.
- Use package `exports` to expose a stable public API; keep internals private.

### Migration Strategies
- Incremental + Aliases: Add barrels and `tsconfig.paths`; move files gradually with re-exports.
- Category Sprints: Reorg by operation category in small PRs; update registry/tests per sprint.
- Compat Window: Deprecate old import paths; add a lint rule to forbid after N releases.

### Decision Factors
- Consumers: External import patterns; need for per-feature installs.
- Release Cadence: Ability to coordinate breaking changes.
- Tooling: Appetite for workspaces/plugins/codegen.
- Team Size: Layer ownership vs domain ownership.

### Recommendation
- Adopt Alt 1 (Layered Mono-Package) now, with category-structured `operations/` and unified per-identifier modules. Prepare for potential evolution to Alt 2 or Alt 3 by:
  - Keeping clean public barrels and private internals.
  - Avoiding deep inter-layer coupling.

### Next Steps
- Write ADR capturing chosen structure, naming convention, and deprecation policy.
- Add public barrels and package `exports` to stabilize imports before physical moves.
- Spike: small POCs — (a) plugin-loaded ops pack, (b) codegen of 3–5 ops — to assess ROI.

---

## Mid-Term Restructure (Simple, Relationship-Oriented)

### Scope
- Reflect intended layers and dependencies with minimal churn.
- Keep public API stable; prefer re-exports over renames.

### Directory Layout (target)
- src/core: `lexer.ts`, `parser.ts`, `interpreter.ts`, `registry.ts`, `navigator.ts`, `errors.ts`, `types.ts`.
- src/analyzer: `analyzer.ts`, `analysis/*` (moved under this folder).
- src/lsp: `completion-provider.ts`, `augmentor.ts`, `cursor-services.ts`, `trivia-indexer.ts`.
- src/values: `temporal.ts`, `decimal-boundaries.ts`, `quantity-value.ts`.
- src/runtime: `boxing.ts` (+ `runtime-context.ts` if/when introduced).
- src/operations: category folders only; keep existing files, add barrels.
  - arithmetic/, logical/, comparison/, collection/, navigation/, string/, temporal/, type/.
- src/devtools: `inspect.ts`, trace/debug helpers as needed.

### Operations Organization
- Keep current file names; introduce category `index.ts` barrels re-exporting existing modules.
- Consolidate only obvious inconsistencies now:
  - `less-than.ts` → re-export from `less-operator.ts` (deprecate the former).
  - `temporal-functions.ts` → keep for now; add a small barrel to expose already split functions (`yearOf`, `dateOf`, `timeOf`) when available.
- Maintain `*-function.ts`/`*-operator.ts` suffixes for this phase to avoid wide changes.

### Registry & Dependencies
- Keep `operations/index.ts` as the single aggregator; switch imports to category barrels.
- Relationships:
  - Interpreter depends on `registry` and `navigator` (core → operations).
  - Analyzer reads function/operator signatures from `registry` (analyzer → core/operations types only).
  - LSP composes `parser` + `analyzer` and does not depend on interpreter.

### Tests Layout
- Create `test/helpers/` and move `model-provider-singleton.ts` there.
- Group tests by layer/category without renaming test files:
  - `test/core/`, `test/analyzer/`, `test/lsp/`, `test/operations/<category>/`.
- Keep existing fixtures; update imports to `test/helpers/*`.

### Import Stability
- Add barrels: `src/core/index.ts`, `src/analyzer/index.ts`, `src/lsp/index.ts`, `src/values/index.ts`, and per-operations category barrels.
- Optionally add `tsconfig.paths` aliases (`@core`, `@analyzer`, `@lsp`, `@values`, `@operations/*`) to decouple paths from physical layout.

### Migration Plan (PR-sized steps)
- Step 1: Add barrels for `core`, `analyzer`, `lsp`, `values` (no file moves). Update a few internal imports to validate.
- Step 2: Move `completion-provider.ts` → `src/lsp/`; fix imports.
- Step 3: Create `src/values/` and move `temporal.ts`, `decimal-boundaries.ts`, `quantity-value.ts`.
- Step 4: Create `src/operations/<category>/` folders; add `index.ts` per category re-exporting current files.
- Step 5: Point `operations/index.ts` to category barrels; keep old deep paths re-exported for a deprecation window.
- Step 6: Deprecate `operations/less-than.ts` (re-export from `less-operator.ts`).
- Step 7: Move `test/model-provider-singleton.ts` → `test/helpers/` and update imports.
- Step 8: Run `bun tsc --noEmit` and `bun run test`; fix import path fallout only.

### Notes
- This preserves hot-path simplicity: interpreter ↔ registry under `core/operations` with shallow imports.
- Analyzer/LSP remain clearly separated and can evolve independently.
