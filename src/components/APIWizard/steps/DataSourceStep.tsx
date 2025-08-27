import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Icon,
  NonIdealState,
  Spinner,
  Tag,
  Intent,
  Callout
} from '@blueprintjs/core';
import { supabase } from '../../../lib/supabase';
import { DataSource } from '../../../types/datasource.types';

interface DataSourceStepProps {
  config: any;
  onUpdate: (updates: any) => void;
}

const DataSourceStep: React.FC<DataSourceStepProps> = ({ config, onUpdate }) => {
  const [availableSources, setAvailableSources] = useState<DataSource[]>([]);
  const [selectedSources, setSelectedSources] = useState<DataSource[]>(config.dataSources || []);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDataSources();
  }, []);

  const loadDataSources = async () => {
    try {
      const { data } = await supabase
        .from('data_sources')
        .select('*')
        .eq('active', true)
        .order('name');
      
      if (data) {
        setAvailableSources(data);
      }
    } catch (error) {
      console.error('Failed to load data sources:', error);
    } finally {
      setLoading(false);
    }
  };

  const addSource = (source: DataSource) => {
    const updated = [...selectedSources, source];
    setSelectedSources(updated);
    onUpdate({ dataSources: updated });
  };

  const removeSource = (sourceId: string) => {
    const updated = selectedSources.filter(s => s.id !== sourceId);
    setSelectedSources(updated);
    onUpdate({ dataSources: updated });
  };

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'api': return 'cloud';
      case 'database': return 'database';
      case 'rss': return 'feed';
      case 'file': return 'document';
      default: return 'data-connection';
    }
  };

  if (loading) {
    return <Spinner />;
  }

  return (
    <div className="datasource-step">
      <Callout intent={Intent.PRIMARY} icon="info-sign">
        Select one or more data sources to combine into your API endpoint.
        You can create relationships between multiple sources in the next step.
      </Callout>

      <div className="sources-container">
        <div className="available-sources">
          <h4>Available Data Sources</h4>
          {availableSources.length > 0 ? (
            <div className="source-list">
              {availableSources
                .filter(s => !selectedSources.find(sel => sel.id === s.id))
                .map(source => (
                  <Card
                    key={source.id}
                    interactive
                    className="source-card"
                    onClick={() => addSource(source)}
                  >
                    <Icon icon={getSourceIcon(source.type)} />
                    <div className="source-info">
                      <strong>{source.name}</strong>
                      <Tag minimal>{source.type}</Tag>
                    </div>
                    <Icon icon="add" />
                  </Card>
                ))}
            </div>
          ) : (
            <NonIdealState
              icon="inbox"
              title="No data sources"
              description="Create data sources first before building an API endpoint"
            />
          )}
        </div>

        <div className="selected-sources">
          <h4>Selected Sources ({selectedSources.length})</h4>
          {selectedSources.length > 0 ? (
            <div className="source-list">
              {selectedSources.map((source, index) => (
                <Card key={source.id} className="source-card selected">
                  <div className="source-order">{index + 1}</div>
                  <Icon icon={getSourceIcon(source.type)} />
                  <div className="source-info">
                    <strong>{source.name}</strong>
                    <Tag minimal>{source.type}</Tag>
                    {index === 0 && <Tag intent={Intent.SUCCESS}>Primary</Tag>}
                  </div>
                  <Button
                    minimal
                    icon="cross"
                    onClick={() => removeSource(source.id)}
                  />
                </Card>
              ))}
            </div>
          ) : (
            <NonIdealState
              icon="select"
              title="No sources selected"
              description="Click on available sources to add them"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default DataSourceStep;