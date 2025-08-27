import { supabase } from '../lib/supabase';
import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  Box,
  Button,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  CircularProgress,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Typography,
  Paper,
  Toolbar,
  Divider
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import WarningIcon from '@mui/icons-material/Warning';
import ApiIcon from '@mui/icons-material/Api';
import RssFeedIcon from '@mui/icons-material/RssFeed';
import StorageIcon from '@mui/icons-material/Storage';
import FolderIcon from '@mui/icons-material/Folder';
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions';
import SyncIcon from '@mui/icons-material/Sync';
import EditIcon from '@mui/icons-material/Edit';
import GitBranchIcon from '@mui/icons-material/AccountTree';
import DatabaseIcon from '@mui/icons-material/DataObject';
import ErrorIcon from '@mui/icons-material/Error';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import ScheduleIcon from '@mui/icons-material/Schedule';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { useIntegrations } from '../hooks/useIntegrations';
import DataWizard from '../components/DataWizard';
import { IntegrationEditDialog } from '../components/IntegrationEditDialog';
import { Integration } from '../types/api';
import 'ag-grid-enterprise';

const IntegrationsPage: React.FC = () => {
  const gridRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { 
    integrations, 
    loading, 
    error, 
    updateIntegration, 
    deleteIntegration, 
    refreshIntegrations, 
    triggerManualSync,
    resetStuckSync,
    getSyncStatus 
  } = useIntegrations();

  // UI State
  const [selectedRows, setSelectedRows] = useState<Integration[]>([]);
  const [searchText, setSearchText] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Dialog states
  const [dataWizardOpen, setDataWizardOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<Integration | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemsToDelete, setItemsToDelete] = useState<Integration[]>([]);

  // Snackbar state
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info' as 'success' | 'error' | 'info' | 'warning'
  });  

  const handleCloseSnackbar = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  const handleDelete = (integration: Integration) => {
    prepareDelete([integration]);
  };

  // Get icon for integration type
  const getIntegrationIcon = (type: string) => {
    switch (type) {
      case 'api':
        return <ApiIcon fontSize="small" />;
      case 'rss':
        return <RssFeedIcon fontSize="small" />;
      case 'database':
        return <StorageIcon fontSize="small" />;
      case 'file':
        return <FolderIcon fontSize="small" />;
      default:
        return <IntegrationInstructionsIcon fontSize="small" />;
    }
  };

  const NameCellRenderer = (props: any) => {
    const icon = getIntegrationIcon(props.data.type);
    
    return (
      <span style={{ display: 'flex', alignItems: 'center' }}>
        {icon}
        <span style={{ marginLeft: '8px' }}>{props.value}</span>
      </span>
    );
  };

  const handleEdit = (integration: any) => {
    setEditingIntegration(integration);
    setEditDialogOpen(true);
  };

  // Enhanced sync handler with user feedback
  const handleSyncWithFeedback = async (integration: Integration, forceSync: boolean = false) => {
    try {
       const { isStuck } = getSyncStatus(integration.id);
      
      // If stuck, automatically use force
      const shouldForce = forceSync || isStuck;
      
      showSnackbar(
        shouldForce 
          ? `Force syncing ${integration.name}...` 
          : `Starting sync for ${integration.name}...`, 
        'info'
      );
      
      const result = await triggerManualSync(integration.id, shouldForce);
      
      showSnackbar(
        `Successfully synced ${result.itemsProcessed || 0} items for ${integration.name}`,
        'success'
      );
      
      // Refresh specific rows in the grid
      if (gridRef.current?.api) {
        const rowNode = gridRef.current.api.getRowNode(integration.id);
        if (rowNode) {
          rowNode.setData({ ...integration, ...result });
        }
      }
    } catch (error) {
      showSnackbar(
        `Sync failed for ${integration.name}: ${error.message}`,
        'error'
      );
    }
  };

  // Handle reset for stuck syncs
  const handleResetSync = async (integrationId: string) => {
    try {
      await resetStuckSync(integrationId);
      showSnackbar('Sync status reset, starting force sync...', 'info');
      
      // Refresh the specific row to show idle status
      if (gridRef.current?.api) {
        const rowNode = gridRef.current.api.getRowNode(integrationId);
        if (rowNode) {
          rowNode.setDataValue('sync_status', 'idle');
        }
      }
      
      // Now trigger a force sync
      const integration = integrations.find(i => i.id === integrationId);
      if (integration) {
        const result = await triggerManualSync(integrationId, true);  // FORCE = TRUE
        showSnackbar(
          `Force sync completed! ${result.itemsProcessed || 0} items processed.`,
          'success'
        );
      }
    } catch (error) {
      showSnackbar('Failed to reset and sync', 'error');
    }
  };
  
  const columnDefs = useMemo(() => [
    {
      field: 'active',
      headerName: 'Active',
      width: 100,
      filter: true, // Enable filter
      filterParams: {
        values: [true, false],
        suppressMiniFilter: true
      },
      cellRenderer: (params: any) => {
        return (
          <input 
            type="checkbox" 
            checked={params.value} 
            onChange={() => {
              const newValue = !params.value;
              params.node.setDataValue('active', newValue);
            }}
            style={{ cursor: 'pointer' }}
          />
        );
      },
      editable: false,
      sortable: true
    },
    {
      field: 'name',
      headerName: 'Name',
      flex: 1,
      minWidth: 200,
      sortable: true,
      filter: 'agTextColumnFilter',
      cellRenderer: (params: any) => {
        const icon = getIntegrationIcon(params.data.type);
        
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {icon}
            <span style={{ fontWeight: 500 }}>{params.value}</span>
          </Box>
        );
      },
      tooltipField: 'name'
    },
    {
      field: 'type',
      headerName: 'Type',
      width: 150,
      sortable: true,
      filter: 'agTextColumnFilter',
      cellRenderer: (params: any) => {
        let icon;
        let chipColor: any = 'default';
        let tooltip = params.value?.toUpperCase() || 'Unknown';
        let additionalInfo = null;
        
        // Get detailed info for database integrations
        if (params.value === 'database' && params.data.database_config) {
          const queries = Object.values(params.data.database_config.queries || {});
          const parentChildCount = queries.filter((q: any) => q.mode === 'parent-child').length;
          const simpleCount = queries.filter((q: any) => q.mode !== 'parent-child').length;
          
          tooltip = `Database - ${queries.length} queries (${parentChildCount} parent-child, ${simpleCount} simple)`;
          
          if (parentChildCount > 0) {
            additionalInfo = (
              <Tooltip title={`${parentChildCount} parent-child queries`}>
                <GitBranchIcon fontSize="small" color="primary" />
              </Tooltip>
            );
          }
        }
        
        switch (params.value) {
          case 'api':
            icon = <ApiIcon fontSize="small" />;
            chipColor = 'primary';
            break;
          case 'rss':
            icon = <RssFeedIcon fontSize="small" />;
            chipColor = 'secondary';
            break;
          case 'database':
            icon = <StorageIcon fontSize="small" />;
            chipColor = 'success';
            break;
          case 'file':
            icon = <FolderIcon fontSize="small" />;
            chipColor = 'info';
            break;
          default:
            icon = <DatabaseIcon fontSize="small" />;
        }
        
        return (
          <Tooltip title={tooltip}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Chip
                icon={icon}
                label={params.value?.toUpperCase()}
                size="small"
                color={chipColor}
                variant="outlined"
              />
              {additionalInfo}
            </span>
          </Tooltip>
        );
      }
    },
    {
      field: 'url',
      headerName: 'Source',
      width: 250,
      valueGetter: (params: any) => {
        if (params.data.type === 'api' && params.data.api_config) {
          return params.data.api_config.url || params.data.url || '';
        }
        if (params.data.type === 'file' && params.data.file_config) {
          if (params.data.file_config.source === 'upload') {
            return params.data.file_config.fileName || 'Uploaded file';
          }
          return params.data.file_config.url || params.data.url || '';
        }
        if (params.data.type === 'database' && params.data.database_config) {
          const connections = Object.values(params.data.database_config.connections || {});
          if (connections.length > 0) {
            const conn = connections[0] as any;
            return `${conn.host}:${conn.port || 'default'}/${conn.database}`;
          }
        }
        return params.data.url || '';
      },
      tooltipValueGetter: (params: any) => params.value,
      cellRenderer: (params: any) => {
        if (!params.value) return <span style={{ color: '#999' }}>—</span>;
        
        return (
          <Tooltip title={params.value}>
            <span style={{ 
              fontSize: '12px', 
              color: '#666',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {params.value}
            </span>
          </Tooltip>
        );
      }
    },
    {
      field: 'sync_status',
      headerName: 'Sync Status',
      width: 140,
      cellRenderer: (params: any) => {
        const { status, lastError, isStuck } = getSyncStatus(params.data.id);
        
        // Only show sync status for syncable types
        if (!['file', 'database', 'api'].includes(params.data.type)) {
          return <Chip label="N/A" size="small" variant="outlined" />;
        }
        
        let chipColor: any = 'default';
        let chipIcon = null;
        let label = status || 'idle';
        
        switch (status) {
          case 'running':
            if (isStuck) {
              chipColor = 'error';
              chipIcon = <ErrorIcon />;
              label = 'Stuck';
            } else {
              chipColor = 'primary';
              chipIcon = <CircularProgress size={16} color="inherit" />;
              label = 'Syncing';
            }
            break;
          case 'success':
            chipColor = 'success';
            chipIcon = <CheckCircleIcon />;
            label = 'Success';
            break;
          case 'error':
            chipColor = 'error';
            chipIcon = <ErrorIcon />;
            label = 'Error';
            break;
          case 'pending':  // New status from DB
            chipColor = 'warning';
            chipIcon = <HourglassEmptyIcon />;
            label = 'Pending';
            break;
          case 'scheduled':  // New status from DB
            chipColor = 'info';
            chipIcon = <ScheduleIcon />;  // Need to import this
            label = 'Scheduled';
            break;
          case 'ready':  // New status from DB
            chipColor = 'info';
            chipIcon = <CheckCircleOutlineIcon />;  // Need to import this
            label = 'Ready';
            break;
          case 'idle':
          default:
            chipColor = 'default';
            chipIcon = <HourglassEmptyIcon />;
            label = 'Idle';
        }
        
        return (
          <Tooltip title={lastError || `Status: ${label}`}>
            <Chip 
              label={label} 
              size="small" 
              color={chipColor}
              icon={chipIcon}
              variant={status === 'running' && !isStuck ? 'filled' : 'outlined'}
            />
          </Tooltip>
        );
      },
      sortable: true
    },
    {
      field: 'last_sync_at',
      headerName: 'Last Sync',
      width: 160,
      cellRenderer: (params: any) => {
        if (!params.value) return 'Never';
        
        const date = new Date(params.value);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        
        let displayText;
        if (diffMins < 1) {
          displayText = 'Just now';
        } else if (diffMins < 60) {
          displayText = `${diffMins}m ago`;
        } else if (diffMins < 1440) {
          displayText = `${Math.floor(diffMins / 60)}h ago`;
        } else if (diffMins < 2880) { // Less than 2 days
          displayText = 'Yesterday';
        } else if (diffMins < 10080) { // Less than 7 days
          displayText = `${Math.floor(diffMins / 1440)}d ago`;
        } else {
          // Show date with time for older syncs
          displayText = date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
          });
        }
        
        // Full date/time in tooltip
        const fullDateTime = date.toLocaleString();
        
        return (
          <Tooltip title={fullDateTime}>
            <span>{displayText}</span>
          </Tooltip>
        );
      }
    },
    {
      field: 'next_sync_at',
      headerName: 'Next Sync',
      width: 160,
      valueGetter: (params: any) => {
        if (!['file', 'database'].includes(params.data.type)) return null;
        
        // Return actual next_sync_at if available
        if (params.data.next_sync_at) {
          return params.data.next_sync_at;
        }
        
        // Calculate based on sync config
        if (params.data.sync_config?.enabled && params.data.last_sync_at) {
          const lastSync = new Date(params.data.last_sync_at);
          const intervalMs = (params.data.sync_config.interval || 60) * 60 * 1000;
          const nextSync = new Date(lastSync.getTime() + intervalMs);
          return nextSync.toISOString();
        }
        
        return null;
      },
      cellRenderer: (params: any) => {
        if (!params.value) {
          return <span style={{ color: '#999' }}>—</span>;
        }
        
        const nextSyncDate = new Date(params.value);
        const now = new Date();
        const diffMs = nextSyncDate.getTime() - now.getTime();
        
        if (diffMs < 0) {
          return (
            <Chip 
              label="Overdue" 
              size="small" 
              color="warning"
              variant="outlined"
            />
          );
        }
        
        const diffMins = Math.floor(diffMs / 60000);
        let label = '';
        let color = '#666';
        
        if (diffMins < 60) {
          label = `${diffMins}m`;
          color = diffMins < 5 ? '#ff5722' : '#ff9800';
        } else if (diffMins < 1440) {
          label = `${Math.floor(diffMins / 60)}h`;
          color = '#2196f3';
        } else {
          label = `${Math.floor(diffMins / 1440)}d`;
          color = '#666';
        }
        
        return (
          <Tooltip title={nextSyncDate.toLocaleString()}>
            <Chip 
              label={label} 
              size="small" 
              style={{ 
                backgroundColor: `${color}20`,
                color: color,
                borderColor: color
              }}
              variant="outlined"
            />
          </Tooltip>
        );
      },
      sortable: true
    },
    {
      field: 'sync_info',
      headerName: 'Sync Info',
      width: 200,
      valueGetter: (params: any) => {
        if (!['file', 'database', 'api'].includes(params.data.type)) return '';
        
        const parts = [];

        if (params.data.sync_config) {
          if (!params.data.sync_config.enabled) {
            return 'Sync disabled';
          }
        }
        
        // Add sync mode
        if (params.data.sync_config?.syncMode) {
          parts.push(params.data.sync_config.syncMode === 'update' ? 'Update' : 'Replace');
        }
        
        // Add interval
        if (params.data.sync_config?.interval) {
          const interval = params.data.sync_config.interval;
          const unit = params.data.sync_config.intervalUnit || 'minutes';
          parts.push(`Every ${interval} ${unit}`);
        }
        
        // Add item count from last sync
        if (params.data.last_sync_result?.itemsProcessed) {
          parts.push(`${params.data.last_sync_result.itemsProcessed} items`);
        }
        
        return parts.join(' • ');
      },
      cellRenderer: (params: any) => {
        if (!params.value) return null;
        
        // Just return plain text
        return (
          <span style={{ fontSize: '12px', color: '#666' }}>
            {params.value}
          </span>
        );
      }
    },
    {
      field: 'created_at',
      headerName: 'Created',
      width: 120,
      valueFormatter: (params: any) => {
        if (!params.value) return '';
        return new Date(params.value).toLocaleDateString();
      },
      sortable: true,
      filter: 'agDateColumnFilter'
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 180,
      sortable: false,
      filter: false,
      cellRenderer: (params: any) => {
        const { status, isStuck } = getSyncStatus(params.data.id);
        const canSync = ['file', 'database', 'api'].includes(params.data.type);
        const isSyncing = status === 'running' && !isStuck;
        
        return (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {canSync && (
              <>
                <Tooltip title={isStuck ? 'Force Sync (was stuck)' : isSyncing ? 'Syncing...' : 'Sync Now'}>
                  <span>
                    <IconButton
                      size="small"
                      onClick={() => handleSyncWithFeedback(params.data, isStuck)}
                      disabled={isSyncing && !isStuck || !params.data.active}
                      color={isStuck ? "warning" : "primary"}
                    >
                      {isSyncing && !isStuck ? (
                        <CircularProgress size={20} />
                      ) : (
                        <SyncIcon fontSize="small" />
                      )}
                    </IconButton>
                  </span>
                </Tooltip>
                
                {isStuck && (
                  <Tooltip title="Reset Stuck Sync">
                    <IconButton
                      size="small"
                      onClick={() => handleResetSync(params.data.id)}
                      color="error"
                    >
                      <RestartAltIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </>
            )}
            
            <Tooltip title="Edit Integration">
              <IconButton
                size="small"
                onClick={() => handleEdit(params.data)}
                color="default"
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Delete Integration">
              <IconButton
                size="small"
                onClick={() => prepareDelete([params.data])}
                color="error"
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        );
      }
    }
  ], []);

  // Default column definition
  const defaultColDef = useMemo(() => ({
    resizable: true,
    editable: false,
    sortable: true,
    suppressMenu: true,
    floatingFilter: true,
    filter: true
  }), []);

  const onGridReady = useCallback((params) => {
    if (containerRef.current) {
      params.api.sizeColumnsToFit();
    }
  }, []);

  // Handle selection changed
  const onSelectionChanged = useCallback(() => {
    if (!gridRef.current) return;
    const selected = gridRef.current.api.getSelectedRows();
    setSelectedRows(selected);
  }, []);

  // Handle cell value changed
  const onCellValueChanged = useCallback(async (event: any) => {
    const { data, colDef, newValue } = event;
    
    try {
      await updateIntegration(data.id, { [colDef.field]: newValue });
      showSnackbar('Integration updated successfully', 'success');
    } catch (error) {
      console.error('Failed to update integration:', error);
      showSnackbar('Failed to update integration', 'error');
      // Revert the change in the grid
      if (gridRef.current?.api) {
        gridRef.current.api.applyTransaction({
          update: [{ ...data, [colDef.field]: data[colDef.field] }]
        });
      }
    }
  }, [updateIntegration]);

  // Handle double-click to edit
  const onCellDoubleClicked = useCallback((params: any) => {
    const { data } = params;
    
    if (data) {
      setEditingIntegration(data);
      setEditDialogOpen(true);
    }
  }, []);
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshIntegrations();
      showSnackbar('Integrations refreshed', 'success');
    } catch (error) {
      showSnackbar('Failed to refresh integrations', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const prepareDelete = (items?: any[]) => {
    const toDelete = items || selectedRows;
    if (toDelete.length === 0) return;
    setItemsToDelete(toDelete);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    try {
      for (const integration of itemsToDelete) {
        await deleteIntegration(integration.id);
      }
      showSnackbar(`Deleted ${itemsToDelete.length} integration(s)`, 'success');
      setSelectedRows([]);
      setItemsToDelete([]);
      setDeleteDialogOpen(false);
    } catch (error) {
      showSnackbar('Failed to delete integrations', 'error');
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleSnackbarClose = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  const handleExport = () => {
    if (gridRef.current?.api) {
      gridRef.current.api.exportDataAsCsv({
        fileName: `integrations_${new Date().toISOString().split('T')[0]}.csv`
      });
    }
  };

  const handleEditIntegration = async (updates: Partial<Integration>) => {
    if (!editingIntegration) return;
    
    try {
      // The updates object should already have the correct structure
      // with everything in api_config, so just pass it through
      await updateIntegration(editingIntegration.id, updates);
      showSnackbar('Integration updated successfully', 'success');
      await refreshIntegrations();
    } catch (error) {
      showSnackbar('Failed to update integration', 'error');
      throw error;
    }
  };
  
  // Grid options
  const gridOptions = useMemo(() => ({
    rowSelection: 'multiple',
    animateRows: true,
    getRowId: (params: any) => params.data.id,
    quickFilterText: searchText, // <-- Using searchText here
    suppressRowClickSelection: true,
    enableCellTextSelection: true,
    ensureDomOrder: true,
    suppressCellSelection: true,
    // Status bar configuration
    statusBar: {
      statusPanels: [
        { 
          statusPanel: 'agTotalAndFilteredRowCountComponent',
          align: 'left' 
        },
        {
          statusPanel: 'agSelectedRowCountComponent',
          align: 'center'
        },
        {
          statusPanel: 'agAggregationComponent',
          align: 'right'
        }
      ]
    }
  }), [searchText]);

    // Handle search text change
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(event.target.value);
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchText('');
  };

  // Toggle filters
  const handleToggleFilters = () => {
    setShowFilters(!showFilters);
    // Refresh column definitions to show/hide floating filters
    if (gridRef.current?.api) {
      gridRef.current.api.refreshHeader();
    }
  };
  
  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (gridRef.current?.api && integrations.length > 0) {
        gridRef.current.api.sizeColumnsToFit();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [integrations]);

  if (loading && integrations.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Alert severity="error">Error loading integrations: {error}</Alert>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="toolbar">
        <Tooltip title="Add New Integration">
          <IconButton
            onClick={() => setDataWizardOpen(true)}
            className="toolbar-button"
            size="small"
            color="primary"
          >
            <AddIcon />
          </IconButton>
        </Tooltip>
        <div style={{ flex: 1 }} />
        <Tooltip title="Refresh">
          <span>
            <IconButton
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="toolbar-button"
              size="small"
              color="primary"
            >
              <RefreshIcon style={{
                animation: isRefreshing ? 'spin 1.5s linear infinite' : 'none'
              }} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Delete Selected">
          <span>
            <IconButton
              onClick={prepareDelete}
              disabled={selectedRows.length === 0}
              className="toolbar-button"
              size="small"
              color="error"
            >
              <DeleteIcon />
            </IconButton>
          </span>
        </Tooltip>
      </div>
      
      <div 
        ref={containerRef}
        className="ag-theme-alpine" 
        style={{ flex: 1, overflow: 'auto' }}
      >
        <AgGridReact
          ref={gridRef}
          rowData={integrations}
          gridOptions={gridOptions}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          onCellValueChanged={onCellValueChanged}
          onCellDoubleClicked={onCellDoubleClicked}
          onSelectionChanged={onSelectionChanged}
          onGridReady={onGridReady}
          loading={loading}
          popupParent={document.body}
          suppressContextMenu={true}
        />
      </div>
      
      {/* Data Wizard Dialog */}
      <DataWizard
        isOpen={dataWizardOpen}
        onClose={(event, reason) => {
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
            return; // Prevent closing
          }
          
          setDataWizardOpen(false);
          // Refresh integrations after wizard closes
          refreshIntegrations();
        }}
        refreshIntegrations={refreshIntegrations}  // Pass this prop
      />
      
      {/* Integration Edit Dialog */}
      <IntegrationEditDialog
        open={editDialogOpen}
        onClose={(event, reason) => {
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
            return; // Prevent closing
          }
          setEditDialogOpen(false);
          setEditingIntegration(null);
        }}
        integration={editingIntegration}
        onSave={handleEditIntegration}
      />
      
      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        aria-labelledby="delete-dialog-title"
        maxWidth="md"
      >
        <DialogTitle id="delete-dialog-title">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <WarningIcon color="error" style={{ marginRight: 8 }} />
            Confirm Deletion
          </div>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Are you sure you want to delete the following integrations? This action cannot be undone.
          </Typography>
          <List>
            {itemsToDelete.map(item => (
              <ListItem key={item.id}>
                <ListItemIcon>
                  {getIntegrationIcon(item.type)}
                </ListItemIcon>
                <ListItemText 
                  primary={item.name} 
                  secondary={`Type: ${item.type.toUpperCase()}`}
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} color="primary">
            Cancel
          </Button>
          <Button onClick={confirmDelete} color="error" variant="contained" autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Snackbar for feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default IntegrationsPage;
