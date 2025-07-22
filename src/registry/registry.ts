import { TokenType } from '../lexer/token';
import type { Operation, Operator, Function, Literal } from './types';

export class Registry {
  private static operations = new Map<string, Operation>();
  private static tokenToOperation = new Map<TokenType, Operation>();
  private static precedenceTable = new Map<TokenType, number>();
  private static literals: Literal[] = [];
  private static keywords = new Set<string>();
  
  static register(op: Operation) {
    this.operations.set(op.name, op);
    
    // Type-based registration
    switch (op.kind) {
      case 'operator':
        this.tokenToOperation.set(op.syntax.token, op);
        this.precedenceTable.set(op.syntax.token, op.syntax.precedence);
        // Register keyword operators (and, or, not, etc.)
        if (/^[a-z]+$/.test(op.name)) {
          this.keywords.add(op.name);
        }
        break;
        
      case 'literal':
        this.literals.push(op);
        // Register keyword literals
        if (op.syntax.keywords) {
          op.syntax.keywords.forEach(kw => this.keywords.add(kw));
        }
        break;
        
      case 'function':
        // Functions don't need special registration
        break;
    }
  }
  
  static get(name: string): Operation | undefined {
    return this.operations.get(name);
  }
  
  static getByToken(token: TokenType): Operation | undefined {
    return this.tokenToOperation.get(token);
  }
  
  static getPrecedence(token: TokenType): number {
    return this.precedenceTable.get(token) ?? 0;
  }
  
  static isKeyword(word: string): boolean {
    return this.keywords.has(word);
  }
  
  static getLiterals(): Literal[] {
    return this.literals;
  }
  
  static matchLiteral(text: string): { operation: Literal; value: any } | null {
    for (const literal of this.literals) {
      if (literal.syntax.pattern && literal.syntax.pattern.test(text)) {
        return {
          operation: literal,
          value: literal.parse(text)
        };
      }
      if (literal.syntax.keywords && literal.syntax.keywords.includes(text)) {
        return {
          operation: literal,
          value: literal.parse(text)
        };
      }
    }
    return null;
  }
  
  // For special forms
  static getSpecialForms(): Operator[] {
    return Array.from(this.operations.values())
      .filter((op): op is Operator => op.kind === 'operator' && op.syntax.special === true);
  }
  
  // Check if token starts a composite operator
  static isCompositeOperatorStart(token: TokenType): boolean {
    // Used by lexer to know when to look ahead
    return [TokenType.LT, TokenType.GT, TokenType.NEQ, TokenType.NEQUIV]
      .includes(token);
  }
  
  // Clear registry (useful for testing)
  static clear() {
    this.operations.clear();
    this.tokenToOperation.clear();
    this.precedenceTable.clear();
    this.literals = [];
    this.keywords.clear();
  }
  
  // Get all registered operations
  static getAllOperations(): Operation[] {
    return Array.from(this.operations.values());
  }
  
  // Get operators by form
  static getOperatorsByForm(form: 'prefix' | 'infix' | 'postfix'): Operator[] {
    return Array.from(this.operations.values())
      .filter((op): op is Operator => op.kind === 'operator' && op.syntax.form === form);
  }
  
  // Get all functions
  static getAllFunctions(): Function[] {
    return Array.from(this.operations.values())
      .filter((op): op is Function => op.kind === 'function');
  }
}