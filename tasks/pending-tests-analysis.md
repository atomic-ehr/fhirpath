# Pending Tests Analysis

## Overview
**Total**: 22 pending tests across 13 files

## Categories

### 1. Error Handling (11 tests)

#### Parse Errors (3 tests)
- **unclosed string literal**: `'hello` - Parser should detect unclosed strings
- **invalid operator**: `5 ** 3` - Parser should reject unknown operators
- **missing closing parenthesis**: `(5 + 3` - Parser should detect unmatched parentheses

#### Type Errors (2 tests)
- **string + number**: `'hello' + 5` - Should error on incompatible types
- **invalid function argument type**: `substring('hello', 'not a number')` - Should validate argument types

#### Evaluation Errors (2 tests)
- **division by zero**: `5 / 0` - Should handle division by zero gracefully
- **single() with multiple items**: Should error when single() is called on collection with multiple items

#### Variable Errors (4 tests)
- **redefining variable in same scope**: `defineVariable('x', 5).defineVariable('x', 10)` - Should error on redefinition
- **overriding system variables**: Should prevent overriding $this, $index, $total

### 2. Missing Functionality (7 tests)

#### Not Implemented Functions/Features
- **resolve() function**: Used in `generalPractitioner.all($this.resolve() is Practitioner)`
- **null literal**: `null` should be treated as empty collection
- **substring matching in 'in' operator**: `'a' in 'abc'` should return true
- **toString() function**: Used in `'123456789'.contains(length().toString())`
- **Dynamic variable names**: `defineVariable(defineVariable('param','ppp').select(%param), ...)`

#### Complex Type Inference
- **aggregate without init**: Cannot infer result type without init parameter (2 tests)

### 3. Implementation Issues (4 tests)

#### Collection Comparison
- **collection inequality**: `{1, 2} != {1, 2, 3}` - Not working correctly (2 tests)

#### Type System Strictness
- **anyFalse with non-boolean**: Analyzer enforces boolean type but runtime should skip non-booleans
- **System variable protection**: defineVariable should prevent using system variable names

## Priority Recommendations

### High Priority (Core Functionality)
1. **Error handling tests** - Important for robustness
2. **System variable protection** - Security/correctness issue
3. **Collection inequality** - Basic operator functionality

### Medium Priority (Common Use Cases)
1. **toString() function** - Commonly used conversion
2. **null literal handling** - Important for compatibility
3. **Variable redefinition checking** - Prevents bugs

### Low Priority (Edge Cases)
1. **resolve() function** - FHIR-specific, less common
2. **Dynamic variable names** - Complex edge case
3. **Substring matching in 'in'** - Alternative syntax available
4. **Aggregate type inference without init** - Can work around with explicit init

## Implementation Effort Estimate

### Quick Fixes (< 1 hour each)
- System variable protection in defineVariable
- Variable redefinition checking
- null literal handling
- Division by zero error

### Medium Effort (1-3 hours each)
- Parse error improvements
- Type error messages
- toString() function
- Collection inequality fix

### Complex (3+ hours)
- resolve() function (FHIR-specific)
- Dynamic variable names
- Aggregate type inference
- Substring matching in 'in' operator