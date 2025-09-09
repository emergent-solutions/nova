import React, { useState } from 'react';
import {
  Card,
  Button,
  FileInput,
  Callout,
  Intent,
  FormGroup,
  TextArea,
  Divider,
  Tag,
  Collapse,
  Icon,
  Tree,
  TreeNode,
  Position,
  Toaster
} from '@blueprintjs/core';

const AppToaster = Toaster.create({
  position: Position.TOP,
});

interface OpenAPIImportProps {
  onImport: (schema: any, mappingConfig: any) => void;
  onCancel: () => void;
}

export const OpenAPIImport: React.FC<OpenAPIImportProps> = ({ onImport, onCancel }) => {
  const [importedSpec, setImportedSpec] = useState<any>(null);
  const [schemaPreview, setSchemaPreview] = useState<any>(null);
  const [importMethod, setImportMethod] = useState<'file' | 'paste'>('file');
  const [pastedContent, setPastedContent] = useState('');
  const [parseError, setParseError] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);

  const parseOpenAPISpec = (content: string) => {
    try {
      const spec = JSON.parse(content);
      
      // Detect format
      if (spec.openapi && spec.openapi.startsWith('3.')) {
        return parseOpenAPI3(spec);
      } else if (spec.swagger === '2.0') {
        return parseSwagger2(spec);
      } else if (spec.$schema || spec.type) {
        return parseJSONSchema(spec);
      } else {
        throw new Error('Unsupported specification format');
      }
    } catch (error) {
      // Try YAML parsing if JSON fails
      try {
        // You'd need to add a YAML parser library like js-yaml
        // const yaml = require('js-yaml');
        // const spec = yaml.load(content);
        // return parseOpenAPISpec(JSON.stringify(spec));
        throw new Error('YAML parsing not implemented - please provide JSON format');
      } catch (yamlError) {
        throw new Error(`Failed to parse specification: ${error.message}`);
      }
    }
  };

  const parseOpenAPI3 = (spec: any) => {
    const schemas = spec.components?.schemas || {};
    const paths = spec.paths || {};
    
    // Extract response schemas from paths
    const responseSchemas: any[] = [];
    
    Object.entries(paths).forEach(([path, methods]: [string, any]) => {
      Object.entries(methods).forEach(([method, operation]: [string, any]) => {
        if (operation.responses) {
          Object.entries(operation.responses).forEach(([status, response]: [string, any]) => {
            if (response.content?.['application/json']?.schema) {
              responseSchemas.push({
                path,
                method: method.toUpperCase(),
                status,
                schema: response.content['application/json'].schema,
                description: response.description
              });
            }
          });
        }
      });
    });

    return {
      type: 'openapi3',
      info: spec.info,
      schemas,
      responseSchemas,
      servers: spec.servers || []
    };
  };

  const parseSwagger2 = (spec: any) => {
    const definitions = spec.definitions || {};
    const paths = spec.paths || {};
    
    // Extract response schemas
    const responseSchemas: any[] = [];
    
    Object.entries(paths).forEach(([path, methods]: [string, any]) => {
      Object.entries(methods).forEach(([method, operation]: [string, any]) => {
        if (operation.responses) {
          Object.entries(operation.responses).forEach(([status, response]: [string, any]) => {
            if (response.schema) {
              responseSchemas.push({
                path,
                method: method.toUpperCase(),
                status,
                schema: response.schema,
                description: response.description
              });
            }
          });
        }
      });
    });

    return {
      type: 'swagger2',
      info: spec.info,
      schemas: definitions,
      responseSchemas,
      basePath: spec.basePath || '',
      host: spec.host || ''
    };
  };

  const parseJSONSchema = (schema: any) => {
    return {
      type: 'jsonschema',
      schema,
      info: {
        title: schema.title || 'Imported Schema',
        version: schema.version || '1.0.0'
      }
    };
  };

  const convertToInternalSchema = (spec: any) => {
    let rootSchema: any = {
      key: 'root',
      type: 'object',
      children: []
    };

    if (spec.type === 'jsonschema') {
      rootSchema = convertJSONSchemaToInternal(spec.schema);
    } else if (spec.responseSchemas && spec.responseSchemas.length > 0) {
      // Use the first 200 response schema as default
      const defaultResponse = spec.responseSchemas.find(r => r.status === '200') || spec.responseSchemas[0];
      rootSchema = resolveSchemaRef(defaultResponse.schema, spec.schemas);
    }

    return rootSchema;
  };

  const convertJSONSchemaToInternal = (schema: any, key: string = 'root'): any => {
    const internalSchema: any = {
      key,
      type: schema.type || 'object',
      description: schema.description
    };

    if (schema.type === 'object' && schema.properties) {
      internalSchema.children = Object.entries(schema.properties).map(([propKey, propSchema]: [string, any]) => {
        return convertJSONSchemaToInternal(propSchema, propKey);
      });
    } else if (schema.type === 'array' && schema.items) {
      internalSchema.children = [convertJSONSchemaToInternal(schema.items, 'item')];
    }

    if (schema.required && Array.isArray(schema.required)) {
      schema.required.forEach((reqField: string) => {
        const child = internalSchema.children?.find((c: any) => c.key === reqField);
        if (child) child.required = true;
      });
    }

    return internalSchema;
  };

  const resolveSchemaRef = (schema: any, definitions: any): any => {
    if (schema.$ref) {
      const refPath = schema.$ref.replace('#/components/schemas/', '').replace('#/definitions/', '');
      const resolved = definitions[refPath];
      if (resolved) {
        return convertJSONSchemaToInternal(resolved);
      }
    }
    return convertJSONSchemaToInternal(schema);
  };

  const handleFileImport = (event: React.FormEvent<HTMLInputElement>) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      handleImportContent(content);
    };
    reader.readAsText(file);
  };

  const handlePasteImport = () => {
    if (!pastedContent.trim()) {
      setParseError('Please paste a valid OpenAPI/Swagger specification');
      return;
    }
    handleImportContent(pastedContent);
  };

  const handleImportContent = (content: string) => {
    try {
      setParseError('');
      const parsed = parseOpenAPISpec(content);
      setImportedSpec(parsed);
      
      const internalSchema = convertToInternalSchema(parsed);
      setSchemaPreview(internalSchema);
      setShowPreview(true);
      
      AppToaster.show({
        message: `Successfully imported ${parsed.info?.title || 'schema'}`,
        intent: Intent.SUCCESS
      });
    } catch (error) {
      setParseError(error.message);
      AppToaster.show({
        message: `Import failed: ${error.message}`,
        intent: Intent.DANGER
      });
    }
  };

  const handleConfirmImport = () => {
    if (schemaPreview) {
      // Generate mapping configuration
      const mappingConfig = {
        mode: 'openapi',
        sourceSpec: importedSpec,
        autoMapFields: true
      };
      
      onImport(schemaPreview, mappingConfig);
    }
  };

  const renderSchemaTree = (node: any): TreeNode => {
    return {
      id: node.key,
      label: (
        <span>
          <strong>{node.key}</strong>
          <Tag minimal style={{ marginLeft: 8 }}>{node.type}</Tag>
          {node.required && <Tag minimal intent={Intent.DANGER}>required</Tag>}
        </span>
      ),
      icon: node.type === 'object' ? 'folder-close' : 'document',
      isExpanded: true,
      childNodes: node.children?.map(renderSchemaTree) || []
    };
  };

  return (
    <Card style={{ padding: 20 }}>
      <h3>Import OpenAPI/Swagger Specification</h3>
      
      <FormGroup label="Import Method">
        <div style={{ display: 'flex', gap: 10, marginBottom: 15 }}>
          <Button
            active={importMethod === 'file'}
            onClick={() => setImportMethod('file')}
            icon="document"
          >
            Upload File
          </Button>
          <Button
            active={importMethod === 'paste'}
            onClick={() => setImportMethod('paste')}
            icon="clipboard"
          >
            Paste JSON/YAML
          </Button>
        </div>
      </FormGroup>

      {importMethod === 'file' ? (
        <FileInput
          text={importedSpec ? `Imported: ${importedSpec.info?.title}` : "Choose file..."}
          hasSelection={!!importedSpec}
          onInputChange={handleFileImport}
          inputProps={{
            accept: '.json,.yaml,.yml'
          }}
          fill
        />
      ) : (
        <>
          <FormGroup
            label="Paste Specification"
            helperText="Paste your OpenAPI 3.0, Swagger 2.0, or JSON Schema"
            intent={parseError ? Intent.DANGER : Intent.NONE}
          >
            <TextArea
              large
              fill
              rows={10}
              value={pastedContent}
              onChange={(e) => setPastedContent(e.target.value)}
              placeholder={`{
  "openapi": "3.0.0",
  "info": { "title": "My API", "version": "1.0.0" },
  "paths": { ... },
  "components": { "schemas": { ... } }
}`}
            />
          </FormGroup>
          <Button
            intent={Intent.PRIMARY}
            onClick={handlePasteImport}
            disabled={!pastedContent.trim()}
          >
            Parse Specification
          </Button>
        </>
      )}

      {parseError && (
        <Callout intent={Intent.DANGER} style={{ marginTop: 15 }}>
          {parseError}
        </Callout>
      )}

      {importedSpec && (
        <>
          <Divider style={{ margin: '20px 0' }} />
          
          <Callout intent={Intent.SUCCESS} icon="tick-circle">
            <h4>{importedSpec.info?.title || 'Schema'}</h4>
            <p>{importedSpec.info?.description}</p>
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <Tag>Version: {importedSpec.info?.version || '1.0.0'}</Tag>
              <Tag intent={Intent.PRIMARY}>Type: {importedSpec.type.toUpperCase()}</Tag>
              {importedSpec.responseSchemas && (
                <Tag intent={Intent.SUCCESS}>
                  {importedSpec.responseSchemas.length} endpoints found
                </Tag>
              )}
            </div>
          </Callout>

          <Button
            icon={showPreview ? "chevron-up" : "chevron-down"}
            minimal
            onClick={() => setShowPreview(!showPreview)}
            style={{ marginTop: 15 }}
          >
            {showPreview ? 'Hide' : 'Show'} Schema Preview
          </Button>

          <Collapse isOpen={showPreview}>
            <Card style={{ marginTop: 10, maxHeight: 400, overflowY: 'auto' }}>
              {schemaPreview && (
                <Tree contents={[renderSchemaTree(schemaPreview)]} />
              )}
            </Card>
          </Collapse>

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <Button
              intent={Intent.PRIMARY}
              icon="import"
              onClick={handleConfirmImport}
            >
              Use This Schema
            </Button>
            <Button onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </>
      )}
    </Card>
  );
};