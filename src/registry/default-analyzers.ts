import type { 
  Analyzer, 
  TypeInfo, 
  TypeRef,
  Operator, 
  Function, 
  Literal,
  TypeConstraint,
  TypeInferenceRule,
  CardinalityInferenceRule
} from './types';
import type { ModelProvider } from '../analyzer/types';

// Helper to check if type matches constraint
export function matchesConstraint(type: TypeRef, constraint: TypeConstraint): boolean {
  if (constraint.kind === 'any') return true;
  
  if (!constraint.types) return true;
  
  // For now, simple type name matching
  // TODO: Handle inheritance and complex types
  let typeName = typeof type === 'string' ? type : (type as any).type || (type as any).name || 'unknown';
  
  // Normalize case - constraint types are capitalized, but actual types might be lowercase
  const normalizedTypeName = typeName.charAt(0).toUpperCase() + typeName.slice(1);
  
  return constraint.types.includes(normalizedTypeName) || constraint.types.includes(typeName);
}

// Helper to format constraint for error messages
export function formatConstraint(constraint: TypeConstraint): string {
  if (constraint.kind === 'any') return 'any type';
  if (!constraint.types || constraint.types.length === 0) return 'any type';
  if (constraint.types.length === 1) return constraint.types[0]!;
  return constraint.types.join(' or ');
}

// Helper to resolve type inference rule
export function resolveTypeInferenceRule(
  rule: TypeInferenceRule,
  input: TypeRef,
  args: TypeRef[],
  analyzer: Analyzer
): TypeRef {
  if (typeof rule === 'string') {
    if (rule === 'preserve-input') return input;
    if (rule === 'promote-numeric') {
      // Check if we have numeric types
      const types = [input, ...args].map(t => {
        const rawType = typeof t === 'string' ? t : (t as any).type || (t as any).name || 'unknown';
        // Normalize to uppercase first letter
        return rawType.charAt(0).toUpperCase() + rawType.slice(1);
      });
      if (types.includes('Decimal')) return analyzer.resolveType('Decimal');
      if (types.includes('Integer')) return analyzer.resolveType('Integer');
      return input; // fallback
    }
    return analyzer.resolveType(rule); // Fixed type name - resolve through analyzer
  }
  
  if (typeof rule === 'function') {
    // TODO: We need to pass ModelProvider to the rule function
    // For now, just return input
    return input;
  }
  
  return input; // fallback
}

// Helper to resolve cardinality inference rule
export function resolveCardinalityInferenceRule(
  rule: CardinalityInferenceRule,
  inputIsSingleton: boolean,
  argsAreSingleton: boolean[]
): boolean {
  if (rule === 'singleton') return true;
  if (rule === 'collection') return false;
  if (rule === 'preserve-input') return inputIsSingleton;
  if (rule === 'all-singleton') return inputIsSingleton && argsAreSingleton.every(s => s);
  
  if (typeof rule === 'function') {
    return rule(inputIsSingleton, argsAreSingleton);
  }
  
  return inputIsSingleton; // fallback
}

// Default analyzer for operators
export function defaultOperatorAnalyze(
  this: Operator,
  analyzer: Analyzer, 
  input: TypeInfo, 
  args: TypeInfo[]
): TypeInfo {
  const { signature } = this;
  
  // Validate parameter count
  const expectedParams = signature.parameters.length;
  if (args.length !== expectedParams) {
    analyzer.error(`Operator '${this.name}' expects ${expectedParams} parameter(s) but got ${args.length}`);
  }
  
  // Validate parameter types and cardinality
  signature.parameters.forEach((param, i) => {
    const arg = args[i];
    if (!arg) return;
    
    // Check type constraint
    if (param.types && !matchesConstraint(arg.type, param.types)) {
      const argTypeName = typeof arg.type === 'string' 
        ? arg.type 
        : (arg.type as any).type || (arg.type as any).name || 'unknown';
      analyzer.error(
        `Operator '${this.name}' parameter '${param.name}' expects ${formatConstraint(param.types)} but got ${argTypeName}`
      );
    }
    
    // Check cardinality constraint
    if (param.cardinality) {
      if (param.cardinality === 'singleton' && !arg.isSingleton) {
        analyzer.error(
          `Operator '${this.name}' parameter '${param.name}' requires singleton value but got collection`
        );
      } else if (param.cardinality === 'collection' && arg.isSingleton) {
        analyzer.error(
          `Operator '${this.name}' parameter '${param.name}' requires collection but got singleton`
        );
      }
      // 'any' accepts both
    }
  });
  
  // Determine output type
  const outputType = resolveTypeInferenceRule(
    signature.output.type,
    input.type,
    args.map(a => a.type),
    analyzer
  );
  
  // Determine output cardinality
  const isSingleton = resolveCardinalityInferenceRule(
    signature.output.cardinality,
    input.isSingleton,
    args.map(a => a.isSingleton)
  );
  
  return { type: outputType, isSingleton };
}

