# @atomic-ehr/fhirpath

A TypeScript implementation of FHIRPath, the path-based navigation and extraction language for FHIR (Fast Healthcare Interoperability Resources).

## Installation

```bash
npm install @atomic-ehr/fhirpath
# or
bun add @atomic-ehr/fhirpath
```

## Quick Start

```typescript
import fhirpath from '@atomic-ehr/fhirpath';

const patient = {
  name: [
    { given: ['John', 'James'], family: 'Doe' },
    { given: ['Johnny'], family: 'Doe' }
  ],
  birthDate: '1990-01-01'
};

// Simple evaluation
const givenNames = fhirpath.evaluate('name.given', patient);
console.log(givenNames); // ['John', 'James', 'Johnny']

// With filtering
const officialName = fhirpath.evaluate('name.where(use = \'official\').given', patient);

// Arithmetic
const age = fhirpath.evaluate('today().year() - birthDate.toDateTime().year()', patient);
```

## API Reference

### Core Functions

#### `parse(expression: string): FHIRPathExpression`

Parses a FHIRPath expression string into an AST (Abstract Syntax Tree).

```typescript
const expr = fhirpath.parse('Patient.name.given');
// Use the parsed expression multiple times
const result1 = fhirpath.evaluate(expr, patient1);
const result2 = fhirpath.evaluate(expr, patient2);
```

#### `evaluate(expression: string | FHIRPathExpression, input?: any, context?: EvaluationContext): any[]`

Evaluates a FHIRPath expression against input data.

```typescript
// Evaluate with string expression
const names = fhirpath.evaluate('name.family', patient);

// Evaluate with parsed expression
const expr = fhirpath.parse('name.family');
const names = fhirpath.evaluate(expr, patient);

// With context variables
const result = fhirpath.evaluate('%myVar + 5', null, {
  variables: { myVar: 10 }
}); // [15]
```

#### `compile(expression: string | FHIRPathExpression, options?: CompileOptions): CompiledExpression`

Compiles an expression into an optimized JavaScript function for better performance.

```typescript
const compiled = fhirpath.compile('name.given');

// Use compiled function multiple times
const names1 = compiled(patient1);
const names2 = compiled(patient2);
```

#### `analyze(expression: string | FHIRPathExpression, options?: AnalyzeOptions): AnalysisResult`

Performs static type analysis on an expression.

```typescript
const analysis = fhirpath.analyze('name.given');
console.log(analysis.type); // Type information
console.log(analysis.errors); // Any type errors
```

#### `inspect(expression: string | FHIRPathExpression, input?: any, context?: EvaluationContext, options?: InspectOptions): InspectResult`

Evaluates an expression while capturing rich debugging information including traces, execution time, and AST.

```typescript
// Basic usage - capture trace output
const result = fhirpath.inspect(
  'name.trace("names").given.trace("given names")',
  patient
);

console.log(result.result);        // ['John', 'James', 'Johnny']
console.log(result.traces);        // Array of trace entries
console.log(result.executionTime); // Time in milliseconds
console.log(result.ast);           // Parsed AST

// Access trace information
result.traces.forEach(trace => {
  console.log(`${trace.name}: ${JSON.stringify(trace.values)}`);
  console.log(`  at ${trace.timestamp}ms, depth: ${trace.depth}`);
});

// With options
const detailedResult = fhirpath.inspect(
  'Patient.name.where(use = "official")',
  bundle,
  undefined,
  { 
    maxTraces: 100,      // Limit number of traces collected
    recordSteps: true    // Future: enable step-by-step recording
  }
);

// Error handling
const errorResult = fhirpath.inspect('invalid.expression()');
if (errorResult.errors) {
  console.log('Errors:', errorResult.errors);
}
```

The `InspectResult` contains:
- `result`: The evaluation result (same as `evaluate()`)
- `expression`: The original expression string
- `ast`: The parsed Abstract Syntax Tree
- `executionTime`: Total execution time in milliseconds
- `traces`: Array of trace entries from `trace()` calls
- `errors`: Any errors encountered during evaluation
- `warnings`: Any warnings (optional)
- `evaluationSteps`: Step-by-step evaluation details (when enabled)

### Registry API

The registry provides introspection capabilities for available operations.

```typescript
// List all available functions
const functions = fhirpath.registry.listFunctions();
console.log(functions.map(f => f.name)); // ['where', 'select', 'first', ...]

// Check if operation exists
fhirpath.registry.hasFunction('where'); // true
fhirpath.registry.hasOperator('+'); // true

// Get operation details
const whereInfo = fhirpath.registry.getOperationInfo('where');
console.log(whereInfo.syntax.notation); // "where(expression)"

// Validate custom function names
fhirpath.registry.canRegisterFunction('myFunc'); // true
fhirpath.registry.canRegisterFunction('where'); // false (built-in)
```

### Builder Pattern

For advanced configurations, use the builder pattern:

```typescript
import { FHIRPath } from '@atomic-ehr/fhirpath';

const fp = FHIRPath.builder()
  // Add custom functions
  .withCustomFunction('double', (context, input) => {
    return input.map(x => x * 2);
  })
  
  // Set default variables
  .withVariable('defaultStatus', 'active')
  
  // Add model provider for type information
  .withModelProvider({
    resolveType: (typeName) => { /* ... */ },
    getTypeHierarchy: (typeName) => { /* ... */ },
    getProperties: (typeName) => { /* ... */ }
  })
  
  .build();

// Use the configured instance
const result = fp.evaluate('value.double()', { value: [5] }); // [10]
const status = fp.evaluate('%defaultStatus'); // ['active']
```

