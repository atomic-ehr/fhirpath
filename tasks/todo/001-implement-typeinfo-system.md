# Task 001: Implement TypeInfo Type System

## Overview
Refactor the FHIRPath codebase to implement the new TypeInfo type system as specified in ADR-005. This is a breaking change that completely replaces the current TypeSignature interface with the more comprehensive TypeInfo structure that supports both FHIRPath computational types and model-specific type information.

## Background
The current type system uses a simple TypeSignature interface with only `type` and `singleton` properties. The new TypeInfo system adds support for:
- Union types (choice types)
- Complex type elements
- Model-specific namespace and name preservation
- Opaque model context
- Dual type system (FHIRPath + model types)

## Implementation Phases

### Phase 1: Core Type System Updates
1. **Update types.ts**
   - Replace FHIRPathType with TypeName type
   - Replace TypeSignature interface with TypeInfo
   - Update all type imports throughout the codebase
   - Remove any compatibility layers

2. **Update Registry**
   - Replace all TypeSignature references with TypeInfo
   - Update OperatorSignature to use TypeInfo
   - Update FunctionDefinition signature to use TypeInfo
   - Remove deprecated type references

### Phase 2: Update Operations
1. **Update all operator implementations** (50+ files in operations/)
   - Replace TypeSignature with TypeInfo in all signatures
   - Update type construction to use new TypeInfo structure
   - Remove any compatibility code

2. **Key operations to update**:
   - Arithmetic operators (plus, minus, multiply, divide, etc.)
   - Comparison operators (equal, greater, less, etc.)
   - Logical operators (and, or, not, etc.)
   - Collection functions (where, select, first, etc.)
   - Type operators (as, is) - add union type support

### Phase 3: Analyzer Integration
1. **Update analyzer.ts**
   - Replace TypeSignature with TypeInfo throughout
   - Add type inference using full TypeInfo capabilities
   - Implement union type handling
   - Add support for navigating complex type elements
   - Enhanced error messages using namespace/name

2. **Type checking enhancements**
   - Validate property access on complex types using elements map
   - Check union type compatibility
   - Implement type narrowing for is/as operators
   - Add model-aware type checking

### Phase 4: Parser Updates
1. **Update parser to produce TypeInfo metadata**
   - Replace TypeSignature references with TypeInfo
   - Annotate AST nodes with inferred TypeInfo
   - Handle type references in as/is operators
   - Add union type support if needed

### Phase 5: Model Provider Integration
1. **Implement ModelTypeProvider interface** (from ADR-004)
   - Create base implementation using TypeInfo
   - Add FHIR model provider example
   - Integrate with analyzer for model-aware type checking

2. **Connect to type system**
   - Use model provider for complex type navigation
   - Populate elements map from model definitions
   - Handle union types from model (e.g., FHIR choice types)

## Technical Details

### TypeInfo Structure
```typescript
interface TypeInfo {
  // FHIRPath type
  type: TypeName;
  union?: boolean;
  singleton?: boolean;

  // Model type information
  namespace?: string;
  name?: string;

  // For union types
  choices?: TypeInfo[];

  // For complex types
  elements?: {
    [key: string]: TypeInfo;
  }

  // Model context
  modelContext?: unknown;
}
```

### Refactoring Strategy
1. Make a clean break - replace TypeSignature with TypeInfo everywhere
2. Update all files in a single coordinated effort
3. Fix all TypeScript compilation errors
4. Update all tests to use new TypeInfo structure

### Testing Requirements
1. **Unit tests for type system**
   - TypeInfo creation and manipulation
   - Union type handling
   - Complex type navigation
   - Elements map usage

2. **Integration tests**
   - Update all existing tests to use TypeInfo
   - Test new type features (unions, elements)
   - Model provider integration tests
   - Type narrowing with is/as operators

3. **Performance tests**
   - Ensure no significant performance regression
   - Measure impact of richer type information

## Dependencies
- ADR-005: FHIRPath Type System specification
- ADR-004: Model Provider Interface (for Phase 5)

## Success Criteria
1. All tests updated and passing with new TypeInfo structure
2. TypeSignature completely removed from codebase
3. Union types work correctly with is/as operators
4. Complex type navigation works with elements map
5. Model provider can supply type information
6. Clean, consistent API using TypeInfo throughout

## Estimated Effort
- Phase 1: 1-2 days (core type system)
- Phase 2: 2-3 days (update all operations)
- Phase 3: 2 days (analyzer integration)
- Phase 4: 1 day (parser updates)
- Phase 5: 2 days (model provider)

Total: ~8-10 days (reduced due to no backward compatibility requirements)

## Notes
- This is a breaking change - version bump required
- Create migration guide for users upgrading from TypeSignature
- Document the new TypeInfo structure thoroughly
- Consider performance implications of richer type information
- All existing APIs will change to use TypeInfo