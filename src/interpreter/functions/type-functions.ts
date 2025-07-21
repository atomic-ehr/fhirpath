import { FunctionRegistry } from './registry';

// Type checking functions

// Standalone function implementations
export const typeFn = (interpreter: any, context: any, input: any[]) => {
  const { TypeSystem } = require('../types/type-system');
  const types = new Set<string>();
  
  for (const item of input) {
    types.add(TypeSystem.getType(item));
  }
  
  return { value: Array.from(types), context };
};

export const conformsToFn = (interpreter: any, context: any, input: any[], profile: string) => {
  // This is a placeholder - real implementation would check FHIR profiles
  // For now, always return empty (unknown)
  return { value: [], context };
};

export const memberOfFn = (interpreter: any, context: any, input: any[], valueset: string) => {
  // This is a placeholder - real implementation would check against terminology server
  // For now, always return empty (unknown)
  return { value: [], context };
};

export const subsumesFn = (interpreter: any, context: any, input: any[], code: any) => {
  // This is a placeholder - real implementation would use terminology server
  // For now, always return empty (unknown)
  return { value: [], context };
};

export const subsumedByFn = (interpreter: any, context: any, input: any[], code: any) => {
  // This is a placeholder - real implementation would use terminology server
  // For now, always return empty (unknown)
  return { value: [], context };
};

// Register functions with new signature

// type() - returns type of items
FunctionRegistry.register({
  name: 'type',
  evaluate: typeFn
});

// conformsTo(profile) - checks if conforms to profile
FunctionRegistry.register({
  name: 'conformsTo',
  arguments: [{
    name: 'profile',
    type: 'string'
  }],
  evaluate: conformsToFn
});

// memberOf(valueset) - checks if code is member of valueset
FunctionRegistry.register({
  name: 'memberOf',
  arguments: [{
    name: 'valueset',
    type: 'string'
  }],
  evaluate: memberOfFn
});

// subsumes(code) - checks if code subsumes another
FunctionRegistry.register({
  name: 'subsumes',
  arguments: [{
    name: 'code',
    type: 'any'
  }],
  evaluate: subsumesFn
});

// subsumedBy(code) - checks if code is subsumed by another
FunctionRegistry.register({
  name: 'subsumedBy',
  arguments: [{
    name: 'code',
    type: 'any'
  }],
  evaluate: subsumedByFn
});