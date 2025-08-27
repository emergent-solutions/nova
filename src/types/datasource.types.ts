export interface DataSource {
    id: string;
    name: string;
    type: 'api' | 'database' | 'rss' | 'file';
    active: boolean;
    config: DataSourceConfig;
    fields?: string[];
    sample_data?: any[];
    user_id: string;
    created_at: string;
    updated_at: string;
  }
  
  export type DataSourceConfig = 
    | APIDataSourceConfig
    | DatabaseDataSourceConfig
    | RSSDataSourceConfig
    | FileDataSourceConfig;
  
  export interface APIDataSourceConfig {
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    headers?: Record<string, string>;
    body?: any;
    auth?: {
      type: string;
      config: Record<string, any>;
    };
    data_path?: string;
    pagination?: {
      type: 'offset' | 'cursor' | 'page';
      config: Record<string, any>;
    };
  }
  
  export interface DatabaseDataSourceConfig {
    connection_id: string;
    query: string;
    params?: Record<string, any>;
  }
  
  export interface RSSDataSourceConfig {
    url: string;
    refresh_interval?: number;
  }
  
  export interface FileDataSourceConfig {
    file_id: string;
    format: 'csv' | 'json' | 'xml' | 'excel';
    headers?: string[];
    delimiter?: string;
    encoding?: string;
  }