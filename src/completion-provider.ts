import { parse } from './parser';
import { Analyzer } from './analyzer';
import type { TypeInfo, ModelProvider } from './types';
import { CursorContext, isCursorNode } from './cursor-nodes';
import type { AnyCursorNode } from './cursor-nodes';
import { registry } from './registry';

/**
 * Kind of completion item
 */
export enum CompletionKind {
  Property = 'property',
  Function = 'function',
  Variable = 'variable',
  Operator = 'operator',
  Type = 'type',
  Keyword = 'keyword',
  Constant = 'constant'
}

/**
 * Represents a completion item
 */
export interface CompletionItem {
  /** Display text */
  label: string;
  /** Kind of completion */
  kind: CompletionKind;
  /** Short description */
  detail?: string;
  /** Full documentation */
  documentation?: string;
  /** Text to insert (if different from label) */
  insertText?: string;
  /** Sort order */
  sortText?: string;
}

/**
 * Options for completion provider
 */
export interface CompletionOptions {
  /** Model provider for FHIR types */
  modelProvider?: ModelProvider;
  /** Variables in scope */
  variables?: Record<string, any>;
  /** Input type for the expression */
  inputType?: TypeInfo;
  /** Maximum number of completions to return */
  maxCompletions?: number;
}

/**
 * Provides context-aware completions for FHIRPath expressions
 */
