import type { 
  ASTNode, 
  TypeInfo, 
  BinaryNode, 
  UnaryNode, 
  LiteralNode, 
  FunctionNode, 
  IdentifierNode,
  VariableNode,
  CollectionNode,
  TypeCastNode,
  MembershipTestNode,
  ModelTypeProvider
} from './types';
import { NodeType } from './types';
import { registry } from './registry';

export class TypeAnalyzer {
  private modelProvider?: ModelTypeProvider;
  
  constructor(modelProvider?: ModelTypeProvider) {
    this.modelProvider = modelProvider;
  }
  
  /**
   * Infer type information for an AST node
   */
  inferType(node: ASTNode, inputType?: TypeInfo): TypeInfo {
    switch (node.type) {
      case NodeType.Literal:
        return this.inferLiteralType(node as LiteralNode);
        
      case NodeType.Binary:
        return this.inferBinaryType(node as BinaryNode, inputType);
        
      case NodeType.Unary:
        return this.inferUnaryType(node as UnaryNode, inputType);
        
      case NodeType.Function:
        return this.inferFunctionType(node as FunctionNode, inputType);
        
      case NodeType.Identifier:
        return this.inferIdentifierType(node as IdentifierNode, inputType);
        
      case NodeType.Variable:
        return this.inferVariableType(node as VariableNode);
        
      case NodeType.Collection:
        return this.inferCollectionType(node as CollectionNode);
        
      case NodeType.TypeCast:
        return this.inferTypeCastType(node as TypeCastNode);
        
      case NodeType.MembershipTest:
        return { type: 'Boolean', singleton: true };
        
      case NodeType.TypeOrIdentifier:
        return this.inferTypeOrIdentifierType(node, inputType);
        
      default:
        return { type: 'Any', singleton: false };
    }
  }
  
  private inferLiteralType(node: LiteralNode): TypeInfo {
    switch (node.valueType) {
      case 'string':
        return { type: 'String', singleton: true };
      case 'number':
        // Check if integer or decimal
        const num = node.value as number;
        return { 
          type: Number.isInteger(num) ? 'Integer' : 'Decimal', 
          singleton: true 
        };
      case 'boolean':
        return { type: 'Boolean', singleton: true };
      case 'date':
        return { type: 'Date', singleton: true };
      case 'datetime':
        return { type: 'DateTime', singleton: true };
      case 'time':
        return { type: 'Time', singleton: true };
      case 'null':
        return { type: 'Any', singleton: false }; // Empty collection
      default:
        return { type: 'Any', singleton: true };
    }
  }
  
  private inferBinaryType(node: BinaryNode, inputType?: TypeInfo): TypeInfo {
    const operator = registry.getOperatorDefinition(node.operator);
    if (!operator) {
      return { type: 'Any', singleton: false };
    }
    
    // For navigation (dot operator), we need special handling
    if (node.operator === '.') {
      return this.inferNavigationType(node, inputType);
    }
    
    // Infer types of operands
    const leftType = this.inferType(node.left, inputType);
    const rightType = this.inferType(node.right, inputType);
    
    // Find matching signature
    for (const sig of operator.signatures) {
      if (this.isTypeCompatible(leftType, sig.left) && 
          this.isTypeCompatible(rightType, sig.right)) {
        return sig.result;
      }
    }
    
    // Default to first signature's result type
    return operator.signatures[0]?.result || { type: 'Any', singleton: false };
  }
  
  private inferNavigationType(node: BinaryNode, inputType?: TypeInfo): TypeInfo {
    if (!inputType) {
      return { type: 'Any', singleton: false };
    }
    
    const leftType = this.inferType(node.left, inputType);
    
    // If we have a model provider and the left type is complex
    if (this.modelProvider && leftType.namespace && leftType.name) {
      const rightNode = node.right;
      if (rightNode.type === NodeType.Identifier) {
        const propertyName = (rightNode as IdentifierNode).name;
        
        // Try to navigate using model provider
        const resultType = this.modelProvider.navigateProperty(leftType, propertyName);
        if (resultType) {
          return resultType;
        }
      }
    }
    
    // Check elements map
    if (leftType.elements && node.right.type === NodeType.Identifier) {
      const propertyName = (node.right as IdentifierNode).name;
      const elementType = leftType.elements[propertyName];
      if (elementType) {
        return elementType;
      }
    }
    
    // Default navigation behavior
    return { type: 'Any', singleton: false };
  }
  
  private inferUnaryType(node: UnaryNode, inputType?: TypeInfo): TypeInfo {
    const operator = registry.getOperatorDefinition(node.operator);
    if (!operator) {
      return { type: 'Any', singleton: false };
    }
    
    // Unary operators typically have one signature
    const signature = operator.signatures[0];
    if (signature) {
      return signature.result;
    }
    
    return { type: 'Any', singleton: false };
  }
  
