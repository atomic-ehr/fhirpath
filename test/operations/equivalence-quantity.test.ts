import { describe, it, expect } from 'bun:test';
import { equivalent } from '../../src/operations/comparison';
import type { QuantityValue } from '../../src/complex-types/quantity-value';

describe('Quantity Equivalence', () => {
  describe('Calendar to UCUM mappings', () => {
    it('should treat year and UCUM annum as equivalent', () => {
      const yearQ: QuantityValue = { value: 1, unit: 'year' };
      const annumQ: QuantityValue = { value: 1, unit: 'a' };
      expect(equivalent(yearQ, annumQ)).toBe(true);
      
      const yearsQ: QuantityValue = { value: 2, unit: 'years' };
      const annumsQ: QuantityValue = { value: 2, unit: 'a' };
      expect(equivalent(yearsQ, annumsQ)).toBe(true);
    });

    it('should treat month and UCUM month as equivalent', () => {
      const monthQ: QuantityValue = { value: 3, unit: 'month' };
      const moQ: QuantityValue = { value: 3, unit: 'mo' };
      expect(equivalent(monthQ, moQ)).toBe(true);
      
      const monthsQ: QuantityValue = { value: 6, unit: 'months' };
      const mosQ: QuantityValue = { value: 6, unit: 'mo' };
      expect(equivalent(monthsQ, mosQ)).toBe(true);
    });

    it('should treat week and UCUM week as equivalent', () => {
      const weekQ: QuantityValue = { value: 1, unit: 'week' };
      const wkQ: QuantityValue = { value: 1, unit: 'wk' };
      expect(equivalent(weekQ, wkQ)).toBe(true);
      
      const weeksQ: QuantityValue = { value: 4, unit: 'weeks' };
      const wksQ: QuantityValue = { value: 4, unit: 'wk' };
      expect(equivalent(weeksQ, wksQ)).toBe(true);
    });

    it('should treat day and UCUM day as equivalent', () => {
      const dayQ: QuantityValue = { value: 7, unit: 'day' };
      const dQ: QuantityValue = { value: 7, unit: 'd' };
      expect(equivalent(dayQ, dQ)).toBe(true);
      
      const daysQ: QuantityValue = { value: 30, unit: 'days' };
      const dsQ: QuantityValue = { value: 30, unit: 'd' };
      expect(equivalent(daysQ, dsQ)).toBe(true);
    });

    it('should treat hour and UCUM hour as equivalent', () => {
      const hourQ: QuantityValue = { value: 24, unit: 'hour' };
      const hQ: QuantityValue = { value: 24, unit: 'h' };
      expect(equivalent(hourQ, hQ)).toBe(true);
      
      const hoursQ: QuantityValue = { value: 48, unit: 'hours' };
      const hsQ: QuantityValue = { value: 48, unit: 'h' };
      expect(equivalent(hoursQ, hsQ)).toBe(true);
    });

    it('should treat minute and UCUM minute as equivalent', () => {
      const minuteQ: QuantityValue = { value: 60, unit: 'minute' };
      const minQ: QuantityValue = { value: 60, unit: 'min' };
      expect(equivalent(minuteQ, minQ)).toBe(true);
      
      const minutesQ: QuantityValue = { value: 120, unit: 'minutes' };
      const minsQ: QuantityValue = { value: 120, unit: 'min' };
      expect(equivalent(minutesQ, minsQ)).toBe(true);
    });

    it('should treat second and UCUM second as equivalent', () => {
      const secondQ: QuantityValue = { value: 60, unit: 'second' };
      const sQ: QuantityValue = { value: 60, unit: 's' };
      expect(equivalent(secondQ, sQ)).toBe(true);
      
      const secondsQ: QuantityValue = { value: 3600, unit: 'seconds' };
      const ssQ: QuantityValue = { value: 3600, unit: 's' };
      expect(equivalent(secondsQ, ssQ)).toBe(true);
    });

    it('should treat millisecond and UCUM millisecond as equivalent', () => {
      const millisecondQ: QuantityValue = { value: 1000, unit: 'millisecond' };
      const msQ: QuantityValue = { value: 1000, unit: 'ms' };
      expect(equivalent(millisecondQ, msQ)).toBe(true);
      
      const millisecondsQ: QuantityValue = { value: 5000, unit: 'milliseconds' };
      const mssQ: QuantityValue = { value: 5000, unit: 'ms' };
      expect(equivalent(millisecondsQ, mssQ)).toBe(true);
    });

    it('should handle bidirectional equivalence', () => {
      const yearQ: QuantityValue = { value: 1, unit: 'year' };
      const annumQ: QuantityValue = { value: 1, unit: 'a' };
      
      expect(equivalent(yearQ, annumQ)).toBe(true);
      expect(equivalent(annumQ, yearQ)).toBe(true);
    });

    it('should not be equivalent when values differ', () => {
      const yearQ: QuantityValue = { value: 1, unit: 'year' };
      const annumQ: QuantityValue = { value: 2, unit: 'a' };
      expect(equivalent(yearQ, annumQ)).toBe(false);
    });

    it('should NOT convert between different calendar units', () => {
      // 1 year is NOT equivalent to 12 months in calendar duration
      const yearQ: QuantityValue = { value: 1, unit: 'year' };
      const monthsQ: QuantityValue = { value: 12, unit: 'months' };
      expect(equivalent(yearQ, monthsQ)).toBe(false);
      
      // 1 year is NOT equivalent to 365.25 days
      const daysQ: QuantityValue = { value: 365.25, unit: 'd' };
      expect(equivalent(yearQ, daysQ)).toBe(false);
    });
  });

  describe('Calendar duration comparison', () => {
    it('should compare same calendar units', () => {
      const year1: QuantityValue = { value: 2, unit: 'years' };
      const year2: QuantityValue = { value: 2, unit: 'years' };
      expect(equivalent(year1, year2)).toBe(true);
      
      const year3: QuantityValue = { value: 3, unit: 'years' };
      expect(equivalent(year1, year3)).toBe(false);
    });

    it('should handle singular and plural forms', () => {
      const year1: QuantityValue = { value: 1, unit: 'year' };
      const year2: QuantityValue = { value: 1, unit: 'years' };
      // Both map to 'a' in UCUM, so they should be equivalent
      expect(equivalent(year1, year2)).toBe(true);
    });
  });

  describe('UCUM semantic equivalence', () => {
    it('should handle UCUM unit conversions', () => {
      // 1000 mg = 1 g
      const mg: QuantityValue = { value: 1000, unit: 'mg' };
      const g: QuantityValue = { value: 1, unit: 'g' };
      expect(equivalent(mg, g)).toBe(true);
      
      // 1 kg = 1000 g
      const kg: QuantityValue = { value: 1, unit: 'kg' };
      const g1000: QuantityValue = { value: 1000, unit: 'g' };
      expect(equivalent(kg, g1000)).toBe(true);
    });

    it('should handle different UCUM dimensions as not equivalent', () => {
      const kg: QuantityValue = { value: 1, unit: 'kg' };
      const meter: QuantityValue = { value: 1, unit: 'm' };
      expect(equivalent(kg, meter)).toBe(false);
    });
  });

  describe('Mixed calendar and UCUM', () => {
    it('should not mix calendar durations with UCUM time units for conversion', () => {
      // Calendar 'year' maps to UCUM 'a', but doesn't convert to other UCUM time units
      const yearQ: QuantityValue = { value: 1, unit: 'year' };
      const hoursQ: QuantityValue = { value: 8760, unit: 'h' }; // ~365 days * 24 hours
      
      // These should NOT be equivalent even though mathematically they might be close
      // Calendar durations don't convert to other time units
      expect(equivalent(yearQ, hoursQ)).toBe(false);
    });
  });
});