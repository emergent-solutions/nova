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

export function getValueFromPath(obj: any, path: string): any {
  if (!path) return obj;
  
  const parts = path.split(".");
  let current = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    
    // Handle array notation like items[0] or items[*]
    const arrayMatch = part.match(/^(.+)\[(\*|\d+)\]$/);
    if (arrayMatch) {
      const [, field, index] = arrayMatch;
      current = current[field];
      
      if (index === "*") {
        // Return array as-is for wildcard
        return current;
      } else {
        current = current[parseInt(index)];
      }
    } else {
      current = current[part];
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