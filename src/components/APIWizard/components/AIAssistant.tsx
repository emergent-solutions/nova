import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  Button,
  TextArea,
  Card,
  Tag,
  Intent,
  Spinner,
  Callout,
  Icon,
  FormGroup,
  Switch,
  Divider,
  Classes,
  Position,
  Toaster,
  NonIdealState,
  HTMLSelect
} from '@blueprintjs/core';
import { supabase } from '../../../lib/supabase';
import { APIEndpointConfig, Transformation, FieldMapping } from '../../../types/schema.types';
import './AIAssistant.css';

const toaster = Toaster.create({ position: Position.TOP });

interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  config: APIEndpointConfig;
  onApplyConfig: (updates: Partial<APIEndpointConfig>) => void;
  dataSources?: any[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  config?: Partial<APIEndpointConfig>;
  error?: boolean;
}

const EXAMPLE_PROMPTS = [
  { category: 'Basic', text: 'Create a JSON API endpoint that fetches user data' },
  { category: 'RSS', text: 'Build an RSS feed combining multiple news sources' },
  { category: 'Security', text: 'Add API key authentication with rate limiting' },
  { category: 'Transform', text: 'Add AI transformation to summarize descriptions' },
  { category: 'Format', text: 'Create a CSV export with custom field mappings' },
  { category: 'Relationship', text: 'Join users table with orders and embed results' }
];

/**
 * Detects if the user's prompt contains an output structure that requires wrapping
 * and extracts the wrapper key if present
 */
