# ADR-015: Context-Flow Analysis Architecture

## Status

Proposed

## Context

The FHIRPath analyzer needs to track user-defined variables (created via `defineVariable()`) to detect undefined variable usage at analysis time. The current implementation has a critical issue with the union operator (`|`): variables defined in one branch of a union are incorrectly accessible in the other branch during analysis.

### Current Problems

1. **Scope Isolation**: Variables defined in union branches leak across branches
2. **Special Casing**: Dot operator has special logic for `defineVariable` detection
3. **Pattern Matching**: Analyzer must detect functions by name and AST structure
4. **Timing Issues**: Variables are added during traversal, causing scope conflicts
5. **Extensibility**: Hard to add analysis logic for new functions

### Root Cause

The analyzer uses a visitor pattern with shared mutable state. Variables are added to a single shared set during traversal, making it difficult to isolate scopes properly. The dot operator has special-case logic to detect and handle `defineVariable`, which breaks abstraction boundaries.

## Decision

Transform the analyzer to use a **context-flow architecture** that mirrors the interpreter's evaluation flow. Instead of mutating shared state during traversal, we pass an immutable context through the analysis tree, with each node potentially transforming the context for its children.

### Core Concept

```typescript
// Runtime evaluation flow
evaluate(node: ASTNode, context: EvaluationContext): any[]

// Analysis flow (parallel structure)
analyze(node: ASTNode, context: AnalysisContext): AnalysisResult
```

### Analysis Context

```typescript
interface AnalysisContext {
  // Variable tracking
  variables: Map<string, TypeInfo>;
  systemVariables: Map<string, TypeInfo>;  // $this, $index, etc.
  
  // Type flow
  inputType: TypeInfo;                     // Type flowing into expression
  
  // Context manipulation (immutable operations)
  withVariable(name: string, type: TypeInfo): AnalysisContext;
  withInputType(type: TypeInfo): AnalysisContext;
  withScope<T>(fn: (ctx: AnalysisContext) => T): T;
  
  // Branching for unions
  fork(): AnalysisContext;
}

interface AnalysisResult {
  type: TypeInfo;                          // Output type
  diagnostics: Diagnostic[];               // Errors/warnings found
  context?: AnalysisContext;                // Modified context (for defineVariable)
}
```

### Function Analysis Interface

```typescript
interface AnalyzableFunction extends FunctionDefinition {
  // Runtime evaluation
  evaluate: (inputs: any[], context: Context, args: any[]) => any[];
  
  // Analysis-time behavior
  analyze?: (context: AnalysisContext, args: ASTNode[]) => AnalysisResult;
}
```

## Implementation

### Core Analyzer Flow

```typescript
class Analyzer {
  analyze(ast: ASTNode, initialContext?: AnalysisContext): AnalysisResult {
    const context = initialContext || this.createInitialContext();
    return this.analyzeNode(ast, context);
  }
  
  private analyzeNode(node: ASTNode, context: AnalysisContext): AnalysisResult {
    switch (node.type) {
      case NodeType.Binary:
        return this.analyzeBinary(node as BinaryNode, context);
      case NodeType.Function:
        return this.analyzeFunction(node as FunctionNode, context);
      case NodeType.Variable:
        return this.analyzeVariable(node as VariableNode, context);
      // ... other node types
    }
  }
}
```

### Union Operator with Natural Isolation

```typescript
private analyzeBinary(node: BinaryNode, context: AnalysisContext): AnalysisResult {
  if (node.operator === '|') {
    // Each branch gets its own context fork
    const leftResult = this.analyzeNode(node.left, context.fork());
    const rightResult = this.analyzeNode(node.right, context.fork());
    
    // Combine results, but don't merge variable scopes!
    return {
      type: combineTypes(leftResult.type, rightResult.type),
      diagnostics: [...leftResult.diagnostics, ...rightResult.diagnostics],
      context: context  // Original context unchanged
    };
  }
  
  if (node.operator === '.') {
    // Context flows naturally through dot chains
    const leftResult = this.analyzeNode(node.left, context);
    
    // Right side gets left's output type as input
    const rightContext = leftResult.context || context;
    const rightContextWithInput = rightContext.withInputType(leftResult.type);
    const rightResult = this.analyzeNode(node.right, rightContextWithInput);
    
    return {
      type: rightResult.type,
      diagnostics: [...leftResult.diagnostics, ...rightResult.diagnostics],
      context: rightResult.context  // Propagate context changes
    };
  }
  
  // Other binary operators...
}
```

### defineVariable with Context Flow

