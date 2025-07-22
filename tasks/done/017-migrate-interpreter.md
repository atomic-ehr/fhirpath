# Task 004: Migrate Interpreter to Use Registry

## Objective
Update the interpreter to use the unified registry for evaluating all operations.

## Requirements

1. **Remove operator classes**:
   - Delete `Operators` class
   - Remove operator method implementations
   - Use registry's `evaluate()` methods

2. **Simplify evaluation**:
   - Replace switch statements with registry lookups
   - Use `operation.evaluate()` for all operations
   - Remove `FunctionRegistry.evaluate()`

3. **Update node evaluators**:
   - Unify binary/unary operator evaluation
   - Simplify function evaluation
   - Add literal evaluation via registry

4. **Argument evaluation**:
   - Use operation's parameter definitions
   - Remove `ArgumentEvaluator` if fully replaced
   - Handle expression vs value parameters

## Files to Update

- `/src/interpreter/interpreter.ts` - Main interpreter
- `/src/interpreter/operators.ts` - Delete this file
- `/src/interpreter/functions/registry.ts` - Simplify or remove
- `/src/interpreter/functions/index.ts` - Remove if using central registry

## Key Changes

```typescript
// Before
const value = Operators.arithmetic(node.operator, leftResult.value, rightResult.value);

// After
const operation = Registry.getByToken(node.operator);
return operation.evaluate(this, context, input, leftResult.value, rightResult.value);
```

## Tests to Update

- Operator evaluation tests
- Function evaluation tests
- Empty propagation tests
- Context handling tests

## Dependencies

- Tasks 001, 002, and 003 should be completed first