# ADR-008: Interpreter Type-Aware Execution

## Status

Proposed

## Context

The current FHIRPath implementation maintains a clean separation between the analyzer (static type checking) and interpreter (runtime execution). However, certain FHIRPath operations would benefit from type information at runtime:

1. **Type filtering operations** like `ofType()` need to understand type hierarchies
2. **Type-specific navigation** could be optimized if types are known
3. **Better runtime errors** could be provided with type context
4. **Performance optimizations** are possible when types are statically known

Currently, the analyzer annotates AST nodes with `typeInfo`, but the interpreter completely ignores this information. This leads to:
- Duplicate type checking logic between analyzer and runtime
- Missed optimization opportunities
- Less informative runtime errors
- Inability to fully implement type-aware operations like `ofType()`

## Decision

**Always run the analyzer** before interpretation to provide type information, with the ModelProvider being optional. The interpreter will:

1. **Always receive analyzed AST** - Parser → Analyzer → Interpreter pipeline
2. **Basic type analysis always available** - Even without ModelProvider
3. **Enhanced analysis with ModelProvider** - Richer type information when domain model is available
4. **Use typeInfo for optimization** - Leverage type annotations from the analyzer

Implementation approach:
- Change `evaluate()` to always run analyzer before interpreter
- Analyzer runs with or without ModelProvider
- Without ModelProvider: Basic FHIRPath type analysis (primitives, collections)
- With ModelProvider: Full domain-aware type analysis (FHIR resources, navigations)
- Interpreter leverages typeInfo for better execution

## Model-Dependent Operation Validation

The analyzer enforces that ALL type operations require a ModelProvider, regardless of the type being checked.

### Operations That ALWAYS Require ModelProvider:

- `ofType(Type)` - ALL uses require ModelProvider
- `is Type` - ALL uses require ModelProvider
- `as Type` - ALL uses require ModelProvider

### Critical Insight:

Even primitive types require ModelProvider due to choice types:

```typescript
"Patient.deceased.ofType(Boolean)"
// Boolean is a primitive type, BUT:
// - FHIR data has 'deceasedBoolean', not 'deceased'
// - Without ModelProvider: Returns empty (WRONG!)
// - With ModelProvider: Correctly handles the choice type

"Observation.value.ofType(String)"  
// String is a primitive type, BUT:
// - FHIR data has 'valueString', not 'value'
// - Without ModelProvider: Returns empty (WRONG!)
// - With ModelProvider: Correctly handles the choice type
```

### The Rule:

NO EXCEPTIONS - all type operations require ModelProvider:

```typescript
// ALL of these require ModelProvider:
"data.ofType(String)"        // Even primitive types
"value is Boolean"           // Even primitive types
"item as Integer"            // Even primitive types
"data.ofType(Patient)"       // Non-primitive types
```

### Error Message:

```
Error: Operation 'ofType' requires a ModelProvider to handle type checking correctly.
       Even primitive types like Boolean can fail due to choice types 
       (e.g., Patient.deceased is actually deceasedBoolean in FHIR data).
       
       Configure a ModelProvider to use type operations.
```

### Rationale:

Without ModelProvider, we cannot know:
- If a property uses choice types (value[x], deceased[x])
- The correct property names in the actual data
- How to properly filter by type

This leads to silent failures where expressions return empty results instead of the correct values.

## Consequences

### Positive

- **Consistent behavior** - All expressions go through the same pipeline
- **Better performance** - Skip impossible type checks, optimize navigation paths
- **Richer functionality** - Properly implement `ofType()`, `descendants()`, and other type-aware operations
- **Improved errors** - Always have at least basic type context
- **Progressive enhancement** - Better results with ModelProvider, but works without
- **Simplified interpreter** - Can assume typeInfo is always present
- **Fail-fast type operations** - Prevent silent failures in type operations without ModelProvider

### Negative

