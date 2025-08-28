// src/components/APIWizard/APIWizard.tsx
import React, { useState, useEffect } from 'react';
import {
  DialogStep,
  MultistepDialog,
  Button,
  Intent,
  Card,
  FormGroup,
  InputGroup,
  HTMLSelect,
  RadioGroup,
  Radio,
  Icon,
  Callout,
  NonIdealState,
  Tag,
  Classes
} from '@blueprintjs/core';
import { APIEndpointConfig } from '../../types/schema.types';
import DataSourcesStep from './steps/DataSourcesStep';
import DataSourceConfigStep from './steps/DataSourceConfigStep';
import RelationshipsStep from './steps/RelationshipsStep';
import SchemaDesignStep from './steps/SchemaDesignStep';
import OutputFormatStep from './steps/OutputFormatStep';
import TransformationStep from './steps/TransformationStep';
import AuthenticationStep from './steps/AuthenticationStep';
import TestingStep from './steps/TestingStep';
import DeploymentStep from './steps/DeploymentStep';
import { supabase } from '../../lib/supabase';

interface APIWizardProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  existingEndpoint?: any;
  onClose: () => void;
  onComplete: (endpoint: any) => void;
}

interface DataSourceConfig {
  id?: string;
  name: string;
  type: 'api' | 'database' | 'file' | 'rss' | null;
  isNew: boolean;
  // API config
  api_config?: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    auth_type?: string;
    auth_config?: Record<string, any>;
  };
  // Database config
  database_config?: {
    dbType?: string;
    connections?: Record<string, any>;
    queries?: Record<string, any>;
  };
  // File config
  file_config?: {
    source?: string;
    url?: string;
    fileName?: string;
    format?: string;
    headers?: string[];
  };
}

