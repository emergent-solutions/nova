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
    if (path.startsWith('_source.')) {
      const metadataKey = path.substring(8);
      
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
          return sourceInfo?.primaryPath || 'root';
        default:
          if (metadataKey.startsWith('metadata.')) {
            const nestedKey = metadataKey.substring(9);
            return sourceInfo?.metadata?.[nestedKey];
          }
          return null;
      }
    }
    return null;
  }, []);

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
    console.log('Generating preview with config:', config);
    console.log('Available sample data:', Object.keys(sampleData));
    console.log('Field mappings:', config.fieldMappings);
    
    // Check if we have any sources selected
    if (!config.sourceSelection.sources || config.sourceSelection.sources.length === 0) {
      console.warn('No sources selected');
      return null;
    }

    // Determine merge mode
    const mergeMode = config.sourceSelection.mergeMode || 'single';
    const sources = config.sourceSelection.sources;
    
    if (mergeMode === 'combined' && sources.length > 1) {
      // COMBINED MODE: Merge articles from all sources into a single array
      console.log('Combined mode - merging articles from multiple sources');
      
      let allArticles: any[] = [];
      
      // Collect articles from each source
      sources.forEach(sourceInfo => {
        if (!sampleData[sourceInfo.id]) {
          console.warn(`No sample data for source: ${sourceInfo.id}`);
          return;
        }
        
        // Get data from this source
        let sourceData = sampleData[sourceInfo.id];
        
        // Navigate to the path if specified (e.g., "articles", "data.items", etc.)
        if (sourceInfo.primaryPath) {
          sourceData = getValueFromPath(sourceData, sourceInfo.primaryPath);
        }
        
        console.log(`Source ${sourceInfo.name}: found ${Array.isArray(sourceData) ? sourceData.length : 0} items`);
        
        // Add articles from this source
        if (Array.isArray(sourceData)) {
          // Add each article with its source information attached
          sourceData.forEach(article => {
            allArticles.push({
              ...article,
              _sourceInfo: {
                id: sourceInfo.id,
                name: sourceInfo.name,
                category: sourceInfo.category
              }
            });
          });
        }
      });
      
      console.log(`Total articles collected: ${allArticles.length}`);
      
      // Now map each article to the output structure
      let mappedArticles = allArticles.slice(0, 10).map((article, index) => {
        let mappedArticle = {};
        
        // Group mappings by target field to handle multiple sources mapping to same field
        const mappingsByTarget: Record<string, JsonFieldMapping[]> = {};
        config.fieldMappings.forEach(mapping => {
          if (!mappingsByTarget[mapping.targetPath]) {
            mappingsByTarget[mapping.targetPath] = [];
          }
          mappingsByTarget[mapping.targetPath].push(mapping);
        });
        
        // Process each target field
        Object.entries(mappingsByTarget).forEach(([targetPath, mappings]) => {
          // Find the mapping that matches this article's source
          const matchingMapping = mappings.find(m => 
            m.sourceId === article._sourceInfo.id
          );
          
          if (matchingMapping) {
            // Use the mapping from the article's source
            const value = processMapping(article, matchingMapping, article._sourceInfo);
            mappedArticle = setValueAtPath(mappedArticle, targetPath, value);
          } else if (mappings.length === 1 && !mappings[0].sourceId) {
            // If there's only one mapping and it doesn't specify a source, use it for all
            const value = processMapping(article, mappings[0], article._sourceInfo);
            mappedArticle = setValueAtPath(mappedArticle, targetPath, value);
          }
          // If no matching mapping, the field remains unmapped for this article
        });
        
        return mappedArticle;
      });
      
      // Apply output wrapper if enabled
      return applyOutputWrapper(mappedArticles, sources);
      
    } else if (sources.length === 1) {
      // SINGLE SOURCE MODE
      console.log('Single source mode');
      const sourceInfo = sources[0];
      const sourceId = sourceInfo.id;
      
      if (!sampleData[sourceId]) {
        console.warn(`No sample data for source: ${sourceId}`);
        return null;
      }
      
      // Get the actual data
      let sourceData = sampleData[sourceId];
      
      // Navigate to the path if specified
      if (sourceInfo.primaryPath) {
        sourceData = getValueFromPath(sourceData, sourceInfo.primaryPath);
      }
      
      console.log('Source data type:', Array.isArray(sourceData) ? 'array' : typeof sourceData);
      
      // Process the mapped data
      let mappedData;
      
      if (Array.isArray(sourceData)) {
        // Map array items
        mappedData = sourceData.slice(0, 5).map(item => {
          let result = {};
          
          // Apply each mapping
          config.fieldMappings.forEach(mapping => {
            const value = processMapping(item, mapping, sourceInfo);
            result = setValueAtPath(result, mapping.targetPath, value);
          });
          
          return result;
        });
      } else if (sourceData && typeof sourceData === 'object') {
        // Map single object
        let result = {};
        
        config.fieldMappings.forEach(mapping => {
          const value = processMapping(sourceData, mapping, sourceInfo);
          result = setValueAtPath(result, mapping.targetPath, value);
        });
        
        mappedData = result;
      } else {
        console.warn('Source data is not an object or array');
        return null;
      }
      
      // Apply output wrapper if enabled
      return applyOutputWrapper(mappedData, [sourceInfo]);
      
    } else {
      // SEPARATE MODE: Keep sources separate
      console.log('Separate mode - keeping sources independent');
      const result: Record<string, any> = {};
      
      sources.forEach(sourceInfo => {
        if (!sampleData[sourceInfo.id]) {
          console.warn(`No sample data for source: ${sourceInfo.id}`);
          return;
        }
        
        let sourceData = sampleData[sourceInfo.id];
        
        // Navigate to the path if specified
        if (sourceInfo.primaryPath) {
          sourceData = getValueFromPath(sourceData, sourceInfo.primaryPath);
        }
        
        // Process mappings for this source
        let mappedData;
        
        if (Array.isArray(sourceData)) {
          mappedData = sourceData.slice(0, 5).map(item => {
            let itemResult = {};
            
            // Only apply mappings for this source
            config.fieldMappings
              .filter(m => m.sourceId === sourceInfo.id)
              .forEach(mapping => {
                const value = processMapping(item, mapping, sourceInfo);
                itemResult = setValueAtPath(itemResult, mapping.targetPath, value);
              });
            
            return itemResult;
          });
        } else {
          let objectResult = {};
          
          config.fieldMappings
            .filter(m => m.sourceId === sourceInfo.id)
            .forEach(mapping => {
              const value = processMapping(sourceData, mapping, sourceInfo);
              objectResult = setValueAtPath(objectResult, mapping.targetPath, value);
            });
          
          mappedData = objectResult;
        }
        
        // Store under source name or ID
        const key = sourceInfo.name || sourceInfo.id;
        result[key] = mappedData;
      });
      
      // Apply output wrapper if enabled
      return applyOutputWrapper(result, sources);
    }
  }, [config, sampleData, processMapping]);

  // Helper function to apply output wrapper
  const applyOutputWrapper = (data: any, sources: any[]) => {
    if (config.outputWrapper?.enabled) {
      let wrappedOutput: any = {};
      
      // Add metadata if enabled
      if (config.outputWrapper.includeMetadata) {
        const metadata: any = {};
        
        if (config.outputWrapper.metadataFields?.timestamp !== false) {
          metadata.timestamp = new Date().toISOString();
        }
        
        if (config.outputWrapper.metadataFields?.source !== false) {
          metadata.sources = sources.map(s => ({
            id: s.id,
            name: s.name,
            type: s.type,
            category: s.category
          }));
        }
        
        if (config.outputWrapper.metadataFields?.count !== false) {
          if (Array.isArray(data)) {
            metadata.count = data.length;
            metadata.sourceCounts = {};
            // Count articles per source
            sources.forEach(source => {
              const sourceCount = Array.isArray(data) 
                ? data.filter((item: any) => item._sourceInfo?.id === source.id).length
                : 0;
              metadata.sourceCounts[source.name] = sourceCount;
            });
          } else if (typeof data === 'object') {
            metadata.count = Object.keys(data).length;
          }
        }
        
        if (config.outputWrapper.metadataFields?.version) {
          metadata.version = '1.0.0';
        }
        
        wrappedOutput.metadata = metadata;
      }
      
      // Add the actual data with the specified wrapper key
      wrappedOutput[config.outputWrapper.wrapperKey || 'data'] = data;
      
      return wrappedOutput;
    }
    
    return data;
  };

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
    
    // For combined mode with multiple sources, check if target fields have mappings from all sources
    if (config.sourceSelection.mergeMode === 'combined' && config.sourceSelection.sources.length > 1) {
      const targetFields = new Set(config.fieldMappings.map(m => m.targetPath));
      targetFields.forEach(targetPath => {
        const mappingsForTarget = config.fieldMappings.filter(m => m.targetPath === targetPath);
        const sourcesForTarget = new Set(mappingsForTarget.map(m => m.sourceId));
        const missingSources = config.sourceSelection.sources
          .filter(s => !sourcesForTarget.has(s.id))
          .map(s => s.name);
        
        if (missingSources.length > 0) {
          warnings.push(`Field "${targetPath}" is not mapped for sources: ${missingSources.join(', ')}`);
        }
      });
    }
    
    // Check if any sources are selected
    if (!config.sourceSelection.sources || config.sourceSelection.sources.length === 0) {
      errors.push('No data sources selected');
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
    
    // Check if mappings have valid source IDs
    const sourceIds = new Set(config.sourceSelection.sources.map(s => s.id));
    config.fieldMappings.forEach(mapping => {
      if (mapping.sourceId && !sourceIds.has(mapping.sourceId)) {
        errors.push(`Mapping references unknown source: ${mapping.sourceId}`);
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