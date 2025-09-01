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
  Tag,
  RadioGroup,
  Radio,
  Classes
} from '@blueprintjs/core';
import { APIEndpointConfig } from '../../../types/schema.types';
import { DataSource } from '../../../types/datasource.types';
import { useFetchProxy } from '../../../hooks/useFetchProxy';
import { JsonPathExplorer } from '../../JsonPathExplorer/JsonPathExplorer';

// Helper to extract field paths
function extractFieldPaths(obj: any, prefix = ''): Array<{ path: string; display: string }> {
  const fields: Array<{ path: string; display: string }> = [];
  
  if (!obj || typeof obj !== 'object') return fields;
  
  Object.keys(obj).forEach(key => {
    const path = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    const valuePreview = typeof value === 'string' 
      ? `"${value.substring(0, 30)}${value.length > 30 ? '...' : ''}"`
      : typeof value === 'number' || typeof value === 'boolean' 
      ? String(value)
      : Array.isArray(value) 
      ? `[${value.length} items]`
      : typeof value === 'object' && value !== null
      ? '{...}'
      : 'null';
    
    fields.push({ 
      path, 
      display: `${key} (${valuePreview})`
    });
    
    // Recurse for nested objects (but not arrays)
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      fields.push(...extractFieldPaths(value, path));
    }
  });
  
  return fields;
}

const getDefaultChannelLink = () => {
  // Option 1: Use current application URL
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  // Option 2: Use a configured base URL
  return import.meta.env.VITE_APP_URL || 'https://your-app.com';
};

const AppToaster = Toaster.create({
  position: Position.TOP,
});

interface OutputFormatStepProps {
  config: APIEndpointConfig;
  onUpdate: (updates: Partial<APIEndpointConfig>) => void;
}

const JsonPathSelector: React.FC<{
  data: any;
  onSelectItemsPath: (path: string) => void;
  selectedItemsPath: string;
}> = ({ data, onSelectItemsPath, selectedItemsPath }) => {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  const findArrayPaths = (obj: any, currentPath = ''): Array<{ path: string; count: number }> => {
    const arrayPaths: Array<{ path: string; count: number }> = [];
    
    if (!obj || typeof obj !== 'object') return arrayPaths;
    
    Object.keys(obj).forEach(key => {
      const path = currentPath ? `${currentPath}.${key}` : key;
      const value = obj[key];
      
      if (Array.isArray(value)) {
        arrayPaths.push({ path, count: value.length });
        // Don't recurse into arrays - we want the array itself, not its contents
      } else if (typeof value === 'object' && value !== null) {
        // Recurse into objects
        arrayPaths.push(...findArrayPaths(value, path));
      }
    });
    
    return arrayPaths;
  };

  const arrayPaths = findArrayPaths(data);

  return (
    <FormGroup label="Select the array containing RSS items" labelInfo="(required)">
      <RadioGroup
        onChange={(e) => onSelectItemsPath(e.currentTarget.value)}
        selectedValue={selectedItemsPath}
      >
        {arrayPaths.length === 0 ? (
          <Callout intent="warning">
            No arrays found in the data structure. Make sure your API returns an array of items.
          </Callout>
        ) : (
          arrayPaths.map(({ path, count }) => (
            <Radio 
              key={path} 
              value={path}
              label={
                <span>
                  <code>{path}</code> 
                  <Tag minimal intent={Intent.PRIMARY} style={{ marginLeft: 8 }}>
                    {count} items
                  </Tag>
                </span>
              }
            />
          ))
        )}
      </RadioGroup>
      
      {selectedItemsPath && arrayPaths.length > 0 && (
        <Callout intent="success" icon="tick" style={{ marginTop: 10 }}>
          RSS items will be generated from the <strong>{
            arrayPaths.find(a => a.path === selectedItemsPath)?.count || 0
          }</strong> items in <code>{selectedItemsPath}</code>
        </Callout>
      )}
    </FormGroup>
  );
};

