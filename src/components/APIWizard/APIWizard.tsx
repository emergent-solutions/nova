import React, { useState } from 'react';
import {
  Dialog,
  DialogStep,
  MultistepDialog,
  Button,
  Intent,
  Classes
} from '@blueprintjs/core';
import { APIEndpointConfig } from '../../types/schema.types';
import DataSourceStep from './steps/DataSourceStep';
import RelationshipsStep from './steps/RelationshipsStep';
import SchemaDesignStep from './steps/SchemaDesignStep';
import OutputFormatStep from './steps/OutputFormatStep';
import TransformationStep from './steps/TransformationStep';
import AuthenticationStep from './steps/AuthenticationStep';
import TestingStep from './steps/TestingStep';
import DeploymentStep from './steps/DeploymentStep';
import { supabase } from '../../lib/supabase';
import './APIWizard.css';

interface APIWizardProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  existingEndpoint?: any;
  onClose: () => void;
  onComplete: (endpoint: any) => void;
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

  const [currentStep, setCurrentStep] = useState(0);
  const [isDeploying, setIsDeploying] = useState(false);

  const updateConfig = (updates: Partial<APIEndpointConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const handleDeploy = async () => {
    try {
      setIsDeploying(true);
      
      // Save to database
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
      if (data && config.dataSources.length > 0) {
        const sourceRelations = config.dataSources.map((source, index) => ({
          endpoint_id: data.id,
          data_source_id: source.id,
          is_primary: index === 0,
          sort_order: index
        }));

        await supabase
          .from('api_endpoint_sources')
          .insert(sourceRelations);
      }

      // Deploy edge function
      await supabase.functions.invoke('deploy-api-endpoint', {
        body: { endpoint_id: data.id }
      });

      onComplete(data);
    } catch (error) {
      console.error('Failed to deploy endpoint:', error);
    } finally {
      setIsDeploying(false);
    }
  };

  const steps: DialogStep[] = [
    {
      id: 'datasource',
      title: 'Data Sources',
      panel: (
        <DataSourceStep
          config={config}
          onUpdate={updateConfig}
        />
      )
    },
    {
      id: 'relationships',
      title: 'Relationships',
      panel: (
        <RelationshipsStep
          config={config}
          onUpdate={updateConfig}
        />
      ),
      disabled: config.dataSources.length < 2
    },
    {
      id: 'schema',
      title: 'Output Schema',
      panel: (
        <SchemaDesignStep
          config={config}
          onUpdate={updateConfig}
        />
      )
    },
    {
      id: 'format',
      title: 'Output Format',
      panel: (
        <OutputFormatStep
          config={config}
          onUpdate={updateConfig}
        />
      )
    },
    {
      id: 'transformations',
      title: 'Transformations',
      panel: (
        <TransformationStep
          config={config}
          onUpdate={updateConfig}
        />
      )
    },
    {
      id: 'authentication',
      title: 'Security',
      panel: (
        <AuthenticationStep
          config={config}
          onUpdate={updateConfig}
        />
      )
    },
    {
      id: 'testing',
      title: 'Test',
      panel: (
        <TestingStep
          config={config}
          onUpdate={updateConfig}
        />
      )
    },
    {
      id: 'deployment',
      title: 'Deploy',
      panel: (
        <DeploymentStep
          config={config}
          onDeploy={handleDeploy}
          isDeploying={isDeploying}
        />
      )
    }
  ];

  return (
    <MultistepDialog
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'Create API Endpoint' : 'Edit API Endpoint'}
      navigationPosition="left"
      showCloseButtonInFooter={false}
      canEscapeKeyClose={false}
      canOutsideClickClose={false}
      className="api-wizard-dialog"
      finalButtonProps={{
        text: 'Deploy Endpoint',
        intent: Intent.PRIMARY,
        loading: isDeploying,
        onClick: handleDeploy
      }}
    >
      {steps}
    </MultistepDialog>
  );
};