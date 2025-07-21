// Re-export the function registry
export { FunctionRegistry } from './registry';
export type { EnhancedFunctionDefinition as FunctionDefinition } from '../signature-system/types';

// Import all function implementations
import './core-functions';
import './existence-functions';
import './filtering-functions';
import './subsetting-functions';
import './combining-functions';
import './conversion-functions';
import './string-functions';
import './math-functions';
import './type-functions';
import './utility-functions';