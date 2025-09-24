export function findArraysAndObjects(
  data: any, 
  currentPath = '', 
  maxDepth = 5, 
  currentDepth = 0
): Array<{ path: string; type: 'array' | 'object'; count?: number }> {
  const results: Array<{ path: string; type: 'array' | 'object'; count?: number }> = [];
  
  if (currentDepth >= maxDepth) return results;
  
  if (Array.isArray(data)) {
    results.push({
      path: currentPath,
      type: 'array',
      count: data.length
    });
  } else if (data && typeof data === 'object') {
    results.push({
      path: currentPath,
      type: 'object'
    });
    
    // Recurse into object properties
    Object.keys(data).forEach(key => {
      const newPath = currentPath ? `${currentPath}.${key}` : key;
      const nested = findArraysAndObjects(
        data[key], 
        newPath, 
        maxDepth, 
        currentDepth + 1
      );
      results.push(...nested);
    });
  }
  
  return results;
}

export function extractFieldPaths(
  data: any,
  basePath = '',
  maxDepth = 3
): Array<{ path: string; name: string; type: string; value?: any }> {
  const fields: Array<{ path: string; name: string; type: string; value?: any }> = [];
  
  function traverse(obj: any, currentPath = '', depth = 0) {
    if (depth >= maxDepth || !obj) return;
    
    if (Array.isArray(obj) && obj.length > 0) {
      // Add the array field itself
      if (currentPath) {
        const lastDot = currentPath.lastIndexOf('.');
        const fieldName = lastDot >= 0 ? currentPath.substring(lastDot + 1) : currentPath;
        fields.push({
          path: currentPath,
          name: fieldName,
          type: 'array',
          value: undefined
        });
      }
      // For arrays, analyze the first item
      traverse(obj[0], `${currentPath}[*]`, depth);
    } else if (typeof obj === 'object' && obj !== null) {
      Object.keys(obj).forEach(key => {
        const fullPath = currentPath ? `${currentPath}.${key}` : key;
        const value = obj[key];
        const type = Array.isArray(value) ? 'array' : typeof value;
        
        fields.push({
          path: fullPath,
          name: key,
          type,
          value: type === 'object' || type === 'array' ? undefined : value
        });
        
        if (type === 'object' || type === 'array') {
          traverse(value, fullPath, depth + 1);
        }
      });
    }
  }
  
  // Start from the base path if provided
  if (basePath) {
    const pathParts = basePath.split('.');
    let current = data;
    for (const part of pathParts) {
      current = current?.[part];
    }
    traverse(current);
  } else {
    traverse(data);
  }
  
  return fields;
}

export function getValueFromPath(data: any, path: string): any {
  if (!path) return data;
  
  // Split the path into segments, handling both dot notation and array notation
  // e.g., "competitions[0].competitors[1].team.displayName"
  // becomes ["competitions", "0", "competitors", "1", "team", "displayName"]
  const segments = path.split(/[\.\[\]]+/).filter(Boolean);
  
  let current = data;
  
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
        return undefined; // Trying to index into non-array
      }
    } 
    // Handle wildcard [*] - return first item for preview
    else if (segment === '*') {
      if (Array.isArray(current) && current.length > 0) {
        current = current[0]; // For preview, just use first item
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

export function setValueAtPath(data: any, path: string, value: any): any {
  if (!path) return value;
  
  const segments = path.split(/[\.\[\]]+/).filter(Boolean);
  const result = data ? JSON.parse(JSON.stringify(data)) : {}; // Deep clone or create new object
  
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
        // Check if next segment is numeric (indicates next level should be array)
        current[index] = /^\d+$/.test(nextSegment) ? [] : {};
      }
      
      current = current[index];
    } else {
      // Regular property access
      if (!current[segment]) {
        // Check if next segment is numeric (indicates next level should be array)
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
      current[index] = value;
    }
  } else {
    current[lastSegment] = value;
  }
  
  return result;
}
