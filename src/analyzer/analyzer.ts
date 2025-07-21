import type { 
  ASTNode, 
  LiteralNode, 
  IdentifierNode, 
  VariableNode,
  BinaryNode,
  UnaryNode,
  FunctionNode,
  CollectionNode,
  IndexNode,
  UnionNode,
  MembershipTestNode,
  TypeCastNode,
  TypeReferenceNode,
  TypeOrIdentifierNode
} from '../parser/ast';
import { NodeType } from '../parser/ast';
import { TokenType } from '../lexer/token';
import type { 
  ModelProvider, 
  TypeRef, 
  TypeAnalysisResult, 
  TypeDiagnostic
} from './types';
import { AnalysisMode } from './types';
import { functionSignatures } from './function-signatures';
import * as operatorSignatures from './function-signatures';

// Type for node analyzer functions
type NodeAnalyzer = (node: any, inputType: TypeRef | undefined, inputIsSingleton: boolean) => AnalysisResult;

interface AnalysisResult {
  type: TypeRef | undefined;
  isSingleton: boolean;
}

/**
 * FHIRPath Type Analyzer - performs type analysis on AST nodes
 * Follows the same pattern as the interpreter but tracks types instead of values
 */
export class TypeAnalyzer {
  private diagnostics: TypeDiagnostic[] = [];
  
  // Object lookup for node analyzers (mirrors interpreter pattern)
  private readonly nodeAnalyzers: Record<NodeType, NodeAnalyzer> = {
    [NodeType.Literal]: this.analyzeLiteral.bind(this),
    [NodeType.Identifier]: this.analyzeIdentifier.bind(this),
    [NodeType.TypeOrIdentifier]: this.analyzeTypeOrIdentifier.bind(this),
    [NodeType.Variable]: this.analyzeVariable.bind(this),
    [NodeType.Binary]: this.analyzeBinary.bind(this),
    [NodeType.Unary]: this.analyzeUnary.bind(this),
    [NodeType.Function]: this.analyzeFunction.bind(this),
    [NodeType.Collection]: this.analyzeCollection.bind(this),
    [NodeType.Index]: this.analyzeIndex.bind(this),
    [NodeType.Union]: this.analyzeUnion.bind(this),
    [NodeType.MembershipTest]: this.analyzeMembershipTest.bind(this),
    [NodeType.TypeCast]: this.analyzeTypeCast.bind(this),
    [NodeType.TypeReference]: this.analyzeTypeReference.bind(this),
  };
  
  constructor(
    private modelProvider: ModelProvider,
    private mode: AnalysisMode = AnalysisMode.Lenient
  ) {}
  
  /**
   * Analyze a FHIRPath expression
   */
  analyze(
    ast: ASTNode, 
    inputType?: TypeRef,
    inputIsSingleton: boolean = true
  ): TypeAnalysisResult {
    this.diagnostics = [];
    
    const result = this.analyzeNode(ast, inputType, inputIsSingleton);
    
    return {
      ast,
      diagnostics: this.diagnostics,
      resultType: result.type,
      resultIsSingleton: result.isSingleton
    };
  }
  
  /**
   * Main analysis method - uses object lookup
   */
  private analyzeNode(
    node: ASTNode, 
    inputType: TypeRef | undefined,
    inputIsSingleton: boolean
  ): AnalysisResult {
    const analyzer = this.nodeAnalyzers[node.type];
    
    if (!analyzer) {
      this.addDiagnostic('error', `Unknown node type: ${node.type}`, node.position);
      return { type: this.modelProvider.resolveType('Any'), isSingleton: false };
    }
    
    const result = analyzer(node, inputType, inputIsSingleton);
    
    // Annotate the node with type information
    node.resultType = result.type;
    node.isSingleton = result.isSingleton;
    
    return result;
  }
  
