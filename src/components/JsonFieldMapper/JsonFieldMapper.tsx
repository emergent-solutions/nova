import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Button,
  Intent,
  Tabs,
  Tab,
  Callout,
  Classes,
  FormGroup,
  InputGroup,
  Switch,
  Icon,
  Tag
} from '@blueprintjs/core';

// Types
import { 
  JsonMappingConfig, 
  JsonFieldMapping,
  JsonFieldMapperProps
} from '../../types/jsonMapping.types';

// Sub-components
import { SourceSelector } from './components/SourceSelector';
import { OutputTemplateBuilder } from './components/OutputTemplateBuilder';
import { FieldMappingCanvas } from './components/FieldMappingCanvas';
import { MappingPreview } from './components/MappingPreview';

// Hooks
import { useMappingEngine } from './hooks/useMappingEngine';

// Styles
import './JsonFieldMapper.css';

export const JsonFieldMapper: React.FC<JsonFieldMapperProps> = ({
  dataSources,
  sampleData = {},
  initialConfig,
  onChange,
  onTest
}) => {
  const [activeTab, setActiveTab] = useState<string>('source');
  const [config, setConfig] = useState<JsonMappingConfig>(
    initialConfig || {
      sourceSelection: {
        type: 'object',
        primaryPath: '',
        sources: []
      },
      outputTemplate: {
        structure: {},
        fields: []
      },
      fieldMappings: [],
      transformations: [],
      outputWrapper: {
        enabled: false,
        wrapperKey: 'data',
        includeMetadata: false,
        metadataFields: {
          timestamp: true,
          source: true,
          count: true,
          version: false
        },
        customMetadata: {}
      }
    }
  );

  const { 
    processMapping, 
    validateMapping, 
    generatePreview 
  } = useMappingEngine(config, sampleData);

  const updateConfigAndNotify = useCallback((updates: Partial<JsonMappingConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    onChange(newConfig); // Only call onChange when user makes explicit changes
  }, [config, onChange]);

  const updateSourceSelection = (selection: any) => {
    const newConfig = {
      ...config,
      sourceSelection: selection
    };
    setConfig(newConfig);
    // Only notify parent when user completes source selection (moving to next step)
    // Don't notify on every intermediate change
  };

  const updateOutputTemplate = (template: any) => {
    const newConfig = {
      ...config,
      outputTemplate: template
    };
    setConfig(newConfig);
    // Don't notify on every field addition/change
  };

  const updateFieldMappings = (mappings: JsonFieldMapping[]) => {
    const newConfig = {
      ...config,
      fieldMappings: mappings
    };
    setConfig(newConfig);
    // Don't notify on every drag and drop
  };

  const updateOutputWrapper = (wrapper: any) => {
    const newConfig = {
      ...config,
      outputWrapper: wrapper
    };
    setConfig(newConfig);
  };

  const handleNextStep = () => {
    const tabs = ['source', 'template', 'mapping', 'preview'];
    const currentIndex = tabs.indexOf(activeTab);
    if (currentIndex < tabs.length - 1) {
      setActiveTab(tabs[currentIndex + 1]);
      
      // Notify parent only when moving between major steps
      if (currentIndex === 2) { // Moving from mapping to preview
        onChange(config); // Save the configuration when user completes mapping
      }
    }
  };

  const handlePreviousStep = () => {
    const tabs = ['source', 'template', 'mapping', 'preview'];
    const currentIndex = tabs.indexOf(activeTab);
    if (currentIndex > 0) {
      setActiveTab(tabs[currentIndex - 1]);
    }
  };

  return (
    <div className="json-field-mapper">
      <Card className="mapper-header">
        <h3>JSON Field Mapping Configuration</h3>
        <p className={Classes.TEXT_MUTED}>
          Configure how your data sources map to the JSON output structure
        </p>
      </Card>

      {/* Output Wrapper Configuration */}
      <Card style={{ marginBottom: 20 }}>
        <h4>Output Configuration</h4>
        
        <FormGroup>
          <Switch
            checked={config.outputWrapper?.enabled || false}
            onChange={(e) => updateOutputWrapper({
              ...config.outputWrapper,
              enabled: e.target.checked
            })}
            label="Wrap output in container object"
            large
          />
        </FormGroup>

        {config.outputWrapper?.enabled && (
          <>
            <FormGroup 
              label="Wrapper Key" 
              helperText="The key that will contain your mapped data"
            >
              <InputGroup
                value={config.outputWrapper.wrapperKey || 'data'}
                onChange={(e) => updateOutputWrapper({
                  ...config.outputWrapper,
                  wrapperKey: e.target.value || 'data'
                })}
                placeholder="e.g., data, results, items"
              />
            </FormGroup>

            <FormGroup>
              <Switch
                checked={config.outputWrapper.includeMetadata || false}
                onChange={(e) => updateOutputWrapper({
                  ...config.outputWrapper,
                  includeMetadata: e.target.checked
                })}
                label="Include metadata in wrapper"
              />
            </FormGroup>

            {config.outputWrapper.includeMetadata && (
              <Card style={{ marginLeft: 20, backgroundColor: '#f5f8fa' }}>
                <h5>Metadata Fields</h5>
                
                <Switch
                  checked={config.outputWrapper.metadataFields?.timestamp !== false}
                  onChange={(e) => updateOutputWrapper({
                    ...config.outputWrapper,
                    metadataFields: {
                      ...config.outputWrapper.metadataFields,
                      timestamp: e.target.checked
                    }
                  })}
                  label="Include timestamp"
                  inline
                  style={{ marginRight: 20 }}
                />
                
                <Switch
                  checked={config.outputWrapper.metadataFields?.source !== false}
                  onChange={(e) => updateOutputWrapper({
                    ...config.outputWrapper,
                    metadataFields: {
                      ...config.outputWrapper.metadataFields,
                      source: e.target.checked
                    }
                  })}
                  label="Include source info"
                  inline
                  style={{ marginRight: 20 }}
                />
                
                <Switch
                  checked={config.outputWrapper.metadataFields?.count !== false}
                  onChange={(e) => updateOutputWrapper({
                    ...config.outputWrapper,
                    metadataFields: {
                      ...config.outputWrapper.metadataFields,
                      count: e.target.checked
                    }
                  })}
                  label="Include item count"
                  inline
                  style={{ marginRight: 20 }}
                />
                
                <Switch
                  checked={config.outputWrapper.metadataFields?.version || false}
                  onChange={(e) => updateOutputWrapper({
                    ...config.outputWrapper,
                    metadataFields: {
                      ...config.outputWrapper.metadataFields,
                      version: e.target.checked
                    }
                  })}
                  label="Include API version"
                  inline
                />
              </Card>
            )}

            {/* Preview of wrapper structure */}
            <Card style={{ marginTop: 15, backgroundColor: '#1e2127', color: '#abb2bf' }}>
              <h5 style={{ color: '#61afef', margin: '0 0 10px 0' }}>Output Structure Preview</h5>
              <pre style={{ margin: 0, fontSize: 12 }}>
{`{
${config.outputWrapper.includeMetadata ? `  "metadata": {
${config.outputWrapper.metadataFields?.timestamp !== false ? '    "timestamp": "2024-01-01T00:00:00Z",\n' : ''}${config.outputWrapper.metadataFields?.source !== false ? '    "source": { "id": "...", "name": "..." },\n' : ''}${config.outputWrapper.metadataFields?.count !== false ? '    "count": 10,\n' : ''}${config.outputWrapper.metadataFields?.version ? '    "version": "1.0.0",\n' : ''}  },
` : ''}  "${config.outputWrapper.wrapperKey || 'data'}": ${config.sourceSelection.type === 'array' ? '[' : '{'}
    // Your mapped fields here
  ${config.sourceSelection.type === 'array' ? ']' : '}'}
}`}
              </pre>
            </Card>
          </>
        )}
      </Card>

      <Tabs
        id="json-mapper-tabs"
        selectedTabId={activeTab}
        onChange={(newTab: string) => setActiveTab(newTab)}
        large
      >
        <Tab
          id="source"
          title="1. Select Source"
          panel={
            <SourceSelector
              dataSources={dataSources}
              sampleData={sampleData}
              selection={config.sourceSelection}
              onChange={updateSourceSelection}
              onNext={handleNextStep}
            />
          }
        />
        
        <Tab
          id="template"
          title="2. Define Output"
          disabled={!config.sourceSelection.primaryPath}
          panel={
            <OutputTemplateBuilder
              template={config.outputTemplate}
              sourceSelection={config.sourceSelection}
              sampleData={sampleData}
              onChange={updateOutputTemplate}
              onNext={handleNextStep}
              onPrevious={handlePreviousStep}
            />
          }
        />
        
        <Tab
          id="mapping"
          title="3. Map Fields"
          disabled={!config.outputTemplate.fields.length}
          panel={
            <FieldMappingCanvas
              sourceSelection={config.sourceSelection}
              outputTemplate={config.outputTemplate}
              mappings={config.fieldMappings}
              transformations={config.transformations}
              sampleData={sampleData}
              onChange={updateFieldMappings}
              onNext={handleNextStep}
              onPrevious={handlePreviousStep}
            />
          }
        />
        
        <Tab
          id="preview"
          title="4. Preview & Test"
          disabled={!config.fieldMappings.length}
          panel={
            <MappingPreview
              config={config}
              sampleData={sampleData}
              onTest={onTest}
              onPrevious={handlePreviousStep}
            />
          }
        />
      </Tabs>

      <div style={{ marginTop: 20, textAlign: 'right' }}>
        <Button
          intent={Intent.PRIMARY}
          icon="floppy-disk"
          text="Save Configuration"
          onClick={() => onChange(config)}
        />
      </div>
    </div>
  );
};

export default JsonFieldMapper;