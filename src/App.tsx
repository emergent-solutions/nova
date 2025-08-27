// src/App.tsx (Correct version for API Builder)
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
import EndpointsGrid from './pages/EndpointsGrid';
import Analytics from './pages/Analytics';
import Documentation from './pages/Documentation';
import { APIWizard } from './components/APIWizard/APIWizard';
import './styles/global.css';

const App: React.FC = () => {
  const { user, loading, signOut } = useAuth();
  const [currentView, setCurrentView] = useState<'dashboard' | 'endpoints' | 'analytics' | 'docs'>('dashboard');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardMode, setWizardMode] = useState<'create' | 'edit'>('create');
  const [editingEndpoint, setEditingEndpoint] = useState(null);

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
              <strong>API Builder</strong>
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
                icon="list" 
                text="Endpoints"
                active={currentView === 'endpoints'}
                onClick={() => setCurrentView('endpoints')}
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
                <EndpointsGrid onEditEndpoint={handleEditEndpoint} onCreateEndpoint={handleCreateEndpoint} /> :
              currentView === 'analytics' ?
                <Analytics /> :
                <Documentation />
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
            }}
          />
        )}
      </div>
    </Router>
  );
};

export default App;