export const APIWizard: React.FC<APIWizardProps> = ({
  isOpen,
  mode,
  existingEndpoint,
  onClose,
  onComplete
}) => {
  const [config, setConfig] = useState<APIEndpointConfig>({
    name: '',
    description: '',
    slug: '',
    dataSources: [],
    relationships: [],
    outputFormat: 'json',
    outputSchema: {
      root: {
        key: 'root',
        type: 'object',
        children: []
      },
      version: '1.0.0',
      format: 'json'
    },
    fieldMappings: [],
    transformations: [],
    authentication: {
      required: false,
      type: 'none'
    },
    caching: {
      enabled: false,
      ttl: 300
    },
    rateLimiting: {
      enabled: false,
      requests_per_minute: 60
    },
    ...existingEndpoint
  });

  const [isDeploying, setIsDeploying] = useState(false);
  const [currentStepId, setCurrentStepId] = useState<string>('basic');
  const [existingDataSources, setExistingDataSources] = useState<any[]>([]);
  const [newDataSources, setNewDataSources] = useState<DataSourceConfig[]>([]);
  const [selectedDataSources, setSelectedDataSources] = useState<string[]>([]);

  // Debug logging
  useEffect(() => {
    console.log('Selected data sources:', selectedDataSources);
  }, [selectedDataSources]);

  // Load existing data sources when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadExistingDataSources();
    }
  }, [isOpen]);

  // Create a computed value for all data sources
  const allDataSources = React.useMemo(() => {
    const selectedExisting = existingDataSources.filter(ds => 
      selectedDataSources.includes(ds.id)
    );
    const validNew = newDataSources.filter(ds => ds.name && ds.type);
    
    return [...selectedExisting, ...validNew];
  }, [existingDataSources, selectedDataSources, newDataSources]);
  
  // Update the config whenever allDataSources changes
  useEffect(() => {
    updateConfig({ dataSources: allDataSources });
  }, [allDataSources]);

  const loadExistingDataSources = async () => {
    try {
      const { data, error } = await supabase
        .from('data_sources')
        .select('*')
        .eq('active', true)
        .order('name');
      
      if (data) {
        setExistingDataSources(data);
      }
    } catch (error) {
      console.error('Failed to load data sources:', error);
    }
  };

  const updateConfig = (updates: Partial<APIEndpointConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const handleAddNewDataSource = () => {
    const newSource: DataSourceConfig = {
      name: '',
      type: null,
      isNew: true
    };
    setNewDataSources(prev => [...prev, newSource]);
  };

  const updateNewDataSource = (index: number, updates: Partial<DataSourceConfig>) => {
    setNewDataSources(prev => prev.map((ds, i) => 
      i === index ? { ...ds, ...updates } : ds
    ));
  };

  const removeNewDataSource = (index: number) => {
    setNewDataSources(prev => prev.filter((_, i) => i !== index));
  };

  const validateDataSources = () => {
    // Check if at least one data source is selected or created
    const hasSelectedExisting = selectedDataSources.length > 0;
    const hasValidNew = newDataSources.length > 0; // Just having new sources is enough at this stage
    
    return hasSelectedExisting || hasValidNew;
  };

  const validateDataSourceConfig = (dataSource: DataSourceConfig): boolean => {
    if (!dataSource.name || !dataSource.type) return false;
    
    switch (dataSource.type) {
      case 'api':
        return !!(dataSource.api_config?.url);
      case 'database':
        // For database, just having the type selected is enough initially
        return !!(dataSource.database_config?.dbType);
      case 'file':
        return !!(dataSource.file_config?.url || dataSource.file_config?.source === 'upload');
      default:
        return true; // For other types, basic info is enough
    }
  };

  const handleDeploy = async () => {
    try {
      setIsDeploying(true);
      
      // First, save any new data sources
      const createdDataSourceIds: string[] = [];
      
      for (const newDs of newDataSources) {
        if (newDs.name && newDs.type && validateDataSourceConfig(newDs)) {
          const { data: createdDs, error } = await supabase
            .from('data_sources')
            .insert({
              name: newDs.name,
              type: newDs.type,
              active: true,
              api_config: newDs.api_config,
              database_config: newDs.database_config,
              file_config: newDs.file_config
            })
            .select()
            .single();
          
          if (error) throw error;
          if (createdDs) {
            createdDataSourceIds.push(createdDs.id);
          }
        }
      }
      
      // Combine selected existing and newly created data source IDs
      const allDataSourceIds = [...selectedDataSources, ...createdDataSourceIds];
      
      // Save the API endpoint
      const { data, error } = await supabase
        .from('api_endpoints')
        .insert({
          name: config.name,
          slug: config.slug,
          description: config.description,
          output_format: config.outputFormat,
          schema_config: {
            type: 'custom',
            schema: config.outputSchema,
            mapping: config.fieldMappings
          },
          transform_config: {
            transformations: config.transformations
          },
          relationship_config: {
            relationships: config.relationships
          },
          auth_config: config.authentication,
          cache_config: config.caching,
          rate_limit_config: config.rateLimiting,
          active: true
        })
        .select()
        .single();

      if (error) throw error;

      // Save data source relationships
      if (data && allDataSourceIds.length > 0) {
        const sourceRelations = allDataSourceIds.map((sourceId, index) => ({
          endpoint_id: data.id,
          data_source_id: sourceId,
          is_primary: index === 0,
          sort_order: index
        }));

        await supabase
          .from('api_endpoint_sources')
          .insert(sourceRelations);
      }

      onComplete(data);
      onClose();
    } catch (error) {
      console.error('Failed to deploy endpoint:', error);
    } finally {
      setIsDeploying(false);
    }
  };

  // Get validation state for current step
  const isCurrentStepValid = (): boolean => {
    switch (currentStepId) {
      case 'basic':
        return !!(config.name && config.slug);
      case 'datasources':
        return validateDataSources();
      case 'configure-source':
        // For configuration step, we just need name and type for each new source
        return newDataSources.every(ds => ds.name && ds.type);
      default:
        return true;
    }
  };

  return (
    <MultistepDialog
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'Create API Endpoint' : 'Edit API Endpoint'}
      navigationPosition="left"
      showCloseButtonInFooter={false}
      canEscapeKeyClose={false}
      canOutsideClickClose={false}
      className="api-wizard-dialog wide-multistep-dialog"
      currentStepId={currentStepId}
      onChange={(newStepId) => setCurrentStepId(newStepId)}
      nextButtonProps={{
        disabled: !isCurrentStepValid()
      }}
      finalButtonProps={{
        text: 'Deploy Endpoint',
        intent: Intent.PRIMARY,
        loading: isDeploying,
        onClick: handleDeploy,
        disabled: !isCurrentStepValid()
      }}
    >
      <DialogStep
        id="basic"
        title="Basic Info"
        panel={
          <div style={{ padding: '20px' }}>
            <FormGroup label="Endpoint Name" labelInfo="(required)">
              <InputGroup
                value={config.name}
                onChange={(e) => updateConfig({ name: e.target.value })}
                placeholder="My API Endpoint"
              />
            </FormGroup>
            
            <FormGroup label="URL Slug" labelInfo="(required)">
              <InputGroup
                value={config.slug}
                onChange={(e) => updateConfig({ slug: e.target.value })}
                placeholder="my-api-endpoint"
                leftIcon="link"
              />
              {config.slug && (
                <Callout intent={Intent.PRIMARY} style={{ marginTop: '10px' }}>
                  Your API will be available at: <code>/api/v1/{config.slug}</code>
                </Callout>
              )}
            </FormGroup>
            
            <FormGroup label="Description">
              <InputGroup
                value={config.description}
                onChange={(e) => updateConfig({ description: e.target.value })}
                placeholder="Describe what this endpoint does..."
              />
            </FormGroup>
          </div>
        }
      />
      
      <DialogStep
        id="datasources"
        title="Data Sources"
        panel={
          <DataSourcesStep
            existingDataSources={existingDataSources}
            newDataSources={newDataSources}
            selectedDataSources={selectedDataSources}
            onSelectExisting={(ids) => setSelectedDataSources(ids)}
            onAddNew={handleAddNewDataSource}
            onUpdateNew={updateNewDataSource}
            onRemoveNew={removeNewDataSource}
          />
        }
      />
      
      {newDataSources.length > 0 && (
        <DialogStep
          id="configure-source"
          title="Configure New Sources"
          panel={
            <DataSourceConfigStep
              dataSources={newDataSources}
              onUpdate={updateNewDataSource}
            />
          }
        />
      )}
      
      <DialogStep
        id="relationships"
        title="Relationships"
        panel={
          <RelationshipsStep
            config={config}
            onUpdate={updateConfig}
            availableDataSources={[
              ...existingDataSources.filter(ds => selectedDataSources.includes(ds.id)),
              ...newDataSources.filter(ds => ds.name && ds.type)
            ]}
          />
        }
      />
      
      <DialogStep
        id="schema"
        title="Output Schema"
        panel={
          <SchemaDesignStep
            config={config}
            onUpdate={updateConfig}
          />
        }
      />
      
      <DialogStep
        id="format"
        title="Output Format"
        panel={
          <OutputFormatStep
            config={{
              ...config,
              dataSources: allDataSources // Ensure it has the latest
            }}
            onUpdate={updateConfig}
          />
        }
      />
      
      <DialogStep
        id="transformations"
        title="Transformations"
        panel={
          <TransformationStep
            config={config}
            onUpdate={updateConfig}
          />
        }
      />
      
      <DialogStep
        id="authentication"
        title="Security"
        panel={
          <AuthenticationStep
            config={config}
            onUpdate={updateConfig}
          />
        }
      />
      
      <DialogStep
        id="testing"
        title="Test"
        panel={
          <TestingStep
            config={config}
            onUpdate={updateConfig}
          />
        }
      />
      
      <DialogStep
        id="deployment"
        title="Deploy"
        panel={
          <DeploymentStep
            config={config}
            onDeploy={handleDeploy}
            isDeploying={isDeploying}
          />
        }
      />
    </MultistepDialog>
  );
};

export default APIWizard;