- **Analysis overhead** - Every expression must be analyzed (though lightweight without ModelProvider)
- **Breaking change** - Changes the execution pipeline
- **Memory overhead** - All ASTs contain type annotations
- **Potential performance impact** - Analysis step always runs
- **Stricter requirements** - Type operations now require ModelProvider

### Implementation Example

```typescript
// In index.ts - evaluate always uses analyzer
export function evaluate(
  expression: string,
  options: EvaluateOptions = {}
): any[] {
  const parser = new Parser(expression);
  const parseResult = parser.parse();
  
  if (parseResult.errors.length > 0) {
    throw new Error(parseResult.errors[0]!.message);
  }
  
  // ALWAYS analyze the AST
  const analyzer = new Analyzer(options.modelProvider);
  const analysisResult = analyzer.analyze(
    parseResult.ast, 
    options.variables,
    options.inputType
  );
  
  // Use the analyzed AST with type information
  const interpreter = new Interpreter();
  const input = prepareInput(options.input);
  const context = createContext(input, options.variables);
  
  return interpreter.evaluate(analysisResult.ast, input, context).value;
}

// In ofType-function.ts - can rely on typeInfo being present
export const ofTypeFunction: FunctionDefinition = {
  name: 'ofType',
  evaluate(input: any[], context: RuntimeContext, args: ASTNode[], evaluator: NodeEvaluator) {
    const typeArg = args[0];
    const targetType = extractTypeName(typeArg);
    
    // typeInfo is always available (basic or enhanced)
    const typeInfo = context.currentNode?.typeInfo;
    
    if (typeInfo?.modelContext?.isUnion) {
      // Enhanced type info from ModelProvider
      const validChoice = typeInfo.modelContext.choices?.find(c => c.type === targetType);
      
      if (!validChoice) {
        // Type system knows this filter returns empty
        return { value: [], context };
      }
      
      // Optimized filtering with union type knowledge
      return filterByUnionType(input, validChoice);
    }
    
    // Basic type checking (always available)
    return filterByBasicType(input, targetType, typeInfo);
  }
};

// In analyzer.ts - enforce ModelProvider for type operations
private checkTypeOperations(node: FunctionNode | BinaryNode): void {
  const isTypeOperation = 
    (node.type === NodeType.Function && 
     (node.name as IdentifierNode).name === 'ofType') ||
    (node.type === NodeType.Binary && 
     (node.operator === 'is' || node.operator === 'as'));
  
  if (isTypeOperation && !this.modelProvider) {
    this.addDiagnostic(
      DiagnosticSeverity.Error,
      `Operation '${getOperationName(node)}' requires a ModelProvider to handle type checking correctly. ` +
      `Even primitive types like Boolean can fail due to choice types ` +
      `(e.g., Patient.deceased is actually deceasedBoolean in FHIR data).`,
      node,
      'MODEL_REQUIRED_FOR_TYPE_OPERATION'
    );
  }
}
```

## Alternatives Considered

### 1. Optional Analysis (Original Proposal)
Keep analysis optional, interpreter works with or without:
- **Pros**: Maximum flexibility, no breaking changes
- **Cons**: Dual code paths, inconsistent behavior, complex testing

### 2. Runtime Type Provider
Pass ModelProvider directly to the interpreter:
- **Pros**: Clean separation, explicit dependency
- **Cons**: API change, duplicate type resolution logic

### 3. Lazy Analysis
Analyze on-demand when type operations are encountered:
- **Pros**: Performance optimization for simple expressions
- **Cons**: Complex caching, unpredictable performance

### 4. Separate Type-Aware Functions
Create type-aware versions of functions (ofType, descendants):
- **Pros**: No impact on existing functions
- **Cons**: API fragmentation, user confusion

The chosen approach (always analyze, optional ModelProvider) provides:
- Consistent execution pipeline
- Progressive enhancement with ModelProvider
- Single code path in interpreter
- Clear separation of concerns
