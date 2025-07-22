import type { Compiler, CompiledExpression } from './types';

export function defaultFunctionCompile(
  compiler: Compiler,
  input: CompiledExpression,
  args: CompiledExpression[]
): CompiledExpression {
  throw new Error('Compiler not implemented');
}