export function provideCompletions(
  expression: string,
  cursorPosition: number,
  options: CompletionOptions = {}
): CompletionItem[] {
  const { modelProvider, variables, inputType, maxCompletions = 100 } = options;
  
  try {
    // Parse with cursor
    const parseResult = parse(expression, { cursorPosition });
    if (!parseResult.ast) {
      return [];
    }
    
    // Analyze with cursor mode
    const analyzer = new Analyzer(modelProvider);
    const analysis = analyzer.analyze(
      parseResult.ast,
      variables,
      inputType,
      { cursorMode: true }
    );
    
    // Extract cursor context
    let cursorNode = analysis.cursorContext?.cursorNode;
    let typeBeforeCursor = analysis.cursorContext?.typeBeforeCursor;
    
    // Check if cursor is in a binary expression as the right operand
    // This handles cases where analyzer found the cursor but we need to adjust context
    if (parseResult.ast) {
      const ast = parseResult.ast as any;
      if (ast.type === 'Binary' && ast.right && isCursorNode(ast.right)) {
        cursorNode = ast.right;
        // Get type from left side
        typeBeforeCursor = ast.left?.typeInfo;
        
        // Special case for navigation: cursor right after identifier
        if (ast.left?.type === 'Binary' && ast.left.operator === '.') {
          if (ast.left.right?.type === 'Identifier') {
            const identifierEnd = ast.left.right.range?.end?.offset;
            
            // If cursor is right after identifier with no space
            if (identifierEnd === cursorPosition) {
              // Check if this could be a partial identifier by seeing if there are
              // any properties that would match if we treated it as a prefix
              const partialText = extractPartialText(expression, cursorPosition);
              if (partialText && modelProvider) {
                // Try to get properties from the type before the identifier
                const baseType = ast.left.left?.typeInfo;
                if (baseType) {
                  const properties = modelProvider.getProperties?.(baseType.type);
                  if (properties) {
                    // Check if any properties start with the partial text
                    const hasMatches = properties.some(p => 
                      p.name.toLowerCase().startsWith(partialText.toLowerCase()) &&
                      p.name.toLowerCase() !== partialText.toLowerCase()
                    );
                    
                    if (hasMatches) {
                      // There are potential completions - treat as identifier context
                      cursorNode = {
                        ...cursorNode,
                        context: CursorContext.Identifier
                      } as any;
                      typeBeforeCursor = baseType;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    
    // Check if cursor is in a function argument and fix the function name
    if (cursorNode && cursorNode.context === CursorContext.Argument) {
      const functionName = findFunctionName(parseResult.ast as any, cursorNode);
      if (functionName) {
        (cursorNode as any).functionName = functionName;
        
        // Special case: ofType, as, is should treat their arguments as type context
        if (functionName === 'ofType' || functionName === 'as' || functionName === 'is') {
          // Convert to type cursor node
          cursorNode = {
            ...cursorNode,
            context: CursorContext.Type,
            typeOperator: functionName
          } as any;
        }
      }
    }
    
    if (!cursorNode) {
      // Fallback: provide general completions if no cursor node found
      return getGeneralCompletions();
    }
    
    const expectedType = analysis.cursorContext?.expectedType;
    
    // Get partial text for filtering
    const partialText = extractPartialText(expression, cursorPosition);
    
    // Generate completions based on cursor context
    let completions: CompletionItem[] = [];
    
    switch (cursorNode.context) {
      case CursorContext.Identifier:
        completions = getIdentifierCompletions(typeBeforeCursor, modelProvider);
        break;
      
      case CursorContext.Operator:
        completions = getOperatorCompletions(typeBeforeCursor);
        break;
      
      case CursorContext.Type:
        completions = getTypeCompletions(cursorNode, modelProvider);
        break;
      
      case CursorContext.Argument:
        completions = getArgumentCompletions(cursorNode, typeBeforeCursor, modelProvider, variables);
        break;
      
      case CursorContext.Index:
        completions = getIndexCompletions(typeBeforeCursor, variables);
        break;
    }
    
    // Filter by partial text
    if (partialText) {
      completions = filterCompletions(completions, partialText);
    }
    
    // Sort and limit
    completions = rankCompletions(completions);
    if (maxCompletions > 0 && completions.length > maxCompletions) {
      completions = completions.slice(0, maxCompletions);
    }
    
    return completions;
  } catch (error) {
    // Return empty array on error
    return [];
  }
}

/**
 * Get general completions when no specific context
 */
function getGeneralCompletions(): CompletionItem[] {
  const completions: CompletionItem[] = [];
  
  // Add dot operator for navigation
  completions.push({
    label: '.',
    kind: CompletionKind.Operator,
    detail: 'Navigation operator'
  });
  
  // Add common operators
  const operators = ['+', '-', '=', '!=', 'and', 'or'];
  for (const op of operators) {
    completions.push({
      label: op,
      kind: CompletionKind.Operator,
      detail: 'Operator'
    });
  }
  
  // Add common constants
  completions.push(
    { label: 'true', kind: CompletionKind.Constant, detail: 'Boolean true' },
    { label: 'false', kind: CompletionKind.Constant, detail: 'Boolean false' },
    { label: 'null', kind: CompletionKind.Constant, detail: 'Null value' }
  );
  
  return completions;
}

/**
 * Find function name for a cursor node in an argument position
 */
function findFunctionName(ast: any, cursorNode: any): string | null {
  // Check if AST is a function with cursor in arguments
  if (ast.type === 'Function' && ast.arguments?.includes(cursorNode)) {
    return ast.name?.name || null;
  }
  
  // Check if AST is binary with function on right
  if (ast.type === 'Binary' && ast.right?.type === 'Function') {
    if (ast.right.arguments?.includes(cursorNode)) {
      return ast.right.name?.name || null;
    }
  }
  
  // Recursively check children
  if (ast.left) {
    const leftResult = findFunctionName(ast.left, cursorNode);
    if (leftResult) return leftResult;
  }
  
  if (ast.right) {
    const rightResult = findFunctionName(ast.right, cursorNode);
    if (rightResult) return rightResult;
  }
  
  if (ast.arguments) {
    for (const arg of ast.arguments) {
      if (arg !== cursorNode) {
        const argResult = findFunctionName(arg, cursorNode);
        if (argResult) return argResult;
      }
    }
  }
  
  return null;
}

/**
 * Extract partial text before cursor for filtering
 */
function extractPartialText(expression: string, cursorPosition: number): string {
  // Handle case where cursor is right after a dot
  if (cursorPosition > 0 && expression[cursorPosition - 1] === '.') {
    return '';
  }
  
  let start = cursorPosition;
  
  // Move back to find start of identifier
  while (start > 0 && /[a-zA-Z0-9_$%]/.test(expression[start - 1])) {
    start--;
  }
  
  return expression.substring(start, cursorPosition);
}

/**
 * Get completions for identifier context (after dot)
 */
function getIdentifierCompletions(
  typeBeforeCursor?: TypeInfo,
  modelProvider?: ModelProvider
): CompletionItem[] {
  const completions: CompletionItem[] = [];
  
  // Add properties from type if available
  if (typeBeforeCursor && modelProvider) {
    const properties = modelProvider.getProperties?.(typeBeforeCursor.type);
    if (properties) {
      for (const prop of properties) {
        completions.push({
          label: prop.name,
          kind: CompletionKind.Property,
          detail: prop.type,
          documentation: prop.documentation
        });
      }
    }
  }
  
  // Add common FHIRPath functions
  const functions = [
    { name: 'where', detail: 'Filter collection by condition' },
    { name: 'select', detail: 'Transform each item' },
    { name: 'first', detail: 'Get first item' },
    { name: 'last', detail: 'Get last item' },
    { name: 'tail', detail: 'Get all except first' },
    { name: 'take', detail: 'Take first N items' },
    { name: 'skip', detail: 'Skip first N items' },
    { name: 'count', detail: 'Count items' },
    { name: 'distinct', detail: 'Remove duplicates' },
    { name: 'exists', detail: 'Check if any items exist' },
    { name: 'empty', detail: 'Check if empty' },
    { name: 'all', detail: 'Check if all items match' },
    { name: 'single', detail: 'Get single item' },
    { name: 'ofType', detail: 'Filter by type' },
    { name: 'as', detail: 'Cast to type' },
    { name: 'is', detail: 'Check type' },
    { name: 'toString', detail: 'Convert to string' },
    { name: 'toInteger', detail: 'Convert to integer' },
    { name: 'toDecimal', detail: 'Convert to decimal' },
    { name: 'toBoolean', detail: 'Convert to boolean' },
    { name: 'toDateTime', detail: 'Convert to datetime' },
    { name: 'toTime', detail: 'Convert to time' },
    { name: 'toQuantity', detail: 'Convert to quantity' }
  ];
  
  for (const func of functions) {
    completions.push({
      label: func.name,
      kind: CompletionKind.Function,
      detail: func.detail,
      insertText: func.name + '()'
    });
  }
  
  // Add type-specific functions
  if (typeBeforeCursor) {
    const typeSpecificFunctions = getTypeSpecificFunctions(typeBeforeCursor.type);
    for (const func of typeSpecificFunctions) {
      completions.push({
        label: func.name,
        kind: CompletionKind.Function,
        detail: func.detail,
        insertText: func.name + (func.hasArgs ? '()' : '')
      });
    }
  }
  
  return completions;
}

/**
 * Get completions for operator context (between expressions)
 */
function getOperatorCompletions(typeBeforeCursor?: TypeInfo): CompletionItem[] {
  const completions: CompletionItem[] = [];
  
  // Always include navigation operator
  completions.push({
    label: '.',
    kind: CompletionKind.Operator,
    detail: 'Navigation'
  });
  
  // Always include comparison operators
  const comparisonOps = [
    { op: '=', detail: 'Equal' },
    { op: '!=', detail: 'Not equal' },
    { op: '<', detail: 'Less than' },
    { op: '>', detail: 'Greater than' },
    { op: '<=', detail: 'Less than or equal' },
    { op: '>=', detail: 'Greater than or equal' }
  ];
  
  for (const op of comparisonOps) {
    completions.push({
      label: op.op,
      kind: CompletionKind.Operator,
      detail: op.detail
    });
  }
  
  // Type-specific operators
  if (typeBeforeCursor) {
    const typeName = typeBeforeCursor.type;
    
    // Arithmetic operators for numeric types
    if (typeName === 'Integer' || typeName === 'Decimal' || typeName === 'Quantity') {
      const arithmeticOps = [
        { op: '+', detail: 'Addition' },
        { op: '-', detail: 'Subtraction' },
        { op: '*', detail: 'Multiplication' },
        { op: '/', detail: 'Division' },
        { op: 'div', detail: 'Integer division' },
        { op: 'mod', detail: 'Modulo' }
      ];
      
      for (const op of arithmeticOps) {
        completions.push({
          label: op.op,
          kind: CompletionKind.Operator,
          detail: op.detail
        });
      }
    }
    
    // String operators
    if (typeName === 'String') {
      completions.push({
        label: '+',
        kind: CompletionKind.Operator,
        detail: 'String concatenation'
      });
      completions.push({
        label: '&',
        kind: CompletionKind.Operator,
        detail: 'String concatenation'
      });
      completions.push({
        label: '~',
        kind: CompletionKind.Operator,
        detail: 'String contains'
      });
      completions.push({
        label: '!~',
        kind: CompletionKind.Operator,
        detail: 'String not contains'
      });
    }
    
    // Boolean operators
    if (typeName === 'Boolean') {
      const booleanOps = [
        { op: 'and', detail: 'Logical AND' },
        { op: 'or', detail: 'Logical OR' },
        { op: 'xor', detail: 'Logical XOR' },
        { op: 'implies', detail: 'Logical implication' }
      ];
      
      for (const op of booleanOps) {
        completions.push({
          label: op.op,
          kind: CompletionKind.Operator,
          detail: op.detail
        });
      }
    }
    
    // Collection operators
    if (!typeBeforeCursor.singleton) {
      const collectionOps = [
        { op: '|', detail: 'Union' },
        { op: 'union', detail: 'Union collections' },
        { op: 'intersect', detail: 'Intersection' },
        { op: 'exclude', detail: 'Exclude items' },
        { op: 'in', detail: 'Membership test' },
        { op: 'contains', detail: 'Contains item' }
      ];
      
      for (const op of collectionOps) {
        completions.push({
          label: op.op,
          kind: CompletionKind.Operator,
          detail: op.detail
        });
      }
    }
  }
  
  // Type operators
  completions.push({
    label: 'is',
    kind: CompletionKind.Operator,
    detail: 'Type check'
  });
  completions.push({
    label: 'as',
    kind: CompletionKind.Operator,
    detail: 'Type cast'
  });
  
  return completions;
}

/**
 * Get completions for type context (after is/as/ofType)
 */
function getTypeCompletions(
  cursorNode: AnyCursorNode,
  modelProvider?: ModelProvider
): CompletionItem[] {
  const completions: CompletionItem[] = [];
  
  // FHIRPath primitive types
  const primitiveTypes = [
    'Boolean',
    'String',
    'Integer',
    'Decimal',
    'Date',
    'DateTime',
    'Time',
    'Quantity'
  ];
  
  for (const type of primitiveTypes) {
    completions.push({
      label: type,
      kind: CompletionKind.Type,
      detail: 'FHIRPath primitive type'
    });
  }
  
  // FHIR complex types
  const complexTypes = [
    'Coding',
    'CodeableConcept',
    'Period',
    'Range',
    'Ratio',
    'SampledData',
    'Identifier',
    'HumanName',
    'Address',
    'ContactPoint',
    'Attachment',
    'Reference'
  ];
  
  for (const type of complexTypes) {
    completions.push({
      label: type,
      kind: CompletionKind.Type,
      detail: 'FHIR complex type'
    });
  }
  
  // For ofType, add resource types
  const typeOperator = (cursorNode as any).typeOperator;
  if (typeOperator === 'ofType' && modelProvider) {
    const resourceTypes = modelProvider.getResourceTypes?.() || [];
    for (const type of resourceTypes) {
      completions.push({
        label: type,
        kind: CompletionKind.Type,
        detail: 'FHIR resource type'
      });
    }
  }
  
  return completions;
}

/**
 * Get completions for argument context (in function arguments)
 */
function getArgumentCompletions(
  cursorNode: AnyCursorNode,
  typeBeforeCursor?: TypeInfo,
  modelProvider?: ModelProvider,
  variables?: Record<string, any>
): CompletionItem[] {
  const completions: CompletionItem[] = [];
  const argNode = cursorNode as any;
  
  // Add variables
  completions.push({
    label: '$this',
    kind: CompletionKind.Variable,
    detail: 'Current item in iteration'
  });
  
  completions.push({
    label: '$index',
    kind: CompletionKind.Variable,
    detail: 'Current index in iteration'
  });
  
  // Add user variables
  if (variables) {
    for (const varName of Object.keys(variables)) {
      completions.push({
        label: varName.startsWith('%') ? varName : '%' + varName,
        kind: CompletionKind.Variable,
        detail: 'User-defined variable'
      });
    }
  }
  
  // Add properties if in lambda context
  const functionName = argNode.functionName;
  if (functionName && ['where', 'select', 'all', 'exists'].includes(functionName)) {
    // In lambda function, provide properties of item type
    if (typeBeforeCursor && modelProvider) {
      const itemType = { ...typeBeforeCursor, singleton: true };
      const properties = modelProvider.getProperties?.(itemType.type);
      if (properties) {
        for (const prop of properties) {
          completions.push({
            label: prop.name,
            kind: CompletionKind.Property,
            detail: prop.type
          });
        }
      }
    }
  }
  
  // Add constants
  completions.push({
    label: 'true',
    kind: CompletionKind.Constant,
    detail: 'Boolean true'
  });
  completions.push({
    label: 'false',
    kind: CompletionKind.Constant,
    detail: 'Boolean false'
  });
  completions.push({
    label: 'null',
    kind: CompletionKind.Constant,
    detail: 'Null value'
  });
  
  return completions;
}

/**
 * Get completions for index context (in brackets)
 */
function getIndexCompletions(
  typeBeforeCursor?: TypeInfo,
  variables?: Record<string, any>
): CompletionItem[] {
  const completions: CompletionItem[] = [];
  
  // Integer literals
  for (let i = 0; i < 10; i++) {
    completions.push({
      label: i.toString(),
      kind: CompletionKind.Constant,
      detail: 'Index'
    });
  }
  
  // Index variables
  completions.push({
    label: '$index',
    kind: CompletionKind.Variable,
    detail: 'Current index'
  });
  
  // Index functions
  completions.push({
    label: 'first()',
    kind: CompletionKind.Function,
    detail: 'First item index',
    insertText: 'first()'
  });
  
  completions.push({
    label: 'last()',
    kind: CompletionKind.Function,
    detail: 'Last item index',
    insertText: 'last()'
  });
  
  return completions;
}

/**
 * Get type-specific functions
 */
function getTypeSpecificFunctions(typeName: string): Array<{name: string, detail: string, hasArgs?: boolean}> {
  const functions: Array<{name: string, detail: string, hasArgs?: boolean}> = [];
  
  switch (typeName) {
    case 'String':
      functions.push(
        { name: 'length', detail: 'String length', hasArgs: false },
        { name: 'startsWith', detail: 'Check string start', hasArgs: true },
        { name: 'endsWith', detail: 'Check string end', hasArgs: true },
        { name: 'contains', detail: 'Check substring', hasArgs: true },
        { name: 'substring', detail: 'Extract substring', hasArgs: true },
        { name: 'upper', detail: 'Convert to uppercase', hasArgs: false },
        { name: 'lower', detail: 'Convert to lowercase', hasArgs: false },
        { name: 'replace', detail: 'Replace substring', hasArgs: true },
        { name: 'matches', detail: 'Regex match', hasArgs: true },
        { name: 'indexOf', detail: 'Find substring position', hasArgs: true },
        { name: 'split', detail: 'Split string', hasArgs: true },
        { name: 'trim', detail: 'Trim whitespace', hasArgs: false }
      );
      break;
      
    case 'Date':
    case 'DateTime':
    case 'Time':
      functions.push(
        { name: 'toDateTime', detail: 'Convert to DateTime', hasArgs: false },
        { name: 'toTime', detail: 'Convert to Time', hasArgs: false },
        { name: 'toString', detail: 'Convert to String', hasArgs: false }
      );
      break;
      
    case 'Integer':
    case 'Decimal':
      functions.push(
        { name: 'abs', detail: 'Absolute value', hasArgs: false },
        { name: 'ceiling', detail: 'Round up', hasArgs: false },
        { name: 'floor', detail: 'Round down', hasArgs: false },
        { name: 'round', detail: 'Round to nearest', hasArgs: true },
        { name: 'sqrt', detail: 'Square root', hasArgs: false },
        { name: 'ln', detail: 'Natural logarithm', hasArgs: false },
        { name: 'log', detail: 'Logarithm base 10', hasArgs: false },
        { name: 'exp', detail: 'Exponential', hasArgs: false },
        { name: 'power', detail: 'Raise to power', hasArgs: true }
      );
      break;
      
    case 'Quantity':
      functions.push(
        { name: 'value', detail: 'Numeric value', hasArgs: false },
        { name: 'unit', detail: 'Unit string', hasArgs: false }
      );
      break;
  }
  
  return functions;
}

/**
 * Filter completions by partial text
 */
function filterCompletions(completions: CompletionItem[], partialText: string): CompletionItem[] {
  const lowerPartial = partialText.toLowerCase();
  return completions.filter(item => 
    item.label.toLowerCase().startsWith(lowerPartial)
  );
}

/**
 * Rank completions by relevance
 */
function rankCompletions(completions: CompletionItem[]): CompletionItem[] {
  return completions.sort((a, b) => {
    // Sort by kind priority
    const kindPriority: Record<CompletionKind, number> = {
      [CompletionKind.Property]: 1,
      [CompletionKind.Variable]: 2,
      [CompletionKind.Function]: 3,
      [CompletionKind.Operator]: 4,
      [CompletionKind.Type]: 5,
      [CompletionKind.Keyword]: 6,
      [CompletionKind.Constant]: 7
    };
    
    const aPriority = kindPriority[a.kind] || 10;
    const bPriority = kindPriority[b.kind] || 10;
    
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    
    // Then alphabetically
    return a.label.localeCompare(b.label);
  });
}