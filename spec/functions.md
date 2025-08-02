# FHIRPath Functions Reference

This document provides a comprehensive reference of all FHIRPath functions as defined in the specification, along with their implementation status in this TypeScript implementation.

## Implementation Summary

- **Total Functions in Spec**: 82
- **Implemented**: 45
- **Not Implemented**: 37
- **Implementation Coverage**: 55%

## Functions by Category

### 1. Existence Functions (§1.5.1)

| Function | Signature | Return Type | Description | Status |
|----------|-----------|-------------|-------------|---------|
| empty | `empty()` | Boolean | Returns true if the input collection is empty | ✅ Implemented |
| exists | `exists([criteria: expression])` | Boolean | Returns true if the input collection has any elements (optionally filtered by criteria) | ✅ Implemented |
| all | `all(criteria: expression)` | Boolean | Returns true if criteria evaluates to true for every element in the input collection | ✅ Implemented |
| allTrue | `allTrue()` | Boolean | Takes a collection of Boolean values and returns true if all items are true | ✅ Implemented |
| anyTrue | `anyTrue()` | Boolean | Returns true if any items in the Boolean collection are true | ✅ Implemented |
| allFalse | `allFalse()` | Boolean | Returns true if all items in the Boolean collection are false | ✅ Implemented |
| anyFalse | `anyFalse()` | Boolean | Returns true if any items in the Boolean collection are false | ✅ Implemented |
| subsetOf | `subsetOf(other: collection)` | Boolean | Returns true if input collection is a subset of other collection | ✅ Implemented |
| supersetOf | `supersetOf(other: collection)` | Boolean | Returns true if input collection is a superset of other collection | ✅ Implemented |
| count | `count()` | Integer | Returns the integer count of items in the input collection | ✅ Implemented |
| distinct | `distinct()` | collection | Returns collection with duplicate values removed | ✅ Implemented |
| isDistinct | `isDistinct()` | Boolean | Returns true if all elements in the collection are distinct | ✅ Implemented |

### 2. Filtering and Projection Functions (§1.5.2)

| Function | Signature | Return Type | Description | Status |
|----------|-----------|-------------|-------------|---------|
| where | `where(criteria: expression)` | collection | Returns collection containing only elements for which criteria evaluates to true | ✅ Implemented |
| select | `select(projection: expression)` | collection | Evaluates projection expression for each item and flattens results into output collection | ✅ Implemented |
| repeat | `repeat(projection: expression)` | collection | Applies projection expression repeatedly until no new elements are returned | ❌ Not Implemented |
| ofType | `ofType(type: type-specifier)` | collection | Returns collection filtered to only items of the specified type | ❌ Not Implemented |

### 3. Subsetting Functions (§1.5.3)

| Function | Signature | Return Type | Description | Status |
|----------|-----------|-------------|-------------|---------|
| [index] | `[index: Integer]` | collection | Returns collection with only the index-th item (0-based) | ✅ Implemented (as operator) |
| single | `single()` | collection | Returns single item if collection has exactly one item, error if multiple | ✅ Implemented |
| first | `first()` | collection | Returns collection containing only the first item | ✅ Implemented |
| last | `last()` | collection | Returns collection containing only the last item | ✅ Implemented |
| tail | `tail()` | collection | Returns collection containing all but the first item | ✅ Implemented |
| skip | `skip(num: Integer)` | collection | Returns collection with first num items removed | ✅ Implemented |
| take | `take(num: Integer)` | collection | Returns collection with at most num items from the beginning | ✅ Implemented |
| intersect | `intersect(other: collection)` | collection | Returns collection with items that appear in both input and other | ✅ Implemented |
| exclude | `exclude(other: collection)` | collection | Returns collection with items from input that don't appear in other | ✅ Implemented |

### 4. Combining Functions (§1.5.4)

| Function | Signature | Return Type | Description | Status |
|----------|-----------|-------------|-------------|---------|
| union | `union(other: collection)` | collection | Merges two collections eliminating duplicates | ✅ Implemented |
| combine | `combine(other: collection)` | collection | Concatenates two collections without removing duplicates | ✅ Implemented |

### 5. Conversion Functions (§1.5.5)

