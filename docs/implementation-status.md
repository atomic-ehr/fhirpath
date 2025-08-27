# FHIRPath Implementation Status

Generated: 2025-08-26T (manually updated)

## Summary

### Functions
- **Total Functions**: 80
- **Implemented**: 48 (60%)
- **Fully Tested**: 42 (88% of implemented)
- **Partially Tested**: 6
- **Untested**: 0

### Operators
- **Total Operators**: 30
- **Implemented**: 26 (87%)
- **Fully Tested**: 23 (88% of implemented)
- **Partially Tested**: 3
- **Untested**: 0

## Functions Implementation Status

### Existence Functions (12/12 implemented)

| Function | Status | Implementation | Tests | Coverage | Notes |
|----------|--------|----------------|-------|----------|-------|
| all | ✅ | operations/all-function.ts | 23 files | Full | - |
| allFalse | ✅ | operations/allFalse-function.ts | 3 files | Full | - |
| allTrue | ✅ | operations/allTrue-function.ts | 3 files | Full | - |
| anyFalse | ✅ | operations/anyFalse-function.ts | 2 files | Full | - |
| anyTrue | ✅ | operations/anyTrue-function.ts | 2 files | Full | - |
| count | ✅ | operations/count-function.ts | 14 files | Full | - |
| distinct | ✅ | operations/distinct-function.ts | 6 files | Full | - |
| empty | ✅ | operations/empty-function.ts | 73 files | Full | - |
| exists | ✅ | operations/exists-function.ts | 17 files | Full | - |
| isDistinct | ✅ | operations/isDistinct-function.ts | 2 files | Partial | - |
| subsetOf | ✅ | operations/subsetOf-function.ts | 2 files | Full | - |
| supersetOf | ✅ | operations/supersetOf-function.ts | 2 files | Full | - |

### Filtering and Projection Functions (3/4 implemented)

| Function | Status | Implementation | Tests | Coverage | Notes |
|----------|--------|----------------|-------|----------|-------|
| ofType | ✅ | operations/ofType-function.ts | 10 files | Full | - |
| repeat | ❌ | - | - | - | Not implemented |
| select | ✅ | operations/select-function.ts | 28 files | Full | - |
| where | ✅ | operations/where-function.ts | 34 files | Full | - |

### Subsetting Functions (9/9 implemented)

| Function | Status | Implementation | Tests | Coverage | Notes |
|----------|--------|----------------|-------|----------|-------|
| [index] | ✅ | interpreter.ts:669-686, parser.ts:333-343 | 110 files | Full | - |
| exclude | ✅ | operations/exclude-function.ts | 1 file | Partial | - |
| first | ✅ | operations/first-function.ts | 30 files | Full | - |
| intersect | ✅ | operations/intersect-function.ts | 1 file | Partial | - |
| last | ✅ | operations/last-function.ts | 6 files | Full | - |
| single | ✅ | operations/single-function.ts | 22 files | Full | - |
| skip | ✅ | operations/skip-function.ts | 7 files | Full | - |
| tail | ✅ | operations/tail-function.ts | 6 files | Full | - |
| take | ✅ | operations/take-function.ts | 1 file | Partial | - |

### Combining Functions (2/2 implemented)

| Function | Status | Implementation | Tests | Coverage | Notes |
|----------|--------|----------------|-------|----------|-------|
| combine | ✅ | operations/combine-function.ts | 4 files | Full | - |
| union | ✅ | operations/union-function.ts | 10 files | Full | - |

### Conversion Functions (8/19 implemented)

