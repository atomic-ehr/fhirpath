# ADR-003: FHIRPath to JavaScript Closure Compiler

## Status

Proposed

## Context

The current FHIRPath implementation uses an AST interpreter that traverses the syntax tree for each evaluation. While this approach is correct and maintainable, it has performance limitations:

1. **Runtime overhead**: Each evaluation requires traversing the AST, with method calls and type checking at each node
2. **No optimization**: Cannot leverage JavaScript engine optimizations or perform compile-time optimizations
3. **Repeated parsing**: Frequently used expressions must be re-interpreted each time

FHIRPath expressions are often evaluated millions of times in production systems when processing large datasets or validating FHIR resources. Performance is critical for:
- Bulk data processing
- Real-time validation
- Complex queries over large resource bundles

## Decision

Implement a compiler that transforms FHIRPath AST nodes into JavaScript closures. Each AST node will be compiled into a JavaScript function with the signature:

```typescript
type CompiledNode = (input: any[], context: Context) => EvaluationResult;
```

This approach:
1. Maintains the exact same semantics as the interpreter
2. Follows the established mental model where each node is a stream processor
3. Generates plain JavaScript functions that can be optimized by the JavaScript engine
4. Allows for compile-time optimizations

### Compilation Examples

**Literal Node**:
```javascript
// AST: { type: 'Literal', value: 42 }
// Compiles to:
(input, context) => ({ value: [42], context })
```

**Identifier Node**:
```javascript
// AST: { type: 'Identifier', name: 'name' }
// Compiles to:
(input, context) => {
  const results = [];
  for (const item of input) {
    if (item != null && typeof item === 'object' && item.name !== undefined) {
      if (Array.isArray(item.name)) {
        results.push(...item.name);
      } else {
        results.push(item.name);
      }
    }
  }
  return { value: results, context };
}
```

**Binary Dot Operator** (composition):
```javascript
// AST: { type: 'Binary', operator: '.', left: leftNode, right: rightNode }
// Compiles to:
(input, context) => {
  const leftResult = compiledLeft(input, context);
  return compiledRight(leftResult.value, leftResult.context);
}
```

**Where Function** (higher-order):
```javascript
// AST: { type: 'Function', name: 'where', arguments: [predicateNode] }
// Compiles to:
(input, context) => {
  const results = [];
  for (let i = 0; i < input.length; i++) {
    const item = input[i];
    const iterContext = { ...context, env: { ...context.env, $this: [item], $index: i }};
    const predResult = compiledPredicate([item], iterContext);
    if (predResult.value.length > 0 && predResult.value[0]) {
      results.push(item);
    }
  }
  return { value: results, context };
}
```

## Consequences

### Positive

- **Performance**: 10-100x faster execution for complex expressions
- **Optimization opportunities**: 
  - Constant folding at compile time
  - Dead code elimination
  - Inline simple operations
  - Common subexpression elimination
- **Caching**: Compiled functions can be cached and reused
- **Debugging**: Can generate readable JavaScript with source maps
- **JIT benefits**: JavaScript engines can further optimize the generated code
- **Memory efficiency**: No AST traversal overhead during execution

### Negative

- **Complexity**: Additional compilation step adds complexity
- **Binary size**: Compiler adds to the library size (~20-30KB estimated)
- **Debugging complexity**: Need to maintain source maps for debugging
- **Maintenance**: Two execution engines to maintain (interpreter and compiler)
- **Compilation overhead**: Initial compilation takes time (mitigated by caching)

## Alternatives Considered

### 1. Optimize the Interpreter
- Add caching, memoization, and other optimizations to the interpreter
- **Rejected because**: Limited optimization potential, still has fundamental overhead

### 2. Bytecode VM
- Compile to custom bytecode and implement a stack-based VM
- **Rejected because**: More complex, cannot leverage JavaScript engine optimizations

### 3. WebAssembly Compilation
- Compile FHIRPath to WebAssembly
- **Rejected because**: Much more complex, harder to debug, less portable

### 4. Generate TypeScript/JavaScript Source
- Generate source code files that can be compiled with TypeScript
- **Rejected because**: Requires build step, harder to use dynamically

### 5. JIT Compilation with eval()
- Generate JavaScript source code and use eval() or Function constructor
- **Rejected because**: Security concerns, CSP restrictions, harder to debug

## Implementation Strategy

1. **Phase 1**: Basic compiler for core nodes (literals, identifiers, basic operators)
2. **Phase 2**: Function compilation and context handling
3. **Phase 3**: Optimization passes (constant folding, inlining)
4. **Phase 4**: Source map generation and debugging support
5. **Phase 5**: Performance benchmarking and optimization

The compiler will coexist with the interpreter, allowing gradual migration and fallback for edge cases.