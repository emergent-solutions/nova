import { TransformationType } from '../types/api.types';

export interface TransformDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
}

// AI transformation is always available for any type
const AI_TRANSFORM: TransformDefinition = {
  id: 'ai-transform',
  name: 'AI Transform',
  description: 'Use Claude AI to intelligently transform data',
  icon: 'predictive-analysis',
  category: 'advanced'
};

export const TRANSFORMATIONS: Record<string, Record<string, TransformDefinition[]>> = {
  string: {
    string: [
      { id: 'direct', name: 'Direct Copy', description: 'Copy value as-is', icon: 'arrow-right', category: 'basic' },
      { id: 'uppercase', name: 'Uppercase', description: 'Convert to uppercase', icon: 'font', category: 'text' },
      { id: 'lowercase', name: 'Lowercase', description: 'Convert to lowercase', icon: 'font', category: 'text' },
      { id: 'capitalize', name: 'Capitalize', description: 'Capitalize first letter', icon: 'font', category: 'text' },
      { id: 'trim', name: 'Trim', description: 'Remove whitespace', icon: 'clean', category: 'text' },
      { id: 'substring', name: 'Substring', description: 'Extract part of text', icon: 'cut', category: 'text' },
      { id: 'replace', name: 'Find & Replace', description: 'Replace text', icon: 'search-text', category: 'text' },
      { id: 'regex-extract', name: 'Regex Extract', description: 'Extract using regex', icon: 'filter', category: 'advanced' },
      { id: 'string-format', name: 'Format Template', description: 'Use template string', icon: 'code-block', category: 'advanced' }
    ],
    number: [
      { id: 'parse-number', name: 'Parse as Number', description: 'Convert to number', icon: 'numerical', category: 'conversion' },
      { id: 'length', name: 'String Length', description: 'Get text length', icon: 'horizontal-bar-chart', category: 'analysis' }
    ],
    boolean: [
      { id: 'is-empty', name: 'Is Empty?', description: 'Check if empty', icon: 'help', category: 'validation' },
      { id: 'contains', name: 'Contains?', description: 'Check for text', icon: 'search', category: 'validation' }
    ],
    array: [
      { id: 'split', name: 'Split Text', description: 'Split into array', icon: 'split-columns', category: 'conversion' }
    ]
  },
  number: {
    number: [
      { id: 'direct', name: 'Direct Copy', description: 'Copy value as-is', icon: 'arrow-right', category: 'basic' },
      { id: 'round', name: 'Round', description: 'Round to decimal places', icon: 'numerical', category: 'math' },
      { id: 'floor', name: 'Floor', description: 'Round down', icon: 'arrow-down', category: 'math' },
      { id: 'ceil', name: 'Ceiling', description: 'Round up', icon: 'arrow-up', category: 'math' },
      { id: 'abs', name: 'Absolute', description: 'Remove negative', icon: 'plus', category: 'math' },
      { id: 'math-operation', name: 'Math Operation', description: 'Apply calculation', icon: 'calculator', category: 'math' }
    ],
    string: [
      { id: 'to-string', name: 'To String', description: 'Convert to text', icon: 'font', category: 'conversion' },
      { id: 'format-number', name: 'Format Number', description: 'Format with locale', icon: 'numerical', category: 'formatting' },
      { id: 'currency', name: 'Currency', description: 'Format as currency', icon: 'dollar', category: 'formatting' }
    ],
    boolean: [
      { id: 'is-positive', name: 'Is Positive?', description: 'Check if > 0', icon: 'chevron-right', category: 'validation' },
      { id: 'is-zero', name: 'Is Zero?', description: 'Check if = 0', icon: 'equals', category: 'validation' }
    ]
  },
  date: {
    date: [
      { id: 'direct', name: 'Direct Copy', description: 'Copy value as-is', icon: 'arrow-right', category: 'basic' },
      { id: 'date-format', name: 'Format Date', description: 'Change date format', icon: 'calendar', category: 'formatting' }
    ],
    string: [
      { id: 'date-format', name: 'Format Date', description: 'Format as string', icon: 'calendar', category: 'formatting' },
      { id: 'relative-time', name: 'Relative Time', description: 'e.g., "2 days ago"', icon: 'time', category: 'formatting' }
    ],
    number: [
      { id: 'timestamp', name: 'Timestamp', description: 'Unix timestamp', icon: 'time', category: 'conversion' },
      { id: 'day-of-week', name: 'Day of Week', description: 'Get day number', icon: 'calendar', category: 'extraction' },
      { id: 'month', name: 'Month', description: 'Get month number', icon: 'calendar', category: 'extraction' },
      { id: 'year', name: 'Year', description: 'Get year', icon: 'calendar', category: 'extraction' }
    ]
  },
  boolean: {
    boolean: [
      { id: 'direct', name: 'Direct Copy', description: 'Copy value as-is', icon: 'arrow-right', category: 'basic' },
      { id: 'invert', name: 'Invert', description: 'Flip true/false', icon: 'swap-horizontal', category: 'logic' }
    ],
    string: [
      { id: 'to-string', name: 'To String', description: 'Convert to text', icon: 'font', category: 'conversion' },
      { id: 'yes-no', name: 'Yes/No', description: 'Convert to Yes/No', icon: 'font', category: 'formatting' },
      { id: 'custom-boolean', name: 'Custom Format', description: 'Custom true/false text', icon: 'font', category: 'formatting' }
    ],
    number: [
      { id: 'to-number', name: 'To Number', description: '1 or 0', icon: 'numerical', category: 'conversion' }
    ]
  },
  array: {
    string: [
      { id: 'join', name: 'Join', description: 'Join array items', icon: 'join', category: 'conversion' },
      { id: 'first', name: 'First Item', description: 'Get first item', icon: 'arrow-top-left', category: 'selection' },
      { id: 'last', name: 'Last Item', description: 'Get last item', icon: 'arrow-bottom-right', category: 'selection' }
    ],
    number: [
      { id: 'count', name: 'Count', description: 'Count items', icon: 'numerical', category: 'aggregation' },
      { id: 'sum', name: 'Sum', description: 'Sum all values', icon: 'plus', category: 'aggregation' },
      { id: 'average', name: 'Average', description: 'Calculate mean', icon: 'timeline-line-chart', category: 'aggregation' },
      { id: 'min', name: 'Minimum', description: 'Find minimum', icon: 'arrow-down', category: 'aggregation' },
      { id: 'max', name: 'Maximum', description: 'Find maximum', icon: 'arrow-up', category: 'aggregation' }
    ],
    array: [
      { id: 'direct', name: 'Direct Copy', description: 'Copy array as-is', icon: 'arrow-right', category: 'basic' },
      { id: 'filter', name: 'Filter', description: 'Filter items', icon: 'filter', category: 'manipulation' },
      { id: 'map', name: 'Map', description: 'Transform items', icon: 'exchange', category: 'manipulation' },
      { id: 'sort', name: 'Sort', description: 'Sort items', icon: 'sort', category: 'manipulation' },
      { id: 'unique', name: 'Unique', description: 'Remove duplicates', icon: 'group-objects', category: 'manipulation' }
    ]
  }
};

