# ADR-017: Temporal Values Implementation

## Status
Proposed

## Context
FHIRPath requires sophisticated date/time handling with partial precision support, timezone awareness, and specific arithmetic rules that differ significantly from standard JavaScript Date objects. The current stub implementation needs comprehensive development.

## Decision

### Core Design Principles
1. **Immutable value objects** - All temporal operations return new instances
2. **Precision-first design** - Every value tracks its precision level explicitly
3. **Strict FHIRPath semantics** - Follow spec precisely, even when counterintuitive

### Implementation Approach

*Note: The current `src/temporal.ts` and `test/temporal.test.ts` are just exploratory examples. The actual implementation should be built from scratch following this ADR.*

### Proposed Architecture

```typescript
// Precision handling - unified approach with proper value mapping
interface PrecisionInfo {
  level: 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' | 'millisecond';
  value: number;  // FHIRPath precision value (4, 6, 8, 10, 12, 14, 17)
}

// Base interface for all temporal values
interface TemporalValue {
  readonly type: 'Date' | 'DateTime' | 'Time';
  readonly precision: PrecisionInfo;
  
  // Core operations
  equals(other: TemporalValue): boolean | null;      // null for different precision
  equivalent(other: TemporalValue): boolean;         // false for different precision
  compare(other: TemporalValue): -1 | 0 | 1 | null; // null if incomparable
  
  // String representation preserving precision
  toString(): string;
  toFHIRPathLiteral(): string;  // With @ prefix
  
  // Precision utilities
  getPrecisionValue(): number;
  withPrecision(precision: PrecisionInfo): TemporalValue;
}

// Concrete types with optional components based on precision
interface FHIRDate extends TemporalValue {
  readonly type: 'Date';
  readonly year: number;
  readonly month?: number;    // Present if precision >= month
  readonly day?: number;      // Present if precision >= day
  
  add(quantity: TimeQuantity): FHIRDate;
  subtract(quantity: TimeQuantity): FHIRDate;
  
  // Component extraction
  yearOf(): number;
  monthOf(): number | null;
  dayOf(): number | null;
}

interface FHIRDateTime extends TemporalValue {
  readonly type: 'DateTime';
  readonly year: number;
  readonly month?: number;
  readonly day?: number;
  readonly hour?: number;
  readonly minute?: number;
  readonly second?: number;
  readonly millisecond?: number;
  readonly timezoneOffset?: number;  // Minutes from UTC, undefined = naive
  
  add(quantity: TimeQuantity): FHIRDateTime;
  subtract(quantity: TimeQuantity): FHIRDateTime;
  
  // Component extraction
  yearOf(): number;
  monthOf(): number | null;
  dayOf(): number | null;
  hourOf(): number | null;
  minuteOf(): number | null;
  secondOf(): number | null;
  millisecondOf(): number | null;
  timezoneOffsetOf(): number | null;
  
  // Conversions
  dateOf(): FHIRDate;
  timeOf(): FHIRTime | null;
}

interface FHIRTime extends TemporalValue {
  readonly type: 'Time';
  readonly hour: number;
  readonly minute?: number;
  readonly second?: number;
  readonly millisecond?: number;
  
  add(quantity: TimeQuantity): FHIRTime;
  subtract(quantity: TimeQuantity): FHIRTime;
  
  // Component extraction
  hourOf(): number;
  minuteOf(): number | null;
  secondOf(): number | null;
  millisecondOf(): number | null;
}

// Time quantity for arithmetic
interface TimeQuantity {
  readonly value: number;
  readonly unit: 'year' | 'month' | 'week' | 'day' | 
                 'hour' | 'minute' | 'second' | 'millisecond';
  readonly isCalendarUnit: boolean;  // true for year/month/week/day
}

// Factory functions with precision inference
function createDate(
  year: number, 
  month?: number, 
  day?: number
): FHIRDate;

function createDateTime(
  year: number,
  month?: number,
  day?: number,
  hour?: number,
  minute?: number,
  second?: number,
  millisecond?: number,
  timezoneOffset?: number
): FHIRDateTime;

function createTime(
  hour: number,
  minute?: number,
  second?: number,
  millisecond?: number
): FHIRTime;

// Parser with precision detection
function parseTemporalLiteral(literal: string): FHIRDate | FHIRDateTime | FHIRTime;
```

