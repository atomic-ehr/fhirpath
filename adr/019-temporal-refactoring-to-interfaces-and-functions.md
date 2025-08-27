# ADR-019: Refactor Temporal Module from Classes to Interfaces and Functions

## Status
**Accepted** - Not yet implemented

## Date
2025-08-27

## Implementation Status
As of 2025-08-27: The refactoring described in this ADR has not been implemented yet. The current codebase still uses the class-based approach with all the issues described below.

## Context

The current temporal implementation (`src/temporal.ts` and `src/temporal-arithmetic.ts`) uses classes to represent temporal values (FHIRDate, FHIRTime, FHIRDateTime). Three independent code reviews (Gemini, Claude, Codex) have identified significant architectural issues with this approach.

### Current Problems

1.  **Circular Dependencies**: Classes use `require()` at runtime to avoid circular module dependencies between `temporal.ts` and `temporal-arithmetic.ts`. This violates ES module principles and creates fragile load-order dependencies.
2.  **Code Duplication**: ~400 lines of nearly identical code across the three temporal classes for comparison methods (`equals()`, `equivalent()`, `compare()`), validation logic, and component extraction.
3.  **Type System Issues**: Operations use `instanceof` checks and prototype manipulation (`Object.setPrototypeOf`), making the type system fragile and harder to understand.
4.  **Inconsistent Architecture**: The rest of the FHIRPath implementation uses pure functions (parser, interpreter, operations), making classes an architectural outlier.
5.  **JavaScript `Date` Dependency**: The implementation relies on the native JavaScript `Date` object for calendar arithmetic, which introduces timezone/DST edge cases and obscures FHIRPath's simplified calendar semantics (e.g., 30-day months).
6.  **Precision Handling Inconsistencies**: Different precision value systems for Time vs. DateTime types are defined inline, creating a maintenance risk.

### Current Implementation Size
- `temporal.ts`: 1,043 lines
- `temporal-arithmetic.ts`: 581 lines
- **Total: 1,624 lines**

### Current Implementation Problems (Verified)
The current implementation exhibits all the architectural issues identified:
1. **Circular dependencies confirmed**: `temporal.ts` uses `require()` calls at runtime (lines 222, 227, 419, 424, 794, 799) to import from `temporal-arithmetic.ts`
2. **instanceof checks with reconstruction**: Operations files need to check `instanceof` and reconstruct objects from plain objects when they don't match (see `plus-operator.ts` lines 76-83)
3. **Dynamic imports**: Multiple files use `await import('../temporal')` to avoid circular dependency issues
4. **No Object.setPrototypeOf found**: While mentioned in the ADR, the current code doesn't use `Object.setPrototypeOf`, instead reconstructing objects when needed

## Decision

**Refactor the temporal module from a class-based model to a functional one using interfaces and pure functions.** This decision is based on the unanimous recommendation from all code reviews and the clear architectural benefits.

### Additional Architecture Change: Parse Temporal Literals in AST

**Problem with Current Implementation:**
The current architecture has temporal literals parsed repeatedly throughout the codebase:
- **21+ calls** to `parseTemporalLiteral` scattered across operations
- Every operation does `await import('../temporal')` and re-parses the same literal
- The interpreter parses literals multiple times during evaluation (lines 277, 453, 489)
- Inconsistent with how `Quantity` literals are handled (which are parsed once in AST)

**Solution: Parse Temporal Literals to Structured Nodes in AST**
Similar to how `QuantityNode` works, create a `TemporalLiteralNode`:

```typescript
// In parser - parse the string into components
interface TemporalLiteralNode extends BaseASTNode {
  type: NodeType.TemporalLiteral;
  temporalType: 'Date' | 'DateTime' | 'Time';
  components: {
    year?: number;
    month?: number;
    day?: number;
    hour?: number;
    minute?: number;
    second?: number;
    millisecond?: number;
    timezoneOffset?: number;
  };
  precision: PrecisionInfo;
}

// In interpreter - create the actual temporal object ONCE
private async evaluateTemporalLiteral(
  node: ASTNode, 
  input: FHIRPathValue[], 
  context: RuntimeContext
): Promise<EvaluationResult> {
  const temporal = node as TemporalLiteralNode;
  
  let value: TemporalValue;
  if (temporal.temporalType === 'Date') {
    value = createDate(
      temporal.components.year!, 
      temporal.components.month,
      temporal.components.day
    );
  } else if (temporal.temporalType === 'DateTime') {
    value = createDateTime(/* components */);
  } else {
    value = createTime(/* components */);
  }
  
  return {
    value: [box(value, { type: temporal.temporalType, singleton: true })],
    context
  };
}
```

