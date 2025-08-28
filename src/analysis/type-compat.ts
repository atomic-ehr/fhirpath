import type {
  TypeInfo,
  OperatorDefinition,
  OperatorSignature,
  FunctionDefinition,
  FunctionSignature,
  TypeName,
} from '../types';
import { registry } from '../registry';

export function isTypeCompatible(source: TypeInfo, target: TypeInfo): boolean {
  return registry.isTypeCompatible(source, target);
}

export function matchOperatorSignature(
  left: TypeInfo,
  right: TypeInfo,
  def?: OperatorDefinition
): OperatorSignature | undefined {
  if (!def || !def.signatures || def.signatures.length === 0) return undefined;

  let best: { sig: OperatorSignature; score: number; tieBias: number } | undefined;

  for (const sig of def.signatures) {
    const leftOk = isTypeCompatible(left, sig.left);
    const rightOk = isTypeCompatible(right, sig.right);
    if (!leftOk || !rightOk) continue;

    const leftScore = specificity(left, sig.left);
    const rightScore = specificity(right, sig.right);
    let score = leftScore + rightScore;

    // Prefer decimal math when any operand is Decimal
    const anyActualDecimal = left.type === 'Decimal' || right.type === 'Decimal';
    const sigHasDecimal = sig.left.type === 'Decimal' || sig.right.type === 'Decimal';
    const tieBias = anyActualDecimal && sigHasDecimal ? 1 : 0;

    if (!best || score > best.score || (score === best.score && tieBias > best.tieBias)) {
      best = { sig, score, tieBias };
    }
  }

  return best?.sig;
}

function specificity(actual: TypeInfo, required: TypeInfo): number {
  if (required.type === 'Any') return 0;
  if (actual.type === required.type) return 3;
  // numeric widening
  const numeric = new Set<TypeName>(['Integer', 'Decimal']);
  if (numeric.has(actual.type) && numeric.has(required.type)) return 2;
  return 1;
}

export function matchFunctionSignature(
  input: TypeInfo,
  args: TypeInfo[],
  def?: FunctionDefinition
): FunctionSignature | undefined {
  if (!def || !def.signatures || def.signatures.length === 0) return undefined;

  let best: { sig: FunctionSignature; score: number; tieBias: number } | undefined;

  for (const sig of def.signatures) {
    // Input compatibility (if specified)
    if (sig.input && !isFunctionTypeCompatible(input, sig.input)) {
      continue;
    }

    let ok = true;
    let score = 0;
    let tieBias = 0;
    const params = sig.parameters || [];
    for (let i = 0; i < Math.min(args.length, params.length); i++) {
      const argType = args[i]!;
      const param = params[i]!;
      if (param.expression) {
        continue; // expression params are analyzed in their own context
      }

      const isEmptyArg = argType.isEmpty || (argType.type === 'Any' && !argType.singleton);
      if (isEmptyArg && !def.doesNotPropagateEmpty) {
        continue; // empty propagates; don't penalize
      }

      if (!isFunctionTypeCompatible(argType, param.type)) {
        ok = false;
        break;
      }
      score += specificity(argType, param.type);

      // Prefer decimal params when actual is Decimal
      if (argType.type === 'Decimal' && param.type.type === 'Decimal') {
        tieBias += 1;
      }
    }

    if (!ok) continue;

    // Add input specificity
    if (sig.input) {
      score += specificity(input, sig.input);
      if (input.type === 'Decimal' && sig.input.type === 'Decimal') tieBias += 1;
    }

    if (!best || score > best.score || (score === best.score && tieBias > best.tieBias)) {
      best = { sig, score, tieBias };
    }
  }

  return best?.sig;
}

function isFunctionTypeCompatible(actual: TypeInfo, expected: TypeInfo): boolean {
  // Enforce singleton when required
  if (expected.singleton && !actual.singleton) return false;
  if (expected.type === 'Any') return true;
  if (actual.type === expected.type) return true;
  // Allow Integer to be used where Decimal is expected (promotion)
  if (expected.type === 'Decimal' && actual.type === 'Integer') return true;
  return false;
}

export type ResultSpec =
  | TypeInfo
  | 'inputType'
  | 'inputTypeSingleton'
  | 'leftType'
  | 'rightType'
  | 'parameterType';

export function resolveResultType(
  spec: ResultSpec,
  ctx: {
    input?: TypeInfo;
    left?: TypeInfo;
    right?: TypeInfo;
    firstParam?: TypeInfo;
  }
): TypeInfo {
  if (typeof spec !== 'string') return spec;

  switch (spec) {
    case 'inputType':
      return ctx.input || { type: 'Any', singleton: false };
    case 'inputTypeSingleton':
      return ctx.input ? { ...ctx.input, singleton: true } : { type: 'Any', singleton: true };
    case 'leftType':
      return ctx.left ? { ...ctx.left, singleton: false } : { type: 'Any', singleton: false };
    case 'rightType':
      return ctx.right ? { ...ctx.right, singleton: false } : { type: 'Any', singleton: false };
    case 'parameterType':
      return ctx.firstParam ? { ...ctx.firstParam, singleton: false } : { type: 'Any', singleton: false };
    default:
      return { type: 'Any', singleton: false };
  }
}
