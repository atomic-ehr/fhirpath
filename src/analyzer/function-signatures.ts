import type { FunctionTypeSignature, OperatorTypeSignature, TypeRef } from './types';

/**
 * Type signatures for built-in FHIRPath functions
 */

// Existence functions
export const existsSignature: FunctionTypeSignature = {
  requiresSingleton: false,
  parameters: [{ type: 'expression', optional: true }],
  returnType: (input, params, provider) => provider.resolveType('Boolean'),
  returnsSingleton: () => true
};

export const emptySignature: FunctionTypeSignature = {
  requiresSingleton: false,
  returnType: (input, params, provider) => provider.resolveType('Boolean'),
  returnsSingleton: () => true
};

export const countSignature: FunctionTypeSignature = {
  requiresSingleton: false,
  returnType: (input, params, provider) => provider.resolveType('Integer'),
  returnsSingleton: () => true
};

export const allSignature: FunctionTypeSignature = {
  requiresSingleton: false,
  parameters: [{ type: 'expression', optional: true }],
  returnType: (input, params, provider) => provider.resolveType('Boolean'),
  returnsSingleton: () => true
};

// Subsetting functions
export const firstSignature: FunctionTypeSignature = {
  requiresSingleton: false,
  returnType: (inputType) => inputType, // Same as input type
  returnsSingleton: () => true
};

export const lastSignature: FunctionTypeSignature = {
  requiresSingleton: false,
  returnType: (inputType) => inputType,
  returnsSingleton: () => true
};

export const tailSignature: FunctionTypeSignature = {
  requiresSingleton: false,
  returnType: (inputType) => inputType,
  returnsSingleton: () => false // Always returns collection
};

export const skipSignature: FunctionTypeSignature = {
  requiresSingleton: false,
  parameters: [{ type: 'any', requiresSingleton: true }], // num parameter
  returnType: (inputType) => inputType,
  returnsSingleton: () => false
};

export const takeSignature: FunctionTypeSignature = {
  requiresSingleton: false,
  parameters: [{ type: 'any', requiresSingleton: true }], // num parameter
  returnType: (inputType) => inputType,
  returnsSingleton: () => false
};

// Filtering functions
export const whereSignature: FunctionTypeSignature = {
  requiresSingleton: false,
  parameters: [{ type: 'expression' }],
  returnType: (inputType) => inputType, // Same type, filtered
  returnsSingleton: () => false // Always returns collection
};

export const selectSignature: FunctionTypeSignature = {
  requiresSingleton: false,
  parameters: [{ type: 'expression' }],
  returnType: (inputType, paramTypes) => {
    // Return type is the type of the expression evaluated on each item
    // This would need to be determined by analyzing the expression
    return paramTypes[0];
  },
  returnsSingleton: () => false // Always returns collection
};

// Combining functions
export const unionSignature: FunctionTypeSignature = {
  requiresSingleton: false,
  parameters: [{ type: 'any' }],
  returnType: (inputType, paramTypes, provider) => {
    if (!inputType || !paramTypes[0]) return provider.resolveType('Any');
    return provider.getCommonType?.([inputType, paramTypes[0]]) || provider.resolveType('Any');
  },
  returnsSingleton: () => false
};

export const combineSignature: FunctionTypeSignature = {
  requiresSingleton: false,
  parameters: [{ type: 'any' }],
  returnType: (inputType, paramTypes, provider) => {
    if (!inputType || !paramTypes[0]) return provider.resolveType('Any');
    return provider.getCommonType?.([inputType, paramTypes[0]]) || provider.resolveType('Any');
  },
  returnsSingleton: () => false
};

// Type functions
export const isSignature: FunctionTypeSignature = {
  requiresSingleton: false,
  parameters: [{ type: 'any' }], // Type name
  returnType: (input, params, provider) => provider.resolveType('Boolean'),
  returnsSingleton: (inputIsSingleton) => inputIsSingleton
};

export const asSignature: FunctionTypeSignature = {
  requiresSingleton: false,
  parameters: [{ type: 'any' }], // Type name
  returnType: (input, params, provider) => {
    // Return the target type if cast succeeds
    // In analysis, we assume it might succeed
    return params[0] || provider.resolveType('Any');
  },
  returnsSingleton: (inputIsSingleton) => inputIsSingleton
};