| Function | Status | Implementation | Tests | Coverage | Notes |
|----------|--------|----------------|-------|----------|-------|
| convertsToBoolean | ❌ | - | - | - | Not implemented |
| convertsToDate | ❌ | - | - | - | Not implemented |
| convertsToDateTime | ❌ | - | - | - | Not implemented |
| convertsToDecimal | ❌ | - | - | - | Not implemented |
| convertsToInteger | ❌ | - | - | - | Not implemented |
| convertsToLong | ❌ | - | - | - | Not implemented |
| convertsToQuantity | ❌ | - | - | - | Not implemented |
| convertsToString | ❌ | - | - | - | Not implemented |
| convertsToTime | ❌ | - | - | - | Not implemented |
| iif | ✅ | operations/iif-function.ts | 6 files | Full | - |
| toBoolean | ✅ | operations/toBoolean-function.ts | 2 files | Full | - |
| toDate | ✅ | operations/temporal-functions.ts | 2 files | Full | - |
| toDateTime | ✅ | operations/temporal-functions.ts | 2 files | Full | - |
| toDecimal | ✅ | operations/toDecimal-function.ts | 2 files | Full | - |
| toInteger | ✅ | operations/toInteger-function.ts | 4 files | Full | - |
| toLong | ❌ | - | - | - | Not implemented |
| toQuantity | ❌ | - | - | - | Not implemented |
| toString | ✅ | operations/toString-function.ts | 7 files | Full | - |
| toTime | ✅ | operations/temporal-functions.ts | 2 files | Full | - |

### String Manipulation Functions (9/14 implemented)

| Function | Status | Implementation | Tests | Coverage | Notes |
|----------|--------|----------------|-------|----------|-------|
| contains | ✅ | operations/contains-function.ts | 10 files | Full | - |
| endsWith | ✅ | operations/endsWith-function.ts | 6 files | Full | - |
| indexOf | ✅ | operations/indexOf-function.ts | 5 files | Full | - |
| lastIndexOf | ❌ | - | - | - | Not implemented |
| length | ✅ | operations/length-function.ts | 24 files | Full | - |
| lower | ✅ | operations/lower-function.ts | 5 files | Full | - |
| matches | ❌ | - | 6 files | - | Not implemented |
| matchesFull | ❌ | - | - | - | Not implemented |
| replace | ✅ | operations/replace-function.ts | 7 files | Full | - |
| replaceMatches | ❌ | - | - | - | Not implemented |
| startsWith | ✅ | operations/startsWith-function.ts | 6 files | Full | - |
| substring | ✅ | operations/substring-function.ts | 14 files | Full | - |
| toChars | ❌ | - | - | - | Not implemented |
| upper | ✅ | operations/upper-function.ts | 6 files | Full | - |

### Tree Navigation Functions (2/2 implemented)

| Function | Status | Implementation | Tests | Coverage | Notes |
|----------|--------|----------------|-------|----------|-------|
| children | ✅ | operations/children-function.ts | 5 files | Full | - |
| descendants | ✅ | operations/descendants-function.ts | 1 file | Partial | - |

### Utility Functions (3/18 implemented)

| Function | Status | Implementation | Tests | Coverage | Notes |
|----------|--------|----------------|-------|----------|-------|
| dateOf | ❌ | - | - | - | Not implemented |
| dayOf | ❌ | - | - | - | Not implemented |
| defineVariable | ✅ | operations/defineVariable-function.ts | 7 files | Full | - |
| highBoundary | ❌ | - | - | - | Not implemented |
| hourOf | ❌ | - | - | - | Not implemented |
| lowBoundary | ❌ | - | - | - | Not implemented |
| millisecondOf | ❌ | - | - | - | Not implemented |
| minuteOf | ❌ | - | - | - | Not implemented |
| monthOf | ❌ | - | - | - | Not implemented |
| now | ❌ | - | 9 files | - | Not implemented |
| precision | ✅ | operations/round-function.ts | 1 file | Partial | - |
| secondOf | ❌ | - | - | - | Not implemented |
| timeOf | ❌ | - | - | - | Not implemented |
| timeOfDay | ❌ | - | - | - | Not implemented |
| timezoneOffsetOf | ❌ | - | - | - | Not implemented |
| today | ❌ | - | - | - | Not implemented |
| trace | ✅ | operations/trace-function.ts | 4 files | Full | - |
| yearOf | ❌ | - | - | - | Not implemented |

## Operators Implementation Status