```typescript
export const defineVariableFunc: AnalyzableFunction = {
  evaluate: (inputs, context, args) => {
    // Runtime implementation
    const name = args[0];
    const value = args[1] ?? inputs;
    context.setVariable(name, value);
    return inputs;
  },
  
  analyze: (context: AnalysisContext, args: ASTNode[]): AnalysisResult => {
    const diagnostics: Diagnostic[] = [];
    
    // Extract variable name
    if (args[0]?.type !== 'Literal' || args[0].valueType !== 'string') {
      diagnostics.push(createError('Variable name must be a string literal'));
      return { type: context.inputType, diagnostics };
    }
    
    const varName = args[0].value as string;
    
    // Analyze value expression if provided
    let varType: TypeInfo;
    if (args[1]) {
      const valueResult = context.analyzeNode(args[1], context);
      varType = valueResult.type;
      diagnostics.push(...valueResult.diagnostics);
    } else {
      varType = context.inputType;
    }
    
    // Return new context with variable added
    return {
      type: context.inputType,  // defineVariable returns input unchanged
      diagnostics,
      context: context.withVariable(varName, varType)  // Modified context!
    };
  }
};
```

### where/select with Scoped Variables

```typescript
export const whereFunc: AnalyzableFunction = {
  analyze: (context: AnalysisContext, args: ASTNode[]): AnalysisResult => {
    const inputType = context.inputType;
    const elementType = getElementType(inputType);
    
    // Analyze condition with $this in scope
    const result = context.withScope(ctx => {
      const scopedCtx = ctx
        .withSystemVariable('$this', elementType)
        .withSystemVariable('$index', { type: 'Integer', singleton: true });
      
      return ctx.analyzeNode(args[0], scopedCtx);
    });
    
    return {
      type: inputType,  // where returns same type (filtered)
      diagnostics: result.diagnostics,
      context: context  // Original context (no variable leakage)
    };
  }
};
```

## Example: How Union Scope Isolation Works

```fhirpath
defineVariable('n1', 'v1').active | defineVariable('n2', 'v2').select(%n1)
```

```typescript
// Analyzing union node
analyzeBinary(unionNode, context) {
  // Left branch: defineVariable('n1', 'v1').active
  const leftContext = context.fork();
  // → defineVariable returns context with 'n1' added
  // → .active uses that context
  // → Result: { type: Boolean, context: contextWithN1 }
  
  // Right branch: defineVariable('n2', 'v2').select(%n1)
  const rightContext = context.fork();  // Fresh fork, no 'n1'!
  // → defineVariable returns context with 'n2' added
  // → select(%n1) tries to find 'n1' in context
  // → ERROR: Variable '%n1' not defined!
  
  // Return combined result
  // Original context unchanged - neither n1 nor n2 leak out
}
```

## Consequences

### Positive

- **Natural Scope Isolation**: Union branches automatically get isolated contexts
- **No Special Cases**: No dot operator special logic for defineVariable
- **Parallel to Runtime**: Analysis mirrors evaluation architecture
- **Extensible**: Functions implement their own analysis logic
- **Immutable Contexts**: No shared mutable state issues
- **Type Flow**: Types naturally flow through expressions
- **Composable**: Each node is a pure transformation

### Negative

- **Major Refactoring**: Requires rewriting most of the analyzer
- **Performance**: Context copying might impact performance (mitigatable with persistent data structures)
- **Learning Curve**: Developers need to understand context-flow pattern
- **More Complex Types**: Need AnalysisResult type with context propagation

## Migration Strategy

### Phase 1: Add Infrastructure
1. Create AnalysisContext interface and implementation
2. Add analyze method to FunctionDefinition interface
3. Create AnalysisResult type

### Phase 2: Incremental Migration
1. Start with analyzeNode wrapper that converts between old and new style
2. Migrate operators one by one (union first, then dot, etc.)
3. Add analyze methods to critical functions (defineVariable, where, select)

### Phase 3: Complete Migration
1. Remove old visitor-based code
2. Remove collectDefinedVariables and special casing
3. Add analyze methods to remaining functions

### Phase 4: Optimization
1. Implement persistent data structures for context
2. Add caching for repeated analysis
3. Performance profiling and optimization

## Alternatives Considered

### Option 1: Patch Current System (Rejected)
Add union branch context flags to existing visitor pattern.
- **Rejected because**: Adds more complexity to already complex mutable state management

### Option 2: Two-Pass Analysis (Rejected)
First pass collects variables, second pass validates.
- **Rejected because**: Doesn't solve fundamental architecture issues, requires two traversals

### Option 3: Scope Manager Enhancement (Rejected)
Use existing ScopeManager more extensively.
- **Rejected because**: Still based on mutable state during traversal

## Testing Strategy

1. **Regression Tests**: Ensure all existing tests pass
2. **Union Scope Tests**: 
   - `defineVariable9`
   - `dvUsageOutsideScopeThrows`
3. **New Test Cases**:
   - Nested unions with variables
   - Complex defineVariable chains
   - Variables in where/select scopes

## References

- FHIRPath Specification: Section 6.6 (defineVariable)
- Similar architecture in: Compiler design (SSA form), Functional interpreters
- Related patterns: Continuation-passing style, Reader monad

## Decision

Proceed with the context-flow architecture. While it requires significant refactoring, it provides a cleaner, more maintainable solution that naturally handles scope isolation and is extensible for future analysis needs.