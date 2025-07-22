# Task 005: Migrate Compiler to Use Registry

## Objective
Update the compiler to use the unified registry for generating closure-based compiled expressions.

## Requirements

1. **Implement closure-based compilation**:
   - Use `operation.compile()` for all operations
   - Generate closures instead of strings
   - Include type information in compiled output

2. **Update compilation methods**:
   - Unify operator/function/literal compilation
   - Use registry lookups for all operations
   - Remove any string concatenation

3. **Runtime context**:
   - Implement `RuntimeContext` interface
   - Update execution to use context
   - Handle environment variables

4. **Optimization opportunities**:
   - Leverage type information for optimizations
   - Use singleton information to avoid array wrapping
   - Inline literal values

## Files to Create/Update

- `/src/compiler/compiler.ts` - Main compiler implementation
- `/src/compiler/types.ts` - CompiledExpression and RuntimeContext
- `/src/compiler/runtime.ts` - Runtime execution helpers

## Key Implementation

```typescript
class Compiler {
  compile(ast: ASTNode): CompiledExpression {
    // Dispatch to specific compilers
  }
  
  compileBinary(node: BinaryNode): CompiledExpression {
    const op = Registry.getByToken(node.operator);
    const left = this.compile(node.left);
    const right = this.compile(node.right);
    return op.compile(this, null, [left, right]);
  }
  
  execute(compiled: CompiledExpression, input: any[], env: Record<string, any>): any[] {
    return compiled.fn({ input, env });
  }
}
```

## Tests

- Compilation output tests
- Execution correctness tests
- Performance benchmarks
- Type preservation tests

## Dependencies

- All previous tasks should be completed
- This is the final migration step