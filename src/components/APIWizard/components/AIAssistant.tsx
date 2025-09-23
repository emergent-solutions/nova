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
        caching: config.caching
      },
      availableDataSources: dataSources.map(ds => ({
        id: ds.id,
        name: ds.name,
        type: ds.type,
        fields: ds.fields || []
      }))
    };

    // System prompt for API configuration
    const systemPrompt = `You are an API configuration assistant for APIWizard. 
Generate valid JSON configurations based on user requests.

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

2. For field mappings, use this EXACT format:
{
  "fieldMappings": [
    {
      "id": "map_1",
      "target_field": "homeTeam",
      "source_field": "events[0].competitions[0].competitors[0].team.displayName"
    },
    {
      "id": "map_2",
      "target_field": "awayTeam",
      "source_field": "events[0].competitions[0].competitors[1].team.displayName"
    }
  ]
}

3. Always use "dataSources" (plural) not "dataSource" (singular)
4. Always include "isNew": true for new data sources
5. Always include "api_config" for API type sources

Available configuration keys:
- dataSources (array) - for data sources
- fieldMappings (array) - for field mappings
- outputFormat (string) - json, xml, rss, csv, atom
- authentication (object) - auth configuration
- rateLimiting (object) - rate limit settings
- transformations (array) - data transformations

For ESPN MLB API specifically:
- URL: https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard
- Data path: "events"
- Home team path: events[0].competitions[0].competitors[0].team.displayName
- Away team path: events[0].competitions[0].competitors[1].team.displayName
- Home score: events[0].competitions[0].competitors[0].score
- Away score: events[0].competitions[0].competitors[1].score

Current context: ${JSON.stringify(context)}

Return ONLY valid JSON that can be merged into APIEndpointConfig.`;

    // User prompt with their request
    const userPrompt = `User request: "${prompt}"

Generate the configuration changes needed to fulfill this request.`;

    // Debug logging
    console.log('🤖 AI Assistant - Generating configuration');
    console.log('📝 User request:', prompt);
    console.log('🔧 Current config:', {
      name: config.name,
      outputFormat: config.outputFormat,
      dataSources: config.dataSources?.length || 0
    });
    console.log('📤 Calling claude with:', {
      promptLength: userPrompt.length,
      systemPromptLength: systemPrompt.length,
      outputFormat: 'json'
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

    console.log('✨ Final parsed configuration:', result);
    return result;
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

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
      const generatedConfig = await generateConfiguration(userMessage.content);
      
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