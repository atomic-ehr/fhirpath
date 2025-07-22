import { Registry } from './registry';
import { arithmeticOperators } from './operations/arithmetic';
import { logicalOperators } from './operations/logical';
import { comparisonOperators } from './operations/comparison';
import { membershipOperators } from './operations/membership';
import { typeOperators } from './operations/type-operators';
import { literals } from './operations/literals';
import { existenceFunctions } from './operations/existence';

// Export types
export * from './types';
export { Registry } from './registry';
export * from './default-analyzers';

// Register all operations on module load
[
  ...arithmeticOperators,
  ...logicalOperators,
  ...comparisonOperators,
  ...membershipOperators,
  ...typeOperators,
  ...literals,
  ...existenceFunctions
].forEach(op => Registry.register(op));

// Export default registry instance
export default Registry;