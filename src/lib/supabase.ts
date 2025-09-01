import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create the base client
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'public'
  },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    redirectTo: `${window.location.origin}/auth/callback`
  }
});

// List of tables that have RLS enabled and require auth
const RLS_PROTECTED_TABLES = [
  'data_sources',
  'api_endpoints',
  'api_endpoint_sources',
  'api_documentation',
  'api_field_mappings',
  'api_transformations',
  'api_access_logs'
];

// Store the original from method
const originalFrom = supabaseClient.from.bind(supabaseClient);

// Override the from method to add auth checking for RLS tables
supabaseClient.from = (table: string) => {
  // Check if this table requires authentication
  if (RLS_PROTECTED_TABLES.includes(table)) {
    // Log for debugging (remove in production)
    console.log(`[Supabase] Accessing RLS-protected table: ${table}`);
    
    // Get the current session synchronously from storage
    const sessionStr = localStorage.getItem('sb-' + supabaseUrl.split('//')[1].split('.')[0] + '-auth-token');
    
    if (!sessionStr) {
      console.warn(`[Supabase] No session found for RLS table: ${table}`);
      // You could throw an error here, but returning the query allows it to fail naturally
      // throw new Error(`Authentication required to access ${table}`);
    } else {
      try {
        const session = JSON.parse(sessionStr);
        if (session.expires_at && new Date(session.expires_at * 1000) < new Date()) {
          console.warn(`[Supabase] Session expired for RLS table: ${table}`);
        }
      } catch (e) {
        console.warn(`[Supabase] Invalid session data for RLS table: ${table}`);
      }
    }
  }
  
  // Return the original query builder
  return originalFrom(table);
};

// Export both the enhanced client and the original if needed
export const supabase = supabaseClient;
export const supabaseAdmin = originalFrom; // Use this if you need to bypass the check

// Helper to check current auth status
export const checkAuthStatus = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    isAuthenticated: !!session,
    user: session?.user || null,
    expiresAt: session?.expires_at ? new Date(session.expires_at * 1000) : null
  };
};

// Helper to ensure auth before operation
export const ensureAuth = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Authentication required');
  }
  return session;
};