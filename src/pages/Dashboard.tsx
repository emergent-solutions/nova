import React, { useState, useEffect } from 'react';
import {
  Card,
  Elevation,
  Button,
  Intent,
  Icon,
  NonIdealState,
  Spinner,
  Tag,
  H1,
  H3,
  H5
} from '@blueprintjs/core';
import { supabase } from '../lib/supabase';
import { APIEndpoint, AnalyticsData } from '../types/api.types';
import { formatDistanceToNow } from 'date-fns';
import './Dashboard.css';

interface DashboardProps {
  onCreateEndpoint: () => void;
  onNavigate?: (view: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onCreateEndpoint, onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [endpoints, setEndpoints] = useState<APIEndpoint[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load endpoints
      const { data: endpointsData } = await supabase
        .from('api_endpoints')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (endpointsData) {
        setEndpoints(endpointsData);
      }

      // Load analytics summary
      const { data: analyticsData } = await supabase
        .rpc('get_analytics_summary', {
          time_period: '30d'
        });
      
      if (analyticsData) {
        setAnalytics(analyticsData);
      }

      // Load recent activity
      const { data: activityData } = await supabase
        .from('api_access_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (activityData) {
        setRecentActivity(activityData);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIntent = (status: number) => {
    if (status >= 200 && status < 300) return Intent.SUCCESS;
    if (status >= 400 && status < 500) return Intent.WARNING;
    if (status >= 500) return Intent.DANGER;
    return Intent.NONE;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <Spinner size={50} />
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Hero Section */}
      <div className="dashboard-hero">
        <div className="hero-content">
          <h1>Welcome to Emergent Nova</h1>
          <p>Create powerful agents to serve your data</p>
          <Button
            large
            intent={Intent.PRIMARY}
            icon="add"
            onClick={onCreateEndpoint}
          >
            Create Your First Agent
          </Button>
        </div>
        <div className="hero-illustration">
          <Icon icon="data-connection" size={120} />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <Card className="stat-card">
          <div className="stat-value">{endpoints.length}</div>
          <div className="stat-label">Active Agents</div>
          <Icon icon="globe-network" className="stat-icon" />
        </Card>
        
        <Card className="stat-card">
          <div className="stat-value">
            {analytics?.total_requests || 0}
          </div>
          <div className="stat-label">Calls This Month</div>
          <Icon icon="exchange" className="stat-icon" />
        </Card>
        
        <Card className="stat-card">
          <div className="stat-value">
            {analytics?.average_response_time || 0}ms
          </div>
          <div className="stat-label">Avg Response Time</div>
          <Icon icon="time" className="stat-icon" />
        </Card>
        
        <Card className="stat-card">
          <div className="stat-value">
            {analytics?.unique_clients || 0}
          </div>
          <div className="stat-label">Unique Clients</div>
          <Icon icon="people" className="stat-icon" />
        </Card>
      </div>

      <div className="dashboard-content">
        <div className="dashboard-main">
          {/* Recent Endpoints */}
          <Card className="recent-endpoints" elevation={Elevation.ONE}>
            <div className="card-header">
              <H3>Recent Agents</H3>
              <Button
                minimal
                icon="arrow-right"
                text="View All"
                onClick={() => onNavigate?.('endpoints')}
              />
            </div>
            
            {endpoints.length > 0 ? (
              <div className="endpoints-list">
                {endpoints.map(endpoint => (
                  <div key={endpoint.id} className="endpoint-item">
                    <div className="endpoint-info">
                      <div className="endpoint-name">
                        <Icon icon="globe" />
                        <strong>{endpoint.name}</strong>
                      </div>
                      <code className="endpoint-url">
                        /api/{endpoint.slug}
                      </code>
                    </div>
                    <div className="endpoint-meta">
                      <Tag minimal intent={endpoint.active ? Intent.SUCCESS : Intent.NONE}>
                        {endpoint.active ? 'Active' : 'Inactive'}
                      </Tag>
                      <Tag minimal>
                        {endpoint.output_format.toUpperCase()}
                      </Tag>
                      <span className="endpoint-date">
                        {formatDistanceToNow(new Date(endpoint.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <NonIdealState
                icon="inbox"
                title="No endpoints yet"
                description="Create your first API endpoint to get started"
                action={
                  <Button intent={Intent.PRIMARY} onClick={onCreateEndpoint}>
                    Create Agent
                  </Button>
                }
              />
            )}
          </Card>

          {/* Quick Start Templates */}
          <Card className="templates-section" elevation={Elevation.ONE}>
            <H3>Quick Start Templates</H3>
            <div className="template-grid">
              <Card 
                interactive 
                className="template-card"
                onClick={() => console.log('RSS Template')}
              >
                <Icon icon="feed" size={30} />
                <H5>RSS to JSON API</H5>
                <p>Convert RSS feeds to RESTful JSON APIs</p>
              </Card>
              
              <Card 
                interactive 
                className="template-card"
                onClick={() => console.log('Database Template')}
              >
                <Icon icon="database" size={30} />
                <H5>Database REST API</H5>
                <p>Expose database tables as REST endpoints</p>
              </Card>
              
              <Card 
                interactive 
                className="template-card"
                onClick={() => console.log('Aggregator Template')}
              >
                <Icon icon="merge-columns" size={30} />
                <H5>Data Aggregator</H5>
                <p>Combine multiple sources into one API</p>
              </Card>
              
              <Card 
                interactive 
                className="template-card"
                onClick={() => console.log('Webhook Template')}
              >
                <Icon icon="lightning" size={30} />
                <H5>Webhook Processor</H5>
                <p>Transform webhooks into structured APIs</p>
              </Card>
            </div>
          </Card>
        </div>

        <div className="dashboard-sidebar">
          {/* Recent Activity */}
          <Card className="recent-activity" elevation={Elevation.ONE}>
            <H3>Recent Activity</H3>
            <div className="activity-list">
              {recentActivity.map((activity, index) => (
                <div key={activity.id || index} className="activity-item">
                  <Tag 
                    minimal 
                    intent={getStatusIntent(activity.response_status)}
                  >
                    {activity.response_status}
                  </Tag>
                  <span className="activity-method">
                    {activity.request_method}
                  </span>
                  <span className="activity-path">
                    {activity.request_path}
                  </span>
                  <span className="activity-time">
                    {activity.response_time_ms}ms
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Quick Actions */}
          <Card className="quick-actions" elevation={Elevation.ONE}>
            <H3>Quick Actions</H3>
            <div className="actions-list">
              <Button
                fill
                minimal
                alignText="left"
                icon="add"
                text="Create Agent"
                onClick={onCreateEndpoint}
              />
              <Button
                fill
                minimal
                alignText="left"
                icon="import"
                text="Import OpenAPI"
              />
              <Button
                fill
                minimal
                alignText="left"
                icon="document"
                text="View Documentation"
              />
              <Button
                fill
                minimal
                alignText="left"
                icon="cog"
                text="Settings"
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;