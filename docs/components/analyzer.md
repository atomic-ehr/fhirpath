# Analyzer Component

## Overview

The analyzer performs static type checking and validation of FHIRPath expressions. It validates type compatibility through the registry, checks operation signatures, and integrates with external model providers to validate against specific FHIR profiles or custom data models. The analyzer uses opaque type references to allow flexible implementation of type systems.

## Architecture

### Core Analyzer Class
**Location**: [`/src/analyzer/analyzer.ts`](../../src/analyzer/analyzer.ts)

The `TypeAnalyzer` class provides type analysis and validation:

```typescript
export class TypeAnalyzer implements IAnalyzer {
  private diagnostics: TypeDiagnostic[] = [];
  private currentPosition?: Position;
  
  // Object lookup for node analyzers (mirrors interpreter pattern)
  private readonly nodeAnalyzers: Record<NodeType, NodeAnalyzer> = {
    [NodeType.Literal]: this.analyzeLiteral.bind(this),
    [NodeType.Identifier]: this.analyzeIdentifier.bind(this),
    [NodeType.Binary]: this.analyzeBinary.bind(this),
    [NodeType.Function]: this.analyzeFunction.bind(this),
    // ... other node types
  };
  
  constructor(
    private modelProvider: ModelProvider,
    private mode: AnalysisMode = AnalysisMode.Lenient
  ) {}
  
  analyze(
    ast: ASTNode, 
    inputType?: TypeRef,
    inputIsSingleton: boolean = true
  ): TypeAnalysisResult {
    this.diagnostics = [];
    
    const result = this.analyzeNode(ast, inputType, inputIsSingleton);
    
    return {
      ast,
      diagnostics: this.diagnostics,
      resultType: result.type,
      resultIsSingleton: result.isSingleton
    };
  }
}
```

### Type System
**Location**: [`/src/analyzer/types.ts`](../../src/analyzer/types.ts)

The analyzer uses an opaque type system for flexibility:

```typescript
// Opaque type reference - implementation details hidden from analyzer
export type TypeRef = unknown;

/**
 * Information about a property on a type
 */
export interface PropertyInfo {
  type: TypeRef;
  isSingleton: boolean;
}

/**
 * Type analysis mode
 */
export enum AnalysisMode {
  Strict = 'strict',   // Type mismatches are errors
  Lenient = 'lenient' // Type mismatches are warnings, continue with Any
}

/**
 * Type analysis result
 */
export interface TypeAnalysisResult {
  // Annotated AST with type information
  ast: ASTNode;
  
  // Any errors or warnings encountered
  diagnostics: TypeDiagnostic[];
  
  // Overall result type
  resultType?: TypeRef;
  resultIsSingleton?: boolean;
}

/**
 * Type diagnostic (error or warning)
 */
export interface TypeDiagnostic {
  severity: 'error' | 'warning';
  message: string;
  position?: Position;
}
```

### Model Provider Interface
**Location**: [`/src/analyzer/types.ts`](../../src/analyzer/types.ts)

External type information integration:

```typescript
/**
 * Model provider interface for type resolution and navigation
 */
export interface ModelProvider {
  /**
   * Resolve a type name to an opaque type reference
   */
  resolveType(typeName: string): TypeRef | undefined;
  
  /**
   * Get property type from an opaque type reference
   */
  getPropertyType(type: TypeRef, propertyName: string): PropertyInfo | undefined;
  
  /**
   * Check if one type is assignable to another
   */
  isAssignable(from: TypeRef, to: TypeRef): boolean;
  
  /**
   * Get a human-readable name for a type (for error messages)
   */
  getTypeName(type: TypeRef): string;
  
  /**
   * Check if a type is a collection type
   */
  isCollectionType?(type: TypeRef): boolean;
  
  /**
   * Get common base type for union types
   */
  getCommonType?(types: TypeRef[]): TypeRef | undefined;
}
```

## IAnalyzer Interface Implementation

The TypeAnalyzer implements the `IAnalyzer` interface from the registry, allowing operations to report errors and resolve types:

```typescript
// IAnalyzer interface implementation
error(message: string): void {
  this.addDiagnostic('error', message, this.currentPosition);
}

warning(message: string): void {
  this.addDiagnostic('warning', message, this.currentPosition);
}

resolveType(typeName: string): TypeRef {
  return this.modelProvider.resolveType(typeName) || this.modelProvider.resolveType('Any')!;
}
```

This enables operations to participate in type analysis by calling these methods during their `analyze` implementations.

## Type Analysis Algorithms

### 1. Expression Type Inference
**Location**: [`analyzer.ts:analyzeNode()`](../../src/analyzer/analyzer.ts)

Main type inference using object lookup pattern:

```typescript
private analyzeNode(
  node: ASTNode, 
  inputType: TypeRef | undefined,
  inputIsSingleton: boolean
): AnalysisResult {
  const analyzer = this.nodeAnalyzers[node.type];
  
  if (!analyzer) {
    this.addDiagnostic('error', `Unknown node type: ${node.type}`, node.position);
    return { type: this.modelProvider.resolveType('Any'), isSingleton: false };
  }
  
  const result = analyzer(node, inputType, inputIsSingleton);
  
  // Annotate the node with type information
  node.resultType = result.type;
  node.isSingleton = result.isSingleton;
  
  return result;
}
```

### 2. Binary Operation Type Checking
**Location**: [`analyzer.ts:analyzeBinary()`](../../src/analyzer/analyzer.ts)

Validates operator type compatibility through registry:

```typescript
private analyzeBinary(
  node: BinaryNode,
  inputType: TypeRef | undefined,
  inputIsSingleton: boolean
): AnalysisResult {
  // Special handling for dot operator - it's a pipeline
  if (node.operator === TokenType.DOT) {
    const leftResult = this.analyzeNode(node.left, inputType, inputIsSingleton);
    const rightResult = this.analyzeNode(node.right, leftResult.type, leftResult.isSingleton);
    return rightResult;
  }
  
  // Get operation from registry
  const operation = node.operation || Registry.getByToken(node.operator);
  if (!operation || operation.kind !== 'operator') {
    this.addDiagnostic('error', `Unknown operator: ${node.operator}`, node.position);
    return { type: this.modelProvider.resolveType('Any'), isSingleton: true };
  }
  
  // Analyze operands
  const leftResult = this.analyzeNode(node.left, inputType, inputIsSingleton);
  const rightResult = this.analyzeNode(node.right, inputType, inputIsSingleton);
  
  // Convert to registry TypeInfo format
  const inputInfo: RegistryTypeInfo = { type: inputType || this.resolveType('Any'), isSingleton: inputIsSingleton };
  const leftInfo: RegistryTypeInfo = { type: leftResult.type || this.resolveType('Any'), isSingleton: leftResult.isSingleton };
  const rightInfo: RegistryTypeInfo = { type: rightResult.type || this.resolveType('Any'), isSingleton: rightResult.isSingleton };
  
  // Use operation's analyze method
  this.currentPosition = node.position;
  const result = operation.analyze(this, inputInfo, [leftInfo, rightInfo]);
  
  return {
    type: result.type,
    isSingleton: result.isSingleton
  };
}
```

### 3. Function Call Analysis
**Location**: [`analyzer.ts:analyzeFunction()`](../../src/analyzer/analyzer.ts)

Validates function calls through registry:

```typescript
private analyzeFunction(
  node: FunctionNode,
  inputType: TypeRef | undefined,
  inputIsSingleton: boolean
): AnalysisResult {
  // Extract function name
  let funcName: string;
  if (node.name.type === NodeType.Identifier) {
    funcName = (node.name as IdentifierNode).name;
  } else {
    this.addDiagnostic('error', 'Complex function names not yet supported', node.position);
    return { type: this.modelProvider.resolveType('Any'), isSingleton: false };
  }
  
  // Get function from registry
  const operation = Registry.get(funcName);
  if (!operation || operation.kind !== 'function') {
    this.addDiagnostic('error', `Unknown function: ${funcName}`, node.position);
    return { type: this.modelProvider.resolveType('Any'), isSingleton: false };
  }
  
  // Analyze arguments
  const argResults = node.arguments.map(arg => this.analyzeNode(arg, inputType, inputIsSingleton));
  
  // Convert to registry TypeInfo format
  const inputInfo: RegistryTypeInfo = { type: inputType || this.resolveType('Any'), isSingleton: inputIsSingleton };
  const argInfos: RegistryTypeInfo[] = argResults.map(r => ({
    type: r.type || this.resolveType('Any'),
    isSingleton: r.isSingleton
  }));
  
  // Use operation's analyze method
  this.currentPosition = node.position;
  const result = operation.analyze(this, inputInfo, argInfos);
  
  return {
    type: result.type,
    isSingleton: result.isSingleton
  };
}
```

