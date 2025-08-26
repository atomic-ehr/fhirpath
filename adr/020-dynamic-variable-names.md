# ADR-020: Support Dynamic Variable Names in defineVariable

## Status
Proposed

## Context

The current implementation of `defineVariable()` requires the variable name to be a string literal known at parse time. This restriction causes the test `[FHIRPath Lab] defineVariable19` to fail:

```fhirpath
defineVariable(defineVariable('param','ppp').select(%param), defineVariable('param','value').select(%param)).select(%ppp)
```

This test expects to:
1. Compute the variable name `'ppp'` at runtime
2. Create a variable with that computed name
3. Reference it later as `%ppp`

### Current Limitations

1. **Implementation**: `defineVariable-function.ts` expects first argument to be a `LiteralNode`:
   ```typescript
   const nameNode = args[0] as LiteralNode;
   if (nameNode.valueType !== 'string') {
     throw Errors.invalidOperation('Variable name must be a string');
   }
   ```

2. **Analyzer**: Requires literal strings to track variable scopes and types at compile time

3. **Official Tests**: The FHIRPath Lab test suite includes tests with dynamic variable names, indicating this is expected behavior

### Specification Review

The FHIRPath specification (§5.5.4) defines `defineVariable(name: String, value: expression)` but does not require `name` to be a literal. The parameter type `String` indicates the evaluated result should be a string, not that it must be a string literal in the source.

## Decision

Support dynamic variable names in `defineVariable()` by:

1. **Runtime Evaluation**: Evaluate the first argument to get the variable name
2. **Hybrid Analysis**: 
   - For literal string names: Full static analysis with errors for undefined variables
   - For dynamic names: Best-effort analysis with warnings instead of errors
3. **Graceful Degradation**: Maintain full type checking for statically-known variables while allowing dynamic ones

## Consequences

### Positive

1. **Spec Compliance**: Full compatibility with FHIRPath specification
2. **Test Compatibility**: Pass official FHIRPath Lab tests
3. **Flexibility**: Support advanced use cases with computed variable names
4. **Backward Compatible**: Existing code with literal names continues to work with full static analysis

### Negative

1. **Reduced Static Analysis**: Cannot validate existence of dynamically-named variables at compile time
2. **Runtime Errors**: Variable reference errors move from compile-time to runtime for dynamic cases
3. **Type Inference**: Cannot infer types for dynamically-named variables
4. **Complexity**: Implementation becomes more complex with dual modes

### Neutral

1. **Performance**: Minimal impact - literal names can still be optimized, dynamic names add small overhead
2. **Security**: No additional risk if input is properly validated (which it already must be)

## Implementation Approach

### 1. Runtime Changes

```typescript
// defineVariable-function.ts
export const evaluate: FunctionEvaluator = async (input, context, args, evaluator) => {
  if (args.length < 1) {
    throw Errors.invalidOperation('defineVariable requires at least 1 argument');
  }

  let varName: string;
  
  // Check if first argument is a literal
  const nameArg = args[0];
  if (nameArg.type === 'Literal' && nameArg.valueType === 'string') {
    // Fast path: literal string
    varName = nameArg.value as string;
  } else {
    // Slow path: evaluate expression to get name
    const nameResult = await evaluator(nameArg, input, context);
    if (nameResult.value.length === 0) {
      throw Errors.invalidOperation('Variable name expression evaluated to empty');
    }
    const nameValue = unbox(nameResult.value[0]);
    if (typeof nameValue !== 'string') {
      throw Errors.invalidOperation('Variable name must evaluate to a string');
    }
    varName = nameValue;
  }
  
  // Rest of implementation remains the same...
};
```

### 2. Analyzer Changes

```typescript
async analyze(context: AnalysisContext, args): Promise<InternalAnalysisResult> {
  const diagnostics: any[] = [];
  
  // First argument: variable name
  const nameNode = args[0];
  let varName: string | undefined;
  let isDynamic = false;
  
  if (nameNode.type === 'Literal' && nameNode.valueType === 'string') {
    // Static variable name - full analysis
    varName = nameNode.value as string;
    
    if (context.userVariables.has(varName)) {
      diagnostics.push({
        range: nameNode.range,
        message: `Variable '${varName}' is already defined`,
        severity: DiagnosticSeverity.Error
      });
    }
  } else {
    // Dynamic variable name - limited analysis
    isDynamic = true;
    diagnostics.push({
      range: nameNode.range,
      message: 'Dynamic variable name: cannot validate variable references at compile time',
      severity: DiagnosticSeverity.Warning
    });
    
    // Still analyze the expression for other errors
    const nameResult = await context.analyzeNode(nameNode);
    diagnostics.push(...nameResult.diagnostics);
    
    // Check if it evaluates to string type
    if (nameResult.type.type !== 'String') {
      diagnostics.push({
        range: nameNode.range,
        message: 'Variable name expression must evaluate to String type',
        severity: DiagnosticSeverity.Error
      });
    }
  }
  
  // Determine variable type...
  // Return with context that may or may not include the variable
}
```

### 3. Variable Reference Analysis

When analyzing variable references (`%varname`):

```typescript
// For variable references in analyzer
if (!context.userVariables.has(varName) && !context.hasDynamicVariables) {
  // Only error if we're certain the variable doesn't exist
  diagnostics.push({
    message: `Variable '${varName}' is not defined`,
    severity: DiagnosticSeverity.Error
  });
} else if (!context.userVariables.has(varName) && context.hasDynamicVariables) {
  // Warning if variable might be dynamically defined
  diagnostics.push({
    message: `Variable '${varName}' may not be defined (dynamic variables in scope)`,
    severity: DiagnosticSeverity.Warning
  });
}
```

## Alternatives Considered

### 1. Keep Current Restriction
- **Pros**: Simpler implementation, full static analysis
- **Cons**: Fails official tests, not spec-compliant, limits flexibility
- **Rejected**: Incompatible with official test suite

### 2. Disable Static Analysis for All Variables
- **Pros**: Simpler implementation
- **Cons**: Loses valuable compile-time checking for common cases
- **Rejected**: Unnecessarily degrades developer experience

### 3. Separate Functions for Static/Dynamic
- **Pros**: Clear distinction between modes
- **Cons**: Not spec-compliant, fragments the API
- **Rejected**: Violates principle of least surprise

## References

- FHIRPath Specification §5.5.4: defineVariable function
- FHIRPath Lab Test: defineVariable19
- Test file: `/test-cases/operations/utility/defineVariable.json`
- Related tests: defineVariable19, dvParametersDontColide