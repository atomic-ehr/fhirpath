import type { 
  TypeName, 
  TypeInfo, 
  OperatorSignature, 
  OperatorDefinition, 
  RegisteredOperator, 
  FunctionDefinition 
} from './types';

// Re-export types
export type { 
  TypeName, 
  TypeInfo, 
  OperatorSignature, 
  OperatorDefinition, 
  RegisteredOperator, 
  FunctionDefinition 
} from './types';

// Re-export precedence for backwards compatibility
export { PRECEDENCE } from './types';

import * as operations from './operations';

export class Registry {
  private symbolOperators = new Map<string, OperatorDefinition>();
  private keywordOperators = new Map<string, OperatorDefinition>();
  private unaryOperators = new Map<string, OperatorDefinition>();
  private functions = new Map<string, FunctionDefinition>();
  
  constructor() {
    this.registerDefaultOperators();
  }
  
  private registerDefaultOperators(): void {
    // Register all operators and functions from the operations module
    const allOperations = Object.values(operations);
    
    for (const operation of allOperations) {
      if (typeof operation === 'object') {
        if ('symbol' in operation) {
          // It's an operator
          this.registerOperator(operation);
        } else if ('signatures' in operation && !('symbol' in operation)) {
          // It's a function (has signatures but no symbol)
          this.registerFunction(operation as FunctionDefinition);
        }
      }
    }
  }
  
  private registerOperator(operator: OperatorDefinition): void {
    const symbol = operator.symbol.toLowerCase();
    
    // Check if it's a unary operator first
    if (operator.name.startsWith('unary') || operator.name === 'not') {
      this.unaryOperators.set(operator.symbol, operator);
      
      // 'not' is only unary, don't register as binary
      if (operator.name === 'not') {
        this.keywordOperators.set(symbol, operator);
        return;
      }
    }
    
    // Check if it's a keyword operator (contains only letters)
    if (/^[a-z]+$/.test(symbol)) {
      this.keywordOperators.set(symbol, operator);
    } else {
      // For symbol operators, only register non-unary versions in symbolOperators
      if (!operator.name.startsWith('unary')) {
        this.symbolOperators.set(operator.symbol, operator);
      }
    }
  }
  
  // Operator methods
  isSymbolOperator(symbol: string): boolean {
    return this.symbolOperators.has(symbol);
  }
  
  isKeywordOperator(keyword: string): boolean {
    return this.keywordOperators.has(keyword.toLowerCase());
  }
  
  isUnaryOperator(op: string): boolean {
    return this.unaryOperators.has(op);
  }
  
  isBinaryOperator(op: string): boolean {
    // 'not' is only unary, not binary
    if (op.toLowerCase() === 'not') {
      return false;
    }
    return this.isSymbolOperator(op) || this.isKeywordOperator(op);
  }
  
  getOperatorDefinition(op: string): OperatorDefinition | undefined {
    return this.symbolOperators.get(op) || 
           this.keywordOperators.get(op.toLowerCase()) ||
           this.unaryOperators.get(op);
  }
  
  getPrecedence(op: string): number {
    const def = this.getOperatorDefinition(op);
    return def ? def.precedence : 0;
  }
  
  getAssociativity(op: string): 'left' | 'right' {
    const def = this.getOperatorDefinition(op);
    return def ? def.associativity : 'left';
  }
  
  // Get all keyword operators (useful for parser)
  getKeywordOperators(): string[] {
    return Array.from(this.keywordOperators.keys());
  }
  
  // Function methods
  registerFunction(def: FunctionDefinition): void {
    this.functions.set(def.name, def);
  }
  
  getFunction(name: string): FunctionDefinition | undefined {
    return this.functions.get(name);
  }
  
  isFunction(name: string): boolean {
    return this.functions.has(name);
  }
  
  // List methods for registry-lookup tool
  listFunctions(): string[] {
    return Array.from(this.functions.keys()).sort();
  }
  
  listOperators(): string[] {
    const operators = new Set<string>();
    this.symbolOperators.forEach((_, key) => operators.add(key));
    this.keywordOperators.forEach((_, key) => operators.add(key));
    this.unaryOperators.forEach((_, key) => operators.add(key));
    return Array.from(operators).sort();
  }
  
  listAllOperations(): string[] {
    return [...this.listOperators(), ...this.listFunctions()].sort();
  }
  
