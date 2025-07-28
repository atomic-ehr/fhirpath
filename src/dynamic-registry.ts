import { TOKEN_DEFINITIONS, TokenType, TokenTypeValue, getTokenName } from './registry-tokens';

export type FHIRPathType = 'String' | 'Boolean' | 'Date' | 'DateTime' | 'Long' | 
                          'Decimal' | 'Integer' | 'Time' | 'Quantity' | 'Any';

export interface TypeSignature {
  type: FHIRPathType;
  singleton: boolean;
}

export interface OperatorSignature {
  name: string;
  left: TypeSignature;
  right: TypeSignature;
  result: TypeSignature;
}

export interface OperatorDefinition {
  symbol: string;
  name: string;
  category: string[];
  precedence: number;
  associativity: 'left' | 'right';
  description: string;
  examples: string[];
  signatures: OperatorSignature[];
}

export interface RegisteredOperator extends OperatorDefinition {
  tokenType: TokenTypeValue;
}

export interface FunctionDefinition {
  name: string;
  category: string[];
  description: string;
  examples: string[];
  signature: {
    input: TypeSignature;
    parameters: Array<{
      name: string;
      optional?: boolean;
      type: TypeSignature;
    }>;
    result: TypeSignature;
  };
}

export class DynamicRegistry {
  private nextTokenValue: number;
  private operators: Map<TokenTypeValue, RegisteredOperator> = new Map();
  private operatorsBySymbol: Map<string, RegisteredOperator> = new Map();
  private functions: Map<string, FunctionDefinition> = new Map();
  private tokenDefinitions: Map<TokenTypeValue, { name: string; symbol: string }> = new Map();
  
  constructor() {
    // Start token values after predefined ones
    this.nextTokenValue = Math.max(...Object.values(TOKEN_DEFINITIONS).map(d => d.value)) + 1;
    
    // Register predefined tokens
    Object.entries(TOKEN_DEFINITIONS).forEach(([name, def]) => {
      this.tokenDefinitions.set(def.value, { name, symbol: '' });
    });
  }
  
  /**
   * Register an operator and allocate a token type for it
   */
  registerOperator(operator: OperatorDefinition): TokenTypeValue {
    // Check if operator already exists
    const existing = this.operatorsBySymbol.get(operator.symbol);
    if (existing) {
      return existing.tokenType;
    }
    
    // Allocate new token type
    const tokenType = this.nextTokenValue++;
    const tokenName = `OP_${operator.name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
    
    // Store token definition
    this.tokenDefinitions.set(tokenType, { 
      name: tokenName, 
      symbol: operator.symbol 
    });
    
    // Create registered operator
    const registeredOp: RegisteredOperator = {
      ...operator,
      tokenType
    };
    
    // Store in maps
    this.operators.set(tokenType, registeredOp);
    this.operatorsBySymbol.set(operator.symbol, registeredOp);
    
    // Add to global TokenType object for compatibility
    (TokenType as any)[tokenName] = tokenType;
    
    return tokenType;
  }
  
  registerFunction(func: FunctionDefinition): void {
    this.functions.set(func.name, func);
  }
  
  // Lookup methods
  getOperator(tokenType: TokenTypeValue): RegisteredOperator | undefined {
    return this.operators.get(tokenType);
  }
  
  getOperatorBySymbol(symbol: string): RegisteredOperator | undefined {
    return this.operatorsBySymbol.get(symbol);
  }
  
  getFunction(name: string): FunctionDefinition | undefined {
    return this.functions.get(name);
  }
  
  getPrecedence(tokenType: TokenTypeValue): number {
    const op = this.operators.get(tokenType);
    return op ? op.precedence : -1;
  }
  
  getAssociativity(tokenType: TokenTypeValue): 'left' | 'right' | null {
    const op = this.operators.get(tokenType);
    return op ? op.associativity : null;
  }
  
  isOperator(tokenType: TokenTypeValue): boolean {
    return this.operators.has(tokenType);
  }
  
  getTokenName(tokenType: TokenTypeValue): string {
    const def = this.tokenDefinitions.get(tokenType);
    if (def) return def.name;
    return getTokenName(tokenType);
  }
  
  getTokenSymbol(tokenType: TokenTypeValue): string {
    const def = this.tokenDefinitions.get(tokenType);
    if (def) return def.symbol;
    
    const op = this.operators.get(tokenType);
    return op ? op.symbol : '';
  }
  
  /**
   * Get all registered tokens for lexer
   */
  getAllTokens(): Map<string, TokenTypeValue> {
    const tokens = new Map<string, TokenTypeValue>();
    
    // Add operator symbols
    this.operatorsBySymbol.forEach((op, symbol) => {
      tokens.set(symbol, op.tokenType);
    });
    
    // Add keywords that are operators
    this.operators.forEach((op) => {
      if (/^[a-zA-Z]+$/.test(op.symbol)) {
        tokens.set(op.symbol, op.tokenType);
      }
    });
    
    return tokens;
  }
  
  /**
   * Export token definitions for code generation
   */
  exportTokenDefinitions(): Record<string, number> {
    const result: Record<string, number> = {};
    
    // Add predefined tokens
    Object.entries(TOKEN_DEFINITIONS).forEach(([name, def]) => {
      result[name] = def.value;
    });
    
    // Add dynamic tokens
    this.tokenDefinitions.forEach((def, value) => {
      if (!result[def.name]) {
        result[def.name] = value;
      }
    });
    
    return result;
  }
}