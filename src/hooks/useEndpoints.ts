import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { APIEndpoint } from '../types/api.types';

export const useEndpoints = () => {
  const [endpoints, setEndpoints] = useState<APIEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEndpoints();
  }, []);

  const loadEndpoints = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('api_endpoints')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEndpoints(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createEndpoint = async (endpoint: Partial<APIEndpoint>) => {
    try {
      const { data, error } = await supabase
        .from('api_endpoints')
        .insert(endpoint)
        .select()
        .single();

      if (error) throw error;
      
      setEndpoints([data, ...endpoints]);
      return data;
    } catch (err: any) {
      throw err;
    }
  };

  const updateEndpoint = async (id: string, updates: Partial<APIEndpoint>) => {
    try {
      const { data, error } = await supabase
        .from('api_endpoints')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      setEndpoints(endpoints.map(ep => ep.id === id ? data : ep));
      return data;
    } catch (err: any) {
      throw err;
    }
  };

  const deleteEndpoint = async (id: string) => {
    try {
      const { error } = await supabase
        .from('api_endpoints')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setEndpoints(endpoints.filter(ep => ep.id !== id));
    } catch (err: any) {
      throw err;
    }
  };

  return {
    endpoints,
    loading,
    error,
    refreshEndpoints: loadEndpoints,
    createEndpoint,
    updateEndpoint,
    deleteEndpoint
  };
};
