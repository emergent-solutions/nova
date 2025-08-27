import React from 'react';
import { FormGroup, HTMLSelect, InputGroup } from '@blueprintjs/core';

interface DateFormatOptionsProps {
  inputFormat?: string;
  outputFormat?: string;
  timezone?: string;
  onChange: (options: any) => void;
}

const DateFormatOptions: React.FC<DateFormatOptionsProps> = ({
  inputFormat = 'auto',
  outputFormat = 'ISO',
  timezone = 'UTC',
  onChange
}) => {
  return (
    <div className="date-format-options">
      <FormGroup label="Input Format">
        <HTMLSelect
          value={inputFormat}
          onChange={(e) => onChange({ inputFormat: e.target.value, outputFormat, timezone })}
        >
          <option value="auto">Auto-detect</option>
          <option value="ISO">ISO 8601</option>
          <option value="unix">Unix Timestamp</option>
          <option value="DD/MM/YYYY">DD/MM/YYYY</option>
          <option value="MM/DD/YYYY">MM/DD/YYYY</option>
          <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          <option value="custom">Custom</option>
        </HTMLSelect>
      </FormGroup>

      <FormGroup label="Output Format">
        <HTMLSelect
          value={outputFormat}
          onChange={(e) => onChange({ inputFormat, outputFormat: e.target.value, timezone })}
        >
          <option value="ISO">ISO 8601</option>
          <option value="unix">Unix Timestamp</option>
          <option value="relative">Relative (e.g., 2 hours ago)</option>
          <option value="long">Long format</option>
          <option value="short">Short format</option>
          <option value="custom">Custom</option>
        </HTMLSelect>
      </FormGroup>

      {outputFormat === 'custom' && (
        <FormGroup label="Custom Format">
          <InputGroup
            placeholder="e.g., YYYY-MM-DD HH:mm:ss"
            onChange={(e) => onChange({ inputFormat, outputFormat, timezone, customFormat: e.target.value })}
          />
        </FormGroup>
      )}

      <FormGroup label="Timezone">
        <HTMLSelect
          value={timezone}
          onChange={(e) => onChange({ inputFormat, outputFormat, timezone: e.target.value })}
        >
          <option value="UTC">UTC</option>
          <option value="local">Local Time</option>
          <option value="America/New_York">America/New_York</option>
          <option value="Europe/London">Europe/London</option>
          <option value="Asia/Tokyo">Asia/Tokyo</option>
        </HTMLSelect>
      </FormGroup>
    </div>
  );
};

export default DateFormatOptions;