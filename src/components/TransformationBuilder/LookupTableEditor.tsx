// src/components/TransformationBuilder/LookupTableEditor.tsx
import React, { useState } from 'react';
import {
  Button,
  FormGroup,
  InputGroup,
  Icon,
  Intent
} from '@blueprintjs/core';

interface LookupTableEditorProps {
  mappings: Record<string, string>;
  defaultValue?: string;
  onChange: (options: { mappings: Record<string, string>; defaultValue?: string }) => void;
}

const LookupTableEditor: React.FC<LookupTableEditorProps> = ({
  mappings = {},
  defaultValue = '',
  onChange
}) => {
  const [rows, setRows] = useState<Array<{ from: string; to: string }>>(
    Object.entries(mappings).map(([from, to]) => ({ from, to }))
  );

  const addRow = () => {
    setRows([...rows, { from: '', to: '' }]);
  };

  const updateRow = (index: number, field: 'from' | 'to', value: string) => {
    const newRows = [...rows];
    newRows[index][field] = value;
    setRows(newRows);
    
    // Convert back to object format
    const newMappings: Record<string, string> = {};
    newRows.forEach(row => {
      if (row.from) {
        newMappings[row.from] = row.to;
      }
    });
    onChange({ mappings: newMappings, defaultValue });
  };

  const removeRow = (index: number) => {
    const newRows = rows.filter((_, i) => i !== index);
    setRows(newRows);
    
    // Convert back to object format
    const newMappings: Record<string, string> = {};
    newRows.forEach(row => {
      if (row.from) {
        newMappings[row.from] = row.to;
      }
    });
    onChange({ mappings: newMappings, defaultValue });
  };

  return (
    <div className="lookup-table-editor">
      <h5>Value Mapping</h5>
      
      <table className="bp5-html-table bp5-html-table-striped" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th>Input Value</th>
            <th>Output Value</th>
            <th style={{ width: '50px' }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              <td>
                <InputGroup
                  value={row.from}
                  onChange={(e) => updateRow(index, 'from', e.target.value)}
                  placeholder="Source value..."
                />
              </td>
              <td>
                <InputGroup
                  value={row.to}
                  onChange={(e) => updateRow(index, 'to', e.target.value)}
                  placeholder="Target value..."
                />
              </td>
              <td>
                <Button
                  icon="trash"
                  minimal
                  intent={Intent.DANGER}
                  onClick={() => removeRow(index)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <Button 
        icon="add" 
        text="Add Mapping" 
        onClick={addRow} 
        style={{ marginTop: '12px' }}
        small 
      />
      
      <FormGroup 
        label="Default Value (if no match)" 
        style={{ marginTop: '16px' }}
      >
        <InputGroup
          value={defaultValue}
          onChange={(e) => onChange({ mappings, defaultValue: e.target.value })}
          placeholder="Fallback value..."
        />
      </FormGroup>
    </div>
  );
};

export default LookupTableEditor;