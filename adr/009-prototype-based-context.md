# ADR-009: Prototype-Based Context Implementation

## Status

Proposed

## Context

The current FHIRPath interpreter and compiler use a context management system that copies all context data on every modification. The `ContextManager.copy()` method creates new Maps and objects, copying all variables and environment data even when only one variable changes.

This approach has several inefficiencies:
- **Memory overhead**: Each context modification duplicates all existing variables
- **Performance cost**: O(n) time complexity for context creation where n is the number of variables
- **Deep call stacks**: Functions like `where()`, `select()`, and nested expressions create many context copies

In typical FHIRPath expressions, contexts are created frequently:
- Each function call that defines variables (e.g., `defineVariable()`)
- Iterator functions create contexts for each item (`where()`, `select()`, `all()`, etc.)
- Nested expressions compound the problem

## Decision

Implement context inheritance using JavaScript's prototype chain mechanism. Instead of copying data, each new context will inherit from its parent context through the prototype chain.

### Implementation Details

1. **Context as Prototype Chain**:
   ```typescript
   class PrototypeContext {
     variables: Record<string, any[]> = Object.create(null);
     env: Record<string, any> = Object.create(null);
     
     static create(parent?: PrototypeContext): PrototypeContext {
       const context = Object.create(parent || null);
       context.variables = Object.create(parent?.variables || null);
       context.env = Object.create(parent?.env || null);
       return context;
     }
   }
   ```

2. **Variable Resolution**:
   - Setting a variable only affects the current context
   - Getting a variable uses JavaScript's natural prototype lookup
   - No explicit copying needed

3. **ContextManager Refactoring**:
   ```typescript
   export class ContextManager {
     static newContext(parent: Context): Context {
       // Creates child context inheriting from parent
       return PrototypeContext.create(parent);
     }
     
     static setVariable(context: Context, name: string, value: any[]): Context {
       const newContext = this.newContext(context);
       newContext.variables[name] = value;
       return newContext;
     }
   }
   ```

## Consequences

### Positive

- **Performance improvement**: O(1) context creation regardless of variable count
- **Memory efficiency**: No data duplication, only changed values stored
- **Natural scoping**: JavaScript's prototype chain provides correct variable shadowing
- **Simpler implementation**: Less code needed for context management
- **Better for deep nesting**: Scales well with complex expressions

### Negative

- **Debugging complexity**: Prototype chains can be harder to inspect in debuggers
- **Serialization challenges**: Cannot use simple JSON.stringify for context state
- **Potential property access overhead**: Prototype lookup has small runtime cost
- **Breaking change**: Requires updates to both interpreter and compiler
- **Testing complexity**: Need to ensure prototype behavior matches current semantics

## Alternatives Considered

1. **Persistent Data Structures** (e.g., Immutable.js):
   - Pros: Efficient structural sharing, well-tested libraries
   - Cons: External dependency, learning curve, bundle size
   - Not chosen: Prototype chain is simpler and has no dependencies

2. **Copy-on-Write with Tracking**:
   - Pros: Only copy modified parts
   - Cons: Complex bookkeeping, still requires some copying
   - Not chosen: More complex than prototype approach

3. **Mutable Context with Explicit Scoping**:
   - Pros: No copying at all
   - Cons: Breaks functional programming model, complex state management
   - Not chosen: Goes against FHIRPath's immutable semantics

4. **Keep Current Approach**:
   - Pros: Simple, predictable, already works
   - Cons: Performance issues with complex expressions
   - Not chosen: Performance problems will worsen as usage grows