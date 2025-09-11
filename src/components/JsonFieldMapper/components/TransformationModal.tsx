import React, { useState, useEffect } from 'react';
import {
  Dialog,
  Button,
  Intent,
  FormGroup,
  InputGroup,
  HTMLSelect,
  Switch,
  NumericInput,
  TextArea,
  Callout,
  Tag,
  Card,
  Classes
} from '@blueprintjs/core';
import { JsonFieldMapping, MappingTransformation } from '../../../types/jsonMapping.types';
import { applyTransformation, TRANSFORMATION_TYPES } from '../utils/transformations';

interface TransformationModalProps {
  mapping: JsonFieldMapping;
  onSave: (updated: JsonFieldMapping) => void;
  onClose: () => void;
}

export const TransformationModal: React.FC<TransformationModalProps> = ({
  mapping,
  onSave,
  onClose
}) => {
  const [transformType, setTransformType] = useState<string>('none');
  const [transformConfig, setTransformConfig] = useState<Record<string, any>>({});
  const [fallbackValue, setFallbackValue] = useState<string>(mapping.fallbackValue || '');
  const [useConditional, setUseConditional] = useState<boolean>(!!mapping.conditional);
  const [conditional, setConditional] = useState(mapping.conditional || {
    type: 'simple',
    when: '',
    operator: 'equals',
    value: '',
    then: '',
    else: ''
  });
  const [previewInput, setPreviewInput] = useState<string>('Sample text');
  const [previewOutput, setPreviewOutput] = useState<string>('');

  // Initialize from existing mapping
  useEffect(() => {
    if (mapping.transformId) {
      // Parse transform type from ID or config
      setTransformType(mapping.transformId.split('_')[0] || 'none');
    }
  }, [mapping]);

  // Update preview when transformation changes
  useEffect(() => {
    updatePreview();
  }, [transformType, transformConfig, previewInput]);

  const updatePreview = () => {
    try {
      if (transformType === 'none') {
        setPreviewOutput(previewInput);
        return;
      }

      const transform: MappingTransformation = {
        id: `${transformType}_preview`,
        name: transformType,
        type: transformType as any,
        config: transformConfig
      };

      const result = applyTransformation(previewInput, transform);
      setPreviewOutput(String(result));
    } catch (error) {
      setPreviewOutput(`Error: ${error.message}`);
    }
  };

  const handleSave = () => {
    const updated: JsonFieldMapping = {
      ...mapping,
      fallbackValue: fallbackValue || undefined
    };

    // Add transformation if selected
    if (transformType !== 'none') {
      updated.transformId = `${transformType}_${Date.now()}`;
      // In a real implementation, you'd also save the transformation config
      // to the parent component's transformations array
    }

    // Add conditional if enabled
    if (useConditional && conditional.when) {
      updated.conditional = conditional;
    } else {
      updated.conditional = undefined;
    }

    onSave(updated);
  };

  const renderTransformConfig = () => {
    switch (transformType) {
      case 'concatenate':
        return (
          <>
            <FormGroup label="Separator">
              <InputGroup
                value={transformConfig.separator || ' '}
                onChange={(e) => setTransformConfig({
                  ...transformConfig,
                  separator: e.target.value
                })}
                placeholder="Space, comma, etc."
              />
            </FormGroup>
            <FormGroup label="Additional Fields" helperText="Comma-separated field paths">
              <TextArea
                style={{ width: '100%' }}
                value={transformConfig.fields || ''}
                onChange={(e) => setTransformConfig({
                  ...transformConfig,
                  fields: e.target.value
                })}
                placeholder="field1.path, field2.path"
              />
            </FormGroup>
          </>
        );

      case 'substring':
        return (
          <>
            <FormGroup label="Start Index">
              <NumericInput
                value={transformConfig.start || 0}
                onValueChange={(value) => setTransformConfig({
                  ...transformConfig,
                  start: value
                })}
                min={0}
              />
            </FormGroup>
            <FormGroup label="Length" helperText="Leave empty for rest of string">
              <NumericInput
                value={transformConfig.length}
                onValueChange={(value) => setTransformConfig({
                  ...transformConfig,
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
                value={transformConfig.find || ''}
                onChange={(e) => setTransformConfig({
                  ...transformConfig,
                  find: e.target.value
                })}
                placeholder="Text to find"
              />
            </FormGroup>
            <FormGroup label="Replace With">
              <InputGroup
                value={transformConfig.replace || ''}
                onChange={(e) => setTransformConfig({
                  ...transformConfig,
                  replace: e.target.value
                })}
                placeholder="Replacement text"
              />
            </FormGroup>
            <Switch
              label="Use Regular Expression"
              checked={transformConfig.regex || false}
              onChange={(e) => setTransformConfig({
                ...transformConfig,
                regex: e.target.checked
              })}
            />
          </>
        );

      case 'date_format':
        return (
          <>
            <FormGroup label="Input Format" helperText="e.g., YYYY-MM-DD">
              <InputGroup
                value={transformConfig.inputFormat || 'YYYY-MM-DD'}
                onChange={(e) => setTransformConfig({
                  ...transformConfig,
                  inputFormat: e.target.value
                })}
              />
            </FormGroup>
            <FormGroup label="Output Format" helperText="e.g., MMM DD, YYYY">
              <InputGroup
                value={transformConfig.outputFormat || 'MMM DD, YYYY'}
                onChange={(e) => setTransformConfig({
                  ...transformConfig,
                  outputFormat: e.target.value
                })}
              />
            </FormGroup>
          </>
        );

      case 'number_format':
        return (
          <>
            <FormGroup label="Decimal Places">
              <NumericInput
                value={transformConfig.decimals || 2}
                onValueChange={(value) => setTransformConfig({
                  ...transformConfig,
                  decimals: value
                })}
                min={0}
                max={10}
              />
            </FormGroup>
            <Switch
              label="Use Thousand Separator"
              checked={transformConfig.thousandSeparator || false}
              onChange={(e) => setTransformConfig({
                ...transformConfig,
                thousandSeparator: e.target.checked
              })}
            />
            <FormGroup label="Prefix" helperText="e.g., $ for currency">
              <InputGroup
                value={transformConfig.prefix || ''}
                onChange={(e) => setTransformConfig({
                  ...transformConfig,
                  prefix: e.target.value
                })}
                placeholder="Optional"
              />
            </FormGroup>
          </>
        );

      case 'calculate':
        return (
          <>
            <FormGroup label="Operation">
              <HTMLSelect
                value={transformConfig.operation || 'add'}
                onChange={(e) => setTransformConfig({
                  ...transformConfig,
                  operation: e.target.value
                })}
              >
                <option value="add">Add</option>
                <option value="subtract">Subtract</option>
                <option value="multiply">Multiply</option>
                <option value="divide">Divide</option>
                <option value="modulo">Modulo</option>
                <option value="power">Power</option>
              </HTMLSelect>
            </FormGroup>
            <FormGroup label="Value">
              <NumericInput
                value={transformConfig.value || 0}
                onValueChange={(value) => setTransformConfig({
                  ...transformConfig,
                  value: value
                })}
              />
            </FormGroup>
          </>
        );

      case 'split':
        return (
          <>
            <FormGroup label="Delimiter">
              <InputGroup
                value={transformConfig.delimiter || ','}
                onChange={(e) => setTransformConfig({
                  ...transformConfig,
                  delimiter: e.target.value
                })}
                placeholder="Comma, space, etc."
              />
            </FormGroup>
            <FormGroup label="Return Index" helperText="Which part to return (0-based)">
              <NumericInput
                value={transformConfig.index || 0}
                onValueChange={(value) => setTransformConfig({
                  ...transformConfig,
                  index: value
                })}
                min={0}
              />
            </FormGroup>
          </>
        );

      case 'lookup':
        return (
          <>
            <FormGroup label="Lookup Table" helperText="JSON object mapping">
              <TextArea
                style={{ width: '100%' }}
                value={transformConfig.lookupTable || '{}'}
                onChange={(e) => setTransformConfig({
                  ...transformConfig,
                  lookupTable: e.target.value
                })}
                placeholder='{"key1": "value1", "key2": "value2"}'
                rows={5}
              />
            </FormGroup>
            <FormGroup label="Default Value">
              <InputGroup
                value={transformConfig.defaultValue || ''}
                onChange={(e) => setTransformConfig({
                  ...transformConfig,
                  defaultValue: e.target.value
                })}
                placeholder="If key not found"
              />
            </FormGroup>
          </>
        );

      case 'custom':
        return (
          <FormGroup 
            label="JavaScript Expression" 
            helperText="Use 'value' to reference the input"
          >
            <TextArea
              style={{ width: '100%' }}
              value={transformConfig.expression || ''}
              onChange={(e) => setTransformConfig({
                ...transformConfig,
                expression: e.target.value
              })}
              placeholder="value.toLowerCase().trim()"
              rows={3}
            />
          </FormGroup>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog
      isOpen={true}
      onClose={onClose}
      title="Configure Field Transformation"
      className="transformation-modal"
    >
      <div className={Classes.DIALOG_BODY}>
        <Card className="mapping-info">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>Source:</strong> <Tag minimal>{mapping.sourcePath}</Tag>
            </div>
            <Icon icon="arrow-right" />
            <div>
              <strong>Target:</strong> <Tag minimal>{mapping.targetPath}</Tag>
            </div>
          </div>
        </Card>

        {/* Transformation Type Selection */}
        <FormGroup label="Transformation Type">
          <HTMLSelect
            value={transformType}
            onChange={(e) => setTransformType(e.target.value)}
            fill
          >
            <option value="none">None (Direct Mapping)</option>
            <optgroup label="Text Transformations">
              <option value="uppercase">Uppercase</option>
              <option value="lowercase">Lowercase</option>
              <option value="capitalize">Capitalize</option>
              <option value="trim">Trim Whitespace</option>
              <option value="substring">Substring</option>
              <option value="replace">Find & Replace</option>
              <option value="concatenate">Concatenate Fields</option>
              <option value="split">Split Text</option>
            </optgroup>
            <optgroup label="Number Transformations">
              <option value="number_format">Format Number</option>
              <option value="calculate">Calculate</option>
              <option value="round">Round</option>
              <option value="ceil">Ceiling</option>
              <option value="floor">Floor</option>
            </optgroup>
            <optgroup label="Date Transformations">
              <option value="date_format">Format Date</option>
              <option value="date_add">Add Time</option>
              <option value="date_diff">Date Difference</option>
            </optgroup>
            <optgroup label="Advanced">
              <option value="parse_json">Parse JSON</option>
              <option value="stringify">Convert to String</option>
              <option value="lookup">Lookup Table</option>
              <option value="custom">Custom JavaScript</option>
            </optgroup>
          </HTMLSelect>
        </FormGroup>

        {/* Transformation Configuration */}
        {transformType !== 'none' && (
          <Card style={{ marginTop: 15 }}>
            <h4>Transformation Settings</h4>
            {renderTransformConfig()}
          </Card>
        )}

        {/* Fallback Value */}
        <FormGroup 
          label="Fallback Value" 
          helperText="Used when source field is empty or null"
        >
          <InputGroup
            value={fallbackValue}
            onChange={(e) => setFallbackValue(e.target.value)}
            placeholder="Optional default value"
          />
        </FormGroup>

        {/* Conditional Mapping */}
        <Switch
          label="Use Conditional Mapping"
          checked={useConditional}
          onChange={(e) => setUseConditional(e.target.checked)}
        />

        {useConditional && (
          <Card style={{ marginTop: 15 }}>
            <h4>Conditional Logic</h4>
            <FormGroup label="When Field">
              <InputGroup
                value={conditional.when}
                onChange={(e) => setConditional({
                  ...conditional,
                  when: e.target.value
                })}
                placeholder="Field path to check"
              />
            </FormGroup>
            <FormGroup label="Operator">
              <HTMLSelect
                value={conditional.operator}
                onChange={(e) => setConditional({
                  ...conditional,
                  operator: e.target.value as any
                })}
              >
                <option value="equals">Equals</option>
                <option value="not_equals">Not Equals</option>
                <option value="contains">Contains</option>
                <option value="greater_than">Greater Than</option>
                <option value="less_than">Less Than</option>
                <option value="exists">Exists</option>
                <option value="not_exists">Does Not Exist</option>
              </HTMLSelect>
            </FormGroup>
            {conditional.operator !== 'exists' && conditional.operator !== 'not_exists' && (
              <FormGroup label="Value">
                <InputGroup
                  value={conditional.value}
                  onChange={(e) => setConditional({
                    ...conditional,
                    value: e.target.value
                  })}
                  placeholder="Value to compare"
                />
              </FormGroup>
            )}
            <FormGroup label="Then (if true)">
              <InputGroup
                value={conditional.then}
                onChange={(e) => setConditional({
                  ...conditional,
                  then: e.target.value
                })}
                placeholder="Value when condition is true"
              />
            </FormGroup>
            <FormGroup label="Else (if false)">
              <InputGroup
                value={conditional.else}
                onChange={(e) => setConditional({
                  ...conditional,
                  else: e.target.value
                })}
                placeholder="Value when condition is false"
              />
            </FormGroup>
          </Card>
        )}

        {/* Preview */}
        {transformType !== 'none' && (
          <Card style={{ marginTop: 20 }}>
            <h4>Preview</h4>
            <FormGroup label="Sample Input">
              <InputGroup
                value={previewInput}
                onChange={(e) => setPreviewInput(e.target.value)}
                placeholder="Enter sample value"
              />
            </FormGroup>
            <div className="transform-preview">
              <div>
                <small className={Classes.TEXT_MUTED}>Input:</small>
                <div><strong>{previewInput}</strong></div>
              </div>
              <Icon icon="arrow-right" className="transform-arrow" />
              <div>
                <small className={Classes.TEXT_MUTED}>Output:</small>
                <div><strong>{previewOutput}</strong></div>
              </div>
            </div>
          </Card>
        )}
      </div>

      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <Button onClick={onClose}>Cancel</Button>
          <Button intent={Intent.PRIMARY} onClick={handleSave}>
            Save Transformation
          </Button>
        </div>
      </div>
    </Dialog>
  );
};