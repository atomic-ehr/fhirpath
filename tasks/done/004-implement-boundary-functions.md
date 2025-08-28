# Task 004: Implement highBoundary and lowBoundary Functions (Temporal Types Only)

## Overview
Implement `highBoundary()` and `lowBoundary()` functions for Date, DateTime, and Time types only.
Decimal support will be handled separately as it requires different logic.

## Specification Summary

### highBoundary([precision: Integer])
- Returns the greatest possible value of the input to the specified precision
- For temporal types, fills in maximum values for unspecified components

### lowBoundary([precision: Integer])
- Returns the least possible value of the input to the specified precision
- For temporal types, fills in minimum values for unspecified components

### Common Requirements
- Input must be a singleton (single value)
- Empty input returns empty
- Multiple items throws error (FP3006)
- If precision > max implementation precision, return empty
- If no precision specified, use type's default max precision:
  - Date: 8 (day precision)
  - DateTime: 17 (millisecond precision) 
  - Time: 9 (millisecond precision)

## Implementation Plan

### Phase 1: Add Helper Functions to temporal.ts
Create internal helper functions for boundary calculations:

```typescript
// In src/temporal.ts

// Helper to get min/max values for temporal components
export function getTemporalBoundaries(precision: DateTimePrecisionLevel): {
  month: { min: number; max: number };
  day: { min: number; max: number };
  hour: { min: number; max: number };
  minute: { min: number; max: number };
  second: { min: number; max: number };
  millisecond: { min: number; max: number };
  timezoneOffset?: { min: number; max: number };
}

// Calculate low boundary for Date
export function getDateLowBoundary(date: FHIRDate, precision?: number): FHIRDate | null

// Calculate high boundary for Date  
export function getDateHighBoundary(date: FHIRDate, precision?: number): FHIRDate | null

// Calculate low boundary for DateTime
export function getDateTimeLowBoundary(dateTime: FHIRDateTime, precision?: number): FHIRDateTime | null

// Calculate high boundary for DateTime
export function getDateTimeHighBoundary(dateTime: FHIRDateTime, precision?: number): FHIRDateTime | null

// Calculate low boundary for Time
export function getTimeLowBoundary(time: FHIRTime, precision?: number): FHIRTime | null

// Calculate high boundary for Time
export function getTimeHighBoundary(time: FHIRTime, precision?: number): FHIRTime | null
```

### Phase 2: Write Unit Tests for temporal.ts Helpers
Create `test/temporal-boundaries.test.ts`:

```typescript
describe('Temporal Boundary Functions', () => {
  describe('Date boundaries', () => {
    it('should calculate low boundary for year-only date', () => {
      const date = createDate(2014);
      // Default precision 8 (day)
      const result = getDateLowBoundary(date);
      expect(result).toEqual(createDate(2014, 1, 1));
      
      // With month precision (6)
      const result2 = getDateLowBoundary(date, 6);
      expect(result2).toEqual(createDate(2014, 1));
    });
    
    it('should calculate high boundary for year-only date', () => {
      const date = createDate(2014);
      // Default precision 8 (day)
      const result = getDateHighBoundary(date);
      expect(result).toEqual(createDate(2014, 12, 31));
      
      // With month precision (6)
      const result2 = getDateHighBoundary(date, 6);
      expect(result2).toEqual(createDate(2014, 12));
    });
    
    // Test leap year handling for February
    it('should handle leap years for high boundary', () => {
      const date = createDate(2020, 2); // February 2020 (leap year)
      const result = getDateHighBoundary(date, 8);
      expect(result?.day).toBe(29);
      
      const date2 = createDate(2021, 2); // February 2021 (non-leap)
      const result2 = getDateHighBoundary(date2, 8);
      expect(result2?.day).toBe(28);
    });
  });
  
  describe('DateTime boundaries', () => {
    it('should calculate low boundary for DateTime with timezone', () => {
      const dt = createDateTime(2014, 1, 1, 8, undefined, undefined, undefined, -420); // -07:00
      
      // Default precision 17 (millisecond)
      const result = getDateTimeLowBoundary(dt);
      expect(result).toEqual(
        createDateTime(2014, 1, 1, 8, 0, 0, 0, 840) // +14:00 (max positive offset)
      );
      
      // With minute precision (12)
      const result2 = getDateTimeLowBoundary(dt, 12);
      expect(result2).toEqual(
        createDateTime(2014, 1, 1, 8, 0, undefined, undefined, -420)
      );
    });
    
    it('should calculate high boundary for DateTime with timezone', () => {
      const dt = createDateTime(2014, 1, 1, 8, undefined, undefined, undefined, -420);
      
      // Default precision 17 (millisecond)
      const result = getDateTimeHighBoundary(dt);
      expect(result).toEqual(
        createDateTime(2014, 1, 1, 8, 59, 59, 999, -720) // -12:00 (max negative offset)
      );
    });
    
    it('should handle DateTime without timezone', () => {
      const dt = createDateTime(2014, 1, 1, 8);
      
      const low = getDateTimeLowBoundary(dt);
      expect(low?.timezoneOffset).toBeUndefined();
      expect(low?.minute).toBe(0);
      expect(low?.second).toBe(0);
      expect(low?.millisecond).toBe(0);
      
      const high = getDateTimeHighBoundary(dt);
      expect(high?.timezoneOffset).toBeUndefined();
      expect(high?.minute).toBe(59);
      expect(high?.second).toBe(59);
      expect(high?.millisecond).toBe(999);
    });
  });
  
  describe('Time boundaries', () => {
    it('should calculate boundaries for partial time', () => {
      const time = createTime(10, 30);
      
      // Low boundary with default precision
      const low = getTimeLowBoundary(time);
      expect(low).toEqual(createTime(10, 30, 0, 0));
      
      // High boundary with default precision
      const high = getTimeHighBoundary(time);
      expect(high).toEqual(createTime(10, 30, 59, 999));
    });
  });
  
  describe('Invalid precision handling', () => {
    it('should return null for precision > max', () => {
      const date = createDate(2014);
      expect(getDateLowBoundary(date, 9)).toBeNull(); // Date max is 8
      expect(getDateHighBoundary(date, 9)).toBeNull();
      
      const time = createTime(10, 30);
      expect(getTimeLowBoundary(time, 10)).toBeNull(); // Time max is 9
      expect(getTimeHighBoundary(time, 10)).toBeNull();
      
      const dt = createDateTime(2014);
      expect(getDateTimeLowBoundary(dt, 18)).toBeNull(); // DateTime max is 17
      expect(getDateTimeHighBoundary(dt, 18)).toBeNull();
    });
    
    it('should return null for negative precision', () => {
      const date = createDate(2014);
      expect(getDateLowBoundary(date, -1)).toBeNull();
      expect(getDateHighBoundary(date, -1)).toBeNull();
    });
  });
});
```

### Phase 3: Implement Functions
Create two new files:

#### src/operations/lowBoundary-function.ts
```typescript
import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { box, unbox } from '../boxing';
import { isFHIRDate, isFHIRDateTime, isFHIRTime, 
         getDateLowBoundary, getDateTimeLowBoundary, getTimeLowBoundary } from '../temporal';
import { Errors } from '../errors';

export const lowBoundaryEvaluator: FunctionEvaluator = async (input, context, args) => {
  // lowBoundary() takes optional precision parameter
  if (args.length > 1) {
    throw Errors.wrongArgumentCount('lowBoundary', '0 or 1', args.length);
  }
  
  // Empty input returns empty
  if (input.length === 0) {
    return { value: [], context };
  }
  
  // Multiple items throws error
  if (input.length > 1) {
    throw Errors.singletonRequired('lowBoundary', input.length);
  }
  
  const boxedValue = input[0];
  const value = unbox(boxedValue);
  
  // Get precision if provided
  let precision: number | undefined;
  if (args.length === 1) {
    const precisionArg = args[0];
    if (precisionArg.length !== 1) {
      throw Errors.singletonRequired('lowBoundary precision', precisionArg.length);
    }
    const precisionValue = unbox(precisionArg[0]);
    if (typeof precisionValue !== 'number' || !Number.isInteger(precisionValue)) {
      throw Errors.typeMismatch('lowBoundary precision', 'Integer', typeof precisionValue);
    }
    precision = precisionValue;
  }
  
  // Handle Date
  if (isFHIRDate(value)) {
    const result = getDateLowBoundary(value, precision);
    if (!result) {
      return { value: [], context };
    }
    return { value: [box(result, { type: 'Date', singleton: true })], context };
  }
  
  // Handle DateTime
  if (isFHIRDateTime(value)) {
    const result = getDateTimeLowBoundary(value, precision);
    if (!result) {
      return { value: [], context };
    }
    return { value: [box(result, { type: 'DateTime', singleton: true })], context };
  }
  
  // Handle Time
  if (isFHIRTime(value)) {
    const result = getTimeLowBoundary(value, precision);
    if (!result) {
      return { value: [], context };
    }
    return { value: [box(result, { type: 'Time', singleton: true })], context };
  }
  
  // For Decimal types (not implemented in this phase)
  if (typeof value === 'number') {
    // TODO: Implement Decimal boundary logic
    throw new Error('lowBoundary for Decimal not yet implemented');
  }
  
  // Invalid type returns empty
  return { value: [], context };
};
```

