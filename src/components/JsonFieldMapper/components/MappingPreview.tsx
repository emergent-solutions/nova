import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Intent,
  Callout,
  Spinner,
  Tag,
  Icon,
  Classes
} from '@blueprintjs/core';
import { JsonMappingConfig } from '../../../types/jsonMapping.types';
import { useMappingEngine } from '../hooks/useMappingEngine';

interface MappingPreviewProps {
  config: JsonMappingConfig;
  sampleData: Record<string, any>;
  onTest?: () => void;
  onPrevious: () => void;
}

export const MappingPreview: React.FC<MappingPreviewProps> = ({
  config,
  sampleData,
  onTest,
  onPrevious
}) => {
  const [preview, setPreview] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);

  const { generatePreview, validateMapping } = useMappingEngine(config, sampleData);

  useEffect(() => {
    generatePreviewData();
    validateConfiguration();
  }, [config]);

  const generatePreviewData = async () => {
    setIsLoading(true);
    try {
      const result = await generatePreview();
      setPreview(result);
    } catch (error) {
      console.error('Preview generation failed:', error);
      setPreview(null);
    } finally {
      setIsLoading(false);
    }
  };

  const validateConfiguration = () => {
    const result = validateMapping();
    setValidationResult(result);
  };

  const getMappingStats = () => {
    const totalFields = config.outputTemplate.fields.length;
    const mappedFields = config.fieldMappings.length;
    const requiredFields = config.outputTemplate.fields.filter(f => f.required).length;
    const mappedRequired = config.outputTemplate.fields
      .filter(f => f.required)
      .filter(f => config.fieldMappings.some(m => m.targetPath === f.path))
      .length;

    return {
      totalFields,
      mappedFields,
      requiredFields,
      mappedRequired,
      completeness: Math.round((mappedFields / totalFields) * 100)
    };
  };

  const stats = getMappingStats();

  return (
    <div className="mapping-preview">
      {/* Validation Status */}
      {validationResult && (
        <Callout
          intent={validationResult.valid ? Intent.SUCCESS : Intent.WARNING}
          icon={validationResult.valid ? 'tick' : 'warning-sign'}
        >
          {validationResult.valid ? (
            'Configuration is valid and ready to use!'
          ) : (
            <>
              <strong>Configuration Issues:</strong>
              <ul>
                {validationResult.errors.map((error: string, i: number) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </>
          )}
        </Callout>
      )}

      {/* Mapping Statistics */}
      <Card style={{ marginTop: 20 }}>
        <h4>Mapping Summary</h4>
        <div className="preview-stats">
          <div className="stat-card">
            <div className="stat-value">{stats.mappedFields}/{stats.totalFields}</div>
            <div className="stat-label">Fields Mapped</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.completeness}%</div>
            <div className="stat-label">Completeness</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.mappedRequired}/{stats.requiredFields}</div>
            <div className="stat-label">Required Fields</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{config.transformations?.length || 0}</div>
            <div className="stat-label">Transformations</div>
          </div>
        </div>
      </Card>

      {/* Preview Output */}
      <Card style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4>Output Preview</h4>
          <Button
            icon="refresh"
            text="Regenerate"
            onClick={generatePreviewData}
            loading={isLoading}
          />
        </div>

        {isLoading ? (
          <Spinner />
        ) : preview ? (
          <pre className="preview-code">
            {JSON.stringify(preview, null, 2)}
          </pre>
        ) : (
          <Callout intent={Intent.NONE}>
            No preview available. Check your mapping configuration.
          </Callout>
        )}
      </Card>

      {/* Test Button */}
      <div className="step-actions">
        <Button
          text="Previous"
          icon="arrow-left"
          onClick={onPrevious}
        />
        {onTest && (
          <Button
            intent={Intent.PRIMARY}
            text="Test Mapping"
            icon="play"
            onClick={onTest}
            disabled={!validationResult?.valid}
          />
        )}
      </div>
    </div>
  );
};