const FieldSelector: React.FC<{
  sourcePath: string;
  sampleData: any;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}> = ({ sourcePath, sampleData, value, onChange, placeholder }) => {
  // Get sample item from the selected path
  const getSampleItem = () => {
    const parts = sourcePath.split('.');
    let current = sampleData;
    
    for (const part of parts) {
      current = current?.[part];
    }
    
    return Array.isArray(current) && current.length > 0 ? current[0] : null;
  };

  const sampleItem = getSampleItem();
  const availableFields = sampleItem ? extractFieldPaths(sampleItem) : [];

  return (
    <HTMLSelect
      value={value}
      onChange={(e) => onChange(e.target.value)}
      fill
    >
      <option value="">{placeholder || "Select field..."}</option>
      <optgroup label="Simple Fields">
        {availableFields
          .filter(f => !f.path.includes('.'))
          .map(field => (
            <option key={field.path} value={field.path}>
              {field.display}
            </option>
          ))}
      </optgroup>
      {availableFields.some(f => f.path.includes('.')) && (
        <optgroup label="Nested Fields">
          {availableFields
            .filter(f => f.path.includes('.'))
            .map(field => (
              <option key={field.path} value={field.path}>
                {field.display}
              </option>
            ))}
        </optgroup>
      )}
    </HTMLSelect>
  );
};