### Key Implementation Requirements

1. **Precision Preservation in Arithmetic**
   - Convert quantity to target precision, truncate decimal portion
   - Result maintains original precision (never expands)
   - Example: `@2014 + 10 months` = `@2014` (not `@2014-10`)

2. **Dual Arithmetic Modes**
   - Calendar-based: years, months, weeks, days (respects calendar)
   - Definite-duration: hours, minutes, seconds, ms (fixed units)

### The Core Addition/Subtraction Algorithm

**The fundamental question for all temporal arithmetic: "Do I need to coerce the time-valued quantity?"**

```typescript
function add(temporal: TemporalValue, quantity: TimeQuantity): TemporalValue {
  // THE ONE QUESTION that determines everything
  if (temporal.precision < quantity.precision) {
    // Path A: Coerce quantity to match temporal's precision
    const coercedValue = coerceAndTruncate(quantity, temporal.precision);
    return simpleAdd(temporal, coercedValue);
  } else {
    // Path B: Regular calendar/clock arithmetic
    return calendarAdd(temporal, quantity);
  }
}
```

This single decision point determines whether we:
- **Coerce** (YES): Convert quantity to temporal's precision level, truncate decimals, simple add
- **Calendar** (NO): Use full calendar/clock arithmetic with all complexity

### Addition Algorithm Details for Date

The arithmetic strategy depends on the date's precision level:

#### Low Precision Date (Year) - Convert & Truncate Strategy
When date has Year precision, convert quantity to years and truncate:

```
@2020 + 12 months
  Step 1: Convert to years: 12 ÷ 12 = 1.0 years
  Step 2: Truncate decimal: 1 year
  Step 3: Add: 2020 + 1 = 2021
  Result: @2021 (Year precision maintained)

@2020 + 11 months
  Step 1: Convert to years: 11 ÷ 12 = 0.916... years
  Step 2: Truncate decimal: 0 years
  Step 3: Add: 2020 + 0 = 2020
  Result: @2020 (unchanged!)

@2020 + 364 days
  Step 1: Convert to years: 364 ÷ 365 = 0.997... years
  Step 2: Truncate decimal: 0 years
  Step 3: Add: 2020 + 0 = 2020
  Result: @2020 (unchanged!)
```

#### Medium Precision Date (Month) - Hybrid Strategy
When date has Month precision, use calendar math for years/months, convert & truncate for days:

```
@2020-01 + 25 months
  Step 1: Divide months: 25 ÷ 12 = 2 years + 1 month remainder
  Step 2: Add years: 2020 + 2 = 2022
  Step 3: Add months: 1 + 1 = 2
  Result: @2022-02 (Month precision, no day component)

@2020-01 + 45 days
  Step 1: Convert to months: 45 ÷ 30 = 1.5 months
  Step 2: Truncate decimal: 1 month
  Step 3: Add months: 1 + 1 = 2
  Result: @2020-02
```

#### High Precision Date (Day) - Full Calendar Arithmetic
When date has Day precision, use proper calendar arithmetic:

```
@2020-01-01 + 13 months
  Step 1: Divide months: 13 ÷ 12 = 1 year + 1 month remainder
  Step 2: Add years: 2020 + 1 = 2021
  Step 3: Add months: 1 + 1 = 2
  Step 4: Keep day: 01
  Result: @2021-02-01 (Day precision maintained)

@2020-02-01 + 1 month
  Step 1: Add to month: 2 + 1 = 3 (March)
  Step 2: Check validity: March 1st is valid
  Step 3: Keep day unchanged
  Result: @2020-03-01

@2020-01-31 + 1 month
  Step 1: Add to month: 1 + 1 = 2 (February)
  Step 2: Check validity: Feb 31st invalid
  Step 3: Adjust to last valid day: 29 (leap year)
  Result: @2020-02-29 (day component CHANGED for validity)

@2021-01-31 + 1 month  
  Step 1: Add to month: 1 + 1 = 2 (February)
  Step 2: Check validity: Feb 31st invalid
  Step 3: Adjust to last valid day: 28 (non-leap year)
  Result: @2021-02-28 (day component CHANGED for validity)

@2020-03-31 + 1 month
  Step 1: Add to month: 3 + 1 = 4 (April)
  Step 2: Check validity: April 31st invalid
  Step 3: Adjust to last valid day: 30
  Result: @2020-04-30 (day component CHANGED for validity)
```