  private analyzeLiteral(node: LiteralNode): AnalysisResult {
    let typeName: string;
    
    switch (node.valueType) {
      case 'string':
        typeName = 'String';
        break;
      case 'number':
        typeName = Number.isInteger(node.value) ? 'Integer' : 'Decimal';
        break;
      case 'boolean':
        typeName = 'Boolean';
        break;
      case 'date':
        typeName = 'Date';
        break;
      case 'time':
        typeName = 'Time';
        break;
      case 'datetime':
        typeName = 'DateTime';
        break;
      case 'null':
        // null is empty collection
        return { type: undefined, isSingleton: false };
      default:
        typeName = 'Any';
    }
    
    return {
      type: this.modelProvider.resolveType(typeName),
      isSingleton: true
    };
  }
  
  private analyzeIdentifier(
    node: IdentifierNode, 
    inputType: TypeRef | undefined,
    inputIsSingleton: boolean
  ): AnalysisResult {
    if (!inputType) {
      // No input type - might be a type name or error
      const typeRef = this.modelProvider.resolveType(node.name);
      if (typeRef) {
        return { type: typeRef, isSingleton: true };
      }
      
      this.addDiagnostic('error', `Cannot navigate property '${node.name}' on empty input`, node.position);
      return { type: this.modelProvider.resolveType('Any'), isSingleton: false };
    }
    
    // Property navigation
    const propInfo = this.modelProvider.getPropertyType(inputType, node.name);
    
    if (!propInfo) {
      this.addDiagnostic(
        this.mode === AnalysisMode.Strict ? 'error' : 'warning',
        `Property '${node.name}' not found on type '${this.modelProvider.getTypeName(inputType)}'`,
        node.position
      );
      return { type: this.modelProvider.resolveType('Any'), isSingleton: false };
    }
    
    // If input is collection, result is always collection (flattening)
    return {
      type: propInfo.type,
      isSingleton: inputIsSingleton && propInfo.isSingleton
    };
  }
  
  private analyzeTypeOrIdentifier(
    node: TypeOrIdentifierNode,
    inputType: TypeRef | undefined,
    inputIsSingleton: boolean
  ): AnalysisResult {
    // First try as type reference
    const typeRef = this.modelProvider.resolveType(node.name);
    if (typeRef && !inputType) {
      return { type: typeRef, isSingleton: true };
    }
    
    // Otherwise treat as identifier
    return this.analyzeIdentifier(node as any, inputType, inputIsSingleton);
  }
  
  private analyzeVariable(node: VariableNode): AnalysisResult {
    // For now, assume variables can be Any type
    // In a real implementation, we'd track variable types in context
    return {
      type: this.modelProvider.resolveType('Any'),
      isSingleton: node.name === '$index' // $index is always singleton
    };
  }
  
