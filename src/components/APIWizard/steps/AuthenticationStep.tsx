// src/components/APIWizard/steps/AuthenticationStep.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  FormGroup,
  Switch,
  RadioGroup,
  Radio,
  InputGroup,
  Button,
  Callout,
  Intent,
  Tag,
  Divider,
  HTMLSelect,
  Icon,
  Collapse,
  TextArea,
  Code,
  Classes,
  Spinner,
  Position,
  Toaster
} from '@blueprintjs/core';
import { APIEndpointConfig } from '../../../types/schema.types';
import CurlCommandGenerator from '../components/CurlCommandGenerator';
import { supabase } from '../../../lib/supabase';

// Create toaster instance for notifications
const AppToaster = Toaster.create({
  position: Position.TOP
});

interface AuthenticationStepProps {
  config: APIEndpointConfig;
  onUpdate: (updates: Partial<APIEndpointConfig>) => void;
  onDraftCreated?: (draftId: string | null) => void;
}

const AuthenticationStep: React.FC<AuthenticationStepProps> = ({ config, onUpdate, onDraftCreated }) => {
  const [authEnabled, setAuthEnabled] = useState(config.authentication?.required || false);
  const [authType, setAuthType] = useState(config.authentication?.type || 'none');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [testToken, setTestToken] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  
  // Auto-draft states
  const [draftId, setDraftId] = useState<string | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftStatus, setDraftStatus] = useState<'none' | 'saving' | 'saved' | 'error'>('none');
  const draftTimeoutRef = useRef<NodeJS.Timeout>();
  const lastSavedAuthRef = useRef<string>('');

  // Initialize auth config if not present
  const authConfig = config.authentication || {
    required: false,
    type: 'none',
    config: {}
  };

  // Auto-save draft when authentication is configured
  useEffect(() => {
    const saveDraft = async () => {
      console.log('saveDraft called', { authEnabled, slug: config.slug });
  
      // Only save if we have auth enabled and a slug
      if (!authEnabled || !config.slug) {
        return;
      }

      // Check if auth config has actually changed
      const currentAuthString = JSON.stringify(authConfig);
      if (currentAuthString === lastSavedAuthRef.current) {
        return; // No changes, skip saving
      }

      // Clear existing timeout
      if (draftTimeoutRef.current) {
        clearTimeout(draftTimeoutRef.current);
      }

      // Debounce the save by 1 second
      draftTimeoutRef.current = setTimeout(async () => {
        setIsSavingDraft(true);
        setDraftStatus('saving');

        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            throw new Error('No authenticated user');
          }

          // Generate a unique draft slug to avoid conflicts
          // Option 1: Add timestamp suffix for drafts
          const draftSlug = `${config.slug}-draft-${Date.now()}`;
          
          // Option 2: Use the same slug but rely on the partial unique index
          // const draftSlug = config.slug;

          const endpointData = {
            name: config.name || `[DRAFT] ${config.slug}`,
            slug: config.slug, // Use the actual slug if you've applied the SQL fix
            // slug: draftSlug, // Use this if you haven't applied the SQL fix
            description: config.description || 'Auto-draft for authentication testing',
            output_format: config.outputFormat || 'json',
            auth_config: authConfig,
            active: true, // Make it active so it can be tested
            is_draft: true, // Mark as draft
            user_id: user.id,
            schema_config: {
              type: 'custom',
              schema: config.outputSchema || {},
              mapping: []
            },
            // Minimal configs for other features
            transform_config: { transformations: [] },
            relationship_config: { relationships: [] },
            cache_config: { enabled: false, ttl: 300 },
            rate_limit_config: { enabled: false, requests_per_minute: 60 }
          };

          let savedDraftId = draftId;

          if (draftId) {
            // Update existing draft
            const { error } = await supabase
              .from('api_endpoints')
              .update({
                ...endpointData,
                updated_at: new Date().toISOString()
              })
              .eq('id', draftId);

            if (error) throw error;
          } else {
            // Check if a draft already exists for this slug and user
            const { data: existingDraft } = await supabase
              .from('api_endpoints')
              .select('id')
              .eq('slug', config.slug)
              .eq('user_id', user.id)
              .eq('is_draft', true)
              .single();

            if (existingDraft) {
              // Update the existing draft instead of creating a new one
              const { error } = await supabase
                .from('api_endpoints')
                .update({
                  ...endpointData,
                  updated_at: new Date().toISOString()
                })
                .eq('id', existingDraft.id);

              if (error) throw error;
              savedDraftId = existingDraft.id;
              setDraftId(existingDraft.id);
              
              if (onDraftCreated) {
                onDraftCreated(existingDraft.id);
              }
            } else {
              // Create new draft
              const { data, error } = await supabase
                .from('api_endpoints')
                .insert({
                  ...endpointData,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })
                .select()
                .single();

              if (error) {
                // If we get a unique constraint error, try to find and update existing
                if (error.code === '23505') {
                  // Try to find an existing endpoint with this slug
                  const { data: existing } = await supabase
                    .from('api_endpoints')
                    .select('id')
                    .eq('slug', config.slug)
                    .eq('user_id', user.id)
                    .single();

                  if (existing) {
                    // Update it to be a draft
                    const { error: updateError } = await supabase
                      .from('api_endpoints')
                      .update({
                        ...endpointData,
                        is_draft: true,
                        updated_at: new Date().toISOString()
                      })
                      .eq('id', existing.id);

                    if (updateError) throw updateError;
                    savedDraftId = existing.id;
                    setDraftId(existing.id);
                    
                    if (onDraftCreated) {
                      onDraftCreated(existing.id);
                    }
                  } else {
                    throw error;
                  }
                } else {
                  throw error;
                }
              } else {
                savedDraftId = data.id;
                setDraftId(data.id);
                
                if (onDraftCreated) {
                  onDraftCreated(data.id);
                }
              }
            }
          }

          lastSavedAuthRef.current = currentAuthString;
          setDraftStatus('saved');

          // Show subtle notification
          AppToaster.show({
            message: 'Authentication configuration saved for testing',
            intent: Intent.SUCCESS,
            timeout: 2000
          });

          // After successful save, add:
          console.log('Draft saved successfully', { 
            draftId: savedDraftId, 
            slug: config.slug,
            authConfig 
          });
        } catch (error) {
          console.error('Failed to save draft:', error);
          setDraftStatus('error');
          
          // More specific error message for constraint violations
          const errorMessage = error.code === '23505' 
            ? 'An endpoint with this slug already exists. Please use a different slug.'
            : 'Failed to save draft for testing';
          
          AppToaster.show({
            message: errorMessage,
            intent: Intent.WARNING,
            timeout: 3000
          });

          // After error, add more detail:
          console.error('Failed to save draft:', {
            error,
            slug: config.slug
          });
        } finally {
          setIsSavingDraft(false);
        }
      }, 1000); // 1 second debounce
    };

    saveDraft();

    // Cleanup function
    return () => {
      if (draftTimeoutRef.current) {
        clearTimeout(draftTimeoutRef.current);
      }
    };
  }, [authConfig, authEnabled, config.slug, config.name, config.outputFormat, draftId]);

  // Clean up draft when component unmounts or dialog closes
  useEffect(() => {
    return () => {
      if (draftId) {
        // Notify parent that draft is being cleaned up
        if (onDraftCreated) {
          onDraftCreated(null);
        }
        
        // Delete the draft endpoint
        const cleanup = async () => {
          try {
            await supabase
              .from('api_endpoints')
              .delete()
              .eq('id', draftId)
              .eq('is_draft', true); // Safety check to only delete drafts
            
            console.log('Draft endpoint cleaned up:', draftId);
          } catch (error) {
            console.error('Failed to cleanup draft:', error);
          }
        };
        cleanup();
      }
    };
  }, [draftId]);

  const updateAuthConfig = (updates: any) => {
    const newAuthConfig = {
      ...authConfig,
      ...updates
    };
    onUpdate({
      authentication: newAuthConfig
    });
  };

  const handleAuthToggle = (enabled: boolean) => {
    setAuthEnabled(enabled);
    updateAuthConfig({
      required: enabled,
      type: enabled ? (authType === 'none' ? 'api_key' : authType) : 'none'
    });
  };

  const handleAuthTypeChange = (type: string) => {
    setAuthType(type);
    
    // Set default config for each auth type
    let defaultConfig = {};
    switch (type) {
      case 'api_key':
        defaultConfig = {
          header_name: 'X-API-Key',
          keys: [],
          key_validation: 'exact_match'
        };
        break;
      case 'bearer':
        defaultConfig = {
          validate_jwt: false,
          jwt_secret: '',
          allowed_tokens: []
        };
        break;
      case 'basic':
        defaultConfig = {
          users: []
        };
        break;
      case 'oauth2':
        defaultConfig = {
          provider: 'google',
          client_id: '',
          allowed_domains: []
        };
        break;
      case 'custom':
        defaultConfig = {
          validation_endpoint: '',
          validation_method: 'POST',
          cache_ttl: 300
        };
        break;
    }

    updateAuthConfig({
      type,
      config: defaultConfig
    });
  };

  const addApiKey = () => {
    const newKey = `ak_${Math.random().toString(36).substring(2, 15)}`;
    const currentKeys = authConfig.config?.keys || [];
    
    updateAuthConfig({
      config: {
        ...authConfig.config,
        keys: [...currentKeys, {
          key: newKey,
          name: `API Key ${currentKeys.length + 1}`,
          created_at: new Date().toISOString(),
          active: true
        }]
      }
    });

    AppToaster.show({
      message: 'New API key generated',
      intent: Intent.SUCCESS
    });
  };

  const removeApiKey = (index: number) => {
    const currentKeys = authConfig.config?.keys || [];
    updateAuthConfig({
      config: {
        ...authConfig.config,
        keys: currentKeys.filter((_, i) => i !== index)
      }
    });
  };

  const addBasicAuthUser = () => {
    const currentUsers = authConfig.config?.users || [];
    updateAuthConfig({
      config: {
        ...authConfig.config,
        users: [...currentUsers, {
          username: '',
          password: '',
          active: true
        }]
      }
    });
  };

  const updateBasicAuthUser = (index: number, field: string, value: any) => {
    const currentUsers = authConfig.config?.users || [];
    const updated = [...currentUsers];
    updated[index] = { ...updated[index], [field]: value };
    
    updateAuthConfig({
      config: {
        ...authConfig.config,
        users: updated
      }
    });
  };

  const testAuthentication = async () => {
    if (!config.slug) {
      AppToaster.show({
        message: 'Please set an endpoint slug first',
        intent: Intent.WARNING
      });
      return;
    }

    // Wait for draft to be saved
    if (draftStatus === 'saving') {
      AppToaster.show({
        message: 'Waiting for configuration to save...',
        intent: Intent.NONE
      });
      return;
    }

    try {
      // Construct auth header based on type
      let headers: any = {};
      
      switch (authType) {
        case 'api_key':
          headers[authConfig.config?.header_name || 'X-API-Key'] = testToken;
          break;
        case 'bearer':
          headers['Authorization'] = `Bearer ${testToken}`;
          break;
        case 'basic':
          const [username, password] = testToken.split(':');
          headers['Authorization'] = `Basic ${btoa(`${username}:${password}`)}`;
          break;
      }

      // Make actual test request to the endpoint
      const response = await fetch(`/api/${config.slug}`, {
        headers
      });

      const data = await response.text();
      
      setTestResult({
        success: response.ok,
        message: response.ok 
          ? 'Authentication successful!' 
          : `Authentication failed: ${data}`,
        status: response.status,
        headers
      });

    } catch (error) {
      setTestResult({
        success: false,
        message: `Test failed: ${error.message}`
      });
    }
  };

  return (
    <div className="authentication-step">
      <Callout intent={Intent.PRIMARY} icon="info-sign">
        Configure authentication to protect your API endpoint. 
        {draftStatus === 'saved' && (
          <span style={{ fontWeight: 'bold' }}>
            {' '}Your configuration is automatically saved for testing.
          </span>
        )}
      </Callout>

      {/* Auto-save indicator */}
      {authEnabled && config.slug && (
        <div style={{ 
          position: 'fixed', 
          top: 20, 
          right: 20, 
          zIndex: 1000,
          padding: '8px 12px',
          borderRadius: 4,
          backgroundColor: draftStatus === 'saved' ? '#3dcc91' : '#f5f8fa',
          color: draftStatus === 'saved' ? 'white' : '#5c7080',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          {isSavingDraft ? (
            <>
              <Spinner size={16} />
              <span>Saving...</span>
            </>
          ) : draftStatus === 'saved' ? (
            <>
              <Icon icon="tick-circle" />
              <span>Ready to test</span>
            </>
          ) : null}
        </div>
      )}

      <Card style={{ marginTop: 20 }}>
        <FormGroup>
          <Switch
            large
            checked={authEnabled}
            onChange={(e) => handleAuthToggle(e.currentTarget.checked)}
            label={
              <span>
                <strong>Enable Authentication</strong>
                <br />
                <small className={Classes.TEXT_MUTED}>
                  Require authentication for API access
                </small>
              </span>
            }
          />
        </FormGroup>

        {authEnabled && (
          <>
            <Divider style={{ margin: '20px 0' }} />
            
            <FormGroup label="Authentication Method">
              <RadioGroup
                selectedValue={authType}
                onChange={(e) => handleAuthTypeChange(e.currentTarget.value)}
              >
                <Radio 
                  label={
                    <span>
                      <strong>API Key</strong>
                      <br />
                      <small className={Classes.TEXT_MUTED}>
                        Simple key-based authentication with custom header
                      </small>
                    </span>
                  }
                  value="api_key"
                />
                <Radio 
                  label={
                    <span>
                      <strong>Bearer Token</strong>
                      <br />
                      <small className={Classes.TEXT_MUTED}>
                        JWT or custom bearer token authentication
                      </small>
                    </span>
                  }
                  value="bearer"
                />
                <Radio 
                  label={
                    <span>
                      <strong>Basic Authentication</strong>
                      <br />
                      <small className={Classes.TEXT_MUTED}>
                        Username and password authentication
                      </small>
                    </span>
                  }
                  value="basic"
                />
              </RadioGroup>
            </FormGroup>

            <Divider style={{ margin: '20px 0' }} />

            {/* API Key Configuration */}
            {authType === 'api_key' && (
              <div className="api-key-config">
                <FormGroup label="Header Name">
                  <InputGroup
                    value={authConfig.config?.header_name || 'X-API-Key'}
                    onChange={(e) => updateAuthConfig({
                      config: {
                        ...authConfig.config,
                        header_name: e.target.value
                      }
                    })}
                    placeholder="X-API-Key"
                  />
                </FormGroup>

                <FormGroup label="API Keys">
                  <div style={{ marginBottom: 10 }}>
                    {(authConfig.config?.keys || []).map((key: any, index: number) => (
                      <Card key={index} style={{ marginBottom: 10, padding: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Icon icon="key" />
                          <Code style={{ flex: 1 }}>{key.key}</Code>
                          <InputGroup
                            value={key.name}
                            onChange={(e) => {
                              const keys = [...(authConfig.config?.keys || [])];
                              keys[index] = { ...keys[index], name: e.target.value };
                              updateAuthConfig({
                                config: { ...authConfig.config, keys }
                              });
                            }}
                            placeholder="Key name/description"
                            style={{ maxWidth: 200 }}
                          />
                          <Switch
                            checked={key.active}
                            onChange={(e) => {
                              const keys = [...(authConfig.config?.keys || [])];
                              keys[index] = { ...keys[index], active: e.currentTarget.checked };
                              updateAuthConfig({
                                config: { ...authConfig.config, keys }
                              });
                            }}
                          />
                          <Button
                            minimal
                            icon="trash"
                            intent={Intent.DANGER}
                            onClick={() => removeApiKey(index)}
                          />
                        </div>
                      </Card>
                    ))}
                  </div>
                  <Button
                    icon="add"
                    text="Generate New API Key"
                    intent={Intent.PRIMARY}
                    onClick={addApiKey}
                  />
                </FormGroup>
              </div>
            )}

            {/* Bearer Token Configuration */}
            {authType === 'bearer' && (
              <div className="bearer-config">
                <FormGroup label="Allowed Tokens (one per line)" helperText="Leave empty to accept any valid token">
                  <TextArea
                    value={(authConfig.config?.allowed_tokens || []).join('\n')}
                    onChange={(e) => updateAuthConfig({
                      config: {
                        ...authConfig.config,
                        allowed_tokens: e.target.value.split('\n').filter(t => t.trim())
                      }
                    })}
                    rows={5}
                    placeholder="eyJhbGciOiJIUzI1NiIs..."
                  />
                </FormGroup>
              </div>
            )}

            {/* Basic Auth Configuration */}
            {authType === 'basic' && (
              <div className="basic-auth-config">
                <FormGroup label="Users">
                  <div style={{ marginBottom: 10 }}>
                    {(authConfig.config?.users || []).map((user: any, index: number) => (
                      <Card key={index} style={{ marginBottom: 10, padding: 10 }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <InputGroup
                            value={user.username}
                            onChange={(e) => updateBasicAuthUser(index, 'username', e.target.value)}
                            placeholder="Username"
                            style={{ flex: 1 }}
                          />
                          <InputGroup
                            type="password"
                            value={user.password}
                            onChange={(e) => updateBasicAuthUser(index, 'password', e.target.value)}
                            placeholder="Password"
                            style={{ flex: 1 }}
                          />
                          <Switch
                            checked={user.active}
                            onChange={(e) => updateBasicAuthUser(index, 'active', e.currentTarget.checked)}
                          />
                          <Button
                            minimal
                            icon="trash"
                            intent={Intent.DANGER}
                            onClick={() => {
                              const users = authConfig.config?.users?.filter((_, i) => i !== index) || [];
                              updateAuthConfig({
                                config: { ...authConfig.config, users }
                              });
                            }}
                          />
                        </div>
                      </Card>
                    ))}
                  </div>
                  <Button
                    icon="add"
                    text="Add User"
                    intent={Intent.PRIMARY}
                    onClick={addBasicAuthUser}
                  />
                </FormGroup>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Test Authentication */}
      {authEnabled && draftStatus === 'saved' && (
        <Card style={{ marginTop: 20 }}>
          <h4>Test Authentication</h4>
          <FormGroup label={`Test ${authType === 'basic' ? 'Credentials (username:password)' : 'Token'}`}>
            <InputGroup
              value={testToken}
              onChange={(e) => setTestToken(e.target.value)}
              placeholder={
                authType === 'api_key' ? 'Your API key' :
                authType === 'bearer' ? 'Your bearer token' :
                authType === 'basic' ? 'username:password' :
                'Test token'
              }
            />
          </FormGroup>
          
          <Button
            icon="play"
            text="Test Authentication"
            intent={Intent.PRIMARY}
            onClick={testAuthentication}
            disabled={!testToken || draftStatus !== 'saved'}
          />

          {testResult && (
            <Callout
              style={{ marginTop: 15 }}
              intent={testResult.success ? Intent.SUCCESS : Intent.DANGER}
              icon={testResult.success ? "tick-circle" : "error"}
            >
              <strong>{testResult.success ? 'Success' : 'Failed'}</strong>
              <p>{testResult.message}</p>
              {testResult.headers && (
                <Code block style={{ marginTop: 10 }}>
                  {JSON.stringify(testResult.headers, null, 2)}
                </Code>
              )}
            </Callout>
          )}
        </Card>
      )}

      {/* Curl Command Examples */}
      {config.slug && authEnabled && draftStatus === 'saved' && (
        <CurlCommandGenerator 
          endpoint={{
            slug: config.slug,
            authentication: authConfig,
            isDeployed: true // Draft is saved and testable
          }}
          baseUrl={window.location.origin}
        />
      )}

      {/* Show message if slug is not set */}
      {authEnabled && !config.slug && (
        <Callout intent={Intent.WARNING} icon="warning-sign" style={{ marginTop: 20 }}>
          Please set an endpoint slug in the Basic Info step to enable authentication testing.
        </Callout>
      )}
    </div>
  );
};

export default AuthenticationStep;