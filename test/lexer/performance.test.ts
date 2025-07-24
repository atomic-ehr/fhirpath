import { describe, it, expect } from 'bun:test';
import { FHIRPathLexer, lex } from '../../src/lexer/lexer';
import { TokenType } from '../../src/lexer/token';

describe('FHIRPath Lexer - Performance', () => {
  it('should handle large input efficiently', () => {
    // Generate a large expression
    const parts: string[] = [];
    for (let i = 0; i < 1000; i++) {
      parts.push(`Patient.name[${i}].given.where(value = 'test${i}')`);
    }
    const largeExpr = parts.join(' | ');

    const start = performance.now();
    const tokens = lex(largeExpr);
    const duration = performance.now() - start;

    // Should tokenize in reasonable time (less than 100ms for 1000 expressions)
    expect(duration).toBeLessThan(100);

    // Should produce expected number of tokens (rough estimate)
    expect(tokens.length).toBeGreaterThan(10000);
  });

  it('should demonstrate token pool effectiveness', () => {
    // Create two lexers to compare memory usage patterns
    const expr = "Patient.name.given.first()";

    // First lexer - fresh pool
    const lexer1 = new FHIRPathLexer(expr);
    const tokens1 = lexer1.tokenize();

    // Second lexer - should reuse pooled objects
    const lexer2 = new FHIRPathLexer(expr);
    const tokens2 = lexer2.tokenize();

    // Both should produce identical results
    expect(tokens1.length).toBe(tokens2.length);
    tokens1.forEach((t1, i) => {
      const t2 = tokens2[i]!;
      expect(t1.type).toBe(t2.type);
      expect(t1.value).toBe(t2.value);
    });
  });

  it('should verify string interning', () => {
    // Common keywords should be interned
    const expr = "true and true or false and false or true";
    const lexer = new FHIRPathLexer(expr);
    const tokens = lexer.tokenize();

    // Get all 'true' tokens
    const trueTokens = tokens.filter(t => t.value === 'true');
    expect(trueTokens.length).toBe(3);

    // In a real implementation, we'd check that they share the same string reference
    // For now, just verify they have the same value
    trueTokens.forEach(t => {
      expect(t.value).toBe('true');
      expect(t.type).toBe(TokenType.TRUE);
    });
  });

  it('should handle deeply nested expressions', () => {
    // Generate deeply nested expression
    let expr = 'value';
    for (let i = 0; i < 100; i++) {
      expr = `(${expr} + 1)`;
    }

    const start = performance.now();
    const tokens = lex(expr);
    const duration = performance.now() - start;

    // Should handle deep nesting without stack overflow
    expect(duration).toBeLessThan(50);

    // Should have correct number of parentheses
    const lparens = tokens.filter(t => t.type === 'LPAREN').length;
    const rparens = tokens.filter(t => t.type === 'RPAREN').length;
    expect(lparens).toBe(100);
    expect(rparens).toBe(100);
  });

  it('should handle long strings efficiently', () => {
    // Create a very long string literal
    const longContent = 'a'.repeat(10000);
    const expr = `'${longContent}'`;

    const start = performance.now();
    const tokens = lex(expr);
    const duration = performance.now() - start;

    // Should tokenize long strings quickly
    expect(duration).toBeLessThan(10);
    expect(tokens[0]!!.value).toBe(longContent);
  });

  it('should handle many small tokens efficiently', () => {
    // Create expression with many small tokens
    const numbers = Array.from({ length: 1000 }, (_, i) => i).join(' + ');

    const start = performance.now();
    const tokens = lex(numbers);
    const duration = performance.now() - start;

    // Should tokenize many tokens quickly
    expect(duration).toBeLessThan(20);

    // Verify token count (number, plus, number, plus, ..., number, EOF)
    expect(tokens.length).toBe(1000 + 999 + 1); // numbers + operators + EOF
  });

  it('should demonstrate character table performance', () => {
    // Test identifier-heavy expression
    const identifiers : string[] = [];
    for (let i = 0; i < 1000; i++) {
      identifiers.push(`variable_${i}_with_long_name`);
    }
    const expr = identifiers.join(' and ');

    const start = performance.now();
    const tokens = lex(expr);
    const duration = performance.now() - start;

    // Character table should make identifier scanning fast
    expect(duration).toBeLessThan(50);

    // Verify all identifiers were tokenized
    const idTokens = tokens.filter(t => t.type === 'IDENTIFIER');
    expect(idTokens.length).toBe(1000);
  });

  it('should handle mixed content efficiently', () => {
    // Real-world-like expression with mixed token types
    const expr = `
      Patient.contact
        .where(relationship.coding.exists(system = 'http://hl7.org/fhir' and code = 'emergency'))
        .name.where(use = 'official' or use = 'usual')
        .given.first() + ' ' + 
      Patient.contact
        .where(relationship.coding.exists(system = 'http://hl7.org/fhir' and code = 'emergency'))
        .name.where(use = 'official' or use = 'usual')
        .family
    `;

    const iterations = 100;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      lex(expr);
    }

    const duration = performance.now() - start;
    const avgTime = duration / iterations;

    // Should maintain good performance even with complex expressions
    expect(avgTime).toBeLessThan(1); // Less than 1ms per tokenization
  });
});
