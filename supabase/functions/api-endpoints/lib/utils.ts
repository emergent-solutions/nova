// Utility functions
export function escapeXML(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function cleanEncodingIssues(str: string): string {
  if (!str || typeof str !== "string") return str;
  
  let cleaned = str;
  let previousCleaned = "";
  let iterations = 0;
  const maxIterations = 5;
  
  while (cleaned !== previousCleaned && iterations < maxIterations) {
    iterations++;
    previousCleaned = cleaned;
    
    // Common UTF-8 encoding issues
    cleaned = cleaned
      .replace(/â€™/g, "'")
      .replace(/â€œ/g, '"')
      .replace(/â€/g, '"')
      .replace(/â€˜/g, "'")
      .replace(/â€"/g, "—")
      .replace(/â€"/g, "–")
      .replace(/â€¦/g, "…")
      .replace(/â€¢/g, "•")
      .replace(/Â /g, " ")
      .replace(/â€‰/g, " ")
      .replace(/Ã©/g, "é")
      .replace(/Ã¨/g, "è")
      .replace(/Ã¢/g, "â")
      .replace(/Ã´/g, "ô")
      .replace(/Ã§/g, "ç")
      .replace(/Ã±/g, "ñ")
      .replace(/Ã¼/g, "ü")
      .replace(/Ã¶/g, "ö")
      .replace(/Ã¤/g, "ä")
      .replace(/Ã¡/g, "á")
      .replace(/Ã³/g, "ó")
      .replace(/Ãº/g, "ú")
      .replace(/Ã/g, "í");
  }
  
  // Handle HTML entities
  cleaned = cleaned
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
  
  return cleaned;
}

export function deepCleanObject(obj: any): any {
  if (typeof obj === "string") {
    return cleanEncodingIssues(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => deepCleanObject(item));
  }
  if (obj && typeof obj === "object") {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      cleaned[key] = deepCleanObject(value);
    }
    return cleaned;
  }
  return obj;
}

export function evaluateConditionSimple(
  value: any,
  operator: string,
  compareValue: any
): boolean {
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

// ===== formatters/xml.ts =====
// XML format generator
import { fetchDataFromSource } from "../lib/data-fetcher.ts";
import { applyTransformationPipeline } from "../lib/transformations.ts";
import { corsHeaders } from "../lib/cors.ts";
import { escapeXML, deepCleanObject } from "../lib/utils.ts";
import type { APIEndpoint, DataSource } from "../types.ts";

export async function generateXMLResponse(
  endpoint: APIEndpoint,
  dataSources: DataSource[],
  supabase: any
): Promise<Response> {
  const metadata = endpoint.schema_config?.schema?.metadata || {};
  const {
    namespace = "",
    includeDeclaration = true,
    useAttributes = false,
    rootElement = "root",
    itemElement = "item"
  } = metadata;
  
  // Fetch and process data
  let data: any = {};
  
  for (const source of dataSources) {
    let sourceData = await fetchDataFromSource(source, supabase);
    
    if (sourceData && endpoint.transform_config?.transformations) {
      sourceData = await applyTransformationPipeline(
        sourceData,
        endpoint.transform_config,
        supabase
      );
    }
    
    data[source.name] = sourceData;
  }
  
  // Clean the data
  data = deepCleanObject(data);
  
  // Generate XML
  let xml = includeDeclaration ? '<?xml version="1.0" encoding="UTF-8"?>\n' : '';
  
  if (namespace) {
    xml += `<${rootElement} xmlns="${namespace}">`;
  } else {
    xml += `<${rootElement}>`;
  }
  
  xml += objectToXML(data, useAttributes, itemElement);
  xml += `</${rootElement}>`;
  
  return new Response(xml, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/xml; charset=utf-8"
    }
  });
}

function objectToXML(
  obj: any,
  useAttributes: boolean = false,
  itemElement: string = "item",
  indent: string = "  "
): string {
  if (obj === null || obj === undefined) {
    return "";
  }
  
  if (typeof obj !== "object") {
    return escapeXML(String(obj));
  }
  
  let xml = "";
  
  if (Array.isArray(obj)) {
    for (const item of obj) {
      xml += `\n${indent}<${itemElement}>`;
      xml += objectToXML(item, useAttributes, itemElement, indent + "  ");
      xml += `\n${indent}</${itemElement}>`;
    }
  } else {
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) continue;
      
      const validKey = key.replace(/[^a-zA-Z0-9_-]/g, "_");
      
      if (useAttributes && typeof value !== "object") {
        // Add as attribute instead of element
        continue; // Attributes handled separately
      }
      
      if (Array.isArray(value)) {
        for (const item of value) {
          xml += `\n${indent}<${validKey}>`;
          xml += objectToXML(item, useAttributes, itemElement, indent + "  ");
          xml += `</${validKey}>`;
        }
      } else if (typeof value === "object") {
        xml += `\n${indent}<${validKey}>`;
        xml += objectToXML(value, useAttributes, itemElement, indent + "  ");
        xml += `\n${indent}</${validKey}>`;
      } else {
        xml += `\n${indent}<${validKey}>${escapeXML(String(value))}</${validKey}>`;
      }
    }
  }
  
  return xml;
}