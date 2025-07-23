# Task 023: Implement Prototype-Based Context (ADR-009)

## Objective
Refactor the existing ContextManager to use JavaScript's prototype chain for context inheritance instead of copying all data on every context modification.

## Background
- Current implementation copies all variables and environment data on each context change
- This is inefficient for deep call stacks and expressions with many variables
- ADR-009 proposes using prototype chain for O(1) context creation

## Implementation Steps

### 1. Refactor Context Type Structure
- [ ] Update the Context interface in `src/interpreter/types.ts` to support prototype-based lookup
- [ ] Ensure variables and env objects can work with prototype chain

### 2. Refactor ContextManager Methods
- [ ] Update `ContextManager.create()` to use Object.create() for prototype chain
- [ ] Refactor `ContextManager.copy()` to create child context via prototype inheritance
- [ ] Update `ContextManager.setVariable()` to only set on current context level
- [ ] Ensure `ContextManager.getVariable()` uses prototype lookup correctly
- [ ] Update `ContextManager.setIteratorContext()` for prototype-based env
- [ ] Update `ContextManager.setAggregateContext()` similarly
- [ ] Refactor `ContextManager.getAllVariables()` to traverse prototype chain

### 3. Handle Special Variables
- [ ] Ensure $context, $resource, $rootResource work with prototype chain
- [ ] Verify $this, $index, $total environment variables behave correctly

### 4. Update Compiler Integration
- [ ] Verify RuntimeContext in compiler works with new context structure
- [ ] Update any compiler-specific context handling
- [ ] Ensure compiled expressions work with prototype-based contexts

### 5. Testing
- [ ] Create unit tests for prototype-based context behavior
- [ ] Test variable shadowing in nested contexts
- [ ] Test performance improvements with deep nesting
- [ ] Ensure all existing tests still pass
- [ ] Add tests for edge cases (empty contexts, deeply nested prototypes)

### 6. Performance Validation
- [ ] Create benchmark comparing old vs new implementation
- [ ] Measure memory usage reduction
- [ ] Validate O(1) context creation time

## Technical Considerations

### Prototype Chain Structure
```typescript
// Example of how contexts will be chained:
// grandparent: { variables: { a: [1] }, env: {} }
//     ↑
// parent: { variables: { b: [2] }, env: { $this: [item] } }
//     ↑  
// current: { variables: { c: [3] }, env: {} }
```

### Key Implementation Details
- Use `Object.create(parent)` for inheritance
- Only store changed/new values in current context
- Leverage JavaScript's natural prototype lookup
- Maintain immutability semantics

## Success Criteria
- [ ] All existing tests pass
- [ ] Context creation is O(1) regardless of variable count
- [ ] Memory usage reduced for nested expressions
- [ ] No behavioral changes from user perspective
- [ ] Performance benchmarks show improvement

## Related Files
- `/adr/009-prototype-based-context.md` - Architecture decision
- `/src/interpreter/context.ts` - Main implementation file
- `/src/interpreter/types.ts` - Type definitions
- `/src/compiler/compiler.ts` - Compiler integration
- `/src/registry/operations/utility.ts` - defineVariable function

## Notes
- This is a performance optimization, not a functional change
- Must maintain backward compatibility
- Consider adding debug utilities for prototype chain inspection