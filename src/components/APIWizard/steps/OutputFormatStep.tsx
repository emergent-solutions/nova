import React, { useState } from 'react';
import {
  Card,
  Icon,
  FormGroup,
  InputGroup,
  Switch,
  HTMLSelect,
  TextArea,
  NumericInput,
  Button,
  Callout,
  Intent,
  Spinner, 
  Toaster, 
  Position, 
  NonIdealState, 
  Tag
} from '@blueprintjs/core';
import { APIEndpointConfig } from '../../../types/schema.types';
import { useFetchProxy } from '../../../hooks/useFetchProxy';

const AppToaster = Toaster.create({
  position: Position.TOP,
});

interface OutputFormatStepProps {
  config: APIEndpointConfig;
  onUpdate: (updates: Partial<APIEndpointConfig>) => void;
}

const OutputFormatStep: React.FC<OutputFormatStepProps> = ({ config, onUpdate }) => {
  console.log('OutputFormatStep - config:', config);
  console.log('OutputFormatStep - dataSources:', config.dataSources);
  console.log('OutputFormatStep - dataSources length:', config.dataSources?.length);
  console.log('OutputFormatStep - first data source:', config.dataSources?.[0]);

  const [loadingFields, setLoadingFields] = useState<string[]>([]);
  const [testingSource, setTestingSource] = useState<string | null>(null);
  const [discoveredFields, setDiscoveredFields] = useState<Record<string, string[]>>({});
  const [format, setFormat] = useState(config.outputFormat || 'json');
  const [formatOptions, setFormatOptions] = useState<any>({
    prettyPrint: true,
    includeMetadata: true,
    rootWrapper: 'data',
    ...config.outputSchema?.metadata
  });

  const { fetchViaProxy } = useFetchProxy();

  // Function to test a data source and discover its fields
  const testAndDiscoverFields = async (source: DataSource) => {
    setTestingSource(source.id);
    
    try {
      let fields: string[] = [];
      
      if (source.type === 'api') {
        const apiConfig = source.config as APIDataSourceConfig;
        
        try {
          // Use fetchViaProxy for the API request
          const result = await fetchViaProxy(apiConfig.url, {
            method: apiConfig.method || 'GET',
            headers: apiConfig.headers || {},
            body: apiConfig.body
          });
          
          // The data from fetchViaProxy is in result.data
          let data = result.data;
          
          // Parse JSON if it's a string
          if (typeof data === 'string') {
            try {
              data = JSON.parse(data);
            } catch (e) {
              console.warn('Response is not JSON:', e);
              AppToaster.show({
                message: 'API returned non-JSON response',
                intent: 'warning'
              });
              return;
            }
          }
          
          // Navigate to the data path if specified
          let targetData = data;
          if (apiConfig.data_path) {
            const pathParts = apiConfig.data_path.split('.');
            for (const part of pathParts) {
              if (targetData && typeof targetData === 'object' && part in targetData) {
                targetData = targetData[part];
              } else {
                console.warn(`Data path "${apiConfig.data_path}" not found in response`);
                break;
              }
            }
          }
          
          // Extract fields from the response
          if (Array.isArray(targetData) && targetData.length > 0) {
            // If it's an array, get fields from the first item
            const firstItem = targetData[0];
            if (typeof firstItem === 'object' && firstItem !== null) {
              fields = Object.keys(firstItem);
            }
          } else if (typeof targetData === 'object' && targetData !== null && !Array.isArray(targetData)) {
            // If it's an object, get its keys
            fields = Object.keys(targetData);
          }
          
          // Filter out internal/system fields
          fields = fields.filter(field => 
            !field.startsWith('_') && 
            !field.startsWith('$') &&
            field !== '__typename' // GraphQL artifact
          );
          
        } catch (error: any) {
          console.error('API request failed:', error);
          AppToaster.show({
            message: `Failed to test API: ${error.message || 'Unknown error'}`,
            intent: 'danger'
          });
          return;
        }
        
      } else if (source.type === 'database') {
        // For database sources, you might need a different endpoint
        AppToaster.show({
          message: 'Database field discovery requires the data source to be synced first',
          intent: 'warning'
        });
        return;
        
      } else if (source.type === 'file') {
        // For file sources, check if fields are already stored
        const fileConfig = source.config as any;
        if (fileConfig.headers && fileConfig.headers.length > 0) {
          fields = fileConfig.headers;
        } else if (source.fields && source.fields.length > 0) {
          fields = source.fields;
        } else {
          AppToaster.show({
            message: 'File source needs to be synced first to discover fields',
            intent: 'warning'
          });
          return;
        }
        
      } else if (source.type === 'rss') {
        // RSS feeds have standard fields
        fields = [
          'title', 
          'description', 
          'link', 
          'pubDate', 
          'guid', 
          'author', 
          'category', 
          'content',
          'enclosure',
          'source'
        ];
      }
      
      if (fields.length > 0) {
        // Store discovered fields locally
        setDiscoveredFields(prev => ({
          ...prev,
          [source.id]: fields
        }));
        
        // Update the data source in config with the discovered fields
        const updatedSources = config.dataSources.map(s => 
          s.id === source.id 
            ? { ...s, fields } 
            : s
        );
        
        onUpdate({ dataSources: updatedSources });
        
        // Also store sample data if we got any
        if (source.type === 'api' && !source.sample_data) {
          const apiConfig = source.config as APIDataSourceConfig;
          const result = await fetchViaProxy(apiConfig.url, {
            method: apiConfig.method || 'GET',
            headers: apiConfig.headers || {},
            body: apiConfig.body
          });
          
          let sampleData = result.data;
          if (apiConfig.data_path) {
            const pathParts = apiConfig.data_path.split('.');
            for (const part of pathParts) {
              if (sampleData && typeof sampleData === 'object' && part in sampleData) {
                sampleData = sampleData[part];
              }
            }
          }
          
          // Store up to 5 sample items
          if (Array.isArray(sampleData)) {
            const samples = sampleData.slice(0, 5);
            const updatedWithSamples = config.dataSources.map(s => 
              s.id === source.id 
                ? { ...s, fields, sample_data: samples } 
                : s
            );
            onUpdate({ dataSources: updatedWithSamples });
          }
        }
        
        AppToaster.show({
          message: `Discovered ${fields.length} fields from ${source.name}`,
          intent: 'success'
        });
      } else {
        AppToaster.show({
          message: 'No fields found in the response',
          intent: 'warning'
        });
      }
      
    } catch (error: any) {
      console.error('Failed to discover fields:', error);
      AppToaster.show({
        message: `Failed to test ${source.name}: ${error.message || 'Unknown error'}`,
        intent: 'danger'
      });
    } finally {
      setTestingSource(null);
    }
  };

  const fetchFieldsForSource = async (sourceId: string) => {
    setLoadingFields([...loadingFields, sourceId]);
    
    try {
      // Call your API to analyze the data source
      const response = await fetch(`/api/data-sources/${sourceId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const { fields } = await response.json();
        
        // Update the data source with discovered fields
        const updatedSources = config.dataSources.map(source => 
          source.id === sourceId 
            ? { ...source, fields } 
            : source
        );
        
        onUpdate({ dataSources: updatedSources });
      }
    } catch (error) {
      console.error('Failed to fetch fields:', error);
    } finally {
      setLoadingFields(loadingFields.filter(id => id !== sourceId));
    }
  };

  const handleFormatChange = (newFormat: typeof format) => {
    setFormat(newFormat);
    onUpdate({ 
      outputFormat: newFormat,
      outputSchema: {
        ...config.outputSchema,
        format: newFormat
      }
    });
  };

  const updateFormatOption = (key: string, value: any) => {
    const updated = { ...formatOptions, [key]: value };
    setFormatOptions(updated);
    onUpdate({
      outputSchema: {
        ...config.outputSchema,
        metadata: updated
      }
    });
  };

  const getAllFields = () => {
    const fields: string[] = [];
    
    config.dataSources.forEach(source => {
      // Check discovered fields first
      if (discoveredFields[source.id]) {
        fields.push(...discoveredFields[source.id]);
      }
      // Then check stored fields
      else if (source.fields && source.fields.length > 0) {
        fields.push(...source.fields);
      }
      // Method 2: Extract from sample_data if available
      else if (source.sample_data && source.sample_data.length > 0) {
        const firstItem = source.sample_data[0];
        
        // Handle different data structures
        if (typeof firstItem === 'object' && firstItem !== null) {
          // For API sources with data_path, the sample might be nested
          const apiConfig = source.config as any;
          let dataToAnalyze = firstItem;
          
          // If there's a data_path, try to navigate to it
          if (source.type === 'api' && apiConfig?.data_path) {
            const pathParts = apiConfig.data_path.split('.');
            let current = firstItem;
            
            for (const part of pathParts) {
              if (current && typeof current === 'object' && part in current) {
                current = current[part];
              }
            }
            
            // If we found data at the path and it's an array, use the first item
            if (Array.isArray(current) && current.length > 0) {
              dataToAnalyze = current[0];
            } else if (typeof current === 'object') {
              dataToAnalyze = current;
            }
          }
          
          // Extract fields from the data
          if (typeof dataToAnalyze === 'object' && dataToAnalyze !== null) {
            Object.keys(dataToAnalyze).forEach(key => {
              // Skip internal fields
              if (!key.startsWith('_') && !key.startsWith('$')) {
                fields.push(key);
              }
            });
          }
        }
      }
      // Method 3: For specific source types, provide common fields
      else if (source.type === 'rss') {
        // RSS feeds typically have these fields
        fields.push('title', 'description', 'link', 'pubDate', 'guid', 'author', 'category', 'content');
      }
    });
    
    // If still no fields found, log a warning
    if (fields.length === 0) {
      console.warn('No fields detected in data sources. Sources:', config.dataSources);
    }
    
    // Remove duplicates and return
    return [...new Set(fields)];
  };
  
  // Helper function to recursively extract keys from nested objects
  const extractKeys = (obj: any, prefix: string = ''): string[] => {
    const keys: string[] = [];
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        
        if (obj[key] !== null && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
          // For nested objects, add both the key and nested keys
          keys.push(fullKey);
          keys.push(...extractKeys(obj[key], fullKey));
        } else {
          keys.push(fullKey);
        }
      }
    }
    
    return keys;
  };

  const renderDataSourceTesting = () => (
    <Card className="data-source-testing" style={{ marginBottom: 20 }}>
      <h4>Data Source Fields</h4>
      <div className="source-list">
        {config.dataSources.map(source => {
          const sourceFields = source.fields || discoveredFields[source.id] || [];
          const hasFields = sourceFields.length > 0;
          
          return (
            <div key={source.id} className="source-item" style={{ 
              padding: '10px',
              marginBottom: '10px',
              border: '1px solid #e1e8ed',
              borderRadius: '4px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{source.name}</strong>
                  <Tag minimal style={{ marginLeft: 8 }}>
                    {source.type.toUpperCase()}
                  </Tag>
                  {hasFields && (
                    <Tag minimal intent="success" style={{ marginLeft: 4 }}>
                      {sourceFields.length} fields
                    </Tag>
                  )}
                </div>
                <Button
                  small
                  intent={hasFields ? "none" : "primary"}
                  loading={testingSource === source.id}
                  disabled={testingSource !== null && testingSource !== source.id}
                  onClick={() => testAndDiscoverFields(source)}
                  icon={hasFields ? "refresh" : "search"}
                  text={hasFields ? "Re-test" : "Discover Fields"}
                />
              </div>
              
              {hasFields && (
                <div style={{ marginTop: 8, fontSize: '12px', color: '#5c7080' }}>
                  Fields: {sourceFields.slice(0, 5).join(', ')}
                  {sourceFields.length > 5 && ` ... and ${sourceFields.length - 5} more`}
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {config.dataSources.length === 0 && (
        <NonIdealState
          icon="database"
          title="No data sources"
          description="Add data sources in the previous step"
        />
      )}
    </Card>
  );

  return (
    <div className="output-format-step">
      <Card style={{ marginBottom: 20, background: '#f5f5f5' }}>
        <h4>Debug Info</h4>
        <p>Data Sources Count: {config.dataSources?.length || 0}</p>
        <p>Data Sources: {JSON.stringify(config.dataSources?.map(ds => ({
          id: ds.id,
          name: ds.name,
          type: ds.type,
          fields: ds.fields?.length || 0
        })))}</p>
      </Card>
      
      <Callout intent={Intent.PRIMARY} icon="info-sign">
        Choose how your API will format and deliver data to consumers.
      </Callout>

      {renderDataSourceTesting()}

      <div className="format-selector">
        <h4>Select Output Format</h4>
        <div className="format-options-grid">
          <Card
            interactive
            className={`format-card ${format === 'json' ? 'selected' : ''}`}
            onClick={() => handleFormatChange('json')}
          >
            <Icon icon="code-block" size={30} />
            <h5>JSON</h5>
            <p>RESTful JSON API</p>
            <small>Most common, works with all clients</small>
          </Card>

          <Card
            interactive
            className={`format-card ${format === 'xml' ? 'selected' : ''}`}
            onClick={() => handleFormatChange('xml')}
          >
            <Icon icon="code" size={30} />
            <h5>XML</h5>
            <p>XML formatted responses</p>
            <small>Enterprise systems, SOAP services</small>
          </Card>

          <Card
            interactive
            className={`format-card ${format === 'rss' ? 'selected' : ''}`}
            onClick={() => handleFormatChange('rss')}
          >
            <Icon icon="feed" size={30} />
            <h5>RSS</h5>
            <p>RSS 2.0 Feed</p>
            <small>News feeds, content syndication</small>
          </Card>

          <Card
            interactive
            className={`format-card ${format === 'atom' ? 'selected' : ''}`}
            onClick={() => handleFormatChange('atom')}
          >
            <Icon icon="feed" size={30} />
            <h5>ATOM</h5>
            <p>ATOM 1.0 Feed</p>
            <small>Modern feed format, blogs & podcasts</small>
          </Card>

          <Card
            interactive
            className={`format-card ${format === 'csv' ? 'selected' : ''}`}
            onClick={() => handleFormatChange('csv')}
          >
            <Icon icon="th" size={30} />
            <h5>CSV</h5>
            <p>Comma-separated values</p>
            <small>Spreadsheets, data analysis</small>
          </Card>
        </div>
      </div>

      <Card className="format-settings">
        <h4>{format.toUpperCase()} Settings</h4>
        
        {format === 'json' && (
          <>
            <FormGroup label="Root Wrapper Field">
              <InputGroup
                value={formatOptions.rootWrapper}
                onChange={(e) => updateFormatOption('rootWrapper', e.target.value)}
                placeholder="e.g., data, results, items"
              />
            </FormGroup>

            <Switch
              label="Pretty print (formatted output)"
              checked={formatOptions.prettyPrint}
              onChange={(e) => updateFormatOption('prettyPrint', e.target.checked)}
            />

            <Switch
              label="Include metadata (pagination, timestamps)"
              checked={formatOptions.includeMetadata}
              onChange={(e) => updateFormatOption('includeMetadata', e.target.checked)}
            />

            <Switch
              label="Include null values"
              checked={formatOptions.includeNulls}
              onChange={(e) => updateFormatOption('includeNulls', e.target.checked)}
            />

            <FormGroup label="Date Format">
              <HTMLSelect
                value={formatOptions.dateFormat || 'ISO'}
                onChange={(e) => updateFormatOption('dateFormat', e.target.value)}
              >
                <option value="ISO">ISO 8601 (2024-01-01T12:00:00Z)</option>
                <option value="unix">Unix Timestamp (1704106800)</option>
                <option value="custom">Custom Format</option>
              </HTMLSelect>
            </FormGroup>
          </>
        )}

        {format === 'xml' && (
          <>
            <FormGroup label="Root Element Name">
              <InputGroup
                value={formatOptions.rootElement || 'response'}
                onChange={(e) => updateFormatOption('rootElement', e.target.value)}
              />
            </FormGroup>

            <FormGroup label="XML Namespace">
              <InputGroup
                value={formatOptions.namespace}
                onChange={(e) => updateFormatOption('namespace', e.target.value)}
                placeholder="Optional"
              />
            </FormGroup>

            <Switch
              label="Include XML declaration"
              checked={formatOptions.includeDeclaration !== false}
              onChange={(e) => updateFormatOption('includeDeclaration', e.target.checked)}
            />

            <Switch
              label="Use attributes instead of elements"
              checked={formatOptions.useAttributes}
              onChange={(e) => updateFormatOption('useAttributes', e.target.checked)}
            />
          </>
        )}

        {format === 'rss' && (
          <>
            {/* Add this warning/action if no fields are available */}
            {getAllFields().length === 0 && (
              <Callout intent="warning" icon="warning-sign" style={{ marginBottom: 20 }}>
                No fields detected in your data sources. 
                {config.dataSources.map(source => (
                  !source.fields || source.fields.length === 0 ? (
                    <div key={source.id} style={{ marginTop: 10 }}>
                      <Button
                        small
                        intent="primary"
                        loading={loadingFields.includes(source.id)}
                        onClick={() => fetchFieldsForSource(source.id)}
                        text={`Analyze ${source.name}`}
                        icon="refresh"
                      />
                    </div>
                  ) : null
                ))}
              </Callout>
            )}

            <FormGroup label="Channel Title" labelInfo="(required)">
              <InputGroup
                value={formatOptions.channelTitle}
                onChange={(e) => updateFormatOption('channelTitle', e.target.value)}
                placeholder="My API Feed"
              />
            </FormGroup>

            <FormGroup label="Channel Description" labelInfo="(required)">
              <TextArea
                value={formatOptions.channelDescription}
                onChange={(e) => updateFormatOption('channelDescription', e.target.value)}
                placeholder="Description of your feed"
                rows={2}
              />
            </FormGroup>

            <FormGroup label="Channel Link">
              <InputGroup
                value={formatOptions.channelLink}
                onChange={(e) => updateFormatOption('channelLink', e.target.value)}
                placeholder="https://example.com"
              />
            </FormGroup>

            <FormGroup label="Title Field">
              <HTMLSelect
                value={formatOptions.titleField}
                onChange={(e) => updateFormatOption('titleField', e.target.value)}
              >
                <option value="">Select field...</option>
                {getAllFields().map(field => (
                  <option key={field} value={field}>{field}</option>
                ))}
              </HTMLSelect>
            </FormGroup>

            <FormGroup label="Description Field">
              <HTMLSelect
                value={formatOptions.descriptionField}
                onChange={(e) => updateFormatOption('descriptionField', e.target.value)}
              >
                <option value="">Select field...</option>
                {getAllFields().map(field => (
                  <option key={field} value={field}>{field}</option>
                ))}
              </HTMLSelect>
            </FormGroup>

            <FormGroup label="Link Field">
              <HTMLSelect
                value={formatOptions.linkField}
                onChange={(e) => updateFormatOption('linkField', e.target.value)}
              >
                <option value="">Select field...</option>
                {getAllFields().map(field => (
                  <option key={field} value={field}>{field}</option>
                ))}
              </HTMLSelect>
            </FormGroup>

            <FormGroup label="Publication Date Field">
              <HTMLSelect
                value={formatOptions.pubDateField}
                onChange={(e) => updateFormatOption('pubDateField', e.target.value)}
              >
                <option value="">Select field...</option>
                {getAllFields().map(field => (
                  <option key={field} value={field}>{field}</option>
                ))}
              </HTMLSelect>
            </FormGroup>
          </>
        )}

        {format === 'atom' && (
          <>
            <FormGroup label="Feed ID" labelInfo="(required - unique URI)">
              <InputGroup
                value={formatOptions.feedId}
                onChange={(e) => updateFormatOption('feedId', e.target.value)}
                placeholder="https://example.com/feed"
              />
            </FormGroup>

            <FormGroup label="Feed Title" labelInfo="(required)">
              <InputGroup
                value={formatOptions.feedTitle}
                onChange={(e) => updateFormatOption('feedTitle', e.target.value)}
                placeholder="My ATOM Feed"
              />
            </FormGroup>

            <FormGroup label="Feed Subtitle">
              <TextArea
                value={formatOptions.feedSubtitle}
                onChange={(e) => updateFormatOption('feedSubtitle', e.target.value)}
                placeholder="Description of your feed"
                rows={2}
              />
            </FormGroup>

            <FormGroup label="Feed Link">
              <InputGroup
                value={formatOptions.feedLink}
                onChange={(e) => updateFormatOption('feedLink', e.target.value)}
                placeholder="https://example.com"
              />
            </FormGroup>

            <FormGroup label="Author Name">
              <InputGroup
                value={formatOptions.authorName}
                onChange={(e) => updateFormatOption('authorName', e.target.value)}
                placeholder="Feed Author"
              />
            </FormGroup>

            <FormGroup label="Author Email">
              <InputGroup
                value={formatOptions.authorEmail}
                onChange={(e) => updateFormatOption('authorEmail', e.target.value)}
                placeholder="author@example.com"
              />
            </FormGroup>

            <h5 style={{ marginTop: '20px', marginBottom: '10px' }}>Entry Field Mappings</h5>

            <FormGroup label="Title Field" labelInfo="(required)">
              <HTMLSelect
                value={formatOptions.titleField}
                onChange={(e) => updateFormatOption('titleField', e.target.value)}
              >
                <option value="">Select field...</option>
                {getAllFields().map(field => (
                  <option key={field} value={field}>{field}</option>
                ))}
              </HTMLSelect>
            </FormGroup>

            <FormGroup label="ID Field" labelInfo="(required - unique identifier)">
              <HTMLSelect
                value={formatOptions.idField}
                onChange={(e) => updateFormatOption('idField', e.target.value)}
              >
                <option value="">Select field...</option>
                {getAllFields().map(field => (
                  <option key={field} value={field}>{field}</option>
                ))}
              </HTMLSelect>
            </FormGroup>

            <FormGroup label="Summary Field" labelInfo="(required)">
              <HTMLSelect
                value={formatOptions.summaryField}
                onChange={(e) => updateFormatOption('summaryField', e.target.value)}
              >
                <option value="">Select field...</option>
                {getAllFields().map(field => (
                  <option key={field} value={field}>{field}</option>
                ))}
              </HTMLSelect>
            </FormGroup>

            <FormGroup label="Content Field" labelInfo="(optional - full content)">
              <HTMLSelect
                value={formatOptions.contentField}
                onChange={(e) => updateFormatOption('contentField', e.target.value)}
              >
                <option value="">Select field...</option>
                {getAllFields().map(field => (
                  <option key={field} value={field}>{field}</option>
                ))}
              </HTMLSelect>
            </FormGroup>

            <FormGroup label="Link Field">
              <HTMLSelect
                value={formatOptions.linkField}
                onChange={(e) => updateFormatOption('linkField', e.target.value)}
              >
                <option value="">Select field...</option>
                {getAllFields().map(field => (
                  <option key={field} value={field}>{field}</option>
                ))}
              </HTMLSelect>
            </FormGroup>

            <FormGroup label="Updated Date Field">
              <HTMLSelect
                value={formatOptions.updatedField}
                onChange={(e) => updateFormatOption('updatedField', e.target.value)}
              >
                <option value="">Select field...</option>
                {getAllFields().map(field => (
                  <option key={field} value={field}>{field}</option>
                ))}
              </HTMLSelect>
            </FormGroup>

            <FormGroup label="Published Date Field">
              <HTMLSelect
                value={formatOptions.publishedField}
                onChange={(e) => updateFormatOption('publishedField', e.target.value)}
              >
                <option value="">Select field...</option>
                {getAllFields().map(field => (
                  <option key={field} value={field}>{field}</option>
                ))}
              </HTMLSelect>
            </FormGroup>

            <FormGroup label="Categories Field" labelInfo="(optional)">
              <HTMLSelect
                value={formatOptions.categoriesField}
                onChange={(e) => updateFormatOption('categoriesField', e.target.value)}
              >
                <option value="">None</option>
                {getAllFields().map(field => (
                  <option key={field} value={field}>{field}</option>
                ))}
              </HTMLSelect>
            </FormGroup>
          </>
        )}

        {format === 'csv' && (
          <>
            <FormGroup label="Delimiter">
              <HTMLSelect
                value={formatOptions.delimiter || ','}
                onChange={(e) => updateFormatOption('delimiter', e.target.value)}
              >
                <option value=",">Comma (,)</option>
                <option value=";">Semicolon (;)</option>
                <option value="\t">Tab</option>
                <option value="|">Pipe (|)</option>
              </HTMLSelect>
            </FormGroup>

            <Switch
              label="Include headers"
              checked={formatOptions.includeHeaders !== false}
              onChange={(e) => updateFormatOption('includeHeaders', e.target.checked)}
            />

            <Switch
              label="Quote strings"
              checked={formatOptions.quoteStrings}
              onChange={(e) => updateFormatOption('quoteStrings', e.target.checked)}
            />

            <FormGroup label="Line Ending">
              <HTMLSelect
                value={formatOptions.lineEnding || 'LF'}
                onChange={(e) => updateFormatOption('lineEnding', e.target.value)}
              >
                <option value="LF">LF (Unix/Mac)</option>
                <option value="CRLF">CRLF (Windows)</option>
              </HTMLSelect>
            </FormGroup>
          </>
        )}
      </Card>
    </div>
  );
};

export default OutputFormatStep;