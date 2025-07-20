# Task 005: Implement Simple FHIRPath Interpreter ✓

## Overview
Implement a simple FHIRPath interpreter based on the stream-processing mental model from `ideas/fhirpath-mental-model-3.md`. The interpreter should evaluate parsed AST nodes following the two-phase evaluation model (control flow down, data flow up).

## Completion Summary

**Status**: ✅ Completed (Phases 1-3 implemented)

### What Was Done

Successfully implemented the first three phases of the FHIRPath interpreter with full test coverage:

#### Phase 1: Core Infrastructure ✅
- Created `src/interpreter/types.ts` with core interfaces:
  - `EvaluationResult` - Always returns collection + context
  - `Context` - Variables, environment, and root context
  - `CollectionUtils` - Helper functions for collection operations
- Created `src/interpreter/context.ts` with context management:
  - Context creation and copying
  - Variable management (get/set)
  - Iterator context ($this, $index)
  - Environment variable handling
- Created `src/interpreter/interpreter.ts` with base interpreter class:
  - Main evaluate method with node dispatch
  - Error handling with position information

#### Phase 2: Simple Nodes ✅
- **Literal evaluation**: Numbers, strings, booleans, null → empty, collections
- **Identifier evaluation**: Property navigation with array flattening
- **Variable evaluation**: 
  - Special variables: $this, $index, $total
  - User variables: %varName
  - Root variables: %context, %resource, %rootResource
- **Dot operator**: Pipeline semantics (left output → right input)

#### Phase 3: Operators ✅
- Created `src/interpreter/operators.ts` for operator implementations
- **Arithmetic operators**: +, -, *, /, div, mod
  - Singleton conversion rules
  - Empty propagation
  - Type checking
- **Comparison operators**: =, !=, <, >, <=, >=
  - Three-valued logic (empty → empty)
  - String and number comparison
- **Logical operators**: and, or, not, xor, implies
  - Full three-valued logic implementation
  - Empty as "unknown" value
- **Unary operators**: +, -, not

#### Testing ✅
- Created comprehensive test suite in `test/interpreter.test.ts`
- 37 tests covering all implemented features
- All tests passing with good performance

#### Documentation ✅
- Created `src/interpreter/README.md` with architecture overview
- Clear documentation of design decisions and usage

### Key Design Achievements

1. **Stream Processing Model**: Every node follows (input, context) → (output, new context)
2. **Collection Semantics**: Everything is a collection, empty represents null/missing
3. **Context Threading**: Context flows through expressions, modified by some operations
4. **Three-Valued Logic**: Properly implemented for all logical operators
5. **Clean Architecture**: Well-organized modules with clear separation of concerns

### Example Usage

```typescript
import { evaluateFHIRPath } from './interpreter/interpreter';

// Simple navigation
evaluateFHIRPath('Patient.name.given', patient);  // → ['John', 'Jane']

// With operators
evaluateFHIRPath('age > 18 and status = "active"', data);  // → [true]

// With variables
const ctx = ContextManager.setVariable(context, 'threshold', [10]);
evaluateFHIRPath('value > %threshold', data, ctx);  // → [true/false]
```

### Not Implemented (Future Phases)

- Phase 4: Functions (where, select, first, etc.)
- Phase 5: Type system (is, as, ofType)
- Phase 6: Advanced features (defineVariable, iif, union)

## Mental Model Summary

### Core Concepts
1. **Everything is a Processing Node** with uniform interface:
   - Input: Collection (even single values are collections of one)
   - Context: Variables, services, and environment data
   - Arguments: Other nodes that provide processing logic
   - Output: Resulting collection
   - New Context: Potentially modified context

2. **Two-Phase Evaluation**:
   - Phase 1 (Control Flow): Top-down orchestration of evaluation
   - Phase 2 (Data Flow): Bottom-up result propagation

3. **Collections**: Ordered, non-unique, indexed, typed
4. **Empty Collection**: Represents null/missing/unknown values

## Design Principles

### 1. Node Interface
```typescript
interface EvaluationResult {
  value: any[];  // Always a collection
  context: Context;
}

interface Context {
  variables: Map<string, any[]>;  // %varName -> value
  env: {
    $this?: any[];
    $index?: number;
    $total?: any[];
  };
}
```

### 2. Evaluator Structure
```typescript
class Interpreter {
  evaluate(node: ASTNode, input: any[], context: Context): EvaluationResult
}
```

## Implementation Steps

### Phase 1: Core Infrastructure
- [ ] Create `src/interpreter/types.ts` with core interfaces
  - EvaluationResult interface
  - Context interface
  - Collection helper type
- [ ] Create `src/interpreter/context.ts` with context management
  - Context creation
  - Variable management
  - Special variables ($this, $index, $total)
