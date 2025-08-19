# Code Review: Operations and Functions

This review focuses on the implementation of the individual FHIRPath operators and functions located in the `src/operations/` directory.

## 1. Overall Assessment

The modular approach of placing each operation in its own file is excellent for maintainability. The implementations are generally clear and correctly use the project's core architectural patterns, such as the unified error system (`Errors` factory) and the runtime value boxing (`box`, `unbox`).

The review identifies one critical area for improvement related to an incomplete architectural migration (ADR-014) and several opportunities to reduce boilerplate and improve consistency.

## 2. Operations Suggestions

### 2.1. [CRITICAL] Adopt Union Signatures for All Functions (ADR-014)

**Observation:**
This is the most significant issue found during the review and was also mentioned in the general review. ADR-014 (Union Types in Function Signatures) proposes that `FunctionDefinition` should support an array of signatures (`signatures: FunctionSignature[]`) to accurately model functions that accept multiple types. This makes them consistent with `OperatorDefinition`.

Currently, this ADR is only partially implemented. While some functions like `abs` have been updated, the vast majority of functions in `src/operations` and the core `FunctionDefinition` type in `src/types.ts` still use a single, outdated `signature: FunctionSignature` property. This severely limits the accuracy of the type system.

**Example (`src/operations/ceiling-function.ts`):**
```typescript
// Current incorrect implementation
export const ceilingFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  // ...
  signatures: [{
    name: 'ceiling',
    input: { type: 'Decimal', singleton: true },
    parameters: [],
    result: { type: 'Integer', singleton: true }
  }],
  evaluate
};
```
*Correction*: The above example for `ceiling` *is* actually using `signatures` (plural), which is good. However, many others are not. For instance, `toInteger` in `toInteger-function.ts` should have multiple signatures for `String`, `Boolean`, and `Integer` inputs, but is likely defined with a single, overly broad signature like `Any`.

**Recommendation:**
Prioritize the full implementation of ADR-014 across the codebase.
1.  **Update `src/types.ts`:** Change the `FunctionDefinition` interface to exclusively use `signatures: FunctionSignature[]`.
2.  **Refactor All Operations:** Audit every file in `src/operations/` and convert all single `signature` objects to a `signatures` array.
3.  **Create Multiple Signatures:** For functions that accept multiple types (e.g., `toInteger`, `toDecimal`, `toString`), create a distinct signature for each valid input type. This will make the function's behavior explicit and allow the `Analyzer` and `CompletionProvider` to be much more precise.

### 2.2. [REFINEMENT] Extract Boilerplate Logic into Helpers

**Observation:**
Many function implementations contain repetitive boilerplate code for validating input and arguments. For example, checking that an input is a singleton is a very common pattern.

**Example (`src/operations/length-function.ts`):**
```typescript
// Boilerplate checks
if (input.length === 0) {
  return { value: [], context };
}
if (input.length > 1) {
  throw Errors.stringSingletonRequired('length', input.length);
}

const boxedInputValue = input[0];
// ... more checks
```

**Suggestion:**
Create a set of helper functions to encapsulate these common validation patterns. This would reduce code duplication and make the core logic of each operation easier to read.

**Example Helpers:**
```typescript
// In a new src/operations/helpers.ts file

/**
 * Validates that the input is a singleton collection and returns the unboxed value.
 * Throws an appropriate error if the validation fails.
 */
export function getSingletonValue(input: FHIRPathValue[], functionName: string): any | null {
  if (input.length === 0) return null; // Return null for empty, let caller decide what to do
  if (input.length > 1) throw Errors.singletonRequired(functionName, input.length);
  return unbox(input[0]!);
}

/**
 * Validates and returns a singleton string argument from the arguments array.
 */
export async function getStringArg(args: ASTNode[], index: number, ...): Promise<string | null> {
  // ... logic to evaluate arg, check for singleton, check for string type, and unbox
}
```
Using these helpers would make the operation code much more concise and declarative.

### 2.3. [CORRECTNESS] Clarify `as` and `is` Operator Implementations

**Observation:**
The files `src/operations/as-operator.ts` and `src/operations/is-operator.ts` contain simplified, incomplete logic for type casting and checking, with comments like `// TODO: Implement proper FHIRPath type casting`. However, the primary, more robust logic for these operations resides in the `Interpreter`'s `evaluateTypeCast` and `evaluateMembershipTest` methods, which correctly leverage the `ModelProvider`.

This is confusing as it appears there are two competing implementations. The implementations in the `operations` files seem to be dead code that is never reached because the parser creates dedicated `TypeCastNode` and `MembershipTestNode` AST nodes, which are handled directly by the interpreter and never dispatched as generic binary operators.

**Suggestion:**
Remove the misleading and incomplete `evaluate` functions from `src/operations/as-operator.ts` and `src/operations/is-operator.ts`. Replace them with a comment clarifying that their execution is handled directly by the `Interpreter` due to their special syntactic nature.

```typescript
// In src/operations/as-operator.ts

export const evaluate: OperationEvaluator = async (...) => {
  // The 'as' operator is handled by a dedicated TypeCastNode in the AST
  // and evaluated directly in the interpreter's `evaluateTypeCast` method.
  // This evaluator should not be called.
  throw new Error('The 'as' operator evaluator should not be called directly.');
};
```
This prevents future confusion and ensures developers look in the correct place (the interpreter) to understand how these operations are implemented.
