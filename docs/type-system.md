# FHIRPath Type System Documentation

## Overview

The FHIRPath type system is a dual-type system that bridges FHIRPath computational types with model-specific types (like FHIR resources). This document details the type system implementation, type inference mechanisms, and integration points.

## Type Hierarchy

### FHIRPath Primitive Types

FHIRPath defines a set of primitive types used for computations:

```typescript
export type TypeName = 
  | 'Any'      // Base type for all values
  | 'Boolean'  // true, false
  | 'String'   // Character sequences
  | 'Integer'  // 32-bit integers
  | 'Long'     // 64-bit integers (STU)
  | 'Decimal'  // Arbitrary precision decimals
  | 'Date'     // Year, month, day
  | 'DateTime' // Date with time and optional timezone
  | 'Time'     // Time of day
  | 'Quantity' // Number with unit
```

### Type Relationships

```
System.Any
├── System.Boolean
├── System.String
├── System.Integer
├── System.Long
├── System.Decimal
├── System.Date
├── System.DateTime
├── System.Time
└── System.Quantity
```

All types inherit from `System.Any`, which serves as the universal base type.

## Type Information Structure

### Core TypeInfo Interface

```typescript
export interface TypeInfo {
  // FHIRPath computational type
  type: TypeName;
  
  // Cardinality
  singleton?: boolean;     // true = single value, false/undefined = collection
  
  // Union type indicator
  union?: boolean;         // true for choice types like value[x]
  
  // Model-specific information
  namespace?: string;      // e.g., "FHIR", "CDA"
  name?: string;          // e.g., "Patient", "Observation"
  
  // Union type choices
  choices?: TypeInfo[];    // For union types only
  
  // Complex type properties
  elements?: {
    [propertyName: string]: TypeInfo;
  };
  
  // Model-specific context (opaque)
  modelContext?: unknown;
}
```

### Type Examples

#### Primitive Types

```typescript
// Single string
const stringType: TypeInfo = {
  type: 'String',
  singleton: true
};

// Collection of integers
const integerListType: TypeInfo = {
  type: 'Integer',
  singleton: false
};

// Quantity with unit
const quantityType: TypeInfo = {
  type: 'Quantity',
  singleton: true
};
```

#### Complex Types

```typescript
// FHIR Patient resource
const patientType: TypeInfo = {
  type: 'Any',           // All complex types are 'Any' in FHIRPath
  namespace: 'FHIR',
  name: 'Patient',
  singleton: true,
  elements: {
    'id': { type: 'String', singleton: true },
    'name': { 
      type: 'Any',
      namespace: 'FHIR',
      name: 'HumanName',
      singleton: false,
      elements: {
        'given': { type: 'String', singleton: false },
        'family': { type: 'String', singleton: true },
        'use': { type: 'String', singleton: true }
      }
    },
    'birthDate': { type: 'Date', singleton: true }
  }
};
```

#### Union Types

```typescript
// FHIR Observation.value[x] choice type
const valueChoiceType: TypeInfo = {
  type: 'Any',
  union: true,
  namespace: 'FHIR',
  name: 'Observation.value[x]',
  singleton: true,
  choices: [
    { type: 'String', singleton: true },
    { type: 'Integer', singleton: true },
    { type: 'Decimal', singleton: true },
    { 
      type: 'Quantity',
      namespace: 'FHIR',
      name: 'Quantity',
      singleton: true
    },
    {
      type: 'Any',
      namespace: 'FHIR',
      name: 'CodeableConcept',
      singleton: true
    }
  ]
};
```

## Type Inference

### TypeAnalyzer Implementation

The TypeAnalyzer (`src/type-analyzer.ts`) performs type inference on AST nodes:

```typescript
export class TypeAnalyzer {
  constructor(
    private registry: Registry,
    private modelProvider?: ModelTypeProvider
  ) {}
  
  analyze(ast: ASTNode): Map<ASTNode, TypeInfo> {
    const typeMap = new Map<ASTNode, TypeInfo>();
    this.inferTypes(ast, typeMap);
    return typeMap;
  }
}
```

### Inference Rules

#### Literal Type Inference

