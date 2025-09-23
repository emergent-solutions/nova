import { describe, it, expect, beforeEach } from '@jest/globals';
import { 
  validateAIConfig, 
  isConfigSafeToApply,
  AIConfigValidator 
} from '../ai-config-validator';
import {
  enhancePrompt,
  validateGeneratedConfig,
  mergeConfigurations,
  generateConfigId,
  parseNaturalLanguageValues
} from '../ai-config-helpers';
import { findBestTemplate } from '../ai-prompt-templates';

describe('AI Configuration Validator', () => {
  let validator: AIConfigValidator;

  beforeEach(() => {
    validator = new AIConfigValidator();
  });

  describe('Endpoint Configuration Validation', () => {
    it('should validate a valid endpoint config', () => {
      const config = {
        name: 'Test API',
        slug: 'test-api',
        output_format: 'json',
        authentication: {
          required: false,
          type: 'none'
        }
      };

      const result = validateAIConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid slug format', () => {
      const config = {
        name: 'Test API',
        slug: 'Test API!', // Invalid slug
        output_format: 'json'
      };

      const result = validateAIConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'slug',
          message: expect.stringContaining('lowercase letters')
        })
      );
    });

    it('should reject invalid output format', () => {
      const config = {
        name: 'Test API',
        output_format: 'invalid'
      };

      const result = validateAIConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'outputFormat'
        })
      );
    });
  });

  describe('Transformation Validation', () => {
    it('should validate AI transformation config', () => {
      const config = {
        transformations: [
          {
            id: 'ai-1',
            type: 'ai-transform',
            config: {
              prompt: 'Summarize this text',
              outputFormat: 'text'
            }
          }
        ]
      };

      const result = validateAIConfig(config);
      expect(result.valid).toBe(true);
    });

    it('should reject AI transformation without prompt', () => {
      const config = {
        transformations: [
          {
            id: 'ai-1',
            type: 'ai-transform',
            config: {}
          }
        ]
      };

      const result = validateAIConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: expect.stringContaining('prompt')
        })
      );
    });

    it('should warn about missing transformation ID', () => {
      const config = {
        transformations: [
          {
            type: 'uppercase',
            source_field: 'name'
          }
        ]
      };

      const result = validateAIConfig(config);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: expect.stringContaining('[0].id')
        })
      );
    });
  });

  describe('Authentication Validation', () => {
    it('should validate API key authentication', () => {
      const config = {
        authentication: {
          required: true,
          type: 'api-key',
          config: {
            header_name: 'X-API-Key'
          }
        }
      };

      const result = validateAIConfig(config);
      expect(result.valid).toBe(true);
    });

    it('should reject API key auth without header or query param', () => {
      const config = {
        authentication: {
          required: true,
          type: 'api-key',
          config: {}
        }
      };

      const result = validateAIConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'authentication.config'
        })
      );
    });
  });

  describe('Rate Limiting Validation', () => {
    it('should validate rate limiting config', () => {
      const config = {
        rateLimiting: {
          enabled: true,
          requests_per_minute: 100,
          burst_limit: 10
        }
      };

      const result = validateAIConfig(config);
      expect(result.valid).toBe(true);
    });

    it('should reject negative rate limit', () => {
      const config = {
        rateLimiting: {
          enabled: true,
          requests_per_minute: -10
        }
      };

      const result = validateAIConfig(config);
      expect(result.valid).toBe(false);
    });

    it('should warn about very high rate limit', () => {
      const config = {
        rateLimiting: {
          enabled: true,
          requests_per_minute: 100000
        }
      };

      const result = validateAIConfig(config);
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});

describe('AI Config Helpers', () => {
  describe('Prompt Enhancement', () => {
    it('should enhance authentication prompts', () => {
      const prompt = 'Create an API with authentication';
      const enhanced = enhancePrompt(prompt, {});
      
      expect(enhanced).toContain('authentication configuration');
    });

    it('should enhance transformation prompts', () => {
      const prompt = 'Transform all dates to ISO format';
      const enhanced = enhancePrompt(prompt, {});
      
      expect(enhanced).toContain('transformation configurations');
    });
  });

  describe('Natural Language Parsing', () => {
    it('should parse time values correctly', () => {
      const result = parseNaturalLanguageValues('cache for 5 minutes');
      expect(result.ttl).toBe(300);
    });

    it('should parse rate limit values', () => {
      const result = parseNaturalLanguageValues('100 requests per minute');
      expect(result.requests_per_minute).toBe(100);
    });

    it('should parse multiple values', () => {
      const result = parseNaturalLanguageValues('100 requests per minute with 1 hour cache');
      expect(result.requests_per_minute).toBe(100);
      expect(result.ttl).toBe(3600);
    });
  });

  describe('Configuration Merging', () => {
    it('should merge configurations correctly', () => {
      const base = {
        name: 'Test API',
        authentication: { required: false, type: 'none' }
      };

      const updates = {
        authentication: { required: true, type: 'api-key' },
        caching: { enabled: true, ttl: 300 }
      };

      const merged = mergeConfigurations(base, updates);
      
      expect(merged.name).toBe('Test API');
      expect(merged.authentication.required).toBe(true);
      expect(merged.authentication.type).toBe('api-key');
      expect(merged.caching.enabled).toBe(true);
    });

    it('should handle array merging for transformations', () => {
      const base = {
        transformations: [
          { id: 't1', type: 'uppercase' }
        ]
      };

      const updates = {
        transformations: [
          { id: 't2', type: 'lowercase' }
        ]
      };

      const merged = mergeConfigurations(base, updates);
      expect(merged.transformations).toHaveLength(1);
      expect(merged.transformations[0].id).toBe('t2');
    });
  });

  describe('ID Generation', () => {
    it('should generate unique IDs', () => {
      const id1 = generateConfigId('transform');
      const id2 = generateConfigId('transform');
      
      expect(id1).toContain('transform_');
      expect(id1).not.toBe(id2);
    });
  });
});

describe('AI Prompt Templates', () => {
  describe('Template Matching', () => {
    it('should find REST API template', () => {
      const template = findBestTemplate('Create a REST API for users');
      expect(template).not.toBeNull();
      expect(template?.id).toBe('rest-api-basic');
    });

    it('should find RSS template', () => {
      const template = findBestTemplate('Create an RSS feed');
      expect(template).not.toBeNull();
      expect(template?.id).toBe('rss-aggregator');
    });

    it('should find security template', () => {
      const template = findBestTemplate('Secure API with rate limiting');
      expect(template).not.toBeNull();
      expect(template?.id).toBe('secure-api');
    });

    it('should return null for no match', () => {
      const template = findBestTemplate('random unrelated text');
      expect(template).toBeNull();
    });
  });
});

describe('Config Safety Check', () => {
  it('should mark valid config as safe', () => {
    const config = {
      name: 'Test API',
      slug: 'test-api',
      output_format: 'json'
    };

    expect(isConfigSafeToApply(config)).toBe(true);
  });

  it('should mark config with errors as unsafe', () => {
    const config = {
      name: '',
      slug: 'Invalid Slug!',
      output_format: 'invalid'
    };

    expect(isConfigSafeToApply(config)).toBe(false);
  });

  it('should mark config with many warnings as unsafe', () => {
    const config = {
      name: 'Test',
      transformations: [
        { type: 'uppercase' }, // No ID
        { type: 'lowercase' }, // No ID
        { type: 'trim' }, // No ID
        { type: 'capitalize' } // No ID
      ]
    };

    expect(isConfigSafeToApply(config)).toBe(false);
  });
});