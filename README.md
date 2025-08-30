# @atomic-ehr/fhirpath

[![npm version](https://badge.fury.io/js/@atomic-ehr%2Ffhirpath.svg)](https://www.npmjs.com/package/@atomic-ehr/fhirpath)

A TypeScript implementation of FHIRPath, the path-based navigation and extraction language for FHIR (Fast Healthcare Interoperability Resources).

## Installation

```bash
npm install @atomic-ehr/fhirpath
# or
bun add @atomic-ehr/fhirpath
```

## Quick Start

```typescript
import { evaluate } from '@atomic-ehr/fhirpath';

const patient = {
  name: [
    { given: ['John', 'James'], family: 'Doe' },
    { given: ['Johnny'], family: 'Doe' }
  ],
  birthDate: '1990-01-01'
};

// Simple evaluation (async)
const givenNames = await evaluate('name.given', { input: patient });
console.log(givenNames); // ['John', 'James', 'Johnny']

// With filtering
const officialName = await evaluate(
  "name.where(use = 'official').given", 
  { input: patient }
);

// With variables
const result = await evaluate('%x + 5', { 
  variables: { x: 10 } 
});
console.log(result); // [15]
```

## API Reference

**Important Note**: As of version 2.0.0, all evaluation and analysis functions are async to support lazy loading of FHIR schemas and improved performance. Make sure to use `await` when calling `evaluate()`, `compile()`, `analyze()`, and `inspect()`.

### Core Functions

#### `parse(expression: string, options?: ParserOptions): ParseResult`

Parses a FHIRPath expression string into an AST (Abstract Syntax Tree) with optional parser features.

```typescript
import { parse } from '@atomic-ehr/fhirpath';

// Basic parsing (collects diagnostics)
const result = parse('Patient.name.given');
console.log(result.ast);         // The parsed AST
console.log(result.errors);      // Array of any syntax errors

// Parse with error recovery for IDE tools
const result = parse('Patient..name', {
  mode: 'lsp',           // Enable LSP mode
  errorRecovery: true    // Continue parsing after errors
});
console.log(result.errors);  // Contains parse errors
console.log(result.ast);     // Partial AST with error nodes
```

**Parser Options:**
- `mode?: 'simple' | 'lsp'` - Parser mode (simple for fast parsing, lsp for IDE features)
- `errorRecovery?: boolean` - Enable error recovery to continue parsing after errors (LSP mode only)
- `cursorPosition?: number` - Cursor position for completion support (LSP mode only)

#### `evaluate(expression: string, options?: EvaluateOptions): Promise<any[]>`

Evaluates a FHIRPath expression against input data. **Note: This function is async.**

```typescript
import { evaluate } from '@atomic-ehr/fhirpath';

// Simple evaluation
const names = await evaluate('name.family', { input: patient });

// With variables
const result = await evaluate('%myVar + 5', {
  variables: { myVar: 10 }
}); // [15]

// With model provider for type checking
const modelProvider = new FHIRModelProvider({
  packages: [{ name: 'hl7.fhir.r4.core', version: '4.0.1' }]
});
await modelProvider.initialize();

const typed = await evaluate('Patient.name.given', {
  input: patient,
  modelProvider,
  inputType: { type: 'Patient', singleton: true }
});
```


#### `analyze(expression: string, options?: AnalyzeOptions): Promise<AnalysisResult>`

Performs static type analysis on a FHIRPath expression, with optional type checking using a FHIR model provider and error recovery for broken expressions. **Note: This function is now async.**

```typescript
// Basic analysis
const analysis = await analyze('name.given');
console.log(analysis.diagnostics); // Array of any issues found
console.log(analysis.ast); // The analyzed AST with type information

// With FHIR model provider for type checking
import { FHIRModelProvider } from '@atomic-ehr/fhirpath';

const modelProvider = new FHIRModelProvider({
  packages: [{ name: 'hl7.fhir.r4.core', version: '4.0.1' }]
});
await modelProvider.initialize();

const analysis = await analyze('Patient.birthDate.substring(0, 4)', {
  modelProvider
});
// Will report type error: substring() expects String but birthDate is date

// With error recovery for IDE/tooling scenarios
const analysis = await analyze('Patient.name.', {
  errorRecovery: true,  // Won't throw on syntax errors
  modelProvider
});
console.log(analysis.diagnostics); // Contains parse error: "Expected identifier after '.'"
console.log(analysis.ast); // Partial AST with error nodes

// With input type context
const analysis = await analyze('name.given', {
  modelProvider,
  inputType: { 
    type: 'HumanName',
    singleton: false 
  }
});
```

**Analyze Options:**
- `modelProvider?: ModelProvider` - Provides type information for FHIR resources and data types
- `errorRecovery?: boolean` - Enable error tolerance for broken expressions (useful for IDEs)
- `variables?: Record<string, unknown>` - Variables available in the expression context
- `inputType?: TypeInfo` - Type information for the input context

#### `inspect(expression: string, options?: InspectOptions): Promise<InspectResult>`

Evaluates an expression while capturing rich debugging information including traces, execution time, and AST. **Note: This function is async.**

```typescript
import { inspect } from '@atomic-ehr/fhirpath';

// Basic usage - capture trace output
const result = await inspect(
  'name.trace("names").given.trace("given names")',
  { input: patient }
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
const detailedResult = await inspect(
  'Patient.name.where(use = "official")',
  { 
    input: bundle,
    maxTraces: 100      // Limit number of traces collected
  }
);

// Error handling
const errorResult = await inspect('invalid.expression()', {});
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
import { registry } from '@atomic-ehr/fhirpath';

// List all available functions
const functions = registry.listFunctions();
console.log(functions.map(f => f.name)); // ['where', 'select', 'first', ...]

// List all available operators
const operators = registry.listOperators();
console.log(operators.map(o => o.name)); // ['+', '-', '*', ...]

// Get function metadata
const whereFunction = registry.getFunction('where');
console.log(whereFunction?.signatures); // Function signatures

// Get operator metadata
const plusOperator = registry.getOperator('+');
console.log(plusOperator?.precedence); // Operator precedence
```

### FHIR Model Provider

The FHIR Model Provider enables advanced type checking and validation for FHIR resources:

```typescript
import { FHIRModelProvider, analyze } from '@atomic-ehr/fhirpath';

// Create and initialize the model provider
const modelProvider = new FHIRModelProvider({
  packages: [{ name: 'hl7.fhir.r4.core', version: '4.0.1' }]
});

// Initialize before use (loads FHIR type definitions)
await modelProvider.initialize();

// Use with analyze for type checking (async)
const result = await analyze('Patient.active.substring(0, 1)', { modelProvider });
// Diagnostics: "Type mismatch: function 'substring' expects input type String but got Boolean"

// Type-aware property navigation
const result2 = await analyze('Patient.birthDate.year()', { modelProvider });
// Works correctly - birthDate is recognized as a date type

// Detect invalid property access
const result3 = await analyze('Patient.invalidProperty', { modelProvider });
// Diagnostics: "Unknown property 'invalidProperty' on type FHIR.Patient"

// Works with complex paths
const result4 = await analyze(
  'Bundle.entry.resource.where(resourceType = "Patient").name.given',
  { modelProvider }
);
// Validates entire path with proper type information
```

The model provider supports:
- Property validation and type checking
- Polymorphic type resolution
- Choice type handling (e.g., `value[x]`)
- Extension navigation
- Full FHIR R4 type system


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
  ASTNode,
  AnalysisResult,
  Diagnostic,
  DiagnosticSeverity,
  TypeInfo,
  ModelProvider,
  OperatorDefinition,
  FunctionDefinition,
  // Parser types
  ParseResult,
  // FHIR Model Provider
  FHIRModelProvider,
  FHIRModelProviderConfig,
  // Inspect types
  InspectResult,
  InspectOptions,
  ASTMetadata,
  // Completion types
  CompletionItem,
  CompletionOptions
} from '@atomic-ehr/fhirpath';
```

## IDE Integration and Error Recovery

The analyzer supports error recovery mode for IDE and tooling scenarios, allowing analysis of incomplete or syntactically incorrect expressions:

```typescript
// Normal mode - throws on syntax errors
try {
  const result = await analyze('Patient.name.');
} catch (error) {
  console.error('Syntax error:', error.message);
}

// Error recovery mode - continues analysis despite errors
const result = await analyze('Patient.name.', {
  errorRecovery: true
});

// Check diagnostics instead of catching errors
console.log(result.diagnostics);
// [{ 
//   message: "Expected identifier after '.', got: EOF",
//   severity: DiagnosticSeverity.Error,
//   range: { start: { line: 0, character: 13 }, end: { line: 0, character: 13 } }
// }]

// The AST contains error nodes but analysis continues
console.log(result.ast); // Partial AST with error nodes

// Complex broken expression - multiple errors reported
const result2 = await analyze('Patient.name.where(use = ).given.', {
  errorRecovery: true,
  modelProvider
});
console.log(result2.diagnostics.length); // 2 errors

// Type information is preserved for valid parts
const result3 = await analyze('5 + 3 * ', {
  errorRecovery: true
});
// Even though expression is incomplete, literals 5 and 3 have type info
```

This is particularly useful for:
- **Language servers**: Provide diagnostics while users type
- **IDE plugins**: Show errors inline without breaking analysis
- **Code completion**: Analyze partial expressions for context
- **Linting tools**: Report all issues in a single pass

## Supported Features

### Complete FHIRPath Function Coverage

This implementation supports **100% of FHIRPath functions** as defined in the specification:

#### Arithmetic Functions (13)
- **Basic**: `+`, `-`, `*`, `/`, `div`, `mod`, `power`
- **Math**: `abs`, `ceiling`, `floor`, `round`, `sqrt`, `truncate`

#### String Functions (19)
- **Properties**: `length`
- **Manipulation**: `substring`, `upper`, `lower`, `trim`, `toChars`, `repeat`
- **Testing**: `startsWith`, `endsWith`, `contains`, `matches`, `matchesFull`
- **Search**: `indexOf`, `lastIndexOf`
- **Transform**: `replace`, `replaceMatches`, `split`, `join`

#### Collection Functions (23)
- **Filtering**: `where`, `select`, `ofType`
- **Subsetting**: `first`, `last`, `tail`, `skip`, `take`, `single`
- **Existence**: `exists`, `empty`, `count`, `distinct`, `isDistinct`
- **Aggregation**: `all`, `allTrue`, `anyTrue`, `allFalse`, `anyFalse`
- **Combining**: `combine`, `union`, `intersect`, `exclude`
- **Membership**: `subsetOf`, `supersetOf`

#### Type Functions (16)
- **Conversion**: `toBoolean`, `toInteger`, `toLong`, `toDecimal`, `toString`, `toQuantity`
- **Testing**: `convertsToBoolean`, `convertsToInteger`, `convertsToLong`, `convertsToDecimal`, `convertsToString`, `convertsToQuantity`
- **Operators**: `is`, `as`
- **Boundaries**: `highBoundary`, `lowBoundary`

#### Temporal Functions (15)
- **Current**: `now`, `today`, `timeOfDay`
- **Extraction**: `dateOf`, `timeOf`, `yearOf`, `monthOf`, `dayOf`, `hourOf`, `minuteOf`, `secondOf`, `millisecondOf`, `timezoneOffsetOf`
- **Arithmetic**: Full support for date/time arithmetic with durations

#### Logical Operators (6)
- **Boolean**: `and`, `or`, `xor`, `not`, `implies`
- **Membership**: `in`, `contains`

#### Comparison Operators (8)
- **Equality**: `=`, `!=`, `~`, `!~`
- **Ordering**: `<`, `>`, `<=`, `>=`

#### Utility Functions (7)
- **Control**: `iif`, `defineVariable`
- **Navigation**: `children`, `descendants`
- **Debugging**: `trace`
- **Advanced**: `aggregate`
- **Indexing**: Array indexing with `[n]`

### Advanced Features

#### FHIR Model Integration
- Full R4, R5, STU3, DSTU2 support via `@atomic-ehr/fhir-canonical-manager`
- Type-aware property navigation
- Polymorphic type resolution
- Choice type handling (e.g., `value[x]`)
- Extension navigation

#### UCUM Quantity Support
- Complete UCUM unit system
- Unit conversion and normalization
- Quantity arithmetic with unit compatibility checking
- Temporal quantity support (years, months, days, etc.)

#### Temporal Types
- FHIR Date, DateTime, and Time types
- Timezone-aware operations
- Partial date support (e.g., "2023", "2023-05")
- Date/time boundary calculations
- Duration arithmetic

#### Variables and Context
- User-defined variables with `%` prefix
- Built-in variables: `$this`, `$index`, `$total`
- System variables: `%context`, `%resource`, `%rootResource`, `%ucum`
- Scoped variable definitions with `defineVariable()`

#### Type System
- Complete type inference
- Union type support
- Polymorphic function signatures
- Type coercion rules
- Singleton vs collection tracking

#### Performance Optimizations
- Compiled expression mode for repeated evaluations
- Prototype-based context for minimal allocation
- Schema and type hierarchy caching
- Optimized operator dispatch
- Lazy evaluation where applicable

#### IDE and Tooling Support
- LSP (Language Server Protocol) integration
- Context-aware code completions
- Error recovery for partial expressions
- Source range tracking for diagnostics
- Trivia preservation (comments, whitespace)
- Step-by-step debugging with `inspect()`

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
const patients = await evaluate(
  "entry.resource.where(resourceType = 'Patient')",
  { input: bundle }
);

// Get active patients
const activePatients = await evaluate(
  "entry.resource.where(resourceType = 'Patient' and active = true)",
  { input: bundle }
);

// Count resources by type
const patientCount = await evaluate(
  "entry.resource.where(resourceType = 'Patient').count()",
  { input: bundle }
); // [2]
```

### Complex Filtering and Navigation

**Important Note on Polymorphic Properties**: In FHIR JSON, polymorphic properties like `value[x]` are stored with their type suffix (e.g., `valueQuantity`, `valueString`). However, in FHIRPath expressions, you access them without the suffix and use `ofType()` to filter by type:
- JSON: `observation.valueQuantity.value`
- FHIRPath: `observation.value.ofType(Quantity).value`

```typescript
// Blood pressure observations (FHIR Observation resources)
const observations = [
  { 
    resourceType: 'Observation',
    code: { coding: [{ system: 'loinc', code: '85354-9' }] }, 
    valueQuantity: { value: 140, unit: 'mm[Hg]' },
    effectiveDateTime: '2024-01-15T10:30:00Z'  // In FHIR JSON, stored as effectiveDateTime
  },
  { 
    resourceType: 'Observation',
    code: { coding: [{ system: 'loinc', code: '85354-9' }] }, 
    valueQuantity: { value: 120, unit: 'mm[Hg]' },
    effectiveDateTime: '2024-01-14T09:00:00Z'  // In FHIR JSON, stored as effectiveDateTime
  },
  { 
    resourceType: 'Observation',
    code: { coding: [{ system: 'loinc', code: '8310-5' }] }, 
    valueQuantity: { value: 98.6, unit: '[degF]' },
    effectiveDateTime: '2024-01-15T10:30:00Z'  // In FHIR JSON, stored as effectiveDateTime
  }
];

// Find high blood pressure readings (systolic > 130)
// Note: In FHIRPath, polymorphic properties like value[x] are accessed directly as 'value'
const highBP = await evaluate(
  `where(code.coding.exists(system = 'loinc' and code = '85354-9') 
    and value.ofType(Quantity).value > 130)`,
  { input: observations }
);

// Get all observation values with units (for Quantity types)
const valuesWithUnits = await evaluate(
  "value.ofType(Quantity).select(value.toString() + ' ' + unit)",
  { input: observations }
); // ['140 mm[Hg]', '120 mm[Hg]', '98.6 [degF]']

// Find most recent observation
// Note: effective[x] can be DateTime, Period, Timing, or Instant
const mostRecent = await evaluate(
  'where(effective.ofType(dateTime) = effective.ofType(dateTime).max()).first()',
  { input: observations }
);
```

### Patient Demographics and Identifiers

```typescript
const patient = {
  resourceType: 'Patient',
  identifier: [
    { system: 'http://hospital.org/mrn', value: 'MRN-12345' },
    { system: 'http://hl7.org/fhir/sid/us-ssn', value: '123-45-6789' }
  ],
  name: [
    { 
      use: 'official', 
      family: 'Smith', 
      given: ['John', 'Robert'],
      prefix: ['Dr']
    },
    { 
      use: 'nickname', 
      given: ['Johnny'] 
    }
  ],
  telecom: [
    { system: 'phone', value: '555-0123', use: 'home' },
    { system: 'email', value: 'john@example.com', use: 'work' }
  ],
  birthDate: '1980-05-15',
  address: [
    {
      use: 'home',
      line: ['123 Main St', 'Apt 4B'],
      city: 'Boston',
      state: 'MA',
      postalCode: '02101'
    }
  ]
};

// Get patient's MRN
const mrn = await evaluate(
  "identifier.where(system = 'http://hospital.org/mrn').value",
  { input: patient }
); // ['MRN-12345']

// Get full official name
const fullName = await evaluate(
  "name.where(use = 'official').select((prefix | {}).first() + ' ' + given.join(' ') + ' ' + family)",
  { input: patient }
); // ['Dr John Robert Smith']

// Get all phone numbers
const phones = await evaluate(
  "telecom.where(system = 'phone').value",
  { input: patient }
); // ['555-0123']

// Get home address as single line
const address = await evaluate(
  "address.where(use = 'home').select(line.join(', ') + ', ' + city + ', ' + state + ' ' + postalCode)",
  { input: patient }
); // ['123 Main St, Apt 4B, Boston, MA 02101']

// Calculate age
const age = await evaluate(
  "today().toString().substring(0, 4).toInteger() - birthDate.substring(0, 4).toInteger()",
  { input: patient }
); // [44] (as of 2024)
```

### Medication and Dosage Calculations

```typescript
const medicationRequest = {
  resourceType: 'MedicationRequest',
  medication: {
    coding: [{ 
      system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
      code: '1049502',
      display: 'Acetaminophen 325 MG Oral Tablet'
    }]
  },
  dosageInstruction: [
    {
      timing: {
        repeat: {
          frequency: 2,
          period: 1,
          periodUnit: 'd'
        }
      },
      doseAndRate: [{
        doseQuantity: {
          value: 650,
          unit: 'mg',
          system: 'http://unitsofmeasure.org'
        }
      }]
    }
  ],
  dispenseRequest: {
    quantity: {
      value: 60,
      unit: 'TAB'
    },
    expectedSupplyDuration: {
      value: 30,
      unit: 'd'
    }
  }
};

// Get medication name (medication[x] can be CodeableConcept or Reference)
const medName = await evaluate(
  'medication.ofType(CodeableConcept).coding.display.first()',
  { input: medicationRequest }
); // ['Acetaminophen 325 MG Oral Tablet']

// Calculate daily dose
const dailyDose = await evaluate(
  'dosageInstruction.first().doseAndRate.doseQuantity.value * dosageInstruction.first().timing.repeat.frequency',
  { input: medicationRequest }
); // [1300] (650mg * 2 times per day)

// Get supply duration
const duration = await evaluate(
  "dispenseRequest.expectedSupplyDuration.value.toString() + ' ' + dispenseRequest.expectedSupplyDuration.unit",
  { input: medicationRequest }
); // ['30 d']
```

### Date and Time Operations

```typescript
const appointment = {
  resourceType: 'Appointment',
  start: '2024-03-15T14:30:00Z',
  end: '2024-03-15T15:00:00Z',
  created: '2024-03-01T10:00:00Z',
  participant: [
    {
      actor: { reference: 'Patient/123' },
      required: 'required',
      status: 'accepted'
    },
    {
      actor: { reference: 'Practitioner/456' },
      required: 'required',
      status: 'accepted'
    }
  ]
};

// Calculate appointment duration in minutes
const duration = await evaluate(
  '(end - start) / 1 minute',
  { input: appointment }
); // [30]

// Check if appointment is in the future
const isFuture = await evaluate(
  'start > now()',
  { input: appointment }
);

// Get appointment date only
const appointmentDate = await evaluate(
  'start.toString().substring(0, 10)',
  { input: appointment }
); // ['2024-03-15']

// Check if all participants accepted
const allAccepted = await evaluate(
  "participant.all(status = 'accepted')",
  { input: appointment }
); // [true]

// Days until appointment
const daysUntil = await evaluate(
  '(start - now()) / 1 day',
  { input: appointment }
);
```

### Laboratory Results Analysis

```typescript
const labResults = {
  resourceType: 'Bundle',
  entry: [
    {
      resource: {
        resourceType: 'Observation',
        code: { 
          coding: [{ 
            system: 'http://loinc.org',
            code: '2951-2',
            display: 'Sodium'
          }]
        },
        valueQuantity: { value: 145, unit: 'mmol/L' },  // In actual FHIR, this is stored as valueQuantity
        referenceRange: [{
          low: { value: 136, unit: 'mmol/L' },
          high: { value: 145, unit: 'mmol/L' }
        }],
        status: 'final',
        effectiveDateTime: '2024-01-15T08:00:00Z'  // In FHIR JSON, stored as effectiveDateTime
      }
    },
    {
      resource: {
        resourceType: 'Observation',
        code: { 
          coding: [{ 
            system: 'http://loinc.org',
            code: '2823-3',
            display: 'Potassium'
          }]
        },
        valueQuantity: { value: 5.5, unit: 'mmol/L' },  // In actual FHIR, this is stored as valueQuantity
        referenceRange: [{
          low: { value: 3.5, unit: 'mmol/L' },
          high: { value: 5.0, unit: 'mmol/L' }
        }],
        status: 'final',
        effectiveDateTime: '2024-01-15T08:00:00Z'  // In FHIR JSON, stored as effectiveDateTime
      }
    }
  ]
};

// Find all abnormal results (outside reference range)
const abnormalResults = await evaluate(
  `entry.resource.where(
    value.ofType(Quantity).value < referenceRange.low.value or 
    value.ofType(Quantity).value > referenceRange.high.value
  )`,
  { input: labResults }
);

// Get test names and values
const testSummary = await evaluate(
  `entry.resource.select(
    code.coding.display.first() + ': ' + 
    value.ofType(Quantity).value.toString() + ' ' + 
    value.ofType(Quantity).unit
  )`,
  { input: labResults }
); // ['Sodium: 145 mmol/L', 'Potassium: 5.5 mmol/L']

// Find critical values (e.g., potassium > 5.0)
const criticalValues = await evaluate(
  `entry.resource.where(
    code.coding.exists(code = '2823-3') and 
    value.ofType(Quantity).value > 5.0
  )`,
  { input: labResults }
);
```

### Allergy and Intolerance Checking

```typescript
const allergyIntolerance = {
  resourceType: 'AllergyIntolerance',
  clinicalStatus: {
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
      code: 'active'
    }]
  },
  verificationStatus: {
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
      code: 'confirmed'
    }]
  },
  type: 'allergy',
  category: ['medication'],
  criticality: 'high',
  code: {
    coding: [{
      system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
      code: '7980',
      display: 'Penicillin'
    }]
  },
  reaction: [
    {
      substance: {
        coding: [{
          system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
          code: '7980',
          display: 'Penicillin'
        }]
      },
      manifestation: [
        {
          coding: [{
            system: 'http://snomed.info/sct',
            code: '39579001',
            display: 'Anaphylaxis'
          }]
        },
        {
          coding: [{
            system: 'http://snomed.info/sct',
            code: '271807003',
            display: 'Rash'
          }]
        }
      ],
      severity: 'severe'
    }
  ]
};

// Check if allergy is active and confirmed
const isActiveConfirmed = await evaluate(
  "clinicalStatus.coding.code = 'active' and verificationStatus.coding.code = 'confirmed'",
  { input: allergyIntolerance }
); // [true]

// Get all reaction manifestations
const manifestations = await evaluate(
  'reaction.manifestation.coding.display',
  { input: allergyIntolerance }
); // ['Anaphylaxis', 'Rash']

// Check for severe reactions
const hasSevereReaction = await evaluate(
  "reaction.exists(severity = 'severe')",
  { input: allergyIntolerance }
); // [true]

// Get allergen name
const allergen = await evaluate(
  'code.coding.display.first()',
  { input: allergyIntolerance }
); // ['Penicillin']
```

### Bundle Processing and Resource Extraction

```typescript
const bundle = {
  resourceType: 'Bundle',
  type: 'searchset',
  total: 3,
  entry: [
    {
      fullUrl: 'http://example.org/Patient/123',
      resource: {
        resourceType: 'Patient',
        id: '123',
        name: [{ family: 'Smith', given: ['John'] }],
        birthDate: '1980-01-01'
      }
    },
    {
      fullUrl: 'http://example.org/Encounter/456',
      resource: {
        resourceType: 'Encounter',
        id: '456',
        status: 'finished',
        class: { code: 'IMP' },
        subject: { reference: 'Patient/123' }
      }
    },
    {
      fullUrl: 'http://example.org/Condition/789',
      resource: {
        resourceType: 'Condition',
        id: '789',
        clinicalStatus: {
          coding: [{ code: 'active' }]
        },
        code: {
          coding: [{
            system: 'http://snomed.info/sct',
            code: '44054006',
            display: 'Diabetes mellitus type 2'
          }]
        },
        subject: { reference: 'Patient/123' },
        onsetDateTime: '2015-06-15'  // In FHIR JSON, stored as onsetDateTime
      }
    }
  ]
};

// Extract all patients
const patients = await evaluate(
  "entry.resource.where(resourceType = 'Patient')",
  { input: bundle }
);

// Get all active conditions
const activeConditions = await evaluate(
  "entry.resource.where(resourceType = 'Condition' and clinicalStatus.coding.code = 'active')",
  { input: bundle }
);

// Count resources by type
const patientCount = await evaluate(
  "entry.resource.where(resourceType = 'Patient').count()",
  { input: bundle }
); // [1]

// Get all resources for a specific patient
const patientResources = await evaluate(
  "entry.resource.where(subject.reference = 'Patient/123')",
  { input: bundle }
);

// Extract condition names
const conditions = await evaluate(
  "entry.resource.where(resourceType = 'Condition').code.coding.display",
  { input: bundle }
); // ['Diabetes mellitus type 2']
```

### Using Variables and Advanced Control Flow

```typescript
// Using defineVariable for complex calculations
const result = await evaluate(
  `name
    .defineVariable('fullName', given.first() + ' ' + family)
    .select(%fullName + ' (' + use + ')')`,
  {
    input: {
      name: [
        { use: 'official', given: ['John'], family: 'Doe' },
        { use: 'nickname', given: ['Johnny'], family: 'D' }
      ]
    }
  }
); // ['John Doe (official)', 'Johnny D (nickname)']

// Using aggregate for running calculations
const sum = await evaluate(
  'aggregate(0, $total + $this)',
  { input: [1, 2, 3, 4, 5] }
); // [15]

// Using iif for conditional logic
const ageGroup = await evaluate(
  "iif(age < 18, 'child', iif(age < 65, 'adult', 'senior'))",
  { input: { age: 70 } }
); // ['senior']

// Complex aggregation with variables
const stats = await evaluate(
  `defineVariable('values', value)
    .defineVariable('sum', %values.aggregate(0, $total + $this))
    .defineVariable('count', %values.count())
    .defineVariable('avg', %sum / %count)
    .select('Average: ' + %avg.toString())`,
  {
    input: [
      { value: 10 },
      { value: 20 },
      { value: 30 }
    ]
  }
); // ['Average: 20']
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
const result = await inspect(
  `entry.resource
    .trace('all resources')
    .where(resourceType = 'Patient')
    .trace('patients only')
    .name.given
    .trace('all given names')`,
  { input: bundle }
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

1. **Reuse Parsed Expressions**: Parse expressions once when possible:
   ```typescript
   const parsed = parse('name.given');
   // Use parsed.ast for multiple evaluations
   ```

2. **Cache Analysis Results**: For repeated type checking, cache the analyzed AST:
   ```typescript
   const analysis = await analyze('name.given', { modelProvider });
   // Reuse analysis.ast which includes type information
   ```

3. **Use Simple Parser Mode**: For production, use simple parsing:
   ```typescript
   // Simple mode (default) - fastest
   const result = parse('name.given');
   
   // LSP mode - only for IDE tools
   const result = parse('name.given', {
     mode: 'lsp',
     errorRecovery: true
   });
   ```


## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and guidelines.

## License

MIT