const RssMappingPreview: React.FC<{
  sampleData: any;
  itemsPath: string;
  fieldMappings: {
    title?: string;
    description?: string;
    link?: string;
    pubDate?: string;
    guid?: string;
    author?: string;
    category?: string;
  };
  channelInfo: {  // Add this prop type
    title: string;
    description: string;
    link: string;
  };
}> = ({ sampleData, itemsPath, fieldMappings, channelInfo }) => {  // Add channelInfo to props
  // Helper function to get value from a path like "data.items" or "author.name"
  const getValueFromPath = (obj: any, path: string): any => {
    if (!path || !obj) return null;
    
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) return null;
      current = current[part];
    }
    
    return current;
  };

  // Get the items array from the sample data
  const items = getValueFromPath(sampleData, itemsPath);
  
  if (!items || !Array.isArray(items) || items.length === 0) {
    return (
      <Callout intent="warning" icon="warning-sign" style={{ marginTop: 20 }}>
        No items found at path: <code>{itemsPath}</code>
      </Callout>
    );
  }

  // Get the first item as a sample
  const sampleItem = items[0];
  
  // Get field values
  const getFieldValue = (fieldPath?: string): string => {
    if (!fieldPath) return '[Not mapped]';
    const value = getValueFromPath(sampleItem, fieldPath);
    if (value === null || value === undefined) return '[No value]';
    if (typeof value === 'object') return '[Object]';
    if (Array.isArray(value)) return value.join(', ');
    return String(value);
  };

  return (
    <div style={{ marginTop: 20 }}>
      <h5>RSS Feed Preview</h5>
      <Card style={{ backgroundColor: '#f5f8fa', padding: 15, fontFamily: 'monospace', fontSize: 12 }}>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
{`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${channelInfo.title || '[Channel Title]'}</title>
    <description>${channelInfo.description || '[Channel Description]'}</description>
    <link>${channelInfo.link || '[Channel Link]'}</link>
    
    <!-- First item from ${items.length} total items -->
    <item>
      <title>${getFieldValue(fieldMappings.title)}</title>
      <description>${getFieldValue(fieldMappings.description)}</description>
      <link>${getFieldValue(fieldMappings.link)}</link>${fieldMappings.pubDate ? `
      <pubDate>${getFieldValue(fieldMappings.pubDate)}</pubDate>` : ''}${fieldMappings.guid ? `
      <guid>${getFieldValue(fieldMappings.guid)}</guid>` : ''}${fieldMappings.author ? `
      <author>${getFieldValue(fieldMappings.author)}</author>` : ''}${fieldMappings.category ? `
      <category>${getFieldValue(fieldMappings.category)}</category>` : ''}
    </item>
  </channel>
</rss>`}
        </pre>
      </Card>
      
      <Callout intent="success" icon="tick" style={{ marginTop: 10 }}>
        This preview shows the first item from {items.length} total items found at <code>{itemsPath}</code>
      </Callout>
    </div>
  );
};

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
    channelLink: getDefaultChannelLink(),
    ...config.outputSchema?.metadata
  });
  const [selectedDataSource, setSelectedDataSource] = useState<string>(
    formatOptions.sourceId || ''
  );
  const [sampleData, setSampleData] = useState<Record<string, any>>({});
  
  const { fetchViaProxy } = useFetchProxy();

  // Function to test a data source and discover its fields
  const testAndDiscoverFields = async (source: DataSource) => {
    setTestingSource(source.id);
    
    try {
      let fields: string[] = [];
      
      if (source.type === 'api') {
        // Handle different possible structures for API config
        let apiConfig: any = null;
        
        // Check different possible locations for API configuration
        if (source.config && typeof source.config === 'object') {
          // If config is an object, it might be the API config directly
          if ('url' in source.config) {
            apiConfig = source.config;
          }
          // Or it might be nested under api_config
          else if ('api_config' in source.config && source.config.api_config) {
            apiConfig = source.config.api_config;
          }
        }
        // Check if api_config is at root level
        else if ('api_config' in source && source.api_config) {
          apiConfig = source.api_config;
        }
        // Check if URL is at root level (legacy structure)
        else if ('url' in source) {
          apiConfig = {
            url: source.url,
            method: source.method || 'GET',
            headers: source.headers || {}
          };
        }
        
        // Debug log to see the structure
        console.log('Data source structure:', {
          id: source.id,
          type: source.type,
          config: source.config,
          api_config: source.api_config,
          url: source.url
        });
        
        if (!apiConfig || !apiConfig.url) {
          AppToaster.show({
            message: `API URL not found for ${source.name}. Please check the data source configuration.`,
            intent: 'warning'
          });
          return;
        }
        
        try {
          // Use fetchViaProxy for the API request
          const result = await fetchViaProxy(apiConfig.url, {
            method: apiConfig.method || 'GET',
            headers: apiConfig.headers || {},
            body: apiConfig.body
          });
          
          // The data from fetchViaProxy is in result.data
          let data = result.data;

          setSampleData(prev => ({
            ...prev,
            [source.id]: data // Store the full response data
          }));
          
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
          const dataPath = apiConfig.data_path || apiConfig.dataPath;
          if (dataPath) {
            const pathParts = dataPath.split('.');
            for (const part of pathParts) {
              if (targetData && typeof targetData === 'object' && part in targetData) {
                targetData = targetData[part];
              } else {
                console.warn(`Data path "${dataPath}" not found in response`);
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
        // Handle database sources...
        AppToaster.show({
          message: 'Database field discovery requires the data source to be synced first',
          intent: 'warning'
        });
        return;
        
      } else if (source.type === 'file') {
        // Handle file sources...
        if (source.fields && source.fields.length > 0) {
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
      
      // Rest of the function remains the same...
      if (fields.length > 0) {
        setDiscoveredFields(prev => ({
          ...prev,
          [source.id]: fields
        }));
        
        const updatedSources = config.dataSources.map(s => 
          s.id === source.id 
            ? { ...s, fields } 
            : s
        );
        
        onUpdate({ dataSources: updatedSources });
        
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
            {/* Channel Configuration */}
            <Card style={{ marginBottom: 20 }}>
              <h4>RSS Channel Settings</h4>
              
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

              <FormGroup 
                label="Channel Link" 
                labelInfo="(auto-generated)"
                helperText="The homepage URL for this RSS feed"
              >
                <InputGroup
                  value={formatOptions.channelLink || getDefaultChannelLink()}
                  onChange={(e) => updateFormatOption('channelLink', e.target.value)}
                  placeholder="https://example.com"
                  disabled={false} // Set to true if you want it read-only
                  leftIcon="link"
                  rightElement={
                    <Button
                      minimal
                      icon="refresh"
                      title="Reset to default"
                      onClick={() => updateFormatOption('channelLink', getDefaultChannelLink())}
                    />
                  }
                />
              </FormGroup>
            </Card>

            {/* Data Source Selection and Field Discovery */}
            <Card style={{ marginBottom: 20 }}>
              <h4>Data Source & Field Mapping</h4>
              
              {config.dataSources.length === 0 ? (
                <Callout intent="warning" icon="warning-sign">
                  No data sources selected. Please go back and select at least one data source.
                </Callout>
              ) : (
                <>
                  <FormGroup label="Select Data Source for RSS Items">
                    <HTMLSelect
                      value={selectedDataSource || ''}
                      onChange={(e) => {
                        setSelectedDataSource(e.target.value);
                        // Reset field mappings when changing source
                        updateFormatOption('sourceId', e.target.value);
                        updateFormatOption('itemsPath', '');
                        updateFormatOption('fieldMappings', {});
                      }}
                      fill
                    >
                      <option value="">-- Select a data source --</option>
                      {config.dataSources.map(source => (
                        <option key={source.id} value={source.id}>
                          {source.name} ({source.type})
                        </option>
                      ))}
                    </HTMLSelect>
                  </FormGroup>

                  {selectedDataSource && (
                    <div style={{ marginTop: 15 }}>
                      {!discoveredFields[selectedDataSource] ? (
                        <Callout intent="warning" icon="info-sign">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <strong>Field discovery needed</strong>
                              <p style={{ margin: 0 }}>Click analyze to discover available fields in this data source.</p>
                            </div>
                            <Button
                              intent="primary"
                              loading={testingSource === selectedDataSource}
                              onClick={() => testAndDiscoverFields(
                                config.dataSources.find(s => s.id === selectedDataSource)!
                              )}
                              icon="search"
                              text="Analyze"
                            />
                          </div>
                        </Callout>
                      ) : (
                        <>
                          {/* Show sample data structure if available */}
                          {sampleData[selectedDataSource] && (
                            <JsonPathSelector
                              data={sampleData[selectedDataSource]}
                              onSelectItemsPath={(path) => updateFormatOption('itemsPath', path)}
                              selectedItemsPath={formatOptions.itemsPath || ''}
                            />
                          )}
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </Card>

            {/* Field Mapping */}
            {selectedDataSource && formatOptions.itemsPath && (
              <Card style={{ marginBottom: 20 }}>
                <h4>RSS Field Mapping</h4>
                <p className={Classes.TEXT_MUTED}>
                  Map fields from your data to RSS elements. 
                  Items will be extracted from: <Tag intent="primary">{formatOptions.itemsPath}</Tag>
                </p>

                <FormGroup label="Title Field" labelInfo="(required)">
                  <FieldSelector
                    sourcePath={formatOptions.itemsPath}
                    sampleData={sampleData[selectedDataSource]}
                    value={formatOptions.titleField || ''}
                    onChange={(value) => updateFormatOption('titleField', value)}
                    placeholder="Select or type field path..."
                  />
                </FormGroup>

                <FormGroup label="Description Field" labelInfo="(required)">
                  <FieldSelector
                    sourcePath={formatOptions.itemsPath}
                    sampleData={sampleData[selectedDataSource]}
                    value={formatOptions.descriptionField || ''}
                    onChange={(value) => updateFormatOption('descriptionField', value)}
                    placeholder="Select or type field path..."
                  />
                </FormGroup>

                <FormGroup label="Link Field" labelInfo="(required)">
                  <FieldSelector
                    sourcePath={formatOptions.itemsPath}
                    sampleData={sampleData[selectedDataSource]}
                    value={formatOptions.linkField || ''}
                    onChange={(value) => updateFormatOption('linkField', value)}
                    placeholder="Select or type field path..."
                  />
                </FormGroup>

                <FormGroup label="Publication Date Field">
                  <FieldSelector
                    sourcePath={formatOptions.itemsPath}
                    sampleData={sampleData[selectedDataSource]}
                    value={formatOptions.pubDateField || ''}
                    onChange={(value) => updateFormatOption('pubDateField', value)}
                    placeholder="Select or type field path..."
                  />
                </FormGroup>

                <FormGroup label="GUID Field" helperText="Unique identifier for each item">
                  <FieldSelector
                    sourcePath={formatOptions.itemsPath}
                    sampleData={sampleData[selectedDataSource]}
                    value={formatOptions.guidField || ''}
                    onChange={(value) => updateFormatOption('guidField', value)}
                    placeholder="Select or type field path..."
                  />
                </FormGroup>

                <FormGroup label="Author Field">
                  <FieldSelector
                    sourcePath={formatOptions.itemsPath}
                    sampleData={sampleData[selectedDataSource]}
                    value={formatOptions.authorField || ''}
                    onChange={(value) => updateFormatOption('authorField', value)}
                    placeholder="Select or type field path..."
                  />
                </FormGroup>

                <FormGroup label="Category Field">
                  <FieldSelector
                    sourcePath={formatOptions.itemsPath}
                    sampleData={sampleData[selectedDataSource]}
                    value={formatOptions.categoryField || ''}
                    onChange={(value) => updateFormatOption('categoryField', value)}
                    placeholder="Select or type field path..."
                  />
                </FormGroup>

                {/* Preview Section */}
                {sampleData[selectedDataSource] && (
                  <RssMappingPreview
                    sampleData={sampleData[selectedDataSource]}
                    itemsPath={formatOptions.itemsPath}
                    channelInfo={{  // Add this prop
                      title: formatOptions.channelTitle || '',
                      description: formatOptions.channelDescription || '',
                      link: formatOptions.channelLink || ''
                    }}
                    fieldMappings={{
                      title: formatOptions.titleField,
                      description: formatOptions.descriptionField,
                      link: formatOptions.linkField,
                      pubDate: formatOptions.pubDateField,
                      guid: formatOptions.guidField,
                      author: formatOptions.authorField,
                      category: formatOptions.categoryField
                    }}
                  />
                )}
              </Card>
            )}
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