// JSON Mapping specific types
export interface JsonMappingConfig {
  sourceSelection: SourceSelection;
  outputTemplate: OutputTemplate;
  fieldMappings: JsonFieldMapping[];
  transformations: MappingTransformation[];
  outputWrapper?: OutputWrapperConfig;
}

export interface OutputWrapperConfig {
  enabled: boolean;
  wrapperKey: string;
  includeMetadata: boolean;
  metadataFields?: {
    timestamp?: boolean;
    source?: boolean;
    count?: boolean;
    version?: boolean;
    [key: string]: boolean | undefined;
  };
  customMetadata?: Record<string, any>;
  additionalWrappers?: Array<{
    key: string;
    type: "object" | "array";
  }>;
}

export interface SourceSelection {
  type: "array" | "object" | "mixed";
  primaryPath: string;
  sources: DataSourceSelection[];
}

export interface DataSourceSelection {
  id: string;
  name: string;
  path: string;
  alias?: string;
  type: "array" | "object";
}

export interface MultiSourceSelection {
  type: 'object' | 'array';
  sources: Array<{
    id: string;
    name: string;
    type: string;
    category?: string;
    primaryPath?: string;
    enabled: boolean;
  }>;
}

export interface OutputTemplate {
  structure: any; // The JSON structure template
  fields: OutputField[];
}

export interface OutputField {
  path: string;
  type: "string" | "number" | "boolean" | "object" | "array" | "any";
  required?: boolean;
  defaultValue?: any;
  description?: string;
}

export interface JsonFieldMapping {
  id: string;
  targetPath: string;
  sourcePath: string;
  sourceId?: string;
  sourceName?: string;
  transformId?: string;
  fallbackValue?: any;
  conditional?: MappingCondition;
}

export interface MappingCondition {
  type: "simple" | "complex";
  when: string; // Field path to check
  operator:
    | "equals"
    | "not_equals"
    | "contains"
    | "greater_than"
    | "less_than"
    | "exists"
    | "not_exists";
  value?: any;
  then: any;
  else?: any;
}

export interface MappingTransformation {
  id: string;
  name: string;
  type: TransformationType;
  config: Record<string, any>;
}

export type TransformationType =
  | "concatenate"
  | "split"
  | "uppercase"
  | "lowercase"
  | "capitalize"
  | "trim"
  | "substring"
  | "replace"
  | "date_format"
  | "number_format"
  | "parse_json"
  | "stringify"
  | "calculate"
  | "lookup"
  | "custom";
