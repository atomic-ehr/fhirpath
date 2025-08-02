import { TokenType } from './lexer';
import type { Token, LexerOptions } from './lexer';
import { BaseParser } from './parser-base';
import { NodeType } from './types';
import type {
  Position,
  Range,
  ASTNode,
  IdentifierNode,
  TypeOrIdentifierNode,
  LiteralNode,
  BinaryNode,
  UnaryNode,
  FunctionNode,
  VariableNode,
  IndexNode,
  MembershipTestNode,
  TypeCastNode,
  CollectionNode,
  TypeReferenceNode,
  QuantityNode,
  ErrorNode,
  TriviaInfo,
  ParseResult,
  ParseError
} from './types';

// Re-export types for backward compatibility
export {
  NodeType,
  type Position,
  type ASTNode,
  type IdentifierNode,
  type TypeOrIdentifierNode,
  type LiteralNode,
  type BinaryNode,
  type UnaryNode,
  type FunctionNode,
  type VariableNode,
  type IndexNode,
  type MembershipTestNode,
  type TypeCastNode,
  type CollectionNode,
  type TypeReferenceNode,
  type QuantityNode,
  type ErrorNode,
  type TriviaInfo,
  type ParseResult,
  type ParseError
} from './types';

// Parser options
export interface ParserOptions {
  mode?: 'simple' | 'lsp';     // Default: 'simple'
  preserveTrivia?: boolean;     // Auto-enabled in LSP mode
  buildIndexes?: boolean;       // Auto-enabled in LSP mode
  errorRecovery?: boolean;      // Auto-enabled in LSP mode
  partialParse?: {              // For partial parsing
    cursorPosition: number;
  };
}

export class Parser extends BaseParser<ASTNode> {
  private mode: 'simple' | 'lsp';
  private options: ParserOptions;
  private errors?: ParseError[];
  private nodeIdCounter?: number;
  private nodeIndex?: Map<string, ASTNode>;
  private nodesByType?: Map<NodeType | 'Error', ASTNode[]>;
  private identifierIndex?: Map<string, ASTNode[]>;
  private currentParent?: ASTNode | null;
  private input: string;
  
  // Synchronization tokens for error recovery
  private readonly synchronizationTokens = new Set([
    TokenType.COMMA,
    TokenType.RPAREN,
    TokenType.RBRACE,
    TokenType.RBRACKET,
    TokenType.EOF
  ]);
  
  constructor(input: string, options: ParserOptions = {}) {
    const mode = options.mode || 'simple';
    const lexerOptions: LexerOptions = {
      trackPosition: true,
      preserveTrivia: mode === 'lsp' ? true : (options.preserveTrivia ?? false)
    };
    
    super(input, lexerOptions);
    
    this.input = input;
    this.mode = mode;
    this.options = options;
    
    // Initialize LSP features only if needed
    if (this.mode === 'lsp') {
      this.errors = [];
      this.nodeIdCounter = 0;
      this.nodeIndex = new Map();
      this.nodesByType = new Map();
      this.identifierIndex = new Map();
      this.currentParent = null;
    }
  }
  
  private getRangeFromToken(token: Token): Range {
    return token.range || {
      start: { line: 0, character: 0, offset: token.start },
      end: { line: 0, character: 0, offset: token.end }
    };
  }
  
  private getRangeFromTokens(startToken: Token, endToken: Token): Range {
    const start = startToken.range?.start || { line: 0, character: 0, offset: startToken.start };
    const end = endToken.range?.end || { line: 0, character: 0, offset: endToken.end };
    return { start, end };
  }
  
  private getRangeFromNodes(startNode: ASTNode, endNode: ASTNode): Range {
    return {
      start: startNode.range.start,
      end: endNode.range.end
    };
  }

  parse(): ParseResult {
    if (this.mode === 'simple') {
      return this.parseSimple();
    } else {
      return this.parseLSP();
    }
  }
  
