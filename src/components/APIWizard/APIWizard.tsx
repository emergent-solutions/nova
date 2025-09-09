// src/components/APIWizard/APIWizard.tsx
import React, { useState, useEffect, useMemo } from 'react';
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
  category?: string;
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
      console.log('Loading existing endpoint:', existingEndpoint);
      
      // Extract all data sources that are connected to this endpoint
      const connectedDataSources = existingEndpoint.api_endpoint_sources?.map((s: any) => s.data_source) || [];
      
      // Extract metadata from schema_config
      const schemaConfig = existingEndpoint.schema_config || {};
      const metadata = schemaConfig.schema?.metadata || {};
      
      // For RSS endpoints, the sourceMappings are in metadata
      const outputSchema = {
        ...(schemaConfig.schema || {}),
        metadata: {
          ...metadata,
          // Preserve RSS multi-source mappings
          sourceMappings: metadata.sourceMappings || [],
          // Preserve other format-specific settings
          channelTitle: metadata.channelTitle,
          channelDescription: metadata.channelDescription,
          channelLink: metadata.channelLink,
          titleField: metadata.titleField,
          descriptionField: metadata.descriptionField,
          linkField: metadata.linkField,
          pubDateField: metadata.pubDateField,
          mergeStrategy: metadata.mergeStrategy,
          maxItemsPerSource: metadata.maxItemsPerSource,
          maxTotalItems: metadata.maxTotalItems,
          // JSON settings
          prettyPrint: metadata.prettyPrint,
          includeMetadata: metadata.includeMetadata,
          wrapResponse: metadata.wrapResponse,
          rootElement: metadata.rootElement,
          jsonMappingConfig: metadata.jsonMappingConfig,
          // Any other format options
          ...metadata
        }
      };
      
      console.log('Loaded schema config:', schemaConfig);
      console.log('Loaded metadata:', metadata);
      console.log('Loaded field mappings:', schemaConfig.mapping);
      
      return {
        name: existingEndpoint.name || '',
        description: existingEndpoint.description || '',
        slug: existingEndpoint.slug || '',
        dataSources: connectedDataSources,
        relationships: existingEndpoint.relationship_config?.relationships || [],
        outputFormat: existingEndpoint.output_format || 'json',
        outputSchema: outputSchema,
        fieldMappings: schemaConfig.mapping || [], // Load the field mappings
        transformations: existingEndpoint.transform_config?.transformations || [],
        authentication: existingEndpoint.auth_config || { required: false, type: 'none' },
        caching: existingEndpoint.cache_config || { enabled: false, ttl: 300 },
        rateLimiting: existingEndpoint.rate_limit_config || { enabled: false, requests_per_minute: 60 }
      };
    }
    
    // Default empty config for create mode
    return {
      name: '',
      description: '',
      slug: '',
      dataSources: [],
      relationships: [],
      outputFormat: 'json',
      jsonMappingConfig: {
        sourceSelection: {
          mergeMode: 'separate'
        }
      },
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
  const [currentStepId, setCurrentStepId] = useState<string>('basic');  
  const [existingDataSources, setExistingDataSources] = useState<any[]>([]);
  const [newDataSources, setNewDataSources] = useState<DataSourceConfig[]>([]);
  const [selectedDataSources, setSelectedDataSources] = useState<string[]>(() => {
    if (mode === 'edit' && existingEndpoint) {
      // Get all source IDs from both api_endpoint_sources AND sourceMappings
      const endpointSourceIds = existingEndpoint.api_endpoint_sources?.map((s: any) => s.data_source_id) || [];
      
      // Also check if there are sources in the RSS configuration
      const rssSourceIds = existingEndpoint.schema_config?.schema?.metadata?.sourceMappings
        ?.filter(m => m.enabled)
        ?.map(m => m.sourceId) || [];
      
      // Combine and deduplicate
      const allSourceIds = [...new Set([...endpointSourceIds, ...rssSourceIds])];
      
      return allSourceIds;
    }
    return [];
  });
  const [isSavingDataSources, setIsSavingDataSources] = useState(false);
  const [pendingStepChange, setPendingStepChange] = useState<string | null>(null);
  const [autoDraftId, setAutoDraftId] = useState<string | null>(null);


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

  const saveAllNewDataSources = async (): Promise<boolean> => {
    const unsavedDataSources = newDataSources.filter(ds => !ds.id && ds.name && ds.type);
    
    if (unsavedDataSources.length === 0) {
      return true; // Nothing to save
    }
  
    setIsSavingDataSources(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }
  
      // Save all unsaved data sources
      for (let i = 0; i < newDataSources.length; i++) {
        const source = newDataSources[i];
        
        // Skip if already saved or incomplete
        if (source.id || !source.name || !source.type) {
          continue;
        }
  
        // Validate based on type
        if (source.type === 'api' && !source.api_config?.url) {
          toaster.show({
            message: `Data source "${source.name}" is missing required API URL`,
            intent: Intent.WARNING
          });
          setIsSavingDataSources(false);
          return false;
        }
  
        if (source.type === 'rss' && !source.rss_config?.feed_url) {
          toaster.show({
            message: `Data source "${source.name}" is missing required RSS feed URL`,
            intent: Intent.WARNING
          });
          setIsSavingDataSources(false);
          return false;
        }
  
        if (source.type === 'file' && !source.file_config?.url) {
          toaster.show({
            message: `Data source "${source.name}" is missing required file URL`,
            intent: Intent.WARNING
          });
          setIsSavingDataSources(false);
          return false;
        }
  
        const dataSourceData = {
          name: source.name,
          type: source.type,
          category: source.category,
          active: true,
          api_config: source.type === 'api' ? source.api_config : null,
          database_config: source.type === 'database' ? source.database_config : null,
          file_config: source.type === 'file' ? source.file_config : null,
          rss_config: source.type === 'rss' ? source.rss_config : null,
          user_id: user.id
        };
  
        const { data, error } = await supabase
          .from('data_sources')
          .insert(dataSourceData)
          .select()
          .single();
        
        if (error) {
          throw new Error(`Failed to save ${source.name}: ${error.message}`);
        }
  
        // Update the data source with the saved ID
        updateNewDataSource(i, {
          ...source,
          id: data.id,
          isNew: false
        });
      }
  
      toaster.show({
        message: `Successfully saved ${unsavedDataSources.length} data source(s)`,
        intent: Intent.SUCCESS
      });
  
      setIsSavingDataSources(false);
      return true;
      
    } catch (error: any) {
      console.error('Error saving data sources:', error);
      toaster.show({
        message: `Failed to save data sources: ${error.message}`,
        intent: Intent.DANGER
      });
      setIsSavingDataSources(false);
      return false;
    }
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

  const allDataSources = useMemo(() => {
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

  const sampleData = useMemo(() => {
    const result = {};
    allDataSources.forEach(source => {
      if (source.api_config?.sample_response) {
        result[source.id] = source.api_config.sample_response;
      }
    });
    return result;
  }, [allDataSources]);

  const handleAutoDraftCreated = (draftId: string | null) => {
    setAutoDraftId(draftId);
  };  

  const handleDeploy = async () => {
    try {
      setIsDeploying(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('No authenticated user');
      }

      // Ensure outputSchema includes all the RSS configuration
      const schemaConfig = {
        type: 'custom',
        schema: {
          ...config.outputSchema,
          metadata: {
            ...config.outputSchema?.metadata,
            jsonMappingConfig: {
              ...config.outputSchema?.metadata?.jsonMappingConfig,
              sourceSelection: {
                ...config.outputSchema?.metadata?.jsonMappingConfig?.sourceSelection,
                mergeMode: config.outputSchema?.metadata?.jsonMappingConfig?.sourceSelection?.mergeMode || 'separate'
              }
            },
            // Ensure RSS mappings are preserved
            sourceMappings: config.outputSchema?.metadata?.sourceMappings || [],
            // Preserve all other metadata
            ...config.outputSchema?.metadata
          }
        },
        mapping: config.fieldMappings || [] 
      };

      console.log('Saving with schema config:', schemaConfig);
      
      // Check if we're updating an auto-draft or existing endpoint
      const endpointToUpdate = autoDraftId ? 
        { id: autoDraftId, isAutoDraft: true } : 
        (mode === 'edit' && existingEndpoint ? existingEndpoint : null);
      
      if (endpointToUpdate) {
        // Update existing endpoint or convert auto-draft to final
        const updateData = {
          name: config.name,
          slug: config.slug,
          description: config.description,
          output_format: config.outputFormat,
          schema_config: schemaConfig,
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
          is_draft: false, // Convert draft to final if it was an auto-draft
          updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
          .from('api_endpoints')
          .update(updateData)
          .eq('id', endpointToUpdate.id)
          .select()
          .single();

        if (error) throw error;
        
        // Clear auto-draft ID if we just converted it
        if (endpointToUpdate.isAutoDraft) {
          setAutoDraftId(null);
        }
        
        // Handle data source updates for RSS multi-source
        if (config.outputFormat === 'rss' && config.outputSchema?.metadata?.sourceMappings) {
          const sourceMappings = config.outputSchema.metadata.sourceMappings;
          const enabledSources = sourceMappings.filter(m => m.enabled);
          
          // First, get current sources
          const { data: currentSources } = await supabase
            .from('api_endpoint_sources')
            .select('*')
            .eq('endpoint_id', endpointToUpdate.id);
          
          // Delete removed sources
          const currentSourceIds = currentSources?.map(s => s.data_source_id) || [];
          const newSourceIds = enabledSources.map(s => s.sourceId);
          const toDelete = currentSourceIds.filter(id => !newSourceIds.includes(id));
          
          if (toDelete.length > 0) {
            await supabase
              .from('api_endpoint_sources')
              .delete()
              .eq('endpoint_id', endpointToUpdate.id)
              .in('data_source_id', toDelete);
          }
          
          // Add new sources
          const toAdd = newSourceIds.filter(id => !currentSourceIds.includes(id));
          if (toAdd.length > 0) {
            const newRelations = toAdd.map((sourceId, index) => ({
              endpoint_id: endpointToUpdate.id,
              data_source_id: sourceId,
              is_primary: false,
              sort_order: currentSources?.length + index || index
            }));
            
            await supabase
              .from('api_endpoint_sources')
              .insert(newRelations);
          }
        } else if (!endpointToUpdate.isAutoDraft) {
          // For non-RSS endpoints that aren't auto-drafts, update data sources normally
          // (Auto-drafts don't have data sources yet)
          
          // Your existing data source update logic here...
        }
        
        // If this was an auto-draft, now link the data sources
        if (endpointToUpdate.isAutoDraft) {
          const createdDataSourceIds: string[] = [];
          
          // Create new data sources
          for (const newDs of newDataSources) {
            if (newDs.name && newDs.type && !newDs.id) {
              const { data: existing } = await supabase
                .from('data_sources')
                .select('id')
                .eq('name', newDs.name)
                .eq('user_id', user.id)
                .single();
              
              if (existing) {
                createdDataSourceIds.push(existing.id);
              } else {
                const { data: createdDs, error } = await supabase
                  .from('data_sources')
                  .insert({
                    name: newDs.name,
                    type: newDs.type,
                    category: newDs.category,
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
                  newDs.id = createdDs.id;
                }
              }
            } else if (newDs.id) {
              createdDataSourceIds.push(newDs.id);
            }
          }

          const allDataSourceIds = [...selectedDataSources, ...createdDataSourceIds];
          
          if (allDataSourceIds.length > 0) {
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
        }
        
        toaster.show({ 
          message: endpointToUpdate.isAutoDraft ? 
            'Endpoint deployed successfully' : 
            'Endpoint updated successfully', 
          intent: Intent.SUCCESS 
        });
        
        onComplete(data);
        onClose();
      } else {
        // Create brand new endpoint (no auto-draft exists)
        const createdDataSourceIds: string[] = [];
        
        // Your existing data source creation logic...
        for (const newDs of newDataSources) {
          if (newDs.name && newDs.type && !newDs.id) {
            const { data: existing } = await supabase
              .from('data_sources')
              .select('id')
              .eq('name', newDs.name)
              .eq('user_id', user.id)
              .single();
            
            if (existing) {
              createdDataSourceIds.push(existing.id);
              console.log(`Using existing data source: ${newDs.name}`);
            } else {
              const { data: createdDs, error } = await supabase
                .from('data_sources')
                .insert({
                  name: newDs.name,
                  type: newDs.type,
                  category: newDs.category,
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
                newDs.id = createdDs.id;
              }
            }
          } else if (newDs.id) {
            createdDataSourceIds.push(newDs.id);
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
            schema_config: schemaConfig,
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
            is_draft: false, // Explicitly not a draft
            user_id: user.id
          })
          .select()
          .single();

        if (error) throw error;

        // Link data sources
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

          // Handle RSS multi-source special case
          if (config.outputFormat === 'rss' && config.outputSchema?.metadata?.sourceMappings) {
            const sourceMappings = config.outputSchema.metadata.sourceMappings;
            const enabledRssSources = sourceMappings.filter(m => m.enabled);
            
            const rssSourceIds = enabledRssSources.map(s => s.sourceId);
            const additionalSources = rssSourceIds.filter(id => !allDataSourceIds.includes(id));
            
            if (additionalSources.length > 0) {
              const additionalRelations = additionalSources.map((sourceId, index) => ({
                endpoint_id: data.id,
                data_source_id: sourceId,
                is_primary: false,
                sort_order: allDataSourceIds.length + index
              }));
              
              await supabase
                .from('api_endpoint_sources')
                .insert(additionalRelations);
            }
          }
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

  const handleClose = () => {
    if (autoDraftId) {
      // Clean up the auto-draft
      const cleanup = async () => {
        try {
          await supabase
            .from('api_endpoints')
            .delete()
            .eq('id', autoDraftId)
            .eq('is_draft', true); // Safety check
          
          console.log('Auto-draft cleaned up on close:', autoDraftId);
        } catch (error) {
          console.error('Failed to cleanup auto-draft:', error);
        }
      };
      cleanup();
    }
    onClose();
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

  const handleStepChange = async (newStepId: string, prevStepId?: string) => {
    // Check if we're leaving the "configure-source" step
    if (prevStepId === 'configure-source' || currentStepId === 'configure-source') {
      // Check if there are unsaved data sources
      const hasUnsavedDataSources = newDataSources.some(ds => !ds.id && ds.name && ds.type);
      
      if (hasUnsavedDataSources) {
        // Save all data sources before proceeding
        setPendingStepChange(newStepId);
        const saveSuccess = await saveAllNewDataSources();
        
        if (saveSuccess) {
          setCurrentStepId(newStepId);
          setPendingStepChange(null);
        } else {
          // Stay on current step if save failed
          setPendingStepChange(null);
          return;
        }
      } else {
        setCurrentStepId(newStepId);
      }
    } else {
      setCurrentStepId(newStepId);
    }
  };
  

  return (
    <MultistepDialog
      isOpen={isOpen}
      onClose={handleClose}
      title={mode === 'create' ? 'Create API Endpoint' : `Edit Endpoint: ${config.name}`}
      navigationPosition="left"
      showCloseButtonInFooter={false}
      canEscapeKeyClose={true}
      canOutsideClickClose={false}
      className="api-wizard-dialog"
      initialStepIndex={mode === 'edit' ? 9 : 0} // Set to last step index if editing
      currentStepId={currentStepId}
      onChange={handleStepChange}
      nextButtonProps={{
        disabled: mode === 'create' && !isCurrentStepValid(),
        loading: isSavingDataSources // Show loading state when saving
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
            <div>
              {/* Add a status bar at the top */}
              {newDataSources.some(ds => !ds.id) && (
                <Callout intent={Intent.WARNING} icon="info-sign" style={{ marginBottom: '20px' }}>
                  <strong>Note:</strong> Data sources will be automatically saved when you click Next.
                  {newDataSources.filter(ds => !ds.id && ds.name && ds.type).length > 0 && (
                    <span> ({newDataSources.filter(ds => !ds.id && ds.name && ds.type).length} unsaved)</span>
                  )}
                </Callout>
              )}
              
              {/* Add save status for each data source */}
              {newDataSources.every(ds => ds.id || (!ds.name || !ds.type)) && newDataSources.length > 0 && (
                <Callout intent={Intent.SUCCESS} icon="tick" style={{ marginBottom: '20px' }}>
                  All configured data sources have been saved!
                </Callout>
              )}
              
              <DataSourceConfigStep
                dataSources={newDataSources}
                onUpdate={updateNewDataSource}
              />
            </div>
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
            onDraftCreated={handleAutoDraftCreated}
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