```typescript
private inferLiteralType(node: LiteralNode): TypeInfo {
  switch (node.valueType) {
    case 'boolean':
      return { type: 'Boolean', singleton: true };
    case 'string':
      return { type: 'String', singleton: true };
    case 'number':
      // Check if integer or decimal
      return Number.isInteger(node.value)
        ? { type: 'Integer', singleton: true }
        : { type: 'Decimal', singleton: true };
    case 'date':
      return { type: 'Date', singleton: true };
    case 'datetime':
      return { type: 'DateTime', singleton: true };
    case 'time':
      return { type: 'Time', singleton: true };
    case 'quantity':
      return { type: 'Quantity', singleton: true };
    default:
      return { type: 'Any', singleton: true };
  }
}
```

#### Binary Operation Type Inference

```typescript
private inferBinaryType(node: BinaryNode, typeMap: Map<ASTNode, TypeInfo>): TypeInfo {
  const leftType = this.inferTypes(node.left, typeMap);
  const rightType = this.inferTypes(node.right, typeMap);
  
  // Special handling for navigation (dot operator)
  if (node.operator === '.') {
    return this.inferNavigationType(leftType, node.right, typeMap);
  }
  
  // Look up operator signature
  const operator = this.registry.getOperator(node.operator);
  if (operator) {
    const signature = this.findMatchingSignature(
      operator.signatures,
      leftType,
      rightType
    );
    
    if (signature) {
      return signature.result;
    }
  }
  
  // Default to Any collection
  return { type: 'Any', singleton: false };
}
```

#### Navigation Type Inference

```typescript
private inferNavigationType(
  parentType: TypeInfo,
  propertyNode: ASTNode,
  typeMap: Map<ASTNode, TypeInfo>
): TypeInfo {
  // Handle identifier navigation
  if (propertyNode.type === NodeType.Identifier) {
    const propertyName = (propertyNode as IdentifierNode).name;
    
    // Use model provider if available
    if (this.modelProvider && parentType.namespace && parentType.name) {
      const propertyType = this.modelProvider.navigateProperty(
        parentType,
        propertyName
      );
      if (propertyType) {
        // Navigation to collection property from collection parent 
        // results in flattened collection
        if (!parentType.singleton && !propertyType.singleton) {
          return { ...propertyType, singleton: false };
        }
        return propertyType;
      }
    }
    
    // Check elements if available
    if (parentType.elements && parentType.elements[propertyName]) {
      const elementType = parentType.elements[propertyName];
      // Same flattening logic
      if (!parentType.singleton && !elementType.singleton) {
        return { ...elementType, singleton: false };
      }
      return elementType;
    }
  }
  
  // Default to Any collection
  return { type: 'Any', singleton: false };
}
```

#### Function Return Type Inference

```typescript
private inferFunctionType(node: FunctionNode, typeMap: Map<ASTNode, TypeInfo>): TypeInfo {
  const functionName = this.getFunctionName(node);
  const functionDef = this.registry.getFunction(functionName);
  
  if (functionDef) {
    // Get input type from navigation context
    const inputType = this.getInputType(node, typeMap);
    
    // Check if input matches function signature
    if (this.isTypeCompatible(inputType, functionDef.signature.input)) {
      // Apply cardinality rules
      const result = functionDef.signature.result;
      
      // Functions like first(), last() convert collections to singletons
      if (functionName === 'first' || functionName === 'last') {
        return { ...result, singleton: true };
      }
      
      // Functions like where(), select() preserve collection nature
      if (!inputType.singleton && !result.singleton) {
        return { ...result, singleton: false };
      }
      
      return result;
    }
  }
  
  return { type: 'Any', singleton: false };
}
```

## Type Conversion

### Implicit Conversions

FHIRPath automatically converts between compatible types:

```typescript
const implicitConversions: Record<TypeName, TypeName[]> = {
  'Integer': ['Long', 'Decimal', 'Quantity'],
  'Long': ['Decimal'],
  'Decimal': ['Quantity'],
  'Date': ['DateTime'],
  // Other types have no implicit conversions
  'Boolean': [],
  'String': [],
  'DateTime': [],
  'Time': [],
  'Quantity': [],
  'Any': []
};
```

### Explicit Conversion Functions

