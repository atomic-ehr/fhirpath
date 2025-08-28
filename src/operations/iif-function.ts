import type { FunctionDefinition, AnalysisContext, InternalAnalysisResult } from '../types';
import { Errors, ErrorCodes } from '../errors';
import type { FunctionEvaluator } from '../types';
import { box, unbox } from '../boxing';
import { RuntimeContextManager } from '../runtime-context';
import { NodeType } from '../parser';
import { DiagnosticSeverity } from '../types';

export const evaluate: FunctionEvaluator = async (input, context, args, evaluator) => {
  if (args.length < 2) {
    throw Errors.invalidOperation('iif requires at least 2 arguments');
  }
  
  if (args.length > 3) {
    throw Errors.invalidOperation('iif takes at most 3 arguments');
  }

  // Check for multiple items in input collection
  if (input.length > 1) {
    throw Errors.emptyNotAllowed('iif');
  }

  // Always evaluate condition
  const condExpr = args[0];
  const thenExpr = args[1];
  const elseExpr = args[2]; // Optional
  
  if (!condExpr || !thenExpr) {
    throw Errors.invalidOperation('iif requires condition and true-result arguments');
  }
  
  // When evaluating expressions within iif, ensure $this refers to the input
  // We need to preserve context variables but set $this to the iif input
  // Use RuntimeContextManager to properly handle prototype chain
  let evalContext = RuntimeContextManager.copy(context);
  evalContext = RuntimeContextManager.setVariable(evalContext, '$this', input.map(v => unbox(v)), true);
  
  const condResult = await evaluator(condExpr, input, evalContext);
  
  // Empty condition is treated as false
  if (condResult.value.length === 0) {
    // If no else expression provided, return empty
    if (!elseExpr) {
      return { value: [], context };
    }
    // Otherwise evaluate the else branch
    return await evaluator(elseExpr, input, context);
  }

  const boxedCondition = condResult.value[0];
  if (!boxedCondition) {
    return { value: [], context };
  }
  
  const condition = unbox(boxedCondition);
  
  // Check if condition is a boolean
  if (typeof condition !== 'boolean') {
    // Non-boolean criteria returns empty
    return { value: [], context };
  }
  
  // Evaluate only the needed branch
  if (condition === true) {
    return await evaluator(thenExpr, input, evalContext);
  } else {
    // If no else expression provided, return empty
    if (!elseExpr) {
      return { value: [], context };
    }
    return await evaluator(elseExpr, input, evalContext);
  }
};

