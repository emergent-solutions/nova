import React, { useState } from 'react';
import {
  Card,
  Button,
  Intent,
  FormGroup,
  InputGroup,
  Callout,
  ProgressBar,
  Icon,
  Tag,
  NonIdealState,
  Switch,
  HTMLSelect
} from '@blueprintjs/core';
import { APIEndpointConfig } from '../../../types/schema.types';

interface DeploymentStepProps {
  config: APIEndpointConfig;
  onDeploy: () => Promise<void>;
  isDeploying?: boolean;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const DeploymentStep: React.FC<DeploymentStepProps> = ({ 
  config, 
  onDeploy, 
  isDeploying = false 
}) => {
  const [deploymentName, setDeploymentName] = useState(config.name || '');
  const [deploymentSlug, setDeploymentSlug] = useState(config.slug || '');
  const [deploymentEnv, setDeploymentEnv] = useState<'production' | 'staging' | 'development'>('production');
  const [autoStart, setAutoStart] = useState(true);
  const [generateDocs, setGenerateDocs] = useState(true);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [deploymentProgress, setDeploymentProgress] = useState(0);
  const [deploymentStatus, setDeploymentStatus] = useState<string>('');

  const validateConfiguration = (): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!deploymentName) errors.push('Endpoint name is required');
    if (!deploymentSlug) errors.push('URL slug is required');
    if (!config.dataSources || config.dataSources.length === 0) {
      errors.push('At least one data source is required');
    }

    // Slug validation
    if (deploymentSlug && !/^[a-z0-9-]+$/.test(deploymentSlug)) {
      errors.push('Slug must contain only lowercase letters, numbers, and hyphens');
    }

    // Output format validation
    if (!config.outputFormat) {
      errors.push('Output format must be selected');
    }

    // RSS specific validation
    if (config.outputFormat === 'rss') {
      const metadata = config.outputSchema?.metadata;
      if (!metadata?.channelTitle) errors.push('RSS channel title is required');
      if (!metadata?.channelDescription) errors.push('RSS channel description is required');
      if (!metadata?.titleField) warnings.push('RSS item title field not mapped');
    }

    // ATOM specific validation
    if (config.outputFormat === 'atom') {
      const metadata = config.outputSchema?.metadata;
      if (!metadata?.feedId) errors.push('ATOM feed ID is required');
      if (!metadata?.feedTitle) errors.push('ATOM feed title is required');
      if (!metadata?.idField) errors.push('ATOM entry ID field must be mapped');
      if (!metadata?.titleField) warnings.push('ATOM entry title field not mapped');
      if (!metadata?.summaryField) warnings.push('ATOM entry summary field not mapped');
    }

    // Schema validation
    if (!config.outputSchema?.root) {
      warnings.push('Output schema not defined - using auto-generated schema');
    }

    // Authentication warnings
    if (!config.authentication?.required) {
      warnings.push('No authentication configured - endpoint will be public');
    }

    // Rate limiting warnings
    if (!config.rateLimiting?.enabled) {
      warnings.push('No rate limiting configured');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  };

  const handleValidate = () => {
    const result = validateConfiguration();
    setValidation(result);
    return result.valid;
  };

  const handleDeploy = async () => {
    if (!handleValidate()) return;

    setDeploymentProgress(10);
    setDeploymentStatus('Validating configuration...');

    // Update config with deployment settings
    config.name = deploymentName;
    config.slug = deploymentSlug;

    try {
      setDeploymentProgress(30);
      setDeploymentStatus('Creating endpoint...');
      
      // Simulate deployment steps
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setDeploymentProgress(50);
      setDeploymentStatus('Configuring data sources...');
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setDeploymentProgress(70);
      setDeploymentStatus('Setting up authentication...');
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setDeploymentProgress(90);
      setDeploymentStatus('Generating documentation...');
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setDeploymentProgress(100);
      setDeploymentStatus('Deployment complete!');
      
      // Call the actual deploy function
      await onDeploy();
    } catch (error) {
      setDeploymentStatus('Deployment failed');
      console.error('Deployment error:', error);
    }
  };

