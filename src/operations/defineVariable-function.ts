import type { FunctionDefinition, LiteralNode, AnalysisContext, InternalAnalysisResult } from '../types';
import { Errors } from '../errors';
import { RuntimeContextManager } from '../interpreter';
import { type FunctionEvaluator } from '../types';
import { box, unbox } from '../boxing';
import { DiagnosticSeverity } from '../types';
import { toDiagnostic } from '../errors';

export const evaluate: FunctionEvaluator = async (input, context, args, evaluator) => {
  if (args.length < 1) {
    throw Errors.invalidOperation('defineVariable requires at least 1 argument');
  }

  const nameNode = args[0] as LiteralNode;
  if (nameNode.valueType !== 'string') {
    throw Errors.invalidOperation('Variable name must be a string');
  }

  const varName = nameNode.value as string;
  
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
    
    // First argument must be a string literal (variable name)
    const nameNode = args[0] as LiteralNode;
    if (nameNode.type !== 'Literal' || nameNode.valueType !== 'string') {
      diagnostics.push({
        range: nameNode.range,
        message: 'Variable name must be a string literal',
        severity: DiagnosticSeverity.Error
      });
      return { type: context.inputType, diagnostics };
    }
    
    const varName = nameNode.value as string;
    
    // Check if variable already exists
    if (context.userVariables.has(varName)) {
      diagnostics.push({
        range: nameNode.range,
        message: `Variable '${varName}' is already defined`,
        severity: DiagnosticSeverity.Error
      });
      return { type: context.inputType, diagnostics };
    }
    
    // Determine the type of the variable
    let varType = context.inputType;
    
    if (args.length >= 2 && args[1]) {
      // If value expression provided, analyze it to get its type
      const valueResult = await context.analyzeNode(args[1]);
      diagnostics.push(...valueResult.diagnostics);
      varType = valueResult.type;
    }
    
    // Return with modified context that includes the new variable
    return {
      type: context.inputType, // defineVariable returns input unchanged
      diagnostics,
      context: context.withUserVariable(varName, varType) // Add variable to context
    };
  }
};