import type { Token } from '../lexer/token';
import { TokenType } from '../lexer/token';
import type { ASTNode, IdentifierNode, FunctionNode, TypeReferenceNode } from './ast';
import { NodeType } from './ast';
import { ASTFactory } from './ast-factory';
import type { TokenNavigator } from './token-navigator';
import { ErrorCode } from '../api/errors';

/**
 * Handles parsing of special FHIRPath constructs
 */
export class SpecialConstructs {
  /**
   * Parse special function syntax like ofType(Type)
   */
  static parseOfType(navigator: TokenNavigator, errorCallback: (msg: string) => Error): ASTNode {
    const ofTypeToken = navigator.previous();
    
    // Expect (
    navigator.consume(TokenType.LPAREN, () => 
      errorCallback("Expected '(' after 'ofType'")
    );
    
    // Expect type name
    const typeToken = navigator.consume(TokenType.IDENTIFIER, () => 
      errorCallback("Expected type name in ofType()")
    );
    
    // Expect )
    navigator.consume(TokenType.RPAREN, () => 
      errorCallback("Expected ')' after type name")
    );
    
    return ASTFactory.createFunction(
      ASTFactory.createIdentifier('ofType', ofTypeToken.position),
      [ASTFactory.createTypeReference(typeToken.value, typeToken.position)],
      ofTypeToken.position
    );
  }

  /**
   * Parse type operators (is/as) with their special syntax
   */
  static parseTypeOperator(
    navigator: TokenNavigator, 
    left: ASTNode,
    op: Token,
    errorCallback: (msg: string, code?: ErrorCode) => Error
  ): ASTNode {
    // Type name can be either a simple identifier or in parentheses (for is() function syntax)
    let typeName: string;
    
    if (navigator.check(TokenType.LPAREN)) {
      // Handle is(TypeName) syntax
      navigator.advance(); // consume (
      const typeToken = navigator.consume(TokenType.IDENTIFIER, () => 
        errorCallback("Expected type name", ErrorCode.EXPECTED_IDENTIFIER)
      );
      typeName = typeToken.value;
      navigator.consume(TokenType.RPAREN, () => 
        errorCallback("Expected ')' after type name", ErrorCode.UNCLOSED_PARENTHESIS)
      );
    } else {
      // Regular is TypeName syntax
      const typeToken = navigator.consume(TokenType.IDENTIFIER, () => 
        errorCallback(`Expected type name after '${op.value}'`, ErrorCode.EXPECTED_IDENTIFIER)
      );
      typeName = typeToken.value;
    }
    
    if (op.type === TokenType.IS) {
      return ASTFactory.createMembershipTest(left, typeName, op.position);
    } else {
      return ASTFactory.createTypeCast(left, typeName, op.position);
    }
  }

  /**
   * Parse union operator which can chain multiple operands
   */
  static parseUnion(left: ASTNode, precedence: number, parseExpression: (p: number) => ASTNode): ASTNode {
    const right = parseExpression(precedence + 1);
    
    // If left is already a union, add to it
    if (left.type === NodeType.Union) {
      (left as any).operands.push(right);
      return left;
    }
    
    // Create new union node
    return ASTFactory.createUnion([left, right], (left as any).position);
  }

  /**
   * Check for common mistakes like == instead of =
   */
  static checkDoubleEquals(
    navigator: TokenNavigator,
    op: Token,
    diagnosticsCallback?: (start: Token, end: Token, message: string, code: ErrorCode) => void
  ): void {
    if (op.type === TokenType.EQ && navigator.check(TokenType.EQ)) {
      const secondEq = navigator.peek();
      if (diagnosticsCallback) {
        diagnosticsCallback(
          op,
          secondEq,
          "'==' is not valid in FHIRPath, use '=' for equality",
          ErrorCode.INVALID_OPERATOR
        );
        // Skip the extra = to avoid cascading errors
        navigator.advance();
      }
    }
  }

  /**
   * Check for double dot error
   */
  static checkDoubleDot(
    navigator: TokenNavigator,
    firstDot: Token,
    markPartial: () => void,
    diagnosticsCallback?: (start: Token, end: Token, message: string, code: ErrorCode) => void
  ): void {
    if (navigator.check(TokenType.DOT)) {
      const secondDot = navigator.peek();
      if (diagnosticsCallback) {
        diagnosticsCallback(
          firstDot,
          secondDot,
          "Invalid '..' operator - use a single '.' for navigation",
          ErrorCode.INVALID_OPERATOR
        );
      }
      
      // Skip the extra dot to avoid cascading errors
      navigator.advance();
      markPartial();
    }
  }
}