import { RuntimeContextManager } from '../runtime/context';
import type { RuntimeContext } from '../runtime/context';

/**
 * Adapter functions to help transition compiler operations to prototype-based context.
 * These can be used to gradually migrate operations.
 */

/**
 * Create an iterator context using prototype inheritance
 * instead of spread operator copying.
 */
export function createIteratorContext(
  ctx: RuntimeContext,
  item: any,
  index: number
): RuntimeContext {
  return RuntimeContextManager.withIterator(ctx, item, index);
}

/**
 * Create a context with new input/focus using prototype inheritance
 */
export function createInputContext(
  ctx: RuntimeContext,
  input: any[],
  focus?: any[]
): RuntimeContext {
  return RuntimeContextManager.withInput(ctx, input, focus);
}

/**
 * Set a variable in context using prototype inheritance
 */
export function setContextVariable(
  ctx: RuntimeContext,
  name: string,
  value: any[]
): RuntimeContext {
  return RuntimeContextManager.setVariable(ctx, name, value);
}

/**
 * Example of how to update the where operation to use prototype-based context
 */
export function whereWithPrototypeContext(
  input: { fn: (ctx: RuntimeContext) => any[] },
  criteria: { fn: (ctx: RuntimeContext) => any[] }
) {
  return {
    fn: (ctx: RuntimeContext) => {
      const inputValue = input.fn(ctx);
      const results: any[] = [];
      
      for (let i = 0; i < inputValue.length; i++) {
        const item = inputValue[i];
        // Use prototype-based context instead of spread operator
        const iterCtx = createIteratorContext(ctx, item, i);
        const predicateResult = criteria.fn(iterCtx);
        
        if (isTruthy(predicateResult)) {
          results.push(item);
        }
      }
      
      return results;
    }
  };
}

/**
 * Example of how to update the select operation to use prototype-based context
 */
export function selectWithPrototypeContext(
  input: { fn: (ctx: RuntimeContext) => any[] },
  expression: { fn: (ctx: RuntimeContext) => any[] }
) {
  return {
    fn: (ctx: RuntimeContext) => {
      const inputValue = input.fn(ctx);
      const results: any[] = [];
      
      for (let i = 0; i < inputValue.length; i++) {
        const item = inputValue[i];
        // Use prototype-based context instead of spread operator
        const iterCtx = createIteratorContext(ctx, item, i);
        const exprResult = expression.fn(iterCtx);
        results.push(...exprResult);
      }
      
      return results;
    }
  };
}

// Helper function (should be imported from utils)
function isTruthy(value: any[]): boolean {
  return value.length > 0 && value[0] === true;
}