| Operator | Status | Implementation | Tests | Coverage | Notes |
|----------|--------|----------------|-------|----------|-------|
| `-` | ✅ | operations/minus-operator.ts | 53 files | Full | - |
| `,` | ✅ | operations/split-function.ts | 118 files | Full | - |
| `;` | ❌ | - | 30 files | - | Not implemented |
| `!=` | ✅ | operations/not-equal-operator.ts | 14 files | Full | - |
| `!~` | ✅ | operations/not-equivalent-operator.ts | 3 files | Partial | - |
| `.` | ✅ | operations/dot-operator.ts | 119 files | Full | - |
| `()` | ❌ | - | 81 files | - | Not implemented |
| `[]` | ❌ | - | 91 files | - | Not implemented |
| `{}` | ❌ | - | 59 files | - | Not implemented |
| `*` | ✅ | operations/multiply-operator.ts | 11 files | Partial | - |
| `/` | ✅ | operations/divide-operator.ts | 36 files | Full | - |
| `&` | ✅ | operations/combine-operator.ts | 12 files | Full | - |
| `+` | ✅ | operations/plus-operator.ts | 35 files | Full | - |
| `<` | ✅ | operations/less-than.ts | 20 files | Full | - |
| `<=` | ✅ | operations/less-or-equal-operator.ts | 10 files | Full | - |
| `=` | ✅ | operations/equal-operator.ts | 54 files | Full | - |
| `>` | ✅ | operations/greater-operator.ts | 47 files | Full | - |
| `>=` | ✅ | operations/greater-or-equal-operator.ts | 9 files | Full | - |
| `|` | ✅ | operations/union-operator.ts | 70 files | Full | - |
| `~` | ✅ | operations/equivalent-operator.ts | 5 files | Partial | - |
| `and` | ✅ | operations/and-operator.ts | 30 files | Full | - |
| `as` | ✅ | operations/as-operator.ts | 36 files | Full | - |
| `contains` | ✅ | operations/contains-operator.ts | 10 files | Full | - |
| `div` | ✅ | operations/div-operator.ts | 10 files | Full | - |
| `implies` | ✅ | operations/implies-operator.ts | 6 files | Full | - |
| `in` | ✅ | operations/in-operator.ts | 70 files | Full | - |
| `is` | ✅ | operations/is-operator.ts | 53 files | Full | - |
| `mod` | ✅ | operations/mod-operator.ts | 20 files | Full | - |
| `or` | ✅ | operations/or-operator.ts | 48 files | Full | - |
| `xor` | ✅ | operations/xor-operator.ts | 6 files | Full | - |

## Priority Lists

### High Priority - Not Implemented Functions

#### Conversion Functions
- convertsToBoolean
- convertsToInteger
- toLong
- convertsToLong
- convertsToDecimal
- convertsToString
- toDate
- convertsToDate
- toDateTime
- convertsToDateTime
- toTime
- convertsToTime
- toQuantity
- convertsToQuantity

### Implemented but Untested

## Test File Index

### Functions by Test File

**test-cases/context-flow.json**
  Tests: select, [index], defineVariable, ., in, [], ,

**test-cases/errors/evaluation-errors.json**
  Tests: [index], single, ., /, in, [], (), ,

**test-cases/errors/parse-errors.json**
  Tests: [index], +, ., [], ,

**test-cases/errors/type-errors.json**
  Tests: [index], substring, +, ., in, [], ,

**test-cases/errors/variable-errors.json**
  Tests: where, select, [index], first, defineVariable, &, +, ., =, >, in, is, |, [], (), ,

**test-cases/input/patient-example.json**
  Tests: ., div, []

**test-cases/integration/complex-expressions.json**
  Tests: where, select, [index], +, ., =, >, [], ,

**test-cases/metadata.json**
  Tests: []

**test-cases/navigation.json**
  Tests: empty, [index], ., [], ,

**test-cases/operations/aggregates/aggregate.json**
  Tests: empty, count, [index], iif, toString, substring, +, ., <, =, >, in, is, |, [], (), ,

**test-cases/operations/arithmetic/concat.json**
  Tests: empty, [index], first, &, ., and, in, is, or, [], (), {}, ,

**test-cases/operations/arithmetic/div.json**
  Tests: [index], ., /, div, [], ,

