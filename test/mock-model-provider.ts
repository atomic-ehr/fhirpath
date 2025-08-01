import type { ModelProvider, TypeInfo, TypeName } from '../src/types';

const typeConversion: Record<string, TypeName> = {
    'string': 'String',
    'boolean': 'Boolean',
    'integer': 'Integer',
    'decimal': 'Decimal',
    'date': 'Date',
    'dateTime': 'DateTime',
    'time': 'Time',
    'instant': 'DateTime',
    'uri': 'String',
    'url': 'String',
    'canonical': 'String',
    'code': 'String',
    'oid': 'String',
    'id': 'String',
    'markdown': 'String',
    'base64Binary': 'String',
    'positiveInt': 'Integer',
    'unsignedInt': 'Integer',
    'uuid': 'String',
    'xhtml': 'String'
}

interface ElementSchema {
    type?: string;
    choices?: Array<{type: string}>;
    array?: boolean;
    base?: string;
    elements?: Record<string, ElementSchema>;
}

interface TypeSchema {
    base?: string;
    elements?: Record<string, ElementSchema>;
    type?: string;
}

const model: Record<string, TypeSchema> = {
    string: {
        type: 'string'
    },
    uri: {
        type: 'string'
    },
    Resource: {
        elements: {
            id: { type: 'string' },
            meta: { type: 'Meta' },
            implicitRules: { type: 'uri' },
        }
    },
    DomainResource: {
        base: 'Resource',
        elements: {
            text: { type: 'Narrative' },
        }
    },
    Narrative: {
        elements: {
            status: { type: 'code' },
            div: { type: 'xhtml' }
        }
    },
    HumanName: {
        elements: {
            given: { type: 'string', array: true },
            family: { type: 'string' }
        }
    },
    Patient: {
        base: 'DomainResource',
        elements: {
            name:  { 
                type: 'HumanName', 
                array: true
            },
            multipleBirth: {
                choices: [
                    { type: 'boolean' },
                    { type: 'integer' }
                ]
            },
            active: {
                type: 'boolean'
            },
            birthDate: {
                type: 'date'
            }
        }
    }
}

interface ModelContext {
    path: string;
    schemaset: any[];
    isUnion?: boolean;
    choices?: Array<{
        type: TypeName;
        name: string;
        singleton: boolean;
    }>;
}

function getParents(schema: TypeSchema): TypeSchema[] {
    const schemaset: TypeSchema[] = [schema];
    let currentSchema = schema;
    while (currentSchema?.base) {
        const parent = model[currentSchema.base];
        if (!parent) {
            console.warn(`Base type '${currentSchema.base}' not found in model`);
            break;
        }
        schemaset.push(parent);
        currentSchema = parent;
    }
    return schemaset;
}

export const modelProvider: ModelProvider<ModelContext> = {
  getType: (typeName: string): TypeInfo<ModelContext> | undefined => {
    const schema = model[typeName];
    if (!schema) {
      // Check if it's a primitive type
      if (typeConversion[typeName]) {
        return {
          type: typeConversion[typeName],
          namespace: 'FHIR',
          name: typeName,
          singleton: true,
          modelContext: { path: typeName, schemaset: [] }
        };
      }
      return undefined;
    }

    const schemaset = getParents(schema);

    const fhirType = schema.type && typeConversion[schema.type] ? typeConversion[schema.type] : 'Any';
    const typeInfo: TypeInfo<ModelContext> = {
      type: fhirType,
      namespace: 'FHIR',
      name: typeName,
      singleton: true,
      modelContext: { path: typeName, schemaset }
    };
    return typeInfo;
  },
  getElementType: (parentType: TypeInfo<ModelContext>, propertyName: string): TypeInfo<ModelContext> | undefined => {
    const schemaset = parentType.modelContext?.schemaset as TypeSchema[];
    const path = parentType.modelContext?.path + '.' + propertyName;
    
    // Find the element in the schema hierarchy
    let elementSchema: ElementSchema | undefined;
    for (const schema of schemaset) {
      if (schema.elements && schema.elements[propertyName]) {
        elementSchema = schema.elements[propertyName];
        break;
      }
    }
    
    if (!elementSchema) {
      return undefined;
    }
    
    // Handle choice types
    if (elementSchema.choices) {
      const choices = elementSchema.choices.map(choice => {
        const choiceType = typeConversion[choice.type] || 'Any';
        return {
          type: choiceType,
          name: choice.type,
          singleton: !elementSchema.array
        };
      });
      
      return {
        type: 'Any',
        namespace: 'FHIR',
        name: path,
        singleton: !elementSchema.array,
        modelContext: { 
          path, 
          schemaset: [elementSchema],
          isUnion: true,
          choices
        }
      };
    }
    
    // Handle regular types
    if (elementSchema.type) {
      const fhirpathType = typeConversion[elementSchema.type] || 'Any';
      const typeSchema = model[elementSchema.type];
      
      let elementSchemaset: TypeSchema[] = [];
      if (typeSchema) {
        elementSchemaset = getParents(typeSchema);
      } else if (!typeConversion[elementSchema.type]) {
        // Unknown type
        return undefined;
      }
      
      return {
        type: fhirpathType,
        namespace: 'FHIR',
        name: elementSchema.type,
        singleton: !elementSchema.array,
        modelContext: { path, schemaset: elementSchemaset }
      };
    }
    
    return undefined;
  },

  ofType: (type: TypeInfo<ModelContext>, typeName: TypeName): TypeInfo<ModelContext> | undefined => {
    const context = type.modelContext;
    
    // Handle union types - filter to matching choice
    if (context?.isUnion && context?.choices) {
      for (const choice of context.choices) {
        if (choice.type === typeName) {
          return {
            type: choice.type,
            namespace: 'FHIR',
            name: choice.name,
            singleton: choice.singleton,
            modelContext: {
              path: context.path + `[${choice.name}]`,
              schemaset: []
            }
          };
        }
        // Also check by name for model types
        if (choice.name && typeConversion[choice.name] === typeName) {
          return {
            type: typeName,
            namespace: 'FHIR',
            name: choice.name,
            singleton: choice.singleton,
            modelContext: {
              path: context.path + `[${choice.name}]`,
              schemaset: []
            }
          };
        }
      }
      return undefined;
    }
    
    // For non-union types, check if the type matches
    if (type.type === typeName) {
      return type;
    }
    
    // Check if we can convert the model type to the requested FHIRPath type
    if (type.name && typeConversion[type.name] === typeName) {
      return {
        ...type,
        type: typeName
      };
    }
    
    return undefined;
  },

  getElementNames: (parentType: TypeInfo<ModelContext>): string[] => {
    let schemaset = parentType.modelContext?.schemaset as any[];
    let names: Set<string> = new Set();
    for (let schema of schemaset) {
        for (let element of Object.keys(schema.elements)) {
            names.add(element);
        }
    }
    return Array.from(names);
  }
}

