# Task 012: Implement children() Function Analyzer Support

## Overview
Implement the `children()` function in the FHIRPath analyzer based on ADR-011, enabling proper type tracking and validation for heterogeneous collections returned by children().

## Background
- ADR-011 defines the approach for handling children() type analysis
- The function returns all immediate child nodes, creating a union of different types
- Type filtering operations (ofType, is, as) need validation against the union

## !!! IMPORTANT NOTES !!!
- Write clean code, don't maintain backwards compatibility

## Implementation Steps

### 1. Extend ModelProvider Interface
**File:** `src/types.ts`
- Add `getChildrenType()` method to ModelProvider interface
- Method should return a union TypeInfo containing all possible child types

```typescript
interface ModelProvider<TypeContext = unknown> {
  // ... existing methods ...
  
  // Returns a union type of all possible child element types
  getChildrenType(parentType: TypeInfo<TypeContext>): TypeInfo<TypeContext> | undefined;
}
```

### 2. Implement getChildrenType in FHIRModelProvider
**File:** `src/model-provider.ts`
- Implement the new method to construct union from all child element types
- Reuse existing union type structure (isUnion, choices)
- Deduplicate types based on namespace and name

```typescript
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
    type: 'Any',
    namespace: parentType.namespace,
    name: 'ChildrenUnion',
    singleton: false, // children() always returns a collection
    modelContext: {
      path: `${(parentType.modelContext as any)?.path || ''}.children()`,
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

### 3. Register children() Function
**File:** `src/operations/children-function.ts` (new file)
- Create operation definition for children()
- Register with appropriate metadata

```typescript
import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { Errors } from '../errors';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  if (args.length !== 0) {
    throw Errors.wrongArgumentCount('children', 0, args.length);
  }
  
  // Implementation will be added later for interpreter
  // For now, return empty as placeholder
  return { value: [], context };
};

export const childrenFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'children',
  category: ['navigation'],
  description: 'Returns all immediate child nodes of all items in the input collection',
  signature: {
    input: { type: 'Any', singleton: false },
    arguments: [],
    output: { type: 'Any', singleton: false }
  },
  evaluate
};
```

### 4. Update Analyzer for children() Support
**File:** `src/analyzer.ts`

#### 4.1 Add children() type annotation
In `annotateAST` method, handle children() function:

```typescript
case 'children':
  if (inputType && this.modelProvider && 'getChildrenType' in this.modelProvider) {
    const childrenType = this.modelProvider.getChildrenType(inputType);
    if (childrenType) {
      node.typeInfo = childrenType;
    } else {
      // Fallback to Any collection
      node.typeInfo = { type: 'Any', singleton: false };
    }
  } else {
    node.typeInfo = { type: 'Any', singleton: false };
  }
  break;
```

#### 4.2 Add validation for type filtering operations
Enhance existing type filtering validation to check union types:

For `ofType()`:
```typescript
case 'ofType':
  if (args.length !== 1) {
    // existing validation
  }
  
  const targetType = /* extract target type from args */;
  if (inputType?.modelContext && 
      typeof inputType.modelContext === 'object' &&
      'isUnion' in inputType.modelContext && 
      inputType.modelContext.isUnion &&
      'choices' in inputType.modelContext &&
      Array.isArray(inputType.modelContext.choices)) {
    
    const validChoice = inputType.modelContext.choices.find((choice: any) => 
      choice.type === targetType || choice.code === targetType
    );
    
    if (!validChoice) {
      this.diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        code: 'invalid-type-filter',
        message: `Type '${targetType}' is not present in the union type. Available types: ${
          inputType.modelContext.choices.map((c: any) => c.type || c.code).join(', ')
        }`,
        range: node.range
      });
      node.typeInfo = { type: 'Any', singleton: false };
    } else {
      node.typeInfo = validChoice;
    }
  }
  break;
```

Similar validation for `is` and `as` operators in their respective handlers.

### 5. Register Function in Registry
**File:** `src/registry.ts`
- Import and register the children function

```typescript
import { childrenFunction } from './operations/children-function';

// In registry initialization
registry.registerFunction(childrenFunction);
```

### 6. Add to Operations Index
**File:** `src/operations/index.ts`
- Export the new function

```typescript
export { childrenFunction } from './children-function';
```

### 7. Create Tests
**File:** `test/children-function.test.ts`
- Test basic children() functionality
- Test type analysis with model provider
- Test union type creation
- Test type filtering warnings

### 8. Create Test Cases
**File:** `test-cases/operations/navigation/children.json`
- Add FHIRPath test cases for children() function
- Include cases with type filtering

## Testing Plan

1. **Unit Tests:**
   - Test getChildrenType() method with various input types
   - Test union type construction and deduplication
   - Test analyzer warnings for invalid type filters

2. **Integration Tests:**
   - Test children() with real FHIR resources
   - Test chaining: `Patient.children().ofType(HumanName)`
   - Test combining with other operations

3. **Test Cases:**
   - Basic children() on complex types
   - children() on primitive types (should return empty)
   - Type filtering with valid and invalid types
   - Nested children() calls

## Success Criteria

- [ ] ModelProvider.getChildrenType() returns proper union types
- [ ] Analyzer annotates children() with union type information
- [ ] Type filtering operations produce warnings for invalid types
- [ ] All existing tests continue to pass
- [ ] New tests pass for children() functionality
- [ ] Test cases in test-cases/operations/navigation/children.json pass

## Notes

- The interpreter implementation will be added in a separate task
- Focus on analyzer support and type tracking first
- Ensure backward compatibility with existing code
- Consider performance implications of large union types