import type { ASTNode, FunctionNode, IdentifierNode, BinaryNode } from '../parser/ast';
import { NodeType } from '../parser/ast';
import type { Context, EvaluationResult } from './types';
import type { Interpreter } from './interpreter';
import { EvaluationError, CollectionUtils } from './types';
import { ContextManager } from './context';
import { InputValidators, ArgumentValidators } from './helpers';
import type { EnhancedFunctionDefinition } from './signature-system/types';
import { enhancedToStandardFunction } from './signature-system/enhanced-registry';

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
    args: ASTNode[] | any[][],  // ASTNode[] when evaluateArgs is false, any[][] when true
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
  static register(fn: FunctionDefinition | EnhancedFunctionDefinition) {
    if ('arity' in fn) {
      this.functions.set(fn.name, fn);
    } else {
      // Convert enhanced function to standard function
      const standardFn = enhancedToStandardFunction(fn);
      this.functions.set(standardFn.name, standardFn);
    }
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
    let funcName: string;
    
    // Handle different function name patterns
    if (node.name.type === NodeType.Identifier) {
      funcName = (node.name as IdentifierNode).name;
    } else if (node.name.type === NodeType.Binary) {
      // Method call syntax like 'hello'.is(String)
      const binaryNode = node.name as BinaryNode;
      if (binaryNode.right.type === NodeType.Identifier) {
        funcName = (binaryNode.right as IdentifierNode).name;
        // For method calls, evaluate the left side and use as input
        const leftResult = interpreter.evaluate(binaryNode.left, input, context);
        input = leftResult.value;
        // Update $this to the new input for method calls
        context = {
          ...leftResult.context,
          env: {
            ...leftResult.context.env,
            $this: input
          }
        };
      } else {
        throw new EvaluationError('Invalid function call syntax', node.position);
      }
    } else {
      throw new EvaluationError('Invalid function name', node.position);
    }
    
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
        // Use $this as input for argument evaluation if available
        const argInput = context.env.$this || input;
        const result = interpreter.evaluate(arg, argInput, context);
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
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    const results: any[] = [];
    const astArgs = args as ASTNode[];
    const predicate = astArgs[0];

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
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    const results: any[] = [];
    const astArgs = args as ASTNode[];
    const expression = astArgs[0];

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
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    const astArgs = args as ASTNode[];
    const [conditionExpr, thenExpr, elseExpr] = astArgs;

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
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    const astArgs = args as ASTNode[];
    if (astArgs.length !== 2) {
      throw new EvaluationError('defineVariable requires exactly 2 arguments');
    }

    // First argument must be a string literal (variable name)
    const nameArg = astArgs[0]!;
    if (nameArg.type !== NodeType.Literal || typeof (nameArg as any).value !== 'string') {
      throw new EvaluationError('defineVariable first argument must be a string literal');
    }

    const varName = (nameArg as any).value;
    
    // Evaluate the value expression
    const valueResult = interpreter.evaluate(astArgs[1]!, input, context);
    
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
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    const result = input.length > 0 ? [input[0]] : [];
    return { value: result, context };
  }
});

// is(type) - type checking function (deprecated syntax)
FunctionRegistry.register({
  name: 'is',
  arity: 1,
  evaluateArgs: false, // We need the type name as AST
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    // Get the type name from the argument
    const astArgs = args as ASTNode[];
    const typeArg = astArgs[0]!;
    let typeName: string;
    
    // Handle TypeOrIdentifier or Identifier nodes
    if ((typeArg.type === NodeType.TypeOrIdentifier || typeArg.type === NodeType.Identifier) && 
        'name' in typeArg) {
      typeName = (typeArg as IdentifierNode).name;
    } else {
      throw new EvaluationError('is() requires a type name');
    }
    
    // Import TypeSystem
    const { TypeSystem } = require('./types/type-system');
    
    // Check type for each value
    const results: boolean[] = [];
    for (const value of input) {
      results.push(TypeSystem.isType(value, typeName));
    }
    
    return { value: results, context };
  }
});

