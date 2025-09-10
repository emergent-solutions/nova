export interface APIEndpoint {
  id: string;
  name: string;
  slug: string;
  description?: string;
  output_format: 'json' | 'xml' | 'rss' | 'csv' | 'custom';
  schema_config: SchemaConfig;
  transform_config: TransformConfig;
  relationship_config: RelationshipConfig;
  cache_config: CacheConfig;
  auth_config: AuthConfig;
  rate_limit_config: RateLimitConfig;
  active: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface SchemaConfig {
  type: 'auto' | 'custom' | 'import';
  schema?: any;
  mapping?: Record<string, any>;
  version?: string;
}

export interface TransformConfig {
  transformations: Transformation[];
  pipeline?: TransformPipeline[];
}

export interface Transformation {
  id: string;
  type: TransformationType;
  config: Record<string, any>;
  source_field?: string;
  target_field?: string;
}

export type TransformationType = 
  | 'ai-transform'
  | 'direct'
  | 'uppercase' | 'lowercase' | 'capitalize' | 'trim'
  | 'substring' | 'replace' | 'regex-extract' | 'string-format'
  | 'parse-number' | 'round' | 'floor' | 'ceil' | 'abs'
  | 'date-format' | 'timestamp' | 'relative-time'
  | 'join' | 'split' | 'filter' | 'map' | 'sort' | 'unique'
  | 'lookup' | 'compute' | 'conditional';

export interface TransformPipeline {
  step: number;
  transformations: string[]; // Transform IDs
  parallel?: boolean;
}

export interface AITransformConfig {
  prompt: string;
  systemPrompt?: string;
  outputFormat?: 'text' | 'json' | 'structured';
  examples?: Array<{ input: any; output: any }>;
  cacheResults?: boolean;
  maxTokens?: number;
  temperature?: number;
}

export interface RelationshipConfig {
  relationships: DataRelationship[];
}

export interface DataRelationship {
  id: string;
  parent_source: string;
  parent_key: string;
  child_source: string;
  foreign_key: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  embed_as: string;
  include_orphans?: boolean;
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number; // seconds
  strategy?: 'time-based' | 'conditional';
  invalidate_on?: string[];
}

export interface AuthConfig {
  required: boolean;
  type: 'none' | 'api-key' | 'bearer' | 'basic' | 'oauth2' | 'custom';
  config?: Record<string, any>;
}

export interface RateLimitConfig {
  enabled: boolean;
  requests_per_minute: number;
  burst_limit?: number;
  per_user?: boolean;
}