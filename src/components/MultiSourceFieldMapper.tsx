import React, { useState, useEffect } from 'react';
import {
  Card,
  FormGroup,
  HTMLSelect,
  Button,
  Tag,
  Icon,
  Callout,
  Intent,
  Tabs,
  Tab,
  Tree,
  TreeNode,
  Classes,
  Divider
} from '@blueprintjs/core';

interface EnhancedFieldMapping {
  outputField: string;           // The field in the output
  sourceId: string;              // Which data source
  sourceField: string;           // Which field from that source
  transform?: string;            // Optional transformation
  joinKey?: string;              // If joining data sources
  aggregation?: 'first' | 'last' | 'concat' | 'sum' | 'avg'; // How to handle multiple values
}

interface MultiSourceFieldMapperProps {
  dataSources: any[];
  outputFormat: string;
  fieldMappings: EnhancedFieldMapping[];
  relationships: any[];
  onUpdate: (mappings: EnhancedFieldMapping[]) => void;
}

const MultiSourceFieldMapper: React.FC<MultiSourceFieldMapperProps> = ({
  dataSources,
  outputFormat,
  fieldMappings,
  relationships,
  onUpdate
}) => {
  const [selectedOutput, setSelectedOutput] = useState<string>('');
  const [mappingMode, setMappingMode] = useState<'simple' | 'advanced'>('simple');
  
  // Get all available fields from all data sources
  const getAllSourceFields = () => {
    const fields: { sourceId: string; sourceName: string; field: string; fullPath: string }[] = [];
    
    dataSources.forEach(source => {
      if (source.fields && source.fields.length > 0) {
        source.fields.forEach((field: string) => {
          fields.push({
            sourceId: source.id,
            sourceName: source.name,
            field: field,
            fullPath: `${source.name}.${field}`
          });
        });
      }
    });
    
    return fields;
  };

  // Add a new field mapping
  const addFieldMapping = (outputField: string) => {
    const newMapping: EnhancedFieldMapping = {
      outputField: outputField,
      sourceId: '',
      sourceField: '',
      transform: 'direct'
    };
    
    onUpdate([...fieldMappings, newMapping]);
  };

  // Update an existing mapping
  const updateMapping = (index: number, updates: Partial<EnhancedFieldMapping>) => {
    const updated = [...fieldMappings];
    updated[index] = { ...updated[index], ...updates };
    onUpdate(updated);
  };

  // Remove a mapping
  const removeMapping = (index: number) => {
    onUpdate(fieldMappings.filter((_, i) => i !== index));
  };

  // Check if sources are related
  const areSourcesRelated = (sourceId1: string, sourceId2: string) => {
    return relationships.some(rel => 
      (rel.source_id === sourceId1 && rel.target_id === sourceId2) ||
      (rel.source_id === sourceId2 && rel.target_id === sourceId1)
    );
  };

  // Get relationship details between sources
  const getRelationship = (sourceId1: string, sourceId2: string) => {
    return relationships.find(rel => 
      (rel.source_id === sourceId1 && rel.target_id === sourceId2) ||
      (rel.source_id === sourceId2 && rel.target_id === sourceId1)
    );
  };

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3>Field Mapping Configuration</h3>
        <div>
          <Button
            text="Simple Mode"
            active={mappingMode === 'simple'}
            onClick={() => setMappingMode('simple')}
            style={{ marginRight: 10 }}
          />
          <Button
            text="Advanced Mode"
            active={mappingMode === 'advanced'}
            onClick={() => setMappingMode('advanced')}
          />
        </div>
      </div>

      {/* Data Source Summary */}
      <Callout intent={Intent.PRIMARY} icon="info-sign" style={{ marginBottom: 20 }}>
        <strong>Available Data Sources:</strong>
        <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {dataSources.map(source => (
            <Tag key={source.id} large intent={Intent.SUCCESS}>
              <Icon icon="database" style={{ marginRight: 5 }} />
              {source.name} ({source.fields?.length || 0} fields)
            </Tag>
          ))}
        </div>
        {relationships.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <strong>Relationships:</strong>
            {relationships.map((rel, idx) => {
              const source = dataSources.find(s => s.id === rel.source_id);
              const target = dataSources.find(s => s.id === rel.target_id);
              return (
                <div key={idx} style={{ marginTop: 5 }}>
                  <Tag minimal>
                    {source?.name}.{rel.source_field} → {target?.name}.{rel.target_field}
                    ({rel.type})
                  </Tag>
                </div>
              );
            })}
          </div>
        )}
      </Callout>

      {mappingMode === 'simple' ? (
        // Simple Mode: Direct field mapping
        <div>
          <h4>Output Fields</h4>
          <table className={Classes.HTML_TABLE} style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Output Field</th>
                <th>Data Source</th>
                <th>Source Field</th>
                <th>Transform</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {fieldMappings.map((mapping, index) => (
                <tr key={index}>
                  <td>
                    <input
                      className={Classes.INPUT}
                      value={mapping.outputField}
                      onChange={(e) => updateMapping(index, { outputField: e.target.value })}
                      placeholder="e.g., title, description"
                    />
                  </td>
                  <td>
                    <HTMLSelect
                      value={mapping.sourceId}
                      onChange={(e) => updateMapping(index, { 
                        sourceId: e.target.value,
                        sourceField: '' // Reset field when source changes
                      })}
                    >
                      <option value="">-- Select Source --</option>
                      {dataSources.map(source => (
                        <option key={source.id} value={source.id}>
                          {source.name}
                        </option>
                      ))}
                    </HTMLSelect>
                  </td>
                  <td>
                    <HTMLSelect
                      value={mapping.sourceField}
                      onChange={(e) => updateMapping(index, { sourceField: e.target.value })}
                      disabled={!mapping.sourceId}
                    >
                      <option value="">-- Select Field --</option>
                      {mapping.sourceId && dataSources
                        .find(s => s.id === mapping.sourceId)
                        ?.fields?.map((field: string) => (
                          <option key={field} value={field}>
                            {field}
                          </option>
                        ))
                      }
                    </HTMLSelect>
                  </td>
                  <td>
                    <HTMLSelect
                      value={mapping.transform || 'direct'}
                      onChange={(e) => updateMapping(index, { transform: e.target.value })}
                    >
                      <option value="direct">Direct</option>
                      <option value="uppercase">Uppercase</option>
                      <option value="lowercase">Lowercase</option>
                      <option value="trim">Trim</option>
                      <option value="date_format">Date Format</option>
                    </HTMLSelect>
                  </td>
                  <td>
                    <Button
                      minimal
                      icon="trash"
                      intent={Intent.DANGER}
                      onClick={() => removeMapping(index)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Button
            icon="add"
            text="Add Field Mapping"
            onClick={() => addFieldMapping('')}
            style={{ marginTop: 10 }}
          />
        </div>
      ) : (
        // Advanced Mode: With joins and aggregations
        <div>
          <h4>Advanced Field Mapping</h4>
          <Callout intent={Intent.WARNING} icon="warning-sign" style={{ marginBottom: 20 }}>
            Advanced mode allows you to configure how data from multiple sources is combined,
            including join strategies and aggregation methods.
          </Callout>
          
          {fieldMappings.map((mapping, index) => (
            <Card key={index} style={{ marginBottom: 15 }}>
              <FormGroup label="Output Field Name">
                <input
                  className={Classes.INPUT}
                  value={mapping.outputField}
                  onChange={(e) => updateMapping(index, { outputField: e.target.value })}
                  placeholder="e.g., combined_title"
                />
              </FormGroup>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <FormGroup label="Data Source">
                  <HTMLSelect
                    value={mapping.sourceId}
                    onChange={(e) => updateMapping(index, { 
                      sourceId: e.target.value,
                      sourceField: ''
                    })}
                    fill
                  >
                    <option value="">-- Select Source --</option>
                    {dataSources.map(source => (
                      <option key={source.id} value={source.id}>
                        {source.name}
                      </option>
                    ))}
                  </HTMLSelect>
                </FormGroup>
                
                <FormGroup label="Source Field">
                  <HTMLSelect
                    value={mapping.sourceField}
                    onChange={(e) => updateMapping(index, { sourceField: e.target.value })}
                    disabled={!mapping.sourceId}
                    fill
                  >
                    <option value="">-- Select Field --</option>
                    {mapping.sourceId && dataSources
                      .find(s => s.id === mapping.sourceId)
                      ?.fields?.map((field: string) => (
                        <option key={field} value={field}>
                          {field}
                        </option>
                      ))
                    }
                  </HTMLSelect>
                </FormGroup>
              </div>

              {/* Show join key if multiple sources with relationships */}
              {relationships.length > 0 && (
                <FormGroup label="Join Strategy" helperText="How to combine data when sources are related">
                  <HTMLSelect
                    value={mapping.aggregation || 'first'}
                    onChange={(e) => updateMapping(index, { aggregation: e.target.value as any })}
                    fill
                  >
                    <option value="first">Use First Match</option>
                    <option value="last">Use Last Match</option>
                    <option value="concat">Concatenate All</option>
                    <option value="sum">Sum (Numeric)</option>
                    <option value="avg">Average (Numeric)</option>
                  </HTMLSelect>
                </FormGroup>
              )}
              
              <Button
                text="Remove Mapping"
                icon="trash"
                intent={Intent.DANGER}
                onClick={() => removeMapping(index)}
                fill={false}
              />
            </Card>
          ))}
          
          <Button
            icon="add"
            text="Add Field Mapping"
            intent={Intent.PRIMARY}
            onClick={() => addFieldMapping('')}
            large
            fill
          />
        </div>
      )}

      {/* Preview Section */}
      <Divider style={{ margin: '30px 0' }} />
      
      <div>
        <h4>Mapping Preview</h4>
        <Card style={{ backgroundColor: '#f5f8fa' }}>
          <pre style={{ margin: 0, fontSize: 12 }}>
{JSON.stringify(
  fieldMappings.reduce((acc, mapping) => {
    if (mapping.outputField && mapping.sourceId && mapping.sourceField) {
      const source = dataSources.find(s => s.id === mapping.sourceId);
      acc[mapping.outputField] = `${source?.name}.${mapping.sourceField}`;
    }
    return acc;
  }, {} as any),
  null,
  2
)}
          </pre>
        </Card>
      </div>
    </Card>
  );
};

export default MultiSourceFieldMapper;