export const ofTypeSignature: FunctionTypeSignature = {
  requiresSingleton: false,
  parameters: [{ type: 'any' }], // Type name
  returnType: (input, params) => params[0], // Returns the specified type
  returnsSingleton: () => false // Filtering operation
};

// Conversion functions
export const toStringSignature: FunctionTypeSignature = {
  requiresSingleton: false,
  returnType: (input, params, provider) => provider.resolveType('String'),
  returnsSingleton: (inputIsSingleton) => inputIsSingleton
};

export const toIntegerSignature: FunctionTypeSignature = {
  requiresSingleton: false,
  returnType: (input, params, provider) => provider.resolveType('Integer'),
  returnsSingleton: (inputIsSingleton) => inputIsSingleton
};

export const toDecimalSignature: FunctionTypeSignature = {
  requiresSingleton: false,
  returnType: (input, params, provider) => provider.resolveType('Decimal'),
  returnsSingleton: (inputIsSingleton) => inputIsSingleton
};

export const toBooleanSignature: FunctionTypeSignature = {
  requiresSingleton: false,
  returnType: (input, params, provider) => provider.resolveType('Boolean'),
  returnsSingleton: (inputIsSingleton) => inputIsSingleton
};

// String functions
export const startsWithSignature: FunctionTypeSignature = {
  requiresSingleton: true,
  parameters: [{ type: 'any', requiresSingleton: true }],
  returnType: (input, params, provider) => provider.resolveType('Boolean'),
  returnsSingleton: () => true,
  requiresInputType: 'string'
};

export const endsWithSignature: FunctionTypeSignature = {
  requiresSingleton: true,
  parameters: [{ type: 'any', requiresSingleton: true }],
  returnType: (input, params, provider) => provider.resolveType('Boolean'),
  returnsSingleton: () => true,
  requiresInputType: 'string'
};

export const containsStringSignature: FunctionTypeSignature = {
  requiresSingleton: true,
  parameters: [{ type: 'any', requiresSingleton: true }],
  returnType: (input, params, provider) => provider.resolveType('Boolean'),
  returnsSingleton: () => true,
  requiresInputType: 'string'
};

export const lengthSignature: FunctionTypeSignature = {
  requiresSingleton: true,
  returnType: (input, params, provider) => provider.resolveType('Integer'),
  returnsSingleton: () => true,
  requiresInputType: 'string'
};

// Math functions
export const absSignature: FunctionTypeSignature = {
  requiresSingleton: true,
  returnType: (inputType) => inputType, // Same numeric type
  returnsSingleton: () => true,
  requiresInputType: 'numeric' // Special marker for numeric types
};

export const ceilingSignature: FunctionTypeSignature = {
  requiresSingleton: true,
  returnType: (input, params, provider) => provider.resolveType('Integer'),
  returnsSingleton: () => true,
  requiresInputType: 'numeric'
};

export const floorSignature: FunctionTypeSignature = {
  requiresSingleton: true,
  returnType: (input, params, provider) => provider.resolveType('Integer'),
  returnsSingleton: () => true,
  requiresInputType: 'numeric'
};

export const roundSignature: FunctionTypeSignature = {
  requiresSingleton: true,
  parameters: [{ type: 'any', requiresSingleton: true, optional: true }],
  returnType: (inputType) => inputType, // Same numeric type
  returnsSingleton: () => true,
  requiresInputType: 'numeric'
};

// Utility functions
export const traceSignature: FunctionTypeSignature = {
  requiresSingleton: false,
  parameters: [{ type: 'any', optional: true }],
  returnType: (input, params, provider) => provider.resolveType('Any'),
  returnsSingleton: (inputIsSingleton) => inputIsSingleton
};

export const nowSignature: FunctionTypeSignature = {
  requiresSingleton: false,
  returnType: (input, params, provider) => provider.resolveType('DateTime'),
  returnsSingleton: () => true
};

export const todaySignature: FunctionTypeSignature = {
  requiresSingleton: false,
  returnType: (input, params, provider) => provider.resolveType('Date'),
  returnsSingleton: () => true
};

