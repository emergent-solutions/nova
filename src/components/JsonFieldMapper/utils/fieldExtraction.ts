export interface ExtractedField {
  path: string;           // Full path like "competitions[0].competitors[0].team.displayName"
  name: string;           // Display name (last segment or custom)
  type: string;           // 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null'
  value?: any;            // Sample value if available
  isArray?: boolean;      // True if this field is an array
  arrayLength?: number;   // Length of array if applicable
  depth: number;          // Nesting depth (for UI indentation)
  isWildcard?: boolean;   // True if path contains [*]
  isFixedIndex?: boolean; // True if path contains [0], [1], etc.
  category?: string;      // 'metadata' | 'data' | 'array-iterator' | 'array-index'
}

export interface ExtractFieldsOptions {
  maxDepth?: number;           // Maximum nesting depth (default: 10)
  includeWildcards?: boolean;  // Include [*] paths for arrays (default: true)
  includeFixedIndices?: boolean; // Include [0], [1], etc. (default: true)
  maxArrayIndices?: number;    // Max number of array indices to show (default: 3)
  includeValues?: boolean;     // Include sample values (default: true)
  excludePatterns?: string[];  // Patterns to exclude (e.g., ['_*', '$*', '__typename'])
  includeEmptyArrays?: boolean; // Include empty arrays (default: false)
  includeNullValues?: boolean; // Include null/undefined fields (default: false)
  flattenArrays?: boolean;     // If true, show array items inline (default: false)
  maxTotalFields?: number;      // Stop after N total fields
  cacheResults?: boolean;       // Cache extraction results
  progressCallback?: (progress: number) => void; // Progress reporting
}

export type FieldValueResult<T = any> = {
  success: boolean;
  value?: T;
  error?: string;
  isWildcard?: boolean;
  count?: number;
};

export type FieldType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null' | 'undefined';
export type FieldCategory = 'metadata' | 'data' | 'array-iterator' | 'array-index' | 'info';

// Add a type guard
export function isExtractedField(obj: any): obj is ExtractedField {
  return obj && typeof obj.path === 'string' && typeof obj.name === 'string';
}

/**
 * Unified field extraction function that supports:
 * - Fixed array indices: [0], [1], [2]
 * - Wildcard notation: [*]
 * - Nested objects and arrays
 * - Metadata fields
 * - Various data types
 */
