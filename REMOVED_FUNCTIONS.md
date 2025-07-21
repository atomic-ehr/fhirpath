# Removed Functions for Refactoring

**Removal Date**: 2025-07-21
**Commit Before Removal**: b147b092716995b23ac0fd307af961c30b6f1ec3
**Task**: 012-remove-non-essential-functions.md

## Purpose
These functions were temporarily removed to create a smaller, more manageable codebase during architecture refactoring. They can be restored from git history once the core refactoring is complete.

## Restoration Commands

### Type System Functions
```bash
# Restore conformsTo, memberOf, subsumes
git checkout b147b092716995b23ac0fd307af961c30b6f1ec3 -- src/interpreter/functions/type-functions.ts
```

### Date/Time Functions
```bash
# Restore all date/time functions
git checkout b147b092716995b23ac0fd307af961c30b6f1ec3 -- src/interpreter/functions/utility-functions.ts
```

### Advanced String Functions
```bash
# Restore matches, replaceMatches, encode, decode
git checkout b147b092716995b23ac0fd307af961c30b6f1ec3 -- src/interpreter/functions/string-functions.ts
```

### Advanced Math Functions
```bash
# Restore exp, ln, log, power, truncate, ceiling, floor
git checkout b147b092716995b23ac0fd307af961c30b6f1ec3 -- src/interpreter/functions/math-functions.ts
```

## Removed Functions List

### Type System (4 functions)
- `conformsTo(type)` - Check conformance to FHIR profiles
- `memberOf(valueSet)` - Check membership in ValueSet
- `subsumes(code)` - Terminology subsumption
- `subsumedBy(code)` - Reverse terminology subsumption

### Date/Time (9 functions)
- `convertsToDateTime()` - Check if convertible to DateTime
- `convertsToDate()` - Check if convertible to Date
- `convertsToTime()` - Check if convertible to Time
- `toDateTime()` - Convert to DateTime
- `toDate()` - Convert to Date
- `toTime()` - Convert to Time
- `now()` - Current datetime
- `today()` - Current date
- `timeOfDay()` - Current time

### Advanced String (4 functions)
- `matches(regex)` - Regex matching
- `replaceMatches(regex, replacement)` - Regex replacement
- `encode(encoding)` - Base64 encoding
- `decode(encoding)` - Base64 decoding

### Advanced Math (7 functions)
- `exp()` - Exponential function
- `ln()` - Natural logarithm
- `log(base)` - Logarithm with base
- `power(exponent)` - Power function
- `truncate()` - Truncate to integer
- `ceiling()` - Round up
- `floor()` - Round down

## Total: 24 functions removed

## Test Files Affected
- `test/interpreter/functions/type-functions.test.ts`
- `test/interpreter/functions/date-functions.test.ts` (if exists)
- `test/interpreter/functions/string-functions.test.ts` (partial)
- `test/interpreter/functions/math-functions.test.ts` (partial)
- `test/interpreter/functions/utility-functions.test.ts` (partial)