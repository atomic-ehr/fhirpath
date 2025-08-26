# FHIRPath Date/Time Types: Comprehensive Analysis

## 1. Core Types and Representation

### 1.1 Date Type
- **Range**: `@0001-01-01` to `@9999-12-31`
- **Precision**: 1 day step size
- **Literal format**: `@YYYY-MM-DD` where month and day are optional
- **Partial dates supported**: `@2014`, `@2014-01`, `@2014-01-25`
- **No timezone component**
- **Required**: Year must always be present
- **Constraint**: Month must be present if day is present

### 1.2 DateTime Type
- **Range**: `@0001-01-01T00:00:00.000` to `@9999-12-31T23:59:59.999`
- **Precision**: 1 millisecond step size  
- **Literal format**: `@YYYY-MM-DDThh:mm:ss.fff(+|-)hh:mm`
- **Partial datetime**: `@2014T`, `@2014-01T`, `@2014-01-01T`, `@2014-01-01T10:30`
- **Timezone**: Optional, using `Z` for UTC or `(+|-)hh:mm` for offset
- **Critical distinction**: The suffix `T` differentiates partial DateTime from Date
  - `@2014` = Date with year precision
  - `@2014T` = DateTime with year precision

### 1.3 Time Type
- **Range**: `@T00:00:00.000` to `@T23:59:59.999`
- **Precision**: 1 millisecond step size
- **Literal format**: `@Thh:mm:ss.fff`
- **No date component, no timezone**
- **Partial time**: `@T10:30` (hour and minute only)

## 2. Precision System

### 2.1 Precision Values
The `precision()` function returns the number of precision units:
- `@2014.precision()` = 4 (year only)
- `@2014-01.precision()` = 6 (year-month)  
- `@2014-01-01.precision()` = 8 (year-month-day)
- `@2014-01-01T10:30:00.000.precision()` = 17 (full datetime with ms)
- `@T10:30.precision()` = 4 (hour-minute)
- `@T10:30:00.000.precision()` = 9 (time with ms)

### 2.2 Precision Preservation in Arithmetic (CRITICAL)
**Arithmetic operations preserve the original precision and do NOT expand it.**

This is the most counterintuitive aspect of FHIRPath date/time arithmetic:

```fhirpath
@2012 + 10 months  // Result: @2012 (NOT @2012-10)
@2014 + 24 months  // Result: @2016 (NOT @2016-01)
@2014 + 23 months  // Result: @2015 (NOT @2015-11)
```

**Why this happens:**
1. The operation converts the time-valued quantity to match the date's precision
2. Decimal portions are **truncated** (not rounded!) at that precision level
3. `10 months` at year precision = 0 years (10/12 = 0.833... → 0)
4. `24 months` at year precision = 2 years (24/12 = 2.0 → 2)
5. `23 months` at year precision = 1 year (23/12 = 1.916... → 1)

**Truncation Examples with Different Precisions:**

```fhirpath
// Month precision - divides days by 30, truncates remainder
@2020-01 + 29 days  // 29÷30 = 0.96 → 0 months → @2020-01
@2020-01 + 30 days  // 30÷30 = 1.00 → 1 month  → @2020-02
@2020-01 + 32 days  // 32÷30 = 1.06 → 1 month  → @2020-02
@2020-01 + 59 days  // 59÷30 = 1.96 → 1 month  → @2020-02
@2020-01 + 60 days  // 60÷30 = 2.00 → 2 months → @2020-03
@2020-01 + 89 days  // 89÷30 = 2.96 → 2 months → @2020-03

// Year precision - divides days by 365, truncates remainder
@2020 + 364 days    // 364÷365 = 0.997 → 0 years → @2020
@2020 + 365 days    // 365÷365 = 1.000 → 1 year  → @2021
@2020 + 729 days    // 729÷365 = 1.997 → 1 year  → @2021
@2020 + 730 days    // 730÷365 = 2.000 → 2 years → @2022
```

**Standard Conversion Factors for Partial Dates:**
- 1 month = 30 days (for conversion only)
- 1 year = 365 days (for conversion only)
- 1 year = 12 months

These conversions are fixed and do NOT account for actual calendar variations.

### 2.3 Precision in Comparisons

#### Equality (`=`)
- Same precision: Normal comparison
- Different precision: Returns **empty** `{}`
- Seconds/milliseconds treated as single decimal precision

```fhirpath
@2012 = @2012           // true
@2012-01 = @2012        // {} (empty - different precisions)
@2012-01-01T10:30:31 = @2012-01-01T10:30  // {} (empty)
@2012-01-01T10:30:31.0 = @2012-01-01T10:30:31  // true
```

#### Equivalence (`~`)
- Different precision: Returns **false** (not empty)
- Otherwise same as equality

```fhirpath
@2012 ~ @2012           // true
@2012-01 ~ @2012        // false (different precisions)
```

