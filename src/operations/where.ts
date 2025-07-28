import type { FHIRPathFunction } from '../registry';

export const whereFunction: FHIRPathFunction = {
  name: 'where',
  category: ['filtering'],
  description: 'Returns a collection containing only those elements for which the expression evaluates to true',
  examples: [
    'Patient.name.where(use = "official")',
    'Bundle.entry.where(resource is Patient)'
  ],
  signature: {
    input: { type: 'Any', singleton: false },
    parameters: [{
      name: 'criteria',
      type: { type: 'Boolean', singleton: true }
    }],
    result: { type: 'Any', singleton: false },
  }
};