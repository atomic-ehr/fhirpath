import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { Errors } from '../errors';
import { box, unbox } from '../interpreter/boxing';

const htmlEscapeMap: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const jsonEscapeMap: Record<string, string> = {
  '"': '\\"',
  '\\': '\\\\',
  '\b': '\\b',
  '\f': '\\f',
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
};

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (char) => htmlEscapeMap[char] || char);
}

function escapeJson(str: string): string {
  return str.replace(/["\\\/\b\f\n\r\t]/g, (char) => jsonEscapeMap[char] || char);
}

export const evaluate: FunctionEvaluator = async (input, context, args, evaluator) => {
  // escape() takes exactly one argument (target)
  if (args.length !== 1) {
    throw Errors.wrongArgumentCount('escape', 1, args.length);
  }

  // If input is empty, return empty
  if (input.length === 0) {
    return { value: [], context };
  }

  // If input has multiple items, error
  if (input.length > 1) {
    throw Errors.singletonRequired('escape', input.length);
  }

  const boxedValue = input[0];
  if (!boxedValue) {
    return { value: [], context };
  }
  
  const value = unbox(boxedValue);

  // Value must be a string
  if (typeof value !== 'string') {
    throw Errors.invalidOperandType('escape', `${typeof value}`);
  }

  // Evaluate target
  const targetResult = await evaluator(args[0]!, input, context);
  if (targetResult.value.length === 0) {
    return { value: [], context };
  }
  if (targetResult.value.length > 1) {
    throw Errors.invalidOperation('escape target must be a single value');
  }

  const boxedTarget = targetResult.value[0];
  if (!boxedTarget) {
    return { value: [], context };
  }
  
  const target = unbox(boxedTarget);
  if (typeof target !== 'string') {
    throw Errors.invalidOperation('escape target must be a string');
  }

  // Escape based on target
  let result: string;
  switch (target.toLowerCase()) {
    case 'html':
      result = escapeHtml(value);
      break;
    case 'json':
      result = escapeJson(value);
      break;
    default:
      // Unknown target, return empty
      return { value: [], context };
  }

  return { value: [box(result, { type: 'String', singleton: true })], context };
};

export const escapeFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'escape',
  category: ['string'],
  description: 'Escapes a string for a given target (html or json)',
  examples: [
    "'\"test\"'.escape('html')",
    "'\"test\"'.escape('json')"
  ],
  signatures: [
    {
      name: 'escape',
      input: { type: 'String', singleton: true },
      parameters: [
        { name: 'target', type: { type: 'String', singleton: true }, optional: false }
      ],
      result: { type: 'String', singleton: true }
    }
  ],
  evaluate
};