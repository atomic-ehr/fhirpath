import type { ASTNode, BinaryNode, IdentifierNode, LiteralNode, FunctionNode, Diagnostic, AnalysisResult, UnaryNode, IndexNode, CollectionNode, MembershipTestNode, TypeCastNode, Range, Position, TypeInfo, ModelProvider } from './types';
import { NodeType, DiagnosticSeverity, isErrorNode } from './types';
import { registry } from './registry';
import { TypeAnalyzer } from './type-analyzer';

export class Analyzer {
  private diagnostics: Diagnostic[] = [];
  private variables: Set<string> = new Set(['$this', '$index', '$total']);
  private typeAnalyzer: TypeAnalyzer;

  constructor(modelProvider?: ModelProvider) {
    this.typeAnalyzer = new TypeAnalyzer(modelProvider);
  }

  analyze(ast: ASTNode, userVariables?: Record<string, any>, inputType?: TypeInfo): AnalysisResult {
    this.diagnostics = [];
    
    if (userVariables) {
      Object.keys(userVariables).forEach(name => this.variables.add(name));
    }
    
    // Annotate AST with type information
    this.typeAnalyzer.annotateAST(ast, inputType);
    
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
    // All nodes now have range property
    const range: Range = node.range;

    this.diagnostics.push({
      range,
      severity,
      message,
      code,
      source: 'fhirpath-analyzer'
    });
  }
}