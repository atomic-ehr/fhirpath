import { CollectionUtils } from './types';

/**
 * Convert collection to singleton value
 */
export function toSingleton(collection: any[]): any {
  return CollectionUtils.toSingleton(collection);
}

/**
 * Convert value to boolean according to FHIRPath rules
 */
export function toBoolean(value: any): boolean {
  // Handle direct boolean
  if (typeof value === 'boolean') {
    return value;
  }
  
  // Handle null/undefined as false
  if (value == null) {
    return false;
  }
  
  // Handle empty string as false
  if (value === '') {
    return false;
  }
  
  // Handle zero as false
  if (value === 0) {
    return false;
  }
  
  // Everything else is true
  return true;
}

/**
 * Check if a collection evaluates to true according to FHIRPath rules
 */
export function isTruthy(collection: any[]): boolean {
  if (collection.length === 0) {
    return false;
  }
  
  const value = toSingleton(collection);
  return toBoolean(value);
}