  private inferFunctionType(node: FunctionNode, inputType?: TypeInfo): TypeInfo {
    if (node.name.type !== NodeType.Identifier) {
      return { type: 'Any', singleton: false };
    }
    
    const funcName = (node.name as IdentifierNode).name;
    const func = registry.getFunction(funcName);
    
    if (!func) {
      return { type: 'Any', singleton: false };
    }
    
    return func.signature.result;
  }
  
  private inferIdentifierType(node: IdentifierNode, inputType?: TypeInfo): TypeInfo {
    // Check if it's a type name (for type references)
    if (this.modelProvider && this.modelProvider.hasTypeName(node.name)) {
      const typeInfo = this.modelProvider.getTypeByName(node.name);
      if (typeInfo) {
        return typeInfo;
      }
    }
    
    // Otherwise, it's a property access on the input
    if (inputType && inputType.elements) {
      const elementType = inputType.elements[node.name];
      if (elementType) {
        return elementType;
      }
    }
    
    return { type: 'Any', singleton: false };
  }
  
  private inferVariableType(node: VariableNode): TypeInfo {
    // Built-in variables
    if (node.name === '$this' || node.name === '$index' || node.name === '$total') {
      return { type: 'Any', singleton: true };
    }
    
    // User-defined variables - we don't have type info
    return { type: 'Any', singleton: true };
  }
  
  private inferCollectionType(node: CollectionNode): TypeInfo {
    if (node.elements.length === 0) {
      return { type: 'Any', singleton: false };
    }
    
    // Infer types of all elements
    const elementTypes = node.elements.map(el => this.inferType(el));
    
    // If all elements have the same type, use that
    const firstType = elementTypes[0];
    if (firstType) {
      const allSameType = elementTypes.every(t => 
        t.type === firstType.type && 
        t.namespace === firstType.namespace && 
        t.name === firstType.name
      );
      
      if (allSameType) {
        return { ...firstType, singleton: false };
      }
    }
    
    // Otherwise, create a union type
    return {
      type: 'Any',
      union: true,
      singleton: false,
      choices: elementTypes
    };
  }
  
  private inferTypeCastType(node: TypeCastNode): TypeInfo {
    const targetType = node.targetType;
    
    // If we have a model provider, try to get the full type info
    if (this.modelProvider && this.modelProvider.hasTypeName(targetType)) {
      const typeInfo = this.modelProvider.getTypeByName(targetType);
      if (typeInfo) {
        return typeInfo;
      }
    }
    
    // Otherwise, check if it's a FHIRPath primitive type
    const fhirPathTypes = ['String', 'Boolean', 'Integer', 'Decimal', 'Date', 'DateTime', 'Time', 'Quantity'];
    if (fhirPathTypes.includes(targetType)) {
      return { type: targetType as any, singleton: true };
    }
    
    return { type: 'Any', singleton: true };
  }
  
  private inferTypeOrIdentifierType(node: ASTNode, inputType?: TypeInfo): TypeInfo {
    // TypeOrIdentifier nodes need context to determine their type
    return inputType || { type: 'Any', singleton: false };
  }
  
  private isTypeCompatible(source: TypeInfo, target: TypeInfo): boolean {
    // Simple compatibility check
    if (source.type === target.type && source.singleton === target.singleton) {
      return true;
    }
    
    // Any is compatible with everything
    if (source.type === 'Any' || target.type === 'Any') {
      return true;
    }
    
    // Collection compatibility
    if (!source.singleton && target.singleton) {
      return false;
    }
    
    // Union type compatibility
    if (source.union && source.choices) {
      return source.choices.some(choice => this.isTypeCompatible(choice, target));
    }
    
    // Model-specific compatibility
    if (this.modelProvider && source.namespace && target.namespace) {
      return this.modelProvider.isTypeCompatible(source, target);
    }
    
    return false;
  }
  
  /**
   * Annotate AST with type information
   */
  annotateAST(node: ASTNode, inputType?: TypeInfo): void {
    // Infer and attach type info
    node.typeInfo = this.inferType(node, inputType);
    
    // Recursively annotate children
    switch (node.type) {
      case NodeType.Binary:
        const binaryNode = node as BinaryNode;
        this.annotateAST(binaryNode.left, inputType);
        
        // For navigation, pass the left's type as input to the right
        if (binaryNode.operator === '.') {
          this.annotateAST(binaryNode.right, binaryNode.left.typeInfo);
        } else {
          this.annotateAST(binaryNode.right, inputType);
        }
        break;
        
      case NodeType.Unary:
        const unaryNode = node as UnaryNode;
        this.annotateAST(unaryNode.operand, inputType);
        break;
        
      case NodeType.Function:
        const funcNode = node as FunctionNode;
        this.annotateAST(funcNode.name, inputType);
        funcNode.arguments.forEach(arg => this.annotateAST(arg, inputType));
        break;
        
      case NodeType.Collection:
        const collNode = node as CollectionNode;
        collNode.elements.forEach(el => this.annotateAST(el, inputType));
        break;
        
      // Add other node types as needed
    }
  }
}