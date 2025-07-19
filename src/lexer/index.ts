export { FHIRPathLexer, lex } from './lexer';
export type { Token, Position } from './token';
export { TokenType, Channel } from './token';
export { LexerError, formatError } from './errors';
export { CHAR_FLAGS, FLAG_DIGIT, FLAG_ALPHA, FLAG_WHITESPACE, FLAG_IDENTIFIER_START, FLAG_IDENTIFIER_CONT } from './char-tables';