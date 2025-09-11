import React, { useState } from 'react';
import {
  Card,
  Button,
  Intent,
  FormGroup,
  InputGroup,
  HTMLSelect,
  TextArea,
  Tabs,
  Tab,
  Tag,
  Spinner,
  Callout,
  NonIdealState,
  Icon
} from '@blueprintjs/core';
import { APIEndpointConfig } from '../../../types/schema.types';
import { supabase } from '../../../lib/supabase';
import { JSONTree } from 'react-json-tree';

interface TestingStepProps {
  config: APIEndpointConfig;
  onUpdate: (updates: Partial<APIEndpointConfig>) => void;
}

interface TestResult {
  success: boolean;
  data?: any;
  error?: string;
  responseTime?: number;
  statusCode?: number;
  headers?: Record<string, string>;
  size?: number;
}

const TestingStep: React.FC<TestingStepProps> = ({ config, onUpdate }) => {
  const [testParams, setTestParams] = useState<Record<string, any>>({});
  const [testHeaders, setTestHeaders] = useState<Record<string, string>>({});
  const [testMethod, setTestMethod] = useState<string>('GET');
  const [testBody, setTestBody] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [selectedTab, setSelectedTab] = useState<string>('response');
  const [queryParams, setQueryParams] = useState<Array<{key: string, value: string}>>([
    { key: '', value: '' }
  ]);

  const getEndpointUrl = () => {
    // Use the actual app URL and the endpoint slug
    const baseUrl = import.meta.env.VITE_API_URL || window.location.origin;
    const slug = config.slug || 'endpoint';
    return `${baseUrl}/api/${slug}`;
  };

  const runTest = async () => {
    setIsLoading(true);
    const startTime = Date.now();
    
    try {
      // Clean the config to remove sample_response
      const cleanConfig = JSON.parse(
        JSON.stringify(config, (key, value) => {
          if (key === 'sample_response') return undefined;
          return value;
        })
      );

      // Parse the test body if it exists
      let parsedBody = undefined;
      if (testBody && testMethod !== 'GET' && testMethod !== 'DELETE') {
        try {
          parsedBody = JSON.parse(testBody);
        } catch (e) {
          console.error('Invalid JSON in request body:', e);
          setTestResult({
            success: false,
            error: 'Invalid JSON in request body',
            responseTime: 0
          });
          setIsLoading(false);
          return;
        }
      }

      // Call the test endpoint function
      const { data, error } = await supabase.functions.invoke('test-api-endpoint', {
        body: {
          config: cleanConfig,
          params: testParams,
          headers: testHeaders,
          method: testMethod,
          body: parsedBody
        }
      });

      const responseTime = Date.now() - startTime;

      if (error) {
        setTestResult({
          success: false,
          error: error.message,
          responseTime
        });
      } else {
        setTestResult({
          success: true,
          data: data.response,
          statusCode: data.status || 200,
          headers: data.headers || {},
          responseTime,
          size: JSON.stringify(data.response).length
        });
      }
    } catch (error: any) {
      setTestResult({
        success: false,
        error: error.message || 'Test failed',
        responseTime: Date.now() - startTime
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addQueryParam = () => {
    setQueryParams([...queryParams, { key: '', value: '' }]);
  };

  const updateQueryParam = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...queryParams];
    updated[index][field] = value;
    setQueryParams(updated);
    
    // Update testParams
    const params: Record<string, string> = {};
    updated.forEach(param => {
      if (param.key) {
        params[param.key] = param.value;
      }
    });
    setTestParams(params);
  };

  const removeQueryParam = (index: number) => {
    const updated = queryParams.filter((_, i) => i !== index);
    setQueryParams(updated);
    
    // Update testParams
    const params: Record<string, string> = {};
    updated.forEach(param => {
      if (param.key) {
        params[param.key] = param.value;
      }
    });
    setTestParams(params);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getStatusIntent = (status?: number) => {
    if (!status) return Intent.NONE;
    if (status >= 200 && status < 300) return Intent.SUCCESS;
    if (status >= 400 && status < 500) return Intent.WARNING;
    if (status >= 500) return Intent.DANGER;
    return Intent.NONE;
  };

  return (
    <div className="testing-step">
      <Callout intent={Intent.PRIMARY} icon="info-sign">
        Test your API endpoint with different parameters and see the response in real-time.
      </Callout>

      <div className="test-container">
        <Card className="test-config">
          <h4>Test Configuration</h4>
          
          <FormGroup label="Endpoint URL">
            <InputGroup
              value={getEndpointUrl()}
              readOnly
              rightElement={
                <Button 
                  minimal 
                  icon="duplicate"
                  title="Copy to clipboard"
                  onClick={() => {
                    navigator.clipboard.writeText(getEndpointUrl());
                    // Optional: show a toast notification
                    // AppToaster.show({ message: "URL copied!", intent: "success" });
                  }}
                />
              }
            />
          </FormGroup>

          <FormGroup label="HTTP Method">
            <HTMLSelect
              value={testMethod}
              onChange={(e) => setTestMethod(e.target.value)}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
            </HTMLSelect>
          </FormGroup>

          <FormGroup label="Query Parameters">
            <div className="query-params">
              {queryParams.map((param, index) => (
                <div key={index} className="param-row">
                  <InputGroup
                    placeholder="Key"
                    value={param.key}
                    onChange={(e) => updateQueryParam(index, 'key', e.target.value)}
                  />
                  <InputGroup
                    placeholder="Value"
                    value={param.value}
                    onChange={(e) => updateQueryParam(index, 'value', e.target.value)}
                  />
                  <Button
                    minimal
                    icon="cross"
                    intent={Intent.DANGER}
                    onClick={() => removeQueryParam(index)}
                  />
                </div>
              ))}
              <Button
                minimal
                icon="add"
                text="Add Parameter"
                onClick={addQueryParam}
              />
            </div>
          </FormGroup>

          {testMethod !== 'GET' && testMethod !== 'DELETE' && (
            <FormGroup label="Request Body (JSON)">
              <TextArea
                value={testBody}
                onChange={(e) => setTestBody(e.target.value)}
                placeholder='{"key": "value"}'
                rows={5}
                style={{ fontFamily: 'monospace', width: '100%' }}
              />
            </FormGroup>
          )}

          <FormGroup label="Headers (Optional)">
            <TextArea
              value={JSON.stringify(testHeaders, null, 2)}
              onChange={(e) => {
                try {
                  setTestHeaders(JSON.parse(e.target.value));
                } catch {}
              }}
              placeholder='{"Authorization": "Bearer token"}'
              rows={3}
              style={{ fontFamily: 'monospace', width: '100%' }}
            />
          </FormGroup>

          <Button
            intent={Intent.PRIMARY}
            icon="play"
            text="Run Test"
            onClick={runTest}
            loading={isLoading}
            fill
          />
        </Card>

        <Card className="test-results">
          <h4>Test Results</h4>
          
          {isLoading && (
            <div className="loading-state">
              <Spinner />
              <p>Running test...</p>
            </div>
          )}

          {!isLoading && !testResult && (
            <NonIdealState
              icon="chart"
              title="No test results"
              description="Run a test to see the API response"
            />
          )}

          {testResult && !isLoading && (
            <>
              <div className="result-header">
                <div className="result-status">
                  <Tag 
                    large 
                    intent={testResult.success ? Intent.SUCCESS : Intent.DANGER}
                  >
                    {testResult.success ? 'SUCCESS' : 'FAILED'}
                  </Tag>
                  {testResult.statusCode && (
                    <Tag large intent={getStatusIntent(testResult.statusCode)}>
                      {testResult.statusCode}
                    </Tag>
                  )}
                </div>
                <div className="result-metrics">
                  <div className="metric">
                    <Icon icon="time" />
                    <span>{testResult.responseTime}ms</span>
                  </div>
                  {testResult.size && (
                    <div className="metric">
                      <Icon icon="document" />
                      <span>{formatBytes(testResult.size)}</span>
                    </div>
                  )}
                </div>
              </div>

              <Tabs
                selectedTabId={selectedTab}
                onChange={(newTab) => setSelectedTab(newTab as string)}
              >
                <Tab
                  id="response"
                  title="Response"
                  panel={
                    <div className="response-panel">
                      {testResult.success ? (
                        <div className="response-content">
                          {typeof testResult.data === 'object' ? (
                            <JSONTree 
                              data={testResult.data}
                              theme={{
                                scheme: 'monokai',
                                base00: '#272822',
                                base01: '#383830',
                                base02: '#49483e',
                                base03: '#75715e',
                                base04: '#a59f85',
                                base05: '#f8f8f2',
                                base06: '#f5f4f1',
                                base07: '#f9f8f5',
                                base08: '#f92672',
                                base09: '#fd971f',
                                base0A: '#f4bf75',
                                base0B: '#a6e22e',
                                base0C: '#a1efe4',
                                base0D: '#66d9ef',
                                base0E: '#ae81ff',
                                base0F: '#cc6633'
                              }}
                              invertTheme={false}
                              hideRoot
                            />
                          ) : (
                            <pre>{testResult.data}</pre>
                          )}
                        </div>
                      ) : (
                        <Callout intent={Intent.DANGER}>
                          {testResult.error}
                        </Callout>
                      )}
                    </div>
                  }
                />
                
                <Tab
                  id="raw"
                  title="Raw"
                  panel={
                    <div className="raw-panel">
                      <pre className="raw-response">
                        {JSON.stringify(testResult.data, null, 2)}
                      </pre>
                    </div>
                  }
                />
                
                <Tab
                  id="headers"
                  title="Headers"
                  panel={
                    <div className="headers-panel">
                      <table className="bp5-html-table bp5-html-table-striped">
                        <thead>
                          <tr>
                            <th>Header</th>
                            <th>Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(testResult.headers || {}).map(([key, value]) => (
                            <tr key={key}>
                              <td><code>{key}</code></td>
                              <td>{value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  }
                />
                
                <Tab
                  id="curl"
                  title="cURL"
                  panel={
                    <div className="curl-panel">
                      <pre className="curl-command">
                        {generateCurlCommand(config, testMethod, testParams, testHeaders, testBody)}
                      </pre>
                      <Button
                        icon="duplicate"
                        text="Copy"
                        onClick={() => {
                          navigator.clipboard.writeText(
                            generateCurlCommand(config, testMethod, testParams, testHeaders, testBody)
                          );
                        }}
                      />
                    </div>
                  }
                />
              </Tabs>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

function generateCurlCommand(
  config: APIEndpointConfig,
  method: string,
  params: Record<string, any>,
  headers: Record<string, string>,
  body: string
): string {
  let url = `https://your-api.com/api/${config.slug || 'endpoint'}`;
  
  if (Object.keys(params).length > 0) {
    const queryString = new URLSearchParams(params).toString();
    url += `?${queryString}`;
  }
  
  let cmd = `curl -X ${method} "${url}"`;
  
  Object.entries(headers).forEach(([key, value]) => {
    cmd += ` \\\n  -H "${key}: ${value}"`;
  });
  
  if (body && method !== 'GET' && method !== 'DELETE') {
    cmd += ` \\\n  -d '${body}'`;
  }
  
  return cmd;
}

export default TestingStep;