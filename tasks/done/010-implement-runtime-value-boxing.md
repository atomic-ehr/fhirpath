# Task 010: Implement Runtime Value Boxing

## Overview
Implement the runtime value boxing system as specified in ADR-009 to support primitive extensions and maintain type information during FHIRPath evaluation.

## !!!IMPORTANT NOTE!!!:
- DON'T MAINTAIN BACKWARD COMPATIBILITY
- WRITE NEW CLEAN CODE
- WHENEVER YOU STOP WORKING, IF YOU STILL HAVE UNFINISHED WORK, PLEASE TELL ME ABOUT IT ALOUD, SO I WILL ASK YOU TO CONTINUE


## Prerequisites
- ADR-009 approved and finalized
- Understanding of current interpreter architecture
- Test cases for primitive extension navigation

## Implementation Steps

### 1. Define Boxing Infrastructure (Priority: High)
**File**: `src/boxing.ts` (new file)
- [ ] Define `FHIRPathValue<T>` interface
- [ ] Implement `box(value, typeInfo?, primitiveElement?)` function
- [ ] Implement `unbox(boxedValue)` function
- [ ] Implement `ensureBoxed(value)` for interpreter entry
- [ ] Add unit tests for boxing utilities

### 2. Update Interpreter Entry Point (Priority: High)
**File**: `src/interpreter.ts`
- [ ] Modify `evaluate()` to box initial input using `ensureBoxed()`
- [ ] Update `EvaluationResult` type to use boxed values
- [ ] Ensure all node evaluators expect and return boxed values
- [ ] Update context management to handle boxed values

### 3. Update Navigation to Box Values (Priority: High)
**File**: `src/interpreter.ts` - `evaluateIdentifier()`
- [ ] Integrate ModelProvider to get type information during navigation
- [ ] Box navigation results with appropriate `TypeInfo`
- [ ] For primitives, check for `_propertyName` and attach to `primitiveElement`
- [ ] Handle array vs singleton values correctly
- [ ] Add special handling for `.extension` navigation on boxed primitives

### 4. Update Literal and Variable Evaluation (Priority: High)
**Files**: `src/interpreter.ts`
- [ ] Update `evaluateLiteral()` to box literal values
- [ ] Update `evaluateVariable()` to ensure variables are boxed
- [ ] Update `evaluateQuantity()` to box quantity values
- [ ] Update `evaluateCollection()` to handle boxed elements

### 5. Update Binary Operations (Priority: High)
**Files**: `src/operations/*.ts`
- [ ] Arithmetic operators (`+`, `-`, `*`, `/`, `div`, `mod`): unwrap inputs, box results
- [ ] Comparison operators (`=`, `!=`, `<`, `>`, `<=`, `>=`): unwrap inputs, box boolean results
- [ ] Logical operators (`and`, `or`, `xor`, `implies`): unwrap inputs, box boolean results
- [ ] String concatenation (`+`): unwrap strings, box result
- [ ] Contains operators (`contains`, `in`): unwrap inputs, box boolean results

### 6. Update Unary Operations (Priority: High)
**Files**: `src/operations/unary-*.ts`, `src/operations/not-function.ts`
- [ ] Unary minus/plus: unwrap input, box result
- [ ] `not()` function: unwrap input, box boolean result

### 7. Update String Functions (Priority: Medium)
**Files**: `src/operations/*-function.ts`
- [ ] `substring()`, `replace()`, `trim()`: unwrap input, box string result
- [ ] `upper()`, `lower()`: unwrap input, box string result
- [ ] `split()`: unwrap input, box each result string
- [ ] `startsWith()`, `endsWith()`, `contains()`: unwrap inputs, box boolean result
- [ ] `length()`: unwrap input, box integer result

### 8. Update Math Functions (Priority: Medium)
**Files**: `src/operations/*-function.ts`
- [ ] `abs()`, `ceiling()`, `floor()`, `round()`: unwrap input, box result
- [ ] `sqrt()`, `power()`: unwrap inputs, box result
- [ ] `truncate()`: unwrap input, box result

### 9. Update Type Conversion Functions (Priority: High)
**Files**: `src/operations/to*-function.ts`
- [ ] `toString()`: unwrap input, box with String type
- [ ] `toInteger()`: unwrap input, box with Integer type
- [ ] `toDecimal()`: unwrap input, box with Decimal type
- [ ] `toBoolean()`: unwrap input, box with Boolean type

### 10. Update Collection Test Functions (Priority: Medium)
**Files**: `src/operations/*-function.ts`
- [ ] `exists()`, `empty()`: test collection, box boolean result
- [ ] `all()`, `any()`: unwrap expression results, box boolean result
- [ ] `allTrue()`, `allFalse()`, `anyTrue()`, `anyFalse()`: unwrap values, box boolean result
- [ ] `isDistinct()`: unwrap for comparison, box boolean result
- [ ] `count()`: box integer result

### 11. Update Expression-Based Functions (Priority: High)
**Files**: `src/operations/where-function.ts`, `src/operations/select-function.ts`, etc.
- [ ] `where()`: unwrap condition result to test, preserve item boxes in output
- [ ] `select()`: expression returns boxed values, collect them
- [ ] `aggregate()`: handle boxed accumulator and values
- [ ] `iif()`: unwrap condition, return boxed branch result

### 12. Update Collection Operations (Priority: Medium)
**Files**: `src/operations/*-function.ts`, `src/operations/*-operator.ts`
- [ ] `union()`, `combine()`: pass through boxed values
- [ ] `intersect()`, `exclude()`: preserve boxes during filtering
- [ ] `distinct()`: compare unwrapped values, preserve unique boxes
- [ ] `first()`, `last()`, `single()`: pass through boxed values
- [ ] `tail()`, `take()`, `skip()`: pass through boxed values from collection

### 13. Update Special Operations (Priority: Low)
**Files**: `src/operations/*-function.ts`
- [ ] `trace()`: pass through boxes, log unwrapped values
- [ ] `defineVariable()`: ensure variable value is boxed

### 14. Update Type Operations (Priority: Low - for future)
**Files**: `src/operations/as-operator.ts`, `src/operations/is-operator.ts`
- [ ] `as`: update to work with boxed values
- [ ] `is`: update to work with boxed values
- [ ] Note: Full implementation depends on `ofType()` and `children()` functions

### 15. Testing (Priority: High)
**Files**: `test/*.test.ts`, new test files
- [ ] Create comprehensive tests for primitive extension navigation
- [ ] Test all operation categories with boxed values
- [ ] Test edge cases (null values, empty collections, mixed types)
- [ ] Performance benchmarks to measure boxing overhead
- [ ] Integration tests with ModelProvider

### 16. Documentation (Priority: Medium)
- [ ] Update code comments to reflect boxing behavior
- [ ] Add examples of primitive extension navigation
- [ ] Document boxing/unboxing patterns for future operations
- [ ] Update README if needed

## Success Criteria
- [ ] `Patient.gender.extension` navigation works correctly
- [ ] All existing tests pass with boxed values
- [ ] Type information preserved throughout evaluation
- [ ] No performance regression > 10%
- [ ] Clean, consistent boxing/unboxing patterns

## Estimated Effort
- Total: 3-5 days
- High priority items: 2-3 days
- Medium priority items: 1-2 days
- Low priority items: Future work

## Notes
- Start with high-priority items to get core functionality working
- Run tests frequently to catch regressions early
- Consider creating a feature branch for this work
- Type operations (as, is, ofType) can be implemented later as they depend on additional functionality