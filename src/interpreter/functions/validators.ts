// Common validators for FHIRPath function arguments

export const positiveInteger = (v: any): boolean => 
  Number.isInteger(v) && v > 0;

export const nonNegativeInteger = (v: any): boolean => 
  Number.isInteger(v) && v >= 0;

export const positiveNumber = (v: any): boolean => 
  typeof v === 'number' && v > 0;

export const nonNegativeNumber = (v: any): boolean => 
  typeof v === 'number' && v >= 0;

export const nonEmptyString = (v: any): boolean => 
  typeof v === 'string' && v.length > 0;

export const isString = (v: any): boolean => 
  typeof v === 'string';

export const isBoolean = (v: any): boolean => 
  typeof v === 'boolean';

export const isNumber = (v: any): boolean => 
  typeof v === 'number';

export const isInteger = (v: any): boolean => 
  Number.isInteger(v);

export const isCollection = (v: any): boolean => 
  Array.isArray(v);

export const isSingleton = (v: any): boolean => 
  Array.isArray(v) && v.length === 1;

export const inRange = (min: number, max: number) => (v: any): boolean =>
  typeof v === 'number' && v >= min && v <= max;

export const oneOf = <T>(...values: T[]) => (v: any): boolean =>
  values.includes(v);

export const matches = (regex: RegExp) => (v: any): boolean =>
  typeof v === 'string' && regex.test(v);