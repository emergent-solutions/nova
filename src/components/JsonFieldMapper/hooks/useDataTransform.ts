import { useState, useCallback } from 'react';
import { 
  MappingTransformation, 
  TransformationType 
} from '../../../types/jsonMapping.types';
import { 
  applyTransformation, 
  applyTransformations,
  validateTransformConfig 
} from '../utils/transformations';

interface UseDataTransformReturn {
  transform: (value: any, transformId: string) => any;
  transformBatch: (values: any[], transformId: string) => any[];
  createTransformation: (type: TransformationType, config?: any) => MappingTransformation;
  updateTransformation: (id: string, updates: Partial<MappingTransformation>) => void;
  deleteTransformation: (id: string) => void;
  validateTransformation: (transform: MappingTransformation) => boolean;
  transformations: MappingTransformation[];
}

export function useDataTransform(
  initialTransformations: MappingTransformation[] = []
): UseDataTransformReturn {
  const [transformations, setTransformations] = useState<MappingTransformation[]>(
    initialTransformations
  );

  const transform = useCallback((value: any, transformId: string): any => {
    const transformation = transformations.find(t => t.id === transformId);
    if (!transformation) return value;
    
    return applyTransformation(value, transformation);
  }, [transformations]);

  const transformBatch = useCallback((values: any[], transformId: string): any[] => {
    return values.map(value => transform(value, transformId));
  }, [transform]);

  const createTransformation = useCallback((
    type: TransformationType,
    config: any = {}
  ): MappingTransformation => {
    const newTransform: MappingTransformation = {
      id: `transform_${type}_${Date.now()}`,
      name: `${type} transformation`,
      type,
      config
    };

    setTransformations(prev => [...prev, newTransform]);
    return newTransform;
  }, []);

  const updateTransformation = useCallback((
    id: string,
    updates: Partial<MappingTransformation>
  ): void => {
    setTransformations(prev => 
      prev.map(t => t.id === id ? { ...t, ...updates } : t)
    );
  }, []);

  const deleteTransformation = useCallback((id: string): void => {
    setTransformations(prev => prev.filter(t => t.id !== id));
  }, []);

  const validateTransformation = useCallback((
    transform: MappingTransformation
  ): boolean => {
    const result = validateTransformConfig(transform.type, transform.config);
    return result.valid;
  }, []);

  return {
    transform,
    transformBatch,
    createTransformation,
    updateTransformation,
    deleteTransformation,
    validateTransformation,
    transformations
  };
}