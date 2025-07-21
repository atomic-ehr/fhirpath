# Interpreter Code Structure Improvements

## Current Issues

1. **Monolithic Interpreter Class**: All evaluation logic in one large class
2. **Large Switch Statement**: 14+ cases in main evaluate method
3. **Mixed Responsibilities**: Evaluation, type checking, and error handling mixed
4. **Tight Coupling**: Direct dependencies between components
5. **Limited Extensibility**: Hard to add new node types or behaviors

## Proposed Structure

### 1. Separate Evaluation Strategies

Instead of one large interpreter class, create focused evaluators:

```typescript
// Base interface for all evaluators
interface NodeEvaluator<T extends ASTNode = ASTNode> {
  canEvaluate(node: ASTNode): node is T;
  evaluate(node: T, input: any[], context: Context, interpreter: Interpreter): EvaluationResult;
}

// Specific evaluators
class LiteralEvaluator implements NodeEvaluator<LiteralNode> {
  canEvaluate(node: ASTNode): node is LiteralNode {
    return node.type === NodeType.Literal;
  }
  
  evaluate(node: LiteralNode, input: any[], context: Context): EvaluationResult {
    const value = node.value === null ? [] : [node.value];
    return { value, context };
  }
}

class IdentifierEvaluator implements NodeEvaluator<IdentifierNode> {
  constructor(private propertyNavigator: PropertyNavigator) {}
  
  canEvaluate(node: ASTNode): node is IdentifierNode {
    return node.type === NodeType.Identifier;
  }
  
  evaluate(node: IdentifierNode, input: any[], context: Context): EvaluationResult {
    return this.propertyNavigator.navigate(input, node.name, context);
  }
}

// Registry pattern
class EvaluatorRegistry {
  private evaluators: NodeEvaluator[] = [];
  
  register(evaluator: NodeEvaluator): void {
    this.evaluators.push(evaluator);
  }
  
  getEvaluator(node: ASTNode): NodeEvaluator {
    const evaluator = this.evaluators.find(e => e.canEvaluate(node));
    if (!evaluator) {
      throw new Error(`No evaluator for node type: ${node.type}`);
    }
    return evaluator;
  }
}
```

### 2. Extract Property Navigation

```typescript
interface PropertyNavigator {
  navigate(input: any[], property: string, context: Context): EvaluationResult;
}

class FHIRPropertyNavigator implements PropertyNavigator {
  navigate(input: any[], property: string, context: Context): EvaluationResult {
    const results: any[] = [];
    
    for (const item of input) {
      if (this.isPrimitive(item)) continue;
      
      const value = this.getProperty(item, property);
      if (value !== undefined) {
        this.addToResults(results, value);
      }
    }
    
    return { value: results, context };
  }
  
  private isPrimitive(item: any): boolean {
    return item == null || typeof item !== 'object';
  }
  
  private getProperty(item: any, property: string): any {
    // Handle FHIR-specific property access
    return item[property];
  }
  
  private addToResults(results: any[], value: any): void {
    if (Array.isArray(value)) {
      results.push(...value);
    } else {
      results.push(value);
    }
  }
}
```

### 3. Operator Evaluation Strategy

```typescript
// Base for all operators
abstract class OperatorEvaluator {
  abstract supports(operator: TokenType): boolean;
  abstract evaluate(left: any[], right: any[], operator: TokenType): any[];
}

class ArithmeticOperatorEvaluator extends OperatorEvaluator {
  private operations = new Map<TokenType, (a: number, b: number) => number>([
    [TokenType.PLUS, (a, b) => a + b],
    [TokenType.MINUS, (a, b) => a - b],
    [TokenType.STAR, (a, b) => a * b],
    [TokenType.SLASH, (a, b) => a / b],
    [TokenType.DIV, (a, b) => Math.floor(a / b)],
    [TokenType.MOD, (a, b) => a % b],
  ]);
  
  supports(operator: TokenType): boolean {
    return this.operations.has(operator);
  }
  
  evaluate(left: any[], right: any[], operator: TokenType): any[] {
    if (left.length === 0 || right.length === 0) return [];
    
    const leftVal = CollectionUtils.toSingleton(left);
    const rightVal = CollectionUtils.toSingleton(right);
    
    this.validateTypes(leftVal, rightVal);
    
    const operation = this.operations.get(operator)!;
    return [operation(leftVal, rightVal)];
  }
  
  private validateTypes(left: any, right: any): void {
    if (typeof left !== 'number' || typeof right !== 'number') {
      throw new EvaluationError('Arithmetic operations require numbers');
    }
  }
}

// Composite evaluator
class BinaryOperatorEvaluator {
  private evaluators: OperatorEvaluator[] = [
    new ArithmeticOperatorEvaluator(),
    new ComparisonOperatorEvaluator(),
    new LogicalOperatorEvaluator(),
    new MembershipOperatorEvaluator(),
  ];
  
  evaluate(operator: TokenType, left: any[], right: any[]): any[] {
    const evaluator = this.evaluators.find(e => e.supports(operator));
    if (!evaluator) {
      throw new Error(`Unsupported operator: ${operator}`);
    }
    return evaluator.evaluate(left, right, operator);
  }
}
```

### 4. Context Management Improvements

```typescript
// Make context immutable and provide builder pattern
class ContextBuilder {
  private variables = new Map<string, any[]>();
  private env: EnvironmentVariables = {};
  private rootContext?: RootContext;
  
  withVariable(name: string, value: any[]): ContextBuilder {
    this.variables.set(name, value);
    return this;
  }
  
  withIterator(item: any, index: number): ContextBuilder {
    this.env.$this = [item];
    this.env.$index = index;
    return this;
  }
  
  withRootContext(context: RootContext): ContextBuilder {
    this.rootContext = context;
    return this;
  }
  
  build(): ImmutableContext {
    return new ImmutableContext(
      new Map(this.variables),
      { ...this.env },
      this.rootContext
    );
  }
}
```