  private parseSimple(): ParseResult {
    const errors: ParseError[] = [];
    let ast: ASTNode;
    
    try {
      ast = this.expression();
      if (!this.isAtEnd()) {
        const token = this.peek();
        throw new Error(`Unexpected token: ${token.value || TokenType[token.type]}`);
      }
    } catch (error) {
      // In simple mode, we still collect the error but also throw
      if (error instanceof Error) {
        const token = this.peek();
        errors.push({
          message: error.message,
          position: {
            line: token.line || 0,
            character: token.column || 0,
            offset: token.start
          },
          range: this.getRangeFromToken(token),
          token
        });
        throw error; // Re-throw for backward compatibility
      }
      throw error;
    }
    
    return {
      ast,
      errors
    };
  }
  
  private parseLSP(): ParseResult {
    // Clear indexes for fresh parse
    this.errors = [];
    this.nodeIndex!.clear();
    this.nodesByType!.clear();
    this.identifierIndex!.clear();
    
    let ast: ASTNode;
    
    try {
      ast = this.expression();
      
      if (!this.isAtEnd()) {
        const token = this.peek();
        this.addError(`Unexpected token: ${token.value || TokenType[token.type]}`, token);
      }
    } catch (error) {
      // In LSP mode, create error node on fatal errors
      if (error instanceof Error) {
        ast = this.createErrorNode(error.message, this.peek());
      } else {
        ast = this.createErrorNode('Parse failed', this.peek());
      }
    }
    
    const result: ParseResult = {
      ast,
      errors: this.errors!,
      indexes: {
        nodeById: this.nodeIndex!,
        nodesByType: this.nodesByType!,
        identifiers: this.identifierIndex!
      }
    };
    
    // Add cursor context if partial parsing
    if (this.options.partialParse) {
      const nodeAtCursor = this.findNodeAtPosition(ast, this.options.partialParse.cursorPosition);
      result.cursorContext = {
        node: nodeAtCursor,
        expectedTokens: this.getExpectedTokens(nodeAtCursor),
        availableCompletions: this.getCompletions(nodeAtCursor)
      };
    }
    
    return result;
  }

  // Implement abstract methods for node creation
  protected createIdentifierNode(name: string, token: Token): ASTNode {
    const range = this.getRangeFromToken(token);
    const isType = name[0] && name[0] >= 'A' && name[0] <= 'Z';
    const nodeType = isType ? NodeType.TypeOrIdentifier : NodeType.Identifier;
    
    const node: ASTNode = {
      type: nodeType,
      name,
      range
    };
    
    // Add LSP features if in LSP mode
    if (this.mode === 'lsp') {
      this.enrichNodeForLSP(node, token);
      
      // Index identifier
      const identifiers = this.identifierIndex!.get(name) || [];
      identifiers.push(node);
      this.identifierIndex!.set(name, identifiers);
    }
    
    return node;
  }

  protected createLiteralNode(value: any, valueType: LiteralNode['valueType'], token: Token): LiteralNode {
    const node: LiteralNode = {
      type: NodeType.Literal,
      value,
      valueType,
      range: this.getRangeFromToken(token)
    };
    
    if (this.mode === 'lsp') {
      this.enrichNodeForLSP(node, token);
    }
    
    return node;
  }

  protected createBinaryNode(token: Token, left: ASTNode, right: ASTNode): BinaryNode {
    const node: BinaryNode = {
      type: NodeType.Binary,
      operator: token.value,
      left,
      right,
      range: this.getRangeFromNodes(left, right)
    };
    
    if (this.mode === 'lsp') {
      // For binary nodes, we need to find the actual start and end tokens
      const startToken = this.tokens.find(t => t.start === left.range.start.offset) || token;
      const endToken = this.tokens.find(t => t.end === right.range.end.offset) || token;
      this.enrichNodeForLSP(node, startToken, endToken);
      
      // Set up parent-child relationships
      if (node.id) {
        left.parent = node;
        right.parent = node;
        node.children = [left, right];
      }
    }
    
    return node;
  }

