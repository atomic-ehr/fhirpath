import { FunctionRegistry } from './registry';
import { nonNegativeInteger } from './validators';

// String manipulation functions

// Standalone function implementations
export const containsFn = (interpreter: any, context: any, input: any[], substring: string) => {
  const str = input[0];
  return { value: [str.includes(substring)], context };
};

export const lengthFn = (interpreter: any, context: any, input: any[]) => {
  const str = input[0];
  return { value: [str.length], context };
};

export const substringFn = (interpreter: any, context: any, input: any[], start: number, length?: number) => {
  const str = input[0];
  
  if (start >= str.length) {
    return { value: [''], context };
  }
  
  const result = length !== undefined 
    ? str.substring(start, start + length)
    : str.substring(start);
    
  return { value: [result], context };
};

export const startsWithFn = (interpreter: any, context: any, input: any[], prefix: string) => {
  const str = input[0];
  return { value: [str.startsWith(prefix)], context };
};

export const endsWithFn = (interpreter: any, context: any, input: any[], suffix: string) => {
  const str = input[0];
  return { value: [str.endsWith(suffix)], context };
};

export const upperFn = (interpreter: any, context: any, input: any[]) => {
  const str = input[0];
  return { value: [str.toUpperCase()], context };
};

export const lowerFn = (interpreter: any, context: any, input: any[]) => {
  const str = input[0];
  return { value: [str.toLowerCase()], context };
};

export const indexOfFn = (interpreter: any, context: any, input: any[], substring: string) => {
  const str = input[0];
  const index = str.indexOf(substring);
  return { value: index === -1 ? [] : [index], context };
};


export const replaceFn = (interpreter: any, context: any, input: any[], pattern: string, substitution: string) => {
  const str = input[0];
  // Replace all occurrences
  return { value: [str.split(pattern).join(substitution)], context };
};


export const splitFn = (interpreter: any, context: any, input: any[], separator: string) => {
  const str = input[0];
  return { value: str.split(separator), context };
};

export const joinFn = (interpreter: any, context: any, input: any[], separator: string) => {
  return { value: [input.join(separator)], context };
};

export const trimFn = (interpreter: any, context: any, input: any[]) => {
  const str = input[0];
  return { value: [str.trim()], context };
};

export const toCharsFn = (interpreter: any, context: any, input: any[]) => {
  const str = input[0];
  return { value: Array.from(str), context };
};

// Register functions with new signature

// contains(substring) - checks if string contains substring
FunctionRegistry.register({
  name: 'contains',
  inputType: 'string',
  propagateEmptyInput: true,
  arguments: [{
    name: 'substring',
    type: 'string'
  }],
  evaluate: containsFn
});

// length() - returns string length
FunctionRegistry.register({
  name: 'length',
  inputType: 'string',
  propagateEmptyInput: true,
  evaluate: lengthFn
});

// substring(start[, length]) - extracts substring
FunctionRegistry.register({
  name: 'substring',
  inputType: 'string',
  propagateEmptyInput: true,
  arguments: [
    {
      name: 'start',
      type: 'integer',
      validator: nonNegativeInteger
    },
    {
      name: 'length',
      type: 'integer',
      optional: true,
      validator: nonNegativeInteger
    }
  ],
  evaluate: substringFn
});

// startsWith(prefix) - checks if string starts with prefix
FunctionRegistry.register({
  name: 'startsWith',
  inputType: 'string',
  propagateEmptyInput: true,
  arguments: [{
    name: 'prefix',
    type: 'string'
  }],
  evaluate: startsWithFn
});

// endsWith(suffix) - checks if string ends with suffix
FunctionRegistry.register({
  name: 'endsWith',
  inputType: 'string',
  propagateEmptyInput: true,
  arguments: [{
    name: 'suffix',
    type: 'string'
  }],
  evaluate: endsWithFn
});

// upper() - converts to uppercase
FunctionRegistry.register({
  name: 'upper',
  inputType: 'string',
  propagateEmptyInput: true,
  evaluate: upperFn
});

// lower() - converts to lowercase
FunctionRegistry.register({
  name: 'lower',
  inputType: 'string',
  propagateEmptyInput: true,
  evaluate: lowerFn
});

// indexOf(substring) - finds index of substring
FunctionRegistry.register({
  name: 'indexOf',
  inputType: 'string',
  propagateEmptyInput: true,
  arguments: [{
    name: 'substring',
    type: 'string'
  }],
  evaluate: indexOfFn
});


// replace(pattern, substitution) - replace first occurrence
FunctionRegistry.register({
  name: 'replace',
  inputType: 'string',
  propagateEmptyInput: true,
  arguments: [
    {
      name: 'pattern',
      type: 'string'
    },
    {
      name: 'substitution',
      type: 'string'
    }
  ],
  evaluate: replaceFn
});


// split(separator) - splits string into array
FunctionRegistry.register({
  name: 'split',
  inputType: 'string',
  propagateEmptyInput: true,
  arguments: [{
    name: 'separator',
    type: 'string'
  }],
  evaluate: splitFn
});

// join(separator) - joins collection into string
FunctionRegistry.register({
  name: 'join',
  propagateEmptyInput: true,
  arguments: [{
    name: 'separator',
    type: 'string'
  }],
  evaluate: joinFn
});

// trim() - removes leading/trailing whitespace
FunctionRegistry.register({
  name: 'trim',
  inputType: 'string',
  propagateEmptyInput: true,
  evaluate: trimFn
});

// toChars() - converts string to array of characters
FunctionRegistry.register({
  name: 'toChars',
  inputType: 'string',
  propagateEmptyInput: true,
  evaluate: toCharsFn
});