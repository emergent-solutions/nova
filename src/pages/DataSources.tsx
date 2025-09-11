import React, { useState, useEffect } from 'react';
import {
  Button,
  ButtonGroup,
  Intent,
  Tag,
  Icon,
  Dialog,
  Classes,
  Toaster,
  Spinner,
  Card,
  NonIdealState,
  HTMLTable,
  FormGroup,
  InputGroup,
  TextArea,
  HTMLSelect,
  Switch,
  Callout
} from '@blueprintjs/core';
import { supabase } from '../lib/supabase';
import { formatDistanceToNow } from 'date-fns';

interface DataSource {
  id: string;
  name: string;
  type: string;
  category: string;
  active: boolean;
  api_config?: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    auth_type?: string;
    data_path?: string;
  };
  database_config?: {
    host?: string;
    port?: number;
    database?: string;
    query?: string;
  };
  file_config?: {
    file_path?: string;
    format?: string;
  };
  created_at: string;
  updated_at: string;
  user_id: string;
}

// Add sorting types
type SortField = 'name' | 'type' | 'category' | 'active' | 'created_at';
type SortDirection = 'asc' | 'desc';

const toaster = Toaster.create({ position: 'top' });

const DataSourcesPage: React.FC = () => {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedDataSource, setSelectedDataSource] = useState<DataSource | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Add sorting state
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'api',
    category: '',
    active: true,
    api_config: {
      url: '',
      method: 'GET',
      headers: {},
      auth_type: 'none',
      data_path: ''
    },
    database_config: {
      host: '',
      port: 5432,
      database: '',
      query: ''
    },
    file_config: {
      file_path: '',
      format: 'json'
    }
  });

  const dataSourceTypes = [
    { value: 'api', label: 'REST API' },
    { value: 'database', label: 'Database' },
    { value: 'file', label: 'File' },
    { value: 'rss', label: 'RSS Feed' },
    { value: 'graphql', label: 'GraphQL' }
  ];

  const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

  useEffect(() => {
    loadDataSources();
  }, []);

  const loadDataSources = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('data_sources')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDataSources(data || []);
    } catch (error) {
      console.error('Error loading data sources:', error);
      toaster.show({ 
        message: 'Failed to load data sources', 
        intent: Intent.DANGER 
      });
    } finally {
      setLoading(false);
    }
  };

  // Sorting function
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to ascending
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Sort the data sources
  const sortedDataSources = [...dataSources].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];

    // Handle null/undefined values
    if (aVal === null || aVal === undefined) aVal = '';
    if (bVal === null || bVal === undefined) bVal = '';

    // Convert to string for comparison if needed
    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
    if (typeof bVal === 'string') bVal = bVal.toLowerCase();

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Helper to render sort indicator
  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return (
      <Icon 
        icon={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'} 
        size={12}
        style={{ marginLeft: '4px', verticalAlign: 'middle' }}
      />
    );
  };

  const handleCreate = () => {
    setIsEditing(false);
    setFormData({
      name: '',
      type: 'api',
      category: '',
      active: true,
      api_config: {
        url: '',
        method: 'GET',
        headers: {},
        auth_type: 'none',
        data_path: ''
      },
      database_config: {
        host: '',
        port: 5432,
        database: '',
        query: ''
      },
      file_config: {
        file_path: '',
        format: 'json'
      }
    });
    setDialogOpen(true);
  };

  const handleEdit = (source: DataSource) => {
    setIsEditing(true);
    setSelectedDataSource(source);
    setFormData({
      name: source.name,
      type: source.type,
      category: source.category || '',
      active: source.active,
      api_config: source.api_config || {
        url: '',
        method: 'GET',
        headers: {},
        auth_type: 'none',
        data_path: ''
      },
      database_config: source.database_config || {
        host: '',
        port: 5432,
        database: '',
        query: ''
      },
      file_config: source.file_config || {
        file_path: '',
        format: 'json'
      }
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const dataToSave = {
        ...formData,
        user_id: user.id,
        updated_at: new Date().toISOString()
      };

      if (isEditing && selectedDataSource) {
        const { error } = await supabase
          .from('data_sources')
          .update(dataToSave)
          .eq('id', selectedDataSource.id);

        if (error) throw error;
        toaster.show({ 
          message: 'Data source updated successfully', 
          intent: Intent.SUCCESS 
        });
      } else {
        const { error } = await supabase
          .from('data_sources')
          .insert(dataToSave);

        if (error) throw error;
        toaster.show({ 
          message: 'Data source created successfully', 
          intent: Intent.SUCCESS 
        });
      }

      setDialogOpen(false);
      loadDataSources();
    } catch (error) {
      console.error('Error saving data source:', error);
      toaster.show({ 
        message: 'Failed to save data source', 
        intent: Intent.DANGER 
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedDataSource) return;

    try {
      const { error } = await supabase
        .from('data_sources')
        .delete()
        .eq('id', selectedDataSource.id);

      if (error) throw error;

      toaster.show({ 
        message: 'Data source deleted successfully', 
        intent: Intent.SUCCESS 
      });
      setDeleteDialogOpen(false);
      loadDataSources();
    } catch (error) {
      console.error('Error deleting data source:', error);
      toaster.show({ 
        message: 'Failed to delete data source', 
        intent: Intent.DANGER 
      });
    }
  };

  const toggleDataSourceStatus = async (source: DataSource) => {
    try {
      const { error } = await supabase
        .from('data_sources')
        .update({ active: !source.active })
        .eq('id', source.id);

      if (error) throw error;

      toaster.show({ 
        message: `Data source ${!source.active ? 'activated' : 'deactivated'}`, 
        intent: Intent.SUCCESS 
      });
      loadDataSources();
    } catch (error) {
      console.error('Error toggling data source status:', error);
      toaster.show({ 
        message: 'Failed to update status', 
        intent: Intent.DANGER 
      });
    }
  };

  const testConnection = async (source: DataSource) => {
    toaster.show({ 
      message: 'Testing connection...', 
      intent: Intent.NONE 
    });

    // Simulate connection test
    setTimeout(() => {
      const success = Math.random() > 0.3;
      toaster.show({ 
        message: success ? 'Connection successful' : 'Connection failed', 
        intent: success ? Intent.SUCCESS : Intent.DANGER 
      });
    }, 2000);
  };

  const getTypeIcon = (type: string) => {
    switch(type) {
      case 'api': return 'cloud';
      case 'database': return 'database';
      case 'file': return 'document';
      case 'rss': return 'feed';
      case 'graphql': return 'git-branch';
      default: return 'cube';
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spinner size={50} />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ margin: 0 }}>Data Sources</h1>
        <Button
          large
          intent={Intent.PRIMARY}
          icon="add"
          text="Add Data Source"
          onClick={handleCreate}
        />
      </div>

      {dataSources.length === 0 ? (
        <Card style={{ padding: '40px', textAlign: 'center' }}>
          <NonIdealState
            icon="database"
            title="No data sources yet"
            description="Create your first data source to start building Agents"
            action={
              <Button 
                intent={Intent.PRIMARY} 
                icon="add"
                text="Add Data Source"
                onClick={handleCreate}
              />
            }
          />
        </Card>
      ) : (
        <Card>
          <HTMLTable interactive striped style={{ width: '100%' }}>
            <thead>
              <tr>
                <th 
                  onClick={() => handleSort('name')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  Name <SortIndicator field="name" />
                </th>
                <th 
                  onClick={() => handleSort('type')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  Type <SortIndicator field="type" />
                </th>
                <th 
                  onClick={() => handleSort('category')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  Category <SortIndicator field="category" />
                </th>
                <th 
                  onClick={() => handleSort('active')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  Status <SortIndicator field="active" />
                </th>
                <th>Configuration</th>
                <th 
                  onClick={() => handleSort('created_at')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  Created <SortIndicator field="created_at" />
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedDataSources.map(source => (
                <tr key={source.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Icon icon={getTypeIcon(source.type)} />
                      <strong>{source.name}</strong>
                    </div>
                  </td>
                  <td>
                    <Tag minimal>{source.type.toUpperCase()}</Tag>
                  </td>
                  <td>
                    <Tag minimal intent={source.category === 'internal' ? Intent.PRIMARY : Intent.NONE}>
                      {source.category || 'Uncategorized'}
                    </Tag>
                  </td>
                  <td>
                    <Tag 
                      intent={source.active ? Intent.SUCCESS : Intent.NONE}
                      interactive
                      onClick={() => toggleDataSourceStatus(source)}
                      style={{ cursor: 'pointer' }}
                    >
                      {source.active ? 'Active' : 'Inactive'}
                    </Tag>
                  </td>
                  <td>
                    {source.type === 'api' && source.api_config?.url && (
                      <code style={{ fontSize: '11px', backgroundColor: '#f5f5f5', padding: '2px 4px', borderRadius: '3px' }}>
                        {source.api_config.method} {source.api_config.url.substring(0, 30)}...
                      </code>
                    )}
                    {source.type === 'database' && source.database_config?.host && (
                      <code style={{ fontSize: '11px', backgroundColor: '#f5f5f5', padding: '2px 4px', borderRadius: '3px' }}>
                        {source.database_config.host}:{source.database_config.port}
                      </code>
                    )}
                    {source.type === 'file' && source.file_config?.file_path && (
                      <code style={{ fontSize: '11px', backgroundColor: '#f5f5f5', padding: '2px 4px', borderRadius: '3px' }}>
                        {source.file_config.file_path}
                      </code>
                    )}
                  </td>
                  <td>
                    <span style={{ fontSize: '12px', color: '#5c7080' }}>
                      {formatDistanceToNow(new Date(source.created_at), { addSuffix: true })}
                    </span>
                  </td>
                  <td>
                    <ButtonGroup minimal>
                      <Button
                        icon="edit"
                        small
                        onClick={() => handleEdit(source)}
                        title="Edit data source"
                      />
                      <Button
                        icon="play"
                        small
                        intent={Intent.PRIMARY}
                        onClick={() => testConnection(source)}
                        title="Test connection"
                      />
                      <Button
                        icon="trash"
                        small
                        intent={Intent.DANGER}
                        onClick={() => {
                          setSelectedDataSource(source);
                          setDeleteDialogOpen(true);
                        }}
                        title="Delete data source"
                      />
                    </ButtonGroup>
                  </td>
                </tr>
              ))}
            </tbody>
          </HTMLTable>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={isEditing ? 'Edit Data Source' : 'Add Data Source'}
        icon={isEditing ? 'edit' : 'add'}
        canEscapeKeyClose
        canOutsideClickClose
        style={{ width: '600px' }}
      >
        <div className={Classes.DIALOG_BODY}>
          <FormGroup label="Name" labelFor="name" labelInfo="(required)">
            <InputGroup
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="e.g., Production Database"
            />
          </FormGroup>

          <FormGroup label="Type" labelFor="type">
            <HTMLSelect
              id="type"
              value={formData.type}
              onChange={(e) => setFormData({...formData, type: e.target.value})}
              options={dataSourceTypes}
              fill
            />
          </FormGroup>

          <FormGroup label="Category" labelFor="category" helperText="Optional category to organize your data sources">
            <InputGroup
              id="category"
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
              placeholder="e.g., weather, finance, internal, external"
            />
          </FormGroup>

          <FormGroup>
            <Switch
              checked={formData.active}
              onChange={(e) => setFormData({...formData, active: e.target.checked})}
              label="Active"
              alignIndicator="left"
            />
          </FormGroup>

          {/* API Configuration */}
          {formData.type === 'api' && (
            <>
              <FormGroup label="API URL" labelFor="url" labelInfo="(required)" helperText="Use relative URLs (/path) for same-host or full URLs">
                <InputGroup
                  id="url"
                  value={formData.api_config.url}
                  onChange={(e) => setFormData({
                    ...formData,
                    api_config: {...formData.api_config, url: e.target.value}
                  })}
                  placeholder="https://api.example.com/data"
                />
              </FormGroup>

              <FormGroup label="HTTP Method" labelFor="method">
                <HTMLSelect
                  id="method"
                  value={formData.api_config.method}
                  onChange={(e) => setFormData({
                    ...formData,
                    api_config: {...formData.api_config, method: e.target.value}
                  })}
                  options={httpMethods}
                  fill
                />
              </FormGroup>

              <FormGroup label="Data Path" labelFor="dataPath" helperText="Optional: JSONPath to data in response (e.g., data.items)">
                <InputGroup
                  id="dataPath"
                  value={formData.api_config.data_path}
                  onChange={(e) => setFormData({
                    ...formData,
                    api_config: {...formData.api_config, data_path: e.target.value}
                  })}
                  placeholder="data.results"
                />
              </FormGroup>
            </>
          )}

          {/* Database Configuration */}
          {formData.type === 'database' && (
            <>
              <FormGroup label="Host" labelFor="host">
                <InputGroup
                  id="host"
                  value={formData.database_config.host}
                  onChange={(e) => setFormData({
                    ...formData,
                    database_config: {...formData.database_config, host: e.target.value}
                  })}
                  placeholder="localhost"
                />
              </FormGroup>

              <FormGroup label="Port" labelFor="port">
                <InputGroup
                  id="port"
                  type="number"
                  value={formData.database_config.port}
                  onChange={(e) => setFormData({
                    ...formData,
                    database_config: {...formData.database_config, port: parseInt(e.target.value)}
                  })}
                  placeholder="5432"
                />
              </FormGroup>

              <FormGroup label="Database Name" labelFor="database">
                <InputGroup
                  id="database"
                  value={formData.database_config.database}
                  onChange={(e) => setFormData({
                    ...formData,
                    database_config: {...formData.database_config, database: e.target.value}
                  })}
                  placeholder="mydb"
                />
              </FormGroup>

              <FormGroup label="Query" labelFor="query">
                <TextArea
                  style={{ width: '100%' }}
                  id="query"
                  value={formData.database_config.query}
                  onChange={(e) => setFormData({
                    ...formData,
                    database_config: {...formData.database_config, query: e.target.value}
                  })}
                  placeholder="SELECT * FROM users"
                  fill
                  rows={4}
                />
              </FormGroup>
            </>
          )}

          {/* File Configuration */}
          {formData.type === 'file' && (
            <>
              <FormGroup label="File Path" labelFor="filePath">
                <InputGroup
                  id="filePath"
                  value={formData.file_config.file_path}
                  onChange={(e) => setFormData({
                    ...formData,
                    file_config: {...formData.file_config, file_path: e.target.value}
                  })}
                  placeholder="/data/export.csv"
                />
              </FormGroup>

              <FormGroup label="Format" labelFor="format">
                <HTMLSelect
                  id="format"
                  value={formData.file_config.format}
                  onChange={(e) => setFormData({
                    ...formData,
                    file_config: {...formData.file_config, format: e.target.value}
                  })}
                  options={['json', 'csv', 'xml', 'yaml']}
                  fill
                />
              </FormGroup>
            </>
          )}
        </div>

        <div className={Classes.DIALOG_FOOTER}>
          <div className={Classes.DIALOG_FOOTER_ACTIONS}>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button 
              intent={Intent.PRIMARY} 
              onClick={handleSave}
              disabled={!formData.name}
            >
              {isEditing ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        title="Delete Data Source"
        icon="trash"
        canEscapeKeyClose
        canOutsideClickClose
      >
        <div className={Classes.DIALOG_BODY}>
          <p>Are you sure you want to delete the data source <strong>{selectedDataSource?.name}</strong>?</p>
          <p>This action cannot be undone.</p>
        </div>
        <div className={Classes.DIALOG_FOOTER}>
          <div className={Classes.DIALOG_FOOTER_ACTIONS}>
            <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button intent={Intent.DANGER} onClick={handleDelete}>Delete</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default DataSourcesPage;