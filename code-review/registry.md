# Code Review: Registry

This review focuses on the `Registry` component (`src/registry.ts`), which serves as the central repository for operator and function definitions.

## 1. Overall Assessment

The `Registry` is a well-designed and critical piece of the engine's infrastructure. It effectively decouples the parser and analyzer from the concrete implementations of the operations.

**Key Strengths:**

*   **Automatic Discovery:** The mechanism to automatically discover and register all definitions from the `src/operations/` directory is excellent. It makes adding new functions or operators simple and less error-prone, as no manual registration step is required.
*   **Clear Categorization:** The separation of operators into `symbolOperators`, `keywordOperators`, and `unaryOperators` provides the necessary granularity for the parser to correctly handle different syntactic forms.
*   **Singleton Pattern:** The use of a single, exported `registry` instance provides simple, global access to definitions, which is appropriate for this use case.
*   **Tooling Support:** The `list...` and `get...Info` methods provide a clean API for introspection, which is valuable for documentation generation and debugging tools.

Suggestions for improvement focus on fully realizing the potential of the registry's type-aware features and enhancing its extensibility.

## 2. Registry Suggestions

### 2.1. [PRIORITY] Enhance Type-Awareness via ADR-014

**Observation:**
The registry's most powerful features are its type-aware methods (`getFunctionsForType`, `isFunctionApplicableToType`), which are essential for providing accurate static analysis and code completions. However, the effectiveness of these methods is fundamentally limited by the incomplete implementation of **ADR-014 (Union Types in Function Signatures)**.

Currently, because most `FunctionDefinition` objects have a single, overly broad signature (e.g., `input: { type: 'Any' }`), the applicability checks often return true for types that should be invalid. For example, `isFunctionApplicableToType('length', 'Integer')` incorrectly returns `true` because the signature for `length` is likely too permissive, whereas it should only apply to strings.

**Recommendation:**
As stated in the other reviews, completing the implementation of ADR-014 is the highest-impact change for the entire project. For the registry, this means:

1.  **Enforcing Precise Signatures:** Once all functions are updated to use `signatures: FunctionSignature[]`, the registry's type-checking logic can be made much stricter and more accurate.
2.  **Improving `isFunctionApplicableToType`:** This method should be updated to rigorously check all signatures in the array, paying close attention to both the `type` and the `singleton` cardinality. This will allow it to correctly differentiate between functions that operate on `String` vs. `String[]`, for example.

Fixing this will immediately and dramatically improve the quality of diagnostics from the `Analyzer` and suggestions from the `CompletionProvider`.

### 2.2. [REFACTOR] Centralize Type Compatibility Logic

**Observation:**
The `is...ApplicableToType` methods in the registry contain logic for determining type compatibility (e.g., treating `Integer` as compatible with `Decimal`, handling collection types). Similar logic exists in `src/analyzer.ts` in the `isTypeCompatible` method.

This duplication means there are multiple sources of truth for the rules of the type system, which can lead to inconsistencies and maintenance challenges.

**Suggestion:**
Create a new, dedicated module (e.g., `src/type-system.ts` or `src/type-utils.ts`) to house all type compatibility and subtyping logic. 

**Example `type-system.ts`:**
```typescript
export function isSubTypeOf(source: TypeName, target: TypeName): boolean { ... }

// Checks if a value of sourceType can be used where a targetType is expected,
// considering collections, subtypes, and promotions (e.g., Integer to Decimal).
export function isAssignable(source: TypeInfo, target: TypeInfo): boolean { ... }
```

Both the `Registry` and the `Analyzer` would then import and use these centralized functions for all type comparisons. This ensures consistency and makes the type system rules explicit and easier to manage.

### 2.3. [FEATURE] Enable Dynamic Registration for Extensibility

**Observation:**
The current `Registry` class loads all operations at initialization time from a hardcoded directory. The `registerFunction` and `registerOperator` methods are private, meaning a consumer of this library cannot add their own custom FHIRPath functions.

**Suggestion:**
Make the registration methods public to turn the registry into a powerful extension point for users.

**Example (`src/registry.ts`):**
```typescript
export class Registry {
  // ...
  public registerFunction(def: FunctionDefinition): void {
    this.functions.set(def.name, def);
  }

  public registerOperator(operator: OperatorDefinition): void {
    // ... existing logic
  }
}
```
This would allow users to easily extend the FHIRPath engine with domain-specific logic, greatly increasing the library's utility in real-world applications. For example, a user could define and register a `resolveToConcept()` function specific to their own terminology server.
