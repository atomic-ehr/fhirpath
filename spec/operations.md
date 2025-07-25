# FHIRPath Operations Reference

This document provides a comprehensive list of all FHIRPath operators and functions with their signatures and descriptions extracted from the official specification.

## Operators

### Equality Operators

#### = (Equals)
- **Signature**: `left = right`
- **Returns**: `Boolean | empty`
- **Description**: Returns `true` if the left collection is equal to the right collection. For primitives, comparison is based on exact values. For complex types, all child properties must be equal recursively. Returns empty if either operand is empty.

#### ~ (Equivalent)
- **Signature**: `left ~ right`
- **Returns**: `Boolean`
- **Description**: Returns `true` if the collections are equivalent. Similar to equals but with relaxed rules: strings ignore case/locale and normalize whitespace, dates/times with different precision return `false` rather than empty. Empty collections are equivalent to each other.

#### != (Not Equals)
- **Signature**: `left != right`
- **Returns**: `Boolean | empty`
- **Description**: The converse of the equals operator.

#### !~ (Not Equivalent)
- **Signature**: `left !~ right`
- **Returns**: `Boolean`
- **Description**: The converse of the equivalent operator.

### Comparison Operators

#### > (Greater Than)
- **Signature**: `left > right`
- **Returns**: `Boolean | empty`
- **Description**: Returns `true` if the first operand is strictly greater than the second. Operands must be of the same type or convertible. Returns empty for partial date/time comparisons with different precision.

#### < (Less Than)
- **Signature**: `left < right`
- **Returns**: `Boolean | empty`
- **Description**: Returns `true` if the first operand is strictly less than the second. Operands must be of the same type or convertible. Returns empty for partial date/time comparisons with different precision.

#### <= (Less or Equal)
- **Signature**: `left <= right`
- **Returns**: `Boolean | empty`
- **Description**: Returns `true` if the first operand is less than or equal to the second. Operands must be of the same type or convertible.

#### >= (Greater or Equal)
- **Signature**: `left >= right`
- **Returns**: `Boolean | empty`
- **Description**: Returns `true` if the first operand is greater than or equal to the second. Operands must be of the same type or convertible.

### Type Operators

#### is
- **Signature**: `operand is TypeSpecifier`
- **Returns**: `Boolean | empty`
- **Description**: Returns `true` if the type of the left operand is the specified type or a subclass thereof. Returns empty if the input is empty.

#### as
- **Signature**: `operand as TypeSpecifier`
- **Returns**: `collection`
- **Description**: Returns the value of the left operand if it is of the specified type or a subclass thereof. Otherwise returns empty.

### Collection Operators

#### | (Union)
- **Signature**: `left | right`
- **Returns**: `collection`
- **Description**: Merges two collections into a single collection, eliminating any duplicate values (using equals semantics).

#### in (Membership)
- **Signature**: `element in collection`
- **Returns**: `Boolean | empty`
- **Description**: Returns `true` if the single-item left operand is in the right operand collection using equality semantics.

#### contains (Containership)
- **Signature**: `collection contains element`
- **Returns**: `Boolean | empty`
- **Description**: Returns `true` if the single-item right operand is in the left operand collection using equality semantics.

### Boolean Logic Operators

#### and
- **Signature**: `left and right`
- **Returns**: `Boolean | empty`
- **Description**: Returns `true` if both operands evaluate to `true`, `false` if either evaluates to `false`, empty otherwise.

#### or
- **Signature**: `left or right`
- **Returns**: `Boolean | empty`
- **Description**: Returns `false` if both operands evaluate to `false`, `true` if either evaluates to `true`, empty otherwise.

#### xor
- **Signature**: `left xor right`
- **Returns**: `Boolean | empty`
- **Description**: Returns `true` if exactly one operand evaluates to `true`, `false` if both are `true` or both are `false`, empty otherwise.

#### implies
- **Signature**: `left implies right`
- **Returns**: `Boolean | empty`
- **Description**: If left is `true`, returns the boolean evaluation of right. If left is `false`, returns `true`. Otherwise returns `true` if right is `true`, empty otherwise.

### Math Operators

#### * (Multiplication)
- **Signature**: `left * right`
- **Returns**: `Integer | Decimal | Quantity`
- **Description**: Multiplies both arguments. Supported for Integer, Decimal, and Quantity. For quantities, results have appropriate unit.

