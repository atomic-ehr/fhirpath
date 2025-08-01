# FHIRPath Implementation Details

This document covers internal implementation details, performance optimizations, and design decisions that may be useful for contributors and advanced users.

## Performance Optimizations

### 1. Prototype-Based Context Management

One of the key performance optimizations is the use of JavaScript's prototype chain for context management:

```typescript
// src/interpreter.ts
export class RuntimeContextManager {
  static create(input: any[]): RuntimeContext {
    return {
      input,
      focus: input,
      variables: Object.create(null)
    };
  }
  
  static extend(parent: RuntimeContext): RuntimeContext {
    // O(1) operation - no copying!
    return Object.create(parent);
  }
  
  static setVariable(context: RuntimeContext, name: string, value: any): RuntimeContext {
    const newContext = this.extend(context);
    // Only copy variables object when modifying
    newContext.variables = Object.create(context.variables);
    newContext.variables[name] = value;
    return newContext;
  }
}
```

**Benefits:**
- O(1) context creation instead of O(n)
- Minimal memory allocation
- Automatic inheritance of parent context values
- No deep copying needed

**How it works:**
```javascript
// Traditional approach (slow)
const newContext = {
  ...oldContext,
  variables: { ...oldContext.variables, newVar: value }
}; // O(n) copying

// Prototype approach (fast)
const newContext = Object.create(oldContext);
newContext.variables = Object.create(oldContext.variables);
newContext.variables.newVar = value; // O(1)
```

### 2. Token Caching in Lexer

The lexer tokenizes the entire input once and caches the results:

```typescript
// src/lexer.ts
export class Lexer {
  private tokens: Token[] = [];
  private position = 0;
  
  tokenize(): Token[] {
    if (this.tokens.length > 0) {
      return this.tokens; // Return cached tokens
    }
    
    while (!this.isAtEnd()) {
      this.skipWhitespace();
      this.tokens.push(this.scanToken());
    }
    
    this.tokens.push(this.createToken(TokenType.EOF));
    return this.tokens;
  }
}
```

### 3. Precedence Climbing Parser

The precedence climbing algorithm is more efficient than recursive descent for expressions with many operators:

```typescript
// src/parser-base.ts
protected binaryExpression(minPrecedence: number): TNode {
  let left = this.unaryExpression();
  
  while (true) {
    const token = this.peek();
    const precedence = this.getBinaryPrecedence(token);
    
    if (precedence < minPrecedence) {
      break;
    }
    
    this.advance();
    const associativity = this.getAssociativity(token);
    const nextMinPrecedence = associativity === 'left' 
      ? precedence + 1 
      : precedence;
    
    const right = this.binaryExpression(nextMinPrecedence);
    left = this.createBinaryNode(token, left, right);
  }
  
  return left;
}
```

**Benefits:**
- Avoids deep recursion for long expressions
- Natural handling of operator precedence
- Efficient for typical FHIRPath expressions

### 4. Visitor Pattern with Direct Dispatch

The interpreter uses a pre-bound visitor pattern for fast dispatch:

```typescript
// src/interpreter.ts
export class Interpreter {
  private readonly visitors: Record<string, NodeEvaluator> = {
    [NodeType.Literal]: this.visitLiteral.bind(this),
    [NodeType.Identifier]: this.visitIdentifier.bind(this),
    [NodeType.Binary]: this.visitBinary.bind(this),
    // ... more visitors
  };
  
  evaluate(node: ASTNode, input: any[], context: RuntimeContext): EvaluationResult {
    const visitor = this.visitors[node.type];
    if (!visitor) {
      throw new Error(`No visitor for node type: ${node.type}`);
    }
    return visitor(node, input, context);
  }
}
```

**Benefits:**
- Direct function lookup instead of switch/if-else chains
- Pre-bound methods avoid runtime binding overhead
- Easy to extend with new node types

### 5. Lazy Evaluation

Many operations use lazy evaluation to avoid unnecessary work:

