# Analyzer — Duplication in Argument/Type Checks

## Scope
- File: `src/analyzer.ts`
- Focus: Repeated argument/type checking logic in `analyzeFunction` and related diagnostic formatting.

## Duplicated Blocks
- No-matching-signature branch (~426–455): loops parameters and reports mismatches.
- Input-matches-but-params-don’t (~475–511): repeats the same comparison/diagnostic logic.
- Matching-signature branch (~555–606): repeats comparison + empty-propagation handling.
- Common repeated pieces:
  - Type string formatting for diagnostics (e.g., `Integer[]`).
  - Decimal-expected vs Integer-actual compatibility.
  - Singleton checks and when to warn vs error.
  - Empty-collection handling (propagation warning).
  - Skipping expression parameters.

## Helper APIs
- `formatType(t: TypeInfo): string`
  - Purpose: consistent type names in diagnostics.
  - Behavior: singleton → `Type`, collection → `Type[]`.

- `isEmptyCollection(t: TypeInfo): boolean`
  - Purpose: unify emptiness checks.
  - Behavior: return `true` only when `t.isEmpty === true`.
  - Note: do not treat `Any[]` as empty; that’s unknown, not empty.

- `checkParamTypes(sig, argTypes, nodes, opts): Diagnostic[]`
  - Signature:
    - `sig: FunctionSignature`
    - `argTypes: TypeInfo[]`
    - `nodes: ASTNode[]` (for ranges)
    - `opts: { warnOnSingletonOnly: boolean; doesNotPropagateEmpty: boolean; treatEmptyAsWarning?: boolean; }`
  - Logic per-param (skip if `param.expression`):
    - Compute `typeMatch` with Decimal-accepts-Integer rule.
    - Compute `singletonMatch` (`!expected.singleton || arg.singleton`).
    - If `isEmptyCollection(argType)` and `!doesNotPropagateEmpty` and `treatEmptyAsWarning !== false`:
      - Push Warning: “Argument i: expected X, got empty collection. Result will be empty.”
      - Continue.
    - If mismatch:
      - If `(typeMatch && !singletonMatch && warnOnSingletonOnly)` → Warning.
      - Else → Error.
    - Use `formatType()` for expected/actual strings.

## Refactor Plan (analyzeFunction)
1. Arity pre-filter:
   - Compute `required..max` per signature, build `byArity = signatures.filter(sig => actualCount in range)`.
   - If none match by arity → fast WRONG_ARGUMENT_COUNT diagnostic using min/max across all signatures.
2. Collect `argTypes` (unchanged), but ensure expression-parameter context sets input to item type:
   - `const exprCtx = context.withInputType(itemType).withSystemVariable('$this', itemType).withSystemVariable('$index', Integer)`.
3. Try `matchFunctionSignature(context.inputType, argTypes, funcDef)` against `byArity` first (or let matcher consider arity).
4. If matchingSignature:
   - `diagnostics.push(...checkParamTypes(matchingSignature, argTypes, node.arguments, { warnOnSingletonOnly: true, doesNotPropagateEmpty: !!funcDef.doesNotPropagateEmpty }))`.
   - Infer result via `resolveResultType`.
5. If no matching signature:
   - If `input.isEmpty === true` and function propagates empties → return empty result; optionally still call `checkParamTypes` to surface arg issues as warnings.
   - Else try “input-only matches” (ignore params) to produce targeted param diagnostics using `checkParamTypes`.
   - Else produce one `INVALID_OPERAND_TYPE` with expected input types summary.
6. Remove the three inlined loops; replace with the single helper call.

## Edge Cases & Policies
- Decimal vs Integer: allow Integer where Decimal expected.
- Expression parameters: skip type validation (runtime-evaluated).
- Empty propagation: warnings only when function propagates empty; otherwise evaluate mismatches normally.
- Singleton-only mismatch: prefer warning; configurable via `warnOnSingletonOnly`.
- Do not conflate unknown collection (`Any[]`) with empty; only `isEmpty === true` means empty.

## Suggested Location
- New module: `src/analysis/utils.ts` to host `formatType`, `isEmptyCollection`, `checkParamTypes`.
- Import into `analyzer.ts` (and reuse elsewhere later).

## Example Helper Stubs (illustrative)
```ts
// src/analysis/utils.ts
import type { ASTNode, Diagnostic, FunctionSignature, TypeInfo } from '../types';
import { DiagnosticSeverity } from '../types';

export function formatType(t: TypeInfo): string {
  const base = t.type;
  return t.singleton ? base : `${base}[]`;
}

export function isEmptyCollection(t: TypeInfo): boolean {
  return t.isEmpty === true;
}

export function checkParamTypes(
  sig: FunctionSignature,
  argTypes: TypeInfo[],
  nodes: ASTNode[],
  opts: { warnOnSingletonOnly: boolean; doesNotPropagateEmpty: boolean; treatEmptyAsWarning?: boolean }
): Diagnostic[] {
  const diags: Diagnostic[] = [];
  const params = sig.parameters || [];
  for (let i = 0; i < params.length; i++) {
    const param = params[i];
    const arg = argTypes[i];
    if (!param || !arg || param.expression) { continue; }

    if (isEmptyCollection(arg) && !opts.doesNotPropagateEmpty && opts.treatEmptyAsWarning !== false) {
      diags.push({
        range: nodes[i]?.range ?? nodes[0]?.range,
        severity: DiagnosticSeverity.Warning,
        message: `Argument ${i + 1}: expected ${formatType(param.type)}, got empty collection. Result will be empty.`,
        source: 'fhirpath'
      });
      continue;
    }

    const typeMatch = param.type.type === 'Any' || arg.type === 'Any' ||
      param.type.type === arg.type ||
      (param.type.type === 'Decimal' && arg.type === 'Integer');
    const singletonMatch = !param.type.singleton || arg.singleton === true;

    if (!typeMatch || !singletonMatch) {
      const msg = `Argument ${i + 1}: expected ${formatType(param.type)}, got ${formatType(arg)}`;
      const severity = (typeMatch && !singletonMatch && opts.warnOnSingletonOnly)
        ? DiagnosticSeverity.Warning
        : DiagnosticSeverity.Error;
      diags.push({ range: nodes[i]?.range ?? nodes[0]?.range, severity, message: msg, source: 'fhirpath' });
    }
  }
  return diags;
}
```

## Benefits
- Single source of truth for parameter validation rules and diagnostic text.
- Shrinks `analyzeFunction`, reduces bug surface from drift.
- Easier to evolve compatibility (e.g., extend numeric coercions) in one place.

