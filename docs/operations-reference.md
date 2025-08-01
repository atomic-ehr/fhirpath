# FHIRPath Operations Reference

This document provides a comprehensive reference for all operators and functions available in the FHIRPath implementation.

## Table of Contents

1. [Operators](#operators)
   - [Arithmetic Operators](#arithmetic-operators)
   - [Comparison Operators](#comparison-operators)
   - [Equality Operators](#equality-operators)
   - [Logical Operators](#logical-operators)
   - [Membership Operators](#membership-operators)
   - [Type Operators](#type-operators)
   - [Collection Operators](#collection-operators)
   - [Navigation Operators](#navigation-operators)
2. [Functions](#functions)
   - [Filtering Functions](#filtering-functions)
   - [Selection Functions](#selection-functions)
   - [Aggregation Functions](#aggregation-functions)
   - [String Functions](#string-functions)
   - [Type Conversion Functions](#type-conversion-functions)
   - [Utility Functions](#utility-functions)

## Operators

### Arithmetic Operators

#### `+` (Addition/Concatenation)
- **Precedence**: 90 (ADDITIVE)
- **Associativity**: left
- **Description**: Adds numbers or concatenates strings
- **Signatures**:
  ```
  Integer + Integer → Integer
  Decimal + Decimal → Decimal
  String + String → String
  Date + Quantity → Date
  DateTime + Quantity → DateTime
  ```
- **Examples**:
  ```fhirpath
  5 + 3              // 8
  5.5 + 2.3          // 7.8
  'Hello' + ' World' // 'Hello World'
  @2023-01-01 + 5 'days' // @2023-01-06
  ```
- **Implementation**: `src/operations/plus-operator.ts`

#### `-` (Subtraction)
- **Precedence**: 90 (ADDITIVE)
- **Associativity**: left
- **Description**: Subtracts numbers or calculates date differences
- **Signatures**:
  ```
  Integer - Integer → Integer
  Decimal - Decimal → Decimal
  Date - Date → Quantity
  DateTime - DateTime → Quantity
  Date - Quantity → Date
  DateTime - Quantity → DateTime
  ```
- **Examples**:
  ```fhirpath
  10 - 3             // 7
  5.5 - 2.3          // 3.2
  @2023-01-10 - @2023-01-01 // 9 'days'
  @2023-01-10 - 5 'days' // @2023-01-05
  ```
- **Implementation**: `src/operations/minus-operator.ts`

#### `*` (Multiplication)
- **Precedence**: 100 (MULTIPLICATIVE)
- **Associativity**: left
- **Description**: Multiplies numbers
- **Signatures**:
  ```
  Integer * Integer → Integer
  Decimal * Decimal → Decimal
  ```
- **Examples**:
  ```fhirpath
  5 * 3              // 15
  2.5 * 4            // 10.0
  ```
- **Implementation**: `src/operations/multiply-operator.ts`

#### `/` (Division)
- **Precedence**: 100 (MULTIPLICATIVE)
- **Associativity**: left
- **Description**: Divides numbers (decimal division)
- **Signatures**:
  ```
  Integer / Integer → Decimal
  Decimal / Decimal → Decimal
  ```
- **Examples**:
  ```fhirpath
  10 / 3             // 3.333...
  15.0 / 3.0         // 5.0
  ```
- **Implementation**: `src/operations/divide-operator.ts`

#### `div` (Integer Division)
- **Precedence**: 100 (MULTIPLICATIVE)
- **Associativity**: left
- **Description**: Integer division (truncates towards zero)
- **Signatures**:
  ```
  Integer div Integer → Integer
  Decimal div Decimal → Integer
  ```
- **Examples**:
  ```fhirpath
  10 div 3           // 3
  -10 div 3          // -3
  10.5 div 3.2       // 3
  ```
- **Implementation**: `src/operations/div-operator.ts`

#### `mod` (Modulo)
- **Precedence**: 100 (MULTIPLICATIVE)
- **Associativity**: left
- **Description**: Remainder after division
- **Signatures**:
  ```
  Integer mod Integer → Integer
  Decimal mod Decimal → Decimal
  ```
- **Examples**:
  ```fhirpath
  10 mod 3           // 1
  10.5 mod 3.0       // 1.5
  ```
- **Implementation**: `src/operations/mod-operator.ts`

#### Unary `+` (Unary Plus)
- **Precedence**: 110 (UNARY)
- **Description**: Identity operation for numbers
- **Signatures**:
  ```
  +Integer → Integer
  +Decimal → Decimal
  ```
- **Examples**:
  ```fhirpath
  +5                 // 5
  +(-3)              // -3
  ```
- **Implementation**: `src/operations/unary-plus-operator.ts`

#### Unary `-` (Unary Minus)
- **Precedence**: 110 (UNARY)
- **Description**: Negates numbers
- **Signatures**:
  ```
  -Integer → Integer
  -Decimal → Decimal
  ```
- **Examples**:
  ```fhirpath
  -5                 // -5
  -(-3)              // 3
  ```
- **Implementation**: `src/operations/unary-minus-operator.ts`

### Comparison Operators

#### `<` (Less Than)
- **Precedence**: 70 (COMPARISON)
- **Associativity**: left
- **Description**: Tests if left value is less than right value
- **Signatures**:
  ```
  Integer < Integer → Boolean
  Decimal < Decimal → Boolean
  String < String → Boolean
  Date < Date → Boolean
  DateTime < DateTime → Boolean
  Time < Time → Boolean
  Quantity < Quantity → Boolean
  ```
- **Examples**:
  ```fhirpath
  3 < 5              // true
  'abc' < 'def'      // true
  @2023-01-01 < @2023-01-02 // true
  ```
- **Implementation**: `src/operations/less-operator.ts`

#### `>` (Greater Than)
- **Precedence**: 70 (COMPARISON)
- **Associativity**: left
- **Description**: Tests if left value is greater than right value
- **Signatures**: Same as `<`
- **Examples**:
  ```fhirpath
  5 > 3              // true
  'def' > 'abc'      // true
  ```
- **Implementation**: `src/operations/greater-operator.ts`

#### `<=` (Less Than or Equal)
- **Precedence**: 70 (COMPARISON)
- **Associativity**: left
- **Description**: Tests if left value is less than or equal to right value
- **Signatures**: Same as `<`
- **Examples**:
  ```fhirpath
  3 <= 3             // true
  3 <= 5             // true
  ```
- **Implementation**: `src/operations/less-or-equal-operator.ts`

#### `>=` (Greater Than or Equal)
- **Precedence**: 70 (COMPARISON)
- **Associativity**: left
- **Description**: Tests if left value is greater than or equal to right value
- **Signatures**: Same as `<`
- **Examples**:
  ```fhirpath
  5 >= 3             // true
  3 >= 3             // true
  ```
- **Implementation**: `src/operations/greater-or-equal-operator.ts`

### Equality Operators

#### `=` (Equal)
- **Precedence**: 60 (EQUALITY)
- **Associativity**: left
- **Description**: Tests for equality (exact match including type)
- **Signatures**:
  ```
  T = T → Boolean (for any type T)
  ```
- **Special Rules**:
  - Empty collections: `{} = {}` returns `true`
  - Mixed empty/non-empty: `{} = 5` returns `false`
  - Collections must have same order
- **Examples**:
  ```fhirpath
  5 = 5              // true
  5 = 5.0            // false (different types)
  'hello' = 'hello'  // true
  (1 | 2) = (1 | 2)  // true
  (1 | 2) = (2 | 1)  // false (order matters)
  ```
- **Implementation**: `src/operations/equal-operator.ts`

#### `!=` (Not Equal)
- **Precedence**: 60 (EQUALITY)
- **Associativity**: left
- **Description**: Tests for inequality (negation of `=`)
- **Signatures**: Same as `=`
- **Examples**:
  ```fhirpath
  5 != 3             // true
  5 != 5             // false
  ```
- **Implementation**: `src/operations/not-equal-operator.ts`

#### `~` (Equivalent)
- **Precedence**: 60 (EQUALITY)
- **Associativity**: left
- **Description**: Tests for equivalence (type-flexible equality)
- **Signatures**: Same as `=`
- **Special Rules**:
  - Implicit type conversion
  - Case-insensitive string comparison
  - Whitespace normalization
  - Collection order doesn't matter
- **Examples**:
  ```fhirpath
  5 ~ 5.0            // true
  'Hello' ~ 'HELLO'  // true
  (1 | 2) ~ (2 | 1)  // true
  ```
- **Implementation**: `src/operations/equivalent-operator.ts`

#### `!~` (Not Equivalent)
- **Precedence**: 60 (EQUALITY)
- **Associativity**: left
- **Description**: Tests for non-equivalence (negation of `~`)
- **Signatures**: Same as `=`
- **Examples**:
  ```fhirpath
  5 !~ 'five'        // true
  'Hello' !~ 'HELLO' // false
  ```
- **Implementation**: `src/operations/not-equivalent-operator.ts`

### Logical Operators

#### `and` (Logical AND)
- **Precedence**: 40 (AND)
- **Associativity**: left
- **Description**: Logical AND with three-valued logic
- **Truth Table**:
  ```
  true and true = true
  true and false = false
  true and {} = {}
  false and anything = false
  {} and {} = {}
  ```
- **Examples**:
  ```fhirpath
  true and true      // true
  true and false     // false
  true and {}        // {} (empty)
  ```
- **Implementation**: `src/operations/and-operator.ts`

#### `or` (Logical OR)
- **Precedence**: 20 (OR)
- **Associativity**: left
- **Description**: Logical OR with three-valued logic
- **Truth Table**:
  ```
  true or anything = true
  false or false = false
  false or true = true
  false or {} = {}
  {} or {} = {}
  ```
- **Examples**:
  ```fhirpath
  true or false      // true
  false or false     // false
  false or {}        // {} (empty)
  ```
- **Implementation**: `src/operations/or-operator.ts`

#### `xor` (Logical XOR)
- **Precedence**: 30 (XOR)
- **Associativity**: left
- **Description**: Logical exclusive OR
- **Truth Table**:
  ```
  true xor true = false
  true xor false = true
  false xor true = true
  false xor false = false
  anything xor {} = {}
  ```
- **Examples**:
  ```fhirpath
  true xor false     // true
  true xor true      // false
  ```
- **Implementation**: `src/operations/xor-operator.ts`

#### `implies` (Logical Implication)
- **Precedence**: 10 (IMPLIES) - lowest
- **Associativity**: right
- **Description**: Logical implication (if-then)
- **Truth Table**:
  ```
  true implies true = true
  true implies false = false
  false implies anything = true
  {} implies anything = true
  anything implies {} = {}
  ```
- **Examples**:
  ```fhirpath
  true implies true  // true
  true implies false // false
  false implies false // true
  ```
- **Implementation**: `src/operations/implies-operator.ts`

### Membership Operators

#### `in` (Membership Test)
- **Precedence**: 50 (IN_CONTAINS)
- **Associativity**: left
- **Description**: Tests if left value is contained in right collection
- **Signatures**:
  ```
  T in Collection<T> → Boolean
  ```
- **Examples**:
  ```fhirpath
  5 in (1 | 3 | 5 | 7) // true
  'a' in ('x' | 'y' | 'z') // false
  ```
- **Implementation**: `src/operations/in-operator.ts`

#### `contains` (Contains Test)
- **Precedence**: 50 (IN_CONTAINS)
- **Associativity**: left
- **Description**: Tests if left collection contains right value
- **Signatures**:
  ```
  Collection<T> contains T → Boolean
  ```
- **Examples**:
  ```fhirpath
  (1 | 3 | 5 | 7) contains 5 // true
  'hello' contains 'ell'      // true (string contains)
  ```
- **Implementation**: `src/operations/contains-operator.ts`

### Type Operators

#### `is` (Type Test)
- **Precedence**: 120 (AS_IS)
- **Associativity**: left
- **Description**: Tests if value is of specified type
- **Signatures**:
  ```
  Any is TypeIdentifier → Boolean
  ```
- **Examples**:
  ```fhirpath
  5 is Integer       // true
  5.0 is Decimal     // true
  'hello' is String  // true
  Patient is Patient // true
  ```
- **Implementation**: `src/operations/is-operator.ts`

#### `as` (Type Cast)
- **Precedence**: 120 (AS_IS)
- **Associativity**: left
- **Description**: Casts value to specified type or returns empty
- **Signatures**:
  ```
  Any as TypeIdentifier → T | {}
  ```
- **Examples**:
  ```fhirpath
  5 as Integer       // 5
  5.0 as Integer     // {} (empty)
  Resource as Patient // Patient or empty
  ```
- **Implementation**: `src/operations/as-operator.ts`

### Collection Operators

#### `|` (Union)
- **Precedence**: 80 (PIPE)
- **Associativity**: left
- **Description**: Combines collections preserving duplicates
- **Signatures**:
  ```
  Collection<T> | Collection<T> → Collection<T>
  ```
- **Examples**:
  ```fhirpath
  (1 | 2) | (2 | 3)  // (1 | 2 | 2 | 3)
  name | nickname    // all names and nicknames
  ```
- **Implementation**: `src/operations/union-operator.ts`

#### `combine` (Combine Collections)
- **Precedence**: N/A (function-like operator)
- **Description**: Combines collections removing duplicates
- **Examples**:
  ```fhirpath
  (1 | 2).combine(2 | 3) // (1 | 2 | 3)
  ```
- **Implementation**: `src/operations/combine-operator.ts`

### Navigation Operators

#### `.` (Dot/Navigation)
- **Precedence**: 140 (DOT) - highest
- **Associativity**: left
- **Description**: Navigates to properties or invokes functions
- **Special Semantics**:
  - Propagates through collections
  - Returns empty for missing properties
  - Flattens nested collections
- **Examples**:
  ```fhirpath
  Patient.name       // Navigate to name property
  Patient.name.given // Chain navigation
  name.first()       // Invoke function
  ```
- **Implementation**: `src/operations/dot-operator.ts`

## Functions

### Filtering Functions

#### `where(criteria)`
- **Description**: Filters collection based on criteria expression
- **Signature**:
  ```
  Collection<T>.where(criteria: Boolean) → Collection<T>
  ```
- **Parameters**:
  - `criteria`: Expression evaluated for each item (has access to `$this`)
- **Examples**:
  ```fhirpath
  Patient.name.where(use = 'official')
  Observation.where(status = 'final')
  value.where($this > 10)
  ```
- **Implementation**: `src/operations/where-function.ts`

#### `select(projection)`
- **Description**: Projects each item using expression
- **Signature**:
  ```
  Collection<T>.select(projection: Any) → Collection<Any>
  ```
- **Parameters**:
  - `projection`: Expression evaluated for each item
- **Examples**:
  ```fhirpath
  Patient.name.select(given + ' ' + family)
  Observation.select(code.text)
  ```
- **Implementation**: `src/operations/select-function.ts`

#### `single()`
- **Description**: Returns single item if collection has exactly one item, otherwise error
- **Signature**:
  ```
  Collection<T>.single() → T
  ```
- **Examples**:
  ```fhirpath
  Patient.identifier.where(system = 'mrn').single()
  ```
- **Implementation**: `src/operations/single-function.ts`

### Selection Functions

#### `first()`
- **Description**: Returns first item in collection
- **Signature**:
  ```
  Collection<T>.first() → T
  ```
- **Examples**:
  ```fhirpath
  Patient.name.first()
  (1 | 2 | 3).first() // 1
  ```
- **Implementation**: `src/operations/first-function.ts`

#### `last()`
- **Description**: Returns last item in collection
- **Signature**:
  ```
  Collection<T>.last() → T
  ```
- **Examples**:
  ```fhirpath
  Patient.name.last()
  (1 | 2 | 3).last() // 3
  ```
- **Implementation**: `src/operations/last-function.ts`

#### `tail()`
- **Description**: Returns all items except the first
- **Signature**:
  ```
  Collection<T>.tail() → Collection<T>
  ```
- **Examples**:
  ```fhirpath
  (1 | 2 | 3).tail() // (2 | 3)
  ```
- **Implementation**: `src/operations/tail-function.ts`

#### `skip(count)`
- **Description**: Skips first N items
- **Signature**:
  ```
  Collection<T>.skip(count: Integer) → Collection<T>
  ```
- **Examples**:
  ```fhirpath
  (1 | 2 | 3 | 4).skip(2) // (3 | 4)
  ```
- **Implementation**: `src/operations/skip-function.ts`

#### `take(count)`
- **Description**: Takes first N items
- **Signature**:
  ```
  Collection<T>.take(count: Integer) → Collection<T>
  ```
- **Examples**:
  ```fhirpath
  (1 | 2 | 3 | 4).take(2) // (1 | 2)
  ```
- **Implementation**: `src/operations/take-function.ts`

### Aggregation Functions

#### `count()`
- **Description**: Returns number of items in collection
- **Signature**:
  ```
  Collection<T>.count() → Integer
  ```
- **Examples**:
  ```fhirpath
  Patient.name.count()
  (1 | 2 | 3).count() // 3
  ```
- **Implementation**: `src/operations/count-function.ts`

#### `exists([criteria])`
- **Description**: Tests if collection has any items (optionally matching criteria)
- **Signature**:
  ```
  Collection<T>.exists(criteria?: Boolean) → Boolean
  ```
- **Examples**:
  ```fhirpath
  Patient.name.exists()
  Patient.name.exists(use = 'official')
  ```
- **Implementation**: `src/operations/exists-function.ts`

#### `all(criteria)`
- **Description**: Tests if all items match criteria
- **Signature**:
  ```
  Collection<T>.all(criteria: Boolean) → Boolean
  ```
- **Examples**:
  ```fhirpath
  Observation.component.all(value.exists())
  (1 | 2 | 3).all($this > 0) // true
  ```
- **Implementation**: `src/operations/all-function.ts`

#### `empty()`
- **Description**: Tests if collection is empty
- **Signature**:
  ```
  Collection<T>.empty() → Boolean
  ```
- **Examples**:
  ```fhirpath
  Patient.name.empty()
  {}.empty() // true
  ```
- **Implementation**: `src/operations/empty-function.ts`

#### `distinct()`
- **Description**: Removes duplicate values
- **Signature**:
  ```
  Collection<T>.distinct() → Collection<T>
  ```
- **Examples**:
  ```fhirpath
  (1 | 2 | 2 | 3).distinct() // (1 | 2 | 3)
  ```
- **Implementation**: `src/operations/distinct-function.ts`

#### `isDistinct()`
- **Description**: Tests if all values are unique
- **Signature**:
  ```
  Collection<T>.isDistinct() → Boolean
  ```
- **Examples**:
  ```fhirpath
  (1 | 2 | 3).isDistinct() // true
  (1 | 2 | 2).isDistinct() // false
  ```
- **Implementation**: `src/operations/isDistinct-function.ts`

### String Functions

#### `indexOf(substring)`
- **Description**: Returns index of substring (0-based)
- **Signature**:
  ```
  String.indexOf(substring: String) → Integer
  ```
- **Examples**:
  ```fhirpath
  'hello world'.indexOf('world') // 6
  'hello'.indexOf('x') // -1
  ```
- **Implementation**: `src/operations/indexOf-function.ts`

#### `substring(start[, length])`
- **Description**: Extracts substring
- **Signature**:
  ```
  String.substring(start: Integer, length?: Integer) → String
  ```
- **Examples**:
  ```fhirpath
  'hello world'.substring(0, 5) // 'hello'
  'hello world'.substring(6) // 'world'
  ```
- **Implementation**: `src/operations/substring-function.ts`

#### `startsWith(prefix)`
- **Description**: Tests if string starts with prefix
- **Signature**:
  ```
  String.startsWith(prefix: String) → Boolean
  ```
- **Examples**:
  ```fhirpath
  'hello world'.startsWith('hello') // true
  ```
- **Implementation**: `src/operations/startsWith-function.ts`

#### `endsWith(suffix)`
- **Description**: Tests if string ends with suffix
- **Signature**:
  ```
  String.endsWith(suffix: String) → Boolean
  ```
- **Examples**:
  ```fhirpath
  'hello world'.endsWith('world') // true
  ```
- **Implementation**: `src/operations/endsWith-function.ts`

#### `contains(substring)`
- **Description**: Tests if string contains substring
- **Signature**:
  ```
  String.contains(substring: String) → Boolean
  ```
- **Examples**:
  ```fhirpath
  'hello world'.contains('lo wo') // true
  ```
- **Implementation**: `src/operations/contains-function.ts`

#### `length()`
- **Description**: Returns string length
- **Signature**:
  ```
  String.length() → Integer
  ```
- **Examples**:
  ```fhirpath
  'hello'.length() // 5
  ```
- **Implementation**: `src/operations/length-function.ts`

#### `upper()`
- **Description**: Converts to uppercase
- **Signature**:
  ```
  String.upper() → String
  ```
- **Examples**:
  ```fhirpath
  'hello'.upper() // 'HELLO'
  ```
- **Implementation**: `src/operations/upper-function.ts`

#### `lower()`
- **Description**: Converts to lowercase
- **Signature**:
  ```
  String.lower() → String
  ```
- **Examples**:
  ```fhirpath
  'HELLO'.lower() // 'hello'
  ```
- **Implementation**: `src/operations/lower-function.ts`

#### `replace(pattern, replacement)`
- **Description**: Replaces pattern with replacement
- **Signature**:
  ```
  String.replace(pattern: String, replacement: String) → String
  ```
- **Examples**:
  ```fhirpath
  'hello world'.replace('world', 'FHIRPath') // 'hello FHIRPath'
  ```
- **Implementation**: `src/operations/replace-function.ts`

#### `split(delimiter)`
- **Description**: Splits string into array
- **Signature**:
  ```
  String.split(delimiter: String) → Collection<String>
  ```
- **Examples**:
  ```fhirpath
  'a,b,c'.split(',') // ('a' | 'b' | 'c')
  ```
- **Implementation**: `src/operations/split-function.ts`

#### `trim()`
- **Description**: Removes leading/trailing whitespace
- **Signature**:
  ```
  String.trim() → String
  ```
- **Examples**:
  ```fhirpath
  '  hello  '.trim() // 'hello'
  ```
- **Implementation**: `src/operations/trim-function.ts`

#### `join(separator)`
- **Description**: Joins collection items into string
- **Signature**:
  ```
  Collection<String>.join(separator?: String) → String
  ```
- **Examples**:
  ```fhirpath
  ('a' | 'b' | 'c').join(', ') // 'a, b, c'
  ```
- **Implementation**: `src/operations/join-function.ts`

### Type Conversion Functions

#### `toString()`
- **Description**: Converts value to string
- **Signature**:
  ```
  Any.toString() → String
  ```
- **Examples**:
  ```fhirpath
  5.toString() // '5'
  true.toString() // 'true'
  ```
- **Implementation**: `src/operations/toString-function.ts`

#### `toInteger()`
- **Description**: Converts value to integer
- **Signature**:
  ```
  Any.toInteger() → Integer
  ```
- **Examples**:
  ```fhirpath
  '123'.toInteger() // 123
  5.7.toInteger() // 5
  ```
- **Implementation**: `src/operations/toInteger-function.ts`

#### `toDecimal()`
- **Description**: Converts value to decimal
- **Signature**:
  ```
  Any.toDecimal() → Decimal
  ```
- **Examples**:
  ```fhirpath
  '123.45'.toDecimal() // 123.45
  5.toDecimal() // 5.0
  ```
- **Implementation**: `src/operations/toDecimal-function.ts`

#### `toBoolean()`
- **Description**: Converts value to boolean
- **Signature**:
  ```
  Any.toBoolean() → Boolean
  ```
- **Conversion Rules**:
  - Strings: 'true', 't', 'yes', 'y', '1' → true
  - Strings: 'false', 'f', 'no', 'n', '0' → false
  - Numbers: 1 → true, 0 → false
- **Examples**:
  ```fhirpath
  'true'.toBoolean() // true
  1.toBoolean() // true
  ```
- **Implementation**: `src/operations/toBoolean-function.ts`

### Utility Functions

#### `iif(condition, trueResult, falseResult)`
- **Description**: Conditional expression (if-then-else)
- **Signature**:
  ```
  iif(condition: Boolean, trueResult: T, falseResult: T) → T
  ```
- **Examples**:
  ```fhirpath
  iif(gender = 'male', 'Mr.', 'Ms.')
  iif(age >= 18, 'Adult', 'Minor')
  ```
- **Implementation**: `src/operations/iif-function.ts`

#### `trace(name, selector)`
- **Description**: Debug helper that logs value and returns it
- **Signature**:
  ```
  Collection<T>.trace(name?: String, selector?: Any) → Collection<T>
  ```
- **Examples**:
  ```fhirpath
  Patient.name.trace('names')
  value.trace('value', $this.unit)
  ```
- **Implementation**: `src/operations/trace-function.ts`

#### `defineVariable(name)`
- **Description**: Defines a variable for later use
- **Signature**:
  ```
  Collection<T>.defineVariable(name: String) → Collection<T>
  ```
- **Examples**:
  ```fhirpath
  Observation.value.defineVariable('obsValue')
  ```
- **Implementation**: `src/operations/defineVariable-function.ts`

#### `not()`
- **Description**: Logical NOT operation
- **Signature**:
  ```
  Boolean.not() → Boolean
  ```
- **Examples**:
  ```fhirpath
  true.not() // false
  Patient.active.not()
  ```
- **Implementation**: `src/operations/not-function.ts`

### Collection Set Operations

#### `union(other)`
- **Description**: Combines collections preserving duplicates
- **Signature**:
  ```
  Collection<T>.union(other: Collection<T>) → Collection<T>
  ```
- **Examples**:
  ```fhirpath
  (1 | 2).union(2 | 3) // (1 | 2 | 2 | 3)
  ```
- **Implementation**: `src/operations/union-function.ts`

#### `combine(other)`
- **Description**: Combines collections removing duplicates
- **Signature**:
  ```
  Collection<T>.combine(other: Collection<T>) → Collection<T>
  ```
- **Examples**:
  ```fhirpath
  (1 | 2).combine(2 | 3) // (1 | 2 | 3)
  ```
- **Implementation**: `src/operations/combine-function.ts`

#### `intersect(other)`
- **Description**: Returns common elements
- **Signature**:
  ```
  Collection<T>.intersect(other: Collection<T>) → Collection<T>
  ```
- **Examples**:
  ```fhirpath
  (1 | 2 | 3).intersect(2 | 3 | 4) // (2 | 3)
  ```
- **Implementation**: `src/operations/intersect-function.ts`

#### `exclude(other)`
- **Description**: Removes elements present in other collection
- **Signature**:
  ```
  Collection<T>.exclude(other: Collection<T>) → Collection<T>
  ```
- **Examples**:
  ```fhirpath
  (1 | 2 | 3).exclude(2 | 3) // (1)
  ```
- **Implementation**: `src/operations/exclude-function.ts`

### Boolean Aggregation Functions

#### `allTrue()`
- **Description**: Tests if all boolean values are true
- **Signature**:
  ```
  Collection<Boolean>.allTrue() → Boolean
  ```
- **Examples**:
  ```fhirpath
  (true | true | true).allTrue() // true
  (true | false | true).allTrue() // false
  ```
- **Implementation**: `src/operations/allTrue-function.ts`

#### `anyTrue()`
- **Description**: Tests if any boolean value is true
- **Signature**:
  ```
  Collection<Boolean>.anyTrue() → Boolean
  ```
- **Examples**:
  ```fhirpath
  (false | true | false).anyTrue() // true
  (false | false).anyTrue() // false
  ```
- **Implementation**: `src/operations/anyTrue-function.ts`

#### `allFalse()`
- **Description**: Tests if all boolean values are false
- **Signature**:
  ```
  Collection<Boolean>.allFalse() → Boolean
  ```
- **Examples**:
  ```fhirpath
  (false | false).allFalse() // true
  (false | true).allFalse() // false
  ```
- **Implementation**: `src/operations/allFalse-function.ts`

#### `anyFalse()`
- **Description**: Tests if any boolean value is false
- **Signature**:
  ```
  Collection<Boolean>.anyFalse() → Boolean
  ```
- **Examples**:
  ```fhirpath
  (true | false | true).anyFalse() // true
  (true | true).anyFalse() // false
  ```
- **Implementation**: `src/operations/anyFalse-function.ts`

## Operation Precedence

Operations are evaluated in the following precedence order (highest to lowest):

1. **DOT (140)**: `.` navigation
2. **POSTFIX (130)**: `[]` indexing
3. **AS_IS (120)**: `as`, `is` type operators
4. **UNARY (110)**: unary `+`, `-`, `not`
5. **MULTIPLICATIVE (100)**: `*`, `/`, `div`, `mod`
6. **ADDITIVE (90)**: binary `+`, `-`
7. **PIPE (80)**: `|` union
8. **COMPARISON (70)**: `<`, `>`, `<=`, `>=`
9. **EQUALITY (60)**: `=`, `!=`, `~`, `!~`
10. **IN_CONTAINS (50)**: `in`, `contains`
11. **AND (40)**: `and`
12. **XOR (30)**: `xor`
13. **OR (20)**: `or`
14. **IMPLIES (10)**: `implies`

## Special Semantics

### Collection Handling

- All values in FHIRPath are collections (including single values)
- Empty collection `{}` represents "no value" or "null"
- Operations propagate through collections automatically

### Three-Valued Logic

- Boolean operations use three-valued logic: `true`, `false`, and `{}` (unknown)
- Empty collections in boolean contexts represent "unknown"

### Type Coercion

- Some operations perform implicit type conversion
- The `~` (equivalent) operator is more permissive than `=` (equal)

### Navigation Semantics

- The dot operator (`.`) has special navigation semantics
- Missing properties return empty collections, not errors
- Navigation through collections is automatically flattened

## Error Handling

- Division by zero returns empty collection
- Type mismatches typically return empty collections
- Invalid operations return empty rather than throwing errors

## References

- FHIRPath Specification: http://hl7.org/fhirpath/
- Implementation files: `src/operations/`
- Registry: `src/registry.ts`
- Type definitions: `src/types.ts`