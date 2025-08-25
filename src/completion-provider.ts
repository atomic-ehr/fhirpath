import { parse } from './parser';
import { Analyzer } from './analyzer';
import type { TypeInfo, ModelProvider } from './types';

import { CursorContext, isCursorNode } from './cursor-nodes';
import type { AnyCursorNode } from './cursor-nodes';
import { registry } from './registry';

/**
 * Type guard for ErrorNode
 */
function isErrorNode(node: any): node is import('./types').ErrorNode {
  return node.type === 'Error';
}

/**
 * Find the cursor node in the AST
 */
function findCursorNode(node: import('./types').ASTNode): AnyCursorNode | undefined {
  if (isCursorNode(node)) {
    return node as AnyCursorNode;
  }

  switch (node.type) {
    case 'Binary':
      return findCursorNode(node.left) || findCursorNode(node.right);
    case 'Unary':
      return findCursorNode(node.operand);
    case 'Function':
      // It's more likely for the cursor to be in the arguments, so check them first.
      for (const arg of node.arguments) {
        const found = findCursorNode(arg);
        if (found) return found;
      }
      return findCursorNode(node.name);
    case 'Index':
      return findCursorNode(node.expression) || findCursorNode(node.index);
    case 'Collection':
      for (const element of node.elements) {
        const found = findCursorNode(element);
        if (found) return found;
      }
      break;
    case 'TypeCast':
      return findCursorNode((node as any).expression);
    case 'MembershipTest':
      return findCursorNode((node as any).expression);
  }

  return undefined;
}


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
  /** Sort text for ordering (if different from label) */
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
export async function provideCompletions(
  expression: string,
  cursorPosition: number,
  options: CompletionOptions = {}
): Promise<CompletionItem[]> {
  const { modelProvider, variables, inputType, maxCompletions = 100 } = options;
  
  try {
    // Parse with cursor
    const parseResult = parse(expression, {
      mode: 'lsp',
      cursorPosition,
    });
    if (!parseResult.ast) {
      return [];
    }

    // Find the cursor node
    const cursorNode = findCursorNode(parseResult.ast);
    if (!cursorNode || isErrorNode(cursorNode)) {
      return [];
    }
    
    // Analyze with cursor mode
    const analyzer = new Analyzer(modelProvider);
    const analysis = await analyzer.analyze(
      parseResult.ast,
      variables,
      inputType,
      { cursorMode: true }
    );
    
    // Extract cursor context
    const { typeBeforeCursor, functionCall } = analysis.cursorContext || {};
    
    // Get partial text for filtering
    const partialText = (cursorNode as any).partialText || '';
    
    // Generate completions based on cursor context
    let completions: CompletionItem[] = [];
    
    switch (cursorNode.context) {
      case CursorContext.Identifier:
        completions = await getIdentifierCompletions(typeBeforeCursor, modelProvider);
        break;
      
      case CursorContext.Operator:
        completions = getOperatorCompletions(typeBeforeCursor);
        break;
      
      case CursorContext.Type:
        completions = await getTypeCompletions(cursorNode, modelProvider);
        break;
      
      case CursorContext.Argument:
        completions = await getArgumentCompletions(cursorNode, typeBeforeCursor, modelProvider, variables, functionCall);
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
  
  // Get operators from registry
  const operatorNames = registry.listOperators();
  for (const opName of operatorNames) {
    const opDef = registry.getOperatorDefinition(opName);
    if (opDef) {
      completions.push({
        label: opDef.symbol,
        kind: CompletionKind.Operator,
        detail: opDef.description || `${opDef.name} operator`
      });
    }
  }
  
  // No hardcoded constants - these should come from context
  
  return completions;
}

/**
 * Check if a function is applicable to a given type
 */
function isFunctionApplicable(funcDef: any, typeInfo: TypeInfo): boolean {
  if (!typeInfo || !typeInfo.type) return true;
  // Pass type with collection info: append [] if not singleton
  const typeForRegistry = typeInfo.singleton === false 
    ? `${typeInfo.type}[]` 
    : typeInfo.type;
  return registry.isFunctionApplicableToType(funcDef.name, typeForRegistry);
}

/**
 * Check if an operator is applicable to a given type
 */
function isOperatorApplicable(opDef: any, typeInfo: TypeInfo): boolean {
  if (!typeInfo || !typeInfo.type) return true;
  return registry.isOperatorApplicableToType(opDef.symbol, typeInfo.type);
}

/**
 * Get sort text for operator to ensure common operators appear first
 */
function getSortTextForOperator(opDef: any): string {
  // Common operators should appear first
  const commonOps = ['.', '=', '!=', '<', '>', '<=', '>=', '+', '-', 'and', 'or'];
  const index = commonOps.indexOf(opDef.symbol);
  if (index >= 0) {
    return `0${index.toString().padStart(2, '0')}_${opDef.symbol}`;
  }
  return `1_${opDef.symbol}`;
}

/**
 * Get completions for identifier context (after dot)
 */
async function getIdentifierCompletions(
  typeBeforeCursor?: TypeInfo,
  modelProvider?: ModelProvider
): Promise<CompletionItem[]> {
  const completions: CompletionItem[] = [];
  
  // Add elements from type if available
  if (typeBeforeCursor && modelProvider) {
    // Use the name property which contains the actual FHIR type name
    // Skip if type is 'Any' as it's not a real FHIR type
    const typeName = typeBeforeCursor.name || typeBeforeCursor.type;
    if (typeName && typeName !== 'Any') {
      const elements = await modelProvider.getElements(typeName);
      if (elements.length > 0) {
        for (const element of elements) {
          completions.push({
            label: element.name,
            kind: CompletionKind.Property,
            detail: element.type,
            documentation: element.documentation
          });
        }
      }
    }
  }
  
  // Add FHIRPath functions from registry
  const functionNames = registry.listFunctions();
  for (const name of functionNames) {
    const funcDef = registry.getFunction(name);
    if (funcDef) {
      // Check if function is appropriate for the current type context
      const isApplicable = !typeBeforeCursor || isFunctionApplicable(funcDef, typeBeforeCursor);
      
      if (isApplicable) {
        // Determine if function takes parameters
        const hasParams = funcDef.signatures?.[0]?.parameters && funcDef.signatures[0].parameters.length > 0;
        const funcDescription = funcDef.description || `FHIRPath ${name} function`;
        
        completions.push({
          label: name,
          kind: CompletionKind.Function,
          detail: funcDescription,
          insertText: name + (hasParams ? '()' : '()')
        });
      }
    }
  }
  
  // Add type-specific functions from registry
  if (typeBeforeCursor && typeBeforeCursor.type) {
    // Pass type with collection info: append [] if not singleton
    const typeForRegistry = typeBeforeCursor.singleton === false 
      ? `${typeBeforeCursor.type}[]` 
      : typeBeforeCursor.type;
    const typeFunctions = registry.getFunctionsForType(typeForRegistry);
    for (const func of typeFunctions) {
      // Check if function is already added from general functions
      if (!completions.some(c => c.label === func.name)) {
        const hasParams = func.signatures?.[0]?.parameters && func.signatures[0].parameters.length > 0;
        completions.push({
          label: func.name,
          kind: CompletionKind.Function,
          detail: func.description || `FHIRPath ${func.name} function`,
          insertText: func.name + (hasParams ? '()' : '()')
        });
      }
    }
  }
  
  return completions;
}

/**
 * Get completions for operator context (between expressions)
 */
function getOperatorCompletions(typeBeforeCursor?: TypeInfo): CompletionItem[] {
  const completions: CompletionItem[] = [];
  const addedOperators = new Set<string>();
  
  // Get all operators from registry
  const operatorNames = registry.listOperators();
  
  for (const opName of operatorNames) {
    const opDef = registry.getOperatorDefinition(opName);
    if (opDef) {
      // Check if operator is applicable to the current type
      const isApplicable = !typeBeforeCursor || isOperatorApplicable(opDef, typeBeforeCursor);
      
      if (isApplicable && !addedOperators.has(opDef.symbol)) {
        completions.push({
          label: opDef.symbol,
          kind: CompletionKind.Operator,
          detail: opDef.description || `${opDef.name} operator`,
          sortText: getSortTextForOperator(opDef)
        });
        addedOperators.add(opDef.symbol);
      }
    }
  }
  
  return completions;
}

/**
 * Get completions for type context (after is/as/ofType)
 */
async function getTypeCompletions(
  cursorNode: AnyCursorNode,
  modelProvider?: ModelProvider
): Promise<CompletionItem[]> {
  const completions: CompletionItem[] = [];
  
  // Primitive types - only if modelProvider is available
  if (modelProvider) {
    const primitiveTypes = await modelProvider.getPrimitiveTypes();
    for (const type of primitiveTypes) {
      completions.push({
        label: type,
        kind: CompletionKind.Type,
        detail: 'FHIRPath primitive type',
        sortText: `0_${type}` // Priority 0 for primitives
      });
    }
    
    // Complex types
    const complexTypes = await modelProvider.getComplexTypes();
    for (const type of complexTypes) {
      completions.push({
        label: type,
        kind: CompletionKind.Type,
        detail: 'FHIR complex type',
        sortText: `1_${type}` // Priority 1 for complex types
      });
    }
  }
  
  // Always add resource types when we have a model provider
  // They're valid type names in contexts like ofType()
  if (modelProvider) {
    const resourceTypes = await modelProvider.getResourceTypes();
    for (const type of resourceTypes) {
      completions.push({
        label: type,
        kind: CompletionKind.Type,
        detail: 'FHIR resource type',
        sortText: `2_${type}` // Priority 2 for resource types
      });
    }
  }
  
  return completions;
}

/**
 * Get completions for argument context (in function arguments)
 */
async function getArgumentCompletions(
  cursorNode: AnyCursorNode,
  typeBeforeCursor?: TypeInfo,
  modelProvider?: ModelProvider,
  variables?: Record<string, any>,
  functionCall?: {
    definition: import('./types').FunctionDefinition;
    argumentIndex: number;
  }
): Promise<CompletionItem[]> {
  // Check if this function parameter expects a type reference
  if (functionCall?.definition && functionCall.argumentIndex >= 0) {
    const signature = functionCall.definition.signatures[0];
    const param = signature?.parameters[functionCall.argumentIndex];
    
    if (param?.typeReference) {
      // This parameter expects a type name, provide type completions
      return getTypeCompletions(cursorNode, modelProvider);
    }
  }
  
  const completions: CompletionItem[] = [];
  const argNode = cursorNode as any;
  
  // Add user variables if available
  if (variables) {
    for (const varName of Object.keys(variables)) {
      if (varName === '$this') {
        completions.push({
          label: '$this',
          kind: CompletionKind.Variable,
          detail: 'Current item in iteration'
        });
      } else if (varName === '$index') {
        completions.push({
          label: '$index',
          kind: CompletionKind.Variable,
          detail: 'Current index in iteration'
        });
      } else {
        completions.push({
          label: varName.startsWith('%') ? varName : '%' + varName,
          kind: CompletionKind.Variable,
          detail: 'User-defined variable'
        });
      }
    }
  }
  
  // Add elements if in lambda context
  const functionName = functionCall?.definition.name;
  // Check if the function accepts lambda expressions (could be determined from function signature in registry)
  const lambdaFunctions = ['where', 'select', 'all', 'exists', 'any', 'repeat'];
  if (functionName && lambdaFunctions.includes(functionName)) {
    // In lambda function, provide elements of item type
    if (typeBeforeCursor && modelProvider) {
      const itemType = { ...typeBeforeCursor, singleton: true };
      const typeName = itemType.name || itemType.type;
      // Skip if type is 'Any' as it's not a real FHIR type
      if (typeName && typeName !== 'Any') {
        const elements = await modelProvider.getElements(typeName);
        if (elements.length > 0) {
          for (const element of elements) {
            completions.push({
              label: element.name,
              kind: CompletionKind.Property,
              detail: element.type
            });
          }
        }
      }
    }
  }
  
  // No hardcoded constants - these should come from context or be typed by user
  
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
  
  // Add user variables if available
  if (variables) {
    // Add $index if it's in scope (should be provided by context)
    if ('$index' in variables) {
      completions.push({
        label: '$index',
        kind: CompletionKind.Variable,
        detail: 'Current index'
      });
    }
    
    // Add other user variables
    for (const varName of Object.keys(variables)) {
      if (!varName.startsWith('$')) {
        completions.push({
          label: varName.startsWith('%') ? varName : '%' + varName,
          kind: CompletionKind.Variable,
          detail: 'User-defined variable'
        });
      }
    }
  }
  
  // Get index-related functions from registry
  const functionNames = registry.listFunctions();
  for (const name of functionNames) {
    if (name === 'first' || name === 'last') {
      const funcDef = registry.getFunction(name);
      if (funcDef) {
        completions.push({
          label: name + '()',
          kind: CompletionKind.Function,
          detail: funcDef.description || `${name} function`,
          insertText: name + '()'
        });
      }
    }
  }
  
  return completions;
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
    // First check if items have sortText
    if (a.sortText || b.sortText) {
      const aSortText = a.sortText || a.label;
      const bSortText = b.sortText || b.label;
      return aSortText.localeCompare(bSortText);
    }
    
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