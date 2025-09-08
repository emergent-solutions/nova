import React, { useState, useEffect } from 'react';
import {
  RadioGroup,
  Radio,
  Callout,
  Intent,
  Button,
  FileInput,
  NonIdealState,
  Tree,
  TreeNode,
  Card,
  FormGroup,
  TextArea,
  Toaster,
  Position,
  Tabs,
  Tab,
  Tag,
  Icon,
  Checkbox,
  HTMLSelect,
  Collapse,
  Classes,
  Divider
} from '@blueprintjs/core';
import { APIEndpointConfig } from '../../../types/schema.types';
import { SchemaMapper } from '../../SchemaMapper/SchemaMapper';
import { generateAutoSchema } from '../../../utils/schemaHelpers';

interface SchemaDesignStepProps {
  config: APIEndpointConfig;
  dataSources?: any[]; // Add this for multi-source support
  sampleData?: Record<string, any>; // Add this for field extraction
  onUpdate: (updates: Partial<APIEndpointConfig>) => void;
}

// Create toaster instance for notifications
const toaster = Toaster.create({
  position: Position.TOP
});

const SchemaDesignStep: React.FC<SchemaDesignStepProps> = ({ 
  config, 
  dataSources = [],
  sampleData = {},
  onUpdate 
}) => {
  // State for schema mode
  const [schemaMode, setSchemaMode] = useState<string>(() => {
    if (config.schemaMode) return config.schemaMode;
    return config.outputSchema?.root && config.outputSchema?.isCustom ? 'custom' : 'auto';
  });
  
  const [importedSchema, setImportedSchema] = useState<any>(null);
  const [manualSchemaText, setManualSchemaText] = useState<string>('');
  const [schemaError, setSchemaError] = useState<string>('');
  
  // Multi-source mapping state
  const [mappingMode, setMappingMode] = useState<'single' | 'multi'>('single');
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [activeSourceTab, setActiveSourceTab] = useState<string>('');
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [fieldMappings, setFieldMappings] = useState<any[]>(config.fieldMappings || []);
  const [draggedField, setDraggedField] = useState<any>(null);

  // Initialize selected sources from config
  useEffect(() => {
    if (config.dataSources && config.dataSources.length > 0) {
      const sourceIds = new Set(config.dataSources.map(ds => ds.id));
      setSelectedSources(sourceIds);
      setActiveSourceTab(config.dataSources[0].id);
      
      // Determine mapping mode based on number of sources
      setMappingMode(config.dataSources.length > 1 ? 'multi' : 'single');
    }
  }, [config.dataSources]);

  // Auto-generate schema on mount if in auto mode
  useEffect(() => {
    if (schemaMode === 'auto' && (!config.outputSchema?.root || !config.outputSchema?.isCustom)) {
      const autoSchema = generateAutoSchemaForFormat(config);
      onUpdate({
        outputSchema: {
          root: autoSchema,
          version: '1.0.0',
          format: config.outputFormat || 'json',
          isCustom: false
        },
        schemaMode: 'auto'
      });
    }
  }, [schemaMode, config.outputFormat, config.dataSources]);

  // Format-specific schema generation
  const generateAutoSchemaForFormat = (config: APIEndpointConfig) => {
    const format = config.outputFormat || 'json';
    
    switch (format) {
      case 'rss':
        return generateRSSSchema();
      case 'atom':
        return generateAtomSchema();
      case 'csv':
        return generateCSVSchema(config);
      case 'xml':
        return generateXMLSchema(config);
      default:
        return generateJSONSchema(config);
    }
  };

  const generateJSONSchema = (config: APIEndpointConfig) => {
    return generateAutoSchema(config);
  };

  const generateRSSSchema = () => ({
    key: 'rss',
    type: 'element' as const,
    attributes: [{ key: 'version', value: '2.0' }],
    children: [{
      key: 'channel',
      type: 'element' as const,
      children: [
        { key: 'title', type: 'string' },
        { key: 'link', type: 'string' },
        { key: 'description', type: 'string' },
        { key: 'language', type: 'string' },
        { key: 'pubDate', type: 'string' },
        {
          key: 'item',
          type: 'array' as const,
          children: [
            { key: 'title', type: 'string' },
            { key: 'link', type: 'string' },
            { key: 'description', type: 'string' },
            { key: 'pubDate', type: 'string' },
            { key: 'guid', type: 'string' }
          ]
        }
      ]
    }]
  });

  const generateAtomSchema = () => ({
    key: 'feed',
    type: 'element' as const,
    namespace: 'http://www.w3.org/2005/Atom',
    children: [
      { key: 'title', type: 'string' },
      { key: 'link', type: 'string' },
      { key: 'updated', type: 'string' },
      { key: 'author', type: 'object', children: [{ key: 'name', type: 'string' }] },
      {
        key: 'entry',
        type: 'array' as const,
        children: [
          { key: 'title', type: 'string' },
          { key: 'link', type: 'string' },
          { key: 'id', type: 'string' },
          { key: 'updated', type: 'string' },
          { key: 'summary', type: 'string' }
        ]
      }
    ]
  });

  const generateCSVSchema = (config: APIEndpointConfig) => ({
    key: 'table',
    type: 'table' as const,
    columns: config.dataSources.length > 0
      ? extractColumnsFromDataSources(config.dataSources)
      : [
          { key: 'id', type: 'number' },
          { key: 'name', type: 'string' },
          { key: 'value', type: 'string' }
        ]
  });

  const generateXMLSchema = (config: APIEndpointConfig) => ({
    key: 'root',
    type: 'element' as const,
    attributes: [],
    children: config.dataSources.length > 0
      ? extractFieldsFromDataSources(config.dataSources)
      : [{ key: 'data', type: 'string' }]
  });

  const extractColumnsFromDataSources = (dataSources: any[]) => {
    return [{ key: 'column1', type: 'string' }];
  };

  const extractFieldsFromDataSources = (dataSources: any[]) => {
    return [{ key: 'field1', type: 'string' }];
  };

  const handleSchemaModeChange = (mode: string) => {
    setSchemaMode(mode);
    setSchemaError('');
    
    if (mode === 'auto') {
      const autoSchema = generateAutoSchemaForFormat(config);
      onUpdate({
        outputSchema: {
          root: autoSchema,
          version: '1.0.0',
          format: config.outputFormat || 'json',
          isCustom: false
        },
        schemaMode: mode
      });
    } else {
      onUpdate({ schemaMode: mode });
    }
  };

  // Multi-source field extraction
  const extractFieldsFromSource = (sourceId: string) => {
    if (!sampleData[sourceId]) return [];
    
    const fields: any[] = [];
    const data = sampleData[sourceId];
    
    // Add metadata fields
    fields.push(
      { path: '_source.id', name: 'Source ID', type: 'string', isMetadata: true },
      { path: '_source.name', name: 'Source Name', type: 'string', isMetadata: true },
      { path: '_source.timestamp', name: 'Timestamp', type: 'string', isMetadata: true }
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
  };

  // Drag and drop handlers for multi-source mapping
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
    
    const newMapping = {
      id: `mapping-${Date.now()}`,
      sourceId: draggedField.sourceId,
      sourceName: draggedField.sourceName,
      source_field: draggedField.path,
      target_field: targetPath,
      transform_type: 'direct'
    };
    
    const updatedMappings = fieldMappings.filter(m => m.target_field !== targetPath);
    updatedMappings.push(newMapping);
    
    setFieldMappings(updatedMappings);
    onUpdate({ fieldMappings: updatedMappings });
    setDraggedField(null);
  };

  const removeMapping = (targetPath: string) => {
    const updatedMappings = fieldMappings.filter(m => m.target_field !== targetPath);
    setFieldMappings(updatedMappings);
    onUpdate({ fieldMappings: updatedMappings });
  };

  // Render multi-source field mapper
  const renderMultiSourceMapper = () => {
    const availableDataSources = dataSources || config.dataSources || [];
    
    return (
      <div className="multi-source-mapper">
        <div style={{ display: 'flex', gap: 20, height: 500 }}>
          {/* Left Panel: Source Fields */}
          <Card style={{ flex: '0 0 45%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <h4>Data Sources</h4>
            {availableDataSources.length === 0 ? (
              <NonIdealState
                icon="database"
                title="No data sources"
                description="Please add data sources first"
              />
            ) : (
              <Tabs
                id="source-tabs"
                selectedTabId={activeSourceTab}
                onChange={(newTab: string) => setActiveSourceTab(newTab)}
              >
                {availableDataSources.map(source => (
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
                      <div style={{ height: 380, overflowY: 'auto' }}>
                        {extractFieldsFromSource(source.id).map(field => {
                          const isMapped = fieldMappings.some(
                            m => m.sourceId === source.id && m.source_field === field.path
                          );
                          
                          return (
                            <div
                              key={field.path}
                              draggable
                              onDragStart={() => handleDragStart(field, source.id, source.name)}
                              onDragEnd={handleDragEnd}
                              style={{
                                padding: 8,
                                margin: 4,
                                backgroundColor: isMapped ? '#e1f0fe' : '#f5f8fa',
                                border: '1px solid #d3d8de',
                                borderRadius: 4,
                                cursor: 'grab',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8
                              }}
                            >
                              <Icon icon="drag-handle-vertical" size={12} />
                              <span style={{ flex: 1 }}>{field.name}</span>
                              <Tag minimal>{field.type}</Tag>
                              {field.isMetadata && <Tag minimal intent={Intent.PRIMARY}>META</Tag>}
                              {isMapped && <Icon icon="link" color="#137cbd" />}
                            </div>
                          );
                        })}
                      </div>
                    }
                  />
                ))}
              </Tabs>
            )}
          </Card>

          {/* Right Panel: Output Schema */}
          <Card style={{ flex: '0 0 45%', overflow: 'hidden' }}>
            <h4>Output Schema</h4>
            <div style={{ height: 420, overflowY: 'auto' }}>
              {config.outputSchema?.root ? (
                renderSchemaNode(config.outputSchema.root, '')
              ) : (
                <NonIdealState
                  icon="build"
                  title="No schema defined"
                  description="Generate or define your output schema"
                />
              )}
            </div>
          </Card>
        </div>

        {/* Mapping Summary */}
        <Card style={{ marginTop: 20, backgroundColor: '#f5f8fa' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
            <Icon icon="info-sign" />
            <strong>Mapping Summary:</strong>
            <Tag intent={Intent.SUCCESS}>
              {fieldMappings.length} fields mapped
            </Tag>
            {availableDataSources.map(source => {
              const sourceMappings = fieldMappings.filter(m => m.sourceId === source.id);
              return sourceMappings.length > 0 ? (
                <Tag key={source.id} minimal>
                  {source.name}: {sourceMappings.length} fields
                </Tag>
              ) : null;
            })}
          </div>
        </Card>
      </div>
    );
  };

  // Render schema node for mapping
  const renderSchemaNode = (node: any, path: string) => {
    const fullPath = path ? `${path}.${node.key}` : node.key;
    const mapping = fieldMappings.find(m => m.target_field === fullPath);
    
    return (
      <div key={fullPath}>
        <div
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, fullPath)}
          style={{
            padding: 10,
            margin: 4,
            backgroundColor: mapping ? '#d4edda' : '#f8f9fa',
            border: `2px ${mapping ? 'solid #28a745' : 'dashed #dee2e6'}`,
            borderRadius: 4,
            minHeight: 40
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <strong>{node.key}</strong>
              <Tag minimal style={{ marginLeft: 8 }}>{node.type}</Tag>
              {node.required && (
                <Tag minimal intent={Intent.DANGER} style={{ marginLeft: 4 }}>
                  Required
                </Tag>
              )}
            </div>
            
            {mapping && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Tag intent={Intent.SUCCESS}>
                  {mapping.sourceName}: {mapping.source_field}
                </Tag>
                <Button
                  minimal
                  icon="cross"
                  intent={Intent.DANGER}
                  onClick={() => removeMapping(fullPath)}
                />
              </div>
            )}
          </div>
          
          {!mapping && (
            <div style={{ marginTop: 8, color: '#6c757d', fontSize: 12 }}>
              Drag a source field here to map
            </div>
          )}
        </div>
        
        {node.children && node.children.length > 0 && (
          <div style={{ marginLeft: 20 }}>
            {node.children.map((child: any) => renderSchemaNode(child, fullPath))}
          </div>
        )}
      </div>
    );
  };

  const handleSchemaImport = (event: React.FormEvent<HTMLInputElement>) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        
        setImportedSchema(parsed);
        
        // Convert based on detected format
        const convertedSchema = detectAndConvertSchema(parsed);
        onUpdate({
          outputSchema: {
            root: convertedSchema,
            version: parsed.info?.version || parsed.version || '1.0.0',
            format: config.outputFormat || 'json',
            isCustom: true
          }
        });
        
        toaster.show({
          message: "Schema imported successfully",
          intent: Intent.SUCCESS
        });
      } catch (error) {
        console.error('Failed to parse schema file:', error);
        toaster.show({
          message: "Failed to parse schema file. Please check the format.",
          intent: Intent.DANGER
        });
      }
    };
    reader.readAsText(file);
  };

  const detectAndConvertSchema = (schema: any): any => {
    // Default conversion - you can expand this
    return schema;
  };

  const handleManualSchemaUpdate = () => {
    try {
      const parsed = JSON.parse(manualSchemaText);
      onUpdate({
        outputSchema: {
          root: parsed,
          version: '1.0.0',
          format: config.outputFormat || 'json',
          isCustom: true
        }
      });
      setSchemaError('');
      toaster.show({
        message: "Schema updated successfully",
        intent: Intent.SUCCESS
      });
    } catch (error) {
      setSchemaError('Invalid JSON schema');
    }
  };

  const handleSchemaStructureChange = (newSchema: any) => {
    onUpdate({
      outputSchema: {
        ...config.outputSchema,
        root: newSchema,
        isCustom: true
      }
    });
  };

  return (
    <div className="schema-design-step">
      <Callout intent={Intent.PRIMARY} icon="info-sign">
        Design the structure of your API output. {config.dataSources && config.dataSources.length > 1 
          ? 'You can map fields from multiple data sources.' 
          : 'Auto-generation is recommended for most use cases.'}
      </Callout>

      <RadioGroup
        label="Schema Design Mode"
        selectedValue={schemaMode}
        onChange={(e) => handleSchemaModeChange((e.target as HTMLInputElement).value)}
      >
        <Radio 
          label="Auto-generate from data sources" 
          value="auto"
        >
          <small className="bp4-text-muted">
            Automatically create a schema based on your output format and data sources
          </small>
        </Radio>
        <Radio 
          label="Custom schema design" 
          value="custom"
        >
          <small className="bp4-text-muted">
            Manually design your output schema with full control
          </small>
        </Radio>
        {config.dataSources && config.dataSources.length > 1 && (
          <Radio 
            label="Multi-source field mapping" 
            value="multi-source"
          >
            <small className="bp4-text-muted">
              Map fields from multiple data sources to your output schema
            </small>
          </Radio>
        )}
        <Radio 
          label="Import from OpenAPI/Swagger" 
          value="import"
        >
          <small className="bp4-text-muted">
            Import an existing API specification (OpenAPI 3.0, Swagger 2.0, or JSON Schema)
          </small>
        </Radio>
        <Radio 
          label="Manual JSON entry" 
          value="manual"
        >
          <small className="bp4-text-muted">
            Directly edit the schema as JSON
          </small>
        </Radio>
      </RadioGroup>

      <div className="schema-content" style={{ marginTop: 20 }}>
        {schemaMode === 'auto' && (
          <Card className="auto-schema-preview">
            <h4>Auto-Generated Schema for {config.outputFormat?.toUpperCase() || 'JSON'}</h4>
            {config.outputSchema?.root ? (
              <>
                <Tree
                  contents={schemaNodeToTreeNode(config.outputSchema.root)}
                />
                <div style={{ marginTop: 10 }}>
                  <Button
                    icon="refresh"
                    text="Regenerate"
                    onClick={() => handleSchemaModeChange('auto')}
                  />
                </div>
              </>
            ) : (
              <NonIdealState
                icon="automatic-updates"
                title="Generating schema..."
                description="Schema will be generated based on your data sources and output format"
              />
            )}
          </Card>
        )}

        {schemaMode === 'custom' && (
          <div className="custom-schema-designer">
            {config.dataSources.length > 0 ? (
              <SchemaMapper
                sources={config.dataSources}
                targetSchema={config.outputSchema?.root || generateAutoSchemaForFormat(config)}
                mappings={config.fieldMappings || []}
                onChange={(mappings) => onUpdate({ fieldMappings: mappings })}
                onSchemaChange={handleSchemaStructureChange}
              />
            ) : (
              <Card>
                <h4>Manual Schema Builder</h4>
                <p className="bp4-text-muted">
                  You can design your schema structure even without data sources.
                </p>
                <SchemaMapper
                  sources={[]}
                  targetSchema={config.outputSchema?.root || { key: 'root', type: 'object', children: [] }}
                  mappings={[]}
                  onChange={(mappings) => onUpdate({ fieldMappings: mappings })}
                  onSchemaChange={handleSchemaStructureChange}
                  allowManualEdit={true}
                />
              </Card>
            )}
          </div>
        )}

        {schemaMode === 'multi-source' && renderMultiSourceMapper()}

        {schemaMode === 'import' && (
          <Card className="import-schema">
            <h4>Import Schema</h4>
            <FileInput
              text={importedSchema ? `Imported: ${importedSchema.info?.title || 'Schema'}` : "Choose file..."}
              hasSelection={!!importedSchema}
              onInputChange={handleSchemaImport}
              inputProps={{
                accept: '.json,.yaml,.yml'
              }}
            />
            <div className="bp4-text-muted" style={{ marginTop: 10 }}>
              Supports: OpenAPI 3.0, Swagger 2.0, JSON Schema
            </div>
            {importedSchema && (
              <Callout intent={Intent.SUCCESS} style={{ marginTop: 15 }}>
                <strong>Successfully imported:</strong> {importedSchema.info?.title || importedSchema.title || 'Untitled Schema'}
                <br />
                <small>Version: {importedSchema.info?.version || importedSchema.version || 'Not specified'}</small>
              </Callout>
            )}
          </Card>
        )}

        {schemaMode === 'manual' && (
          <Card className="manual-schema">
            <h4>Manual Schema JSON</h4>
            <FormGroup
              label="Schema Definition"
              labelFor="schema-json"
              helperText={schemaError || "Enter valid JSON schema"}
              intent={schemaError ? Intent.DANGER : Intent.NONE}
            >
              <TextArea
                id="schema-json"
                large={true}
                fill={true}
                rows={15}
                value={manualSchemaText || JSON.stringify(config.outputSchema?.root, null, 2)}
                onChange={(e) => setManualSchemaText(e.target.value)}
                placeholder={'{\n  "key": "root",\n  "type": "object",\n  "children": [...]\n}'}
              />
            </FormGroup>
            <Button
              text="Apply Schema"
              intent={Intent.PRIMARY}
              onClick={handleManualSchemaUpdate}
              disabled={!manualSchemaText}
            />
          </Card>
        )}
      </div>
    </div>
  );
};

// Helper function to convert schema nodes to Blueprint Tree nodes
function schemaNodeToTreeNode(node: any): TreeNode[] {
  if (!node) return [];
  
  const getIcon = (type: string) => {
    switch (type) {
      case 'object':
      case 'element':
        return 'folder-close';
      case 'array':
      case 'table':
        return 'array';
      case 'string':
      case 'text':
        return 'font';
      case 'number':
      case 'integer':
        return 'numerical';
      case 'boolean':
        return 'tick-circle';
      case 'datetime':
      case 'date':
        return 'calendar';
      case 'url':
      case 'uri':
        return 'link';
      default:
        return 'document';
    }
  };

  const getLabel = (node: any) => {
    let label = node.key;
    if (node.type) label += ` (${node.type})`;
    if (node.required) label += ' *';
    if (node.format) label += ` [${node.format}]`;
    return label;
  };
  
  const treeNode: TreeNode = {
    id: node.key,
    label: getLabel(node),
    icon: getIcon(node.type),
    isExpanded: true,
    secondaryLabel: node.description,
    childNodes: node.children ? node.children.map((child: any) => schemaNodeToTreeNode(child)[0]) : []
  };
  
  return [treeNode];
}

export default SchemaDesignStep;