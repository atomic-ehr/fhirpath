# FHIRPath API Reference

This document provides a complete reference for the public API of the FHIRPath TypeScript implementation.

## Table of Contents

1. [Main Functions](#main-functions)
2. [Classes](#classes)
3. [Interfaces](#interfaces)
4. [Types](#types)
5. [Error Handling](#error-handling)
6. [Examples](#examples)

## Main Functions

### `evaluate()`

Evaluates a FHIRPath expression against input data.

```typescript
async function evaluate(
  expression: string,
  options?: EvaluateOptions
): Promise<any[]>
```

#### Parameters

- `expression`: The FHIRPath expression to evaluate
- `options`: Optional evaluation configuration

#### Options

```typescript
interface EvaluateOptions {
  input?: unknown;
  variables?: Record<string, unknown>;
  modelProvider?: import('./types').ModelProvider;
  inputType?: import('./types').TypeInfo;
}
```

#### Returns

- `Promise<any[]>`: A promise that resolves to an array (collections in FHIRPath)

#### Examples

```typescript
import { evaluate } from '@fhirpath/core';

// Simple property access
const names = await evaluate('Patient.name', {
  input: {
    resourceType: 'Patient',
    name: [{ given: ['John'], family: 'Doe' }]
  }
});
// Result: [{ given: ['John'], family: 'Doe' }]

// With filtering
const officialNames = await evaluate("Patient.name.where(use = 'official')", {
  input: patientResource
});

// With variables
const result = await evaluate('%myVar + 5', {
  variables: { myVar: 10 }
});
// Result: [15]

// Arithmetic
const sum = await evaluate('5 + 3');
// Result: [8]
```

### `parse()`

Parses a FHIRPath expression into an Abstract Syntax Tree (AST).

```typescript
function parse(
  expression: string,
  options?: ParserOptions
): ParseResult
```

#### Parameters

- `expression`: The FHIRPath expression to parse
- `options`: Optional parser configuration

#### Options

```typescript
interface ParserOptions {
  mode?: 'simple' | 'lsp';     // Default: 'simple'
  preserveTrivia?: boolean;     // Preserve comments/whitespace
  buildIndexes?: boolean;       // Build AST indexes
  errorRecovery?: boolean;      // Continue parsing after errors
  partialParse?: {              // For partial parsing (IDE support)
    cursorPosition: number;
  };
}
```

#### Returns

```typescript
interface ParseResult {
  ast: ASTNode;                // The parsed AST
  errors: ParseError[];        // Any parse errors
  indexes?: {                  // AST indexes (LSP mode only)
    nodeById: Map<string, ASTNode>;
    nodesByType: Map<NodeType | 'Error', ASTNode[]>;
    identifiers: Map<string, ASTNode[]>;
  };
  cursorContext?: {            // Cursor context (partial parse only)
    node: ASTNode | null;
    expectedTokens: TokenType[];
    availableCompletions: string[];
  };
}
```

#### Examples

```typescript
import { parse } from '@fhirpath/core';

// Simple parsing
const result = parse('Patient.name.given');
console.log(result.ast); // AST structure

// LSP mode with error recovery
const lspResult = parse('Patient.name.', {
  mode: 'lsp',
  errorRecovery: true
});
// Continues parsing despite trailing dot

// Check for errors
if (result.errors.length > 0) {
  console.error('Parse errors:', result.errors);
}
```

### `analyze()`

Performs static analysis on a FHIRPath expression.

```typescript
async function analyze(
  expression: string,
  options?: AnalyzeOptions
): Promise<AnalysisResult>
```

#### Parameters

- `expression`: The FHIRPath expression to analyze
- `options`: Optional analysis configuration

#### Options

```typescript
interface AnalyzeOptions {
  variables?: Record<string, unknown>;
  modelProvider?: import('./types').ModelProvider;
  inputType?: import('./types').TypeInfo;
  errorRecovery?: boolean;
}
```

#### Returns

```typescript
interface AnalysisResult {
  diagnostics: Diagnostic[];   // Analysis diagnostics
  ast: ASTNode;               // Type-annotated AST
}
```

#### Examples

```typescript
import { analyze } from '@fhirpath/core';

// Check for undefined variables
const result = await analyze('$unknown + 5');
// Diagnostics: [{ message: 'Unknown variable: $unknown', ... }]

// With known variables
const validResult = await analyze('%myVar + 5', {
  variables: { myVar: 10 }
});
// Diagnostics: []

// Type checking with model provider
const typeResult = await analyze('Patient.unknownProperty', {
  modelProvider: fhirModelProvider
});
// Diagnostics: [{ message: 'Property not found: unknownProperty', ... }]
```

## Classes

### `Parser`

The parser class for converting expressions to AST.

```typescript
class Parser {
  constructor(input: string, options?: ParserOptions);
  parse(): ParseResult;
}
```

#### Example

```typescript
import { Parser } from '@fhirpath/core';

const parser = new Parser('Patient.name');
const result = parser.parse();
```

### `Interpreter`

The interpreter class for evaluating AST nodes.

```typescript
class Interpreter {
  async evaluate(
    node: ASTNode, 
    input: any[], 
    context?: RuntimeContext
  ): Promise<EvaluationResult>;
}
```

#### Example

```typescript
import { Parser, Interpreter } from '@fhirpath/core';

const parser = new Parser('5 + 3');
const ast = parser.parse().ast;

const interpreter = new Interpreter();
const result = await interpreter.evaluate(ast, []);
// result.value: [8]
```

### `Analyzer`

The analyzer class for static analysis.

```typescript
class Analyzer {
  constructor(modelProvider?: ModelProvider);
  
  async analyze(
    ast: ASTNode,
    userVariables?: Record<string, any>, 
    inputType?: TypeInfo,
    options?: { cursorMode?: boolean }
  ): Promise<AnalysisResult>;
}
```

#### Example

```typescript
import { Parser, Analyzer } from '@fhirpath/core';

const parser = new Parser('$this.value');
const ast = parser.parse().ast;

const analyzer = new Analyzer();
const result = await analyzer.analyze(ast);
```

## Interfaces

### Core Interfaces

#### `ASTNode`

Base interface for all AST nodes.

```typescript
interface BaseASTNode {
  type: NodeType | 'Error' | 'CursorNode';
  range: Range;
  
  // Optional LSP features
  parent?: ASTNode;
  children?: ASTNode[];
  leadingTrivia?: TriviaInfo[];
  trailingTrivia?: TriviaInfo[];
  raw?: string;
  id?: string;
  
  // Type information (added by analyzer)
  typeInfo?: TypeInfo;
}
```

#### `RuntimeContext`

Runtime evaluation context.

```typescript
interface RuntimeContext {
  input: any[];
  focus: any[];
  variables: Record<string, any>;
  currentNode?: ASTNode;
  modelProvider?: ModelProvider;
}
```

#### `EvaluationResult`

Result of expression evaluation.

```typescript
interface EvaluationResult {
  value: import('./boxing').FHIRPathValue[];
  context: RuntimeContext;
}
```

### Type System Interfaces

#### `TypeInfo`

Type information structure.

```typescript
interface TypeInfo<TypeContext = unknown> {
  // FHIRPath type
  type: TypeName;
  singleton?: boolean;

  // Model type information FHIR.Patient; FHIR.string; 
  namespace?: string;
  name?: string;

  // opaque context for model provider
  modelContext?: TypeContext;
}
```

#### `ModelProvider`

Interface for integrating with data models.

```typescript
interface ModelProvider<TypeContext = unknown> {
  getType(typeName: string): Promise<TypeInfo<TypeContext> | undefined>;
  
  // get element type from complex type
  getElementType(parentType: TypeInfo<TypeContext>, propertyName: string): Promise<TypeInfo<TypeContext> | undefined>;

  // get type from union type
  ofType(type: TypeInfo<TypeContext>, typeName: TypeName): TypeInfo<TypeContext> | undefined;

  // get element names from complex type
  getElementNames(parentType: TypeInfo<TypeContext>): string[];

  // Returns a union type of all possible child element types
  getChildrenType(parentType: TypeInfo<TypeContext>): Promise<TypeInfo<TypeContext> | undefined>;

  // Get detailed information about elements of a type for completion suggestions
  getElements(typeName: string): Promise<Array<{
    name: string;
    type: string;
    documentation?: string;
  }>>;

  // Get list of all resource types (now async for clean design)
  getResourceTypes(): Promise<string[]>;
  
  // Get list of all complex types
  getComplexTypes(): Promise<string[]>;
  
  // Get list of all primitive types
  getPrimitiveTypes(): Promise<string[]>;
}
```

### Diagnostic Interfaces

#### `Diagnostic`

LSP-compatible diagnostic structure.

```typescript
interface Diagnostic {
  range: Range;
  severity?: DiagnosticSeverity;
  code?: string;
  source?: string;
  message: string;
  tags?: number[];
  relatedInformation?: any[];
  data?: any;
}
```

#### `DiagnosticSeverity`

Diagnostic severity levels.

```typescript
enum DiagnosticSeverity {
  Error = 1,
  Warning = 2,
  Information = 3,
  Hint = 4
}
```

## Types

### Type Definitions

#### `TypeName`

FHIRPath primitive type names.

```typescript
type TypeName = 
  | 'Any'
  | 'Boolean'
  | 'String'
  | 'Integer'
  | 'Long'
  | 'Decimal'
  | 'Date'
  | 'DateTime'
  | 'Time'
  | 'Quantity';
```

#### `NodeType`

AST node types.

```typescript
enum NodeType {
  EOF = 'EOF',
  Binary = 'Binary',
  Unary = 'Unary',
  TypeOrIdentifier = 'TypeOrIdentifier',
  Identifier = 'Identifier',
  Literal = 'Literal',
  Function = 'Function',
  Variable = 'Variable',
  Index = 'Index',
  MembershipTest = 'MembershipTest',
  TypeCast = 'TypeCast',
  Collection = 'Collection',
  TypeReference = 'TypeReference',
  Quantity = 'Quantity',
}
```

#### `Range`

Source position range.

```typescript
interface Range {
  start: Position;
  end: Position;
}

interface Position {
  line: number;      // 0-based
  character: number; // 0-based
  offset?: number;   // Absolute offset
}
```

## Error Handling

### Parse Errors

Parse errors are returned in the `ParseResult`:

```typescript
interface ParseError {
  message: string;
  position: Position;
  range?: Range;
  token?: Token;
}

// Example
const result = parse('Patient..');
if (result.errors.length > 0) {
  const error = result.errors[0];
  console.error(`Parse error at ${error.position.line}:${error.position.character}: ${error.message}`);
}
```

### Runtime Errors

Runtime errors throw exceptions:

```typescript
try {
  const result = evaluate('1 / 0', { input: [] });
} catch (error) {
  console.error('Runtime error:', error.message);
}
```

### Analysis Diagnostics

Static analysis returns diagnostics:

```typescript
const result = analyze('Patient.unknownProperty');
for (const diagnostic of result.diagnostics) {
  console.log(`${diagnostic.severity}: ${diagnostic.message}`);
}
```

## Examples

### Basic Usage

```typescript
import { evaluate } from '@fhirpath/core';

// Property navigation
const patientNames = await evaluate('name.given', {
  input: {
    name: [
      { given: ['John', 'James'], family: 'Doe' },
      { given: ['Jane'], family: 'Doe' }
    ]
  }
});
// Result: ['John', 'James', 'Jane']
```

### Filtering and Selection

```typescript
// Filter with where()
const activePatients = await evaluate("entry.resource.where(resourceType = 'Patient' and active = true)", {
  input: bundle
});

// Project with select()
const fullNames = await evaluate("Patient.name.select(given.first() + ' ' + family)", {
  input: patient
});
```

### Working with Variables

```typescript
// Built-in variables
const result = await evaluate('$this.value > 10', {
  input: [{ value: 15 }, { value: 5 }]
});
// Result: [true, false]

// User-defined variables
const calculated = await evaluate('%base * %multiplier', {
  variables: {
    base: 100,
    multiplier: 1.5
  }
});
// Result: [150]
```

### Type Checking

```typescript
// Check types with is operator
const isPatient = await evaluate("Resource is Patient", {
  input: { resourceType: 'Patient', id: '123' }
});
// Result: [true]

// Cast with as operator
const patients = await evaluate("Bundle.entry.resource as Patient", {
  input: bundle
});
// Result: Only Patient resources
```

### Advanced Queries

```typescript
// Complex filtering with multiple conditions
const query = `
  Observation
    .where(status = 'final')
    .where(code.coding.exists(system = 'http://loinc.org'))
    .where(value as Quantity > 10 'mg/dL')
    .select({
      date: effectiveDateTime,
      value: value.value,
      unit: value.unit
    })
`;

const results = await evaluate(query, { input: observations });
```

### Error Handling Best Practices

```typescript
import { evaluate, parse, analyze } from '@fhirpath/core';

async function safeEvaluate(expression: string, input: any): Promise<any[] | null> {
  // First, parse the expression
  const parseResult = parse(expression);
  if (parseResult.errors.length > 0) {
    console.error('Parse errors:', parseResult.errors);
    return null;
  }
  
  // Then analyze for static errors
  const analysisResult = await analyze(expression);
  if (analysisResult.diagnostics.some(d => d.severity === DiagnosticSeverity.Error)) {
    console.error('Analysis errors:', analysisResult.diagnostics);
    return null;
  }
  
  // Finally, evaluate
  try {
    return await evaluate(expression, { input });
  } catch (error) {
    console.error('Runtime error:', error);
    return null;
  }
}
```

### Custom Model Provider

```typescript
import { ModelProvider, TypeInfo } from '@fhirpath/core';

class MyModelProvider implements ModelProvider {
  async getType(typeName: string): Promise<TypeInfo | undefined> {
    // Return type information for your model
    if (typeName === 'MyResource') {
      return {
        type: 'Any',
        namespace: 'MyModel',
        name: 'MyResource',
        singleton: true
      };
    }
    return undefined;
  }
  
  // Implement other required async methods...
}

// Use with analyzer
const result = await analyze('MyResource.items', {
  modelProvider: new MyModelProvider()
});
```

## Best Practices

1. **Always Check for Errors**: Parse results may contain errors even if an AST is returned (in LSP mode)

2. **Handle Empty Collections**: FHIRPath uses empty collections for "no value"
   ```typescript
   const result = await evaluate('nonexistent.property');
   // Result: [] (not null or undefined)
   ```

3. **Use Type Checking**: When working with polymorphic data, use type checking
   ```typescript
   const medications = await evaluate("List.entry.item.where(resolve() is Medication)");
   ```

4. **Provide Variables**: For reusable expressions, use variables
   ```typescript
   const template = '%resource.meta.lastUpdated > %cutoffDate';
   const recent = await evaluate(template, {
     variables: {
       resource: patient,
       cutoffDate: '2023-01-01'
     }
   });
   ```

5. **Validate Before Production**: Use analyze() to catch errors early
   ```typescript
   const diagnostics = (await analyze(userExpression)).diagnostics;
   if (diagnostics.length === 0) {
     // Safe to use in production
   }
   ```

## Performance Tips

1. **Parse Once, Evaluate Many**: For repeated evaluations, parse once and reuse the AST
   ```typescript
   const ast = parse('complicated.expression').ast;
   const interpreter = new Interpreter();
   
   for (const resource of resources) {
     const result = await interpreter.evaluate(ast, [resource]);
   }
   ```

2. **Use Simple Expressions**: Complex expressions with many operations are slower
   ```typescript
   // Prefer
   await evaluate('Patient.name.given');
   
   // Over
   await evaluate('Patient.name.select(given).flatten()');
   ```

3. **Limit Collection Sizes**: Operations on large collections can be expensive
   ```typescript
   // Use take() to limit results
   await evaluate('largeList.take(100)');
   ```

## Migration Guide

### From JavaScript eval()

```javascript
// Old (unsafe)
const result = eval(`patient.name[0].given[0]`);

// New (safe)
const result = (await evaluate('Patient.name.first().given.first()', {
  input: patient
}))[0];
```

### From JSONPath

```javascript
// JSONPath
const names = jsonpath.query(patient, '$.name[*].given[*]');

// FHIRPath
const names = await evaluate('Patient.name.given', { input: patient });
```

### From XPath

```xml
<!-- XPath -->
//Patient/name/given/text()

<!-- FHIRPath -->
Patient.name.given
```

## Changelog

See [CHANGELOG.md](../CHANGELOG.md) for version history and breaking changes.

## Support

- GitHub Issues: [github.com/fhirpath/fhirpath.js/issues](https://github.com/fhirpath/fhirpath.js/issues)
- Specification: [hl7.org/fhirpath/](http://hl7.org/fhirpath/)
- Community: [chat.fhir.org/#narrow/stream/179266-fhirpath](https://chat.fhir.org/#narrow/stream/179266-fhirpath)