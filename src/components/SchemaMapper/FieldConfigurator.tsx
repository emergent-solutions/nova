import React, { useState } from 'react';
import {
  Card,
  FormGroup,
  HTMLSelect,
  InputGroup,
  Button,
  Icon,
  Switch,
  TextArea,
  Intent
} from '@blueprintjs/core';
import { FieldMapping } from '../../types/schema.types';
import { DataSource } from '../../types/datasource.types';

interface FieldConfiguratorProps {
  field: string;
  mapping?: FieldMapping;
  sources: DataSource[];
  onUpdate: (mapping: Partial<FieldMapping>) => void;
  onClose: () => void;
}

const FieldConfigurator: React.FC<FieldConfiguratorProps> = ({
  field,
  mapping,
  sources,
  onUpdate,
  onClose
}) => {
  const [config, setConfig] = useState({
    source_id: mapping?.source_id || '',
    source_field: mapping?.source_field || '',
    transform_type: mapping?.transform_type || 'direct',
    fallback_value: mapping?.fallback_value || ''
  });

  // Helper function to get fields from a data source
  const getSourceFields = (sourceId: string): string[] => {
    const source = config.dataSources.find(s => s.id === sourceId);
    if (!source) return [];
    
    // Start with existing fields
    let fields: string[] = [];
    
    // Try multiple ways to get fields
    if (source.fields && source.fields.length > 0) {
      fields = [...source.fields];
    }
    
    // Check if fields were extracted during configuration
    if (source.api_config?.extracted_fields) {
      fields = [...source.api_config.extracted_fields];
    }
    
    // Try to extract from sample data if available
    if (fields.length === 0 && source.sample_data && source.sample_data.length > 0) {
      const sample = source.sample_data[0];
      if (typeof sample === 'object' && sample !== null) {
        fields = Object.keys(sample);
      }
    }
    
    // Add metadata fields including category
    if (source.category) {
      fields.push('_metadata.category');
    }
    fields.push('_metadata.source_name', '_metadata.source_type', '_metadata.source_id');
    
    return fields;
  };

  const handleSave = () => {
    onUpdate(config);
    onClose();
  };

  return (
    <Card className="field-configurator">
      <div className="configurator-header">
        <h4>Configure Field: {field}</h4>
        <Button minimal icon="cross" onClick={onClose} />
      </div>

      <FormGroup label="Data Source">
        <HTMLSelect
          value={config.source_id}
          onChange={(e) => setConfig({ ...config, source_id: e.target.value, source_field: '' })}
        >
          <option value="">-- Select Source --</option>
          {sources.map(source => (
            <option key={source.id} value={source.id}>{source.name}</option>
          ))}
          <option value="__static__">Static Value</option>
        </HTMLSelect>
      </FormGroup>

      {config.source_id === '__static__' ? (
        <FormGroup label="Static Value">
          <InputGroup
            value={config.fallback_value}
            onChange={(e) => setConfig({ ...config, fallback_value: e.target.value })}
            placeholder="Enter static value..."
          />
        </FormGroup>
      ) : config.source_id && (
        <>
          <FormGroup label="Source Field">
            <HTMLSelect
              value={config.source_field}
              onChange={(e) => setConfig({ ...config, source_field: e.target.value })}
            >
              <option value="">-- Select Field --</option>
              {getSourceFields(config.source_id).map(field => (
                <option key={field} value={field}>{field}</option>
              ))}
            </HTMLSelect>
          </FormGroup>

          <FormGroup label="Transformation">
            <HTMLSelect
              value={config.transform_type}
              onChange={(e) => setConfig({ ...config, transform_type: e.target.value })}
            >
              <option value="direct">Direct (No transformation)</option>
              <option value="uppercase">Uppercase</option>
              <option value="lowercase">Lowercase</option>
              <option value="trim">Trim Whitespace</option>
              <option value="date-format">Format Date</option>
              <option value="number-format">Format Number</option>
            </HTMLSelect>
          </FormGroup>
        </>
      )}

      <FormGroup label="Fallback Value (if empty)">
        <InputGroup
          value={config.fallback_value}
          onChange={(e) => setConfig({ ...config, fallback_value: e.target.value })}
          placeholder="Optional default value..."
        />
      </FormGroup>

      <div className="configurator-actions">
        <Button onClick={onClose}>Cancel</Button>
        <Button intent={Intent.PRIMARY} onClick={handleSave}>Apply</Button>
      </div>
    </Card>
  );
};

export default FieldConfigurator;