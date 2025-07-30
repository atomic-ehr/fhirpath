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

### 2. Check Legacy Tests
- Look for existing tests in `legacy-fp/legacy-spec/fhirpath/tests/$ARGUMENTS.json`
- Extract any useful test cases

### 3. Implementation
Create `/src/operations/$ARGUMENTS-function.ts` following this structure:

```typescript
import type { FunctionDefinition, FunctionEvaluator } from '../types';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // Handle empty input collection
  if (input.length === 0) {
    return { value: [], context };
  }
  
  // Validate singleton input (if required by spec)
  // Type check the input
  // Validate arguments
  // Evaluate arguments
  // Implement core logic per spec
  // Return result maintaining collection semantics
};

export const $ARGUMENTSFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: '$ARGUMENTS',
  category: ['<category>'], // Determine from spec
  description: '<from spec>',
  examples: [
    // Add examples from spec
  ],
  signature: {
    input: { type: '<Type>', singleton: <boolean> },
    parameters: [
      // Add parameters from spec
    ],
    result: { type: '<Type>', singleton: <boolean> }
  },
  evaluate
};
```

### 4. Add to Operations Index
Add export to `/src/operations/index.ts`

### 5. Create Test Cases
Create `/test-cases/operations/<category>/$ARGUMENTS.json` with:
- Basic functionality tests
- Edge cases
- Empty input handling
- Error cases
- Integration tests
- Spec examples
- FHIRPath Lab tests (if found)

### 6. Run Tests
- `bun tools/testcase.ts operations/<category>/$ARGUMENTS.json`
- `bun tsc --noEmit`
- Test interactively with interpreter