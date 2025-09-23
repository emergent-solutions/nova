export interface PromptTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  systemPrompt: string;
  userPromptTemplate: string;
  expectedConfig: any;
  examples: Array<{
    input: string;
    output: any;
  }>;
}

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'rest-api-basic',
    name: 'Basic REST API',
    category: 'API',
    description: 'Create a standard RESTful JSON API',
    systemPrompt: 'Configure a REST API endpoint with standard conventions',
    userPromptTemplate: 'Create a REST API for {resource} with {operations}',
    expectedConfig: {
      output_format: 'json',
      authentication: { required: false, type: 'none' },
      caching: { enabled: true, ttl: 300 }
    },
    examples: [
      {
        input: 'Create a REST API for users with CRUD operations',
        output: {
          name: 'Users API',
          slug: 'users',
          output_format: 'json',
          authentication: { required: true, type: 'bearer' }
        }
      }
    ]
  },
  
  {
    id: 'rss-aggregator',
    name: 'RSS Feed Aggregator',
    category: 'Feed',
    description: 'Combine multiple RSS sources into a single feed',
    systemPrompt: 'Configure an RSS feed that aggregates multiple sources',
    userPromptTemplate: 'Create RSS feed combining {sources} sorted by {sort_field}',
    expectedConfig: {
      output_format: 'rss',
      outputSchema: {
        metadata: {
          mergeStrategy: 'combine',
          maxItemsPerSource: 10,
          sortBy: 'pubDate',
          sortOrder: 'desc'
        }
      }
    },
    examples: [
      {
        input: 'Combine tech news feeds sorted by date, max 50 items',
        output: {
          name: 'Tech News Aggregator',
          output_format: 'rss',
          outputSchema: {
            metadata: {
              channelTitle: 'Tech News Aggregator',
              maxTotalItems: 50,
              sortBy: 'pubDate'
            }
          }
        }
      }
    ]
  },

  {
    id: 'data-transformation',
    name: 'Data Transformation Pipeline',
    category: 'Transform',
    description: 'Apply AI and standard transformations to data',
    systemPrompt: 'Configure data transformations with AI and standard operations',
    userPromptTemplate: 'Transform {fields} by {transformation_description}',
    expectedConfig: {
      transformations: []
    },
    examples: [
      {
        input: 'Summarize descriptions to 50 words and format dates as ISO',
        output: {
          transformations: [
            {
              id: 'ai-summary',
              type: 'ai-transform',
              source_field: 'description',
              config: {
                prompt: 'Summarize this text to maximum 50 words',
                outputFormat: 'text'
              }
            },
            {
              id: 'date-iso',
              type: 'date-format',
              source_field: 'date',
              config: {
                format: 'ISO'
              }
            }
          ]
        }
      }
    ]
  },

  {
    id: 'secure-api',
    name: 'Secured API Endpoint',
    category: 'Security',
    description: 'API with authentication and rate limiting',
    systemPrompt: 'Configure a secure API with proper authentication and rate controls',
    userPromptTemplate: 'Secure API with {auth_type} and {rate_limit} requests/minute',
    expectedConfig: {
      authentication: { required: true },
      rate_limiting: { enabled: true },
      caching: { enabled: false }
    },
    examples: [
      {
        input: 'API with API key auth and 100 requests per minute limit',
        output: {
          authentication: {
            required: true,
            type: 'api-key',
            config: {
              header_name: 'X-API-Key'
            }
          },
          rate_limiting: {
            enabled: true,
            requests_per_minute: 100,
            per_user: true
          }
        }
      }
    ]
  },

  {
    id: 'csv-export',
    name: 'CSV Data Export',
    category: 'Export',
    description: 'Configure CSV export with custom formatting',
    systemPrompt: 'Configure a CSV export endpoint with proper formatting',
    userPromptTemplate: 'Export {data} as CSV with {options}',
    expectedConfig: {
      output_format: 'csv',
      outputSchema: {
        metadata: {
          delimiter: ',',
          include_headers: true
        }
      }
    },
    examples: [
      {
        input: 'Export orders as CSV with semicolon delimiter',
        output: {
          name: 'Orders Export',
          output_format: 'csv',
          outputSchema: {
            metadata: {
              delimiter: ';',
              include_headers: true,
              quote_char: '"'
            }
          }
        }
      }
    ]
  },

  {
    id: 'data-join',
    name: 'Data Relationship Join',
    category: 'Relationship',
    description: 'Join related data from multiple sources',
    systemPrompt: 'Configure data relationships and joins between sources',
    userPromptTemplate: 'Join {parent} with {child} on {key}',
    expectedConfig: {
      relationships: []
    },
    examples: [
      {
        input: 'Join users with their orders, embed orders as nested array',
        output: {
          relationships: [
            {
              id: 'user-orders',
              parent_source: 'users',
              parent_key: 'id',
              child_source: 'orders',
              foreign_key: 'user_id',
              type: 'one-to-many',
              embed_as: 'orders'
            }
          ]
        }
      }
    ]
  }
];

// Function to find best matching template
export function findBestTemplate(userPrompt: string): PromptTemplate | null {
  const promptLower = userPrompt.toLowerCase();
  
  // Score each template based on keyword matches
  const scores = PROMPT_TEMPLATES.map(template => {
    let score = 0;
    
    // Check category keywords
    if (promptLower.includes(template.category.toLowerCase())) {
      score += 10;
    }
    
    // Check name keywords
    const nameWords = template.name.toLowerCase().split(' ');
    nameWords.forEach(word => {
      if (promptLower.includes(word)) score += 5;
    });
    
    // Check description keywords
    const descWords = template.description.toLowerCase().split(' ');
    descWords.forEach(word => {
      if (promptLower.includes(word)) score += 2;
    });
    
    // Check for specific format mentions
    if (template.expectedConfig.output_format && 
        promptLower.includes(template.expectedConfig.output_format)) {
      score += 15;
    }
    
    return { template, score };
  });
  
  // Sort by score and return best match if score > threshold
  scores.sort((a, b) => b.score - a.score);
  return scores[0].score > 5 ? scores[0].template : null;
}

// Generate prompt from template
export function generatePromptFromTemplate(
  template: PromptTemplate,
  parameters: Record
): string {
  let prompt = template.userPromptTemplate;
  
  // Replace placeholders with actual values
  Object.entries(parameters).forEach(([key, value]) => {
    prompt = prompt.replace(`{${key}}`, value);
  });
  
  return prompt;
}

// Combine multiple templates
export function combineTemplates(
  templateIds: string[],
  userContext: string
): any {
  const templates = templateIds
    .map(id => PROMPT_TEMPLATES.find(t => t.id === id))
    .filter(Boolean) as PromptTemplate[];
  
  if (templates.length === 0) return {};
  
  // Merge expected configs
  const combined = templates.reduce((acc, template) => {
    return { ...acc, ...template.expectedConfig };
  }, {});
  
  // Merge arrays intelligently
  if (templates.some(t => t.expectedConfig.transformations)) {
    combined.transformations = templates
      .filter(t => t.expectedConfig.transformations)
      .flatMap(t => t.expectedConfig.transformations);
  }
  
  if (templates.some(t => t.expectedConfig.relationships)) {
    combined.relationships = templates
      .filter(t => t.expectedConfig.relationships)
      .flatMap(t => t.expectedConfig.relationships);
  }
  
  return combined;
}

export default {
  PROMPT_TEMPLATES,
  findBestTemplate,
  generatePromptFromTemplate,
  combineTemplates
};