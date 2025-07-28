# Interpreter Algorithm

## Overview

The interpreter implements a tree-walking evaluation strategy that directly traverses the AST to execute FHIRPath expressions. It follows a stream-processing model where every node is a processing unit: `(input, context) → (output, new context)`. All operations work with collections, treating single values as collections of size one.

## Core Algorithm

### Main Interpreter Class
**Location**: [`/src/interpreter/interpreter.ts`](../../src/interpreter/interpreter.ts)

```typescript
export class Interpreter implements IInterpreter {
  // Object lookup for node evaluators
  private readonly nodeEvaluators: Record<NodeType, NodeEvaluator> = {
    [NodeType.Literal]: this.evaluateLiteral.bind(this),
    [NodeType.Identifier]: this.evaluateIdentifier.bind(this),
    [NodeType.Binary]: this.evaluateBinary.bind(this),
    [NodeType.Function]: this.evaluateFunction.bind(this),
    // ... other node types
  };
  
  evaluate(node: ASTNode, input: any[], context: RuntimeContext): EvaluationResult {
    // Ensure $this is set in the context if not already present
    if (!context.env.$this) {
      context = {
        ...context,
        env: {
          ...context.env,
          $this: input
        }
      };
    }
    
    const evaluator = this.nodeEvaluators[node.type];
    
    if (!evaluator) {
      throw new EvaluationError(
        `Unknown node type: ${node.type}`,
        node.position
      );
    }
    
    return evaluator(node, input, context);
  }
}
```

### Node Evaluation Dispatch

The interpreter uses object dispatch for performance, binding each node type to its evaluator function:

```typescript
// Type for node evaluator functions
type NodeEvaluator = (node: any, input: any[], context: RuntimeContext) => EvaluationResult;

// Each evaluator receives:
// - node: The AST node to evaluate
// - input: The input collection (stream) to process
// - context: The runtime context with variables
// Returns: { value: any[], context: RuntimeContext }
```

## Evaluation Strategies

### 1. Literal Evaluation
**Location**: [`interpreter.ts:evaluateLiteral()`](../../src/interpreter/interpreter.ts)

Literals delegate to registry operations when available:

```typescript
private evaluateLiteral(node: LiteralNode, input: any[], context: RuntimeContext): EvaluationResult {
  // If literal has operation reference from parser
  if (node.operation && node.operation.kind === 'literal') {
    return node.operation.evaluate(this, context, input);
  }
  
  // Fallback for legacy literals
  const value = node.value === null ? [] : [node.value];
  return { value, context };
}
```

### 2. Identifier Resolution
**Location**: [`interpreter.ts:evaluateIdentifier()`](../../src/interpreter/interpreter.ts)

Handles both type filtering and property navigation:

```typescript
private evaluateIdentifier(node: IdentifierNode, input: any[], context: RuntimeContext): EvaluationResult {
  // Check if this identifier could be a resource type name
  // Resource types in FHIR typically start with uppercase
  if (node.name[0] === node?.name?.[0]?.toUpperCase()) {
    // Check if any input items have this as their resourceType
    const hasMatchingResourceType = input.some(item =>
      item && typeof item === 'object' && item.resourceType === node.name
    );
    
    if (hasMatchingResourceType) {
      // This is a type filter - return only items matching this resourceType
      const filtered = input.filter(item =>
        item && typeof item === 'object' && item.resourceType === node.name
      );
      return { value: filtered, context };
    }
  }
  
  // Regular property navigation
  const results: any[] = [];
  
  for (const item of input) {
    if (item == null || typeof item !== 'object') {
      // Primitives don't have properties - skip
      continue;
    }
    
    const value = item[node.name];
    if (value !== undefined) {
      // Add to results - flatten if array
      if (Array.isArray(value)) {
        results.push(...value);
      } else {
        results.push(value);
      }
    }
    // Missing properties return empty (not added to results)
  }
  
  return { value: results, context };
}
```

