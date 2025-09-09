// src/components/APIWizard/components/FieldMappingInterface.tsx
import React, { useState } from 'react';
import {
  Card,
  HTMLSelect,
  FormGroup,
  Tag,
  Icon,
  Button,
  Collapse
} from '@blueprintjs/core';

interface FieldMappingInterfaceProps {
  schema: any;
  dataSources: any[];
  mappings: any[];
  onUpdate: (mappings: any[]) => void;
}

export const FieldMappingInterface: React.FC<FieldMappingInterfaceProps> = ({
  schema,
  dataSources,
  mappings,
  onUpdate
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root']));

  const toggleNode = (path: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedNodes(newExpanded);
  };

  const updateMapping = (targetPath: string, sourceId: string, sourceField: string) => {
    const existingIndex = mappings.findIndex(m => m.target_field === targetPath);
    const newMapping = {
      target_field: targetPath,
      source_id: sourceId,
      source_field: sourceField
    };

    let newMappings;
    if (existingIndex >= 0) {
      newMappings = [...mappings];
      if (!sourceId || !sourceField) {
        // Remove mapping
        newMappings.splice(existingIndex, 1);
      } else {
        // Update mapping
        newMappings[existingIndex] = newMapping;
      }
    } else if (sourceId && sourceField) {
      // Add new mapping
      newMappings = [...mappings, newMapping];
    } else {
      return;
    }

    onUpdate(newMappings);
  };

  const getSourceFields = (sourceId: string): string[] => {
    const source = dataSources.find(ds => ds.id === sourceId);
    if (!source) return [];
    
    // Get fields from source
    if (source.fields) return source.fields;
    if (source.sample_data && Array.isArray(source.sample_data) && source.sample_data.length > 0) {
      return Object.keys(source.sample_data[0]);
    }
    
    return [];
  };

  const renderSchemaNode = (node: any, path: string = '', depth: number = 0) => {
    const fullPath = path ? `${path}.${node.key}` : node.key;
    const mapping = mappings.find(m => m.target_field === fullPath);
    const isExpanded = expandedNodes.has(fullPath);
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={fullPath} style={{ marginLeft: depth * 20 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px',
          backgroundColor: mapping ? '#e7f5e7' : '#f8f9fa',
          borderRadius: 4,
          marginBottom: 4
        }}>
          {hasChildren && (
            <Button
              minimal
              small
              icon={isExpanded ? "chevron-down" : "chevron-right"}
              onClick={() => toggleNode(fullPath)}
              style={{ marginRight: 8 }}
            />
          )}
          
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
            <strong>{node.key}</strong>
            <Tag minimal>{node.type}</Tag>
            {node.required && <Tag minimal intent="danger">required</Tag>}
          </div>

          {node.type !== 'object' && node.type !== 'array' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <HTMLSelect
                value={mapping?.source_id || ''}
                onChange={(e) => {
                  const sourceId = e.target.value;
                  if (sourceId) {
                    const fields = getSourceFields(sourceId);
                    if (fields.length > 0) {
                      updateMapping(fullPath, sourceId, fields[0]);
                    }
                  } else {
                    updateMapping(fullPath, '', '');
                  }
                }}
                style={{ minWidth: 150 }}
              >
                <option value="">Select source...</option>
                {dataSources.map(ds => (
                  <option key={ds.id} value={ds.id}>{ds.name}</option>
                ))}
              </HTMLSelect>

              {mapping?.source_id && (
                <HTMLSelect
                  value={mapping.source_field || ''}
                  onChange={(e) => updateMapping(fullPath, mapping.source_id, e.target.value)}
                  style={{ minWidth: 150 }}
                >
                  <option value="">Select field...</option>
                  {getSourceFields(mapping.source_id).map(field => (
                    <option key={field} value={field}>{field}</option>
                  ))}
                </HTMLSelect>
              )}

              {mapping && (
                <Button
                  minimal
                  small
                  icon="cross"
                  intent="danger"
                  onClick={() => updateMapping(fullPath, '', '')}
                />
              )}
            </div>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div>
            {node.children.map((child: any) => renderSchemaNode(child, fullPath, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card style={{ padding: 15, maxHeight: 500, overflowY: 'auto' }}>
      {renderSchemaNode(schema)}
      
      <div style={{ marginTop: 20, padding: 10, backgroundColor: '#f0f0f0', borderRadius: 4 }}>
        <strong>Mapped Fields:</strong> {mappings.length}
        {mappings.length === 0 && (
          <p style={{ margin: '10px 0 0', color: '#666' }}>
            No fields mapped yet. Select data sources and fields above to create mappings.
          </p>
        )}
      </div>
    </Card>
  );
};