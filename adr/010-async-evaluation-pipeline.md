# ADR-010: Async Evaluation Pipeline

## Status
Proposed

## Context
Currently, the FHIRPath evaluation pipeline has a mix of synchronous and asynchronous operations:
- The ModelProvider's `getType` needs to be async to support lazy loading of FHIR schemas
- The analyzer calls `getTypeFromCache` as a synchronous workaround
- The interpreter cannot await async operations in its visitor methods
- This leads to incomplete type information and failing tests

## Decision
Convert the entire FHIRPath evaluation pipeline to be async by default.

## Implementation Plan

### Phase 1: Update Type System (Foundation)
1. **ModelProvider Interface** (`src/types.ts`)
   - Change `getType(typeName: string): TypeInfo` to `getType(typeName: string): Promise<TypeInfo>`
   - Change `getElements(typeName: string): ElementDefinition[]` to `getElements(typeName: string): Promise<ElementDefinition[]>`
   - Keep `ofType` synchronous (works with already-loaded TypeInfo)

2. **FHIRModelProvider** (`src/model-provider.ts`)
   - Update `getType` to be async and use `getSchema` internally
   - Remove `getTypeFromCache` method entirely
   - Update `getElements` to be async
   - Ensure transparent caching in all methods

### Phase 2: Make Interpreter Async (Core Change)
1. **Interpreter Class** (`src/interpreter.ts`)
   - Change `evaluate` method signature to return `Promise<EvaluationResult>`
   - Update all visitor methods to be async:
     - `evaluateLiteral` → `async evaluateLiteral`
     - `evaluateIdentifier` → `async evaluateIdentifier`
     - `evaluateBinary` → `async evaluateBinary`
     - etc.
   - Add `await` for recursive evaluate calls
   - Add `await` for ModelProvider.getType calls

2. **Operation Evaluators** (`src/operations/*.ts`)
   - Change `OperationEvaluator` type to return `Promise<EvaluationResult>`
   - Update all operation implementations to be async
   - Special attention to:
     - `where` function (needs async predicate evaluation)
     - `select` function (needs async projection)
     - `ofType` function (needs async type checking)
     - Binary operators that evaluate operands

3. **Function Evaluators** (`src/operations/*-function.ts`)
   - Change `FunctionEvaluator` type to return `Promise<EvaluationResult>`
   - Update all function implementations
   - The `evaluator` callback passed to functions needs to be async

### Phase 3: Make Analyzer Async
1. **Analyzer Class** (`src/analyzer.ts`)
   - Change `analyze` method to return `Promise<AnalysisResult>`
   - Update visitor methods to be async
   - Add `await` for ModelProvider.getType calls
   - Remove all references to `getTypeFromCache`

### Phase 4: Update Public API
1. **Main evaluate function** (`src/index.ts`)
   - Change signature: `evaluate(expression: string, options?: EvaluateOptions): Promise<any[]>`
   - Add `await` for analyzer.analyze
   - Add `await` for interpreter.evaluate
   - Update JSDoc to reflect Promise return

2. **analyze function** (`src/index.ts`)
   - Change signature: `analyze(expression: string, options?: AnalyzeOptions): Promise<AnalysisResult>`
   - Add `await` for analyzer.analyze

### Phase 5: Update Tests and Tools
1. **Test Suite** (`test/*.test.ts`)
   - Update all test functions to be async
   - Add `await` before all `evaluate()` calls
   - Update test helpers to handle Promises

2. **Tools** (`tools/*.ts`)
   - `interpreter.ts`: Make main function async, await evaluate
   - `testcase.ts`: Update test runners to await evaluate
   - `inspect.ts`: Make inspect async, await evaluate
   - Any other tools that call evaluate

3. **Documentation**
   - Update README examples to show async usage
   - Update API documentation
   - Add migration guide for users

### Phase 6: Cleanup
1. Remove all temporary workarounds:
   - `getTypeFromCache` method
   - `getTypeSync` (if any remain)
   - Synchronous type loading in tests

2. Optimize caching strategy:
   - Ensure efficient cache hits
   - Consider pre-warming cache for common types

## Consequences

### Positive
- Clean, consistent async API throughout
- Natural support for lazy loading
- No need for synchronous workarounds
- Better error handling with async/await
- Future-proof for other async operations (external data sources, etc.)

### Negative
- **Breaking Change**: Public API becomes async
- All consumers must update their code to use async/await
- Potential performance impact if not properly optimized
- More complex error handling in some cases

### Migration Path
Users will need to update their code:

**Before:**
```typescript
const result = evaluate('Patient.name', { input: patient });
```

**After:**
```typescript
const result = await evaluate('Patient.name', { input: patient });
```

## Alternatives Considered
1. **Keep dual sync/async APIs**: Rejected due to complexity and maintenance burden
2. **Pre-load all types**: Rejected due to memory usage and startup time
3. **Lazy loading with synchronous blocking**: Rejected as anti-pattern in JavaScript

## References
- Issue: Tests failing due to incomplete type information
- Related: ADR-009 (Dynamic Type Discovery)