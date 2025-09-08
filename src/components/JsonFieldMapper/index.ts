// Main component exports
export { JsonFieldMapper } from './JsonFieldMapper';
export type { JsonFieldMapperProps } from './types';

// Sub-component exports (if needed elsewhere)
export { SourceSelector } from './components/SourceSelector';
export { OutputTemplateBuilder } from './components/OutputTemplateBuilder';
export { FieldMappingCanvas } from './components/FieldMappingCanvas';
export { MappingPreview } from './components/MappingPreview';
export { TransformationModal } from './components/TransformationModal';

// Hook exports
export { useMappingEngine } from './hooks/useMappingEngine';
export { useDataTransform } from './hooks/useDataTransform';

// Utility exports
export * from './utils/pathHelpers';
export * from './utils/transformations';
export * from './utils/mappingHelpers';

// Type exports
export type {
  JsonMappingConfig,
  SourceSelection,
  DataSourceSelection,
  OutputTemplate,
  OutputField,
  JsonFieldMapping,
  MappingCondition,
  MappingTransformation,
  TransformationType
} from '../../types/jsonMapping.types';