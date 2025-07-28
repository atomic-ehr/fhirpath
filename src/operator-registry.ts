/**
 * FHIRPath Operator Registry
 * Defines operators with their precedence and associativity
 */

export interface OperatorInfo {
  symbol: string;
  precedence: number;
  associativity: 'left' | 'right';
  isKeyword?: boolean; // For keyword operators like 'and', 'or', 'div', etc.
}

// Precedence levels (higher number = higher precedence)
const PRECEDENCE = {
  // Lowest precedence
  IMPLIES: 10,
  OR: 20,
  XOR: 30,
  AND: 40,
  IN_CONTAINS: 50,
  EQUALITY: 60,      // =, !=, ~, !~
  COMPARISON: 70,    // <, >, <=, >=
  PIPE: 80,          // |
  ADDITIVE: 90,      // +, -
  MULTIPLICATIVE: 100, // *, /, div, mod
  UNARY: 110,        // unary +, -, not
  AS_IS: 120,        // as, is
  POSTFIX: 130,      // []
  DOT: 140,          // . (highest)
};

// Symbol operators
const SYMBOL_OPERATORS: Record<string, OperatorInfo> = {
  // Arithmetic
  '+': { symbol: '+', precedence: PRECEDENCE.ADDITIVE, associativity: 'left' },
  '-': { symbol: '-', precedence: PRECEDENCE.ADDITIVE, associativity: 'left' },
  '*': { symbol: '*', precedence: PRECEDENCE.MULTIPLICATIVE, associativity: 'left' },
  '/': { symbol: '/', precedence: PRECEDENCE.MULTIPLICATIVE, associativity: 'left' },
  
  // Comparison
  '<': { symbol: '<', precedence: PRECEDENCE.COMPARISON, associativity: 'left' },
  '>': { symbol: '>', precedence: PRECEDENCE.COMPARISON, associativity: 'left' },
  '<=': { symbol: '<=', precedence: PRECEDENCE.COMPARISON, associativity: 'left' },
  '>=': { symbol: '>=', precedence: PRECEDENCE.COMPARISON, associativity: 'left' },
  
  // Equality
  '=': { symbol: '=', precedence: PRECEDENCE.EQUALITY, associativity: 'left' },
  '!=': { symbol: '!=', precedence: PRECEDENCE.EQUALITY, associativity: 'left' },
  '~': { symbol: '~', precedence: PRECEDENCE.EQUALITY, associativity: 'left' },
  '!~': { symbol: '!~', precedence: PRECEDENCE.EQUALITY, associativity: 'left' },
  
  // Other
  '|': { symbol: '|', precedence: PRECEDENCE.PIPE, associativity: 'left' },
  '&': { symbol: '&', precedence: PRECEDENCE.ADDITIVE, associativity: 'left' },
  
  // Structural (not really operators but needed for parsing)
  '.': { symbol: '.', precedence: PRECEDENCE.DOT, associativity: 'left' },
};

// Keyword operators
const KEYWORD_OPERATORS: Record<string, OperatorInfo> = {
  // Logical
  'and': { symbol: 'and', precedence: PRECEDENCE.AND, associativity: 'left', isKeyword: true },
  'or': { symbol: 'or', precedence: PRECEDENCE.OR, associativity: 'left', isKeyword: true },
  'xor': { symbol: 'xor', precedence: PRECEDENCE.XOR, associativity: 'left', isKeyword: true },
  'implies': { symbol: 'implies', precedence: PRECEDENCE.IMPLIES, associativity: 'right', isKeyword: true },
  
  // Arithmetic
  'div': { symbol: 'div', precedence: PRECEDENCE.MULTIPLICATIVE, associativity: 'left', isKeyword: true },
  'mod': { symbol: 'mod', precedence: PRECEDENCE.MULTIPLICATIVE, associativity: 'left', isKeyword: true },
  
  // Membership
  'in': { symbol: 'in', precedence: PRECEDENCE.IN_CONTAINS, associativity: 'left', isKeyword: true },
  'contains': { symbol: 'contains', precedence: PRECEDENCE.IN_CONTAINS, associativity: 'left', isKeyword: true },
  
  // Type operators
  'is': { symbol: 'is', precedence: PRECEDENCE.AS_IS, associativity: 'left', isKeyword: true },
  'as': { symbol: 'as', precedence: PRECEDENCE.AS_IS, associativity: 'left', isKeyword: true },
};

// Unary operators
const UNARY_OPERATORS: Record<string, OperatorInfo> = {
  '+': { symbol: '+', precedence: PRECEDENCE.UNARY, associativity: 'right' },
  '-': { symbol: '-', precedence: PRECEDENCE.UNARY, associativity: 'right' },
  'not': { symbol: 'not', precedence: PRECEDENCE.UNARY, associativity: 'right', isKeyword: true },
};

export class OperatorRegistry {
  private symbolOperators = new Map<string, OperatorInfo>();
  private keywordOperators = new Map<string, OperatorInfo>();
  private unaryOperators = new Map<string, OperatorInfo>();
  
  constructor() {
    // Initialize symbol operators
    for (const [symbol, info] of Object.entries(SYMBOL_OPERATORS)) {
      this.symbolOperators.set(symbol, info);
    }
    
    // Initialize keyword operators
    for (const [keyword, info] of Object.entries(KEYWORD_OPERATORS)) {
      this.keywordOperators.set(keyword.toLowerCase(), info);
    }
    
    // Initialize unary operators
    for (const [op, info] of Object.entries(UNARY_OPERATORS)) {
      this.unaryOperators.set(op, info);
    }
  }
  
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
    return this.isSymbolOperator(op) || this.isKeywordOperator(op);
  }
  
  getOperatorInfo(op: string): OperatorInfo | undefined {
    return this.symbolOperators.get(op) || 
           this.keywordOperators.get(op.toLowerCase()) ||
           this.unaryOperators.get(op);
  }
  
  getPrecedence(op: string): number {
    const info = this.getOperatorInfo(op);
    return info ? info.precedence : 0;
  }
  
  getAssociativity(op: string): 'left' | 'right' {
    const info = this.getOperatorInfo(op);
    return info ? info.associativity : 'left';
  }
  
  // Get all keyword operators (useful for parser)
  getKeywordOperators(): string[] {
    return Array.from(this.keywordOperators.keys());
  }
}

// Export singleton instance
export const operatorRegistry = new OperatorRegistry();

// Export precedence constants for reference
export { PRECEDENCE };