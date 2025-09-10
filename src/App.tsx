import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { 
  Navbar, 
  Button, 
  Alignment,
  ButtonGroup,
  Intent,
  Spinner
} from '@blueprintjs/core';
import { supabase } from './lib/supabase';
import { useAuth } from './hooks/useAuth';
import LoginForm from './components/LoginForm';
import AuthCallback from './components/AuthCallback';
import Dashboard from './pages/Dashboard';
import EndpointsPage from './pages/Endpoints';
import Analytics from './pages/Analytics';
import Documentation from './pages/Documentation';
import { APIWizard } from './components/APIWizard/APIWizard';

import './styles/global.css';
import DataSourcesPage from './pages/DataSources';

const App: React.FC = () => {
  const { user, loading, signOut } = useAuth();
  const [currentView, setCurrentView] = useState<'dashboard' | 'endpoints' | 'analytics' | 'docs' | 'data-sources'>('dashboard');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardMode, setWizardMode] = useState<'create' | 'edit'>('create');
  const [editingEndpoint, setEditingEndpoint] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);


  const handleCreateEndpoint = () => {
    setWizardMode('create');
    setEditingEndpoint(null);
    setWizardOpen(true);
  };

  const handleEditEndpoint = (endpoint: any) => {
    setWizardMode('edit');
    setEditingEndpoint(endpoint);
    setWizardOpen(true);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <Spinner intent={Intent.PRIMARY} size={50} />
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  return (
    <Router>
      <div className="app">
        <Navbar className="bp5-dark">
          <Navbar.Group align={Alignment.LEFT}>
            <Navbar.Heading>
              <strong>Emergent Nova</strong>
            </Navbar.Heading>
            <Navbar.Divider />
            
            <ButtonGroup>
              <Button 
                className="bp5-minimal" 
                icon="dashboard" 
                text="Dashboard"
                active={currentView === 'dashboard'}
                onClick={() => setCurrentView('dashboard')}
              />
              <Button 
                className="bp5-minimal" 
                icon="predictive-analysis" 
                text="Agents"
                active={currentView === 'endpoints'}
                onClick={() => setCurrentView('endpoints')}
              />
              <Button 
                className="bp5-minimal" 
                icon="data-connection" 
                text="Sources"
                active={currentView === 'data-sources'}
                onClick={() => setCurrentView('data-sources')}
              />
              <Button 
                className="bp5-minimal" 
                icon="chart" 
                text="Analytics"
                active={currentView === 'analytics'}
                onClick={() => setCurrentView('analytics')}
              />
              <Button 
                className="bp5-minimal" 
                icon="document" 
                text="Documentation"
                active={currentView === 'docs'}
                onClick={() => setCurrentView('docs')}
              />
            </ButtonGroup>
          </Navbar.Group>

          <Navbar.Group align={Alignment.RIGHT}>
            <Button 
              intent={Intent.SUCCESS}
              icon="add"
              text="Create Endpoint"
              onClick={handleCreateEndpoint}
            />
            <Navbar.Divider />
            <Button 
              className="bp5-minimal"
              icon="user"
              text={user.email}
            />
            <Button 
              className="bp5-minimal"
              icon="log-out"
              onClick={signOut}
            />
          </Navbar.Group>
        </Navbar>

        <div className="main-content">
          <Routes>
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/" element={
              currentView === 'dashboard' ? 
                <Dashboard onCreateEndpoint={handleCreateEndpoint} /> :
              currentView === 'endpoints' ?
                <EndpointsPage onEditEndpoint={handleEditEndpoint} onCreateEndpoint={handleCreateEndpoint} refreshTrigger={refreshTrigger} /> :
              currentView === 'analytics' ?
                <Analytics /> :
              currentView === 'docs' ?
                <Documentation /> :
              currentView === 'data-sources' ?
                <DataSourcesPage /> :
              <Dashboard onCreateEndpoint={handleCreateEndpoint} />
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>

        {wizardOpen && (
          <APIWizard
            isOpen={wizardOpen}
            mode={wizardMode}
            existingEndpoint={editingEndpoint}
            onClose={() => setWizardOpen(false)}
            onComplete={(endpoint) => {
              setWizardOpen(false);
              setCurrentView('endpoints');
              setRefreshTrigger(prev => prev + 1); // Trigger refresh
            }}
          />
        )}
      </div>
    </Router>
  );
};

export default App;