// as(type) - type casting function (deprecated syntax)
FunctionRegistry.register({
  name: 'as',
  arity: 1,
  evaluateArgs: false, // We need the type name as AST
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    // Get the type name from the argument
    const astArgs = args as ASTNode[];
    const typeArg = astArgs[0]!;
    let typeName: string;
    
    // Handle TypeOrIdentifier or Identifier nodes
    if ((typeArg.type === NodeType.TypeOrIdentifier || typeArg.type === NodeType.Identifier) && 
        'name' in typeArg) {
      typeName = (typeArg as IdentifierNode).name;
    } else {
      throw new EvaluationError('as() requires a type name');
    }
    
    // Import TypeSystem
    const { TypeSystem } = require('./types/type-system');
    
    // Filter by type
    const results: any[] = [];
    for (const value of input) {
      if (TypeSystem.isType(value, typeName)) {
        results.push(value);
      } else {
        // Try to cast
        const castValue = TypeSystem.cast(value, typeName);
        if (castValue !== null) {
          results.push(castValue);
        }
      }
    }
    
    return { value: results, context };
  }
});

// empty() - returns true if collection is empty
FunctionRegistry.register({
  name: 'empty',
  arity: 0,
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    return { value: [input.length === 0], context };
  }
});

// exists([criteria]) - returns true if collection has items (with optional criteria)
FunctionRegistry.register({
  name: 'exists',
  arity: { min: 0, max: 1 },
  evaluateArgs: false, // Need to control evaluation for criteria
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    const astArgs = args as ASTNode[];
    if (astArgs.length === 0) {
      // No criteria - just check if non-empty
      return { value: [input.length > 0], context };
    }
    
    // With criteria - check if any item matches
    const criteria = astArgs[0]!;
    for (let i = 0; i < input.length; i++) {
      const item = input[i];
      const iterContext = ContextManager.setIteratorContext(context, item, i);
      const result = interpreter.evaluate(criteria, [item], iterContext);
      
      // If any result is truthy, return true
      if (result.value.length > 0) {
        const isTrue = result.value.length === 1 
          ? result.value[0] === true
          : true; // Non-empty collection is truthy
        if (isTrue) {
          return { value: [true], context };
        }
      }
    }
    
    return { value: [false], context };
  }
});

// count() - returns number of items in collection
FunctionRegistry.register({
  name: 'count',
  arity: 0,
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    return { value: [input.length], context };
  }
});

// all(criteria) - returns true if all items match criteria
FunctionRegistry.register({
  name: 'all',
  arity: 1,
  evaluateArgs: false, // Need to control evaluation
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    if (input.length === 0) {
      // Empty collection: all() returns true
      return { value: [true], context };
    }
    
    const astArgs = args as ASTNode[];
    const criteria = astArgs[0]!;
    for (let i = 0; i < input.length; i++) {
      const item = input[i];
      const iterContext = ContextManager.setIteratorContext(context, item, i);
      const result = interpreter.evaluate(criteria, [item], iterContext);
      
      // Check if result is truthy
      if (result.value.length === 0) {
        // Empty result is false
        return { value: [false], context };
      }
      
      const isTrue = result.value.length === 1 
        ? result.value[0] === true
        : true; // Non-empty collection is truthy
        
      if (!isTrue) {
        return { value: [false], context };
      }
    }
    
    return { value: [true], context };
  }
});

// anyTrue() - returns true if any boolean item is true
FunctionRegistry.register({
  name: 'anyTrue',
  arity: 0,
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    for (const item of input) {
      if (item === true) {
        return { value: [true], context };
      }
    }
    return { value: [false], context };
  }
});

// allTrue() - returns true if all boolean items are true
FunctionRegistry.register({
  name: 'allTrue',
  arity: 0,
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    if (input.length === 0) {
      return { value: [true], context }; // Empty collection
    }
    
    for (const item of input) {
      if (item !== true) {
        return { value: [false], context };
      }
    }
    return { value: [true], context };
  }
});

// anyFalse() - returns true if any boolean item is false
FunctionRegistry.register({
  name: 'anyFalse',
  arity: 0,
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    for (const item of input) {
      if (item === false) {
        return { value: [true], context };
      }
    }
    return { value: [false], context };
  }
});

