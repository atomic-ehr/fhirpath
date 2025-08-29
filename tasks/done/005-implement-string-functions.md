# Task 005: Implement Remaining String Functions

## Objective
Implement the 5 remaining string manipulation functions in FHIRPath to achieve 100% string function coverage.

## Functions to Implement

### 1. lastIndexOf(substring: String) : Integer
- Returns the 0-based index of the last occurrence of substring within the input string
- Returns -1 if substring is not found
- Should handle empty string cases
- Implementation file: `operations/lastIndexOf-function.ts`

### 2. matches(regex: String) : Boolean
- Returns true if the input string matches the given regular expression
- Note: Has 6 test files already referencing it, needs investigation
- Implementation file: `operations/matches-function.ts`

### 3. matchesFull(regex: String) : Boolean
- Returns true if the entire input string matches the given regular expression (anchored match)
- Similar to matches() but requires full string match (implicit ^$ anchors)
- Implementation file: `operations/matchesFull-function.ts`

### 4. replaceMatches(regex: String, replacement: String) : String
- Replaces all matches of the regex pattern with the replacement string
- Should support regex capture groups in replacement string
- Implementation file: `operations/replaceMatches-function.ts`

### 5. toChars() : collection
- Splits the input string into a collection of single-character strings
- Empty string returns empty collection
- Implementation file: `operations/toChars-function.ts`

## Implementation Steps

### Phase 1: Research and Test Collection
- [x] Search for existing test references for `matches()` function (6 files mention it)
- [x] Extract test cases from fhirpath.js tests:
  - [x] Check `fhirpath.js/test/cases/*.yaml` for string function tests
  - [x] Look for `lastIndexOf`, `matches`, `matchesFull`, `replaceMatches`, `toChars` tests
- [x] Extract test cases from XML test suite if available:
  - [x] Check for `.xml` test files with string function tests
  - [x] Convert XML test cases to JSON format

### Phase 2: Implementation
- [x] Implement `lastIndexOf()` function
  - [x] Create `operations/lastIndexOf-function.ts`
  - [x] Register in `registry.ts`
  - [x] Handle edge cases (empty string, not found, multiple occurrences)
- [x] Implement `matches()` function
  - [x] Create `operations/matches-function.ts`
  - [x] Register in `registry.ts`
  - [x] Handle regex validation and errors
- [x] Implement `matchesFull()` function
  - [x] Create `operations/matchesFull-function.ts`
  - [x] Register in `registry.ts`
  - [x] Ensure full string matching semantics
- [x] Implement `replaceMatches()` function
  - [x] Create `operations/replaceMatches-function.ts`
  - [x] Register in `registry.ts`
  - [x] Support capture group replacements ($1, $2, etc.)
- [x] Implement `toChars()` function
  - [x] Create `operations/toChars-function.ts`
  - [x] Register in `registry.ts`
  - [x] Handle Unicode characters properly

### Phase 3: Testing
- [x] Create test file `test-cases/operations/string/lastIndexOf.json`
- [x] Create test file `test-cases/operations/string/matches.json` (or update existing)
- [x] Create test file `test-cases/operations/string/matchesFull.json`
- [x] Create test file `test-cases/operations/string/replaceMatches.json`
- [x] Create test file `test-cases/operations/string/toChars.json`
- [x] Run all tests with `bun run test`
- [x] Verify with interpreter tool for each function

### Phase 4: Documentation and Validation
- [x] Update `docs/implementation-status.md` to mark functions as implemented
- [x] Run `bun tsc --noEmit` to check for TypeScript errors
- [x] Test with complex expressions combining new functions with existing ones
- [x] Verify empty propagation behavior for each function

## Success Criteria
- All 5 string functions implemented and passing tests
- Test coverage includes edge cases from fhirpath.js and XML test suites
- No TypeScript errors
- Documentation updated to reflect 100% string function implementation

## Notes
- The `matches()` function already has test references, investigate why it's marked as not implemented
- Regex functions should use JavaScript's RegExp with appropriate error handling
- Consider performance implications for large strings
- Ensure consistent empty/null handling across all string functions

## Completion Summary

**Completed:** 2025-08-29

### What Was Done
1. **Implemented all 5 string functions:**
   - `lastIndexOf()` - Returns the last occurrence index of a substring
   - `matches()` - Tests if string matches a regex pattern (partial match)
   - `matchesFull()` - Tests if string fully matches a regex pattern (anchored)
   - `replaceMatches()` - Replaces all regex matches with substitution
   - `toChars()` - Splits string into array of single characters

2. **Created comprehensive test files:**
   - Each function has its own test file in `test-cases/operations/string/`
   - Tests cover edge cases, error conditions, and Unicode support
   - All tests are passing

3. **Technical Implementation Details:**
   - Used JavaScript's native RegExp with 'us' flags (unicode + dotAll)
   - Proper error handling for invalid regex patterns
   - Support for capture groups in replaceMatches ($1, $2, etc.)
   - Unicode-aware character splitting in toChars using Array.from()

4. **Documentation Updates:**
   - Updated `docs/implementation-status.md` to reflect 100% string function coverage
   - String functions now 14/14 implemented (was 9/14)
   - Overall function implementation increased from 79% to 85%

### Test Results
- All new function tests passing
- All existing tests still passing (4208 tests total)
- TypeScript compilation successful with no errors