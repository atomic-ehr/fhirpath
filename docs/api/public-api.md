# Public API Reference

## Overview

The FHIRPath implementation provides a clean, user-friendly API for parsing, analyzing, and evaluating FHIRPath expressions. The API is designed to be intuitive while providing access to advanced features when needed.

## Main Entry Points
**Location**: [`/src/api/index.ts`](../../src/api/index.ts)

### parse()
Parse a FHIRPath expression with configurable options.

```typescript
export function parse(
  expression: string, 
  options?: ParserOptions
): ParseResult

export interface ParserOptions {
  throwOnError?: boolean;    // Throw on first error (fastest)
  trackRanges?: boolean;     // Track source ranges for AST nodes
  errorRecovery?: boolean;   // Enable error recovery for partial ASTs
  maxErrors?: number;        // Maximum errors to collect
}

export interface ParseResult {
  ast: ASTNode;              // The parsed AST
  diagnostics: ParseDiagnostic[]; // Syntax errors/warnings
  hasErrors: boolean;        // Quick error check
  isPartial?: boolean;       // Present when errorRecovery enabled
  ranges?: Map<ASTNode, TextRange>; // Present when trackRanges enabled
}
```

**Examples:**
```typescript
import { parse } from '@atomic-ehr/fhirpath';

// Default parsing - collects diagnostics
const result = parse("Patient.name.given");
if (result.hasErrors) {
  console.log('Syntax errors:', result.diagnostics);
} else {
  const ast = result.ast;
  // Use the AST...
}

// Fast parsing for production
try {
  const result = parse("Patient.name", { throwOnError: true });
  const ast = result.ast;
} catch (error) {
  console.error('Parse error:', error.message);
}

// Development mode with all features
const devResult = parse("Patient..name", {
  errorRecovery: true,
  trackRanges: true,
  maxErrors: 10
});
```

### parseForEvaluation()
Convenience function for fast parsing that throws on errors.

```typescript
export function parseForEvaluation(expression: string): ASTNode
```

**Example:**
```typescript
import { parseForEvaluation } from '@atomic-ehr/fhirpath';

try {
  const ast = parseForEvaluation("Patient.name.given");
  // Use AST directly - no need to check result.ast
} catch (error) {
  console.error('Invalid expression:', error.message);
}
```

### validate()
Validate expression syntax without throwing errors.

```typescript
export function validate(
  expression: string
): { valid: boolean; diagnostics: ParseDiagnostic[] }
```

**Example:**
```typescript
import { validate } from '@atomic-ehr/fhirpath';

const validation = validate("Patient..name");
if (!validation.valid) {
  validation.diagnostics.forEach(diag => {
    console.log(`Error at ${diag.range.start.line}:${diag.range.start.character}: ${diag.message}`);
  });
}
```

### evaluate()
Evaluate a FHIRPath expression against input data.

```typescript
export function evaluate(
  expression: string | FHIRPathExpression,
  input?: any,
  context?: EvaluationContext
): any[]

export interface EvaluationContext {
  // User-defined variables
  variables?: Record<string, any>;
  
  // Environment variables (Note: currently not fully implemented)
  environment?: Record<string, any>;
  
  // Model provider for type information
  modelProvider?: ModelProvider;
  
  // Custom functions (Note: experimental)
  customFunctions?: CustomFunctionMap;
}

export type CustomFunction = (
  context: Context,
  input: any[],
  ...args: any[]
) => any[];

export type CustomFunctionMap = Record<string, CustomFunction>;
```

**Examples:**
```typescript
import { evaluate } from '@fhirpath/core';

// Basic evaluation
const result = evaluate(
  "name.given",
  { name: [{ given: ["John", "Q"], family: "Doe" }] }
);
// Result: ["John", "Q"]

// With variables
const result2 = evaluate(
  "encounter.where(id = %encounterId)",
  patient,
  {
    variables: { encounterId: "12345" }
  }
);

// With custom functions (via builder pattern)
const fhirpath = FHIRPath.builder()
  .withCustomFunction('age', (context, input, ...args) => {
    const birthDate = input[0];
    // Calculate age...
    return [calculatedAge];
  })
  .build();

const result3 = fhirpath.evaluate(
  "Patient.birthDate.age() > 18",
  patient
);
```

### compile()
Pre-compile an expression for repeated execution.

```typescript
export function compile(
  expression: string | FHIRPathExpression,
  options?: CompileOptions
): CompiledExpression

export interface CompileOptions {
  // Optimization flag
  optimize?: boolean;
  
  // Include source map for debugging
  sourceMap?: boolean;
}

export interface CompiledExpression {
  // The compiled expression is a function
  (input?: any, context?: EvaluationContext): any[];
  
  // Source property contains the original expression or string representation
  readonly source: string;
}
```

**Example:**
```typescript
import { compile } from '@fhirpath/core';

// Compile once
const compiled = compile("Patient.name.where(use = 'official').given");

// Execute many times
for (const patient of patients) {
  const result = compiled(patient);
  console.log(result);
}

// Access source
console.log(compiled.source);
```

