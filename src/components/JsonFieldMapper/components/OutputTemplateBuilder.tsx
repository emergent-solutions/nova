import React, { useState, useRef, useEffect } from 'react';
import {
  Card,
  Button,
  Intent,
  FormGroup,
  InputGroup,
  TextArea,
  HTMLSelect,
  Icon,
  Tag,
  Callout,
  Classes,
  Switch,
  ButtonGroup,
  NonIdealState
} from '@blueprintjs/core';
import { OutputField, OutputTemplate } from '../../../types/jsonMapping.types';

interface OutputTemplateBuilderProps {
  template: OutputTemplate;
  sourceSelection: any;
  sampleData: Record<string, any>;
  onChange: (template: OutputTemplate) => void;
  onNext: () => void;
  onPrevious: () => void;
}

// Separate component for editable field to manage its own state
const EditableFieldName: React.FC<{
  field: OutputField;
  onRename: (oldPath: string, newName: string) => void;
  isEditing: boolean;
  onStartEdit: () => void;
  onEndEdit: () => void;
}> = ({ field, onRename, isEditing, onStartEdit, onEndEdit }) => {
  const fieldName = field.path.split('.').pop() || field.path;
  const [editValue, setEditValue] = useState(fieldName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(fieldName);
  }, [fieldName]);

  const handleSave = () => {
    const sanitized = editValue.replace(/[^a-zA-Z0-9_]/g, '');
    if (sanitized && sanitized !== fieldName) {
      onRename(field.path, sanitized);
    } else {
      setEditValue(fieldName); // Reset if invalid
    }
    onEndEdit();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(fieldName);
      onEndEdit();
    }
  };

  if (isEditing) {
    return (
      <InputGroup
        inputRef={inputRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        small
        style={{ width: '100%' }}
        placeholder="Field name..."
      />
    );
  }

  return (
    <div 
      onClick={onStartEdit}
      style={{ 
        cursor: 'pointer', 
        fontFamily: 'monospace',
        fontSize: '13px',
        padding: '4px 8px',
        borderRadius: '3px',
        background: '#f5f8fa',
        border: '1px solid transparent',
        transition: 'all 0.2s'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = '#e1e8ed';
        e.currentTarget.style.borderColor = '#137cbd';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = '#f5f8fa';
        e.currentTarget.style.borderColor = 'transparent';
      }}
    >
      {fieldName}
    </div>
  );
};

