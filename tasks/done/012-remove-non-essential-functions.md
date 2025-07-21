# Task 012: Temporarily Remove Non-Essential Functions for Refactoring

## Priority: HIGH

## Motivation

During our architecture refactoring (Tasks 012-13), we need a smaller, more manageable codebase that:
- Reduces test execution time from minutes to seconds
- Simplifies migration to new patterns
- Allows faster iteration on core architectural improvements
- Maintains all essential FHIRPath functionality
- Keeps complex iterator functions to properly stress-test new architecture
- Preserves debugging capabilities (trace, check)

By temporarily removing ~20-25 specialized functions, we can focus on getting the core architecture right without being distracted by edge cases and external dependencies.

**Note**: We will DELETE these functions rather than comment them out, as we can always restore them from git history when needed.

## Functions to Remove

### 1. Complex Type System Functions
- `conformsTo()` - Requires FHIR profiles
- `memberOf()` - Requires ValueSet infrastructure  
- `subsumes()` - Complex terminology hierarchies

### 2. All Date/Time Functions
- Conversion checks: `convertsToDateTime()`, `convertsToDate()`, `convertsToTime()`
- Conversions: `toDateTime()`, `toDate()`, `toTime()`
- System time: `now()`, `today()`, `timeOfDay()`
- Any date arithmetic functions

### 3. Advanced String Functions
- `matches(regex)` - Regex engine dependency
- `replaceMatches(regex, replacement)` - Regex replacement
- `encode(encoding)` - Base64 encoding
- `decode(encoding)` - Base64 decoding

### 4. Advanced Math Functions
- `exp()` - Exponential
- `ln()` - Natural logarithm
- `log(base)` - Logarithm with base
- `power(exponent)` - Exponentiation
- `truncate()` - Truncation
- `ceiling()` - Ceiling
- `floor()` - Floor

### 5. Quantity Functions (if implemented)
- Any FHIR Quantity-specific operations
- Unit conversions

## Functions to KEEP

### Essential Utility Functions
- ✅ `trace(name)` - Critical for debugging
- ✅ `check(condition, message)` - Assertions
- ✅ `aggregate(expression, init?)` - Complex iteration
- ✅ `now()` → Consider keeping if used in tests

### All Core Functions
- All operators (arithmetic, logical, comparison, navigation)
- All iterators (where, select, repeat)
- All collection operations (union, combine, intersect, exclude)
- All existence functions (empty, exists, count, etc.)
- All subsetting (first, last, take, skip, etc.)
- Basic math (abs, round, sqrt)
- Basic type operations (type, is, as, ofType)
- Basic conversions (toString, toInteger, toDecimal, toBoolean)
- Control flow (iif, defineVariable)

### String Functions (for experiments)
- All basic string functions remain for testing new patterns

## Implementation Steps

1. **Delete function registrations and implementations**:
   - Remove entire function definitions from respective files
   - Remove corresponding FunctionRegistry.register() calls
   - Clean up any unused imports

2. **Delete related tests**:
   - Remove test files for deleted functions
   - Remove individual test cases from mixed test files
   - Update test imports

3. **Create restoration documentation**:
   - Create `REMOVED_FUNCTIONS.md` with:
     - List of all removed functions
     - Git commit hash before removal
     - Command to restore: `git checkout <hash> -- <file>`

4. **Clean up files**:
   - Remove any helper functions only used by deleted functions
   - Remove unused type definitions
   - Remove unused validator functions

5. **Verify core functionality**:
   - Run all remaining tests
   - Ensure no broken dependencies
   - Confirm faster test execution

## Test Cleanup

1. Delete entire test files for removed function categories
2. Remove individual tests from shared test files
3. Update any test utilities that were only for removed functions
4. Document test count before/after removal

## Restoration Plan

After refactoring is complete:
1. Use git to restore functions by category:
   ```bash
   git checkout <commit-before-removal> -- src/interpreter/functions/date-functions.ts
   ```
2. Apply new architectural patterns to restored functions
3. Restore and update corresponding tests
4. Verify each category works with new architecture

## Success Criteria
- [x] ~20-25 functions temporarily removed (24 functions removed)
- [x] All iterator functions still work
- [x] trace() and check() still available
- [x] Test execution time significantly reduced
- [x] Clear documentation for restoration (REMOVED_FUNCTIONS.md)
- [x] No breaking changes to kept functions (all tests pass)

## Estimated Time
2-3 hours