  protected createUnaryNode(token: Token, operand: ASTNode): UnaryNode {
    const startPos = token.range?.start || { line: 0, character: 0, offset: token.start };
    const node: UnaryNode = {
      type: NodeType.Unary,
      operator: token.value,
      operand,
      range: { start: startPos, end: operand.range.end }
    };
    
    if (this.mode === 'lsp') {
      const endToken = this.tokens.find(t => t.end === operand.range.end.offset) || token;
      this.enrichNodeForLSP(node, token, endToken);
      
      if (node.id) {
        operand.parent = node;
        node.children = [operand];
      }
    }
    
    return node;
  }

  protected createFunctionNode(name: ASTNode, args: ASTNode[], startToken: Token): FunctionNode {
    const endNode = args.length > 0 ? args[args.length - 1]! : name;
    const node: FunctionNode = {
      type: NodeType.Function,
      name,
      arguments: args,
      range: this.getRangeFromNodes(name, endNode)
    };
    
    if (this.mode === 'lsp') {
      const startTok = this.tokens.find(t => t.start === name.range.start.offset) || startToken;
      const endToken = this.tokens.find(t => t.end === endNode.range.end.offset) || startToken;
      this.enrichNodeForLSP(node, startTok, endToken);
      
      if (node.id) {
        name.parent = node;
        args.forEach(arg => { arg.parent = node; });
        node.children = [name, ...args];
      }
    }
    
    return node;
  }

  protected createVariableNode(name: string, token: Token): VariableNode {
    const node: VariableNode = {
      type: NodeType.Variable,
      name,
      range: this.getRangeFromToken(token)
    };
    
    if (this.mode === 'lsp') {
      this.enrichNodeForLSP(node, token);
    }
    
    return node;
  }

  protected createIndexNode(expression: ASTNode, index: ASTNode, startToken: Token): IndexNode {
    const node: IndexNode = {
      type: NodeType.Index,
      expression,
      index,
      range: this.getRangeFromNodes(expression, index)
    };
    
    if (this.mode === 'lsp') {
      const startTok = this.tokens.find(t => t.start === expression.range.start.offset) || startToken;
      const endToken = this.tokens.find(t => t.end === index.range.end.offset) || startToken;
      this.enrichNodeForLSP(node, startTok, endToken);
      
      if (node.id) {
        expression.parent = node;
        index.parent = node;
        node.children = [expression, index];
      }
    }
    
    return node;
  }


  protected createMembershipTestNode(expression: ASTNode, targetType: string, startToken: Token): MembershipTestNode {
    // The range should extend from expression to the end of the type name
    const endToken = this.previous(); // Should be the type identifier
    const node: MembershipTestNode = {
      type: NodeType.MembershipTest,
      expression,
      targetType,
      range: this.getRangeFromTokens(startToken, endToken)
    };
    
    if (this.mode === 'lsp') {
      const startTok = this.tokens.find(t => t.start === expression.range.start.offset) || startToken;
      this.enrichNodeForLSP(node, startTok, endToken);
      
      if (node.id) {
        expression.parent = node;
        node.children = [expression];
      }
    }
    
    return node;
  }

  protected createTypeCastNode(expression: ASTNode, targetType: string, startToken: Token): TypeCastNode {
    // The range should extend from expression to the end of the type name
    const endToken = this.previous(); // Should be the type identifier
    const node: TypeCastNode = {
      type: NodeType.TypeCast,
      expression,
      targetType,
      range: this.getRangeFromTokens(startToken, endToken)
    };
    
    if (this.mode === 'lsp') {
      const startTok = this.tokens.find(t => t.start === expression.range.start.offset) || startToken;
      this.enrichNodeForLSP(node, startTok, endToken);
      
      if (node.id) {
        expression.parent = node;
        node.children = [expression];
      }
    }
    
    return node;
  }

