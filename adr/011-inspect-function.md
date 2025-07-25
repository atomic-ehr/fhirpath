# ADR-011: Inspect Function for Rich Debug Information

## Status
Proposed

## Context
Currently, the FHIRPath implementation provides basic evaluation functionality through the `evaluate()` and `compile()` functions, which return only the final result. When debugging FHIRPath expressions, developers need more information:

1. **Trace output**: The `trace()` function currently outputs to console.log, making it difficult to capture programmatically
2. **AST visualization**: Understanding how expressions are parsed
3. **Execution details**: Step-by-step evaluation information
4. **Performance metrics**: Execution time and performance bottlenecks
5. **Context state**: Variable values at different points in evaluation

Use cases that would benefit from rich debug information:
- Interactive FHIRPath explorers and playgrounds
- Testing and debugging tools
- Educational applications showing expression evaluation
- Performance profiling and optimization
- IDE integrations with step-through debugging

## Decision
Implement an `inspect()` function that provides comprehensive debugging information while evaluating FHIRPath expressions.

### API Design

```typescript
// Main function signature
export function inspect(
  expression: string | FHIRPathExpression,
  input?: any,
  context?: EvaluationContext
): InspectResult;

// Result structure
export interface InspectResult {
  // Core results
  result: any[];                    // The evaluation result
  expression: string;               // The original expression string
  ast: ASTNode;                    // The parsed AST
  
  // Execution information
  executionTime: number;           // Total execution time in milliseconds
  traces: TraceEntry[];            // Collected trace outputs
  
  // Optional detailed information
  evaluationSteps?: EvaluationStep[]; // Step-by-step evaluation (if enabled)
  errors?: ErrorInfo[];              // Any errors encountered
  warnings?: WarningInfo[];          // Any warnings
}

export interface TraceEntry {
  name: string;                    // Trace name/label
  values: any[];                   // Values being traced
  timestamp: number;               // When the trace occurred
  location?: SourceLocation;       // Location in the expression
  depth: number;                   // Call stack depth
}

export interface EvaluationStep {
  nodeType: string;                // Type of AST node
  expression: string;              // Expression fragment
  input: any[];                    // Input to this step
  output: any[];                   // Output from this step
  variables: Record<string, any>;  // Variable state
  timestamp: number;               // When this step executed
  duration: number;                // How long this step took
}

export interface SourceLocation {
  line: number;
  column: number;
  offset: number;
}
```

### Implementation Approach

1. **Debug Context**: Extend RuntimeContext with debug capabilities:
   ```typescript
   interface DebugRuntimeContext extends RuntimeContext {
     debugMode: true;
     traces: TraceEntry[];
     steps?: EvaluationStep[];
     startTime: number;
   }
   ```

2. **Trace Collection**: Modify the trace() function to check for debug mode:
   ```typescript
   if (context.debugMode) {
     context.traces.push({
       name: traceName,
       values: values,
       timestamp: Date.now() - context.startTime,
       depth: getCallDepth(context)
     });
   } else {
     console.log(`[TRACE] ${traceName}:`, values);
   }
   ```

3. **Step Recording**: Optionally record each evaluation step for detailed debugging

4. **Performance Measurement**: Use high-resolution timers to measure execution time

## Consequences

### Positive
- **Enhanced Debugging**: Developers get comprehensive information about expression evaluation
- **Programmatic Access**: Trace outputs can be captured and processed programmatically
- **Educational Value**: Step-by-step evaluation helps users understand FHIRPath
- **Tool Integration**: IDEs and debugging tools can provide better experiences
- **Performance Analysis**: Identify bottlenecks in complex expressions
- **Non-Breaking**: Existing APIs remain unchanged

### Negative
- **Performance Overhead**: Collecting debug information adds overhead
- **Memory Usage**: Storing traces and steps increases memory consumption
- **Complexity**: Adds complexity to the evaluation process
- **Maintenance**: Another API to maintain and test

### Mitigation Strategies
- Make detailed step recording optional (opt-in)
- Limit trace/step collection with configurable maximums
- Use efficient data structures for debug information
- Clear documentation on when to use inspect() vs evaluate()

## Implementation Notes

1. **File Structure**:
   - `src/api/inspect.ts` - Main inspect function
   - `src/api/types.ts` - Add InspectResult and related types
   - `src/runtime/debug-context.ts` - Debug-enabled context
   - Update trace() in `src/registry/operations/utility.ts`

2. **Testing**:
   - Test trace collection
   - Verify performance impact
   - Test with complex expressions
   - Test error handling

3. **Documentation**:
   - API documentation with examples
   - Performance considerations
   - Comparison with evaluate()

## Example Usage

```typescript
const result = inspect(
  'Patient.name.trace("all names").where(use = "official").trace("official only").given',
  patient,
  { variables: { x: 10 } }
);

console.log('Result:', result.result);
console.log('Execution time:', result.executionTime, 'ms');
console.log('Traces:', result.traces);
// Output:
// Traces: [
//   { name: 'all names', values: [...], timestamp: 0.5 },
//   { name: 'official only', values: [...], timestamp: 1.2 }
// ]

// With detailed steps
const detailed = inspect(expression, input, {
  ...context,
  inspectOptions: { recordSteps: true }
});
console.log('Steps:', detailed.evaluationSteps);
```

## References
- [ADR-010: Public API](./010-public-api.md)
- [FHIRPath Specification](http://hl7.org/fhirpath/)
- Node.js util.inspect() for naming precedent