  private analyzeBinary(
    node: BinaryNode,
    inputType: TypeRef | undefined,
    inputIsSingleton: boolean
  ): AnalysisResult {
    // Special handling for dot operator - it's a pipeline
    if (node.operator === TokenType.DOT) {
      // Analyze left with original input
      const leftResult = this.analyzeNode(node.left, inputType, inputIsSingleton);
      
      // Analyze right with left's output as input
      const rightResult = this.analyzeNode(node.right, leftResult.type, leftResult.isSingleton);
      
      return rightResult;
    }
    
    // For other operators, analyze both sides
    const leftResult = this.analyzeNode(node.left, inputType, inputIsSingleton);
    const rightResult = this.analyzeNode(node.right, inputType, inputIsSingleton);
    
    // Get operator signature
    const operatorSignature = this.getOperatorSignature(node.operator);
    
    if (!operatorSignature) {
      this.addDiagnostic('error', `Unknown operator: ${node.operator}`, node.position);
      return { type: this.modelProvider.resolveType('Any'), isSingleton: true };
    }
    
    // Check singleton requirements
    if (operatorSignature.requiresLeftSingleton && !leftResult.isSingleton) {
      this.addDiagnostic('error', `Left side of ${node.operator} must be singleton`, node.position);
    }
    if (operatorSignature.requiresRightSingleton && !rightResult.isSingleton) {
      this.addDiagnostic('error', `Right side of ${node.operator} must be singleton`, node.position);
    }
    
    // Determine result type
    let resultType: TypeRef | undefined;
    
    if (operatorSignature.returnType) {
      resultType = operatorSignature.returnType(leftResult.type, rightResult.type, this.modelProvider);
    } else if (operatorSignature.acceptedTypes === 'any') {
      resultType = this.modelProvider.resolveType('Boolean'); // For comparisons
    } else if (Array.isArray(operatorSignature.acceptedTypes)) {
      // Find matching type combination
      const leftTypeName = leftResult.type ? this.modelProvider.getTypeName(leftResult.type) : 'Any';
      const rightTypeName = rightResult.type ? this.modelProvider.getTypeName(rightResult.type) : 'Any';
      
      const match = operatorSignature.acceptedTypes.find(
        t => t.left === leftTypeName && t.right === rightTypeName
      );
      
      if (match) {
        resultType = this.modelProvider.resolveType(match.result);
      } else {
        this.addDiagnostic(
          'error',
          `Operator ${node.operator} cannot be applied to types ${leftTypeName} and ${rightTypeName}`,
          node.position
        );
        resultType = this.modelProvider.resolveType('Any');
      }
    }
    
    // Determine result cardinality
    const resultIsSingleton = typeof operatorSignature.returnsSingleton === 'function'
      ? operatorSignature.returnsSingleton(leftResult.isSingleton, rightResult.isSingleton)
      : operatorSignature.returnsSingleton;
    
    return { type: resultType, isSingleton: resultIsSingleton };
  }
  
  private analyzeUnary(
    node: UnaryNode,
    inputType: TypeRef | undefined,
    inputIsSingleton: boolean
  ): AnalysisResult {
    const operandResult = this.analyzeNode(node.operand, inputType, inputIsSingleton);
    
    switch (node.operator) {
      case TokenType.NOT:
        return {
          type: this.modelProvider.resolveType('Boolean'),
          isSingleton: operandResult.isSingleton
        };
      
      case TokenType.PLUS:
      case TokenType.MINUS:
        // Check numeric type
        if (operandResult.type) {
          const typeName = this.modelProvider.getTypeName(operandResult.type);
          if (typeName !== 'Integer' && typeName !== 'Decimal') {
            this.addDiagnostic('error', `Unary ${node.operator} requires numeric type`, node.position);
          }
        }
        return operandResult;
      
      default:
        this.addDiagnostic('error', `Unknown unary operator: ${node.operator}`, node.position);
        return { type: this.modelProvider.resolveType('Any'), isSingleton: true };
    }
  }
  
