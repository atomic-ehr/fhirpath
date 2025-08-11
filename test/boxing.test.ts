import {describe, it, expect} from 'bun:test';
import {
  box,
  unbox,
  isBoxed,
  ensureBoxed,
  mapBoxed,
  filterBoxed,
  flattenBoxed,
  type FHIRPathValue,
  type TypeInfo,
  type PrimitiveElement
} from '../src/boxing';

describe('boxing utilities', () => {
  describe('box', () => {
    it('should box a simple value', async () => {
      const boxed = box('hello');
      expect(boxed.value).toBe('hello');
      expect(boxed.typeInfo).toBeUndefined();
      expect(boxed.primitiveElement).toBeUndefined();
    });

    it('should box with type info', async () => {
      const typeInfo: TypeInfo = {type: 'String', singleton: true};
      const boxed = box('hello', typeInfo);
      expect(boxed.value).toBe('hello');
      expect(boxed.typeInfo).toBe(typeInfo);
    });

    it('should box with primitive element', async () => {
      const primitiveElement: PrimitiveElement = {
        extension: [{url: 'http://example.org/ext', valueString: 'test'}]
      };
      const boxed = box('male', undefined, primitiveElement);
      expect(boxed.value).toBe('male');
      expect(boxed.primitiveElement).toBe(primitiveElement);
    });

    it('should box null and undefined', async () => {
      expect(box(null).value).toBeNull();
      expect(box(undefined).value).toBeUndefined();
    });

    it('should box complex objects', async () => {
      const obj = {name: 'John', age: 30};
      const boxed = box(obj);
      expect(boxed.value).toBe(obj);
    });
  });

  describe('unbox', () => {
    it('should unbox a boxed value', async () => {
      const boxed = box('hello');
      expect(unbox(boxed)).toBe('hello');
    });

    it('should unbox null value', async () => {
      const boxed = box(null);
      expect(unbox(boxed)).toBeNull();
    });
  });

  describe('isBoxed', () => {
    it('should identify boxed values', async () => {
      expect(isBoxed(box('hello'))).toBe(true);
      expect(isBoxed(box(123))).toBe(true);
      expect(isBoxed(box(null))).toBe(true);
    });

    it('should reject unboxed values', async () => {
      expect(isBoxed('hello')).toBe(false);
      expect(isBoxed(123)).toBe(false);
      expect(isBoxed(null)).toBe(false);
      expect(isBoxed(undefined)).toBe(false);
      expect(isBoxed([])).toBe(false);
      expect(isBoxed({})).toBe(false);
    });

    it('should reject objects that happen to have value property', async () => {
      expect(isBoxed({value: 'not really boxed', other: 'prop'})).toBe(false);
    });
  });

  describe('ensureBoxed', () => {
    it('should box unboxed values', async () => {
      const result = ensureBoxed('hello');
      expect(isBoxed(result)).toBe(true);
      expect(result.value).toBe('hello');
    });

    it('should preserve already boxed values', async () => {
      const boxed = box('hello', {type: 'String', singleton: true});
      const result = ensureBoxed(boxed);
      expect(result).toBe(boxed);
    });

    it('should add type info when boxing', async () => {
      const typeInfo: TypeInfo = {type: 'Integer', singleton: true};
      const result = ensureBoxed(42, typeInfo);
      expect(result.value).toBe(42);
      expect(result.typeInfo).toBe(typeInfo);
    });
  });

  describe('mapBoxed', () => {
    it('should map over boxed values', async () => {
      const boxedNumbers = [box(1), box(2), box(3)];
      const result = mapBoxed(boxedNumbers, n => n * 2);
      
      expect(result.length).toBe(3);
      expect(unbox(result[0]!)).toBe(2);
      expect(unbox(result[1]!)).toBe(4);
      expect(unbox(result[2]!)).toBe(6);
    });

    it('should preserve boxing with new type info', async () => {
      const boxedStrings = [box('a'), box('b')];
      const typeInfo: TypeInfo = {type: 'Integer', singleton: true};
      const result = mapBoxed(boxedStrings, s => s.length, typeInfo);
      
      expect(result[0]!.typeInfo).toBe(typeInfo);
      expect(result[1]!.typeInfo).toBe(typeInfo);
    });

    it('should provide index to mapper', async () => {
      const boxedValues = [box('a'), box('b'), box('c')];
      const result = mapBoxed(boxedValues, (v, i) => `${v}-${i}`);
      
      expect(unbox(result[0]!)).toBe('a-0');
      expect(unbox(result[1]!)).toBe('b-1');
      expect(unbox(result[2]!)).toBe('c-2');
    });
  });

  describe('filterBoxed', () => {
    it('should filter boxed values', async () => {
      const boxedNumbers = [box(1), box(2), box(3), box(4)];
      const result = filterBoxed(boxedNumbers, n => n % 2 === 0);
      
      expect(result.length).toBe(2);
      expect(unbox(result[0]!)).toBe(2);
      expect(unbox(result[1]!)).toBe(4);
    });

    it('should preserve original boxing', async () => {
      const typeInfo: TypeInfo = {type: 'Integer', singleton: true};
      const boxedNumbers = [
        box(1, typeInfo),
        box(2, typeInfo),
        box(3, typeInfo)
      ];
      const result = filterBoxed(boxedNumbers, n => n > 1);
      
      expect(result[0]!).toBe(boxedNumbers[1]!);
      expect(result[1]!).toBe(boxedNumbers[2]!);
    });

    it('should provide index to predicate', async () => {
      const boxedValues = [box('a'), box('b'), box('c'), box('d')];
      const result = filterBoxed(boxedValues, (v, i) => i % 2 === 0);
      
      expect(result.length).toBe(2);
      expect(unbox(result[0]!)).toBe('a');
      expect(unbox(result[1]!)).toBe('c');
    });
  });

  describe('flattenBoxed', () => {
    it('should flatten boxed arrays', async () => {
      const boxedArrays = [
        box([1, 2]),
        box([3, 4])
      ];
      const result = flattenBoxed(boxedArrays);
      
      expect(result.length).toBe(4);
      expect(unbox(result[0]!)).toBe(1);
      expect(unbox(result[1]!)).toBe(2);
      expect(unbox(result[2]!)).toBe(3);
      expect(unbox(result[3]!)).toBe(4);
    });

    it('should preserve type info from parent', async () => {
      const typeInfo: TypeInfo = {type: 'Integer', singleton: false};
      const boxedArrays = [
        box([1, 2], typeInfo),
        box([3], typeInfo)
      ];
      const result = flattenBoxed(boxedArrays);
      
      expect(result[0]!.typeInfo).toBe(typeInfo);
      expect(result[1]!.typeInfo).toBe(typeInfo);
      expect(result[2]!.typeInfo).toBe(typeInfo);
    });

    it('should handle empty arrays', async () => {
      const boxedArrays = [
        box([1]),
        box([]),
        box([2, 3])
      ];
      const result = flattenBoxed(boxedArrays);
      
      expect(result.length).toBe(3);
      expect(unbox(result[0]!)).toBe(1);
      expect(unbox(result[1]!)).toBe(2);
      expect(unbox(result[2]!)).toBe(3);
    });

    it('should handle non-array boxed values gracefully', async () => {
      const boxedValues = [
        box([1, 2]),
        box('not an array' as any),
        box([3])
      ];
      const result = flattenBoxed(boxedValues);
      
      expect(result.length).toBe(3);
      expect(unbox(result[0]!)).toBe(1);
      expect(unbox(result[1]!)).toBe(2);
      expect(unbox(result[2]!)).toBe(3);
    });
  });
});