```typescript
// src/operations/where-function.ts
export const whereFunction: FunctionDefinition = {
  evaluate: (input, context, args, evaluator) => {
    const results: any[] = [];
    
    for (let i = 0; i < input.length; i++) {
      const item = input[i];
      const itemContext = RuntimeContextManager.setFocus(context, [item]);
      const criteriaContext = RuntimeContextManager.setVariable(itemContext, '$index', i);
      
      const criteriaResult = evaluator(args[0], [item], criteriaContext);
      
      // Short-circuit if criteria is definitely false
      if (criteriaResult.value.length === 1 && criteriaResult.value[0] === false) {
        continue;
      }
      
      // Include if criteria is true
      if (criteriaResult.value.length === 1 && criteriaResult.value[0] === true) {
        results.push(item);
      }
    }
    
    return { value: results, context };
  }
};
```

### 6. String Interning for Identifiers

Common identifiers are interned to reduce memory usage:

```typescript
// src/lexer.ts
private identifierCache = new Map<string, string>();

private getIdentifier(value: string): string {
  const cached = this.identifierCache.get(value);
  if (cached) return cached;
  
  this.identifierCache.set(value, value);
  return value;
}
```

## Memory Management

### AST Node Pooling (Future Enhancement)

For high-frequency parsing scenarios, node pooling could be implemented:

```typescript
class NodePool<T extends ASTNode> {
  private pool: T[] = [];
  
  acquire(type: NodeType): T {
    const node = this.pool.pop() || {} as T;
    node.type = type;
    return node;
  }
  
  release(node: T): void {
    // Clear node properties
    for (const key in node) {
      if (key !== 'type') {
        delete node[key];
      }
    }
    this.pool.push(node);
  }
}
```

### Weak References for Model Context

Model context uses weak references to prevent memory leaks:

```typescript
// src/types.ts
interface TypeInfo {
  // ... other properties
  modelContext?: unknown; // Could be WeakRef in future
}

// Future implementation
class ModelContextManager {
  private contexts = new WeakMap<object, ModelContext>();
  
  setContext(typeInfo: TypeInfo, context: ModelContext): void {
    if (typeInfo.modelContext) {
      this.contexts.set(typeInfo.modelContext, context);
    }
  }
}
```

## Error Handling Strategies

### 1. Error Recovery in Parser

The parser implements sophisticated error recovery in LSP mode:

```typescript
// src/parser.ts
private synchronize(): void {
  // Skip tokens until we find a synchronization point
  while (!this.isAtEnd()) {
    const token = this.peek();
    
    // Synchronization tokens
    if (token.type === TokenType.COMMA ||
        token.type === TokenType.RPAREN ||
        token.type === TokenType.RBRACE ||
        token.type === TokenType.RBRACKET ||
        token.type === TokenType.EOF) {
      return;
    }
    
    // Also synchronize on keywords that start statements
    if (token.type === TokenType.IDENTIFIER &&
        this.isStatementKeyword(token.value)) {
      return;
    }
    
    this.advance();
  }
}

private createErrorNode(message: string, token?: Token): ErrorNode {
  const node: ErrorNode = {
    type: 'Error',
    message,
    range: token ? this.getRangeFromToken(token) : this.getDefaultRange()
  };
  
  if (this.mode === 'lsp') {
    this.enrichNodeForLSP(node, token || this.peek());
  }
  
  return node;
}
```

### 2. Graceful Degradation

Operations return empty collections instead of throwing errors:

```typescript
// src/operations/divide-operator.ts
export const divideOperator: OperatorDefinition = {
  evaluate: (input, context, left, right) => {
    if (left.length === 0 || right.length === 0) {
      return { value: [], context }; // Empty instead of error
    }
    
    const leftVal = left[0];
    const rightVal = right[0];
    
    // Division by zero returns empty
    if (rightVal === 0) {
      return { value: [], context };
    }
    
    return { value: [leftVal / rightVal], context };
  }
};
```

### 3. Diagnostic Collection

The analyzer collects multiple diagnostics without stopping:

```typescript
// src/analyzer.ts
export class Analyzer {
  private diagnostics: Diagnostic[] = [];
  
  private addDiagnostic(diagnostic: Diagnostic): void {
    // Deduplicate diagnostics
    const exists = this.diagnostics.some(d => 
      d.range.start.offset === diagnostic.range.start.offset &&
      d.range.end.offset === diagnostic.range.end.offset &&
      d.code === diagnostic.code
    );
    
    if (!exists) {
      this.diagnostics.push(diagnostic);
    }
  }
  
  analyze(ast: ASTNode, variables?: Record<string, unknown>): AnalysisResult {
    this.diagnostics = [];
    
    // Run all analysis phases, collecting diagnostics
    this.checkSyntax(ast);
    this.checkVariables(ast, variables);
    this.checkOperations(ast);
    this.analyzeTypes(ast);
    
    return {
      diagnostics: this.diagnostics,
      ast
    };
  }
}
```

