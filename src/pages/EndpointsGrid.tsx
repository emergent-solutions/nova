import React, { useState, useEffect, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  Button,
  ButtonGroup,
  Intent,
  Tag,
  Icon,
  Dialog,
  Classes,
  Toaster
} from '@blueprintjs/core';
import { supabase } from '../lib/supabase';
import { APIEndpoint } from '../types/api.types';
import { formatDistanceToNow } from 'date-fns';

interface EndpointsGridProps {
  onEditEndpoint: (endpoint: APIEndpoint) => void;
  onCreateEndpoint: () => void;
}

const toaster = Toaster.create({ position: 'top' });

const EndpointsGrid: React.FC<EndpointsGridProps> = ({ onEditEndpoint, onCreateEndpoint }) => {
  const gridRef = useRef<AgGridReact>(null);
  const [endpoints, setEndpoints] = useState<APIEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState<APIEndpoint | null>(null);

  useEffect(() => {
    loadEndpoints();
  }, []);

  const loadEndpoints = async () => {
    try {
      const { data, error } = await supabase
        .from('api_endpoints')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEndpoints(data || []);
    } catch (error) {
      console.error('Failed to load endpoints:', error);
      toaster.show({ message: 'Failed to load endpoints', intent: Intent.DANGER });
    } finally {
      setLoading(false);
    }
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
        message: `Endpoint ${endpoint.active ? 'deactivated' : 'activated'}`,
        intent: Intent.SUCCESS
      });

      loadEndpoints();
    } catch (error) {
      console.error('Failed to toggle endpoint status:', error);
    }
  };

  const copyEndpointUrl = (endpoint: APIEndpoint) => {
    const url = `https://your-api.com/api/${endpoint.slug}`;
    navigator.clipboard.writeText(url);
    toaster.show({ message: 'URL copied to clipboard', intent: Intent.SUCCESS });
  };

  const columnDefs = [
    {
      field: 'name',
      headerName: 'Name',
      flex: 1,
      cellRenderer: (params: any) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icon icon="globe-network" />
          <strong>{params.value}</strong>
        </div>
      )
    },
    {
      field: 'slug',
      headerName: 'Endpoint URL',
      flex: 1,
      cellRenderer: (params: any) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <code style={{ fontSize: '12px' }}>/api/{params.value}</code>
          <Button
            minimal
            small
            icon="duplicate"
            onClick={() => copyEndpointUrl(params.data)}
          />
        </div>
      )
    },
    {
      field: 'output_format',
      headerName: 'Format',
      width: 100,
      cellRenderer: (params: any) => (
        <Tag minimal>{params.value?.toUpperCase()}</Tag>
      )
    },
    {
      field: 'active',
      headerName: 'Status',
      width: 120,
      cellRenderer: (params: any) => (
        <Tag 
          intent={params.value ? Intent.SUCCESS : Intent.NONE}
          interactive
          onClick={() => toggleEndpointStatus(params.data)}
        >
          {params.value ? 'Active' : 'Inactive'}
        </Tag>
      )
    },
    {
      field: 'cache_config',
      headerName: 'Cache',
      width: 100,
      valueGetter: (params: any) => params.data.cache_config?.enabled,
      cellRenderer: (params: any) => (
        <Tag minimal intent={params.value ? Intent.PRIMARY : Intent.NONE}>
          {params.value ? `${params.data.cache_config.ttl}s` : 'Off'}
        </Tag>
      )
    },
    {
      field: 'auth_config',
      headerName: 'Auth',
      width: 120,
      valueGetter: (params: any) => params.data.auth_config?.type || 'none',
      cellRenderer: (params: any) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {params.value !== 'none' && <Icon icon="lock" size={12} />}
          <span>{params.value}</span>
        </div>
      )
    },
    {
      field: 'created_at',
      headerName: 'Created',
      width: 150,
      valueFormatter: (params: any) => 
        formatDistanceToNow(new Date(params.value), { addSuffix: true })
    },
    {
      headerName: 'Actions',
      width: 200,
      cellRenderer: (params: any) => (
        <ButtonGroup minimal>
          <Button
            icon="edit"
            onClick={() => onEditEndpoint(params.data)}
          />
          <Button
            icon="play"
            onClick={() => window.open(`/test/${params.data.slug}`, '_blank')}
          />
          <Button
            icon="document"
            onClick={() => window.open(`/docs/${params.data.slug}`, '_blank')}
          />
          <Button
            icon="trash"
            intent={Intent.DANGER}
            onClick={() => {
              setSelectedEndpoint(params.data);
              setDeleteDialogOpen(true);
            }}
          />
        </ButtonGroup>
      )
    }
  ];

  return (
    <div className="endpoints-grid-page">
      <div className="page-header">
        <h1>API Endpoints</h1>
        <Button
          large
          intent={Intent.PRIMARY}
          icon="add"
          text="Create New Endpoint"
          onClick={onCreateEndpoint}
        />
      </div>

      <div className="ag-theme-alpine" style={{ height: 'calc(100vh - 150px)', width: '100%' }}>
        <AgGridReact
          ref={gridRef}
          rowData={endpoints}
          columnDefs={columnDefs}
          defaultColDef={{
            sortable: true,
            filter: true,
            resizable: true
          }}
          pagination={true}
          paginationPageSize={20}
          rowSelection="single"
          animateRows={true}
        />
      </div>

      <Dialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        title="Delete Endpoint"
      >
        <div className={Classes.DIALOG_BODY}>
          <p>Are you sure you want to delete the endpoint <strong>{selectedEndpoint?.name}</strong>?</p>
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

export default EndpointsGrid;
