# Compiler Algorithm

## Overview

The compiler transforms FHIRPath AST into JavaScript closures that maintain FHIRPath semantics while leveraging JavaScript's JIT optimization. It integrates with the registry system where each operation provides its own compilation strategy through a `compile` method, ensuring consistent behavior between interpreted and compiled execution.

## Core Algorithm

### Main Compiler Class
**Location**: [`/src/compiler/compiler.ts`](../../src/compiler/compiler.ts)

```typescript
export class Compiler implements ICompiler {
  /**
   * Main entry point - compiles an AST into an executable function
   */
  compile(node: ASTNode, input?: CompiledExpression): CompiledExpression {
    const compiled = this.compileNode(node);
    
    // Return the compiled expression directly
    // The RuntimeContext is managed through RuntimeContextManager
    return compiled;
  }
  
  /**
   * Resolve a type name to a TypeRef
   */
  resolveType(typeName: string): TypeRef {
    // For now, return a simple type reference
    // In the future, this should use a model provider
    return { type: typeName } as TypeRef;
  }
}
```

### Closure Generation Strategy
**Location**: [`compiler.ts:compileNode()`](../../src/compiler/compiler.ts)

The compiler uses a switch statement to dispatch to specific compilation methods:

```typescript
private compileNode(node: ASTNode): CompiledExpression {
  switch (node.type) {
    case NodeType.Literal:
      return this.compileLiteral(node as LiteralNode);
    case NodeType.Identifier:
      return this.compileIdentifier(node as IdentifierNode);
    case NodeType.TypeOrIdentifier:
      return this.compileTypeOrIdentifier(node as TypeOrIdentifierNode);
    case NodeType.Variable:
      return this.compileVariable(node as VariableNode);
    case NodeType.Binary:
      return this.compileBinary(node as BinaryNode);
    case NodeType.Unary:
      return this.compileUnary(node as UnaryNode);
    case NodeType.Function:
      return this.compileFunction(node as FunctionNode);
    case NodeType.Collection:
      return this.compileCollection(node as CollectionNode);
    case NodeType.Index:
      return this.compileIndex(node as IndexNode);
    case NodeType.Union:
      return this.compileUnion(node as UnionNode);
    case NodeType.MembershipTest:
      return this.compileMembershipTest(node as MembershipTestNode);
    case NodeType.TypeCast:
      return this.compileTypeCast(node as TypeCastNode);
    case NodeType.TypeReference:
      return this.compileTypeReference(node as TypeReferenceNode);
    default:
      throw new EvaluationError(
        `Unknown node type: ${(node as any).type}`,
        node.position
      );
  }
}
```

Each compilation method returns a `CompiledExpression`:
```typescript
export interface CompiledExpression {
  // The compiled function
  fn: (context: RuntimeContext) => any[];
  
  // Type information for optimization
  type: TypeRef;
  isSingleton: boolean;
  
  // For debugging/tracing
  source?: string;
}
```

## Compilation Strategies

### 1. Literal Compilation
**Location**: [`compiler.ts:compileLiteral()`](../../src/compiler/compiler.ts)

Literals check the registry for literal operations before creating simple closures:

```typescript
private compileLiteral(node: LiteralNode): CompiledExpression {
  const value = node.value;
  
  // Check if literal is an operation reference
  if (typeof value === 'string') {
    const operation = Registry.get(value);
    if (operation && operation.kind === 'literal') {
      return operation.compile(this, { fn: () => [], type: this.resolveType('Any'), isSingleton: false }, []);
    }
  }
  
  // Return a compiled expression for the literal value
  return {
    fn: (ctx: RuntimeContext) => value === null ? [] : [value],
    type: this.resolveType(this.getLiteralType(value)),
    isSingleton: true,
    source: JSON.stringify(value)
  };
}

private getLiteralType(value: any): string {
  if (value === null || value === undefined) return 'Any';
  if (typeof value === 'boolean') return 'Boolean';
  if (typeof value === 'string') return 'String';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'Integer' : 'Decimal';
  }
  return 'Any';
}
```

### 2. Identifier Compilation
**Location**: [`compiler.ts:compileIdentifier()`](../../src/compiler/compiler.ts)

Property navigation on the focus collection:

```typescript
private compileIdentifier(node: IdentifierNode): CompiledExpression {
  const name = node.name;
  
  return {
    fn: (ctx: RuntimeContext) => {
      const input = ctx.focus || ctx.input || [];
      const results: any[] = [];
      
      for (const item of input) {
        if (item == null || typeof item !== 'object') {
          continue;
        }
        
        const value = item[name];
        if (value !== undefined) {
          if (Array.isArray(value)) {
            results.push(...value);
          } else {
            results.push(value);
          }
        }
      }
      
      return results;
    },
    type: this.resolveType('Any'),
    isSingleton: false,
    source: name
  };
}
```

### 3. Binary Operation Compilation
**Location**: [`compiler.ts:compileBinary()`](../../src/compiler/compiler.ts)

