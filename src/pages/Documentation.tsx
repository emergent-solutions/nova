import React from 'react';
import { Card, Elevation, Button, Intent, Tab, Tabs } from '@blueprintjs/core';

const Documentation: React.FC = () => {
  return (
    <div className="documentation-page" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>API Documentation</h1>
      
      <Card elevation={Elevation.ONE} style={{ marginBottom: '24px' }}>
        <h2>Getting Started</h2>
        <p>Welcome to the Emergent Nova documentation. This guide will help you create and manage Agents.</p>
        
        <h3>Quick Start</h3>
        <ol>
          <li>Create a data source (API, Database, RSS, or File)</li>
          <li>Design your Agent using the wizard</li>
          <li>Configure transformations and relationships</li>
          <li>Test and deploy your Agent</li>
        </ol>
      </Card>

      <Tabs id="docs-tabs">
        <Tab id="endpoints" title="Agents" panel={
          <Card>
            <h3>Managing Agents</h3>
            <p>Learn how to create, edit, and manage your Agents.</p>
          </Card>
        } />
        <Tab id="auth" title="Authentication" panel={
          <Card>
            <h3>Authentication Methods</h3>
            <p>Configure different authentication methods for your Agents.</p>
          </Card>
        } />
        <Tab id="transforms" title="Transformations" panel={
          <Card>
            <h3>Data Transformations</h3>
            <p>Transform and manipulate your data before output.</p>
          </Card>
        } />
      </Tabs>
    </div>
  );
};

export default Documentation;