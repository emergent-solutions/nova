import React from 'react';
import { FormGroup, InputGroup, HTMLSelect, NumericInput } from '@blueprintjs/core';

interface ArrayOperationOptionsProps {
  operation: string;
  delimiter?: string;
  limit?: number;
  onChange: (options: any) => void;
}

const ArrayOperationOptions: React.FC<ArrayOperationOptionsProps> = ({
  operation,
  delimiter = ',',
  limit,
  onChange
}) => {
  return (
    <div className="array-operation-options">
      {(operation === 'join' || operation === 'split') && (
        <FormGroup label="Delimiter">
          <InputGroup
            value={delimiter}
            onChange={(e) => onChange({ operation, delimiter: e.target.value, limit })}
            placeholder="e.g., comma, space, |"
          />
        </FormGroup>
      )}

      {operation === 'split' && (
        <FormGroup label="Limit (optional)">
          <NumericInput
            value={limit}
            onValueChange={(value) => onChange({ operation, delimiter, limit: value })}
            min={0}
            placeholder="No limit"
          />
        </FormGroup>
      )}

      {operation === 'filter' && (
        <FormGroup label="Filter Condition">
          <HTMLSelect
            onChange={(e) => onChange({ operation, condition: e.target.value })}
          >
            <option value="truthy">Keep truthy values</option>
            <option value="unique">Keep unique values</option>
            <option value="numbers">Keep numbers only</option>
            <option value="strings">Keep strings only</option>
          </HTMLSelect>
        </FormGroup>
      )}

      {operation === 'sort' && (
        <FormGroup label="Sort Order">
          <HTMLSelect
            onChange={(e) => onChange({ operation, order: e.target.value })}
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </HTMLSelect>
        </FormGroup>
      )}
    </div>
  );
};

export default ArrayOperationOptions;