Delegates to registry operations with special handling for dot operator:

```typescript
private compileBinary(node: BinaryNode): CompiledExpression {
  const operator = node.operator;
  
  // Special handling for dot operator - it's a pipeline
  if (operator === TokenType.DOT) {
    const left = this.compileNode(node.left);
    const right = this.compileNode(node.right);
    
    return {
      fn: (ctx: RuntimeContext) => {
        // Execute left side with the original context
        const leftResult = left.fn(ctx);
        
        // Execute right side with left's result as input
        // Use withInput to maintain prototype chain
        const rightCtx = RuntimeContextManager.withInput(ctx, leftResult);
        return right.fn(rightCtx);
      },
      type: right.type,
      isSingleton: right.isSingleton,
      source: `${left.source || ''}.${right.source || ''}`
    };
  }
  
  // Get operation from registry
  const operation = node.operation || Registry.getByToken(operator, 'infix');
  if (!operation || operation.kind !== 'operator') {
    throw new EvaluationError(`Unknown operator: ${operator}`, node.position);
  }
  
  // Compile operands
  const left = this.compileNode(node.left);
  const right = this.compileNode(node.right);
  
  // Use operation's compile method
  // For operators, pass both operands in args array
  return operation.compile(this, left, [left, right]);
}
```

### 4. Function Compilation
**Location**: [`compiler.ts:compileFunction()`](../../src/compiler/compiler.ts)

Delegates to registry operations:

```typescript
private compileFunction(node: FunctionNode): CompiledExpression {
  // For now, handle only identifier function names
  if (node.name.type !== NodeType.Identifier) {
    throw new EvaluationError('Dynamic function names not yet supported', node.position);
  }
  
  const functionName = (node.name as IdentifierNode).name;
  
  // Check if function is registered
  const operation = Registry.get(functionName);
  if (!operation || operation.kind !== 'function') {
    throw new EvaluationError(`Unknown function: ${functionName}`, node.position);
  }
  
  // Compile arguments
  const compiledArgs = node.arguments.map(arg => this.compileNode(arg));
  
  // Use operation's compile method
  // For functions, the input is passed as the first compiled expression
  const inputExpr: CompiledExpression = {
    fn: (ctx) => ctx.focus || ctx.input || [],
    type: this.resolveType('Any'),
    isSingleton: false
  };
  
  return operation.compile(this, inputExpr, compiledArgs);
}
```

### 5. Variable Compilation
**Location**: [`compiler.ts:compileVariable()`](../../src/compiler/compiler.ts)

Handles special variables and user-defined variables:

```typescript
private compileVariable(node: VariableNode): CompiledExpression {
  const name = node.name;
  
  return {
    fn: (ctx: RuntimeContext) => {
      const value = RuntimeContextManager.getVariable(ctx, name);
      
      if (value === undefined) {
        // Special handling for unknown special variables
        if (name.startsWith('$') && !['$this', '$index', '$total'].includes(name)) {
          throw new EvaluationError(`Unknown special variable: ${name}`, node.position);
        }
        return [];
      }
      
      // Ensure we always return an array
      return Array.isArray(value) ? value : [value];
    },
    type: this.resolveType('Any'),
    isSingleton: false,
    source: name
  };
}
```

### 6. Collection and Index Compilation
**Location**: [`compiler.ts`](../../src/compiler/compiler.ts)

Compiles collection literals and indexing:

```typescript
private compileCollection(node: CollectionNode): CompiledExpression {
  const compiledElements = node.elements.map(elem => this.compileNode(elem));
  
  return {
    fn: (ctx: RuntimeContext) => {
      const results: any[] = [];
      
      for (const element of compiledElements) {
        const elementResult = element.fn(ctx);
        results.push(...elementResult);
      }
      
      return results;
    },
    type: this.resolveType('Any'),
    isSingleton: false,
    source: `{${compiledElements.map(e => e.source || '').join(', ')}}`
  };
}

private compileIndex(node: IndexNode): CompiledExpression {
  const expression = this.compileNode(node.expression);
  const index = this.compileNode(node.index);
  
  return {
    fn: (ctx: RuntimeContext) => {
      const exprResult = expression.fn(ctx);
      // Evaluate index in the original context
      const indexResult = index.fn(ctx);
      
      if (indexResult.length === 0) {
        return [];
      }
      
      const idx = toSingleton(indexResult);
      if (typeof idx !== 'number' || !Number.isInteger(idx)) {
        throw new EvaluationError('Index must be an integer', node.position);
      }
      
      if (idx < 0 || idx >= exprResult.length) {
        return [];
      }
      
      return [exprResult[idx]];
    },
    type: expression.type,
    isSingleton: true,
    source: `${expression.source || ''}[${index.source || ''}]`
  };
}
```

## Type Operations

### Type Cast and Membership Test
**Location**: [`compiler.ts`](../../src/compiler/compiler.ts)

