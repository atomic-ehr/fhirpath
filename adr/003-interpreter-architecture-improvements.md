# ADR 003: Interpreter Architecture Improvements

## Status
Proposed

## Context
The current interpreter implementation has several architectural issues that impact performance, maintainability, and extensibility:

1. **Performance Issues**:
   - Heavy use of `JSON.stringify()` for equality comparisons in set operations
   - Excessive context copying on every modification
   - No caching or optimization of expressions

2. **Architecture Issues**:
   - Large switch statement for node type dispatch
   - Mixed concerns between evaluation logic and type checking
   - Tight coupling between components

3. **Developer Experience**:
   - Limited debugging capabilities
   - Basic error messages without context
   - Hard to extend with custom functions

## Decision

We will implement a phased improvement plan focusing on immediate wins first:

### Phase 1: Performance Critical Fixes

#### 1.1 Value Equality Without Serialization
Replace JSON.stringify with proper deep equality:

```typescript
class ValueComparator {
  static equals(a: any, b: any, seen = new WeakSet()): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;
    
    if (typeof a === 'object') {
      // Handle circular references
      if (seen.has(a)) return false;
      seen.add(a);
      
      if (Array.isArray(a)) {
        if (!Array.isArray(b) || a.length !== b.length) return false;
        return a.every((v, i) => this.equals(v, b[i], seen));
      }
      
      // Handle FHIR resources
      const keysA = Object.keys(a).sort();
      const keysB = Object.keys(b).sort();
      if (!this.equals(keysA, keysB, seen)) return false;
      
      return keysA.every(key => this.equals(a[key], b[key], seen));
    }
    
    return false;
  }
  
  static hash(value: any): string {
    // Implement stable hashing for set operations
    // without JSON.stringify
  }
}
```

#### 1.2 Immutable Context
Replace deep copying with structural sharing:

```typescript
class ImmutableContext implements Context {
  private constructor(
    private readonly _variables: Map<string, any[]>,
    private readonly _env: Readonly<EnvVariables>,
    private readonly _rootVars: Readonly<RootVariables>
  ) {}
  
  static create(input?: any[]): ImmutableContext {
    return new ImmutableContext(
      new Map(),
      {},
      { $context: input, $resource: input, $rootResource: input }
    );
  }
  
  setVariable(name: string, value: any[]): ImmutableContext {
    const newVars = new Map(this._variables);
    newVars.set(name, value);
    return new ImmutableContext(newVars, this._env, this._rootVars);
  }
  
  setIteratorContext(item: any, index: number): ImmutableContext {
    return new ImmutableContext(
      this._variables,
      { ...this._env, $this: [item], $index: index },
      this._rootVars
    );
  }
}
```

### Phase 2: Architecture Refactoring

#### 2.1 Visitor Pattern for AST Traversal
```typescript
interface ExpressionVisitor<T> {
  visitLiteral(node: LiteralNode, context: T): EvaluationResult;
  visitIdentifier(node: IdentifierNode, context: T): EvaluationResult;
  visitBinary(node: BinaryNode, context: T): EvaluationResult;
  // ... other visit methods
}

class EvaluationVisitor implements ExpressionVisitor<EvaluationContext> {
  constructor(private interpreter: Interpreter) {}
  
  visit(node: ASTNode, context: EvaluationContext): EvaluationResult {
    return node.accept(this, context);
  }
  
  visitBinary(node: BinaryNode, ctx: EvaluationContext): EvaluationResult {
    if (node.operator === TokenType.DOT) {
      // Pipeline evaluation
      const left = this.visit(node.left, ctx);
      return this.visit(node.right, { ...ctx, input: left.value });
    }
    // ... handle other operators
  }
}
```

#### 2.2 Evaluation Pipeline
```typescript
interface EvaluationStage {
  process(ast: ASTNode, context: Context): ASTNode | EvaluationResult;
}

class EvaluationPipeline {
  private stages: EvaluationStage[] = [
    new ValidationStage(),
    new OptimizationStage(),
    new EvaluationStage()
  ];
  
  evaluate(ast: ASTNode, input: any[], context?: Context): any[] {
    let result: any = ast;
    const ctx = context || ImmutableContext.create(input);
    
    for (const stage of this.stages) {
      result = stage.process(result, ctx);
      if (isEvaluationResult(result)) {
        return result.value;
      }
    }
    
    throw new Error('Pipeline did not produce result');
  }
}
```

### Phase 3: Enhanced Features

#### 3.1 Comprehensive Error Handling
```typescript
class RichEvaluationError extends Error {
  constructor(
    message: string,
    public readonly details: {
      position?: Position;
      expression?: string;
      input?: any[];
      actualType?: string;
      expectedType?: string;
      suggestions?: string[];
    }
  ) {
    super(message);
    this.name = 'EvaluationError';
  }
  
  toString(): string {
    const parts = [this.message];
    
    if (this.details.position) {
      parts.push(`at line ${this.details.position.line}, column ${this.details.position.column}`);
    }
    
    if (this.details.expression) {
      parts.push(`in expression: ${this.details.expression}`);
    }
    
    if (this.details.actualType && this.details.expectedType) {
      parts.push(`expected ${this.details.expectedType}, got ${this.details.actualType}`);
    }
    
    if (this.details.suggestions?.length) {
      parts.push(`suggestions: ${this.details.suggestions.join(', ')}`);
    }
    
    return parts.join('\n  ');
  }
}
```

#### 3.2 Evaluation Tracing
```typescript
interface TraceEntry {
  timestamp: number;
  node: ASTNode;
  nodeType: string;
  input: any[];
  output: any[];
  duration: number;
  contextSnapshot: Record<string, any>;
}

class TracingInterpreter extends Interpreter {
  private trace: TraceEntry[] = [];
  
  protected override evaluate(
    node: ASTNode, 
    input: any[], 
    context: Context
  ): EvaluationResult {
    const start = performance.now();
    
    const result = super.evaluate(node, input, context);
    
    this.trace.push({
      timestamp: Date.now(),
      node,
      nodeType: node.type,
      input,
      output: result.value,
      duration: performance.now() - start,
      contextSnapshot: this.captureContext(context)
    });
    
    return result;
  }
  
  getTrace(): TraceEntry[] {
    return [...this.trace];
  }
}
```

## Consequences

### Positive
- **Performance**: 10-100x improvement for set operations on large collections
- **Memory**: Reduced GC pressure from context copying
- **Maintainability**: Cleaner separation of concerns
- **Extensibility**: Easier to add new features
- **Debugging**: Rich error messages and tracing

### Negative
- **Migration effort**: Need to update existing code
- **Complexity**: More abstractions to understand
- **Testing**: Need comprehensive tests for new components

### Neutral
- **Bundle size**: Slightly larger due to new abstractions
- **Learning curve**: Developers need to understand new patterns

## Implementation Plan

1. **Week 1**: Implement ValueComparator and update set operations
2. **Week 2**: Implement ImmutableContext and update all usages
3. **Week 3**: Implement visitor pattern and migrate node evaluation
4. **Week 4**: Add rich error handling and basic tracing
5. **Week 5**: Testing, benchmarking, and documentation

## Alternatives Considered

1. **Minimal fixes only**: Just fix JSON.stringify issue
   - Pros: Quick to implement
   - Cons: Doesn't address architectural issues

2. **Complete rewrite**: Start from scratch with new architecture
   - Pros: Clean slate, optimal design
   - Cons: High risk, long timeline

3. **Use existing library**: Switch to a FHIRPath library
   - Pros: No maintenance burden
   - Cons: Less control, may not meet requirements