### 5. Pipeline Architecture

```typescript
interface EvaluationPipeline {
  addStage(stage: PipelineStage): EvaluationPipeline;
  evaluate(node: ASTNode, input: any[], context: Context): EvaluationResult;
}

interface PipelineStage {
  name: string;
  process(node: ASTNode, input: any[], context: Context, next: NextFunction): EvaluationResult;
}

type NextFunction = (node: ASTNode, input: any[], context: Context) => EvaluationResult;

// Example stages
class ValidationStage implements PipelineStage {
  name = 'validation';
  
  process(node: ASTNode, input: any[], context: Context, next: NextFunction): EvaluationResult {
    // Validate before evaluation
    this.validateNode(node);
    this.validateInput(input);
    
    return next(node, input, context);
  }
}

class CachingStage implements PipelineStage {
  name = 'caching';
  private cache = new Map<string, EvaluationResult>();
  
  process(node: ASTNode, input: any[], context: Context, next: NextFunction): EvaluationResult {
    const key = this.getCacheKey(node, input, context);
    
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }
    
    const result = next(node, input, context);
    this.cache.set(key, result);
    return result;
  }
}

class TracingStage implements PipelineStage {
  name = 'tracing';
  private traces: TraceEntry[] = [];
  
  process(node: ASTNode, input: any[], context: Context, next: NextFunction): EvaluationResult {
    const start = performance.now();
    
    const result = next(node, input, context);
    
    this.traces.push({
      node,
      input,
      output: result.value,
      duration: performance.now() - start,
    });
    
    return result;
  }
  
  getTraces(): TraceEntry[] {
    return [...this.traces];
  }
}
```

### 6. Simplified Main Interpreter

```typescript
class ModularInterpreter {
  private registry: EvaluatorRegistry;
  private pipeline: EvaluationPipeline;
  
  constructor(config?: InterpreterConfig) {
    this.registry = this.createRegistry(config);
    this.pipeline = this.createPipeline(config);
  }
  
  evaluate(node: ASTNode, input: any[], context: Context): EvaluationResult {
    return this.pipeline.evaluate(node, input, context);
  }
  
  private createRegistry(config?: InterpreterConfig): EvaluatorRegistry {
    const registry = new EvaluatorRegistry();
    
    // Register core evaluators
    registry.register(new LiteralEvaluator());
    registry.register(new IdentifierEvaluator(new FHIRPropertyNavigator()));
    registry.register(new VariableEvaluator());
    registry.register(new BinaryEvaluator(new BinaryOperatorEvaluator()));
    registry.register(new FunctionEvaluator(FunctionRegistry));
    // ... more evaluators
    
    // Register custom evaluators from config
    config?.customEvaluators?.forEach(e => registry.register(e));
    
    return registry;
  }
  
  private createPipeline(config?: InterpreterConfig): EvaluationPipeline {
    const pipeline = new DefaultPipeline(this.registry);
    
    // Add stages based on config
    if (config?.validation) {
      pipeline.addStage(new ValidationStage());
    }
    
    if (config?.caching) {
      pipeline.addStage(new CachingStage());
    }
    
    if (config?.tracing) {
      pipeline.addStage(new TracingStage());
    }
    
    return pipeline;
  }
}
```

### 7. Error Handling Improvements

```typescript
// Centralized error factory
class EvaluationErrorFactory {
  static unknownNode(node: ASTNode): EvaluationError {
    return new EvaluationError(
      `Unknown node type: ${node.type}`,
      {
        position: node.position,
        nodeType: node.type,
        suggestions: this.getSuggestionsForNode(node)
      }
    );
  }
  
  static typeMismatch(expected: string, actual: string, node: ASTNode): EvaluationError {
    return new EvaluationError(
      `Type mismatch: expected ${expected}, got ${actual}`,
      {
        position: node.position,
        expectedType: expected,
        actualType: actual,
        suggestions: [`Convert value using to${expected}() function`]
      }
    );
  }
  
  static invalidOperation(operator: string, leftType: string, rightType: string): EvaluationError {
    return new EvaluationError(
      `Cannot apply ${operator} to ${leftType} and ${rightType}`,
      {
        operator,
        leftType,
        rightType,
        suggestions: this.getOperatorSuggestions(operator, leftType, rightType)
      }
    );
  }
}

// Error context enrichment
class ErrorContextEnricher implements PipelineStage {
  name = 'error-enricher';
  
  process(node: ASTNode, input: any[], context: Context, next: NextFunction): EvaluationResult {
    try {
      return next(node, input, context);
    } catch (error) {
      if (error instanceof EvaluationError && !error.hasContext()) {
        error.enrichWith({
          node,
          input: input.slice(0, 3), // First few items
          contextVars: this.extractContextVars(context),
          expression: this.getExpressionString(node)
        });
      }
      throw error;
    }
  }
}
```

## Benefits

1. **Modularity**: Each component has a single responsibility
2. **Extensibility**: Easy to add new node types or operators
3. **Testability**: Each component can be tested in isolation
4. **Configurability**: Behavior can be customized via configuration
5. **Maintainability**: Smaller, focused classes are easier to understand
6. **Performance**: Pipeline stages can be added/removed as needed
7. **Debugging**: Tracing and error enrichment built into architecture

## Migration Strategy

1. Start with new evaluator structure alongside existing interpreter
2. Migrate one node type at a time
3. Add pipeline stages incrementally
4. Run both implementations in parallel for validation
5. Switch over once all tests pass
6. Remove old implementation

This structure provides a clean, extensible foundation for the FHIRPath interpreter while maintaining all existing functionality.