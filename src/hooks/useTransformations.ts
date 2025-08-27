import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Transformation } from '../types/api.types';

export const useTransformations = () => {
  const [transformations, setTransformations] = useState<Transformation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTransformations();
  }, []);

  const loadTransformations = async () => {
    try {
      const { data, error } = await supabase
        .from('api_transformations')
        .select('*')
        .eq('is_public', true)
        .order('name');

      if (error) throw error;
      setTransformations(data || []);
    } finally {
      setLoading(false);
    }
  };

  return {
    transformations,
    loading,
    refreshTransformations: loadTransformations
  };
};