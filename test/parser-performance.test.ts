import { describe, it, expect } from 'bun:test';
import { parseForEvaluation } from '../src/api';

describe('FHIRPath Parser - Performance', () => {
  it('parses simple navigation < 1ms', () => {
    const start = performance.now();
    parseForEvaluation('Patient.name.given');
    const end = performance.now();
    const duration = end - start;
    
    console.log(`Simple navigation: ${duration.toFixed(3)}ms`);
    expect(duration).toBeLessThan(2); // Allow up to 2ms for first parse
  });
  
  it('parses complex query < 5ms', () => {
    const start = performance.now();
    parseForEvaluation("Bundle.entry.resource.where(status = 'active').name.given");
    const end = performance.now();
    const duration = end - start;
    
    console.log(`Complex query: ${duration.toFixed(3)}ms`);
    expect(duration).toBeLessThan(5);
  });
  
  it('handles deeply nested expressions efficiently', () => {
    // Create a deeply nested expression
    let expr = '1';
    for (let i = 0; i < 50; i++) {
      expr = `(${expr} + 1)`;
    }
    
    const start = performance.now();
    parseForEvaluation(expr);
    const end = performance.now();
    const duration = end - start;
    
    console.log(`Deeply nested (50 levels): ${duration.toFixed(3)}ms`);
    expect(duration).toBeLessThan(5);
  });
  
  it('handles long navigation chains efficiently', () => {
    // Create a long navigation chain
    const segments = ['Bundle'];
    for (let i = 0; i < 20; i++) {
      segments.push('entry', 'resource');
    }
    segments.push('name', 'given');
    const expr = segments.join('.');
    
    const start = performance.now();
    parseForEvaluation(expr);
    const end = performance.now();
    const duration = end - start;
    
    console.log(`Long navigation chain (${segments.length} segments): ${duration.toFixed(3)}ms`);
    expect(duration).toBeLessThan(5);
  });
  
  it('handles multiple function calls efficiently', () => {
    const expr = "Patient.name.where(use = 'official').given.substring(0, 10).toUpperCase().trim()";
    
    const start = performance.now();
    parseForEvaluation(expr);
    const end = performance.now();
    const duration = end - start;
    
    console.log(`Multiple function calls: ${duration.toFixed(3)}ms`);
    expect(duration).toBeLessThan(3);
  });
  
  it('handles union operations efficiently', () => {
    const expr = 'a | b | c | d | e | f | g | h | i | j | k | l | m | n | o | p';
    
    const start = performance.now();
    parseForEvaluation(expr);
    const end = performance.now();
    const duration = end - start;
    
    console.log(`Union chain (16 operands): ${duration.toFixed(3)}ms`);
    expect(duration).toBeLessThan(2);
  });
  
  it('stress test with mixed operations', () => {
    const expr = `
      Bundle.entry.resource.ofType(Patient)
        .where(
          birthDate > @1990-01-01 and 
          gender = 'male' and 
          name.given.exists() and
          address.where(use = 'home').city.startsWith('New')
        )
        .name
        .where(use = 'official' or use = 'usual')
        .given
        .first() + ' ' + 
      Bundle.entry.resource.ofType(Patient)
        .name
        .where(use = 'official' or use = 'usual')
        .family
        .first()
    `;
    
    const start = performance.now();
    parseForEvaluation(expr);
    const end = performance.now();
    const duration = end - start;
    
    console.log(`Complex mixed expression: ${duration.toFixed(3)}ms`);
    expect(duration).toBeLessThan(10);
  });
  
  it('measures memory efficiency with repeated parsing', () => {
    const expr = "Patient.name.where(given = 'John' and family = 'Doe').given.first()";
    const iterations = 1000;
    
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      parseForEvaluation(expr);
    }
    const end = performance.now();
    const totalDuration = end - start;
    const avgDuration = totalDuration / iterations;
    
    console.log(`Average time per parse (${iterations} iterations): ${avgDuration.toFixed(3)}ms`);
    expect(avgDuration).toBeLessThan(0.5); // Should be very fast on average
  });
});