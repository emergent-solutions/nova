// CSV format generator
import { fetchDataFromSource } from "../lib/data-fetcher.ts";
import { applyTransformationPipeline } from "../lib/transformations.ts";
import { corsHeaders } from "../lib/cors.ts";
import { deepCleanObject } from "../lib/utils.ts";
import type { APIEndpoint, DataSource } from "../types.ts";

export async function generateCSVResponse(
  endpoint: APIEndpoint,
  dataSources: DataSource[],
  supabase: any
): Promise<Response> {
  const metadata = endpoint.schema_config?.schema?.metadata || {};
  const {
    delimiter = ",",
    includeHeaders = true,
    lineEnding = "\n",
    quoteCharacter = '"',
    escapeCharacter = '"'
  } = metadata;
  
  // Fetch and process data
  let allData: any[] = [];
  
  for (const source of dataSources) {
    let sourceData = await fetchDataFromSource(source, supabase);
    
    if (sourceData && endpoint.transform_config?.transformations) {
      sourceData = await applyTransformationPipeline(
        sourceData,
        endpoint.transform_config,
        supabase
      );
    }
    
    // Ensure data is an array
    if (Array.isArray(sourceData)) {
      allData.push(...sourceData);
    } else if (sourceData && typeof sourceData === "object") {
      allData.push(sourceData);
    }
  }
  
  // Clean the data
  allData = deepCleanObject(allData);
  
  if (allData.length === 0) {
    return new Response("", {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv; charset=utf-8"
      }
    });
  }
  
  // Extract headers from first object
  const headers = Object.keys(allData[0]);
  let csv = "";
  
  // Add headers if requested
  if (includeHeaders) {
    csv += headers.map(h => escapeCSVValue(h, delimiter, quoteCharacter, escapeCharacter)).join(delimiter) + lineEnding;
  }
  
  // Add data rows
  for (const row of allData) {
    const values = headers.map(header => {
      const value = row[header];
      return escapeCSVValue(value, delimiter, quoteCharacter, escapeCharacter);
    });
    csv += values.join(delimiter) + lineEnding;
  }
  
  return new Response(csv, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${endpoint.slug}.csv"`
    }
  });
}

function escapeCSVValue(
  value: any,
  delimiter: string,
  quoteChar: string,
  escapeChar: string
): string {
  if (value === null || value === undefined) {
    return "";
  }
  
  const stringValue = String(value);
  
  // Check if value needs quoting
  const needsQuoting = 
    stringValue.includes(delimiter) ||
    stringValue.includes(quoteChar) ||
    stringValue.includes("\n") ||
    stringValue.includes("\r");
  
  if (!needsQuoting) {
    return stringValue;
  }
  
  // Escape quotes in the value
  const escaped = stringValue.replace(
    new RegExp(quoteChar, "g"),
    escapeChar + quoteChar
  );
  
  return quoteChar + escaped + quoteChar;
}