// ===== lib/complex-mapping.ts (COMPLETE) =====
// Complex field mapping logic for JSON with proper transformation support
import { fetchDataFromSource } from "./data-fetcher.ts";
import { applyTransformationPipeline } from "./transformations.ts";
import { getValueFromPath, setValueAtPath } from "./transformations.ts";
import { deepCleanObject } from "./utils.ts";

export async function applyComplexMapping(
  endpoint: any,
  dataSources: any[],
  mappingConfig: any,
  supabase: any
): Promise<any> {
  console.log("Complex Mapping Config:", {
    hasFieldMappings: !!mappingConfig?.fieldMappings?.length,
    fieldMappingCount: mappingConfig?.fieldMappings?.length || 0,
    hasTransformations: !!endpoint.transform_config?.transformations?.length,
    transformationCount: endpoint.transform_config?.transformations?.length || 0
  });
  
  if (!mappingConfig?.fieldMappings?.length) {
    console.error("No field mappings configured");
    return { error: "No field mappings configured" };
  }
  
  const sources = mappingConfig.sourceSelection?.sources || [];
  const mergeMode = mappingConfig.sourceSelection?.mergeMode || "single";
  
  console.log(`Processing ${sources.length} sources in ${mergeMode} mode`);
  
  // Handle single source (most common case)
  if (sources.length === 1) {
    return await processSingleSource(
      endpoint,
      dataSources,
      mappingConfig,
      sources[0],
      supabase
    );
  }
  
  // Multi-source combined mode
  if (mergeMode === "combined" && sources.length > 1) {
    console.log("Using combined multi-source mode");
    let allItems: any[] = [];
    
    for (const sourceConfig of sources) {
      const dataSource = dataSources.find(ds => ds.id === sourceConfig.id);
      if (!dataSource) continue;
      
      console.log(`Fetching from source: ${dataSource.name}`);
      let sourceData = await fetchDataFromSource(dataSource, supabase);
      if (!sourceData) continue;
      
      // Apply transformations BEFORE navigation
      if (endpoint.transform_config?.transformations) {
        console.log(`Applying transformations to source data from ${dataSource.name}...`);
        sourceData = await applyTransformationPipeline(sourceData, endpoint.transform_config, supabase);
      }
      
      // Navigate to primary path
      let dataToProcess = sourceData;
      if (sourceConfig.primaryPath) {
        console.log(`Navigating to path: ${sourceConfig.primaryPath}`);
        dataToProcess = getValueFromPath(sourceData, sourceConfig.primaryPath);
      }
      
      // Add source tracking
      if (Array.isArray(dataToProcess)) {
        dataToProcess.forEach((item) => {
          allItems.push({
            ...item,
            _sourceInfo: {
              id: dataSource.id,
              name: dataSource.name,
              type: dataSource.type,
              category: dataSource.category
            }
          });
        });
      } else if (dataToProcess && typeof dataToProcess === "object") {
        allItems.push({
          ...dataToProcess,
          _sourceInfo: {
            id: dataSource.id,
            name: dataSource.name,
            type: dataSource.type,
            category: dataSource.category
          }
        });
      }
    }
    
    console.log(`Total items to map: ${allItems.length}`);
    
    // Apply field mappings
    const mappedData = allItems.map((item) => {
      const result: any = {};
      
      // Group mappings by target
      const mappingsByTarget: Record<string, any[]> = {};
      mappingConfig.fieldMappings.forEach((mapping: any) => {
        const targetPath = mapping.targetPath;
        if (!mappingsByTarget[targetPath]) {
          mappingsByTarget[targetPath] = [];
        }
        mappingsByTarget[targetPath].push(mapping);
      });
      
      // Apply mappings
      for (const [targetPath, mappings] of Object.entries(mappingsByTarget)) {
        const matchingMapping = mappings.find((m: any) => 
          m.sourceId === item._sourceInfo.id
        );
        
        if (matchingMapping) {
          let value;
          
          // Handle metadata fields
          if (matchingMapping.sourcePath.startsWith("_source.")) {
            const metaField = matchingMapping.sourcePath.substring(8);
            value = item._sourceInfo[metaField];
          } else {
            value = getValueFromPath(item, matchingMapping.sourcePath);
          }
          
          // Apply fallback
          if (value === undefined || value === null) {
            value = matchingMapping.fallbackValue;
          }
          
          setValueAtPath(result, targetPath, value);
        }
      }
      
      return result;
    });
    
    // Apply output wrapper
    const wrapperConfig = mappingConfig.outputWrapper;
    if (wrapperConfig?.includeMetadata) {
      const result: any = { metadata: {} };
      
      result.metadata.timestamp = new Date().toISOString();
      result.metadata.sources = sources.map((s: any) => ({
        id: s.id,
        name: s.name
      }));
      
      result[wrapperConfig.wrapperKey || "data"] = mappedData;
      return deepCleanObject(result);
    }
    
    return deepCleanObject(mappedData);
  }
  
  // Fallback for other modes
  return { error: "Unsupported merge mode" };
}

