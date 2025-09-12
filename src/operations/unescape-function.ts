import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { Errors } from '../errors';
import { box, unbox } from '../interpreter/boxing';

const htmlUnescapeMap: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'",
  '&#x2F;': '/',
};

function unescapeHtml(str: string): string {
  return str.replace(/&(?:amp|lt|gt|quot|#39|#x27|#x2F);/g, (entity) => htmlUnescapeMap[entity] || entity);
}

function unescapeJson(str: string): string {
  // Handle JSON escape sequences
  return str.replace(/\\(.)/g, (match, char) => {
    switch (char) {
      case '"': return '"';
      case '\\': return '\\';
      case '/': return '/';
      case 'b': return '\b';
      case 'f': return '\f';
      case 'n': return '\n';
      case 'r': return '\r';
      case 't': return '\t';
      default: return match; // Unknown escape, leave as is
    }
  });
}

export const evaluate: FunctionEvaluator = async (input, context, args, evaluator) => {
  // unescape() takes exactly one argument (target)
  if (args.length !== 1) {
    throw Errors.wrongArgumentCount('unescape', 1, args.length);
  }

  // If input is empty, return empty
  if (input.length === 0) {
    return { value: [], context };
  }

  // If input has multiple items, error
  if (input.length > 1) {
    throw Errors.singletonRequired('unescape', input.length);
  }

  const boxedValue = input[0];
  if (!boxedValue) {
    return { value: [], context };
  }
  
  const value = unbox(boxedValue);

  // Value must be a string
  if (typeof value !== 'string') {
    throw Errors.invalidOperandType('unescape', `${typeof value}`);
  }

  // Evaluate target
  const targetResult = await evaluator(args[0]!, input, context);
  if (targetResult.value.length === 0) {
    return { value: [], context };
  }
  if (targetResult.value.length > 1) {
    throw Errors.invalidOperation('unescape target must be a single value');
  }

  const boxedTarget = targetResult.value[0];
  if (!boxedTarget) {
    return { value: [], context };
  }
  
  const target = unbox(boxedTarget);
  if (typeof target !== 'string') {
    throw Errors.invalidOperation('unescape target must be a string');
  }

  // Unescape based on target
  let result: string;
  switch (target.toLowerCase()) {
    case 'html':
      result = unescapeHtml(value);
      break;
    case 'json':
      result = unescapeJson(value);
      break;
    default:
      // Unknown target, return empty
      return { value: [], context };
  }

  return { value: [box(result, { type: 'String', singleton: true })], context };
};

export const unescapeFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'unescape',
  category: ['string'],
  description: 'Unescapes a string for a given target (html or json)',
  examples: [
    "'&quot;test&quot;'.unescape('html')",
    "'\\\"test\\\"'.unescape('json')"
  ],
  signatures: [
    {
      name: 'unescape',
      input: { type: 'String', singleton: true },
      parameters: [
        { name: 'target', type: { type: 'String', singleton: true }, optional: false }
      ],
      result: { type: 'String', singleton: true }
    }
  ],
  evaluate
};