**test-cases/operations/arithmetic/divide.json**
  Tests: ., /, [], ,

**test-cases/operations/arithmetic/minus.json**
  Tests: -, ., [], ,

**test-cases/operations/arithmetic/mod.json**
  Tests: [index], ., mod, [], ,

**test-cases/operations/arithmetic/multiply.json**
  Tests: ., [], ,

**test-cases/operations/arithmetic/plus.json**
  Tests: [index], +, ., [], ,

**test-cases/operations/collection/combine.json**
  Tests: empty, select, [index], combine, +, ., as, in, is, |, [], (), {}, ,

**test-cases/operations/collection/exclude.json**
  Tests: empty, all, [index], single, exclude, ., |, [], {}, ,

**test-cases/operations/collection/intersect.json**
  Tests: empty, [index], intersect, ., in, |, [], {}, ,

**test-cases/operations/collection/union.json**
  Tests: select, [index], union, defineVariable, ., in, |, [], ,

**test-cases/operations/comparison/eq.json**
  Tests: empty, [index], !=, ., <, <=, =, >, >=, or, |, [], {}, ,

**test-cases/operations/comparison/gt.json**
  Tests: ., =, >, >=, [], ,

**test-cases/operations/comparison/gte.json**
  Tests: ., =, >, >=, [], ,

**test-cases/operations/comparison/lt.json**
  Tests: [index], ., <, <=, =, [], ,

**test-cases/operations/comparison/lte.json**
  Tests: ., <, <=, =, [], ,

**test-cases/operations/comparison/neq.json**
  Tests: empty, [index], !=, ., =, or, |, [], {}, ,

**test-cases/operations/existence/all.json**
  Tests: empty, exists, all, allTrue, allFalse, [index], length, ., <, =, >, >=, in, is, mod, or, |, [], (), {}, ,

**test-cases/operations/existence/allFalse.json**
  Tests: empty, all, allFalse, where, select, [index], ., <, <=, =, is, [], (), {}, ,

**test-cases/operations/existence/allTrue.json**
  Tests: empty, all, allTrue, where, select, [index], ., >, is, [], (), {}, ,

**test-cases/operations/existence/anyFalse.json**
  Tests: empty, anyFalse, select, [index], ., >, in, |, [], (), {}, ,

**test-cases/operations/existence/anyTrue.json**
  Tests: empty, anyTrue, select, [index], ., >, in, |, [], (), {}, ,

**test-cases/operations/existence/count.json**
  Tests: count, [index], ., [], (), {}, ,

**test-cases/operations/existence/distinct.json**
  Tests: distinct, [index], ., in, is, [], (), ,

**test-cases/operations/existence/empty.json**
  Tests: empty, [index], ., in, is, [], (), {}, ,

**test-cases/operations/existence/exists.json**
  Tests: exists, [index], ., >, in, is, [], (), ,

**test-cases/operations/existence/isDistinct.json**
  Tests: empty, isDistinct, [index], ., in, is, |, [], (), {}, ,

**test-cases/operations/existence/subsetOf.json**
  Tests: empty, subsetOf, where, [index], first, ., =, in, is, |, [], (), {}, ,

**test-cases/operations/existence/supersetOf.json**
  Tests: empty, supersetOf, where, [index], first, ., =, in, is, |, [], (), {}, ,

**test-cases/operations/filtering/ofType.json**
  Tests: empty, ofType, [index], ., as, in, [], ,

**test-cases/operations/filtering/select.json**
  Tests: empty, exists, where, select, [index], first, last, union, contains, defineVariable, &, +, -, ., =, as, contains, in, is, |, [], (), {}, ,

**test-cases/operations/filtering/where.json**
  Tests: empty, where, [index], ., <, >, and, in, is, [], {}, ,

**test-cases/operations/index.json**
  Tests: [index], -, ., in, is, [], ,

**test-cases/operations/literals.json**
  Tests: [index], -, ., |, [], {}, ,

**test-cases/operations/logical/and.json**
  Tests: [index], ., and, [], {}, ,