  // Get operation info for registry-lookup tool
  getOperationInfo(name: string): OperatorDefinition | FunctionDefinition | undefined {
    // Try as operator first
    const operator = this.getOperatorDefinition(name);
    if (operator) return operator;
    
    // Try as function
    return this.getFunction(name);
  }
  
  // Type-aware methods for completion provider
  
  /**
   * Get functions applicable to a specific type
   */
  getFunctionsForType(typeName: TypeName | string): FunctionDefinition[] {
    const results: FunctionDefinition[] = [];
    
    for (const [_, func] of this.functions) {
      if (this.isFunctionApplicableToType(func.name, typeName)) {
        results.push(func);
      }
    }
    
    return results;
  }
  
  /**
   * Get operators applicable to a specific type
   */
  getOperatorsForType(typeName: TypeName | string): OperatorDefinition[] {
    const results: OperatorDefinition[] = [];
    const seen = new Set<string>();
    
    // Check all operator maps
    const allOps = [
      ...Array.from(this.symbolOperators.values()),
      ...Array.from(this.keywordOperators.values()),
      ...Array.from(this.unaryOperators.values())
    ];
    
    for (const op of allOps) {
      if (!seen.has(op.symbol) && this.isOperatorApplicableToType(op.symbol, typeName)) {
        results.push(op);
        seen.add(op.symbol);
      }
    }
    
    return results;
  }
  
  /**
   * Check if a function is applicable to a type
   */
  isFunctionApplicableToType(functionName: string, typeName: TypeName | string): boolean {
    const func = this.getFunction(functionName);
    if (!func) return false;
    
    // If no signatures, function works with any type
    if (!func.signatures || func.signatures.length === 0) return true;
    
    // Check if we're dealing with a collection type
    const isCollection = typeof typeName === 'string' && typeName.endsWith('[]');
    
    // Check if ANY signature matches the type
    for (const signature of func.signatures) {
      // If no input type specified, this signature works with any type
      if (!signature.input) return true;
      
      const inputType = signature.input.type;
      const requiresSingleton = signature.input.singleton;
      
      // If function requires singleton but we have a collection, skip this signature
      if (requiresSingleton && isCollection) {
        continue;
      }
      
      // 'Any' type accepts all inputs (but still respects singleton constraint checked above)
      if (inputType === 'Any') return true;
      
      // Direct type match
      if (inputType === typeName) return true;
      
      // For collection types, check if function can work with collections
      if (typeof typeName === 'string' && typeName.endsWith('[]')) {
        const itemType = typeName.slice(0, -2);
        // Only allow if function doesn't require singleton
        if (inputType === itemType && !requiresSingleton) {
          return true;
        }
      }
      
      // Check if it's a numeric type and function accepts numeric types
      const numericTypes = ['Integer', 'Decimal', 'Number'];
      if (numericTypes.includes(typeName as string) && numericTypes.includes(inputType as string)) {
        return true;
      }
      
      // Check if it's a temporal type and function accepts temporal types
      const temporalTypes = ['Date', 'DateTime', 'Time', 'Instant'];
      if (temporalTypes.includes(typeName as string) && temporalTypes.includes(inputType as string)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Check if an operator is applicable to a type
   */
  isOperatorApplicableToType(operatorSymbol: string, typeName: TypeName | string): boolean {
    const op = this.getOperatorDefinition(operatorSymbol);
    if (!op) return false;
    
    // If no signatures, operator works with any type
    if (!op.signatures || op.signatures.length === 0) return true;
    
    // Check if any signature matches the type
    for (const sig of op.signatures) {
      if (!sig.left) continue;
      
      const leftType = sig.left.type;
      
      // 'Any' type accepts all inputs
      if (leftType === 'Any') return true;
      
      // Direct type match
      if (leftType === typeName) return true;
      
      // For collection types, check item type
      if (typeof typeName === 'string' && typeName.endsWith('[]')) {
        const itemType = typeName.slice(0, -2);
        if (leftType === itemType) return true;
      }
      
      // Check numeric type compatibility
      const numericTypes = ['Integer', 'Decimal', 'Number'];
      if (numericTypes.includes(typeName as string) && numericTypes.includes(leftType as string)) {
        return true;
      }
      
      // Check temporal type compatibility
      const temporalTypes = ['Date', 'DateTime', 'Time', 'Instant'];
      if (temporalTypes.includes(typeName as string) && temporalTypes.includes(leftType as string)) {
        return true;
      }
    }
    
    return false;
  }
}

// Export singleton instance
export const registry = new Registry();