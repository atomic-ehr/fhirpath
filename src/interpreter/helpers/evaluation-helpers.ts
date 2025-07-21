import { CollectionUtils } from '../types';

/**
 * Determines if a value is truthy according to FHIRPath rules
 */
export function isTruthy(value: any[]): boolean {
  if (value.length === 0) {
    return false;
  }
  
  // Convert to singleton
  const singleton = CollectionUtils.toSingleton(value);
  
  // Rule: true if singleton is true, false if singleton is false
  if (typeof singleton === 'boolean') {
    return singleton;
  }
  
  // Rule: singleton exists and is not false = true
  return singleton !== undefined;
}

/**
 * Checks if two values are equivalent for FHIRPath comparison
 */
export function isEquivalent(a: any, b: any): boolean {
  // Handle null/undefined
  if (a === b) return true;
  if (a == null || b == null) return false;
  
  // Handle different types
  if (typeof a !== typeof b) return false;
  
  // Handle primitives
  if (typeof a !== 'object') return a === b;
  
  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!isEquivalent(a[i], b[i])) return false;
    }
    return true;
  }
  
  // Handle objects (deep comparison)
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!isEquivalent(a[key], b[key])) return false;
  }
  
  return true;
}