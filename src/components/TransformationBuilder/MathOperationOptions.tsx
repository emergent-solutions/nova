import React from 'react';
import { FormGroup, HTMLSelect, NumericInput } from '@blueprintjs/core';

interface MathOperationOptionsProps {
  operation?: string;
  operand?: number;
  onChange: (options: any) => void;
}

const MathOperationOptions: React.FC<MathOperationOptionsProps> = ({
  operation = 'add',
  operand = 0,
  onChange
}) => {
  return (
    <div className="math-operation-options">
      <FormGroup label="Operation">
        <HTMLSelect
          value={operation}
          onChange={(e) => onChange({ operation: e.target.value, operand })}
        >
          <option value="add">Add (+)</option>
          <option value="subtract">Subtract (-)</option>
          <option value="multiply">Multiply (×)</option>
          <option value="divide">Divide (÷)</option>
          <option value="modulo">Modulo (%)</option>
          <option value="power">Power (^)</option>
          <option value="sqrt">Square Root</option>
          <option value="abs">Absolute Value</option>
        </HTMLSelect>
      </FormGroup>

      {operation !== 'sqrt' && operation !== 'abs' && (
        <FormGroup label="Value">
          <NumericInput
            value={operand}
            onValueChange={(value) => onChange({ operation, operand: value })}
          />
        </FormGroup>
      )}
    </div>
  );
};

export default MathOperationOptions;