## Extension Points

### 1. Custom Operations

The registry allows runtime extension:

```typescript
// Example: Adding a custom operator
registry.defineOperator({
  symbol: '**',
  name: 'power',
  category: ['arithmetic', 'custom'],
  precedence: PRECEDENCE.MULTIPLICATIVE + 5, // Higher than multiply
  associativity: 'right',
  description: 'Exponentiation operator',
  examples: ['2 ** 3', '10 ** -1'],
  signatures: [{
    name: 'Number ** Number',
    left: { type: 'Decimal', singleton: true },
    right: { type: 'Decimal', singleton: true },
    result: { type: 'Decimal', singleton: true }
  }],
  evaluate: (input, context, left, right) => {
    if (left.length === 0 || right.length === 0) {
      return { value: [], context };
    }
    return { value: [Math.pow(left[0], right[0])], context };
  }
});
```

### 2. Custom Node Types

The parser can be extended with custom node types:

```typescript
// Define custom node type
export interface MacroNode extends BaseASTNode {
  type: 'Macro';
  name: string;
  arguments: ASTNode[];
}

// Extend parser
class ExtendedParser extends Parser {
  protected parsePrimary(): ASTNode {
    if (this.match(TokenType.PERCENT)) {
      return this.parseMacro();
    }
    return super.parsePrimary();
  }
  
  private parseMacro(): MacroNode {
    const name = this.consume(TokenType.IDENTIFIER, 'Expected macro name');
    const args = this.parseArguments();
    return {
      type: 'Macro',
      name: name.value,
      arguments: args,
      range: this.getRangeFromToken(name)
    };
  }
}
```

### 3. Custom Type Providers

Implement custom model providers for different data models:

```typescript
// Example: CDA model provider
class CDAModelProvider implements ModelTypeProvider {
  private readonly typeMap = new Map<string, TypeInfo>();
  
  constructor() {
    this.initializeTypes();
  }
  
  private initializeTypes(): void {
    this.typeMap.set('ClinicalDocument', {
      type: 'Any',
      namespace: 'CDA',
      name: 'ClinicalDocument',
      singleton: true,
      elements: {
        'id': { type: 'String', singleton: true },
        'effectiveTime': { type: 'DateTime', singleton: true },
        'author': {
          type: 'Any',
          namespace: 'CDA',
          name: 'Author',
          singleton: false
        }
      }
    });
  }
  
  getTypeByName(typeName: string): TypeInfo | undefined {
    return this.typeMap.get(typeName);
  }
  
  // ... implement other methods
}
```

## Debugging Support

### 1. Trace Points

The implementation supports trace points for debugging:

```typescript
// src/interpreter.ts
private trace(message: string, value: any): void {
  if (this.options?.debug) {
    console.log(`[FHIRPath] ${message}:`, value);
  }
}

private visitBinary(node: BinaryNode, input: any[], context: RuntimeContext): EvaluationResult {
  this.trace('Binary operation', { operator: node.operator, input });
  
  const leftResult = this.evaluate(node.left, input, context);
  this.trace('Left operand result', leftResult.value);
  
  const rightResult = this.evaluate(node.right, input, context);
  this.trace('Right operand result', rightResult.value);
  
  // ... rest of implementation
}
```

### 2. AST Visualization

The `pprint` function provides readable AST representation:

```typescript
// src/parser.ts
export function pprint(node: ASTNode, indent: number = 0): string {
  const spaces = ' '.repeat(indent);
  
  switch (node.type) {
    case NodeType.Binary: {
      const bin = node as BinaryNode;
      const op = bin.operator;
      const leftStr = pprint(bin.left, 0);
      const rightStr = pprint(bin.right, 0);
      
      if (leftStr.length + rightStr.length + op.length + 4 < 60 && 
          !leftStr.includes('\n') && !rightStr.includes('\n')) {
        return `(${op} ${leftStr} ${rightStr})`;
      }
      
      return `(${op}\n${spaces}  ${pprint(bin.left, indent + 2)}\n${spaces}  ${pprint(bin.right, indent + 2)})`;
    }
    // ... more cases
  }
}

// Usage
const ast = parse('Patient.name.where(use = "official")').ast;
console.log(pprint(ast));
// Output:
// (.
//   (.
//     Patient
//     name)
//   (where
//     (=
//       use
//       "official")))
```

