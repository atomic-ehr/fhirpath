import type { FunctionDefinition, FunctionEvaluator, ASTNode } from '../types';
import { box, unbox, type FHIRPathValue } from '../interpreter/boxing';
import { Errors } from '../errors';
import { isIdentifierNode, isFunctionNode } from '../types';

/**
 * SQL on FHIR: getReferenceKey(resourceType?)
 *
 * Returns a foreign key from a Reference element that can be used to join
 * to another resource. The returned value equals getResourceKey() on the
 * referenced resource.
 *
 * If resourceType is provided, returns empty collection if the reference
 * doesn't point to that type. This enables type-safe joins.
 *
 * @see https://build.fhir.org/ig/FHIR/sql-on-fhir-v2/functional-model.html
 */

/**
 * Parse a FHIR reference string to extract resourceType and id
 * Handles formats:
 * - "Patient/123" (relative reference)
 * - "http://example.org/fhir/Patient/123" (absolute reference)
 * - "urn:uuid:..." (URN reference)
 */
function parseReference(reference: string): { resourceType?: string; id?: string } | null {
  if (!reference) return null;

  // Handle URN references (urn:uuid:..., urn:oid:...)
  if (reference.startsWith('urn:')) {
    // For URN references, the whole URN is the identifier
    return { id: reference };
  }

  // Handle absolute URLs - extract the last two path segments
  // e.g., "http://example.org/fhir/Patient/123" -> Patient/123
  if (reference.includes('://')) {
    const url = reference.split('?')[0]; // Remove query string
    const segments = url!.split('/').filter(s => s);
    if (segments.length >= 2) {
      const id = segments[segments.length - 1];
      const resourceType = segments[segments.length - 2];
      return { resourceType, id };
    }
    return null;
  }

  // Handle relative references - "ResourceType/id"
  const parts = reference.split('/');
  if (parts.length === 2) {
    return { resourceType: parts[0], id: parts[1] };
  }

  // Handle contained references (#id)
  if (reference.startsWith('#')) {
    return { id: reference.substring(1) };
  }

  return null;
}

/**
 * Extract type name from AST node (identifier or function call)
 */
function extractTypeName(typeArg: ASTNode): string {
  if (isIdentifierNode(typeArg)) {
    return typeArg.name;
  } else if (isFunctionNode(typeArg) && isIdentifierNode(typeArg.name)) {
    return typeArg.name.name;
  }
  throw Errors.invalidOperation(`getReferenceKey() requires a type name as argument, got ${typeArg.type}`);
}

export const evaluate: FunctionEvaluator = async (input, context, args, evaluator) => {
  // Extract optional resourceType filter
  let targetResourceType: string | undefined;
  if (args.length > 0) {
    targetResourceType = extractTypeName(args[0]!);
  }

  const results: FHIRPathValue<string>[] = [];

  for (const boxedItem of input) {
    const item = unbox(boxedItem);

    if (!item || typeof item !== 'object') {
      continue;
    }

    // Extract reference string from Reference element
    let referenceString: string | undefined;

    if ('reference' in item && typeof item.reference === 'string') {
      // Standard FHIR Reference: { reference: "Patient/123", ... }
      referenceString = item.reference;
    } else if (typeof item === 'string') {
      // Direct string reference (less common but possible)
      referenceString = item;
    }

    if (!referenceString) {
      continue;
    }

    const parsed = parseReference(referenceString);
    if (!parsed || !parsed.id) {
      continue;
    }

    // If resourceType filter is specified, check it matches
    if (targetResourceType) {
      if (!parsed.resourceType || parsed.resourceType !== targetResourceType) {
        // Return empty for this item (type doesn't match)
        continue;
      }
    }

    // Return the reference key (the id portion)
    results.push(box(parsed.id, { type: 'String', singleton: true }));
  }

  return { value: results, context };
};

export const getReferenceKeyFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'getReferenceKey',
  category: ['SQL on FHIR', 'navigation'],
  description:
    'Returns a foreign key from a Reference element for joining to another resource. ' +
    'The returned value equals getResourceKey() on the referenced resource. ' +
    'If resourceType is provided, returns empty if the reference is not of that type.',
  examples: [
    'subject.getReferenceKey()',
    'subject.getReferenceKey(Patient)',
    'Observation.subject.getReferenceKey(Patient)',
  ],
  signatures: [
    {
      name: 'getReferenceKey',
      input: { type: 'Any', singleton: false, name: 'Reference' },
      parameters: [
        {
          name: 'resourceType',
          type: { type: 'Any', singleton: true },
          optional: true,
          expression: true,
          typeReference: true, // Expects a type name like Patient, Observation
        }
      ],
      result: { type: 'String', singleton: false },
    }
  ],
  evaluate,
};