  private analyzeFunction(
    node: FunctionNode,
    inputType: TypeRef | undefined,
    inputIsSingleton: boolean
  ): AnalysisResult {
    // Extract function name
    let funcName: string;
    if (node.name.type === NodeType.Identifier) {
      funcName = (node.name as IdentifierNode).name;
    } else {
      this.addDiagnostic('error', 'Complex function names not yet supported in type analysis', node.position);
      return { type: this.modelProvider.resolveType('Any'), isSingleton: false };
    }
    
    // Get function signature
    const signature = functionSignatures.get(funcName);
    
    if (!signature) {
      this.addDiagnostic('error', `Unknown function: ${funcName}`, node.position);
      return { type: this.modelProvider.resolveType('Any'), isSingleton: false };
    }
    
    // Check singleton requirement
    if (signature.requiresSingleton && !inputIsSingleton) {
      this.addDiagnostic('error', `Function ${funcName} requires singleton input`, node.position);
    }
    
    // Check input type requirement
    if (signature.requiresInputType && inputType) {
      if (signature.requiresInputType === 'numeric') {
        // Special handling for numeric types
        const numericTypes = ['integer', 'decimal', 'unsignedInt', 'positiveInt'];
        const inputTypeName = this.modelProvider.getTypeName(inputType).toLowerCase();
        if (!numericTypes.includes(inputTypeName)) {
          this.addDiagnostic(
            'error', 
            `Function ${funcName} requires numeric input, but got ${this.modelProvider.getTypeName(inputType)}`, 
            node.position
          );
        }
      } else {
        // Regular type check
        const requiredType = this.modelProvider.resolveType(signature.requiresInputType);
        if (requiredType && !this.modelProvider.isAssignable(inputType, requiredType)) {
          const actualTypeName = this.modelProvider.getTypeName(inputType);
          this.addDiagnostic(
            'error', 
            `Function ${funcName} requires ${signature.requiresInputType} input, but got ${actualTypeName}`, 
            node.position
          );
        }
      }
    }
    
    // Analyze parameters
    const paramTypes: (TypeRef | undefined)[] = [];
    const paramAreSingleton: boolean[] = [];
    
    for (let i = 0; i < node.arguments.length; i++) {
      const param = node.arguments[i];
      const paramDef = signature.parameters?.[i];
      
      if (!param) continue;
      
      if (paramDef?.type === 'expression') {
        // For expression parameters, analyze in context of input
        const paramResult = this.analyzeNode(param, inputType, true); // Each item context
        paramTypes.push(paramResult.type);
        paramAreSingleton.push(paramResult.isSingleton);
      } else {
        // Regular parameters
        const paramResult = this.analyzeNode(param, inputType, inputIsSingleton);
        paramTypes.push(paramResult.type);
        paramAreSingleton.push(paramResult.isSingleton);
        
        // Check singleton requirement
        if (paramDef?.requiresSingleton && !paramResult.isSingleton) {
          this.addDiagnostic('error', `Parameter ${i + 1} of ${funcName} must be singleton`, param.position);
        }
      }
    }
    
    // Calculate return type
    const returnType = signature.returnType(inputType, paramTypes, this.modelProvider);
    const returnIsSingleton = signature.returnsSingleton(inputIsSingleton, paramAreSingleton);
    
    return { type: returnType, isSingleton: returnIsSingleton };
  }
  
  private analyzeCollection(
    node: CollectionNode,
    inputType: TypeRef | undefined,
    inputIsSingleton: boolean
  ): AnalysisResult {
    if (node.elements.length === 0) {
      // Empty collection
      return { type: undefined, isSingleton: false };
    }
    
    // Analyze all elements
    const elementTypes: TypeRef[] = [];
    
    for (const element of node.elements) {
      const result = this.analyzeNode(element, inputType, inputIsSingleton);
      if (result.type) {
        elementTypes.push(result.type);
      }
    }
    
    // Get common type
    const commonType = this.modelProvider.getCommonType?.(elementTypes) || this.modelProvider.resolveType('Any');
    
    return { type: commonType, isSingleton: false };
  }
  
  private analyzeIndex(
    node: IndexNode,
    inputType: TypeRef | undefined,
    inputIsSingleton: boolean
  ): AnalysisResult {
    // Analyze the expression being indexed
    const exprResult = this.analyzeNode(node.expression, inputType, inputIsSingleton);
    
    // Analyze the index expression
    const indexResult = this.analyzeNode(node.index, exprResult.type, exprResult.isSingleton);
    
    // Index must be Integer
    if (indexResult.type) {
      const typeName = this.modelProvider.getTypeName(indexResult.type);
      if (typeName !== 'Integer') {
        this.addDiagnostic('error', 'Index must be an integer', node.position);
      }
    }
    
    if (!indexResult.isSingleton) {
      this.addDiagnostic('error', 'Index must be singleton', node.position);
    }
    
    // Result is singleton of the expression type
    return { type: exprResult.type, isSingleton: true };
  }
  
  private analyzeUnion(
    node: UnionNode,
    inputType: TypeRef | undefined,
    inputIsSingleton: boolean
  ): AnalysisResult {
    const types: TypeRef[] = [];
    
    for (const operand of node.operands) {
      const result = this.analyzeNode(operand, inputType, inputIsSingleton);
      if (result.type) {
        types.push(result.type);
      }
    }
    
    const commonType = this.modelProvider.getCommonType?.(types) || this.modelProvider.resolveType('Any');
    
    return { type: commonType, isSingleton: false };
  }
  