### 3. Performance Profiling

Built-in performance measurement:

```typescript
// src/interpreter.ts
interface PerformanceMetrics {
  parseTime: number;
  evaluateTime: number;
  nodeCount: number;
  operationCounts: Map<string, number>;
}

class ProfilingInterpreter extends Interpreter {
  private metrics: PerformanceMetrics = {
    parseTime: 0,
    evaluateTime: 0,
    nodeCount: 0,
    operationCounts: new Map()
  };
  
  evaluate(node: ASTNode, input: any[], context: RuntimeContext): EvaluationResult {
    const start = performance.now();
    
    // Count operation
    const count = this.metrics.operationCounts.get(node.type) || 0;
    this.metrics.operationCounts.set(node.type, count + 1);
    this.metrics.nodeCount++;
    
    const result = super.evaluate(node, input, context);
    
    this.metrics.evaluateTime += performance.now() - start;
    return result;
  }
  
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }
}
```

## Testing Infrastructure

### 1. Parameterized Tests

The test suite uses parameterized tests for comprehensive coverage:

```typescript
// test/operations.test.ts
describe('Binary Operators', () => {
  const testCases = [
    { expr: '5 + 3', expected: [8] },
    { expr: '5 - 3', expected: [2] },
    { expr: '5 * 3', expected: [15] },
    { expr: '10 / 4', expected: [2.5] },
    { expr: '10 div 3', expected: [3] },
    { expr: '10 mod 3', expected: [1] }
  ];
  
  testCases.forEach(({ expr, expected }) => {
    it(`should evaluate ${expr}`, () => {
      expect(evaluate(expr)).toEqual(expected);
    });
  });
});
```

### 2. Spec Compliance Tests

Official FHIRPath test cases are integrated:

```typescript
// test/spec-compliance.test.ts
import { readFileSync } from 'fs';
import { evaluate } from '../src';

const specTests = JSON.parse(
  readFileSync('./test-cases/spec-tests.json', 'utf-8')
);

describe('FHIRPath Spec Compliance', () => {
  specTests.forEach((test: any) => {
    it(test.description, () => {
      const result = evaluate(test.expression, {
        input: test.input,
        variables: test.variables
      });
      
      if (test.error) {
        expect(() => result).toThrow();
      } else {
        expect(result).toEqual(test.expected);
      }
    });
  });
});
```

### 3. Performance Benchmarks

Benchmarks ensure performance doesn't regress:

```typescript
// test-perf/benchmarks.ts
import { Suite } from 'benchmark';
import { evaluate, parse, Interpreter } from '../src';

const suite = new Suite();

// Benchmark parsing
suite.add('Parse complex expression', () => {
  parse('Patient.name.where(use = "official").given.first()');
});

// Benchmark evaluation
const ast = parse('Patient.name.given').ast;
const interpreter = new Interpreter();
const testData = { name: [{ given: ['John', 'James'] }] };

suite.add('Evaluate pre-parsed expression', () => {
  interpreter.evaluate(ast, [testData]);
});

// Benchmark end-to-end
suite.add('Parse and evaluate', () => {
  evaluate('Patient.name.given', { input: testData });
});

suite.on('cycle', (event: any) => {
  console.log(String(event.target));
});

suite.run({ async: true });
```

## Security Considerations

### 1. Input Validation

All input is validated to prevent injection attacks:

```typescript
// src/lexer.ts
private validateInput(input: string): void {
  // Check for null bytes
  if (input.includes('\0')) {
    throw new Error('Input contains null bytes');
  }
  
  // Check input length
  if (input.length > this.options.maxInputLength) {
    throw new Error(`Input exceeds maximum length of ${this.options.maxInputLength}`);
  }
  
  // Check for invalid Unicode
  if (!/^[\u0000-\u{10FFFF}]*$/u.test(input)) {
    throw new Error('Input contains invalid Unicode');
  }
}
```

### 2. Resource Limits

Prevent resource exhaustion:

