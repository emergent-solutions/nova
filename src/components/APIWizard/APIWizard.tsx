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
import AIAssistant from './components/AIAssistant';

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
  const [sampleData, setSampleData] = useState<Record<string, any>>(() => {
    if (mode === 'edit' && existingEndpoint?.sample_data) {
      return existingEndpoint.sample_data;
    }
    return {};
  });
  const [showAIAssistant, setShowAIAssistant] = useState(false);

  // Helper function to check if a string is a valid UUID
  const isValidUUID = (str: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  // Check if all required steps are valid
  const isAllStepsValid = (): boolean => {
    // Basic validation
    if (!config.name || !config.slug) return false;
    
    // Data sources validation
    const hasDataSources = selectedDataSources.length > 0 || 
                          newDataSources.some(ds => ds.name && ds.type);
    if (!hasDataSources) return false;
    
    // All new data sources should be properly configured
    const allNewSourcesValid = newDataSources.every(ds => 
      !ds.name || !ds.type || (ds.name && ds.type)
    );
    if (!allNewSourcesValid) return false;
    
    // Output format should be set
    if (!config.outputFormat) return false;
    
    return true;
  };

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

      const allSourceIds = new Set<string>();

      console.log('=== COLLECTING SOURCE IDS ===');

      // 1. From selectedDataSources
      console.log('1. selectedDataSources:', selectedDataSources);
      selectedDataSources.forEach(id => {
        console.log(`  - Checking selectedDataSource: "${id}" - Valid UUID: ${isValidUUID(id)}`);
        if (isValidUUID(id)) {
          allSourceIds.add(id);
        }
      });

      // 2. From newDataSources that have IDs
      console.log('2. newDataSources:', newDataSources);
      newDataSources.forEach(ds => {
        if (ds.id) {
          console.log(`  - Checking newDataSource ID: "${ds.id}" - Valid UUID: ${isValidUUID(ds.id)}`);
          if (isValidUUID(ds.id)) {
            allSourceIds.add(ds.id);
          }
        }
      });

      // 3. From config.dataSources
      console.log('3. config.dataSources:', config.dataSources);
      config.dataSources?.forEach(ds => {
        if (ds.id) {
          console.log(`  - Checking config.dataSource ID: "${ds.id}" - Valid UUID: ${isValidUUID(ds.id)}`);
          if (isValidUUID(ds.id)) {
            allSourceIds.add(ds.id);
          }
        }
      });

      // 4. From field mappings
      console.log('4. config.fieldMappings:', config.fieldMappings);
      config.fieldMappings?.forEach(mapping => {
        const sourceId = mapping.source_id || mapping.sourceId;
        if (sourceId) {
          console.log(`  - Checking fieldMapping source: "${sourceId}" - Valid UUID: ${isValidUUID(sourceId)}`);
          if (isValidUUID(sourceId)) {
            allSourceIds.add(sourceId);
          }
        }
      });

      // 5. From jsonMappingConfig
      const jmc = config.outputSchema?.metadata?.jsonMappingConfig;
      console.log('5. jsonMappingConfig:', jmc);
      if (jmc?.sourceSelection?.sources) {
        jmc.sourceSelection.sources.forEach((source: any) => {
          if (source.id) {
            console.log(`  - Checking jsonMapping source: "${source.id}" - Valid UUID: ${isValidUUID(source.id)}`);
            if (isValidUUID(source.id)) {
              allSourceIds.add(source.id);
            }
          }
        });
      }

      console.log('=== FINAL COLLECTED IDS ===');
      const finalSourceIds = Array.from(allSourceIds);
      console.log('Valid UUIDs collected:', finalSourceIds);
      console.log('Total count:', finalSourceIds.length);

      if (finalSourceIds.length === 0) {
        throw new Error('No valid data source UUIDs found. The data sources may not have been created properly.');
      }

      const dataSourceIdArray = Array.from(allSourceIds);
      console.log('🚀 Deploying with data source IDs:', dataSourceIdArray);
      console.log(`📊 Total unique data sources: ${allSourceIds.size}`);
      if (dataSourceIdArray.length === 0) {
        throw new Error('No valid data sources found. Please ensure at least one data source is properly configured.');
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
          sample_data: sampleData,
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
          
          // First, delete existing source links
          await supabase
            .from('api_endpoint_sources')
            .delete()
            .eq('endpoint_id', endpointToUpdate.id);

          // Then add the new/updated source links
          if (dataSourceIdArray.length > 0) {
            const sourceRelations = dataSourceIdArray.map((sourceId, index) => ({
              endpoint_id: endpointToUpdate.id,
              data_source_id: sourceId,
              is_primary: index === 0,
              sort_order: index
            }));
            
            await supabase
              .from('api_endpoint_sources')
              .insert(sourceRelations);
          }
        }
        
        // If this was an auto-draft, now link the data sources
        if (endpointToUpdate.isAutoDraft) {
          // Ensure we have ALL data source IDs, including ones created earlier
          const allSourceIds = new Set<string>();
          
          // Add from selectedDataSources
          selectedDataSources.forEach(id => allSourceIds.add(id));
          
          // Add from newDataSources that already have IDs
          newDataSources.forEach(ds => {
            if (ds.id) allSourceIds.add(ds.id);
          });
          
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
                allSourceIds.add(existing.id);
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
                  allSourceIds.add(createdDs.id);
                  newDs.id = createdDs.id;
                }
              }
            } else if (newDs.id) {
              allSourceIds.add(newDs.id);
            }
          }

          const finalSourceIds = Array.from(allSourceIds);
          if (finalSourceIds.length > 0) {
            const sourceRelations = dataSourceIdArray.map((sourceId, index) => ({
              endpoint_id: endpointToUpdate.id,
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
            'Agent deployed successfully' : 
            'Agent updated successfully', 
          intent: Intent.SUCCESS 
        });
        
        onComplete(data);
        onClose();
      } else {
        // Create brand new endpoint (no auto-draft exists)
        console.log('📝 Starting new endpoint creation');
        console.log('Selected data sources:', selectedDataSources);
        console.log('New data sources:', newDataSources);
        
        const allSourceIds = new Set<string>();
        
        // Add all selected existing data sources
        selectedDataSources.forEach(id => {
          if (isValidUUID(id)) {
            console.log('Adding selected source ID:', id);
            allSourceIds.add(id);
          }
        });
        
        // Process new data sources
        for (const newDs of newDataSources) {
          console.log('Processing new data source:', newDs);
          
          if (newDs.name && newDs.type) {
            if (newDs.id) {
              // Already has an ID, just add it
              console.log('Data source already has ID:', newDs.id);
              allSourceIds.add(newDs.id);
            } else {
              // Need to create it
              console.log('Creating new data source:', newDs.name);
              
              const { data: existing } = await supabase
                .from('data_sources')
                .select('id')
                .eq('name', newDs.name)
                .eq('user_id', user.id)
                .single();
              
              if (existing) {
                console.log('Found existing data source with ID:', existing.id);
                allSourceIds.add(existing.id);
              } else {
                const dataSourcePayload = {
                  name: newDs.name,
                  type: newDs.type,
                  category: newDs.category,
                  active: true,
                  api_config: newDs.api_config || null,
                  database_config: newDs.database_config || null,
                  file_config: newDs.file_config || null,
                  rss_config: newDs.rss_config || null,
                  user_id: user.id
                };
                
                console.log('Creating data source with payload:', dataSourcePayload);
                
                const { data: createdDs, error } = await supabase
                  .from('data_sources')
                  .insert(dataSourcePayload)
                  .select()
                  .single();
                
                if (error) {
                  console.error('Error creating data source:', error);
                  throw error;
                }
                
                if (createdDs) {
                  console.log('Created data source with ID:', createdDs.id);
                  allSourceIds.add(createdDs.id);
                  newDs.id = createdDs.id;
                }
              }
            }
          }
        }
        
        // Also check field mappings for source IDs
        if (config.fieldMappings && config.fieldMappings.length > 0) {
          console.log('Checking field mappings for source IDs:', config.fieldMappings);
          config.fieldMappings.forEach(mapping => {
            const sourceId = mapping.source_id || mapping.sourceId;
            if (sourceId) {
              console.log('Found source ID in field mapping:', sourceId);
              allSourceIds.add(sourceId);
            }
          });
        }
        
        // Check jsonMappingConfig for source IDs
        const jmc = config.outputSchema?.metadata?.jsonMappingConfig;
        if (jmc?.sourceSelection?.sources) {
          console.log('Checking jsonMappingConfig sources:', jmc.sourceSelection.sources);
          jmc.sourceSelection.sources.forEach((source: any) => {
            if (source.id) {
              console.log('Found source ID in jsonMappingConfig:', source.id);
              allSourceIds.add(source.id);
            }
          });
        }
        
        const finalSourceIds = Array.from(allSourceIds);
        console.log('🎯 FINAL source IDs to link:', finalSourceIds);
        console.log('Total source IDs:', finalSourceIds.length);
      
        // Create the endpoint
        const endpointPayload = {
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
          sample_data: sampleData,
          active: true,
          is_draft: false,
          user_id: user.id
        };
        
        console.log('Creating endpoint with payload:', endpointPayload);
      
        const { data, error } = await supabase
          .from('api_endpoints')
          .insert(endpointPayload)
          .select()
          .single();
      
        if (error) {
          console.error('Error creating endpoint:', error);
          throw error;
        }
      
        console.log('✅ Endpoint created with ID:', data.id);
      
        // Link data sources
        if (data && finalSourceIds.length > 0) {
          console.log(`🔗 Linking ${finalSourceIds.length} data sources to endpoint ${data.id}`);
          
          const sourceRelations = finalSourceIds.map((sourceId, index) => {
            const relation = {
              endpoint_id: data.id,
              data_source_id: sourceId,
              is_primary: index === 0,
              sort_order: index
            };
            console.log(`Creating relation ${index + 1}:`, relation);
            return relation;
          });
      
          console.log('Inserting source relations:', sourceRelations);
          
          const { data: linkData, error: linkError } = await supabase
            .from('api_endpoint_sources')
            .insert(sourceRelations)
            .select();
          
          if (linkError) {
            console.error('❌ Failed to link data sources:', linkError);
            console.error('Error details:', JSON.stringify(linkError, null, 2));
            throw linkError; // Throw the error so the transaction can be handled properly
          } else {
            console.log('✅ Successfully linked data sources:', linkData);
          }
          
          // Handle RSS multi-source special case
          if (config.outputFormat === 'rss' && config.outputSchema?.metadata?.sourceMappings) {
            console.log('🔄 Processing RSS multi-source configuration');
            const sourceMappings = config.outputSchema.metadata.sourceMappings;
            const enabledRssSources = sourceMappings.filter(m => m.enabled);
            
            const rssSourceIds = enabledRssSources.map(s => s.sourceId);
            const additionalSources = rssSourceIds.filter(id => !finalSourceIds.includes(id));
            
            console.log('RSS enabled sources:', rssSourceIds);
            console.log('Additional RSS sources to link:', additionalSources);
            
            if (additionalSources.length > 0) {
              const additionalRelations = additionalSources.map((sourceId, index) => ({
                endpoint_id: data.id,
                data_source_id: sourceId,
                is_primary: false,
                sort_order: finalSourceIds.length + index
              }));
              
              console.log('Inserting additional RSS source relations:', additionalRelations);
              
              const { data: rssLinkData, error: rssLinkError } = await supabase
                .from('api_endpoint_sources')
                .insert(additionalRelations)
                .select();
              
              if (rssLinkError) {
                console.error('Failed to link additional RSS sources:', rssLinkError);
                throw rssLinkError;
              } else {
                console.log('✅ Successfully linked additional RSS sources:', rssLinkData);
              }
            }
          }
        } else {
          console.warn('⚠️ No data sources to link!');
          console.log('endpointData exists:', !!data);
          console.log('finalSourceIds:', finalSourceIds);
        }
      
        toaster.show({ 
          message: 'Agent created successfully', 
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

  const handleSave = async () => {
    setIsDeploying(true);
    
    try {
      // Save data sources if needed
      await saveAllNewDataSources();
      
      const finalConfig = {
        ...config,
        dataSources: allDataSources
      };
      
      // Save directly to the database instead of calling onComplete
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // Update the existing endpoint
      const { data, error } = await supabase
        .from('api_endpoints')
        .update({
          name: finalConfig.name,
          slug: finalConfig.slug,
          description: finalConfig.description,
          output_format: finalConfig.outputFormat,
          schema_config: {
            schema: finalConfig.outputSchema,
            mapping: finalConfig.fieldMappings
          },
          transform_config: {
            transformations: finalConfig.transformations
          },
          relationship_config: {
            relationships: finalConfig.relationships
          },
          auth_config: finalConfig.authentication,
          cache_config: finalConfig.caching,
          rate_limit_config: finalConfig.rateLimiting,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingEndpoint.id)
        .select()
        .single();
      
      if (error) throw error;
      
      toaster.show({
        message: 'Changes saved successfully!',
        intent: Intent.SUCCESS
      });
      
    } catch (error) {
      console.error('Save failed:', error);
      toaster.show({
        message: 'Failed to save changes. Please try again.',
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

  const handleApplyAIConfig = async (aiConfig: Partial<APIEndpointConfig>) => {
    console.log('🎯 Applying AI configuration:', aiConfig);
    
    // Track ALL data source IDs that need to be linked to the endpoint
    const dataSourceIdsToLink: string[] = [];
    const idMapping: Record<string, string> = {};

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toaster.show({
          message: 'You must be logged in to create data sources',
          intent: Intent.DANGER
        });
        return;
      }
  
      // Handle data sources
      let dataSourcesToProcess = aiConfig.dataSources;
      
      if (dataSourcesToProcess && Array.isArray(dataSourcesToProcess)) {
        console.log('📦 Processing data sources from AI:', dataSourcesToProcess);
        
        for (const dataSource of dataSourcesToProcess) {
          const tempId = dataSource.id;
          let finalId: string | null = null;
          
          // Check if this is a new data source that needs creation
          if (dataSource.isNew || !dataSource.id || !isValidUUID(dataSource.id) || 
              dataSource.id.includes('temp') || dataSource.id.includes('new')) {
            
            console.log(`💾 Creating new data source: ${dataSource.name}`);
            
            // Check if exists
            const { data: existing } = await supabase
              .from('data_sources')
              .select('id')
              .eq('name', dataSource.name)
              .eq('user_id', user.id)
              .single();
            
            if (existing) {
              finalId = existing.id;
              console.log(`✅ Using existing data source: ${dataSource.name} (ID: ${finalId})`);
            } else {
              // Create new
              const { data: created, error } = await supabase
                .from('data_sources')
                .insert({
                  name: dataSource.name,
                  type: dataSource.type || 'api',
                  category: dataSource.category || 'api',
                  active: true,
                  user_id: user.id,
                  ...(dataSource.api_config ? { api_config: dataSource.api_config } : {}),
                  ...(dataSource.database_config ? { database_config: dataSource.database_config } : {}),
                  ...(dataSource.file_config ? { file_config: dataSource.file_config } : {})
                })
                .select()
                .single();
              
              if (error) throw error;
              if (created) {
                finalId = created.id;
                console.log(`✅ Created data source: ${dataSource.name} (ID: ${finalId})`);
              }
            }
            
            if (finalId) {
              // Track the ID mapping
              if (tempId) {
                idMapping[tempId] = finalId;
              }
              
              // Add to the list of IDs to link
              dataSourceIdsToLink.push(finalId);
              
              // Update the data source object
              dataSource.id = finalId;
              
              // Add to newDataSources array for UI tracking
              setNewDataSources(prev => {
                const exists = prev.some(ds => ds.id === finalId);
                if (!exists) {
                  return [...prev, dataSource];
                }
                return prev;
              });
            }
          } else {
            // Existing data source, just track its ID
            console.log(`📌 Using existing data source ID: ${dataSource.id}`);
            dataSourceIdsToLink.push(dataSource.id);
          }
        }
      }
      
      // CRITICAL: Also extract data source IDs from field mappings if they exist
      // This handles cases where the data source was created but not properly tracked
      if (aiConfig.fieldMappings && aiConfig.fieldMappings.length > 0) {
        aiConfig.fieldMappings.forEach(mapping => {
          const sourceId = mapping.source_id || mapping.sourceId;
          if (sourceId && !dataSourceIdsToLink.includes(sourceId)) {
            console.log(`📎 Found data source ID in field mappings: ${sourceId}`);
            dataSourceIdsToLink.push(sourceId);
          }
        });
      }
      
      // Also check jsonMappingConfig for source IDs
      if (aiConfig.outputSchema?.metadata?.jsonMappingConfig?.sourceSelection?.sources) {
        aiConfig.outputSchema.metadata.jsonMappingConfig.sourceSelection.sources.forEach((source: any) => {
          if (source.id && !dataSourceIdsToLink.includes(source.id)) {
            console.log(`📎 Found data source ID in sourceSelection: ${source.id}`);
            dataSourceIdsToLink.push(source.id);
          }
        });
      }
      
      // Update field mappings with new IDs if needed
      if (Object.keys(idMapping).length > 0) {
        console.log('🔄 Updating field mappings with ID mapping:', idMapping);
        
        if (aiConfig.fieldMappings) {
          aiConfig.fieldMappings = aiConfig.fieldMappings.map(mapping => {
            const oldId = mapping.source_id || mapping.sourceId;
            const newId = idMapping[oldId] || oldId;
            return {
              ...mapping,
              source_id: newId,
              sourceId: newId
            };
          });
        }
        
        // Update jsonMappingConfig
        if (aiConfig.outputSchema?.metadata?.jsonMappingConfig) {
          const jmc = aiConfig.outputSchema.metadata.jsonMappingConfig;
          
          if (jmc.fieldMappings) {
            jmc.fieldMappings = jmc.fieldMappings.map((mapping: any) => ({
              ...mapping,
              sourceId: idMapping[mapping.sourceId] || mapping.sourceId,
              source_id: idMapping[mapping.source_id] || mapping.source_id
            }));
          }
          
          if (jmc.sourceSelection?.sources) {
            jmc.sourceSelection.sources = jmc.sourceSelection.sources.map((source: any) => ({
              ...source,
              id: idMapping[source.id] || source.id
            }));
          }
        }
      }
      
      // CRITICAL FIX: Update the selectedDataSources state with ALL collected IDs
      console.log('🔗 Data source IDs to link to endpoint:', dataSourceIdsToLink);
      setSelectedDataSources(prev => {
        const combined = [...new Set([...prev, ...dataSourceIdsToLink])];
        console.log('📋 Updated selectedDataSources:', combined);
        return combined;
      });
      
      // Apply the rest of the configuration
      if (aiConfig.name) updateConfig({ name: aiConfig.name });
      if (aiConfig.slug) updateConfig({ slug: aiConfig.slug });
      if (aiConfig.description) updateConfig({ description: aiConfig.description });
      if (aiConfig.outputFormat) updateConfig({ outputFormat: aiConfig.outputFormat });
      if (aiConfig.fieldMappings) updateConfig({ fieldMappings: aiConfig.fieldMappings });
      if (aiConfig.outputSchema) updateConfig({ outputSchema: aiConfig.outputSchema });
      if (aiConfig.outputWrapper) updateConfig({ outputWrapper: aiConfig.outputWrapper });
      if (aiConfig.transformations) updateConfig({ transformations: aiConfig.transformations });
      if (aiConfig.authentication) updateConfig({ authentication: aiConfig.authentication });
      if (aiConfig.caching) updateConfig({ caching: aiConfig.caching });
      if (aiConfig.rateLimiting) updateConfig({ rateLimiting: aiConfig.rateLimiting });
      
      console.log('✅ AI configuration applied successfully');
      toaster.show({
        message: 'Configuration applied successfully',
        intent: Intent.SUCCESS
      });
      
    } catch (error) {
      console.error('Failed to apply AI configuration:', error);
      toaster.show({
        message: 'Failed to apply configuration',
        intent: Intent.DANGER
      });
    }
  };

  return (
    <>    
      <MultistepDialog
        isOpen={isOpen}
        onClose={handleClose}
        title={
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            width: '100%'
          }}>
            <span>{mode === 'create' ? 'Create Agent' : `Edit Agent: ${config.name}`}</span>
            <Button
              icon="predictive-analysis"
              text="AI Assistant"
              intent={Intent.PRIMARY}
              onClick={() => setShowAIAssistant(true)}
              minimal
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white'
              }}
            />
            {mode === 'edit' && isAllStepsValid() && (
              <Button
                minimal
                icon="floppy-disk"
                title="Save Changes"
                intent={Intent.PRIMARY}
                loading={isDeploying}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSave();
                }}
                style={{ marginLeft: 'auto' }}
              />
            )}
          </div>
        }
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
          text: mode === 'edit' ? 'Save Changes' : 'Deploy Agent',
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
                  {isAllStepsValid() && (
                    <span style={{ display: 'block', marginTop: '10px' }}>
                      <strong>✓ All required fields are complete.</strong> You can save your changes at any time.
                    </span>
                  )}
                </Callout>
              )}
              <FormGroup label="Agent Name" labelInfo="(required)">
                <InputGroup
                  value={config.name}
                  onChange={(e) => updateConfig({ name: e.target.value })}
                  placeholder="My Agent"
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
              initialSampleData={sampleData}
              onSampleDataChange={setSampleData}
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
              sampleData={sampleData}
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
      <AIAssistant
        isOpen={showAIAssistant}
        onClose={() => setShowAIAssistant(false)}
        config={config}
        onApplyConfig={handleApplyAIConfig}
        dataSources={[...existingDataSources, ...newDataSources]}
      />
    </>
  );
};

export default APIWizard;