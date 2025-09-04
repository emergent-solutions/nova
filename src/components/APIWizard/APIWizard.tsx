// src/components/APIWizard/APIWizard.tsx
import React, { useState, useEffect } from 'react';
import {
  DialogStep,
  MultistepDialog,
  Button,
  Intent,
  FormGroup,
  InputGroup,
  Callout,
  Card,
  Toaster
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
import './APIWizard.css';

const toaster = Toaster.create({ position: 'top' });

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
  api_config?: any;
  database_config?: any;
  file_config?: any;
}

export const APIWizard: React.FC<APIWizardProps> = ({
  isOpen,
  mode,
  existingEndpoint,
  onClose,
  onComplete
}) => {
  // Initialize config with existing endpoint data if in edit mode
  const [config, setConfig] = useState<APIEndpointConfig>(() => {
    if (mode === 'edit' && existingEndpoint) {
      return {
        name: existingEndpoint.name || '',
        description: existingEndpoint.description || '',
        slug: existingEndpoint.slug || '',
        dataSources: existingEndpoint.api_endpoint_sources?.map((s: any) => s.data_source) || [],
        relationships: existingEndpoint.relationship_config?.relationships || [],
        outputFormat: existingEndpoint.output_format || 'json',
        outputSchema: existingEndpoint.schema_config?.schema || {
          root: { key: 'root', type: 'object', children: [] },
          version: '1.0.0',
          format: 'json'
        },
        fieldMappings: existingEndpoint.schema_config?.mapping || [],
        transformations: existingEndpoint.transform_config?.transformations || [],
        authentication: existingEndpoint.auth_config || { required: false, type: 'none' },
        caching: existingEndpoint.cache_config || { enabled: false, ttl: 300 },
        rateLimiting: existingEndpoint.rate_limit_config || { enabled: false, requests_per_minute: 60 }
      };
    }
    
    return {
      name: '',
      description: '',
      slug: '',
      dataSources: [],
      relationships: [],
      outputFormat: 'json',
      outputSchema: {
        root: { key: 'root', type: 'object', children: [] },
        version: '1.0.0',
        format: 'json'
      },
      fieldMappings: [],
      transformations: [],
      authentication: { required: false, type: 'none' },
      caching: { enabled: false, ttl: 300 },
      rateLimiting: { enabled: false, requests_per_minute: 60 }
    };
  });

  const [isDeploying, setIsDeploying] = useState(false);
  
  // Always start at basic, we'll change it for edit mode after mount
  const [currentStepId, setCurrentStepId] = useState<string>('basic');
  
  const [existingDataSources, setExistingDataSources] = useState<any[]>([]);
  const [newDataSources, setNewDataSources] = useState<DataSourceConfig[]>([]);
  const [selectedDataSources, setSelectedDataSources] = useState<string[]>(() => {
    if (mode === 'edit' && existingEndpoint?.api_endpoint_sources) {
      return existingEndpoint.api_endpoint_sources.map((s: any) => s.data_source_id);
    }
    return [];
  });

  // Force navigation to deployment step when in edit mode after dialog opens
  useEffect(() => {
    if (isOpen && mode === 'edit') {
      // Use a timeout to ensure the dialog has rendered
      const timer = setTimeout(() => {
        setCurrentStepId('deployment');
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen, mode]);

  // Load existing data sources when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadExistingDataSources();
    }
  }, [isOpen]);

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

  const allDataSources = React.useMemo(() => {
    const selectedExisting = existingDataSources.filter(ds => 
      selectedDataSources.includes(ds.id)
    );
    const validNew = newDataSources.filter(ds => ds.name && ds.type);
    
    return [...selectedExisting, ...validNew];
  }, [existingDataSources, selectedDataSources, newDataSources]);

  useEffect(() => {
    updateConfig({ dataSources: allDataSources });
  }, [allDataSources]);

  const validateDataSources = () => {
    return selectedDataSources.length > 0 || newDataSources.some(ds => ds.name && ds.type);
  };

  const handleDeploy = async () => {
    try {
      setIsDeploying(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('No authenticated user');
      }
      
      if (mode === 'edit' && existingEndpoint) {
        // Update existing endpoint
        const { data, error } = await supabase
          .from('api_endpoints')
          .update({
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
            updated_at: new Date().toISOString()
          })
          .eq('id', existingEndpoint.id)
          .select()
          .single();

        if (error) throw error;
        
        toaster.show({ 
          message: 'Endpoint updated successfully', 
          intent: Intent.SUCCESS 
        });
        
        onComplete(data);
        onClose();
      } else {
        // Create new endpoint
        const createdDataSourceIds: string[] = [];
        
        for (const newDs of newDataSources) {
          if (newDs.name && newDs.type) {
            const { data: createdDs, error } = await supabase
              .from('data_sources')
              .insert({
                name: newDs.name,
                type: newDs.type,
                active: true,
                api_config: newDs.api_config,
                database_config: newDs.database_config,
                file_config: newDs.file_config,
                user_id: user.id
              })
              .select()
              .single();
            
            if (error) throw error;
            if (createdDs) {
              createdDataSourceIds.push(createdDs.id);
            }
          }
        }
        
        const allDataSourceIds = [...selectedDataSources, ...createdDataSourceIds];
        
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
            active: true,
            user_id: user.id
          })
          .select()
          .single();

        if (error) throw error;

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

        toaster.show({ 
          message: 'Endpoint created successfully', 
          intent: Intent.SUCCESS 
        });

        onComplete(data);
        onClose();
      }
    } catch (error) {
      console.error('Failed to deploy endpoint:', error);
      toaster.show({ 
        message: `Failed to ${mode === 'edit' ? 'update' : 'create'} endpoint`, 
        intent: Intent.DANGER 
      });
    } finally {
      setIsDeploying(false);
    }
  };

  const isCurrentStepValid = (): boolean => {
    // In edit mode, all steps are valid since data exists
    if (mode === 'edit') return true;
    
    switch (currentStepId) {
      case 'basic':
        return !!(config.name && config.slug);
      case 'datasources':
        return validateDataSources();
      case 'configure-source':
        return newDataSources.every(ds => ds.name && ds.type);
      default:
        return true;
    }
  };

  // Define the initial step based on mode
  const initialStepId = mode === 'edit' ? 'deployment' : 'basic';

  return (
    <MultistepDialog
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'Create API Endpoint' : `Edit Endpoint: ${config.name}`}
      navigationPosition="left"
      showCloseButtonInFooter={false}
      canEscapeKeyClose={true}
      canOutsideClickClose={false}
      className="api-wizard-dialog"
      initialStepIndex={mode === 'edit' ? 9 : 0} // Set to last step index if editing
      currentStepId={currentStepId}
      onChange={(newStepId) => setCurrentStepId(newStepId)}
      nextButtonProps={{
        disabled: mode === 'create' && !isCurrentStepValid()
      }}
      finalButtonProps={{
        text: mode === 'edit' ? 'Save Changes' : 'Deploy Endpoint',
        intent: Intent.PRIMARY,
        loading: isDeploying,
        onClick: handleDeploy,
        disabled: mode === 'create' && !isCurrentStepValid()
      }}
    >
      <DialogStep
        id="basic"
        title="Basic Info"
        panel={
          <div className="basic-info-step">
            {mode === 'edit' && (
              <Callout intent={Intent.PRIMARY} icon="info-sign" style={{ marginBottom: '20px' }}>
                <strong>Edit Mode:</strong> All steps are now accessible. Navigate using the sidebar or Previous/Next buttons.
              </Callout>
            )}
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
                  Your API will be available at: <code>/api/{config.slug}</code>
                </Callout>
              )}
            </FormGroup>
            
            <FormGroup label="Description">
              <InputGroup
                value={config.description || ''}
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
            availableDataSources={allDataSources}
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
              dataSources: allDataSources
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
            mode={mode}
          />
        }
      />
    </MultistepDialog>
  );
};

export default APIWizard;