export function getAvailableTransformations(
  sourceType: string, 
  targetType: string
): TransformDefinition[] {
  // Get type-specific transformations
  const typeSpecific = TRANSFORMATIONS[sourceType]?.[targetType] || [];
  
  // Always include AI transformation as the first advanced option
  const allTransforms = [...typeSpecific];
  
  // Add AI transform if not already present
  if (!allTransforms.find(t => t.id === 'ai-transform')) {
    // Insert AI transform at the beginning of advanced transformations
    const advancedIndex = allTransforms.findIndex(t => t.category === 'advanced');
    if (advancedIndex >= 0) {
      allTransforms.splice(advancedIndex, 0, AI_TRANSFORM);
    } else {
      allTransforms.push(AI_TRANSFORM);
    }
  }
  
  return allTransforms;
}

export async function applyTransformation(
  value: any,
  transformation: TransformationType,
  options: Record<string, any> = {}
): Promise<any> {
  switch (transformation) {
    case 'direct':
      return value;
    
    // String transformations
    case 'uppercase':
      return String(value).toUpperCase();
    case 'lowercase':
      return String(value).toLowerCase();
    case 'capitalize':
      return String(value).charAt(0).toUpperCase() + String(value).slice(1).toLowerCase();
    case 'trim':
      return String(value).trim();
    case 'substring':
      return String(value).substring(options.start || 0, options.end);
    case 'replace':
      if (options.replaceAll) {
        return String(value).replaceAll(options.find || '', options.replace || '');
      }
      return String(value).replace(options.find || '', options.replace || '');
    
    // Number transformations
    case 'round':
      return Math.round(Number(value) * Math.pow(10, options.precision || 0)) / Math.pow(10, options.precision || 0);
    case 'floor':
      return Math.floor(Number(value));
    case 'ceil':
      return Math.ceil(Number(value));
    case 'abs':
      return Math.abs(Number(value));
    
    // Array transformations
    case 'join':
      return Array.isArray(value) ? value.join(options.delimiter || ',') : value;
    case 'split':
      return String(value).split(options.delimiter || ',');
    
    // Type conversions
    case 'parse-number':
      return Number(value);
    case 'to-string':
      return String(value);
    
    // Date transformations
    case 'timestamp':
      return new Date(value).getTime();
    
    // AI transformation
    case 'ai-transform':
      // This will be handled by a separate async function
      // that calls the Supabase edge function
      return applyAITransformation(value, options);
    
    default:
      return value;
  }
}

