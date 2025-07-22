// Re-export the FunctionRegistry from the functions module
export { FunctionRegistry } from './functions/registry';
export { FunctionRegistry as Registry } from './functions/registry';

// Import and register all functions from modules
import './functions/core-functions';
import './functions/existence-functions';
import './functions/filtering-functions';
import './functions/subsetting-functions';
import './functions/combining-functions';
import './functions/conversion-functions';
import './functions/string-functions';
import './functions/math-functions';
import './functions/type-functions';
import './functions/utility-functions';