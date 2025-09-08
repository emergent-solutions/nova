import { 
    JsonFieldMapping, 
    JsonMappingConfig,
    OutputField 
  } from '../../../types/jsonMapping.types';
  import { getValueFromPath, setValueAtPath } from './pathHelpers';
  
  /**
   * Generate automatic mappings based on field name similarity
   */
  export function generateAutoMappings(
    sourceFields: Array<{ path: string; type: string }>,
    targetFields: OutputField[],
    threshold = 0.7
  ): JsonFieldMapping[] {
    const mappings: JsonFieldMapping[] = [];
  
    targetFields.forEach(target => {
      // Find best matching source field
      let bestMatch: { field: any; score: number } | null = null;
  
      sourceFields.forEach(source => {
        const score = calculateSimilarity(
          source.path.toLowerCase(),
          target.path.toLowerCase()
        );
  
        if (score > threshold && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { field: source, score };
        }
      });
  
      if (bestMatch) {
        mappings.push({
          id: `mapping_${Date.now()}_${Math.random()}`,
          targetPath: target.path,
          sourcePath: bestMatch.field.path,
          fallbackValue: target.defaultValue
        });
      }
    });
  
    return mappings;
  }
  
  /**
   * Calculate string similarity score (0-1)
   */
  function calculateSimilarity(str1: string, str2: string): number {
    // Simple Levenshtein distance-based similarity
    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 1;
    
    const distance = levenshteinDistance(str1, str2);
    return 1 - (distance / maxLen);
  }
  
  /**
   * Calculate Levenshtein distance between two strings
   */
  function levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
  
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
  
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
  
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
  
    return matrix[str2.length][str1.length];
  }
  
  /**
   * Validate a complete mapping configuration
   */
  export function validateMappingConfig(
    config: JsonMappingConfig
  ): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
  
    // Check source selection
    if (!config.sourceSelection.primaryPath) {
      errors.push('No source data path selected');
    }
  
    if (!config.sourceSelection.sources.length) {
      errors.push('No data sources configured');
    }
  
    // Check output template
    if (!config.outputTemplate.fields.length) {
      errors.push('No output fields defined');
    }
  
    // Check required fields are mapped
    const requiredFields = config.outputTemplate.fields.filter(f => f.required);
    requiredFields.forEach(field => {
      const hasMapping = config.fieldMappings.some(m => m.targetPath === field.path);
      if (!hasMapping && !field.defaultValue) {
        errors.push(`Required field "${field.path}" is not mapped and has no default value`);
      }
    });
  
    // Check for duplicate mappings
    const targetPaths = config.fieldMappings.map(m => m.targetPath);
    const duplicates = targetPaths.filter(
      (path, index) => targetPaths.indexOf(path) !== index
    );
    if (duplicates.length > 0) {
      warnings.push(`Duplicate mappings found for: ${duplicates.join(', ')}`);
    }
  
    // Check for orphaned transformations
    const usedTransformIds = config.fieldMappings
      .filter(m => m.transformId)
      .map(m => m.transformId);
    
    config.transformations.forEach(transform => {
      if (!usedTransformIds.includes(transform.id)) {
        warnings.push(`Transformation "${transform.name}" is defined but not used`);
      }
    });
  
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Apply a mapping configuration to data
   */
  export function applyMappingToData(
    data: any,
    config: JsonMappingConfig
  ): any {
    const { sourceSelection, fieldMappings, transformations } = config;
    
    // Get source data from the specified path
    let sourceData = getValueFromPath(data, sourceSelection.primaryPath);
    
    if (!sourceData) return null;
  
    // Helper to process a single item
    const processItem = (item: any): any => {
      let result = {};
  
      fieldMappings.forEach(mapping => {
        // Get source value
        let value = getValueFromPath(item, mapping.sourcePath);
  
        // Apply transformation if specified
        if (mapping.transformId) {
          const transform = transformations.find(t => t.id === mapping.transformId);
          if (transform) {
            const { applyTransformation } = require('./transformations');
            value = applyTransformation(value, transform);
          }
        }
  
        // Apply conditional logic
        if (mapping.conditional) {
          const conditionValue = getValueFromPath(item, mapping.conditional.when);
          const meetsCondition = evaluateCondition(
            conditionValue,
            mapping.conditional.operator,
            mapping.conditional.value
          );
          value = meetsCondition ? mapping.conditional.then : mapping.conditional.else;
        }
  
        // Use fallback if null/undefined
        if (value === null || value === undefined) {
          value = mapping.fallbackValue;
        }
  
        // Set value in result
        result = setValueAtPath(result, mapping.targetPath, value);
      });
  
      return result;
    };
  
    // Process based on source type
    if (sourceSelection.type === 'array' && Array.isArray(sourceData)) {
      return sourceData.map(processItem);
    } else {
      return processItem(sourceData);
    }
  }
  
  /**
   * Evaluate a mapping condition
   */
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
  
  /**
   * Export mapping configuration as JSON
   */
  export function exportMappingConfig(config: JsonMappingConfig): string {
    return JSON.stringify(config, null, 2);
  }
  
  /**
   * Import mapping configuration from JSON
   */
  export function importMappingConfig(jsonString: string): JsonMappingConfig {
    try {
      const config = JSON.parse(jsonString);
      // Validate the imported config structure
      if (!config.sourceSelection || !config.outputTemplate || !config.fieldMappings) {
        throw new Error('Invalid mapping configuration structure');
      }
      return config;
    } catch (error) {
      throw new Error(`Failed to import mapping configuration: ${error.message}`);
    }
  }
  
  /**
   * Clone a mapping configuration
   */
  export function cloneMappingConfig(config: JsonMappingConfig): JsonMappingConfig {
    return JSON.parse(JSON.stringify(config));
  }
  
  /**
   * Merge two mapping configurations
   */
  export function mergeMappingConfigs(
    base: JsonMappingConfig,
    override: Partial<JsonMappingConfig>
  ): JsonMappingConfig {
    return {
      ...base,
      ...override,
      sourceSelection: {
        ...base.sourceSelection,
        ...(override.sourceSelection || {})
      },
      outputTemplate: {
        ...base.outputTemplate,
        ...(override.outputTemplate || {})
      },
      fieldMappings: override.fieldMappings || base.fieldMappings,
      transformations: override.transformations || base.transformations
    };
  }