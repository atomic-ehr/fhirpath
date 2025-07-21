# FHIRPath Type Analyzer

The FHIRPath Type Analyzer performs static type analysis on FHIRPath expressions without executing them. It operates as "evaluation without data", mirroring the interpreter's behavior while tracking type information instead of values.

## Overview

The type analyzer:
- Analyzes FHIRPath expressions to determine result types
- Tracks whether expressions return single values (singleton) or collections
- Validates type compatibility for operators and functions
- Provides diagnostics for type errors
- Operates independently from the interpreter (pure analysis)

## Architecture

### Core Components

#### 1. Type System (`src/analyzer/types.ts`)

The type system uses opaque type references to allow flexible implementation:

```typescript
type TypeRef = unknown;  // Opaque type reference

interface PropertyInfo {
  type: TypeRef;
  isSingleton: boolean;
}

interface ModelProvider {
  resolveType(typeName: string): TypeRef | undefined;
  getPropertyType(type: TypeRef, propertyName: string): PropertyInfo | undefined;
  isAssignable(from: TypeRef, to: TypeRef): boolean;
  getTypeName(type: TypeRef): string;
}
```

#### 2. Model Provider (`src/analyzer/model-provider.ts`)

The model provider uses FHIR schemas to resolve types:
- Uses a SchemaRegistry interface for dynamic schema resolution
- Supports schema inheritance through base type chains
- Handles inline anonymous types without artificial names
- Normalizes type names (e.g., "String" → "string")

Example schema definition:
```yaml
Patient:
  base: DomainResource
  elements:
    name: {array: true, type: HumanName}
    birthDate: {type: date}
    contact:
      type: BackboneElement
      array: true
      elements:
        name: {type: HumanName}
        telecom: {array: true, type: ContactPoint}
```

The provider builds schema lists for inheritance:
- `Patient` → `[Patient, DomainResource, Resource]`
- Properties are resolved by searching through the list
- First matching property definition wins

#### 3. Function Signatures (`src/analyzer/function-signatures.ts`)

Function signatures define type behavior for built-in functions:

```typescript
interface FunctionTypeSignature {
  requiresSingleton: boolean;
  parameters?: ParameterTypeInfo[];
  returnType: (inputType, paramTypes, provider) => TypeRef;
  returnsSingleton: (inputIsSingleton, paramAreSingleton) => boolean;
}
```

Examples:
- `count()` - Always returns Integer singleton
- `first()` - Returns input type as singleton
- `select(expr)` - Returns type of expression, always collection
- `where(expr)` - Returns input type, maintains collection

#### 4. Type Analyzer (`src/analyzer/analyzer.ts`)

The analyzer follows the visitor pattern with object lookup:

```typescript
class TypeAnalyzer {
  private readonly nodeAnalyzers: Record<NodeType, NodeAnalyzer> = {
    [NodeType.Literal]: this.analyzeLiteral.bind(this),
    [NodeType.Identifier]: this.analyzeIdentifier.bind(this),
    [NodeType.Binary]: this.analyzeBinary.bind(this),
    [NodeType.Function]: this.analyzeFunction.bind(this),
    // ... other node types
  };
}
```

## Type Analysis Process

### 1. Literal Analysis
```typescript
'hello'     -> String (singleton)
42          -> Integer (singleton)
3.14        -> Decimal (singleton)
true        -> Boolean (singleton)
{}          -> undefined (empty collection)
```

### 2. Property Navigation
```typescript
// Given Patient type as input
name        -> HumanName (collection)
birthDate   -> Date (singleton)
name.given  -> String (collection) // flattened

// Anonymous types
contact.name -> HumanName (collection) // contact is collection
```

### 3. Function Analysis
```typescript
// Input: Patient.name (HumanName collection)
name.count()              -> Integer (singleton)
name.first()              -> HumanName (singleton)
name.where(use = 'official') -> HumanName (collection)
name.select(given)        -> String (collection)
```

### 4. Operator Analysis
```typescript
// Arithmetic with type promotion
1 + 2        -> Integer
1 + 2.5      -> Decimal

// Comparison
age > 18     -> Boolean

// Navigation (dot operator)
Patient.name -> HumanName (collection)
```

## Cardinality Tracking

The analyzer tracks whether expressions return singletons or collections:

```typescript
// Singleton operations
Patient.birthDate           -> singleton
Patient.name.first()        -> singleton
Patient.name.count()        -> singleton

// Collection operations
Patient.name                -> collection
Patient.name.where(...)     -> collection
Patient.name.select(...)    -> collection

// Cardinality propagation
Patient.name.given          -> collection (flattened)
Patient.name.given.first()  -> singleton
```

## Error Handling

The analyzer supports two modes:

### Strict Mode
Type mismatches are errors:
```typescript
'hello' + 42  -> Error: Operator + cannot be applied to String and Integer
```

### Lenient Mode
Type mismatches are warnings, analysis continues with Any type:
```typescript
unknownProperty.foo  -> Warning: Property 'unknownProperty' not found
                     -> Result: Any type
```

## Usage Example

```typescript
import { analyzeFHIRPath } from './src/analyzer/analyzer';
import { ModelProvider } from './src/analyzer/model-provider';
import { StaticSchemaRegistry } from './src/analyzer/schemas';
import { AnalysisMode } from './src/analyzer/types';

// In production, schemas would come from the fhirschema library
// For this example, assume we have schemas loaded
const schemas = loadFHIRSchemas(); // From fhirschema library

// Create schema registry with FHIR schemas
const registry = new StaticSchemaRegistry(schemas);
const modelProvider = new ModelProvider(registry);

const patientType = modelProvider.resolveType('Patient');

const result = analyzeFHIRPath(
  "name.where(use = 'official').given.first()",
  modelProvider,
  patientType,
  AnalysisMode.Strict
);

console.log(result.resultType);        // String type reference
console.log(result.resultIsSingleton); // true
console.log(result.diagnostics);       // []

// The AST is annotated with type information
console.log(result.ast.resultType);    // String
console.log(result.ast.isSingleton);   // true
```

## Implementation Details

### AST Extension

The AST nodes are extended with optional type fields:

```typescript
interface ASTNode {
  type: NodeType;
  position: Position;
  resultType?: unknown;   // Opaque type reference
  isSingleton?: boolean;  // Cardinality information
}
```

### Type Analysis Algorithm

1. **Visit each node** following the same pattern as the interpreter
2. **Determine type** based on node type and input:
   - Literals: Type from value
   - Identifiers: Property lookup via model provider
   - Functions: Use function signature
   - Operators: Check type compatibility
3. **Track cardinality** through operations
4. **Annotate AST** with type information
5. **Collect diagnostics** for errors/warnings

### Special Cases

#### Union Types
When navigating polymorphic properties:
```typescript
Observation.value  -> Union of Quantity | String | CodeableConcept | ...
```

#### Any Type
Functions returning Any:
```typescript
trace('debug')     -> Any (same cardinality as input)
children()         -> Any (collection)
```

#### Anonymous Types
Complex properties without standalone types:
```typescript
Patient.contact    -> Anonymous type with properties
```

## Testing

The test suite covers:
- Literal type inference
- Property navigation (simple, chained, anonymous)
- Function signatures and parameter validation
- Operator type checking
- Complex expressions
- Error handling in both modes
- Type propagation including Any
- Collection operations

Run tests:
```bash
bun test test/analyzer.test.ts
```

## Schema System

The analyzer uses a schema-based type system:

### Schema Structure
```typescript
interface FHIRSchema {
  name?: string;              // Schema name
  base?: string;              // Parent type for inheritance
  primitive?: boolean;        // Primitive type indicator
  elements?: Record<string, FHIRSchemaElement>;
}

interface FHIRSchemaElement {
  type?: string;              // Type reference
  array?: boolean;            // Collection indicator
  union?: boolean | string;   // Union type discriminator
  types?: string[];           // Union type options
  elements?: Record<string, FHIRSchemaElement>; // Inline nested type
}
```

### Schema Registry
The `SchemaRegistry` interface enables dynamic schema resolution:
```typescript
interface SchemaRegistry {
  resolve(typeName: string): FHIRSchema | undefined;
}
```

This allows for:
- Lazy loading of schemas
- Remote schema fetching
- Version-specific resolution
- Integration with FHIR package managers

## Future Enhancements

1. **Dynamic Schema Loading**: Load schemas from FHIR packages or servers
2. **Advanced Type Features**: Generics, type constraints, invariants
3. **Performance Optimization**: Incremental analysis, better caching
4. **IDE Integration**: Real-time type checking, auto-completion
5. **Type Inference**: Infer types for variables and complex expressions
6. **Union Type Support**: Full support for FHIR choice types (e.g., value[x])
7. **Constraint Validation**: Check FHIR invariants and cardinality constraints