- [ ] Create `src/interpreter/interpreter.ts` with base class
  - Main evaluate method dispatching to node handlers
  - Error handling framework

### Phase 2: Simple Nodes
- [ ] Implement literal evaluation
  - String, number, boolean literals
  - Empty collection `{}`
  - Collection literals `{1, 2, 3}`
- [ ] Implement identifier evaluation
  - Property navigation on input collection
  - Handle missing properties → empty collection
- [ ] Implement variable evaluation
  - %varName lookups from context
  - Special variables ($this, $index, $total)
  - %context, %resource, %rootResource

### Phase 3: Operators
- [ ] Implement dot operator (highest precedence)
  - Left evaluation with input/context
  - Right evaluation with left's output as input
  - Context threading
- [ ] Implement arithmetic operators (+, -, *, /, div, mod)
  - Parallel evaluation of operands
  - Singleton conversion rules
  - Type checking
- [ ] Implement comparison operators (=, !=, <, >, <=, >=)
  - Handle different types appropriately
  - Three-valued logic with empty collections
- [ ] Implement logical operators (and, or, not, xor, implies)
  - Three-valued logic implementation
  - Empty collection as "unknown"

### Phase 4: Basic Functions
- [ ] Implement function dispatch mechanism
  - Built-in function registry
  - Argument evaluation control
- [ ] Simple value functions
  - `first()`, `last()`, `tail()`
  - `count()`, `empty()`, `exists()`
  - `distinct()`, `combine()`
- [ ] Iterator functions with controlled evaluation
  - `where(expression)` - filtering with $this
  - `select(expression)` - transformation with $this
  - `exists(expression)` - any match check
  - `all(expression)` - all match check

### Phase 5: Type System
- [ ] Implement type hierarchy
  - System types (String, Integer, Boolean, etc.)
  - Type checking infrastructure
- [ ] Type operations
  - `is` operator for type testing
  - `as` operator for safe casting
  - `ofType()` function
- [ ] Type conversions
  - Implicit conversions (singleton rules)
  - Explicit conversions

### Phase 6: Advanced Features
- [ ] Context modification
  - `defineVariable(name, value)`
  - Context flow through expressions
- [ ] Conditional evaluation
  - `iif(condition, then, else)`
  - Lazy evaluation of branches
- [ ] Collection operations
  - `union()` with duplicate removal
  - `intersect()`, `exclude()`
- [ ] Index operations
  - `[index]` subscripting
  - Bounds checking

## Test Strategy

### Unit Tests
1. **Node Tests**: Each node type in isolation
2. **Operator Tests**: All operators with various inputs
3. **Function Tests**: Each built-in function
4. **Type Tests**: Type checking and conversions
5. **Context Tests**: Variable management and flow

### Integration Tests
1. **Navigation**: `Patient.name.given`
2. **Filtering**: `name.where(use = 'official')`
3. **Complex**: Real-world expressions from invariants.json
4. **Edge Cases**: Empty collections, type mismatches

### Performance Tests
1. **Large Collections**: Performance with 1000+ items
2. **Deep Nesting**: Deeply nested expressions
3. **Memory**: Context and collection management

## Example Implementation

```typescript
// Simple literal evaluation
case NodeType.Literal:
  const literal = node as LiteralNode;
  return {
    value: literal.value === null ? [] : [literal.value],
    context: context
  };

// Dot operator with pipeline semantics
case NodeType.Binary:
  const binary = node as BinaryNode;
  if (binary.operator === TokenType.DOT) {
    // Phase 1: Evaluate left with original input
    const leftResult = this.evaluate(binary.left, input, context);
    // Phase 2: Evaluate right with left's output as input
    const rightResult = this.evaluate(binary.right, leftResult.value, leftResult.context);
    return rightResult;
  }
  // Other operators...
```

## Success Criteria

1. **Correctness**: Pass test suite with real FHIRPath expressions
2. **Mental Model Alignment**: Implementation follows stream-processing model
3. **Error Handling**: Clear error messages for type mismatches, etc.
4. **Performance**: <10ms for typical expressions
5. **Extensibility**: Easy to add new functions and operators

## Future Enhancements

1. **Lazy Evaluation**: Optimize for large collections
2. **Type Inference**: Compile-time type checking
3. **Custom Functions**: User-defined function support
4. **Debugging**: Step-through evaluation with state inspection
5. **Optimization**: Query optimization and caching

## Resources

- Mental Model: `ideas/fhirpath-mental-model-3.md`
- Parser AST: `src/parser/ast.ts`
- Test Data: `test/invariants.json`, `test/searchparams.json`
- FHIRPath Spec: http://hl7.org/fhirpath/

## Notes

- Start simple: Get basic navigation working first
- Focus on correctness over performance initially
- Use the mental model's two-phase evaluation approach
- Ensure empty collection semantics are preserved
- Make context flow explicit and traceable