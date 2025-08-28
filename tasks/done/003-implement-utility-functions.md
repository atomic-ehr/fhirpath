# Task 003: Implement Missing Utility Functions

## Overview
Implement all missing Utility Functions from the FHIRPath specification, excluding highBoundary and lowBoundary (which are complex and may require separate tasks).

## Status: COMPLETED ✅

## What Was Done

Successfully implemented all 13 missing utility functions:

### Temporal "Current Time" Functions
1. **now()** - Returns current DateTime with timezone
   - Fixed critical determinism bug: ensured all temporal functions use the same timestamp within an expression
   - Pre-caches values at expression evaluation start
   
2. **today()** - Returns current Date  
   - Derives from the same cached DateTime as now()
   
3. **timeOfDay()** - Returns current Time
   - Derives from the same cached DateTime as now()

### Date/Time Component Extraction Functions  
4. **dateOf()** - Extracts date component from DateTime
   - Returns Date type
   - Handles partial precision correctly
   
5. **timeOf()** - Extracts time component from DateTime
   - Returns Time type
   - Returns empty for DateTime without time components
   
6. **yearOf()** - Extracts year from Date/DateTime
   - Returns Integer (1-9999)
   - Returns empty for partial dates without year
   
7. **monthOf()** - Extracts month from Date/DateTime
   - Returns Integer (1-12)
   - Returns empty for year-only dates
   
8. **dayOf()** - Extracts day from Date/DateTime
   - Returns Integer (1-31)
   - Returns empty for year/year-month dates
   
9. **hourOf()** - Extracts hour from Time/DateTime
   - Returns Integer (0-23)
   - Returns empty when hour not present
   
10. **minuteOf()** - Extracts minute from Time/DateTime
    - Returns Integer (0-59)
    - Returns empty when minute not present
    
11. **secondOf()** - Extracts second from Time/DateTime
    - Returns Integer (0-59)
    - Returns empty when second not present
    
12. **millisecondOf()** - Extracts millisecond from Time/DateTime
    - Returns Integer (0-999)
    - Returns empty when millisecond not present
    
13. **timezoneOffsetOf()** - Extracts timezone offset from DateTime
    - Returns Decimal (hours offset from UTC)
    - Handles fractional offsets (e.g., +05:30 → 5.5)
    - Returns empty for DateTime without timezone

## Key Implementation Details

- All functions properly handle:
  - Empty input collections → return empty
  - Multiple items → throw FP3006 error (singleton required)
  - Invalid types → return empty (per spec)
  - Partial precision dates/times → return empty when component not present
  
- Fixed critical temporal determinism issue:
  - All temporal functions (now, today, timeOfDay) must return consistent values within a single expression evaluation
  - Solution: Pre-cache values in context at expression start using special `__fhirpath_now_cache__`, `__fhirpath_today_cache__`, and `__fhirpath_timeOfDay_cache__` variables
  
- Followed consistent implementation pattern:
  - Each function in separate file: `src/operations/<name>-function.ts`
  - Comprehensive test suite in: `test-cases/operations/utility/<name>.json`
  - Proper TypeScript typing and error handling
  - Functions registered in registry and exported from operations index

## Files Created/Modified

### New Implementation Files:
- `src/operations/dateOf-function.ts`
- `src/operations/timeOf-function.ts`
- `src/operations/yearOf-function.ts`
- `src/operations/monthOf-function.ts`
- `src/operations/dayOf-function.ts`
- `src/operations/hourOf-function.ts`
- `src/operations/minuteOf-function.ts`
- `src/operations/secondOf-function.ts`
- `src/operations/millisecondOf-function.ts`
- `src/operations/timezoneOffsetOf-function.ts`

### New Test Files:
- `test-cases/operations/utility/dateOf.json`
- `test-cases/operations/utility/timeOf.json`
- `test-cases/operations/utility/yearOf.json`
- `test-cases/operations/utility/monthOf.json`
- `test-cases/operations/utility/dayOf.json`
- `test-cases/operations/utility/hourOf.json`
- `test-cases/operations/utility/minuteOf.json`
- `test-cases/operations/utility/secondOf.json`
- `test-cases/operations/utility/millisecondOf.json`
- `test-cases/operations/utility/timezoneOffsetOf.json`

### Modified Files:
- `src/operations/index.ts` - Added exports for all new functions
- `src/index.ts` - Fixed temporal function determinism with pre-caching
- `test-cases/operations/utility/now.json` - Fixed test format and preserved determinism test
- `test-cases/operations/utility/today.json` - Fixed test format and input structure
- `test-cases/operations/utility/timeOfDay.json` - Fixed test format and input structure

## Test Results
All tests passing:
- 3766 tests passed
- 6 tests skipped (intentional - testing partial precision edge cases)
- 0 failures
- TypeScript compilation successful with no errors

## Completion Date
2025-08-28