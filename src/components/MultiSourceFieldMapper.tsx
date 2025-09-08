import React, { useState, useRef } from 'react';
import {
  Card,
  Button,
  Intent,
  Icon,
  Tag,
  Tabs,
  Tab,
  Classes,
  Divider,
  Menu,
  MenuItem,
  Popover,
  Position
} from '@blueprintjs/core';

interface MultiSourceFieldMappingProps {
  selection: MultiSourceSelection;
  outputTemplate: any;
  mappings: EnhancedFieldMapping[];
  sampleData: Record<string, any>;
  onChange: (mappings: EnhancedFieldMapping[]) => void;
  onNext: () => void;
  onPrevious: () => void;
}

export const MultiSourceFieldMapping: React.FC<MultiSourceFieldMappingProps> = ({
  selection,
  outputTemplate,
  mappings,
  sampleData,
  onChange,
  onNext,
  onPrevious
}) => {
  const [activeSourceTab, setActiveSourceTab] = useState<string>(
    selection.sources[0]?.id || ''
  );
  const [draggedField, setDraggedField] = useState<any>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const getSourceFields = (sourceId: string) => {
    const source = selection.sources.find(s => s.id === sourceId);
    if (!source || !sampleData[sourceId]) return [];
    
    const sourceData = source.primaryPath 
      ? getValueFromPath(sampleData[sourceId], source.primaryPath)
      : sampleData[sourceId];
    
    // Extract fields from source data
    return extractFieldsFromData(sourceData, sourceId, source.name);
  };

  const handleDragStart = (field: any, sourceId: string, sourceName: string) => {
    setDraggedField({ ...field, sourceId, sourceName });
  };

  const handleDragEnd = () => {
    setDraggedField(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent, targetPath: string) => {
    e.preventDefault();
    if (!draggedField) return;
    
    const newMapping: EnhancedFieldMapping = {
      id: `mapping-${Date.now()}`,
      sourceId: draggedField.sourceId,
      sourceName: draggedField.sourceName,
      sourcePath: draggedField.path,
      targetPath: targetPath,
      transformationType: 'direct',
      transformations: [],
      fallbackValue: null,
      conditional: null
    };
    
    // Replace existing mapping for this target or add new
    const existingIndex = mappings.findIndex(m => m.targetPath === targetPath);
    const updatedMappings = [...mappings];
    
    if (existingIndex >= 0) {
      updatedMappings[existingIndex] = newMapping;
    } else {
      updatedMappings.push(newMapping);
    }
    
    onChange(updatedMappings);
    setDraggedField(null);
  };

  const removeMapping = (targetPath: string) => {
    onChange(mappings.filter(m => m.targetPath !== targetPath));
  };

  const getMappingForTarget = (targetPath: string) => {
    return mappings.find(m => m.targetPath === targetPath);
  };

  return (
    <div className="multi-source-field-mapping" ref={canvasRef}>
      <div className="mapping-container" style={{ display: 'flex', gap: 20, height: '600px' }}>
        {/* Left Panel: Source Fields */}
        <Card style={{ flex: '0 0 40%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <h3>Source Fields</h3>
          <Tabs
            id="source-tabs"
            selectedTabId={activeSourceTab}
            onChange={(newTab: string) => setActiveSourceTab(newTab)}
          >
            {selection.sources.map(source => (
              <Tab
                key={source.id}
                id={source.id}
                title={
                  <span>
                    {source.name}
                    {source.category && (
                      <Tag minimal style={{ marginLeft: 5 }}>
                        {source.category}
                      </Tag>
                    )}
                  </span>
                }
                panel={
                  <div style={{ height: '480px', overflowY: 'auto' }}>
                    {getSourceFields(source.id).map(field => {
                      const isMapped = mappings.some(
                        m => m.sourceId === source.id && m.sourcePath === field.path
                      );
                      
                      return (
                        <div
                          key={field.path}
                          className={`source-field ${isMapped ? 'mapped' : ''}`}
                          draggable
                          onDragStart={() => handleDragStart(field, source.id, source.name)}
                          onDragEnd={handleDragEnd}
                          style={{
                            padding: '8px',
                            margin: '4px',
                            backgroundColor: isMapped ? '#e1f0fe' : '#f5f8fa',
                            border: '1px solid #d3d8de',
                            borderRadius: '4px',
                            cursor: 'grab',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                        >
                          <Icon icon="drag-handle-vertical" size={12} />
                          <span style={{ flex: 1 }}>{field.name}</span>
                          <Tag minimal>{field.type}</Tag>
                          {isMapped && <Icon icon="link" color="#137cbd" />}
                        </div>
                      );
                    })}
                  </div>
                }
              />
            ))}
          </Tabs>
        </Card>

        {/* Center: Connection Lines (visual indicator) */}
        <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center' }}>
          <Icon icon="arrow-right" size={20} />
        </div>

        {/* Right Panel: Target Fields */}
        <Card style={{ flex: '0 0 40%', overflow: 'hidden' }}>
          <h3>Output Fields</h3>
          <div style={{ height: '520px', overflowY: 'auto' }}>
            {outputTemplate.fields.map((field: any) => {
              const mapping = getMappingForTarget(field.path);
              
              return (
                <div
                  key={field.path}
                  className="target-field"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, field.path)}
                  style={{
                    padding: '10px',
                    margin: '4px',
                    backgroundColor: mapping ? '#d4edda' : '#f8f9fa',
                    border: `2px ${mapping ? 'solid #28a745' : 'dashed #dee2e6'}`,
                    borderRadius: '4px',
                    minHeight: '40px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <strong>{field.name}</strong>
                      <Tag minimal style={{ marginLeft: 8 }}>{field.type}</Tag>
                      {field.required && (
                        <Tag minimal intent={Intent.DANGER} style={{ marginLeft: 4 }}>
                          Required
                        </Tag>
                      )}
                    </div>
                    
                    {mapping && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Tag intent={Intent.SUCCESS}>
                          {mapping.sourceName}: {mapping.sourcePath}
                        </Tag>
                        <Popover
                          content={
                            <Menu>
                              <MenuItem
                                text="Add Transformation"
                                icon="function"
                                onClick={() => {/* Open transformation modal */}}
                              />
                              <MenuItem
                                text="Remove Mapping"
                                icon="trash"
                                intent={Intent.DANGER}
                                onClick={() => removeMapping(field.path)}
                              />
                            </Menu>
                          }
                          position={Position.BOTTOM_RIGHT}
                        >
                          <Button minimal icon="more" />
                        </Popover>
                      </div>
                    )}
                  </div>
                  
                  {!mapping && (
                    <div style={{ marginTop: 8, color: '#6c757d', fontSize: 12 }}>
                      Drag a source field here to map
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Summary Section */}
      <Card style={{ marginTop: 20, backgroundColor: '#f5f8fa' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
          <Icon icon="info-sign" />
          <strong>Mapping Summary:</strong>
          <Tag intent={Intent.SUCCESS}>
            {mappings.length} fields mapped
          </Tag>
          <Tag intent={Intent.WARNING}>
            {outputTemplate.fields.filter((f: any) => 
              f.required && !mappings.some(m => m.targetPath === f.path)
            ).length} required fields unmapped
          </Tag>
          {selection.sources.map(source => {
            const sourceMappings = mappings.filter(m => m.sourceId === source.id);
            return (
              <Tag key={source.id} minimal>
                {source.name}: {sourceMappings.length} fields
              </Tag>
            );
          })}
        </div>
      </Card>

      {/* Navigation */}
      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between' }}>
        <Button
          text="Previous"
          icon="arrow-left"
          onClick={onPrevious}
        />
        <Button
          intent={Intent.PRIMARY}
          text="Next: Preview & Test"
          rightIcon="arrow-right"
          onClick={onNext}
          disabled={mappings.length === 0}
        />
      </div>
    </div>
  );
};

// Helper functions
function getValueFromPath(obj: any, path: string): any {
  if (!path) return obj;
  
  const parts = path.split('.');
  let current = obj;
  
  for (const part of parts) {
    if (current && typeof current === 'object') {
      current = current[part];
    } else {
      return undefined;
    }
  }
  
  return current;
}

function extractFieldsFromData(data: any, sourceId: string, sourceName: string): any[] {
  const fields: any[] = [];
  
  // Add metadata fields
  fields.push(
    { path: '_source.id', name: 'Source ID', type: 'string' },
    { path: '_source.name', name: 'Source Name', type: 'string' },
    { path: '_source.timestamp', name: 'Timestamp', type: 'string' }
  );
  
  // Extract data fields
  const extractFields = (obj: any, prefix = '') => {
    if (Array.isArray(obj) && obj.length > 0) {
      extractFields(obj[0], prefix);
    } else if (obj && typeof obj === 'object') {
      for (const key in obj) {
        const fullPath = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];
        
        if (value === null || value === undefined) {
          fields.push({ path: fullPath, name: fullPath, type: 'unknown' });
        } else if (Array.isArray(value)) {
          fields.push({ path: fullPath, name: fullPath, type: 'array' });
          if (value.length > 0 && typeof value[0] === 'object') {
            extractFields(value[0], fullPath + '[0]');
          }
        } else if (typeof value === 'object') {
          fields.push({ path: fullPath, name: fullPath, type: 'object' });
          extractFields(value, fullPath);
        } else {
          fields.push({ path: fullPath, name: fullPath, type: typeof value });
        }
      }
    }
  };
  
  extractFields(data);
  return fields;
}