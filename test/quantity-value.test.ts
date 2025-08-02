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
  CALENDAR_TO_UCUM
} from '../src/quantity-value';

describe('Quantity Value', () => {
  describe('createQuantity', () => {
    it('should create a quantity with UCUM unit', () => {
      const q = createQuantity(5, 'mg', false);
      expect(q.value).toBe(5);
      expect(q.unit).toBe('mg');
    });

    it('should map calendar units to UCUM', () => {
      const q = createQuantity(1, 'year', true);
      expect(q.value).toBe(1);
      expect(q.unit).toBe('a'); // UCUM unit for year
    });

    it('should handle plural calendar units', () => {
      const q = createQuantity(3, 'years', true);
      expect(q.value).toBe(3);
      expect(q.unit).toBe('a');
    });
  });

  describe('getUcumQuantity', () => {
    it('should create UCUM quantity on first call', () => {
      const q = createQuantity(5, 'mg', false);
      expect(q._ucumQuantity).toBeUndefined();
      
      const ucumQ = getUcumQuantity(q);
      expect(ucumQ).not.toBeNull();
      expect(ucumQ?.value).toBe(5);
      expect(ucumQ?.unit).toBe('mg');
      expect(q._ucumQuantity).toBeDefined();
    });

    it('should return null for invalid units', () => {
      const q = createQuantity(5, 'invalid-unit', false);
      const ucumQ = getUcumQuantity(q);
      expect(ucumQ).toBeNull();
    });

    it('should cache UCUM quantity', () => {
      const q = createQuantity(5, 'mg', false);
      const ucumQ1 = getUcumQuantity(q);
      const ucumQ2 = getUcumQuantity(q);
      expect(ucumQ1).toBe(ucumQ2); // Same object reference
    });
  });

  describe('isValidQuantity', () => {
    it('should return true for valid units', () => {
      expect(isValidQuantity(createQuantity(5, 'mg', false))).toBe(true);
      expect(isValidQuantity(createQuantity(1, 'g', false))).toBe(true);
      expect(isValidQuantity(createQuantity(100, 'km', false))).toBe(true);
    });

    it('should return false for invalid units', () => {
      expect(isValidQuantity(createQuantity(5, 'xyz', false))).toBe(false);
      expect(isValidQuantity(createQuantity(5, '', false))).toBe(false);
    });
  });

  describe('addQuantities', () => {
    it('should add quantities with same unit', () => {
      const q1 = createQuantity(5, 'mg', false);
      const q2 = createQuantity(3, 'mg', false);
      const result = addQuantities(q1, q2);
      
      expect(result).not.toBeNull();
      expect(result?.value).toBe(8);
      expect(result?.unit).toBe('mg');
    });

    it('should add quantities with compatible units', () => {
      const q1 = createQuantity(1, 'g', false);
      const q2 = createQuantity(500, 'mg', false);
      const result = addQuantities(q1, q2);
      
      expect(result).not.toBeNull();
      expect(result?.value).toBe(1.5);
      expect(result?.unit).toBe('g');
    });

    it('should return null for incompatible units', () => {
      const q1 = createQuantity(5, 'mg', false);
      const q2 = createQuantity(3, 'm', false);
      const result = addQuantities(q1, q2);
      
      expect(result).toBeNull();
    });

    it('should return null for invalid units', () => {
      const q1 = createQuantity(5, 'invalid', false);
      const q2 = createQuantity(3, 'mg', false);
      const result = addQuantities(q1, q2);
      
      expect(result).toBeNull();
    });
  });

  describe('subtractQuantities', () => {
    it('should subtract quantities with same unit', () => {
      const q1 = createQuantity(10, 'mg', false);
      const q2 = createQuantity(3, 'mg', false);
      const result = subtractQuantities(q1, q2);
      
      expect(result).not.toBeNull();
      expect(result?.value).toBe(7);
      expect(result?.unit).toBe('mg');
    });

    it('should subtract quantities with compatible units', () => {
      const q1 = createQuantity(1, 'g', false);
      const q2 = createQuantity(200, 'mg', false);
      const result = subtractQuantities(q1, q2);
      
      expect(result).not.toBeNull();
      expect(result?.value).toBe(0.8);
      expect(result?.unit).toBe('g');
    });
  });

  describe('multiplyQuantities', () => {
    it('should multiply quantities', () => {
      const q1 = createQuantity(3, 'm', false);
      const q2 = createQuantity(4, 'm', false);
      const result = multiplyQuantities(q1, q2);
      
      expect(result).not.toBeNull();
      expect(result?.value).toBe(12);
      expect(result?.unit).toBe('m.m');
    });

    it('should handle area calculation', () => {
      const q1 = createQuantity(5, 'cm', false);
      const q2 = createQuantity(10, 'cm', false);
      const result = multiplyQuantities(q1, q2);
      
      expect(result).not.toBeNull();
      expect(result?.value).toBe(50);
      expect(result?.unit).toBe('cm.cm');
    });
  });

  describe('divideQuantities', () => {
    it('should divide quantities', () => {
      const q1 = createQuantity(12, 'm2', false);
      const q2 = createQuantity(3, 'm', false);
      const result = divideQuantities(q1, q2);
      
      expect(result).not.toBeNull();
      expect(result?.value).toBe(4);
      expect(result?.unit).toBe('m2/m');
    });

    it('should handle velocity calculation', () => {
      const q1 = createQuantity(100, 'km', false);
      const q2 = createQuantity(2, 'h', false);
      const result = divideQuantities(q1, q2);
      
      expect(result).not.toBeNull();
      expect(result?.value).toBe(50);
      expect(result?.unit).toBe('km/h');
    });

    it('should handle same units canceling', () => {
      const q1 = createQuantity(10, 'mg', false);
      const q2 = createQuantity(5, 'mg', false);
      const result = divideQuantities(q1, q2);
      
      expect(result).not.toBeNull();
      expect(result?.value).toBe(2);
      expect(result?.unit).toBe('1'); // Dimensionless
    });
  });

  describe('compareQuantities', () => {
    it('should compare quantities with same unit', () => {
      const q1 = createQuantity(5, 'mg', false);
      const q2 = createQuantity(3, 'mg', false);
      const q3 = createQuantity(5, 'mg', false);
      
      expect(compareQuantities(q1, q2)).toBe(1); // q1 > q2
      expect(compareQuantities(q2, q1)).toBe(-1); // q2 < q1
      expect(compareQuantities(q1, q3)).toBe(0); // q1 = q3
    });

    it('should compare quantities with compatible units', () => {
      const q1 = createQuantity(1, 'g', false);
      const q2 = createQuantity(500, 'mg', false);
      
      expect(compareQuantities(q1, q2)).toBe(1); // 1g > 500mg
    });

    it('should return null for incompatible units', () => {
      const q1 = createQuantity(5, 'mg', false);
      const q2 = createQuantity(3, 'm', false);
      
      expect(compareQuantities(q1, q2)).toBeNull();
    });
  });

  describe('equalQuantities', () => {
    it('should check equality with same unit', () => {
      const q1 = createQuantity(5, 'mg', false);
      const q2 = createQuantity(5, 'mg', false);
      const q3 = createQuantity(3, 'mg', false);
      
      expect(equalQuantities(q1, q2)).toBe(true);
      expect(equalQuantities(q1, q3)).toBe(false);
    });

    it('should check equality with unit conversion', () => {
      const q1 = createQuantity(1, 'g', false);
      const q2 = createQuantity(1000, 'mg', false);
      
      expect(equalQuantities(q1, q2)).toBe(true);
    });

    it('should return false for incompatible units', () => {
      const q1 = createQuantity(5, 'mg', false);
      const q2 = createQuantity(5, 'm', false);
      
      expect(equalQuantities(q1, q2)).toBe(false);
    });
  });

  describe('quantityToString', () => {
    it('should format quantity as string', () => {
      const q = createQuantity(5, 'mg', false);
      expect(quantityToString(q)).toBe("5 'mg'");
    });
  });

  describe('CALENDAR_TO_UCUM mapping', () => {
    it('should have all calendar units mapped', () => {
      expect(CALENDAR_TO_UCUM['year']).toBe('a');
      expect(CALENDAR_TO_UCUM['years']).toBe('a');
      expect(CALENDAR_TO_UCUM['month']).toBe('mo');
      expect(CALENDAR_TO_UCUM['months']).toBe('mo');
      expect(CALENDAR_TO_UCUM['week']).toBe('wk');
      expect(CALENDAR_TO_UCUM['weeks']).toBe('wk');
      expect(CALENDAR_TO_UCUM['day']).toBe('d');
      expect(CALENDAR_TO_UCUM['days']).toBe('d');
      expect(CALENDAR_TO_UCUM['hour']).toBe('h');
      expect(CALENDAR_TO_UCUM['hours']).toBe('h');
      expect(CALENDAR_TO_UCUM['minute']).toBe('min');
      expect(CALENDAR_TO_UCUM['minutes']).toBe('min');
      expect(CALENDAR_TO_UCUM['second']).toBe('s');
      expect(CALENDAR_TO_UCUM['seconds']).toBe('s');
      expect(CALENDAR_TO_UCUM['millisecond']).toBe('ms');
      expect(CALENDAR_TO_UCUM['milliseconds']).toBe('ms');
    });
  });

  describe('Calendar duration operations', () => {
    it('should add calendar durations', () => {
      const q1 = createQuantity(1, 'year', true);
      const q2 = createQuantity(6, 'months', true);
      const result = addQuantities(q1, q2);
      
      expect(result).not.toBeNull();
      // 1 year + 6 months = 1.5 years (in UCUM 'a' units)
      expect(result?.value).toBeCloseTo(1.5, 2);
      expect(result?.unit).toBe('a');
    });

    it('should compare calendar durations', () => {
      const q1 = createQuantity(1, 'year', true);
      const q2 = createQuantity(11, 'months', true);
      
      expect(compareQuantities(q1, q2)).toBe(1); // 1 year > 11 months
    });
  });

  describe('Temperature conversions', () => {
    it('should compare temperatures', () => {
      const q1 = createQuantity(0, 'Cel', false);
      const q2 = createQuantity(32, '[degF]', false);
      
      // 0°C = 32°F
      expect(equalQuantities(q1, q2)).toBe(true);
    });
  });
});