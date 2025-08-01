import type { 
  ASTNode, 
  BinaryNode, 
  IdentifierNode, 
  LiteralNode, 
  FunctionNode, 
  Diagnostic, 
  AnalysisResult, 
  UnaryNode, 
  IndexNode, 
  CollectionNode, 
  MembershipTestNode, 
  TypeCastNode, 
  TypeInfo, 
  ModelProvider,
  VariableNode,
  TypeName
} from './types';
import { NodeType, DiagnosticSeverity } from './types';
import { registry } from './registry';

export class Analyzer {
  private diagnostics: Diagnostic[] = [];
  private variables: Set<string> = new Set(['$this', '$index', '$total']);
  private modelProvider?: ModelProvider;

  constructor(modelProvider?: ModelProvider) {
    this.modelProvider = modelProvider;
  }

  analyze(ast: ASTNode, userVariables?: Record<string, any>, inputType?: TypeInfo): AnalysisResult {
    this.diagnostics = [];
    
    if (userVariables) {
      Object.keys(userVariables).forEach(name => this.variables.add(name));
    }
    
    // Annotate AST with type information if model provider is available
    if (this.modelProvider) {
      this.annotateAST(ast, inputType);
    }
    
    // Perform validation
    this.visitNode(ast);
    
    return {
      diagnostics: this.diagnostics,
      ast
    };
  }

  private visitNode(node: ASTNode): void {
    // Handle error nodes
    if (node.type === 'Error') {
      // Error nodes are already reported by the parser
      return;
    }
    
    switch (node.type) {
      case NodeType.Binary:
        this.visitBinaryOperator(node as BinaryNode);
        break;
      case NodeType.Identifier:
        this.visitIdentifier(node as IdentifierNode);
        break;
      case NodeType.Function:
        this.visitFunctionCall(node as FunctionNode);
        break;
      case NodeType.Index:
        const indexNode = node as IndexNode;
        this.visitNode(indexNode.expression);
        this.visitNode(indexNode.index);
        break;
      case NodeType.Collection:
        (node as CollectionNode).elements.forEach(el => this.visitNode(el));
        break;
      case NodeType.Unary:
        this.visitNode((node as UnaryNode).operand);
        break;
      case NodeType.MembershipTest:
        this.visitNode((node as MembershipTestNode).expression);
        break;
      case NodeType.TypeCast:
        this.visitNode((node as TypeCastNode).expression);
        break;
      case NodeType.Variable:
        this.visitVariable(node as any);
        break;
      case NodeType.Literal:
      case NodeType.TypeOrIdentifier:
      case NodeType.TypeReference:
        // These are always valid
        break;
    }
  }

  private visitBinaryOperator(node: BinaryNode): void {
    this.visitNode(node.left);
    this.visitNode(node.right);
    
    const op = registry.getOperatorDefinition(node.operator);
    if (!op) {
      this.addDiagnostic(DiagnosticSeverity.Error, `Unknown operator: ${node.operator}`, node, 'UNKNOWN_OPERATOR');
    }
  }

  private visitIdentifier(node: IdentifierNode): void {
    const name = node.name;
    
    // Check special identifiers
    if (name.startsWith('$')) {
      if (!this.variables.has(name)) {
        this.addDiagnostic(DiagnosticSeverity.Error, `Unknown variable: ${name}`, node, 'UNKNOWN_VARIABLE');
      }
    } else if (name.startsWith('%')) {
      const varName = name.substring(1);
      if (!this.variables.has(varName)) {
        this.addDiagnostic(DiagnosticSeverity.Error, `Unknown user variable: ${name}`, node, 'UNKNOWN_USER_VARIABLE');
      }
    }
  }

  private visitFunctionCall(node: FunctionNode): void {
    if (node.name.type === NodeType.Identifier) {
      const funcName = (node.name as IdentifierNode).name;
      const func = registry.getFunction(funcName);
      
      if (!func) {
        this.addDiagnostic(DiagnosticSeverity.Error, `Unknown function: ${funcName}`, node, 'UNKNOWN_FUNCTION');
      } else {
        // Check argument count based on signature
        const params = func.signature.parameters;
        const requiredParams = params.filter(p => !p.optional).length;
        const maxParams = params.length;
        
        if (node.arguments.length < requiredParams) {
          this.addDiagnostic(DiagnosticSeverity.Error, `Function '${funcName}' requires at least ${requiredParams} arguments, got ${node.arguments.length}`, node, 'TOO_FEW_ARGS');
        } else if (node.arguments.length > maxParams) {
          this.addDiagnostic(DiagnosticSeverity.Error, `Function '${funcName}' accepts at most ${maxParams} arguments, got ${node.arguments.length}`, node, 'TOO_MANY_ARGS');
        }
      }
    }
    
    node.arguments.forEach(arg => this.visitNode(arg));
  }

