# ADR-010: Unified Error System

## Status

Proposed

## Context

Currently, the FHIRPath implementation has two separate error handling approaches:

1. **Analyzer errors**: Use structured `Diagnostic` objects with error codes, severity levels, and source locations. These are collected during static analysis and reported as a list.

2. **Runtime errors**: Use thrown JavaScript `Error` objects with inconsistent error messages. These immediately halt execution and lack standardized codes or source location tracking.

This split creates several problems:
- Inconsistent error reporting between analysis and runtime phases
- Duplicate error classification logic (e.g., arity checking in both analyzer and operations)
- Runtime errors lack the structured information needed for good IDE integration
- Similar errors have different representations depending on when they're detected
- No unified way to handle, categorize, or recover from errors

## Decision

Implement a unified error system following TypeScript's diagnostic pattern:

1. **Use unique numeric error codes** for each specific error (e.g., FP1001, FP2001)
2. **Organize codes by category** using number ranges:
   - 1000-1999: Resolution errors
   - 2000-2999: Arity errors  
   - 3000-3999: Type errors
   - 4000-4999: Configuration errors
   - 5000-5999: Syntax errors
   - 6000-6999: Domain errors

3. **Create specialized error constructors with embedded codes and messages**:
   ```typescript
   // errors.ts
   
   // Base error class
   export class FHIRPathError extends Error {
     constructor(
       public code: string,
       message: string,
       public location?: SourceLocation
     ) {
       super(message);
       this.name = 'FHIRPathError';
     }
   }
   
   // Error factory with specialized constructors
   export const Errors = {
     // Resolution errors (1000-1999)
     unknownOperator(operator: string, location?: SourceLocation): FHIRPathError {
       return new FHIRPathError('FP1001', `Unknown operator: ${operator}`, location);
     },
     
     unknownFunction(name: string, location?: SourceLocation): FHIRPathError {
       return new FHIRPathError('FP1002', `Unknown function: ${name}`, location);
     },
     
     unknownVariable(name: string, location?: SourceLocation): FHIRPathError {
       return new FHIRPathError('FP1003', `Unknown variable: ${name}`, location);
     },
     
     unknownUserVariable(name: string, location?: SourceLocation): FHIRPathError {
       return new FHIRPathError('FP1004', `Unknown user variable: ${name}`, location);
     },
     
     unknownProperty(property: string, type: string, location?: SourceLocation): FHIRPathError {
       return new FHIRPathError('FP1005', `Unknown property '${property}' on type ${type}`, location);
     },
     
     unknownNodeType(nodeType: string, location?: SourceLocation): FHIRPathError {
       return new FHIRPathError('FP1006', `Unknown node type: ${nodeType}`, location);
     },
     
     noEvaluatorFound(evaluatorType: string, name: string, location?: SourceLocation): FHIRPathError {
       return new FHIRPathError('FP1007', `No evaluator found for ${evaluatorType}: ${name}`, location);
     },
     
     variableNotDefined(name: string, location?: SourceLocation): FHIRPathError {
       return new FHIRPathError('FP1008', `Variable '${name}' is not defined in the current scope`, location);
     },
     
     // Arity errors (2000-2999)
     wrongArgumentCount(funcName: string, expected: number, actual: number, location?: SourceLocation): FHIRPathError {
       return new FHIRPathError('FP2001', `${funcName} expects ${expected} arguments, got ${actual}`, location);
     },
     
     wrongArgumentCountRange(funcName: string, min: number, max: number, actual: number, location?: SourceLocation): FHIRPathError {
       return new FHIRPathError('FP2002', `${funcName} expects ${min} to ${max} arguments, got ${actual}`, location);
     },
     
     singletonRequired(funcName: string, actualCount: number, location?: SourceLocation): FHIRPathError {
       return new FHIRPathError('FP2003', `${funcName} requires a single item, but collection has ${actualCount} items`, location);
     },
     
     emptyNotAllowed(funcName: string, location?: SourceLocation): FHIRPathError {
       return new FHIRPathError('FP2004', `${funcName} cannot operate on empty collection`, location);
     },
     
     argumentRequired(funcName: string, argumentName: string, location?: SourceLocation): FHIRPathError {
       return new FHIRPathError('FP2005', `${funcName} requires ${argumentName}`, location);
     },
     
     // Type errors (3000-3999)
     typeNotAssignable(sourceType: string, targetType: string, location?: SourceLocation): FHIRPathError {
       return new FHIRPathError('FP3001', `Type ${sourceType} is not assignable to type ${targetType}`, location);
     },
     
     operatorTypeMismatch(operator: string, leftType: string, rightType: string, location?: SourceLocation): FHIRPathError {
       return new FHIRPathError('FP3002', `Operator '${operator}' cannot be applied to types ${leftType} and ${rightType}`, location);
     },
     
     argumentTypeMismatch(argIndex: number, funcName: string, expected: string, actual: string, location?: SourceLocation): FHIRPathError {
       return new FHIRPathError('FP3003', `Argument ${argIndex} of ${funcName}: expected ${expected}, got ${actual}`, location);
     },
     
     conversionFailed(value: string, targetType: string, location?: SourceLocation): FHIRPathError {
       return new FHIRPathError('FP3004', `Cannot convert '${value}' to ${targetType}`, location);
     },
     
     invalidValueType(expected: string, actual: string, location?: SourceLocation): FHIRPathError {
       return new FHIRPathError('FP3005', `${expected} expected, got ${actual}`, location);
     },
     
     invalidOperandType(operation: string, type: string, location?: SourceLocation): FHIRPathError {
       return new FHIRPathError('FP3006', `Cannot apply ${operation} to ${type}`, location);
     },
     
     stringOperationOnNonString(operation: string, location?: SourceLocation): FHIRPathError {
       return new FHIRPathError('FP3007', `${operation} can only be used on string values`, location);
     },
     
     numericOperationOnNonNumeric(operation: string, location?: SourceLocation): FHIRPathError {
       return new FHIRPathError('FP3008', `${operation} can only be applied to numeric values`, location);
     },
     
     booleanOperationOnNonBoolean(operation: string, index: number, actualType: string, location?: SourceLocation): FHIRPathError {
       return new FHIRPathError('FP3009', `${operation} expects all items to be Boolean values, but item at index ${index} is ${actualType}`, location);
     },
     
     // Configuration errors (4000-4999)
     modelProviderRequired(operation: string, location?: SourceLocation): FHIRPathError {
       return new FHIRPathError('FP4001', 
         `ModelProvider required for '${operation}' operation. Even primitive types like Boolean can fail due to choice types (e.g., Patient.deceased is actually deceasedBoolean in FHIR data)`, 
         location);
     },
     
     // Syntax errors (5000-5999)
     unexpectedToken(token: string, location?: SourceLocation): FHIRPathError {
       return new FHIRPathError('FP5001', `Unexpected token: ${token}`, location);
     },
     
     expectedToken(expected: string, actual: string, location?: SourceLocation): FHIRPathError {
       return new FHIRPathError('FP5002', `Expected ${expected}, got ${actual}`, location);
     },
     
     invalidSyntax(details: string, location?: SourceLocation): FHIRPathError {
       return new FHIRPathError('FP5003', `Invalid syntax: ${details}`, location);
     },
     
     expectedIdentifier(after: string, actual: string, location?: SourceLocation): FHIRPathError {
       return new FHIRPathError('FP5004', `Expected identifier after '${after}', got: ${actual}`, location);
     },
     
     expectedTypeName(actual: string, location?: SourceLocation): FHIRPathError {
       return new FHIRPathError('FP5005', `Expected type name, got: ${actual}`, location);
     },
     
     // Domain errors (6000-6999)
     divisionByZero(location?: SourceLocation): FHIRPathError {
       return new FHIRPathError('FP6001', 'Division by zero', location);
     },
     
     invalidDateTimeFormat(format: string, location?: SourceLocation): FHIRPathError {
       return new FHIRPathError('FP6002', `Invalid date/time format: '${format}'`, location);
     },
     
     incompatibleUnits(unit1: string, unit2: string, location?: SourceLocation): FHIRPathError {
       return new FHIRPathError('FP6003', `Cannot perform operation on incompatible units: ${unit1} and ${unit2}`, location);
     },
     
     indexOutOfBounds(index: number, size: number, location?: SourceLocation): FHIRPathError {
       return new FHIRPathError('FP6004', `Index ${index} out of bounds for collection of size ${size}`, location);
     },
     
     invalidOperation(details: string, location?: SourceLocation): FHIRPathError {
       return new FHIRPathError('FP6005', `Invalid operation: ${details}`, location);
     },
     
     invalidPrecision(operation: string, location?: SourceLocation): FHIRPathError {
       return new FHIRPathError('FP6006', `${operation} precision must be a non-negative integer`, location);
     },
     
     invalidStringOperation(operation: string, paramName: string, location?: SourceLocation): FHIRPathError {
       return new FHIRPathError('FP6007', `${operation} ${paramName} must be a string`, location);
     },
     
     invalidNumericOperation(operation: string, paramName: string, expectedType: string, location?: SourceLocation): FHIRPathError {
       return new FHIRPathError('FP6008', `${operation} ${paramName} must be ${expectedType}`, location);
     }
   };
   
   // For analyzer diagnostics
   export function toDiagnostic(error: FHIRPathError, severity: DiagnosticSeverity = DiagnosticSeverity.Error): Diagnostic {
     return {
       code: error.code,
       message: error.message,
       severity,
       range: error.location,
       source: 'fhirpath'
     };
   }
   ```

