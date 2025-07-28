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

/**
 * Optimized Dynamic Registry with bit-encoded precedence
 * 
 * Token format: 0xPPXXXXXX
 * - PP: precedence (0-255)
 * - XXXXXX: unique identifier
 */
export class DynamicRegistryOptimized {
  private static readonly PRECEDENCE_SHIFT = 24; // Shift precedence to high byte
  private static readonly ID_MASK = 0xFFFFFF;    // Mask for ID (lower 24 bits)
  private static readonly PRECEDENCE_MASK = 0xFF; // Mask for precedence (8 bits)
  
  private nextId: number;
  private operators: Map<TokenTypeValue, RegisteredOperator> = new Map();
  private operatorsBySymbol: Map<string, RegisteredOperator> = new Map();
  private functions: Map<string, FunctionDefinition> = new Map();
  private tokenDefinitions: Map<TokenTypeValue, { name: string; symbol: string }> = new Map();
  
  constructor() {
    // Start IDs after predefined tokens (ensure they don't have precedence encoded)
    const maxPredefinedToken = Math.max(...Object.values(TOKEN_DEFINITIONS).map(d => d.value));
    // Ensure we start with a clean ID that won't conflict
    this.nextId = (maxPredefinedToken & DynamicRegistryOptimized.ID_MASK) + 1;
    
    // Register predefined tokens
    Object.entries(TOKEN_DEFINITIONS).forEach(([name, def]) => {
      this.tokenDefinitions.set(def.value, { name, symbol: '' });
    });
  }
  
  /**
   * Register an operator and allocate a token type with encoded precedence
   */
  registerOperator(operator: OperatorDefinition): TokenTypeValue {
    // Check if operator already exists
    const existing = this.operatorsBySymbol.get(operator.symbol);
    if (existing) {
      return existing.tokenType;
    }
    
    // Validate precedence
    if (operator.precedence < 0 || operator.precedence > 255) {
      throw new Error(`Precedence must be between 0 and 255, got ${operator.precedence}`);
    }
    
    // Allocate new token with encoded precedence
    const id = this.nextId++;
    if (id > DynamicRegistryOptimized.ID_MASK) {
      throw new Error('Token ID overflow - too many operators registered');
    }
    
    // Encode: precedence in high byte, ID in lower bytes
    const tokenType = (operator.precedence << DynamicRegistryOptimized.PRECEDENCE_SHIFT) | id;
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
  
  /**
   * Extract precedence from token using bit operations
   * This is VERY fast - just a bit shift!
   */
  getPrecedence(tokenType: TokenTypeValue): number {
    // Check if it's a registered operator first
    if (this.operators.has(tokenType)) {
      // Extract precedence from high byte
      return (tokenType >>> DynamicRegistryOptimized.PRECEDENCE_SHIFT) & DynamicRegistryOptimized.PRECEDENCE_MASK;
    }
    
    // Special tokens that aren't operators but have precedence
    switch (tokenType) {
      case TokenType.DOT:
      case TokenType.LBRACKET:
      case TokenType.LPAREN:
        return 100; // Highest precedence
      default:
        return -1; // Not an operator
    }
  }
  
  /**
   * Fast check if token is an operator by checking if precedence is encoded
   */
  isOperator(tokenType: TokenTypeValue): boolean {
    // Quick check: if high byte is non-zero, it's likely an operator
    const precedence = (tokenType >>> DynamicRegistryOptimized.PRECEDENCE_SHIFT) & DynamicRegistryOptimized.PRECEDENCE_MASK;
    if (precedence > 0) {
      return true;
    }
    // Double-check in our map for operators with 0 precedence
    return this.operators.has(tokenType);
  }
  
  getAssociativity(tokenType: TokenTypeValue): 'left' | 'right' | null {
    const op = this.operators.get(tokenType);
    return op ? op.associativity : null;
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
   * Debug helper to decode token information
   */
  decodeToken(tokenType: TokenTypeValue): { precedence: number; id: number } {
    return {
      precedence: (tokenType >>> DynamicRegistryOptimized.PRECEDENCE_SHIFT) & DynamicRegistryOptimized.PRECEDENCE_MASK,
      id: tokenType & DynamicRegistryOptimized.ID_MASK
    };
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