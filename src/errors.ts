import type { Range, Diagnostic } from './types';
import { DiagnosticSeverity } from './types';

/**
 * Base error class for all FHIRPath errors
 */
export class FHIRPathError extends Error {
  constructor(
    public code: string,
    message: string,
    public location?: Range
  ) {
    super(message);
    this.name = 'FHIRPathError';
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Convert FHIRPathError to Diagnostic for analyzer
 */
export function toDiagnostic(error: FHIRPathError, severity: DiagnosticSeverity = DiagnosticSeverity.Error): Diagnostic {
  return {
    code: error.code,
    message: error.message,
    severity,
    range: error.location!,
    source: 'fhirpath'
  };
}

/**
 * Error factory with specialized constructors
 */
export const Errors = {
  // Resolution errors (1000-1999)
  unknownOperator(operator: string, location?: Range): FHIRPathError {
    return new FHIRPathError(ErrorCodes.UNKNOWN_OPERATOR, `Unknown operator: ${operator}`, location);
  },
  
  unknownFunction(name: string, location?: Range): FHIRPathError {
    return new FHIRPathError(ErrorCodes.UNKNOWN_FUNCTION, `Unknown function: ${name}`, location);
  },
  
  unknownVariable(name: string, location?: Range): FHIRPathError {
    return new FHIRPathError(ErrorCodes.UNKNOWN_VARIABLE, `Unknown variable: ${name}`, location);
  },
  
  unknownUserVariable(name: string, location?: Range): FHIRPathError {
    return new FHIRPathError(ErrorCodes.UNKNOWN_USER_VARIABLE, `Unknown user variable: ${name}`, location);
  },
  
  unknownProperty(property: string, type: string, location?: Range): FHIRPathError {
    return new FHIRPathError(ErrorCodes.UNKNOWN_PROPERTY, `Unknown property '${property}' on type ${type}`, location);
  },
  
  unknownNodeType(nodeType: string, location?: Range): FHIRPathError {
    return new FHIRPathError(ErrorCodes.UNKNOWN_NODE_TYPE, `Unknown node type: ${nodeType}`, location);
  },
  
  noEvaluatorFound(evaluatorType: string, name: string, location?: Range): FHIRPathError {
    return new FHIRPathError(ErrorCodes.NO_EVALUATOR_FOUND, `No evaluator found for ${evaluatorType}: ${name}`, location);
  },
  
  variableNotDefined(name: string, location?: Range): FHIRPathError {
    return new FHIRPathError(ErrorCodes.VARIABLE_NOT_DEFINED, `Variable '${name}' is not defined in the current scope`, location);
  },
  
  // Arity errors (2000-2999)
  wrongArgumentCount(funcName: string, expected: number, actual: number, location?: Range): FHIRPathError {
    return new FHIRPathError(ErrorCodes.WRONG_ARGUMENT_COUNT, `${funcName} expects ${expected} arguments, got ${actual}`, location);
  },
  
  wrongArgumentCountRange(funcName: string, min: number, max: number, actual: number, location?: Range): FHIRPathError {
    return new FHIRPathError(ErrorCodes.WRONG_ARGUMENT_COUNT_RANGE, `${funcName} expects ${min} to ${max} arguments, got ${actual}`, location);
  },
  
  singletonRequired(funcName: string, actualCount: number, location?: Range): FHIRPathError {
    return new FHIRPathError(ErrorCodes.SINGLETON_REQUIRED, `${funcName} requires a single item, but collection has ${actualCount} items`, location);
  },
  
  stringSingletonRequired(funcName: string, actualCount: number, location?: Range): FHIRPathError {
    return new FHIRPathError(ErrorCodes.SINGLETON_REQUIRED, `${funcName} can only be used on a single string, but collection has ${actualCount} items`, location);
  },
  
  emptyNotAllowed(funcName: string, location?: Range): FHIRPathError {
    return new FHIRPathError(ErrorCodes.EMPTY_NOT_ALLOWED, `${funcName} cannot operate on empty collection`, location);
  },
  
  argumentRequired(funcName: string, argumentName: string, location?: Range): FHIRPathError {
    return new FHIRPathError(ErrorCodes.ARGUMENT_REQUIRED, `${funcName} requires ${argumentName}`, location);
  },
  
  // Type errors (3000-3999)
  typeNotAssignable(sourceType: string, targetType: string, location?: Range): FHIRPathError {
    return new FHIRPathError(ErrorCodes.TYPE_NOT_ASSIGNABLE, `Type ${sourceType} is not assignable to type ${targetType}`, location);
  },
  
  operatorTypeMismatch(operator: string, leftType: string, rightType: string, location?: Range): FHIRPathError {
    return new FHIRPathError(ErrorCodes.OPERATOR_TYPE_MISMATCH, `Operator '${operator}' cannot be applied to types ${leftType} and ${rightType}`, location);
  },
  
  argumentTypeMismatch(argIndex: number, funcName: string, expected: string, actual: string, location?: Range): FHIRPathError {
    return new FHIRPathError(ErrorCodes.ARGUMENT_TYPE_MISMATCH, `Argument ${argIndex} of ${funcName}: expected ${expected}, got ${actual}`, location);
  },
  
  conversionFailed(value: string, targetType: string, location?: Range): FHIRPathError {
    return new FHIRPathError(ErrorCodes.CONVERSION_FAILED, `Cannot convert '${value}' to ${targetType}`, location);
  },
  
  invalidValueType(expected: string, actual: string, location?: Range): FHIRPathError {
    return new FHIRPathError(ErrorCodes.INVALID_VALUE_TYPE, `${expected} expected, got ${actual}`, location);
  },
  
  invalidOperandType(operation: string, type: string, location?: Range): FHIRPathError {
    return new FHIRPathError(ErrorCodes.INVALID_OPERAND_TYPE, `Cannot apply ${operation} to ${type}`, location);
  },
  
  stringOperationOnNonString(operation: string, location?: Range): FHIRPathError {
    return new FHIRPathError(ErrorCodes.STRING_OPERATION_ON_NON_STRING, `${operation} can only be used on string values`, location);
  },
  
  numericOperationOnNonNumeric(operation: string, location?: Range): FHIRPathError {
    return new FHIRPathError(ErrorCodes.NUMERIC_OPERATION_ON_NON_NUMERIC, `${operation} can only be applied to numeric values`, location);
  },
  
  booleanOperationOnNonBoolean(operation: string, index: number, actualType: string, location?: Range): FHIRPathError {
    return new FHIRPathError(ErrorCodes.BOOLEAN_OPERATION_ON_NON_BOOLEAN, `${operation} expects all items to be Boolean values, but item at index ${index} is ${actualType}`, location);
  },
  
  // Configuration errors (4000-4999)
  modelProviderRequired(operation: string, location?: Range): FHIRPathError {
    return new FHIRPathError(ErrorCodes.MODEL_PROVIDER_REQUIRED, 
      `ModelProvider required for '${operation}' operation. Even primitive types like Boolean can fail due to choice types (e.g., Patient.deceased is actually deceasedBoolean in FHIR data)`, 
      location);
  },
  
  // Syntax errors (5000-5999)
  unexpectedToken(token: string, location?: Range): FHIRPathError {
    return new FHIRPathError(ErrorCodes.UNEXPECTED_TOKEN, `Unexpected token: ${token}`, location);
  },
  
  expectedToken(expected: string, actual: string, location?: Range): FHIRPathError {
    return new FHIRPathError(ErrorCodes.EXPECTED_TOKEN, `Expected ${expected}, got ${actual}`, location);
  },
  
  invalidSyntax(details: string, location?: Range): FHIRPathError {
    return new FHIRPathError(ErrorCodes.INVALID_SYNTAX, `Invalid syntax: ${details}`, location);
  },
  
  expectedIdentifier(after: string, actual: string, location?: Range): FHIRPathError {
    return new FHIRPathError(ErrorCodes.EXPECTED_IDENTIFIER, `Expected identifier after '${after}', got: ${actual}`, location);
  },
  
  expectedTypeName(actual: string, location?: Range): FHIRPathError {
    return new FHIRPathError(ErrorCodes.EXPECTED_TYPE_NAME, `Expected type name, got: ${actual}`, location);
  },
  
  // Domain errors (6000-6999)
  divisionByZero(location?: Range): FHIRPathError {
    return new FHIRPathError(ErrorCodes.DIVISION_BY_ZERO, 'Division by zero', location);
  },
  
  invalidDateTimeFormat(format: string, location?: Range): FHIRPathError {
    return new FHIRPathError(ErrorCodes.INVALID_DATE_TIME_FORMAT, `Invalid date/time format: '${format}'`, location);
  },
  
  incompatibleUnits(unit1: string, unit2: string, location?: Range): FHIRPathError {
    return new FHIRPathError(ErrorCodes.INCOMPATIBLE_UNITS, `Cannot perform operation on incompatible units: ${unit1} and ${unit2}`, location);
  },
  
  indexOutOfBounds(index: number, size: number, location?: Range): FHIRPathError {
    return new FHIRPathError(ErrorCodes.INDEX_OUT_OF_BOUNDS, `Index ${index} out of bounds for collection of size ${size}`, location);
  },
  
  invalidOperation(details: string, location?: Range): FHIRPathError {
    return new FHIRPathError(ErrorCodes.INVALID_OPERATION, `Invalid operation: ${details}`, location);
  },
  
  invalidPrecision(operation: string, location?: Range): FHIRPathError {
    return new FHIRPathError(ErrorCodes.INVALID_PRECISION, `${operation} precision must be a non-negative integer`, location);
  },
  
  invalidStringOperation(operation: string, paramName: string, location?: Range): FHIRPathError {
    return new FHIRPathError(ErrorCodes.INVALID_STRING_OPERATION, `${operation} ${paramName} must be a string`, location);
  },
  
  invalidNumericOperation(operation: string, paramName: string, expectedType: string, location?: Range): FHIRPathError {
    return new FHIRPathError(ErrorCodes.INVALID_NUMERIC_OPERATION, `${operation} ${paramName} must be ${expectedType}`, location);
  }
};

// Export error codes as enum for external use
export enum ErrorCodes {
  // Resolution errors (1000-1999)
  UNKNOWN_OPERATOR = 'FP1001',
  UNKNOWN_FUNCTION = 'FP1002',
  UNKNOWN_VARIABLE = 'FP1003',
  UNKNOWN_USER_VARIABLE = 'FP1004',
  UNKNOWN_PROPERTY = 'FP1005',
  UNKNOWN_NODE_TYPE = 'FP1006',
  NO_EVALUATOR_FOUND = 'FP1007',
  VARIABLE_NOT_DEFINED = 'FP1008',
  
  // Arity errors (2000-2999)
  WRONG_ARGUMENT_COUNT = 'FP2001',
  WRONG_ARGUMENT_COUNT_RANGE = 'FP2002',
  SINGLETON_REQUIRED = 'FP2003',
  EMPTY_NOT_ALLOWED = 'FP2004',
  ARGUMENT_REQUIRED = 'FP2005',
  
  // Type errors (3000-3999)
  TYPE_NOT_ASSIGNABLE = 'FP3001',
  OPERATOR_TYPE_MISMATCH = 'FP3002',
  ARGUMENT_TYPE_MISMATCH = 'FP3003',
  CONVERSION_FAILED = 'FP3004',
  INVALID_VALUE_TYPE = 'FP3005',
  INVALID_OPERAND_TYPE = 'FP3006',
  STRING_OPERATION_ON_NON_STRING = 'FP3007',
  NUMERIC_OPERATION_ON_NON_NUMERIC = 'FP3008',
  BOOLEAN_OPERATION_ON_NON_BOOLEAN = 'FP3009',
  
  // Configuration errors (4000-4999)
  MODEL_PROVIDER_REQUIRED = 'FP4001',
  
  // Syntax errors (5000-5999)
  UNEXPECTED_TOKEN = 'FP5001',
  EXPECTED_TOKEN = 'FP5002',
  INVALID_SYNTAX = 'FP5003',
  EXPECTED_IDENTIFIER = 'FP5004',
  EXPECTED_TYPE_NAME = 'FP5005',
  
  // Domain errors (6000-6999)
  DIVISION_BY_ZERO = 'FP6001',
  INVALID_DATE_TIME_FORMAT = 'FP6002',
  INCOMPATIBLE_UNITS = 'FP6003',
  INDEX_OUT_OF_BOUNDS = 'FP6004',
  INVALID_OPERATION = 'FP6005',
  INVALID_PRECISION = 'FP6006',
  INVALID_STRING_OPERATION = 'FP6007',
  INVALID_NUMERIC_OPERATION = 'FP6008'
}