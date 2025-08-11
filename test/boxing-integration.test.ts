import {describe, it, expect} from 'bun:test';
import {evaluate} from '../src/index';

describe('boxing integration', () => {
  it('should evaluate literal values', async () => {
    expect(await evaluate('"hello"')).toEqual(['hello']);
    expect(await evaluate('42')).toEqual([42]);
    expect(await evaluate('true')).toEqual([true]);
  });

  it('should evaluate arithmetic with boxing', async () => {
    expect(await evaluate('2 + 3')).toEqual([5]);
    expect(await evaluate('"Hello" + " " + "World"')).toEqual(['Hello World']);
  });

  it('should navigate properties and preserve primitive extensions', async () => {
    const patient = {
      resourceType: 'Patient',
      gender: 'male',
      _gender: {
        extension: [{
          url: 'http://example.org/gender-identity',
          valueString: 'non-binary'
        }]
      }
    };

    // Basic navigation
    expect(await evaluate('gender', {input: patient})).toEqual(['male']);
    
    // Extension navigation from primitive
    const extensions = await evaluate('gender.extension', {input: patient});
    expect(extensions).toHaveLength(1);
    expect(extensions[0]).toEqual({
      url: 'http://example.org/gender-identity',
      valueString: 'non-binary'
    });
  });

  it('should evaluate variables', async () => {
    expect(await evaluate('%x + %y', {variables: {x: 10, y: 20}})).toEqual([30]);
  });

  it('should evaluate collections', async () => {
    expect(await evaluate('(1 | 2 | 3)')).toEqual([1, 2, 3]);
  });
});