// ============= FIXED FIELD MAPPING CANVAS - SHOWS ALL SOURCES =============
// components/JsonFieldMapper/components/FieldMappingCanvas.tsx

import React, { useState, useRef } from 'react';
import {
  Card,
  Button,
  Intent,
  Icon,
  Tag,
  NonIdealState,
  Callout,
  Divider,
  Classes,
  Collapse
} from '@blueprintjs/core';
import { JsonFieldMapping } from '../../../types/jsonMapping.types';
import { extractFieldPaths } from '../utils/pathHelpers';

interface FieldMappingCanvasProps {
  sourceSelection: any;
  outputTemplate: any;
  mappings: JsonFieldMapping[];
  transformations: any[];
  sampleData: Record<string, any>;
  onChange: (mappings: JsonFieldMapping[]) => void;
  onNext: () => void;
  onPrevious: () => void;
}

interface SourceField {
  path: string;
  name: string;
  type: string;
  value?: any;
  isMetadata?: boolean;
  category?: string;
  sourceId: string;
  sourceName: string;
}

export const FieldMappingCanvas: React.FC<FieldMappingCanvasProps> = ({
  sourceSelection,
  outputTemplate,
  mappings,
  transformations,
  sampleData,
  onChange,
  onNext,
  onPrevious
}) => {
  const [draggedField, setDraggedField] = useState<any>(null);
  const [selectedMapping, setSelectedMapping] = useState<string | null>(null);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(() => 
    new Set(sourceSelection.sources.map((s: any) => s.id))
  );
  const canvasRef = useRef<HTMLDivElement>(null);

  // ============= SAFETY CHECKS =============
  if (!sourceSelection || !sourceSelection.sources || sourceSelection.sources.length === 0) {
    return (
      <div className="field-mapping-canvas" ref={canvasRef}>
        <NonIdealState
          icon="warning-sign"
          title="No Sources Selected"
          description="Please go back and select data sources first."
          action={
            <Button
              text="Go Back"
              icon="arrow-left"
              intent={Intent.PRIMARY}
              onClick={onPrevious}
            />
          }
        />
      </div>
    );
  }

  if (!outputTemplate || !outputTemplate.fields || outputTemplate.fields.length === 0) {
    return (
      <div className="field-mapping-canvas" ref={canvasRef}>
        <NonIdealState
          icon="build"
          title="No Output Fields Defined"
          description="Please go back and define your output structure first."
          action={
            <Button
              text="Go Back"
              icon="arrow-left"
              intent={Intent.PRIMARY}
              onClick={onPrevious}
            />
          }
        />
      </div>
    );
  }

  // ============= BUILD SOURCE FIELDS FROM ALL SOURCES =============
  const getAllSourceFields = (): Record<string, SourceField[]> => {
    const fieldsBySource: Record<string, SourceField[]> = {};
    
    sourceSelection.sources.forEach((source: any) => {
      const fields: SourceField[] = [];
      
      // Add metadata fields for this source
      fields.push(
        {
          path: '_source.id',
          name: 'Source ID',
          type: 'string',
          value: source.id,
          isMetadata: true,
          category: 'metadata',
          sourceId: source.id,
          sourceName: source.name
        },
        {
          path: '_source.name',
          name: 'Source Name',
          type: 'string',
          value: source.name,
          isMetadata: true,
          category: 'metadata',
          sourceId: source.id,
          sourceName: source.name
        },
        {
          path: '_source.category',
          name: 'Source Category',
          type: 'string',
          value: source.category || 'uncategorized',
          isMetadata: true,
          category: 'metadata',
          sourceId: source.id,
          sourceName: source.name
        }
      );
      
      // Extract data fields from sample data
      if (sampleData[source.id]) {
        let dataToAnalyze = sampleData[source.id];
        
        // Navigate to the primary path if specified
        if (source.primaryPath) {
          const parts = source.primaryPath.split('.');
          for (const part of parts) {
            if (dataToAnalyze && typeof dataToAnalyze === 'object') {
              dataToAnalyze = dataToAnalyze[part];
            }
          }
        }
        
        // Extract fields from the data
        const extracted = extractFieldPaths(dataToAnalyze, '');
        extracted.forEach(field => {
          fields.push({
            ...field,
            category: 'data',
            isMetadata: false,
            sourceId: source.id,
            sourceName: source.name
          });
        });
      }
      
      fieldsBySource[source.id] = fields;
    });
    
    return fieldsBySource;
  };

  const fieldsBySource = getAllSourceFields();

  // ============= DRAG AND DROP HANDLERS =============
  const handleDragStart = (field: SourceField) => {
    setDraggedField(field);
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
    
    // Check if this target already has a mapping from this source
    const existingMappingIndex = mappings.findIndex(
      m => m.targetPath === targetPath && m.sourceId === draggedField.sourceId
    );
    
    const newMapping: JsonFieldMapping = {
      id: `mapping-${Date.now()}-${Math.random()}`,
      sourceId: draggedField.sourceId,
      sourceName: draggedField.sourceName,
      sourcePath: draggedField.path,
      targetPath: targetPath,
      transformationType: 'direct',
      transformations: [],
      fallbackValue: null,
      conditional: null
    };
    
    let updatedMappings = [...mappings];
    
    if (existingMappingIndex >= 0) {
      // Replace existing mapping from this source for this target
      updatedMappings[existingMappingIndex] = newMapping;
    } else {
      // Add new mapping
      updatedMappings.push(newMapping);
    }
    
    onChange(updatedMappings);
    setDraggedField(null);
  };

  const removeMapping = (mappingId: string) => {
    onChange(mappings.filter(m => m.id !== mappingId));
  };

  const toggleSourceExpanded = (sourceId: string) => {
    const newExpanded = new Set(expandedSources);
    if (newExpanded.has(sourceId)) {
      newExpanded.delete(sourceId);
    } else {
      newExpanded.add(sourceId);
    }
    setExpandedSources(newExpanded);
  };

  // Get all mappings for a target field
  const getMappingsForTarget = (targetPath: string) => {
    return mappings.filter(m => m.targetPath === targetPath);
  };

  return (
    <div className="field-mapping-canvas" ref={canvasRef}>
      <Callout intent={Intent.PRIMARY} icon="info-sign" style={{ marginBottom: 20 }}>
        Drag fields from any source to the output fields. Multiple sources can map to the same output field - 
        the appropriate source field will be used based on which source each item comes from.
      </Callout>

      <div className="mapping-container" style={{ display: 'flex', gap: 20, minHeight: 600 }}>
        {/* Left Panel: All Source Fields */}
        <Card style={{ flex: '0 0 45%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <h3>Source Fields (All Sources)</h3>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {sourceSelection.sources.map((source: any) => {
              const isExpanded = expandedSources.has(source.id);
              const sourceFields = fieldsBySource[source.id] || [];
              
              return (
                <div key={source.id} style={{ marginBottom: 15 }}>
                  <div 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 10,
                      padding: '8px',
                      backgroundColor: '#f5f8fa',
                      cursor: 'pointer'
                    }}
                    onClick={() => toggleSourceExpanded(source.id)}
                  >
                    <Icon icon={isExpanded ? 'chevron-down' : 'chevron-right'} />
                    <Icon icon={
                      source.type === 'api' ? 'cloud' :
                      source.type === 'database' ? 'database' :
                      source.type === 'file' ? 'document' :
                      'data-connection'
                    } />
                    <strong>{source.name}</strong>
                    <Tag minimal>{source.type}</Tag>
                    {source.category && (
                      <Tag minimal icon="tag">{source.category}</Tag>
                    )}
                    <Tag minimal intent={Intent.PRIMARY}>
                      {sourceFields.length} fields
                    </Tag>
                  </div>
                  
                  <Collapse isOpen={isExpanded}>
                    <div style={{ paddingLeft: 20, paddingTop: 10 }}>
                      {/* Metadata Fields */}
                      <div style={{ marginBottom: 10 }}>
                        <small style={{ color: '#5c7080', fontWeight: 'bold' }}>METADATA</small>
                        {sourceFields
                          .filter(f => f.isMetadata)
                          .map(field => {
                            const isMapped = mappings.some(
                              m => m.sourceId === source.id && m.sourcePath === field.path
                            );
                            
                            return (
                              <div
                                key={field.path}
                                draggable
                                onDragStart={() => handleDragStart(field)}
                                onDragEnd={handleDragEnd}
                                style={{
                                  padding: 6,
                                  margin: '4px 0',
                                  backgroundColor: isMapped ? '#d4edda' : '#f8f9fa',
                                  border: '1px solid #d3d8de',
                                  borderRadius: 3,
                                  cursor: 'grab',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  fontSize: 12
                                }}
                              >
                                <Icon icon="drag-handle-vertical" size={10} />
                                <span style={{ flex: 1 }}>{field.name}</span>
                                <Tag minimal small>{field.type}</Tag>
                                {isMapped && <Icon icon="link" size={10} color="#28a745" />}
                              </div>
                            );
                          })}
                      </div>
                      
                      {/* Data Fields */}
                      <div>
                        <small style={{ color: '#5c7080', fontWeight: 'bold' }}>DATA FIELDS</small>
                        {sourceFields
                          .filter(f => !f.isMetadata)
                          .map(field => {
                            const isMapped = mappings.some(
                              m => m.sourceId === source.id && m.sourcePath === field.path
                            );
                            
                            return (
                              <div
                                key={field.path}
                                draggable
                                onDragStart={() => handleDragStart(field)}
                                onDragEnd={handleDragEnd}
                                style={{
                                  padding: 6,
                                  margin: '4px 0',
                                  backgroundColor: isMapped ? '#d4edda' : '#ffffff',
                                  border: '1px solid #d3d8de',
                                  borderRadius: 3,
                                  cursor: 'grab',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  fontSize: 12
                                }}
                              >
                                <Icon icon="drag-handle-vertical" size={10} />
                                <span style={{ flex: 1 }}>{field.path}</span>
                                <Tag minimal small>{field.type}</Tag>
                                {isMapped && <Icon icon="link" size={10} color="#28a745" />}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </Collapse>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Center Arrow */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Icon icon="arrow-right" size={20} />
        </div>

        {/* Right Panel: Target Fields */}
        <Card style={{ flex: '0 0 45%', overflow: 'hidden' }}>
          <h3>Output Fields</h3>
          <div style={{ height: 520, overflowY: 'auto' }}>
            {outputTemplate.fields.map((field: any) => {
              const targetMappings = getMappingsForTarget(field.path);
              const hasMappings = targetMappings.length > 0;
              
              return (
                <div
                  key={field.path}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, field.path)}
                  style={{
                    padding: 10,
                    margin: '8px 4px',
                    backgroundColor: hasMappings ? '#d4edda' : '#f8f9fa',
                    border: `2px ${hasMappings ? 'solid #28a745' : 'dashed #dee2e6'}`,
                    borderRadius: 4,
                    minHeight: 60
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <strong>{field.name || field.path}</strong>
                      <Tag minimal style={{ marginLeft: 8 }}>{field.type}</Tag>
                      {field.required && (
                        <Tag minimal intent={Intent.DANGER} style={{ marginLeft: 4 }}>
                          Required
                        </Tag>
                      )}
                    </div>
                  </div>
                  
                  {targetMappings.length > 0 ? (
                    <div>
                      <small style={{ color: '#5c7080' }}>Mapped from:</small>
                      {targetMappings.map(mapping => (
                        <div 
                          key={mapping.id}
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 8,
                            marginTop: 4,
                            padding: '4px 8px',
                            backgroundColor: '#ffffff',
                            borderRadius: 3,
                            fontSize: 12
                          }}
                        >
                          <Tag intent={Intent.SUCCESS} minimal>
                            {mapping.sourceName}
                          </Tag>
                          <code>{mapping.sourcePath}</code>
                          <Button
                            minimal
                            small
                            icon="cross"
                            intent={Intent.DANGER}
                            onClick={() => removeMapping(mapping.id)}
                            style={{ marginLeft: 'auto' }}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: '#6c757d', fontSize: 12 }}>
                      Drag fields here from any source
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
            {mappings.length} total mappings
          </Tag>
          <Tag intent={Intent.WARNING}>
            {outputTemplate.fields.filter((f: any) => 
              f.required && !mappings.some(m => m.targetPath === f.path)
            ).length} required fields unmapped
          </Tag>
          <Divider />
          {sourceSelection.sources.map((source: any) => {
            const sourceMappings = mappings.filter(m => m.sourceId === source.id);
            return (
              <Tag key={source.id} minimal>
                {source.name}: {sourceMappings.length}
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

export default FieldMappingCanvas;