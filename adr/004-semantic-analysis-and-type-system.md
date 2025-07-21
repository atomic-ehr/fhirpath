# ADR-004: Pure Type Analysis System

## Status

Proposed

## Context

The current FHIRPath implementation has a parser that produces an untyped Abstract Syntax Tree (AST). We need a type analysis system that can:

1. **Analyze Types**: Determine the types of expressions without modifying the existing interpreter.

2. **Provide Type Information**: Make type information available for tooling, validation, and documentation without runtime overhead.

3. **Model Awareness**: Support multiple type models (System types, FHIR resources, custom models) in a pluggable way.

4. **Static Analysis**: Enable compile-time type checking and validation as a separate concern from execution.

5. **Development Tools**: Provide foundation for IDE features like autocomplete, hover information, and type-based refactoring.

6. **Validation**: Support validating FHIRPath expressions against schemas without executing them.

## Decision

We will implement a pure type analysis system that operates on the AST without modifying the interpreter. This system will be completely separate from the runtime execution path:

### 1. Type Information Infrastructure

Create a type system that mirrors the FHIRPath specification:

```typescript
// Type information classes as per spec
interface TypeInfo {
  abstract accept<T>(visitor: TypeInfoVisitor<T>): T;
}

class SimpleTypeInfo implements TypeInfo {
  constructor(
    public namespace: string,
    public name: string,
    public baseType?: TypeSpecifier
  ) {}
}

class ClassInfo implements TypeInfo {
  constructor(
    public namespace: string,
    public name: string,
    public baseType?: TypeSpecifier,
    public elements: ClassInfoElement[] = []
  ) {}
}

class ListTypeInfo implements TypeInfo {
  constructor(public elementType: TypeSpecifier) {}
}

class TupleTypeInfo implements TypeInfo {
  constructor(public elements: TupleTypeInfoElement[]) {}
}
```

### 2. Model Registry

Implement a registry for type models:

```typescript
interface ModelDefinition {
  namespace: string;
  types: Map<string, TypeInfo>;
}

class ModelRegistry {
  private models = new Map<string, ModelDefinition>();
  
  register(model: ModelDefinition): void;
  resolveType(typeName: string, currentNamespace?: string): TypeInfo | undefined;
  getTypeInfo(value: any): TypeInfo;
}
```

### 3. Type Analysis Result

Create a separate type analysis result that doesn't modify the AST:

```typescript
interface TypeAnalysisResult {
  // Map from AST node to its type information
  nodeTypes: Map<ASTNode, TypeInfo>;
  
  // Map from AST node to cardinality info
  nodeCardinality: Map<ASTNode, { min: number; max: number | '*' }>;
  
  // Collected errors and warnings
  diagnostics: TypeDiagnostic[];
  
  // Symbol table for resolved identifiers
  symbols: Map<string, SymbolInfo>;
}

interface TypeDiagnostic {
  severity: 'error' | 'warning' | 'info';
  message: string;
  node: ASTNode;
  position: Position;
}
```

### 4. Type Analyzer

Create a visitor-based type analyzer that produces analysis results:

```typescript
class TypeAnalyzer {
  constructor(
    private modelRegistry: ModelRegistry,
    private options: { strict: boolean } = { strict: false }
  ) {}
  
  analyze(ast: ASTNode, contextType?: TypeInfo): TypeAnalysisResult {
    // Walk AST and collect type information
    // Resolve identifiers to types or properties
    // Perform type checking based on strictness
    // Return analysis result without modifying AST
  }
}
```

### 5. Analysis API

Provide a clean API for using type analysis:

```typescript
class FHIRPathTypeChecker {
  constructor(private modelRegistry: ModelRegistry) {}
  
  // Check expression validity without execution
  validate(expression: string, contextType?: string): ValidationResult {
    const ast = parse(expression);
    const analysis = this.analyzer.analyze(ast, this.resolveType(contextType));
    return {
      valid: analysis.diagnostics.filter(d => d.severity === 'error').length === 0,
      diagnostics: analysis.diagnostics
    };
  }
  
  // Get type of expression result
  getExpressionType(expression: string, contextType?: string): TypeInfo | undefined {
    const ast = parse(expression);
    const analysis = this.analyzer.analyze(ast, this.resolveType(contextType));
    return analysis.nodeTypes.get(ast);
  }
  
  // Get available properties/methods at a position (for IDE)
  getCompletions(expression: string, position: number, contextType?: string): CompletionItem[] {
    // Analyze partial expression and return possible completions
  }
}

### Implementation Phases

**Phase 1: Core Infrastructure (Week 1)**
- Type information classes
- Model registry
- System model with primitive types

**Phase 2: Type Analysis Engine (Week 2)**
- Type analyzer visitor implementation
- Type inference for expressions
- Cardinality tracking

**Phase 3: Type Checking (Week 3)**
- Operator type checking
- Function signature validation
- Diagnostic reporting

**Phase 4: Analysis API (Week 4)**
- Validation API
- Type query API
- IDE support APIs

**Phase 5: Advanced Features (Week 5)**
- Strict type checking mode
- FHIR model loader
- Custom model support
- Completion provider

## Consequences

### Positive

- **No Runtime Impact**: Type analysis is completely separate from interpreter, no performance overhead
- **Better Development Tools**: Enables IDE features without modifying core runtime
- **Validation Without Execution**: Can validate expressions without running them
- **Clean Separation**: Type checking is an optional layer, not required for execution
- **Extensibility**: Easy to add new models without touching interpreter
- **Reusable Analysis**: Type information can be cached and reused

### Negative

- **Duplicate Logic**: Some type-related logic may be duplicated between analyzer and interpreter
- **Synchronization**: Need to keep type analyzer in sync with interpreter behavior
- **Limited Runtime Benefits**: Can't use type information for runtime optimizations
- **Additional API Surface**: More code to maintain alongside the interpreter

### Neutral

- **Separate Tool**: Type analysis becomes a separate tool/library concern
- **Optional Dependency**: Projects can choose whether to include type analysis
- **Model Loading**: Need to decide how to load/define FHIR models (JSON schema, TypeScript, etc.)

## Alternatives Considered

### 1. Modify Interpreter for Type Awareness
Update the existing interpreter to include type checking.

**Pros:**
- Single source of truth for behavior
- Can optimize based on types
- No duplication of logic

**Cons:**
- Breaks separation of concerns
- Adds runtime overhead for all users
- Makes interpreter more complex
- Can't validate without execution

### 2. Type-Annotated AST
Modify AST nodes to include type information.

**Pros:**
- Type information travels with nodes
- Natural place for type data

**Cons:**
- Requires modifying existing AST structure
- Increases memory usage for all users
- Couples parsing with type analysis

### 3. Language Server Protocol Implementation
Build type analysis as part of a full LSP implementation.

**Pros:**
- Standard protocol for IDE integration
- Could provide other IDE features

**Cons:**
- Much larger scope
- Overkill if only type checking needed
- Requires LSP runtime infrastructure

## Decision Rationale

The pure type analysis approach is chosen because:

1. **Separation of Concerns**: Keeps type analysis completely separate from execution
2. **No Runtime Impact**: Users who don't need type checking pay no performance cost
3. **Tool Friendly**: Easy to build development tools on top of the analysis API
4. **Incremental Adoption**: Can be added to existing projects without breaking changes
5. **Flexibility**: Different tools can use type information differently
6. **Maintainability**: Easier to evolve type system independently of interpreter

This approach treats type analysis as a development-time concern rather than a runtime concern, which aligns with the optional nature of type checking in FHIRPath and provides maximum flexibility for different use cases.