### 3. Binary Operation Evaluation
**Location**: [`interpreter.ts:evaluateBinary()`](../../src/interpreter/interpreter.ts)

Delegates to registry operations with special handling for dot and union:

```typescript
private evaluateBinary(node: BinaryNode, input: any[], context: RuntimeContext): EvaluationResult {
  // Special handling for dot operator - it's a pipeline
  if (node.operator === TokenType.DOT) {
    // Phase 1: Evaluate left with original input/context
    const leftResult = this.evaluate(node.left, input, context);
    
    // Phase 2: Evaluate right with left's output as input
    const rightResult = this.evaluate(node.right, leftResult.value, leftResult.context);
    
    return rightResult;
  }
  
  // Get operation from registry (binary operators are infix)
  const operation = node.operation || Registry.getByToken(node.operator, 'infix');
  if (!operation || operation.kind !== 'operator') {
    throw new EvaluationError(`Unknown operator: ${node.operator}`, node.position);
  }
  
  // Special handling for union operator - both sides should use the same context
  if (node.operator === TokenType.PIPE) {
    const leftResult = this.evaluate(node.left, input, context);
    const rightResult = this.evaluate(node.right, input, context); // Use original context
    
    // Use operation's evaluate method
    return operation.evaluate(this, context, input, leftResult.value, rightResult.value);
  }
  
  // Normal operators - context flows from left to right
  const leftResult = this.evaluate(node.left, input, context);
  const rightResult = this.evaluate(node.right, input, leftResult.context);
  
  // Use operation's evaluate method
  return operation.evaluate(this, rightResult.context, input, leftResult.value, rightResult.value);
}
```

### 4. Function Evaluation
**Location**: [`interpreter.ts:evaluateFunction()`](../../src/interpreter/interpreter.ts)

Handles both simple function calls and method call syntax:

```typescript
private evaluateFunction(node: FunctionNode, input: any[], context: RuntimeContext): EvaluationResult {
  // Extract function name and handle method call syntax
  let funcName: string;
  let functionInput = input;
  
  if (node.name.type === NodeType.Identifier) {
    funcName = (node.name as IdentifierNode).name;
  } else if (node.name.type === NodeType.Binary && (node.name as BinaryNode).operator === TokenType.DOT) {
    // Method call syntax: expression.function(args)
    const binaryNode = node.name as BinaryNode;
    
    // Evaluate the left side to get the input
    const leftResult = this.evaluate(binaryNode.left, input, context);
    functionInput = leftResult.value;
    context = leftResult.context;
    
    // Get the function name from the right side
    if (binaryNode.right.type === NodeType.Identifier) {
      funcName = (binaryNode.right as IdentifierNode).name;
    } else {
      throw new EvaluationError('Invalid method call syntax', node.position);
    }
  } else {
    throw new EvaluationError('Complex function names not yet supported', node.position);
  }
  
  // Check for custom functions first
  if ((context as any).customFunctions && funcName in (context as any).customFunctions) {
    const customFunc = (context as any).customFunctions[funcName];
    // Evaluate all arguments
    const evaluatedArgs: any[] = [];
    for (const arg of node.arguments) {
      const argResult = this.evaluate(arg, functionInput, context);
      evaluatedArgs.push(argResult.value);
      context = argResult.context;
    }
    
    // Call custom function
    const result = customFunc!(context, functionInput, ...evaluatedArgs);
    return { value: result, context };
  }
  
  // Get function from registry
  const operation = Registry.get(funcName);
  if (!operation || operation.kind !== 'function') {
    throw new EvaluationError(`Unknown function: ${funcName}`, node.position);
  }
  
  // Check propagateEmptyInput flag
  if (operation.signature.propagatesEmpty && functionInput.length === 0) {
    return { value: [], context };
  }
  
  // Evaluate arguments based on parameter definitions
  const evaluatedArgs: any[] = [];
  for (let i = 0; i < node.arguments.length; i++) {
    const arg = node.arguments[i];
    const param = operation.signature.parameters[i];
    
    if (param && param.kind === 'expression') {
      // Pass expression as-is, will be evaluated by the function
      evaluatedArgs.push(arg);
    } else {
      // Evaluate the argument to get its value
      const argResult = this.evaluate(arg!, functionInput, context);
      evaluatedArgs.push(argResult.value);
      context = argResult.context;
    }
  }
  
  // Use operation's evaluate method
  return operation.evaluate(this, context, functionInput, ...evaluatedArgs);
}
```