```typescript
private compileMembershipTest(node: MembershipTestNode): CompiledExpression {
  // Get the 'is' operator from registry
  const operation = Registry.getByToken(TokenType.IS, 'infix');
  if (!operation || operation.kind !== 'operator') {
    throw new EvaluationError('is operator not found in registry', node.position);
  }
  
  const expression = this.compileNode(node.expression);
  const typeExpr: CompiledExpression = {
    fn: () => [node.targetType],
    type: this.resolveType('String'),
    isSingleton: true,
    source: node.targetType
  };
  
  return operation.compile(this, expression, [expression, typeExpr]);
}

private compileTypeCast(node: TypeCastNode): CompiledExpression {
  // Get the 'as' operator from registry
  const operation = Registry.getByToken(TokenType.AS, 'infix');
  if (!operation || operation.kind !== 'operator') {
    throw new EvaluationError('as operator not found in registry', node.position);
  }
  
  const expression = this.compileNode(node.expression);
  const typeExpr: CompiledExpression = {
    fn: () => [node.targetType],
    type: this.resolveType('String'),
    isSingleton: true,
    source: node.targetType
  };
  
  return operation.compile(this, expression, [typeExpr]);
}
```

## Registry Integration

The key innovation is that each operation in the registry provides its own `compile` method:

```typescript
// Example from arithmetic operations
export const plusOperator: Operator = {
  name: '+',
  kind: 'operator',
  
  // ... other properties ...
  
  compile: (compiler, input, args) => ({
    fn: (ctx) => {
      const left = args[0]?.fn(ctx) || [];
      const right = args[1]?.fn(ctx) || [];
      if (left.length === 0 || right.length === 0) return [];
      
      const l = toSingleton(left);
      const r = toSingleton(right);
      
      if (typeof l === 'string' || typeof r === 'string') {
        return [String(l) + String(r)];
      }
      
      return [l + r];
    },
    type: promoteNumericType(args[0]?.type, args[1]?.type),
    isSingleton: true,
    source: `${args[0]?.source || ''} + ${args[1]?.source || ''}`
  })
};
```

This approach ensures:
1. **Consistency**: The same operation logic is used for both interpretation and compilation
2. **Modularity**: Each operation encapsulates its own compilation strategy
3. **Optimization**: Operations can provide optimized closures for their specific semantics
4. **Type Safety**: Operations propagate type information through compilation

## Error Handling

The compiler uses the same `EvaluationError` as the interpreter for consistency:

```typescript
try {
  return operation.compile(this, expression, [expression, typeExpr]);
} catch (error: any) {
  // If the error doesn't have position, add it from the node
  if (error instanceof EvaluationError && !error.position) {
    error.position = node.position;
  }
  throw error;
}
```

## Usage Example

```typescript
import { compile, evaluateCompiled } from './compiler/compiler';
import { RuntimeContextManager } from './runtime/context';
import { parse } from './parser';

// Method 1: Using helper function
const result1 = evaluateCompiled(
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

// Method 2: Compile once, execute multiple times
const compiled = compile("Patient.name.where(use = 'official').given");

// Create runtime context using RuntimeContextManager
const context = RuntimeContextManager.create([{
  resourceType: 'Patient',
  name: [
    { use: 'official', given: ['John', 'Q'], family: 'Doe' },
    { use: 'nickname', given: ['Johnny'], family: 'Doe' }
  ]
}]);

const result2 = compiled.fn(context);
console.log(result2); // ['John', 'Q']

// Compiled function can be reused with different contexts
const context2 = RuntimeContextManager.create([/* different patient */]);
const result3 = compiled.fn(context2);
```

## Integration Points

### With Interpreter
The compiler and interpreter share the same execution model:
- Both work with the stream-processing pattern: `(input, context) → output`
- Both use the same `RuntimeContext` structure
- Both delegate to registry operations for consistency

### With Registry
The compiler leverages the registry's `compile` methods:
- Each operation provides its own optimized compilation
- Type information flows through the compilation pipeline
- Operations can choose between generic or optimized compilation strategies

### With Runtime Context
The compiler uses `RuntimeContextManager` for context manipulation:
- `withInput()` for updating the focus/input
- `getVariable()` for accessing all variables (special, environment, and user-defined)
- Prototype-based context for efficient variable scoping
- Same variable resolution as the interpreter

Note: The RuntimeContext interface has a flat structure with all variables stored in a single `variables` object:
```typescript
export interface RuntimeContext {
  input: any[];
  focus: any[];
  variables: Record<string, any>;
}
```

Special variables like `$this`, `$index`, and environment variables like `%context` are all stored in the `variables` object with their respective prefixes.

## Key Design Decisions

1. **Registry-based Compilation**: Operations own their compilation logic, ensuring consistency
2. **CompiledExpression Structure**: Each compiled node carries type information and source for debugging
3. **Direct Closures**: No string generation or eval, improving security and performance
4. **Type Propagation**: Type information flows through compilation for potential optimizations
5. **Error Preservation**: Position information is maintained through compilation for better error messages