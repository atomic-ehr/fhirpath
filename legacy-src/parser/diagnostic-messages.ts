import type { Token } from '../lexer/token';
import type { SourceMapper } from './source-mapper';
import type { ParseDiagnostic, TextRange, RelatedInformation } from './types';
import type { FunctionNode } from './ast';
import { ErrorCode } from '../api/errors';
import { DiagnosticSeverity } from './types';

/**
 * Factory for creating common FHIRPath diagnostic messages
 */
export class FHIRPathDiagnostics {
  static unclosedParenthesis(openParen: Token, mapper: SourceMapper): ParseDiagnostic {
    const range = mapper.tokenToRange(openParen);
    return {
      range,
      severity: DiagnosticSeverity.Error,
      code: ErrorCode.UNCLOSED_PARENTHESIS,
      message: "Unclosed parenthesis - missing ')' to close function call",
      source: 'fhirpath-parser'
    };
  }
  
  static unclosedBracket(openBracket: Token, mapper: SourceMapper): ParseDiagnostic {
    const range = mapper.tokenToRange(openBracket);
    return {
      range,
      severity: DiagnosticSeverity.Error,
      code: ErrorCode.UNCLOSED_BRACKET,
      message: "Expected ']' after index expression",
      source: 'fhirpath-parser'
    };
  }
  
  static unclosedBrace(openBrace: Token, mapper: SourceMapper): ParseDiagnostic {
    const range = mapper.tokenToRange(openBrace);
    return {
      range,
      severity: DiagnosticSeverity.Error,
      code: ErrorCode.UNCLOSED_BRACE,
      message: "Expected '}' to close collection literal",
      source: 'fhirpath-parser'
    };
  }
  
  static missingFunctionArguments(
    functionName: string,
    position: TextRange,
    functionDefinitionLocation?: TextRange
  ): ParseDiagnostic {
    const diagnostic: ParseDiagnostic = {
      range: position,
      severity: DiagnosticSeverity.Error,
      code: ErrorCode.MISSING_ARGUMENTS,
      message: `Function '${functionName}' requires arguments`,
      source: 'fhirpath-parser'
    };
    
    if (functionDefinitionLocation) {
      diagnostic.relatedInformation = [{
        location: functionDefinitionLocation,
        message: `Function '${functionName}' defined here`
      }];
    }
    
    return diagnostic;
  }
  
  static doubleDotOperator(firstDot: Token, secondDot: Token, mapper: SourceMapper): ParseDiagnostic {
    const startPos = mapper.tokenToRange(firstDot).start;
    const endPos = mapper.tokenToRange(secondDot).end;
    const range: TextRange = { start: startPos, end: endPos };
    
    return {
      range,
      severity: DiagnosticSeverity.Error,
      code: ErrorCode.INVALID_OPERATOR,
      message: "Invalid '..' operator - use single '.' for navigation",
      source: 'fhirpath-parser'
    };
  }
  
  static unexpectedToken(
    token: Token,
    expected: string[],
    mapper: SourceMapper
  ): ParseDiagnostic {
    const range = mapper.tokenToRange(token);
    const expectedText = expected.length === 1 
      ? expected[0]
      : expected.slice(0, -1).join(', ') + ' or ' + expected[expected.length - 1];
    
    return {
      range,
      severity: DiagnosticSeverity.Error,
      code: ErrorCode.UNEXPECTED_TOKEN,
      message: `Expected ${expectedText}, found '${token.value}'`,
      source: 'fhirpath-parser'
    };
  }
  
  static invalidEscapeSequence(
    escapeToken: Token,
    escapeSequence: string,
    mapper: SourceMapper
  ): ParseDiagnostic {
    const range = mapper.tokenToRange(escapeToken);
    return {
      range,
      severity: DiagnosticSeverity.Error,
      code: ErrorCode.INVALID_ESCAPE,
      message: `Invalid escape sequence '${escapeSequence}'`,
      source: 'fhirpath-parser'
    };
  }
  
  static unterminatedString(stringStart: Token, mapper: SourceMapper): ParseDiagnostic {
    const range = mapper.tokenToRange(stringStart);
    return {
      range,
      severity: DiagnosticSeverity.Error,
      code: ErrorCode.UNTERMINATED_STRING,
      message: "Unterminated string literal",
      source: 'fhirpath-parser'
    };
  }
  
  static invalidCharacter(position: TextRange, character: string): ParseDiagnostic {
    return {
      range: position,
      severity: DiagnosticSeverity.Error,
      code: ErrorCode.INVALID_CHARACTER,
      message: `Invalid character '${character}'`,
      source: 'fhirpath-parser'
    };
  }
  
  static trailingComma(commaToken: Token, mapper: SourceMapper): ParseDiagnostic {
    const range = mapper.tokenToRange(commaToken);
    return {
      range,
      severity: DiagnosticSeverity.Error,
      code: ErrorCode.EXPECTED_EXPRESSION,
      message: "Expected expression after ','",
      source: 'fhirpath-parser'
    };
  }
  
  static missingOperand(
    operatorToken: Token,
    side: 'left' | 'right',
    mapper: SourceMapper
  ): ParseDiagnostic {
    const range = mapper.tokenToRange(operatorToken);
    return {
      range,
      severity: DiagnosticSeverity.Error,
      code: ErrorCode.EXPECTED_EXPRESSION,
      message: `Expected expression ${side === 'left' ? 'before' : 'after'} '${operatorToken.value}'`,
      source: 'fhirpath-parser'
    };
  }
  
  static emptyBrackets(openBracket: Token, mapper: SourceMapper): ParseDiagnostic {
    const range = mapper.tokenToRange(openBracket);
    return {
      range,
      severity: DiagnosticSeverity.Error,
      code: ErrorCode.EXPECTED_EXPRESSION,
      message: "Expected expression in index",
      source: 'fhirpath-parser'
    };
  }
  
  static spaceInDotNavigation(dotToken: Token, mapper: SourceMapper): ParseDiagnostic {
    const range = mapper.tokenToRange(dotToken);
    return {
      range,
      severity: DiagnosticSeverity.Error,
      code: ErrorCode.EXPECTED_IDENTIFIER,
      message: "Expected property name immediately after '.'",
      source: 'fhirpath-parser'
    };
  }
  
  static incompleteTypeCast(asToken: Token, mapper: SourceMapper): ParseDiagnostic {
    const range = mapper.tokenToRange(asToken);
    return {
      range,
      severity: DiagnosticSeverity.Error,
      code: ErrorCode.EXPECTED_IDENTIFIER,
      message: "Expected type name after 'as'",
      source: 'fhirpath-parser'
    };
  }
  
  static incompleteMembershipTest(isToken: Token, mapper: SourceMapper): ParseDiagnostic {
    const range = mapper.tokenToRange(isToken);
    return {
      range,
      severity: DiagnosticSeverity.Error,
      code: ErrorCode.EXPECTED_IDENTIFIER,
      message: "Expected type name after 'is'",
      source: 'fhirpath-parser'
    };
  }
  
  static multipleErrors(errorCount: number, position: TextRange): ParseDiagnostic {
    return {
      range: position,
      severity: DiagnosticSeverity.Error,
      code: ErrorCode.MULTIPLE_ERRORS,
      message: `Expression contains ${errorCount} errors`,
      source: 'fhirpath-parser'
    };
  }
}