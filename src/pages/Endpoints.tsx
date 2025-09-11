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
  HTMLTable
} from '@blueprintjs/core';
import { supabase } from '../lib/supabase';
import { APIEndpoint } from '../types/api.types';
import { formatDistanceToNow } from 'date-fns';

type SortField = 'name' | 'slug' | 'output_format' | 'active' | 'created_at' | 'cache_enabled' | 'auth_required';
type SortDirection = 'asc' | 'desc';

interface EndpointsPageProps {
  onEditEndpoint: (endpoint: APIEndpoint) => void;
  onCreateEndpoint: () => void;
}

const toaster = Toaster.create({ position: 'top' });

const EndpointsPage: React.FC<EndpointsPageProps> = ({ onEditEndpoint, onCreateEndpoint, refreshTrigger }) => {
  const [endpoints, setEndpoints] = useState<APIEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState<APIEndpoint | null>(null);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    loadEndpoints();
  }, [refreshTrigger]);

  const loadEndpoints = async () => {
    try {
      console.log('Loading endpoints...');
      
      const { data, error } = await supabase
        .from('api_endpoints')
        .select('*')
        .order('created_at', { ascending: false });

      console.log('Endpoints response:', { data, error });
      
      if (error) throw error;
      setEndpoints(data || []);
    } catch (error) {
      console.error('Failed to load endpoints:', error);
      toaster.show({ message: 'Failed to load endpoints', intent: Intent.DANGER });
    } finally {
      setLoading(false);
    }
  };

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

  const sortedEndpoints = [...endpoints].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];

    // Handle cache_enabled and auth_required specially
    if (sortField === 'cache_enabled') {
      aVal = a.cache_config?.enabled;
      bVal = b.cache_config?.enabled;
    }
    if (sortField === 'auth_required') {
      aVal = a.auth_config?.required;
      bVal = b.auth_config?.required;
    }

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

  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return (
      <Icon 
        icon={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'} 
        size={12}
        style={{ marginLeft: '4px' }}
      />
    );
  };

  const handleDelete = async () => {
    if (!selectedEndpoint) return;

    try {
      const { error } = await supabase
        .from('api_endpoints')
        .delete()
        .eq('id', selectedEndpoint.id);

      if (error) throw error;

      toaster.show({ 
        message: 'Endpoint deleted successfully', 
        intent: Intent.SUCCESS 
      });
      
      loadEndpoints();
    } catch (error) {
      console.error('Failed to delete endpoint:', error);
      toaster.show({ 
        message: 'Failed to delete endpoint', 
        intent: Intent.DANGER 
      });
    } finally {
      setDeleteDialogOpen(false);
      setSelectedEndpoint(null);
    }
  };

  const toggleEndpointStatus = async (endpoint: APIEndpoint) => {
    try {
      const { error } = await supabase
        .from('api_endpoints')
        .update({ active: !endpoint.active })
        .eq('id', endpoint.id);

      if (error) throw error;

      toaster.show({
        message: `Agent ${endpoint.active ? 'deactivated' : 'activated'}`,
        intent: Intent.SUCCESS
      });

      loadEndpoints();
    } catch (error) {
      console.error('Failed to toggle endpoint status:', error);
      toaster.show({ 
        message: 'Failed to update endpoint status', 
        intent: Intent.DANGER 
      });
    }
  };

  const getEndpointUrl = (endpoint: APIEndpoint) => {
    // Use the current domain as the base URL
    const baseUrl = window.location.origin;
    return `${baseUrl}/api/${endpoint.slug}`;
  };

  const copyEndpointUrl = (endpoint: APIEndpoint) => {
    const url = getEndpointUrl(endpoint);
    navigator.clipboard.writeText(url);
    toaster.show({ message: 'URL copied to clipboard', intent: Intent.SUCCESS });
  };

  const testEndpoint = (endpoint: APIEndpoint) => {
    const url = getEndpointUrl(endpoint);
    // Open the endpoint in a new tab
    window.open(url, '_blank');
  };

  const handleEditEndpoint = async (endpoint: APIEndpoint) => {
    try {
      // First, fetch the complete endpoint data with all relationships
      const { data: fullEndpoint, error: endpointError } = await supabase
        .from('api_endpoints')
        .select(`
          *,
          api_endpoint_sources (
            *,
            data_source:data_sources (*)
          )
        `)
        .eq('id', endpoint.id)
        .single();

      if (endpointError) throw endpointError;

      console.log('Full endpoint data for editing:', fullEndpoint);
      
      // Call the onEditEndpoint prop with the full endpoint data
      onEditEndpoint(fullEndpoint);
    } catch (error) {
      console.error('Failed to load endpoint details:', error);
      toaster.show({ 
        message: 'Failed to load endpoint details', 
        intent: Intent.DANGER 
      });
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <Spinner size={50} />
      </div>
    );
  }

  return (
    <div className="endpoints-grid-page" style={{ padding: '24px' }}>
      <div className="page-header" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <h1 style={{ margin: 0 }}>Agents</h1>
        <Button
          large
          intent={Intent.PRIMARY}
          icon="add"
          text="Create New Agent"
          onClick={onCreateEndpoint}
        />
      </div>

      {endpoints.length === 0 ? (
        <Card style={{ padding: '40px', textAlign: 'center' }}>
          <NonIdealState
            icon="inbox"
            title="No endpoints yet"
            description="Create your first Agent to get started"
            action={
              <Button 
                intent={Intent.PRIMARY} 
                icon="add"
                text="Create Agent"
                onClick={onCreateEndpoint}
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
                  onClick={() => handleSort('slug')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  Agent URL <SortIndicator field="slug" />
                </th>
                <th 
                  onClick={() => handleSort('output_format')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  Format <SortIndicator field="output_format" />
                </th>
                <th 
                  onClick={() => handleSort('active')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  Status <SortIndicator field="active" />
                </th>
                <th 
                  onClick={() => handleSort('cache_enabled')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  Cache <SortIndicator field="cache_enabled" />
                </th>
                <th 
                  onClick={() => handleSort('auth_required')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  Auth <SortIndicator field="auth_required" />
                </th>
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
              {sortedEndpoints.map(endpoint => (
                <tr key={endpoint.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Icon icon="globe-network" />
                      <strong>{endpoint.name}</strong>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <code style={{ 
                        fontSize: '12px',
                        backgroundColor: '#f5f5f5',
                        padding: '2px 6px',
                        borderRadius: '3px'
                      }}>
                        /api/{endpoint.slug}
                      </code>
                      <Button
                        minimal
                        small
                        icon="duplicate"
                        onClick={() => copyEndpointUrl(endpoint)}
                        title="Copy full URL"
                      />
                    </div>
                  </td>
                  <td>
                    <Tag minimal>{endpoint.output_format?.toUpperCase() || 'JSON'}</Tag>
                  </td>
                  <td>
                    <Tag 
                      intent={endpoint.active ? Intent.SUCCESS : Intent.NONE}
                      interactive
                      onClick={() => toggleEndpointStatus(endpoint)}
                      style={{ cursor: 'pointer' }}
                    >
                      {endpoint.active ? 'Active' : 'Inactive'}
                    </Tag>
                  </td>
                  <td>
                    <Tag minimal intent={endpoint.cache_config?.enabled ? Intent.PRIMARY : Intent.NONE}>
                      {endpoint.cache_config?.enabled ? `${endpoint.cache_config.ttl}s` : 'Off'}
                    </Tag>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {endpoint.auth_config?.type && endpoint.auth_config.type !== 'none' && (
                        <Icon icon="lock" size={12} />
                      )}
                      <span>{endpoint.auth_config?.type || 'none'}</span>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: '12px', color: '#5c7080' }}>
                      {formatDistanceToNow(new Date(endpoint.created_at), { addSuffix: true })}
                    </span>
                  </td>
                  <td>
                    <ButtonGroup minimal>
                      <Button
                        icon="edit"
                        small
                        onClick={() => handleEditEndpoint(endpoint)}
                        title="Edit endpoint"
                      />
                      <Button
                        icon="play"
                        small
                        intent={Intent.PRIMARY}
                        onClick={() => testEndpoint(endpoint)}
                        title="Open endpoint in new tab"
                      />
                      <Button
                        icon="document"
                        small
                        onClick={() => window.open(`/docs/${endpoint.slug}`, '_blank')}
                        title="View documentation"
                      />
                      <Button
                        icon="trash"
                        small
                        intent={Intent.DANGER}
                        onClick={() => {
                          setSelectedEndpoint(endpoint);
                          setDeleteDialogOpen(true);
                        }}
                        title="Delete endpoint"
                      />
                    </ButtonGroup>
                  </td>
                </tr>
              ))}
            </tbody>
          </HTMLTable>
        </Card>
      )}

      <Dialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        title="Delete Agent"
        icon="trash"
        canEscapeKeyClose
        canOutsideClickClose
      >
        <div className={Classes.DIALOG_BODY}>
          <p>
            Are you sure you want to delete the endpoint <strong>{selectedEndpoint?.name}</strong>?
          </p>
          <p style={{ color: '#d13913' }}>
            <Icon icon="warning-sign" /> This action cannot be undone.
          </p>
        </div>
        <div className={Classes.DIALOG_FOOTER}>
          <div className={Classes.DIALOG_FOOTER_ACTIONS}>
            <Button 
              onClick={() => setDeleteDialogOpen(false)}
              text="Cancel"
            />
            <Button 
              intent={Intent.DANGER} 
              onClick={handleDelete}
              text="Delete"
              icon="trash"
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default EndpointsPage;