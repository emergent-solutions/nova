import React, { useState } from 'react';
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
  Switch
} from '@blueprintjs/core';
import { DataRelationship } from '../../../types/api.types';
import { APIEndpointConfig } from '../../../types/schema.types';

interface RelationshipsStepProps {
  config: APIEndpointConfig;
  onUpdate: (updates: Partial<APIEndpointConfig>) => void;
}

const RelationshipsStep: React.FC<RelationshipsStepProps> = ({ config, onUpdate }) => {
  const [relationships, setRelationships] = useState<DataRelationship[]>(
    config.relationships || []
  );

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

  const updateRelationship = (index: number, updates: Partial<DataRelationship>) => {
    const updated = [...relationships];
    updated[index] = { ...updated[index], ...updates };
    setRelationships(updated);
    onUpdate({ relationships: updated });
  };

  const removeRelationship = (index: number) => {
    const updated = relationships.filter((_, i) => i !== index);
    setRelationships(updated);
    onUpdate({ relationships: updated });
  };

  const getSourceFields = (sourceId: string) => {
    const source = config.dataSources.find(s => s.id === sourceId);
    return source?.fields || [];
  };

  if (config.dataSources.length < 2) {
    return (
      <NonIdealState
        icon="flow-branch"
        title="Multiple Sources Required"
        description="Add at least 2 data sources to define relationships between them"
      />
    );
  }

  return (
    <div className="relationships-step">
      <Callout intent={Intent.PRIMARY} icon="info-sign">
        Define how your data sources relate to each other. This allows you to create nested structures
        and join data from multiple sources.
      </Callout>

      <div className="relationships-list">
        {relationships.map((rel, index) => (
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
                      disabled={!rel.parent_source}
                    >
                      <option value="">Select field...</option>
                      {getSourceFields(rel.parent_source).map(field => (
                        <option key={field} value={field}>{field}</option>
                      ))}
                    </HTMLSelect>
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
                      disabled={!rel.child_source}
                    >
                      <option value="">Select field...</option>
                      {getSourceFields(rel.child_source).map(field => (
                        <option key={field} value={field}>{field}</option>
                      ))}
                    </HTMLSelect>
                  </FormGroup>
                </div>
              </div>

              <div className="relationship-options">
                <FormGroup label="Relationship Type">
                  <RadioGroup
                    selectedValue={rel.type}
                    onChange={(e) => updateRelationship(index, { type: e.target.value as any })}
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
        ))}

        <Button
          icon="add"
          text="Add Relationship"
          intent={Intent.PRIMARY}
          outlined
          onClick={addRelationship}
        />
      </div>
    </div>
  );
};

export default RelationshipsStep;