export const OutputTemplateBuilder: React.FC<OutputTemplateBuilderProps> = ({
  template,
  sourceSelection,
  sampleData,
  onChange,
  onNext,
  onPrevious
}) => {
  const [editMode, setEditMode] = useState<'visual' | 'json'>('visual');
  const [jsonText, setJsonText] = useState(
    JSON.stringify(template.structure || {}, null, 2)
  );
  const [jsonError, setJsonError] = useState<string>('');
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());
  const [editingFieldPath, setEditingFieldPath] = useState<string | null>(null);
  const [newFieldCounter, setNewFieldCounter] = useState(1);

  // Add a new field
  const handleAddField = (parentPath: string = '') => {
    const timestamp = Date.now();
    const fieldName = `field_${newFieldCounter}`;
    const newField: OutputField = {
      path: parentPath ? `${parentPath}.${fieldName}` : fieldName,
      type: 'string',
      required: false,
      description: '',
      defaultValue: ''
    };

    const updatedFields = [...(template.fields || []), newField];
    onChange({
      ...template,
      fields: updatedFields
    });

    setNewFieldCounter(newFieldCounter + 1);
    
    // Auto-edit the new field
    setTimeout(() => {
      setEditingFieldPath(newField.path);
    }, 50);
  };

  // Update field properties
  const handleUpdateField = (fieldPath: string, updates: Partial<OutputField>) => {
    const updatedFields = template.fields.map((field: OutputField) => 
      field.path === fieldPath 
        ? { ...field, ...updates }
        : field
    );

    onChange({
      ...template,
      fields: updatedFields
    });
  };

  // Rename a field (update path)
  const handleRenameField = (oldPath: string, newName: string) => {
    // Extract parent path if nested
    const lastDotIndex = oldPath.lastIndexOf('.');
    const parentPath = lastDotIndex > -1 ? oldPath.substring(0, lastDotIndex) : '';
    const newPath = parentPath ? `${parentPath}.${newName}` : newName;

    // Check for duplicate paths
    if (template.fields.some((f: OutputField) => f.path === newPath && f.path !== oldPath)) {
      // Show error or handle duplicate
      console.warn('Duplicate field name:', newName);
      return;
    }

    const updatedFields = template.fields.map((field: OutputField) => {
      if (field.path === oldPath) {
        return { ...field, path: newPath };
      }
      // Update child fields if this is a parent
      if (field.path.startsWith(oldPath + '.')) {
        const childPath = field.path.substring(oldPath.length);
        return { ...field, path: newPath + childPath };
      }
      return field;
    });

    onChange({
      ...template,
      fields: updatedFields
    });
  };

  // Delete a field
  const handleDeleteField = (fieldPath: string) => {
    const updatedFields = template.fields.filter(
      (f: OutputField) => f.path !== fieldPath && !f.path.startsWith(fieldPath + '.')
    );
    onChange({
      ...template,
      fields: updatedFields
    });
    
    // Clear editing state if deleting the editing field
    if (editingFieldPath === fieldPath) {
      setEditingFieldPath(null);
    }
  };

  // Add a nested field
  const handleAddNestedField = (parentPath: string) => {
    const fieldName = `nested_${newFieldCounter}`;
    const newField: OutputField = {
      path: `${parentPath}.${fieldName}`,
      type: 'string',
      required: false,
      description: '',
      defaultValue: ''
    };

    const updatedFields = [...template.fields, newField];
    
    // Update parent field type to object if needed
    const parentFieldIndex = template.fields.findIndex((f: OutputField) => f.path === parentPath);
    if (parentFieldIndex !== -1) {
      const parentField = template.fields[parentFieldIndex];
      if (parentField.type !== 'object' && parentField.type !== 'array') {
        updatedFields[parentFieldIndex] = { ...parentField, type: 'object' };
      }
    }

    onChange({
      ...template,
      fields: updatedFields
    });

    setNewFieldCounter(newFieldCounter + 1);
    
    // Expand parent and focus new field
    setExpandedFields(new Set([...expandedFields, parentPath]));
    setTimeout(() => {
      setEditingFieldPath(newField.path);
    }, 50);
  };

  // Duplicate a field
  const handleDuplicateField = (field: OutputField) => {
    const basePath = field.path + '_copy';
    let copyPath = basePath;
    let counter = 1;
    
    // Find unique name
    while (template.fields.some((f: OutputField) => f.path === copyPath)) {
      copyPath = `${basePath}_${counter}`;
      counter++;
    }
    
    const newField: OutputField = {
      ...field,
      path: copyPath
    };
    
    onChange({
      ...template,
      fields: [...template.fields, newField]
    });
  };

  // Toggle field expansion
  const toggleFieldExpansion = (fieldPath: string) => {
    const newExpanded = new Set(expandedFields);
    if (newExpanded.has(fieldPath)) {
      newExpanded.delete(fieldPath);
    } else {
      newExpanded.add(fieldPath);
    }
    setExpandedFields(newExpanded);
  };

  // Convert JSON to field structure
  const handleJsonUpdate = () => {
    try {
      const structure = JSON.parse(jsonText);
      const fields = extractFieldsFromStructure(structure);
      onChange({
        structure,
        fields
      });
      setJsonError('');
      setEditMode('visual');
    } catch (error) {
      setJsonError(`Invalid JSON: ${error.message}`);
    }
  };

  // Extract fields from JSON structure
  const extractFieldsFromStructure = (obj: any, path = ''): OutputField[] => {
    const fields: OutputField[] = [];
    
    if (!obj || typeof obj !== 'object') return fields;
    
    Object.keys(obj).forEach(key => {
      const fieldPath = path ? `${path}.${key}` : key;
      const value = obj[key];
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Object field
        fields.push({
          path: fieldPath,
          type: 'object',
          required: false,
          description: ''
        });
        // Recursively add nested fields
        fields.push(...extractFieldsFromStructure(value, fieldPath));
      } else if (Array.isArray(value)) {
        // Array field
        fields.push({
          path: fieldPath,
          type: 'array',
          required: false,
          description: ''
        });
        // If array has objects, extract their structure
        if (value.length > 0 && typeof value[0] === 'object') {
          fields.push(...extractFieldsFromStructure(value[0], `${fieldPath}[0]`));
        }
      } else {
        // Primitive field
        fields.push({
          path: fieldPath,
          type: typeof value === 'number' ? 'number' : 
                typeof value === 'boolean' ? 'boolean' : 'string',
          required: false,
          description: '',
          defaultValue: value
        });
      }
    });
    
    return fields;
  };

  // Import from sample data
  const handleImportFromSample = () => {
    const sourceId = sourceSelection?.sources?.[0]?.id;
    if (sourceId && sampleData[sourceId]) {
      const fields = extractFieldsFromStructure(sampleData[sourceId]);
      onChange({ ...template, fields });
      setNewFieldCounter(fields.length + 1);
    }
  };

  // Render a single field with inline editing
  const renderField = (field: OutputField, depth = 0) => {
    const hasChildren = template.fields.some((f: OutputField) => 
      f.path.startsWith(field.path + '.') && 
      f.path.split('.').length === field.path.split('.').length + 1
    );
    const isExpanded = expandedFields.has(field.path);

    return (
      <div 
        key={field.path} 
        className="output-field"
        style={{ 
          marginLeft: depth * 24,
          marginBottom: '2px'
        }}
      >
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          padding: '6px 8px',
          borderRadius: '4px',
          background: depth > 0 ? '#f5f8fa' : '#ffffff',
          border: '1px solid #e1e8ed'
        }}>
          {/* Expand/Collapse for object/array types */}
          {(field.type === 'object' || field.type === 'array') && hasChildren ? (
            <Button
              minimal
              small
              icon={isExpanded ? 'chevron-down' : 'chevron-right'}
              onClick={() => toggleFieldExpansion(field.path)}
              style={{ minWidth: 20 }}
            />
          ) : (
            <div style={{ width: 20 }} />
          )}
          
          {/* Field Name */}
          <div style={{ flex: '0 0 180px' }}>
            <EditableFieldName
              field={field}
              onRename={handleRenameField}
              isEditing={editingFieldPath === field.path}
              onStartEdit={() => setEditingFieldPath(field.path)}
              onEndEdit={() => setEditingFieldPath(null)}
            />
          </div>

          {/* Field Type */}
          <HTMLSelect
            value={field.type}
            onChange={(e) => handleUpdateField(field.path, { type: e.target.value as any })}
            small
            minimal
            style={{ minWidth: 90 }}
          >
            <option value="string">String</option>
            <option value="number">Number</option>
            <option value="boolean">Boolean</option>
            <option value="object">Object</option>
            <option value="array">Array</option>
            <option value="any">Any</option>
          </HTMLSelect>

          {/* Required Toggle */}
          <Switch
            checked={field.required || false}
            onChange={(e) => handleUpdateField(field.path, { required: e.target.checked })}
            label="Required"
            inline
            style={{ marginBottom: 0 }}
          />

          {/* Default Value (for primitive types) */}
          {['string', 'number', 'boolean'].includes(field.type) && (
            <InputGroup
              placeholder={field.type === 'boolean' ? 'true/false' : 'Default...'}
              value={field.defaultValue || ''}
              onChange={(e) => handleUpdateField(field.path, { defaultValue: e.target.value })}
              small
              style={{ maxWidth: '120px' }}
            />
          )}

          {/* Description */}
          <InputGroup
            placeholder="Description..."
            value={field.description || ''}
            onChange={(e) => handleUpdateField(field.path, { description: e.target.value })}
            small
            style={{ flex: 1, minWidth: 100 }}
          />

          {/* Action Buttons */}
          <ButtonGroup minimal>
            {(field.type === 'object' || field.type === 'array') && (
              <Button
                icon="plus"
                small
                intent={Intent.PRIMARY}
                title="Add nested field"
                onClick={() => handleAddNestedField(field.path)}
              />
            )}
            <Button
              icon="duplicate"
              small
              title="Duplicate field"
              onClick={() => handleDuplicateField(field)}
            />
            <Button
              icon="trash"
              small
              intent={Intent.DANGER}
              title="Delete field"
              onClick={() => {
                if (confirm(`Delete field "${field.path}" and all its nested fields?`)) {
                  handleDeleteField(field.path);
                }
              }}
            />
          </ButtonGroup>
        </div>

        {/* Nested Fields */}
        {isExpanded && hasChildren && (
          <div style={{ marginTop: '4px' }}>
            {template.fields
              .filter((f: OutputField) => 
                f.path.startsWith(field.path + '.') &&
                f.path.split('.').length === field.path.split('.').length + 1
              )
              .map((childField: OutputField) => renderField(childField, depth + 1))
            }
          </div>
        )}
      </div>
    );
  };

  // Group fields by hierarchy
  const getRootFields = () => {
    return template.fields.filter((f: OutputField) => !f.path.includes('.'));
  };

  return (
    <div className="output-template-builder">
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
          <h4>Define Output Structure</h4>
          <ButtonGroup>
            <Button
              active={editMode === 'visual'}
              onClick={() => setEditMode('visual')}
            >
              Visual Editor
            </Button>
            <Button
              active={editMode === 'json'}
              onClick={() => setEditMode('json')}
            >
              JSON Editor
            </Button>
          </ButtonGroup>
        </div>

        {editMode === 'visual' ? (
          <>
            <Callout intent={Intent.PRIMARY} icon="info-sign" style={{ marginBottom: 20 }}>
              Define your JSON output structure. Click field names to edit them.
              Press Enter to save or Escape to cancel editing.
            </Callout>

            {/* Action Buttons */}
            <div style={{ marginBottom: 20, display: 'flex', gap: 10 }}>
              <Button
                icon="plus"
                text="Add Field"
                intent={Intent.PRIMARY}
                onClick={() => handleAddField()}
              />
              <Button
                icon="import"
                text="Import from Sample"
                onClick={handleImportFromSample}
                disabled={!sourceSelection?.sources?.[0]?.id || !sampleData[sourceSelection.sources[0].id]}
              />
              <Button
                icon="expand-all"
                text="Expand All"
                onClick={() => {
                  const allParents = template.fields
                    .filter(f => f.type === 'object' || f.type === 'array')
                    .map(f => f.path);
                  setExpandedFields(new Set(allParents));
                }}
                disabled={template.fields.length === 0}
              />
              <Button
                icon="collapse-all"
                text="Collapse All"
                onClick={() => setExpandedFields(new Set())}
                disabled={expandedFields.size === 0}
              />
              <Button
                icon="clean"
                text="Clear All"
                intent={Intent.DANGER}
                onClick={() => {
                  if (confirm('Are you sure you want to clear all fields?')) {
                    onChange({ ...template, fields: [] });
                    setNewFieldCounter(1);
                  }
                }}
                disabled={template.fields.length === 0}
              />
            </div>

            {/* Field List */}
            <Card style={{ 
              backgroundColor: '#fafbfc', 
              maxHeight: 400, 
              overflowY: 'auto',
              padding: 10
            }}>
              {template.fields && template.fields.length > 0 ? (
                getRootFields().map((field: OutputField) => renderField(field))
              ) : (
                <NonIdealState
                  icon="build"
                  title="No fields defined"
                  description="Click 'Add Field' to start building your output structure"
                />
              )}
            </Card>

            {/* Field Statistics */}
            {template.fields.length > 0 && (
              <div style={{ marginTop: 15, display: 'flex', gap: 15, flexWrap: 'wrap' }}>
                <Tag minimal large>
                  <Icon icon="properties" />
                  <span style={{ marginLeft: 5 }}>
                    {template.fields.length} field{template.fields.length !== 1 ? 's' : ''}
                  </span>
                </Tag>
                <Tag minimal large intent={Intent.WARNING}>
                  <Icon icon="star" />
                  <span style={{ marginLeft: 5 }}>
                    {template.fields.filter(f => f.required).length} required
                  </span>
                </Tag>
                <Tag minimal large intent={Intent.SUCCESS}>
                  <Icon icon="folder-close" />
                  <span style={{ marginLeft: 5 }}>
                    {template.fields.filter(f => f.type === 'object').length} object{template.fields.filter(f => f.type === 'object').length !== 1 ? 's' : ''}
                  </span>
                </Tag>
                <Tag minimal large intent={Intent.PRIMARY}>
                  <Icon icon="array" />
                  <span style={{ marginLeft: 5 }}>
                    {template.fields.filter(f => f.type === 'array').length} array{template.fields.filter(f => f.type === 'array').length !== 1 ? 's' : ''}
                  </span>
                </Tag>
              </div>
            )}
          </>
        ) : (
          /* JSON Editor Mode */
          <>
            <FormGroup 
              label="JSON Structure Template"
              helperText="Define your output structure as JSON"
              intent={jsonError ? Intent.DANGER : Intent.NONE}
            >
              <TextArea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                rows={15}
                style={{ 
                  fontFamily: 'monospace',
                  fontSize: '12px'
                }}
                fill
              />
              {jsonError && (
                <Callout intent={Intent.DANGER} style={{ marginTop: 10 }}>
                  {jsonError}
                </Callout>
              )}
            </FormGroup>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button
                intent={Intent.PRIMARY}
                text="Apply JSON Structure"
                icon="import"
                onClick={handleJsonUpdate}
              />
              <Button
                text="Format JSON"
                icon="clean"
                onClick={() => {
                  try {
                    const parsed = JSON.parse(jsonText);
                    setJsonText(JSON.stringify(parsed, null, 2));
                    setJsonError('');
                  } catch (error) {
                    setJsonError(`Invalid JSON: ${error.message}`);
                  }
                }}
              />
            </div>
          </>
        )}
      </Card>

      {/* Navigation */}
      <div className="step-actions" style={{ marginTop: 30, display: 'flex', justifyContent: 'space-between' }}>
        <Button
          text="Previous"
          icon="arrow-left"
          onClick={onPrevious}
        />
        <Button
          intent={Intent.PRIMARY}
          text="Next: Map Fields"
          rightIcon="arrow-right"
          disabled={!template.fields || template.fields.length === 0}
          onClick={onNext}
        />
      </div>
    </div>
  );
};