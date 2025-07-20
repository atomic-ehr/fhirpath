import type { ASTNode, FunctionNode, IdentifierNode } from '../parser/ast';
import type { Context, EvaluationResult } from './types';
import type { Interpreter } from './interpreter';
import { EvaluationError } from './types';
import { ContextManager } from './context';

/**
 * Function definition for the registry
 */
export interface FunctionDefinition {
  name: string;
  arity: number | { min: number; max?: number };
  // Some functions control argument evaluation (e.g., where, select, iif)
  evaluateArgs?: boolean; // Default true
  evaluate: (
    interpreter: Interpreter,
    args: ASTNode[],
    input: any[],
    context: Context
  ) => EvaluationResult;
}

/**
 * Registry of built-in FHIRPath functions
 */
export class FunctionRegistry {
  private static functions = new Map<string, FunctionDefinition>();

  /**
   * Register a function
   */
  static register(fn: FunctionDefinition) {
    this.functions.set(fn.name, fn);
  }

  /**
   * Get a function definition
   */
  static get(name: string): FunctionDefinition | undefined {
    return this.functions.get(name);
  }

  /**
   * Check if a function exists
   */
  static has(name: string): boolean {
    return this.functions.has(name);
  }

  /**
   * Evaluate a function call
   */
  static evaluate(
    interpreter: Interpreter,
    node: FunctionNode,
    input: any[],
    context: Context
  ): EvaluationResult {
    const funcName = (node.name as IdentifierNode).name;
    const funcDef = this.get(funcName);

    if (!funcDef) {
      throw new EvaluationError(`Unknown function: ${funcName}`, node.position);
    }

    // Check arity
    const argCount = node.arguments.length;
    if (typeof funcDef.arity === 'number') {
      if (argCount !== funcDef.arity) {
        throw new EvaluationError(
          `Function ${funcName} expects ${funcDef.arity} arguments, got ${argCount}`,
          node.position
        );
      }
    } else {
      const { min, max } = funcDef.arity;
      if (argCount < min || (max !== undefined && argCount > max)) {
        const expected = max !== undefined ? `${min}-${max}` : `at least ${min}`;
        throw new EvaluationError(
          `Function ${funcName} expects ${expected} arguments, got ${argCount}`,
          node.position
        );
      }
    }

    // Evaluate arguments if needed (default behavior)
    if (funcDef.evaluateArgs !== false) {
      const evaluatedArgs: any[][] = [];
      for (const arg of node.arguments) {
        const result = interpreter.evaluate(arg, input, context);
        evaluatedArgs.push(result.value);
        // Note: We don't thread context through args evaluation
      }
      // For pre-evaluated args, we pass the values directly
      return funcDef.evaluate(interpreter, evaluatedArgs as any, input, context);
    }

    // Pass unevaluated AST nodes (for functions that control evaluation)
    return funcDef.evaluate(interpreter, node.arguments, input, context);
  }
}

// Register built-in functions

// where(expression) - filters input collection
FunctionRegistry.register({
  name: 'where',
  arity: 1,
  evaluateArgs: false, // We control evaluation with $this
  evaluate: (interpreter, args, input, context) => {
    const results: any[] = [];
    const predicate = args[0];

    for (let i = 0; i < input.length; i++) {
      const item = input[i];
      // Set $this and $index for the predicate evaluation
      const iterContext = ContextManager.setIteratorContext(context, item, i);
      
      // Evaluate predicate with item as both input and $this
      const predicateResult = interpreter.evaluate(predicate!, [item], iterContext);
      
      // Check if predicate is true (with singleton conversion)
      if (predicateResult.value.length > 0) {
        // Convert to boolean - empty is false, non-empty is true
        const isTrue = predicateResult.value.length === 1 
          ? predicateResult.value[0] === true
          : true; // Non-empty collection is truthy
          
        if (isTrue) {
          results.push(item);
        }
      }
    }

    return { value: results, context };
  }
});

// select(expression) - transforms each item
FunctionRegistry.register({
  name: 'select',
  arity: 1,
  evaluateArgs: false, // We control evaluation with $this
  evaluate: (interpreter, args, input, context) => {
    const results: any[] = [];
    const expression = args[0];

    for (let i = 0; i < input.length; i++) {
      const item = input[i];
      // Set $this and $index for the expression evaluation
      const iterContext = ContextManager.setIteratorContext(context, item, i);
      
      // Evaluate expression with item as both input and $this
      const exprResult = interpreter.evaluate(expression!, [item], iterContext);
      
      // Add all results (flattened)
      results.push(...exprResult.value);
    }

    return { value: results, context };
  }
});

// iif(condition, then, else) - conditional with lazy evaluation
FunctionRegistry.register({
  name: 'iif',
  arity: 3,
  evaluateArgs: false, // We need lazy evaluation
  evaluate: (interpreter, args, input, context) => {
    const [conditionExpr, thenExpr, elseExpr] = args;

    // Evaluate condition
    const conditionResult = interpreter.evaluate(conditionExpr!, input, context);
    
    // Check condition (empty = false, true = true, anything else = true)
    let conditionValue = false;
    if (conditionResult.value.length > 0) {
      conditionValue = conditionResult.value.length === 1
        ? conditionResult.value[0] === true
        : true; // Non-empty collection is truthy
    }

    // Evaluate appropriate branch
    if (conditionValue) {
      return interpreter.evaluate(thenExpr!, input, conditionResult.context);
    } else {
      return interpreter.evaluate(elseExpr!, input, conditionResult.context);
    }
  }
});

// defineVariable(name, value) - adds variable to context
FunctionRegistry.register({
  name: 'defineVariable',
  arity: 2,
  evaluateArgs: false, // We need to handle the name specially
  evaluate: (interpreter, args, input, context) => {
    if (args.length !== 2) {
      throw new EvaluationError('defineVariable requires exactly 2 arguments');
    }

    // First argument must be a string literal (variable name)
    const nameArg = args[0]!;
    // Import NodeType enum to use proper type checking
    const { NodeType } = require('../parser/ast');
    if (nameArg.type !== NodeType.Literal || typeof (nameArg as any).value !== 'string') {
      throw new EvaluationError('defineVariable first argument must be a string literal');
    }

    const varName = (nameArg as any).value;
    
    // Evaluate the value expression
    const valueResult = interpreter.evaluate(args[1]!, input, context);
    
    // Add variable to context
    const newContext = ContextManager.setVariable(valueResult.context, varName, valueResult.value);
    
    // Return original input with modified context
    return { value: input, context: newContext };
  }
});

// first() - returns first item from collection
FunctionRegistry.register({
  name: 'first',
  arity: 0,
  evaluate: (interpreter, args, input, context) => {
    const result = input.length > 0 ? [input[0]] : [];
    return { value: result, context };
  }
});