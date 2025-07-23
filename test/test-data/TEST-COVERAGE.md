# Test Coverage Summary

This document summarizes the test cases extracted from `interpreter.test.ts` and organized into JSON test files.

## New Test Files Created

1. **three-valued-logic.json** - Tests for FHIRPath three-valued logic with empty collections
   - `true and {}` → []
   - `false and {}` → false
   - `{} or {}` → []
   - `true or {}` → true

2. **functions/conversion.json** - Type conversion functions
   - toString(), toInteger(), toDecimal(), toBoolean()
   - Failed conversions returning empty

3. **functions/existence.json** - Existence and aggregate functions
   - empty(), exists(), count(), all()
   - Boolean aggregates: allTrue(), anyTrue(), anyFalse(), allFalse()
   - distinct(), isDistinct()

4. **functions/subsetting.json** - Subsetting operations
   - first(), last(), tail()
   - skip(n), take(n)
   - single()

5. **functions/set-operations.json** - Set operations
   - intersect(), exclude()
   - union() vs combine() (duplicates handling)

6. **operators/type-checking.json** - Type checking operators
   - `is` operator for primitive types
   - `is` operator for FHIR resource types
   - ofType() function for filtering

7. **functions/conditionals.json** - Conditional functions
   - iif() function with lazy evaluation
   - Empty treated as false

8. **functions/define-variable.json** - Variable definition
   - defineVariable() function
   - Chained defineVariable calls

## Updated Existing Test Files

1. **operators/comparison.json**
   - Added collection equality tests (order sensitivity)
   - Empty comparison tests
   - Singleton conversion in equality

2. **operators/string.json**
   - Empty operand handling in concatenation

3. **variables/variables.json**
   - $this in select expressions
   - $this in nested contexts
   - %context variable

4. **operators/index.json**
   - Indexer operator on property navigation
   - Out of bounds handling

## Test Cases Not Yet Migrated

Some test cases that require error handling (like `single()` with multiple items) were not included as they require special handling for error cases.