import { APIEndpointConfig, Transformation, FieldMapping } from '../types/schema.types';

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: string[];
}

interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

export class AIConfigValidator {
  private errors: ValidationError[] = [];
  private warnings: ValidationWarning[] = [];
  private suggestions: string[] = [];

  // Main validation entry point
  public validate(config: any): ValidationResult {
    this.reset();
    
    // Validate based on config type
    if (this.isEndpointConfig(config)) {
      this.validateEndpointConfig(config);
    } else if (this.isTransformationConfig(config)) {
      this.validateTransformations(config.transformations || [config]);
    } else if (this.isAuthConfig(config)) {
      this.validateAuthentication(config);
    }
    
    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      suggestions: this.suggestions
    };
  }

  private reset() {
    this.errors = [];
    this.warnings = [];
    this.suggestions = [];
  }

  private isEndpointConfig(config: any): boolean {
    return config.hasOwnProperty('name') || 
           config.hasOwnProperty('slug') || 
           config.hasOwnProperty('output_format');
  }

  private isTransformationConfig(config: any): boolean {
    return config.hasOwnProperty('transformations') || 
           (config.hasOwnProperty('type') && config.hasOwnProperty('config'));
  }

  private isAuthConfig(config: any): boolean {
    return config.hasOwnProperty('authentication') || 
           (config.hasOwnProperty('required') && config.hasOwnProperty('type'));
  }

  private validateEndpointConfig(config: Partial) {
    // Name validation
    if (config.name !== undefined) {
      if (!config.name || config.name.trim().length === 0) {
        this.errors.push({
          field: 'name',
          message: 'Endpoint name cannot be empty'
        });
      } else if (config.name.length > 100) {
        this.errors.push({
          field: 'name',
          message: 'Endpoint name must be less than 100 characters',
          value: config.name
        });
      }
    }

    // Slug validation
    if (config.slug !== undefined) {
      if (!config.slug || config.slug.trim().length === 0) {
        this.errors.push({
          field: 'slug',
          message: 'Endpoint slug cannot be empty'
        });
      } else if (!/^[a-z0-9-]+$/.test(config.slug)) {
        this.errors.push({
          field: 'slug',
          message: 'Slug must contain only lowercase letters, numbers, and hyphens',
          value: config.slug
        });
        this.suggestions.push(`Try: ${this.generateSlug(config.name || '')}`);
      }
    }

    // Output format validation
    if (config.outputFormat) {
      const validFormats = ['json', 'xml', 'rss', 'csv', 'atom'];
      if (!validFormats.includes(config.outputFormat)) {
        this.errors.push({
          field: 'outputFormat',
          message: `Invalid output format. Must be one of: ${validFormats.join(', ')}`,
          value: config.outputFormat
        });
      }

      // Format-specific validation
      this.validateFormatSpecificConfig(config);
    }

    // Validate nested configurations
    if (config.transformations) {
      this.validateTransformations(config.transformations);
    }

    if (config.authentication) {
      this.validateAuthentication(config.authentication);
    }

    if (config.rateLimiting) {
      this.validateRateLimiting(config.rateLimiting);
    }

    if (config.caching) {
      this.validateCaching(config.caching);
    }

    if (config.relationships) {
      this.validateRelationships(config.relationships);
    }
  }

  private validateFormatSpecificConfig(config: Partial) {
    const metadata = config.outputSchema?.metadata;

    switch (config.outputFormat) {
      case 'rss':
        if (!metadata?.channelTitle) {
          this.errors.push({
            field: 'outputSchema.metadata.channelTitle',
            message: 'RSS feed requires a channel title'
          });
        }
        if (!metadata?.channelDescription) {
          this.warnings.push({
            field: 'outputSchema.metadata.channelDescription',
            message: 'RSS feed should have a channel description',
            suggestion: 'Add a description for better feed discovery'
          });
        }
        break;

      case 'csv':
        if (metadata?.delimiter && metadata.delimiter.length !== 1) {
          this.errors.push({
            field: 'outputSchema.metadata.delimiter',
            message: 'CSV delimiter must be a single character',
            value: metadata.delimiter
          });
        }
        break;

      case 'atom':
        if (!metadata?.feedId) {
          this.errors.push({
            field: 'outputSchema.metadata.feedId',
            message: 'Atom feed requires a unique feed ID'
          });
        }
        break;
    }
  }

  private validateTransformations(transformations: Transformation[]) {
    const validTypes = [
      'ai-transform', 'uppercase', 'lowercase', 'capitalize', 'trim',
      'substring', 'replace', 'regex-extract', 'string-format',
      'parse-number', 'round', 'floor', 'ceil', 'abs',
      'date-format', 'timestamp', 'relative-time',
      'join', 'split', 'filter', 'map', 'sort', 'unique',
      'lookup', 'compute', 'conditional'
    ];

    transformations.forEach((transform, index) => {
      // Check for required fields
      if (!transform.type) {
        this.errors.push({
          field: `transformations[${index}].type`,
          message: 'Transformation type is required'
        });
        return;
      }

      // Validate transformation type
      if (!validTypes.includes(transform.type)) {
        this.errors.push({
          field: `transformations[${index}].type`,
          message: `Invalid transformation type: ${transform.type}`,
          value: transform.type
        });
        this.suggestions.push(`Valid types: ${validTypes.join(', ')}`);
      }

      // Generate ID if missing
      if (!transform.id) {
        this.warnings.push({
          field: `transformations[${index}].id`,
          message: 'Transformation ID missing (will be auto-generated)',
          suggestion: `transform_${transform.type}_${index}`
        });
      }

      // Validate AI transformation config
      if (transform.type === 'ai-transform') {
        this.validateAITransform(transform, index);
      }

      // Validate date format config
      if (transform.type === 'date-format' && !transform.config?.format) {
        this.warnings.push({
          field: `transformations[${index}].config.format`,
          message: 'Date format not specified',
          suggestion: 'Use ISO, RFC3339, or custom format string'
        });
      }
    });
  }

  private validateAITransform(transform: Transformation, index: number) {
    if (!transform.config?.prompt) {
      this.errors.push({
        field: `transformations[${index}].config.prompt`,
        message: 'AI transformation requires a prompt'
      });
    }

    if (transform.config?.maxTokens && transform.config.maxTokens > 4000) {
      this.warnings.push({
        field: `transformations[${index}].config.maxTokens`,
        message: 'Max tokens exceeds recommended limit',
        suggestion: 'Consider using 2000 or less for optimal performance'
      });
    }

    if (transform.config?.temperature && 
        (transform.config.temperature < 0 || transform.config.temperature > 1)) {
      this.errors.push({
        field: `transformations[${index}].config.temperature`,
        message: 'Temperature must be between 0 and 1',
        value: transform.config.temperature
      });
    }
  }

  private validateAuthentication(auth: any) {
    const validTypes = ['none', 'api-key', 'bearer', 'basic', 'oauth2', 'custom'];

    if (auth.type && !validTypes.includes(auth.type)) {
      this.errors.push({
        field: 'authentication.type',
        message: `Invalid authentication type: ${auth.type}`,
        value: auth.type
      });
    }

    // Type-specific validation
    if (auth.type === 'api-key' && auth.config) {
      if (!auth.config.header_name && !auth.config.query_param) {
        this.errors.push({
          field: 'authentication.config',
          message: 'API key authentication requires header_name or query_param'
        });
      }
    }

    if (auth.type === 'oauth2' && auth.config) {
      if (!auth.config.client_id) {
        this.errors.push({
          field: 'authentication.config.client_id',
          message: 'OAuth2 requires client_id'
        });
      }
      if (!auth.config.authorization_url) {
        this.errors.push({
          field: 'authentication.config.authorization_url',
          message: 'OAuth2 requires authorization_url'
        });
      }
    }
  }

  private validateRateLimiting(rateLimit: any) {
    if (rateLimit.enabled && !rateLimit.requests_per_minute) {
      this.errors.push({
        field: 'rateLimiting.requests_per_minute',
        message: 'Rate limiting enabled but requests_per_minute not specified'
      });
    }

    if (rateLimit.requests_per_minute) {
      if (rateLimit.requests_per_minute < 1) {
        this.errors.push({
          field: 'rateLimiting.requests_per_minute',
          message: 'Requests per minute must be at least 1',
          value: rateLimit.requests_per_minute
        });
      }
      if (rateLimit.requests_per_minute > 10000) {
        this.warnings.push({
          field: 'rateLimiting.requests_per_minute',
          message: 'Very high rate limit',
          suggestion: 'Consider if this rate limit is appropriate for your use case'
        });
      }
    }

    if (rateLimit.burst_limit && rateLimit.burst_limit < rateLimit.requests_per_minute / 60) {
      this.warnings.push({
        field: 'rateLimiting.burst_limit',
        message: 'Burst limit is less than requests per second',
        suggestion: 'Consider increasing burst limit for better performance'
      });
    }
  }

  private validateCaching(cache: any) {
    if (cache.enabled && !cache.ttl) {
      this.errors.push({
        field: 'caching.ttl',
        message: 'Caching enabled but TTL not specified'
      });
    }

    if (cache.ttl) {
      if (cache.ttl < 0) {
        this.errors.push({
          field: 'caching.ttl',
          message: 'Cache TTL cannot be negative',
          value: cache.ttl
        });
      }
      if (cache.ttl > 86400) {
        this.warnings.push({
          field: 'caching.ttl',
          message: 'Cache TTL is longer than 24 hours',
          suggestion: 'Consider if data might become stale'
        });
      }
    }

    if (cache.strategy && !['time-based', 'conditional'].includes(cache.strategy)) {
      this.errors.push({
        field: 'caching.strategy',
        message: 'Invalid cache strategy',
        value: cache.strategy
      });
    }
  }

  private validateRelationships(relationships: any[]) {
    const validTypes = ['one-to-one', 'one-to-many', 'many-to-many'];

    relationships.forEach((rel, index) => {
      if (!rel.parent_source) {
        this.errors.push({
          field: `relationships[${index}].parent_source`,
          message: 'Parent source is required for relationship'
        });
      }

      if (!rel.child_source) {
        this.errors.push({
          field: `relationships[${index}].child_source`,
          message: 'Child source is required for relationship'
        });
      }

      if (!rel.parent_key) {
        this.errors.push({
          field: `relationships[${index}].parent_key`,
          message: 'Parent key is required for relationship'
        });
      }

      if (!rel.foreign_key) {
        this.errors.push({
          field: `relationships[${index}].foreign_key`,
          message: 'Foreign key is required for relationship'
        });
      }

      if (rel.type && !validTypes.includes(rel.type)) {
        this.errors.push({
          field: `relationships[${index}].type`,
          message: `Invalid relationship type: ${rel.type}`,
          value: rel.type
        });
      }

      if (!rel.embed_as) {
        this.warnings.push({
          field: `relationships[${index}].embed_as`,
          message: 'No embed_as field specified',
          suggestion: `Use "${rel.child_source}_data" as field name`
        });
      }
    });
  }

  // Helper methods
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}

// Export singleton instance
export const validator = new AIConfigValidator();

// Quick validation function
export function validateAIConfig(config: any): ValidationResult {
  return validator.validate(config);
}

// Check if config is safe to apply
export function isConfigSafeToApply(config: any): boolean {
  const result = validator.validate(config);
  return result.valid && result.warnings.length < 3;
}

export default {
  AIConfigValidator,
  validator,
  validateAIConfig,
  isConfigSafeToApply
};