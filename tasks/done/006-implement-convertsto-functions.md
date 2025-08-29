# Task 006: Implement convertsTo* Functions

## Objective
Implement all 9 `convertsTo*` functions in FHIRPath that test whether values can be converted to specific types.

## Functions to Implement

### 1. convertsToBoolean() : Boolean
- Tests if the input value can be safely converted to a Boolean
- Returns true if conversion would succeed, false otherwise
- Empty collection returns empty
- Implementation file: `operations/convertsToBoolean-function.ts`

### 2. convertsToDate() : Boolean
- Tests if the input value can be safely converted to a Date
- Returns true for valid date strings (YYYY-MM-DD format)
- Returns true if already a Date
- Implementation file: `operations/convertsToDate-function.ts`

### 3. convertsToDateTime() : Boolean
- Tests if the input value can be safely converted to a DateTime
- Returns true for valid datetime strings (ISO 8601 format)
- Returns true if already a DateTime
- Implementation file: `operations/convertsToDateTime-function.ts`

### 4. convertsToDecimal() : Boolean
- Tests if the input value can be safely converted to a Decimal
- Returns true for numeric strings, integers, and existing decimals
- Implementation file: `operations/convertsToDecimal-function.ts`

### 5. convertsToInteger() : Boolean
- Tests if the input value can be safely converted to an Integer
- Returns true for integer strings and decimals that are whole numbers
- Implementation file: `operations/convertsToInteger-function.ts`

### 6. convertsToLong() : Boolean
- Tests if the input value can be safely converted to a Long
- Similar to convertsToInteger but for Long type
- Implementation file: `operations/convertsToLong-function.ts`

### 7. convertsToQuantity() : Boolean
- Tests if the input value can be safely converted to a Quantity
- Returns true for quantity strings (e.g., "10 mg", "5.5 km")
- Implementation file: `operations/convertsToQuantity-function.ts`

### 8. convertsToString() : Boolean
- Tests if the input value can be safely converted to a String
- Returns true for most primitive types
- Implementation file: `operations/convertsToString-function.ts`

### 9. convertsToTime() : Boolean
- Tests if the input value can be safely converted to a Time
- Returns true for valid time strings (HH:MM:SS format)
- Implementation file: `operations/convertsToTime-function.ts`

## Implementation Steps

### Phase 1: Research and Test Collection
- [ ] Search for existing test references in the codebase
- [ ] Extract test cases from fhirpath.js tests:
  - [ ] Check `fhirpath.js/test/cases/*.yaml` for convertsTo* function tests
  - [ ] Look specifically in type conversion test files
  - [ ] Document expected behavior for each type conversion
- [ ] Extract test cases from XML test suite:
  - [ ] Search for convertsTo* tests in `.xml` files
  - [ ] Check `spec/fhirpathlab-tests/fhirpathlab-tests.xml`
  - [ ] Convert XML test cases to JSON format
- [ ] Review existing to* conversion functions for consistency:
  - [ ] Study `toBoolean`, `toInteger`, `toDecimal`, `toString` implementations
  - [ ] Understand validation logic that can be reused

### Phase 2: Core Implementation
- [ ] Create shared validation utilities:
  - [ ] Extract common validation logic from existing to* functions
  - [ ] Create helper functions for date/time validation
  - [ ] Create helper for quantity parsing validation
- [ ] Implement `convertsToBoolean()`:
  - [ ] Create `operations/convertsToBoolean-function.ts`
  - [ ] Test strings 'true', 'false', 't', 'f', 'yes', 'no', 'y', 'n', '1', '0'
  - [ ] Test numeric values 1, 0
- [ ] Implement `convertsToInteger()`:
  - [ ] Create `operations/convertsToInteger-function.ts`
  - [ ] Validate integer strings (no decimal point)
  - [ ] Check decimals are whole numbers
- [ ] Implement `convertsToDecimal()`:
  - [ ] Create `operations/convertsToDecimal-function.ts`
  - [ ] Validate numeric strings
  - [ ] Handle scientific notation
- [ ] Implement `convertsToString()`:
  - [ ] Create `operations/convertsToString-function.ts`
  - [ ] Most primitives can convert to string
  - [ ] Complex objects cannot
- [ ] Implement `convertsToDate()`:
  - [ ] Create `operations/convertsToDate-function.ts`
  - [ ] Validate YYYY-MM-DD format
  - [ ] Check DateTime can convert to Date
- [ ] Implement `convertsToDateTime()`:
  - [ ] Create `operations/convertsToDateTime-function.ts`
  - [ ] Validate ISO 8601 format
  - [ ] Handle timezone information
- [ ] Implement `convertsToTime()`:
  - [ ] Create `operations/convertsToTime-function.ts`
  - [ ] Validate HH:MM:SS[.FFF] format
  - [ ] Extract time from DateTime
- [ ] Implement `convertsToQuantity()`:
  - [ ] Create `operations/convertsToQuantity-function.ts`
  - [ ] Parse quantity strings with units
  - [ ] Validate UCUM units if applicable
- [ ] Implement `convertsToLong()`:
  - [ ] Create `operations/convertsToLong-function.ts`
  - [ ] Similar to convertsToInteger
  - [ ] May need to handle larger number ranges

