import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DataSource } from '../types/datasource.types';

export const useDataSources = () => {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDataSources();
  }, []);

  const loadDataSources = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('data_sources')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDataSources(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createDataSource = async (dataSource: Partial<DataSource>) => {
    try {
      const { data, error } = await supabase
        .from('data_sources')
        .insert(dataSource)
        .select()
        .single();

      if (error) throw error;
      
      setDataSources([data, ...dataSources]);
      return data;
    } catch (err: any) {
      throw err;
    }
  };

  const updateDataSource = async (id: string, updates: Partial<DataSource>) => {
    try {
      const { data, error } = await supabase
        .from('data_sources')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      setDataSources(dataSources.map(ds => ds.id === id ? data : ds));
      return data;
    } catch (err: any) {
      throw err;
    }
  };

  const deleteDataSource = async (id: string) => {
    try {
      const { error } = await supabase
        .from('data_sources')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setDataSources(dataSources.filter(ds => ds.id !== id));
    } catch (err: any) {
      throw err;
    }
  };

  return {
    dataSources,
    loading,
    error,
    refreshDataSources: loadDataSources,
    createDataSource,
    updateDataSource,
    deleteDataSource
  };
};