  private visitVariable(node: any): void {
    const name = node.name;
    
    if (name.startsWith('$')) {
      if (!this.variables.has(name)) {
        this.addDiagnostic(DiagnosticSeverity.Error, `Unknown variable: ${name}`, node, 'UNKNOWN_VARIABLE');
      }
    } else if (name.startsWith('%')) {
      const varName = name.substring(1);
      if (!this.variables.has(varName)) {
        this.addDiagnostic(DiagnosticSeverity.Error, `Unknown user variable: ${name}`, node, 'UNKNOWN_USER_VARIABLE');
      }
    }
  }

  private addDiagnostic(severity: DiagnosticSeverity, message: string, node: ASTNode, code: string): void {
    this.diagnostics.push({
      range: node.range,
      severity,
      message,
      code,
      source: 'fhirpath-analyzer'
    });
  }

  // Type inference methods merged from TypeAnalyzer
  private inferType(node: ASTNode, inputType?: TypeInfo): TypeInfo {
    switch (node.type) {
      case NodeType.Literal:
        return this.inferLiteralType(node as LiteralNode);
        
      case NodeType.Binary:
        return this.inferBinaryType(node as BinaryNode, inputType);
        
      case NodeType.Unary:
        return this.inferUnaryType(node as UnaryNode);
        
      case NodeType.Function:
        return this.inferFunctionType(node as FunctionNode);
        
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
        
      default:
        return { type: 'Any', singleton: false };
    }
  }
  
  private inferLiteralType(node: LiteralNode): TypeInfo {
    switch (node.valueType) {
      case 'string':
        return { type: 'String', singleton: true };
      case 'number':
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
    const leftType = this.inferType(node.left, inputType);
    
    // If we have a model provider and the right side is an identifier
    if (this.modelProvider && node.right.type === NodeType.Identifier) {
      const propertyName = (node.right as IdentifierNode).name;
      
      // Use getElementType to navigate the property
      const resultType = this.modelProvider.getElementType(leftType, propertyName);
      if (resultType) {
        return resultType;
      }
    }
    
    // Default navigation behavior
    return { type: 'Any', singleton: false };
  }
  
  private inferUnaryType(node: UnaryNode): TypeInfo {
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
  
  private inferFunctionType(node: FunctionNode): TypeInfo {
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
    // If we have a model provider, check if it's a type name
    if (this.modelProvider) {
      const typeInfo = this.modelProvider.getType(node.name);
      if (typeInfo) {
        return typeInfo;
      }
    }
    
    // Otherwise, try to navigate from input type
    if (inputType && this.modelProvider) {
      const elementType = this.modelProvider.getElementType(inputType, node.name);
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
    
    // Otherwise, it's a heterogeneous collection
    return { type: 'Any', singleton: false };
  }
  
  private inferTypeCastType(node: TypeCastNode): TypeInfo {
    const targetType = node.targetType;
    
    // If we have a model provider, try to get the type info
    if (this.modelProvider) {
      const typeInfo = this.modelProvider.getType(targetType);
      if (typeInfo) {
        return typeInfo;
      }
    }
    
    // Otherwise, check if it's a FHIRPath primitive type
    const fhirPathTypes = ['String', 'Boolean', 'Integer', 'Decimal', 'Date', 'DateTime', 'Time', 'Quantity'];
    if (fhirPathTypes.includes(targetType)) {
      return { type: targetType as TypeName, singleton: true };
    }
    
    return { type: 'Any', singleton: true };
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
    
    return false;
  }
  
  /**
   * Annotate AST with type information
   */
  private annotateAST(node: ASTNode, inputType?: TypeInfo): void {
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
        
      case NodeType.TypeCast:
        const castNode = node as TypeCastNode;
        this.annotateAST(castNode.expression, inputType);
        break;
        
      case NodeType.MembershipTest:
        const memberNode = node as MembershipTestNode;
        this.annotateAST(memberNode.expression, inputType);
        break;
        
      case NodeType.Index:
        const indexNode = node as IndexNode;
        this.annotateAST(indexNode.expression, inputType);
        this.annotateAST(indexNode.index, inputType);
        break;
    }
  }
}