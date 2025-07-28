// Precedence levels (higher number = higher precedence)
export const PRECEDENCE = {
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
  // bit-packed with precedence
  tokenType: number;
  name: string;
  category: string[];
  precedence: number;
  associativity: 'left' | 'right';
  description: string;
  examples: string[];
  signatures: OperatorSignature[];
}

export interface RegisteredOperator extends OperatorDefinition {
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