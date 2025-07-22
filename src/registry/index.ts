import { Registry } from './registry';
import { arithmeticOperators } from './operations/arithmetic';
import { logicalOperators } from './operations/logical';
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
  ...literals,
  ...existenceFunctions
].forEach(op => Registry.register(op));

// Export default registry instance
export default Registry;