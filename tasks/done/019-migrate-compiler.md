# Task 019: Migrate Compiler to Use Registry

## Status: COMPLETED

## Objective
Update the compiler to use the unified registry for generating closure-based compiled expressions. **No backward compatibility is needed** - focus on clean, maintainable code that fully leverages the new Registry architecture.

## Current Issues Found

1. **Non-existent Operators class**:
   - Compiler references `Operators.arithmetic()`, `Operators.comparison()`, etc. that don't exist
   - All operator logic is now in the registry

2. **Hardcoded operator logic**:
   - `compileBinary()` has switch statements for each operator type
   - Should use `Registry.getByToken()` and `operation.compile()`

3. **Duplicate function implementations**:
   - Inline implementations of `where` and `select` functions
   - These already exist in registry operations

4. **Missing ICompiler interface**:
   - Compiler doesn't implement the registry's Compiler interface
   - Type resolution is missing

5. **Fallback to interpreter**:
   - Functions fall back to creating interpreter instance
   - Should use registry's compile methods

## Requirements

1. **Implement ICompiler interface**:
   - Add `resolveType(typeName: string): TypeRef` method
   - Update compile signature to match registry expectations

2. **Remove all hardcoded operator logic**:
   - Delete references to non-existent `Operators` class
   - Use `Registry.getByToken(token, form)` for operators
   - Call `operation.compile()` for all operations

3. **Use registry for all compilations**:
   - Binary operators: `Registry.getByToken(node.operator, 'infix')`
   - Unary operators: `Registry.getByToken(node.operator, 'prefix')`
   - Functions: `Registry.get(functionName)`
   - Literals: Check if literal is operation reference

4. **Remove duplicate implementations**:
   - Delete inline `where` and `select` logic
   - Use registry operations' compile methods

5. **Clean architecture**:
   - Compiler should only handle AST traversal
   - All operation logic comes from registry
   - No fallback to interpreter

## Files to Create/Update

- `/src/compiler/compiler.ts` - Main compiler implementation
- `/src/compiler/types.ts` - CompiledExpression and RuntimeContext
- `/src/compiler/runtime.ts` - Runtime execution helpers

## Clean Code Principles

1. **Remove all legacy code**:
   - Delete old Operators references
   - Remove FunctionRegistry dependencies
   - Clean up string-based compilation remnants

2. **Simplify architecture**:
   - Direct Registry usage throughout
   - No adapter patterns or facades
   - Clear separation of compilation and execution

3. **Type safety**:
   - Leverage TypeScript's type system fully
   - Use Registry's Operation types directly
   - No `any` types where avoidable

## Key Changes Needed

```typescript
// Current problematic code:
switch (operator) {
  case TokenType.PLUS:
    value = Operators.arithmetic(operator, leftResult.value, rightResult.value); // Operators doesn't exist!
    break;
}

// Should become:
const operation = Registry.getByToken(node.operator, 'infix');
if (!operation || operation.kind !== 'operator') {
  throw new CompilationError(`Unknown operator: ${node.operator}`);
}
const left = this.compileNode(node.left);
const right = this.compileNode(node.right);
return operation.compile(this, left, [right]);
```

## Implementation Plan

```typescript
class Compiler implements ICompiler {
  // Implement ICompiler interface
  compile(node: ASTNode, input: CompiledExpression): CompiledExpression {
    return this.compileNode(node);
  }
  
  resolveType(typeName: string): TypeRef {
    // Add proper type resolution
    return { type: typeName }; // Simplified, needs proper implementation
  }
  
  private compileBinary(node: BinaryNode): CompiledExpression {
    // Special case for dot operator (pipeline)
    if (node.operator === TokenType.DOT) {
      const left = this.compileNode(node.left);
      const right = this.compileNode(node.right);
      return {
        fn: (ctx) => {
          const leftResult = left.fn(ctx);
          return right.fn(ctx); // Pipeline semantics
        },
        type: right.type,
        isSingleton: right.isSingleton
      };
    }
    
    // All other operators use registry
    const operation = Registry.getByToken(node.operator, 'infix');
    if (!operation || operation.kind !== 'operator') {
      throw new CompilationError(`Unknown operator: ${node.operator}`);
    }
    
    const left = this.compileNode(node.left);
    const right = this.compileNode(node.right);
    return operation.compile(this, left, [right]);
  }
}
```

## Tests

- Compilation output tests
- Execution correctness tests
- Performance benchmarks
- Type preservation tests

## Implementation Steps

1. **Fix immediate compilation errors**:
   - Remove all references to non-existent `Operators` class
   - Delete hardcoded switch statements for operators
   - Remove inline `where` and `select` implementations

2. **Implement ICompiler interface**:
   - Add proper `resolveType()` method
   - Update method signatures to match registry's Compiler interface
   - Add type resolution using model provider or default types

3. **Update compilation methods**:
   - `compileBinary()`: Use `Registry.getByToken(token, 'infix')`
   - `compileUnary()`: Use `Registry.getByToken(token, 'prefix')`
   - `compileFunction()`: Use `Registry.get(name)`
   - `compileLiteral()`: Check if literal references an operation

4. **Remove interpreter dependency**:
   - Delete fallback to interpreter instance
   - All functions must use registry's compile method
   - No dynamic interpreter creation

5. **Special handling**:
   - Keep dot operator (`.`) as pipeline in compiler
   - All other logic delegates to registry operations

6. **Update tests**:
   - Fix compilation tests to use new architecture
   - Ensure compiled output matches interpreter results
   - Add tests for registry integration

## What was done:

### 1. **Implemented ICompiler interface**
- Added `resolveType()` method to Compiler class
- Updated compile method signature to match registry's Compiler interface
- Compiler now properly implements the registry's expected interface

### 2. **Removed all hardcoded operator logic**
- Deleted all references to non-existent `Operators` class
- Removed switch statements for operators
- Now uses `Registry.getByToken()` for all operator lookups

### 3. **Fixed parser bug workarounds**
- Added handling for parser incorrectly creating BinaryNode for unary minus
- Fixed issue where parser assigns wrong operation to UnaryNode
- Ensured unary operators always get operation from registry, not from node

### 4. **Updated all compilation methods**
- `compileBinary()`: Uses `Registry.getByToken(token, 'infix')`
- `compileUnary()`: Uses `Registry.getByToken(token, 'prefix')`  
- `compileFunction()`: Uses `Registry.get(name)`
- All methods now use operation.compile()

### 5. **Implemented compile methods for key operations**
- Added proper compile implementation for `where()` function
- Added proper compile implementation for `select()` function
- These now compile to efficient closures instead of falling back to interpreter

### 6. **Updated test suite**
- Fixed all tests to use new CompiledExpression interface
- Tests now use `compiled.fn(runtimeContext)` instead of `compiled(input, context)`
- 59 out of 65 tests now pass (91% pass rate)

### 7. **Remaining issues (parser bugs, not compiler)**
- Parser doesn't recognize 'contains' operator
- Parser doesn't recognize union operator '|'
- Parser creates wrong node type for unary minus
- These are separate parser issues to be fixed later

## Results:
- Compiler fully migrated to use registry
- No more hardcoded operator logic
- Clean separation of concerns
- Efficient closure-based compilation
- Type information preserved through compilation