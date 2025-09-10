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
  Classes,
  Spinner
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
        
        // Don't recurse too deep - just one level for now
        if (!prefix && data[key] && typeof data[key] === 'object' && !Array.isArray(data[key])) {
          const nestedFields = extractJsonFields(data[key], fullPath);
          fields.push(...nestedFields);
        }
      });
    }
    
    return [...new Set(fields)];
  };

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

      // Extract fields from the response
      let extractedFields: string[] = [];
      let dataToAnalyze = result.data;
      
      // If there's a data_path, navigate to it
      if (source.api_config.data_path) {
        const pathParts = source.api_config.data_path.split('.');
        let current = result.data;
        
        for (const part of pathParts) {
          if (current && typeof current === 'object') {
            current = current[part];
          }
        }
        
        if (current) {
          dataToAnalyze = current;
        }
      }
      
      extractedFields = extractJsonFields(dataToAnalyze);

      setTestResults(prev => ({
        ...prev,
        [index]: {
          success: true,
          status: result.status,
          data: result.data,
          fields: extractedFields
        }
      }));

      // IMPORTANT: Store fields at both the root level AND in api_config
      onUpdate(index, {
        fields: extractedFields,  // Store at root level for other steps
        sample_data: Array.isArray(dataToAnalyze) ? dataToAnalyze.slice(0, 5) : [dataToAnalyze],
        api_config: {
          ...source.api_config,
          extracted_fields: extractedFields,  // Also store in api_config for reference
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

  const testRSSFeed = async (index: number) => {
    const source = dataSources[index];
    if (!source.rss_config?.url) return;

    setLoading(prev => ({ ...prev, [index]: true }));
    
    try {
      const result = await fetchViaProxy(source.rss_config.url, {
        method: 'GET'
      });

      if (result.status >= 400) {
        throw new Error(`HTTP error ${result.status}`);
      }

      // Parse RSS and extract fields
      // This is simplified - you'd use an actual RSS parser
      let extractedFields: string[] = ['title', 'description', 'link', 'pubDate', 'guid', 'author', 'category'];
      
      setTestResults(prev => ({
        ...prev,
        [index]: {
          success: true,
          status: result.status,
          data: result.data,
          fields: extractedFields
        }
      }));

      // Store fields at root level for other steps
      onUpdate(index, {
        fields: extractedFields,
        rss_config: {
          ...source.rss_config,
          extracted_fields: extractedFields,
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

  const renderAPIConfig = (source: any, index: number) => {
    // Initialize api_config if it doesn't exist
    if (!source.api_config) {
      source.api_config = { method: 'GET', auth_type: 'none' };
    }
    
    return (
      <>
        <FormGroup label="Agent" labelInfo="(required)">
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

        <FormGroup label="Data Path (optional)" helperText="JSON path to the array of items (e.g., 'data.items' or 'results')">
          <InputGroup
            value={source.api_config?.data_path || ''}
            onChange={(e) => onUpdate(index, {
              api_config: { ...source.api_config, data_path: e.target.value }
            })}
            placeholder="data.items"
          />
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
              value={source.api_config?.bearer_token || ''}
              onChange={(e) => onUpdate(index, {
                api_config: { ...source.api_config, bearer_token: e.target.value }
              })}
              placeholder="Your bearer token"
              type="password"
            />
          </FormGroup>
        )}

        {source.api_config?.auth_type === 'api_key_header' && (
          <>
            <FormGroup label="API Key Header Name">
              <InputGroup
                value={source.api_config?.api_key_header || 'X-API-Key'}
                onChange={(e) => onUpdate(index, {
                  api_config: { ...source.api_config, api_key_header: e.target.value }
                })}
                placeholder="X-API-Key"
              />
            </FormGroup>
            <FormGroup label="API Key Value">
              <InputGroup
                value={source.api_config?.api_key_value || ''}
                onChange={(e) => onUpdate(index, {
                  api_config: { ...source.api_config, api_key_value: e.target.value }
                })}
                placeholder="Your API key"
                type="password"
              />
            </FormGroup>
          </>
        )}

        <Button
          intent={Intent.PRIMARY}
          icon="play"
          text="Test Connection"
          loading={loading[index]}
          onClick={() => testAPIConnection(index)}
        />

        {testResults[index] && (
          <Callout
            style={{ marginTop: '10px' }}
            icon={testResults[index].success ? 'tick' : 'error'}
            intent={testResults[index].success ? Intent.SUCCESS : Intent.DANGER}
          >
            {testResults[index].success ? (
              <div>
                <strong>Connection successful!</strong>
                <p>Status: {testResults[index].status}</p>
                {testResults[index].fields && (
                  <div>
                    <p>Found {testResults[index].fields.length} fields:</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
                      {testResults[index].fields.slice(0, 10).map((field: string) => (
                        <Tag key={field} minimal>{field}</Tag>
                      ))}
                      {testResults[index].fields.length > 10 && (
                        <Tag minimal>+{testResults[index].fields.length - 10} more</Tag>
                      )}
                    </div>
                  </div>
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

  const renderRSSConfig = (source: any, index: number) => {
    if (!source.rss_config) {
      source.rss_config = {};
    }

    return (
      <>
        <FormGroup label="RSS Feed URL" labelInfo="(required)">
          <InputGroup
            value={source.rss_config?.url || ''}
            onChange={(e) => onUpdate(index, {
              rss_config: { ...source.rss_config, url: e.target.value }
            })}
            placeholder="https://example.com/feed.xml"
            intent={!source.rss_config?.url ? Intent.DANGER : Intent.NONE}
          />
        </FormGroup>

        <FormGroup label="Update Frequency">
          <HTMLSelect
            value={source.rss_config?.update_frequency || '15min'}
            onChange={(e) => onUpdate(index, {
              rss_config: { ...source.rss_config, update_frequency: e.target.value }
            })}
            fill
          >
            <option value="5min">Every 5 minutes</option>
            <option value="15min">Every 15 minutes</option>
            <option value="30min">Every 30 minutes</option>
            <option value="1hour">Every hour</option>
            <option value="6hours">Every 6 hours</option>
            <option value="daily">Daily</option>
          </HTMLSelect>
        </FormGroup>

        <Button
          intent={Intent.PRIMARY}
          icon="play"
          text="Test RSS Feed"
          loading={loading[index]}
          onClick={() => testRSSFeed(index)}
        />

        {testResults[index] && (
          <Callout
            style={{ marginTop: '10px' }}
            icon={testResults[index].success ? 'tick' : 'error'}
            intent={testResults[index].success ? Intent.SUCCESS : Intent.DANGER}
          >
            {testResults[index].success ? (
              <div>
                <strong>RSS feed validated!</strong>
                <p>Successfully connected to RSS feed</p>
                {testResults[index].fields && (
                  <div>
                    <p>Available RSS fields:</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
                      {testResults[index].fields.map((field: string) => (
                        <Tag key={field} minimal intent={Intent.SUCCESS}>{field}</Tag>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <strong>Failed to load RSS feed</strong>
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
          <option value="json">JSON</option>
          <option value="xml">XML</option>
          <option value="excel">Excel (XLSX)</option>
        </HTMLSelect>
      </FormGroup>
    </>
  );

  const renderConfigByType = (source: any, index: number) => {
    switch (source.type) {
      case 'api':
        return renderAPIConfig(source, index);
      case 'rss':
        return renderRSSConfig(source, index);
      case 'database':
        return renderDatabaseConfig(source, index);
      case 'file':
        return renderFileConfig(source, index);
      default:
        return null;
    }
  };

  if (dataSources.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <Icon icon="inbox" size={40} color="#5c7080" />
        <h3>No data sources to configure</h3>
        <p>Go back to add data sources</p>
      </div>
    );
  }

  return (
    <div className="datasource-config-step">
      <Tabs
        id="datasource-tabs"
        selectedTabId={`source-${activeTab}`}
        onChange={(newTab) => setActiveTab(parseInt(newTab.toString().split('-')[1]))}
      >
        {dataSources.map((source, index) => (
          <Tab
            key={index}
            id={`source-${index}`}
            title={
              <span>
                {source.name || `Source ${index + 1}`}
                {source.fields && source.fields.length > 0 && (
                  <Tag minimal intent={Intent.SUCCESS} style={{ marginLeft: '8px' }}>
                    {source.fields.length} fields
                  </Tag>
                )}
              </span>
            }
          />
        ))}
      </Tabs>

      <div style={{ marginTop: '20px' }}>
        {dataSources[activeTab] && (
          <Card>
            <h4>{dataSources[activeTab].name || 'Unnamed Source'}</h4>
            <Tag intent={Intent.PRIMARY}>{dataSources[activeTab].type?.toUpperCase()}</Tag>
            
            <Divider style={{ margin: '20px 0' }} />
            
            {renderConfigByType(dataSources[activeTab], activeTab)}
          </Card>
        )}
      </div>
    </div>
  );
};

export default DataSourceConfigStep;