### 5. Variable Evaluation
**Location**: [`interpreter.ts:evaluateVariable()`](../../src/interpreter/interpreter.ts)

Handles special variables and user-defined variables:

```typescript
private evaluateVariable(node: VariableNode, input: any[], context: RuntimeContext): EvaluationResult {
  // Variables ignore input and return value from context
  let value: any[] = [];
  
  if (node.name.startsWith('$')) {
    // Special environment variables - use object lookup
    const envVarHandlers: Record<string, () => any[]> = {
      '$this': () => context.env.$this || [],
      '$index': () => context.env.$index !== undefined ? [context.env.$index] : [],
      '$total': () => context.env.$total || [],
    };
    
    const handler = envVarHandlers[node.name];
    if (!handler) {
      throw new EvaluationError(`Unknown special variable: ${node.name}`, node.position);
    }
    value = handler();
  } else if (node.name.startsWith('%')) {
    // Environment variables starting with % - delegate to RuntimeContextManager
    value = RuntimeContextManager.getVariable(context, node.name) || [];
  } else {
    // User-defined variables - RuntimeContextManager.getVariable handles % prefix
    value = RuntimeContextManager.getVariable(context, node.name) || [];
  }
  
  return { value, context };
}
```

## Collection Processing

### Collection Node Evaluation
**Location**: [`interpreter.ts:evaluateCollection()`](../../src/interpreter/interpreter.ts)

```typescript
private evaluateCollection(node: CollectionNode, input: any[], context: RuntimeContext): EvaluationResult {
  // Evaluate each element and combine results
  const results: any[] = [];
  let currentContext = context;
  
  for (const element of node.elements) {
    const result = this.evaluate(element, input, currentContext);
    results.push(...result.value);
    currentContext = result.context;
  }
  
  return { value: results, context: currentContext };
}
```

### Index Node Evaluation
**Location**: [`interpreter.ts:evaluateIndex()`](../../src/interpreter/interpreter.ts)

```typescript
private evaluateIndex(node: IndexNode, input: any[], context: RuntimeContext): EvaluationResult {
  // Evaluate the expression being indexed
  const exprResult = this.evaluate(node.expression, input, context);
  
  // Evaluate the index expression in the original context
  const indexResult = this.evaluate(node.index, input, context);
  
  // Index must be a single integer
  if (indexResult.value.length === 0) {
    return { value: [], context: indexResult.context };
  }
  
  const index = CollectionUtils.toSingleton(indexResult.value);
  if (typeof index !== 'number' || !Number.isInteger(index)) {
    throw new EvaluationError('Index must be an integer', node.position);
  }
  
  // FHIRPath uses 0-based indexing
  if (index < 0 || index >= exprResult.value.length) {
    // Out of bounds returns empty
    return { value: [], context: indexResult.context };
  }
  
  return { value: [exprResult.value[index]], context: indexResult.context };
}
```

### Union Node Evaluation
**Location**: [`interpreter.ts:evaluateUnion()`](../../src/interpreter/interpreter.ts)