#### / (Division)
- **Signature**: `left / right`
- **Returns**: `Decimal`
- **Description**: Divides left by right. Result is always Decimal, even for Integer inputs. Returns empty on division by zero.

#### + (Addition)
- **Signature**: `left + right`
- **Returns**: `Integer | Decimal | Quantity | String`
- **Description**: For numbers and quantities, adds the operands. For strings, concatenates right to left. Quantity dimensions must match.

#### - (Subtraction)
- **Signature**: `left - right`
- **Returns**: `Integer | Decimal | Quantity`
- **Description**: Subtracts right from left. Supported for Integer, Decimal, and Quantity. Quantity dimensions must match.

#### div (Integer Division)
- **Signature**: `left div right`
- **Returns**: `Integer`
- **Description**: Performs truncated division, ignoring any remainder. Returns empty on division by zero.

#### mod (Modulo)
- **Signature**: `left mod right`
- **Returns**: `Integer | Decimal`
- **Description**: Computes the remainder of truncated division. Returns empty on division by zero.

#### & (String Concatenation)
- **Signature**: `left & right`
- **Returns**: `String`
- **Description**: Concatenates strings, treating empty operands as empty strings (unlike + which returns empty).

### Indexer

#### [] (Indexer)
- **Signature**: `collection[index]`
- **Returns**: `collection`
- **Description**: Returns a collection with only the item at the specified 0-based index. Returns empty if index is out of bounds.

## Functions

### Existence Functions

#### empty()
- **Signature**: `collection.empty() : Boolean`
- **Description**: Returns `true` if the input collection is empty, `false` otherwise.

#### exists()
- **Signature**: `collection.exists([criteria : expression]) : Boolean`
- **Description**: Returns `true` if the collection has any elements, `false` otherwise. Can take optional criteria to filter before checking existence.

#### all()
- **Signature**: `collection.all(criteria : expression) : Boolean`
- **Description**: Returns `true` if for every element in the collection, criteria evaluates to `true`. Returns `true` for empty collections.

#### allTrue()
- **Signature**: `collection.allTrue() : Boolean`
- **Description**: Returns `true` if all items in the boolean collection are `true`. Returns `true` for empty collections.

#### anyTrue()
- **Signature**: `collection.anyTrue() : Boolean`
- **Description**: Returns `true` if any item in the boolean collection is `true`. Returns `false` for empty collections.

#### allFalse()
- **Signature**: `collection.allFalse() : Boolean`
- **Description**: Returns `true` if all items in the boolean collection are `false`. Returns `true` for empty collections.

#### anyFalse()
- **Signature**: `collection.anyFalse() : Boolean`
- **Description**: Returns `true` if any item in the boolean collection is `false`. Returns `false` for empty collections.

#### subsetOf()
- **Signature**: `collection.subsetOf(other : collection) : Boolean`
- **Description**: Returns `true` if all items in the input collection are members of the other collection.

#### supersetOf()
- **Signature**: `collection.supersetOf(other : collection) : Boolean`
- **Description**: Returns `true` if all items in the other collection are members of the input collection.

#### isDistinct()
- **Signature**: `collection.isDistinct() : Boolean`
- **Description**: Returns `true` if all items in the collection are distinct (no duplicates).

#### distinct()
- **Signature**: `collection.distinct() : collection`
- **Description**: Returns a collection containing only the unique items from the input collection.

#### count()
- **Signature**: `collection.count() : Integer`
- **Description**: Returns the number of items in the collection. Returns 0 for empty collections.

### Filtering and Projection Functions

#### where()
- **Signature**: `collection.where(criteria : expression) : collection`
- **Description**: Returns elements where criteria evaluates to `true`. Elements where criteria is `false` or empty are excluded.

#### select()
- **Signature**: `collection.select(projection : expression) : collection`
- **Description**: Evaluates projection for each item and returns flattened results. Empty projections add nothing to result.

#### repeat()
- **Signature**: `collection.repeat(projection : expression) : collection`
- **Description**: Repeatedly applies projection until no new items are found. Useful for tree traversal.

#### ofType()
- **Signature**: `collection.ofType(type : TypeInfo) : collection`
- **Description**: Returns items that are of the given type or a subclass thereof.

### Subsetting Functions