  protected createCollectionNode(elements: ASTNode[], startToken: Token): CollectionNode {
    const endToken = this.previous(); // Should be RBRACE
    const node: CollectionNode = {
      type: NodeType.Collection,
      elements,
      range: this.getRangeFromTokens(startToken, endToken)
    };
    
    if (this.mode === 'lsp') {
      this.enrichNodeForLSP(node, startToken, endToken);
      
      if (node.id) {
        elements.forEach(elem => { elem.parent = node; });
        node.children = elements;
      }
    }
    
    return node;
  }

  protected createQuantityNode(value: number, unit: string, isCalendarUnit: boolean, startToken: Token, endToken: Token): QuantityNode {
    const node: QuantityNode = {
      type: NodeType.Quantity,
      value,
      unit,
      isCalendarUnit,
      range: this.getRangeFromTokens(startToken, endToken)
    };
    
    if (this.mode === 'lsp') {
      this.enrichNodeForLSP(node, startToken, endToken);
    }
    
    return node;
  }

  protected handleError(message: string, token?: Token): never {
    if (this.mode === 'lsp' && this.options.errorRecovery) {
      // In LSP mode with error recovery, add error and try to recover
      this.addError(message, token);
      
      // Try to synchronize
      this.synchronize();
      
      // Return error node (cast to never to satisfy type system)
      return this.createErrorNode(message, token) as never;
    }
    
    // In simple mode, throw error
    throw new Error(message);
  }
  
  // LSP mode helper methods
  private enrichNodeForLSP(node: ASTNode, startToken: Token, endToken?: Token): void {
    if (this.mode !== 'lsp') return;
    
    // Add unique ID
    node.id = `node_${this.nodeIdCounter!++}`;
    
    // Add raw source text
    const start = startToken.start;
    const end = endToken ? endToken.end : startToken.end;
    node.raw = this.input.substring(start, end);
    
    // Add trivia if preserving
    if (this.options.preserveTrivia) {
      node.leadingTrivia = [];  // TODO: Implement trivia collection
      node.trailingTrivia = [];
    }
    
    // Set parent relationship
    if (this.currentParent) {
      node.parent = this.currentParent;
    }
    
    // Index node
    this.nodeIndex!.set(node.id, node);
    const nodesByType = this.nodesByType!.get(node.type) || [];
    nodesByType.push(node);
    this.nodesByType!.set(node.type, nodesByType);
  }
  
  private createErrorNode(message: string, token?: Token): ErrorNode {
    const range = token ? this.getRangeFromToken(token) : {
      start: { line: 0, character: 0, offset: 0 },
      end: { line: 0, character: 0, offset: 0 }
    };
    
    const node: ErrorNode = {
      type: 'Error',
      message,
      range
    };
    
    if (this.mode === 'lsp') {
      this.enrichNodeForLSP(node, token || this.peek());
    }
    
    return node;
  }
  
  private addError(message: string, token?: Token): void {
    if (!this.errors) return;
    
    const position = token ? {
      line: token.line || 0,
      character: token.column || 0,
      offset: token.start
    } : { line: 0, character: 0, offset: 0 };
    
    const error: ParseError = {
      message,
      position,
      token
    };
    
    if (token) {
      error.range = this.getRangeFromToken(token);
    }
    
    this.errors.push(error);
  }
  
  private synchronize(): void {
    // Skip tokens until we find a synchronization point
    while (!this.isAtEnd()) {
      if (this.synchronizationTokens.has(this.peek().type)) {
        return;
      }
      this.advance();
    }
  }
  
