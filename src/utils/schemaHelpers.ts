import { SchemaNode } from '../types/schema.types';

export function generateAutoSchema(config: any): SchemaNode {
  const root: SchemaNode = {
    key: 'root',
    type: 'object',
    children: []
  };

  // Generate based on data sources
  if (config.dataSources && config.dataSources.length > 0) {
    if (config.dataSources.length === 1) {
      // Single source - flat structure
      const source = config.dataSources[0];
      root.children = [
        {
          key: 'data',
          type: 'array',
          children: generateFieldsFromSource(source)
        },
        {
          key: 'meta',
          type: 'object',
          children: [
            { key: 'total', type: 'number' },
            { key: 'page', type: 'number' },
            { key: 'timestamp', type: 'string' }
          ]
        }
      ];
    } else {
      // Multiple sources - nested structure
      root.children = config.dataSources.map(source => ({
        key: source.name.toLowerCase().replace(/\s+/g, '_'),
        type: 'array',
        children: generateFieldsFromSource(source)
      }));
    }
  }

  return root;
}

function generateFieldsFromSource(source: any): SchemaNode[] {
  if (!source.fields || source.fields.length === 0) {
    return [];
  }

  return source.fields.map(field => ({
    key: field,
    type: inferFieldType(field, source.sample_data),
    required: false
  }));
}

function inferFieldType(field: string, sampleData: any[]): 'string' | 'number' | 'boolean' | 'object' | 'array' {
  if (!sampleData || sampleData.length === 0) {
    return 'string';
  }

  const sample = sampleData[0][field];
  
  if (sample === null || sample === undefined) {
    return 'string';
  }
  
  if (Array.isArray(sample)) {
    return 'array';
  }
  
  if (typeof sample === 'object') {
    return 'object';
  }
  
  if (typeof sample === 'boolean') {
    return 'boolean';
  }
  
  if (typeof sample === 'number') {
    return 'number';
  }
  
  return 'string';
}

export function validateSchema(schema: SchemaNode): string[] {
  const errors: string[] = [];
  
  const validate = (node: SchemaNode, path: string = '') => {
    const fullPath = path ? `${path}.${node.key}` : node.key;
    
    if (!node.key) {
      errors.push(`Missing key at ${fullPath}`);
    }
    
    if (!node.type) {
      errors.push(`Missing type at ${fullPath}`);
    }
    
    if (node.type === 'object' && (!node.children || node.children.length === 0)) {
      errors.push(`Empty object at ${fullPath}`);
    }
    
    if (node.children) {
      node.children.forEach(child => validate(child, fullPath));
    }
  };
  
  validate(schema);
  return errors;
}