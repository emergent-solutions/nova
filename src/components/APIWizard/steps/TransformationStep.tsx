import React, { useState } from 'react';
import {
  Card,
  Button,
  Intent,
  NonIdealState,
  Icon,
  Tag,
  Callout,
  HTMLSelect,
  FormGroup,
  InputGroup
} from '@blueprintjs/core';
import { APIEndpointConfig } from '../../../types/schema.types';
import { Transformation } from '../../../types/api.types';
import TransformationBuilder from '../../TransformationBuilder/TransformationBuilder';

interface TransformationStepProps {
  config: APIEndpointConfig;
  onUpdate: (updates: Partial<APIEndpointConfig>) => void;
}

interface FieldInfo {
  path: string;
  display: string;
  type: string;
}

const TransformationStep: React.FC<TransformationStepProps> = ({ config, onUpdate }) => {
  const [transformations, setTransformations] = useState<Transformation[]>(
    config.transformations || []
  );
  const [selectedTransform, setSelectedTransform] = useState<string | null>(null);
  const [editingTransform, setEditingTransform] = useState<Transformation | null>(null);
  const [newFieldName, setNewFieldName] = useState<string>('');

  const addTransformation = () => {
    const newTransform: Transformation = {
      id: `transform_${Date.now()}`,
      type: 'direct',
      config: {},
      source_field: '',
      target_field: ''
    };
    setEditingTransform(newTransform);
  };

  const saveTransformation = (transform: Transformation) => {
    // Handle new field creation
    if (transform.target_field === '__new__' && newFieldName) {
      transform.target_field = newFieldName;
    }
    
    const updated = editingTransform?.id && transformations.find(t => t.id === editingTransform.id)
      ? transformations.map(t => t.id === editingTransform.id ? transform : t)
      : [...transformations, transform];
    
    setTransformations(updated);
    onUpdate({ transformations: updated });
    setEditingTransform(null);
    setNewFieldName('');
  };

  const removeTransformation = (id: string) => {
    const updated = transformations.filter(t => t.id !== id);
    setTransformations(updated);
    onUpdate({ transformations: updated });
  };

  const getTransformIcon = (type: string) => {
    const iconMap: Record<string, string> = {
      'uppercase': 'font',
      'lowercase': 'font',
      'capitalize': 'font',
      'trim': 'text-highlight',
      'date-format': 'calendar',
      'parse-number': 'numerical',
      'round': 'numerical',
      'lookup': 'search',
      'regex-extract': 'filter',
      'string-format': 'code-block',
      'compute': 'calculator',
      'conditional': 'fork'
    };
    return iconMap[type] || 'exchange';
  };

  const availableFields = getAllFields(config);

  return (
    <div className="transformation-step">
      <Callout intent={Intent.PRIMARY} icon="info-sign">
        Apply transformations to your data before output. Transform text, dates, numbers,
        and create computed fields.
      </Callout>

      <div className="transformations-container" style={{ marginTop: '20px' }}>
        <div className="transformations-list">
          <div className="list-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h4>Transformations Pipeline</h4>
            <Button
              icon="add"
              text="Add Transformation"
              intent={Intent.PRIMARY}
              onClick={addTransformation}
              disabled={availableFields.length === 0}
            />
          </div>

          {availableFields.length === 0 ? (
            <NonIdealState
              icon="warning-sign"
              title="No fields available"
              description="Please configure your data sources first to see available fields for transformation."
            />
          ) : transformations.length > 0 ? (
            <div className="pipeline-list">
              {transformations.map((transform, index) => (
                <Card
                  key={transform.id}
                  className={`transform-item ${selectedTransform === transform.id ? 'selected' : ''}`}
                  interactive
                  onClick={() => setSelectedTransform(transform.id)}
                  style={{ marginBottom: '10px', padding: '15px' }}
                >
                  <div className="transform-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div className="transform-info" style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <Icon icon={getTransformIcon(transform.type)} />
                      <div>
                        <strong>Step {index + 1}: {transform.type.replace('-', ' ').replace('_', ' ')}</strong>
                        {transform.source_field && (
                          <div className="field-mapping" style={{ marginTop: '5px', display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                            <Tag minimal title={transform.source_field}>
                              {transform.source_field.length > 30 
                                ? `...${transform.source_field.slice(-28)}` 
                                : transform.source_field}
                            </Tag>
                            <Icon icon="arrow-right" size={12} />
                            <Tag minimal intent={Intent.SUCCESS} title={transform.target_field || transform.source_field}>
                              {(transform.target_field || transform.source_field).length > 30
                                ? `...${(transform.target_field || transform.source_field).slice(-28)}`
                                : (transform.target_field || transform.source_field)}
                            </Tag>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="transform-actions" style={{ display: 'flex', gap: '5px' }}>
                      <Button
                        minimal
                        icon="edit"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTransform(transform);
                        }}
                      />
                      <Button
                        minimal
                        icon="trash"
                        intent={Intent.DANGER}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTransformation(transform.id);
                        }}
                      />
                    </div>
                  </div>
                  {transform.config && Object.keys(transform.config).length > 0 && (
                    <div className="transform-config-preview" style={{ marginTop: '10px', display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      {Object.entries(transform.config).map(([key, value]) => (
                        <Tag key={key} minimal>
                          {key}: {String(value)}
                        </Tag>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <NonIdealState
              icon="exchange"
              title="No transformations"
              description="Add transformations to modify your data"
              action={
                <Button
                  icon="add"
                  text="Add First Transformation"
                  intent={Intent.PRIMARY}
                  onClick={addTransformation}
                />
              }
            />
          )}
        </div>

        {editingTransform && (
          <Card className="transformation-editor" style={{ marginTop: '20px', padding: '20px' }}>
            <div className="editor-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h4>{editingTransform.id ? 'Edit' : 'New'} Transformation</h4>
              <Button
                minimal
                icon="cross"
                onClick={() => {
                  setEditingTransform(null);
                  setNewFieldName('');
                }}
              />
            </div>

            <div className="editor-content">
              <FormGroup label="Source Field" labelInfo="(required)">
                <HTMLSelect
                  value={editingTransform.source_field}
                  onChange={(e) => setEditingTransform({
                    ...editingTransform,
                    source_field: e.target.value
                  })}
                  fill
                >
                  <option value="">Select field...</option>
                  
                  {/* Group fields by type */}
                  <optgroup label="Simple Fields">
                    {availableFields
                      .filter(f => !f.path.includes('.') && !f.path.includes('[*]'))
                      .map(field => (
                        <option key={field.path} value={field.path}>
                          {field.display} ({field.type})
                        </option>
                      ))}
                  </optgroup>
                  
                  {availableFields.some(f => f.path.includes('.') && !f.path.includes('[*]')) && (
                    <optgroup label="Nested Fields">
                      {availableFields
                        .filter(f => f.path.includes('.') && !f.path.includes('[*]'))
                        .map(field => (
                          <option key={field.path} value={field.path}>
                            {field.display} ({field.type})
                          </option>
                        ))}
                    </optgroup>
                  )}
                  
                  {availableFields.some(f => f.path.includes('[*]')) && (
                    <optgroup label="Array Item Fields">
                      {availableFields
                        .filter(f => f.path.includes('[*]'))
                        .map(field => (
                          <option key={field.path} value={field.path}>
                            {field.display} ({field.type})
                          </option>
                        ))}
                    </optgroup>
                  )}
                </HTMLSelect>
              </FormGroup>

              <FormGroup label="Target Field" labelInfo="(leave empty to transform in place)">
                <HTMLSelect
                  value={editingTransform.target_field}
                  onChange={(e) => {
                    setEditingTransform({
                      ...editingTransform,
                      target_field: e.target.value
                    });
                    if (e.target.value !== '__new__') {
                      setNewFieldName('');
                    }
                  }}
                  fill
                >
                  <option value="">Same as source</option>
                  
                  <optgroup label="Existing Fields">
                    {availableFields
                      .filter(f => !f.path.includes('[*]'))
                      .map(field => (
                        <option key={field.path} value={field.path}>
                          {field.display}
                        </option>
                      ))}
                  </optgroup>
                  
                  <option value="__new__">Create new field...</option>
                </HTMLSelect>
              </FormGroup>

              {editingTransform.target_field === '__new__' && (
                <FormGroup label="New Field Name" labelInfo="(required)">
                  <InputGroup
                    value={newFieldName}
                    onChange={(e) => setNewFieldName(e.target.value)}
                    placeholder="Enter new field name..."
                  />
                </FormGroup>
              )}

              <div style={{ marginTop: '20px' }}>
                <TransformationBuilder
                  sourceType={inferFieldType(editingTransform.source_field)}
                  targetType={inferFieldType(editingTransform.target_field || editingTransform.source_field)}
                  value={editingTransform.type}
                  options={editingTransform.config}
                  onChange={(type, options) => setEditingTransform({
                    ...editingTransform,
                    type,
                    config: options || {}
                  })}
                />
              </div>

              <div className="editor-actions" style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <Button
                  text="Cancel"
                  onClick={() => {
                    setEditingTransform(null);
                    setNewFieldName('');
                  }}
                />
                <Button
                  text="Save Transformation"
                  intent={Intent.PRIMARY}
                  onClick={() => saveTransformation(editingTransform)}
                  disabled={!editingTransform.source_field || (editingTransform.target_field === '__new__' && !newFieldName)}
                />
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

function getAllFields(config: APIEndpointConfig): FieldInfo[] {
  const fields: FieldInfo[] = [];
  const fieldPaths = new Set<string>(); // To track duplicates
  
  config.dataSources.forEach(source => {
    let dataToAnalyze: any = null;
    
    // Method 1: Extract from sample_data if available
    if (source.sample_data && source.sample_data.length > 0) {
      const firstItem = source.sample_data[0];
      
      // Handle different data structures
      if (typeof firstItem === 'object' && firstItem !== null) {
        // For API sources with data_path, the sample might be nested
        const apiConfig = source.api_config || source.config?.api_config;
        dataToAnalyze = firstItem;
        
        // If there's a data_path, try to navigate to it
        if (source.type === 'api' && apiConfig?.data_path) {
          dataToAnalyze = getNestedValue(firstItem, apiConfig.data_path);
          if (Array.isArray(dataToAnalyze) && dataToAnalyze.length > 0) {
            dataToAnalyze = dataToAnalyze[0];
          }
        }
      }
    }
    
    // Method 2: Check for sample response in API config
    else if (source.api_config?.sample_response || source.config?.api_config?.sample_response) {
      const response = source.api_config?.sample_response || source.config?.api_config?.sample_response;
      
      if (Array.isArray(response) && response.length > 0) {
        dataToAnalyze = response[0];
      } else if (typeof response === 'object' && response !== null) {
        // Handle nested data
        const apiConfig = source.api_config || source.config?.api_config;
        dataToAnalyze = apiConfig?.data_path 
          ? getNestedValue(response, apiConfig.data_path)
          : response;
        
        if (Array.isArray(dataToAnalyze) && dataToAnalyze.length > 0) {
          dataToAnalyze = dataToAnalyze[0];
        }
      }
    }
    
    // Extract fields with nested paths
    if (dataToAnalyze && typeof dataToAnalyze === 'object' && !Array.isArray(dataToAnalyze)) {
      const extractedFields = extractFieldPaths(dataToAnalyze);
      extractedFields.forEach(field => {
        if (!fieldPaths.has(field.path)) {
          fieldPaths.add(field.path);
          fields.push(field);
        }
      });
    }
    
    // Fallback to simple field lists if no sample data
    else if (source.fields && source.fields.length > 0) {
      source.fields.forEach((field: string) => {
        if (!fieldPaths.has(field)) {
          fieldPaths.add(field);
          fields.push({ path: field, display: field, type: 'string' });
        }
      });
    }
    else if (source.api_config?.extracted_fields) {
      source.api_config.extracted_fields.forEach((field: string) => {
        if (!fieldPaths.has(field)) {
          fieldPaths.add(field);
          fields.push({ path: field, display: field, type: 'string' });
        }
      });
    }
    else if (source.config?.api_config?.extracted_fields) {
      source.config.api_config.extracted_fields.forEach((field: string) => {
        if (!fieldPaths.has(field)) {
          fieldPaths.add(field);
          fields.push({ path: field, display: field, type: 'string' });
        }
      });
    }
  });
  
  return fields;
}

// Helper function to extract field paths from nested objects
function extractFieldPaths(obj: any, prefix = '', depth = 0, maxDepth = 3): FieldInfo[] {
  const fields: FieldInfo[] = [];
  
  if (depth >= maxDepth || !obj || typeof obj !== 'object') return fields;
  
  Object.keys(obj).forEach(key => {
    // Skip internal fields
    if (key.startsWith('_') || key.startsWith('$')) return;
    
    const path = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    
    if (value === null || value === undefined) {
      fields.push({ 
        path, 
        display: prefix ? `${prefix} → ${key}` : key,
        type: 'unknown'
      });
    } else if (Array.isArray(value)) {
      fields.push({ 
        path, 
        display: prefix ? `${prefix} → ${key} []` : `${key} []`,
        type: 'array'
      });
      // Extract fields from first array item if it's an object
      if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
        const arrayItemFields = extractFieldPaths(value[0], `${path}[*]`, depth + 1, maxDepth);
        arrayItemFields.forEach(f => {
          fields.push({
            path: f.path,
            display: prefix ? `${prefix} → ${key} → ${f.display.split(' → ').slice(-1)[0]}` : `${key} → ${f.display.split(' → ').slice(-1)[0]}`,
            type: f.type
          });
        });
      }
    } else if (typeof value === 'object') {
      fields.push({ 
        path, 
        display: prefix ? `${prefix} → ${key} {}` : `${key} {}`,
        type: 'object'
      });
      // Recursively extract nested fields
      const nestedFields = extractFieldPaths(value, path, depth + 1, maxDepth);
      fields.push(...nestedFields);
    } else {
      const fieldType = typeof value === 'boolean' ? 'boolean' : 
                       typeof value === 'number' ? 'number' : 'string';
      fields.push({ 
        path, 
        display: prefix ? `${prefix} → ${key}` : key,
        type: fieldType
      });
    }
  });
  
  return fields;
}

// Helper function to get nested value from object using path
function getNestedValue(obj: any, path: string): any {
  const parts = path.split('.');
  let current = obj;
  
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return null;
    }
  }
  
  return current;
}

function inferFieldType(fieldPath: string): string {
  // Simple type inference based on field name/path
  if (!fieldPath) return 'string';
  
  // Extract the last part of the path for analysis
  const fieldName = fieldPath.split('.').pop() || fieldPath;
  const lower = fieldName.toLowerCase();
  
  // Check for array notation
  if (fieldPath.includes('[*]')) {
    return 'array';
  }
  
  // Common date/time fields
  if (lower.includes('date') || lower.includes('time') || 
      lower.includes('created') || lower.includes('updated') ||
      lower.includes('timestamp')) {
    return 'date';
  }
  
  // Numeric fields
  if (lower.includes('count') || lower.includes('amount') || 
      lower.includes('price') || lower.includes('quantity') ||
      lower.includes('total') || lower.includes('sum') ||
      lower.includes('id') || lower.endsWith('_id')) {
    return 'number';
  }
  
  // Boolean fields
  if (lower.startsWith('is_') || lower.startsWith('has_') || 
      lower.includes('enabled') || lower.includes('active') ||
      lower.includes('visible') || lower.includes('completed')) {
    return 'boolean';
  }
  
  // Array fields
  if (lower.includes('items') || lower.includes('tags') || 
      lower.includes('categories') || lower.includes('list')) {
    return 'array';
  }
  
  // URL fields
  if (lower.includes('url') || lower.includes('link') || 
      lower.includes('href') || lower.includes('uri')) {
    return 'string';
  }
  
  // Default to string
  return 'string';
}

export default TransformationStep;