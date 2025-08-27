import { createClient } from '@supabase/supabase-js';

// Supabase URL and public anon key
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables. Check your .env file');
}

// Create a single supabase client for interacting with your database
const options = {
  db: {
    schema: 'public',
  },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  global: {
    headers: { 'x-application-name': 'template-manager' },
  }
};

export const supabase = createClient(supabaseUrl, supabaseKey, options);

// Helper function to handle Supabase errors gracefully
export const handleSupabaseError = (error: any, defaultMessage = 'An unexpected error occurred') => {
  console.error('Supabase error:', error);
  
  // Extract the most useful error message
  if (error?.message) {
    return error.message;
  }
  
  if (error?.error_description) {
    return error.error_description;
  }
  
  if (error?.details) {
    return typeof error.details === 'string' 
      ? error.details 
      : JSON.stringify(error.details);
  }
  
  return defaultMessage;
};

// Function to check if error is a "not found" error
export const isNotFoundError = (error: any) => {
  return error?.code === 'PGRST116' || // No rows returned
         error?.code === '404' || 
         error?.message?.includes('not found');
};

// Simple query builder helper
export const buildSupabaseQuery = (
  query: any,
  filters: Record<string, any> = {},
  options: {
    limit?: number,
    offset?: number,
    orderBy?: string,
    orderDirection?: 'asc' | 'desc'
  } = {}
) => {
  let filteredQuery = query;
  
  // Apply filters
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        filteredQuery = filteredQuery.in(key, value);
      } else if (typeof value === 'string' && value.includes('*')) {
        // Handle wildcard searches
        const searchTerm = value.replace(/\*/g, '%');
        filteredQuery = filteredQuery.ilike(key, searchTerm);
      } else {
        filteredQuery = filteredQuery.eq(key, value);
      }
    }
  });
  
  // Apply pagination and sorting
  if (options.orderBy) {
    filteredQuery = filteredQuery.order(
      options.orderBy, 
      { ascending: options.orderDirection !== 'desc' }
    );
  }
  
  if (options.limit) {
    filteredQuery = filteredQuery.limit(options.limit);
  }
  
  if (options.offset) {
    filteredQuery = filteredQuery.offset(options.offset);
  }
  
  return filteredQuery;
};

export default supabase;