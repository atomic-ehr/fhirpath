import type { Token } from '../lexer/token';
import { TokenType } from '../lexer/token';
import type { ASTNode } from './ast';
import { ASTFactory } from './ast-factory';
import type { TokenNavigator } from './token-navigator';
import { ParseError } from './parse-error';
import { ErrorCode } from '../api/errors';

/**
 * Handles parsing of collections and parenthesized expressions
 */
export class CollectionParser {
  /**
   * Parse collection literal {...}
   */
  static parseCollection(
    navigator: TokenNavigator,
    parseExpression: () => ASTNode,
    errorCallback: (msg: string, code?: ErrorCode) => ParseError,
    errorRecovery: boolean,
    createErrorNode: (token: Token, msg: string) => ASTNode
  ): ASTNode {
    const lbrace = navigator.previous();
    const elements: ASTNode[] = [];
    
    // Empty collection
    if (navigator.match(TokenType.RBRACE)) {
      return ASTFactory.createCollection([], lbrace.position);
    }
    
    // Parse elements
    do {
      // Check for trailing comma
      if (navigator.check(TokenType.RBRACE)) {
        break;
      }
      
      try {
        elements.push(parseExpression());
      } catch (error) {
        if (error instanceof ParseError && errorRecovery) {
          elements.push(createErrorNode(error.token, error.message));
          // Skip to next comma or closing brace
          navigator.skipWhile(token => 
            token.type !== TokenType.COMMA && 
            token.type !== TokenType.RBRACE
          );
        } else {
          throw error;
        }
      }
    } while (navigator.match(TokenType.COMMA));
    
    // Check for trailing comma error
    if (elements.length > 0 && navigator.previous().type === TokenType.COMMA) {
      throw errorCallback("Expected expression after ','", ErrorCode.EXPECTED_EXPRESSION);
    }
    
    navigator.consume(TokenType.RBRACE, () => 
      errorCallback("Expected '}' after collection elements", ErrorCode.UNCLOSED_BRACE)
    );
    
    return ASTFactory.createCollection(elements, lbrace.position);
  }
  
  /**
   * Parse parenthesized expression
   */
  static parseParenthesized(
    navigator: TokenNavigator,
    parseExpression: () => ASTNode,
    errorCallback: (msg: string, code?: ErrorCode) => ParseError
  ): ASTNode {
    const lparen = navigator.previous();
    
    // Handle empty parentheses ()
    if (navigator.check(TokenType.RPAREN)) {
      throw errorCallback("Empty parentheses are not allowed", ErrorCode.EXPECTED_EXPRESSION);
    }
    
    const expr = parseExpression();
    
    navigator.consume(TokenType.RPAREN, () => 
      errorCallback("Expected ')' after expression", ErrorCode.UNCLOSED_PARENTHESIS)
    );
    
    return expr;
  }
}