// Default analyzer for functions
export function defaultFunctionAnalyze(
  this: Function,
  analyzer: Analyzer, 
  input: TypeInfo, 
  args: TypeInfo[]
): TypeInfo {
  const { signature } = this;
  
  // Check input constraints if specified
  if (signature.input) {
    if (signature.input.types && !matchesConstraint(input.type, signature.input.types)) {
      const inputTypeName = typeof input.type === 'string' 
        ? input.type 
        : (input.type as any).type || (input.type as any).name || 'unknown';
      analyzer.error(
        `Function '${this.name}' expects input of type ${formatConstraint(signature.input.types)} but got ${inputTypeName}`
      );
    }
    
    if (signature.input.cardinality) {
      if (signature.input.cardinality === 'singleton' && !input.isSingleton) {
        analyzer.error(`Function '${this.name}' requires singleton input but got collection`);
      } else if (signature.input.cardinality === 'collection' && input.isSingleton) {
        analyzer.error(`Function '${this.name}' requires collection input but got singleton`);
      }
    }
  }
  
  // Validate parameters
  const requiredParams = signature.parameters.filter(p => !p.optional);
  if (args.length < requiredParams.length) {
    analyzer.error(
      `Function '${this.name}' requires at least ${requiredParams.length} parameter(s) but got ${args.length}`
    );
  }
  
  if (args.length > signature.parameters.length) {
    analyzer.error(
      `Function '${this.name}' expects at most ${signature.parameters.length} parameter(s) but got ${args.length}`
    );
  }
  
  // Check each parameter
  signature.parameters.forEach((param, i) => {
    const arg = args[i];
    if (!arg && !param.optional) {
      analyzer.error(`Function '${this.name}' parameter '${param.name}' is required`);
      return;
    }
    if (!arg) return; // Optional parameter not provided
    
    // Check type constraint
    if (param.types && !matchesConstraint(arg.type, param.types)) {
      const argTypeName = typeof arg.type === 'string' 
        ? arg.type 
        : (arg.type as any).type || (arg.type as any).name || 'unknown';
      analyzer.error(
        `Function '${this.name}' parameter '${param.name}' expects ${formatConstraint(param.types)} but got ${argTypeName}`
      );
    }
    
    // Check cardinality constraint
    if (param.cardinality) {
      if (param.cardinality === 'singleton' && !arg.isSingleton) {
        analyzer.error(
          `Function '${this.name}' parameter '${param.name}' requires singleton value but got collection`
        );
      } else if (param.cardinality === 'collection' && arg.isSingleton) {
        analyzer.error(
          `Function '${this.name}' parameter '${param.name}' requires collection but got singleton`
        );
      }
    }
  });
  
  // Determine output type
  const outputType = resolveTypeInferenceRule(
    signature.output.type,
    input.type,
    args.map(a => a.type),
    analyzer
  );
  
  // Determine output cardinality
  const isSingleton = resolveCardinalityInferenceRule(
    signature.output.cardinality,
    input.isSingleton,
    args.map(a => a.isSingleton)
  );
  
  return { type: outputType, isSingleton };
}

// Default analyzer for literals
export function defaultLiteralAnalyze(
  this: Literal,
  analyzer: Analyzer, 
  input: TypeInfo, 
  args: TypeInfo[]
): TypeInfo {
  // Literals have fixed output type and cardinality
  return {
    type: analyzer.resolveType(this.signature.output.type),
    isSingleton: true
  };
}