# ADR-011: Children Function Analyzer Support

## Status

Proposed

## Context

The FHIRPath `children()` function returns all immediate child nodes of items in the input collection. During static analysis, this presents a type challenge because:

1. A single element can have many properties of different types
2. The result is a heterogeneous collection of values with different types
3. The analyzer needs to track possible types for downstream type checking
4. The spec notes that many navigation functions result in nodes of different underlying types

For example, calling `Patient.children()` could return values of type:
- HumanName (from name property)
- Identifier (from identifier property)  
- Date (from birthDate property)
- Boolean (from active property)
- ContactPoint (from telecom property)
- And many more...

Currently, our analyzer can handle single types and choice types (unions), but doesn't have a mechanism for representing "all possible child types" from a complex type.

## Decision

Extend the existing union type mechanism to support the `children()` function by:

1. **Reuse Union Type Infrastructure**: Leverage the existing `isUnion` and `choices` pattern used for FHIR choice types
2. **Delegate to ModelProvider**: The ModelProvider will be responsible for constructing the union of all child element types
3. **Create a new ModelProvider method**: Add `getChildrenType()` that returns a union TypeInfo

### Implementation Approach

```typescript
// In ModelProvider interface
interface ModelProvider<TypeContext = unknown> {
  // ... existing methods ...
  
  // Returns a union type of all possible child element types
  getChildrenType(parentType: TypeInfo<TypeContext>): TypeInfo<TypeContext> | undefined;
}

// In FHIRModelProvider
getChildrenType(parentType: TypeInfo<FHIRModelContext>): TypeInfo<FHIRModelContext> | undefined {
  const elementNames = this.getElementNames(parentType);
  if (elementNames.length === 0) return undefined;
  
  // Collect all unique child types
  const childTypes = new Map<string, TypeInfo<FHIRModelContext>>();
  
  for (const elementName of elementNames) {
    const elementType = this.getElementType(parentType, elementName);
    if (elementType) {
      // Use a combination of namespace and name as key to deduplicate
      const key = `${elementType.namespace || ''}.${elementType.name || elementType.type}`;
      childTypes.set(key, elementType);
    }
  }
  
  // Create a union type representing all possible children
  return {
    type: 'Any', // Or a special 'Union' type
    namespace: parentType.namespace,
    name: 'ChildrenUnion',
    singleton: false, // children() always returns a collection
    modelContext: {
      ...parentType.modelContext,
      isUnion: true,
      choices: Array.from(childTypes.values()).map(type => ({
        type: type.type,
        code: type.name || type.type,
        namespace: type.namespace,
        modelContext: type.modelContext
      }))
    }
  };
}
```

### Analyzer Integration

```typescript
// In analyzer.ts, when handling children() function
case 'children':
  if (inputType && this.modelProvider) {
    const childrenType = this.modelProvider.getChildrenType(inputType);
    if (childrenType) {
      node.typeInfo = childrenType;
    } else {
      // Fallback to Any collection
      node.typeInfo = { type: 'Any', singleton: false };
    }
  }
  break;
```

### Type Filtering Integration

When type filtering functions (`ofType()`, `is`, `as`) are applied to the result of `children()`, the analyzer should validate that the requested type exists in the union:

