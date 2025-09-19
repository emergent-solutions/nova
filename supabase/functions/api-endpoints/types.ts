// TypeScript type definitions
export interface APIEndpoint {
    id: string;
    name: string;
    slug: string;
    description?: string;
    output_format: "json" | "xml" | "rss" | "csv" | "custom";
    schema_config: SchemaConfig;
    transform_config: TransformConfig;
    relationship_config?: RelationshipConfig;
    cache_config?: CacheConfig;
    auth_config?: AuthConfig;
    rate_limit_config?: RateLimitConfig;
    active: boolean;
    user_id: string;
    created_at: string;
    updated_at: string;
    api_endpoint_sources?: APIEndpointSource[];
  }
  
  export interface APIEndpointSource {
    id: string;
    endpoint_id: string;
    data_source_id: string;
    data_source: DataSource;
    config?: any;
  }
  
  export interface DataSource {
    id: string;
    name: string;
    type: "api" | "database" | "rss" | "file";
    config?: any;
    api_config?: any;
    database_config?: any;
    rss_config?: any;
    file_config?: any;
    active: boolean;
    user_id: string;
    created_at: string;
    updated_at: string;
  }
  
  export interface SchemaConfig {
    type: "auto" | "custom" | "import";
    schema?: any;
    mapping?: Record<string, any>;
    metadata?: any;
    version?: string;
  }
  
  export interface TransformConfig {
    transformations: Transformation[];
    pipeline?: TransformPipeline[];
  }
  
  export interface Transformation {
    id: string;
    type: string;
    config: Record<string, any>;
    source_field?: string;
    target_field?: string;
  }
  
  export interface TransformPipeline {
    step: number;
    transformations: string[];
    parallel?: boolean;
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
    type: "one-to-one" | "one-to-many" | "many-to-many";
    embed_as: string;
    include_orphans?: boolean;
  }
  
  export interface CacheConfig {
    enabled: boolean;
    ttl: number;
    strategy?: "time-based" | "conditional";
    invalidate_on?: string[];
  }
  
  export interface AuthConfig {
    required: boolean;
    type: "none" | "api-key" | "bearer" | "basic" | "oauth2" | "custom";
    config?: Record<string, any>;
  }
  
  export interface RateLimitConfig {
    enabled: boolean;
    requests_per_minute: number;
    burst_limit?: number;
    per_user?: boolean;
  }