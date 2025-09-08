import React, { useState } from 'react';
import {
  Card,
  FormGroup,
  Checkbox,
  Button,
  Intent,
  Tag,
  Callout,
  Icon,
  Divider,
  Collapse,
  NonIdealState,
  Switch
} from '@blueprintjs/core';
import { findArraysAndObjects } from '../utils/pathHelpers';

interface SourceSelectorProps {
  dataSources: any[];
  sampleData: Record<string, any>;
  selection: any;
  onChange: (selection: any) => void;
  onNext: () => void;
}

export const SourceSelector: React.FC<SourceSelectorProps> = ({
  dataSources,
  sampleData,
  selection,
  onChange,
  onNext
}) => {
  // Change from single selection to multiple selection
  const [selectedSources, setSelectedSources] = useState<Set<string>>(() => {
    // Initialize from existing selection
    if (selection.sources && selection.sources.length > 0) {
      return new Set(selection.sources.map((s: any) => s.id));
    }
    return new Set();
  });
  
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [sourcePaths, setSourcePaths] = useState<Record<string, string>>(() => {
    // Initialize paths from existing selection
    const paths: Record<string, string> = {};
    if (selection.sources) {
      selection.sources.forEach((source: any) => {
        paths[source.id] = source.primaryPath || '';
      });
    }
    return paths;
  });
  
  const [mergeMode, setMergeMode] = useState<'separate' | 'combined'>('separate');

  const toggleSource = (sourceId: string) => {
    const newSelected = new Set(selectedSources);
    if (newSelected.has(sourceId)) {
      newSelected.delete(sourceId);
      // Remove path when deselecting
      const newPaths = { ...sourcePaths };
      delete newPaths[sourceId];
      setSourcePaths(newPaths);
    } else {
      newSelected.add(sourceId);
      // Auto-detect path when selecting
      autoDetectPath(sourceId);
    }
    setSelectedSources(newSelected);
    updateSelection(newSelected, sourcePaths);
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

  const autoDetectPath = (sourceId: string) => {
    const data = sampleData[sourceId];
    if (!data) return;

    const paths = findArraysAndObjects(data);
    if (paths.length === 1) {
      // Auto-select if only one viable path
      updateSourcePath(sourceId, paths[0].path);
    } else if (paths.length > 0) {
      // Select the first array path if available
      const arrayPath = paths.find(p => p.type === 'array');
      if (arrayPath) {
        updateSourcePath(sourceId, arrayPath.path);
      }
    }
  };

  const updateSourcePath = (sourceId: string, path: string) => {
    const newPaths = { ...sourcePaths, [sourceId]: path };
    setSourcePaths(newPaths);
    updateSelection(selectedSources, newPaths);
  };

  const updateSelection = (sources: Set<string>, paths: Record<string, string>) => {
    const sourcesArray = Array.from(sources).map(sourceId => {
      const source = dataSources.find(ds => ds.id === sourceId);
      const data = sampleData[sourceId];
      const path = paths[sourceId] || '';
      
      // Determine type based on the data at the path
      let type: 'array' | 'object' = 'object';
      if (data && path) {
        const valueAtPath = getValueAtPath(data, path);
        type = Array.isArray(valueAtPath) ? 'array' : 'object';
      } else if (data) {
        type = Array.isArray(data) ? 'array' : 'object';
      }

      return {
        id: sourceId,
        name: source?.name || sourceId,
        type: source?.type || 'unknown',
        category: source?.category,
        primaryPath: path,
        dataType: type
      };
    });

    onChange({
      type: sourcesArray.length > 0 ? sourcesArray[0].dataType : 'object',
      sources: sourcesArray,
      mergeMode: sources.size > 1 ? mergeMode : 'single',
      primaryPath: sourcesArray.length === 1 ? sourcesArray[0].primaryPath : ''
    });
  };

  const getValueAtPath = (obj: any, path: string): any => {
    if (!path) return obj;
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current && typeof current === 'object') {
        current = current[part];
      } else {
        return undefined;
      }
    }
    return current;
  };

  const renderPathSelector = (sourceId: string) => {
    const data = sampleData[sourceId];
    if (!data) {
      return (
        <Callout intent={Intent.WARNING} icon="warning-sign">
          No sample data available. Please test this data source first.
        </Callout>
      );
    }

    const paths = findArraysAndObjects(data);
    const currentPath = sourcePaths[sourceId] || '';

    return (
      <FormGroup label="Select data path" labelInfo="Choose where your data is located">
        <div className="path-options">
          {paths.length === 0 ? (
            <Callout intent={Intent.WARNING}>
              No suitable data structures found in the sample data.
            </Callout>
          ) : (
            <>
              {paths.map(({ path, type, count }) => (
                <label key={path || 'root'} className="bp4-control bp4-radio">
                  <input
                    type="radio"
                    checked={currentPath === path}
                    onChange={() => updateSourcePath(sourceId, path)}
                  />
                  <span className="bp4-control-indicator" />
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon icon={type === 'array' ? 'array' : 'box'} />
                    <code>{path || 'root'}</code>
                    <Tag minimal intent={Intent.PRIMARY}>
                      {type === 'array' ? `${count} items` : 'object'}
                    </Tag>
                  </span>
                </label>
              ))}
            </>
          )}
        </div>
      </FormGroup>
    );
  };

  const canProceed = selectedSources.size > 0 && 
    Array.from(selectedSources).every(sourceId => 
      sourcePaths[sourceId] !== undefined || !sampleData[sourceId]
    );

  return (
    <div className="source-selector">
      <Callout intent={Intent.PRIMARY} icon="info-sign" style={{ marginBottom: 20 }}>
        Select one or more data sources to map their fields to your output structure. 
        You can combine data from multiple sources into a single API response.
      </Callout>

      {/* Source Selection with Checkboxes */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
          <h4 style={{ margin: 0 }}>Select Data Sources</h4>
          <div>
            <Button
              minimal
              text="Select All"
              onClick={() => {
                const allIds = new Set(dataSources.map(ds => ds.id));
                setSelectedSources(allIds);
                allIds.forEach(id => autoDetectPath(id));
              }}
            />
            <Button
              minimal
              text="Clear All"
              onClick={() => {
                setSelectedSources(new Set());
                setSourcePaths({});
              }}
            />
          </div>
        </div>

        {dataSources.length === 0 ? (
          <NonIdealState
            icon="database"
            title="No data sources available"
            description="Please add data sources in the previous step"
          />
        ) : (
          dataSources.map(source => {
            const isSelected = selectedSources.has(source.id);
            const isExpanded = expandedSources.has(source.id);
            const hasData = !!sampleData[source.id];
            const currentPath = sourcePaths[source.id];
            
            return (
              <Card
                key={source.id}
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
                    large
                  />
                  
                  <Icon icon={
                    source.type === 'api' ? 'cloud' :
                    source.type === 'database' ? 'database' :
                    source.type === 'file' ? 'document' :
                    'data-connection'
                  } />
                  
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold' }}>{source.name}</div>
                    <div style={{ fontSize: 12, color: '#5c7080' }}>
                      <Tag minimal>{source.type.toUpperCase()}</Tag>
                      {source.category && (
                        <Tag minimal icon="tag" style={{ marginLeft: 5 }}>
                          {source.category}
                        </Tag>
                      )}
                      {hasData && (
                        <Tag minimal intent={Intent.SUCCESS} style={{ marginLeft: 5 }}>
                          Data loaded
                        </Tag>
                      )}
                      {isSelected && currentPath && (
                        <Tag minimal intent={Intent.PRIMARY} style={{ marginLeft: 5 }}>
                          Path: {currentPath || 'root'}
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

                {isSelected && isExpanded && (
                  <Collapse isOpen={true}>
                    <Divider style={{ margin: '10px 0' }} />
                    <div style={{ paddingLeft: 30 }}>
                      {renderPathSelector(source.id)}
                      
                      {hasData && currentPath !== undefined && (
                        <div style={{ marginTop: 15 }}>
                          <strong>Data Preview:</strong>
                          <pre style={{
                            backgroundColor: '#f5f8fa',
                            padding: 10,
                            borderRadius: 3,
                            maxHeight: 150,
                            overflow: 'auto',
                            marginTop: 5,
                            fontSize: 11
                          }}>
                            {JSON.stringify(
                              getValueAtPath(sampleData[source.id], currentPath),
                              null,
                              2
                            ).slice(0, 500)}...
                          </pre>
                        </div>
                      )}
                    </div>
                  </Collapse>
                )}
              </Card>
            );
          })
        )}
      </Card>

      {/* Merge Mode for Multiple Sources */}
      {selectedSources.size > 1 && (
        <Card style={{ marginBottom: 20 }}>
          <h4>How should multiple sources be combined?</h4>
          <FormGroup>
            <label className="bp4-control bp4-radio">
              <input
                type="radio"
                checked={mergeMode === 'separate'}
                onChange={() => {
                  setMergeMode('separate');
                  updateSelection(selectedSources, sourcePaths);
                }}
              />
              <span className="bp4-control-indicator" />
              <span>
                <strong>Keep sources separate</strong>
                <div style={{ fontSize: 12, color: '#5c7080', marginLeft: 20 }}>
                  Map fields from each source independently
                </div>
              </span>
            </label>
            
            <label className="bp4-control bp4-radio">
              <input
                type="radio"
                checked={mergeMode === 'combined'}
                onChange={() => {
                  setMergeMode('combined');
                  updateSelection(selectedSources, sourcePaths);
                }}
              />
              <span className="bp4-control-indicator" />
              <span>
                <strong>Combine into single dataset</strong>
                <div style={{ fontSize: 12, color: '#5c7080', marginLeft: 20 }}>
                  Merge all sources into one unified structure
                </div>
              </span>
            </label>
          </FormGroup>
        </Card>
      )}

      {/* Summary */}
      <Card style={{ backgroundColor: '#f5f8fa', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
          <Icon icon="info-sign" />
          <strong>Selection Summary:</strong>
          {selectedSources.size === 0 ? (
            <span style={{ color: '#5c7080' }}>No sources selected</span>
          ) : (
            <>
              <Tag intent={Intent.PRIMARY}>
                {selectedSources.size} source{selectedSources.size !== 1 ? 's' : ''} selected
              </Tag>
              {Array.from(selectedSources).map(sourceId => {
                const source = dataSources.find(ds => ds.id === sourceId);
                return (
                  <Tag key={sourceId} minimal>
                    {source?.name}
                  </Tag>
                );
              })}
            </>
          )}
        </div>
      </Card>

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          intent={Intent.PRIMARY}
          text="Next: Define Output Structure"
          rightIcon="arrow-right"
          onClick={onNext}
          disabled={!canProceed}
          large
        />
      </div>
    </div>
  );
};

export default SourceSelector;