```typescript
private evaluateUnion(node: UnionNode, input: any[], context: RuntimeContext): EvaluationResult {
  // Union combines results from all operands
  // Each operand should be evaluated with the SAME original context
  // to prevent variable definitions from leaking between branches
  const results: any[] = [];
  const seen = new Set();
  
  for (const operand of node.operands) {
    // Always use the original context for each operand
    const result = this.evaluate(operand, input, context);
    
    // Remove duplicates
    for (const item of result.value) {
      const key = JSON.stringify(item);
      if (!seen.has(key)) {
        seen.add(key);
        results.push(item);
      }
    }
  }
  
  // Return the original context, not a modified one
  return { value: results, context };
}
```

### Type Cast and Membership Test
**Location**: [`interpreter.ts`](../../src/interpreter/interpreter.ts)

```typescript
private evaluateMembershipTest(node: MembershipTestNode, input: any[], context: RuntimeContext): EvaluationResult {
  // Evaluate the expression to get values to test
  const exprResult = this.evaluate(node.expression, input, context);
  
  // Empty collection: is returns empty
  if (exprResult.value.length === 0) {
    return { value: [], context: exprResult.context };
  }
  
  // Check if ALL values match the type
  for (const value of exprResult.value) {
    if (!TypeSystem.isType(value, node.targetType)) {
      return { value: [false], context: exprResult.context };
    }
  }
  
  // All values match the type
  return { value: [true], context: exprResult.context };
}

private evaluateTypeCast(node: TypeCastNode, input: any[], context: RuntimeContext): EvaluationResult {
  // Evaluate the expression to get values to cast
  const exprResult = this.evaluate(node.expression, input, context);
  
  // For each value, attempt to cast to the target type
  const results: any[] = [];
  for (const value of exprResult.value) {
    // If already the correct type, keep it
    if (TypeSystem.isType(value, node.targetType)) {
      results.push(value);
    }
    // Otherwise, try to cast (returns null if fails)
    else {
      const castValue = TypeSystem.cast(value, node.targetType);
      if (castValue !== null) {
        results.push(castValue);
      }
      // Failed casts are filtered out (not added to results)
    }
  }
  
  // Return filtered collection
  return { value: results, context: exprResult.context };
}
```

## Type Conversion Helpers

### Collection Utilities
**Location**: [`/src/interpreter/types.ts`](../../src/interpreter/types.ts)

```typescript
export const CollectionUtils = {
  /**
   * Convert any value to a collection
   */
  toCollection(value: any): any[] {
    if (value === null || value === undefined) {
      return [];
    }
    return Array.isArray(value) ? value : [value];
  },
  
  /**
   * Apply singleton evaluation rules
   * @returns The single value or undefined if rules don't apply
   * @throws Error if multiple items when single expected
   */
  toSingleton(collection: any[], expectedType?: string): SingletonResult {
    if (collection.length === 0) {
      return undefined; // Empty propagates
    }
    
    if (collection.length === 1) {
      const value = collection[0];
      
      // Rule 2: Collection with one item, expecting Boolean → true
      if (expectedType === 'boolean' && typeof value !== 'boolean') {
        return true;
      }
      
      // Rule 1: Collection with one item convertible to expected type → use it
      return value;
    }
    
    // Rule 4: Multiple items → ERROR
    throw new EvaluationError(`Expected single value but got ${collection.length} items`);
  },
  
  /**
   * Check if a collection is empty
   */
  isEmpty(collection: any[]): boolean {
    return collection.length === 0;
  },
  
  /**
   * Flatten nested collections
   */
  flatten(collection: any[]): any[] {
    const result: any[] = [];
    for (const item of collection) {
      if (Array.isArray(item)) {
        result.push(...item);
      } else {
        result.push(item);
      }
    }
    return result;
  }
};
```

## Error Handling

### Runtime Errors
**Location**: [`/src/interpreter/types.ts`](../../src/interpreter/types.ts)

```typescript
/**
 * Error thrown during evaluation with position information
 */
export class EvaluationError extends Error {
  constructor(
    message: string,
    public position?: { line: number; column: number; offset: number }
  ) {
    super(message);
    this.name = 'EvaluationError';
  }
}
```

