import React, { useState, useEffect } from 'react';
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
  InputGroup,
  Spinner
} from '@blueprintjs/core';
import { APIEndpointConfig } from '../../../types/schema.types';
import { Transformation } from '../../../types/api.types';
import TransformationBuilder from '../../TransformationBuilder/TransformationBuilder';

interface TransformationStepProps {
  config: APIEndpointConfig;
  onUpdate: (updates: Partial<APIEndpointConfig>) => void;
  sampleData?: Record<string, any>;  // Optional prop
}

interface FieldInfo {
  path: string;
  display: string;
  type: string;
}

const TransformationStep: React.FC<TransformationStepProps> = ({ config, onUpdate, sampleData = {} }) => {
  const [transformations, setTransformations] = useState<Transformation[]>(
    config.transformations || []
  );
  const [selectedTransform, setSelectedTransform] = useState<string | null>(null);
  const [editingTransform, setEditingTransform] = useState<Transformation | null>(null);
  const [newFieldName, setNewFieldName] = useState<string>('');
  const [availableFields, setAvailableFields] = useState<FieldInfo[]>([]);
  const [isLoadingFields, setIsLoadingFields] = useState(false);

  // Function to extract fields from data
  const extractFieldsFromData = (data: any, prefix = ''): string[] => {
    const fields: string[] = [];
    
    if (!data || typeof data !== 'object') {
      return fields;
    }
    
    // If it's an array, analyze the first element
    if (Array.isArray(data)) {
      if (data.length > 0 && typeof data[0] === 'object') {
        return extractFieldsFromData(data[0], prefix);
      }
      return fields;
    }
    
    // Extract fields from object
    Object.keys(data).forEach(key => {
      // Skip internal/system fields
      if (key.startsWith('_') || key.startsWith('$')) return;
      
      const fieldPath = prefix ? `${prefix}.${key}` : key;
      const value = data[key];
      
      // Add the field
      fields.push(fieldPath);
      
      // Recursively extract nested object fields (but not arrays)
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const nestedFields = extractFieldsFromData(value, fieldPath);
        fields.push(...nestedFields);
      }
      // For arrays, just note it's an array field but don't traverse
      else if (Array.isArray(value)) {
        // Optionally add array notation
        if (value.length > 0 && typeof value[0] === 'object') {
          const arrayItemFields = extractFieldsFromData(value[0], `${fieldPath}[*]`);
          fields.push(...arrayItemFields);
        }
      }
    });
    
    return fields;
  };

  useEffect(() => {
    const extractFields = () => {
      setIsLoadingFields(true);
      const allFields: FieldInfo[] = [];
      const fieldPaths = new Set<string>();
      
      const isRSSEndpoint = config.outputFormat === 'rss';
      const sourceMappings = config.outputSchema?.metadata?.sourceMappings || [];
      
      console.log('TransformationStep - Processing fields:', {
        isRSSEndpoint,
        sourceMappings,
        dataSources: config.dataSources.length,
        hasSampleData: Object.keys(sampleData).length > 0
      });
      
      // Process each data source
      for (const source of config.dataSources) {
        try {
          // Use passed sampleData
          if (sampleData[source.id]) {
            console.log(`Using sample data for ${source.name}`);
            
            let dataToAnalyze = sampleData[source.id];
            
            // Handle nested data paths for APIs
            if (source.type === 'api' && source.api_config?.data_path) {
              const pathParts = source.api_config.data_path.split('.');
              let current = dataToAnalyze;
              
              for (const part of pathParts) {
                if (current && typeof current === 'object') {
                  current = current[part];
                }
              }
              
              if (Array.isArray(current) && current.length > 0) {
                dataToAnalyze = current[0];
              } else if (current) {
                dataToAnalyze = current;
              }
            }
            
            // Handle RSS source mappings
            if (isRSSEndpoint) {
              const mapping = sourceMappings.find(m => m.sourceId === source.id);
              if (mapping?.itemsPath) {
                const pathParts = mapping.itemsPath.split('.');
                let current = dataToAnalyze;
                
                for (const part of pathParts) {
                  if (current && typeof current === 'object') {
                    current = current[part];
                  }
                }
                
                if (Array.isArray(current) && current.length > 0) {
                  dataToAnalyze = current[0];
                } else if (current) {
                  dataToAnalyze = current;
                }
              }
            }
            
            // Extract fields
            const extractedFields = extractFieldsFromData(dataToAnalyze);
            extractedFields.forEach(field => {
              if (!fieldPaths.has(field)) {
                fieldPaths.add(field);
                allFields.push({
                  path: field,
                  display: field.includes('.') ? field.split('.').join(' → ') : field,
                  type: inferFieldType(field)
                });
              }
            });
          }
          // Fallback to stored fields
          else if (source.fields && source.fields.length > 0) {
            console.log(`Using stored fields for ${source.name}:`, source.fields);
            source.fields.forEach((field: string) => {
              if (!fieldPaths.has(field)) {
                fieldPaths.add(field);
                allFields.push({
                  path: field,
                  display: field.includes('.') ? field.split('.').join(' → ') : field,
                  type: inferFieldType(field)
                });
              }
            });
          }
          else {
            console.log(`No sample data for ${source.name}. Test in Output Format step first.`);
          }
        } catch (error) {
          console.error(`Error processing source ${source.name}:`, error);
        }
      }
      
      // Sort fields
      allFields.sort((a, b) => {
        const aDepth = a.path.split('.').length;
        const bDepth = b.path.split('.').length;
        if (aDepth !== bDepth) return aDepth - bDepth;
        return a.path.localeCompare(b.path);
      });
      
      setAvailableFields(allFields);
      setIsLoadingFields(false);
    };
    
    // Only extract fields if we have data sources
    if (config.dataSources?.length > 0) {
      extractFields();
    } else {
      setAvailableFields([]);
      setIsLoadingFields(false);
    }
  }, [sampleData, config.dataSources, config.outputFormat, config.outputSchema]);
 
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

  if (isLoadingFields) {
    return (
      <div className="transformation-step">
        <Card style={{ padding: '40px', textAlign: 'center' }}>
          <Spinner />
          <p style={{ marginTop: '20px' }}>Loading available fields...</p>
        </Card>
      </div>
    );
  }

  // Show warning if no sample data is available
  if (!Object.keys(sampleData || {}).length && config.dataSources.length > 0 && !isLoadingFields) {
    return (
      <div className="transformation-step">
        <Callout intent={Intent.WARNING} icon="warning-sign">
          <h4>Sample Data Required</h4>
          <p>
            Please go back to the Output Format step and test your data sources to load sample data.
            This will enable field selection for transformations.
          </p>
        </Callout>
      </div>
    );
  }

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
                  availableFields={availableFields.map(f => f.path)}
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