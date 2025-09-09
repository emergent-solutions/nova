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
  Collapse,
  Switch,
  Position,
  Tooltip
} from '@blueprintjs/core';
import { JsonFieldMapping } from '../../../types/jsonMapping.types';
import { extractFieldPaths } from '../utils/pathHelpers';

const styles = {
  mappingContainer: {
    display: 'flex',
    gap: 20,
    minHeight: 600,
    position: 'relative' as const
  },
  
  sourcePanel: {
    flex: '0 0 45%',
    maxHeight: '80vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const
  },
  
  outputPanel: {
    flex: '0 0 45%',
    position: 'sticky' as const,
    top: 20,
    maxHeight: '80vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const
  },
  
  panelContent: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '10px'
  },
  
  floatingOutputPanel: {
    position: 'fixed' as const,
    right: 20,
    top: '50%',
    transform: 'translateY(-50%)',
    width: '400px',
    maxHeight: '70vh',
    zIndex: 1000,
    boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
  },
  
  compactMode: {
    padding: '8px',
    marginBottom: '10px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    borderBottom: '1px solid #e1e8ed'
  },
  
  dropZone: {
    padding: 10,
    margin: '8px 4px',
    borderRadius: 4,
    minHeight: 60,
    transition: 'all 0.2s ease'
  },
  
  dropZoneActive: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196f3',
    transform: 'scale(1.02)'
  },
  
  fieldItem: {
    padding: '6px 10px',
    margin: '4px 2px',
    borderRadius: 3,
    cursor: 'grab',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    transition: 'all 0.2s ease'
  },
  
  miniMap: {
    position: 'fixed' as const,
    bottom: 20,
    right: 20,
    width: 200,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 4,
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  }
};

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
  const [expandedSources, setExpandedSources] = useState<Set<string>>(() => 
    new Set(sourceSelection.sources.map((s: any) => s.id))
  );
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'side-by-side' | 'floating' | 'compact'>('side-by-side');
  const [showMiniMap, setShowMiniMap] = useState(false);
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
  const handleDragOver = (e: React.DragEvent, targetPath: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOverTarget(targetPath);
  };

  const handleDragLeave = () => {
    setDragOverTarget(null);
  };

  const handleDragStart = (field: SourceField) => {
    setDraggedField(field);
  };

  const handleDragEnd = () => {
    setDraggedField(null);
  };

  const handleDrop = (e: React.DragEvent, targetPath: string) => {
    e.preventDefault();
    setDragOverTarget(null);

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

  const OutputFieldsPanel = ({ isFloating = false }) => (
    <Card style={isFloating ? styles.floatingOutputPanel : {}}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: '10px',
        borderBottom: '1px solid #e1e8ed'
      }}>
        <h3 style={{ margin: 0 }}>Output Fields</h3>
        {isFloating && (
          <Button
            minimal
            icon="cross"
            onClick={() => setViewMode('side-by-side')}
          />
        )}
      </div>
      
      <div style={styles.panelContent}>
        {outputTemplate.fields.map((field: any) => {
          const targetMappings = getMappingsForTarget(field.path);
          const hasMappings = targetMappings.length > 0;
          const isDragOver = dragOverTarget === field.path;
          
          return (
            <div
              key={field.path}
              onDragOver={(e) => handleDragOver(e, field.path)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, field.path)}
              style={{
                ...styles.dropZone,
                backgroundColor: isDragOver 
                  ? '#e3f2fd' 
                  : hasMappings 
                    ? '#d4edda' 
                    : '#f8f9fa',
                border: `2px ${isDragOver 
                  ? 'solid #2196f3' 
                  : hasMappings 
                    ? 'solid #28a745' 
                    : 'dashed #dee2e6'}`,
                ...(isDragOver ? styles.dropZoneActive : {})
              }}
            >
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                marginBottom: 8 
              }}>
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
                <div style={{ fontSize: 12 }}>
                  {targetMappings.map((mapping: any) => (
                    <div key={mapping.id} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 8,
                      padding: '4px',
                      backgroundColor: 'rgba(255,255,255,0.8)',
                      borderRadius: 3,
                      marginBottom: 4
                    }}>
                      <Icon icon="link" size={10} />
                      <span style={{ flex: 1 }}>
                        <strong>{mapping.sourceName}:</strong> {mapping.sourcePath}
                      </span>
                      <Button
                        minimal
                        small
                        icon="cross"
                        onClick={() => removeMapping(mapping.id)}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ 
                  fontSize: 11, 
                  color: '#8a8a8a',
                  textAlign: 'center',
                  padding: '10px'
                }}>
                  {isDragOver ? 'Drop here to map' : 'Drag a source field here'}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
  
  const MiniMap = () => {
    const mappedCount = outputTemplate.fields.filter((f: any) => 
      mappings.some(m => m.targetPath === f.path)
    ).length;
    
    const requiredMapped = outputTemplate.fields.filter((f: any) => 
      f.required && mappings.some(m => m.targetPath === f.path)
    ).length;
    
    const totalRequired = outputTemplate.fields.filter((f: any) => f.required).length;
    
    return (
      <div style={styles.miniMap}>
        <h5 style={{ margin: '0 0 10px 0' }}>Mapping Progress</h5>
        <div style={{ marginBottom: 8 }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            fontSize: 12,
            marginBottom: 4
          }}>
            <span>Overall</span>
            <span>{mappedCount}/{outputTemplate.fields.length}</span>
          </div>
          <div style={{
            height: 8,
            backgroundColor: '#e0e0e0',
            borderRadius: 4,
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              width: `${(mappedCount / outputTemplate.fields.length) * 100}%`,
              backgroundColor: '#4caf50',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
        
        <div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            fontSize: 12,
            marginBottom: 4
          }}>
            <span>Required</span>
            <span>{requiredMapped}/{totalRequired}</span>
          </div>
          <div style={{
            height: 8,
            backgroundColor: '#e0e0e0',
            borderRadius: 4,
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              width: `${totalRequired > 0 ? (requiredMapped / totalRequired) * 100 : 0}%`,
              backgroundColor: requiredMapped === totalRequired ? '#4caf50' : '#ff9800',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      </div>
    );
  };

  // Helper function to render source fields
  const renderSourceField = (field: SourceField) => {
    const isMapped = mappings.some(
      m => m.sourceId === field.sourceId && m.sourcePath === field.path
    );
    
    return (
      <div
        key={field.path}
        draggable
        onDragStart={() => handleDragStart(field)}
        onDragEnd={handleDragEnd}
        style={{
          ...styles.fieldItem,
          backgroundColor: isMapped ? '#d4edda' : '#ffffff',
          border: '1px solid #d3d8de',
        }}
      >
        <Icon icon="drag-handle-vertical" size={10} />
        <span style={{ flex: 1 }}>{field.path}</span>
        <Tag minimal small>{field.type}</Tag>
        {isMapped && <Icon icon="link" size={10} color="#28a745" />}
      </div>
    );
  };

  return (
    <div className="field-mapping-canvas" ref={canvasRef}>
      <Callout intent={Intent.PRIMARY} icon="info-sign" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            Drag fields from sources to output fields. Multiple sources can map to the same output field.
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Tooltip content="Side-by-side view">
              <Button
                minimal
                icon="panel-stats"
                active={viewMode === 'side-by-side'}
                onClick={() => setViewMode('side-by-side')}
              />
            </Tooltip>
            <Tooltip content="Floating output panel">
              <Button
                minimal
                icon="application"
                active={viewMode === 'floating'}
                onClick={() => setViewMode('floating')}
              />
            </Tooltip>
            <Tooltip content="Compact view">
              <Button
                minimal
                icon="minimize"
                active={viewMode === 'compact'}
                onClick={() => setViewMode('compact')}
              />
            </Tooltip>
            <Divider />
            <Switch
              checked={showMiniMap}
              onChange={(e) => setShowMiniMap(e.target.checked)}
              label="Mini Map"
            />
          </div>
        </div>
      </Callout>

      <div className="mapping-container" style={styles.mappingContainer}>
        {/* Source Fields Panel */}
        <Card style={viewMode === 'floating' ? { flex: '1 1 100%' } : styles.sourcePanel}>
          <h3 style={{ padding: '10px', margin: 0, borderBottom: '1px solid #e1e8ed' }}>
            Source Fields (All Sources)
          </h3>
          <div style={styles.panelContent}>
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
                      cursor: 'pointer',
                      borderRadius: 4
                    }}
                    onClick={() => toggleSourceExpanded(source.id)}
                  >
                    <Icon icon={isExpanded ? 'chevron-down' : 'chevron-right'} />
                    <Icon icon={
                      source.type === 'api' ? 'cloud' :
                      source.type === 'database' ? 'database' :
                      source.type === 'file' ? 'document' : 'folder-close'
                    } />
                    <span style={{ flex: 1, fontWeight: 600 }}>{source.name}</span>
                    <Tag minimal>{sourceFields.length} fields</Tag>
                  </div>
                  
                  <Collapse isOpen={isExpanded}>
                    <div style={{ padding: '8px 8px 8px 32px' }}>
                      {/* Metadata Fields */}
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11, color: '#8a8a8a', marginBottom: 4 }}>
                          METADATA
                        </div>
                        {sourceFields
                          .filter(f => f.isMetadata)
                          .map(field => renderSourceField(field))}
                      </div>
                      
                      {/* Data Fields */}
                      <div>
                        <div style={{ fontSize: 11, color: '#8a8a8a', marginBottom: 4 }}>
                          DATA FIELDS
                        </div>
                        {sourceFields
                          .filter(f => !f.isMetadata)
                          .map(field => renderSourceField(field))}
                      </div>
                    </div>
                  </Collapse>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Center Arrow (only for side-by-side view) */}
        {viewMode === 'side-by-side' && (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Icon icon="arrow-right" size={20} />
          </div>
        )}

        {/* Output Fields Panel */}
        {viewMode === 'side-by-side' && (
          <div style={styles.outputPanel}>
            <OutputFieldsPanel />
          </div>
        )}
      </div>

      {/* Floating Output Panel */}
      {viewMode === 'floating' && <OutputFieldsPanel isFloating={true} />}

      {/* Mini Map */}
      {showMiniMap && <MiniMap />}

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