5. **Usage in analyzer and runtime**:
   ```typescript
   // In analyzer
   if (!func) {
     this.diagnostics.push(
       toDiagnostic(Errors.unknownFunction(funcName, node.location))
     );
   }
   
   if (node.arguments.length < requiredParams) {
     this.diagnostics.push(
       toDiagnostic(Errors.wrongArgumentCount(funcName, requiredParams, node.arguments.length, node.location))
     );
   }
   
   // In runtime operations
   if (args.length !== 1) {
     throw Errors.wrongArgumentCount("skip", 1, args.length);
   }
   
   if (input.length > 1) {
     throw Errors.singletonRequired("toBoolean", input.length);
   }
   
   if (typeof value !== 'string') {
     throw Errors.stringOperationOnNonString("endsWith");
   }
   
   if (typeof value !== 'boolean') {
     throw Errors.booleanOperationOnNonBoolean("allTrue", i, typeof value);
   }
   
   // In interpreter
   if (!evaluator) {
     throw Errors.noEvaluatorFound("binary operator", operator);
   }
   
   // In parser with direct error handling
   this.errors.push(
     toDiagnostic(Errors.unexpectedToken(token.value || TokenType[token.type], token.location))
   );
   
   // Or throw for immediate halt
   throw Errors.unexpectedToken(token.value || TokenType[token.type], token.location);
   ```