export function extractFields(
  data: any,
  parentPath: string = '',
  options: ExtractFieldsOptions = {},
  depth: number = 0
): ExtractedField[] {
  // Set default options
  const opts: Required<ExtractFieldsOptions> = {
    maxDepth: options.maxDepth ?? 10,
    includeWildcards: options.includeWildcards ?? true,
    includeFixedIndices: options.includeFixedIndices ?? true,
    maxArrayIndices: options.maxArrayIndices ?? 3,
    includeValues: options.includeValues ?? true,
    excludePatterns: options.excludePatterns ?? ['_id', '$*', '__typename'],
    includeEmptyArrays: options.includeEmptyArrays ?? false,
    includeNullValues: options.includeNullValues ?? false,
    flattenArrays: options.flattenArrays ?? false,
  };

  const fields: ExtractedField[] = [];

  // Check max depth
  if (depth >= opts.maxDepth) {
    return fields;
  }

  // Handle null/undefined
  if (data === null || data === undefined) {
    if (opts.includeNullValues && parentPath) {
      fields.push({
        path: parentPath,
        name: parentPath.split('.').pop() || parentPath,
        type: 'null',
        value: null,
        depth
      });
    }
    return fields;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    if (data.length === 0) {
      // Empty array
      if (opts.includeEmptyArrays && parentPath) {
        fields.push({
          path: parentPath,
          name: parentPath.split('.').pop() || parentPath,
          type: 'array',
          value: '[]',
          isArray: true,
          arrayLength: 0,
          depth
        });
      }
      return fields;
    }

    // Add the array field itself
    if (parentPath) {
      fields.push({
        path: parentPath,
        name: parentPath.split('.').pop() || parentPath,
        type: 'array',
        value: `[${data.length} items]`,
        isArray: true,
        arrayLength: data.length,
        depth
      });
    }

    // Add wildcard notation for array iteration
    if (opts.includeWildcards) {
      const wildcardPath = parentPath ? `${parentPath}[*]` : '[*]';
      fields.push({
        path: wildcardPath,
        name: '[*] All items',
        type: 'array-iterator',
        value: `Iterate all ${data.length} items`,
        isWildcard: true,
        depth: depth + 1,
        category: 'array-iterator'
      });

      // Extract fields from first item with wildcard path
      if (data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
        const wildcardFields = extractFields(
          data[0],
          wildcardPath,
          opts,
          depth + 2
        );
        fields.push(...wildcardFields);
      }
    }

    // Add fixed indices for specific items (useful for ESPN API)
    if (opts.includeFixedIndices) {
      const indicesToShow = Math.min(opts.maxArrayIndices, data.length);
      
      for (let i = 0; i < indicesToShow; i++) {
        const indexPath = parentPath ? `${parentPath}[${i}]` : `[${i}]`;
        const item = data[i];

        // Add the indexed item marker
        fields.push({
          path: indexPath,
          name: `[${i}] ${getItemLabel(item, i)}`,
          type: 'array-index',
          value: typeof item === 'object' ? '{...}' : item,
          isFixedIndex: true,
          depth: depth + 1,
          category: 'array-index'
        });

        // Extract fields from this specific item
        if (typeof item === 'object' && item !== null) {
          const itemFields = extractFields(
            item,
            indexPath,
            opts,
            depth + 2
          );
          fields.push(...itemFields);
        }
      }

      // Add indicator if there are more items
      if (data.length > opts.maxArrayIndices) {
        fields.push({
          path: `${parentPath}[...]`,
          name: `... and ${data.length - opts.maxArrayIndices} more items`,
          type: 'info',
          value: null,
          depth: depth + 1,
          category: 'info'
        });
      }
    }
  }
  // Handle objects
  else if (typeof data === 'object' && data !== null) {
    // Add the object field itself if it has a parent path
    if (parentPath) {
      fields.push({
        path: parentPath,
        name: parentPath.split('.').pop() || parentPath,
        type: 'object',
        value: '{...}',
        depth
      });
    }

    // Extract fields from object properties
    Object.keys(data).forEach(key => {
      // Check exclude patterns
      if (opts.excludePatterns.some(pattern => {
        if (pattern.includes('*')) {
          const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
          return regex.test(key);
        }
        return key === pattern;
      })) {
        return; // Skip excluded fields
      }

      const fieldPath = parentPath ? `${parentPath}.${key}` : key;
      const value = data[key];
      const valueType = getValueType(value);

      // Handle primitive values
      if (valueType === 'string' || valueType === 'number' || valueType === 'boolean' || valueType === 'null') {
        fields.push({
          path: fieldPath,
          name: key,
          type: valueType,
          value: opts.includeValues ? value : undefined,
          depth: depth + 1
        });
      }
      // Handle nested objects and arrays recursively
      else if (valueType === 'object' || valueType === 'array') {
        const nestedFields = extractFields(
          value,
          fieldPath,
          opts,
          depth + 1
        );
        fields.push(...nestedFields);
      }
    });
  }
  // Handle primitive values at root
  else if (parentPath) {
    fields.push({
      path: parentPath,
      name: parentPath.split('.').pop() || parentPath,
      type: getValueType(data),
      value: opts.includeValues ? data : undefined,
      depth
    });
  }

  return fields;
}

/**
 * Helper function to get a label for an array item
 */
function getItemLabel(item: any, index: number): string {
  if (typeof item !== 'object' || item === null) {
    return String(item).substring(0, 20);
  }

  // Try to find a good label field
  const labelFields = ['name', 'title', 'displayName', 'id', 'key', 'label'];
  for (const field of labelFields) {
    if (item[field]) {
      return String(item[field]).substring(0, 30);
    }
  }

  // For ESPN API specific case
  if (item.team?.displayName) {
    return item.team.displayName;
  }
  if (item.competitors) {
    return `Game ${index + 1}`;
  }

  return `Item ${index + 1}`;
}

/**
 * Get the type of a value
 */
function getValueType(value: any): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Simplified extraction for just field names (backward compatibility)
 */
export function extractFieldNames(data: any): string[] {
  const fields = extractFields(data, '', {
    includeWildcards: false,
    includeFixedIndices: false,
    includeValues: false,
    maxDepth: 1
  });
  
  return fields
    .filter(f => f.type !== 'object' && f.type !== 'array')
    .map(f => f.name);
}

/**
 * Extract fields optimized for UI display (with indentation info)
 */
export function extractFieldsForUI(
  data: any,
  options?: Partial<ExtractFieldsOptions>
): ExtractedField[] {
  return extractFields(data, '', {
    ...options,
    includeWildcards: true,
    includeFixedIndices: true,
    includeValues: true
  });
}

/**
 * Extract fields optimized for mapping (paths only)
 */
