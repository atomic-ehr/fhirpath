import { TokenType, type Token } from '../lexer/token';
import type { SourceMapper } from './source-mapper';
import type { DiagnosticCollector } from './diagnostics';
import { ErrorCode } from '../api/errors';

export enum ParseContext {
  Expression = 'Expression',
  FunctionCall = 'FunctionCall',
  IndexExpression = 'IndexExpression',
  BinaryExpression = 'BinaryExpression',
  UnaryExpression = 'UnaryExpression',
  CollectionLiteral = 'CollectionLiteral',
  TypeCast = 'TypeCast',
  MembershipTest = 'MembershipTest'
}

export class ContextualErrorReporter {
  constructor(
    private sourceMapper: SourceMapper,
    private collector: DiagnosticCollector
  ) {}
  
  reportExpectedToken(
    expected: TokenType[],
    actual: Token,
    context: ParseContext
  ): void {
    const message = this.buildContextualMessage(expected, actual, context);
    const range = this.sourceMapper.tokenToRange(actual);
    
    this.collector.addError(range, message, ErrorCode.UNEXPECTED_TOKEN);
  }
  
  reportUnclosedDelimiter(openToken: Token, expectedClose: string): void {
    const range = this.sourceMapper.tokenToRange(openToken);
    let message: string;
    let code: ErrorCode;
    
    switch (expectedClose) {
      case ')':
        code = ErrorCode.UNCLOSED_PARENTHESIS;
        message = "Unclosed parenthesis - missing ')' to close function call";
        break;
      case ']':
        code = ErrorCode.UNCLOSED_BRACKET;
        message = "Expected ']' after index expression";
        break;
      case '}':
        code = ErrorCode.UNCLOSED_BRACE;
        message = "Expected '}' to close collection literal";
        break;
      default:
        code = ErrorCode.SYNTAX_ERROR;
        message = `Unclosed delimiter - missing '${expectedClose}' to close '${openToken.value}'`;
    }
    
    this.collector.addError(range, message, code);
  }
  
  reportInvalidOperator(operator: Token, message: string): void {
    const range = this.sourceMapper.tokenToRange(operator);
    this.collector.addError(range, message, ErrorCode.INVALID_OPERATOR);
  }
  
  reportMissingExpression(token: Token, context: ParseContext): void {
    const range = this.sourceMapper.tokenToRange(token);
    const contextDesc = this.getContextDescription(context);
    const message = `Expected expression ${contextDesc}`;
    
    this.collector.addError(range, message, ErrorCode.EXPECTED_EXPRESSION);
  }
  
  reportMissingIdentifier(token: Token, context: string): void {
    const range = this.sourceMapper.tokenToRange(token);
    const message = `Expected identifier ${context}`;
    
    this.collector.addError(range, message, ErrorCode.EXPECTED_IDENTIFIER);
  }
  
  reportMissingArguments(functionName: string, token: Token): void {
    const range = this.sourceMapper.tokenToRange(token);
    const message = `Function '${functionName}' requires arguments`;
    
    this.collector.addError(range, message, ErrorCode.MISSING_ARGUMENTS);
  }
  
  private buildContextualMessage(
    expected: TokenType[],
    actual: Token,
    context: ParseContext
  ): string {
    const expectedDesc = this.describeTokens(expected);
    const actualDesc = this.describeToken(actual);
    
    switch (context) {
      case ParseContext.FunctionCall:
        return `Expected ${expectedDesc} in function call, found ${actualDesc}`;
      case ParseContext.IndexExpression:
        return `Expected ${expectedDesc} in index expression, found ${actualDesc}`;
      case ParseContext.BinaryExpression:
        return `Expected ${expectedDesc} after operator, found ${actualDesc}`;
      case ParseContext.CollectionLiteral:
        return `Expected ${expectedDesc} in collection literal, found ${actualDesc}`;
      case ParseContext.TypeCast:
        return `Expected ${expectedDesc} after 'as', found ${actualDesc}`;
      case ParseContext.MembershipTest:
        return `Expected ${expectedDesc} after 'is', found ${actualDesc}`;
      default:
        return `Expected ${expectedDesc}, found ${actualDesc}`;
    }
  }
  
  private getContextDescription(context: ParseContext): string {
    switch (context) {
      case ParseContext.FunctionCall:
        return "in function call";
      case ParseContext.IndexExpression:
        return "in index expression";
      case ParseContext.BinaryExpression:
        return "after operator";
      case ParseContext.CollectionLiteral:
        return "in collection literal";
      case ParseContext.TypeCast:
        return "after 'as'";
      case ParseContext.MembershipTest:
        return "after 'is'";
      default:
        return "";
    }
  }
  
  private describeTokens(tokens: TokenType[]): string {
    if (tokens.length === 0) return "token";
    if (tokens.length === 1) return this.getTokenDescription(tokens[0]!);
    
    const descriptions = tokens.map(t => this.getTokenDescription(t));
    const last = descriptions.pop();
    return descriptions.join(', ') + ' or ' + last;
  }
  
  private describeToken(token: Token): string {
    if (token.type === TokenType.IDENTIFIER) {
      return `identifier '${token.value}'`;
    }
    if (token.type === TokenType.NUMBER || token.type === TokenType.STRING) {
      return `${this.getTokenDescription(token.type)} '${token.value}'`;
    }
    if (token.type === TokenType.EOF) {
      return "end of expression";
    }
    return `'${token.value}'`;
  }
  
  private getTokenDescription(tokenType: TokenType): string {
    switch (tokenType) {
      case TokenType.IDENTIFIER:
        return "identifier";
      case TokenType.NUMBER:
        return "number";
      case TokenType.STRING:
        return "string";
      case TokenType.LPAREN:
        return "'('";
      case TokenType.RPAREN:
        return "')'";
      case TokenType.LBRACKET:
        return "'['";
      case TokenType.RBRACKET:
        return "']'";
      case TokenType.LBRACE:
        return "'{'";
      case TokenType.RBRACE:
        return "'}'";
      case TokenType.COMMA:
        return "','";
      case TokenType.DOT:
        return "'.'";
      case TokenType.PLUS:
        return "'+'";
      case TokenType.MINUS:
        return "'-'";
      case TokenType.STAR:
        return "'*'";
      case TokenType.SLASH:
        return "'/'";
      case TokenType.MOD:
        return "'mod'";
      case TokenType.EQ:
        return "'='";
      case TokenType.NEQ:
        return "'!='";
      case TokenType.LT:
        return "'<'";
      case TokenType.GT:
        return "'>'";
      case TokenType.LTE:
        return "'<='";
      case TokenType.GTE:
        return "'>='";
      case TokenType.AND:
        return "'and'";
      case TokenType.OR:
        return "'or'";
      case TokenType.XOR:
        return "'xor'";
      case TokenType.IMPLIES:
        return "'implies'";
      case TokenType.NOT:
        return "'not'";
      case TokenType.IS:
        return "'is'";
      case TokenType.AS:
        return "'as'";
      case TokenType.IN:
        return "'in'";
      case TokenType.CONTAINS:
        return "'contains'";
      case TokenType.TRUE:
        return "'true'";
      case TokenType.FALSE:
        return "'false'";
      case TokenType.NULL:
        return "'null'";
      case TokenType.EOF:
        return "end of expression";
      default:
        return "token";
    }
  }
}