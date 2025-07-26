# ADR-014: Parser-Analyzer Integration for Enhanced Diagnostics

## Status
Proposed

## Context

The current FHIRPath implementation maintains a clear separation between the parser and analyzer phases:

- **Parser**: Handles syntactic analysis, producing an AST with syntax error diagnostics
- **Analyzer**: Performs type analysis on the AST, producing semantic error diagnostics

While this separation follows good architectural principles, it limits our ability to provide helpful, context-aware error messages. Users often receive generic syntax errors that could be enhanced with type and schema information available in the analyzer.

### Current Limitations

1. **Disconnected Error Messages**: Parser errors lack semantic context that could make them more helpful
2. **Poor Error Recovery**: Parser cannot use type information to make better recovery decisions
3. **Duplicate Diagnostic Infrastructure**: Both systems implement similar but separate diagnostic collection
4. **Limited Suggestions**: Parser cannot suggest valid properties or function names without schema access
5. **Two-Phase Error Reporting**: Users must fix syntax errors before seeing semantic errors

## Decision

We will integrate the parser and analyzer to provide enhanced diagnostic capabilities while maintaining architectural boundaries. The integration will be optional and only active in diagnostic mode to avoid performance impact.

### Key Design Principles

1. **Opt-in Enhancement**: Integration features are only active in Diagnostic parser mode
2. **Maintain Separation**: Core parsing logic remains independent of type analysis
3. **Backward Compatible**: Existing APIs continue to work unchanged
4. **Performance Neutral**: No impact on Fast or Standard parsing modes
5. **Progressive Enhancement**: Each phase builds on previous capabilities

## Integration Architecture

### 1. Unified Diagnostic System

Create a shared diagnostic infrastructure used by both parser and analyzer:

```typescript
interface FHIRPathDiagnostic {
  range: TextRange;
  severity: DiagnosticSeverity;
  code: ErrorCode;
  message: string;
  source: 'parser' | 'analyzer' | 'combined';
  relatedInformation?: RelatedInformation[];
  suggestions?: DiagnosticSuggestion[];
}

class UnifiedDiagnosticCollector {
  private diagnostics: FHIRPathDiagnostic[] = [];
  
  addParserError(diagnostic: FHIRPathDiagnostic): void;
  addAnalyzerError(diagnostic: FHIRPathDiagnostic): void;
  enhanceDiagnostic(index: number, enhancement: Partial<FHIRPathDiagnostic>): void;
  
  getDiagnostics(): FHIRPathDiagnostic[];
}
```

### 2. Parser Enhancement with Type Context

Allow parser to optionally access type information for better diagnostics:

```typescript
interface EnhancedParserOptions extends ParserOptions {
  modelProvider?: ModelProvider;  // For type-aware suggestions
  functionRegistry?: FunctionRegistry;  // For function name validation
}

class DiagnosticModeParser extends Parser {
  constructor(
    tokens: Token[],
    sourceMapper: SourceMapper,
    options: EnhancedParserOptions
  ) {
    super(tokens, sourceMapper);
    
    if (options.modelProvider) {
      this.errorReporter = new EnhancedErrorReporter(
        sourceMapper,
        this.diagnosticCollector,
        options.modelProvider
      );
    }
  }
}
```

### 3. Analyzer Enhancement of Parser Diagnostics

Enable analyzer to enhance existing parser diagnostics with semantic information:

```typescript
class TypeAnalyzer {
  enhanceDiagnostics(
    ast: ASTNode,
    diagnostics: UnifiedDiagnosticCollector
  ): void {
    // Walk AST and enhance relevant diagnostics
    for (const diagnostic of diagnostics.getParserDiagnostics()) {
      const enhancement = this.getEnhancement(diagnostic, ast);
      if (enhancement) {
        diagnostics.enhanceDiagnostic(diagnostic.id, enhancement);
      }
    }
  }
}
```

### 4. Integrated Error Reporting

Combine syntactic and semantic context for richer error messages:

