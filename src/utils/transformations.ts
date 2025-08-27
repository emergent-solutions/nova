import { TransformationType } from '../types/api.types';

export interface TransformDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
}

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
      { id: 'contains', name: 'Contains?', description: 'Check if contains text', icon: 'search', category: 'validation' }
    ],
    date: [
      { id: 'parse-date', name: 'Parse as Date', description: 'Convert to date', icon: 'calendar', category: 'conversion' }
    ]
  },
  number: {
    string: [
      { id: 'to-string', name: 'To String', description: 'Convert to text', icon: 'font', category: 'conversion' },
      { id: 'format-number', name: 'Format Number', description: 'Format with separators', icon: 'dollar', category: 'formatting' },
      { id: 'to-currency', name: 'Currency', description: 'Format as currency', icon: 'bank-account', category: 'formatting' }
    ],
    number: [
      { id: 'direct', name: 'Direct Copy', description: 'Copy value as-is', icon: 'arrow-right', category: 'basic' },
      { id: 'round', name: 'Round', description: 'Round to decimals', icon: 'circle', category: 'math' },
      { id: 'floor', name: 'Floor', description: 'Round down', icon: 'arrow-down', category: 'math' },
      { id: 'ceil', name: 'Ceiling', description: 'Round up', icon: 'arrow-up', category: 'math' },
      { id: 'abs', name: 'Absolute', description: 'Remove sign', icon: 'timeline-bar-chart', category: 'math' },
      { id: 'math-operation', name: 'Math Operation', description: 'Apply calculation', icon: 'calculator', category: 'math' }
    ],
    boolean: [
      { id: 'greater-than', name: 'Greater Than', description: 'Compare greater', icon: 'chevron-right', category: 'comparison' },
      { id: 'less-than', name: 'Less Than', description: 'Compare less', icon: 'chevron-left', category: 'comparison' },
      { id: 'equals', name: 'Equals', description: 'Check equality', icon: 'equals', category: 'comparison' }
    ]
  },
  date: {
    string: [
      { id: 'date-format', name: 'Format Date', description: 'Custom date format', icon: 'calendar', category: 'formatting' },
      { id: 'relative-time', name: 'Relative Time', description: 'e.g., 2 hours ago', icon: 'time', category: 'formatting' }
    ],
    number: [
      { id: 'timestamp', name: 'Unix Timestamp', description: 'Convert to timestamp', icon: 'numerical', category: 'conversion' },
      { id: 'year', name: 'Extract Year', description: 'Get year', icon: 'calendar', category: 'extraction' },
      { id: 'month', name: 'Extract Month', description: 'Get month', icon: 'calendar', category: 'extraction' },
      { id: 'day', name: 'Extract Day', description: 'Get day', icon: 'calendar', category: 'extraction' }
    ]
  },
  array: {
    string: [
      { id: 'join', name: 'Join', description: 'Join to string', icon: 'merge-columns', category: 'conversion' },
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
  return TRANSFORMATIONS[sourceType]?.[targetType] || [];
}

export function applyTransformation(
  value: any,
  transformation: TransformationType,
  options: Record<string, any> = {}
): any {
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
    
    default:
      return value;
  }
}