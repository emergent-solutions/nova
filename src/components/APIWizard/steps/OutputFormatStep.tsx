import React, { useState } from 'react';
import {
  Card,
  Icon,
  FormGroup,
  InputGroup,
  Switch,
  HTMLSelect,
  TextArea,
  NumericInput,
  Callout,
  Intent
} from '@blueprintjs/core';
import { APIEndpointConfig } from '../../../types/schema.types';

interface OutputFormatStepProps {
  config: APIEndpointConfig;
  onUpdate: (updates: Partial<APIEndpointConfig>) => void;
}

const OutputFormatStep: React.FC<OutputFormatStepProps> = ({ config, onUpdate }) => {
  const [format, setFormat] = useState(config.outputFormat || 'json');
  const [formatOptions, setFormatOptions] = useState<any>({
    prettyPrint: true,
    includeMetadata: true,
    rootWrapper: 'data',
    ...config.outputSchema?.metadata
  });

  const handleFormatChange = (newFormat: typeof format) => {
    setFormat(newFormat);
    onUpdate({ 
      outputFormat: newFormat,
      outputSchema: {
        ...config.outputSchema,
        format: newFormat
      }
    });
  };

  const updateFormatOption = (key: string, value: any) => {
    const updated = { ...formatOptions, [key]: value };
    setFormatOptions(updated);
    onUpdate({
      outputSchema: {
        ...config.outputSchema,
        metadata: updated
      }
    });
  };

  const getAllFields = () => {
    const fields: string[] = [];
    config.dataSources.forEach(source => {
      if (source.fields) {
        fields.push(...source.fields);
      }
    });
    return [...new Set(fields)]; // Remove duplicates
  };

  return (
    <div className="output-format-step">
      <Callout intent={Intent.PRIMARY} icon="info-sign">
        Choose how your API will format and deliver data to consumers.
      </Callout>

      <div className="format-selector">
        <h4>Select Output Format</h4>
        <div className="format-options-grid">
          <Card
            interactive
            className={`format-card ${format === 'json' ? 'selected' : ''}`}
            onClick={() => handleFormatChange('json')}
          >
            <Icon icon="code-block" size={30} />
            <h5>JSON</h5>
            <p>RESTful JSON API</p>
            <small>Most common, works with all clients</small>
          </Card>

          <Card
            interactive
            className={`format-card ${format === 'xml' ? 'selected' : ''}`}
            onClick={() => handleFormatChange('xml')}
          >
            <Icon icon="code" size={30} />
            <h5>XML</h5>
            <p>XML formatted responses</p>
            <small>Enterprise systems, SOAP services</small>
          </Card>

          <Card
            interactive
            className={`format-card ${format === 'rss' ? 'selected' : ''}`}
            onClick={() => handleFormatChange('rss')}
          >
            <Icon icon="feed" size={30} />
            <h5>RSS</h5>
            <p>RSS 2.0 Feed</p>
            <small>News feeds, content syndication</small>
          </Card>

          <Card
            interactive
            className={`format-card ${format === 'csv' ? 'selected' : ''}`}
            onClick={() => handleFormatChange('csv')}
          >
            <Icon icon="th" size={30} />
            <h5>CSV</h5>
            <p>Comma-separated values</p>
            <small>Spreadsheets, data analysis</small>
          </Card>
        </div>
      </div>

      <Card className="format-settings">
        <h4>{format.toUpperCase()} Settings</h4>
        
        {format === 'json' && (
          <>
            <FormGroup label="Root Wrapper Field">
              <InputGroup
                value={formatOptions.rootWrapper}
                onChange={(e) => updateFormatOption('rootWrapper', e.target.value)}
                placeholder="e.g., data, results, items"
              />
            </FormGroup>

            <Switch
              label="Pretty print (formatted output)"
              checked={formatOptions.prettyPrint}
              onChange={(e) => updateFormatOption('prettyPrint', e.target.checked)}
            />

            <Switch
              label="Include metadata (pagination, timestamps)"
              checked={formatOptions.includeMetadata}
              onChange={(e) => updateFormatOption('includeMetadata', e.target.checked)}
            />

            <Switch
              label="Include null values"
              checked={formatOptions.includeNulls}
              onChange={(e) => updateFormatOption('includeNulls', e.target.checked)}
            />

            <FormGroup label="Date Format">
              <HTMLSelect
                value={formatOptions.dateFormat || 'ISO'}
                onChange={(e) => updateFormatOption('dateFormat', e.target.value)}
              >
                <option value="ISO">ISO 8601 (2024-01-01T12:00:00Z)</option>
                <option value="unix">Unix Timestamp (1704106800)</option>
                <option value="custom">Custom Format</option>
              </HTMLSelect>
            </FormGroup>
          </>
        )}

        {format === 'xml' && (
          <>
            <FormGroup label="Root Element Name">
              <InputGroup
                value={formatOptions.rootElement || 'response'}
                onChange={(e) => updateFormatOption('rootElement', e.target.value)}
              />
            </FormGroup>

            <FormGroup label="XML Namespace">
              <InputGroup
                value={formatOptions.namespace}
                onChange={(e) => updateFormatOption('namespace', e.target.value)}
                placeholder="Optional"
              />
            </FormGroup>

            <Switch
              label="Include XML declaration"
              checked={formatOptions.includeDeclaration !== false}
              onChange={(e) => updateFormatOption('includeDeclaration', e.target.checked)}
            />

            <Switch
              label="Use attributes instead of elements"
              checked={formatOptions.useAttributes}
              onChange={(e) => updateFormatOption('useAttributes', e.target.checked)}
            />
          </>
        )}

        {format === 'rss' && (
          <>
            <FormGroup label="Channel Title" labelInfo="(required)">
              <InputGroup
                value={formatOptions.channelTitle}
                onChange={(e) => updateFormatOption('channelTitle', e.target.value)}
                placeholder="My API Feed"
              />
            </FormGroup>

            <FormGroup label="Channel Description" labelInfo="(required)">
              <TextArea
                value={formatOptions.channelDescription}
                onChange={(e) => updateFormatOption('channelDescription', e.target.value)}
                placeholder="Description of your feed"
                rows={2}
              />
            </FormGroup>

            <FormGroup label="Channel Link">
              <InputGroup
                value={formatOptions.channelLink}
                onChange={(e) => updateFormatOption('channelLink', e.target.value)}
                placeholder="https://example.com"
              />
            </FormGroup>

            <FormGroup label="Title Field">
              <HTMLSelect
                value={formatOptions.titleField}
                onChange={(e) => updateFormatOption('titleField', e.target.value)}
              >
                <option value="">Select field...</option>
                {getAllFields().map(field => (
                  <option key={field} value={field}>{field}</option>
                ))}
              </HTMLSelect>
            </FormGroup>

            <FormGroup label="Description Field">
              <HTMLSelect
                value={formatOptions.descriptionField}
                onChange={(e) => updateFormatOption('descriptionField', e.target.value)}
              >
                <option value="">Select field...</option>
                {getAllFields().map(field => (
                  <option key={field} value={field}>{field}</option>
                ))}
              </HTMLSelect>
            </FormGroup>

            <FormGroup label="Link Field">
              <HTMLSelect
                value={formatOptions.linkField}
                onChange={(e) => updateFormatOption('linkField', e.target.value)}
              >
                <option value="">Select field...</option>
                {getAllFields().map(field => (
                  <option key={field} value={field}>{field}</option>
                ))}
              </HTMLSelect>
            </FormGroup>

            <FormGroup label="Publication Date Field">
              <HTMLSelect
                value={formatOptions.pubDateField}
                onChange={(e) => updateFormatOption('pubDateField', e.target.value)}
              >
                <option value="">Select field...</option>
                {getAllFields().map(field => (
                  <option key={field} value={field}>{field}</option>
                ))}
              </HTMLSelect>
            </FormGroup>
          </>
        )}

        {format === 'csv' && (
          <>
            <FormGroup label="Delimiter">
              <HTMLSelect
                value={formatOptions.delimiter || ','}
                onChange={(e) => updateFormatOption('delimiter', e.target.value)}
              >
                <option value=",">Comma (,)</option>
                <option value=";">Semicolon (;)</option>
                <option value="\t">Tab</option>
                <option value="|">Pipe (|)</option>
              </HTMLSelect>
            </FormGroup>

            <Switch
              label="Include headers"
              checked={formatOptions.includeHeaders !== false}
              onChange={(e) => updateFormatOption('includeHeaders', e.target.checked)}
            />

            <Switch
              label="Quote strings"
              checked={formatOptions.quoteStrings}
              onChange={(e) => updateFormatOption('quoteStrings', e.target.checked)}
            />

            <FormGroup label="Line Ending">
              <HTMLSelect
                value={formatOptions.lineEnding || 'LF'}
                onChange={(e) => updateFormatOption('lineEnding', e.target.value)}
              >
                <option value="LF">LF (Unix/Mac)</option>
                <option value="CRLF">CRLF (Windows)</option>
              </HTMLSelect>
            </FormGroup>
          </>
        )}
      </Card>
    </div>
  );
};

export default OutputFormatStep;