```typescript
// Conversion functions available in FHIRPath
convertsToBoolean(): Boolean
toBoolean(): Boolean

convertsToInteger(): Boolean
toInteger(): Integer

convertsToLong(): Boolean
toLong(): Long

convertsToDecimal(): Boolean
toDecimal(): Decimal

convertsToString(): Boolean
toString(): String

convertsToDate(): Boolean
toDate(): Date

convertsToDateTime(): Boolean
toDateTime(): DateTime

convertsToTime(): Boolean
toTime(): Time

convertsToQuantity(unit?: String): Boolean
toQuantity(unit?: String): Quantity
```

### Conversion Rules

#### String Conversions

```typescript
// String to Boolean
'true' → true
'false' → false
't' → true
'f' → false
'yes' → true
'no' → false
'y' → true
'n' → false
'1' → true
'0' → false

// String to Integer
'123' → 123
'+123' → 123
'-123' → -123

// String to Decimal
'123.45' → 123.45
'1.23e2' → 123.0

// String to Date/DateTime/Time
'2023-01-15' → Date
'2023-01-15T10:30:00Z' → DateTime
'10:30:00' → Time
```

## Model Provider Interface

### Interface Definition

```typescript
export interface ModelTypeProvider<TypeContext = unknown> {
  // Type lookup
  getTypeByName(typeName: string): TypeInfo | undefined;
  
  // Property navigation
  navigateProperty(parentType: TypeInfo, propertyName: string): TypeInfo | undefined;
  
  // Property existence check
  hasProperty(parentType: TypeInfo, propertyName: string): boolean;
  
  // Available properties
  getPropertyNames(parentType: TypeInfo): string[];
  
  // Check if type name exists
  hasTypeName(typeName: string): boolean;
  
  // All available types
  getAllTypeNames(): string[];
  
  // Type compatibility
  isTypeCompatible(source: TypeInfo, target: TypeInfo): boolean;
  
  // Map to FHIRPath type
  mapToFHIRPathType(typeName: string): TypeName;
  
  // Optional: Documentation
  getTypeDocumentation?(type: TypeInfo): string | undefined;
  getPropertyDocumentation?(parentType: TypeInfo, propertyName: string): string | undefined;
}
```

### Implementation Example

```typescript
class FHIRModelProvider implements ModelTypeProvider {
  private structureDefinitions: Map<string, StructureDefinition>;
  
  getTypeByName(typeName: string): TypeInfo | undefined {
    const sd = this.structureDefinitions.get(typeName);
    if (!sd) return undefined;
    
    return {
      type: this.mapToFHIRPathType(typeName),
      namespace: 'FHIR',
      name: typeName,
      singleton: true,
      elements: this.buildElements(sd),
      modelContext: sd
    };
  }
  
  navigateProperty(parentType: TypeInfo, propertyName: string): TypeInfo | undefined {
    if (!parentType.modelContext) return undefined;
    
    const sd = parentType.modelContext as StructureDefinition;
    const element = this.findElement(sd, propertyName);
    
    if (!element) return undefined;
    
    return this.elementToTypeInfo(element);
  }
  
  mapToFHIRPathType(typeName: string): TypeName {
    // FHIR primitive mappings
    const primitiveMap: Record<string, TypeName> = {
      'boolean': 'Boolean',
      'string': 'String',
      'integer': 'Integer',
      'decimal': 'Decimal',
      'date': 'Date',
      'dateTime': 'DateTime',
      'time': 'Time',
      'Quantity': 'Quantity',
      'SimpleQuantity': 'Quantity',
      'Age': 'Quantity',
      'Distance': 'Quantity',
      'Duration': 'Quantity',
      'Count': 'Quantity',
      'Money': 'Quantity'
    };
    
    return primitiveMap[typeName] || 'Any';
  }
}
```

## Type Operations

### Type Checking (`is` operator)

```typescript
// Runtime type checking
function checkIs(value: any, typeName: string): boolean {
  // Primitive type checks
  switch (typeName) {
    case 'Boolean':
      return typeof value === 'boolean';
    case 'String':
      return typeof value === 'string';
    case 'Integer':
      return Number.isInteger(value);
    case 'Decimal':
      return typeof value === 'number' && !Number.isInteger(value);
    case 'Date':
      return value instanceof Date && !hasTime(value);
    case 'DateTime':
      return value instanceof Date;
    case 'Quantity':
      return isQuantity(value);
  }
  
  // Complex type checks via model provider
  if (modelProvider) {
    return modelProvider.isTypeCompatible(
      getValueType(value),
      { type: 'Any', namespace: 'FHIR', name: typeName }
    );
  }
  
  return false;
}
```