  const generateSlugFromName = (name: string) => {
    return name.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  return (
    <div className="deployment-step">
      <Callout intent={Intent.PRIMARY} icon="info-sign">
        Review your configuration and deploy your API endpoint to make it accessible.
      </Callout>

      {/* Deployment Configuration */}
      <Card className="deployment-config">
        <h4>Deployment Settings</h4>
        
        <FormGroup label="Endpoint Name" labelInfo="(required)">
          <InputGroup
            value={deploymentName}
            onChange={(e) => {
              setDeploymentName(e.target.value);
              if (!deploymentSlug || deploymentSlug === generateSlugFromName(deploymentName)) {
                setDeploymentSlug(generateSlugFromName(e.target.value));
              }
            }}
            placeholder="My API Endpoint"
          />
        </FormGroup>

        <FormGroup label="URL Slug" labelInfo="(required)">
          <InputGroup
            value={deploymentSlug}
            onChange={(e) => setDeploymentSlug(e.target.value)}
            placeholder="my-api-endpoint"
            leftElement={<Tag minimal>/api/</Tag>}
          />
        </FormGroup>

        <FormGroup label="Environment">
          <HTMLSelect
            value={deploymentEnv}
            onChange={(e) => setDeploymentEnv(e.target.value as any)}
          >
            <option value="production">Production</option>
            <option value="staging">Staging</option>
            <option value="development">Development</option>
          </HTMLSelect>
        </FormGroup>

        <Switch
          label="Auto-start endpoint after deployment"
          checked={autoStart}
          onChange={(e) => setAutoStart(e.target.checked)}
        />

        <Switch
          label="Generate API documentation"
          checked={generateDocs}
          onChange={(e) => setGenerateDocs(e.target.checked)}
        />
      </Card>

      {/* Configuration Summary */}
      <Card className="config-summary">
        <h4>Configuration Summary</h4>
        
        <div className="summary-grid">
          <div className="summary-item">
            <Icon icon="database" />
            <div>
              <strong>Data Sources</strong>
              <div>{config.dataSources?.length || 0} source(s)</div>
            </div>
          </div>

          <div className="summary-item">
            <Icon icon="flow-branch" />
            <div>
              <strong>Relationships</strong>
              <div>{config.relationships?.length || 0} defined</div>
            </div>
          </div>

          <div className="summary-item">
            <Icon icon="code-block" />
            <div>
              <strong>Output Format</strong>
              <div>{config.outputFormat?.toUpperCase() || 'JSON'}</div>
            </div>
          </div>

          <div className="summary-item">
            <Icon icon="exchange" />
            <div>
              <strong>Transformations</strong>
              <div>{config.transformations?.length || 0} configured</div>
            </div>
          </div>

          <div className="summary-item">
            <Icon icon="lock" />
            <div>
              <strong>Authentication</strong>
              <div>{config.authentication?.required ? config.authentication.type : 'None'}</div>
            </div>
          </div>

          <div className="summary-item">
            <Icon icon="time" />
            <div>
              <strong>Cache TTL</strong>
              <div>{config.caching?.enabled ? `${config.caching.ttl}s` : 'Disabled'}</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Validation Results */}
      {validation && (
        <Card className="validation-results">
          <h4>Validation Results</h4>
          
          {validation.valid ? (
            <Callout intent={Intent.SUCCESS} icon="tick-circle">
              Configuration is valid and ready for deployment
            </Callout>
          ) : (
            <Callout intent={Intent.DANGER} icon="error">
              Please fix the errors before deploying
            </Callout>
          )}

          {validation.errors.length > 0 && (
            <div className="validation-errors">
              <h5>Errors</h5>
              {validation.errors.map((error, index) => (
                <div key={index} className="validation-item error">
                  <Icon icon="error" intent={Intent.DANGER} />
                  <span>{error}</span>
                </div>
              ))}
            </div>
          )}

          {validation.warnings.length > 0 && (
            <div className="validation-warnings">
              <h5>Warnings</h5>
              {validation.warnings.map((warning, index) => (
                <div key={index} className="validation-item warning">
                  <Icon icon="warning-sign" intent={Intent.WARNING} />
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Deployment Progress */}
      {isDeploying && (
        <Card className="deployment-progress">
          <h4>Deployment Progress</h4>
          <ProgressBar
            value={deploymentProgress / 100}
            intent={deploymentProgress === 100 ? Intent.SUCCESS : Intent.PRIMARY}
          />
          <p className="deployment-status">{deploymentStatus}</p>
        </Card>
      )}

      {/* Deployment Success */}
      {deploymentProgress === 100 && (
        <Card className="deployment-success">
          <Callout intent={Intent.SUCCESS} icon="tick-circle">
            <h4>Deployment Successful!</h4>
            <p>Your API endpoint is now live at:</p>
            <div className="endpoint-url">
              <code>https://your-api.com/api/{deploymentSlug}</code>
              <Button
                minimal
                icon="duplicate"
                onClick={() => {
                  navigator.clipboard.writeText(`https://your-api.com/api/${deploymentSlug}`);
                }}
              />
            </div>
          </Callout>

          <div className="post-deployment-actions">
            <Button icon="document" text="View Documentation" />
            <Button icon="chart" text="View Analytics" />
            <Button icon="play" text="Test Endpoint" />
          </div>
        </Card>
      )}

      {/* Deploy Button */}
      <div className="deployment-actions">
        {!isDeploying && deploymentProgress !== 100 && (
          <>
            <Button
              text="Validate Configuration"
              onClick={handleValidate}
              intent={Intent.NONE}
            />
            <Button
              text="Deploy Endpoint"
              intent={Intent.PRIMARY}
              onClick={handleDeploy}
              disabled={validation ? !validation.valid : false}
              icon="cloud-upload"
            />
          </>
        )}
      </div>
    </div>
  );
};

export default DeploymentStep;