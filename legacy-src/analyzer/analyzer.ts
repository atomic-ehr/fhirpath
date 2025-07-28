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
  TypeOrIdentifierNode,
  Position
} from '../parser/ast';
import { NodeType } from '../parser/ast';
import { TokenType } from '../lexer/token';
import { parseForEvaluation } from '../api';
import type { 
  ModelProvider, 
  TypeRef, 
  TypeAnalysisResult, 
  TypeDiagnostic
} from './types';
import { AnalysisMode } from './types';
import { Registry } from '../registry';
import type { TypeInfo as RegistryTypeInfo, Analyzer as IAnalyzer } from '../registry/types';

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
export class TypeAnalyzer implements IAnalyzer {
  private diagnostics: TypeDiagnostic[] = [];
  private currentPosition?: Position;
  
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
    [NodeType.Error]: this.analyzeError.bind(this),
    [NodeType.Incomplete]: this.analyzeIncomplete.bind(this),
  };
  
  constructor(
    private modelProvider: ModelProvider,
    private mode: AnalysisMode = AnalysisMode.Lenient
  ) {}
  
  // IAnalyzer interface implementation
  error(message: string): void {
    this.addDiagnostic('error', message, this.currentPosition);
  }
  
  warning(message: string): void {
    this.addDiagnostic('warning', message, this.currentPosition);
  }
  
  resolveType(typeName: string): TypeRef {
    return this.modelProvider.resolveType(typeName) || this.modelProvider.resolveType('Any')!;
  }
  
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
    // If literal has operation reference from parser
    if (node.operation && node.operation.kind === 'literal') {
      const inputInfo: RegistryTypeInfo = { type: this.resolveType('Any'), isSingleton: true };
      this.currentPosition = node.position;
      const result = node.operation.analyze(this, inputInfo, []);
      return {
        type: result.type,
        isSingleton: result.isSingleton
      };
    }
    
    // Fallback for legacy literals
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
      const leftResult = this.analyzeNode(node.left, inputType, inputIsSingleton);
      const rightResult = this.analyzeNode(node.right, leftResult.type, leftResult.isSingleton);
      return rightResult;
    }
    
    // Get operation from registry
    const operation = node.operation || Registry.getByToken(node.operator);
    if (!operation || operation.kind !== 'operator') {
      this.addDiagnostic('error', `Unknown operator: ${node.operator}`, node.position);
      return { type: this.modelProvider.resolveType('Any'), isSingleton: true };
    }
    
    // Analyze operands
    const leftResult = this.analyzeNode(node.left, inputType, inputIsSingleton);
    const rightResult = this.analyzeNode(node.right, inputType, inputIsSingleton);
    
    // Convert to registry TypeInfo format
    const inputInfo: RegistryTypeInfo = { type: inputType || this.resolveType('Any'), isSingleton: inputIsSingleton };
    const leftInfo: RegistryTypeInfo = { type: leftResult.type || this.resolveType('Any'), isSingleton: leftResult.isSingleton };
    const rightInfo: RegistryTypeInfo = { type: rightResult.type || this.resolveType('Any'), isSingleton: rightResult.isSingleton };
    
    // Use operation's analyze method
    this.currentPosition = node.position;
    const result = operation.analyze(this, inputInfo, [leftInfo, rightInfo]);
    
    return {
      type: result.type,
      isSingleton: result.isSingleton
    };
  }
  
  private analyzeUnary(
    node: UnaryNode,
    inputType: TypeRef | undefined,
    inputIsSingleton: boolean
  ): AnalysisResult {
    // Get operation from registry
    const operation = node.operation || Registry.getByToken(node.operator);
    if (!operation || operation.kind !== 'operator') {
      this.addDiagnostic('error', `Unknown unary operator: ${node.operator}`, node.position);
      return { type: this.modelProvider.resolveType('Any'), isSingleton: true };
    }
    
    // Analyze operand
    const operandResult = this.analyzeNode(node.operand, inputType, inputIsSingleton);
    
    // Convert to registry TypeInfo format
    const inputInfo: RegistryTypeInfo = { type: inputType || this.resolveType('Any'), isSingleton: inputIsSingleton };
    const operandInfo: RegistryTypeInfo = { type: operandResult.type || this.resolveType('Any'), isSingleton: operandResult.isSingleton };
    
    // Use operation's analyze method
    this.currentPosition = node.position;
    const result = operation.analyze(this, inputInfo, [operandInfo]);
    
    return {
      type: result.type,
      isSingleton: result.isSingleton
    };
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
      this.addDiagnostic('error', 'Complex function names not yet supported', node.position);
      return { type: this.modelProvider.resolveType('Any'), isSingleton: false };
    }
    
    // Get function from registry
    const operation = Registry.get(funcName);
    if (!operation || operation.kind !== 'function') {
      this.addDiagnostic('error', `Unknown function: ${funcName}`, node.position);
      return { type: this.modelProvider.resolveType('Any'), isSingleton: false };
    }
    
    // Analyze arguments
    const argResults = node.arguments.map(arg => this.analyzeNode(arg, inputType, inputIsSingleton));
    
    // Convert to registry TypeInfo format
    const inputInfo: RegistryTypeInfo = { type: inputType || this.resolveType('Any'), isSingleton: inputIsSingleton };
    const argInfos: RegistryTypeInfo[] = argResults.map(r => ({
      type: r.type || this.resolveType('Any'),
      isSingleton: r.isSingleton
    }));
    
    // Use operation's analyze method
    this.currentPosition = node.position;
    const result = operation.analyze(this, inputInfo, argInfos);
    
    return {
      type: result.type,
      isSingleton: result.isSingleton
    };
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
  
  private analyzeError(node: ASTNode): AnalysisResult {
    // Error nodes don't have meaningful types
    return { type: this.modelProvider.resolveType('Any'), isSingleton: false };
  }
  
  private analyzeIncomplete(node: ASTNode): AnalysisResult {
    // Incomplete nodes don't have meaningful types
    return { type: this.modelProvider.resolveType('Any'), isSingleton: false };
  }
  
  private addDiagnostic(
    severity: 'error' | 'warning',
    message: string,
    position?: Position
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
    ? parseForEvaluation(expression)
    : expression;
  
  // Create analyzer and analyze
  const analyzer = new TypeAnalyzer(modelProvider, mode);
  return analyzer.analyze(ast, inputType);
}