```typescript
// In analyzer.ts, when handling type filtering operations on union types

// For ofType() function
case 'ofType':
  const targetType = args[0]; // The type to filter for
  if (inputType?.modelContext?.isUnion && inputType.modelContext.choices) {
    const validChoice = inputType.modelContext.choices.find(choice => 
      choice.type === targetType || choice.code === targetType
    );
    
    if (!validChoice) {
      // Generate warning diagnostic
      this.diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        code: 'invalid-type-filter',
        message: `Type '${targetType}' is not present in the union type. Available types: ${
          inputType.modelContext.choices.map(c => c.type || c.code).join(', ')
        }`,
        range: node.range
      });
      // Result will be empty collection
      node.typeInfo = { type: 'Any', singleton: false };
    } else {
      // Type filter is valid, result is the filtered type
      node.typeInfo = validChoice;
    }
  }
  break;

// For 'is' operator (type test)
case 'is':
  if (leftType?.modelContext?.isUnion && leftType.modelContext.choices) {
    const targetTypeName = (node as TypeTestNode).targetType;
    const validChoice = leftType.modelContext.choices.find(choice =>
      choice.type === targetTypeName || choice.code === targetTypeName
    );
    
    if (!validChoice) {
      this.diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        code: 'invalid-type-test',
        message: `Type test 'is ${targetTypeName}' will always be false. Type '${targetTypeName}' is not in the union. Available types: ${
          leftType.modelContext.choices.map(c => c.type || c.code).join(', ')
        }`,
        range: node.range
      });
    }
    // Result is always Boolean
    node.typeInfo = { type: 'Boolean', singleton: true };
  }
  break;

// For 'as' operator (type cast)
case 'as':
  if (leftType?.modelContext?.isUnion && leftType.modelContext.choices) {
    const targetTypeName = (node as TypeCastNode).targetType;
    const validChoice = leftType.modelContext.choices.find(choice =>
      choice.type === targetTypeName || choice.code === targetTypeName  
    );
    
    if (!validChoice) {
      this.diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        code: 'invalid-type-cast',
        message: `Type cast 'as ${targetTypeName}' may fail. Type '${targetTypeName}' is not guaranteed in the union. Available types: ${
          leftType.modelContext.choices.map(c => c.type || c.code).join(', ')
        }`,
        range: node.range
      });
      // Cast might fail at runtime, but we still set the type
      node.typeInfo = { 
        type: targetTypeName, 
        singleton: leftType.singleton,
        // Mark as potentially empty
        nullable: true 
      };
    } else {
      node.typeInfo = validChoice;
    }
  }
  break;
```

### Example Diagnostics

Given the expression:
```fhirpath
Patient.children().ofType(Medication)
```

The analyzer would produce:
```
Warning: Type 'Medication' is not present in the union type. 
Available types: Identifier, HumanName, ContactPoint, Date, Boolean, Address, CodeableConcept, ...
```

For the expression:
```fhirpath
Patient.children().where(($this is Medication) or ($this is HumanName))
```

The analyzer would produce:
```
Warning: Type test 'is Medication' will always be false. Type 'Medication' is not in the union.
Available types: Identifier, HumanName, ContactPoint, Date, Boolean, Address, CodeableConcept, ...
```

## Consequences

### Positive

- **Reuses existing infrastructure**: Leverages the union type pattern already established for choice types
- **Type safety**: Downstream operations can use `ofType()` to filter specific types from children
- **Accurate type checking**: The analyzer can validate operations on children() results
- **Extensible**: The same pattern can be used for `descendants()` and similar functions
- **Clean separation**: ModelProvider handles domain-specific logic, analyzer stays generic

### Negative

- **Large union types**: Complex resources may have dozens of child types, creating large unions
- **Performance**: Constructing union types for every children() call may have overhead
- **Type precision**: Without path context, we can't narrow types further
- **Complexity**: Adds another method to the ModelProvider interface

## Alternatives Considered

### 1. Return Any Type
Simply return `{ type: 'Any', singleton: false }` for children() results.

**Rejected because**: Loses all type information, making downstream type checking impossible.

### 2. Create a Special ChildrenType
Introduce a new type kind specifically for children() results.

**Rejected because**: Requires significant changes to the type system and doesn't leverage existing union infrastructure.

### 3. Lazy Type Resolution
Defer type resolution until a specific property is accessed.

**Rejected because**: Would require fundamental changes to how the analyzer works and wouldn't support operations like `ofType()`.

### 4. Inline Union Construction in Analyzer
Build the union directly in the analyzer without delegating to ModelProvider.

**Rejected because**: Violates separation of concerns - the analyzer shouldn't know about FHIR-specific type hierarchies and element structures.