import { MappingTransformation } from '../../../types/jsonMapping.types';

export const TRANSFORMATION_TYPES = {
  // Text transformations
  uppercase: { name: 'Uppercase', category: 'text' },
  lowercase: { name: 'Lowercase', category: 'text' },
  capitalize: { name: 'Capitalize', category: 'text' },
  trim: { name: 'Trim', category: 'text' },
  substring: { name: 'Substring', category: 'text' },
  replace: { name: 'Replace', category: 'text' },
  concatenate: { name: 'Concatenate', category: 'text' },
  split: { name: 'Split', category: 'text' },
  
  // Number transformations
  number_format: { name: 'Format Number', category: 'number' },
  calculate: { name: 'Calculate', category: 'number' },
  round: { name: 'Round', category: 'number' },
  ceil: { name: 'Ceiling', category: 'number' },
  floor: { name: 'Floor', category: 'number' },
  
  // Date transformations
  date_format: { name: 'Format Date', category: 'date' },
  date_add: { name: 'Add Time', category: 'date' },
  date_diff: { name: 'Date Difference', category: 'date' },
  
  // Advanced transformations
  parse_json: { name: 'Parse JSON', category: 'advanced' },
  stringify: { name: 'Stringify', category: 'advanced' },
  lookup: { name: 'Lookup Table', category: 'advanced' },
  custom: { name: 'Custom JavaScript', category: 'advanced' }
};

export function applyTransformation(
  value: any,
  transformation: MappingTransformation
): any {
  const { type, config } = transformation;
  let parts = [value];

  try {
    switch (type) {
      // Text transformations
      case 'uppercase':
        return String(value).toUpperCase();
      
      case 'lowercase':
        return String(value).toLowerCase();
      
      case 'capitalize':
        return String(value)
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
      
      case 'trim':
        return String(value).trim();
      
      case 'substring':
        const start = config.start || 0;
        const length = config.length;
        return length 
          ? String(value).substring(start, start + length)
          : String(value).substring(start);
      
      case 'replace':
        const find = config.find || '';
        const replaceWith = config.replace || '';
        if (config.regex) {
          const regex = new RegExp(find, config.flags || 'g');
          return String(value).replace(regex, replaceWith);
        } else {
          return String(value).split(find).join(replaceWith);
        }
      
      case 'concatenate':
        // This would need access to other field values
        // For now, just concatenate with config values
        const separator = config.separator || '';
        if (config.prefix) parts.unshift(config.prefix);
        if (config.suffix) parts.push(config.suffix);
        return parts.join(separator);
      
      case 'split':
        const delimiter = config.delimiter || ',';
        parts = String(value).split(delimiter);
        const index = config.index || 0;
        return parts[index] || '';
      
      // Number transformations
      case 'number_format':
        const num = parseFloat(value);
        if (isNaN(num)) return value;
        
        let formatted = num.toFixed(config.decimals || 2);
        
        if (config.thousandSeparator) {
          parts = formatted.split('.');
          parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
          formatted = parts.join('.');
        }
        
        if (config.prefix) formatted = config.prefix + formatted;
        if (config.suffix) formatted = formatted + config.suffix;
        
        return formatted;
      
      case 'calculate':
        const number = parseFloat(value);
        if (isNaN(number)) return value;
        
        const operand = config.value || 0;
        switch (config.operation) {
          case 'add': return number + operand;
          case 'subtract': return number - operand;
          case 'multiply': return number * operand;
          case 'divide': return operand !== 0 ? number / operand : 0;
          case 'modulo': return number % operand;
          case 'power': return Math.pow(number, operand);
          default: return number;
        }
      
      case 'round':
        return Math.round(parseFloat(value));
      
      case 'ceil':
        return Math.ceil(parseFloat(value));
      
      case 'floor':
        return Math.floor(parseFloat(value));
      
      // Date transformations
      case 'date_format':
        return formatDate(value, config.inputFormat, config.outputFormat);
      
      case 'date_add':
        const date = new Date(value);
        const amount = config.amount || 0;
        const unit = config.unit || 'days';
        
        switch (unit) {
          case 'days':
            date.setDate(date.getDate() + amount);
            break;
          case 'months':
            date.setMonth(date.getMonth() + amount);
            break;
          case 'years':
            date.setFullYear(date.getFullYear() + amount);
            break;
          case 'hours':
            date.setHours(date.getHours() + amount);
            break;
          case 'minutes':
            date.setMinutes(date.getMinutes() + amount);
            break;
        }
        
        return date.toISOString();
      
      // Advanced transformations
      case 'parse_json':
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      
      case 'stringify':
        return JSON.stringify(value, null, config.indent || 0);
      
      case 'lookup':
        try {
          const lookupTable = typeof config.lookupTable === 'string' 
            ? JSON.parse(config.lookupTable)
            : config.lookupTable;
          return lookupTable[value] || config.defaultValue || value;
        } catch {
          return config.defaultValue || value;
        }
      
      case 'custom':
        // Execute custom JavaScript expression
        // In production, this should be sandboxed
        try {
          const func = new Function('value', `return ${config.expression}`);
          return func(value);
        } catch (error) {
          console.error('Custom transformation error:', error);
          return value;
        }
      
      default:
        return value;
    }
  } catch (error) {
    console.error(`Transformation error (${type}):`, error);
    return value;
  }
}

// Helper function for date formatting
function formatDate(
  value: string | Date, 
  inputFormat?: string, 
  outputFormat?: string
): string {
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return String(value);
    
    // Simple date formatting (you might want to use a library like date-fns)
    const formats: Record<string, (d: Date) => string> = {
      'YYYY-MM-DD': (d) => d.toISOString().split('T')[0],
      'MM/DD/YYYY': (d) => `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}/${d.getFullYear()}`,
      'DD/MM/YYYY': (d) => `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`,
      'MMM DD, YYYY': (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      'ISO': (d) => d.toISOString(),
      'LOCAL': (d) => d.toLocaleString(),
      'TIME': (d) => d.toTimeString(),
    };
    
    const formatter = formats[outputFormat || 'ISO'];
    return formatter ? formatter(date) : date.toString();
  } catch {
    return String(value);
  }
}

// Batch transformation processing
export function applyTransformations(
  value: any,
  transformations: MappingTransformation[]
): any {
  return transformations.reduce((result, transform) => {
    return applyTransformation(result, transform);
  }, value);
}

// Validation for transformation configurations
export function validateTransformConfig(
  type: string,
  config: Record<string, any>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  switch (type) {
    case 'substring':
      if (config.start < 0) {
        errors.push('Start index must be non-negative');
      }
      if (config.length && config.length < 0) {
        errors.push('Length must be positive');
      }
      break;
    
    case 'replace':
      if (!config.find) {
        errors.push('Find pattern is required');
      }
      break;
    
    case 'calculate':
      if (config.operation === 'divide' && config.value === 0) {
        errors.push('Cannot divide by zero');
      }
      break;
    
    case 'lookup':
      try {
        if (config.lookupTable) {
          const table = typeof config.lookupTable === 'string' 
            ? JSON.parse(config.lookupTable)
            : config.lookupTable;
          if (typeof table !== 'object') {
            errors.push('Lookup table must be a valid object');
          }
        }
      } catch {
        errors.push('Invalid lookup table JSON');
      }
      break;
    
    case 'custom':
      if (!config.expression) {
        errors.push('Expression is required');
      } else {
        try {
          new Function('value', `return ${config.expression}`);
        } catch {
          errors.push('Invalid JavaScript expression');
        }
      }
      break;
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}