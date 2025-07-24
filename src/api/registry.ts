import type { 
  RegistryAPI, 
  OperationMetadata, 
  OperationInfo 
} from './types';
import { Registry } from '../registry/registry';
import type { Operation } from '../registry/types';

export class PublicRegistryAPI implements RegistryAPI {
  listFunctions(): OperationMetadata[] {
    return Registry.getAllFunctions().map(op => this.toMetadata(op));
  }
  
  listOperators(): OperationMetadata[] {
    const operators = [
      ...Registry.getOperatorsByForm('infix'),
      ...Registry.getOperatorsByForm('prefix'),
      ...Registry.getOperatorsByForm('postfix')
    ];
    return operators.map(op => this.toMetadata(op));
  }
  
  listAllOperations(): OperationMetadata[] {
    return Registry.getAllOperations().map(op => this.toMetadata(op));
  }
  
  hasOperation(name: string): boolean {
    return Registry.get(name) !== undefined;
  }
  
  hasFunction(name: string): boolean {
    const op = Registry.get(name);
    return op !== undefined && op.kind === 'function';
  }
  
  hasOperator(symbol: string): boolean {
    const op = Registry.get(symbol);
    return op !== undefined && op.kind === 'operator';
  }
  
  getOperationInfo(name: string): OperationInfo | undefined {
    const op = Registry.get(name);
    if (!op) return undefined;
    
    return this.toOperationInfo(op);
  }
  
  canRegisterFunction(name: string): boolean {
    // Check if name is valid and not already taken
    if (!name || typeof name !== 'string') return false;
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) return false;
    
    // Check if already exists as built-in
    return !this.hasOperation(name);
  }
  
  private toMetadata(op: Operation): OperationMetadata {
    return {
      name: op.name,
      kind: op.kind,
      syntax: {
        notation: op.syntax.notation
      }
    };
  }
  
  private toOperationInfo(op: Operation): OperationInfo {
    const info: OperationInfo = {
      ...this.toMetadata(op),
      signature: {}
    };
    
    // Add input signature for functions
    if (op.kind === 'function' && op.signature.input) {
      info.signature.input = {
        types: this.extractTypes(op.signature.input.types),
        cardinality: op.signature.input.cardinality
      };
    }
    
    // Add parameters
    if ('parameters' in op.signature && op.signature.parameters && op.signature.parameters.length > 0) {
      info.signature.parameters = op.signature.parameters.map((param: any) => ({
        name: param.name,
        types: this.extractTypes(param.types),
        cardinality: param.cardinality,
        optional: param.optional
      }));
    }
    
    // Add output signature
    if (op.signature.output) {
      info.signature.output = {
        type: typeof op.signature.output.type === 'string' 
          ? op.signature.output.type 
          : 'dynamic',
        cardinality: typeof op.signature.output.cardinality === 'string'
          ? (op.signature.output.cardinality === 'all-singleton' ? 'singleton' : op.signature.output.cardinality as any)
          : undefined
      };
    }
    
    // Add description if available (for now, operations don't have description in the type)
    // TODO: Add description to Operation type if needed
    
    // Add examples if available (for now, operations don't have examples in the type)
    // TODO: Add examples to Operation type if needed
    
    return info;
  }
  
  private extractTypes(constraint?: any): string[] | undefined {
    if (!constraint) return undefined;
    
    if (constraint.kind === 'primitive' || constraint.kind === 'class') {
      return constraint.types;
    } else if (constraint.kind === 'union' && constraint.types) {
      return constraint.types;
    } else if (constraint.kind === 'any') {
      return ['any'];
    }
    
    return undefined;
  }
}

// Singleton instance
export const publicRegistry = new PublicRegistryAPI();