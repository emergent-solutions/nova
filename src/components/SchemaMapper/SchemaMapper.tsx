import React, { useState, useRef, useEffect } from 'react';
import {
  Card,
  Button,
  HTMLSelect,
  Tag,
  Tree,
  TreeNode,
  Icon,
  InputGroup,
  NonIdealState,
  Popover,
  Menu,
  MenuItem,
  Position,
  Classes
} from '@blueprintjs/core';
import { DataSource } from '../../types/datasource.types';
import { FieldMapping, SchemaNode } from '../../types/schema.types';
import FieldConfigurator from './FieldConfigurator';
import './SchemaMapper.css';

interface SchemaMapperProps {
  sources: DataSource[];
  targetSchema: SchemaNode;
  mappings: FieldMapping[];
  onChange: (mappings: FieldMapping[]) => void;
}

export const SchemaMapper: React.FC<SchemaMapperProps> = ({
  sources,
  targetSchema,
  mappings,
  onChange
}) => {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [draggedField, setDraggedField] = useState<any>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root']));
  const svgRef = useRef<SVGSVGElement>(null);
  const [connections, setConnections] = useState<any[]>([]);

  useEffect(() => {
    updateConnections();
  }, [mappings]);

  const updateConnections = () => {
    if (!svgRef.current) return;
    
    const newConnections = mappings.map(mapping => {
      const sourceEl = document.querySelector(`[data-source-field="${mapping.source_field}"]`);
      const targetEl = document.querySelector(`[data-target-field="${mapping.target_field}"]`);
      
      if (sourceEl && targetEl) {
        const sourceRect = sourceEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();
        const svgRect = svgRef.current!.getBoundingClientRect();
        
        return {
          x1: sourceRect.right - svgRect.left,
          y1: sourceRect.top + sourceRect.height / 2 - svgRect.top,
          x2: targetRect.left - svgRect.left,
          y2: targetRect.top + targetRect.height / 2 - svgRect.top,
          mapping
        };
      }
      return null;
    }).filter(Boolean);
    
    setConnections(newConnections);
  };

  const handleDragStart = (e: React.DragEvent, field: any) => {
    setDraggedField(field);
    e.dataTransfer.effectAllowed = 'link';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'link';
  };

  const handleDrop = (e: React.DragEvent, targetField: string) => {
    e.preventDefault();
    if (!draggedField) return;
    
    const newMapping: FieldMapping = {
      id: `${Date.now()}`,
      target_field: targetField,
      source_id: draggedField.sourceId,
      source_field: draggedField.field,
      transform_type: 'direct'
    };
    
    const existingIndex = mappings.findIndex(m => m.target_field === targetField);
    const updated = [...mappings];
    
    if (existingIndex >= 0) {
      updated[existingIndex] = newMapping;
    } else {
      updated.push(newMapping);
    }
    
    onChange(updated);
    setDraggedField(null);
  };

  const removeMapping = (targetField: string) => {
    onChange(mappings.filter(m => m.target_field !== targetField));
  };

  const updateMapping = (targetField: string, updates: Partial<FieldMapping>) => {
    const index = mappings.findIndex(m => m.target_field === targetField);
    if (index >= 0) {
      const updated = [...mappings];
      updated[index] = { ...updated[index], ...updates };
      onChange(updated);
    }
  };

  const generatePreview = async () => {
    // Generate preview data based on mappings
    const preview: any = {};
    
    const buildPreview = (node: SchemaNode, path: string = '') => {
      const fullPath = path ? `${path}.${node.key}` : node.key;
      const mapping = mappings.find(m => m.target_field === fullPath);
      
      if (mapping) {
        // Apply transformation
        preview[node.key] = `[${mapping.source_field} → ${mapping.transform_type || 'direct'}]`;
      } else if (node.children) {
        preview[node.key] = {};
        node.children.forEach(child => {
          buildPreview(child, fullPath);
        });
      } else {
        preview[node.key] = null;
      }
    };
    
    if (targetSchema.children) {
      targetSchema.children.forEach(child => buildPreview(child));
    }
    
    setPreviewData(preview);
  };

  const renderSourceFields = () => {
    const filteredSources = selectedSource === 'all' 
      ? sources 
      : sources.filter(s => s.id === selectedSource);
    
    return (
      <div className="source-fields-list">
        {filteredSources.map(source => (
          <div key={source.id} className="source-group">
            <div className="source-header">
              <Icon icon="database" />
              <span>{source.name}</span>
              <Tag minimal>{source.type}</Tag>
            </div>
            <div className="fields-list">
              {(source.fields || []).map(field => {
                const isMapped = mappings.some(
                  m => m.source_id === source.id && m.source_field === field
                );
                
                return (
                  <div
                    key={`${source.id}-${field}`}
                    className={`field-item ${isMapped ? 'mapped' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, { sourceId: source.id, field })}
                    data-source-field={`${source.id}-${field}`}
                  >
                    <Icon icon="drag-handle-vertical" className="drag-handle" />
                    <span className="field-name">{field}</span>
                    {isMapped && <Icon icon="link" className="mapped-icon" />}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderSchemaNode = (node: SchemaNode, path: string = '', depth: number = 0) => {
    const fullPath = path ? `${path}.${node.key}` : node.key;
    const mapping = mappings.find(m => m.target_field === fullPath);
    const isExpanded = expandedNodes.has(fullPath);
    
    return (
      <div 
        key={fullPath}
        className="schema-node"
        style={{ paddingLeft: `${depth * 20}px` }}
      >
        <div
          className={`node-content ${mapping ? 'mapped' : ''} ${selectedTarget === fullPath ? 'selected' : ''}`}
          onClick={() => setSelectedTarget(fullPath)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, fullPath)}
          data-target-field={fullPath}
        >
          {node.children && (
            <Button
              minimal
              small
              icon={isExpanded ? 'chevron-down' : 'chevron-right'}
              onClick={(e) => {
                e.stopPropagation();
                const updated = new Set(expandedNodes);
                if (isExpanded) {
                  updated.delete(fullPath);
                } else {
                  updated.add(fullPath);
                }
                setExpandedNodes(updated);
              }}
            />
          )}
          
          <Icon icon={node.type === 'object' ? 'folder-close' : 'document'} />
          <span className="node-name">{node.key}</span>
          <Tag minimal>{node.type}</Tag>
          
          {mapping && (
            <div className="mapping-info">
              <Tag intent={Intent.SUCCESS} minimal>
                {mapping.source_field}
              </Tag>
              {mapping.transform_type !== 'direct' && (
                <Tag minimal>{mapping.transform_type}</Tag>
              )}
              <Button
                minimal
                small
                icon="cross"
                onClick={(e) => {
                  e.stopPropagation();
                  removeMapping(fullPath);
                }}
              />
            </div>
          )}
        </div>
        
        {node.children && isExpanded && (
          <div className="node-children">
            {node.children.map(child => 
              renderSchemaNode(child, fullPath, depth + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="schema-mapper">
      <div className="mapper-header">
        <h3>Field Mapping</h3>
        <Button icon="refresh" text="Generate Preview" onClick={generatePreview} />
      </div>
      
      <div className="mapper-layout">
        {/* Source Fields Panel */}
        <Card className="source-panel">
          <div className="panel-header">
            <h4>Source Fields</h4>
            <HTMLSelect
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
            >
              <option value="all">All Sources</option>
              {sources.map(source => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </HTMLSelect>
          </div>
          {renderSourceFields()}
        </Card>

        {/* Connection Lines */}
        <svg 
          ref={svgRef}
          className="connection-svg"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 1
          }}
        >
          {connections.map((conn, index) => (
            <g key={index}>
              <path
                d={`M ${conn.x1} ${conn.y1} C ${conn.x1 + 50} ${conn.y1}, ${conn.x2 - 50} ${conn.y2}, ${conn.x2} ${conn.y2}`}
                stroke="#48aff0"
                strokeWidth="2"
                fill="none"
                opacity="0.6"
              />
              <circle cx={conn.x1} cy={conn.y1} r="4" fill="#48aff0" />
              <circle cx={conn.x2} cy={conn.y2} r="4" fill="#48aff0" />
            </g>
          ))}
        </svg>

        {/* Target Schema Panel */}
        <Card className="target-panel">
          <div className="panel-header">
            <h4>Output Schema</h4>
            <Button minimal icon="expand-all" onClick={() => {
              const allPaths = new Set<string>();
              const collectPaths = (node: SchemaNode, path: string = '') => {
                const fullPath = path ? `${path}.${node.key}` : node.key;
                allPaths.add(fullPath);
                if (node.children) {
                  node.children.forEach(child => collectPaths(child, fullPath));
                }
              };
              collectPaths(targetSchema);
              setExpandedNodes(allPaths);
            }} />
          </div>
          <div className="schema-tree">
            {targetSchema.children?.map(child => renderSchemaNode(child)) || 
              <NonIdealState
                icon="tree"
                title="No schema defined"
                description="Define your output schema first"
              />
            }
          </div>
        </Card>
      </div>

      {/* Field Configuration Panel */}
      {selectedTarget && (
        <Card className="field-config-panel">
          <FieldConfigurator
            field={selectedTarget}
            mapping={mappings.find(m => m.target_field === selectedTarget)}
            sources={sources}
            onUpdate={(updates) => updateMapping(selectedTarget, updates)}
            onClose={() => setSelectedTarget(null)}
          />
        </Card>
      )}

      {/* Preview Panel */}
      {previewData && (
        <Card className="preview-panel">
          <div className="panel-header">
            <h4>Output Preview</h4>
            <Button minimal icon="cross" onClick={() => setPreviewData(null)} />
          </div>
          <pre className="preview-json">
            {JSON.stringify(previewData, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  );
};
