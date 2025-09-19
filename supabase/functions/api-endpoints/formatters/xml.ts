// XML format generator
import { fetchDataFromSource } from "../lib/data-fetcher.ts";
import { applyTransformationPipeline } from "../lib/transformations.ts";
import { getValueFromPath } from "../lib/transformations.ts";
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
    itemElement = "item",
    prettyPrint = true,
    encoding = "UTF-8",
    version = "1.0",
    customNamespaces = {},
    attributePrefix = "@",
    textNodeName = "#text",
    cdataKeys = [] // Keys that should be wrapped in CDATA
  } = metadata;
  
  console.log("XML Generation Config:", {
    rootElement,
    itemElement,
    namespace,
    dataSourceCount: dataSources.length
  });

  // Collect data from all sources
  let combinedData: any = {};
  
  // Check if we should combine sources or keep them separate
  const combineMode = metadata.combineMode || "separate"; // "separate" | "merged" | "array"
  
  if (combineMode === "array") {
    combinedData = [];
  }
  
  for (const source of dataSources) {
    console.log(`Fetching data from source: ${source.name}`);
    let sourceData = await fetchDataFromSource(source, supabase);
    
    if (!sourceData) {
      console.log(`No data returned from source: ${source.name}`);
      continue;
    }
    
    // Apply transformations if configured
    if (endpoint.transform_config?.transformations?.length > 0) {
      console.log(`Applying transformations to source: ${source.name}`);
      sourceData = await applyTransformationPipeline(
        sourceData,
        endpoint.transform_config,
        supabase
      );
    }
    
    // Navigate to specific path if configured
    if (metadata.sourcePaths && metadata.sourcePaths[source.id]) {
      sourceData = getValueFromPath(sourceData, metadata.sourcePaths[source.id]);
    }
    
    // Combine data based on mode
    switch (combineMode) {
      case "merged":
        // Merge all sources into a single object
        if (Array.isArray(sourceData)) {
          if (!Array.isArray(combinedData)) {
            combinedData = [];
          }
          combinedData.push(...sourceData);
        } else if (typeof sourceData === "object") {
          Object.assign(combinedData, sourceData);
        }
        break;
        
      case "array":
        // Add each source as an item in an array
        combinedData.push({
          source: source.name,
          data: sourceData
        });
        break;
        
      case "separate":
      default:
        // Keep sources separate with their names as keys
        combinedData[source.name] = sourceData;
        break;
    }
  }
  
  // Clean the data
  combinedData = deepCleanObject(combinedData);
  
  // Generate XML
  let xml = "";
  
  // Add XML declaration if requested
  if (includeDeclaration) {
    xml += `<?xml version="${version}" encoding="${encoding}"?>\n`;
  }
  
  // Build root element with namespaces
  let rootTag = rootElement;
  const nsAttributes: string[] = [];
  
  if (namespace) {
    nsAttributes.push(`xmlns="${namespace}"`);
  }
  
  // Add custom namespaces
  for (const [prefix, uri] of Object.entries(customNamespaces)) {
    nsAttributes.push(`xmlns:${prefix}="${uri}"`);
  }
  
  const nsString = nsAttributes.length > 0 ? " " + nsAttributes.join(" ") : "";
  xml += `<${rootTag}${nsString}>`;
  
  // Convert data to XML
  if (prettyPrint) {
    xml += "\n" + objectToXML(
      combinedData,
      useAttributes,
      itemElement,
      cdataKeys,
      attributePrefix,
      textNodeName,
      "  "
    );
    xml += "\n";
  } else {
    xml += objectToXML(
      combinedData,
      useAttributes,
      itemElement,
      cdataKeys,
      attributePrefix,
      textNodeName,
      ""
    );
  }
  
  xml += `</${rootTag}>`;
  
  return new Response(xml, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/xml; charset=utf-8"
    }
  });
}

