import type { ASTNode, Diagnostic, FunctionSignature, TypeInfo } from '../types';
import { DiagnosticSeverity } from '../types';

/** Formats a TypeInfo into a user-facing string (e.g., Integer, Decimal[]). */
export function formatType(t: TypeInfo): string {
  const base = t.type;
  return t.singleton ? base : `${base}[]`;
}

/**
 * Determines if a type should be treated as an empty collection for diagnostics.
 * Mirrors existing analyzer semantics: consider explicit isEmpty or Any-collections as empty.
 */
export function isEmptyCollection(t: TypeInfo | undefined): boolean {
  if (!t) {
    return false;
  }
  return t.isEmpty === true || (t.type === 'Any' && t.singleton === false);
}

/**
 * Checks parameter types against a signature and returns diagnostics.
 * - Skips expression parameters.
 * - Treats Decimal-expected vs Integer-actual as compatible.
 * - Emits warnings for empty collections when allowed and function propagates empty.
 */
export function checkParamTypes(
  sig: FunctionSignature,
  argTypes: TypeInfo[],
  nodes: ASTNode[],
  opts: {
    warnOnSingletonOnly: boolean;
    doesNotPropagateEmpty: boolean;
    treatEmptyAsWarning?: boolean;
    errorCode?: string;
  }
): Diagnostic[] {
  const diags: Diagnostic[] = [];
  const params = sig.parameters || [];
  for (let i = 0; i < params.length; i++) {
    const param = params[i];
    const arg = argTypes[i];
    const node = (nodes[i] ?? nodes[0])!;
    if (!param || !arg || param.expression) {
      continue;
    }

    if (
      isEmptyCollection(arg) &&
      !opts.doesNotPropagateEmpty &&
      opts.treatEmptyAsWarning !== false
    ) {
      diags.push({
        range: node.range,
        severity: DiagnosticSeverity.Warning,
        message: `Argument ${i + 1}: expected ${formatType(param.type)}, got empty collection. Result will be empty.`,
        source: 'fhirpath',
        code: opts.errorCode,
      });
      continue;
    }

    const typeMatch =
      param.type.type === 'Any' ||
      arg.type === 'Any' ||
      param.type.type === arg.type ||
      (param.type.type === 'Decimal' && arg.type === 'Integer');
    const singletonMatch = !param.type.singleton || arg.singleton === true;

    if (!typeMatch || !singletonMatch) {
      const msg = `Argument ${i + 1}: expected ${formatType(param.type)}, got ${formatType(arg)}`;
      const severity = typeMatch && !singletonMatch && opts.warnOnSingletonOnly
        ? DiagnosticSeverity.Warning
        : DiagnosticSeverity.Error;
      diags.push({
        range: node.range,
        severity,
        message: msg,
        source: 'fhirpath',
        code: opts.errorCode,
      });
    }
  }
  return diags;
}