// Special functions that return Any
export const childrenSignature: FunctionTypeSignature = {
  requiresSingleton: false,
  returnType: (input, params, provider) => provider.resolveType('Any'),
  returnsSingleton: () => false // Always collection
};

export const descendantsSignature: FunctionTypeSignature = {
  requiresSingleton: false,
  returnType: (input, params, provider) => provider.resolveType('Any'),
  returnsSingleton: () => false // Always collection
};

/**
 * Operator type signatures
 */

// Arithmetic operators
export const arithmeticOperatorSignature: OperatorTypeSignature = {
  requiresLeftSingleton: true,
  requiresRightSingleton: true,
  acceptedTypes: [
    { left: 'Integer', right: 'Integer', result: 'Integer' },
    { left: 'Decimal', right: 'Decimal', result: 'Decimal' },
    { left: 'Integer', right: 'Decimal', result: 'Decimal' },
    { left: 'Decimal', right: 'Integer', result: 'Decimal' }
  ],
  returnsSingleton: true
};

// String concatenation
export const concatOperatorSignature: OperatorTypeSignature = {
  requiresLeftSingleton: true,
  requiresRightSingleton: true,
  acceptedTypes: [
    { left: 'String', right: 'String', result: 'String' }
  ],
  returnsSingleton: true
};

// Comparison operators
export const comparisonOperatorSignature: OperatorTypeSignature = {
  requiresLeftSingleton: false,
  requiresRightSingleton: false,
  acceptedTypes: 'any', // Any types can be compared
  returnType: (left, right, provider) => provider.resolveType('Boolean'),
  returnsSingleton: true
};

// Logical operators
export const logicalOperatorSignature: OperatorTypeSignature = {
  requiresLeftSingleton: true,
  requiresRightSingleton: true,
  acceptedTypes: [
    { left: 'Boolean', right: 'Boolean', result: 'Boolean' }
  ],
  returnsSingleton: true
};

// Membership operators (in, contains)
export const membershipOperatorSignature: OperatorTypeSignature = {
  requiresLeftSingleton: true,
  requiresRightSingleton: false,
  returnType: (left, right, provider) => provider.resolveType('Boolean'),
  returnsSingleton: true
};

// Dot operator (navigation)
export const dotOperatorSignature: OperatorTypeSignature = {
  requiresLeftSingleton: false,
  requiresRightSingleton: false,
  returnType: (leftType, rightType) => rightType, // Type comes from right side
  returnsSingleton: (left, right) => left && right // Only singleton if both are
};

// Union operator
export const unionOperatorSignature: OperatorTypeSignature = {
  requiresLeftSingleton: false,
  requiresRightSingleton: false,
  returnType: (left, right, provider) => {
    if (!left || !right) return provider.resolveType('Any');
    return provider.getCommonType?.([left, right]) || provider.resolveType('Any');
  },
  returnsSingleton: false // Always returns collection
};

/**
 * Function signature registry
 */
export const functionSignatures = new Map<string, FunctionTypeSignature>([
  // Existence
  ['exists', existsSignature],
  ['empty', emptySignature],
  ['count', countSignature],
  ['all', allSignature],
  
  // Subsetting
  ['first', firstSignature],
  ['last', lastSignature],
  ['tail', tailSignature],
  ['skip', skipSignature],
  ['take', takeSignature],
  
  // Filtering
  ['where', whereSignature],
  ['select', selectSignature],
  
  // Combining
  ['union', unionSignature],
  ['combine', combineSignature],
  
  // Type functions
  ['is', isSignature],
  ['as', asSignature],
  ['ofType', ofTypeSignature],
  
  // Conversion
  ['toString', toStringSignature],
  ['toInteger', toIntegerSignature],
  ['toDecimal', toDecimalSignature],
  ['toBoolean', toBooleanSignature],
  
  // String functions
  ['startsWith', startsWithSignature],
  ['endsWith', endsWithSignature],
  ['contains', containsStringSignature],
  ['length', lengthSignature],
  
  // Math functions
  ['abs', absSignature],
  ['ceiling', ceilingSignature],
  ['floor', floorSignature],
  ['round', roundSignature],
  
  // Utility
  ['trace', traceSignature],
  ['now', nowSignature],
  ['today', todaySignature],
  
  // Special
  ['children', childrenSignature],
  ['descendants', descendantsSignature]
]);