import { describe, it, expect } from 'bun:test';
import { evaluate, parseForEvaluation } from '../../legacy-src';
import { FHIRPathExpression } from '../../legacy-src/api/expression';

describe('API - evaluate', () => {
  it('should evaluate simple literals', () => {
    expect(evaluate('5')).toEqual([5]);
    expect(evaluate('true')).toEqual([true]);
    expect(evaluate('\'hello\'')).toEqual(['hello']);
  });
  
  it('should evaluate arithmetic', () => {
    expect(evaluate('5 + 3')).toEqual([8]);
    expect(evaluate('10 - 4')).toEqual([6]);
    expect(evaluate('3 * 4')).toEqual([12]);
    expect(evaluate('12 / 3')).toEqual([4]);
  });
  
  it('should evaluate with input data', () => {
    const patient = {
      name: [
        { given: ['John', 'James'], family: 'Doe' },
        { given: ['Johnny'], family: 'Doe' }
      ]
    };
    
    expect(evaluate('name.given', patient)).toEqual(['John', 'James', 'Johnny']);
    expect(evaluate('name.family', patient)).toEqual(['Doe', 'Doe']);
  });
  
  it('should accept parsed expression', () => {
    const ast = parseForEvaluation('5 + 3');
    const expr = new FHIRPathExpression(ast, '5 + 3');
    expect(evaluate(expr)).toEqual([8]);
  });
  
  it('should handle empty input', () => {
    expect(evaluate('name')).toEqual([]);
    expect(evaluate('name', null)).toEqual([]);
    expect(evaluate('name', undefined)).toEqual([]);
  });
  
  it('should work with where clause', () => {
    const names = [
      { use: 'official', given: ['John'] },
      { use: 'nickname', given: ['Johnny'] }
    ];
    
    const result = evaluate('where(use = \'official\').given', names);
    expect(result).toEqual(['John']);
  });
  
  it('should handle context variables', () => {
    const result = evaluate('%myVar + 5', undefined, {
      variables: { myVar: 10 }
    });
    expect(result).toEqual([15]);
  });
  
  it('should handle array variables', () => {
    const result = evaluate('%names.given', undefined, {
      variables: { 
        names: [
          { given: ['John'] },
          { given: ['Jane'] }
        ]
      }
    });
    expect(result).toEqual(['John', 'Jane']);
  });
});