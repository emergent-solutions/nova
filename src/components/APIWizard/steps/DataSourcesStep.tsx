// src/components/APIWizard/steps/DataSourcesStep.tsx
import React, { useState } from 'react';
import {
  Card,
  Button,
  Icon,
  NonIdealState,
  Spinner,
  Tag,
  Intent,
  Callout,
  Classes,
  Checkbox,
  FormGroup,
  InputGroup,
  HTMLSelect,
  Divider
} from '@blueprintjs/core';
import { DataSource } from '../../../types/datasource.types';

interface DataSourcesStepProps {
  existingDataSources: DataSource[];
  newDataSources: any[];
  selectedDataSources: string[];
  onSelectExisting: (ids: string[]) => void;
  onAddNew: () => void;
  onUpdateNew: (index: number, updates: any) => void;
  onRemoveNew: (index: number) => void;
}

const DataSourcesStep: React.FC<DataSourcesStepProps> = ({
  existingDataSources,
  newDataSources,
  selectedDataSources,
  onSelectExisting,
  onAddNew,
  onUpdateNew,
  onRemoveNew
}) => {
  const [showExisting, setShowExisting] = useState(true);
  const [showNew, setShowNew] = useState(true);

  const handleToggleDataSource = (id: string) => {
    console.log('Toggling data source:', id, 'Currently selected:', selectedDataSources);
    if (selectedDataSources.includes(id)) {
      onSelectExisting(selectedDataSources.filter(dsId => dsId !== id));
    } else {
      onSelectExisting([...selectedDataSources, id]);
    }
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

  const getTypeColor = (type: string): Intent => {
    switch (type) {
      case 'api': return Intent.PRIMARY;
      case 'database': return Intent.SUCCESS;
      case 'rss': return Intent.WARNING;
      case 'file': return Intent.NONE;
      default: return Intent.NONE;
    }
  };

  const totalSelected = selectedDataSources.length + newDataSources.filter(ds => ds.name && ds.type).length;

  return (
    <div className="datasources-step">
      <Callout intent={Intent.PRIMARY} icon="info-sign">
        Select existing data sources or create new ones to combine into your API endpoint.
        You can create relationships between multiple sources in the next step.
      </Callout>

      {totalSelected === 0 && (
        <Callout intent={Intent.WARNING} icon="warning-sign" style={{ marginTop: '20px' }}>
          Please select at least one existing data source or create a new one.
        </Callout>
      )}

      {/* Existing Data Sources */}
      <Card style={{ marginTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h4 style={{ margin: 0 }}>Existing Data Sources</h4>
          <Button
            minimal
            icon={showExisting ? "chevron-up" : "chevron-down"}
            onClick={() => setShowExisting(!showExisting)}
          />
        </div>
        
        {showExisting && (
          <>
            {existingDataSources.length > 0 ? (
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {existingDataSources.map(source => {
                  const isSelected = selectedDataSources.includes(source.id);
                  return (
                    <Card
                      key={source.id}
                      interactive={false}
                      style={{
                        marginBottom: '10px',
                        backgroundColor: isSelected ? '#e1f0fe' : undefined,
                        border: isSelected ? '2px solid #137cbd' : '1px solid #e1e8ed',
                        padding: '10px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Checkbox
                          checked={isSelected}
                          onChange={(e) => {
                            console.log('Checkbox clicked for:', source.id, 'Current state:', isSelected);
                            handleToggleDataSource(source.id);
                          }}
                        />
                        <Icon icon={getSourceIcon(source.type)} size={20} />
                        <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => handleToggleDataSource(source.id)}>
                          <div style={{ fontWeight: 'bold' }}>{source.name}</div>
                          <div style={{ fontSize: '12px', color: '#5c7080' }}>
                            <Tag minimal intent={getTypeColor(source.type)}>
                              {source.type.toUpperCase()}
                            </Tag>
                            
                            {/* Add category tag here */}
                            {source.category && (
                              <Tag minimal intent={Intent.PRIMARY} icon="tag" style={{ marginLeft: '5px' }}>
                                {source.category}
                              </Tag>
                            )}
                            
                            {source.sync_config?.enabled && (
                              <Tag minimal intent={Intent.SUCCESS} style={{ marginLeft: '5px' }}>
                                Sync Enabled
                              </Tag>
                            )}
                            {source.last_sync_at && (
                              <span style={{ marginLeft: '10px' }}>
                                Last sync: {new Date(source.last_sync_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <NonIdealState
                icon="database"
                title="No existing data sources"
                description="Create a new data source below"
              />
            )}
          </>
        )}
      </Card>

      {/* New Data Sources */}
      <Card style={{ marginTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h4 style={{ margin: 0 }}>Create New Data Sources</h4>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Button
              minimal
              icon={showNew ? "chevron-up" : "chevron-down"}
              onClick={() => setShowNew(!showNew)}
            />
            <Button
              icon="add"
              text="Add New"
              intent={Intent.PRIMARY}
              onClick={onAddNew}
            />
          </div>
        </div>

        {showNew && (
          <>
            {newDataSources.length > 0 ? (
              <div>
                {newDataSources.map((source, index) => (
                  <Card key={index} style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                          <FormGroup label="Name" labelInfo="(required)">
                            <InputGroup
                              value={source.name}
                              onChange={(e) => onUpdateNew(index, { name: e.target.value })}
                              placeholder="e.g., Customer API"
                              intent={!source.name ? Intent.DANGER : Intent.NONE}
                            />
                          </FormGroup>

                          <FormGroup label="Type" labelInfo="(required)">
                            <HTMLSelect
                              value={source.type || ''}
                              onChange={(e) => {
                                const newType = e.target.value;
                                const updates: any = { type: newType };
                                
                                // Initialize type-specific config when type is selected
                                if (newType === 'api') {
                                  updates.api_config = { method: 'GET', auth_type: 'none', headers: {} };
                                } else if (newType === 'database') {
                                  updates.database_config = { connections: {} };
                                } else if (newType === 'file') {
                                  updates.file_config = { source: 'url', format: 'csv' };
                                }
                                
                                onUpdateNew(index, updates);
                              }}
                              fill
                            >
                              <option value="">Select type...</option>
                              <option value="api">REST API</option>
                              <option value="database">Database</option>
                              <option value="file">File</option>
                              <option value="rss">RSS Feed</option>
                            </HTMLSelect>
                          </FormGroup>
                        </div>

                        {/* Add Category field here */}
                        <FormGroup label="Category" labelInfo="(optional)">
                          <InputGroup
                            value={source.category || ''}
                            onChange={(e) => onUpdateNew(index, { category: e.target.value })}
                            placeholder="e.g., Customer Data, Analytics, External API"
                            leftIcon="tag"
                          />
                        </FormGroup>

                        {/* Or use a select with predefined categories */}
                        {/* <FormGroup label="Category" labelInfo="(optional)">
                          <HTMLSelect
                            value={source.category || ''}
                            onChange={(e) => onUpdateNew(index, { category: e.target.value })}
                            fill
                          >
                            <option value="">Select category...</option>
                            <option value="customer">Customer Data</option>
                            <option value="product">Product Data</option>
                            <option value="analytics">Analytics</option>
                            <option value="external">External API</option>
                            <option value="internal">Internal System</option>
                            <option value="reference">Reference Data</option>
                            <option value="transactional">Transactional</option>
                          </HTMLSelect>
                        </FormGroup> */}

                        {source.type && (
                          <Callout intent={Intent.PRIMARY} icon="info-sign">
                            You'll configure the details of this {source.type} source in the next step.
                          </Callout>
                        )}
                      </div>

                      <Button
                        icon="trash"
                        intent={Intent.DANGER}
                        minimal
                        onClick={() => onRemoveNew(index)}
                        style={{ marginLeft: '10px' }}
                      />
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <NonIdealState
                icon="add"
                title="No new data sources"
                description="Click 'Add New' to create a data source"
                action={
                  <Button
                    icon="add"
                    text="Add New Data Source"
                    intent={Intent.PRIMARY}
                    onClick={onAddNew}
                  />
                }
              />
            )}
          </>
        )}
      </Card>

      {/* Summary */}
      <Card style={{ marginTop: '20px', backgroundColor: '#f5f8fa' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Icon icon="list" />
          <strong>Summary:</strong>
          <Tag intent={Intent.PRIMARY}>
            {selectedDataSources.length} existing selected
          </Tag>
          <Tag intent={Intent.SUCCESS}>
            {newDataSources.filter(ds => ds.name && ds.type).length} new configured
          </Tag>
          <Tag intent={Intent.NONE}>
            {totalSelected} total sources
          </Tag>
        </div>
      </Card>
    </div>
  );
};

export default DataSourcesStep;