### Custom Functions

Custom functions extend FHIRPath with domain-specific operations:

```typescript
const fp = FHIRPath.builder()
  .withCustomFunction('age', (context, input) => {
    // Calculate age from birthDate
    return input.map(birthDate => {
      const today = new Date();
      const birth = new Date(birthDate);
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      return age;
    });
  })
  .withCustomFunction('fullName', (context, input) => {
    return input.map(name => {
      if (name && typeof name === 'object') {
        const given = Array.isArray(name.given) ? name.given.join(' ') : '';
        const family = name.family || '';
        return `${given} ${family}`.trim();
      }
      return '';
    });
  })
  .build();

// Use custom functions
const age = fp.evaluate('birthDate.age()', patient);
const fullNames = fp.evaluate('name.fullName()', patient);
```

### Error Handling

All API functions throw `FHIRPathError` for invalid expressions or runtime errors:

```typescript
import { FHIRPathError, ErrorCode } from '@atomic-ehr/fhirpath';

try {
  fhirpath.parse('invalid..expression');
} catch (error) {
  if (error instanceof FHIRPathError) {
    console.error(`Error: ${error.message}`);
    console.error(`Code: ${error.code}`);
    console.error(`Location: Line ${error.location?.line}, Column ${error.location?.column}`);
  }
}
```

### Type Definitions

The library is fully typed with TypeScript:

```typescript
import type {
  FHIRPathExpression,
  CompiledExpression,
  EvaluationContext,
  ModelProvider,
  CustomFunction,
  OperationInfo,
  AnalysisResult,
  InspectResult,
  InspectOptions
} from '@atomic-ehr/fhirpath';
```

## Common Use Cases

### Working with FHIR Resources

```typescript
const bundle = {
  resourceType: 'Bundle',
  entry: [
    { resource: { resourceType: 'Patient', id: '1', active: true } },
    { resource: { resourceType: 'Patient', id: '2', active: false } },
    { resource: { resourceType: 'Observation', status: 'final' } }
  ]
};

// Get all patients
const patients = fhirpath.evaluate(
  'entry.resource.where(resourceType = \'Patient\')',
  bundle
);

// Get active patients
const activePatients = fhirpath.evaluate(
  'entry.resource.where(resourceType = \'Patient\' and active = true)',
  bundle
);

// Count resources by type
const patientCount = fhirpath.evaluate(
  'entry.resource.where(resourceType = \'Patient\').count()',
  bundle
); // [2]
```

### Complex Filtering

```typescript
const observations = [
  { code: { coding: [{ system: 'loinc', code: '1234' }] }, value: 140 },
  { code: { coding: [{ system: 'loinc', code: '1234' }] }, value: 120 },
  { code: { coding: [{ system: 'loinc', code: '5678' }] }, value: 98.6 }
];

// Find high blood pressure readings
const highBP = fhirpath.evaluate(
  'where(code.coding.exists(system = \'loinc\' and code = \'1234\') and value > 130)',
  observations
);
```

### Date Manipulation

```typescript
const patient = {
  birthDate: '1990-05-15'
};

// Check if patient is adult (>= 18 years)
const isAdult = fhirpath.evaluate(
  'today() - birthDate.toDateTime() >= 18 years',
  patient
);
```

### Debugging Expressions

Use the `inspect()` function to debug complex FHIRPath expressions:

```typescript
const bundle = {
  entry: [
    { resource: { resourceType: 'Patient', name: [{ given: ['John'] }] } },
    { resource: { resourceType: 'Patient', name: [{ given: ['Jane'] }] } }
  ]
};

// Debug a complex expression with traces
const result = fhirpath.inspect(
  `entry.resource
    .trace('all resources')
    .where(resourceType = 'Patient')
    .trace('patients only')
    .name.given
    .trace('all given names')`,
  bundle
);

// Analyze the execution
console.log('Result:', result.result);
console.log('Execution time:', result.executionTime + 'ms');
console.log('\nTrace output:');
result.traces.forEach(trace => {
  console.log(`- ${trace.name}: ${trace.values.length} items`);
});

// Output:
// Result: ['John', 'Jane']
// Execution time: 0.523ms
// 
// Trace output:
// - all resources: 2 items
// - patients only: 2 items
// - all given names: 2 items
```

## Performance Tips

1. **Parse Once, Evaluate Many**: Parse expressions once and reuse the parsed AST:
   ```typescript
   const expr = fhirpath.parse('name.given');
   for (const patient of patients) {
     const names = fhirpath.evaluate(expr, patient);
   }
   ```

2. **Use Compiled Functions**: For expressions evaluated frequently, use compilation:
   ```typescript
   const getName = fhirpath.compile('name.given');
   const results = patients.map(p => getName(p));
   ```

3. **Builder Instance**: Create a configured instance once and reuse:
   ```typescript
   const fp = FHIRPath.builder()
     .withCustomFunction('myFunc', /* ... */)
     .build();
   // Use fp instance throughout your application
   ```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and guidelines.

## License

MIT
