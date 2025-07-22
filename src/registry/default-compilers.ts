import type { Compiler, CompiledExpression } from './types';

export function defaultFunctionCompile(
  compiler: Compiler,
  input: CompiledExpression,
  args: CompiledExpression[]
): CompiledExpression {
  // Default implementation returns a simple pass-through
  return {
    fn: (ctx) => {
      throw new Error('Function compile not implemented');
    },
    type: compiler.resolveType('Any'),
    isSingleton: false
  };
}

export function defaultOperatorCompile(
  compiler: Compiler,
  left: CompiledExpression,
  right: CompiledExpression[]
): CompiledExpression {
  // Default implementation returns a simple pass-through
  return {
    fn: (ctx) => {
      throw new Error('Operator compile not implemented');
    },
    type: compiler.resolveType('Any'),
    isSingleton: false
  };
}