#### Comparison (`<`, `>`, `<=`, `>=`)
- Component-wise comparison
- Different precision at comparison point: Returns **empty**

## 3. Arithmetic Operations

### 3.1 Two Arithmetic Modes

#### Calendar-based (years, months, weeks, days)
- Respects calendar semantics
- Handles leap years, variable month lengths
- Integer math only (decimal portions ignored)

Examples:
- `@2024-01-31 + 1 month` → `@2024-02-29` (last day of month)
- `@2020-02-29 + 1 year` → `@2021-02-28` (no Feb 29 in 2021)

#### Definite-duration (hours, minutes, seconds, milliseconds)
- Fixed duration units
- Each 24-hour block = 1 calendar day
- Seconds/milliseconds support decimal precision

### 3.2 Calendar Unit Rules

| Unit | Behavior |
|------|----------|
| **year** | Added to year component; invalid dates use last day of month |
| **month** | Divided by 12, integer portion to years, remainder to months |
| **week** | Multiplied by 7, added as days |
| **day** | Added respecting month/year boundaries |
| **hour** | Each 24 hours = 1 calendar day |
| **minute** | Each 60 minutes = 1 hour |
| **second** | Each 60 seconds = 1 minute |
| **millisecond** | Each 1000 ms = 1 second |

### 3.3 Supported Operations

#### Addition (`+`)
- `Date + Quantity[time-unit]` → Date
- `DateTime + Quantity[time-unit]` → DateTime
- `Time + Quantity[time-unit]` → Time

Allowed units:
- Date: years, months, weeks, days
- DateTime: years, months, weeks, days, hours, minutes, seconds, milliseconds
- Time: hours, minutes, seconds, milliseconds

#### Subtraction (`-`)
- `Date - Quantity[time-unit]` → Date
- `DateTime - Quantity[time-unit]` → DateTime
- `Time - Quantity[time-unit]` → Time

**Note**: Date - Date is NOT supported in FHIRPath (no duration calculation between dates)

## 4. Functions

### 4.1 Current Date/Time Functions
- `now()` → DateTime with timezone
- `today()` → Date
- `timeOfDay()` → Time
- **Deterministic**: Must return same value throughout expression evaluation

### 4.2 Component Extraction Functions
Return Integer or empty if component not present:

- `yearOf()` - Extract year from Date/DateTime
- `monthOf()` - Extract month from Date/DateTime  
- `dayOf()` - Extract day from Date/DateTime
- `hourOf()` - Extract hour from DateTime/Time
- `minuteOf()` - Extract minute from DateTime/Time
- `secondOf()` - Extract second from DateTime/Time
- `millisecondOf()` - Extract millisecond from DateTime/Time
- `timezoneOffsetOf()` - Extract timezone offset as Decimal from DateTime
- `dateOf()` - Extract Date from DateTime (preserves precision)
- `timeOf()` - Extract Time from DateTime

Example with partial dates:
```fhirpath
@2012.monthOf()     // {} (empty - month not present)
@2012-03.monthOf()  // 3
```

### 4.3 Conversion Functions

#### Type Conversions
- `toDate()` - Convert to Date
- `toDateTime()` - Convert to DateTime  
- `toTime()` - Convert to Time

#### String Conversion - toString()
**Critical**: `toString()` preserves the original precision level.

Format patterns:
- **Date**: `YYYY-MM-DD`
- **DateTime**: `YYYY-MM-DDThh:mm:ss.fff(+|-)hh:mm`
- **Time**: `hh:mm:ss.fff`

Examples with partial dates/times:
```fhirpath
@2014.toString()              // "2014" (year only)
@2014-03.toString()           // "2014-03" (year-month)
@2014-03-15.toString()        // "2014-03-15" (full date)
@2014T.toString()             // "2014T" (partial DateTime with year only)
@2014-01T.toString()          // "2014-01T" (partial DateTime with year-month)
@2014-01-01T10:30.toString() // "2014-01-01T10:30" (no seconds)
@T10:30.toString()            // "10:30" (partial time)
```

**The result only includes components up to the precision level of the value.**

#### Conversion Testing
- `convertsToDate()` - Test if convertible to Date
- `convertsToDateTime()` - Test if convertible to DateTime
- `convertsToTime()` - Test if convertible to Time

Conversion rules:
- DateTime → Date: Extracts date portion
- Date → DateTime: Creates DateTime with empty time components (not zeros)
- String → Date/DateTime/Time: Must match exact format

### 4.4 Boundary Functions

- `lowBoundary([precision])` - Minimum value at precision
- `highBoundary([precision])` - Maximum value at precision

Default precisions if not specified:
- Date: 4 (day level)
- DateTime: 17 (millisecond level)
- Time: 9 (millisecond level)

