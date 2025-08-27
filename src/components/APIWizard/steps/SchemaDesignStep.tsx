import React, { useState } from 'react';
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
  Card
} from '@blueprintjs/core';
import { APIEndpointConfig } from '../../../types/schema.types';
import { SchemaMapper } from '../../SchemaMapper/SchemaMapper';
import { generateAutoSchema } from '../../../utils/schemaHelpers';

interface SchemaDesignStepProps {
  config: APIEndpointConfig;
  onUpdate: (updates: Partial<APIEndpointConfig>) => void;
}

const SchemaDesignStep: React.FC<SchemaDesignStepProps> = ({ config, onUpdate }) => {
  const [schemaMode, setSchemaMode] = useState(
    config.outputSchema?.root ? 'custom' : 'auto'
  );
  const [importedSchema, setImportedSchema] = useState<any>(null);

  const handleSchemaModeChange = (mode: string) => {
    setSchemaMode(mode);
    
    if (mode === 'auto') {
      const autoSchema = generateAutoSchema(config);
      onUpdate({
        outputSchema: {
          root: autoSchema,
          version: '1.0.0',
          format: config.outputFormat || 'json'
        }
      });
    }
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
        
        // Convert OpenAPI/Swagger to our schema format
        const convertedSchema = convertOpenAPISchema(parsed);
        onUpdate({
          outputSchema: {
            root: convertedSchema,
            version: parsed.info?.version || '1.0.0',
            format: config.outputFormat || 'json'
          }
        });
      } catch (error) {
        console.error('Failed to parse schema file:', error);
      }
    };
    reader.readAsText(file);
  };

  const convertOpenAPISchema = (openapi: any) => {
    // Simple conversion - in production, this would be more sophisticated
    const schemas = openapi.components?.schemas || {};
    const root = {
      key: 'root',
      type: 'object' as const,
      children: Object.keys(schemas).map(key => ({
        key,
        type: schemas[key].type || 'object',
        description: schemas[key].description,
        children: schemas[key].properties ? 
          Object.keys(schemas[key].properties).map(prop => ({
            key: prop,
            type: schemas[key].properties[prop].type || 'string',
            description: schemas[key].properties[prop].description
          })) : []
      }))
    };
    return root;
  };

  return (
    <div className="schema-design-step">
      <Callout intent={Intent.PRIMARY} icon="info-sign">
        Design the structure of your API output. You can auto-generate from your data sources,
        create a custom schema, or import from OpenAPI/Swagger.
      </Callout>

      <RadioGroup
        label="Schema Design Mode"
        selectedValue={schemaMode}
        onChange={(e) => handleSchemaModeChange(e.target.value)}
      >
        <Radio 
          label="Auto-generate from data sources" 
          value="auto"
          description="Automatically create a schema based on your selected data sources"
        />
        <Radio 
          label="Custom schema design" 
          value="custom"
          description="Manually design your output schema with full control"
        />
        <Radio 
          label="Import from OpenAPI/Swagger" 
          value="import"
          description="Import an existing API specification"
        />
      </RadioGroup>

      <div className="schema-content">
        {schemaMode === 'auto' && (
          <Card className="auto-schema-preview">
            <h4>Auto-Generated Schema</h4>
            {config.outputSchema?.root ? (
              <Tree
                contents={schemaNodeToTreeNode(config.outputSchema.root)}
              />
            ) : (
              <NonIdealState
                icon="automatic-updates"
                title="Generating schema..."
                description="Schema will be generated based on your data sources"
              />
            )}
            <Button
              icon="refresh"
              text="Regenerate"
              onClick={() => handleSchemaModeChange('auto')}
            />
          </Card>
        )}

        {schemaMode === 'custom' && (
          <div className="custom-schema-designer">
            {config.dataSources.length > 0 ? (
              <SchemaMapper
                sources={config.dataSources}
                targetSchema={config.outputSchema?.root || generateAutoSchema(config)}
                mappings={config.fieldMappings || []}
                onChange={(mappings) => onUpdate({ fieldMappings: mappings })}
              />
            ) : (
              <NonIdealState
                icon="tree"
                title="No data sources"
                description="Add data sources first to start mapping fields"
              />
            )}
          </div>
        )}

        {schemaMode === 'import' && (
          <Card className="import-schema">
            <h4>Import OpenAPI/Swagger Schema</h4>
            <FileInput
              text="Choose file..."
              hasSelection={!!importedSchema}
              onInputChange={handleSchemaImport}
              inputProps={{
                accept: '.json,.yaml,.yml'
              }}
            />
            {importedSchema && (
              <div className="imported-info">
                <Callout intent={Intent.SUCCESS}>
                  Successfully imported schema: {importedSchema.info?.title || 'Untitled'}
                </Callout>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
};

// Helper function to convert schema nodes to Blueprint Tree nodes
function schemaNodeToTreeNode(node: any): TreeNode[] {
  if (!node) return [];
  
  const treeNode: TreeNode = {
    id: node.key,
    label: `${node.key} (${node.type})`,
    icon: node.type === 'object' ? 'folder-close' : 'document',
    isExpanded: true,
    childNodes: node.children ? node.children.map((child: any) => schemaNodeToTreeNode(child)[0]) : []
  };
  
  return [treeNode];
}

export default SchemaDesignStep;