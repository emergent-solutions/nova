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
  Classes
} from '@blueprintjs/core';
import { JsonFieldMapping } from '../../../types/jsonMapping.types';
import { TransformationModal } from './TransformationModal';
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
  const [showTransformModal, setShowTransformModal] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['metadata', 'data']) // Expand by default
  );
  const canvasRef = useRef<HTMLDivElement>(null);

  // ============= SAFETY CHECKS =============
  if (!sourceSelection || !sourceSelection.sources || sourceSelection.sources.length === 0) {
    return (
      <div className="field-mapping-canvas" ref={canvasRef}>
        <NonIdealState
          icon="warning-sign"
          title="No Source Selected"
          description="Please go back and select a data source first."
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

  const sourceId = sourceSelection.sources[0]?.id;
  const sourceName = sourceSelection.sources[0]?.name || sourceId;
  const sourceType = sourceSelection.sources[0]?.type || 'unknown';

  if (!sourceId || (!sampleData || !sampleData[sourceId])) {
    return (
      <div className="field-mapping-canvas" ref={canvasRef}>
        <NonIdealState
          icon="database"
          title="No Sample Data Available"
          description={`No sample data found for source "${sourceName}". Please test your data source first.`}
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

  // ============= BUILD SOURCE FIELDS =============
  
  // Create metadata fields for the data source
  const metadataFields: SourceField[] = [
    {
      path: '_source.id',
      name: 'Source ID',
      type: 'string',
      value: sourceId,
      isMetadata: true,
      category: 'metadata'
    },
    {
      path: '_source.name',
      name: 'Source Name',
      type: 'string',
      value: sourceName,
      isMetadata: true,
      category: 'metadata'
    },
    {
      path: '_source.type',
      name: 'Source Type',
      type: 'string',
      value: sourceType,
      isMetadata: true,
      category: 'metadata'
    },
    {
      path: '_source.timestamp',
      name: 'Fetch Timestamp',
      type: 'string',
      value: new Date().toISOString(),
      isMetadata: true,
      category: 'metadata'
    },
    {
      path: '_source.path',
      name: 'Source Path',
      type: 'string',
      value: sourceSelection.primaryPath || 'root',
      isMetadata: true,
      category: 'metadata'
    }
  ];

  // Add data source category if available
  const dataSource = sourceSelection.sources[0];
  if (dataSource.category) {
    metadataFields.push({
      path: '_source.category',
      name: 'Source Category',
      type: 'string',
      value: dataSource.category,
      isMetadata: true,
      category: 'metadata'
    });
  }

  // Add any custom metadata from the data source
  if (dataSource.metadata) {
    Object.keys(dataSource.metadata).forEach(key => {
      metadataFields.push({
        path: `_source.metadata.${key}`,
        name: `Source ${key.charAt(0).toUpperCase() + key.slice(1)}`,
        type: typeof dataSource.metadata[key],
        value: dataSource.metadata[key],
        isMetadata: true,
        category: 'metadata'
      });
    });
  }

  // Extract data fields from sample data
  let dataFields: SourceField[] = [];
  try {
    const extracted = extractFieldPaths(
      sampleData[sourceId],
      sourceSelection.primaryPath || ''
    );
    dataFields = extracted.map(field => ({
      ...field,
      category: 'data',
      isMetadata: false
    }));
  } catch (error) {
    console.error('Error extracting source fields:', error);
    dataFields = [];
  }

  // Combine all source fields
  const allSourceFields = [...metadataFields, ...dataFields];

  // Group fields by category
  const fieldsByCategory = allSourceFields.reduce((acc, field) => {
    const category = field.category || 'other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(field);
    return acc;
  }, {} as Record<string, SourceField[]>);

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

    const newMapping: JsonFieldMapping = {
      id: `mapping_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      targetPath,
      sourcePath: draggedField.path,
      sourceId: sourceId
    };

    // Check if mapping already exists for this target
    const existingIndex = mappings.findIndex(m => m.targetPath === targetPath);
    
    if (existingIndex >= 0) {
      const updated = [...mappings];
      updated[existingIndex] = newMapping;
      onChange(updated);
    } else {
      onChange([...mappings, newMapping]);
    }

    setDraggedField(null);
  };

  const removeMapping = (mappingId: string) => {
    onChange(mappings.filter(m => m.id !== mappingId));
  };

  const getMappingForTarget = (targetPath: string) => {
    return mappings.find(m => m.targetPath === targetPath);
  };

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  // ============= RENDER FUNCTIONS =============
  const renderSourceField = (field: SourceField) => {
    const isMapped = mappings.some(m => m.sourcePath === field.path);
    
    return (
      <div
        key={field.path}
        className={`source-field ${isMapped ? 'mapped' : ''} ${draggedField?.path === field.path ? 'dragging' : ''}`}
        draggable
        onDragStart={() => handleDragStart(field)}
        onDragEnd={handleDragEnd}
        style={{ 
          cursor: 'grab',
          padding: '6px 8px',
          margin: '2px 0',
          borderRadius: '3px',
          background: field.isMetadata ? '#f5f8fa' : '#ffffff',
          border: `1px solid ${isMapped ? '#0f9960' : '#e1e8ed'}`,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          if (!isMapped) {
            e.currentTarget.style.background = field.isMetadata ? '#e1e8ed' : '#f5f8fa';
            e.currentTarget.style.borderColor = '#137cbd';
          }
        }}
        onMouseLeave={(e) => {
          if (!isMapped) {
            e.currentTarget.style.background = field.isMetadata ? '#f5f8fa' : '#ffffff';
            e.currentTarget.style.borderColor = '#e1e8ed';
          }
        }}
      >
        <Icon icon="drag-handle-vertical" size={12} />
        <span style={{ 
          flex: 1, 
          fontSize: '12px',
          fontFamily: field.isMetadata ? 'monospace' : 'inherit'
        }}>
          {field.isMetadata ? field.path : field.name || field.path}
        </span>
        <Tag minimal small intent={field.isMetadata ? Intent.PRIMARY : Intent.NONE}>
          {field.type || 'unknown'}
        </Tag>
        {isMapped && <Icon icon="link" intent={Intent.SUCCESS} size={12} />}
        {field.isMetadata && <Icon icon="info-sign" intent={Intent.PRIMARY} size={12} />}
      </div>
    );
  };

  const renderTargetField = (field: any) => {
    const mapping = getMappingForTarget(field.path);
    
    return (
      <div
        key={field.path}
        className={`target-field ${mapping ? 'mapped' : ''}`}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, field.path)}
        style={{ 
          minHeight: 36,
          padding: '6px 8px',
          margin: '2px 0',
          borderRadius: '3px',
          background: mapping ? '#e7f3e7' : '#ffffff',
          border: `1px solid ${mapping ? '#0f9960' : '#e1e8ed'}`,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'all 0.2s'
        }}
      >
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Icon icon={field.required ? 'star' : 'circle'} size={12} />
          <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{field.path}</span>
          <Tag minimal small>{field.type || 'any'}</Tag>
        </div>
        
        {mapping && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Tag intent={Intent.SUCCESS} minimal small>
              <Icon icon="arrow-left" size={10} />
              <span style={{ marginLeft: 4 }}>{mapping.sourcePath}</span>
            </Tag>
            <Button
              minimal
              small
              icon="edit"
              onClick={() => {
                setSelectedMapping(mapping.id);
                setShowTransformModal(true);
              }}
            />
            <Button
              minimal
              small
              icon="cross"
              intent={Intent.DANGER}
              onClick={() => removeMapping(mapping.id)}
            />
          </div>
        )}
      </div>
    );
  };

  const renderFieldCategory = (category: string, fields: SourceField[]) => {
    const isExpanded = expandedCategories.has(category);
    const categoryInfo = {
      metadata: {
        icon: 'info-sign',
        title: 'Source Metadata',
        description: 'Information about the data source',
        intent: Intent.PRIMARY
      },
      data: {
        icon: 'database',
        title: 'Data Fields',
        description: 'Fields from your source data',
        intent: Intent.NONE
      },
      other: {
        icon: 'folder-close',
        title: 'Other Fields',
        description: 'Additional fields',
        intent: Intent.NONE
      }
    }[category] || { icon: 'folder-close', title: category, description: '', intent: Intent.NONE };

    return (
      <div key={category} style={{ marginBottom: 10 }}>
        <div 
          onClick={() => toggleCategory(category)}
          style={{ 
            cursor: 'pointer',
            padding: '6px 10px',
            background: '#e1e8ed',
            borderRadius: '3px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '4px'
          }}
        >
          <Icon icon={isExpanded ? 'chevron-down' : 'chevron-right'} size={12} />
          <Icon icon={categoryInfo.icon as any} intent={categoryInfo.intent} size={12} />
          <span style={{ flex: 1, fontWeight: 500, fontSize: '13px' }}>
            {categoryInfo.title}
          </span>
          <Tag minimal small intent={categoryInfo.intent}>
            {fields.length} fields
          </Tag>
        </div>
        
        {isExpanded && (
          <div style={{ paddingLeft: 20 }}>
            {categoryInfo.description && (
              <p className={Classes.TEXT_MUTED} style={{ fontSize: '11px', margin: '4px 0 8px 0' }}>
                {categoryInfo.description}
              </p>
            )}
            {fields.map(renderSourceField)}
          </div>
        )}
      </div>
    );
  };

  // ============= MAIN RENDER =============
  return (
    <div className="field-mapping-canvas" ref={canvasRef}>
      <Callout intent={Intent.PRIMARY} icon="info-sign" style={{ marginBottom: 20 }}>
        <strong>Map Your Fields</strong>
        <p style={{ margin: '5px 0 0 0' }}>
          Drag fields from the source panel (left) to the output panel (right). 
          Source metadata fields are available to include information about the data source.
        </p>
      </Callout>

      <div className="mapping-panels" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 20 }}>
        {/* Source Fields Panel */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h4 style={{ margin: 0 }}>Source Fields</h4>
            <Tag minimal>
              {allSourceFields.length} available
            </Tag>
          </div>
          
          <Divider style={{ margin: '10px 0' }} />
          
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {Object.keys(fieldsByCategory).map(category => 
              renderFieldCategory(category, fieldsByCategory[category])
            )}
          </div>
        </Card>

        {/* Visual Connection Indicator */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: '#5c7080'
        }}>
          <Icon icon="exchange" size={30} />
          <div style={{ marginTop: 10, fontSize: 12 }}>
            {mappings.length} mapping{mappings.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Target Fields Panel */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h4 style={{ margin: 0 }}>Output Fields</h4>
            <Tag minimal intent={Intent.PRIMARY}>
              {outputTemplate.fields.length} defined
            </Tag>
          </div>
          
          <Divider style={{ margin: '10px 0' }} />
          
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {outputTemplate.fields.length > 0 ? (
              outputTemplate.fields.map(renderTargetField)
            ) : (
              <NonIdealState
                icon="build"
                title="No output fields"
                description="Define your output structure first"
              />
            )}
          </div>
        </Card>
      </div>

      {/* Mapping Summary */}
      {mappings.length > 0 && (
        <Card style={{ marginTop: 20 }}>
          <h4>Mapping Summary</h4>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div>
              <strong>Total Mappings:</strong> {mappings.length}
            </div>
            <div>
              <strong>Metadata Fields Used:</strong>{' '}
              {mappings.filter(m => m.sourcePath.startsWith('_source')).length}
            </div>
            <div>
              <strong>Required Fields Mapped:</strong>{' '}
              {outputTemplate.fields
                .filter((f: any) => f.required)
                .filter((f: any) => getMappingForTarget(f.path))
                .length} / {outputTemplate.fields.filter((f: any) => f.required).length}
            </div>
          </div>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="step-actions" style={{ marginTop: 30, display: 'flex', justifyContent: 'space-between' }}>
        <Button
          text="Previous"
          icon="arrow-left"
          onClick={onPrevious}
        />
        <Button
          intent={Intent.PRIMARY}
          text="Next: Preview"
          rightIcon="arrow-right"
          disabled={mappings.length === 0}
          onClick={onNext}
        />
      </div>

      {/* Transformation Modal */}
      {showTransformModal && selectedMapping && (
        <TransformationModal
          mapping={mappings.find(m => m.id === selectedMapping)!}
          onSave={(updated) => {
            const index = mappings.findIndex(m => m.id === updated.id);
            if (index >= 0) {
              const newMappings = [...mappings];
              newMappings[index] = updated;
              onChange(newMappings);
            }
            setShowTransformModal(false);
            setSelectedMapping(null);
          }}
          onClose={() => {
            setShowTransformModal(false);
            setSelectedMapping(null);
          }}
        />
      )}
    </div>
  );
};