export const iifFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'iif',
  doesNotPropagateEmpty: true,  // iif evaluates even with empty input
  category: ['control'],
  description: 'If-then-else expression (immediate if)',
  examples: ['iif(gender = "male", "Mr.", "Ms.")'],
  signatures: [{

    name: 'iif',
    input: { type: 'Any', singleton: false },
    parameters: [
      { name: 'condition', expression: true, type: { type: 'Boolean', singleton: true } },
      { name: 'trueResult', expression: true, type: { type: 'Any', singleton: false } },
      { name: 'falseResult', expression: true, type: { type: 'Any', singleton: false }, optional: true },
    ],
    result: { type: 'Any', singleton: false },
  }],
  evaluate,
  
  /**
   * Analysis-time behavior for iif with lazy evaluation.
   * Only analyzes reachable branches when condition is a literal.
   */
  async analyze(context: AnalysisContext, args): Promise<InternalAnalysisResult> {
    const diagnostics: any[] = [];
    
    // Validate argument count
    if (args.length < 2) {
      return {
        type: { type: 'Any', singleton: false },
        diagnostics: [{
          message: 'iif requires at least 2 arguments',
          severity: DiagnosticSeverity.Error,
          code: ErrorCodes.WRONG_ARGUMENT_COUNT,
          source: 'fhirpath',
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }
        }]
      };
    }
    
    if (args.length > 3) {
      return {
        type: { type: 'Any', singleton: false },
        diagnostics: [{
          message: 'iif takes at most 3 arguments',
          severity: DiagnosticSeverity.Error,
          code: ErrorCodes.WRONG_ARGUMENT_COUNT,
          source: 'fhirpath',
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }
        }]
      };
    }
    
    // Analyze condition
    const conditionArg = args[0];
    if (!conditionArg) {
      return {
        type: { type: 'Any', singleton: false },
        diagnostics: [{
          message: 'iif requires a condition argument',
          severity: DiagnosticSeverity.Error,
          code: ErrorCodes.WRONG_ARGUMENT_COUNT,
          source: 'fhirpath',
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }
        }]
      };
    }
    const condResult = await context.analyzeNode(conditionArg);
    diagnostics.push(...condResult.diagnostics);
    
    // Check if condition is a literal boolean
    let isLiteralTrue = false;
    let isLiteralFalse = false;
    
    if (conditionArg.type === NodeType.Literal) {
      const literalValue = (conditionArg as any).value;
      if (literalValue === true) {
        isLiteralTrue = true;
      } else if (literalValue === false) {
        isLiteralFalse = true;
      }
    }
    
    let trueBranchType = { type: 'Any', singleton: false } as any;
    let falseBranchType = { type: 'Any', singleton: false } as any;
    
    // Lazy evaluation: only analyze reachable branches
    if (isLiteralTrue) {
      // Only true branch is reachable
      const trueBranch = args[1];
      if (!trueBranch) {
        return {
          type: { type: 'Any', singleton: false },
          diagnostics
        };
      }
      const trueBranchResult = await context.analyzeNode(trueBranch);
      diagnostics.push(...trueBranchResult.diagnostics);
      trueBranchType = trueBranchResult.type;
      
      // Warn about unreachable false branch
      if (args.length === 3 && args[2]) {
        diagnostics.push({
          message: 'Unreachable code: false branch will never execute',
          severity: DiagnosticSeverity.Warning,
          code: ErrorCodes.UNREACHABLE_CODE,
          source: 'fhirpath',
          range: args[2].range || { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }
        });
      }
      
      return { type: trueBranchType, diagnostics };
    } else if (isLiteralFalse) {
      // Only false branch is reachable (if it exists)
      // Warn about unreachable true branch
      const trueBranch = args[1];
      if (trueBranch) {
        diagnostics.push({
          message: 'Unreachable code: true branch will never execute',
          severity: DiagnosticSeverity.Warning,
          code: ErrorCodes.UNREACHABLE_CODE,
          source: 'fhirpath',
          range: trueBranch.range || { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }
        });
      }
      
      if (args.length === 3 && args[2]) {
        const falseBranchResult = await context.analyzeNode(args[2]);
        diagnostics.push(...falseBranchResult.diagnostics);
        falseBranchType = falseBranchResult.type;
        return { type: falseBranchType, diagnostics };
      } else {
        // No else branch, return empty
        return { type: { type: 'Any', singleton: false }, diagnostics };
      }
    } else {
      // Dynamic condition: analyze both branches
      const trueBranch = args[1];
      if (trueBranch) {
        const trueBranchResult = await context.analyzeNode(trueBranch);
        diagnostics.push(...trueBranchResult.diagnostics);
        trueBranchType = trueBranchResult.type;
      }
      
      if (args.length === 3 && args[2]) {
        const falseBranchResult = await context.analyzeNode(args[2]);
        diagnostics.push(...falseBranchResult.diagnostics);
        falseBranchType = falseBranchResult.type;
        
        // Result type is the union of both branches
        // For now, if they differ, return Any
        if (trueBranchType.type === falseBranchType.type && 
            trueBranchType.singleton === falseBranchType.singleton) {
          return { type: trueBranchType, diagnostics };
        } else if (trueBranchType.type === falseBranchType.type) {
          // Same type but different singleton - result is collection
          return { type: { type: trueBranchType.type, singleton: false }, diagnostics };
        }
      }
      
      return { type: { type: 'Any', singleton: false }, diagnostics };
    }
  },
  
  async inferResultType(analyzer, node, inputType) {
    // iif returns the common type of the true and false branches
    if (node.arguments.length >= 2) {
      const trueBranchType = await (analyzer as any).inferType(node.arguments[1]!, inputType);
      if (node.arguments.length >= 3) {
        const falseBranchType = await (analyzer as any).inferType(node.arguments[2]!, inputType);
        // If both branches have the same type, use that
        if (trueBranchType.type === falseBranchType.type && 
            trueBranchType.singleton === falseBranchType.singleton) {
          return trueBranchType;
        }
        // If types are the same but singleton differs, return as collection
        if (trueBranchType.type === falseBranchType.type) {
          // One is singleton, one is collection - result must be collection
          return { type: trueBranchType.type, singleton: false };
        }
        // Otherwise, check if one is a subtype of the other
        if ((analyzer as any).isTypeCompatible(trueBranchType, falseBranchType)) {
          return falseBranchType;
        }
        if ((analyzer as any).isTypeCompatible(falseBranchType, trueBranchType)) {
          return trueBranchType;
        }
      } else {
        // Only true branch, result can be that type or empty
        return { ...trueBranchType, singleton: false };
      }
    }
    return { type: 'Any', singleton: false };
  }
};