The interpreter catches errors and adds position information when available:

```typescript
try {
  const evaluator = this.nodeEvaluators[node.type];
  
  if (!evaluator) {
    throw new EvaluationError(
      `Unknown node type: ${node.type}`,
      node.position
    );
  }
  
  return evaluator(node, input, context);
} catch (error) {
  // Add position information if not already present
  if (error instanceof EvaluationError && !error.position && node.position) {
    error.position = node.position;
  }
  throw error;
}
```

## Performance Optimizations

### 1. Object Dispatch
Using object lookup instead of switch statements:
```typescript
// Faster than switch
const evaluator = this.nodeEvaluators[node.type];

// Instead of
switch (node.type) {
  case NodeType.Literal: ...
  case NodeType.Binary: ...
  // etc
}
```

### 2. Registry Integration
Operations are loaded once from the registry and cached:
- Literal operations are attached to nodes during parsing
- Operator lookups use token type and form (prefix/infix/postfix)
- Functions are resolved by name from the registry

### 3. Stream Processing
All operations work with collections as streams:
- Input flows through the pipeline without unnecessary copying
- Context modifications are kept minimal
- Results are accumulated efficiently

### 4. Expression Parameters
Functions that need unevaluated expressions (like `where`, `select`, `repeat`) receive AST nodes directly:
```typescript
if (param && param.kind === 'expression') {
  // Pass expression as-is, will be evaluated by the function
  evaluatedArgs.push(arg);
} else {
  // Evaluate the argument to get its value
  const argResult = this.evaluate(arg!, functionInput, context);
  evaluatedArgs.push(argResult.value);
}
```

## Usage Example

```typescript
import { Interpreter, evaluateFHIRPath } from './interpreter/interpreter';
import { RuntimeContextManager } from './runtime/context';
import { parse } from './parser';

// Method 1: Using the helper function
const result1 = evaluateFHIRPath(
  "Patient.name.where(use = 'official').given",
  {
    resourceType: 'Patient',
    name: [
      { use: 'official', given: ['John', 'Q'], family: 'Doe' },
      { use: 'nickname', given: ['Johnny'], family: 'Doe' }
    ]
  }
);
console.log(result1); // ['John', 'Q']

// Method 2: Using the interpreter directly
const ast = parse("Patient.name.where(use = 'official').given");
const input = [{
  resourceType: 'Patient',
  name: [
    { use: 'official', given: ['John', 'Q'], family: 'Doe' },
    { use: 'nickname', given: ['Johnny'], family: 'Doe' }
  ]
}];

// Create context with input data
const context = RuntimeContextManager.create(input);

// Create interpreter and evaluate
const interpreter = new Interpreter();
const result = interpreter.evaluate(ast, input, context);
console.log(result.value); // ['John', 'Q']
```

## Integration Points

### With Registry
The interpreter delegates all operation evaluation to the registry:
- Literals use their associated operation's `evaluate` method
- Binary operators are resolved by token type and form (infix)
- Unary operators are resolved by token type and form (prefix)
- Functions are resolved by name
- Operations receive the interpreter instance to evaluate sub-expressions

### With Runtime Context
The interpreter uses `RuntimeContextManager` for variable management:
- Special variables like `$this`, `$index`, `$total` are stored in `context.env`
- User-defined variables are managed by `RuntimeContextManager`
- Context flows through the evaluation pipeline

### With Type System
The interpreter uses `TypeSystem` for type checking:
- `isType()` for membership tests (`is` operator)
- `cast()` for type casting (`as` operator)
- Type-based filtering for resource types

### Stream Processing Model
Every node follows the pattern:
```typescript
(node: ASTNode, input: any[], context: RuntimeContext) => EvaluationResult
```
Where:
- `input` is the collection being processed
- `context` contains variables and environment
- Returns `{ value: any[], context: RuntimeContext }`

This ensures consistent behavior and allows operations to be composed in pipelines.