  private analyzeMembershipTest(
    node: MembershipTestNode,
    inputType: TypeRef | undefined,
    inputIsSingleton: boolean
  ): AnalysisResult {
    // Analyze the expression
    const exprResult = this.analyzeNode(node.expression, inputType, inputIsSingleton);
    
    // Result is Boolean with same cardinality as input
    return {
      type: this.modelProvider.resolveType('Boolean'),
      isSingleton: exprResult.isSingleton
    };
  }
  
  private analyzeTypeCast(
    node: TypeCastNode,
    inputType: TypeRef | undefined,
    inputIsSingleton: boolean
  ): AnalysisResult {
    // Analyze the expression
    const exprResult = this.analyzeNode(node.expression, inputType, inputIsSingleton);
    
    // Resolve target type
    const targetType = this.modelProvider.resolveType(node.targetType);
    
    if (!targetType) {
      this.addDiagnostic('error', `Unknown type: ${node.targetType}`, node.position);
      return { type: this.modelProvider.resolveType('Any'), isSingleton: exprResult.isSingleton };
    }
    
    // Result has target type with same cardinality
    return {
      type: targetType,
      isSingleton: exprResult.isSingleton
    };
  }
  
  private analyzeTypeReference(node: TypeReferenceNode): AnalysisResult {
    const typeRef = this.modelProvider.resolveType(node.typeName);
    
    if (!typeRef) {
      this.addDiagnostic('error', `Unknown type: ${node.typeName}`, node.position);
      return { type: this.modelProvider.resolveType('Any'), isSingleton: true };
    }
    
    return { type: typeRef, isSingleton: true };
  }
  
  private getOperatorSignature(operator: TokenType) {
    switch (operator) {
      // Arithmetic
      case TokenType.PLUS:
      case TokenType.MINUS:
      case TokenType.STAR:
      case TokenType.SLASH:
      case TokenType.DIV:
      case TokenType.MOD:
        return operatorSignatures.arithmeticOperatorSignature;
      
      // String
      case TokenType.CONCAT:
        return operatorSignatures.concatOperatorSignature;
      
      // Comparison
      case TokenType.EQ:
      case TokenType.NEQ:
      case TokenType.LT:
      case TokenType.GT:
      case TokenType.LTE:
      case TokenType.GTE:
        return operatorSignatures.comparisonOperatorSignature;
      
      // Logical
      case TokenType.AND:
      case TokenType.OR:
      case TokenType.XOR:
      case TokenType.IMPLIES:
        return operatorSignatures.logicalOperatorSignature;
      
      // Membership
      case TokenType.IN:
      case TokenType.CONTAINS:
        return operatorSignatures.membershipOperatorSignature;
      
      // Navigation
      case TokenType.DOT:
        return operatorSignatures.dotOperatorSignature;
      
      // Union
      case TokenType.PIPE:
        return operatorSignatures.unionOperatorSignature;
      
      default:
        return undefined;
    }
  }
  
  private addDiagnostic(
    severity: 'error' | 'warning',
    message: string,
    position?: import('../parser/ast').Position
  ) {
    this.diagnostics.push({ severity, message, position });
  }
}

/**
 * Helper function to analyze a FHIRPath expression
 */
export function analyzeFHIRPath(
  expression: string | ASTNode,
  modelProvider: ModelProvider,
  inputType?: TypeRef,
  mode: AnalysisMode = AnalysisMode.Lenient
): TypeAnalysisResult {
  // Parse if string
  const ast = typeof expression === 'string'
    ? require('../parser').parse(expression)
    : expression;
  
  // Create analyzer and analyze
  const analyzer = new TypeAnalyzer(modelProvider, mode);
  return analyzer.analyze(ast, inputType);
}