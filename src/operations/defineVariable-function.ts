import type { FunctionDefinition, LiteralNode, AnalysisContext, InternalAnalysisResult } from '../types';
import { Errors } from '../errors';
import { RuntimeContextManager } from '../interpreter/runtime-context';
import { type FunctionEvaluator } from '../types';
import { box, unbox } from '../interpreter/boxing';
import { DiagnosticSeverity } from '../types';
import { toDiagnostic } from '../errors';

export const evaluate: FunctionEvaluator = async (input, context, args, evaluator) => {
  if (args.length < 1) {
    throw Errors.invalidOperation('defineVariable requires at least 1 argument');
  }

  let varName: string;
  
  // Check if first argument is a literal
  const nameArg = args[0];
  if (nameArg && nameArg.type === 'Literal' && (nameArg as LiteralNode).valueType === 'string') {
    // Fast path: literal string
    varName = (nameArg as LiteralNode).value as string;
  } else {
    // Slow path: evaluate expression to get name
    const nameResult = await evaluator(nameArg!, input, context);
    if (nameResult.value.length === 0) {
      throw Errors.invalidOperation('Variable name expression evaluated to empty');
    }
    const firstValue = nameResult.value[0];
    if (!firstValue) {
      throw Errors.invalidOperation('Variable name expression evaluated to empty');
    }
    const nameValue = unbox(firstValue);
    if (typeof nameValue !== 'string') {
      throw Errors.invalidOperation('Variable name must evaluate to a string');
    }
    varName = nameValue;
  }
  
  let value: any[];
  
  if (args.length === 1) {
    // Single argument: defineVariable(name) - use input as value
    value = input;
  } else {
    // Two arguments: defineVariable(name, value) - evaluate value expression
    // $this should be set to the input collection (unboxed to avoid double-boxing)
    const unboxedInput = input.map(v => unbox(v));
    const tempContext = RuntimeContextManager.setVariable(context, '$this', unboxedInput, true);
    const valueExpr = args[1];
    if (!valueExpr) {
      throw Errors.invalidOperation('defineVariable requires a value expression');
    }
    
    const valueResult = await evaluator(valueExpr, input, tempContext);
    value = valueResult.value;
  }

  // Set the variable using RuntimeContextManager (handles prefixes and checks)
  // This will throw an error if the variable is already defined (per spec)
  const newContext = RuntimeContextManager.setVariable(context, varName, value);

  
  // Pass through input unchanged
  return { value: input, context: newContext };
};

export const defineVariableFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'defineVariable',
  doesNotPropagateEmpty: true,  // defineVariable should always execute to set the variable
  category: ['context'],
  description: 'Defines a variable in the evaluation context',
  examples: [
    'Patient.defineVariable("patientName", name.first())',
    'Patient.name.defineVariable("names")'
  ],
  signatures: [{

    name: 'defineVariable',
    input: { type: 'Any', singleton: false },
    parameters: [
      { name: 'name', type: { type: 'String', singleton: true } },
      { name: 'value', type: { type: 'Any', singleton: false }, optional: true, expression: true },
    ],
    result: { type: 'Any', singleton: false },
  }],
  evaluate,
  async inferResultType(analyzer, node, inputType) {
    // defineVariable returns its input type unchanged
    return inputType || { type: 'Any', singleton: false };
  },
  /**
   * Analysis-time behavior for defineVariable.
   * Adds the variable to the context for downstream expressions.
   */
  async analyze(context: AnalysisContext, args): Promise<InternalAnalysisResult> {
    const diagnostics: any[] = [];
    
    // Validate we have at least one argument
    if (args.length < 1) {
      return { 
        type: context.inputType, 
        diagnostics: [{
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
          message: 'defineVariable requires at least 1 argument',
          severity: DiagnosticSeverity.Error
        }]
      };
    }
    
    // First argument: variable name (can be literal or expression)
    const nameNode = args[0];
    let varName: string | undefined;
    let isDynamic = false;
    
    if (nameNode && nameNode.type === 'Literal' && (nameNode as LiteralNode).valueType === 'string') {
      // Static variable name - full analysis
      varName = (nameNode as LiteralNode).value as string;
      
      // Check if variable already exists
      if (context.userVariables.has(varName)) {
        diagnostics.push({
          range: nameNode.range,
          message: `Variable '${varName}' is already defined`,
          severity: DiagnosticSeverity.Error
        });
        return { type: context.inputType, diagnostics };
      }
    } else {
      // Dynamic variable name - limited analysis
      isDynamic = true;
      diagnostics.push({
        range: nameNode?.range || { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
        message: 'Dynamic variable name: cannot validate variable references at compile time',
        severity: DiagnosticSeverity.Warning
      });
      
      // Still analyze the expression for other errors
      if (nameNode) {
        const nameResult = await context.analyzeNode(nameNode);
        diagnostics.push(...nameResult.diagnostics);
        
        // Check if it evaluates to string type
        if (nameResult.type.type !== 'String') {
          diagnostics.push({
            range: nameNode.range,
            message: 'Variable name expression must evaluate to String type',
            severity: DiagnosticSeverity.Error
          });
        }
      }
    }
    
    // Determine the type of the variable
    let varType = context.inputType;
    
    if (args.length >= 2 && args[1]) {
      // If value expression provided, analyze it to get its type
      const valueResult = await context.analyzeNode(args[1]);
      diagnostics.push(...valueResult.diagnostics);
      varType = valueResult.type;
    }
    
    // Return with modified context
    // For static names, add the variable to context
    // For dynamic names, mark that dynamic variables exist
    let resultContext = context;
    if (varName) {
      resultContext = context.withUserVariable(varName, varType);
    } else if (isDynamic) {
      resultContext = context.withDynamicVariables();
    }
    
    return {
      type: context.inputType, // defineVariable returns input unchanged
      diagnostics,
      context: resultContext
    };
  }
};
