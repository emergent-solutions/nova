import React, { useState } from 'react';
import {
  Card,
  Button,
  FormGroup,
  InputGroup,
  TextArea,
  HTMLSelect,
  Tag,
  Icon,
  Switch,
  NumericInput,
  Callout,
  Intent
} from '@blueprintjs/core';
import { Transformation, TransformationType } from '../../types/api.types';
import StringFormatOptions from './StringFormatOptions';
import DateFormatOptions from './DateFormatOptions';
import MathOperationOptions from './MathOperationOptions';
import LookupTableEditor from './LookupTableEditor';
import ArrayOperationOptions from './ArrayOperationOptions';
import AITransformationOptions from './AITransformationOptions';
import { getAvailableTransformations } from '../../utils/transformations';
import './TransformationBuilder.css';

interface TransformationBuilderProps {
  sourceType: string;
  targetType: string;
  value?: TransformationType;
  options?: Record<string, any>;
  availableFields?: string[];
  onChange: (transform: TransformationType, options?: Record<string, any>) => void;
}

const TransformationBuilder: React.FC<TransformationBuilderProps> = ({
  sourceType,
  targetType,
  value,
  options = {},
  availableFields = [],
  onChange
}) => {
  const availableTransforms = getAvailableTransformations(sourceType, targetType);
  
  // Always add AI transformation as an option
  if (!availableTransforms.find(t => t.id === 'ai-transform')) {
    availableTransforms.push({
      id: 'ai-transform',
      name: 'AI Transform',
      description: 'Use Claude AI to intelligently transform data',
      icon: 'predictive-analysis',
      sourceTypes: ['any'],
      targetTypes: ['any']
    });
  }
  
  const [selectedTransform, setSelectedTransform] = useState<TransformationType | null>(value || null);
  const [transformOptions, setTransformOptions] = useState(options);

  const handleTransformSelect = (transform: TransformationType) => {
    setSelectedTransform(transform);
    onChange(transform, {});
  };

  const handleOptionsChange = (newOptions: Record<string, any>) => {
    setTransformOptions(newOptions);
    if (selectedTransform) {
      onChange(selectedTransform, newOptions);
    }
  };

  const renderTransformOptions = () => {
    if (!selectedTransform) return null;

    switch (selectedTransform) {
      case 'ai-transform':
        return (
          <AITransformationOptions
            prompt={transformOptions.prompt || ''}
            systemPrompt={transformOptions.systemPrompt}
            outputFormat={transformOptions.outputFormat}
            fieldContext={availableFields}
            examples={transformOptions.examples}
            cacheResults={transformOptions.cacheResults}
            onChange={handleOptionsChange}
          />
        );

      case 'string-format':
        return (
          <StringFormatOptions
            template={transformOptions.template || ''}
            availableFields={availableFields}
            onChange={(template) => handleOptionsChange({ ...transformOptions, template })}
          />
        );

      case 'date-format':
        return (
          <DateFormatOptions
            inputFormat={transformOptions.inputFormat}
            outputFormat={transformOptions.outputFormat}
            timezone={transformOptions.timezone}
            onChange={handleOptionsChange}
          />
        );

      case 'math-operation':
        return (
          <MathOperationOptions
            operation={transformOptions.operation}
            operand={transformOptions.operand}
            onChange={handleOptionsChange}
          />
        );

      case 'lookup':
        return (
          <LookupTableEditor
            mappings={transformOptions.mappings || {}}
            defaultValue={transformOptions.defaultValue}
            onChange={handleOptionsChange}
          />
        );

      case 'regex-extract':
        return (
          <div className="regex-options">
            <FormGroup label="Pattern">
              <InputGroup
                value={transformOptions.pattern || ''}
                onChange={(e) => handleOptionsChange({ 
                  ...transformOptions, 
                  pattern: e.target.value 
                })}
                placeholder="e.g., \d+"
              />
            </FormGroup>
            <FormGroup label="Capture Group">
              <NumericInput
                value={transformOptions.group || 0}
                onValueChange={(value) => handleOptionsChange({ 
                  ...transformOptions, 
                  group: value 
                })}
                min={0}
              />
            </FormGroup>
            <FormGroup label="Flags">
              <div className="regex-flags">
                <Switch
                  label="Global (g)"
                  checked={transformOptions.flags?.includes('g')}
                  onChange={(e) => {
                    const flags = transformOptions.flags || '';
                    const newFlags = e.target.checked 
                      ? flags + 'g' 
                      : flags.replace('g', '');
                    handleOptionsChange({ ...transformOptions, flags: newFlags });
                  }}
                />
                <Switch
                  label="Case Insensitive (i)"
                  checked={transformOptions.flags?.includes('i')}
                  onChange={(e) => {
                    const flags = transformOptions.flags || '';
                    const newFlags = e.target.checked 
                      ? flags + 'i' 
                      : flags.replace('i', '');
                    handleOptionsChange({ ...transformOptions, flags: newFlags });
                  }}
                />
              </div>
            </FormGroup>
          </div>
        );

      case 'join':
      case 'split':
        return (
          <ArrayOperationOptions
            operation={selectedTransform}
            delimiter={transformOptions.delimiter}
            limit={transformOptions.limit}
            onChange={handleOptionsChange}
          />
        );

      case 'round':
      case 'floor':
      case 'ceil':
        return (
          <FormGroup label="Decimal Places">
            <NumericInput
              value={transformOptions.precision || 0}
              onValueChange={(value) => handleOptionsChange({ 
                ...transformOptions, 
                precision: value 
              })}
              min={0}
              max={10}
            />
          </FormGroup>
        );

      case 'uppercase':
      case 'lowercase':
      case 'capitalize':
      case 'trim':
        // These transformations don't need options
        return (
          <Callout intent={Intent.PRIMARY}>
            This transformation will be applied directly without additional configuration.
          </Callout>
        );

      case 'substring':
        return (
          <>
            <FormGroup label="Start Index">
              <NumericInput
                value={transformOptions.start || 0}
                onValueChange={(value) => handleOptionsChange({
                  ...transformOptions,
                  start: value
                })}
                min={0}
              />
            </FormGroup>
            <FormGroup label="Length" helperText="Leave empty for rest of string">
              <NumericInput
                value={transformOptions.length}
                onValueChange={(value) => handleOptionsChange({
                  ...transformOptions,
                  length: value
                })}
                min={1}
                placeholder="Optional"
              />
            </FormGroup>
          </>
        );

      case 'replace':
        return (
          <>
            <FormGroup label="Find">
              <InputGroup
                value={transformOptions.find || ''}
                onChange={(e) => handleOptionsChange({
                  ...transformOptions,
                  find: e.target.value
                })}
                placeholder="Text to find"
              />
            </FormGroup>
            <FormGroup label="Replace With">
              <InputGroup
                value={transformOptions.replace || ''}
                onChange={(e) => handleOptionsChange({
                  ...transformOptions,
                  replace: e.target.value
                })}
                placeholder="Replacement text"
              />
            </FormGroup>
            <Switch
              label="Replace All Occurrences"
              checked={transformOptions.replaceAll !== false}
              onChange={(e) => handleOptionsChange({
                ...transformOptions,
                replaceAll: e.target.checked
              })}
            />
          </>
        );

      default:
        return (
          <Callout intent={Intent.WARNING}>
            Configuration options for {selectedTransform} are not yet implemented.
          </Callout>
        );
    }
  };

  return (
    <div className="transformation-builder">
      <div className="transform-selector">
        <h4>Select Transformation</h4>
        <div className="transform-grid">
          {availableTransforms.map(transform => (
            <Card
              key={transform.id}
              interactive
              className={`transform-card ${selectedTransform === transform.id ? 'selected' : ''}`}
              onClick={() => handleTransformSelect(transform.id as TransformationType)}
            >
              <Icon icon={transform.icon as any} size={20} />
              <div className="transform-info">
                <strong>{transform.name}</strong>
                <small>{transform.description}</small>
              </div>
              {transform.id === 'ai-transform' && (
                <Tag intent={Intent.SUCCESS} minimal style={{ position: 'absolute', top: 5, right: 5 }}>
                  AI
                </Tag>
              )}
            </Card>
          ))}
        </div>
      </div>

      {selectedTransform && (
        <div className="transform-options">
          <h4>Configuration</h4>
          {renderTransformOptions()}
          
          {selectedTransform !== 'ai-transform' && (
            <div className="transform-preview">
              <Callout intent={Intent.PRIMARY} icon="info-sign">
                <strong>Example:</strong>
                <div className="preview-example">
                  Input: <Tag>Sample Value</Tag>
                  <Icon icon="arrow-right" />
                  Output: <Tag intent={Intent.SUCCESS}>
                    {getTransformPreview(selectedTransform, transformOptions, 'Sample Value')}
                  </Tag>
                </div>
              </Callout>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Helper function to generate preview
function getTransformPreview(
  transform: TransformationType, 
  options: Record<string, any>, 
  input: string
): string {
  switch (transform) {
    case 'uppercase':
      return input.toUpperCase();
    case 'lowercase':
      return input.toLowerCase();
    case 'capitalize':
      return input.charAt(0).toUpperCase() + input.slice(1).toLowerCase();
    case 'trim':
      return input.trim();
    case 'string-format':
      return options.template?.replace('{{value}}', input) || input;
    case 'substring':
      return input.substring(options.start || 0, options.length ? (options.start || 0) + options.length : undefined);
    case 'replace':
      return options.replaceAll !== false 
        ? input.replaceAll(options.find || '', options.replace || '')
        : input.replace(options.find || '', options.replace || '');
    default:
      return `[${transform}]`;
  }
}

export default TransformationBuilder;