**test-cases/operations/logical/implies.json**
  Tests: [index], ., implies, [], ,

**test-cases/operations/logical/not.json**
  Tests: empty, exists, [index], ., =, is, |, [], (), {}, ,

**test-cases/operations/logical/or.json**
  Tests: [index], ., and, implies, or, xor, [], {}, ,

**test-cases/operations/logical/xor.json**
  Tests: [index], ., or, xor, [], ,

**test-cases/operations/math/abs.json**
  Tests: empty, [index], -, ., |, [], (), ,

**test-cases/operations/math/ceiling.json**
  Tests: empty, [index], -, ., in, |, [], (), ,

**test-cases/operations/math/floor.json**
  Tests: empty, -, ., or, |, [], (), ,

**test-cases/operations/math/power.json**
  Tests: empty, [index], -, ., |, [], (), ,

**test-cases/operations/math/round.json**
  Tests: empty, [index], precision, -, ., |, [], (), ,

**test-cases/operations/math/sqrt.json**
  Tests: empty, -, ., |, [], (), ,

**test-cases/operations/math/truncate.json**
  Tests: empty, [index], !=, -, ., =, or, |, [], (), ,

**test-cases/operations/membership/contains.json**
  Tests: empty, [index], contains, ., contains, in, |, [], {}, ,

**test-cases/operations/membership/in.json**
  Tests: empty, [index], contains, ., contains, in, |, [], {}, ,

**test-cases/operations/navigation/children.json**
  Tests: empty, exists, count, distinct, where, ofType, [index], first, last, children, ., =, as, in, is, [], (), ,

**test-cases/operations/navigation/descendants.json**
  Tests: empty, exists, count, distinct, isDistinct, where, ofType, [index], descendants, ., =, >, and, in, is, [], (), {}, ,

**test-cases/operations/quantity/arithmetic.json**
  Tests: [index], +, -, ., /, [], ,

**test-cases/operations/quantity/comparison.json**
  Tests: [index], !=, ., <, <=, =, >, >=, [], ,

**test-cases/operations/quantity/literals.json**
  Tests: [index], -, ., in, is, [], ,

**test-cases/operations/string/contains.json**
  Tests: empty, where, [index], contains, ., =, and, contains, in, is, or, |, [], (), {}, ,

**test-cases/operations/string/endsWith.json**
  Tests: empty, [index], first, endsWith, +, ., or, |, [], (), ,

**test-cases/operations/string/indexOf.json**
  Tests: empty, [index], first, indexOf, ., in, or, |, [], (), {}, ,

**test-cases/operations/string/join.json**
  Tests: empty, select, [index], -, ., and, in, or, |, [], (), {}, ,

**test-cases/operations/string/length.json**
  Tests: empty, where, select, [index], first, substring, length, +, ., >, in, or, |, [], (), {}, ,

**test-cases/operations/string/lower.json**
  Tests: empty, select, [index], upper, lower, -, ., or, |, [], (), {}, ,

**test-cases/operations/string/replace.json**
  Tests: empty, [index], replace, -, ., =, |, [], (), {}, ,

**test-cases/operations/string/split.json**
  Tests: empty, [index], ., /, <, <=, =, >, in, or, |, [], (), {}, ,, ;

**test-cases/operations/string/startsWith.json**
  Tests: empty, [index], first, startsWith, -, ., or, |, [], (), {}, ,

**test-cases/operations/string/substring.json**
  Tests: empty, select, [index], first, indexOf, substring, length, -, ., =, in, |, [], (), {}, ,

**test-cases/operations/string/trim.json**
  Tests: empty, [index], first, ., /, or, |, [], (), {}, ,

**test-cases/operations/string/upper.json**
  Tests: empty, select, [index], first, upper, -, ., or, |, [], (), {}, ,

**test-cases/operations/subsetting/first.json**
  Tests: empty, [index], first, ., [], (), {}, ,

**test-cases/operations/subsetting/last.json**
  Tests: empty, [index], last, ., as, [], (), {}, ,

**test-cases/operations/subsetting/single.json**
  Tests: empty, where, [index], single, ., >, in, is, |, [], (), {}, ,

