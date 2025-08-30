import { describe, it, expect } from 'bun:test';
import { evaluate, analyze } from '../../src/index';
import { DiagnosticSeverity } from '../../src/types';
import { FHIRPathError, ErrorCodes } from '../../src/errors';

describe('index error handling and diagnostics', () => {
  it('evaluate throws FHIRPathError for parse errors', async () => {
    await expect(evaluate('5 +')).rejects.toBeInstanceOf(FHIRPathError);
    try {
      await evaluate('5 +');
    } catch (e) {
      const err = e as FHIRPathError;
      expect(err.code.startsWith('FP5')).toBe(true); // syntax family
    }
  });

  it('analyze returns diagnostics (no throw) for parse errors with errorRecovery', async () => {
    const result = await analyze('5 +', { errorRecovery: true });
    expect(result.diagnostics.length).toBeGreaterThan(0);
    const hasSyntax = result.diagnostics.some(d => typeof d.code === 'string' ? (d.code as string).startsWith('FP5') : true);
    expect(hasSyntax).toBe(true);
  });

  it('evaluate throws FHIRPathError with FP1002 for unknown function', async () => {
    await expect(evaluate('1.foo()')).rejects.toBeInstanceOf(FHIRPathError);
    try {
      await evaluate('1.foo()');
    } catch (e) {
      const err = e as FHIRPathError;
      expect(err.code).toBe(ErrorCodes.UNKNOWN_FUNCTION);
    }
  });

  it('analyze reports UNKNOWN_USER_VARIABLE with DiagnosticSeverity.Error', async () => {
    const res = await analyze('%x + 1');
    const diag = res.diagnostics.find(d => d.code === ErrorCodes.UNKNOWN_USER_VARIABLE);
    expect(diag).toBeTruthy();
    expect(diag?.severity).toBe(DiagnosticSeverity.Error);
  });
});
