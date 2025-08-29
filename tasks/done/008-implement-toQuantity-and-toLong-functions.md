# Task 008: Implement toQuantity() and toLong() Functions

## Objective
Implement the final two missing FHIRPath functions: `toQuantity` and `toLong` to achieve 100% function coverage.

## Function Specifications

### toQuantity([unit : String]) : Quantity

Converts values to Quantity type according to FHIRPath specification §1.5.5.7.1.

**Behavior:**
- For single item collections:
  - Integer/Decimal → Quantity with default unit `'1'`
  - Quantity → returns as-is
  - String → parses if matches regex: `(?'value'(\+|-)?\d+(\.\d+)?)\s*('(?'unit'[^']+)'|(?'time'[a-zA-Z]+))?`
  - Boolean → `true` returns `1.0 '1'`, `false` returns `0.0 '1'`
  - Other types → empty result

- String format examples:
  - `'4 days'` → valid
  - `'10 \'mg[Hg]\''` → valid (UCUM unit in quotes)
  - `'1 \'wk\''` → valid (week)

- With unit argument:
  - Attempts conversion to specified UCUM unit
  - Returns converted quantity if possible
  - Returns empty if conversion not possible

- Calendar duration conversion factors:
  - `1 year` = `12 months` or `365 days`
  - `1 month` = `30 days`
  - `1 day` = `24 hours`
  - `1 hour` = `60 minutes`
  - `1 minute` = `60 seconds`
  - `1 second` = `1 's'`

**Error Conditions:**
- Multiple items in collection → error
- Empty collection → empty result

### toLong() : Long

Converts values to 64-bit Long integer type (STU feature) according to §1.5.5.3.3.

**Behavior:**
- For single item collections:
  - Integer/Long → returns as-is
  - String → converts if matches regex `(\+|-)?\d+` and within 64-bit bounds
  - Boolean → `true` returns 1, `false` returns 0
  - Other types → empty result

- 64-bit bounds: -9223372036854775808 to 9223372036854775807

**Error Conditions:**
- Multiple items in collection → error
- Empty collection → empty result
- String not matching pattern → empty result
- Number outside 64-bit bounds → empty result

## Implementation Plan

### Phase 1: toQuantity Implementation
- [ ] Create `operations/toQuantity-function.ts`
- [ ] Implement parsing logic:
  - [ ] Regex pattern for quantity strings
  - [ ] Handle Integer/Decimal/Boolean conversion
  - [ ] Parse unit from string format
  - [ ] Handle UCUM units in quotes
- [ ] Implement unit conversion (optional):
  - [ ] Calendar duration conversions
  - [ ] Basic UCUM conversions (if supported)
- [ ] Handle singleton validation
- [ ] Handle empty propagation

### Phase 2: toLong Implementation
- [ ] Create `operations/toLong-function.ts`
- [ ] Implement conversion logic:
  - [ ] Integer/Long passthrough
  - [ ] String parsing with regex validation
  - [ ] Boolean to number conversion
  - [ ] 64-bit bounds checking using BigInt
- [ ] Handle singleton validation
- [ ] Handle empty propagation

### Phase 3: Testing
- [ ] Create `test-cases/operations/conversion/toQuantity.json`
- [ ] Create `test-cases/operations/conversion/toLong.json`
- [ ] Port tests from fhirpath.js and XML suite

## Test Cases to Port

### toQuantity Tests (from fhirpath.js and XML)

Basic conversions:
```fhirpath
1.toQuantity() = 1 '1'                    // Integer to Quantity
1.0.toQuantity() = 1.0 '1'                // Decimal to Quantity
true.toQuantity() = 1.0 '1'               // Boolean true
false.toQuantity() = 0.0 '1'              // Boolean false
'1'.toQuantity() = 1 '1'                  // String integer
'1.0'.toQuantity() = 1.0 '1'              // String decimal
```

Quantity string parsing:
```fhirpath
'1 day'.toQuantity() = 1 'd'              // Calendar duration
'1 \'wk\''.toQuantity() = 1 'wk'          // UCUM week
'10 \'mg[Hg]\''.toQuantity()              // Complex UCUM unit
'4 days'.toQuantity() = 4 'd'             // Multiple units
'1 year'.toQuantity() ~ 1 'a'             // Year conversion
```

