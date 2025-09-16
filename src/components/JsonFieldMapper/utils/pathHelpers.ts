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
  
  const parts = path.split('.');
  let current = data;
  
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  
  return current;
}

export function setValueAtPath(data: any, path: string, value: any): any {
  const parts = path.split('.');
  const result = JSON.parse(JSON.stringify(data)); // Deep clone
  
  let current = result;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!current[part]) {
      current[part] = {};
    }
    current = current[part];
  }
  
  current[parts[parts.length - 1]] = value;
  return result;
}