Examples:
```fhirpath
@2014.lowBoundary(6)   // @2014-01
@2014.highBoundary(6)  // @2014-12
@2014-01-01T08.lowBoundary(17)  // @2014-01-01T08:00:00.000
@2014-01-01T08.highBoundary(17) // @2014-01-01T08:59:59.999
```

## 5. Timezone Handling

### 5.1 DateTime Timezone States
- **Timezone-naive**: No offset specified
- **Timezone-aware**: Has UTC (`Z`) or explicit offset `(+|-)hh:mm`

### 5.2 Comparison Rules
- Both values must be in same timezone state
- If both have timezones, converted to common timezone
- Implementation decides default timezone (typically server local)

Examples:
```fhirpath
@2017-11-05T01:30:00.0-04:00 = @2017-11-05T00:30:00.0-05:00  // true (same instant)
@2017-11-05T01:30:00.0-04:00 > @2017-11-05T01:15:00.0-05:00  // false
```

## 6. Critical Implementation Quirks

### 6.1 Precision Never Expands
The most important and counterintuitive rule: operations maintain original precision.

### 6.2 Empty vs False
- Equality with different precision: empty `{}`
- Equivalence with different precision: false
- Comparison with incomparable values: empty `{}`

### 6.3 Partial Date/Time Semantics
- Missing components are truly absent, not zero
- Operations respect what's actually specified

### 6.4 Calendar Duration vs Definite Duration
- `1 year` ≠ `365 days` (calendar vs fixed)
- `1 year` ~ `1 'a'` (equivalent but not equal)
- Cannot mix calendar and definite durations above seconds

### 6.5 No Date Difference Operation
FHIRPath does not support `Date - Date` to get duration

### 6.6 Seconds/Milliseconds Special Case
Treated as single decimal precision for comparison:
```fhirpath
@T10:30:31.0 = @T10:30:31   // true (same precision)
@T10:30:31.5 = @T10:30:31   // false (different values)
```

## 7. Design Principles for Implementation

### 7.1 Core Classes Needed
```typescript
interface TemporalValue {
  precision: PrecisionLevel;
  compare(other: TemporalValue): number | null;
  equals(other: TemporalValue): boolean | null;
  equivalent(other: TemporalValue): boolean;
  add(quantity: TimeQuantity): TemporalValue;
  subtract(quantity: TimeQuantity): TemporalValue;
}

class FHIRDate implements TemporalValue {
  year: number;
  month?: number;
  day?: number;
  precision: DatePrecision;
}

class FHIRDateTime implements TemporalValue {
  year: number;
  month?: number;
  day?: number;
  hour?: number;
  minute?: number;
  second?: number;
  millisecond?: number;
  timezoneOffset?: number; // in minutes, undefined = naive
  precision: DateTimePrecision;
}

class FHIRTime implements TemporalValue {
  hour: number;
  minute?: number;
  second?: number;
  millisecond?: number;
  precision: TimePrecision;
}
```

### 7.2 Key Implementation Requirements

1. **Immutability**: All operations return new instances
2. **Precision tracking**: Every value knows its precision level
3. **Null-safe operations**: Handle empty/missing components correctly
4. **Calendar awareness**: Implement proper calendar arithmetic
5. **Timezone handling**: Support naive and aware datetimes
6. **Validation**: Strict format and range validation
7. **Performance**: Cache computed values, lazy conversions

### 7.3 Integration Points
- Boxing/unboxing system needs temporal type support
- Parser provides parsed literals with precision info
- Type system already has signatures defined
- Operators need temporal-aware implementations

## 8. Common Pitfalls to Avoid

1. **Don't expand precision**: `@2012 + 10 months` stays `@2012`
2. **Don't treat missing as zero**: Missing components are absent
3. **Don't ignore timezone state**: Both values must match
4. **Don't allow Date - Date**: Not supported in FHIRPath
5. **Don't mix duration types**: Calendar vs definite above seconds
6. **Don't forget decimal truncation**: Calendar math uses integers
7. **Don't assume comparison results**: Can be true, false, or empty

## 9. Testing Considerations

Critical test cases:
- Leap year boundaries (Feb 29)
- Month-end arithmetic (Jan 31 + 1 month)
- Precision preservation in all operations
- Timezone conversions and DST boundaries
- Partial date/time at all precision levels
- Empty propagation rules
- Calendar vs definite duration differences
- Overflow/underflow at range boundaries

## 10. Notes on Current Implementation Status

The FHIRPath TypeScript implementation has:
- ✅ Complete lexer/parser support for date/time literals
- ✅ Type system signatures for all operations
- ❌ No actual date/time value classes
- ❌ No arithmetic implementation (only signatures)
- ❌ No comparison implementation (uses generic JS comparison)
- ❌ No date/time functions implemented
- ❌ No timezone handling
- ❌ No precision tracking in runtime values

This represents a significant implementation gap that needs comprehensive development to support FHIRPath date/time semantics correctly.