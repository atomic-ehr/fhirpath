import { describe, it, expect } from 'bun:test';
import {
  createQuantity,
  getUcumQuantity,
  isValidQuantity,
  addQuantities,
  subtractQuantities,
  multiplyQuantities,
  divideQuantities,
  compareQuantities,
  equalQuantities,
  quantityToString,
  CALENDAR_DURATION_UNITS
} from '../src/quantity-value';

describe('Quantity Value', () => {
  describe('createQuantity', () => {
    it('should create a quantity with UCUM unit', async () => {
      const q = createQuantity(5, 'mg');
      expect(q.value).toBe(5);
      expect(q.unit).toBe('mg');
    });

    it('should preserve calendar units without conversion', async () => {
      const q = createQuantity(1, 'year');
      expect(q.value).toBe(1);
      expect(q.unit).toBe('year'); // Should NOT convert to UCUM
    });

    it('should handle plural calendar units without conversion', async () => {
      const q = createQuantity(3, 'years');
      expect(q.value).toBe(3);
      expect(q.unit).toBe('years'); // Should NOT convert to UCUM
    });
  });

  describe('getUcumQuantity', () => {
    it('should create UCUM quantity on first call', async () => {
      const q = createQuantity(5, 'mg');
      expect(q._ucumQuantity).toBeUndefined();
      
      const ucumQ = getUcumQuantity(q);
      expect(ucumQ).not.toBeNull();
      expect(ucumQ?.value).toBe(5);
      expect(ucumQ?.unit).toBe('mg');
      expect(q._ucumQuantity).toBeDefined();
    });

    it('should return null for invalid units', async () => {
      const q = createQuantity(5, 'invalid-unit');
      const ucumQ = getUcumQuantity(q);
      expect(ucumQ).toBeNull();
    });

    it('should cache UCUM quantity', async () => {
      const q = createQuantity(5, 'mg');
      const ucumQ1 = getUcumQuantity(q);
      const ucumQ2 = getUcumQuantity(q);
      expect(ucumQ1).toBe(ucumQ2); // Same object reference
    });
  });

  describe('isValidQuantity', () => {
    it('should return true for valid units', async () => {
      expect(isValidQuantity(createQuantity(5, 'mg'))).toBe(true);
      expect(isValidQuantity(createQuantity(1, 'g'))).toBe(true);
      expect(isValidQuantity(createQuantity(100, 'km'))).toBe(true);
    });

    it('should return false for invalid units', async () => {
      expect(isValidQuantity(createQuantity(5, 'xyz'))).toBe(false);
      expect(isValidQuantity(createQuantity(5, ''))).toBe(false);
    });

    it('should return true for calendar duration units', async () => {
      expect(isValidQuantity(createQuantity(1, 'year'))).toBe(true);
      expect(isValidQuantity(createQuantity(1, 'years'))).toBe(true);
      expect(isValidQuantity(createQuantity(1, 'month'))).toBe(true);
      expect(isValidQuantity(createQuantity(1, 'day'))).toBe(true);
      expect(isValidQuantity(createQuantity(1, 'hour'))).toBe(true);
      expect(isValidQuantity(createQuantity(1, 'minute'))).toBe(true);
      expect(isValidQuantity(createQuantity(1, 'second'))).toBe(true);
    });
  });

  describe('addQuantities', () => {
    it('should add quantities with same unit', async () => {
      const q1 = createQuantity(5, 'mg');
      const q2 = createQuantity(3, 'mg');
      const result = addQuantities(q1, q2);
      
      expect(result).not.toBeNull();
      expect(result?.value).toBe(8);
      expect(result?.unit).toBe('mg');
    });

    it('should add quantities with compatible units', async () => {
      const q1 = createQuantity(1, 'g');
      const q2 = createQuantity(500, 'mg');
      const result = addQuantities(q1, q2);
      
      expect(result).not.toBeNull();
      expect(result?.value).toBe(1.5);
      expect(result?.unit).toBe('g');
    });

    it('should return null for incompatible units', async () => {
      const q1 = createQuantity(5, 'mg');
      const q2 = createQuantity(3, 'm');
      const result = addQuantities(q1, q2);
      
      expect(result).toBeNull();
    });

    it('should return null for invalid units', async () => {
      const q1 = createQuantity(5, 'invalid');
      const q2 = createQuantity(3, 'mg');
      const result = addQuantities(q1, q2);
      
      expect(result).toBeNull();
    });
  });

  describe('subtractQuantities', () => {
    it('should subtract quantities with same unit', async () => {
      const q1 = createQuantity(10, 'mg');
      const q2 = createQuantity(3, 'mg');
      const result = subtractQuantities(q1, q2);
      
      expect(result).not.toBeNull();
      expect(result?.value).toBe(7);
      expect(result?.unit).toBe('mg');
    });

    it('should subtract quantities with compatible units', async () => {
      const q1 = createQuantity(1, 'g');
      const q2 = createQuantity(200, 'mg');
      const result = subtractQuantities(q1, q2);
      
      expect(result).not.toBeNull();
      expect(result?.value).toBe(0.8);
      expect(result?.unit).toBe('g');
    });
  });

  describe('multiplyQuantities', () => {
    it('should multiply quantities', async () => {
      const q1 = createQuantity(3, 'm');
      const q2 = createQuantity(4, 'm');
      const result = multiplyQuantities(q1, q2);
      
      expect(result).not.toBeNull();
      expect(result?.value).toBe(12);
      expect(result?.unit).toBe('m.m');
    });

    it('should handle area calculation', async () => {
      const q1 = createQuantity(5, 'cm');
      const q2 = createQuantity(10, 'cm');
      const result = multiplyQuantities(q1, q2);
      
      expect(result).not.toBeNull();
      expect(result?.value).toBe(50);
      expect(result?.unit).toBe('cm.cm');
    });

    it('should throw error for multiplying two calendar duration units', async () => {
      const q1 = createQuantity(2, 'year');
      const q2 = createQuantity(3, 'month');
      
      expect(() => multiplyQuantities(q1, q2)).toThrow('Cannot multiply calendar duration units: year * month');
    });

    it('should multiply calendar duration by dimensionless number', async () => {
      const q1 = createQuantity(1, 'year');
      const q2 = createQuantity(2, '1');
      const result = multiplyQuantities(q1, q2);
      
      expect(result).not.toBeNull();
      expect(result?.value).toBe(2);
      expect(result?.unit).toBe('year');
    });

    it('should multiply dimensionless number by calendar duration', async () => {
      const q1 = createQuantity(3, '1');
      const q2 = createQuantity(4, 'month');
      const result = multiplyQuantities(q1, q2);
      
      expect(result).not.toBeNull();
      expect(result?.value).toBe(12);
      expect(result?.unit).toBe('month');
    });
  });

  describe('divideQuantities', () => {
    it('should divide quantities', async () => {
      const q1 = createQuantity(12, 'm2');
      const q2 = createQuantity(3, 'm');
      const result = divideQuantities(q1, q2);
      
      expect(result).not.toBeNull();
      expect(result?.value).toBe(4);
      expect(result?.unit).toBe('m2/m');
    });

    it('should handle velocity calculation', async () => {
      const q1 = createQuantity(100, 'km');
      const q2 = createQuantity(2, 'h');
      const result = divideQuantities(q1, q2);
      
      expect(result).not.toBeNull();
      expect(result?.value).toBe(50);
      expect(result?.unit).toBe('km/h');
    });

    it('should handle same units canceling', async () => {
      const q1 = createQuantity(10, 'mg');
      const q2 = createQuantity(5, 'mg');
      const result = divideQuantities(q1, q2);
      
      expect(result).not.toBeNull();
      expect(result?.value).toBe(2);
      expect(result?.unit).toBe('1'); // Dimensionless
    });

    it('should throw error for dividing calendar duration units', async () => {
      const q1 = createQuantity(12, 'month');
      const q2 = createQuantity(3, 'day');
      
      expect(() => divideQuantities(q1, q2)).toThrow('Cannot divide calendar duration units: month / day');
    });

    it('should divide calendar duration by dimensionless number', async () => {
      const q1 = createQuantity(10, 'month');
      const q2 = createQuantity(2, '1');
      const result = divideQuantities(q1, q2);
      
      expect(result).not.toBeNull();
      expect(result?.value).toBe(5);
      expect(result?.unit).toBe('month');
    });
  });

  describe('compareQuantities', () => {
    it('should compare quantities with same unit', async () => {
      const q1 = createQuantity(5, 'mg');
      const q2 = createQuantity(3, 'mg');
      const q3 = createQuantity(5, 'mg');
      
      expect(compareQuantities(q1, q2)).toBe(1); // q1 > q2
      expect(compareQuantities(q2, q1)).toBe(-1); // q2 < q1
      expect(compareQuantities(q1, q3)).toBe(0); // q1 = q3
    });

    it('should compare quantities with compatible units', async () => {
      const q1 = createQuantity(1, 'g');
      const q2 = createQuantity(500, 'mg');
      
      expect(compareQuantities(q1, q2)).toBe(1); // 1g > 500mg
    });

    it('should return null for incompatible units', async () => {
      const q1 = createQuantity(5, 'mg');
      const q2 = createQuantity(3, 'm');
      
      expect(compareQuantities(q1, q2)).toBeNull();
    });
  });

  describe('equalQuantities', () => {
    it('should check equality with same unit', async () => {
      const q1 = createQuantity(5, 'mg');
      const q2 = createQuantity(5, 'mg');
      const q3 = createQuantity(3, 'mg');
      
      expect(equalQuantities(q1, q2)).toBe(true);
      expect(equalQuantities(q1, q3)).toBe(false);
    });

    it('should check equality with unit conversion', async () => {
      const q1 = createQuantity(1, 'g');
      const q2 = createQuantity(1000, 'mg');
      
      expect(equalQuantities(q1, q2)).toBe(true);
    });

    it('should return false for incompatible units', async () => {
      const q1 = createQuantity(5, 'mg');
      const q2 = createQuantity(5, 'm');
      
      expect(equalQuantities(q1, q2)).toBe(false);
    });
  });

  describe('quantityToString', () => {
    it('should format quantity as string', async () => {
      const q = createQuantity(5, 'mg');
      expect(quantityToString(q)).toBe("5 'mg'");
    });
  });

  describe('CALENDAR_DURATION_UNITS set', () => {
    it('should have all calendar units defined', async () => {
      expect(CALENDAR_DURATION_UNITS.has('year')).toBe(true);
      expect(CALENDAR_DURATION_UNITS.has('years')).toBe(true);
      expect(CALENDAR_DURATION_UNITS.has('month')).toBe(true);
      expect(CALENDAR_DURATION_UNITS.has('months')).toBe(true);
      expect(CALENDAR_DURATION_UNITS.has('week')).toBe(true);
      expect(CALENDAR_DURATION_UNITS.has('weeks')).toBe(true);
      expect(CALENDAR_DURATION_UNITS.has('day')).toBe(true);
      expect(CALENDAR_DURATION_UNITS.has('days')).toBe(true);
      expect(CALENDAR_DURATION_UNITS.has('hour')).toBe(true);
      expect(CALENDAR_DURATION_UNITS.has('hours')).toBe(true);
      expect(CALENDAR_DURATION_UNITS.has('minute')).toBe(true);
      expect(CALENDAR_DURATION_UNITS.has('minutes')).toBe(true);
      expect(CALENDAR_DURATION_UNITS.has('second')).toBe(true);
      expect(CALENDAR_DURATION_UNITS.has('seconds')).toBe(true);
      expect(CALENDAR_DURATION_UNITS.has('millisecond')).toBe(true);
      expect(CALENDAR_DURATION_UNITS.has('milliseconds')).toBe(true);
    });
  });

  describe('Calendar duration operations', () => {
    it('should add calendar durations with same unit', async () => {
      const q1 = createQuantity(1, 'year');
      const q2 = createQuantity(2, 'year');
      const result = addQuantities(q1, q2);
      
      expect(result).not.toBeNull();
      expect(result?.value).toBe(3);
      expect(result?.unit).toBe('year');
    });

    it('should not add calendar durations with different units', async () => {
      const q1 = createQuantity(1, 'year');
      const q2 = createQuantity(6, 'months');
      const result = addQuantities(q1, q2);
      
      // Different calendar units cannot be added
      expect(result).toBeNull();
    });

    it('should subtract calendar durations with same unit', async () => {
      const q1 = createQuantity(3, 'month');
      const q2 = createQuantity(1, 'month');
      const result = subtractQuantities(q1, q2);
      
      expect(result).not.toBeNull();
      expect(result?.value).toBe(2);
      expect(result?.unit).toBe('month');
    });

    it('should compare calendar durations with same unit', async () => {
      const q1 = createQuantity(2, 'year');
      const q2 = createQuantity(1, 'year');
      const q3 = createQuantity(2, 'year');
      
      expect(compareQuantities(q1, q2)).toBe(1); // 2 year > 1 year
      expect(compareQuantities(q2, q1)).toBe(-1); // 1 year < 2 year
      expect(compareQuantities(q1, q3)).toBe(0); // 2 year = 2 year
    });

    it('should not compare calendar durations with different units', async () => {
      const q1 = createQuantity(1, 'year');
      const q2 = createQuantity(11, 'months');
      
      // Different calendar units cannot be compared
      expect(compareQuantities(q1, q2)).toBeNull();
    });
  });

  describe('Temperature conversions', () => {
    it('should compare temperatures', async () => {
      const q1 = createQuantity(0, 'Cel');
      const q2 = createQuantity(32, '[degF]');
      
      // 0°C = 32°F
      expect(equalQuantities(q1, q2)).toBe(true);
    });
  });
});