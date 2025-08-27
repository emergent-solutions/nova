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
  FormGroup
} from '@blueprintjs/core';
import { APIEndpointConfig } from '../../../types/schema.types';
import { Transformation } from '../../../types/api.types';
import TransformationBuilder from '../../TransformationBuilder/TransformationBuilder';

interface TransformationStepProps {
  config: APIEndpointConfig;
  onUpdate: (updates: Partial<APIEndpointConfig>) => void;
}

const TransformationStep: React.FC<TransformationStepProps> = ({ config, onUpdate }) => {
  const [transformations, setTransformations] = useState<Transformation[]>(
    config.transformations || []
  );
  const [selectedTransform, setSelectedTransform] = useState<string | null>(null);
  const [editingTransform, setEditingTransform] = useState<Transformation | null>(null);

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
    const updated = editingTransform?.id && transformations.find(t => t.id === editingTransform.id)
      ? transformations.map(t => t.id === editingTransform.id ? transform : t)
      : [...transformations, transform];
    
    setTransformations(updated);
    onUpdate({ transformations: updated });
    setEditingTransform(null);
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
      'date-format': 'calendar',
      'math-operation': 'calculator',
      'lookup': 'search',
      'regex-extract': 'filter',
      'string-format': 'code-block'
    };
    return iconMap[type] || 'exchange';
  };

  return (
    <div className="transformation-step">
      <Callout intent={Intent.PRIMARY} icon="info-sign">
        Apply transformations to your data before output. Transform text, dates, numbers,
        and create computed fields.
      </Callout>

      <div className="transformations-container">
        <div className="transformations-list">
          <div className="list-header">
            <h4>Transformations Pipeline</h4>
            <Button
              icon="add"
              text="Add Transformation"
              intent={Intent.PRIMARY}
              onClick={addTransformation}
            />
          </div>

          {transformations.length > 0 ? (
            <div className="pipeline-list">
              {transformations.map((transform, index) => (
                <Card
                  key={transform.id}
                  className={`transform-item ${selectedTransform === transform.id ? 'selected' : ''}`}
                  interactive
                  onClick={() => setSelectedTransform(transform.id)}
                >
                  <div className="transform-header">
                    <div className="transform-info">
                      <Icon icon={getTransformIcon(transform.type)} />
                      <div>
                        <strong>Step {index + 1}: {transform.type}</strong>
                        {transform.source_field && (
                          <div className="field-mapping">
                            <Tag minimal>{transform.source_field}</Tag>
                            <Icon icon="arrow-right" />
                            <Tag minimal intent={Intent.SUCCESS}>{transform.target_field}</Tag>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="transform-actions">
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
                    <div className="transform-config-preview">
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
          <Card className="transformation-editor">
            <div className="editor-header">
              <h4>{editingTransform.id ? 'Edit' : 'New'} Transformation</h4>
              <Button
                minimal
                icon="cross"
                onClick={() => setEditingTransform(null)}
              />
            </div>

            <div className="editor-content">
              <FormGroup label="Source Field">
                <HTMLSelect
                  value={editingTransform.source_field}
                  onChange={(e) => setEditingTransform({
                    ...editingTransform,
                    source_field: e.target.value
                  })}
                >
                  <option value="">Select field...</option>
                  {getAllFields(config).map(field => (
                    <option key={field} value={field}>{field}</option>
                  ))}
                </HTMLSelect>
              </FormGroup>

              <FormGroup label="Target Field">
                <HTMLSelect
                  value={editingTransform.target_field}
                  onChange={(e) => setEditingTransform({
                    ...editingTransform,
                    target_field: e.target.value
                  })}
                >
                  <option value="">Same as source</option>
                  {getAllFields(config).map(field => (
                    <option key={field} value={field}>{field}</option>
                  ))}
                  <option value="__new__">Create new field...</option>
                </HTMLSelect>
              </FormGroup>

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

              <div className="editor-actions">
                <Button
                  text="Cancel"
                  onClick={() => setEditingTransform(null)}
                />
                <Button
                  text="Save Transformation"
                  intent={Intent.PRIMARY}
                  onClick={() => saveTransformation(editingTransform)}
                />
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

function getAllFields(config: APIEndpointConfig): string[] {
  const fields: string[] = [];
  config.dataSources.forEach(source => {
    if (source.fields) {
      fields.push(...source.fields);
    }
  });
  return [...new Set(fields)];
}

function inferFieldType(field: string): string {
  // Simple type inference based on field name
  if (!field) return 'string';
  
  const lower = field.toLowerCase();
  if (lower.includes('date') || lower.includes('time') || lower.includes('created') || lower.includes('updated')) {
    return 'date';
  }
  if (lower.includes('count') || lower.includes('amount') || lower.includes('price') || lower.includes('quantity')) {
    return 'number';
  }
  if (lower.includes('is_') || lower.includes('has_') || lower.includes('enabled') || lower.includes('active')) {
    return 'boolean';
  }
  if (lower.includes('items') || lower.includes('tags') || lower.includes('categories')) {
    return 'array';
  }
  return 'string';
}

export default TransformationStep;