// allFalse() - returns true if all boolean items are false  
FunctionRegistry.register({
  name: 'allFalse',
  arity: 0,
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    if (input.length === 0) {
      return { value: [true], context }; // Empty collection
    }
    
    for (const item of input) {
      if (item !== false) {
        return { value: [false], context };
      }
    }
    return { value: [true], context };
  }
});

// distinct() - returns collection with unique items only
FunctionRegistry.register({
  name: 'distinct',
  arity: 0,
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    const seen = new Set<any>();
    const results: any[] = [];
    
    for (const item of input) {
      // Use JSON.stringify for deep equality check
      // In production, we'd need a better equality function
      const key = JSON.stringify(item);
      if (!seen.has(key)) {
        seen.add(key);
        results.push(item);
      }
    }
    
    return { value: results, context };
  }
});

// isDistinct() - returns true if all items are distinct
FunctionRegistry.register({
  name: 'isDistinct',
  arity: 0,
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    const seen = new Set<string>();
    
    for (const item of input) {
      const key = JSON.stringify(item);
      if (seen.has(key)) {
        return { value: [false], context };
      }
      seen.add(key);
    }
    
    return { value: [true], context };
  }
});

// last() - returns last item from collection
FunctionRegistry.register({
  name: 'last',
  arity: 0,
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    const result = input.length > 0 ? [input[input.length - 1]] : [];
    return { value: result, context };
  }
});

// tail() - returns all but first item
FunctionRegistry.register({
  name: 'tail',
  arity: 0,
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    const result = input.length > 0 ? input.slice(1) : [];
    return { value: result, context };
  }
});

// skip(n) - returns all but first n items
FunctionRegistry.register({
  name: 'skip',
  arity: 1,
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    // args are pre-evaluated collections
    const skipArg = args[0] as any[];
    if (args.length === 0 || skipArg.length === 0) {
      return { value: input, context }; // No skip count, return all
    }
    
    const skipCount = CollectionUtils.toSingleton(skipArg);
    if (typeof skipCount !== 'number' || !Number.isInteger(skipCount)) {
      throw new EvaluationError('skip() requires an integer argument');
    }
    
    if (skipCount <= 0) {
      return { value: input, context };
    }
    
    return { value: input.slice(skipCount), context };
  }
});

// take(n) - returns first n items
FunctionRegistry.register({
  name: 'take',
  arity: 1,
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    // args are pre-evaluated collections
    const takeArg = args[0] as any[];
    if (args.length === 0 || takeArg.length === 0) {
      return { value: [], context }; // No take count, return empty
    }
    
    const takeCount = CollectionUtils.toSingleton(takeArg);
    if (typeof takeCount !== 'number' || !Number.isInteger(takeCount)) {
      throw new EvaluationError('take() requires an integer argument');
    }
    
    if (takeCount <= 0) {
      return { value: [], context };
    }
    
    return { value: input.slice(0, takeCount), context };
  }
});

// single() - returns single item or errors if multiple
FunctionRegistry.register({
  name: 'single',
  arity: 0,
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    if (input.length === 0) {
      return { value: [], context };
    }
    if (input.length > 1) {
      throw new EvaluationError('single() called on collection with multiple items');
    }
    return { value: [input[0]], context };
  }
});

// intersect(other) - returns items in both collections
FunctionRegistry.register({
  name: 'intersect',
  arity: 1,
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    // args are pre-evaluated collections  
    const evaluatedArgs = args as any[][];
    const other = evaluatedArgs[0] || [];
    const results: any[] = [];
    const otherSet = new Set(other.map(item => JSON.stringify(item)));
    
    for (const item of input) {
      const key = JSON.stringify(item);
      if (otherSet.has(key)) {
        // Check if we haven't already added this item
        const resultKey = JSON.stringify(item);
        if (!results.some(r => JSON.stringify(r) === resultKey)) {
          results.push(item);
        }
      }
    }
    
    return { value: results, context };
  }
});

// exclude(other) - returns items not in other collection
FunctionRegistry.register({
  name: 'exclude',
  arity: 1,
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    // args are pre-evaluated collections
    const evaluatedArgs = args as any[][];
    const other = evaluatedArgs[0] || [];
    const results: any[] = [];
    const otherSet = new Set(other.map(item => JSON.stringify(item)));
    
    for (const item of input) {
      const key = JSON.stringify(item);
      if (!otherSet.has(key)) {
        results.push(item);
      }
    }
    
    return { value: results, context };
  }
});

