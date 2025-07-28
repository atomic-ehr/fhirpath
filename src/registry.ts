
import { TokenType } from './lexer';

export type FHIRPathType = 'String' | 'Boolean' | 'Date' | 'DateTime' | 'Long' | 
                          'Decimal' | 'Integer' | 'Time' | 'Quantity' | 'Any';

export interface TypeSignature {
  type: FHIRPathType;
  singleton: boolean;
}

export interface BinaryOperatorSignature {
  name: string;
  left: TypeSignature;
  right: TypeSignature;
  result: TypeSignature;
}

export interface BinaryOperator {
  symbol: string;
  name: string;
  tokenType: TokenType;
  category: string[];
  precedence: number;
  associativity: 'left' | 'right';
  description: string;
  examples: string[];
  signatures: BinaryOperatorSignature[];
  selectSignature?: (left: TypeSignature, right: TypeSignature) => BinaryOperatorSignature | null;
}

export interface UnaryOperator {
  symbol: string;
  name: string;
  tokenType: TokenType;
  category: string[];
  precedence: number;
  description: string;
  examples: string[];
  signature: {
    operand: TypeSignature;
    result: TypeSignature;
  };
}

export interface ParameterSignature {
  name: string;
  optional?: boolean;
  type: TypeSignature;
}

export interface FunctionSignature {
  input: TypeSignature;
  parameters: ParameterSignature[];
  result: TypeSignature;
}

export interface FHIRPathFunction {
  name: string;
  category: string[];
  description: string;
  examples: string[];
  signature: FunctionSignature;
}

export class Registry {
  private binaryOperators: Map<TokenType, BinaryOperator> = new Map();
  private binaryOperatorsBySymbol: Map<string, BinaryOperator> = new Map();
  private unaryOperators: Map<TokenType, UnaryOperator> = new Map();
  private functions: Map<string, FHIRPathFunction> = new Map();

  registerBinaryOperator(operator: BinaryOperator): void {
    this.binaryOperators.set(operator.tokenType, operator);
    this.binaryOperatorsBySymbol.set(operator.symbol, operator);
  }

  registerUnaryOperator(operator: UnaryOperator): void {
    this.unaryOperators.set(operator.tokenType, operator);
  }

  registerFunction(func: FHIRPathFunction): void {
    this.functions.set(func.name, func);
  }

  // Lookup methods
  getBinaryOperator(tokenType: TokenType): BinaryOperator | undefined {
    return this.binaryOperators.get(tokenType);
  }

  getBinaryOperatorBySymbol(symbol: string): BinaryOperator | undefined {
    return this.binaryOperatorsBySymbol.get(symbol);
  }

  getUnaryOperator(tokenType: TokenType): UnaryOperator | undefined {
    return this.unaryOperators.get(tokenType);
  }

  getFunction(name: string): FHIRPathFunction | undefined {
    return this.functions.get(name);
  }

  // Precedence and associativity helpers
  getPrecedence(tokenType: TokenType): number {
    const binaryOp = this.binaryOperators.get(tokenType);
    if (binaryOp) return binaryOp.precedence;
    
    const unaryOp = this.unaryOperators.get(tokenType);
    if (unaryOp) return unaryOp.precedence;
    
    return -1; // Not an operator
  }

  getAssociativity(tokenType: TokenType): 'left' | 'right' | null {
    const op = this.binaryOperators.get(tokenType);
    return op ? op.associativity : null;
  }

  isBinaryOperator(tokenType: TokenType): boolean {
    return this.binaryOperators.has(tokenType);
  }

  isUnaryOperator(tokenType: TokenType): boolean {
    return this.unaryOperators.has(tokenType);
  }

  // Type checking helpers
  selectBinaryOperatorSignature(
    tokenType: TokenType, 
    leftType: TypeSignature, 
    rightType: TypeSignature
  ): BinaryOperatorSignature | null {
    const operator = this.binaryOperators.get(tokenType);
    if (!operator) return null;

    if (operator.selectSignature) {
      return operator.selectSignature(leftType, rightType);
    }

    // Default matching logic
    for (const sig of operator.signatures) {
      if (this.typeMatches(leftType, sig.left) && this.typeMatches(rightType, sig.right)) {
        return sig;
      }
    }

    return null;
  }

  private typeMatches(actual: TypeSignature, expected: TypeSignature): boolean {
    // Check singleton compatibility first:
    // If expected is singleton (true), actual must also be singleton (true)
    // If expected is collection (false), actual must also be collection (false)
    if (expected.singleton !== actual.singleton) return false;
    
    // Any matches everything (after singleton check)
    if (expected.type === 'Any' || actual.type === 'Any') return true;
    
    // Type compatibility
    return this.isTypeCompatible(actual.type, expected.type);
  }

  private isTypeCompatible(actual: FHIRPathType, expected: FHIRPathType): boolean {
    if (actual === expected) return true;
    
    // Numeric type hierarchy: Integer -> Long -> Decimal
    if (expected === 'Decimal' && (actual === 'Integer' || actual === 'Long')) return true;
    if (expected === 'Long' && actual === 'Integer') return true;
    
    // DateTime/Date compatibility
    if (expected === 'DateTime' && actual === 'Date') return true;
    
    return false;
  }

}

// Import all operations
import {
  plusOperator,
  minusOperator,
  multiplyOperator,
  divideOperator,
  equalOperator,
  andOperator,
  orOperator,
  unaryMinusOperator,
  substringFunction,
  whereFunction
} from './operations';

// Create and export a default registry instance
export const defaultRegistry = new Registry();

// Register binary operators
defaultRegistry.registerBinaryOperator(equalOperator);
defaultRegistry.registerBinaryOperator(plusOperator);
defaultRegistry.registerBinaryOperator(minusOperator);
defaultRegistry.registerBinaryOperator(multiplyOperator);
defaultRegistry.registerBinaryOperator(divideOperator);
defaultRegistry.registerBinaryOperator(andOperator);
defaultRegistry.registerBinaryOperator(orOperator);

// Register unary operators
defaultRegistry.registerUnaryOperator(unaryMinusOperator);

// Register functions
defaultRegistry.registerFunction(substringFunction);
defaultRegistry.registerFunction(whereFunction);   