// ===== formatters/json.ts (FIXED - Use complex mapping properly) =====
// JSON format generator with proper transformation handling
import { fetchDataFromSource } from "../lib/data-fetcher.ts";
import { applyTransformationPipeline } from "../lib/transformations.ts";
import { applyComplexMapping } from "../lib/complex-mapping.ts";
import { corsHeaders } from "../lib/cors.ts";
import { deepCleanObject, cleanEncodingIssues } from "../lib/utils.ts";
import type { APIEndpoint, DataSource } from "../types.ts";

export async function generateJSONResponse(
  endpoint: APIEndpoint,
  dataSources: DataSource[],
  supabase: any
): Promise<Response> {
  const schemaConfig = endpoint.schema_config || {};
  const metadata = schemaConfig.schema?.metadata || {};

  console.log("JSON Response Generation:", {
    hasJsonMappingConfig: !!metadata.jsonMappingConfig,
    hasFieldMappings: !!(metadata.jsonMappingConfig?.fieldMappings?.length),
    hasTransformations: !!(endpoint.transform_config?.transformations?.length),
    transformationCount: endpoint.transform_config?.transformations?.length || 0
  });

  let jsonData: any;

  // Check for complex mapping configuration
  if (metadata.jsonMappingConfig && 
      metadata.jsonMappingConfig.fieldMappings && 
      metadata.jsonMappingConfig.fieldMappings.length > 0) {
    console.log("Using complex JSON mapping");
    // Use the complex mapping which handles transformations properly
    jsonData = await applyComplexMapping(
      endpoint,
      dataSources,
      metadata.jsonMappingConfig,
      supabase
    );
  } else {
    // Simple mode - no field mappings
    console.log("Using simple JSON generation");
    jsonData = await generateSimpleJSON(endpoint, dataSources, supabase);
  }

  // Clean encoding issues during serialization
  const jsonString = JSON.stringify(jsonData, (key, value) => {
    if (typeof value === "string") {
      return cleanEncodingIssues(value);
    }
    return value;
  }, metadata.prettyPrint !== false ? 2 : 0);

  return new Response(jsonString, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

/**
 * Simple JSON generation - fetch, transform, wrap
 * Used when no field mappings are configured
 */
async function generateSimpleJSON(
  endpoint: APIEndpoint,
  dataSources: DataSource[],
  supabase: any
): Promise<any> {
  if (dataSources.length === 0) {
    return { error: "No data sources configured" };
  }

  const dataSource = dataSources[0];
  let sourceData = await fetchDataFromSource(dataSource, supabase);

  if (!sourceData) {
    return { error: "Failed to fetch data from source" };
  }

  // Apply transformations if configured
  if (endpoint.transform_config?.transformations && 
      endpoint.transform_config.transformations.length > 0) {
    console.log("Applying transformations in simple mode...");
    sourceData = await applyTransformationPipeline(
      sourceData,
      endpoint.transform_config,
      supabase
    );
  }

  // Apply simple wrapper settings if configured
  const metadata = endpoint.schema_config?.schema?.metadata || {};
  
  if (metadata.wrapResponse || metadata.includeMetadata) {
    const result: any = {};
    
    if (metadata.wrapResponse && metadata.rootElement) {
      result[metadata.rootElement] = sourceData;
    } else if (!metadata.includeMetadata) {
      return sourceData;
    } else {
      if (Array.isArray(sourceData)) {
        result.items = sourceData;
      } else {
        Object.assign(result, sourceData);
      }
    }
    
    if (metadata.includeMetadata) {
      result.metadata = {
        timestamp: new Date().toISOString(),
        source: dataSource.name,
        type: dataSource.type,
        format: endpoint.output_format
      };
      
      if (Array.isArray(sourceData)) {
        result.metadata.count = sourceData.length;
      }
    }
    
    return result;
  }

  return sourceData;
}