// union(other) - merges collections removing duplicates
FunctionRegistry.register({
  name: 'union',
  arity: 1,
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    // args are pre-evaluated collections
    const evaluatedArgs = args as any[][];
    const other = evaluatedArgs[0] || [];
    const seen = new Set<string>();
    const results: any[] = [];
    
    // Add items from first collection
    for (const item of input) {
      const key = JSON.stringify(item);
      if (!seen.has(key)) {
        seen.add(key);
        results.push(item);
      }
    }
    
    // Add items from second collection
    for (const item of other) {
      const key = JSON.stringify(item);
      if (!seen.has(key)) {
        seen.add(key);
        results.push(item);
      }
    }
    
    return { value: results, context };
  }
});

// combine(other) - merges collections keeping duplicates
FunctionRegistry.register({
  name: 'combine',
  arity: 1,
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    // args are pre-evaluated collections
    const evaluatedArgs = args as any[][];
    const other = evaluatedArgs[0] || [];
    return { value: [...input, ...other], context };
  }
});

// String Manipulation Functions

// contains(substring) - tests if string contains substring
FunctionRegistry.register({
  name: 'contains',
  arity: 1,
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    const inputResult = InputValidators.handleEmptyInput(input, []);
    if (inputResult.isEmpty) {
      return { value: inputResult.value, context };
    }
    
    const str = InputValidators.requireStringInput(input, 'contains');
    const substring = ArgumentValidators.requireString(args as any[][], 0, 'contains', 'substring');
    
    return { value: [str.includes(substring)], context };
  }
});

// length() - returns string length
FunctionRegistry.register({
  name: 'length',
  arity: 0,
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    const inputResult = InputValidators.handleEmptyInput(input, []);
    if (inputResult.isEmpty) {
      return { value: inputResult.value, context };
    }
    
    const str = InputValidators.requireStringInput(input, 'length');
    
    return { value: [str.length], context };
  }
});

// substring(start [, length]) - returns substring
FunctionRegistry.register({
  name: 'substring',
  arity: { min: 1, max: 2 },
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    const inputResult = InputValidators.handleEmptyInput(input, []);
    if (inputResult.isEmpty) {
      return { value: inputResult.value, context };
    }
    
    const str = InputValidators.requireStringInput(input, 'substring');
    const evaluatedArgs = args as any[][];
    const start = ArgumentValidators.requireInteger(evaluatedArgs, 0, 'substring', 'start');
    
    // FHIRPath uses 0-based indexing
    if (start < 0 || start >= str.length) {
      return { value: [''], context };
    }
    
    const length = ArgumentValidators.optionalInteger(evaluatedArgs, 1, 'substring', 'length');
    if (length !== undefined) {
      return { value: [str.substring(start, start + length)], context };
    }
    
    return { value: [str.substring(start)], context };
  }
});

// startsWith(prefix) - tests if string starts with prefix
FunctionRegistry.register({
  name: 'startsWith',
  arity: 1,
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    if (input.length === 0) {
      return { value: [], context };
    }
    
    const str = CollectionUtils.toSingleton(input);
    if (typeof str !== 'string') {
      throw new EvaluationError('startsWith() requires a string');
    }
    
    const evaluatedArgs = args as any[][];
    const prefix = CollectionUtils.toSingleton(evaluatedArgs[0] || []);
    if (typeof prefix !== 'string') {
      throw new EvaluationError('startsWith() requires a string argument');
    }
    
    return { value: [str.startsWith(prefix)], context };
  }
});

// endsWith(suffix) - tests if string ends with suffix
FunctionRegistry.register({
  name: 'endsWith',
  arity: 1,
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    if (input.length === 0) {
      return { value: [], context };
    }
    
    const str = CollectionUtils.toSingleton(input);
    if (typeof str !== 'string') {
      throw new EvaluationError('endsWith() requires a string');
    }
    
    const evaluatedArgs = args as any[][];
    const suffix = CollectionUtils.toSingleton(evaluatedArgs[0] || []);
    if (typeof suffix !== 'string') {
      throw new EvaluationError('endsWith() requires a string argument');
    }
    
    return { value: [str.endsWith(suffix)], context };
  }
});

