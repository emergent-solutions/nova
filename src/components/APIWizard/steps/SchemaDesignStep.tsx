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
  IToastProps
} from '@blueprintjs/core';
import { APIEndpointConfig } from '../../../types/schema.types';
import { SchemaMapper } from '../../SchemaMapper/SchemaMapper';
import { generateAutoSchema } from '../../../utils/schemaHelpers';

interface SchemaDesignStepProps {
  config: APIEndpointConfig;
  onUpdate: (updates: Partial<APIEndpointConfig>) => void;
}

// Create toaster instance for notifications
const toaster = Toaster.create({
  position: Position.TOP
});

const SchemaDesignStep: React.FC<SchemaDesignStepProps> = ({ config, onUpdate }) => {
  // Default to auto mode for better first-time user experience
  const [schemaMode, setSchemaMode] = useState<string>(() => {
    if (config.schemaMode) return config.schemaMode;
    return config.outputSchema?.root && config.outputSchema?.isCustom ? 'custom' : 'auto';
  });
  
  const [importedSchema, setImportedSchema] = useState<any>(null);
  const [manualSchemaText, setManualSchemaText] = useState<string>('');
  const [schemaError, setSchemaError] = useState<string>('');

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
        return generateAutoSchema(config);
    }
  };

  const generateRSSSchema = () => ({
    key: 'rss',
    type: 'object' as const,
    children: [{
      key: 'channel',
      type: 'object' as const,
      required: true,
      children: [
        { key: 'title', type: 'string', required: true },
        { key: 'link', type: 'url', required: true },
        { key: 'description', type: 'string', required: true },
        { key: 'language', type: 'string', required: false },
        { key: 'pubDate', type: 'datetime', format: 'RFC822', required: false },
        {
          key: 'items',
          type: 'array',
          children: [{
            key: 'item',
            type: 'object',
            children: [
              { key: 'title', type: 'string', required: true },
              { key: 'link', type: 'url', required: true },
              { key: 'description', type: 'string', required: false },
              { key: 'pubDate', type: 'datetime', format: 'RFC822', required: false },
              { key: 'guid', type: 'string', required: false }
            ]
          }]
        }
      ]
    }]
  });

  const generateAtomSchema = () => ({
    key: 'feed',
    type: 'object' as const,
    namespace: 'http://www.w3.org/2005/Atom',
    children: [
      { key: 'title', type: 'string', required: true },
      { key: 'id', type: 'uri', required: true },
      { key: 'updated', type: 'datetime', format: 'ISO8601', required: true },
      { key: 'author', type: 'object', children: [{ key: 'name', type: 'string' }] },
      {
        key: 'entries',
        type: 'array',
        children: [{
          key: 'entry',
          type: 'object',
          children: [
            { key: 'title', type: 'string', required: true },
            { key: 'id', type: 'uri', required: true },
            { key: 'updated', type: 'datetime', format: 'ISO8601', required: true },
            { key: 'summary', type: 'string', required: false },
            { key: 'link', type: 'url', required: false }
          ]
        }]
      }
    ]
  });

  const generateCSVSchema = (config: APIEndpointConfig) => ({
    key: 'csv',
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
    // Implementation would analyze data sources to extract column definitions
    return [{ key: 'column1', type: 'string' }];
  };

  const extractFieldsFromDataSources = (dataSources: any[]) => {
    // Implementation would analyze data sources to extract field definitions
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

  const handleSchemaImport = (event: React.FormEvent<HTMLInputElement>) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = file.name.endsWith('.yaml') || file.name.endsWith('.yml')
          ? parseYAML(content) // You'd need a YAML parser library
          : JSON.parse(content);
        
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

  const parseYAML = (content: string) => {
    // Simplified - in production use a proper YAML parser
    throw new Error('YAML parsing not implemented');
  };

  const detectAndConvertSchema = (schema: any): any => {
    // Detect schema type and version
    if (schema.openapi?.startsWith('3.')) {
      return convertOpenAPI3Schema(schema);
    } else if (schema.swagger === '2.0') {
      return convertSwagger2Schema(schema);
    } else if (schema.$schema) {
      return convertJSONSchema(schema);
    }
    
    // Default conversion
    return convertOpenAPISchema(schema);
  };

  const convertOpenAPI3Schema = (openapi: any) => {
    const schemas = openapi.components?.schemas || {};
    const root = {
      key: 'root',
      type: 'object' as const,
      isCustom: true,
      children: Object.keys(schemas).map(key => 
        convertSchemaObject(key, schemas[key])
      )
    };
    return root;
  };

  const convertSwagger2Schema = (swagger: any) => {
    const definitions = swagger.definitions || {};
    const root = {
      key: 'root',
      type: 'object' as const,
      isCustom: true,
      children: Object.keys(definitions).map(key => 
        convertSchemaObject(key, definitions[key])
      )
    };
    return root;
  };

  const convertJSONSchema = (jsonSchema: any) => {
    return convertSchemaObject('root', jsonSchema);
  };

  const convertSchemaObject = (key: string, schema: any): any => {
    const node: any = {
      key,
      type: schema.type || 'object',
      description: schema.description,
      required: schema.required || false
    };

    // Handle different schema types
    if (schema.type === 'object' && schema.properties) {
      node.children = Object.keys(schema.properties).map(prop => 
        convertSchemaObject(prop, schema.properties[prop])
      );
    } else if (schema.type === 'array' && schema.items) {
      node.children = [convertSchemaObject('item', schema.items)];
    } else if (schema.$ref) {
      // Handle references - in production, resolve these properly
      node.ref = schema.$ref;
    } else if (schema.enum) {
      node.enum = schema.enum;
    }

    // Handle format specifications
    if (schema.format) {
      node.format = schema.format;
    }

    return node;
  };

  const convertOpenAPISchema = (openapi: any) => {
    // Fallback conversion
    const schemas = openapi.components?.schemas || openapi.definitions || {};
    const root = {
      key: 'root',
      type: 'object' as const,
      isCustom: true,
      children: Object.keys(schemas).map(key => ({
        key,
        type: schemas[key].type || 'object',
        description: schemas[key].description,
        children: schemas[key].properties ? 
          Object.keys(schemas[key].properties).map(prop => ({
            key: prop,
            type: schemas[key].properties[prop].type || 'string',
            description: schemas[key].properties[prop].description,
            required: schemas[key].required?.includes(prop) || false
          })) : []
      }))
    };
    return root;
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
        Design the structure of your API output. Auto-generation is recommended for most use cases.
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

      <div className="schema-content" style={{ marginTop: '20px' }}>
        {schemaMode === 'auto' && (
          <Card className="auto-schema-preview">
            <h4>Auto-Generated Schema for {config.outputFormat?.toUpperCase() || 'JSON'}</h4>
            {config.outputSchema?.root ? (
              <>
                <Tree
                  contents={schemaNodeToTreeNode(config.outputSchema.root)}
                />
                <div style={{ marginTop: '10px' }}>
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
            <div className="bp4-text-muted" style={{ marginTop: '10px' }}>
              Supports: OpenAPI 3.0, Swagger 2.0, JSON Schema
            </div>
            {importedSchema && (
              <Callout intent={Intent.SUCCESS} style={{ marginTop: '15px' }}>
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

// Enhanced helper function to convert schema nodes to Blueprint Tree nodes
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