function detectOutputWrapper(prompt: string): {
  needsWrapper: boolean;
  wrapperKey: string | undefined;
  confidence: 'high' | 'medium' | 'low';
} {
  // Check for explicit JSON examples with wrapper keys
  const jsonPatterns = [
    // Match {"data": [...]} or {"data": {...}}
    /\{\s*["'](\w+)["']\s*:\s*[\[\{]/g,
    // Match { data: [...] } (without quotes)
    /\{\s*(\w+)\s*:\s*[\[\{]/g,
    // Match multi-line formatted JSON
    /\{\s*\n\s*["'](\w+)["']\s*:\s*[\[\{]/g,
  ];

  for (const pattern of jsonPatterns) {
    const matches = prompt.matchAll(pattern);
    for (const match of matches) {
      const key = match[1];
      // Common wrapper keys that indicate intentional wrapping
      const commonWrappers = ['data', 'results', 'items', 'records', 'response', 'payload', 'content', 'output'];
      
      if (commonWrappers.includes(key.toLowerCase())) {
        console.log(`🎯 High confidence wrapper detected: "${key}"`);
        return {
          needsWrapper: true,
          wrapperKey: key,
          confidence: 'high'
        };
      } else {
        // Less common key, but still likely a wrapper
        console.log(`🎯 Medium confidence wrapper detected: "${key}"`);
        return {
          needsWrapper: true,
          wrapperKey: key,
          confidence: 'medium'
        };
      }
    }
  }

  // Check for verbal indicators
  const verbalPatterns = [
    /wrap(?:ped)?\s+in\s+(?:a\s+)?["']?(\w+)["']?\s+(?:field|key|property)/i,
    /(?:root|top)\s+(?:element|key|field)\s+["']?(\w+)["']?/i,
    /output\s+(?:should\s+)?(?:be\s+)?(?:wrapped|contained)\s+in\s+["']?(\w+)["']?/i,
    /["']?(\w+)["']?\s+(?:field|key)\s+(?:containing|with)\s+(?:the\s+)?(?:array|data|results)/i,
  ];

  for (const pattern of verbalPatterns) {
    const match = prompt.match(pattern);
    if (match) {
      const key = match[1];
      console.log(`💬 Verbal wrapper indicator found: "${key}"`);
      return {
        needsWrapper: true,
        wrapperKey: key,
        confidence: 'medium'
      };
    }
  }

  // Check for general wrapper keywords without specific key
  const generalWrapperKeywords = [
    /wrap(?:ped)?\s+(?:the\s+)?(?:response|output|results?)/i,
    /(?:with|include)\s+(?:a\s+)?(?:root|wrapper)\s+(?:element|object)/i,
    /(?:container|wrapper)\s+(?:object|field)/i,
  ];

  for (const pattern of generalWrapperKeywords) {
    if (pattern.test(prompt)) {
      console.log(`💭 General wrapper keyword detected, defaulting to "data"`);
      return {
        needsWrapper: true,
        wrapperKey: 'data', // Default wrapper key
        confidence: 'low'
      };
    }
  }

  // Check for explicit flat array/object indicators
  const flatIndicators = [
    /^\s*\[/,  // Starts with array bracket
    /return\s+(?:a\s+)?(?:flat|plain|simple)\s+array/i,
    /(?:no|without)\s+(?:wrapper|container|root)/i,
    /direct(?:ly)?\s+(?:as\s+)?(?:an?\s+)?array/i,
  ];

  for (const pattern of flatIndicators) {
    if (pattern.test(prompt)) {
      console.log(`📋 Flat output structure detected - no wrapper needed`);
      return {
        needsWrapper: false,
        wrapperKey: undefined,
        confidence: 'high'
      };
    }
  }

  // Default: no wrapper detected
  return {
    needsWrapper: false,
    wrapperKey: undefined,
    confidence: 'low'
  };
}

/**
 * Enhances the configuration with proper output wrapper settings
 * This ensures consistency between all wrapper-related configurations
 */
function ensureWrapperConsistency(
  config: Partial<APIEndpointConfig>,
  wrapperKey?: string
): Partial<APIEndpointConfig> {
  // If field mappings exist and wrapper is needed
  if (config.fieldMappings && config.fieldMappings.length > 0) {
    const wrapperDetected = config.outputWrapper?.enabled || wrapperKey;
    
    if (wrapperDetected) {
      const finalWrapperKey = wrapperKey || config.outputWrapper?.wrapperKey || 'data';
      
      // Ensure outputWrapper is properly configured
      config.outputWrapper = {
        enabled: true,
        wrapperKey: finalWrapperKey,
        includeMetadata: config.outputWrapper?.includeMetadata || false,
        metadataFields: config.outputWrapper?.metadataFields || {
          timestamp: false,
          source: false,
          count: false,
          version: false
        }
      };

      // Ensure outputSchema reflects the wrapper configuration
      if (!config.outputSchema) {
        config.outputSchema = {};
      }
      if (!config.outputSchema.metadata) {
        config.outputSchema.metadata = {};
      }
      
      config.outputSchema.metadata.wrapResponse = true;
      config.outputSchema.metadata.rootElement = finalWrapperKey;
      config.outputSchema.metadata.includeMetadata = config.outputWrapper.includeMetadata;
      
      // Sync with jsonMappingConfig
      if (!config.outputSchema.metadata.jsonMappingConfig) {
        config.outputSchema.metadata.jsonMappingConfig = {};
      }
      config.outputSchema.metadata.jsonMappingConfig.outputWrapper = {
        ...config.outputWrapper
      };

      console.log(`✅ Wrapper consistency ensured with key: "${finalWrapperKey}"`);
    }
  }
  
  return config;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({
  isOpen,
  onClose,
  config,
  onApplyConfig,
  dataSources = []
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [autoApply, setAutoApply] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        id: '1',
        role: 'assistant',
        content: `I can help you configure your API endpoint. I understand:
• Data sources and field mappings
• Output formats (JSON, RSS, CSV, XML)
• Transformations and AI processing
• Authentication and rate limiting
• Relationships between data sources

What would you like to configure?`,
        timestamp: new Date()
      }]);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const generateConfiguration = async (prompt: string): Promise<Partial<APIEndpointConfig>> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No authenticated session');
  
    // Build context for Claude
    const context = {
      currentConfig: {
        name: config.name,
        slug: config.slug,
        outputFormat: config.outputFormat,
        authentication: config.authentication,
        rateLimiting: config.rateLimiting,
        caching: config.caching,
        fieldMappings: config.fieldMappings,
        outputWrapper: config.outputWrapper
      },
      availableDataSources: dataSources.map(ds => ({
        id: ds.id,
        name: ds.name,
        type: ds.type,
        fields: ds.fields || []
      }))
    };
  
    // IMPROVED System prompt with output wrapper detection
    const systemPrompt = `You are an API configuration assistant for APIWizard. 
  Generate valid JSON configurations based on user requests.
  
  CRITICAL OUTPUT WRAPPER DETECTION RULES:
  1. If the user provides an example output with a root object containing a key like "data", "results", "items", "records", or any custom key that wraps an array or object, YOU MUST configure outputWrapper.
  2. Look for patterns like:
     - {"data": [...]} or {"data": {...}} → Set outputWrapper with wrapperKey: "data"
     - {"results": [...]} → Set outputWrapper with wrapperKey: "results"
     - {"items": [...]} → Set outputWrapper with wrapperKey: "items"
     - {"{customKey}": [...]} → Set outputWrapper with wrapperKey: "{customKey}"
  3. When outputWrapper is needed, ALWAYS include BOTH:
     - Root level "outputWrapper" configuration
     - Nested outputWrapper in fieldMappings' jsonMappingConfig
  
  IMPORTANT: Follow these EXACT schemas:
  
  1. For creating a new data source from a URL, you MUST use this format:
  {
    "dataSources": [
      {
        "id": "unique_id_here",
        "name": "Source Name",
        "type": "api",
        "isNew": true,
        "api_config": {
          "url": "https://example.com/api",
          "method": "GET",
          "headers": {},
          "data_path": "path.to.data"
        }
      }
    ]
  }
  
  2. For field mappings WITH OUTPUT WRAPPER (when user shows wrapped output):
  {
    "fieldMappings": [
      {
        "id": "map_1",
        "targetPath": "field1",
        "sourcePath": "source.path.to.field1",
        "sourceId": "source_id"
      }
    ],
    "outputWrapper": {
      "enabled": true,
      "wrapperKey": "data",
      "includeMetadata": false,
      "metadataFields": {
        "timestamp": false,
        "source": false,
        "count": false,
        "version": false
      }
    },
    "outputSchema": {
      "metadata": {
        "wrapResponse": true,
        "rootElement": "data",
        "includeMetadata": false,
        "jsonMappingConfig": {
          "outputWrapper": {
            "enabled": true,
            "wrapperKey": "data",
            "includeMetadata": false,
            "metadataFields": {
              "timestamp": false,
              "source": false,
              "count": false,
              "version": false
            }
          }
        }
      }
    }
  }
  
  3. For field mappings WITHOUT wrapper (flat array or object output):
  {
    "fieldMappings": [
      {
        "id": "map_1",
        "targetPath": "field1",
        "sourcePath": "source.path.to.field1"
      }
    ],
    "outputWrapper": {
      "enabled": false
    }
  }
  
  WRAPPER DETECTION EXAMPLES:
  - User shows: {"data": [{"name": "John"}]} → USE wrapper with key "data"
  - User shows: {"results": [...]} → USE wrapper with key "results"
  - User shows: [{"name": "John"}] → NO wrapper needed
  - User shows: {"name": "John"} → NO wrapper needed
  - User says "wrap in data field" → USE wrapper with key "data"
  - User says "return as array" → NO wrapper needed
  
  Available configuration keys:
  - dataSources (array) - for data sources
  - fieldMappings (array) - for field mappings  
  - outputWrapper (object) - for wrapping output in a container
  - outputFormat (string) - json, xml, rss, csv, atom
  - authentication (object) - auth configuration
  - rateLimiting (object) - rate limit settings
  - transformations (array) - data transformations
  - outputSchema (object) - detailed output configuration
  
  ESPN MLB API specific mappings:
  - URL: https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard
  - Data path: "events"
  - Home team: competitions[0].competitors[0].team.displayName
  - Away team: competitions[0].competitors[1].team.displayName
  - Home score: competitions[0].competitors[0].score
  - Away score: competitions[0].competitors[1].score
  - Inning: competitions[0].status.type.shortDetail
  - Game state: competitions[0].status.type.state
  - Period (inning number): competitions[0].status.period
  
  IMPORTANT: Field paths must be valid JavaScript notation. Never use operators like + or - in paths.
  For ESPN MLB, the inning info is in status.type.shortDetail (e.g., "Top 5th", "Bot 9th", "Final")
  
  Current context: ${JSON.stringify(context)}
  
  ANALYZE THE USER'S REQUEST:
  1. Check if they show an example output with a wrapper key
  2. Look for keywords like "wrap", "container", "root element"
  3. Detect the wrapper key name from their example
  4. Set outputWrapper configuration accordingly
  
  Return ONLY valid JSON that can be merged into APIEndpointConfig.`;
  
    // Enhanced user prompt with wrapper detection hint
    const userPrompt = `User request: "${prompt}"
  
  IMPORTANT: 
  - If the user shows an example output like {"data": [...]}, configure outputWrapper with wrapperKey: "data"
  - If the user wants a flat array [...] or object {...}, set outputWrapper.enabled: false
  - Analyze their desired output structure carefully
  
  Generate the configuration changes needed to fulfill this request.`;
  
    // Debug logging
    console.log('🤖 AI Assistant - Generating configuration');
    console.log('📝 User request:', prompt);
    console.log('🔍 Checking for wrapper pattern in request...');
    
    // Quick pattern detection for logging
    const wrapperPatterns = [
      /\{\s*["'](\w+)["']\s*:\s*\[/,  // {"key": [
      /\{\s*["'](\w+)["']\s*:\s*\{/,  // {"key": {
      /"(\w+)":\s*\[.*\]/,            // "key": [...]
    ];
    
    let detectedWrapper = null;
    for (const pattern of wrapperPatterns) {
      const match = prompt.match(pattern);
      if (match) {
        detectedWrapper = match[1];
        console.log(`✅ Detected wrapper key: "${detectedWrapper}"`);
        break;
      }
    }
    
    if (!detectedWrapper && prompt.toLowerCase().includes('wrap')) {
      console.log('⚠️ User mentioned "wrap" but no explicit key detected');
    }
  
    console.log('🔧 Current config:', {
      name: config.name,
      outputFormat: config.outputFormat,
      dataSources: config.dataSources?.length || 0,
      hasOutputWrapper: !!config.outputWrapper?.enabled,
      currentWrapperKey: config.outputWrapper?.wrapperKey
    });
  
    // Call claude with the improved parameters
    const response = await supabase.functions.invoke('claude', {
      body: {
        prompt: userPrompt,
        systemPrompt: systemPrompt,
        outputFormat: 'json'
      },
      headers: {
        Authorization: `Bearer ${session?.access_token}`
      }
    });
  
    console.log('📥 Claude response received:', {
      error: response.error,
      hasData: !!response.data,
      dataType: typeof response.data?.response
    });
  
    if (response.error) {
      console.error('❌ Claude API error:', response.error);
      throw new Error(response.error.message || 'Failed to generate configuration');
    }
  
    // Parse response
    let result = response.data.response;
    console.log('🔍 Raw response (first 500 chars):', 
      typeof result === 'string' ? result.substring(0, 500) : result
    );
    
    if (typeof result === 'string') {
      // Try to extract JSON from the response
      try {
        // First try to find JSON in the response
        const jsonMatch = result.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (jsonMatch) {
          console.log('✅ Found JSON in response, parsing...');
          result = JSON.parse(jsonMatch[0]);
        } else {
          // If no JSON found, try parsing the whole thing
          console.log('🔄 No JSON pattern found, trying to parse entire response...');
          result = JSON.parse(result);
        }
      } catch (e) {
        console.error('⚠️ Failed to parse AI response as JSON:', e);
        console.log('📄 Full raw response:', result);
        
        // As a fallback, try to clean and parse
        console.log('🧹 Attempting to clean response...');
        result = result.replace(/^```(?:json)?\s*\n?/i, '');
        result = result.replace(/\n?```\s*$/i, '');
        result = result.trim();
        
        console.log('🔍 Cleaned response (first 500 chars):', result.substring(0, 500));
        
        try {
          result = JSON.parse(result);
          console.log('✅ Successfully parsed cleaned response');
        } catch (e2) {
          console.error('❌ Failed to parse cleaned response:', e2);
          throw new Error('Failed to parse AI response as valid JSON');
        }
      }
    }
  
    // Post-process to ensure outputWrapper consistency
    if (result.fieldMappings && result.fieldMappings.length > 0) {
      console.log('🔧 Post-processing field mappings configuration...');
      
      // Check if outputWrapper should be enabled based on the result
      if (result.outputWrapper?.enabled) {
        console.log(`✅ Output wrapper enabled with key: "${result.outputWrapper.wrapperKey}"`);
        
        // Ensure outputSchema is properly configured
        if (!result.outputSchema) {
          result.outputSchema = {};
        }
        if (!result.outputSchema.metadata) {
          result.outputSchema.metadata = {};
        }
        
        // Set consistent wrapper configuration
        result.outputSchema.metadata.wrapResponse = true;
        result.outputSchema.metadata.rootElement = result.outputWrapper.wrapperKey;
        result.outputSchema.metadata.includeMetadata = result.outputWrapper.includeMetadata || false;
        
        // Ensure jsonMappingConfig has the same wrapper settings
        if (!result.outputSchema.metadata.jsonMappingConfig) {
          result.outputSchema.metadata.jsonMappingConfig = {};
        }
        result.outputSchema.metadata.jsonMappingConfig.outputWrapper = {
          ...result.outputWrapper
        };
        
        console.log('✅ Output wrapper configuration synchronized');
      } else {
        console.log('ℹ️ No output wrapper needed for this configuration');
      }
    }
  
    console.log('✨ Final parsed configuration:', result);
    return result;
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    // Detect if wrapper is needed before sending to AI
    const wrapperDetection = detectOutputWrapper(input.trim());
    
    if (wrapperDetection.needsWrapper) {
      console.log(`🎁 Wrapper detection result:`, wrapperDetection);
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      let generatedConfig = await generateConfiguration(userMessage.content);
      
      // After getting AI response, ensure consistency
      if (generatedConfig) {
        generatedConfig = ensureWrapperConsistency(
          generatedConfig, 
          wrapperDetection.wrapperKey
        );
      }

      // Format the changes for display
      const changes = Object.entries(generatedConfig).map(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          return `• ${key}: configured`;
        }
        return `• ${key}: ${value}`;
      }).join('\n');

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I've generated the configuration:\n\n${changes}\n\n${
          autoApply ? 'Configuration has been applied.' : 'Click "Apply Configuration" to update your endpoint.'
        }`,
        timestamp: new Date(),
        config: generatedConfig
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (autoApply) {
        onApplyConfig(generatedConfig);
        toaster.show({
          message: 'Configuration applied successfully',
          intent: Intent.SUCCESS,
          icon: 'tick-circle'
        });
      }
    } catch (error: any) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I encountered an error: ${error.message}. Please try rephrasing your request.`,
        timestamp: new Date(),
        error: true
      };
      setMessages(prev => [...prev, errorMessage]);
      
      toaster.show({
        message: 'Failed to generate configuration',
        intent: Intent.DANGER,
        icon: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyConfig = (configUpdate: Partial<APIEndpointConfig>) => {
    onApplyConfig(configUpdate);
    
    const confirmMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'system',
      content: '✅ Configuration applied successfully',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, confirmMessage]);
    
    toaster.show({
      message: 'Configuration applied',
      intent: Intent.SUCCESS,
      icon: 'tick-circle'
    });
  };

  const handleExampleClick = (prompt: string) => {
    setInput(prompt);
  };

  const filteredPrompts = selectedCategory === 'All' 
    ? EXAMPLE_PROMPTS 
    : EXAMPLE_PROMPTS.filter(p => p.category === selectedCategory);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Icon icon="predictive-analysis" />
          <span>AI Configuration Assistant</span>
        </div>
      }
      style={{ width: '800px', maxWidth: '90vw' }}
      className="ai-assistant-dialog"
    >
      <div className={Classes.DIALOG_BODY}>
        {/* Settings Bar */}
        <Card style={{ marginBottom: 15, padding: '10px 15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <FormGroup inline style={{ marginBottom: 0 }}>
              <Switch
                label="Auto-apply configurations"
                checked={autoApply}
                onChange={(e) => setAutoApply(e.currentTarget.checked)}
              />
            </FormGroup>
            
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#5C7080' }}>Examples:</span>
              <HTMLSelect
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                options={['All', 'Basic', 'RSS', 'Security', 'Transform', 'Format', 'Relationship']}
                minimal
              />
            </div>
          </div>
        </Card>

        {/* Example Prompts */}
        <Card style={{ marginBottom: 15, padding: 15 }}>
          <h5 style={{ marginTop: 0, marginBottom: 10 }}>
            <Icon icon="lightbulb" /> Quick Start Prompts
          </h5>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {filteredPrompts.map((prompt, idx) => (
              <Tag
                key={idx}
                interactive
                intent={Intent.NONE}
                onClick={() => handleExampleClick(prompt.text)}
                style={{ cursor: 'pointer' }}
              >
                <Icon icon="chat" style={{ marginRight: 5 }} />
                {prompt.text}
              </Tag>
            ))}
          </div>
        </Card>

        {/* Chat Messages */}
        <div className="ai-chat-messages" style={{ 
          height: '300px', 
          overflowY: 'auto', 
          marginBottom: 15,
          border: '1px solid #E1E8ED',
          borderRadius: '3px',
          padding: '10px',
          backgroundColor: '#F8F9FA'
        }}>
          {messages.map(message => (
            <Card
              key={message.id}
              style={{
                marginBottom: 10,
                padding: 12,
                backgroundColor: message.role === 'user' ? '#E3F2FD' : 
                               message.role === 'system' ? '#E8F5E9' : 
                               message.error ? '#FFEBEE' : 'white',
                borderLeft: `3px solid ${
                  message.role === 'user' ? '#2196F3' : 
                  message.role === 'system' ? '#4CAF50' :
                  message.error ? '#F44336' : '#9C27B0'
                }`
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                <Icon 
                  icon={
                    message.role === 'user' ? 'user' : 
                    message.role === 'system' ? 'tick-circle' : 
                    'predictive-analysis'
                  }
                  style={{ marginRight: 8, opacity: 0.7 }}
                />
                <strong style={{ fontSize: '12px', textTransform: 'uppercase', opacity: 0.7 }}>
                  {message.role === 'user' ? 'You' : 
                   message.role === 'system' ? 'System' : 
                   'AI Assistant'}
                </strong>
                <span style={{ marginLeft: 'auto', fontSize: '11px', opacity: 0.5 }}>
                  {message.timestamp.toLocaleTimeString()}
                </span>
              </div>
              
              <div style={{ whiteSpace: 'pre-wrap', fontSize: '14px' }}>
                {message.content}
              </div>
              
              {message.config && !autoApply && (
                <Button
                  intent={Intent.PRIMARY}
                  icon="import"
                  text="Apply Configuration"
                  onClick={() => handleApplyConfig(message.config!)}
                  style={{ marginTop: 10 }}
                  small
                />
              )}
            </Card>
          ))}
          
          {isLoading && (
            <Card style={{ textAlign: 'center', padding: 20 }}>
              <Spinner size={20} />
              <p style={{ marginTop: 10, marginBottom: 0, opacity: 0.6 }}>
                Generating configuration...
              </p>
            </Card>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div>
          <TextArea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Describe what you want to configure..."
            growVertically={false}
            style={{ minHeight: 60, marginBottom: 10 }}
            disabled={isLoading}
            fill
          />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button
              text="Clear Chat"
              minimal
              onClick={() => setMessages([])}
              disabled={isLoading || messages.length === 0}
            />
            <Button
              text="Send"
              intent={Intent.PRIMARY}
              icon="send-message"
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
            />
          </div>
        </div>
      </div>
    </Dialog>
  );
};

export default AIAssistant;