#### src/operations/highBoundary-function.ts
(Similar structure to lowBoundary)

### Phase 4: Integration Tests
Create test files based on fhirpath.js tests:

#### test-cases/operations/utility/lowBoundary.json
```json
{
  "description": "Tests for lowBoundary() function",
  "tests": [
    {
      "name": "Date year-only with default precision",
      "expression": "@2014.lowBoundary()",
      "input": [{}],
      "expected": ["@2014-01-01"]
    },
    {
      "name": "Date year-only with month precision",
      "expression": "@2014.lowBoundary(6)",
      "input": [{}],
      "expected": ["@2014-01"]
    },
    {
      "name": "Date year-month with day precision",
      "expression": "@2014-03.lowBoundary(8)",
      "input": [{}],
      "expected": ["@2014-03-01"]
    },
    {
      "name": "DateTime with hour only, default precision",
      "expression": "@2014-01-01T08.lowBoundary()",
      "input": [{}],
      "expected": ["@2014-01-01T08:00:00.000"]
    },
    {
      "name": "DateTime with timezone, millisecond precision",
      "expression": "@2014-01-01T08+08:00.lowBoundary(17)",
      "input": [{}],
      "expected": ["@2014-01-01T08:00:00.000+08:00"]
    },
    {
      "name": "DateTime without timezone, adjusts to max positive offset",
      "expression": "@2014-01-01T08.lowBoundary(17)",
      "input": [{}],
      "expected": ["@2014-01-01T08:00:00.000+14:00"]
    },
    {
      "name": "Time with hour and minute",
      "expression": "@T10:30.lowBoundary()",
      "input": [{}],
      "expected": ["@T10:30:00.000"]
    },
    {
      "name": "Time with second precision",
      "expression": "@T10:30.lowBoundary(7)",
      "input": [{}],
      "expected": ["@T10:30:00"]
    },
    {
      "name": "Invalid precision returns empty",
      "expression": "@2014.lowBoundary(100)",
      "input": [{}],
      "expected": []
    },
    {
      "name": "Negative precision returns empty",
      "expression": "@2014.lowBoundary(-1)",
      "input": [{}],
      "expected": []
    },
    {
      "name": "Empty input returns empty",
      "expression": "{}.lowBoundary()",
      "input": [{}],
      "expected": []
    },
    {
      "name": "Multiple items throws error",
      "expression": "(@2014 | @2015).lowBoundary()",
      "input": [{}],
      "error": {
        "type": "Error",
        "code": "FP3006"
      }
    }
  ]
}
```

