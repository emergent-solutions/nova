import { APIEndpointConfig } from '../types/schema.types';

// Helper to validate AI-generated configurations
export function validateAIConfig(config: any): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate output format
  if (config.outputFormat && !['json', 'xml', 'rss', 'csv', 'atom'].includes(config.outputFormat)) {
    errors.push(`Invalid output format: ${config.outputFormat}`);
  }

  // Validate authentication
  if (config.authentication?.type && 
      !['none', 'api-key', 'bearer', 'basic', 'oauth2'].includes(config.authentication.type)) {
    errors.push(`Invalid authentication type: ${config.authentication.type}`);
  }

  // Validate transformations
  if (config.transformations && Array.isArray(config.transformations)) {
    config.transformations.forEach((t: any, idx: number) => {
      if (!t.type) {
        errors.push(`Transformation ${idx} missing type`);
      }
      if (!t.id) {
        warnings.push(`Transformation ${idx} missing ID (will be auto-generated)`);
      }
    });
  }

  // Validate rate limiting
  if (config.rateLimiting?.enabled && !config.rateLimiting.requests_per_minute) {
    errors.push('Rate limiting enabled but requests_per_minute not specified');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

// Merge AI configuration with existing config
export function mergeAIConfig(
  existing: APIEndpointConfig,
  aiGenerated: Partial<APIEndpointConfig>
): APIEndpointConfig {
  const merged = { ...existing };

  Object.entries(aiGenerated).forEach(([key, value]) => {
    if (key === 'transformations' || key === 'fieldMappings' || key === 'relationships') {
      // For arrays, replace entirely
      merged[key] = value;
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Deep merge objects
      merged[key] = { ...(existing[key] || {}), ...value };
    } else {
      // Direct assignment
      merged[key] = value;
    }
  });

  return merged;
}

// Parse natural language values
export function parseNaturalLanguageValues(text: string): any {
  const parsed: any = {};

  // Parse time values (e.g., "5 minutes", "1 hour")
  const timeMatch = text.match(/(\d+)\s*(second|minute|hour|day)s?/i);
  if (timeMatch) {
    const value = parseInt(timeMatch[1]);
    const unit = timeMatch[2].toLowerCase();
    const multipliers = { second: 1, minute: 60, hour: 3600, day: 86400 };
    parsed.ttl = value * multipliers[unit];
  }

  // Parse rate limits (e.g., "100 requests per minute")
  const rateMatch = text.match(/(\d+)\s*requests?\s*per\s*(second|minute|hour)/i);
  if (rateMatch) {
    const value = parseInt(rateMatch[1]);
    const unit = rateMatch[2].toLowerCase();
    const multipliers = { second: 60, minute: 1, hour: 1/60 };
    parsed.requests_per_minute = Math.round(value * multipliers[unit]);
  }

  return parsed;
}

// Generate unique IDs
export function generateConfigId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}