### Type Casting (`as` operator)

```typescript
// Runtime type casting
function castAs(value: any, typeName: string): any {
  // Check if value is already of target type
  if (checkIs(value, typeName)) {
    return value;
  }
  
  // Check union types
  const valueType = getValueType(value);
  if (valueType.union && valueType.choices) {
    for (const choice of valueType.choices) {
      if (choice.name === typeName || 
          (choice.type === typeName && !choice.namespace)) {
        return value;
      }
    }
  }
  
  // No valid cast
  return undefined;
}
```

### Type Filtering (`ofType()` function)

```typescript
function ofType(input: any[], typeName: string): any[] {
  return input.filter(item => checkIs(item, typeName));
}
```

## Type Safety Features

### Compile-Time Type Checking

The analyzer can detect type errors before execution:

```typescript
// Type mismatch in operator
"'hello' + 5"  // Error: String + Integer not defined

// Invalid property access
"Patient.invalidProperty"  // Error: Property not found

// Function parameter type mismatch
"'text'.skip(2.5)"  // Error: skip() expects Integer, got Decimal
```

### Runtime Type Validation

The interpreter validates types at runtime:

```typescript
// Operator type checking
if (!isTypeCompatible(leftValue, operator.leftType)) {
  throw new TypeError(`Invalid left operand type for ${operator.symbol}`);
}

// Function parameter validation
for (const [index, param] of functionDef.signature.parameters.entries()) {
  if (!isTypeCompatible(args[index], param.type)) {
    throw new TypeError(`Invalid argument type for parameter ${param.name}`);
  }
}
```

## Integration with Static Analysis

### Type-Enriched AST

The analyzer adds type information to AST nodes:

```typescript
interface BaseASTNode {
  // ... other properties
  typeInfo?: TypeInfo;  // Added by analyzer
}

// After analysis
const ast = parse("Patient.name.given.first()");
const analyzed = analyze(ast);

// Each node has type information
analyzed.ast.typeInfo;  // { type: 'String', singleton: true }
```

### IDE Support

Type information enables IDE features:

1. **Hover Information**: Show type of expressions
2. **Autocomplete**: Suggest properties based on type
3. **Type Errors**: Highlight type mismatches
4. **Refactoring**: Type-aware rename and extract

## Best Practices

### 1. Always Specify Cardinality

```typescript
// Good
{ type: 'String', singleton: true }   // Single string
{ type: 'String', singleton: false }  // String collection

// Avoid
{ type: 'String' }  // Ambiguous cardinality
```

### 2. Preserve Model Information

```typescript
// Good - preserves source type
{
  type: 'Any',
  namespace: 'FHIR',
  name: 'HumanName',
  singleton: true
}

// Poor - loses model context
{
  type: 'Any',
  singleton: true
}
```

### 3. Handle Union Types Explicitly

```typescript
// Check all choices
if (typeInfo.union && typeInfo.choices) {
  for (const choice of typeInfo.choices) {
    // Handle each possible type
  }
}
```

### 4. Use Model Provider When Available

```typescript
// Prefer model provider for accuracy
if (modelProvider) {
  const propertyType = modelProvider.navigateProperty(parentType, propertyName);
  if (propertyType) return propertyType;
}

// Fall back to static analysis
return parentType.elements?.[propertyName] || { type: 'Any', singleton: false };
```

## Future Enhancements

1. **Generics Support**: Type parameters for functions
2. **Type Aliases**: Custom type definitions
3. **Structural Typing**: Duck typing for complex types
4. **Type Guards**: User-defined type checking functions
5. **Literal Types**: Specific string/number values as types
6. **Intersection Types**: Combining multiple types
7. **Tuple Types**: Fixed-length arrays with specific types

## Summary

The FHIRPath type system provides a robust foundation for type-safe expression evaluation:

- **Dual Type System**: Bridges FHIRPath and model types
- **Type Inference**: Automatic type detection
- **Type Conversion**: Implicit and explicit conversions
- **Model Integration**: Extensible via ModelProvider
- **Static Analysis**: Compile-time type checking
- **Runtime Safety**: Type validation during execution

This design enables both efficient runtime evaluation and rich IDE support while maintaining compatibility with the FHIRPath specification.