**Important**: Calendar arithmetic can modify higher precision components (like day) to maintain calendar validity. This is NOT a precision rule - it's a calendar constraint. The day changes when necessary to land on a valid date, regardless of the quantity's precision being lower than the day component's precision.

### Addition Algorithm Details for DateTime

DateTime follows the same "coerce or calendar" decision, but supports more time units:

#### Low Precision DateTime (Year/Month) - Coerce Strategy

```
@2020T + 365 days
  Question: Year precision < Day precision? YES
  → Coerce: 365 days → 1 year (365÷365, truncate)
  → Add: 2020 + 1 = @2021T

@2020-01T + 48 hours  
  Question: Month precision < Hour precision? YES
  → Coerce: 48 hours → 2 days → 0 months (48÷24=2, 2÷30=0.066, truncate)
  → Add: 2020-01 + 0 = @2020-01T (unchanged!)
```

#### High Precision DateTime - Full Calendar/Clock Arithmetic

```
@2020-01-31T10:30:00 + 1 month
  Question: Second precision < Month precision? NO
  → Calendar: Add 1 month with adjustment
  → Result: @2020-02-29T10:30:00 (leap year adjustment)

@2020-12-31T23:30:00 + 45 minutes
  Question: Second precision < Minute precision? NO  
  → Clock: Add 45 minutes, overflow to next day
  → Result: @2021-01-01T00:15:00 (year rolled over)

@2020-01-01T10:30 + 90 seconds
  Question: Minute precision < Second precision? YES
  → Coerce: 90 seconds → 1 minute (90÷60=1.5, truncate to 1)
  → Add: 10:30 + 1 minute = @2020-01-01T10:31
```

#### DateTime with Timezone

```
@2020-01-01T10:30:00Z + 14 hours
  Question: Second precision < Hour precision? NO
  → Clock arithmetic: 10:30 + 14 hours = 00:30 next day
  → Result: @2020-01-02T00:30:00Z (UTC preserved)

@2020-01-01T10:30:00-05:00 + 1 day
  Question: Second precision < Day precision? NO
  → Calendar: Add 1 calendar day (not 24 hours!)
  → Result: @2020-01-02T10:30:00-05:00 (offset preserved)
```

### Addition Algorithm Details for Time

Time only supports definite-duration units (no calendar units):

#### Low Precision Time - Coerce Strategy

```
@T10 + 90 minutes
  Question: Hour precision < Minute precision? YES
  → Coerce: 90 minutes → 1 hour (90÷60=1.5, truncate)
  → Add: 10 + 1 = @T11

@T10:30 + 45 seconds
  Question: Minute precision < Second precision? YES
  → Coerce: 45 seconds → 0 minutes (45÷60=0.75, truncate)
  → Add: 10:30 + 0 = @T10:30 (unchanged!)

@T10 + 3700 seconds  
  Question: Hour precision < Second precision? YES
  → Coerce: 3700 seconds → 61 minutes → 1 hour (3700÷60÷60=1.027, truncate)
  → Add: 10 + 1 = @T11
```

#### High Precision Time - Clock Arithmetic

```
@T10:30:45 + 30 seconds
  Question: Second precision < Second precision? NO
  → Clock: 45 + 30 = 75 seconds = 1:15
  → Result: @T10:31:15

@T23:45:00 + 30 minutes
  Question: Second precision < Minute precision? NO
  → Clock: 23:45 + 30 minutes = 24:15 → wrap to 00:15
  → Result: @T00:15:00 (next day wrap)

@T10:30:45.500 + 750 milliseconds
  Question: Millisecond precision < Millisecond precision? NO
  → Clock: 500 + 750 = 1250ms = 1.250s
  → Result: @T10:30:46.250
```

