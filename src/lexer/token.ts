export enum TokenType {
  // Literals
  NULL = 'NULL',                  // {} (nullLiteral in grammar)
  TRUE = 'TRUE',                  // true
  FALSE = 'FALSE',                // false
  STRING = 'STRING',              // 'string value'
  NUMBER = 'NUMBER',              // 123, 45.67, 0123 (allows leading zeros)
  DATE = 'DATE',                  // @2024, @2024-01, @2024-01-15
  DATETIME = 'DATETIME',          // @2024-01-15T10:30:00Z
  TIME = 'TIME',                  // @T14:30:00
  
  // Identifiers
  IDENTIFIER = 'IDENTIFIER',      // [A-Za-z_][A-Za-z0-9_]*
  DELIMITED_IDENTIFIER = 'DELIMITED_IDENTIFIER', // `identifier`
  
  // Special variables
  THIS = 'THIS',                  // $this
  INDEX = 'INDEX',                // $index
  TOTAL = 'TOTAL',                // $total
  
  // Environment variables
  ENV_VAR = 'ENV_VAR',           // %context, %`vs-name`
  
  // Operators (by precedence)
  DOT = 'DOT',                   // .
  LBRACKET = 'LBRACKET',         // [
  RBRACKET = 'RBRACKET',         // ]
  LPAREN = 'LPAREN',             // (
  RPAREN = 'RPAREN',             // )
  
  // Arithmetic
  PLUS = 'PLUS',                 // +
  MINUS = 'MINUS',               // -
  STAR = 'STAR',                 // *
  SLASH = 'SLASH',               // /
  DIV = 'DIV',                   // div
  MOD = 'MOD',                   // mod
  CONCAT = 'CONCAT',             // &
  
  // Type operators
  IS = 'IS',                     // is
  AS = 'AS',                     // as
  
  // Union
  PIPE = 'PIPE',                 // |
  
  // Comparison
  LT = 'LT',                     // <
  LTE = 'LTE',                   // <=
  GT = 'GT',                     // >
  GTE = 'GTE',                   // >=
  EQ = 'EQ',                     // =
  NEQ = 'NEQ',                   // !=
  EQUIV = 'EQUIV',               // ~
  NEQUIV = 'NEQUIV',             // !~
  
  // Membership
  IN = 'IN',                     // in
  CONTAINS = 'CONTAINS',         // contains
  
  // Boolean
  AND = 'AND',                   // and
  OR = 'OR',                     // or
  XOR = 'XOR',                   // xor
  IMPLIES = 'IMPLIES',           // implies
  NOT = 'NOT',                   // not
  
  // Collection
  LBRACE = 'LBRACE',             // {
  RBRACE = 'RBRACE',             // }
  
  // Other
  COMMA = 'COMMA',               // ,
  EOF = 'EOF',
  
  // Units (for quantities)
  UNIT = 'UNIT',                 // year, month, 'mg', etc.
  
  // Trivia tokens (when preserving whitespace/comments)
  WS = 'WS',                     // Whitespace
  COMMENT = 'COMMENT',           // /* Multi-line comment */
  LINE_COMMENT = 'LINE_COMMENT', // // Single-line comment
}

export interface Position {
  line: number;
  column: number;
  offset: number;
}

export enum Channel {
  DEFAULT = 0,
  HIDDEN = 1    // For whitespace and comments
}

export interface Token {
  type: TokenType;
  value: string;
  position: Position;
  channel?: Channel;  // Optional channel for trivia
}