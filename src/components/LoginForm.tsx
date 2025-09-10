// src/components/LoginForm.tsx
import React, { useState } from 'react';
import {
  Card,
  FormGroup,
  InputGroup,
  Button,
  Intent,
  Callout,
  Divider,
  Icon,
  Tabs,
  Tab
} from '@blueprintjs/core';
import { supabase } from '../lib/supabase';

const LoginForm: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      // The auth state listener in App.tsx will handle the redirect
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin
        }
      });

      if (error) throw error;

      setSuccess('Check your email to confirm your account!');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: 'github' | 'google') => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) throw error;
    } catch (error: any) {
      setError(error.message);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) throw error;

      setSuccess('Check your email for password reset instructions');
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container" style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <Card className="login-card" elevation={2} style={{
        width: '100%',
        maxWidth: '450px',
        padding: '40px'
      }}>
        <div className="login-header" style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Icon icon="data-connection" size={40} />
          <h1 style={{ margin: '16px 0 8px', fontSize: '28px', fontWeight: 600 }}>Emergent Nova</h1>
          <p style={{ color: '#5c7080', margin: 0 }}>Create powerful agents to serve your data</p>
        </div>

        {error && (
          <Callout intent={Intent.DANGER} icon="error" style={{ marginBottom: '20px' }}>
            {error}
          </Callout>
        )}

        {success && (
          <Callout intent={Intent.SUCCESS} icon="tick-circle" style={{ marginBottom: '20px' }}>
            {success}
          </Callout>
        )}

        <Tabs
          id="auth-tabs"
          selectedTabId={activeTab}
          onChange={(tab) => {
            setActiveTab(tab as 'signin' | 'signup');
            setError(null);
            setSuccess(null);
          }}
        >
          <Tab
            id="signin"
            title="Sign In"
            panel={
              <form onSubmit={handleSignIn} style={{ marginTop: '20px' }}>
                <FormGroup label="Email" labelFor="email">
                  <InputGroup
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    leftIcon="envelope"
                    required
                    large
                  />
                </FormGroup>

                <FormGroup label="Password" labelFor="password">
                  <InputGroup
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    leftIcon="lock"
                    required
                    large
                  />
                </FormGroup>

                <Button
                  type="submit"
                  intent={Intent.PRIMARY}
                  loading={loading}
                  large
                  fill
                  text="Sign In"
                />

                <Button
                  minimal
                  fill
                  style={{ marginTop: '12px', color: '#137cbd' }}
                  onClick={handleForgotPassword}
                  text="Forgot your password?"
                />
              </form>
            }
          />
          
          <Tab
            id="signup"
            title="Sign Up"
            panel={
              <form onSubmit={handleSignUp} style={{ marginTop: '20px' }}>
                <FormGroup label="Email" labelFor="signup-email">
                  <InputGroup
                    id="signup-email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    leftIcon="envelope"
                    required
                    large
                  />
                </FormGroup>

                <FormGroup label="Password" labelFor="signup-password">
                  <InputGroup
                    id="signup-password"
                    type="password"
                    placeholder="Create a password (min 6 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    leftIcon="lock"
                    required
                    large
                  />
                </FormGroup>

                <FormGroup label="Confirm Password" labelFor="confirm-password">
                  <InputGroup
                    id="confirm-password"
                    type="password"
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    leftIcon="lock"
                    required
                    large
                  />
                </FormGroup>

                <Button
                  type="submit"
                  intent={Intent.PRIMARY}
                  loading={loading}
                  large
                  fill
                  text="Create Account"
                />
              </form>
            }
          />
        </Tabs>

        <Divider style={{ margin: '24px 0' }} />

        <div className="oauth-section" style={{ textAlign: 'center' }}>
          <p style={{ color: '#5c7080', marginBottom: '16px' }}>Or continue with</p>
          <div className="oauth-buttons" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Button
              icon="git-branch"
              text="GitHub"
              onClick={() => handleOAuthSignIn('github')}
              large
              fill
            />
            <Button
              icon="globe"
              text="Google"
              onClick={() => handleOAuthSignIn('google')}
              large
              fill
            />
          </div>
        </div>
      </Card>
    </div>
  );
};

export default LoginForm;