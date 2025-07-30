# ADR-003: Type-Enriched AST

## Status

Proposed

## Context

Currently, our analyzer performs validation on the AST but returns only diagnostics (errors/warnings). The AST itself remains unchanged after analysis, missing valuable semantic information that could be used for:

1. **Better IDE support**: Hover information, type hints, auto-completion
2. **Advanced analysis**: Type checking, dead code detection, optimization hints
3. **Runtime optimization**: The interpreter could use type information to optimize execution
4. **Better error messages**: More specific error messages based on expected vs actual types
5. **Documentation generation**: Automatic type documentation from analyzed code

Modern language tools (TypeScript, Rust Analyzer, etc.) enrich their ASTs with semantic information during analysis. This pattern separates syntax (parsing) from semantics (type checking/inference) while providing a unified data structure for downstream tools.

In FHIRPath, we have:
- A well-defined type system (String, Integer, Boolean, etc.)
- Type signatures for all operators and functions
- Implicit type conversions
- Collection vs singleton semantics

However, this type information is only used during evaluation, not exposed in the AST.

## Decision

Enhance the analyzer to optionally return an enriched AST where nodes are augmented with:

### 1. Type Annotations
```typescript
interface TypeInfo {
  // The FHIRPath type of the expression
  type: FHIRPathType | FHIRPathType[];  // Can be union type
  
  // Whether this expression returns a collection or single value
  cardinality: 'singleton' | 'collection';
  
  // For complex types, the underlying model type (e.g., 'FHIR.Patient')
  modelType?: string;
  
  // Confidence level of type inference
  confidence: 'certain' | 'inferred' | 'unknown';
}
```

### 2. Enhanced Node Structure
```typescript
// Extend existing AST nodes with optional semantic information
interface SemanticInfo {
  // Type information for this expression
  typeInfo?: TypeInfo;
  
  // Variable scope at this point
  scope?: Map<string, TypeInfo>;
  
  // For function calls, the matched signature
  matchedSignature?: FunctionSignature | OperatorSignature;
  
  // For identifiers, their declaration/binding
  binding?: {
    kind: 'variable' | 'parameter' | 'builtin';
    declaration?: ASTNode;
    typeInfo: TypeInfo;
  };
  
  // Implicit conversions applied
  conversions?: Array<{
    from: FHIRPathType;
    to: FHIRPathType;
    implicit: boolean;
  }>;
  
  // Usage information
  usage?: {
    reads: ASTNode[];
    writes: ASTNode[];
  };
}

// Nodes can optionally include semantic information
interface EnrichedASTNode extends ASTNode {
  semantic?: SemanticInfo;
}
```

### 3. Enhanced Analysis Result
```typescript
interface EnrichedAnalysisResult extends AnalysisResult {
  // The original AST is now enriched
  ast: EnrichedASTNode;
  
  // Additional analysis results
  typeEnvironment?: {
    // Global type information
    variables: Map<string, TypeInfo>;
    functions: Map<string, FunctionDefinition>;
    modelTypes: Set<string>;
  };
  
  // Metrics about the expression
  metrics?: {
    complexity: number;
    maxDepth: number;
    nodeCount: number;
  };
}
```

### 4. Model Provider Interface

To resolve types from the underlying data model (e.g., FHIR resources), the analyzer will support a model provider:

```typescript
// Interface for providing model type information
interface ModelTypeProvider {
  // Get type information for a model type (e.g., "Patient", "Observation")
  getModelType(typeName: string): ModelTypeInfo | undefined;
  
  // Get type of a property path (e.g., "Patient.name" returns "HumanName[]")
  getPropertyType(modelType: string, propertyPath: string): TypeInfo | undefined;
  
  // Check if a type exists in the model
  hasType(typeName: string): boolean;
  
  // Get all available types (for autocomplete)
  getAllTypes(): string[];
  
  // Check if a property exists on a type
  hasProperty(modelType: string, propertyName: string): boolean;
  
  // Get all properties of a type (for autocomplete)
  getProperties(modelType: string): PropertyInfo[];
}

interface ModelTypeInfo {
  name: string;
  baseType?: string;  // For inheritance
  abstract?: boolean;
  properties: Map<string, PropertyInfo>;
}

interface PropertyInfo {
  name: string;
  type: TypeInfo;
  required: boolean;
  documentation?: string;
}
```

### 5. Analyzer Options

```typescript
interface AnalyzerOptions {
  // Existing options
  variables?: Record<string, any>;
  
  // New options
  enrichAST?: boolean;           // Default: false for backward compatibility
  inferTypes?: boolean;          // Enable type inference
  trackUsage?: boolean;          // Track variable usage
  includeMetrics?: boolean;      // Calculate complexity metrics
  
  // Model provider for type resolution
  modelProvider?: ModelTypeProvider;
}
```

### 6. Type Inference Rules

The analyzer will infer types using:

1. **Literal types**: Numbers, strings, booleans have obvious types
2. **Operator signatures**: `+` with two Integers returns Integer
3. **Function signatures**: Function return types from registry
4. **Type assertions**: `as` and `is` operators provide type hints
5. **Variable types**: From context or previous assignments
6. **Collection operations**: Track cardinality through operations
7. **Model navigation**: When a model provider is available:
   - Resolve property types through the model (e.g., `Patient.name` → `HumanName[]`)
   - Validate property access on model types
   - Infer types through property chains
   - Support polymorphic navigation with type filtering

