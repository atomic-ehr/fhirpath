---
description: Implement a FHIRPath function following the standard pattern
argument-hint: <function-name>
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - MultiEdit
  - Grep
  - WebFetch
  - TodoWrite
---

# Implement FHIRPath Function: $ARGUMENTS

I need to implement the `$ARGUMENTS()` function for FHIRPath. I'll follow the standard implementation pattern:

## Implementation Steps

### 1. Research Phase
- Search for the function specification: `bun tools/spec.ts "$ARGUMENTS" -c`
- Check for any special behaviors, edge cases, or STU markers
- Look for examples in the spec

### 2. Grep fhirpathlab-tests
- Look for existing tests in `./spec/fhirpathlab-tests/fhirpathlab-tests.xml`
- Extract any useful test cases

### 3. Implementation
Create `/src/operations/$ARGUMENTS-function.ts` following this structure:

```typescript
import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { Errors } from '../errors';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // Handle empty input collection if needed (check spec)
  if (input.length === 0) {
    return { value: [], context };
  }

  // Validate singleton input (if required by spec)
  // if (input.length > 1) {
  //   throw Errors.multipleItemsNotAllowed('$ARGUMENTS');
  // }

  // Type check the input if needed
  // const item = unbox(input[0]);
  
  // Validate arguments
  // Evaluate arguments with proper context
  // Implement core logic per spec
  
  // Return result maintaining collection semantics
  // return { value: [box(result, typeInfo)], context };
};

export const $ARGUMENTSFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: '$ARGUMENTS',
  category: ['<category>'], // Determine from spec (e.g., 'existence', 'string', 'math', etc.)
  description: '<from spec>',
  examples: [
    // Add examples from spec
  ],
  signature: {
    input: { type: '<Type>', singleton: <boolean> },
    parameters: [
      // Add parameters from spec with proper optional flags
      // { name: 'param', type: { type: 'String', singleton: true }, optional: true }
    ],
    result: { type: '<Type>', singleton: <boolean> }
  },
  evaluate
};
```

### 4. Register the Function
Add to `/src/operations/index.ts`:
```typescript
export { $ARGUMENTSFunction } from './$ARGUMENTS-function';
```

And register in the functions array at the bottom of the file.

### 5. Create Test Cases
Create `/test-cases/operations/<category>/$ARGUMENTS.json` with:
- Basic functionality tests
- Edge cases
- Empty input handling
- Error cases (with proper error codes)
- Integration tests
- Spec examples
- FHIRPath Lab tests (if found)

For functions that rely on FHIR model (ofType, is, as), use real ModelProvider:
```json
{
  "name": "Test with ModelProvider",
  "expression": "Observation.value.ofType(CodeableConcept)",
  "input": [{
    "resourceType": "Observation",
    "value": {
      "coding": [{"system": "http://example.org", "code": "test"}]
    }
  }],
  "expected": [{"coding": [{"system": "http://example.org", "code": "test"}]}],
  "modelProvider": "r4"
}
```

### 6. Run Tests
- `bun tools/testcase.ts operations/<category>/$ARGUMENTS.json`
- `bun tsc --noEmit` to check for TypeScript errors
- Test interactively: `bun tools/interpreter.ts "<expression>"`

### 7. Common Patterns

#### String Manipulation Functions
- Check for singleton input
- Convert to string if needed
- Handle empty collections appropriately

#### Collection Functions  
- Usually work on any input type
- Propagate empty collections
- Consider collection semantics

#### Type Functions
- May require ModelProvider for complex types
- Handle primitive types without ModelProvider
- Use proper error codes (FP3001, FP3003, etc.)

### 8. Error Handling
Use proper error codes:
- `FP2001` - Wrong argument count
- `FP3001` - Type not assignable
- `FP3003` - Argument type mismatch
- `FP3004` - Conversion failed
- `FP3005` - Multiple items not allowed

### 9. Documentation
- Function is automatically documented through its metadata
- Add complex examples to test cases
- Update ADRs if significant design decisions are made