export function extractFieldsForMapping(
  data: any,
  sourceId?: string,
  sourceName?: string
): Array<{path: string, sourceId?: string, sourceName?: string}> {
  const fields = extractFields(data, '', {
    includeWildcards: true,
    includeFixedIndices: true,
    includeValues: false
  });
  
  return fields
    .filter(f => f.type !== 'info')
    .map(f => ({
      path: f.path,
      sourceId,
      sourceName
    }));
}

/**
 * Test the field extraction with ESPN MLB data
 */
export function testESPNExtraction() {
  const testData = {
    events: [
      {
        competitions: [
          {
            competitors: [
              { team: { displayName: "Yankees" }, score: "5" },
              { team: { displayName: "Red Sox" }, score: "3" }
            ],
            situation: { shortDownDistanceText: "Top 5th" }
          }
        ]
      }
    ]
  };

  const fields = extractFields(testData, '', {
    includeWildcards: true,
    includeFixedIndices: true,
    maxArrayIndices: 2
  });

  // Should include paths like:
  // - events[*]
  // - events[0]
  // - events[0].competitions[0].competitors[0].team.displayName
  // - events[0].competitions[0].competitors[1].team.displayName
  
  console.log('Extracted fields:', fields.map(f => f.path));
  return fields;
}

/**
 * Get value(s) from data using the extracted field path
 * Handles wildcards, fixed indices, and nested paths
 */
export function getFieldValue(data: any, path: string): any | any[] {
  const segments = path.split(/\.|\[|\]/).filter(Boolean);
  let current = data;
  let isWildcardResult = false;
  let results: any[] = [];

  for (const segment of segments) {
    if (segment === '*') {
      // Handle wildcard - collect from all array items
      if (!Array.isArray(current)) return undefined;
      isWildcardResult = true;
      results = [];
      
      for (const item of current) {
        // Continue path traversal for remaining segments
        const remainingPath = segments.slice(segments.indexOf(segment) + 1);
        if (remainingPath.length === 0) {
          results.push(item);
        } else {
          const subValue = getFieldValue(item, remainingPath.join('.'));
          if (Array.isArray(subValue)) {
            results.push(...subValue);
          } else if (subValue !== undefined) {
            results.push(subValue);
          }
        }
      }
      return results;
    } else if (/^\d+$/.test(segment)) {
      // Handle array index
      const index = parseInt(segment, 10);
      if (!Array.isArray(current) || index >= current.length) {
        return undefined;
      }
      current = current[index];
    } else {
      // Handle object property
      if (typeof current !== 'object' || current === null) {
        return undefined;
      }
      current = current[segment];
    }
    
    if (current === undefined) return undefined;
  }

  return isWildcardResult ? results : current;
}

/**
 * Validate that a field path exists in the data
 */
export function validateFieldPath(data: any, path: string): boolean {
  const value = getFieldValue(data, path);
  return value !== undefined;
}

/**
 * Get all concrete paths from a wildcard path
 * e.g., "items[*].name" with 3 items returns:
 * ["items[0].name", "items[1].name", "items[2].name"]
 */
export function expandWildcardPath(data: any, wildcardPath: string): string[] {
  const paths: string[] = [];
  const segments = wildcardPath.split(/\.|\[|\]/).filter(Boolean);
  
  function expand(currentData: any, currentSegments: string[], currentPath: string[]): void {
    if (currentSegments.length === 0) {
      paths.push(currentPath.join('.').replace(/\.\[/g, '['));
      return;
    }
    
    const [segment, ...remaining] = currentSegments;
    
    if (segment === '*') {
      if (Array.isArray(currentData)) {
        currentData.forEach((_, index) => {
          expand(
            currentData[index],
            remaining,
            [...currentPath, `[${index}]`]
          );
        });
      }
    } else if (/^\d+$/.test(segment)) {
      const index = parseInt(segment, 10);
      if (Array.isArray(currentData) && index < currentData.length) {
        expand(
          currentData[index],
          remaining,
          [...currentPath, `[${segment}]`]
        );
      }
    } else {
      if (currentData && typeof currentData === 'object' && segment in currentData) {
        expand(
          currentData[segment],
          remaining,
          [...currentPath, segment]
        );
      }
    }
  }
  
  expand(data, segments, []);
  return paths;
}

/**
 * Convert between path formats
 */
export function normalizePath(path: string): string {
  // Convert from "events.0.name" to "events[0].name"
  return path.replace(/\.(\d+)(\.|\[|$)/g, '[$1]$2');
}

export function denormalizePath(path: string): string {
  // Convert from "events[0].name" to "events.0.name"
  return path.replace(/\[(\d+)\]/g, '.$1');
}