// Separate async function for AI transformations
async function applyAITransformation(
  value: any,
  options: Record<string, any>
): Promise<any> {
  // Check if we have cached result
  if (options.cacheResults && options._cache) {
    const cacheKey = `${JSON.stringify(value)}_${options.prompt}`;
    if (options._cache[cacheKey]) {
      return options._cache[cacheKey];
    }
  }
  
  try {
    // Import Supabase client
    const { supabase } = await import('../lib/supabase');
    
    // Build the full prompt
    let fullPrompt = options.prompt || 'Transform this data';
    fullPrompt = `Input: ${JSON.stringify(value)}\n\nTask: ${fullPrompt}`;
    
    // Add examples if provided
    if (options.examples && options.examples.length > 0) {
      fullPrompt += '\n\nExamples:\n';
      options.examples.forEach((ex: any, idx: number) => {
        fullPrompt += `Example ${idx + 1}:\nInput: ${JSON.stringify(ex.input)}\nOutput: ${JSON.stringify(ex.output)}\n\n`;
      });
    }
    
    // Add output format instruction
    if (options.outputFormat === 'json') {
      fullPrompt += '\n\nRespond with valid JSON only.';
    } else if (options.outputFormat === 'structured') {
      fullPrompt += '\n\nRespond with structured data matching the examples provided.';
    }
    
    // Get session for auth
    const { data: { session } } = await supabase.auth.getSession();
    
    // Call the edge function
    const response = await supabase.functions.invoke('claude', {
      body: {
        prompt: fullPrompt,
        systemPrompt: options.systemPrompt || 'You are a data transformation assistant. Transform the input according to the instructions provided.',
        outputFormat: options.outputFormat
      },
      headers: {
        Authorization: `Bearer ${session?.access_token}`
      }
    });
    
    if (response.error) {
      console.error('AI transformation error:', response.error);
      return value; // Return original value on error
    }
    
    // Parse the response based on output format
    let result = response.data.response;
    if (options.outputFormat === 'json' || options.outputFormat === 'structured') {
      try {
        // Try to extract JSON from the response
        const jsonMatch = result.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.warn('Could not parse AI response as JSON');
      }
    }
    
    // Cache the result if caching is enabled
    if (options.cacheResults) {
      if (!options._cache) options._cache = {};
      const cacheKey = `${JSON.stringify(value)}_${options.prompt}`;
      options._cache[cacheKey] = result;
    }
    
    return result;
  } catch (error) {
    console.error('AI transformation failed:', error);
    return value; // Return original value on error
  }
}