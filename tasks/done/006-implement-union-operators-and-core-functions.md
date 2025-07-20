# Task 006: Implement Union Operators and Core Functions ✓

## Overview
Extend the FHIRPath interpreter to support union operators (`|`, `=`) and essential functions (`where`, `select`, `iif`, `defineVariable`). These are critical for real-world FHIRPath expressions.

## Completion Summary

**Status**: ✅ Completed

### What Was Done

Successfully implemented all requested operators and functions with full test coverage:

#### 1. Union Operator (`|`) ✅
- Implemented in `evaluateUnion()` method
- Combines collections from multiple expressions
- Preserves order and duplicates (no deduplication)
- Threads context through operands

#### 2. Enhanced Equality Operator (`=`) ✅
- Created `collectionEquals()` method in operators.ts
- Properly handles collection comparisons
- Implements singleton conversion rules
- Returns empty for comparisons with empty collections

#### 3. Function Registry System ✅
- Created `src/interpreter/functions.ts` with registry pattern
- Supports functions with controlled argument evaluation
- Clean dispatch mechanism with arity checking
- Extensible design for future functions

#### 4. Core Functions Implemented ✅

**`where(expression)`** - Iterator function for filtering:
- Sets `$this` context for each item
- Evaluates predicate expression
- Returns items where predicate is true
- Example: `name.where(use = 'official')`

**`select(expression)`** - Iterator function for transformation:
- Sets `$this` context for each item
- Evaluates transformation expression
- Flattens results automatically
- Example: `name.select(given | family)`

**`iif(condition, then, else)`** - Conditional with lazy evaluation:
- Only evaluates the needed branch
- Context flows from condition through branches
- Treats empty as false
- Example: `iif(active, 'Active', 'Inactive')`

**`defineVariable(name, value)`** - Context modification:
- Adds variable to context permanently
- Returns original input unchanged
- Variable available in subsequent expressions
- Example: `defineVariable('x', value).otherValue + %x`

**`first()`** - Bonus function added for tests:
- Returns first item from collection
- Returns empty if collection is empty

### Key Implementation Details

1. **Context Threading Fix**: Modified binary operators to thread context from left to right, ensuring variables defined on the left are available on the right side of operators.

2. **Function Argument Control**: Functions can control whether arguments are pre-evaluated or passed as AST nodes for lazy evaluation.

3. **Collection Semantics**: All functions properly handle empty collections and maintain FHIRPath's collection-based semantics.

### Testing

Added comprehensive test suite with 18 new tests covering:
- Union operator with multiple operands
- Collection equality comparisons
- `where()` with simple and complex predicates
- `select()` with transformations and unions
- `iif()` with lazy evaluation
- `defineVariable()` with chaining and usage

All 63 interpreter tests passing!

### Example Usage

```typescript
// Filtering
evaluateFHIRPath("name.where(use = 'official').given", patient);

// Transformation
evaluateFHIRPath("name.select(given | family)", patient);

// Conditional
evaluateFHIRPath("iif(age > 18, 'Adult', 'Minor')", data);

// Variables
evaluateFHIRPath("defineVariable('threshold', 10).values.where($this > %threshold)", data);

// Union
evaluateFHIRPath("Patient.name.given | Patient.name.family", bundle);
```

The interpreter now supports most common FHIRPath patterns and is ready for real-world usage!

## Requirements

