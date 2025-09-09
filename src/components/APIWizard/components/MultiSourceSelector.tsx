import React, { useState } from 'react';
import {
  Card,
  Button,
  Checkbox,
  Intent,
  Tag,
  Icon,
  Callout,
  HTMLSelect,
  FormGroup,
  Collapse,
  Classes
} from '@blueprintjs/core';

interface MultiSourceSelectorProps {
  dataSources: any[];
  sampleData: Record<string, any>;
  selection: MultiSourceSelection;
  onChange: (selection: MultiSourceSelection) => void;
  onNext: () => void;
}

export const MultiSourceSelector: React.FC<MultiSourceSelectorProps> = ({
  dataSources,
  sampleData,
  selection,
  onChange,
  onNext
}) => {
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());

  const toggleSource = (sourceId: string) => {
    const currentSources = [...selection.sources];
    const existingIndex = currentSources.findIndex(s => s.id === sourceId);
    
    if (existingIndex >= 0) {
      // Remove source
      currentSources.splice(existingIndex, 1);
    } else {
      // Add source
      const dataSource = dataSources.find(ds => ds.id === sourceId);
      if (dataSource) {
        currentSources.push({
          id: sourceId,
          name: dataSource.name,
          type: dataSource.type,
          category: dataSource.category,
          primaryPath: '',
          enabled: true
        });
      }
    }
    
    onChange({
      ...selection,
      sources: currentSources
    });
  };

  const updateSourcePath = (sourceId: string, path: string) => {
    const updatedSources = selection.sources.map(source =>
      source.id === sourceId ? { ...source, primaryPath: path } : source
    );
    
    onChange({
      ...selection,
      sources: updatedSources
    });
  };

  const toggleExpanded = (sourceId: string) => {
    const newExpanded = new Set(expandedSources);
    if (newExpanded.has(sourceId)) {
      newExpanded.delete(sourceId);
    } else {
      newExpanded.add(sourceId);
    }
    setExpandedSources(newExpanded);
  };

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'api': return 'cloud';
      case 'database': return 'database';
      case 'file': return 'document';
      case 'rss': return 'feed';
      default: return 'data-connection';
    }
  };

  const getTypeColor = (type: string): Intent => {
    switch (type) {
      case 'api': return Intent.PRIMARY;
      case 'database': return Intent.SUCCESS;
      case 'file': return Intent.NONE;
      case 'rss': return Intent.WARNING;
      default: return Intent.NONE;
    }
  };

  return (
    <div className="multi-source-selector">
      <Callout intent={Intent.PRIMARY} icon="info-sign">
        Select multiple data sources to combine their fields in your output. 
        Each source can have its own data path configuration.
      </Callout>

      <Card style={{ marginTop: 20 }}>
        <h3>Available Data Sources</h3>
        <div className="source-list">
          {dataSources.map(source => {
            const isSelected = selection.sources.some(s => s.id === source.id);
            const selectedSource = selection.sources.find(s => s.id === source.id);
            const isExpanded = expandedSources.has(source.id);
            
            return (
              <Card
                key={source.id}
                interactive={false}
                style={{
                  marginBottom: 10,
                  backgroundColor: isSelected ? '#e1f0fe' : undefined,
                  border: isSelected ? '2px solid #137cbd' : '1px solid #e1e8ed'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Checkbox
                    checked={isSelected}
                    onChange={() => toggleSource(source.id)}
                  />
                  <Icon icon={getSourceIcon(source.type)} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold' }}>{source.name}</div>
                    <div style={{ fontSize: 12, color: '#5c7080' }}>
                      <Tag minimal intent={getTypeColor(source.type)}>
                        {source.type.toUpperCase()}
                      </Tag>
                      {source.category && (
                        <Tag minimal icon="tag" style={{ marginLeft: 5 }}>
                          {source.category}
                        </Tag>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <Button
                      minimal
                      icon={isExpanded ? 'chevron-up' : 'chevron-down'}
                      onClick={() => toggleExpanded(source.id)}
                    />
                  )}
                </div>
                
                {isSelected && (
                  <Collapse isOpen={isExpanded}>
                    <div style={{ marginTop: 15, paddingLeft: 30 }}>
                      <FormGroup label="Data Path" labelInfo="(optional)">
                        <HTMLSelect
                          value={selectedSource?.primaryPath || ''}
                          onChange={(e) => updateSourcePath(source.id, e.target.value)}
                          fill
                        >
                          <option value="">Root Level</option>
                          {sampleData[source.id] && extractPaths(sampleData[source.id]).map(path => (
                            <option key={path} value={path}>{path}</option>
                          ))}
                        </HTMLSelect>
                      </FormGroup>
                      
                      {sampleData[source.id] && (
                        <div style={{ marginTop: 10 }}>
                          <small style={{ color: '#5c7080' }}>
                            Sample data available: {
                              Array.isArray(sampleData[source.id]) 
                                ? `Array with ${sampleData[source.id].length} items`
                                : `Object with ${Object.keys(sampleData[source.id]).length} fields`
                            }
                          </small>
                        </div>
                      )}
                    </div>
                  </Collapse>
                )}
              </Card>
            );
          })}
        </div>
      </Card>

      <Card style={{ marginTop: 20, backgroundColor: '#f5f8fa' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon icon="list" />
          <strong>Selected Sources:</strong>
          {selection.sources.length === 0 ? (
            <span style={{ color: '#5c7080' }}>None selected</span>
          ) : (
            selection.sources.map(source => (
              <Tag key={source.id} intent={Intent.PRIMARY}>
                {source.name}
              </Tag>
            ))
          )}
        </div>
      </Card>

      <div style={{ marginTop: 20, textAlign: 'right' }}>
        <Button
          intent={Intent.PRIMARY}
          text="Next: Define Output"
          rightIcon="arrow-right"
          onClick={onNext}
          disabled={selection.sources.length === 0}
        />
      </div>
    </div>
  );
};

// Helper function to extract paths from sample data
function extractPaths(obj: any, prefix = ''): string[] {
  const paths: string[] = [];
  
  if (Array.isArray(obj)) {
    if (obj.length > 0 && typeof obj[0] === 'object') {
      paths.push(...extractPaths(obj[0], prefix));
    }
  } else if (obj && typeof obj === 'object') {
    for (const key in obj) {
      const fullPath = prefix ? `${prefix}.${key}` : key;
      paths.push(fullPath);
      
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        paths.push(...extractPaths(obj[key], fullPath));
      }
    }
  }
  
  return paths;
}