```typescript
class EnhancedErrorReporter extends ContextualErrorReporter {
  reportUnknownIdentifier(token: Token, context: ParseContext): void {
    const diagnostic = super.reportUnknownIdentifier(token, context);
    
    // Add schema-based suggestions
    if (this.modelProvider && context.currentType) {
      const properties = this.modelProvider.getProperties(context.currentType);
      const suggestions = findSimilar(token.value, properties);
      
      diagnostic.suggestions = suggestions.map(prop => ({
        range: tokenToRange(token),
        newText: prop.name,
        message: `Change to '${prop.name}'`
      }));
    }
    
    // Check if it might be a type name
    if (this.isLikelyTypeName(token.value)) {
      diagnostic.relatedInformation = [{
        message: `'${token.value}' looks like a type name. Use 'is ${capitalize(token.value)}' for type checking.`,
        range: tokenToRange(token)
      }];
    }
  }
}
```

## Implementation Phases

### Phase 1: Unified Diagnostic Infrastructure (Foundation)
- Implement shared `FHIRPathDiagnostic` interface
- Create `UnifiedDiagnosticCollector`
- Migrate existing diagnostics to new system
- Maintain backward compatibility

### Phase 2: Parser Type Context (Enhancement)
- Add optional `ModelProvider` to parser options
- Implement `EnhancedErrorReporter`
- Add property and function suggestions
- Enhance "unknown identifier" messages

### Phase 3: Analyzer Diagnostic Enhancement (Integration)
- Implement diagnostic enhancement in analyzer
- Add related information to parser errors
- Provide fix suggestions based on schema
- Link syntax and semantic errors

### Phase 4: Advanced Features (Future)
- Real-time type checking during parsing
- Improved error recovery using type information
- Context-aware autocomplete from partial ASTs
- Custom domain-specific enhancements

## Consequences

### Positive

1. **Improved Developer Experience**
   - More helpful and actionable error messages
   - Accurate suggestions based on schema
   - Clear guidance for fixing errors

2. **Better IDE Integration**
   - Foundation for intelligent code completion
   - Accurate quick-fix suggestions
   - Rich hover information from partial ASTs

3. **Enhanced Error Recovery**
   - Type-guided synchronization
   - Better partial AST generation
   - More accurate incomplete node creation

4. **Unified Diagnostic Pipeline**
   - Single source of truth for all diagnostics
   - Consistent error formatting and presentation
   - Easier to implement diagnostic consumers

### Negative

1. **Increased Complexity**
   - More complex initialization in diagnostic mode
   - Additional dependencies between components
   - More code paths to test and maintain

2. **Potential Performance Impact**
   - Diagnostic mode becomes slower (acceptable trade-off)
   - Slightly larger memory footprint
   - More objects created during parsing

3. **API Surface Growth**
   - New options and interfaces
   - More configuration possibilities
   - Steeper learning curve for library users

### Neutral

1. **Architectural Changes**
   - Requires careful dependency management
   - Need to maintain clean boundaries
   - More sophisticated initialization logic

2. **Testing Requirements**
   - Need comprehensive integration tests
   - More test scenarios to cover
   - Performance benchmarking needed

## Example Improvements

### Before Integration

```
Error: Property 'patinet' not found
  |
5 | Patient.patinet.name
  |         ^^^^^^^
```

### After Integration

```
Error: Property 'patinet' not found on type 'Patient'
  |
5 | Patient.patinet.name
  |         ^^^^^^^
  |
  = help: Did you mean 'patient'?
  = note: Available properties: patient, practitioner, organization, location
```

### Before Integration

```
Error: Expected identifier after 'is'
  |
3 | Patient.name is patient
  |                 ^^^^^^^
```

### After Integration

```
Error: Expected type name after 'is'
  |
3 | Patient.name is patient
  |                 ^^^^^^^
  |
  = help: 'patient' looks like a type name. Types should be capitalized.
  = note: Did you mean 'is Patient'?
```

## References

- ADR-012: Parser Diagnostics Architecture
- ADR-008: Error Handling Strategy
- FHIRPath Specification Section 5.1 (Error Handling)
- TypeScript Compiler API (Diagnostic Enhancement Patterns)