**Benefits:**
1. **Parse once** at compile time, not repeatedly at runtime
2. **Fail fast** - invalid temporal literals caught during parsing
3. **No dynamic imports** in operations - eliminates all `await import('../temporal')` calls
4. **Consistent** with Quantity handling pattern
5. **Better performance** - no repeated parsing of the same literal
6. **Cleaner code** - removes 21+ `parseTemporalLiteral` calls scattered across codebase

This follows the principle that the AST should represent the **parsed structure** of expressions, and temporal literals have structure (year/month/day/etc.) just like quantities have structure (value/unit).

### Proposed Architecture

1.  **Use Interfaces for Data Types**: Temporal values will be plain data objects defined by interfaces with discriminated union types using the `type` property, consistent with existing AST node patterns in the codebase.
2.  **Use Pure Functions for Operations**: All logic (creation, comparison, arithmetic, formatting) will be handled by standalone, pure functions.
3.  **Consolidate into a Single Module**: All temporal logic will be consolidated into a single, self-contained `temporal.ts` file, estimated to be ~900-1000 lines.
4.  **Create Shared Utility Helpers**: Common logic for validation, comparison, and arithmetic will be extracted into internal helper functions to maximize code reuse.

### Implementation Structure

```typescript
// temporal.ts - Single self-contained module

// ============================================================================
// Types and Interfaces
// ============================================================================
export interface FHIRDate {
  readonly type: 'Date';
  readonly year: number;
  readonly month?: number;
  readonly day?: number;
  readonly precision: PrecisionInfo;
}
// ... similar interfaces for FHIRTime and FHIRDateTime

export type TemporalValue = FHIRDate | FHIRTime | FHIRDateTime;

// ============================================================================
// Type Guards
// ============================================================================
export function isFHIRDate(value: unknown): value is FHIRDate {
  return !!value && (value as any).type === 'Date';
}
// ... other type guards

// ============================================================================
// Factory Functions
// ============================================================================
export function createDate(year: number, month?: number, day?: number): FHIRDate {
  // Validation using shared helpers and creation of the plain object
}
// ... other factory functions

// ============================================================================
// Comparison Operations
// ============================================================================
export function equals(a: TemporalValue, b: TemporalValue): boolean | null { /* ... */ }
export function equivalent(a: TemporalValue, b: TemporalValue): boolean { /* ... */ }
export function compare(a: TemporalValue, b: TemporalValue): -1 | 0 | 1 | null { /* ... */ }

// ============================================================================
// Arithmetic Operations
// ============================================================================
export function add(value: TemporalValue, quantity: TimeQuantity): TemporalValue { /* ... */ }
export function subtract(value: TemporalValue, quantity: TimeQuantity): TemporalValue { /* ... */ }

// ============================================================================
// Formatting and Parsing
// ============================================================================
export function toTemporalString(value: TemporalValue): string { /* ... */ }
export function parseTemporalLiteral(literal: string): TemporalValue { /* ... */ }

// ============================================================================
// Internal Utility Helpers
// ============================================================================
function _assertRange(name: string, v: number | undefined, min: number, max: number) { /* ... */ }
function _compareByComponents(a: any, b: any, keys: string[]): -1 | 0 | 1 | null { /* ... */ }
```

## Consequences

### Positive

1.  **Eliminates Circular Dependencies**: A clean module structure with no runtime `require()` calls.
2.  **Reduces Code by ~40%**: From ~1,600 to ~900 lines by removing boilerplate and sharing logic.
3.  **Improves Type Safety**: Discriminated unions with type guards are more robust than `instanceof`, while factory functions ensure valid object creation.
4.  **Better Tree-Shaking**: Individual functions can be imported and bundled more efficiently.
5.  **Aligns with Project Style**: Creates a consistent functional architecture across the codebase.
6.  **Easier Testing**: Pure functions are simpler to unit test than class methods.
7.  **Explicit Immutability**: `readonly` interfaces make the immutable nature of the data clear.
8.  **No Prototype Manipulation**: Removes fragile `Object.setPrototypeOf` hacks.

### Negative

1.  **API Change**: The calling convention changes from `date.add(quantity)` to `add(date, quantity)`.
2.  **Migration Effort**: Estimated 2-3 days of focused refactoring work.
3.  **Test Updates**: All tests must be updated to use the new functional API.

### Trade-offs

The minor ergonomic change in API style is vastly outweighed by the architectural benefits. The functional style is more explicit about immutability, consistent with other FHIRPath operations, and easier to reason about and test.

## Appendix: Bad vs. Better Examples

**1. Module Cycle and API Coupling**
-   **Bad:**
    ```typescript
    // src/temporal.ts
    export class FHIRDateTime {
      add(q: TimeQuantity): FHIRDateTime {
        const { addToDateTime } = require('./temporal-arithmetic');
        return addToDateTime(this, q);
      }
    }
    ```
