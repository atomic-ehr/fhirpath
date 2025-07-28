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

export class Registry {
  constructor() { }
}