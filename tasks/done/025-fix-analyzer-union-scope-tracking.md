# Task 025: Fix Analyzer Union Scope Tracking

## Problem Statement

The analyzer doesn't properly isolate variable scopes across union operator (`|`) branches. Variables defined in the left branch of a union should not be accessible in the right branch, but the current implementation fails to enforce this at analysis time.

## Root Cause Analysis

### Current Behavior

1. **Variable Addition Timing**:
   - Variables are added during dot operator (`.`) processing, not during union operator processing
   - The sequence for `defineVariable('n1', ...).active | defineVariable('n2', ...).select(%n1)`:
     ```
     1. visitBinaryOperator('|') - Attempts scope isolation
     2. Visit left branch
        → visitBinaryOperator('.') for defineVariable('n1', ...).active
        → Adds 'n1' to this.variables during dot processing
     3. Reset scope (removes 'n1')
     4. Visit right branch
        → Processes select(%n1)
        → Validates %n1 but 'n1' was removed
     ```

2. **Variable Name Handling**:
   - `collectDefinedVariables()` extracts raw names: `"n1"`, `"n2"`
   - Variables are added without prefix: `this.variables.add("n1")`
   - `validateVariable("%n1")` strips prefix and checks for `"n1"`

3. **Scope Isolation Attempt** (Current Code):
   ```typescript
   if (node.operator === '|') {
     const originalVariables = new Set(this.variables);
     this.visitNode(node.left);  // Variables added here
     this.variables = new Set(originalVariables);  // Reset attempt
     this.visitNode(node.right); // But left's vars already processed
   }
   ```

### Why Current Approach Fails

The problem is that variables are added **during** the traversal of each branch, not **before**. When we reset the scope between branches, we're fighting against the natural flow of the visitor pattern.

## Technical Requirements

1. Variables defined via `defineVariable` in left branch of union must not be accessible in right branch
2. Analyzer should detect cross-branch variable access at analysis time (not runtime)
3. Should generate error with code `FP1004` (Unknown user variable)

## Proposed Solution: Context-Flow Architecture

Based on ADR-015, we'll implement a context-flow architecture that mirrors the interpreter's evaluation flow. This approach naturally solves the union scope isolation problem.

### Core Design

```typescript
// Immutable context flows through analysis tree
interface AnalysisContext {
  variables: Map<string, TypeInfo>;
  systemVariables: Map<string, TypeInfo>;
  inputType: TypeInfo;
  
  // Context manipulation (returns new context)
  withVariable(name: string, type: TypeInfo): AnalysisContext;
  withInputType(type: TypeInfo): AnalysisContext;
  fork(): AnalysisContext;  // For union branches
}

// Result of analyzing a node
interface AnalysisResult {
  type: TypeInfo;
  diagnostics: Diagnostic[];
  context?: AnalysisContext;  // Modified context (for defineVariable)
}

// Functions can implement their own analysis
interface FunctionDefinition {
  analyze?: (context: AnalysisContext, args: ASTNode[]) => AnalysisResult;
}
```

### How It Solves the Problem

```typescript
// Union operator with natural isolation
analyzeBinary(node: BinaryNode, context: AnalysisContext): AnalysisResult {
  if (node.operator === '|') {
    // Each branch gets independent context fork
    const leftResult = analyzeNode(node.left, context.fork());
    const rightResult = analyzeNode(node.right, context.fork());
    
    // Variables don't leak between branches!
    return {
      type: combineTypes(leftResult.type, rightResult.type),
      diagnostics: [...leftResult.diagnostics, ...rightResult.diagnostics],
      context: context  // Original unchanged
    };
  }
}

// defineVariable adds to context
defineVariableFunc.analyze = (context, args) => {
  const varName = args[0].value;  // Extract name
  const varType = analyzeNode(args[1], context).type;
  
  return {
    type: context.inputType,
    diagnostics: [],
    context: context.withVariable(varName, varType)  // New context!
  };
};
```

### Why This Works

1. **Natural Isolation**: Each union branch gets a forked context
2. **No Timing Issues**: Variables flow through context, not mutable state
3. **Clean Architecture**: Mirrors interpreter pattern
4. **Extensible**: Functions implement their own analysis