**test-cases/operations/subsetting/skip.json**
  Tests: empty, [index], skip, -, ., [], ,

**test-cases/operations/subsetting/tail.json**
  Tests: empty, [index], first, tail, ., |, [], (), {}, ,

**test-cases/operations/subsetting/take.json**
  Tests: empty, [index], take, +, -, ., |, [], (), {}, ,

**test-cases/operations/type-conversion/toBoolean.json**
  Tests: empty, [index], toBoolean, -, ., |, [], (), {}, ,

**test-cases/operations/type-conversion/toDecimal.json**
  Tests: empty, [index], toDecimal, +, -, ., |, [], (), {}, ,

**test-cases/operations/type-conversion/toInteger.json**
  Tests: empty, [index], toInteger, +, -, ., |, [], (), {}, ,

**test-cases/operations/type-conversion/toString.json**
  Tests: empty, [index], first, toString, -, ., in, [], (), {}, ,

**test-cases/operations/type-operators/as.json**
  Tests: empty, where, [index], ., as, in, is, |, [], ,

**test-cases/operations/type-operators/is.json**
  Tests: empty, where, [index], ., in, is, |, [], ,

**test-cases/operations/utility/defineVariable.json**
  Tests: exists, where, select, [index], first, skip, replace, trace, defineVariable, &, +, -, ., in, is, |, [], (), ,

**test-cases/operations/utility/iif.json**
  Tests: empty, exists, all, count, select, [index], iif, toString, !=, +, -, ., /, =, >, as, in, is, |, [], (), {}, ,

**test-cases/operations/utility/trace.json**
  Tests: empty, count, where, [index], trace, ., =, or, |, [], (), {}, ,

**test-cases/variables.json**
  Tests: empty, select, [index], +, ., in, is, [], ,

**test/analyzer-cursor-mode.test.ts**
  Tests: all, where, [index], single, length, +, -, ., /, =, >, and, as, in, is, mod, or, |, (), ,, ;

**test/analyzer-navigation.test.ts**
  Tests: [index], single, first, startsWith, length, now, -, ., /, =, >, and, as, in, is, mod, or, (), ,, ;

**test/analyzer.test.ts**
  Tests: exists, all, subsetOf, supersetOf, count, where, select, [index], single, first, skip, iif, toString, union, combine, substring, matches, length, now, defineVariable, !=, &, *, +, -, ., /, =, >, and, as, in, is, mod, or, |, (), ,, ;

**test/boxing-integration.test.ts**
  Tests: [index], +, -, ., /, =, >, and, as, in, or, |, (), ,, ;

**test/boxing.test.ts**
  Tests: empty, all, [index], single, length, *, -, ., /, =, >, and, as, in, is, or, (), {}, ,, ;

**test/children-function.test.ts**
  Tests: where, select, ofType, [index], single, first, union, length, children, &, -, ., /, <, =, >, as, in, is, mod, or, |, (), {}, ,, ;

**test/collection-equality.test.ts**
  Tests: empty, distinct, [index], single, union, length, !=, ., /, =, >, and, as, in, is, or, |, (), {}, ,, ;

**test/completion-provider.test.ts**
  Tests: empty, all, count, where, select, ofType, [index], single, first, last, tail, startsWith, contains, matches, length, now, +, -, ., /, =, >, and, as, contains, div, in, is, mod, or, ~, (), {}, ,, ;

**test/completion-singleton-collection.test.ts**
  Tests: empty, exists, count, distinct, where, select, [index], single, first, last, toInteger, toString, substring, startsWith, endsWith, upper, lower, replace, length, -, ., /, =, >, and, as, in, is, mod, or, |, (), {}, ,, ;

**test/cursor-nodes.test.ts**
  Tests: all, where, ofType, [index], substring, length, -, ., /, =, >, and, as, in, is, or, |, (), ,, ;