### 7. Model Provider Integration

When a model provider is supplied, the analyzer enhances its capabilities:

```typescript
// Example: Analyzing with model provider
const modelProvider = new FHIRModelProvider();

const result = analyze('Patient.name.given.first()', {
  enrichAST: true,
  inferTypes: true,
  modelProvider: modelProvider
});

// The analyzer can now:
// 1. Validate that 'Patient' is a known type
// 2. Know that Patient.name returns HumanName[] (collection)
// 3. Know that HumanName.given returns String[] (collection)
// 4. Know that first() on String[] returns String (singleton)
// 5. Produce better error messages: "Property 'foo' does not exist on type 'Patient'"
```

Benefits of model provider integration:
- **Type-aware navigation**: Validate property paths against the model
- **Better diagnostics**: Model-specific error messages
- **Autocomplete support**: Suggest valid properties based on type
- **Polymorphic handling**: Understand type hierarchies and inheritance
- **Cross-reference validation**: Ensure type casts and membership tests are valid

## Consequences

### Positive

- **Rich IDE features**: Hover, completion, and navigation become possible
- **Better error messages**: Can show expected vs actual types
- **Optimization opportunities**: Interpreter can use type info
- **Static analysis**: Detect type errors before runtime
- **Documentation**: Auto-generate type documentation
- **Debugging**: Better understanding of expression types
- **Language server**: Foundation for FHIRPath LSP implementation

### Negative

- **Memory overhead**: Storing type info increases AST size
- **Analysis complexity**: Type inference adds computational cost
- **API complexity**: More options and return types
- **Backward compatibility**: Need to maintain non-enriched mode
- **Maintenance**: Type inference rules need updates with language changes

## Alternatives Considered

### 1. Separate Type Analysis Pass
Return type information as a separate data structure, not modifying the AST.
- **Pros**: Clean separation, original AST unchanged
- **Cons**: Harder to correlate type info with nodes, duplicate traversal

### 2. Always Enrich AST
Make type enrichment mandatory in the analyzer.
- **Pros**: Simpler API, consistent behavior
- **Cons**: Breaking change, performance impact for simple use cases

### 3. Type-Only Analyzer
Create a separate TypeAnalyzer class.
- **Pros**: Single responsibility, opt-in
- **Cons**: Code duplication, multiple analysis passes needed

### 4. Runtime Type Tracking
Only track types during interpretation.
- **Pros**: No static analysis needed
- **Cons**: No IDE support, errors only at runtime

## Implementation Notes

### Phase 1: Basic Type Annotation
- Add TypeInfo interface
- Implement type inference for literals
- Add semantic field to nodes

### Phase 2: Type Inference
- Implement operator type signatures
- Function return type inference
- Collection cardinality tracking

### Phase 3: Model Provider Integration
- Define ModelTypeProvider interface
- Implement property type resolution
- Add model-aware validation
- Support polymorphic navigation

### Phase 4: Advanced Features
- Variable scope tracking
- Usage analysis
- Implicit conversion tracking

### Phase 5: IDE Integration
- Hover information extraction
- Completion context from types
- Type-based navigation
- Model-aware autocomplete

### Example Usage

```typescript
const result = analyze('Patient.name.given + " " + Patient.name.family', {
  enrichAST: true,
  inferTypes: true
});

// Access type information
const ast = result.ast as EnrichedASTNode;
console.log(ast.semantic?.typeInfo);
// { type: 'String', cardinality: 'collection', confidence: 'inferred' }

// Function call has matched signature
const funcCall = findNode(ast, node => node.type === NodeType.Function);
console.log(funcCall.semantic?.matchedSignature);
// { name: '+', left: String, right: String, result: String }
```

### Example Model Provider Implementation

```typescript
class FHIRModelProvider implements ModelTypeProvider {
  private typeRegistry: Map<string, ModelTypeInfo>;
  
  constructor() {
    this.typeRegistry = new Map();
    this.loadFHIRTypes();
  }
  
  getPropertyType(modelType: string, propertyPath: string): TypeInfo | undefined {
    const type = this.typeRegistry.get(modelType);
    if (!type) return undefined;
    
    // Handle nested paths like "name.given"
    const parts = propertyPath.split('.');
    let currentType = type;
    
    for (const part of parts) {
      const prop = currentType.properties.get(part);
      if (!prop) return undefined;
      
      if (prop.type.modelType && parts.length > 1) {
        currentType = this.typeRegistry.get(prop.type.modelType);
        if (!currentType) return undefined;
      } else {
        return prop.type;
      }
    }
    
    return undefined;
  }
  
  private loadFHIRTypes() {
    // Example: Patient type
    this.typeRegistry.set('Patient', {
      name: 'Patient',
      baseType: 'DomainResource',
      properties: new Map([
        ['name', { 
          name: 'name', 
          type: { 
            type: 'Any', 
            modelType: 'HumanName', 
            cardinality: 'collection' 
          }, 
          required: false 
        }]
      ])
    });
  }
}
```

## References

- TypeScript Compiler API and Type Checker
- Language Server Protocol Specification
- FHIRPath Specification Section 5 (Types)
- Rust Analyzer's HIR (High-level Intermediate Representation)