function objectToXML(
  obj: any,
  useAttributes: boolean,
  itemElement: string,
  cdataKeys: string[],
  attributePrefix: string,
  textNodeName: string,
  indent: string = ""
): string {
  if (obj === null || obj === undefined) {
    return "";
  }
  
  // Handle primitives
  if (typeof obj !== "object") {
    return escapeXML(String(obj));
  }
  
  let xml = "";
  
  // Handle arrays
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (indent) xml += "\n" + indent;
      xml += `<${itemElement}>`;
      
      const itemContent = objectToXML(
        item,
        useAttributes,
        itemElement,
        cdataKeys,
        attributePrefix,
        textNodeName,
        indent ? indent + "  " : ""
      );
      
      if (typeof item === "object" && indent) {
        xml += "\n" + indent + "  " + itemContent;
        xml += "\n" + indent;
      } else {
        xml += itemContent;
      }
      
      xml += `</${itemElement}>`;
    }
    return xml;
  }
  
  // Handle objects
  const attributes: Record<string, string> = {};
  const elements: Record<string, any> = {};
  let textContent: string | null = null;
  
  // Separate attributes from elements if using attributes
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    
    if (useAttributes && key.startsWith(attributePrefix)) {
      // This is an attribute
      const attrName = key.substring(attributePrefix.length);
      if (typeof value !== "object") {
        attributes[attrName] = String(value);
      }
    } else if (key === textNodeName) {
      // This is text content
      textContent = String(value);
    } else {
      // This is a regular element
      elements[key] = value;
    }
  }
  
  // Process each element
  for (const [key, value] of Object.entries(elements)) {
    // Sanitize key for XML
    const validKey = key.replace(/[^a-zA-Z0-9_\-:.]/g, "_");
    
    // Check if this should be wrapped in CDATA
    const useCData = cdataKeys.includes(key);
    
    if (Array.isArray(value)) {
      // Handle array of items
      for (const item of value) {
        if (indent) xml += "\n" + indent;
        
        // Build element with attributes if it's an object with @ prefixed keys
        const elementAttributes = useAttributes ? extractAttributes(item, attributePrefix) : {};
        const attrString = buildAttributeString(elementAttributes);
        
        xml += `<${validKey}${attrString}>`;
        
        if (typeof item === "object" && !isSimpleObject(item)) {
          const content = objectToXML(
            item,
            useAttributes,
            itemElement,
            cdataKeys,
            attributePrefix,
            textNodeName,
            indent ? indent + "  " : ""
          );
          if (indent && content) {
            xml += "\n" + indent + "  " + content;
            xml += "\n" + indent;
          } else {
            xml += content;
          }
        } else if (typeof item === "object") {
          // Simple object - inline it
          const content = objectToXML(
            item,
            useAttributes,
            itemElement,
            cdataKeys,
            attributePrefix,
            textNodeName,
            ""
          );
          xml += content;
        } else {
          // Primitive value
          if (useCData) {
            xml += `<![CDATA[${item}]]>`;
          } else {
            xml += escapeXML(String(item));
          }
        }
        
        xml += `</${validKey}>`;
      }
    } else if (typeof value === "object") {
      // Handle nested object
      if (indent) xml += "\n" + indent;
      
      const elementAttributes = useAttributes ? extractAttributes(value, attributePrefix) : {};
      const attrString = buildAttributeString(elementAttributes);
      
      xml += `<${validKey}${attrString}>`;
      
      const content = objectToXML(
        value,
        useAttributes,
        itemElement,
        cdataKeys,
        attributePrefix,
        textNodeName,
        indent ? indent + "  " : ""
      );
      
      if (indent && content && !isSimpleObject(value)) {
        xml += "\n" + indent + "  " + content;
        xml += "\n" + indent;
      } else {
        xml += content;
      }
      
      xml += `</${validKey}>`;
    } else {
      // Handle primitive value
      if (indent) xml += "\n" + indent;
      xml += `<${validKey}>`;
      
      if (useCData) {
        xml += `<![CDATA[${value}]]>`;
      } else {
        xml += escapeXML(String(value));
      }
      
      xml += `</${validKey}>`;
    }
  }
  
  // Add text content if present
  if (textContent !== null) {
    xml += escapeXML(textContent);
  }
  
  return xml;
}

// Helper function to check if object is simple (only primitive values)
function isSimpleObject(obj: any): boolean {
  if (typeof obj !== "object" || obj === null) return true;
  if (Array.isArray(obj)) return false;
  
  for (const value of Object.values(obj)) {
    if (typeof value === "object" && value !== null) {
      return false;
    }
  }
  return true;
}

// Helper function to extract attributes from an object
function extractAttributes(obj: any, prefix: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  
  if (typeof obj !== "object" || obj === null) return attrs;
  
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith(prefix) && typeof value !== "object") {
      const attrName = key.substring(prefix.length);
      attrs[attrName] = String(value);
    }
  }
  
  return attrs;
}

// Helper function to build attribute string
function buildAttributeString(attrs: Record<string, string>): string {
  const entries = Object.entries(attrs);
  if (entries.length === 0) return "";
  
  return " " + entries
    .map(([key, value]) => `${key}="${escapeXML(value)}"`)
    .join(" ");
}