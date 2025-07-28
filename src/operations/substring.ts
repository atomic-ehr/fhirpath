import type { FHIRPathFunction } from '../registry';

export const substringFunction: FHIRPathFunction = {
  name: 'substring',
  category: ['string'],
  description: 'Returns a substring of the input string',
  examples: ['"Hello".substring(1, 3)'],
  signature: {
    input: { type: 'String', singleton: true },
    parameters: [
      { name: 'start', type: { type: 'Integer', singleton: true } },
      { name: 'length', optional: true, type: { type: 'Integer', singleton: true } }
    ],
    result: { type: 'String', singleton: true },
  }
};