### Phase 3: Registration and Integration
- [ ] Export all functions from `operations/index.ts`
- [ ] Verify automatic registration in registry
- [ ] Test each function with interpreter tool
- [ ] Ensure proper error handling for multiple items

### Phase 4: Testing
- [ ] Create test file `test-cases/operations/type-conversion/convertsToBoolean.json`
- [ ] Create test file `test-cases/operations/type-conversion/convertsToInteger.json`
- [ ] Create test file `test-cases/operations/type-conversion/convertsToDecimal.json`
- [ ] Create test file `test-cases/operations/type-conversion/convertsToString.json`
- [ ] Create test file `test-cases/operations/type-conversion/convertsToDate.json`
- [ ] Create test file `test-cases/operations/type-conversion/convertsToDateTime.json`
- [ ] Create test file `test-cases/operations/type-conversion/convertsToTime.json`
- [ ] Create test file `test-cases/operations/type-conversion/convertsToQuantity.json`
- [ ] Create test file `test-cases/operations/type-conversion/convertsToLong.json`
- [ ] Port all relevant tests from fhirpath.js
- [ ] Port all relevant tests from XML test suite
- [ ] Add edge cases for each type
- [ ] Test empty propagation behavior

### Phase 5: Documentation and Validation
- [ ] Update `docs/implementation-status.md`
- [ ] Run `bun tsc --noEmit` for TypeScript validation
- [ ] Run full test suite with `bun run test`
- [ ] Test combined expressions (e.g., `where(convertsToInteger()).select(toInteger())`)
- [ ] Document any deviations from spec

## Success Criteria
- All 9 convertsTo* functions implemented and passing tests
- Test coverage includes cases from both fhirpath.js and XML test suites
- Functions correctly return Boolean values (not perform conversions)
- Empty propagation works correctly
- Error handling for multiple items
- No TypeScript errors
- Documentation updated

## Technical Notes

### Conversion Rules Reference
Based on FHIRPath specification and existing to* functions:

**Boolean conversion accepts:**
- Booleans: true, false
- Strings: 'true', 'false', 't', 'f', 'yes', 'no', 'y', 'n', '1', '0'
- Numbers: 1, 0

**Integer conversion accepts:**
- Integers
- Strings that parse to integers (no decimal point)
- Decimals that are whole numbers

**Decimal conversion accepts:**
- Decimals
- Integers
- Numeric strings (including scientific notation)

**String conversion accepts:**
- Most primitive types
- Not complex objects or resources

**Date/DateTime/Time conversion accepts:**
- Proper format strings
- Existing temporal types that can be converted

**Quantity conversion accepts:**
- Quantity objects
- Strings in format "number [unit]"

### Implementation Pattern
Each convertsTo* function should:
1. Check for empty input (return empty)
2. Check for multiple items (throw error)
3. Extract and validate the single value
4. Return boxed Boolean result
5. Never throw errors for invalid conversions (return false instead)

### Relationship to to* Functions
The convertsTo* functions should use the same validation logic as their corresponding to* functions, but return a Boolean instead of performing the conversion. Consider extracting shared validation logic to avoid duplication.

## References
- FHIRPath Specification: Section on Type Conversion
- Existing implementations: toBoolean, toInteger, toDecimal, toString, toDate, toDateTime, toTime
- Test sources: fhirpath.js/test/cases/*.yaml, spec/fhirpathlab-tests/*.xml

## Completion Summary

**Completed:** 2025-08-29

### What Was Done

1. **Implemented 6 new convertsTo* functions:**
   - `convertsToBoolean()` - Tests if value can convert to Boolean
   - `convertsToInteger()` - Tests if value can convert to Integer
   - `convertsToDecimal()` - Tests if value can convert to Decimal
   - `convertsToString()` - Tests if value can convert to String  
   - `convertsToQuantity()` - Tests if value can convert to Quantity
   - `convertsToLong()` - Tests if value can convert to Long

2. **Reused 3 existing implementations:**
   - `convertsToDate()` - Already in temporal-functions.ts
   - `convertsToDateTime()` - Already in temporal-functions.ts
   - `convertsToTime()` - Already in temporal-functions.ts

3. **Implementation Details:**
   - All functions follow consistent pattern: check empty, check singleton, validate type, return Boolean
   - Reused validation logic from corresponding to* functions
   - Proper handling of all edge cases and type combinations
   - Support for BigInt validation in convertsToLong for 64-bit bounds

4. **Test Coverage:**
   - Created comprehensive test files for all 6 new functions
   - Each test file includes positive cases, negative cases, edge cases, and error conditions
   - All tests passing (total: 4301 tests)

5. **Documentation Updates:**
   - Updated implementation-status.md
   - Conversion functions now 17/19 implemented (89%)
   - Overall function implementation increased from 85% to 96%

### Technical Notes
- Functions correctly return Boolean values (test conversion possibility, don't perform it)
- Empty propagation working correctly
- Error handling for multiple items working as expected
- TypeScript compilation successful with no errors

### Remaining Conversion Functions
Only 2 conversion functions remain unimplemented:
- `toLong` - Converts value to Long type
- `toQuantity` - Converts value to Quantity type