import { describe, it, expect } from 'bun:test';
import { inspect, parse } from '../../src/api';

describe('inspect() function', () => {
  it('should return basic result with traces', () => {
    const result = inspect(
      "name.trace('names').given.trace('given names')",
      { name: [{ given: ["John", "Jane"] }] }
    );
    
    expect(result.result).toEqual(["John", "Jane"]);
    expect(result.traces).toHaveLength(2);
    expect(result.traces[0]!.name).toBe("names");
    expect(result.traces[0]!.values).toEqual([{ given: ["John", "Jane"] }]);
    expect(result.traces[1]!.name).toBe("given names");
    expect(result.traces[1]!.values).toEqual(["John", "Jane"]);
    expect(result.expression).toBe("name.trace('names').given.trace('given names')");
    expect(result.ast).toBeDefined();
    expect(result.executionTime).toBeGreaterThan(0);
  });

  it('should work with simple expressions', () => {
    const result = inspect('5 + 3');
    
    expect(result.result).toEqual([8]);
    expect(result.traces).toHaveLength(0);
    expect(result.expression).toBe('5 + 3');
    expect(result.executionTime).toBeGreaterThan(0);
  });

  it('should work with empty input', () => {
    const result = inspect('$this');
    
    expect(result.result).toEqual([]);
    expect(result.traces).toHaveLength(0);
  });

  it('should capture errors', () => {
    const result = inspect('unknownFunction()');
    
    expect(result.errors).toBeDefined();
    expect(result.errors![0]!.message).toContain('unknownFunction');
    expect(result.result).toEqual([]);
  });

  it('should work with pre-parsed expressions', () => {
    const expr = parse('name.given');
    const result = inspect(expr, { name: [{ given: ["Alice"] }] });
    
    expect(result.result).toEqual(["Alice"]);
    expect(result.ast).toBe(expr.ast);
  });

  it('should capture traces at different depths', () => {
    const result = inspect(
      "Patient.where(name.trace('filtering').given.contains('J')).trace('matched patients').name.given",
      {
        Patient: [
          { name: [{ given: ['John'] }] },
          { name: [{ given: ['Jane'] }] },
          { name: [{ given: ['Bob'] }] }
        ]
      }
    );
    
    expect(result.traces).toHaveLength(4); // 2 filtering + 2 matched patients  
    expect(result.traces[0]!.name).toBe('filtering');
    
    const matchedTraces = result.traces.filter(t => t.name === 'matched patients');
    expect(matchedTraces).toHaveLength(1);
  });

  it('should support custom context variables', () => {
    const result = inspect(
      '%x + %y',
      undefined,
      { variables: { x: 10, y: 20 } }
    );
    
    expect(result.result).toEqual([30]);
  });

  it('should trace with selector expressions', () => {
    const result = inspect(
      "Patient.trace('patient data', name)",
      { Patient: [{ id: '123', name: [{ given: ['John'] }] }] }
    );
    
    expect(result.traces).toHaveLength(1);
    expect(result.traces[0]!.name).toBe('patient data');
    expect(result.traces[0]!.values).toEqual([{ given: ['John'] }]);
  });

  it('should limit traces when maxTraces is set', () => {
    const result = inspect(
      "Patient.name.trace('name1').trace('name2').trace('name3')",
      { Patient: [{ name: [{ given: ["John"] }] }] },
      undefined,
      { maxTraces: 2 }
    );
    
    expect(result.traces).toHaveLength(2);
    expect(result.traces[0]!.name).toBe('name1');
    expect(result.traces[1]!.name).toBe('name2');
  });

  it('should measure execution time accurately', () => {
    const result1 = inspect('1 + 1');
    const result2 = inspect('(1 | 2 | 3 | 4 | 5).aggregate(($total + $this), 0)');
    
    expect(result2.executionTime).toBeGreaterThan(result1.executionTime);
  });

  it('should work with complex expressions', () => {
    const result = inspect(
      "Patient.name.where(use = 'official').trace('official names').given | Patient.name.where(use = 'nickname').trace('nicknames').given",
      {
        Patient: [{
          name: [
            { use: "official", given: ["John", "James"] },
            { use: "nickname", given: ["Johnny"] }
          ]
        }]
      }
    );
    
    expect(result.result).toEqual(["John", "James", "Johnny"]);
    expect(result.traces).toHaveLength(2);
    expect(result.traces[0]!.name).toBe('official names');
    expect(result.traces[0]!.values).toEqual([{ use: 'official', given: ['John', 'James'] }]);
    expect(result.traces[1]!.name).toBe('nicknames');
    expect(result.traces[1]!.values).toEqual([{ use: 'nickname', given: ['Johnny'] }]);
  });

  it('should handle trace without parameters', () => {
    const result = inspect(
      'name.trace().given',
      { name: [{ given: ["Alice"] }] }
    );
    
    expect(result.traces).toHaveLength(1);
    expect(result.traces[0]!.name).toBe('trace');
    expect(result.traces[0]!.values).toEqual([{ given: ["Alice"] }]);
  });
});