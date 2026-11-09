import {describe, it, expect} from 'bun:test';
import {evaluate} from '../src/index.node';

// https://github.com/atomic-ehr/fhirpath/issues/9
describe('navigation does not treat same-prefix siblings as choice types', () => {
  const med = (repeat: Record<string, unknown>) => ({
    resourceType: 'MedicationRequest',
    dosageInstruction: [{timing: {repeat}}],
  });
  const path = 'MedicationRequest.dosageInstruction.timing.repeat.';

  const cases: Array<[Record<string, unknown>, string, unknown[]]> = [
    [{period: 1, periodUnit: 'd'}, 'period', [1]],
    [{period: 1, periodMax: 3}, 'period', [1]],
    [{period: 1, periodMax: 3, periodUnit: 'd'}, 'period', [1]],
    [{frequency: 1, frequencyMax: 2}, 'frequency', [1]],
    [{duration: 10, durationMax: 20, durationUnit: 'min'}, 'duration', [10]],
    [{count: 3, countMax: 5}, 'count', [3]],
    [{period: 1, periodMax: 3, periodUnit: 'd'}, 'periodMax', [3]],
    [{period: 1, periodUnit: 'd'}, 'periodUnit', ['d']],
    [{periodUnit: 'd'}, 'period', []],
  ];

  for (const [repeat, prop, expected] of cases) {
    it(`${prop} with ${JSON.stringify(repeat)}`, async () => {
      expect(await evaluate(path + prop, {input: med(repeat)})).toEqual(expected);
    });
  }

  it('plain JSON', async () => {
    expect(await evaluate('a', {input: {a: 1, aMax: 3, aUnit: 'd'}})).toEqual([1]);
  });

  it('still resolves choice types', async () => {
    const input = {resourceType: 'Observation', valueQuantity: {value: 5, unit: 'mg'}};
    expect(await evaluate('Observation.value.value', {input})).toEqual([5]);
    const timing = {repeat: {boundsDuration: {value: 2}, period: 1}};
    expect(await evaluate('repeat.bounds.value', {input: timing})).toEqual([2]);
    // R6 PlanDefinition.action.timing[x] allows RelativeTime
    const action = {timingRelativeTime: {contextPath: 'x', offsetDuration: {value: 1, unit: 'd'}}};
    expect(await evaluate('timing.offset.value', {input: action})).toEqual([1]);
  });
});
