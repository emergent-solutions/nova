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

export function applyStringTransformation(data: any, type: string, config: any): any {
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

export function getValueFromPath(obj: any, path: string): any {
  if (!obj || !path) return null;
  
  // Handle paths with array indices like "competitions[0].competitors[1].score"
  const segments = path.split(/[\.\[\]]+/).filter(Boolean);
  let current = obj;
  
  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }
    
    // Check if segment is a number (array index)
    if (/^\d+$/.test(segment)) {
      const index = parseInt(segment, 10);
      if (Array.isArray(current)) {
        current = current[index];
      } else {
        return undefined;
      }
    }
    // Handle wildcard [*] - return first item for preview
    else if (segment === '*') {
      if (Array.isArray(current) && current.length > 0) {
        current = current[0];
      } else {
        return undefined;
      }
    }
    // Regular property access
    else {
      if (typeof current === 'object' && current !== null) {
        current = current[segment];
      } else {
        return undefined;
      }
    }
  }
  
  return current;
}

export function setValueAtPath(obj: any, path: string, value: any): any {
  if (!path) return value;
  
  const segments = path.split(/[\.\[\]]+/).filter(Boolean);
  const result = obj ? JSON.parse(JSON.stringify(obj)) : {};
  
  let current = result;
  
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    const nextSegment = segments[i + 1];
    
    // Check if segment is a number (array index)
    if (/^\d+$/.test(segment)) {
      const index = parseInt(segment, 10);
      
      // Ensure current is an array
      if (!Array.isArray(current)) {
        console.warn(`Expected array at path segment ${segment}, got ${typeof current}`);
        return result;
      }
      
      // Ensure array has this index
      while (current.length <= index) {
        current.push(null);
      }
      
      // Create next level if needed
      if (current[index] === null || current[index] === undefined) {
        current[index] = /^\d+$/.test(nextSegment) ? [] : {};
      }
      
      current = current[index];
    } else {
      // Regular property access
      if (!current[segment]) {
        current[segment] = /^\d+$/.test(nextSegment) ? [] : {};
      }
      current = current[segment];
    }
  }
  
  // Set the final value
  const lastSegment = segments[segments.length - 1];
  if (/^\d+$/.test(lastSegment)) {
    const index = parseInt(lastSegment, 10);
    if (Array.isArray(current)) {
      while (current.length <= index) {
        current.push(null);
      }
      current[index] = value;
    }
  } else {
    current[lastSegment] = value;
  }
  
  return result;
}

// Also export the evaluateCondition function since it's used by other modules
export function evaluateCondition(value: any, operator: string, compareValue: any): boolean {
  switch (operator) {
    case "equals":
      return value === compareValue;
    case "not_equals":
      return value !== compareValue;
    case "contains":
      return String(value).includes(String(compareValue));
    case "starts_with":
      return String(value).startsWith(String(compareValue));
    case "ends_with":
      return String(value).endsWith(String(compareValue));
    case "greater_than":
      return Number(value) > Number(compareValue);
    case "less_than":
      return Number(value) < Number(compareValue);
    case "greater_than_or_equal":
      return Number(value) >= Number(compareValue);
    case "less_than_or_equal":
      return Number(value) <= Number(compareValue);
    case "in":
      return Array.isArray(compareValue) && compareValue.includes(value);
    case "not_in":
      return Array.isArray(compareValue) && !compareValue.includes(value);
    case "regex":
      try {
        const regex = new RegExp(compareValue);
        return regex.test(String(value));
      } catch {
        return false;
      }
    case "is_empty":
      return value === null || value === undefined || value === "" || 
             (Array.isArray(value) && value.length === 0);
    case "is_not_empty":
      return value !== null && value !== undefined && value !== "" &&
             (!Array.isArray(value) || value.length > 0);
    default:
      return false;
  }
}