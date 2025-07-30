# ADR-005: FHIRPath Type System and Data Model Integration

## Status

Proposed

## Context

We need a type system for FHIRPath library. It should be dual type system - FHIRPath + FHIR or may be other models.

### Proposed Type System

```typescript

type TypeName = 'Any' | 'Boolean' | 'String' | 'Integer' | 'Long' | 'Decimal' | 'Date' | 'DateTime' | 'Time' | 'Quantity';

interface TypeInfo {
  // FHIRPath type
  type: TypeName;
  union?: boolean;
  singleton?: boolean;

  // original type namespace and name
  namespace?: string;
  name?: string;

  // for union types
  choices?: TypeInfo[];

  // for complex types
  elements?: {
    [key: string]: TypeInfo;
  }

  // model context
  modelContext?: unknown;
}

```

### Type Signature Examples

```typescript
// Primitive type - singleton String
const stringType: TypeInfo = { type: 'String', singleton: true };

// Primitive type - collection of Integers
const integerListType: TypeInfo = { type: 'Integer', singleton: false };

// Complex type - FHIR Patient
const patientType: TypeInfo = {
  type: 'Any',
  namespace: 'FHIR',
  name: 'Patient',
  singleton: true,
  modelContext: { /* opaque model data */ }
};

// Complex type - collection of FHIR HumanName
const humanNameListType: TypeInfo = {
  type: 'Any',

  namespace: 'FHIR',
  name: 'HumanName',

  singleton: false
  elements: {
    'given':  { type: 'String', singleton: false },
    'family': { type: 'String', singleton: true }
  }
};

const simpleQuantityType: TypeInfo = {
  type: 'Quantity',
  namespace: 'FHIR',
  name: 'SimpleQuantity',
  singleton: true
}

const durationType: TypeInfo = {
  type: 'Quantity',
  namespace: 'FHIR',
  name: 'Duration',
  singleton: true,
  modelContext: {/*...*/ }
}

const moneyType: TypeInfo = {
  type: 'Quantity',
  namespace: 'FHIR',
  name: 'Money',
  singleton: true
}

// Union type - choice type
const valueChoiceType: TypeSignature = {
  type: 'Any',
  union: true,
  namespace: 'FHIR',
  name: 'Observation.value[x]',
  // if no name - means tuple
  singleton: true,
  choices: [
    { type: 'String', singleton: true },
    { type: 'Integer', singleton: true },
    { type: 'Quantity', namespace: 'FHIR', name: 'Quantity', singleton: true },
    { type: 'Any', namespace: 'FHIR', name: 'CodeableConcept', singleton: true }
  ]
};

const integerPlusSignature: BinaryOperatorSignature = {
  left:   { type: 'Integer', singleton: true } as TypeInfo,
  right:  { type: 'Integer', singleton: true } as TypeInfo,
  result: { type: 'Integer', singleton: true } as TypeInfo
}

interface ArgumentInfo {
  name: string;
  type: TypeInfo;
}

interface FunctionSignature {
  input: TypeInfo;
  arguments: ArgumentInfo[];
  result: TypeInfo;
}

const substringSignature: FunctionSignature = {
  input: { type: 'String', singleton: true } as TypeInfo,
  arguments: [
    {
      name: 'start', 
      type: {type: 'Integer', singleton: true } as TypeInfo
    },
    {
      name: 'end',   
      type: {type: 'Integer', singleton: true } as TypeInfo
    }
  ],
  result: {type: 'String', singleton: true } as TypeInfo
}

```

## Design Rationale

### Dual Type System

The design maintains a clear separation between:
1. **FHIRPath computational types** (TypeName) - used for operations and computations
2. **Model-specific types** (namespace + name) - preserved for type checking and navigation

This dual nature is reflected in having both:
- `type: TypeName` - Always maps to a FHIRPath primitive or 'Any'
- `namespace + name` - Preserves the original model type information

### Key Design Decisions

1. **Complex types always map to 'Any'** in FHIRPath type system
   - All FHIR resources, datatypes, etc. are 'Any' from FHIRPath's perspective
   - This aligns with FHIRPath spec where complex types have limited operations
   - The actual type is preserved in namespace/name for type checking

2. **Elements for complex types**
   - The `elements` map allows static type analysis without model provider
   - Enables IDE features like autocomplete
   - Can be populated lazily or partially

3. **Union types are explicit**
   - Choice types (like value[x]) are represented as unions
   - Each choice maintains its full type information
   - Enables proper type narrowing with `is` and `as` operators

4. **Unknown kind for dynamic scenarios**
   - When type information is unavailable
   - Allows graceful degradation
   - Better than throwing errors during analysis

### Type Resolution Example

```typescript
// Type flow for: Patient.name.given.first()
const typeFlow = [
  {
    expr: "Patient",
    type: {
      kind: 'complex',
      type: 'Any',
      namespace: 'FHIR',
      name: 'Patient',
      singleton: true,
      elements: {
        name: { kind: 'complex', type: 'Any', namespace: 'FHIR', name: 'HumanName', singleton: false }
      }
    }
  },
  {
    expr: ".name",
    type: {
      kind: 'complex',
      type: 'Any',
      namespace: 'FHIR', 
      name: 'HumanName',
      singleton: false,
      elements: {
        given: { kind: 'primitive', type: 'String', singleton: false },
        family: { kind: 'primitive', type: 'String', singleton: true }
      }
    }
  },
  {
    expr: ".given",
    type: { kind: 'primitive', type: 'String', singleton: false }
  },
  {
    expr: ".first()",
    type: { kind: 'primitive', type: 'String', singleton: true }
  }
];
```

### Integration with Existing Code

The BaseTypeInfo interface aligns with the existing TypeSignature:

```typescript
// Existing in types.ts
interface TypeSignature {
  type: FHIRPathType;
  singleton: boolean;
}

// Enhanced version adds metadata
interface TypeInfo extends BaseTypeInfo {
  // Additional context without breaking existing code
}
```

## Implementation Phases

1. **Phase 1**: Update TypeSignature to TypeInfo structure
2. **Phase 2**: Implement type resolution for navigation
3. **Phase 3**: Add union type support
4. **Phase 4**: Model provider implementation
5. **Phase 5**: Integrate with analyzer for type checking