  private findNodeAtPosition(root: ASTNode, offset: number): ASTNode | null {
    // DFS to find the most specific node containing the position
    if (offset < root.range.start.offset! || offset > root.range.end.offset!) {
      return null;
    }
    
    // Check children if they exist
    if ('children' in root && Array.isArray(root.children)) {
      for (const child of root.children) {
        const found = this.findNodeAtPosition(child, offset);
        if (found) return found;
      }
    }
    
    // Check specific node types
    if (root.type === NodeType.Binary) {
      const binaryNode = root as BinaryNode;
      const leftResult = this.findNodeAtPosition(binaryNode.left, offset);
      if (leftResult) return leftResult;
      const rightResult = this.findNodeAtPosition(binaryNode.right, offset);
      if (rightResult) return rightResult;
    } else if (root.type === NodeType.Unary) {
      const unaryNode = root as UnaryNode;
      return this.findNodeAtPosition(unaryNode.operand, offset);
    } else if (root.type === NodeType.Function) {
      const funcNode = root as FunctionNode;
      const nameResult = this.findNodeAtPosition(funcNode.name, offset);
      if (nameResult) return nameResult;
      for (const arg of funcNode.arguments) {
        const argResult = this.findNodeAtPosition(arg, offset);
        if (argResult) return argResult;
      }
    }
    
    return root;
  }
  
  private getExpectedTokens(node: ASTNode | null): TokenType[] {
    if (!node) return this.getExpectedTokensForError();
    
    // Context-specific expectations
    switch (node.type) {
      case NodeType.Binary:
        return [TokenType.DOT, TokenType.LBRACKET];
      case NodeType.Identifier:
      case NodeType.TypeOrIdentifier:
        return [TokenType.DOT, TokenType.LPAREN, TokenType.LBRACKET];
      default:
        return this.getExpectedTokensForError();
    }
  }
  
  private getExpectedTokensForError(): TokenType[] {
    // Common continuations
    return [
      TokenType.EOF,
      TokenType.DOT,
      TokenType.LBRACKET,
      TokenType.LPAREN,
      TokenType.OPERATOR,
      TokenType.IDENTIFIER
    ];
  }
  
  private getCompletions(node: ASTNode | null): string[] {
    if (!node) return [];
    
    const completions: string[] = [];
    
    // Add all identifiers seen so far
    if (this.identifierIndex) {
      for (const name of Array.from(this.identifierIndex.keys())) {
        completions.push(name);
      }
    }
    
    // Add common FHIRPath functions
    completions.push(
      'where', 'select', 'first', 'last', 'tail',
      'skip', 'take', 'count', 'empty', 'exists'
    );
    
    return completions;
  }
}

export function parse(input: string, options?: ParserOptions): ParseResult {
  const parser = new Parser(input, options);
  return parser.parse();
}

/**
 * Pretty print AST in Lisp style
 * @param node - The AST node to print
 * @param indent - Current indentation level
 * @returns Lisp-style string representation
 */