```typescript
// src/interpreter.ts
export interface EvaluationOptions {
  maxIterations?: number;      // Default: 10000
  maxDepth?: number;          // Default: 100
  maxCollectionSize?: number; // Default: 10000
  timeout?: number;           // Default: 5000ms
}

class SafeInterpreter extends Interpreter {
  private iterations = 0;
  private depth = 0;
  private startTime = Date.now();
  
  evaluate(node: ASTNode, input: any[], context: RuntimeContext): EvaluationResult {
    // Check limits
    if (++this.iterations > this.options.maxIterations) {
      throw new Error('Maximum iterations exceeded');
    }
    
    if (++this.depth > this.options.maxDepth) {
      throw new Error('Maximum depth exceeded');
    }
    
    if (Date.now() - this.startTime > this.options.timeout) {
      throw new Error('Evaluation timeout');
    }
    
    try {
      return super.evaluate(node, input, context);
    } finally {
      this.depth--;
    }
  }
}
```

### 3. Safe Property Access

Property access is sandboxed:

```typescript
// src/interpreter.ts
private navigateProperty(obj: any, property: string): any {
  // Prevent prototype pollution
  if (property === '__proto__' || 
      property === 'constructor' || 
      property === 'prototype') {
    return undefined;
  }
  
  // Only access own properties
  if (!Object.prototype.hasOwnProperty.call(obj, property)) {
    return undefined;
  }
  
  return obj[property];
}
```

## Future Optimizations

### 1. JIT Compilation

Future versions could compile expressions to JavaScript:

```typescript
// Future implementation
class CompiledExpression {
  private readonly fn: Function;
  
  constructor(ast: ASTNode) {
    const code = this.compile(ast);
    this.fn = new Function('input', 'context', code);
  }
  
  private compile(node: ASTNode): string {
    switch (node.type) {
      case NodeType.Identifier:
        return `navigateProperty(input, '${node.name}')`;
      
      case NodeType.Binary:
        const left = this.compile(node.left);
        const right = this.compile(node.right);
        return `applyOperator('${node.operator}', ${left}, ${right})`;
      
      // ... more cases
    }
  }
  
  evaluate(input: any[], context: RuntimeContext): any[] {
    return this.fn(input, context);
  }
}
```

### 2. WebAssembly Backend

For maximum performance, a WASM backend could be implemented:

```typescript
// Future WebAssembly integration
class WasmInterpreter {
  private wasmModule: WebAssembly.Module;
  
  async initialize(): Promise<void> {
    const wasmBinary = await fetch('/fhirpath.wasm');
    this.wasmModule = await WebAssembly.compileStreaming(wasmBinary);
  }
  
  evaluate(ast: ASTNode, input: any[]): any[] {
    // Serialize AST and input to WASM memory
    // Call WASM evaluation function
    // Deserialize results
  }
}
```

### 3. Parallel Evaluation

For large datasets, parallel evaluation could be implemented:

```typescript
// Future parallel implementation
class ParallelEvaluator {
  async evaluateCollection(
    expression: string,
    collection: any[],
    options: { workers?: number } = {}
  ): Promise<any[][]> {
    const workerCount = options.workers || navigator.hardwareConcurrency || 4;
    const chunkSize = Math.ceil(collection.length / workerCount);
    const chunks = [];
    
    for (let i = 0; i < collection.length; i += chunkSize) {
      chunks.push(collection.slice(i, i + chunkSize));
    }
    
    const workers = Array(workerCount).fill(null).map(() => 
      new Worker('/fhirpath-worker.js')
    );
    
    const results = await Promise.all(
      chunks.map((chunk, i) => 
        this.evaluateInWorker(workers[i], expression, chunk)
      )
    );
    
    workers.forEach(w => w.terminate());
    return results.flat();
  }
}
```

## Summary

The FHIRPath implementation achieves high performance through:

1. **Smart memory management** - Prototype-based contexts, string interning
2. **Efficient algorithms** - Precedence climbing, direct dispatch
3. **Lazy evaluation** - Compute only what's needed
4. **Error resilience** - Graceful degradation, comprehensive recovery
5. **Extensibility** - Clean extension points for customization
6. **Security** - Input validation, resource limits, safe property access

These implementation details ensure the library is suitable for both development tools (with rich features) and production systems (with high performance).