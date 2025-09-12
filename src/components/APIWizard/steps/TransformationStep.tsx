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
import { useFetchProxy } from '../../../hooks/useFetchProxy';

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
  const [availableFields, setAvailableFields] = useState<FieldInfo[]>([]);
  const [isLoadingFields, setIsLoadingFields] = useState(false);
  
  const { fetchViaProxy } = useFetchProxy();

  // Function to extract fields from data
  const extractFieldsFromData = (data: any, itemsPath?: string): string[] => {
    const fields: string[] = [];
    let dataToAnalyze = data;
    
    // If there's an items path (for RSS), navigate to it
    if (itemsPath && data[itemsPath]) {
      const items = data[itemsPath];
      if (Array.isArray(items) && items.length > 0) {
        dataToAnalyze = items[0];
      }
    }
    
    // Extract fields from the data
    if (dataToAnalyze && typeof dataToAnalyze === 'object' && !Array.isArray(dataToAnalyze)) {
      const extractFields = (obj: any, prefix = ''): void => {
        Object.keys(obj).forEach(key => {
          if (key.startsWith('_') || key.startsWith('$')) return;
          
          const path = prefix ? `${prefix}.${key}` : key;
          const value = obj[key];
          
          fields.push(path);
          
          // Recursively extract nested fields (but not arrays)
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            extractFields(value, path);
          }
        });
      };
      
      extractFields(dataToAnalyze);
    }
    
    return fields;
  };

  // Fetch fields when component mounts or config changes
  useEffect(() => {
    const fetchFields = async () => {
      setIsLoadingFields(true);
      const allFields: FieldInfo[] = [];
      const fieldPaths = new Set<string>();
      
      // Check if this is an RSS endpoint
      const isRSSEndpoint = config.outputFormat === 'rss';
      const sourceMappings = config.outputSchema?.metadata?.sourceMappings || [];
      
      console.log('TransformationStep - Fetching fields:', {
        isRSSEndpoint,
        sourceMappings,
        dataSources: config.dataSources.length
      });
      
      // Process each data source
      for (const source of config.dataSources) {
        try {
          // Check if we already have fields stored
          if (source.fields && source.fields.length > 0) {
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
            continue;
          }
          
          // For API sources, fetch the data
          if (source.type === 'api') {
            const apiConfig = source.api_config || source.config?.api_config;
            
            if (apiConfig?.url) {
              console.log(`Fetching data for ${source.name} from ${apiConfig.url}`);
              
              try {
                const result = await fetchViaProxy(apiConfig.url, {
                  method: apiConfig.method || 'GET',
                  headers: apiConfig.headers || {}
                });
                
                if (result.status < 400 && result.data) {
                  let extractedFields: string[] = [];
                  
                  // Determine the effective data path
                  let effectiveDataPath = apiConfig.data_path;
                  
                  // For RSS endpoints, use the itemsPath from source mappings if data_path is not set
                  if (isRSSEndpoint && !effectiveDataPath) {
                    const sourceMapping = sourceMappings.find((m: any) => m.sourceId === source.id);
                    if (sourceMapping?.itemsPath && sourceMapping.enabled) {
                      effectiveDataPath = sourceMapping.itemsPath;
                      console.log(`Using RSS itemsPath as data path: ${effectiveDataPath}`);
                    }
                  }
                  
                  // Extract fields based on the effective data path
                  if (effectiveDataPath) {
                    console.log(`Extracting fields from path: ${effectiveDataPath}`);
                    
                    // Navigate to the specified path
                    const pathParts = effectiveDataPath.split('.');
                    let current = result.data;
                    
                    for (const part of pathParts) {
                      if (current && typeof current === 'object') {
                        current = current[part];
                      }
                    }
                    
                    // If we found an array at the path, extract from first item
                    if (Array.isArray(current) && current.length > 0) {
                      console.log(`Found array at path with ${current.length} items`);
                      extractedFields = extractFieldsFromData(current[0]);
                    } else if (current) {
                      extractedFields = extractFieldsFromData(current);
                    } else {
                      console.warn(`No data found at path: ${effectiveDataPath}`);
                      extractedFields = extractFieldsFromData(result.data);
                    }
                  } else {
                    // No path specified, extract from root
                    extractedFields = extractFieldsFromData(result.data);
                  }
                  
                  console.log(`Extracted ${extractedFields.length} fields for ${source.name}`);
                  
                  // Add extracted fields to our collection
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
                  
                  // Update the source with extracted fields for future use
                  const updatedSources = config.dataSources.map(ds => 
                    ds.id === source.id 
                      ? { ...ds, fields: extractedFields }
                      : ds
                  );
                  onUpdate({ dataSources: updatedSources });
                }
              } catch (fetchError) {
                console.error(`Failed to fetch data for ${source.name}:`, fetchError);
              }
            }
          }
        } catch (error) {
          console.error(`Error processing source ${source.name}:`, error);
        }
      }
      
      // Sort fields by hierarchy
      allFields.sort((a, b) => {
        const aDepth = a.path.split('.').length;
        const bDepth = b.path.split('.').length;
        if (aDepth !== bDepth) return aDepth - bDepth;
        return a.path.localeCompare(b.path);
      });
      
      console.log(`Total fields available: ${allFields.length}`);
      setAvailableFields(allFields);
      setIsLoadingFields(false);
    };
    
    fetchFields();
  }, [config.dataSources, config.outputFormat, config.outputSchema]);

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