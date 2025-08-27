import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Card } from '@blueprintjs/core';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa, ViewType } from '@supabase/auth-ui-shared';

interface LoginFormProps {
  onSuccess: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
  const [view, setView] = useState<ViewType>('sign_in');

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      backgroundColor: '#f5f5f5'
    }}>
      <Card style={{ width: '100%', maxWidth: '400px', padding: '20px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Sign In</h2>
        <Auth
          supabaseClient={supabase}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: '#1976d2',
                  brandAccent: '#1565c0'
                }
              }
            }
          }}
          providers={['google', 'github']}
          redirectTo={`${window.location.origin}/auth/callback`}
          view={view}
          onViewChange={newView => setView(newView as ViewType)}
          theme="dark"
          socialLayout="horizontal"
          showLinks={true}
          localization={{
            variables: {
              sign_in: {
                email_label: 'Email',
                password_label: 'Password',
                button_label: 'Sign In',
                loading_button_label: 'Signing in ...',
                social_provider_text: 'Sign in with {{provider}}'
              },
              sign_up: {
                email_label: 'Email',
                password_label: 'Password',
                button_label: 'Sign Up',
                loading_button_label: 'Signing up ...',
                social_provider_text: 'Sign up with {{provider}}'
              }
            }
          }}
        />
      </Card>
    </div>
  );
};

export default LoginForm;