### Precision Hierarchy Reference

For the coercion decision, here's the precision ranking:

```
Date/DateTime components:
  Year < Month < Day < Hour < Minute < Second < Millisecond

Time components:  
  Hour < Minute < Second < Millisecond

Time units in quantities:
  year < month < week/day < hour < minute < second < millisecond
```

Note: Week is treated as 7 days for arithmetic purposes.

#### General Algorithm Pattern

```typescript
function addToDate(date: Date, quantity: TimeQuantity): Date {
  const precision = date.precision;
  
  switch (precision) {
    case Year:
      // Convert everything to years, truncate, add
      const years = truncate(convertToYears(quantity));
      return { ...date, year: date.year + years };
      
    case Month:
      // Calendar math for years/months, convert & truncate for days
      if (quantity.unit >= Month) {
        return calendarAdd(date, quantity);
      } else {
        const months = truncate(convertToMonths(quantity));
        return calendarAdd(date, { value: months, unit: Month });
      }
      
    case Day:
      // Full calendar arithmetic for all units
      return calendarAdd(date, quantity);
  }
}
```

**Key Insight**: The date's precision determines the arithmetic strategy:
- Low precision → Convert & truncate
- High precision → Full calendar arithmetic
- Precision NEVER changes in the result

3. **Comparison Semantics**
   - `=` returns empty (`null`) for different precisions
   - `~` returns `false` for different precisions
   - `</>` compare component-wise, return empty if precisions differ

4. **Parser Implementation**
   - Support partial dates: `@2014`, `@2014-01`, `@2014-01-25`
   - Distinguish Date from DateTime: `@2014` vs `@2014T`
   - Handle timezone: `Z` or `(+|-)hh:mm`

5. **Validation**
   - Year range: 0001-9999
   - Month: 1-12
   - Day: Valid for month/year (leap year aware)
   - Time components: Standard ranges
   - Constraint: Month required if day present

## Alternatives Considered

1. **Use JavaScript Date/Temporal API**
   - Rejected: Can't represent partial dates, precision semantics differ

2. **Single Precision Enum**
   - Rejected: Date/DateTime/Time have different precision mappings

3. **Expand Precision on Arithmetic**
   - Rejected: Violates FHIRPath spec explicitly

## Consequences

### Positive
- Correct FHIRPath date/time semantics
- Clear separation of concerns
- Type-safe precision handling

### Negative
- Complex implementation compared to standard date libraries
- Counterintuitive precision preservation rules
- Significant work required for full implementation

## Implementation Roadmap

### Phase 1: Core Infrastructure
1. Define precision system and mapping
2. Create immutable value classes (FHIRDate, FHIRDateTime, FHIRTime)
3. Implement factory functions with automatic precision inference
4. Add toString() and toFHIRPathLiteral() with precision preservation

### Phase 2: Parser
1. Implement parseTemporalLiteral() with format validation
2. Support partial dates/times with precision detection
3. Handle timezone parsing for DateTime
4. Add error handling for invalid formats

### Phase 3: Arithmetic Operations
1. Implement precision-preserving addition
   - Convert & truncate strategy for low precision
   - Calendar arithmetic for high precision
   - Month-end adjustment logic
2. Implement subtraction (same rules as addition)
3. Add boundary calculation functions

### Phase 4: Comparisons
1. Implement equals() with null for different precisions
2. Implement equivalent() with false for different precisions
3. Implement compare() with component-wise comparison
4. Handle timezone-aware comparisons

### Phase 5: Utility Functions
1. Component extraction (yearOf, monthOf, etc.)
2. Type conversions (toDate, toDateTime, toTime)
3. Precision manipulation (withPrecision, lowBoundary, highBoundary)
4. Integration with existing FHIRPath system

## Testing Focus
- Leap year boundaries
- Month-end arithmetic
- Precision preservation (critical!)
- Timezone conversions
- Partial dates at all levels
- Empty vs false in comparisons
- Calendar vs definite duration differences