### analyze()
Perform static type analysis on an expression.

```typescript
export function analyze(
  expression: string | FHIRPathExpression,
  options?: AnalyzeOptions
): AnalysisResult

export interface AnalyzeOptions {
  // Model provider for type information
  modelProvider?: ModelProvider;
  
  // Strict mode for analysis
  strict?: boolean;
}

export interface AnalysisResult {
  // Inferred return type
  type: TypeRef;
  
  // Whether result is a singleton
  isSingleton: boolean;
  
  // Analysis errors
  errors: AnalysisError[];
  
  // Analysis warnings
  warnings: AnalysisWarning[];
}

export interface AnalysisError {
  message: string;
  location?: Location;
  code: string;
}

export interface AnalysisWarning {
  message: string;
  location?: Location;
  code: string;
}
```

**Example:**
```typescript
import { analyze } from '@fhirpath/core';

const result = analyze(
  "Patient.name.where(use = 'official').given",
  {
    modelProvider: myModelProvider
  }
);

if (result.errors.length > 0) {
  console.error('Type errors:', result.errors);
} else {
  console.log('Return type:', result.type);
  console.log('Is singleton:', result.isSingleton);
}
```

## Expression API
**Location**: [`/src/api/expression.ts`](../../src/api/expression.ts)

### FHIRPathExpression Interface
Wrapper around AST providing convenient methods.

```typescript
export interface FHIRPathExpression {
  readonly ast: ASTNode;
  evaluate(input?: any, context?: EvaluationContext): any[];
  compile(options?: CompileOptions): CompiledExpression;
  analyze(options?: AnalyzeOptions): AnalysisResult;
  toString(): string;
}
```

**Example:**
```typescript
import { parse } from '@fhirpath/core';

const expr = parse("Patient.name.given");

// Various operations
const result = expr.evaluate(patient);
const compiled = expr.compile();
const analysis = expr.analyze({ modelProvider: myModelProvider });

console.log(expr.toString()); // S-expression representation of AST
console.log(expr.ast); // Access raw AST
```

## Builder API
**Location**: [`/src/api/builder.ts`](../../src/api/builder.ts)

### FHIRPath Builder
Builder pattern for creating configured FHIRPath API instances.

```typescript
export class FHIRPath {
  static builder(): FHIRPathBuilder;
}

export interface FHIRPathBuilder {
  withModelProvider(provider: ModelProvider): this;
  withCustomFunction(name: string, fn: CustomFunction): this;
  withVariable(name: string, value: any): this;
  build(): FHIRPathAPI;
}

export interface FHIRPathAPI {
  parse(expression: string): FHIRPathExpression;
  evaluate(expression: string | FHIRPathExpression, input?: any): any[];
  compile(expression: string | FHIRPathExpression): CompiledExpression;
  analyze(expression: string | FHIRPathExpression): AnalysisResult;
  registry: RegistryAPI;
}
```

**Example:**
```typescript
import { FHIRPath } from '@fhirpath/core';

// Create configured FHIRPath instance
const fhirpath = FHIRPath.builder()
  .withModelProvider(myModelProvider)
  .withCustomFunction('age', (context, input) => {
    // Calculate age from birthDate
    return [calculatedAge];
  })
  .withVariable('currentDate', new Date())
  .build();

// Use the configured instance
const result = fhirpath.evaluate(
  "Patient.birthDate.age() > 18",
  patient
);
```

## Registry API
**Location**: [`/src/api/registry.ts`](../../src/api/registry.ts)

### Registry Access
Read-only access to the operation registry.

```typescript
// Registry API interface
export interface RegistryAPI {
  // List operations by type
  listFunctions(): OperationMetadata[];
  listOperators(): OperationMetadata[];
  listAllOperations(): OperationMetadata[];
  
  // Check existence
  hasOperation(name: string): boolean;
  hasFunction(name: string): boolean;
  hasOperator(symbol: string): boolean;
  
  // Get operation metadata
  getOperationInfo(name: string): OperationInfo | undefined;
  
  // Extension validation
  canRegisterFunction(name: string): boolean;
}

// Access default registry
export const registry: RegistryAPI;
```

**Example:**
```typescript
import { registry } from '@fhirpath/core';

// Check if function exists
if (registry.hasFunction('where')) {
  console.log('where function is available');
}

// List all functions
const functions = registry.listFunctions();
functions.forEach(fn => {
  console.log(`${fn.name}: ${fn.syntax.notation}`);
});

// Get operation info
const whereInfo = registry.getOperationInfo('where');
console.log(whereInfo);

// Check if can register custom function
if (registry.canRegisterFunction('myCustomFunction')) {
  // Use builder pattern to add custom function
  const fhirpath = FHIRPath.builder()
    .withCustomFunction('myCustomFunction', myFunc)
    .build();
}
```

## Error Types
**Location**: [`/src/api/errors.ts`](../../src/api/errors.ts)