#### test-cases/operations/utility/highBoundary.json
```json
{
  "description": "Tests for highBoundary() function",
  "tests": [
    {
      "name": "Date year-only with default precision",
      "expression": "@2014.highBoundary()",
      "input": [{}],
      "expected": ["@2014-12-31"]
    },
    {
      "name": "Date year-only with month precision",
      "expression": "@2014.highBoundary(6)",
      "input": [{}],
      "expected": ["@2014-12"]
    },
    {
      "name": "Date February in leap year",
      "expression": "@2020-02.highBoundary(8)",
      "input": [{}],
      "expected": ["@2020-02-29"]
    },
    {
      "name": "Date February in non-leap year",
      "expression": "@2021-02.highBoundary(8)",
      "input": [{}],
      "expected": ["@2021-02-28"]
    },
    {
      "name": "DateTime with hour only, default precision",
      "expression": "@2014-01-01T08.highBoundary()",
      "input": [{}],
      "expected": ["@2014-01-01T08:59:59.999"]
    },
    {
      "name": "DateTime with timezone",
      "expression": "@2014-01-01T08:05-05:00.highBoundary(17)",
      "input": [{}],
      "expected": ["@2014-01-01T08:05:59.999-05:00"]
    },
    {
      "name": "DateTime without timezone, adjusts to max negative offset",
      "expression": "@2014-01-01T08.highBoundary(17)",
      "input": [{}],
      "expected": ["@2014-01-01T08:59:59.999-12:00"]
    },
    {
      "name": "Time with hour and minute",
      "expression": "@T10:30.highBoundary()",
      "input": [{}],
      "expected": ["@T10:30:59.999"]
    },
    {
      "name": "Time with minute precision",
      "expression": "@T10:30.highBoundary(5)",
      "input": [{}],
      "expected": ["@T10:30"]
    },
    {
      "name": "Invalid precision returns empty",
      "expression": "@T10:30.highBoundary(10)",
      "input": [{}],
      "expected": []
    }
  ]
}
```

### Phase 5: Edge Cases and Special Considerations

#### Timezone Offset Rules (Critical!)
Confirmed by both fhirpath.js tests and XML test cases (fhirpathlab-tests.xml):

1. **lowBoundary with DateTime without timezone**:
   - Adjusts to maximum positive offset: +14:00
   - This gives the earliest possible instant
   - Example: `@2014-01-01T08.lowBoundary(17)` → `@2014-01-01T08:00:00.000+14:00`

2. **highBoundary with DateTime without timezone**:
   - Adjusts to maximum negative offset: -12:00
   - This gives the latest possible instant
   - Example: `@2014-01-01T08.highBoundary(17)` → `@2014-01-01T08:00:59.999-12:00`

3. **DateTime with existing timezone**:
   - Preserve the existing timezone offset
   - Only fill in missing time components
   - Example: `@2014-01-01T08:05+08:00.lowBoundary(17)` → `@2014-01-01T08:05:00.000+08:00`

#### Leap Year Handling
- Must correctly calculate days in February (28 or 29)
- Use proper leap year calculation: divisible by 4, except centuries unless divisible by 400

#### Month Day Calculation
- Must handle varying days per month (30, 31, 28/29 for February)
- Use a proper days-in-month function

#### Precision Mapping
```
Precision Value -> Components to include:
4  -> year
6  -> year, month  
8  -> year, month, day
10 -> year, month, day, hour (DateTime only)
12 -> year, month, day, hour, minute (DateTime only)
14 -> year, month, day, hour, minute, second (DateTime only)
17 -> year, month, day, hour, minute, second, millisecond (DateTime only)

For Time:
4  -> hour
5  -> hour, minute
7  -> hour, minute, second
9  -> hour, minute, second, millisecond
```

## Test Coverage Requirements
1. Unit tests for all temporal boundary helper functions
2. Integration tests covering all spec examples
3. Port relevant tests from:
   - fhirpath.js test suite (fhir-r5.yaml, fhir-r4.yaml)
   - XML test cases (spec/fhirpathlab-tests/fhirpathlab-tests.xml)
4. Edge cases: leap years, month boundaries, timezone handling
5. Error cases: invalid precision, multiple inputs, wrong types

## Success Criteria
- [ ] All unit tests pass for temporal boundary helpers
- [ ] All integration tests pass for lowBoundary function
- [ ] All integration tests pass for highBoundary function
- [ ] Correctly handles timezone offset adjustments
- [ ] Properly calculates month boundaries (including leap years)
- [ ] Returns empty for invalid precision values
- [ ] Throws appropriate errors for multiple inputs

## Notes
- Decimal boundary logic will be implemented separately as it uses different algorithms
- Quantity types inherit from their value type (Decimal in most cases)
- Focus on correctness over performance initially
- Ensure immutability of all temporal values

## References
- FHIRPath Spec §1.5.10.4 (lowBoundary)
- FHIRPath Spec §1.5.10.5 (highBoundary)
- fhirpath.js test suite: fhir-r5.yaml (LowBoundary and HighBoundary groups)