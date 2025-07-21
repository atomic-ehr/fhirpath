# Task 013: Implement Basic FHIRPath Compiler

## Objective

Implement a basic FHIRPath to JavaScript closure compiler as described in ADR-003. This initial implementation should handle core node types and demonstrate the compilation approach.

## Background

The current interpreter evaluates the AST by traversing it for each execution. The compiler will transform AST nodes into JavaScript closures that can be executed directly, providing significant performance improvements.

## Scope

### In Scope
1. Core compiler infrastructure
2. Basic node compilation:
   - Literal nodes (numbers, strings, booleans, null)
   - Identifier nodes (property access)
   - Variable nodes ($this, $index, %user-variables)
   - Binary operators (starting with dot operator)
   - Simple functions (where, select)
3. Compilation API
4. Basic tests comparing compiler output with interpreter

### Out of Scope (Future Tasks)
- Optimization passes
- All functions and operators
- Source map generation
- Performance benchmarking
- Caching layer

## Implementation Plan

### 1. Create Compiler Module Structure
```
src/compiler/
├── compiler.ts         # Main compiler class
├── types.ts           # Type definitions
├── node-compilers.ts  # Individual node compilation functions
└── index.ts          # Public API
```

### 2. Define Core Types
```typescript
// types.ts
export type CompiledNode = (input: any[], context: Context) => EvaluationResult;
export type NodeCompiler<T extends ASTNode> = (node: T) => CompiledNode;
```

### 3. Implement Basic Compiler
```typescript
// compiler.ts
export class Compiler {
  compile(ast: ASTNode): CompiledNode {
    return this.compileNode(ast);
  }
  
  private compileNode(node: ASTNode): CompiledNode {
    switch (node.type) {
      case NodeType.Literal:
        return this.compileLiteral(node as LiteralNode);
      // ... other cases
    }
  }
}
```

### 4. Implement Node Compilers
- `compileLiteral`: Return constant value
- `compileIdentifier`: Property navigation
- `compileVariable`: Context lookup
- `compileBinary`: Operator composition (focus on dot)
- `compileFunction`: Basic where/select

### 5. Create Tests
```typescript
// test/compiler.test.ts
describe('Compiler', () => {
  it('should compile literals', () => {
    const ast = parse('42');
    const compiled = compile(ast);
    const interpreted = evaluate(ast, [], context);
    expect(compiled([], context)).toEqual(interpreted);
  });
  
  // Test each node type
  // Compare with interpreter results
});
```

## Success Criteria

1. ✅ Compiler module created with clean architecture
2. ✅ Basic node types compile correctly
3. ✅ Dot operator works as function composition
4. ✅ Where and select functions compile with proper context handling
5. ✅ All compiler tests pass
6. ✅ Compiled functions produce same results as interpreter

## Technical Considerations

1. **Closure Capture**: Ensure helper functions and constants are properly captured
2. **Context Immutability**: Maintain immutable context threading
3. **Error Handling**: Propagate position information for runtime errors
4. **Type Safety**: Use TypeScript types to ensure correctness

## Example Usage

```typescript
import { compile } from './compiler';
import { parse } from './parser';

const ast = parse("Patient.name.where(use = 'official').given");
const compiled = compile(ast);

// Use compiled function
const result = compiled([patient], context);
```

## Dependencies

- Existing parser (for AST)
- Existing interpreter types (Context, EvaluationResult)
- Existing interpreter helpers (isTruthy, etc.)

## Estimated Effort

~4-6 hours for basic implementation and tests

## Status: COMPLETED

## What Was Done

1. **Created compiler module structure** in `src/compiler/`:
   - `compiler.ts` - Main compiler class with node compilation methods
   - `types.ts` - Type definitions for compiled nodes
   - `index.ts` - Public API exports

2. **Implemented node compilers** for all basic node types:
   - Literal nodes (numbers, strings, booleans, null, collections)
   - Identifier nodes (property navigation with array flattening)
   - Variable nodes ($this, $index, %user-variables)
   - Binary operators (all arithmetic, comparison, logical, membership, string operators)
   - Unary operators (not, +, -)
   - Dot operator (pipeline composition)
   - Union operator (combining collections)
   - Index operator (array access)
   - Collection nodes
   - Function calls (with special inline compilation for where/select)

3. **Created comprehensive test suite** (`test/compiler.test.ts`):
   - Tests for all node types comparing compiler output with interpreter
   - Error handling tests
   - Performance comparison showing compiler is faster than interpreter
   - Helper function tests

4. **Key design decisions**:
   - Generates closures directly in memory (no eval or source code generation)
   - Maintains exact same semantics as interpreter
   - Special inline compilation for performance-critical functions (where, select)
   - Falls back to interpreter for complex functions not yet compiled
   - Proper error position propagation

## Results

- All basic node types compile correctly and produce identical results to the interpreter
- Performance tests show compiled expressions execute faster than interpreted ones
- Clean architecture that can be extended with more optimizations
- TypeScript type-safe implementation

## Notes

- Function registration requires runtime imports due to module initialization order
- Some complex functions still use interpreter fallback (can be optimized later)
- Ready for optimization passes and additional node type support