#### single()
- **Signature**: `collection.single() : collection`
- **Description**: Returns the single item if there is exactly one. Signals error if multiple items, returns empty if no items.

#### first()
- **Signature**: `collection.first() : collection`
- **Description**: Returns the first item in the collection. Returns empty if no items.

#### last()
- **Signature**: `collection.last() : collection`
- **Description**: Returns the last item in the collection. Returns empty if no items.

#### tail()
- **Signature**: `collection.tail() : collection`
- **Description**: Returns all but the first item. Returns empty if one or no items.

#### skip()
- **Signature**: `collection.skip(num : Integer) : collection`
- **Description**: Returns all but the first num items. Returns empty if not enough items remain.

#### take()
- **Signature**: `collection.take(num : Integer) : collection`
- **Description**: Returns the first num items, or less if fewer available. Returns empty if num <= 0.

#### intersect()
- **Signature**: `collection.intersect(other : collection) : collection`
- **Description**: Returns elements that are in both collections. Eliminates duplicates.

#### exclude()
- **Signature**: `collection.exclude(other : collection) : collection`
- **Description**: Returns elements not in the other collection. Preserves duplicates and order.

### Combining Functions

#### union()
- **Signature**: `collection.union(other : collection) : collection`
- **Description**: Merges collections eliminating duplicates. Same as | operator.

#### combine()
- **Signature**: `collection.combine(other : collection) : collection`
- **Description**: Merges collections without eliminating duplicates.

### Conversion Functions

#### iif()
- **Signature**: `iif(criterion : expression, true-result : collection [, otherwise-result : collection]) : collection`
- **Description**: If criterion is true, returns true-result. Otherwise returns otherwise-result or empty. Short-circuit evaluation expected.

#### convertsToBoolean()
- **Signature**: `item.convertsToBoolean() : Boolean`
- **Description**: Returns true if the single item can be converted to Boolean.

#### toBoolean()
- **Signature**: `item.toBoolean() : Boolean`
- **Description**: Converts the single item to Boolean if possible, otherwise returns empty.

#### convertsToInteger()
- **Signature**: `item.convertsToInteger() : Boolean`
- **Description**: Returns true if the single item can be converted to Integer.

#### toInteger()
- **Signature**: `item.toInteger() : Integer`
- **Description**: Converts the single item to Integer if possible, otherwise returns empty.

#### convertsToDate()
- **Signature**: `item.convertsToDate() : Boolean`
- **Description**: Returns true if the single item can be converted to Date.

#### toDate()
- **Signature**: `item.toDate() : Date`
- **Description**: Converts the single item to Date if possible, otherwise returns empty.

#### convertsToDateTime()
- **Signature**: `item.convertsToDateTime() : Boolean`
- **Description**: Returns true if the single item can be converted to DateTime.

#### toDateTime()
- **Signature**: `item.toDateTime() : DateTime`
- **Description**: Converts the single item to DateTime if possible, otherwise returns empty.

#### convertsToDecimal()
- **Signature**: `item.convertsToDecimal() : Boolean`
- **Description**: Returns true if the single item can be converted to Decimal.

#### toDecimal()
- **Signature**: `item.toDecimal() : Decimal`
- **Description**: Converts the single item to Decimal if possible, otherwise returns empty.

#### convertsToQuantity()
- **Signature**: `item.convertsToQuantity([unit : String]) : Boolean`
- **Description**: Returns true if the single item can be converted to Quantity, optionally with specified unit.

#### toQuantity()
- **Signature**: `item.toQuantity([unit : String]) : Quantity`
- **Description**: Converts the single item to Quantity if possible, optionally with unit conversion.

#### convertsToString()
- **Signature**: `item.convertsToString() : Boolean`
- **Description**: Returns true if the single item can be converted to String.

#### toString()
- **Signature**: `item.toString() : String`
- **Description**: Converts the single item to String representation if possible, otherwise returns empty.

#### convertsToTime()
- **Signature**: `item.convertsToTime() : Boolean`
- **Description**: Returns true if the single item can be converted to Time.

#### toTime()
- **Signature**: `item.toTime() : Time`
- **Description**: Converts the single item to Time if possible, otherwise returns empty.

### String Manipulation Functions

#### indexOf()
- **Signature**: `string.indexOf(substring : String) : Integer`
- **Description**: Returns 0-based index of first occurrence of substring, or -1 if not found.

