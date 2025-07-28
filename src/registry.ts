import type { 
  FHIRPathType, 
  TypeSignature, 
  OperatorSignature, 
  OperatorDefinition, 
  RegisteredOperator, 
  FunctionDefinition 
} from './types';

// Re-export types for backwards compatibility
export type { 
  FHIRPathType, 
  TypeSignature, 
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
        } else if ('signature' in operation && !('symbol' in operation)) {
          // It's a function (has signature but no symbol)
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
    this.functions.set(def.name.toLowerCase(), def);
  }
  
  getFunction(name: string): FunctionDefinition | undefined {
    return this.functions.get(name.toLowerCase());
  }
  
  isFunction(name: string): boolean {
    return this.functions.has(name.toLowerCase());
  }
}

// Export singleton instance
export const registry = new Registry();