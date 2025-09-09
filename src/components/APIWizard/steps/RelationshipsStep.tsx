import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  FormGroup,
  HTMLSelect,
  RadioGroup,
  Radio,
  InputGroup,
  Icon,
  Callout,
  Intent,
  NonIdealState,
  Switch,
  Tag,
  Tabs,
  Tab,
  Divider
} from '@blueprintjs/core';

// Define types inline for the component
interface DataRelationship {
  id: string;
  parent_source: string;
  parent_key: string;
  child_source: string;
  foreign_key: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  embed_as: string;
  include_orphans?: boolean;
}

interface DataConcatenation {
  id: string;
  sources: string[];
  merge_strategy: 'concatenate' | 'union' | 'interleave';
  deduplicate?: boolean;
  deduplicate_field?: string;
}

interface APIEndpointConfig {
  relationships?: DataRelationship[];
  concatenations?: DataConcatenation[];
  dataSources: any[];
  [key: string]: any;
}

interface RelationshipsStepProps {
  config: APIEndpointConfig;
  onUpdate: (updates: Partial<APIEndpointConfig>) => void;
}

const RelationshipsStep: React.FC<RelationshipsStepProps> = ({ config, onUpdate }) => {
  const [relationships, setRelationships] = useState<DataRelationship[]>(
    config.relationships || []
  );
  const [concatenations, setConcatenations] = useState<DataConcatenation[]>(
    config.concatenations || []
  );
  const [activeTab, setActiveTab] = useState<'relationships' | 'concatenate'>('relationships');

  // Helper function to get fields from a data source
  const getSourceFields = (sourceId: string): string[] => {
    const source = config.dataSources.find(s => s.id === sourceId);
    if (!source) return [];
    
    // Try multiple ways to get fields
    if (source.fields && source.fields.length > 0) {
      return source.fields;
    }
    
    // Check if fields were extracted during configuration
    if (source.api_config?.extracted_fields) {
      return source.api_config.extracted_fields;
    }
    
    // Try to extract from sample data if available
    if (source.sample_data && source.sample_data.length > 0) {
      const sample = source.sample_data[0];
      if (typeof sample === 'object' && sample !== null) {
        return Object.keys(sample);
      }
    }
    
    // Check for sample response in API config
    if (source.api_config?.sample_response) {
      const response = source.api_config.sample_response;
      if (Array.isArray(response) && response.length > 0) {
        return Object.keys(response[0]);
      } else if (typeof response === 'object' && response !== null) {
        // Handle nested data
        const data = source.api_config.data_path 
          ? getNestedValue(response, source.api_config.data_path)
          : response;
        
        if (Array.isArray(data) && data.length > 0) {
          return Object.keys(data[0]);
        }
      }
    }
    
    return [];
  };

  // Helper to get nested value from object using path
  const getNestedValue = (obj: any, path: string): any => {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return null;
      current = current[part];
    }
    return current;
  };

  // Check if sources have compatible schemas for concatenation
  const areSourcesCompatible = (sourceIds: string[]): boolean => {
    if (sourceIds.length < 2) return false;
    
    const fieldSets = sourceIds.map(id => {
      const fields = getSourceFields(id);
      return new Set(fields);
    });
    
    // Check if there's at least some overlap in fields
    const firstSet = fieldSets[0];
    for (let i = 1; i < fieldSets.length; i++) {
      const intersection = new Set([...firstSet].filter(x => fieldSets[i].has(x)));
      if (intersection.size === 0) return false;
    }
    
    return true;
  };

  // Add a new relationship
  const addRelationship = () => {
    const newRelationship: DataRelationship = {
      id: `rel_${Date.now()}`,
      parent_source: '',
      parent_key: '',
      child_source: '',
      foreign_key: '',
      type: 'one-to-many',
      embed_as: 'items',
      include_orphans: false
    };
    const updated = [...relationships, newRelationship];
    setRelationships(updated);
    onUpdate({ relationships: updated });
  };

  // Add a new concatenation
  const addConcatenation = () => {
    const newConcatenation: DataConcatenation = {
      id: `concat_${Date.now()}`,
      sources: [],
      merge_strategy: 'concatenate',
      deduplicate: false
    };
    const updated = [...concatenations, newConcatenation];
    setConcatenations(updated);
    onUpdate({ concatenations: updated });
  };

  const updateRelationship = (index: number, updates: Partial<DataRelationship>) => {
    const updated = [...relationships];
    updated[index] = { ...updated[index], ...updates };
    setRelationships(updated);
    onUpdate({ relationships: updated });
  };

  const updateConcatenation = (index: number, updates: Partial<DataConcatenation>) => {
    const updated = [...concatenations];
    updated[index] = { ...updated[index], ...updates };
    setConcatenations(updated);
    onUpdate({ concatenations: updated });
  };

  const removeRelationship = (index: number) => {
    const updated = relationships.filter((_, i) => i !== index);
    setRelationships(updated);
    onUpdate({ relationships: updated });
  };

  const removeConcatenation = (index: number) => {
    const updated = concatenations.filter((_, i) => i !== index);
    setConcatenations(updated);
    onUpdate({ concatenations: updated });
  };

  const toggleSourceInConcatenation = (concatIndex: number, sourceId: string) => {
    const concat = concatenations[concatIndex];
    const sources = concat.sources.includes(sourceId)
      ? concat.sources.filter(id => id !== sourceId)
      : [...concat.sources, sourceId];
    
    updateConcatenation(concatIndex, { sources });
  };

  if (config.dataSources.length === 0) {
    return (
      <NonIdealState
        icon="database"
        title="No Data Sources"
        description="Add at least one data source to continue"
      />
    );
  }

  return (
    <div className="relationships-step">
      <Tabs
        id="relationship-tabs"
        selectedTabId={activeTab}
        onChange={(newTab) => setActiveTab(newTab as 'relationships' | 'concatenate')}
        large={false}
      >
        <Tab id="relationships" title="Relationships" />
      </Tabs>

      {activeTab === 'relationships' ? (
        <div style={{ marginTop: '20px' }}>
          <Callout intent={Intent.PRIMARY} icon="info-sign">
            Define relationships between your data sources to create nested structures and join data.
            Leave this empty if you just want to combine sources without relationships.
          </Callout>

          {config.dataSources.length < 2 ? (
            <NonIdealState
              icon="flow-branch"
              title="Multiple Sources Required"
              description="Add at least 2 data sources to define relationships between them"
              style={{ marginTop: '20px' }}
            />
          ) : (
            <div className="relationships-list">
              {relationships.map((rel, index) => {
                const parentFields = getSourceFields(rel.parent_source);
                const childFields = getSourceFields(rel.child_source);
                
                return (
                  <Card key={rel.id} className="relationship-card">
                    <div className="relationship-header">
                      <h4>Relationship {index + 1}</h4>
                      <Button
                        minimal
                        icon="trash"
                        intent={Intent.DANGER}
                        onClick={() => removeRelationship(index)}
                      />
                    </div>

                    <div className="relationship-config">
                      <div className="relationship-sources">
                        <div className="source-config">
                          <FormGroup label="Parent Source">
                            <HTMLSelect
                              value={rel.parent_source}
                              onChange={(e) => updateRelationship(index, { 
                                parent_source: e.target.value,
                                parent_key: '' // Reset key when source changes
                              })}
                            >
                              <option value="">Select source...</option>
                              {config.dataSources.map(source => (
                                <option key={source.id} value={source.id}>
                                  {source.name}
                                </option>
                              ))}
                            </HTMLSelect>
                          </FormGroup>

                          <FormGroup label="Parent Key Field">
                            <HTMLSelect
                              value={rel.parent_key}
                              onChange={(e) => updateRelationship(index, { parent_key: e.target.value })}
                              disabled={!rel.parent_source || parentFields.length === 0}
                            >
                              <option value="">
                                {parentFields.length === 0 ? 'No fields available' : 'Select field...'}
                              </option>
                              {parentFields.map(field => (
                                <option key={field} value={field}>{field}</option>
                              ))}
                            </HTMLSelect>
                            {rel.parent_source && parentFields.length === 0 && (
                              <Callout intent="warning" style={{ marginTop: '5px' }}>
                                No fields detected. Try testing the data source first.
                              </Callout>
                            )}
                          </FormGroup>
                        </div>

                        <Icon icon="link" className="relationship-link-icon" size={20} />

                        <div className="source-config">
                          <FormGroup label="Child Source">
                            <HTMLSelect
                              value={rel.child_source}
                              onChange={(e) => updateRelationship(index, { 
                                child_source: e.target.value,
                                foreign_key: '' // Reset key when source changes
                              })}
                            >
                              <option value="">Select source...</option>
                              {config.dataSources
                                .filter(s => s.id !== rel.parent_source) // Can't relate to itself
                                .map(source => (
                                  <option key={source.id} value={source.id}>
                                    {source.name}
                                  </option>
                                ))}
                            </HTMLSelect>
                          </FormGroup>

                          <FormGroup label="Foreign Key Field">
                            <HTMLSelect
                              value={rel.foreign_key}
                              onChange={(e) => updateRelationship(index, { foreign_key: e.target.value })}
                              disabled={!rel.child_source || childFields.length === 0}
                            >
                              <option value="">
                                {childFields.length === 0 ? 'No fields available' : 'Select field...'}
                              </option>
                              {childFields.map(field => (
                                <option key={field} value={field}>{field}</option>
                              ))}
                            </HTMLSelect>
                            {rel.child_source && childFields.length === 0 && (
                              <Callout intent="warning" style={{ marginTop: '5px' }}>
                                No fields detected. Try testing the data source first.
                              </Callout>
                            )}
                          </FormGroup>
                        </div>
                      </div>

                      <div className="relationship-options">
                        <FormGroup label="Relationship Type">
                          <RadioGroup
                            selectedValue={rel.type}
                            onChange={(e) => updateRelationship(index, { type: e.currentTarget.value as any })}
                          >
                            <Radio label="One to One" value="one-to-one" />
                            <Radio label="One to Many" value="one-to-many" />
                            <Radio label="Many to Many" value="many-to-many" />
                          </RadioGroup>
                        </FormGroup>

                        <FormGroup label="Embed Field Name">
                          <InputGroup
                            value={rel.embed_as}
                            onChange={(e) => updateRelationship(index, { embed_as: e.target.value })}
                            placeholder="e.g., items, details, children"
                          />
                        </FormGroup>

                        <Switch
                          label="Include orphaned records"
                          checked={rel.include_orphans || false}
                          onChange={(e) => updateRelationship(index, { 
                            include_orphans: e.target.checked 
                          })}
                        />
                      </div>
                    </div>
                  </Card>
                );
              })}

              <Button
                icon="add"
                text="Add Relationship"
                intent={Intent.PRIMARY}
                outlined
                onClick={addRelationship}
                style={{ marginTop: '16px' }}
              />
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginTop: '20px' }}>
          <Callout intent={Intent.PRIMARY} icon="info-sign">
            Combine multiple data sources with the same or similar schema into a single endpoint.
            This is useful for aggregating data from multiple APIs or sources.
          </Callout>

          <div className="concatenations-list" style={{ marginTop: '20px' }}>
            {concatenations.map((concat, index) => (
              <Card key={concat.id} className="concatenation-card">
                <div className="concatenation-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h4>Data Combination {index + 1}</h4>
                  <Button
                    minimal
                    icon="trash"
                    intent={Intent.DANGER}
                    onClick={() => removeConcatenation(index)}
                  />
                </div>

                <FormGroup label="Select Sources to Combine">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {config.dataSources.map(source => {
                      const isSelected = concat.sources.includes(source.id);
                      const fields = getSourceFields(source.id);
                      
                      return (
                        <Tag
                          key={source.id}
                          large
                          interactive
                          intent={isSelected ? Intent.PRIMARY : Intent.NONE}
                          onClick={() => toggleSourceInConcatenation(index, source.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          {isSelected && <Icon icon="tick" style={{ marginRight: '4px' }} />}
                          {source.name}
                          <Tag minimal style={{ marginLeft: '4px' }}>
                            {fields.length} fields
                          </Tag>
                        </Tag>
                      );
                    })}
                  </div>
                  {concat.sources.length > 1 && !areSourcesCompatible(concat.sources) && (
                    <Callout intent="warning" style={{ marginTop: '10px' }}>
                      Warning: Selected sources have different schemas. Ensure they have compatible fields.
                    </Callout>
                  )}
                </FormGroup>

                <FormGroup label="Merge Strategy">
                  <RadioGroup
                    selectedValue={concat.merge_strategy}
                    onChange={(e) => updateConcatenation(index, { merge_strategy: e.currentTarget.value as any })}
                  >
                    <Radio 
                      label="Concatenate - Append all records sequentially" 
                      value="concatenate" 
                    />
                    <Radio 
                      label="Union - Merge and remove duplicates" 
                      value="union" 
                    />
                    <Radio 
                      label="Interleave - Alternate records from each source" 
                      value="interleave" 
                    />
                  </RadioGroup>
                </FormGroup>

                {concat.merge_strategy === 'union' && (
                  <>
                    <Switch
                      label="Remove duplicate records"
                      checked={concat.deduplicate || false}
                      onChange={(e) => updateConcatenation(index, { 
                        deduplicate: e.target.checked 
                      })}
                    />
                    
                    {concat.deduplicate && (
                      <FormGroup label="Deduplicate by Field">
                        <HTMLSelect
                          value={concat.deduplicate_field || ''}
                          onChange={(e) => updateConcatenation(index, { deduplicate_field: e.target.value })}
                        >
                          <option value="">Select field for deduplication...</option>
                          {concat.sources.length > 0 && getSourceFields(concat.sources[0]).map(field => (
                            <option key={field} value={field}>{field}</option>
                          ))}
                        </HTMLSelect>
                      </FormGroup>
                    )}
                  </>
                )}
              </Card>
            ))}

            <Button
              icon="add"
              text="Add Data Combination"
              intent={Intent.PRIMARY}
              outlined
              onClick={addConcatenation}
              style={{ marginTop: '16px' }}
            />
          </div>

          {concatenations.length === 0 && relationships.length === 0 && (
            <Callout intent="warning" icon="warning-sign" style={{ marginTop: '20px' }}>
              <strong>No combinations defined</strong>
              <p>Your data sources will be output as separate arrays in the API response.</p>
            </Callout>
          )}
        </div>
      )}
    </div>
  );
};

export default RelationshipsStep;