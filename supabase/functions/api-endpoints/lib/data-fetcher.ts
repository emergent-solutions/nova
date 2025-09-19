// Handles fetching data from different source types
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import type { DataSource } from "../types.ts";

export async function fetchDataFromSource(
  dataSource: DataSource,
  supabase: any
): Promise<any> {
  console.log(`Fetching from source: ${dataSource.name} (${dataSource.type})`);
  
  switch (dataSource.type) {
    case "api":
      return await fetchFromAPI(dataSource);
    case "database":
      return await fetchFromDatabase(dataSource, supabase);
    case "rss":
      return await fetchFromRSS(dataSource);
    case "file":
      return await fetchFromFile(dataSource);
    default:
      console.error(`Unsupported source type: ${dataSource.type}`);
      return null;
  }
}

async function fetchFromAPI(source: DataSource): Promise<any> {
  const apiConfig = source.api_config || source.config;
  if (!apiConfig?.url) {
    throw new Error("API URL not configured");
  }

  const headers: Record<string, string> = {};
  
  // Add authentication headers
  if (apiConfig.auth_type === "bearer" && apiConfig.auth_token) {
    headers["Authorization"] = `Bearer ${apiConfig.auth_token}`;
  } else if (apiConfig.auth_type === "api_key") {
    if (apiConfig.api_key_header && apiConfig.api_key_value) {
      headers[apiConfig.api_key_header] = apiConfig.api_key_value;
    }
  }

  // Add custom headers
  if (apiConfig.headers) {
    Object.assign(headers, apiConfig.headers);
  }

  const response = await fetch(apiConfig.url, {
    method: apiConfig.method || "GET",
    headers,
    ...(apiConfig.body && { body: JSON.stringify(apiConfig.body) })
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return await response.json();
}

async function fetchFromDatabase(source: DataSource, supabase: any): Promise<any> {
  const dbConfig = source.database_config || source.config;
  if (!dbConfig?.table) {
    throw new Error("Database table not configured");
  }

  let query = supabase.from(dbConfig.table).select(dbConfig.columns || "*");
  
  // Apply filters
  if (dbConfig.filters) {
    for (const filter of dbConfig.filters) {
      query = query.filter(filter.column, filter.operator, filter.value);
    }
  }

  // Apply ordering
  if (dbConfig.order_by) {
    query = query.order(dbConfig.order_by, { 
      ascending: dbConfig.order_ascending !== false 
    });
  }

  // Apply limit
  if (dbConfig.limit) {
    query = query.limit(dbConfig.limit);
  }

  const { data, error } = await query;
  
  if (error) {
    throw new Error(`Database query failed: ${error.message}`);
  }

  return data;
}

async function fetchFromRSS(source: DataSource): Promise<any> {
  const rssConfig = source.rss_config || source.config;
  if (!rssConfig?.url) {
    throw new Error("RSS URL not configured");
  }

  const response = await fetch(rssConfig.url);
  if (!response.ok) {
    throw new Error(`RSS fetch failed: ${response.status}`);
  }

  const text = await response.text();
  // Parse RSS to JSON
  return parseRSSToJSON(text);
}

async function fetchFromFile(source: DataSource): Promise<any> {
  const fileConfig = source.file_config || source.config;
  if (!fileConfig?.url) {
    throw new Error("File URL not configured");
  }

  const response = await fetch(fileConfig.url);
  if (!response.ok) {
    throw new Error(`File fetch failed: ${response.status}`);
  }

  const contentType = response.headers.get("content-type");
  
  if (contentType?.includes("json")) {
    return await response.json();
  } else if (contentType?.includes("csv")) {
    const text = await response.text();
    return parseCSVToJSON(text);
  } else {
    return await response.text();
  }
}

function parseRSSToJSON(rssText: string): any {
  // RSS parsing logic here
  const items: any[] = [];
  const itemMatches = rssText.matchAll(/<item>(.*?)<\/item>/gs);
  
  for (const match of itemMatches) {
    const itemXml = match[1];
    items.push({
      title: extractXMLValue(itemXml, "title"),
      description: extractXMLValue(itemXml, "description"),
      link: extractXMLValue(itemXml, "link"),
      pubDate: extractXMLValue(itemXml, "pubDate"),
      guid: extractXMLValue(itemXml, "guid"),
      author: extractXMLValue(itemXml, "author"),
      category: extractXMLValue(itemXml, "category")
    });
  }
  
  return items;
}

function extractXMLValue(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}>(.*?)<\/${tag}>`, "s"));
  if (match) {
    return match[1]
      .replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  }
  return "";
}

function parseCSVToJSON(csv: string): any[] {
  const lines = csv.split("\n");
  const headers = lines[0].split(",").map(h => h.trim());
  const results = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = lines[i].split(",");
    const obj: any = {};
    
    headers.forEach((header, index) => {
      obj[header] = values[index]?.trim() || "";
    });
    
    results.push(obj);
  }
  
  return results;
}