| Function | Signature | Return Type | Description | Status |
|----------|-----------|-------------|-------------|---------|
| iif | `iif(criterion: expression, true-result: collection [, otherwise-result: collection])` | collection | Conditional operator (immediate if) | ✅ Implemented |
| toBoolean | `toBoolean()` | Boolean | Converts input to Boolean if possible | ✅ Implemented |
| convertsToBoolean | `convertsToBoolean()` | Boolean | Returns true if input can be converted to Boolean | ❌ Not Implemented |
| toInteger | `toInteger()` | Integer | Converts input to Integer if possible | ✅ Implemented |
| convertsToInteger | `convertsToInteger()` | Boolean | Returns true if input can be converted to Integer | ❌ Not Implemented |
| toLong | `toLong()` | Long | Converts input to Long if possible | ❌ Not Implemented |
| convertsToLong | `convertsToLong()` | Boolean | Returns true if input can be converted to Long | ❌ Not Implemented |
| toDecimal | `toDecimal()` | Decimal | Converts input to Decimal if possible | ✅ Implemented |
| convertsToDecimal | `convertsToDecimal()` | Boolean | Returns true if input can be converted to Decimal | ❌ Not Implemented |
| toString | `toString()` | String | Converts input to String | ✅ Implemented |
| convertsToString | `convertsToString()` | Boolean | Returns true if input can be converted to String | ❌ Not Implemented |
| toDate | `toDate()` | Date | Converts input to Date if possible | ❌ Not Implemented |
| convertsToDate | `convertsToDate()` | Boolean | Returns true if input can be converted to Date | ❌ Not Implemented |
| toDateTime | `toDateTime()` | DateTime | Converts input to DateTime if possible | ❌ Not Implemented |
| convertsToDateTime | `convertsToDateTime()` | Boolean | Returns true if input can be converted to DateTime | ❌ Not Implemented |
| toTime | `toTime()` | Time | Converts input to Time if possible | ❌ Not Implemented |
| convertsToTime | `convertsToTime()` | Boolean | Returns true if input can be converted to Time | ❌ Not Implemented |
| toQuantity | `toQuantity([unit: String])` | Quantity | Converts input to Quantity if possible | ❌ Not Implemented |
| convertsToQuantity | `convertsToQuantity([unit: String])` | Boolean | Returns true if input can be converted to Quantity | ❌ Not Implemented |

### 6. String Manipulation Functions (§1.5.6)

| Function | Signature | Return Type | Description | Status |
|----------|-----------|-------------|-------------|---------|
| indexOf | `indexOf(substring: String)` | Integer | Returns 0-based index of first occurrence of substring, or -1 if not found | ✅ Implemented |
| lastIndexOf | `lastIndexOf(substring: String)` | Integer | Returns 0-based index of last occurrence of substring, or -1 if not found | ❌ Not Implemented |
| substring | `substring(start: Integer [, length: Integer])` | String | Returns part of string starting at position start | ✅ Implemented |
| startsWith | `startsWith(prefix: String)` | Boolean | Returns true if string starts with prefix | ✅ Implemented |
| endsWith | `endsWith(suffix: String)` | Boolean | Returns true if string ends with suffix | ✅ Implemented |
| contains | `contains(substring: String)` | Boolean | Returns true if string contains substring | ✅ Implemented |
| upper | `upper()` | String | Converts string to uppercase | ✅ Implemented |
| lower | `lower()` | String | Converts string to lowercase | ✅ Implemented |
| replace | `replace(pattern: String, substitution: String)` | String | Replaces all occurrences of pattern with substitution | ✅ Implemented |
| matches | `matches(regex: String)` | Boolean | Returns true if string matches regular expression | ❌ Not Implemented |
| matchesFull | `matchesFull(regex: String)` | Boolean | Returns true if entire string matches regular expression | ❌ Not Implemented |
| replaceMatches | `replaceMatches(regex: String, substitution: String)` | String | Replaces matches of regex with substitution string | ❌ Not Implemented |
| length | `length()` | Integer | Returns length of the input string | ✅ Implemented |
| toChars | `toChars()` | collection | Returns collection of single-character strings | ❌ Not Implemented |

### 7. Additional String Functions (§1.5.7) - STU

| Function | Signature | Return Type | Description | Status |
|----------|-----------|-------------|-------------|---------|
| encode | `encode(format: String)` | String | Encodes string using specified format | ❌ Not Implemented |
| decode | `decode(format: String)` | String | Decodes string using specified format | ❌ Not Implemented |
| escape | `escape(target: String)` | String | Escapes special characters for target format | ❌ Not Implemented |
| unescape | `unescape(target: String)` | String | Unescapes special characters for target format | ❌ Not Implemented |
| trim | `trim()` | String | Removes leading and trailing whitespace | ✅ Implemented |
| split | `split(separator: String)` | collection | Splits string into collection using separator | ✅ Implemented |
| join | `join(separator: String)` | String | Joins collection of strings using separator | ✅ Implemented |

### 8. Math Functions (§1.5.8) - STU