// upper() - converts to uppercase
FunctionRegistry.register({
  name: 'upper',
  arity: 0,
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    if (input.length === 0) {
      return { value: [], context };
    }
    
    const str = CollectionUtils.toSingleton(input);
    if (typeof str !== 'string') {
      throw new EvaluationError('upper() requires a string');
    }
    
    return { value: [str.toUpperCase()], context };
  }
});

// lower() - converts to lowercase
FunctionRegistry.register({
  name: 'lower',
  arity: 0,
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    if (input.length === 0) {
      return { value: [], context };
    }
    
    const str = CollectionUtils.toSingleton(input);
    if (typeof str !== 'string') {
      throw new EvaluationError('lower() requires a string');
    }
    
    return { value: [str.toLowerCase()], context };
  }
});

// replace(pattern, replacement) - replaces all occurrences
FunctionRegistry.register({
  name: 'replace',
  arity: 2,
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    if (input.length === 0) {
      return { value: [], context };
    }
    
    const str = CollectionUtils.toSingleton(input);
    if (typeof str !== 'string') {
      throw new EvaluationError('replace() requires a string');
    }
    
    const evaluatedArgs = args as any[][];
    const pattern = CollectionUtils.toSingleton(evaluatedArgs[0] || []);
    if (typeof pattern !== 'string') {
      throw new EvaluationError('replace() pattern must be a string');
    }
    
    const replacement = CollectionUtils.toSingleton(evaluatedArgs[1] || []);
    if (typeof replacement !== 'string') {
      throw new EvaluationError('replace() replacement must be a string');
    }
    
    // Replace all occurrences
    return { value: [str.split(pattern).join(replacement)], context };
  }
});

// matches(regex) - tests if string matches regex
FunctionRegistry.register({
  name: 'matches',
  arity: 1,
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    if (input.length === 0) {
      return { value: [], context };
    }
    
    const str = CollectionUtils.toSingleton(input);
    if (typeof str !== 'string') {
      throw new EvaluationError('matches() requires a string');
    }
    
    const evaluatedArgs = args as any[][];
    const pattern = CollectionUtils.toSingleton(evaluatedArgs[0] || []);
    if (typeof pattern !== 'string') {
      throw new EvaluationError('matches() requires a string pattern');
    }
    
    try {
      const regex = new RegExp(pattern);
      return { value: [regex.test(str)], context };
    } catch (e) {
      throw new EvaluationError(`Invalid regex pattern: ${pattern}`);
    }
  }
});

// indexOf(substring) - returns position of substring
FunctionRegistry.register({
  name: 'indexOf',
  arity: 1,
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    if (input.length === 0) {
      return { value: [], context };
    }
    
    const str = CollectionUtils.toSingleton(input);
    if (typeof str !== 'string') {
      throw new EvaluationError('indexOf() requires a string');
    }
    
    const evaluatedArgs = args as any[][];
    const substring = CollectionUtils.toSingleton(evaluatedArgs[0] || []);
    if (typeof substring !== 'string') {
      throw new EvaluationError('indexOf() requires a string argument');
    }
    
    const index = str.indexOf(substring);
    // FHIRPath returns empty for not found (not -1)
    return { value: index >= 0 ? [index] : [], context };
  }
});

// Type Conversion Functions

// toString() - converts to string
FunctionRegistry.register({
  name: 'toString',
  arity: 0,
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    if (input.length === 0) {
      return { value: [], context };
    }
    
    const value = CollectionUtils.toSingleton(input);
    
    // Handle different types
    if (typeof value === 'string') {
      return { value: [value], context };
    }
    if (typeof value === 'number') {
      return { value: [value.toString()], context };
    }
    if (typeof value === 'boolean') {
      return { value: [value.toString()], context };
    }
    if (value instanceof Date) {
      return { value: [value.toISOString()], context };
    }
    
    // For complex objects, return empty (conversion fails)
    return { value: [], context };
  }
});