/**
 * Process a single source with transformations and mappings
 */
async function processSingleSource(
  endpoint: any,
  dataSources: any[],
  mappingConfig: any,
  sourceConfig: any,
  supabase: any
): Promise<any> {
  const dataSource = dataSources.find(ds => ds.id === sourceConfig.id);
  
  if (!dataSource) {
    console.error(`Data source not found: ${sourceConfig.id}`);
    return { error: "Data source not found" };
  }
  
  console.log(`Processing single source: ${dataSource.name}`);
  let sourceData = await fetchDataFromSource(dataSource, supabase);
  
  if (!sourceData) {
    console.error("Failed to fetch data from source");
    return { error: "Failed to fetch data from source" };
  }
  
  console.log("Raw source data type:", Array.isArray(sourceData) ? `array(${sourceData.length})` : typeof sourceData);
  
  // Navigate to primary path FIRST (before transformations)
  let dataToProcess = sourceData;
  const primaryPath = sourceConfig.primaryPath || mappingConfig.sourceSelection?.primaryPath;

  if (primaryPath) {
    console.log(`Navigating to primary path: ${primaryPath}`);
    dataToProcess = getValueFromPath(sourceData, primaryPath);
    console.log("Data after navigation:", Array.isArray(dataToProcess) ? `array(${dataToProcess.length})` : typeof dataToProcess);
    
    if (!dataToProcess) {
      console.error(`No data found at path: ${mappingConfig.sourceSelection.primaryPath}`);
      return { error: `No data found at path: ${mappingConfig.sourceSelection.primaryPath}` };
    }
  }
  
  // CRITICAL: Apply transformations AFTER navigation but BEFORE field mapping
  if (endpoint.transform_config?.transformations && endpoint.transform_config.transformations.length > 0) {
    console.log("Applying transformations to navigated data...");
    console.log("Transformation details:", endpoint.transform_config.transformations.map((t: any) => ({
      type: t.type,
      source_field: t.source_field,
      config: t.config?.prompt ? { prompt: t.config.prompt.substring(0, 50) + '...' } : t.config
    })));
    
    dataToProcess = await applyTransformationPipeline(
      dataToProcess,
      endpoint.transform_config,
      supabase
    );
    
    console.log("Data after transformations:", Array.isArray(dataToProcess) ? `array(${dataToProcess.length})` : typeof dataToProcess);
    
    // Log sample of transformed data
    if (Array.isArray(dataToProcess) && dataToProcess.length > 0) {
      console.log("First transformed item:", JSON.stringify(dataToProcess[0]).substring(0, 500));
    } else if (dataToProcess && typeof dataToProcess === 'object') {
      console.log("Transformed data sample:", JSON.stringify(dataToProcess).substring(0, 500));
    }
  }
  
  // Apply field mappings to transformed data
  let mappedData;
  if (Array.isArray(dataToProcess)) {
    console.log(`Applying field mappings to ${dataToProcess.length} items`);

    if (dataToProcess.length > 0) {
      console.log("First item structure:", JSON.stringify(dataToProcess[0], null, 2).substring(0, 1000));
    }
    
    mappedData = dataToProcess.map((item, idx) => {
      let result: any = {};
      
      for (const mapping of mappingConfig.fieldMappings) {
        let adjustedSourcePath = mapping.sourcePath;

        if (primaryPath) {
          // Check if the sourcePath starts with primaryPath[index]
          const primaryPathWithIndex = `${primaryPath}[${idx}].`;
          const primaryPathWithWildcard = `${primaryPath}[*].`;
          const primaryPathWithZero = `${primaryPath}[0].`;
          
          if (adjustedSourcePath.startsWith(primaryPathWithIndex)) {
            adjustedSourcePath = adjustedSourcePath.substring(primaryPathWithIndex.length);
          } else if (adjustedSourcePath.startsWith(primaryPathWithWildcard)) {
            adjustedSourcePath = adjustedSourcePath.substring(primaryPathWithWildcard.length);
          } else if (adjustedSourcePath.startsWith(primaryPathWithZero)) {
            // For ESPN case: events[0].competitions[0]... becomes competitions[0]...
            adjustedSourcePath = adjustedSourcePath.substring(primaryPathWithZero.length);
          }
        }
        
        let value = getValueFromPath(item, adjustedSourcePath);
        
        if (idx === 0) {
          console.log(`Mapping: "${mapping.sourcePath}" -> "${mapping.targetPath}"`);
          console.log(`  Value found: ${value !== undefined ? JSON.stringify(value).substring(0, 100) : 'undefined'}`);
          
          // Debug: try to see what paths are actually available
          if (value === undefined && idx === 0) {
            console.log(`  Available keys at root:`, Object.keys(item));
            if (item.competitions && Array.isArray(item.competitions) && item.competitions[0]) {
              console.log(`  Available keys in competitions[0]:`, Object.keys(item.competitions[0]));
            }
          }
        }
        
        // Use fallback if needed
        if ((value === undefined || value === null) && mapping.fallbackValue !== undefined) {
          value = mapping.fallbackValue;
          if (idx === 0) {
            console.log(`  Using fallback value:`, mapping.fallbackValue);
          }
        }

        if (idx === 0) {
          console.log(`  Calling setValueAtPath with:`, {
            targetPath: mapping.targetPath,
            value: value,
            resultType: typeof result
          });
        }
        
        result = setValueAtPath(result, mapping.targetPath, value);

        if (idx === 0) {
          console.log(`  Result after setValueAtPath:`, JSON.stringify(result));
        }
      }
      
      return result;
    });
    
    console.log(`Mapped ${mappedData.length} items successfully`);
  } else {
    // Single object mapping
    console.log("Applying field mappings to single object");
    let result: any = {};
    
    for (const mapping of mappingConfig.fieldMappings) {
      let value = getValueFromPath(dataToProcess, mapping.sourcePath);
      
      console.log(`Mapping: "${mapping.sourcePath}" -> "${mapping.targetPath}"`,
        value === undefined ? '(undefined)' : 
        value === null ? '(null)' :
        typeof value === 'string' ? `"${value.substring(0, 100)}${value.length > 100 ? '...' : ''}"` : 
        `(${typeof value}) ${JSON.stringify(value).substring(0, 100)}`);
      
      if ((value === undefined || value === null) && mapping.fallbackValue !== undefined) {
        value = mapping.fallbackValue;
        console.log(`  Using fallback value:`, mapping.fallbackValue);
      }
      
      result = setValueAtPath(result, mapping.targetPath, value);
    }
    
    mappedData = result;
  }
  
  // Apply output wrapper if configured
  const wrapperConfig = mappingConfig.outputWrapper;
  if (wrapperConfig?.enabled) {
    console.log("Applying output wrapper");
    const result: any = {};
    
    // Add the mapped data with the configured key
    result[wrapperConfig.wrapperKey || "data"] = mappedData;
    
    // Add metadata if configured
    if (wrapperConfig.includeMetadata && wrapperConfig.metadataFields) {
      const metadata: any = {};
      
      if (wrapperConfig.metadataFields.timestamp) {
        metadata.timestamp = new Date().toISOString();
      }
      
      if (wrapperConfig.metadataFields.source) {
        metadata.source = {
          id: dataSource.id,
          name: dataSource.name,
          type: dataSource.type
        };
      }
      
      if (wrapperConfig.metadataFields.count && Array.isArray(mappedData)) {
        metadata.count = mappedData.length;
      }
      
      if (Object.keys(metadata).length > 0) {
        result.metadata = metadata;
      }
    }
    
    console.log("Final wrapped output structure:", Object.keys(result));
    return deepCleanObject(result);
  }
  
  // No wrapper, return mapped data directly
  return deepCleanObject(mappedData);
}