| Function | Signature | Return Type | Description | Status |
|----------|-----------|-------------|-------------|---------|
| abs | `abs()` | Integer/Decimal/Quantity | Returns absolute value | ❌ Not Implemented |
| ceiling | `ceiling()` | Integer | Returns smallest integer greater than or equal to input | ❌ Not Implemented |
| exp | `exp()` | Decimal | Returns e raised to the power of input | ❌ Not Implemented |
| floor | `floor()` | Integer | Returns largest integer less than or equal to input | ❌ Not Implemented |
| ln | `ln()` | Decimal | Returns natural logarithm | ❌ Not Implemented |
| log | `log(base: Decimal)` | Decimal | Returns logarithm with specified base | ❌ Not Implemented |
| power | `power(exponent: Integer/Decimal)` | Integer/Decimal | Returns input raised to the power of exponent | ❌ Not Implemented |
| round | `round([precision: Integer])` | Decimal | Rounds to specified precision | ❌ Not Implemented |
| sqrt | `sqrt()` | Decimal | Returns square root | ❌ Not Implemented |
| truncate | `truncate()` | Integer | Truncates decimal to integer | ❌ Not Implemented |

### 9. Tree Navigation Functions (§1.5.9)

| Function | Signature | Return Type | Description | Status |
|----------|-----------|-------------|-------------|---------|
| children | `children()` | collection | Returns collection with all immediate child nodes | ❌ Not Implemented |
| descendants | `descendants()` | collection | Returns collection with all descendant nodes | ❌ Not Implemented |

### 10. Utility Functions (§1.5.10)

| Function | Signature | Return Type | Description | Status |
|----------|-----------|-------------|-------------|---------|
| trace | `trace(name: String [, projection: Expression])` | collection | Adds string representation to diagnostic log and returns input unchanged | ✅ Implemented |
| now | `now()` | DateTime | Returns current date and time with timezone | ❌ Not Implemented |
| timeOfDay | `timeOfDay()` | Time | Returns current time | ❌ Not Implemented |
| today | `today()` | Date | Returns current date | ❌ Not Implemented |
| defineVariable | `defineVariable(name: String [, expr: expression])` | collection | Defines a variable and returns input unchanged | ✅ Implemented |
| lowBoundary | `lowBoundary([precision: Integer])` | Decimal/Date/DateTime/Time | Returns lower boundary of input value | ❌ Not Implemented |
| highBoundary | `highBoundary([precision: Integer])` | Decimal/Date/DateTime/Time | Returns upper boundary of input value | ❌ Not Implemented |
| precision | `precision()` | Integer | Returns precision of input value | ❌ Not Implemented |
| yearOf | `yearOf()` | Integer | Extracts year component from date/datetime | ❌ Not Implemented |
| monthOf | `monthOf()` | Integer | Extracts month component from date/datetime | ❌ Not Implemented |
| dayOf | `dayOf()` | Integer | Extracts day component from date/datetime | ❌ Not Implemented |
| hourOf | `hourOf()` | Integer | Extracts hour component from datetime/time | ❌ Not Implemented |
| minuteOf | `minuteOf()` | Integer | Extracts minute component from datetime/time | ❌ Not Implemented |
| secondOf | `secondOf()` | Integer | Extracts second component from datetime/time | ❌ Not Implemented |
| millisecondOf | `millisecondOf()` | Integer | Extracts millisecond component from datetime/time | ❌ Not Implemented |
| timezoneOffsetOf | `timezoneOffsetOf()` | Decimal | Extracts timezone offset from datetime | ❌ Not Implemented |
| dateOf | `dateOf()` | Date | Extracts date component from datetime | ❌ Not Implemented |
| timeOf | `timeOf()` | Time | Extracts time component from datetime | ❌ Not Implemented |

### 11. Aggregate Functions (§1.7) - STU

| Function | Signature | Return Type | Description | Status |
|----------|-----------|-------------|-------------|---------|
| aggregate | `aggregate(aggregator: expression [, init: value])` | value | General-purpose aggregation using aggregator expression | ✅ Implemented |

## Functions Not Yet Implemented (37 total)

### High Priority (Core Functionality)
1. **Type Functions**: `ofType`, all `convertsTo*` functions
2. **Date/Time Functions**: `toDate`, `toDateTime`, `toTime`, `now`, `today`, `timeOfDay`, all date/time component extractors
3. **Math Functions**: All math functions (`abs`, `ceiling`, `floor`, `round`, `sqrt`, etc.)
4. **Tree Navigation**: `children`, `descendants`
5. **String Functions**: `lastIndexOf`, `matches`, `matchesFull`, `replaceMatches`, `toChars`

### Medium Priority (Advanced Features)
1. **Boundary Functions**: `lowBoundary`, `highBoundary`, `precision`
2. **Encoding Functions**: `encode`, `decode`, `escape`, `unescape`
3. **Quantity Functions**: `toQuantity`, `convertsToQuantity`
4. **Long Type**: `toLong`, `convertsToLong`

### Low Priority (Specialized)
1. **Repeat**: `repeat` function for recursive operations

## Notes

- Functions marked with "STU" (Standard for Trial Use) are newer additions to the specification
- The implementation includes several operators (like `[index]`, `contains`, `in`, etc.) that complement the function set
- Some functions like `not` are implemented but are technically operators in the spec
- The `defineVariable` function is implemented and allows for variable definition within expressions