Unit conversion:
```fhirpath
'1 \'cm\''.toQuantity('mm').value = 10    // UCUM conversion
'1 \'wk\''.toQuantity('d') = 7 'd'        // Week to days
'1 \'cm\''.toQuantity('g')                // Invalid conversion → empty
```

Error cases:
```fhirpath
'some string'.toQuantity()                // Invalid format → empty
'1.a'.toQuantity()                         // Invalid number → empty
(5 | 6).toQuantity()                       // Multiple items → error
{}.toQuantity()                            // Empty → empty
```

### toLong Tests

Basic conversions:
```fhirpath
1.toLong() = 1                             // Integer to Long
'123'.toLong() = 123                       // String to Long
true.toLong() = 1                          // Boolean true
false.toLong() = 0                         // Boolean false
```

Boundary tests:
```fhirpath
'9223372036854775807'.toLong()            // Max 64-bit value
'-9223372036854775808'.toLong()           // Min 64-bit value
'9223372036854775808'.toLong()            // Overflow → empty
```

Error cases:
```fhirpath
'1.5'.toLong()                             // Decimal string → empty
'abc'.toLong()                             // Non-numeric → empty
1.5.toLong()                               // Decimal → empty
(1 | 2).toLong()                          // Multiple items → error
```

## Success Criteria
- Both functions correctly implement specification semantics
- All ported tests pass
- TypeScript compilation successful
- 100% function coverage achieved (80/80 functions)
- Documentation updated

## What Was Done

### Implementation Completed
- ✅ Created `src/operations/toQuantity-function.ts` with full implementation
- ✅ Created `src/operations/toLong-function.ts` with full implementation
- ✅ Registered both functions in operations/index.ts
- ✅ Fixed type detection to use `typeInfo.type` pattern

### toQuantity Implementation
- ✅ Regex pattern matching for quantity strings: `^(?<value>[+-]?\d+(?:\.\d+)?)\s*(?:'(?<quotedUnit>[^']+)'|(?<unquotedUnit>[a-zA-Z]+))?$`
- ✅ Type conversions: Integer/Decimal/Boolean/String/Quantity
- ✅ Calendar duration mapping (day→d, hour→h, etc.)
- ✅ Optional unit parameter with UCUM conversion support
- ✅ Calendar duration conversions (week→days, year→months, etc.)

### toLong Implementation
- ✅ 64-bit bounds checking using BigInt
- ✅ Type conversions: Integer/Long/Boolean/String
- ✅ Regex validation for integer strings: `^[+-]?\d+$`
- ✅ Proper bounds: -9223372036854775808 to 9223372036854775807

### Tests Created
- ✅ Created `test-cases/operations/conversion/toQuantity.json` with 26 tests
- ✅ Created `test-cases/operations/conversion/toLong.json` with 20 tests
- ✅ All 46 tests passing
- ✅ Tests cover basic conversions, boundary cases, error conditions

### Documentation Updated
- ✅ Updated `docs/implementation-status.md`
- ✅ Function coverage: 100% (80/80 functions implemented)
- ✅ Conversion Functions: 19/19 complete
- ✅ Marked as "All Functions Implemented! 🎉"

### Completion Date
2025-08-29

## Achievement Unlocked
**100% FHIRPath Function Coverage!** All 80 functions are now implemented and tested.

## Technical Considerations

### toQuantity Implementation Notes
1. **Regex Pattern**: Must handle both quoted UCUM units and unquoted calendar durations
2. **Unit Normalization**: Calendar durations (days, weeks, months, years) need special handling
3. **UCUM Support**: Implementation may return empty for unsupported unit conversions
4. **String Parsing**: Must handle spaces between value and unit correctly

### toLong Implementation Notes
1. **BigInt Usage**: Use BigInt for bounds checking to avoid JavaScript number precision issues
2. **Type Checking**: Must distinguish between Integer and Decimal types
3. **String Validation**: Strict regex matching for integer format only

## References
- FHIRPath Specification §1.5.5.7.1 (toQuantity)
- FHIRPath Specification §1.5.5.3.3 (toLong)
- UCUM specification for unit conversions
- Test cases from fhirpath.js: `5.5_conversion.yaml`
- Test cases from XML suite: `fhirpathlab-tests.xml`

## Notes
- These are the last two unimplemented functions
- toLong is marked as STU (Standard for Trial Use)
- Full UCUM implementation is not required - basic conversions are acceptable
- Focus on correctness over comprehensive unit conversion support