# ADR-010: Public API for FHIRPath Library

## Status

Proposed

## Context

The FHIRPath library currently lacks a well-defined public API. While the internal components (lexer, parser, interpreter, compiler, analyzer) are well-structured, there is no clear entry point for library consumers. The `src/index.ts` file is empty, and users would need to directly import internal modules, exposing them to implementation details that may change.

Key issues:
- No stable public interface for common operations (parse, evaluate, compile)
- Internal implementation details are exposed to consumers
- Type definitions and error handling are scattered across modules
- No clear extension points for custom functions or model providers
- Integration with FHIR resources requires knowledge of internal structures

Library consumers need:
- Simple, intuitive API for common FHIRPath operations
- Type-safe interfaces for TypeScript users
- Clear error handling and reporting
- Extension mechanisms for custom behaviors
- Stable API that shields them from internal changes

## Decision

Create a clean public API that provides a facade over the internal implementation details. The API will expose core functionality through well-defined interfaces while maintaining flexibility for advanced use cases.

### Core API Design

1. **Main Entry Point**:
   ```typescript
   // Default export with common operations
   export default {
     parse,
     evaluate,
     compile,
     analyze
   };
   
   // Named exports for advanced usage
   export { FHIRPath, FHIRPathError, Context, Registry };
   ```

2. **Primary Functions**:
   ```typescript
   // Parse expression into AST
   function parse(expression: string): FHIRPathExpression;
   
   // Evaluate expression directly
   function evaluate(
     expression: string | FHIRPathExpression,
     input?: any,
     context?: EvaluationContext
   ): any[];
   
   // Compile to optimized function
   function compile(
     expression: string | FHIRPathExpression,
     options?: CompileOptions
   ): CompiledExpression;
   
   // Analyze expression for validation
   function analyze(
     expression: string | FHIRPathExpression,
     options?: AnalyzeOptions
   ): AnalysisResult;
   ```

3. **Core Types**:
   ```typescript
   interface FHIRPathExpression {
     readonly ast: ASTNode;
     evaluate(input?: any, context?: EvaluationContext): any[];
     compile(options?: CompileOptions): CompiledExpression;
     analyze(options?: AnalyzeOptions): AnalysisResult;
     toString(): string;
   }
   
   interface CompiledExpression {
     (input?: any, context?: EvaluationContext): any[];
     readonly source: string;
   }
   
   interface EvaluationContext {
     variables?: Record<string, any>;
     environment?: Record<string, any>;
     modelProvider?: ModelProvider;
     customFunctions?: CustomFunctionMap;
   }
   ```

4. **Error Handling**:
   ```typescript
   class FHIRPathError extends Error {
     constructor(
       message: string,
       public code: ErrorCode,
       public location?: Location,
       public expression?: string
     );
   }
   
   enum ErrorCode {
     PARSE_ERROR = 'PARSE_ERROR',
     TYPE_ERROR = 'TYPE_ERROR',
     RUNTIME_ERROR = 'RUNTIME_ERROR',
     // ... other codes
   }
   ```

5. **Builder Pattern for Complex Setup**:
   ```typescript
   class FHIRPath {
     static builder(): FHIRPathBuilder;
   }
   
   interface FHIRPathBuilder {
     withModelProvider(provider: ModelProvider): this;
     withCustomFunction(name: string, fn: CustomFunction): this;
     withVariable(name: string, value: any): this;
     build(): FHIRPathAPI;
   }
   
   interface FHIRPathAPI {
     parse(expression: string): FHIRPathExpression;
     evaluate(expression: string | FHIRPathExpression, input?: any): any[];
     compile(expression: string | FHIRPathExpression): CompiledExpression;
     analyze(expression: string | FHIRPathExpression): AnalysisResult;
     registry: RegistryAPI;
   }
   ```

### Integration with Existing Architecture

- Leverages ADR-007's registry for operation lookup
- Uses ADR-009's prototype-based context internally
- Maintains compatibility with ADR-008's test structure
- Follows ADR-004's error propagation patterns

### Registry Access

Provide controlled access to the operations registry for introspection and extensibility:

```typescript
interface RegistryAPI {
  // List operations by type
  listFunctions(): OperationMetadata[];
  listOperators(): OperationMetadata[];
  listAllOperations(): OperationMetadata[];
  
  // Check existence
  hasOperation(name: string): boolean;
  hasFunction(name: string): boolean;
  hasOperator(symbol: string): boolean;
  
  // Get operation metadata (read-only view)
  getOperationInfo(name: string): OperationInfo | undefined;
  
  // Extension validation
  canRegisterFunction(name: string): boolean;
}

// Simplified metadata for public consumption
interface OperationMetadata {
  name: string;
  kind: 'function' | 'operator' | 'literal';
  syntax: {
    notation: string;  // e.g., "a + b", "substring(start, length)"
  };
}

interface OperationInfo extends OperationMetadata {
  signature: {
    input?: {
      types?: string[];
      cardinality?: 'singleton' | 'collection' | 'any';
    };
    parameters?: Array<{
      name: string;
      types?: string[];
      cardinality?: 'singleton' | 'collection' | 'any';
      optional?: boolean;
    }>;
    output?: {
      type?: string | 'dynamic';
      cardinality?: 'singleton' | 'collection' | 'preserve-input';
    };
  };
  description?: string;
  examples?: string[];
}
```

Usage examples:
```typescript
// Check available operations
const functions = fhirpath.registry.listFunctions();
console.log(`Available functions: ${functions.map(f => f.name).join(', ')}`);

// Validate custom function name
if (!fhirpath.registry.canRegisterFunction('myFunc')) {
  throw new Error('Function name conflicts with built-in operation');
}

// Get operation details for documentation
const whereInfo = fhirpath.registry.getOperationInfo('where');
console.log(whereInfo?.syntax.notation); // "where(expression)"

// With builder pattern
const fp = FHIRPath.builder()
  .withCustomFunction('myFunc', myFuncImpl)
  .build();

// Verify custom function is available
console.log(fp.registry.hasFunction('myFunc')); // true
```

### Extension Points

1. **Custom Functions**: Register functions via context or builder
2. **Model Providers**: Plug in FHIR model knowledge
3. **Type Resolvers**: Custom type resolution strategies
4. **Error Handlers**: Custom error formatting/logging
5. **Registry Introspection**: Query available operations

## Consequences

### Positive

- **Stable API**: Users are shielded from internal implementation changes
- **Ease of Use**: Simple operations are simple, complex operations are possible
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Extensibility**: Clear extension points for customization
- **Documentation**: Public API is easier to document and understand
- **Testing**: Consumers can mock the public API easily
- **Migration Path**: Internal refactoring won't break consumer code
- **Discoverability**: Registry access enables runtime introspection of capabilities
- **Validation**: Can check for naming conflicts before registering custom functions
- **Tool Support**: IDEs and documentation generators can query available operations

### Negative

- **Abstraction Layer**: Additional indirection may impact performance slightly
- **API Surface**: Need to maintain backward compatibility once published
- **Bundle Size**: Facade pattern may add some overhead
- **Learning Curve**: Advanced users need to learn both public API and extension mechanisms
- **Migration Effort**: Existing code using internal modules needs updating
- **Registry Exposure**: Need careful design to prevent leaking internal implementation details
- **Versioning Complexity**: Registry API changes need careful versioning

## Alternatives Considered

1. **Direct Module Exports**:
   - Export internal modules directly from index.ts
   - Pros: No abstraction overhead, full access to internals
   - Cons: Exposes implementation details, harder to maintain
   - Not chosen: Violates encapsulation principles

2. **Class-Based API**:
   - Single FHIRPath class with all methods
   - Pros: Object-oriented, stateful contexts
   - Cons: Less functional, harder to tree-shake
   - Not chosen: Functional approach better fits FHIRPath's nature

3. **Minimal API**:
   - Only expose evaluate() function
   - Pros: Extremely simple
   - Cons: No access to AST, compilation, or analysis
   - Not chosen: Too limiting for advanced use cases

4. **Plugin Architecture**:
   - Everything as plugins, minimal core
   - Pros: Maximum flexibility
   - Cons: Complex setup, steep learning curve
   - Not chosen: Overkill for FHIRPath's scope