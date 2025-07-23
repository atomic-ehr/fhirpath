import { describe, it } from 'bun:test';
import { expectEvaluation, expectEvaluationError } from '../../setup';

describe('String Functions Extended', () => {
  describe('contains()', () => {
    it('should check if string contains substring', () => {
      expectEvaluation("'hello world'.contains('world')", [], [true]);
      expectEvaluation("'hello world'.contains('foo')", [], [false]);
    });

    it('should return empty for empty input', () => {
      expectEvaluation("contains('test')", [], []);
    });

    it('should validate argument type', () => {
      expectEvaluationError("'hello'.contains(123)", [], 'contains() substring must be a string');
    });

    it('should require argument', () => {
      expectEvaluationError("'hello'.contains()", [], 'Function contains expects at least 1 arguments, got 0');
    });
  });

  describe('length()', () => {
    it('should return string length', () => {
      expectEvaluation("'hello'.length()", [], [5]);
      expectEvaluation("''.length()", [], [0]);
    });

    it('should return empty for empty input', () => {
      expectEvaluation('length()', [], []);
    });

    it('should only work on strings', () => {
      expectEvaluationError('123.length()', [], 'length() requires string input');
    });
  });

  describe('substring()', () => {
    it('should extract substring with start only', () => {
      expectEvaluation("'hello world'.substring(6)", [], ['world']);
    });

    it('should extract substring with start and length', () => {
      expectEvaluation("'hello world'.substring(0, 5)", [], ['hello']);
      expectEvaluation("'hello world'.substring(6, 5)", [], ['world']);
    });

    it('should return empty string for out of bounds start', () => {
      expectEvaluation("'hello'.substring(10)", [], ['']);
    });

    it('should return empty for empty input', () => {
      expectEvaluation('substring(0)', [], []);
    });

    it('should validate argument types', () => {
      expectEvaluationError("'hello'.substring('not a number')", [], 'substring() start must be an integer');
      expectEvaluationError("'hello'.substring(0, 'not a number')", [], 'substring() length must be an integer');
    });
  });

  describe('startsWith()', () => {
    it('should check if string starts with prefix', () => {
      expectEvaluation("'hello world'.startsWith('hello')", [], [true]);
      expectEvaluation("'hello world'.startsWith('world')", [], [false]);
    });

    it('should return empty for empty input', () => {
      expectEvaluation("startsWith('test')", [], []);
    });

    it('should validate argument type', () => {
      expectEvaluationError("'hello'.startsWith(123)", [], 'startsWith() prefix must be a string');
    });
  });

  describe('endsWith()', () => {
    it('should check if string ends with suffix', () => {
      expectEvaluation("'hello world'.endsWith('world')", [], [true]);
      expectEvaluation("'hello world'.endsWith('hello')", [], [false]);
    });

    it('should return empty for empty input', () => {
      expectEvaluation("endsWith('test')", [], []);
    });

    it('should validate argument type', () => {
      expectEvaluationError("'hello'.endsWith(123)", [], 'endsWith() suffix must be a string');
    });
  });

  describe('upper()', () => {
    it('should convert string to uppercase', () => {
      expectEvaluation("'Hello World'.upper()", [], ['HELLO WORLD']);
      expectEvaluation("'hello'.upper()", [], ['HELLO']);
    });

    it('should return empty for empty input', () => {
      expectEvaluation('upper()', [], []);
    });

    it('should only work on strings', () => {
      expectEvaluationError('123.upper()', [], 'upper() requires string input');
    });
  });

  describe('lower()', () => {
    it('should convert string to lowercase', () => {
      expectEvaluation("'Hello World'.lower()", [], ['hello world']);
      expectEvaluation("'HELLO'.lower()", [], ['hello']);
    });

    it('should return empty for empty input', () => {
      expectEvaluation('lower()', [], []);
    });

    it('should only work on strings', () => {
      expectEvaluationError('123.lower()', [], 'lower() requires string input');
    });
  });

  describe('replace()', () => {
    it('should replace all occurrences', () => {
      expectEvaluation("'hello world world'.replace('world', 'FHIRPath')", [], ['hello FHIRPath FHIRPath']);
      expectEvaluation("'test test'.replace('test', 'best')", [], ['best best']);
    });

    it('should return empty for empty input', () => {
      expectEvaluation("replace('test', 'best')", [], []);
    });

    it('should validate argument types', () => {
      expectEvaluationError("'hello'.replace(123, 'world')", [], 'replace() pattern must be a string');
      expectEvaluationError("'hello'.replace('l', 123)", [], 'replace() substitution must be a string');
    });

    it('should require arguments', () => {
      expectEvaluationError("'hello'.replace()", [], 'Function replace expects at least 2 arguments, got 0');
      expectEvaluationError("'hello'.replace('l')", [], 'Function replace expects at least 2 arguments, got 1');
    });
  });

  describe('indexOf()', () => {
    it('should find substring position', () => {
      expectEvaluation("'hello world'.indexOf('world')", [], [6]);
      expectEvaluation("'hello world'.indexOf('hello')", [], [0]);
    });

    it('should return empty when not found', () => {
      expectEvaluation("'hello'.indexOf('world')", [], []);
    });

    it('should return empty for empty input', () => {
      expectEvaluation("indexOf('test')", [], []);
    });

    it('should validate argument type', () => {
      expectEvaluationError("'hello'.indexOf(123)", [], 'indexOf() substring must be a string');
    });

    it('should require argument', () => {
      expectEvaluationError("'hello'.indexOf()", [], 'Function indexOf expects at least 1 arguments, got 0');
    });
  });

  describe('substring() with dynamic length', () => {
    it('should work with length() in expressions', () => {
      expectEvaluation("substring(0, length() - 2)", ["1234"], ['12']);
      expectEvaluation("substring(1, length() - 1)", ["hello"], ['ello']);
    });

    it('should work in complex select expressions', () => {
      const input = [{name: ['aaa']}];
      expectEvaluation("name.select( 'b1b2b3b4'.select(substring(0, length() - 2)) )", input, ['b1b2b3']);
      expectEvaluation("name.select( 'bbbbbb'.substring(0, length() - 2) )", input, ['b']);
    });
  });
});