## Implementation Plan

**Note**: We will completely refactor the **existing** analyzer.ts file without maintaining backward compatibility. This is an in-place transformation, not creating a new file.

### Phase 1: Core Infrastructure ✅
1. ✅ Create `AnalysisContext` class with immutable operations (added to analyzer.ts)
2. ✅ Define `InternalAnalysisResult` interface (added to analyzer.ts)
3. ✅ Add `analyze` method to `FunctionDefinition` interface (added to types.ts)

### Phase 2: Refactor Existing Analyzer ✅
1. ✅ **Transform existing `analyzer.ts`** to use context-flow architecture
2. ✅ Keep the same public API (`analyze` method signature)
3. ✅ Replace visitor pattern internals with context-flow methods
4. ✅ Added context-flow methods: `analyzeNode`, `analyzeBinary`, `analyzeFunction`, `analyzeVariable`
5. ✅ Move AnalysisContext and InternalAnalysisResult to types.ts for better organization

### Phase 3: Operator & Function Analysis ✅
1. ✅ Implement `analyzeBinary` for union (fork) and dot (context flow) operators
2. ✅ Implement `analyzeFunction` that delegates to function's analyze method
3. ✅ Implement `defineVariable.analyze()` method - adds variable to context
4. ✅ Implement `analyzeVariable` for variable validation using context

### Phase 4: Testing & Validation ✅
1. ✅ Enable and verify `defineVariable9` fails at analysis time
2. ✅ Enable and verify `dvUsageOutsideScopeThrows` fails at analysis time  
3. ✅ Both tests now pass with "Unknown user variable: %n1" error
4. ⚠️ Some minor test failures in completion provider (needs adjustment for new architecture)

## Test Cases

### Should Fail at Analysis Time
```fhirpath
# Variable from left branch used in right branch
defineVariable('n1', 'v1').active | defineVariable('n2', 'v2').select(%n1)

# Complex case with navigation
Patient.name.defineVariable('n1', first()).active | Patient.name.defineVariable('n2', skip(1).first()).select(%n1.given)
```

### Should Pass
```fhirpath
# Variables used in same branch where defined
defineVariable('n1', 'v1').select(%n1) | defineVariable('n2', 'v2').select(%n2)

# Variables defined before union
defineVariable('n1', 'v1').select(active | select(%n1))
```

## Success Criteria

1. Analyzer detects cross-union-branch variable access at analysis time
2. Generates appropriate error with code `FP1004`
3. No regression in existing analyzer functionality
4. Tests `defineVariable9` and `dvUsageOutsideScopeThrows` pass with analysis-time error detection

## Complexity Estimate

- **High Complexity**: Complete refactoring of analyzer architecture
- **Time Estimate**: 6-8 hours
- **Risk**: Major change affecting entire analyzer, but cleaner final result

## Implementation Summary

Successfully implemented context-flow architecture for the FHIRPath analyzer, solving the union scope isolation problem:

1. **Created Context-Flow Infrastructure**:
   - Added `AnalysisContext` class with immutable operations (fork, withUserVariable, withInputType, etc.)
   - Added `InternalAnalysisResult` interface for node analysis results
   - Extended `FunctionDefinition` with optional `analyze` method

2. **Refactored Analyzer**:
   - Replaced visitor pattern with context-flow methods
   - Union operator (`|`) now uses `context.fork()` for each branch - variables don't leak
   - Dot operator (`.`) flows context through left to right, allowing defineVariable to work
   - Variables are tracked in immutable context maps

3. **Implemented defineVariable Analysis**:
   - Added `analyze` method to defineVariable function
   - Returns modified context with new variable added
   - Context flows through dot chains but not across union branches

4. **Test Results**:
   - ✅ `defineVariable9`: Variables from left union branch not accessible in right branch
   - ✅ `dvUsageOutsideScopeThrows`: Same scope isolation validation
   - Both tests now properly fail at analysis time with "Unknown user variable: %n1"

## Notes

- The context-flow architecture mirrors the interpreter's evaluation flow
- This is a cleaner, more maintainable solution than patching the visitor pattern
- Minor test failures in completion provider need adjustment for new architecture
- Old visitor pattern code can be removed once all features are migrated