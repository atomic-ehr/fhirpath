# ADR-012: System Variable Type Delegation

## Status

Proposed

## Context

FHIRPath defines several system variables that are available in specific contexts:
- `$this` - Current item in iteration contexts (where, select, all, exists, aggregate, etc.)
- `$index` - Current iteration index (potentially in where, select, repeat)
- `$total` - Accumulator in aggregate function
- `%context`, `%resource`, `%rootResource` - Original input contexts

Currently, the analyzer has several problems with system variable type inference:

1. **Mixed concerns**: System variables are stored in `userVariableTypes` alongside actual user variables
2. **No context awareness**: `$this` returns hardcoded `{ type: 'Any', singleton: false }` regardless of the actual collection being iterated
3. **Hacky workarounds**: Temporary storage of `$total` type in userVariableTypes during aggregate processing
4. **Type propagation issues**: Union types from functions like `children()` don't flow to `$this` in filter expressions

This causes validation failures when checking type operations (`is`, `as`, `ofType`) on system variables, particularly when iterating over union types.

## Decision

Implement a delegation model where each function that establishes system variables is responsible for managing their types during expression evaluation.

### Key Changes

1. **Separate system and user variable storage**:
   - Create `systemVariableTypes: Map<string, TypeInfo>` for system variables
   - Keep `userVariableTypes` exclusively for user-defined variables
   - System variables are only valid within their establishing scope

2. **Function-specific variable management**:
   - Each function that introduces system variables manages them directly
   - Variables are set before processing arguments and cleared after
   - Type information flows naturally from the function's input type

3. **Clean variable semantics**:
   - Variables starting with `$` are system variables (context-dependent)
   - Variables starting with `%` are user variables (context-independent)
   - Clear ownership and lifecycle for each variable type

### Implementation Pattern

```typescript
class Analyzer {
  private systemVariableTypes: Map<string, TypeInfo> = new Map();
  private userVariableTypes: Map<string, TypeInfo> = new Map();
  
  private inferVariableType(node: VariableNode): TypeInfo {
    // System variables - check temporary context
    if (node.name.startsWith('$')) {
      const systemType = this.systemVariableTypes.get(node.name);
      if (systemType) {
        return systemType;
      }
      // Fallback for system variables without context
      return this.getDefaultSystemVariableType(node.name);
    }
    
    // User variables
    if (node.name.startsWith('%')) {
      const varName = node.name.substring(1);
      return this.userVariableTypes.get(varName) || { type: 'Any', singleton: false };
    }
    
    return { type: 'Any', singleton: false };
  }
}
```

### Function Responsibilities

#### Functions that establish `$this`:
- **where, select, all, exists**: `$this` is each element of the input collection
- **aggregate**: `$this` is each element being aggregated
- **repeat**: `$this` is the current iteration result

#### Functions that establish `$total`:
- **aggregate**: `$total` is the accumulator value

#### Functions that establish `$index`:
- **where, select** (optional): Current position in collection
- **repeat**: Iteration count

### Example: where() function handling

```typescript
case 'where':
case 'select':
case 'all':
case 'exists':
  // Establish $this as singleton element from input collection
  const elementType = inputType ? { ...inputType, singleton: true } : undefined;
  
  const savedThis = this.systemVariableTypes.get('$this');
  const savedIndex = this.systemVariableTypes.get('$index');
  
  if (elementType) {
    this.systemVariableTypes.set('$this', elementType);
    this.systemVariableTypes.set('$index', { type: 'Integer', singleton: true });
  }
  
  // Process arguments with system variables in scope
  funcNode.arguments.forEach(arg => this.annotateAST(arg, inputType));
  
  // Restore previous context
  if (savedThis) {
    this.systemVariableTypes.set('$this', savedThis);
  } else {
    this.systemVariableTypes.delete('$this');
  }
  if (savedIndex) {
    this.systemVariableTypes.set('$index', savedIndex);
  } else {
    this.systemVariableTypes.delete('$index');
  }
  break;
```

## Consequences

### Positive

- **Type accuracy**: System variables get correct types from their context
- **Clean separation**: System and user variables are clearly distinguished
- **Proper scoping**: Variables only exist within their intended scope
- **Better validation**: Type checking operations on `$this` work correctly with union types
- **Maintainability**: Each function clearly documents what variables it provides
- **Extensibility**: Easy to add new system variables or modify existing ones

### Negative

- **More complex function handlers**: Each function needs variable management code
- **Potential duplication**: Similar setup/teardown code across functions
- **Stack management**: Need to save/restore variables for nested contexts

## Alternatives Considered

### 1. Thread inputType through all inference methods
Pass inputType parameter through the entire type inference chain.

**Rejected because**: Requires changing many method signatures and doesn't solve the fundamental mixing of concerns.

### 2. Use userVariableTypes with temporary storage
Continue using userVariableTypes but with better temporary storage management.

**Rejected because**: Mixes system and user variables, making the code harder to understand and maintain.

### 3. Global context object
Create a global context object that tracks all variable types.

**Rejected because**: Makes it harder to reason about variable scope and lifecycle.

### 4. Visitor pattern with context stack
Implement a full visitor pattern with a context stack for variable scopes.

**Rejected because**: Over-engineering for the current needs; FHIRPath's scoping rules are relatively simple.