### 4. Identifier Analysis
**Location**: [`analyzer.ts:analyzeIdentifier()`](../../src/analyzer/analyzer.ts)

Property navigation and type resolution:

```typescript
private analyzeIdentifier(
  node: IdentifierNode, 
  inputType: TypeRef | undefined,
  inputIsSingleton: boolean
): AnalysisResult {
  if (!inputType) {
    // No input type - might be a type name or error
    const typeRef = this.modelProvider.resolveType(node.name);
    if (typeRef) {
      return { type: typeRef, isSingleton: true };
    }
    
    this.addDiagnostic('error', `Cannot navigate property '${node.name}' on empty input`, node.position);
    return { type: this.modelProvider.resolveType('Any'), isSingleton: false };
  }
  
  // Property navigation
  const propInfo = this.modelProvider.getPropertyType(inputType, node.name);
  
  if (!propInfo) {
    this.addDiagnostic(
      this.mode === AnalysisMode.Strict ? 'error' : 'warning',
      `Property '${node.name}' not found on type '${this.modelProvider.getTypeName(inputType)}'`,
      node.position
    );
    return { type: this.modelProvider.resolveType('Any'), isSingleton: false };
  }
  
  // If input is collection, result is always collection (flattening)
  return {
    type: propInfo.type,
    isSingleton: inputIsSingleton && propInfo.isSingleton
  };
}
```

## Type Compatibility

Type compatibility is handled by the ModelProvider interface through the `isAssignable` method. The analyzer delegates all type compatibility checks to the model provider, allowing for flexible implementation of type systems.

## Usage Example

```typescript
import { TypeAnalyzer, analyzeFHIRPath } from './analyzer/analyzer';
import { parse } from './parser';
import type { ModelProvider } from './analyzer/types';

// Create a model provider implementation
const modelProvider: ModelProvider = {
  resolveType(typeName: string) {
    // Return opaque type reference
    return { _type: typeName };
  },
  
  getPropertyType(type: any, propertyName: string) {
    // Example: Patient.name returns HumanName[]
    if (type._type === 'Patient' && propertyName === 'name') {
      return {
        type: { _type: 'HumanName' },
        isSingleton: false
      };
    }
    return undefined;
  },
  
  isAssignable(from: any, to: any) {
    // Simple type compatibility
    return from._type === to._type || to._type === 'Any';
  },
  
  getTypeName(type: any) {
    return type._type || 'Unknown';
  }
};

// Analyze expression using helper function
const result = analyzeFHIRPath(
  "Patient.name.where(use = 'official').given",
  modelProvider,
  { _type: 'Patient' }  // Input type
);

if (result.diagnostics.length > 0) {
  console.error('Type diagnostics:', result.diagnostics);
} else {
  console.log('Result type:', modelProvider.getTypeName(result.resultType));
  console.log('Is singleton:', result.resultIsSingleton);
}
```

## Integration Points

### With Registry
The analyzer integrates tightly with the registry:
- Each operation implements its own `analyze` method
- The analyzer implements the `IAnalyzer` interface for operations to use
- Operations handle their own type checking and validation

### With Model Provider
The model provider supplies all type information:
- Type resolution from names to opaque references
- Property type information for navigation
- Type compatibility checking
- Human-readable type names for error messages

### With Interpreter/Compiler
The analyzer annotates AST nodes with:
- `resultType` - the computed type of the expression
- `isSingleton` - whether the result is a single value or collection
- Type information for optimization and runtime validation