**test/empty-propagation.test.ts**
  Tests: empty, exists, all, allTrue, anyTrue, allFalse, anyFalse, count, where, ofType, [index], single, iif, toBoolean, toInteger, toDecimal, toString, toDate, toDateTime, toTime, union, combine, indexOf, substring, startsWith, endsWith, contains, upper, lower, replace, length, !=, *, +, -, ., /, <, <=, =, >, >=, and, as, contains, div, in, is, mod, or, |, (), {}, ,, ;

**test/inspect.test.ts**
  Tests: empty, exists, all, count, where, [index], first, tail, length, trace, now, *, +, -, ., /, =, >, and, as, in, is, or, (), ,, ;

**test/interpreter.test.ts**
  Tests: empty, exists, all, count, distinct, where, select, [index], first, last, iif, combine, length, now, defineVariable, !=, *, +, -, ., /, <, =, >, and, as, div, in, is, or, |, (), {}, ,, ;

**test/lexer.test.ts**
  Tests: empty, exists, all, where, select, [index], single, first, skip, substring, contains, matches, !=, !~, &, *, +, -, ., /, <, <=, =, >, >=, and, as, contains, div, implies, in, is, mod, or, xor, |, ~, (), {}, ,, ;

**test/model-provider.test.ts**
  Tests: empty, all, ofType, [index], single, tail, union, matches, length, children, now, -, ., /, =, >, and, as, in, is, mod, or, |, (), ,, ;

**test/parser-errors.test.ts**
  Tests: empty, [index], single, length, -, ., /, =, >, and, as, in, or, |, (), {}, ,, ;

**test/parser-fixtures.test.ts**
  Tests: all, count, [index], tail, substring, endsWith, replace, length, *, +, -, ., /, <, =, >, as, in, is, or, |, (), ,, ;

**test/parser-lsp-mode.test.ts**
  Tests: where, [index], first, length, &, +, -, ., /, =, >, as, in, mod, or, (), ,, ;

**test/parser.test.ts**
  Tests: empty, all, count, where, [index], single, first, iif, toInteger, union, indexOf, substring, contains, upper, length, !=, !~, &, *, +, -, ., /, <, <=, =, >, >=, and, as, contains, div, implies, in, is, mod, or, xor, |, ~, (), {}, ,, ;

**test/quantity-value.test.ts**
  Tests: all, [index], first, +, -, ., /, <, =, >, and, as, div, in, is, or, (), ,, ;

**test/registry-type-aware.test.ts**
  Tests: empty, exists, where, select, [index], single, toString, indexOf, substring, startsWith, endsWith, contains, upper, lower, replace, length, trace, now, !=, *, +, -, ., /, <, =, >, and, as, contains, div, implies, in, is, mod, or, xor, ~, (), ,, ;

**test/registry.test.ts**
  Tests: empty, all, where, select, [index], single, first, contains, lower, now, !=, !~, &, *, +, -, ., /, <, <=, =, >, >=, and, as, contains, div, implies, in, is, mod, or, xor, |, ~, (), ,, ;

**test/singleton-error.test.ts**
  Tests: [index], single, substring, matches, ., /, =, >, as, in, is, or, (), ,, ;

**test/system-variables.test.ts**
  Tests: exists, where, select, [index], single, first, union, length, children, +, -, ., /, <, =, >, and, as, in, is, mod, or, |, (), {}, ,, ;

**test/test-cases.test.ts**
  Tests: exists, all, [index], tail, skip, endsWith, replace, length, !=, &, +, -, ., /, <, =, >, as, in, is, mod, or, |, (), ,, ;

**test/trivia.test.ts**
  Tests: all, [index], skip, *, +, ., /, =, >, and, as, in, is, or, |, (), ,, ;

**test/type-checking.test.ts**
  Tests: all, where, select, [index], single, union, substring, length, children, now, &, +, -, ., /, =, >, and, as, in, is, mod, or, |, (), {}, ,, ;

**test/type-operation-validation.test.ts**
  Tests: ofType, [index], single, skip, -, ., /, =, >, as, in, is, mod, or, |, (), ,, ;

**test/type-operations.test.ts**
  Tests: empty, all, where, ofType, [index], matches, -, ., /, =, >, and, as, in, is, mod, or, |, (), ,, ;
