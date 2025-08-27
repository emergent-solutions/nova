import React, { useState } from 'react';
import {
  FormGroup,
  TextArea,
  Button,
  Popover,
  Menu,
  MenuItem,
  MenuDivider,
  Tag,
  Position
} from '@blueprintjs/core';

interface StringFormatOptionsProps {
  template: string;
  availableFields: string[];
  onChange: (template: string) => void;
}

const StringFormatOptions: React.FC<StringFormatOptionsProps> = ({
  template,
  availableFields,
  onChange
}) => {
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showHelper, setShowHelper] = useState(false);
  const textAreaRef = React.useRef<HTMLTextAreaElement>(null);

  const insertVariable = (variable: string) => {
    const newTemplate = 
      template.slice(0, cursorPosition) + 
      `{{${variable}}}` + 
      template.slice(cursorPosition);
    onChange(newTemplate);
    setShowHelper(false);
    
    // Refocus and set cursor position
    setTimeout(() => {
      if (textAreaRef.current) {
        textAreaRef.current.focus();
        const newPosition = cursorPosition + variable.length + 4;
        textAreaRef.current.setSelectionRange(newPosition, newPosition);
      }
    }, 0);
  };

  const commonVariables = [
    { name: 'value', description: 'Current field value' },
    { name: 'now', description: 'Current timestamp' },
    { name: 'date', description: 'Current date' },
    { name: 'index', description: 'Row index' },
    { name: 'uuid', description: 'Random UUID' }
  ];

  return (
    <div className="string-format-options">
      <FormGroup label="Format Template">
        <TextArea
          inputRef={textAreaRef}
          value={template}
          onChange={(e) => onChange(e.target.value)}
          onClick={(e: any) => setCursorPosition(e.target.selectionStart)}
          onKeyUp={(e: any) => setCursorPosition(e.target.selectionStart)}
          placeholder="e.g., Hello {{firstName}} {{lastName}}, the date is {{date}}"
          rows={3}
          growVertically
        />
      </FormGroup>

      <Popover
        content={
          <Menu>
            <MenuDivider title="Common Variables" />
            {commonVariables.map(v => (
              <MenuItem
                key={v.name}
                text={
                  <div>
                    <strong>{v.name}</strong>
                    <div style={{ fontSize: '11px', color: '#5c7080' }}>
                      {v.description}
                    </div>
                  </div>
                }
                onClick={() => insertVariable(v.name)}
              />
            ))}
            
            {availableFields.length > 0 && (
              <>
                <MenuDivider title="Available Fields" />
                {availableFields.map(field => (
                  <MenuItem
                    key={field}
                    text={field}
                    onClick={() => insertVariable(field)}
                  />
                ))}
              </>
            )}
          </Menu>
        }
        position={Position.RIGHT}
        isOpen={showHelper}
        onClose={() => setShowHelper(false)}
      >
        <Button
          icon="variable"
          text="Insert Variable"
          onClick={() => setShowHelper(true)}
        />
      </Popover>

      <div className="template-preview">
        <strong>Preview:</strong>
        <div className="preview-content">
          <code>{renderTemplatePreview(template)}</code>
        </div>
      </div>

      <div className="template-variables">
        <strong>Used Variables:</strong>
        <div className="variable-tags">
          {extractVariables(template).map(v => (
            <Tag key={v} minimal>{v}</Tag>
          ))}
        </div>
      </div>
    </div>
  );
};

function renderTemplatePreview(template: string): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
    switch (variable) {
      case 'value': return '[field value]';
      case 'now': return new Date().toISOString();
      case 'date': return new Date().toLocaleDateString();
      case 'index': return '1';
      case 'uuid': return 'xxxx-xxxx-xxxx';
      default: return `[${variable}]`;
    }
  });
}

function extractVariables(template: string): string[] {
  const matches = template.match(/\{\{(\w+)\}\}/g) || [];
  return [...new Set(matches.map(m => m.replace(/[{}]/g, '')))];
}

export default StringFormatOptions;