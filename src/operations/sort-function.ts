import type { FunctionDefinition } from '../types';
import { RuntimeContextManager } from '../interpreter/runtime-context';
import { type FunctionEvaluator } from '../types';
import { unbox } from '../interpreter/boxing';
import { Errors } from '../errors';

/**
 * Compares two values for sorting.
 * Returns -1 if a < b, 0 if a = b, 1 if a > b
 * Returns null if the values cannot be compared
 * 
 * Note: In FHIRPath, nulls always sort first regardless of sort direction.
 * The descending flag is applied AFTER the comparison, not to null handling.
 */
function compareValues(a: unknown, b: unknown): number | null {
  // Handle null/undefined - they always sort first
  if (a === null || a === undefined) {
    if (b === null || b === undefined) return 0;
    return -1; // null/undefined always sorts before everything
  }
  if (b === null || b === undefined) return 1;

  // Handle booleans
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    if (a === b) return 0;
    return a ? 1 : -1; // false < true
  }

  // Handle numbers
  if (typeof a === 'number' && typeof b === 'number') {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  }

  // Handle strings
  if (typeof a === 'string' && typeof b === 'string') {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  }

  // Handle Date, DateTime, Time (they have toString() for comparison)
  const aHasToString = a && typeof a === 'object' && 'toString' in a;
  const bHasToString = b && typeof b === 'object' && 'toString' in b;
  
  if (aHasToString && bHasToString) {
    const aStr = (a as any).toString();
    const bStr = (b as any).toString();
    if (aStr < bStr) return -1;
    if (aStr > bStr) return 1;
    return 0;
  }

  // Handle Quantity objects
  const aIsQuantity = a && typeof a === 'object' && 'value' in (a as any) && 'unit' in (a as any);
  const bIsQuantity = b && typeof b === 'object' && 'value' in (b as any) && 'unit' in (b as any);
  
  if (aIsQuantity && bIsQuantity) {
    const aQuant = a as { value: number; unit: string };
    const bQuant = b as { value: number; unit: string };
    
    // Can only compare quantities with the same unit
    if (aQuant.unit === bQuant.unit) {
      if (aQuant.value < bQuant.value) return -1;
      if (aQuant.value > bQuant.value) return 1;
      return 0;
    }
  }

  // Different types or incomparable objects
  return null;
}

export const evaluate: FunctionEvaluator = async (input, context, args, evaluator) => {
  // Empty input returns empty
  if (input.length === 0) {
    return { value: [], context };
  }

  // If no sort expression provided, sort by the values themselves
  if (args.length === 0) {
    const sorted = [...input].sort((a, b) => {
      const aVal = unbox(a);
      const bVal = unbox(b);
      const result = compareValues(aVal, bVal);
      if (result === null) {
        throw Errors.invalidOperation(`Cannot compare values for sorting`);
      }
      return result;
    });
    return { value: sorted, context };
  }

  // Sort with expression(s)
  // Collect sort keys for each item
  const itemsWithKeys: Array<{ item: any; keys: any[]; descending: boolean[] }> = [];
  
  for (let i = 0; i < input.length; i++) {
    const boxedItem = input[i];
    if (!boxedItem) continue;
    
    const item = unbox(boxedItem);
    
    // Create iterator context with $this and $index
    let tempContext = RuntimeContextManager.withIterator(context, item, i);
    tempContext = RuntimeContextManager.setVariable(tempContext, '$total', input.length);

    const keys: any[] = [];
    const descending: boolean[] = [];
    
    // Evaluate each sort expression
    for (const expr of args) {
      if (!expr) continue;
      
      // Check if this is a unary minus expression for descending sort
      const isDescending = expr && expr.type === 'Unary' && expr.operator === '-';
      descending.push(isDescending);
      
      // For descending sort, evaluate the operand, not the unary minus result
      const exprToEval = isDescending && 'operand' in expr ? expr.operand : expr;
      
      // If exprToEval is null (which shouldn't happen), skip
      if (!exprToEval) {
        keys.push(null);
        continue;
      }
      
      // Evaluate expression with temporary context
      const exprResult = await evaluator(exprToEval, [boxedItem], tempContext);
      
      // Get the sort key value
      if (exprResult.value.length > 0 && exprResult.value[0]) {
        const keyValue = unbox(exprResult.value[0]);
        keys.push(keyValue);
      } else {
        keys.push(null); // No value sorts first
      }
    }
    
    itemsWithKeys.push({ item: boxedItem, keys, descending });
  }

  // Sort by the collected keys
  itemsWithKeys.sort((a, b) => {
    // Handle case where one item has more keys than the other (shouldn't happen)
    const keyCount = Math.max(a.keys.length, b.keys.length);
    
    for (let i = 0; i < keyCount; i++) {
      const aKey = i < a.keys.length ? a.keys[i] : null;
      const bKey = i < b.keys.length ? b.keys[i] : null;
      const isDescending = i < a.descending.length ? a.descending[i] : false;
      
      // Special handling for nulls in descending sort
      // In FHIRPath, nulls always sort first, even in descending order
      const aIsNull = aKey === null || aKey === undefined;
      const bIsNull = bKey === null || bKey === undefined;
      
      if (aIsNull && bIsNull) {
        continue; // Both null, check next sort key
      } else if (aIsNull) {
        return isDescending ? -1 : -1; // Null always sorts first
      } else if (bIsNull) {
        return isDescending ? 1 : 1; // Null always sorts first
      }
      
      // Neither is null, do normal comparison
      let result = compareValues(aKey, bKey);
      if (result === null) {
        throw Errors.invalidOperation(`Cannot compare values for sorting`);
      }
      
      // Reverse the comparison for descending sort (but not for nulls)
      if (isDescending) {
        result = -result;
      }
      
      if (result !== 0) return result;
    }
    return 0;
  });

  // Extract the sorted items
  const sorted = itemsWithKeys.map(x => x.item);
  
  return { value: sorted, context };
};

export const sortFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'sort',
  category: ['collection'],
  description: 'Returns a collection containing all items in the input collection, sorted according to the sort order expressions.',
  examples: [
    '(3 | 1 | 2).sort()',
    'Patient.name.sort(family)',
    'Patient.name.sort(family, given.first())',
    'Patient.name.sort(-family)' // Descending sort
  ],
  signatures: [{
    name: 'sort',
    input: { type: 'Any', singleton: false },
    parameters: [
      { name: 'sortExpression', type: { type: 'Any', singleton: false }, optional: true, expression: true }
    ],
    variadic: true,
    result: 'inputType' as any,
  }],
  evaluate
};