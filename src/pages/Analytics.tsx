import React, { useState, useEffect } from 'react';
import {
  Card,
  Elevation,
  HTMLSelect,
  Spinner,
  NonIdealState,
  Tag,
  Icon
} from '@blueprintjs/core';
import { supabase } from '../lib/supabase';
import { Line, Bar, Pie } from 'recharts';
import {
  LineChart,
  BarChart,
  PieChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';

const Analytics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');
  const [analyticsData, setAnalyticsData] = useState<any>({
    overview: {},
    requestsOverTime: [],
    topEndpoints: [],
    statusDistribution: [],
    responseTimeData: []
  });

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      
      // Get time range filter
      const startDate = getStartDate(timeRange);
      
      // Load access logs
      const { data: logs } = await supabase
        .from('api_access_logs')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (logs) {
        processAnalyticsData(logs);
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStartDate = (range: string) => {
    const now = new Date();
    switch (range) {
      case '24h': return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default: return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
  };

  const processAnalyticsData = (logs: any[]) => {
    // Overview metrics
    const overview = {
      totalRequests: logs.length,
      avgResponseTime: Math.round(
        logs.reduce((sum, log) => sum + (log.response_time_ms || 0), 0) / logs.length
      ),
      successRate: Math.round(
        (logs.filter(log => log.response_status >= 200 && log.response_status < 300).length / logs.length) * 100
      ),
      uniqueClients: new Set(logs.map(log => log.client_ip)).size
    };

    // Requests over time
    const requestsByHour: Record<string, number> = {};
    logs.forEach(log => {
      const hour = new Date(log.created_at).toISOString().slice(0, 13);
      requestsByHour[hour] = (requestsByHour[hour] || 0) + 1;
    });
    const requestsOverTime = Object.entries(requestsByHour)
      .map(([hour, count]) => ({
        time: hour,
        requests: count
      }))
      .sort((a, b) => a.time.localeCompare(b.time));

    // Top endpoints
    const endpointCounts: Record<string, number> = {};
    logs.forEach(log => {
      const path = log.request_path;
      endpointCounts[path] = (endpointCounts[path] || 0) + 1;
    });
    const topEndpoints = Object.entries(endpointCounts)
      .map(([endpoint, count]) => ({ endpoint, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Status distribution
    const statusCounts: Record<string, number> = {};
    logs.forEach(log => {
      const statusGroup = Math.floor(log.response_status / 100) + 'xx';
      statusCounts[statusGroup] = (statusCounts[statusGroup] || 0) + 1;
    });
    const statusDistribution = Object.entries(statusCounts)
      .map(([status, count]) => ({ status, count }));

    // Response time distribution
    const responseTimeData = logs
      .map(log => ({
        time: new Date(log.created_at).toISOString().slice(11, 19),
        responseTime: log.response_time_ms
      }))
      .slice(0, 100); // Last 100 requests

    setAnalyticsData({
      overview,
      requestsOverTime,
      topEndpoints,
      statusDistribution,
      responseTimeData
    });
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spinner size={50} />
      </div>
    );
  }

  return (
    <div className="analytics-page" style={{ padding: '24px' }}>
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <h1>API Analytics</h1>
        <HTMLSelect
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
        >
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </HTMLSelect>
      </div>

      {/* Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <Card elevation={Elevation.ONE}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
                {analyticsData.overview.totalRequests}
              </div>
              <div style={{ color: '#5c7080' }}>Total Requests</div>
            </div>
            <Icon icon="exchange" size={30} style={{ opacity: 0.3 }} />
          </div>
        </Card>

        <Card elevation={Elevation.ONE}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
                {analyticsData.overview.avgResponseTime}ms
              </div>
              <div style={{ color: '#5c7080' }}>Avg Response Time</div>
            </div>
            <Icon icon="time" size={30} style={{ opacity: 0.3 }} />
          </div>
        </Card>

        <Card elevation={Elevation.ONE}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
                {analyticsData.overview.successRate}%
              </div>
              <div style={{ color: '#5c7080' }}>Success Rate</div>
            </div>
            <Icon icon="tick-circle" size={30} style={{ opacity: 0.3 }} />
          </div>
        </Card>

        <Card elevation={Elevation.ONE}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
                {analyticsData.overview.uniqueClients}
              </div>
              <div style={{ color: '#5c7080' }}>Unique Clients</div>
            </div>
            <Icon icon="people" size={30} style={{ opacity: 0.3 }} />
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <Card elevation={Elevation.ONE}>
          <h3>Requests Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analyticsData.requestsOverTime}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="requests" stroke="#137cbd" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card elevation={Elevation.ONE}>
          <h3>Status Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={analyticsData.statusDistribution}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label
              >
                {analyticsData.statusDistribution.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Top Endpoints */}
      <Card elevation={Elevation.ONE}>
        <h3>Top Endpoints</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={analyticsData.topEndpoints}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="endpoint" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#137cbd" />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
};

export default Analytics;