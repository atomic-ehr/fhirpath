# ADR-007: UCUM Library Integration for Quantity Support

## Status
Proposed

## Context

FHIRPath specification requires support for quantity literals and operations, including:
- Quantity literals: `5 'mg'`, `100 '[degF]'`, `2.5 'kg'`
- Calendar duration units: `1 year`, `4 days`
- Quantity arithmetic: addition, subtraction, multiplication, division
- Quantity comparison: equality, less than, greater than
- Unit conversion for compatible units

Our current implementation lacks quantity support. The `@atomic-ehr/ucum` library provides:
- UCUM unit parsing and validation
- Unit conversion capabilities
- Quantity arithmetic operations
- Dimensional analysis
- Support for special units (Celsius, logarithmic units)

## Decision

We will integrate `@atomic-ehr/ucum` library to implement FHIRPath quantity support with the following approach:

### 1. Lexer Enhancement

Modify the lexer to recognize quantity literals as a distinct token type:
- Add `TokenType.QUANTITY` for patterns like `number 'unit'`
- Keep calendar duration units as identifier tokens (e.g., `1 year`)
- Preserve backward compatibility for existing number/string tokens

### 2. Parser Enhancement

Update the parser to handle quantity construction:
- In `parsePrimary()`, detect NUMBER followed by STRING pattern
- For calendar units, detect NUMBER followed by calendar duration identifier
- Create a new `QuantityNode` AST node type:
  ```typescript
  interface QuantityNode extends BaseASTNode {
    type: NodeType.Quantity;
    value: number;
    unit: string;
    isCalendarUnit?: boolean;
  }
  ```

### 3. Type System Integration

Add Quantity to FHIRPath type system:
- Update `TypeName` to include `'Quantity'`
- Add quantity type checking in analyzer
- Support quantity in operation signatures

### 4. Interpreter Integration

Use UCUM library for quantity operations:
- Create `QuantityValue` wrapper around UCUM's `Quantity` interface
- Implement quantity arithmetic using UCUM's add/subtract/multiply/divide
- Handle unit conversion for comparisons
- Support both UCUM units and calendar duration units

### 5. Operation Implementation

Update existing operators to support quantities:
- Arithmetic operators (+, -, *, /)
- Comparison operators (=, !=, <, >, <=, >=)
- Conversion functions (toQuantity)
- String representation (toString)

## Implementation Details

### Quantity Value Representation

```typescript
interface QuantityValue {
  value: number;
  unit: string;
  // Lazy-initialized UCUM quantity for performance
  _ucumQuantity?: ucum.Quantity;
}
```

### Calendar Duration Mapping

Map FHIRPath calendar units to UCUM equivalents:
```typescript
const CALENDAR_TO_UCUM: Record<string, string> = {
  'year': 'a',      // annum
  'month': 'mo',    // month
  'week': 'wk',     // week
  'day': 'd',       // day
  'hour': 'h',      // hour
  'minute': 'min',  // minute
  'second': 's',    // second
  'millisecond': 'ms' // millisecond
};
```

### Error Handling

- Invalid units: Return empty collection per FHIRPath spec
- Incompatible dimensions: Return empty for operations
- Special unit arithmetic: Follow UCUM restrictions

## Consequences

### Benefits
- Full FHIRPath quantity support
- Proper unit conversion and dimensional analysis
- Reuse of well-tested UCUM implementation
- Support for complex unit expressions

### Drawbacks
- Additional dependency on UCUM library
- Slightly increased bundle size
- Performance overhead for quantity operations

### Migration Path
1. Implement basic quantity parsing without breaking existing tests
2. Add quantity operations incrementally
3. Provide feature flag for quantity support if needed

## Alternatives Considered

1. **Custom UCUM Implementation**: Build our own minimal UCUM parser
   - Rejected: Complex to implement correctly, especially unit conversion

2. **String-based Quantities**: Store quantities as strings, defer parsing
   - Rejected: Would require parsing on every operation

3. **External Service**: Use UCUM validation/conversion service
   - Rejected: Performance concerns, offline requirements

## References
- [FHIRPath Quantity Specification](http://hl7.org/fhirpath/#quantity)
- [UCUM Specification](https://ucum.org/ucum.html)
- [@atomic-ehr/ucum documentation](https://github.com/atomic-ehr/ucum)