-   **Better:**
    ```typescript
    // src/temporal.ts
    export function add(dt: TemporalValue, q: TimeQuantity): TemporalValue { /* pure logic */ }

    // Some other file
    import { add, isFHIRDateTime } from '../temporal';
    if (isFHIRDateTime(l)) { result = add(l, timeQuantity); }
    ```

**2. Type Checking**
-   **Bad:**
    ```typescript
    const { FHIRDate } = await import('../temporal');
    const date = Object.setPrototypeOf(l, FHIRDate.prototype); // Prototype hack
    if (date instanceof FHIRDate) { /* ... */ }
    ```
-   **Better:**
    ```typescript
    import { isFHIRDate } from '../temporal';
    if (isFHIRDate(l)) {
      // l is now correctly typed as FHIRDate
    }
    ```

**3. Calendar Arithmetic**
-   **Bad (relies on host environment):**
    ```typescript
    const jsDate = new Date(year, month - 1, day);
    return new FHIRDate(jsDate.getFullYear(), jsDate.getMonth() + 1, jsDate.getDate());
    ```
-   **Better (pure and explicit):**
    ```typescript
    function _addDays(y: number, m: number, d: number, delta: number) {
      // explicit rollover math, no side effects
    }
    ({ year, month, day } = _addDays(year, month, day, Math.trunc(quantity.value)));
    ```

## Migration Strategy

### Critical Integration Points
Based on current codebase analysis, the following files will need updates:
- **Operations using temporal types**: 
  - `plus-operator.ts` - temporal arithmetic with quantities
  - `minus-operator.ts` - temporal arithmetic and differences
  - `is-operator.ts` - type checking with `instanceof`
  - `as-operator.ts` - type casting operations
  - `temporal-functions.ts` - now(), today(), timeOfDay() functions
- **Interpreter**: `interpreter.ts` - temporal literal parsing (lines 277, 453, 489)
- **Tests**: All temporal test files will need updating to use functional API

### Phase 1: Add New Implementation (Day 1)
-   Create the new `temporal.ts` file with interfaces, factory functions, type guards, and pure operation functions, ensuring behavior matches existing tests.
-   Update parser to create `TemporalLiteralNode` instead of generic `LiteralNode` for temporal values
-   Update interpreter to handle `TemporalLiteralNode` and create temporal objects once

### Phase 2: Update Consumers (Day 1-2)
-   Systematically update all consumer files (`/src/operations`, `/test`, etc.).
-   Replace `instanceof` checks and prototype hacks with `isFHIR...` type guards.
-   Replace all method calls (`.add()`, `.equals()`, etc.) with the new pure function calls (`add()`, `equals()`).
-   Remove ALL `parseTemporalLiteral` calls from operations - they'll receive ready-to-use temporal objects
-   Remove ALL `await import('../temporal')` dynamic imports from operations

### Phase 3: Remove Old Implementation (Day 2)
-   Delete the old class-based implementations from `temporal.ts`.
-   Delete the now-redundant `temporal-arithmetic.ts` file.
-   Ensure no `require()` calls related to temporal logic remain.

### Phase 4: Verify and Clean Up (Day 2-3)
-   Run the full test suite to confirm behavioral parity.
-   Update any remaining internal references.
-   Update public-facing documentation to reflect the new API.

## Alternatives Considered

-   **Fix Classes with Dependency Injection**: Rejected. Still leaves code duplication and architectural inconsistency.
-   **Abstract Base Class**: Rejected. Inheritance is inflexible and still requires a class-based model.
-   **Keep Current Implementation**: Rejected. The technical debt and architectural flaws are too significant to ignore.
-   **Add Brand Properties for Nominal Typing**: Considered adding `__brand` properties to prevent structural type compatibility issues. Rejected in favor of simpler discriminated unions with just `type` property, as this matches existing AST node patterns in the codebase and factory functions provide sufficient validation.

## Implementation Recommendations

### Priority Improvements
1. **Eliminate `require()` calls immediately**: Even before full refactoring, replace runtime `require()` with proper imports
2. **Add type guards**: Implement `isFHIRDate()`, `isFHIRDateTime()`, `isFHIRTime()` functions to replace `instanceof` checks
3. **Consolidate precision handling**: Extract precision logic to shared utilities
4. **Remove object reconstruction pattern**: The current pattern of checking `instanceof` and reconstructing objects is error-prone

### Performance Considerations
- The current approach of reconstructing temporal objects from plain objects on every operation is inefficient
- Type guards with discriminated unions will be faster than `instanceof` checks
- Pure functions will enable better optimization by the JavaScript engine

## References
- Code Reviews from Gemini, Claude, and Codex (2025-08-27)
- ADR-017: Original temporal values implementation decision
- FHIRPath Specification: Section 6.6 (Date/Time Arithmetic)
- Current implementation analysis (2025-08-27)