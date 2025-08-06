# Task 013: Implement System Variable Type Delegation

## Overview
Refactor system variable type handling in the analyzer to use delegation model where each function manages its own system variables, as specified in ADR-012.

## Background
- ADR-012 defines the delegation approach for system variable types
- Current implementation mixes system and user variables in userVariableTypes
- System variables like `$this` don't get proper type information from context
- This causes validation failures for type operations on union types

## Implementation Steps

### 1. Add systemVariableTypes map to Analyzer
**File:** `src/analyzer.ts`

```typescript
class Analyzer {
  private diagnostics: Diagnostic[] = [];
  private variables: Set<string> = new Set(['$this', '$index', '$total', 'context', 'resource', 'rootResource']);
  private modelProvider?: ModelProvider;
  private userVariableTypes: Map<string, TypeInfo> = new Map();
  private systemVariableTypes: Map<string, TypeInfo> = new Map(); // NEW
```

### 2. Refactor inferVariableType method
**File:** `src/analyzer.ts`

Update to check systemVariableTypes for system variables:

```typescript
private inferVariableType(node: VariableNode): TypeInfo {
  // System variables - check temporary context
  if (node.name.startsWith('$')) {
    const systemType = this.systemVariableTypes.get(node.name);
    if (systemType) {
      return systemType;
    }
    // Fallback defaults
    switch (node.name) {
      case '$this':
        return { type: 'Any', singleton: false };
      case '$index':
        return { type: 'Integer', singleton: true };
      case '$total':
        return { type: 'Any', singleton: false };
      default:
        return { type: 'Any', singleton: false };
    }
  }
  
  // Special FHIRPath environment variables
  if (node.name === '%context' || node.name === '%resource' || node.name === '%rootResource') {
    return { type: 'Any', singleton: false };
  }
  
  // User-defined variables
  let varName = node.name;
  if (varName.startsWith('%')) {
    varName = varName.substring(1);
  }
  
  const userType = this.userVariableTypes.get(varName);
  if (userType) {
    return userType;
  }
  
  return { type: 'Any', singleton: false };
}
```

### 3. Update annotateAST for where/select/all/exists
**File:** `src/analyzer.ts`

Replace current handling with system variable management:

```typescript
if (funcName && ['where', 'select', 'all', 'exists'].includes(funcName)) {
  // These functions pass each element of input collection as $this
  const elementType = inputType ? { ...inputType, singleton: true } : { type: 'Any', singleton: true };
  
  // Save current context
  const savedThis = this.systemVariableTypes.get('$this');
  const savedIndex = this.systemVariableTypes.get('$index');
  
  // Set system variables for expression evaluation
  this.systemVariableTypes.set('$this', elementType);
  this.systemVariableTypes.set('$index', { type: 'Integer', singleton: true });
  
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
} else {
  // Regular function argument annotation
  funcNode.arguments.forEach(arg => this.annotateAST(arg, inputType));
}
```

### 4. Update aggregate function handling
**File:** `src/analyzer.ts`

Remove the hacky userVariableTypes usage for `$total`:

```typescript
if (funcNode.name.type === NodeType.Identifier && 
    (funcNode.name as IdentifierNode).name === 'aggregate') {
  
  const itemType = inputType ? { ...inputType, singleton: true } : { type: 'Any', singleton: true };
  
  // Save current context
  const savedThis = this.systemVariableTypes.get('$this');
  const savedTotal = this.systemVariableTypes.get('$total');
  
  // Set $this for iteration
  this.systemVariableTypes.set('$this', itemType);
  
  if (funcNode.arguments.length >= 2) {
    // Has init parameter - evaluate it first
    this.annotateAST(funcNode.arguments[1]!, inputType);
    const initType = funcNode.arguments[1]!.typeInfo;
    
    // Set $total to init type
    if (initType) {
      this.systemVariableTypes.set('$total', initType);
    } else {
      this.systemVariableTypes.set('$total', { type: 'Any', singleton: false });
    }
    
    // Process aggregator with both variables set
    this.annotateAST(funcNode.arguments[0]!, inputType);
    
    // Process remaining arguments
    funcNode.arguments.slice(2).forEach(arg => this.annotateAST(arg, inputType));
  } else if (funcNode.arguments.length >= 1) {
    // No init - first pass to infer aggregator type
    this.systemVariableTypes.set('$total', { type: 'Any', singleton: false });
    this.annotateAST(funcNode.arguments[0]!, inputType);
    
    // Second pass with inferred type
    const aggregatorType = funcNode.arguments[0]!.typeInfo;
    if (aggregatorType) {
      this.systemVariableTypes.set('$total', aggregatorType);
      // Re-annotate with proper $total type
      this.annotateAST(funcNode.arguments[0]!, inputType);
    }
  }
  
  // Restore previous context
  if (savedThis) {
    this.systemVariableTypes.set('$this', savedThis);
  } else {
    this.systemVariableTypes.delete('$this');
  }
  if (savedTotal) {
    this.systemVariableTypes.set('$total', savedTotal);
  } else {
    this.systemVariableTypes.delete('$total');
  }
}
```

### 5. Clean up inferFunctionType for aggregate
**File:** `src/analyzer.ts`

Remove the temporary userVariableTypes usage:

```typescript
// Special handling for aggregate function
if (funcName === 'aggregate') {
  // Result type inference remains the same
  if (node.arguments.length >= 2) {
    const initType = this.inferType(node.arguments[1]!, inputType);
    return initType;
  }
  if (node.arguments.length >= 1) {
    // Note: We can't fully infer without running annotation
    // This is a limitation of the current architecture
    return { type: 'Any', singleton: false };
  }
  return { type: 'Any', singleton: false };
}
```

### 6. Update tests
**File:** `test/children-function.test.ts`

The existing tests should now pass with proper type propagation.

### 7. Add tests for system variable types
**File:** `test/system-variables.test.ts` (new)

Create comprehensive tests for system variable type inference:
- Test `$this` type in where/select/all/exists
- Test `$index` type availability
- Test `$total` type in aggregate
- Test nested contexts (where inside select, etc.)
- Test with union types from children()

## Testing Plan

1. Run existing children-function tests - should now pass
2. Run aggregate tests - ensure no regression
3. Create new system-variables tests
4. Test with complex nested expressions
5. Verify type validation warnings work correctly

## Success Criteria

- [ ] System variables get correct types from context
- [ ] `$this` in where/select gets proper union type from children()
- [ ] All existing tests pass
- [ ] Type validation warnings work for is/as operators on $this
- [ ] No regression in aggregate function handling
- [ ] Clear separation between system and user variables

## Notes

- This is a significant refactoring but improves code clarity
- The delegation model makes it easier to add new system variables
- Consider adding helper methods to reduce duplication in variable save/restore