## Consequences

### Positive

- **Type-safe error creation**: Specialized constructors ensure correct parameter types and count
- **Better developer experience**: IntelliSense shows available errors and their parameters
- **Consistent error representation**: Same error structure across analyzer and runtime
- **IDE integration**: Runtime errors include source location and error codes
- **Easy error categorization**: Numeric ranges make filtering/grouping straightforward
- **No string conversion overhead**: Parameters maintain their native types
- **Centralized error definitions**: Easy to maintain and localize messages
- **Compile-time validation**: TypeScript catches incorrect error usage

### Negative

- **Breaking change**: Existing error handling code needs migration
- **More code**: Need to maintain ~40 specialized constructor functions
- **Slightly larger bundle**: Error factory adds some overhead
- **Learning curve**: Developers need to learn available error constructors

## Alternatives Considered

1. **Keep split system but standardize messages**: Would not solve the structural differences or enable better runtime error handling.

2. **Only use Diagnostics everywhere**: Would require significant changes to JavaScript error handling patterns and make the library harder to use in non-IDE contexts.

3. **Use error codes in messages**: "ERROR[ARITY_TOO_FEW]: Function requires..." - Hacky and doesn't provide structured data.

4. **Different error classes per category**: Would create too many classes and make error handling more complex.

5. **Generic error functions (original proposal)**: 
   - `createError("WrongArgumentCount", "skip", "1", args.length.toString())`
   - Requires string conversion of all parameters
   - No type safety on parameter count or types
   - Easy to pass parameters in wrong order
   - Less discoverable API

The specialized constructor approach was chosen because it provides the best balance of type safety, developer experience, and maintainability while keeping the error system unified across all components.