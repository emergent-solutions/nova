import React, { useState, useRef, useEffect } from 'react';
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
  Classes,
  Divider
} from '@blueprintjs/core';
import { APIEndpointConfig } from '../../../types/schema.types';
import { DataSource } from '../../../types/datasource.types';
import { useFetchProxy } from '../../../hooks/useFetchProxy';
import { JsonFieldMapper } from '../../JsonFieldMapper';
import { OpenAPIImport } from '../components/OpenAPIImport';
import { extractFields } from '../../JsonFieldMapper/utils/fieldExtraction';


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

const AppToaster = Toaster.create({
  position: Position.TOP,
});

interface RSSSourceMapping {
  sourceId: string;
  itemsPath: string;
  fieldMappings: {
    title: string;
    description: string;
    link: string;
    pubDate?: string;
    guid?: string;
    author?: string;
    category?: string;
  };
  enabled: boolean;
}

interface OutputFormatStepProps {
  config: APIEndpointConfig;
  onUpdate: (updates: Partial<APIEndpointConfig>) => void;
  initialSampleData?: Record<string, any>;
  onSampleDataChange?: (data: Record<string, any>) => void;
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

const RSSMultiSourceConfiguration: React.FC<{
  config: any;
  formatOptions: any;
  updateFormatOption: (key: string, value: any) => void;
  sampleData: Record<string, any>;
  discoveredFields: Record<string, string[]>;
  testAndDiscoverFields: (source: any) => void;
  testingSource: string | null;
}> = ({ 
  config, 
  formatOptions, 
  updateFormatOption, 
  sampleData,
  discoveredFields,
  testAndDiscoverFields,
  testingSource 
}) => {
  // Initialize source mappings if not exists
  const [sourceMappings, setSourceMappings] = useState<RSSSourceMapping[]>(() => {
    // If we have saved mappings, use them
    if (formatOptions.sourceMappings && formatOptions.sourceMappings.length > 0) {
      // Ensure all current data sources are represented
      const savedMappings = formatOptions.sourceMappings;
      const mappingsBySourceId = new Map(
        savedMappings.map(m => [m.sourceId, m])
      );
      
      // Create mappings for all data sources, using saved data where available
      return config.dataSources.map(source => {
        const savedMapping = mappingsBySourceId.get(source.id);
        
        if (savedMapping) {
          // Use the saved mapping
          return savedMapping;
        } else {
          // Create a new empty mapping for this source
          return {
            sourceId: source.id,
            itemsPath: '',
            fieldMappings: {
              title: '',
              description: '',
              link: '',
              pubDate: '',
              guid: '',
              author: '',
              category: ''
            },
            enabled: false
          };
        }
      });
    } else {
      // No saved mappings, create empty ones for each data source
      return config.dataSources.map(source => ({
        sourceId: source.id,
        itemsPath: '',
        fieldMappings: {
          title: '',
          description: '',
          link: '',
          pubDate: '',
          guid: '',
          author: '',
          category: ''
        },
        enabled: false
      }));
    }
  });

  const [expandedSources, setExpandedSources] = useState<Set<string>>(() => {
    // Auto-expand enabled sources when loading
    const enabled = new Set<string>();
    sourceMappings.forEach(mapping => {
      if (mapping.enabled) {
        enabled.add(mapping.sourceId);
      }
    });
    return enabled;
  });
  
  // Update a specific source mapping
  const updateSourceMapping = (sourceId: string, updates: Partial<RSSSourceMapping>) => {
    const updated = sourceMappings.map(mapping => 
      mapping.sourceId === sourceId 
        ? { ...mapping, ...updates }
        : mapping
    );
    setSourceMappings(updated);
    
    // Critical: Update the parent formatOptions
    updateFormatOption('sourceMappings', updated);
  };

  // Update a field mapping for a specific source
  const updateFieldMapping = (sourceId: string, field: string, value: string) => {
    const updated = sourceMappings.map(mapping => 
      mapping.sourceId === sourceId 
        ? { 
            ...mapping, 
            fieldMappings: { 
              ...mapping.fieldMappings, 
              [field]: value 
            }
          }
        : mapping
    );
    setSourceMappings(updated);
    updateFormatOption('sourceMappings', updated);
  };

  // Toggle source expansion
  const toggleSourceExpansion = (sourceId: string) => {
    const newExpanded = new Set(expandedSources);
    if (newExpanded.has(sourceId)) {
      newExpanded.delete(sourceId);
    } else {
      newExpanded.add(sourceId);
    }
    setExpandedSources(newExpanded);
  };

  // Get enabled sources count
  const enabledCount = sourceMappings.filter(m => m.enabled).length;

  return (
    <div>
      {/* Channel Configuration - same as before */}
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
            style={{ width: '100%' }}
            value={formatOptions.channelDescription}
            onChange={(e) => updateFormatOption('channelDescription', e.target.value)}
            placeholder="Description of your feed"
            rows={2}
          />
        </FormGroup>
        <FormGroup label="Channel Link" labelInfo="(required)">
          <InputGroup
            value={formatOptions.channelLink || ''}
            onChange={(e) => updateFormatOption('channelLink', e.target.value)}
            placeholder="https://example.com"
          />
        </FormGroup>
      </Card>

      {/* Multi-Source Configuration */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
          <h4>Data Sources for RSS Items</h4>
          <Tag intent={enabledCount > 0 ? Intent.SUCCESS : Intent.WARNING}>
            {enabledCount} of {config.dataSources.length} sources enabled
          </Tag>
        </div>

        <Callout intent={Intent.PRIMARY} icon="info-sign" style={{ marginBottom: 15 }}>
          Configure each data source that will contribute items to your RSS feed. 
          You can combine multiple sources with the same or different schemas.
        </Callout>

        {config.dataSources.map((source, index) => {
          const mapping = sourceMappings.find(m => m.sourceId === source.id) || sourceMappings[index];
          const isExpanded = expandedSources.has(source.id);
          const hasDiscoveredFields = discoveredFields[source.id] || source.fields?.length > 0;
          
          return (
            <Card key={source.id} style={{ marginBottom: 10 }}>
              {/* Source Header */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: isExpanded ? 15 : 0
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Switch
                    checked={mapping.enabled}
                    onChange={(e) => updateSourceMapping(source.id, { enabled: e.target.checked })}
                    label={
                      <span>
                        <strong>{source.name}</strong>
                        <Tag minimal style={{ marginLeft: 8 }}>{source.type}</Tag>
                        {mapping.enabled && mapping.itemsPath && (
                          <Tag minimal intent={Intent.SUCCESS} style={{ marginLeft: 4 }}>
                            Configured
                          </Tag>
                        )}
                      </span>
                    }
                  />
                </div>
                <Button
                  minimal
                  icon={isExpanded ? "chevron-up" : "chevron-down"}
                  onClick={() => toggleSourceExpansion(source.id)}
                  disabled={!mapping.enabled}
                />
              </div>

              {/* Expanded Configuration */}
              {isExpanded && mapping.enabled && (
                <div style={{ marginTop: 15 }}>
                  {/* Test Data Source */}
                  {!hasDiscoveredFields ? (
                    <Callout intent={Intent.WARNING} icon="info-sign" style={{ marginBottom: 15 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong>Field discovery needed</strong>
                          <p style={{ margin: 0 }}>Test this data source to discover available fields.</p>
                        </div>
                        <Button
                          intent={Intent.PRIMARY}
                          loading={testingSource === source.id}
                          onClick={() => testAndDiscoverFields(source)}
                          icon="search"
                          text="Test & Discover"
                        />
                      </div>
                    </Callout>
                  ) : (
                    <>
                      {/* Items Path Selection */}
                      {sampleData[source.id] && (
                        <FormGroup label="Select array containing items" labelInfo="(required)">
                          <JsonPathSelector
                            data={sampleData[source.id]}
                            onSelectItemsPath={(path) => updateSourceMapping(source.id, { itemsPath: path })}
                            selectedItemsPath={mapping.itemsPath}
                          />
                        </FormGroup>
                      )}

                      {/* Field Mappings */}
                      {mapping.itemsPath && (
                        <div style={{ marginTop: 20 }}>
                          <h5>Field Mappings for {source.name}</h5>
                          
                          <FormGroup label="Title Field" labelInfo="(required)">
                            <SingleSourceFieldSelector
                              sourcePath={mapping.itemsPath}
                              sourceId={source.id}
                              sampleData={sampleData[source.id]}
                              value={mapping.fieldMappings.title}
                              onChange={(value) => updateFieldMapping(source.id, 'title', value)}
                              placeholder="Select title field..."
                            />
                          </FormGroup>

                          <FormGroup label="Description Field" labelInfo="(required)">
                            <SingleSourceFieldSelector
                              sourcePath={mapping.itemsPath}
                              sourceId={source.id}
                              sampleData={sampleData[source.id]}
                              value={mapping.fieldMappings.description}
                              onChange={(value) => updateFieldMapping(source.id, 'description', value)}
                              placeholder="Select description field..."
                            />
                          </FormGroup>

                          <FormGroup label="Link Field" labelInfo="(required)">
                            <SingleSourceFieldSelector
                              sourcePath={mapping.itemsPath}
                              sourceId={source.id}
                              sampleData={sampleData[source.id]}
                              value={mapping.fieldMappings.link}
                              onChange={(value) => updateFieldMapping(source.id, 'link', value)}
                              placeholder="Select link field..."
                            />
                          </FormGroup>

                          <FormGroup label="Publication Date Field">
                            <SingleSourceFieldSelector
                              sourcePath={mapping.itemsPath}
                              sourceId={source.id}
                              sampleData={sampleData[source.id]}
                              value={mapping.fieldMappings.pubDate}
                              onChange={(value) => updateFieldMapping(source.id, 'pubDate', value)}
                              placeholder="Select date field (optional)..."
                            />
                          </FormGroup>

                          <FormGroup label="GUID Field">
                            <SingleSourceFieldSelector
                              sourcePath={mapping.itemsPath}
                              sourceId={source.id}
                              sampleData={sampleData[source.id]}
                              value={mapping.fieldMappings.guid}
                              onChange={(value) => updateFieldMapping(source.id, 'guid', value)}
                              placeholder="Select unique ID field (optional)..."
                            />
                          </FormGroup>

                          <FormGroup label="Author Field">
                            <SingleSourceFieldSelector
                              sourcePath={mapping.itemsPath}
                              sourceId={source.id}
                              sampleData={sampleData[source.id]}
                              value={mapping.fieldMappings.author}
                              onChange={(value) => updateFieldMapping(source.id, 'author', value)}
                              placeholder="Select author field (optional)..."
                            />
                          </FormGroup>

                          <FormGroup label="Category Field">
                            <SingleSourceFieldSelector
                              sourcePath={mapping.itemsPath}
                              sourceId={source.id}
                              sampleData={sampleData[source.id]}
                              value={mapping.fieldMappings.category}
                              onChange={(value) => updateFieldMapping(source.id, 'category', value)}
                              placeholder="Select category field (optional)..."
                            />
                          </FormGroup>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </Card>

      {/* Merge Strategy */}
      {enabledCount > 1 && (
        <Card style={{ marginBottom: 20 }}>
          <h4>Merge Strategy</h4>
          <FormGroup label="How should items from multiple sources be combined?">
            <RadioGroup
              selectedValue={formatOptions.mergeStrategy || 'sequential'}
              onChange={(e) => updateFormatOption('mergeStrategy', e.currentTarget.value)}
            >
              <Radio value="sequential" label="Sequential - Append sources one after another" />
              <Radio value="chronological" label="Chronological - Sort by date field (requires pubDate)" />
              <Radio value="interleaved" label="Interleaved - Alternate between sources" />
              <Radio value="priority" label="Priority - Order by source order above" />
            </RadioGroup>
          </FormGroup>

          {formatOptions.mergeStrategy === 'chronological' && (
            <Callout intent={Intent.WARNING} icon="warning-sign">
              Make sure all enabled sources have a publication date field mapped for proper chronological sorting.
            </Callout>
          )}

          <FormGroup label="Maximum Items Per Source" helperText="Limit the number of items from each source (0 = unlimited)">
            <NumericInput
              value={formatOptions.maxItemsPerSource || 0}
              onValueChange={(value) => updateFormatOption('maxItemsPerSource', value)}
              min={0}
              placeholder="0"
            />
          </FormGroup>

          <FormGroup label="Total Maximum Items" helperText="Limit the total number of items in the feed (0 = unlimited)">
            <NumericInput
              value={formatOptions.maxTotalItems || 0}
              onValueChange={(value) => updateFormatOption('maxTotalItems', value)}
              min={0}
              placeholder="0"
            />
          </FormGroup>
        </Card>
      )}

      {/* Preview */}
      {enabledCount > 0 && (
        <MultiSourceRSSPreview
          sourceMappings={sourceMappings.filter(m => m.enabled)}
          sampleData={sampleData}
          channelInfo={{
            title: formatOptions.channelTitle,
            description: formatOptions.channelDescription,
            link: formatOptions.channelLink
          }}
          mergeStrategy={formatOptions.mergeStrategy || 'sequential'}
          dataSources={config.dataSources}
        />
      )}
    </div>
  );
};

// Helper component for single-source field selection
const SingleSourceFieldSelector: React.FC<{
  sourcePath: string;
  sourceId: string;
  sampleData: any;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}> = ({ sourcePath, sourceId, sampleData, value, onChange, placeholder }) => {
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

// Helper function for getting values from paths
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

// Multi-source RSS preview component
const MultiSourceRSSPreview: React.FC<{
  sourceMappings: RSSSourceMapping[];
  sampleData: any;
  channelInfo: any;
  mergeStrategy: string;
  dataSources: any[];
}> = ({ sourceMappings, sampleData, channelInfo, mergeStrategy, dataSources }) => {
  // Collect all items from all enabled sources
  const allItems = [];
  
  sourceMappings.forEach(mapping => {
    const sourceData = sampleData[mapping.sourceId];
    if (!sourceData || !mapping.itemsPath) return;
    
    // Get items array
    const items = getValueFromPath(sourceData, mapping.itemsPath);
    if (!Array.isArray(items)) return;
    
    // Get source name for display
    const sourceName = dataSources.find(ds => ds.id === mapping.sourceId)?.name || 'Unknown';
    
    // Take first item as example
    if (items.length > 0) {
      const item = items[0];
      allItems.push({
        source: sourceName,
        title: getValueFromPath(item, mapping.fieldMappings.title) || '[No title]',
        description: getValueFromPath(item, mapping.fieldMappings.description) || '[No description]',
        link: getValueFromPath(item, mapping.fieldMappings.link) || '[No link]',
        pubDate: mapping.fieldMappings.pubDate ? getValueFromPath(item, mapping.fieldMappings.pubDate) : null,
        itemCount: items.length
      });
    }
  });

  return (
    <Card style={{ marginBottom: 20 }}>
      <h4>RSS Feed Preview</h4>
      
      {/* Summary */}
      <Callout intent={Intent.SUCCESS} icon="tick" style={{ marginBottom: 15 }}>
        <strong>Feed Summary:</strong>
        <ul style={{ marginBottom: 0 }}>
          {allItems.map((item, idx) => (
            <li key={idx}>
              {item.source}: {item.itemCount} items
            </li>
          ))}
          <li><strong>Total: {allItems.reduce((sum, item) => sum + item.itemCount, 0)} items</strong></li>
          <li>Merge Strategy: {mergeStrategy}</li>
        </ul>
      </Callout>
      
      {/* XML Preview */}
      <div style={{ backgroundColor: '#f5f8fa', padding: 15, borderRadius: 3 }}>
        <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap' }}>
{`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${channelInfo.title || '[Channel Title]'}</title>
    <description>${channelInfo.description || '[Channel Description]'}</description>
    <link>${channelInfo.link || '[Channel Link]'}</link>
    
    <!-- Items from ${sourceMappings.length} sources (${mergeStrategy} merge) -->
${allItems.map((item, idx) => `    
    <!-- Item ${idx + 1} from ${item.source} -->
    <item>
      <title>${item.title}</title>
      <description>${item.description}</description>
      <link>${item.link}</link>${item.pubDate ? `
      <pubDate>${item.pubDate}</pubDate>` : ''}
      <source url="${channelInfo.link}">${item.source}</source>
    </item>`).join('\n')}
  </channel>
</rss>`}
        </pre>
      </div>
    </Card>
  );
};

const OutputFormatStep: React.FC<OutputFormatStepProps> = ({ config, onUpdate, initialSampleData, onSampleDataChange }) => {
  const [testingSource, setTestingSource] = useState<string | null>(null);
  const [discoveredFields, setDiscoveredFields] = useState<Record<string, string[]>>({});
  const [format, setFormat] = useState(config.outputFormat || 'json');
  const [formatOptions, setFormatOptions] = useState<any>(() => {
    const metadata = config.outputSchema?.metadata || {};
    console.log('Loading format options from metadata:', metadata);
    
    return {
      // RSS options
      channelTitle: metadata.channelTitle || '',
      channelDescription: metadata.channelDescription || '',
      channelLink: metadata.channelLink || '',
      titleField: metadata.titleField || '',
      descriptionField: metadata.descriptionField || '',
      linkField: metadata.linkField || '',
      pubDateField: metadata.pubDateField || '',
      guidField: metadata.guidField || '',
      mergeStrategy: metadata.mergeStrategy || 'sequential',
      maxItemsPerSource: metadata.maxItemsPerSource || 0,
      maxTotalItems: metadata.maxTotalItems || 0,
      sourceMappings: metadata.sourceMappings || [], // Load RSS multi-source mappings
      
      // JSON options
      prettyPrint: metadata.prettyPrint !== false,
      includeMetadata: metadata.includeMetadata || false,
      wrapResponse: metadata.wrapResponse || false,
      rootElement: metadata.rootElement || 'data',
      jsonMappingConfig: metadata.jsonMappingConfig || null,
      
      // XML options
      namespace: metadata.namespace || '',
      includeDeclaration: metadata.includeDeclaration !== false,
      useAttributes: metadata.useAttributes || false,
      
      // CSV options
      delimiter: metadata.delimiter || ',',
      includeHeaders: metadata.includeHeaders !== false,
      
      // Any other saved options
      ...metadata
    };
  });
  const [selectedDataSource, setSelectedDataSource] = useState<string>('');
  const [jsonConfigMode, setJsonConfigMode] = useState<'simple' | 'advanced' | 'openapi'>(() => {
    // If we have saved field mappings or jsonMappingConfig, use advanced mode
    if (config.fieldMappings?.length > 0 || config.outputSchema?.metadata?.jsonMappingConfig) {
      return 'advanced';
    }
    return 'simple';
  });
  const [importedOpenAPISchema, setImportedOpenAPISchema] = useState<any>(null);
  const [sourceMappings, setSourceMappings] = useState(() => {
    // Load saved RSS source mappings
    const savedMappings = config.outputSchema?.metadata?.sourceMappings || [];
    console.log('Loading RSS source mappings:', savedMappings);
    
    // If no saved mappings but we have data sources, create default mappings
    if (savedMappings.length === 0 && config.dataSources?.length > 0) {
      return config.dataSources.map(source => ({
        sourceId: source.id,
        sourceName: source.name,
        enabled: false,
        itemsPath: '',
        fieldMappings: {
          title: '',
          description: '',
          link: '',
          pubDate: '',
          guid: ''
        }
      }));
    }
    
    return savedMappings;
  });  
  const [sampleData, setSampleData] = useState<Record<string, any>>(
    initialSampleData || {}
  );

  const isInitialMount = useRef(true);
  
  const { fetchViaProxy } = useFetchProxy();

  // Update parent whenever local sampleData changes
  useEffect(() => {
    if (onSampleDataChange) {
      onSampleDataChange(sampleData);
    }
  }, [sampleData, onSampleDataChange]);

  useEffect(() => {
    // Update the parent config with all our format options
    onUpdate({
      outputSchema: {
        ...config.outputSchema,
        metadata: {
          ...config.outputSchema?.metadata,
          ...formatOptions,
          sourceMappings: sourceMappings // Include RSS mappings
        }
      }
    });
  }, [formatOptions, sourceMappings]);

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
      
      // Store discovered fields and update data sources
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
        
        // Log current mappings before update
        console.log('Current field mappings before update:', config.fieldMappings);
        console.log('Current output schema before update:', config.outputSchema);
        
        // Only update data sources, explicitly preserve other configurations
        onUpdate({ 
          dataSources: updatedSources,
          // Explicitly preserve field mappings if they exist
          ...(config.fieldMappings && config.fieldMappings.length > 0 ? {
            fieldMappings: config.fieldMappings
          } : {}),
          // Explicitly preserve output schema if it exists
          ...(config.outputSchema ? {
            outputSchema: config.outputSchema
          } : {})
        });
        
        // Log after update to confirm preservation
        console.log('Field mappings preserved:', config.fieldMappings?.length || 0, 'mappings');
        
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

  // Function to test all data sources at once
  const testAllDataSources = async () => {
    const sourcesToTest = config.dataSources.filter(source => {
      const sourceFields = source.fields || discoveredFields[source.id] || [];
      return sourceFields.length > 0; // Only re-test sources that already have fields
    });

    if (sourcesToTest.length === 0) {
      AppToaster.show({
        message: 'No data sources with fields to re-test',
        intent: 'warning'
      });
      return;
    }

    setTestingSource('all'); // Special state to indicate all sources are being tested
    
    let successCount = 0;
    let failCount = 0;

    for (const source of sourcesToTest) {
      try {
        await testAndDiscoverFields(source);
        successCount++;
      } catch (error) {
        failCount++;
        console.error(`Failed to test ${source.name}:`, error);
      }
    }

    setTestingSource(null);

    // Show summary toast
    if (failCount === 0) {
      AppToaster.show({
        message: `Successfully re-tested all ${successCount} data sources`,
        intent: 'success'
      });
    } else {
      AppToaster.show({
        message: `Re-tested ${successCount} sources, ${failCount} failed`,
        intent: failCount > 0 ? 'warning' : 'success'
      });
    }
  };

  // Function to discover fields for all data sources at once
  const discoverAllFields = async () => {
    const sourcesToDiscover = config.dataSources.filter(source => {
      const sourceFields = source.fields || discoveredFields[source.id] || [];
      return sourceFields.length === 0; // Only discover for sources without fields
    });

    if (sourcesToDiscover.length === 0) {
      AppToaster.show({
        message: 'All data sources already have fields discovered',
        intent: 'primary'
      });
      return;
    }

    setTestingSource('all'); // Special state to indicate all sources are being tested
    
    let successCount = 0;
    let failCount = 0;

    for (const source of sourcesToDiscover) {
      try {
        await testAndDiscoverFields(source);
        successCount++;
      } catch (error) {
        failCount++;
        console.error(`Failed to discover fields for ${source.name}:`, error);
      }
    }

    setTestingSource(null);

    // Show summary toast
    if (failCount === 0) {
      AppToaster.show({
        message: `Successfully discovered fields for all ${successCount} data sources`,
        intent: 'success'
      });
    } else {
      AppToaster.show({
        message: `Discovered fields for ${successCount} sources, ${failCount} failed`,
        intent: failCount > 0 ? 'warning' : 'success'
      });
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
    
    // Make sure to update the parent config
    onUpdate({
      outputSchema: {
        ...config.outputSchema,
        metadata: updated,  // This includes sourceMappings
        format: format
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

  const renderDataSourceTesting = () => {
    // Calculate if there are sources to re-test or discover
    const sourcesWithFields = config.dataSources.filter(source => {
      const sourceFields = source.fields || discoveredFields[source.id] || [];
      return sourceFields.length > 0;
    });

    const sourcesWithoutFields = config.dataSources.filter(source => {
      const sourceFields = source.fields || discoveredFields[source.id] || [];
      return sourceFields.length === 0;
    });

    const isTestingAll = testingSource === 'all';
    
    return (
      <Card className="data-source-testing" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
          <h4 style={{ margin: 0 }}>Data Source Fields</h4>
          
          {/* Action buttons for all sources */}
          <div style={{ display: 'flex', gap: 10 }}>
            {sourcesWithFields.length > 0 && (
              <Button
                intent="none"
                icon="refresh"
                text="Re-test All"
                onClick={testAllDataSources}
                loading={isTestingAll}
                disabled={testingSource !== null && testingSource !== 'all'}
              />
            )}
            {sourcesWithoutFields.length > 0 && (
              <Button
                intent="primary"
                icon="search"
                text="Discover All"
                onClick={discoverAllFields}
                loading={isTestingAll}
                disabled={testingSource !== null && testingSource !== 'all'}
              />
            )}
          </div>
        </div>

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
  };

  // Function to convert AI-generated field mappings to the format expected by JsonFieldMapper
  const convertFieldMappingsFormat = (fieldMappings: any[]): any[] => {
    if (!fieldMappings || !Array.isArray(fieldMappings)) return [];
    
    return fieldMappings.map(mapping => {
      // Check if it's already in the correct format
      if (mapping.targetPath && mapping.sourcePath) {
        return mapping; // Already correct format
      }
      
      // Convert from AI format to JsonFieldMapper format
      return {
        targetPath: mapping.target_field || mapping.targetPath,
        sourcePath: mapping.source_field || mapping.sourcePath,
        sourceId: mapping.sourceId || mapping.source_id || config.dataSources[0]?.id, // Use first data source if not specified
        transformation: mapping.transform_type ? {
          type: mapping.transform_type,
          config: mapping.transform_config || {}
        } : null,
        fallbackValue: mapping.fallback_value || mapping.fallbackValue || null,
        conditional: mapping.conditions ? {
          condition: mapping.conditions[0],
          then: mapping.conditions[0]?.result,
          else: mapping.fallback_value
        } : null
      };
    });
  };

  const sourceSelectionType = (() => {
    // Check if we have sample data to determine the type
    if (sampleData && config.dataSources.length > 0) {
      const firstSourceId = config.dataSources[0].id;
      const firstSourceData = sampleData[firstSourceId];
      
      if (firstSourceData) {
        // Navigate to data_path if specified
        const apiConfig = config.dataSources[0].api_config;
        let targetData = firstSourceData;
        
        if (apiConfig?.data_path) {
          const pathParts = apiConfig.data_path.split('.');
          for (const part of pathParts) {
            if (targetData && typeof targetData === 'object' && part in targetData) {
              targetData = targetData[part];
            }
          }
        }
        
        // Return 'array' if the data is an array, 'object' otherwise
        return Array.isArray(targetData) ? 'array' : 'object';
      }
    }
    
    // Default to array for multiple items
    return 'array';
  })();

  const outputFields = (() => {
    // Option A: If you have field mappings, create fields from them
    if (config.fieldMappings && config.fieldMappings.length > 0) {
      // Get unique target fields from mappings
      const fieldMap = new Map();
      
      config.fieldMappings.forEach(mapping => {
        const fieldName = mapping.target_field || mapping.targetPath;
        if (!fieldMap.has(fieldName)) {
          fieldMap.set(fieldName, {
            path: fieldName,
            name: fieldName.charAt(0).toUpperCase() + fieldName.slice(1), // Capitalize first letter
            type: mapping.transform_type === 'parse-number' ? 'number' : 'string',
            required: true,
            defaultValue: null
          });
        }
      });
      
      return Array.from(fieldMap.values());
    }
    
    // Option B: If you have an output schema, extract fields from it
    if (config.outputSchema?.root?.children && config.outputSchema.root.children.length > 0) {
      return config.outputSchema.root.children.map(child => ({
        path: child.key,
        name: child.key.charAt(0).toUpperCase() + child.key.slice(1),
        type: child.type || 'string',
        required: child.required !== false,
        defaultValue: child.default || null
      }));
    }
    
    // Option D: Default generic fields
    return [
      { path: 'id', name: 'ID', type: 'string', required: false, defaultValue: null },
      { path: 'title', name: 'Title', type: 'string', required: true, defaultValue: null },
      { path: 'description', name: 'Description', type: 'string', required: false, defaultValue: null },
      { path: 'value', name: 'Value', type: 'string', required: false, defaultValue: null }
    ];
  })();

  const handleJsonMappingChange = (newConfig: any) => {
    console.log('JsonFieldMapper config changed:', newConfig);
    
    // Convert back to your format if needed
    const convertedMappings = newConfig.fieldMappings?.map(mapping => ({
      id: mapping.id || `map_${Date.now()}_${Math.random()}`,
      target_field: mapping.targetPath,
      source_field: mapping.sourcePath,
      source_id: mapping.sourceId,
      transform_type: mapping.transformation?.type,
      transform_config: mapping.transformation?.config
    })) || [];
    
    // Update your config
    onUpdate({
      fieldMappings: convertedMappings,
      outputSchema: {
        ...config.outputSchema,
        // Update schema based on the new configuration
        metadata: {
          ...config.outputSchema?.metadata,
          jsonMappingConfig: newConfig
        }
      }
    });
  };

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
            {/* Configuration Mode Selection */}
            <FormGroup 
              label="Configuration Mode" 
              helperText="Choose between simple options or advanced field-by-field mapping"
            >
              <RadioGroup
                selectedValue={jsonConfigMode}
                onChange={(e) => setJsonConfigMode(e.currentTarget.value as 'simple' | 'advanced')}
              >
                <Radio 
                  label={
                    <span>
                      <strong>Simple Configuration</strong>
                      <br />
                      <small className={Classes.TEXT_MUTED}>
                        Basic JSON output with formatting options
                      </small>
                    </span>
                  }
                  value="simple"
                />
                <Radio 
                  label={
                    <span>
                      <strong>Advanced Field Mapping</strong>
                      <br />
                      <small className={Classes.TEXT_MUTED}>
                        Visual field mapping with transformations, conditions, and custom output structure
                      </small>
                    </span>
                  }
                  value="advanced"
                />
                <Radio 
                  label={
                    <span>
                      <strong>Import from OpenAPI/Swagger</strong>
                      <br />
                      <small className={Classes.TEXT_MUTED}>
                        Import an existing API specification (OpenAPI 3.0, Swagger 2.0, or JSON Schema)
                      </small>
                    </span>
                  }
                  value="openapi"
                />
              </RadioGroup>
            </FormGroup>

            <Divider style={{ margin: '20px 0' }} />

            {/* OpenAPI Import Mode */}
            {jsonConfigMode === 'openapi' && (
              <div className="openapi-import-mode">
                {!importedOpenAPISchema ? (
                  <OpenAPIImport
                    onImport={(schema, mappingConfig) => {
                      setImportedOpenAPISchema(schema);
                      updateFormatOption('importedSchema', schema);
                      updateFormatOption('mappingConfig', mappingConfig);
                      
                      // Auto-generate field mappings based on imported schema
                      generateFieldMappingsFromSchema(schema);
                      
                      AppToaster.show({
                        message: 'Schema imported successfully',
                        intent: Intent.SUCCESS
                      });
                    }}
                    onCancel={() => setJsonConfigMode('simple')}
                  />
                ) : (
                  <Card>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4>Imported Schema Active</h4>
                      <Button
                        minimal
                        intent={Intent.DANGER}
                        icon="trash"
                        onClick={() => {
                          setImportedOpenAPISchema(null);
                          updateFormatOption('importedSchema', null);
                          updateFormatOption('mappingConfig', null);
                        }}
                      >
                        Remove Import
                      </Button>
                    </div>
                    
                    <Callout intent={Intent.SUCCESS} style={{ marginTop: 15 }}>
                      Your OpenAPI schema has been imported and will be used as the output structure.
                      Fields from your data sources will be automatically mapped to match this schema.
                    </Callout>

                    {/* Show field mapping interface */}
                    <div style={{ marginTop: 20 }}>
                      <h5>Field Mappings</h5>
                      <FieldMappingInterface
                        schema={importedOpenAPISchema}
                        dataSources={config.dataSources}
                        mappings={formatOptions.fieldMappings || []}
                        onUpdate={(mappings) => updateFormatOption('fieldMappings', mappings)}
                      />
                    </div>
                  </Card>
                )}
              </div>
            )}

            {/* Simple Configuration Mode */}
            {jsonConfigMode === 'simple' ? (
              <div className="simple-json-config">
                <Callout intent={Intent.PRIMARY} icon="info-sign" style={{ marginBottom: 20 }}>
                  Configure basic JSON output settings. Your data sources will be combined into a single JSON response.
                </Callout>

                {/* Pretty Print Option */}
                <FormGroup>
                  <Switch
                    label="Pretty print (formatted output)"
                    checked={formatOptions.prettyPrint !== false}
                    onChange={(e) => updateFormatOption('prettyPrint', e.target.checked)}
                  />
                </FormGroup>

                {/* Include Metadata Option */}
                <FormGroup>
                  <Switch
                    label="Include response metadata"
                    checked={formatOptions.includeMetadata}
                    onChange={(e) => updateFormatOption('includeMetadata', e.target.checked)}
                    helperText="Adds timestamp, version, and source information to the response"
                  />
                </FormGroup>

                {/* Root Wrapper Element */}
                <FormGroup 
                  label="Root wrapper element"
                  helperText="The top-level key that will contain your data"
                >
                  <InputGroup
                    value={formatOptions.rootWrapper || 'data'}
                    onChange={(e) => updateFormatOption('rootWrapper', e.target.value)}
                    placeholder="e.g., data, response, items, results"
                  />
                </FormGroup>

                {/* Select Primary Data Source */}
                {config.dataSources.length > 0 && (
                  <>
                    <FormGroup 
                      label="Primary Data Source"
                      helperText="Select which data source to use as the main response body"
                      labelInfo="(required)"
                    >
                      <HTMLSelect
                        value={selectedDataSource || formatOptions.sourceId || ''}
                        onChange={(e) => {
                          setSelectedDataSource(e.target.value);
                          updateFormatOption('sourceId', e.target.value);
                        }}
                        fill
                      >
                        <option value="">Select a data source...</option>
                        {config.dataSources.map(source => (
                          <option key={source.id} value={source.id}>
                            {source.name} ({source.type})
                          </option>
                        ))}
                      </HTMLSelect>
                    </FormGroup>

                    {/* Test Data Source Button */}
                    {selectedDataSource && (
                      <Button
                        icon="play"
                        text="Test Data Source"
                        intent={Intent.PRIMARY}
                        onClick={() => testAndDiscoverFields(
                          config.dataSources.find(ds => ds.id === selectedDataSource)!
                        )}
                        loading={testingSource === selectedDataSource}
                        style={{ marginBottom: 20 }}
                      />
                    )}
                  </>
                )}

                {/* Response Structure Preview */}
                {selectedDataSource && sampleData[selectedDataSource] && (
                  <FormGroup label="Response Structure Preview">
                    <Card style={{ backgroundColor: '#f5f8fa', padding: 15 }}>
                      <pre style={{ margin: 0, fontSize: 12, overflow: 'auto', maxHeight: 200 }}>
                        {JSON.stringify(
                          {
                            ...(formatOptions.includeMetadata && {
                              metadata: {
                                timestamp: new Date().toISOString(),
                                version: "1.0",
                                source: selectedDataSource
                              }
                            }),
                            [formatOptions.rootWrapper || 'data']: Array.isArray(sampleData[selectedDataSource]) 
                              ? `[${sampleData[selectedDataSource].length} items...]`
                              : '{...}'
                          },
                          null,
                          2
                        )}
                      </pre>
                    </Card>
                  </FormGroup>
                )}

                {/* Additional Options */}
                <FormGroup label="Additional Options">
                  <Switch
                    label="Include null values"
                    checked={formatOptions.includeNulls !== false}
                    onChange={(e) => updateFormatOption('includeNulls', e.target.checked)}
                  />
                  <Switch
                    label="Sort object keys alphabetically"
                    checked={formatOptions.sortKeys}
                    onChange={(e) => updateFormatOption('sortKeys', e.target.checked)}
                  />
                  <Switch
                    label="Convert dates to ISO strings"
                    checked={formatOptions.isoDates !== false}
                    onChange={(e) => updateFormatOption('isoDates', e.target.checked)}
                  />
                </FormGroup>

                {/* Character Encoding */}
                <FormGroup label="Character Encoding">
                  <HTMLSelect
                    value={formatOptions.encoding || 'UTF-8'}
                    onChange={(e) => updateFormatOption('encoding', e.target.value)}
                    fill
                  >
                    <option value="UTF-8">UTF-8 (Default)</option>
                    <option value="UTF-16">UTF-16</option>
                    <option value="ASCII">ASCII</option>
                  </HTMLSelect>
                </FormGroup>
              </div>
            ) : (
              /* Advanced Configuration Mode - JsonFieldMapper */
              <div className="advanced-json-config">
                {config.dataSources.length === 0 ? (
                  /* No Data Sources Warning */
                  <NonIdealState
                    icon="data-connection"
                    title="No Data Sources Available"
                    description="You need to configure at least one data source before setting up field mappings."
                    action={
                      <Button 
                        text="Configure Data Sources" 
                        intent={Intent.PRIMARY}
                        icon="arrow-left"
                        onClick={() => {
                          // This should navigate back to the data sources step
                          // Implementation depends on your wizard navigation
                          console.log('Navigate to data sources step');
                        }}
                      />
                    }
                  />
                ) : !Object.keys(sampleData).length ? (
                  /* No Sample Data Warning */
                  <Callout intent={Intent.WARNING} icon="warning-sign">
                    <h4>Sample Data Required</h4>
                    <p>
                      Please test your data sources to load sample data before configuring field mappings.
                      Sample data helps you visualize the available fields and test your transformations.
                    </p>
                    <div style={{ marginTop: 15 }}>
                      {config.dataSources.map(source => (
                        <Button
                          key={source.id}
                          text={`Test ${source.name}`}
                          icon="play"
                          intent={Intent.PRIMARY}
                          onClick={() => testAndDiscoverFields(source)}
                          loading={testingSource === source.id}
                          style={{ marginRight: 10, marginBottom: 10 }}
                        />
                      ))}
                    </div>
                  </Callout>
                ) : (
                  /* JsonFieldMapper Component */
                  <>
                    <Callout intent={Intent.PRIMARY} icon="info-sign" style={{ marginBottom: 20 }}>
                      <strong>Advanced Field Mapping</strong>
                      <p style={{ margin: '5px 0 0 0' }}>
                        Create a custom JSON structure by mapping fields from your data sources. 
                        Add transformations, conditions, and define exactly how your output should look.
                      </p>
                    </Callout>

                    <JsonFieldMapper
                      dataSources={config.dataSources}
                      sampleData={sampleData}
                      initialConfig={{
                        sourceSelection: {
                          type: sourceSelectionType,
                          sources: config.dataSources.map(ds => ({
                            id: ds.id,
                            name: ds.name,
                            type: ds.type,
                            primaryPath: ds.api_config?.data_path || '',
                            category: ds.category
                          })),
                          mergeMode: config.outputSchema?.metadata?.jsonMappingConfig?.sourceSelection?.mergeMode || 'separate'
                        },
                        outputTemplate: {
                          structure: {},
                          fields: outputFields
                        },
                        // Convert the field mappings to the correct format
                        fieldMappings: convertFieldMappingsFormat(config.fieldMappings),
                        transformations: [],
                        outputWrapper: {
                          enabled: formatOptions.wrapResponse || false,
                          wrapperKey: formatOptions.rootElement || 'data',
                          includeMetadata: formatOptions.includeMetadata || false,
                          metadataFields: {
                            timestamp: true,
                            source: true,
                            count: true,
                            version: false
                          }
                        }
                      }}
                      onChange={handleJsonMappingChange}
                      onTest={() => {
                        console.log('Test mapping clicked');
                      }}
                    />

                    {/* Quick Actions */}
                    <div style={{ marginTop: 20, padding: 15, backgroundColor: '#f5f8fa', borderRadius: 4 }}>
                      <h5 style={{ margin: '0 0 10px 0' }}>Quick Actions</h5>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <Button
                          icon="export"
                          text="Export Configuration"
                          small
                          onClick={() => {
                            if (formatOptions.jsonMappingConfig) {
                              const configJson = JSON.stringify(formatOptions.jsonMappingConfig, null, 2);
                              const blob = new Blob([configJson], { type: 'application/json' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = 'json-mapping-config.json';
                              a.click();
                              URL.revokeObjectURL(url);
                              
                              AppToaster.show({
                                message: 'Configuration exported',
                                intent: Intent.SUCCESS
                              });
                            }
                          }}
                          disabled={!formatOptions.jsonMappingConfig}
                        />
                        <Button
                          icon="import"
                          text="Import Configuration"
                          small
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = '.json';
                            input.onchange = async (e) => {
                              const file = (e.target as HTMLInputElement).files?.[0];
                              if (file) {
                                try {
                                  const text = await file.text();
                                  const config = JSON.parse(text);
                                  updateFormatOption('jsonMappingConfig', config);
                                  
                                  AppToaster.show({
                                    message: 'Configuration imported successfully',
                                    intent: Intent.SUCCESS
                                  });
                                } catch (error) {
                                  AppToaster.show({
                                    message: 'Failed to import configuration',
                                    intent: Intent.DANGER
                                  });
                                }
                              }
                            };
                            input.click();
                          }}
                        />
                        <Button
                          icon="refresh"
                          text="Reset Configuration"
                          small
                          intent={Intent.DANGER}
                          onClick={() => {
                            if (confirm('Are you sure you want to reset the mapping configuration?')) {
                              updateFormatOption('jsonMappingConfig', null);
                              AppToaster.show({
                                message: 'Configuration reset',
                                intent: Intent.WARNING
                              });
                            }
                          }}
                          disabled={!formatOptions.jsonMappingConfig}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
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
          <RSSMultiSourceConfiguration
            config={config}
            formatOptions={formatOptions}
            updateFormatOption={updateFormatOption}
            sampleData={sampleData}
            discoveredFields={discoveredFields}
            testAndDiscoverFields={testAndDiscoverFields}
            testingSource={testingSource}
          />
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