// toInteger() - converts to integer
FunctionRegistry.register({
  name: 'toInteger',
  arity: 0,
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    if (input.length === 0) {
      return { value: [], context };
    }
    
    const value = CollectionUtils.toSingleton(input);
    
    // Already an integer
    if (typeof value === 'number' && Number.isInteger(value)) {
      return { value: [value], context };
    }
    
    // Try to convert
    if (typeof value === 'string') {
      const num = parseInt(value, 10);
      if (!isNaN(num)) {
        return { value: [num], context };
      }
    }
    
    if (typeof value === 'number') {
      // Non-integer number - truncate
      return { value: [Math.trunc(value)], context };
    }
    
    if (typeof value === 'boolean') {
      return { value: [value ? 1 : 0], context };
    }
    
    // Conversion failed
    return { value: [], context };
  }
});

// toDecimal() - converts to decimal
FunctionRegistry.register({
  name: 'toDecimal',
  arity: 0,
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    if (input.length === 0) {
      return { value: [], context };
    }
    
    const value = CollectionUtils.toSingleton(input);
    
    // Already a number
    if (typeof value === 'number') {
      return { value: [value], context };
    }
    
    // Try to convert
    if (typeof value === 'string') {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        return { value: [num], context };
      }
    }
    
    if (typeof value === 'boolean') {
      return { value: [value ? 1.0 : 0.0], context };
    }
    
    // Conversion failed
    return { value: [], context };
  }
});

// toBoolean() - converts to boolean
FunctionRegistry.register({
  name: 'toBoolean',
  arity: 0,
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    if (input.length === 0) {
      return { value: [], context };
    }
    
    const value = CollectionUtils.toSingleton(input);
    
    // Already boolean
    if (typeof value === 'boolean') {
      return { value: [value], context };
    }
    
    // String conversions
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'true' || lower === 't' || lower === 'yes' || lower === 'y' || lower === '1') {
        return { value: [true], context };
      }
      if (lower === 'false' || lower === 'f' || lower === 'no' || lower === 'n' || lower === '0') {
        return { value: [false], context };
      }
      // Invalid string
      return { value: [], context };
    }
    
    // Number conversions
    if (typeof value === 'number') {
      if (value === 1) return { value: [true], context };
      if (value === 0) return { value: [false], context };
      // Other numbers don't convert
      return { value: [], context };
    }
    
    // Conversion failed
    return { value: [], context };
  }
});

// convertsToBoolean() - tests if convertible to boolean
FunctionRegistry.register({
  name: 'convertsToBoolean',
  arity: 0,
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    if (input.length === 0) {
      return { value: [false], context };
    }
    
    // Try the conversion and see if it succeeds
    const fn = FunctionRegistry.get('toBoolean')!;
    const result = fn.evaluate(interpreter, [], input, context);
    return { value: [result.value.length > 0], context };
  }
});

// convertsToInteger() - tests if convertible to integer
FunctionRegistry.register({
  name: 'convertsToInteger',
  arity: 0,
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    if (input.length === 0) {
      return { value: [false], context };
    }
    
    const fn = FunctionRegistry.get('toInteger')!;
    const result = fn.evaluate(interpreter, [], input, context);
    return { value: [result.value.length > 0], context };
  }
});

// convertsToDecimal() - tests if convertible to decimal
FunctionRegistry.register({
  name: 'convertsToDecimal',
  arity: 0,
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    if (input.length === 0) {
      return { value: [false], context };
    }
    
    const fn = FunctionRegistry.get('toDecimal')!;
    const result = fn.evaluate(interpreter, [], input, context);
    return { value: [result.value.length > 0], context };
  }
});

// convertsToString() - tests if convertible to string
FunctionRegistry.register({
  name: 'convertsToString',
  arity: 0,
  evaluate: (interpreter: Interpreter, args: ASTNode[] | any[][], input: any[], context: Context): EvaluationResult => {
    if (input.length === 0) {
      return { value: [false], context };
    }
    
    const fn = FunctionRegistry.get('toString')!;
    const result = fn.evaluate(interpreter, [], input, context);
    return { value: [result.value.length > 0], context };
  }
});