import { Registry } from './registry';
import { arithmeticOperators } from './operations/arithmetic';
import { logicalOperators, logicalFunctions } from './operations/logical';
import { comparisonOperators } from './operations/comparison';
import { membershipOperators } from './operations/membership';
import { typeOperators } from './operations/type-operators';
import { literals } from './operations/literals';
import { existenceFunctions } from './operations/existence';
import { 
  aggregateFunction, 
  childrenFunction, 
  descendantsFunction, 
  iifFunction, 
  defineVariableFunction, 
  traceFunction, 
  checkFunction 
} from './operations/utility';
import { typeFunction, isFunction, asFunction } from './operations/type-checking';
import { absFunction, roundFunction, sqrtFunction } from './operations/math';
import { whereFunction, selectFunction, ofTypeFunction, repeatFunction } from './operations/filtering';
import { 
  containsFunction, lengthFunction, substringFunction, startsWithFunction, 
  endsWithFunction, upperFunction, lowerFunction, indexOfFunction,
  replaceFunction, splitFunction, joinFunction, trimFunction, toCharsFunction
} from './operations/string';
import { 
  toStringFunction, toIntegerFunction, toDecimalFunction, 
  toBooleanFunction, toQuantityFunction 
} from './operations/type-conversion';
import { tailFunction, skipFunction, takeFunction } from './operations/subsetting';
import { unionFunction, combineFunction, intersectFunction, excludeFunction, collectionOperators } from './operations/collection';

// Export types
export * from './types';
export { Registry } from './registry';
export * from './default-analyzers';

// Register all operations on module load
[
  ...arithmeticOperators,
  ...logicalOperators,
  ...logicalFunctions,
  ...comparisonOperators,
  ...membershipOperators,
  ...typeOperators,
  ...collectionOperators,
  ...literals,
  ...existenceFunctions,
  aggregateFunction,
  childrenFunction,
  descendantsFunction,
  iifFunction,
  defineVariableFunction,
  traceFunction,
  checkFunction,
  typeFunction,
  isFunction,
  asFunction,
  absFunction,
  roundFunction,
  sqrtFunction,
  whereFunction,
  selectFunction,
  ofTypeFunction,
  repeatFunction,
  containsFunction,
  lengthFunction,
  substringFunction,
  startsWithFunction,
  endsWithFunction,
  upperFunction,
  lowerFunction,
  indexOfFunction,
  replaceFunction,
  splitFunction,
  joinFunction,
  trimFunction,
  toCharsFunction,
  toStringFunction,
  toIntegerFunction,
  toDecimalFunction,
  toBooleanFunction,
  toQuantityFunction,
  tailFunction,
  skipFunction,
  takeFunction,
  unionFunction,
  combineFunction,
  intersectFunction,
  excludeFunction
].forEach(op => Registry.register(op));

// Export default registry instance
export default Registry;