#### substring()
- **Signature**: `string.substring(start : Integer [, length : Integer]) : String`
- **Description**: Returns part of string starting at position start. Optional length parameter limits characters returned.

#### startsWith()
- **Signature**: `string.startsWith(prefix : String) : Boolean`
- **Description**: Returns true if the string starts with the given prefix.

#### endsWith()
- **Signature**: `string.endsWith(suffix : String) : Boolean`
- **Description**: Returns true if the string ends with the given suffix.

#### contains()
- **Signature**: `string.contains(substring : String) : Boolean`
- **Description**: Returns true if substring is found within the string.

#### upper()
- **Signature**: `string.upper() : String`
- **Description**: Returns the string with all characters converted to upper case.

#### lower()
- **Signature**: `string.lower() : String`
- **Description**: Returns the string with all characters converted to lower case.

#### replace()
- **Signature**: `string.replace(pattern : String, substitution : String) : String`
- **Description**: Returns string with all instances of pattern replaced with substitution.

#### matches()
- **Signature**: `string.matches(regex : String) : Boolean`
- **Description**: Returns true if the string matches the regular expression.

#### replaceMatches()
- **Signature**: `string.replaceMatches(regex : String, substitution : String) : String`
- **Description**: Replaces regex matches with substitution, supporting match groups.

#### length()
- **Signature**: `string.length() : Integer`
- **Description**: Returns the length of the string.

#### toChars()
- **Signature**: `string.toChars() : collection`
- **Description**: Returns a collection of individual characters from the string.

### Math Functions

#### abs()
- **Signature**: `number.abs() : Integer | Decimal | Quantity`
- **Description**: Returns the absolute value. Units are unchanged for quantities.

#### ceiling()
- **Signature**: `number.ceiling() : Integer`
- **Description**: Returns the first integer greater than or equal to the input.

#### exp()
- **Signature**: `number.exp() : Decimal`
- **Description**: Returns e raised to the power of the input.

#### floor()
- **Signature**: `number.floor() : Integer`
- **Description**: Returns the first integer less than or equal to the input.

#### ln()
- **Signature**: `number.ln() : Decimal`
- **Description**: Returns the natural logarithm (base e) of the input.

#### log()
- **Signature**: `number.log(base : Decimal) : Decimal`
- **Description**: Returns the logarithm of the input in the specified base.

#### power()
- **Signature**: `number.power(exponent : Integer | Decimal) : Integer | Decimal`
- **Description**: Raises number to the exponent power. Returns empty if result cannot be represented.

#### round()
- **Signature**: `number.round([precision : Integer]) : Decimal`
- **Description**: Rounds to nearest whole number, or to specified decimal precision.

#### sqrt()
- **Signature**: `number.sqrt() : Decimal`
- **Description**: Returns the square root. Returns empty if result cannot be represented.

#### truncate()
- **Signature**: `number.truncate() : Integer`
- **Description**: Returns the integer portion of the input.

### Tree Navigation Functions

#### children()
- **Signature**: `node.children() : collection`
- **Description**: Returns all immediate child nodes. Order is undefined.

#### descendants()
- **Signature**: `node.descendants() : collection`
- **Description**: Returns all descendant nodes (not including the input nodes). Shorthand for repeat(children()).

### Utility Functions

#### trace()
- **Signature**: `collection.trace(name : String [, projection : Expression]) : collection`
- **Description**: Logs the collection (or projection result) to diagnostic log with given name. Returns input unchanged.

#### now()
- **Signature**: `now() : DateTime`
- **Description**: Returns current date and time including timezone offset.

#### timeOfDay()
- **Signature**: `timeOfDay() : Time`
- **Description**: Returns current time.

#### today()
- **Signature**: `today() : Date`
- **Description**: Returns current date.

### Special Boolean Function

#### not()
- **Signature**: `boolean.not() : Boolean`
- **Description**: Returns true if input is false, false if input is true, empty if input is empty.

### Backward Compatibility Functions

#### is()
- **Signature**: `item.is(type : TypeInfo) : Boolean`
- **Description**: Backward compatibility function for `is` operator. May be deprecated.

#### as()
- **Signature**: `item.as(type : TypeInfo) : collection`
- **Description**: Backward compatibility function for `as` operator. May be deprecated.