### Error Classes

```typescript
// Error codes enum
export enum ErrorCode {
  PARSE_ERROR = 'PARSE_ERROR',
  SYNTAX_ERROR = 'SYNTAX_ERROR',
  TYPE_ERROR = 'TYPE_ERROR',
  RUNTIME_ERROR = 'RUNTIME_ERROR',
  UNDEFINED_VARIABLE = 'UNDEFINED_VARIABLE',
  UNDEFINED_FUNCTION = 'UNDEFINED_FUNCTION',
  INVALID_ARGUMENT = 'INVALID_ARGUMENT',
  // ... more codes
}

// Single error class with code discrimination
export class FHIRPathError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public location?: Location,
    public expression?: string
  ) {
    super(message);
  }
  
  // Pretty printing with location info
  toString(): string;
}

// Factory functions
export function parseError(message: string, location?: Location, expression?: string): FHIRPathError;
export function typeError(message: string, location?: Location, expression?: string): FHIRPathError;
export function runtimeError(message: string, location?: Location, expression?: string): FHIRPathError;
export function undefinedVariable(name: string, location?: Location, expression?: string): FHIRPathError;
export function undefinedFunction(name: string, location?: Location, expression?: string): FHIRPathError;
export function invalidArgument(message: string, location?: Location, expression?: string): FHIRPathError;
```

**Error Handling Example:**
```typescript
import { evaluate, FHIRPathError, ErrorCode } from '@fhirpath/core';

try {
  const result = evaluate("invalid expression!", data);
} catch (error) {
  if (error instanceof FHIRPathError) {
    switch (error.code) {
      case ErrorCode.PARSE_ERROR:
      case ErrorCode.SYNTAX_ERROR:
        console.error(`Parse error: ${error.message}`);
        break;
      case ErrorCode.TYPE_ERROR:
        console.error(`Type error: ${error.message}`);
        break;
      case ErrorCode.RUNTIME_ERROR:
        console.error(`Runtime error: ${error.message}`);
        break;
      case ErrorCode.UNDEFINED_VARIABLE:
        console.error(`Undefined variable: ${error.message}`);
        break;
    }
    
    // Pretty print with location
    console.error(error.toString());
  }
}
```

## Type Definitions
**Location**: [`/src/api/types.ts`](../../src/api/types.ts)

### Core Types

```typescript
// Type references (opaque type from analyzer)
export type TypeRef = unknown;

// Model provider for external type information
export interface ModelProvider {
  resolveType(typeName: string): TypeRef | undefined;
  getTypeHierarchy(typeName: string): string[];
  getProperties(typeName: string): PropertyDefinition[];
  getTypeName?(type: TypeRef): string;
}

export interface PropertyDefinition {
  name: string;
  type: string;
  isCollection: boolean;
  isRequired: boolean;
}

// Location information
export interface Location {
  line: number;
  column: number;
  offset: number;
  length: number;
}
```

## Complete Example

```typescript
import {
  parse,
  evaluate,
  compile,
  analyze,
  FHIRPath,
  registry
} from '@fhirpath/core';

// 1. Parse and evaluate
const result1 = evaluate(
  "Patient.contact.where(relationship.coding.exists(system = 'http://terminology.hl7.org/CodeSystem/v2-0131' and code = 'N')).name.given",
  patient
);

// 2. Parse expression
const expr = parse(
  "Patient.contact.where(relationship.coding.exists(system = 'http://terminology.hl7.org/CodeSystem/v2-0131' and code = 'N')).name.given"
);

// 3. Compile for performance
const compiled = compile(expr);
const results = patients.map(p => compiled(p));

// 4. Create configured instance with custom functions
const fhirpath = FHIRPath.builder()
  .withModelProvider(myModelProvider)
  .withCustomFunction('isAdult', (context, input) => {
    const birthDate = input[0];
    // Calculate if over 18...
    return [isOver18];
  })
  .withVariable('currentYear', 2024)
  .build();

// 5. Use configured instance
const result2 = fhirpath.evaluate(
  "Patient.birthDate.isAdult()",
  patient
);

// 6. Type checking
const analysis = fhirpath.analyze(
  "Patient.birthDate.isAdult()"
);

if (analysis.errors.length === 0) {
  console.log('Expression is type-safe!');
  console.log('Return type:', analysis.type);
  console.log('Is singleton:', analysis.isSingleton);
}

// 7. Registry inspection
if (registry.hasFunction('where')) {
  const whereInfo = registry.getOperationInfo('where');
  console.log('where function:', whereInfo);
}
```

## Best Practices

1. **Pre-compile expressions** for better performance when evaluating repeatedly
2. **Use type analysis** to catch errors early in development
3. **Register custom functions** in a shared registry for consistency
4. **Handle errors appropriately** based on error types
5. **Use the builder API** for dynamic expression construction
6. **Provide type information** via ModelProvider for better analysis
7. **Cache compiled expressions** to avoid recompilation overhead