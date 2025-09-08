import React, { useState } from 'react';
import {
  Card,
  FormGroup,
  RadioGroup,
  Radio,
  Button,
  Intent,
  Tag,
  Tree,
  TreeNode,
  Callout,
  Icon
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
  const [selectedSource, setSelectedSource] = useState(selection.sources[0]?.id || '');
  const [selectedPath, setSelectedPath] = useState(selection.primaryPath || '');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const handleSourceSelect = (sourceId: string) => {
    setSelectedSource(sourceId);
    const source = dataSources.find(ds => ds.id === sourceId);
    if (source) {
      // Analyze the source data structure
      const data = sampleData[sourceId];
      const paths = findArraysAndObjects(data);
      
      // Auto-select if only one viable path
      if (paths.length === 1) {
        handlePathSelect(paths[0].path, paths[0].type);
      }
    }
  };

  const handlePathSelect = (path: string, type: 'array' | 'object') => {
    setSelectedPath(path);
    onChange({
      type,
      primaryPath: path,
      sources: [{
        id: selectedSource,
        name: dataSources.find(ds => ds.id === selectedSource)?.name || '',
        path,
        type
      }]
    });
  };

  const renderDataTree = () => {
    if (!selectedSource || !sampleData[selectedSource]) {
      return (
        <NonIdealState
          icon="search"
          title="No data available"
          description="Select a data source and fetch sample data first"
        />
      );
    }

    const data = sampleData[selectedSource];
    const paths = findArraysAndObjects(data);

    return (
      <div className="path-selection">
        <h4>Select the data structure to map:</h4>
        <RadioGroup
          selectedValue={selectedPath}
          onChange={(e) => {
            const path = e.currentTarget.value;
            const pathInfo = paths.find(p => p.path === path);
            if (pathInfo) {
              handlePathSelect(path, pathInfo.type);
            }
          }}
        >
          {paths.map(({ path, type, count }) => (
            <Radio
              key={path}
              value={path}
              label={
                <span className="path-option">
                  <Icon icon={type === 'array' ? 'array' : 'box'} />
                  <code>{path || 'root'}</code>
                  <Tag minimal intent={Intent.PRIMARY}>
                    {type === 'array' ? `${count} items` : 'object'}
                  </Tag>
                </span>
              }
            />
          ))}
        </RadioGroup>
      </div>
    );
  };

  return (
    <div className="source-selector">
      <Card>
        <h4>Select Data Source</h4>
        <RadioGroup
          selectedValue={selectedSource}
          onChange={(e) => handleSourceSelect(e.currentTarget.value)}
        >
          {dataSources.map(source => (
            <Radio
              key={source.id}
              value={source.id}
              label={
                <span>
                  <strong>{source.name}</strong>
                  <Tag minimal>{source.type}</Tag>
                </span>
              }
            />
          ))}
        </RadioGroup>
      </Card>

      {selectedSource && (
        <Card style={{ marginTop: 20 }}>
          {renderDataTree()}
        </Card>
      )}

      <div className="step-actions">
        <Button
          intent={Intent.PRIMARY}
          text="Next: Define Output Structure"
          rightIcon="arrow-right"
          disabled={!selectedPath}
          onClick={onNext}
        />
      </div>
    </div>
  );
};