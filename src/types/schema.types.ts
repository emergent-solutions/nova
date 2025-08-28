export interface FieldMapping {
    id: string;
    target_field: string;
    source_id?: string;
    source_field?: string;
    transform_type?: string;
    transform_config?: Record<string, any>;
    fallback_value?: any;
    conditions?: FieldCondition[];
  }
  
  export interface FieldCondition {
    field: string;
    operator: ConditionOperator;
    value: any;
    result: any;
  }
  
  export type ConditionOperator = 
    | 'equals' | 'not_equals' 
    | 'contains' | 'not_contains'
    | 'starts_with' | 'ends_with'
    | 'greater_than' | 'less_than' 
    | 'greater_than_or_equal' | 'less_than_or_equal'
    | 'is_empty' | 'is_not_empty'
    | 'in' | 'not_in'
    | 'regex_match';
  
  export interface SchemaNode {
    key: string;
    type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
    description?: string;
    required?: boolean;
    children?: SchemaNode[];
    mapping?: FieldMapping;
    format?: string;
    enum?: any[];
    default?: any;
  }
  
  export interface OutputSchema {
    root: SchemaNode;
    version: string;
    format: 'json' | 'xml' | 'rss' | 'atom' | 'csv';
    metadata?: Record<string, any>;
  }
  
  // API Wizard specific types
  export interface WizardConfig {
    mode: 'datasource' | 'endpoint';
    currentStep: number;
    steps: WizardStep[];
    data: APIEndpointConfig | DataSourceConfig;
  }
  
  export interface WizardStep {
    id: string;
    title: string;
    description?: string;
    required?: boolean;
    validate?: (data: any) => boolean | string;
  }
  
  export interface APIEndpointConfig {
    name: string;
    description?: string;
    slug?: string;
    dataSources: DataSource[];
    relationships: DataRelationship[];
    outputFormat: 'json' | 'xml' | 'rss' | 'atom' | 'csv';
    outputSchema: OutputSchema;
    fieldMappings: FieldMapping[];
    transformations: Transformation[];
    authentication: AuthConfig;
    caching: CacheConfig;
    rateLimiting: RateLimitConfig;
  }
  
  // Analytics types
  export interface AnalyticsData {
    endpoint_id: string;
    total_requests: number;
    successful_requests: number;
    failed_requests: number;
    average_response_time: number;
    total_bandwidth: number;
    unique_clients: number;
    time_period: string;
  }
  
  export interface AccessLog {
    id: string;
    endpoint_id: string;
    request_method: string;
    request_path: string;
    request_params?: Record<string, any>;
    response_status: number;
    response_time_ms: number;
    client_ip: string;
    user_agent?: string;
    created_at: string;
  }