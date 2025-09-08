import { useMemo, useCallback } from 'react';
import { JsonMappingConfig, JsonFieldMapping } from '../../../types/jsonMapping.types';
import { getValueFromPath, setValueAtPath } from '../utils/pathHelpers';
import { applyTransformation } from '../utils/transformations';

export function useMappingEngine(
  config: JsonMappingConfig,
  sampleData: Record<string, any>
) {
  // Helper to get metadata values
  const getMetadataValue = useCallback((path: string, sourceId: string, sourceInfo: any) => {
    // Handle _source.* metadata fields
    if (path.startsWith('_source.')) {
      const metadataKey = path.substring(8); // Remove "_source." prefix
      
      switch (metadataKey) {
        case 'id':
          return sourceId;
        case 'name':
          return sourceInfo?.name || sourceId;
        case 'type':
          return sourceInfo?.type || 'unknown';
        case 'category':
          return sourceInfo?.category || 'uncategorized';
        case 'timestamp':
          return new Date().toISOString();
        case 'path':
          return config.sourceSelection.primaryPath || 'root';
        default:
          // Check for nested metadata like _source.metadata.version
          if (metadataKey.startsWith('metadata.')) {
            const nestedKey = metadataKey.substring(9);
            return sourceInfo?.metadata?.[nestedKey];
          }
          return null;
      }
    }
    return null;
  }, [config.sourceSelection.primaryPath]);

  const processMapping = useCallback((
    sourceData: any,
    mapping: JsonFieldMapping,
    sourceInfo?: any
  ): any => {
    let value;
    
    // Check if this is a metadata field
    if (mapping.sourcePath.startsWith('_source.')) {
      value = getMetadataValue(mapping.sourcePath, mapping.sourceId || '', sourceInfo);
    } else {
      // Regular data field
      value = getValueFromPath(sourceData, mapping.sourcePath);
    }
    
    // Apply transformation if specified
    if (mapping.transformId) {
      const transform = config.transformations.find(
        t => t.id === mapping.transformId
      );
      if (transform) {
        value = applyTransformation(value, transform);
      }
    }
    
    // Apply conditional logic
    if (mapping.conditional) {
      const conditionValue = mapping.conditional.when.startsWith('_source.')
        ? getMetadataValue(mapping.conditional.when, mapping.sourceId || '', sourceInfo)
        : getValueFromPath(sourceData, mapping.conditional.when);
        
      const meetsCondition = evaluateCondition(
        conditionValue,
        mapping.conditional.operator,
        mapping.conditional.value
      );
      
      value = meetsCondition 
        ? mapping.conditional.then 
        : mapping.conditional.else;
    }
    
    // Use fallback if value is null/undefined
    if (value === null || value === undefined) {
      value = mapping.fallbackValue;
    }
    
    return value;
  }, [config.transformations, getMetadataValue]);

  const generatePreview = useCallback(() => {
    if (!config.sourceSelection.primaryPath) return null;
    
    const sourceId = config.sourceSelection.sources[0]?.id;
    if (!sourceId || !sampleData[sourceId]) return null;
    
    // Get source info for metadata
    const sourceInfo = config.sourceSelection.sources[0];
    
    // Get the actual data
    const sourceData = getValueFromPath(
      sampleData[sourceId],
      config.sourceSelection.primaryPath
    );
    
    // Process the mapped data
    let mappedData;
    
    if (config.sourceSelection.type === 'array') {
      // Map array items
      if (!Array.isArray(sourceData)) return [];
      
      mappedData = sourceData.slice(0, 5).map(item => { // Limit preview to 5 items
        let result = {};
        
        // Apply each mapping
        config.fieldMappings.forEach(mapping => {
          const value = processMapping(item, mapping, sourceInfo);
          result = setValueAtPath(result, mapping.targetPath, value);
        });
        
        return result;
      });
    } else {
      // Map single object
      let result = {};
      
      config.fieldMappings.forEach(mapping => {
        const value = processMapping(sourceData, mapping, sourceInfo);
        result = setValueAtPath(result, mapping.targetPath, value);
      });
      
      mappedData = result;
    }
    
    // Apply output wrapper if enabled
    if (config.outputWrapper?.enabled) {
      let wrappedOutput: any = {};
      
      // Add metadata if enabled
      if (config.outputWrapper.includeMetadata) {
        const metadata: any = {};
        
        if (config.outputWrapper.metadataFields?.timestamp !== false) {
          metadata.timestamp = new Date().toISOString();
        }
        
        if (config.outputWrapper.metadataFields?.source !== false) {
          metadata.source = {
            id: sourceId,
            name: sourceInfo?.name || sourceId,
            type: sourceInfo?.type || 'unknown',
            category: sourceInfo?.category
          };
        }
        
        if (config.outputWrapper.metadataFields?.count !== false && Array.isArray(mappedData)) {
          metadata.count = mappedData.length;
          metadata.totalCount = Array.isArray(sourceData) ? sourceData.length : 1;
        }
        
        if (config.outputWrapper.metadataFields?.version) {
          metadata.version = '1.0.0';
        }
        
        wrappedOutput.metadata = metadata;
      }
      
      // Add the actual data with the specified wrapper key
      wrappedOutput[config.outputWrapper.wrapperKey || 'data'] = mappedData;
      
      return wrappedOutput;
    }
    
    return mappedData;
  }, [config, sampleData, processMapping]);

  const validateMapping = useCallback((): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } => {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check for required fields
    config.outputTemplate.fields.forEach(field => {
      if (field.required) {
        const hasMapping = config.fieldMappings.some(
          m => m.targetPath === field.path
        );
        if (!hasMapping && !field.defaultValue) {
          errors.push(`Required field "${field.path}" is not mapped`);
        }
      }
    });
    
    // Check for duplicate target paths
    const targetPaths = config.fieldMappings.map(m => m.targetPath);
    const duplicates = targetPaths.filter(
      (path, index) => targetPaths.indexOf(path) !== index
    );
    if (duplicates.length > 0) {
      errors.push(`Duplicate mappings for: ${duplicates.join(', ')}`);
    }
    
    // Validate wrapper configuration
    if (config.outputWrapper?.enabled && !config.outputWrapper.wrapperKey) {
      errors.push('Output wrapper is enabled but no wrapper key is specified');
    }
    
    // Check for unmapped fields (warning, not error)
    config.outputTemplate.fields.forEach(field => {
      if (!field.required) {
        const hasMapping = config.fieldMappings.some(
          m => m.targetPath === field.path
        );
        if (!hasMapping && !field.defaultValue) {
          warnings.push(`Optional field "${field.path}" is not mapped`);
        }
      }
    });
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }, [config]);

  return {
    processMapping,
    generatePreview,
    validateMapping
  };
}

function evaluateCondition(
  value: any,
  operator: string,
  compareValue: any
): boolean {
  switch (operator) {
    case 'equals':
      return value === compareValue;
    case 'not_equals':
      return value !== compareValue;
    case 'contains':
      return String(value).includes(String(compareValue));
    case 'greater_than':
      return Number(value) > Number(compareValue);
    case 'less_than':
      return Number(value) < Number(compareValue);
    case 'exists':
      return value !== null && value !== undefined;
    case 'not_exists':
      return value === null || value === undefined;
    default:
      return false;
  }
}