export function pprint(node: ASTNode, indent: number = 0): string {
  const spaces = ' '.repeat(indent);
  
  switch (node.type) {
    case NodeType.Literal: {
      const lit = node as LiteralNode;
      if (lit.valueType === 'string') {
        return `"${lit.value}"`;
      } else if (lit.valueType === 'null') {
        return 'null';
      }
      return String(lit.value);
    }
    
    case NodeType.Identifier:
    case NodeType.TypeOrIdentifier: {
      const id = node as IdentifierNode | TypeOrIdentifierNode;
      return id.name;
    }
    
    case NodeType.Variable: {
      const v = node as VariableNode;
      return v.name;
    }
    
    case NodeType.Binary: {
      const bin = node as BinaryNode;
      const op = bin.operator;
      
      // For simple expressions, put on one line
      const leftStr = pprint(bin.left, 0);
      const rightStr = pprint(bin.right, 0);
      
      if (leftStr.length + rightStr.length + op.length + 4 < 60 && 
          !leftStr.includes('\n') && !rightStr.includes('\n')) {
        return `(${op} ${leftStr} ${rightStr})`;
      }
      
      // For complex expressions, use multiple lines
      return `(${op}\n${spaces}  ${pprint(bin.left, indent + 2)}\n${spaces}  ${pprint(bin.right, indent + 2)})`;
    }
    
    case NodeType.Unary: {
      const un = node as UnaryNode;
      const operandStr = pprint(un.operand, 0);
      
      if (operandStr.length < 40 && !operandStr.includes('\n')) {
        return `(${un.operator} ${operandStr})`;
      }
      
      return `(${un.operator}\n${spaces}  ${pprint(un.operand, indent + 2)})`;
    }
    
    case NodeType.Function: {
      const fn = node as FunctionNode;
      const nameStr = pprint(fn.name, 0);
      
      if (fn.arguments.length === 0) {
        return `(${nameStr})`;
      }
      
      const argStrs = fn.arguments.map(arg => pprint(arg, 0));
      const totalLen = nameStr.length + argStrs.reduce((sum, s) => sum + s.length + 1, 0) + 2;
      
      if (totalLen < 60 && argStrs.every(s => !s.includes('\n'))) {
        return `(${nameStr} ${argStrs.join(' ')})`;
      }
      
      // Multi-line format
      const argLines = fn.arguments.map(arg => `${spaces}  ${pprint(arg, indent + 2)}`);
      return `(${nameStr}\n${argLines.join('\n')})`;
    }
    
    case NodeType.Index: {
      const idx = node as IndexNode;
      const exprStr = pprint(idx.expression, 0);
      const indexStr = pprint(idx.index, 0);
      
      if (exprStr.length + indexStr.length < 50 && 
          !exprStr.includes('\n') && !indexStr.includes('\n')) {
        return `([] ${exprStr} ${indexStr})`;
      }
      
      return `([]\n${spaces}  ${pprint(idx.expression, indent + 2)}\n${spaces}  ${pprint(idx.index, indent + 2)})`;
    }
    
    case NodeType.MembershipTest: {
      const mt = node as MembershipTestNode;
      const exprStr = pprint(mt.expression, 0);
      
      if (exprStr.length + mt.targetType.length < 50 && !exprStr.includes('\n')) {
        return `(is ${exprStr} ${mt.targetType})`;
      }
      
      return `(is\n${spaces}  ${pprint(mt.expression, indent + 2)}\n${spaces}  ${mt.targetType})`;
    }
    
    case NodeType.TypeCast: {
      const tc = node as TypeCastNode;
      const exprStr = pprint(tc.expression, 0);
      
      if (exprStr.length + tc.targetType.length < 50 && !exprStr.includes('\n')) {
        return `(as ${exprStr} ${tc.targetType})`;
      }
      
      return `(as\n${spaces}  ${pprint(tc.expression, indent + 2)}\n${spaces}  ${tc.targetType})`;
    }
    
    case NodeType.Collection: {
      const coll = node as CollectionNode;
      
      if (coll.elements.length === 0) {
        return '{}';
      }
      
      const elemStrs = coll.elements.map(e => pprint(e, 0));
      const totalLen = elemStrs.reduce((sum, s) => sum + s.length + 1, 2);
      
      if (totalLen < 60 && elemStrs.every(s => !s.includes('\n'))) {
        return `{${elemStrs.join(' ')}}`;
      }
      
      const elemLines = coll.elements.map(e => `${spaces}  ${pprint(e, indent + 2)}`);
      return `{\n${elemLines.join('\n')}\n${spaces}}`;
    }
    
    case NodeType.TypeReference: {
      const tr = node as TypeReferenceNode;
      return `Type[${tr.typeName}]`;
    }
    
    case NodeType.Quantity: {
      const q = node as QuantityNode;
      if (q.isCalendarUnit) {
        return `${q.value} ${q.unit}`;
      }
      return `${q.value} '${q.unit}'`;
    }
    
    default:
      return `<unknown:${node.type}>`;
  }
}