### 1. Union Operator (`|`)
The union operator combines collections from multiple expressions:
- Evaluates all operands with the same input/context
- Combines results preserving order
- NO duplicate removal (that's what `union()` function does)

Example:
```fhirpath
Patient.name.given | Patient.name.family
// If given = ['John', 'J'] and family = ['Doe', 'Smith']
// Result: ['John', 'J', 'Doe', 'Smith']
```

### 2. Equality Operator (`=`) Enhancement
Currently implemented for simple values. Need to enhance for collections:
- Collection equality: same elements in same order
- Singleton conversion applies
- Empty propagation rules

Example:
```fhirpath
name.given = 'John'  // true if given contains exactly ['John']
```

### 3. `where()` Function
Iterator function that filters the input collection:
- Takes an expression as argument
- Evaluates expression for each item with `$this` set
- Returns items where expression evaluates to true

Example:
```fhirpath
Patient.name.where(use = 'official')
// Returns only names where use field equals 'official'
```

### 4. `select()` Function
Iterator function that transforms each item:
- Takes an expression as argument
- Evaluates expression for each item with `$this` set
- Returns collection of results (flattened)

Example:
```fhirpath
Patient.name.select(given | family)
// Returns all given and family names from all name entries
```

### 5. `iif()` Function
Conditional function with lazy evaluation:
- Takes 3 arguments: condition, then-expr, else-expr
- Only evaluates the branch that's needed
- Context flows from the evaluated branch

Example:
```fhirpath
iif(gender = 'male', 'Mr. ' + name.given, 'Ms. ' + name.given)
```

### 6. `defineVariable()` Function
Modifies context by adding a variable:
- Takes variable name and value expression
- Evaluates value expression
- Returns input unchanged but with modified context
- Variable available in subsequent expressions

Example:
```fhirpath
defineVariable('officialName', name.where(use = 'official').first())
  .contact.name.where(given = %officialName.given)
```

## Implementation Plan

### Phase 1: Union Operator
- [ ] Update `evaluateUnion()` in interpreter.ts
- [ ] Handle multiple operands (already parsed as UnionNode)
- [ ] Preserve order, no deduplication
- [ ] Add tests for union operator

### Phase 2: Enhanced Equality
- [ ] Update equality operator in operators.ts
- [ ] Implement collection equality comparison
- [ ] Handle singleton conversion for collections
- [ ] Add tests for collection equality

### Phase 3: Iterator Functions
- [ ] Create function registry/dispatch system
- [ ] Implement `where()`:
  - Set `$this` for each item
  - Evaluate predicate expression
  - Filter based on boolean result
- [ ] Implement `select()`:
  - Set `$this` for each item
  - Evaluate transformation expression
  - Flatten results
- [ ] Add comprehensive tests

### Phase 4: Control Flow Functions
- [ ] Implement `iif()`:
  - Evaluate condition
  - Lazy evaluation of branches
  - Context propagation from evaluated branch
- [ ] Implement `defineVariable()`:
  - Evaluate value expression
  - Add to context variables
  - Return input with modified context
- [ ] Add tests for context flow

## Test Cases

### Union Operator
```typescript
// Basic union
parse('name.given | name.family')
// → ['John', 'Jane', 'Doe', 'Smith']

// Multiple unions
parse('a | b | c')
// → [...a, ...b, ...c]

// With empty
parse('{} | {1, 2}')
// → [1, 2]
```

### Where Function
```typescript
// Simple filter
parse('name.where(use = "official")')

// With navigation
parse('Patient.name.where(given.exists()).family')

// Nested where
parse('Bundle.entry.where(resource.is(Patient))')
```

### Select Function
```typescript
// Simple transformation
parse('name.select(given)')

// Complex expression
parse('name.select(given + " " + family)')

// With union
parse('name.select(given | family)')
```

### iif Function
```typescript
// Basic conditional
parse('iif(active, "Active", "Inactive")')

// With expressions
parse('iif(age > 18, "Adult", "Minor")')

// Nested iif
parse('iif(age < 18, "Minor", iif(age < 65, "Adult", "Senior"))')
```

### defineVariable Function
```typescript
// Simple variable
parse('defineVariable("x", 5).value + %x')

// Complex usage
parse(`Patient
  .defineVariable('names', name)
  .contact
  .where(name in %names)`)
```

## Success Criteria

1. **Union operator** works with multiple operands, preserves order
2. **Equality** handles collections properly with singleton rules
3. **where/select** correctly manage `$this` context
4. **iif** implements lazy evaluation
5. **defineVariable** modifies context for downstream use
6. All functions integrate properly with existing operators
7. Comprehensive test coverage
8. Clear error messages for invalid usage

## Technical Considerations

### Function Registry
Create a clean function dispatch system:
```typescript
interface FunctionDefinition {
  name: string;
  arity: number | { min: number; max?: number };
  evaluate: (interpreter: Interpreter, args: ASTNode[], input: any[], context: Context) => EvaluationResult;
}
```

### Context Management
- Iterator functions need temporary context ($this)
- defineVariable needs permanent context modification
- Ensure proper context isolation and restoration

### Error Handling
- Clear messages for wrong number of arguments
- Type mismatches in comparisons
- Invalid variable names

## Resources
- FHIRPath spec: http://hl7.org/fhirpath/#functions
- Mental model: ideas/fhirpath-mental-model-3.md
- Existing interpreter: src/interpreter/

## Notes
- Start with union operator (simplest)
- Function registry will be reused for future functions
- Focus on correct context management
- These functions enable most real-world FHIRPath usage