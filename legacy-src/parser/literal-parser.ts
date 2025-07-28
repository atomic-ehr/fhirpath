import type { Token } from '../lexer/token';
import { TokenType } from '../lexer/token';
import type { ASTNode, LiteralNode, VariableNode } from './ast';
import { ASTFactory } from './ast-factory';
import type { TokenNavigator } from './token-navigator';

/**
 * Handles parsing of literals and variables
 */
export class LiteralParser {
  /**
   * Parse all types of literals
   */
  static parseLiteral(navigator: TokenNavigator): ASTNode | null {
    // Handle registry-based literals
    if (navigator.match(TokenType.LITERAL)) {
      const token = navigator.previous();
      return ASTFactory.createLiteral(
        token.literalValue ?? token.value,
        ASTFactory.inferLiteralType(token.literalValue ?? token.value),
        token.position,
        token.value,
        token.operation
      );
    }
    
    // Handle legacy literals
    if (navigator.match(TokenType.NUMBER)) {
      const token = navigator.previous();
      return ASTFactory.createLiteral(
        parseFloat(token.value),
        'number',
        token.position
      );
    }
    
    if (navigator.match(TokenType.STRING)) {
      const token = navigator.previous();
      return ASTFactory.createLiteral(
        token.value,
        'string',
        token.position
      );
    }
    
    if (navigator.match(TokenType.TRUE, TokenType.FALSE)) {
      const token = navigator.previous();
      return ASTFactory.createLiteral(
        token.type === TokenType.TRUE,
        'boolean',
        token.position
      );
    }
    
    if (navigator.match(TokenType.NULL)) {
      const token = navigator.previous();
      return ASTFactory.createLiteral(
        null,
        'null',
        token.position
      );
    }
    
    // Date/time literals
    if (navigator.match(TokenType.DATE, TokenType.TIME, TokenType.DATETIME)) {
      const token = navigator.previous();
      return ASTFactory.createLiteral(
        token.value,
        token.type === TokenType.DATE ? 'date' : 
        token.type === TokenType.TIME ? 'time' : 'datetime',
        token.position
      );
    }
    
    return null;
  }
  
  /**
   * Parse special variables
   */
  static parseVariable(navigator: TokenNavigator): ASTNode | null {
    if (navigator.match(TokenType.THIS)) {
      return ASTFactory.createVariable('$this', true, navigator.previous().position);
    }
    
    if (navigator.match(TokenType.INDEX)) {
      return ASTFactory.createVariable('$index', true, navigator.previous().position);
    }
    
    if (navigator.match(TokenType.TOTAL)) {
      return ASTFactory.createVariable('$total', true, navigator.previous().position);
    }
    
    if (navigator.match(TokenType.ENV_VAR)) {
      const token = navigator.previous();
      return ASTFactory.createVariable(token.value, false, token.position);
    }
    
    // Variables starting with $ or % are handled by ENV_VAR token type
    
    return null;
  }
}