import React, { useState, useEffect } from 'react';
import {
  FormGroup,
  TextArea,
  Button,
  Card,
  Tag,
  Icon,
  Spinner,
  Callout,
  Intent,
  Switch,
  InputGroup,
  HTMLSelect,
  Collapse
} from '@blueprintjs/core';
import { supabase } from '../../lib/supabase';

interface AITransformationOptionsProps {
  prompt: string;
  systemPrompt?: string;
  outputFormat?: 'text' | 'json' | 'structured';
  fieldContext?: string[];
  examples?: Array<{ input: any; output: any }>;
  cacheResults?: boolean;
  onChange: (options: Record<string, any>) => void;
}

const AITransformationOptions: React.FC<AITransformationOptionsProps> = ({
  prompt = '',
  systemPrompt = '',
  outputFormat = 'text',
  fieldContext = [],
  examples = [],
  cacheResults = true,
  onChange
}) => {
  const [localPrompt, setLocalPrompt] = useState(prompt);
  const [localSystemPrompt, setLocalSystemPrompt] = useState(systemPrompt);
  const [localOutputFormat, setLocalOutputFormat] = useState(outputFormat);
  const [localExamples, setLocalExamples] = useState(examples);
  const [localCacheResults, setLocalCacheResults] = useState(cacheResults);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [testError, setTestError] = useState<string>('');

  // Predefined prompt templates
  const promptTemplates = [
    {
      name: 'Extract Information',
      prompt: 'Extract the following information: {{fields}}',
      system: 'You are a data extraction assistant. Extract only the requested information from the input.'
    },
    {
      name: 'Summarize',
      prompt: 'Summarize this text in 2-3 sentences',
      system: 'You are a summarization assistant. Create concise, informative summaries.'
    },
    {
      name: 'Translate',
      prompt: 'Translate this text to {{language}}',
      system: 'You are a translation assistant. Translate accurately while preserving meaning and tone.'
    },
    {
      name: 'Format/Clean',
      prompt: 'Clean and format this data as {{format}}',
      system: 'You are a data formatting assistant. Clean, standardize, and format data consistently.'
    },
    {
      name: 'Categorize',
      prompt: 'Categorize this into one of: {{categories}}',
      system: 'You are a categorization assistant. Assign the most appropriate category based on the content.'
    },
    {
      name: 'Sentiment Analysis',
      prompt: 'Analyze the sentiment (positive/negative/neutral) and confidence score',
      system: 'You are a sentiment analysis assistant. Analyze emotional tone and provide confidence scores.'
    },
    {
      name: 'Entity Extraction',
      prompt: 'Extract all {{entity_type}} entities',
      system: 'You are an entity extraction assistant. Identify and extract specific types of entities from text.'
    },
    {
      name: 'Custom',
      prompt: '',
      system: ''
    }
  ];

  // Update parent when options change
  useEffect(() => {
    onChange({
      prompt: localPrompt,
      systemPrompt: localSystemPrompt,
      outputFormat: localOutputFormat,
      examples: localExamples,
      cacheResults: localCacheResults
    });
  }, [localPrompt, localSystemPrompt, localOutputFormat, localExamples, localCacheResults]);

  // Test the AI transformation
  const testTransformation = async () => {
    if (!testInput || !localPrompt) {
      setTestError('Please provide both test input and a prompt');
      return;
    }

    setTesting(true);
    setTestError('');
    setTestResult(null);

    try {
      // Build the full prompt with context
      let fullPrompt = localPrompt;
      
      // Add field context if available
      if (fieldContext && fieldContext.length > 0) {
        fullPrompt = fullPrompt.replace('{{fields}}', fieldContext.join(', '));
      }
      
      // Add the input value
      fullPrompt = `Input: ${testInput}\n\nTask: ${fullPrompt}`;
      
      // Add examples if provided
      if (localExamples.length > 0) {
        fullPrompt += '\n\nExamples:\n';
        localExamples.forEach((ex, idx) => {
          fullPrompt += `Example ${idx + 1}:\nInput: ${JSON.stringify(ex.input)}\nOutput: ${JSON.stringify(ex.output)}\n\n`;
        });
      }
      
      // Add output format instruction
      if (localOutputFormat === 'json') {
        fullPrompt += '\n\nRespond with valid JSON only.';
      } else if (localOutputFormat === 'structured') {
        fullPrompt += '\n\nRespond with structured data matching the examples provided.';
      }

      // Call the edge function
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('claude', {
        body: {
          prompt: fullPrompt,
          systemPrompt: localSystemPrompt || 'You are a data transformation assistant. Transform the input according to the instructions provided.',
          outputFormat: localOutputFormat
        },
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      });

      if (response.error) {
        throw response.error;
      }

      // Parse the response based on output format
      let result = response.data.response;
      if (localOutputFormat === 'json' || localOutputFormat === 'structured') {
        try {
          // Try to extract JSON from the response
          const jsonMatch = result.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
          if (jsonMatch) {
            result = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          console.warn('Could not parse as JSON, returning raw text');
        }
      }

      setTestResult(result);
    } catch (error: any) {
      console.error('Test transformation error:', error);
      setTestError(error.message || 'Failed to test transformation');
    } finally {
      setTesting(false);
    }
  };

  // Add an example
  const addExample = () => {
    setLocalExamples([...localExamples, { input: '', output: '' }]);
  };

  // Remove an example
  const removeExample = (index: number) => {
    setLocalExamples(localExamples.filter((_, i) => i !== index));
  };

  // Update an example
  const updateExample = (index: number, field: 'input' | 'output', value: string) => {
    const updated = [...localExamples];
    updated[index][field] = value;
    setLocalExamples(updated);
  };

  // Apply a template
  const applyTemplate = (template: any) => {
    setLocalPrompt(template.prompt);
    setLocalSystemPrompt(template.system);
  };

  return (
    <div className="ai-transformation-options">
      {/* Template Selection */}
      <FormGroup label="Template" helperText="Start with a predefined template or create custom">
        <HTMLSelect
          onChange={(e) => {
            const template = promptTemplates.find(t => t.name === e.target.value);
            if (template) applyTemplate(template);
          }}
          defaultValue="Custom"
        >
          {promptTemplates.map(t => (
            <option key={t.name} value={t.name}>{t.name}</option>
          ))}
        </HTMLSelect>
      </FormGroup>

      {/* Main Prompt */}
      <FormGroup 
        label="Transformation Prompt" 
        labelInfo="(required)"
        helperText="Describe how to transform the data. Use {{field_name}} for placeholders."
      >
        <TextArea
          value={localPrompt}
          onChange={(e) => setLocalPrompt(e.target.value)}
          placeholder="e.g., Extract the product name and price from this description"
          rows={3}
          growVertically
        />
      </FormGroup>

      {/* Output Format */}
      <FormGroup label="Output Format">
        <HTMLSelect
          value={localOutputFormat}
          onChange={(e) => setLocalOutputFormat(e.target.value as any)}
        >
          <option value="text">Plain Text</option>
          <option value="json">JSON Object</option>
          <option value="structured">Structured (Match Examples)</option>
        </HTMLSelect>
      </FormGroup>

      {/* Advanced Options */}
      <Button
        minimal
        icon={showAdvanced ? "chevron-up" : "chevron-down"}
        text="Advanced Options"
        onClick={() => setShowAdvanced(!showAdvanced)}
        style={{ marginBottom: 10 }}
      />

      <Collapse isOpen={showAdvanced}>
        <Card style={{ padding: 15, marginBottom: 15 }}>
          {/* System Prompt */}
          <FormGroup 
            label="System Prompt" 
            helperText="Optional: Override the default system instructions"
          >
            <TextArea
              value={localSystemPrompt}
              onChange={(e) => setLocalSystemPrompt(e.target.value)}
              placeholder="You are a helpful assistant that..."
              rows={2}
            />
          </FormGroup>

          {/* Examples */}
          <FormGroup label="Examples" helperText="Provide input/output examples for better results">
            {localExamples.map((example, idx) => (
              <Card key={idx} style={{ marginBottom: 10, padding: 10 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <InputGroup
                      placeholder="Example input..."
                      value={example.input}
                      onChange={(e) => updateExample(idx, 'input', e.target.value)}
                    />
                  </div>
                  <Icon icon="arrow-right" />
                  <div style={{ flex: 1 }}>
                    <InputGroup
                      placeholder="Expected output..."
                      value={example.output}
                      onChange={(e) => updateExample(idx, 'output', e.target.value)}
                    />
                  </div>
                  <Button
                    minimal
                    icon="trash"
                    intent={Intent.DANGER}
                    onClick={() => removeExample(idx)}
                  />
                </div>
              </Card>
            ))}
            <Button
              minimal
              icon="add"
              text="Add Example"
              onClick={addExample}
            />
          </FormGroup>

          {/* Cache Results */}
          <Switch
            label="Cache Results"
            checked={localCacheResults}
            onChange={(e) => setLocalCacheResults(e.target.checked)}
            alignIndicator="right"
          />
          <p style={{ fontSize: 12, color: '#5c7080', marginTop: 5 }}>
            Cache identical transformations to reduce API calls and costs
          </p>
        </Card>
      </Collapse>

      {/* Test Transformation */}
      <Card style={{ padding: 15 }}>
        <h4>Test Transformation</h4>
        <FormGroup label="Test Input">
          <TextArea
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            placeholder="Enter sample data to test the transformation..."
            rows={2}
          />
        </FormGroup>

        <Button
          icon="play"
          text="Test"
          intent={Intent.PRIMARY}
          onClick={testTransformation}
          loading={testing}
          disabled={!testInput || !localPrompt}
        />

        {testError && (
          <Callout intent={Intent.DANGER} style={{ marginTop: 10 }}>
            {testError}
          </Callout>
        )}

        {testResult && (
          <Card style={{ marginTop: 10, padding: 10, background: '#f5f8fa' }}>
            <strong>Result:</strong>
            <pre style={{ 
              marginTop: 5, 
              padding: 10, 
              background: 'white', 
              borderRadius: 3,
              overflow: 'auto',
              maxHeight: 200 
            }}>
              {typeof testResult === 'object' 
                ? JSON.stringify(testResult, null, 2)
                : testResult}
            </pre>
          </Card>
        )}
      </Card>

      {/* Usage Info */}
      <Callout intent={Intent.PRIMARY} icon="info-sign" style={{ marginTop: 15 }}>
        <strong>AI Transformation Usage:</strong>
        <ul style={{ marginTop: 5, marginBottom: 0 }}>
          <li>Each transformation calls Claude API (costs apply)</li>
          <li>Use caching to reduce repeated API calls</li>
          <li>Provide clear prompts and examples for best results</li>
          <li>Test thoroughly before applying to production data</li>
        </ul>
      </Callout>
    </div>
  );
};

export default AITransformationOptions;