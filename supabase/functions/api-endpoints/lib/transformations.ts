// Transformation pipeline logic
import type { TransformConfig } from "../types.ts";
import { aiTransform } from "./ai-transform.ts";

export async function applyTransformationPipeline(
  data: any,
  transformConfig: TransformConfig,
  supabase: any
): Promise<any> {
  if (!transformConfig?.transformations || transformConfig.transformations.length === 0) {
    return data;
  }

  let result = data;
  
  for (const transformation of transformConfig.transformations) {
    try {
      console.log(`Applying transformation: ${transformation.type}`);
      result = await applyTransformation(result, transformation, supabase);
    } catch (error) {
      console.error(`Transformation ${transformation.type} failed:`, error);
      console.warn("Continuing with partial transformation result");
    }
  }
  
  return result;
}

async function applyTransformation(
  data: any,
  transformation: any,
  supabase: any
): Promise<any> {
  const { type, config = {} } = transformation;
  
  switch (type) {
    case "ai-transform":
      return await aiTransform(data, config, transformation, supabase);
      
    case "filter":
      if (!Array.isArray(data)) return data;
      return data.filter((item) => {
        const value = getValueFromPath(item, config.field);
        return evaluateCondition(value, config.operator, config.value);
      });
      
    case "sort":
      if (!Array.isArray(data)) return data;
      return [...data].sort((a, b) => {
        const aVal = getValueFromPath(a, config.field);
        const bVal = getValueFromPath(b, config.field);
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return config.order === "desc" ? -comparison : comparison;
      });
      
    case "map":
      if (!Array.isArray(data)) return data;
      return data.map((item) => {
        const result = {};
        for (const [targetField, sourceField] of Object.entries(config.mappings || {})) {
          setValueAtPath(result, targetField, getValueFromPath(item, sourceField));
        }
        return result;
      });
      
    case "limit":
      if (!Array.isArray(data)) return data;
      return data.slice(0, config.limit || 10);
      
    case "uppercase":
    case "lowercase":
    case "capitalize":
    case "trim":
      return applyStringTransformation(data, type, config);
      
    default:
      console.warn(`Unknown transformation type: ${type}`);
      return data;
  }
}

function getValueFromPath(obj: any, path: string): any {
  if (!obj || !path) return null;
  
  // Handle paths with array indices like "competitions[0].competitors[1].score"
  const segments = path.split('.');
  let current = obj;
  
  for (const segment of segments) {
    // Check if segment contains array index
    const arrayMatch = segment.match(/^(.+?)\[(\d+)\]$/);
    
    if (arrayMatch) {
      // Extract property name and index
      const [, propName, index] = arrayMatch;
      
      // Navigate to property
      if (current && typeof current === 'object' && propName in current) {
        current = current[propName];
      } else if (propName === '') {
        // Direct array access like [0]
        // current stays the same
      } else {
        return null;
      }
      
      // Apply array index
      const idx = parseInt(index, 10);
      if (Array.isArray(current) && !isNaN(idx) && idx < current.length) {
        current = current[idx];
      } else {
        return null;
      }
    } else {
      // Regular property access
      if (current && typeof current === 'object' && segment in current) {
        current = current[segment];
      } else {
        return null;
      }
    }
    
    if (current === null || current === undefined) {
      return null;
    }
  }
  
  return current;
}

export function setValueAtPath(obj: any, path: string, value: any): void {
  const parts = path.split(".");
  let current = obj;
  
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in current)) {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  
  current[parts[parts.length - 1]] = value;
}

function evaluateCondition(value: any, operator: string, compareValue: any): boolean {
  switch (operator) {
    case "equals":
      return value === compareValue;
    case "not_equals":
      return value !== compareValue;
    case "contains":
      return String(value).includes(String(compareValue));
    case "not_contains":
      return !String(value).includes(String(compareValue));
    case "greater_than":
      return Number(value) > Number(compareValue);
    case "less_than":
      return Number(value) < Number(compareValue);
    case "is_empty":
      return !value || value === "";
    case "is_not_empty":
      return !!value && value !== "";
    default:
      return true;
  }
}

function applyStringTransformation(data: any, type: string, config: any): any {
  const transform = (str: string) => {
    switch (type) {
      case "uppercase":
        return str.toUpperCase();
      case "lowercase":
        return str.toLowerCase();
      case "capitalize":
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
      case "trim":
        return str.trim();
      default:
        return str;
    }
  };

  if (typeof data === "string") {
    return transform(data);
  } else if (Array.isArray(data)) {
    return data.map(item => {
      if (typeof item === "string") {
        return transform(item);
      } else if (config.field && typeof item === "object") {
        const value = getValueFromPath(item, config.field);
        if (typeof value === "string") {
          const newItem = { ...item };
          setValueAtPath(newItem, config.field, transform(value));
          return newItem;
        }
      }
      return item;
    });
  }
  
  return data;
}