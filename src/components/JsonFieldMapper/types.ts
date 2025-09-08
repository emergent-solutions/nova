// Internal component prop types
export interface JsonFieldMapperProps {
    dataSources: any[];
    sampleData?: Record<string, any>;
    initialConfig?: JsonMappingConfig;
    onChange: (config: JsonMappingConfig) => void;
    onTest?: () => void;
  }
  
  export interface SourceSelectorProps {
    dataSources: any[];
    sampleData: Record<string, any>;
    selection: any;
    onChange: (selection: any) => void;
    onNext: () => void;
  }
  
  export interface OutputTemplateBuilderProps {
    template: any;
    sourceSelection: any;
    sampleData: Record<string, any>;
    onChange: (template: any) => void;
    onNext: () => void;
    onPrevious: () => void;
  }
  
  export interface FieldMappingCanvasProps {
    sourceSelection: any;
    outputTemplate: any;
    mappings: JsonFieldMapping[];
    transformations: any[];
    sampleData: Record<string, any>;
    onChange: (mappings: JsonFieldMapping[]) => void;
    onNext: () => void;
    onPrevious: () => void;
  }
  
  export interface MappingPreviewProps {
    config: JsonMappingConfig;
    sampleData: Record<string, any>;
    onTest?: () => void;
    onPrevious: () => void;
  }
  
  export interface TransformationModalProps {
    mapping: JsonFieldMapping;
    onSave: (updated: JsonFieldMapping) => void;
    onClose: () => void;
  }