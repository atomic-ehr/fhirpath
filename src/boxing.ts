import type {TypeInfo} from './types';
export type {TypeInfo};

/**
 * Symbol to mark boxed values
 */
const BOXED_SYMBOL = Symbol('FHIRPathBoxedValue');

/**
 * Extension structure for FHIR primitive elements
 */
export interface Extension {
  url: string;
  [key: string]: any;
}

/**
 * Metadata for FHIR primitive elements (e.g., _gender for gender property)
 */
export interface PrimitiveElement {
  id?: string;
  extension?: Extension[];
}

/**
 * Boxed FHIRPath value with metadata
 */
export interface FHIRPathValue<T = any> {
  /** The actual value */
  value: T;
  
  /** Type information from ModelProvider */
  typeInfo?: TypeInfo;
  
  /** Primitive element extension (for primitives only) */
  primitiveElement?: PrimitiveElement;
  
  /** Internal marker to identify boxed values */
  [BOXED_SYMBOL]: true;
}

/**
 * Box a value with optional metadata
 */
export function box<T>(
  value: T, 
  typeInfo?: TypeInfo, 
  primitiveElement?: PrimitiveElement
): FHIRPathValue<T> {
  return {
    value,
    typeInfo,
    primitiveElement,
    [BOXED_SYMBOL]: true
  };
}

/**
 * Unbox a value to get the raw value
 */
export function unbox<T>(boxedValue: FHIRPathValue<T>): T {
  return boxedValue.value;
}

/**
 * Check if a value is already boxed
 */
export function isBoxed(value: any): value is FHIRPathValue {
  return value !== null && 
         value !== undefined && 
         typeof value === 'object' && 
         BOXED_SYMBOL in value &&
         value[BOXED_SYMBOL] === true;
}

/**
 * Ensure a value is boxed, boxing it if necessary
 */
export function ensureBoxed(value: any, typeInfo?: TypeInfo): FHIRPathValue {
  if (isBoxed(value)) {
    return value;
  }
  return box(value, typeInfo);
}

/**
 * Map over an array of boxed values, preserving boxing
 */
export function mapBoxed<T, U>(
  values: FHIRPathValue<T>[], 
  fn: (value: T, index: number) => U,
  typeInfo?: TypeInfo
): FHIRPathValue<U>[] {
  return values.map((boxedValue, index) => 
    box(fn(boxedValue.value, index), typeInfo)
  );
}

/**
 * Filter an array of boxed values, preserving boxing
 */
export function filterBoxed<T>(
  values: FHIRPathValue<T>[], 
  predicate: (value: T, index: number) => boolean
): FHIRPathValue<T>[] {
  return values.filter((boxedValue, index) => 
    predicate(boxedValue.value, index)
  );
}

/**
 * Flatten an array of boxed arrays into a single array of boxed values
 */
export function flattenBoxed<T>(values: FHIRPathValue<T[]>[]): FHIRPathValue<T>[] {
  const result: FHIRPathValue<T>[] = [];
  for (const boxedArray of values) {
    if (Array.isArray(boxedArray.value)) {
      for (const item of boxedArray.value) {
        result.push(box(item, boxedArray.typeInfo));
      }
    }
  }
  return result;
}