import { Lexer, TokenType } from './lexer';
import type { Token, LexerOptions } from './lexer';
import { Registry, defaultRegistry } from './registry';
import { NodeType } from './parser-base';
import type { Position, BaseASTNode } from './parser-base';

/**
 * Abstract base parser that integrates with the registry
 * Subclasses must implement node creation and error handling
 */
export abstract class RegistryBasedParser<TNode extends { type: NodeType; position?: Position; offset?: number } = BaseASTNode> {
  protected lexer: Lexer;
  protected tokens: Token[] = [];
  protected current = 0;
  protected registry: Registry;
  
  constructor(input: string, lexerOptions?: LexerOptions, registry?: Registry) {
    this.lexer = new Lexer(input, lexerOptions);
    this.tokens = this.lexer.tokenize();
    this.registry = registry || defaultRegistry;
  }
  
  // Abstract methods that subclasses must implement
  protected abstract createIdentifierNode(name: string, token: Token): TNode;
  protected abstract createLiteralNode(value: any, valueType: 'string' | 'number' | 'boolean' | 'date' | 'time' | 'datetime' | 'null', token: Token): TNode;
  protected abstract createBinaryNode(token: Token, left: TNode, right: TNode): TNode;
  protected abstract createUnaryNode(token: Token, operand: TNode): TNode;
  protected abstract createFunctionNode(name: TNode, args: TNode[], position: Position): TNode;
  protected abstract createVariableNode(name: string, token: Token): TNode;
  protected abstract createIndexNode(expression: TNode, index: TNode, position: Position): TNode;
  protected abstract createMembershipTestNode(expression: TNode, targetType: string, position: Position): TNode;
  protected abstract createTypeCastNode(expression: TNode, targetType: string, position: Position): TNode;
  protected abstract createCollectionNode(elements: TNode[], position: Position): TNode;
  protected abstract handleError(message: string, token?: Token): never | TNode;
  
  // Use registry for operator checks
  protected isBinaryOperator(type: TokenType): boolean {
    return this.registry.isBinaryOperator(type);
  }
  
  protected isUnaryOperator(type: TokenType): boolean {
    return this.registry.isUnaryOperator(type);
  }
  
  protected getPrecedence(type: TokenType): number {
    const precedence = this.registry.getPrecedence(type);
    if (precedence >= 0) return precedence;
    
    // Special handling for non-operator tokens that have precedence
    switch (type) {
      case TokenType.DOT:
      case TokenType.LBRACKET:
      case TokenType.LPAREN:
        return 100; // Highest precedence for postfix operations
      default:
        return -1;
    }
  }
  
  protected getAssociativity(type: TokenType): 'left' | 'right' {
    const associativity = this.registry.getAssociativity(type);
    return associativity || 'left'; // Default to left associative
  }
  
  // Rest of the parser implementation would go here...
  // (We can copy most of it from parser-base.ts but using registry methods)
}