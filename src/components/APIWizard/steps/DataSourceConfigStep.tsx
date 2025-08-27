// src/components/APIWizard/steps/DataSourceConfigStep.tsx
import React, { useState } from 'react';
import {
  Card,
  Button,
  FormGroup,
  InputGroup,
  HTMLSelect,
  TextArea,
  Callout,
  Intent,
  Icon,
  Tag,
  Switch,
  NumericInput,
  Tabs,
  Tab,
  Divider,
  Classes
} from '@blueprintjs/core';
import { useFetchProxy } from '../../../hooks/useFetchProxy';

interface DataSourceConfigStepProps {
  dataSources: any[];
  onUpdate: (index: number, updates: any) => void;
}

const DataSourceConfigStep: React.FC<DataSourceConfigStepProps> = ({
  dataSources,
  onUpdate
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [testResults, setTestResults] = useState<Record<number, any>>({});
  const [loading, setLoading] = useState<Record<number, boolean>>({});
  
  const { fetchViaProxy } = useFetchProxy();

  const testAPIConnection = async (index: number) => {
    const source = dataSources[index];
    if (!source.api_config?.url) return;

    setLoading(prev => ({ ...prev, [index]: true }));
    
    try {
      const result = await fetchViaProxy(source.api_config.url, {
        method: source.api_config.method || 'GET',
        headers: source.api_config.headers || {}
      });

      if (result.status >= 400) {
        throw new Error(`HTTP error ${result.status}`);
      }

      setTestResults(prev => ({
        ...prev,
        [index]: {
          success: true,
          status: result.status,
          data: result.data
        }
      }));

      // Store extracted fields
      const fields = extractJsonFields(result.data);
      onUpdate(index, {
        api_config: {
          ...source.api_config,
          extracted_fields: fields,
          sample_response: result.data
        }
      });

    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [index]: {
          success: false,
          error: error instanceof Error ? error.message : 'Connection failed'
        }
      }));
    } finally {
      setLoading(prev => ({ ...prev, [index]: false }));
    }
  };

  const extractJsonFields = (data: any, prefix: string = ''): string[] => {
    const fields: string[] = [];
    
    if (data === null || data === undefined) return fields;
    
    if (Array.isArray(data)) {
      if (data.length > 0 && typeof data[0] === 'object') {
        return extractJsonFields(data[0], prefix);
      }
      return fields;
    }
    
    if (typeof data === 'object') {
      Object.keys(data).forEach(key => {
        const fullPath = prefix ? `${prefix}.${key}` : key;
        fields.push(fullPath);
        
        if (data[key] && typeof data[key] === 'object') {
          const nestedFields = extractJsonFields(data[key], fullPath);
          fields.push(...nestedFields);
        }
      });
    }
    
    return [...new Set(fields)];
  };

  const renderAPIConfig = (source: any, index: number) => {
    // Initialize api_config if it doesn't exist
    if (!source.api_config) {
      source.api_config = { method: 'GET', auth_type: 'none' };
    }
    
    return (
      <>
        <FormGroup label="API Endpoint" labelInfo="(required)">
          <InputGroup
            value={source.api_config?.url || ''}
            onChange={(e) => onUpdate(index, {
              api_config: { ...source.api_config, url: e.target.value }
            })}
            placeholder="https://api.example.com/v1/data"
            intent={!source.api_config?.url ? Intent.DANGER : Intent.NONE}
          />
        </FormGroup>

        <FormGroup label="HTTP Method">
          <HTMLSelect
            value={source.api_config?.method || 'GET'}
            onChange={(e) => onUpdate(index, {
              api_config: { ...source.api_config, method: e.target.value }
            })}
            fill
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
          </HTMLSelect>
        </FormGroup>

        <FormGroup label="Authentication Type">
          <HTMLSelect
            value={source.api_config?.auth_type || 'none'}
            onChange={(e) => onUpdate(index, {
              api_config: { ...source.api_config, auth_type: e.target.value }
            })}
            fill
          >
            <option value="none">No Authentication</option>
            <option value="basic">Basic Auth</option>
            <option value="bearer">Bearer Token</option>
            <option value="api_key_header">API Key (Header)</option>
            <option value="api_key_query">API Key (Query)</option>
          </HTMLSelect>
        </FormGroup>

        {source.api_config?.auth_type === 'bearer' && (
          <FormGroup label="Bearer Token">
            <InputGroup
              type="password"
              value={source.api_config?.auth_config?.token || ''}
              onChange={(e) => onUpdate(index, {
                api_config: {
                  ...source.api_config,
                  auth_config: { ...source.api_config.auth_config, token: e.target.value }
                }
              })}
              placeholder="Enter bearer token"
            />
          </FormGroup>
        )}

        {source.api_config?.auth_type === 'api_key_header' && (
          <>
            <FormGroup label="API Key">
              <InputGroup
                type="password"
                value={source.api_config?.auth_config?.api_key || ''}
                onChange={(e) => onUpdate(index, {
                  api_config: {
                    ...source.api_config,
                    auth_config: { ...source.api_config.auth_config, api_key: e.target.value }
                  }
                })}
                placeholder="Enter API key"
              />
            </FormGroup>
            <FormGroup label="Header Name">
              <InputGroup
                value={source.api_config?.auth_config?.key_header_name || 'X-API-Key'}
                onChange={(e) => onUpdate(index, {
                  api_config: {
                    ...source.api_config,
                    auth_config: { ...source.api_config.auth_config, key_header_name: e.target.value }
                  }
                })}
                placeholder="X-API-Key"
              />
            </FormGroup>
          </>
        )}

        <FormGroup label="Headers (JSON)">
          <TextArea
            value={JSON.stringify(source.api_config?.headers || {}, null, 2)}
            onChange={(e) => {
              try {
                const headers = JSON.parse(e.target.value);
                onUpdate(index, {
                  api_config: { ...source.api_config, headers }
                });
              } catch (err) {
                // Invalid JSON
              }
            }}
            rows={4}
            fill
          />
        </FormGroup>

        <Button
          icon="exchange"
          text="Test Connection"
          intent={Intent.PRIMARY}
          onClick={() => testAPIConnection(index)}
          loading={loading[index]}
          disabled={!source.api_config?.url}
        />

        {testResults[index] && (
          <Callout
            style={{ marginTop: '15px' }}
            icon={testResults[index].success ? 'tick' : 'error'}
            intent={testResults[index].success ? Intent.SUCCESS : Intent.DANGER}
          >
            {testResults[index].success ? (
              <div>
                <strong>Connection successful!</strong>
                <p>Status: {testResults[index].status}</p>
                {source.api_config?.extracted_fields && (
                  <p>Found {source.api_config.extracted_fields.length} fields</p>
                )}
              </div>
            ) : (
              <div>
                <strong>Connection failed</strong>
                <p>{testResults[index].error}</p>
              </div>
            )}
          </Callout>
        )}
      </>
    );
  };

  const renderDatabaseConfig = (source: any, index: number) => (
    <>
      <FormGroup label="Database Type">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          {['mysql', 'postgresql', 'mssql'].map(dbType => (
            <Card
              key={dbType}
              interactive
              onClick={() => onUpdate(index, {
                database_config: { ...source.database_config, dbType }
              })}
              style={{
                padding: '15px',
                textAlign: 'center',
                border: source.database_config?.dbType === dbType ? '2px solid #137cbd' : '1px solid #d3d8de'
              }}
            >
              <Icon icon="database" size={24} />
              <div style={{ marginTop: '8px', fontSize: '14px' }}>
                {dbType.toUpperCase()}
              </div>
            </Card>
          ))}
        </div>
      </FormGroup>

      {source.database_config?.dbType && (
        <Callout icon="info-sign" intent={Intent.PRIMARY}>
          Database connections and queries will be configured in a later step
          after saving this data source.
        </Callout>
      )}
    </>
  );

  const renderFileConfig = (source: any, index: number) => (
    <>
      <FormGroup label="File Source">
        <HTMLSelect
          value={source.file_config?.source || 'url'}
          onChange={(e) => onUpdate(index, {
            file_config: { ...source.file_config, source: e.target.value }
          })}
          fill
        >
          <option value="url">URL</option>
          <option value="upload">Upload</option>
          <option value="path">Server Path</option>
        </HTMLSelect>
      </FormGroup>

      {source.file_config?.source === 'url' && (
        <FormGroup label="File URL" labelInfo="(required)">
          <InputGroup
            value={source.file_config?.url || ''}
            onChange={(e) => onUpdate(index, {
              file_config: { ...source.file_config, url: e.target.value }
            })}
            placeholder="https://example.com/data.csv"
            intent={!source.file_config?.url ? Intent.DANGER : Intent.NONE}
          />
        </FormGroup>
      )}

      <FormGroup label="File Format">
        <HTMLSelect
          value={source.file_config?.format || 'csv'}
          onChange={(e) => onUpdate(index, {
            file_config: { ...source.file_config, format: e.target.value }
          })}
          fill
        >
          <option value="csv">CSV</option>
          <option value="tsv">TSV</option>
          <option value="json">JSON</option>
          <option value="xml">XML</option>
        </HTMLSelect>
      </FormGroup>
    </>
  );

  const renderConfig = (source: any, index: number) => {
    switch (source.type) {
      case 'api':
        return renderAPIConfig(source, index);
      case 'database':
        return renderDatabaseConfig(source, index);
      case 'file':
        return renderFileConfig(source, index);
      case 'rss':
        return (
          <Callout intent={Intent.PRIMARY}>
            RSS configuration will be added in a future update.
          </Callout>
        );
      default:
        return (
          <Callout intent={Intent.WARNING}>
            Please select a data source type.
          </Callout>
        );
    }
  };

  const validSources = dataSources.filter(ds => ds.name && ds.type);

  if (validSources.length === 0) {
    return (
      <div style={{ padding: '20px' }}>
        <Callout intent={Intent.WARNING} icon="warning-sign">
          No new data sources to configure. Please go back and add data sources.
        </Callout>
      </div>
    );
  }

  return (
    <div className="datasource-config-step" style={{ padding: '20px' }}>
      <Tabs
        id="datasource-tabs"
        selectedTabId={activeTab.toString()}
        onChange={(newTabId) => setActiveTab(parseInt(newTabId as string))}
      >
        {validSources.map((source, index) => (
          <Tab
            key={index}
            id={index.toString()}
            title={
              <span>
                <Icon icon={
                  source.type === 'api' ? 'cloud' :
                  source.type === 'database' ? 'database' :
                  source.type === 'file' ? 'document' :
                  'data-connection'
                } />
                {' '}
                {source.name}
              </span>
            }
            panel={
              <Card style={{ marginTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ margin: 0 }}>{source.name}</h3>
                  <Tag intent={Intent.PRIMARY}>{source.type.toUpperCase()}</Tag>
                </div>
                {renderConfig(source, index)}
              </Card>
            }
          />
        ))}
      </Tabs>
    </div>
  );
};

export default DataSourceConfigStep;