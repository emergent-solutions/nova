// RSS format generator with transformation fix and null safety
import { fetchDataFromSource } from "../lib/data-fetcher.ts";
import { applyTransformationPipeline } from "../lib/transformations.ts";
import { getValueFromPath } from "../lib/transformations.ts";
import { corsHeaders } from "../lib/cors.ts";
import { escapeXML } from "../lib/utils.ts"; // Import escapeXML from utils
import type { APIEndpoint, DataSource } from "../types.ts";

export async function generateRSSFeed(
  endpoint: APIEndpoint,
  dataSources: DataSource[],
  supabase: any
): Promise<Response> {
  const metadata = endpoint.schema_config?.schema?.metadata || {};
  const {
    channelTitle = "RSS Feed",
    channelDescription = "RSS Feed Description",
    channelLink = "https://example.com",
    sourceMappings = [],
    mergeStrategy = "sequential",
    maxItemsPerSource = 0,
    maxTotalItems = 0
  } = metadata;

  console.log("RSS Metadata:", {
    channelTitle,
    sourceMappings: sourceMappings.length,
    hasTransformations: !!endpoint.transform_config?.transformations
  });

  let allItems: any[] = [];

  if (sourceMappings && sourceMappings.length > 0) {
    // Multi-source RSS generation
    for (const mapping of sourceMappings) {
      if (!mapping.enabled) continue;

      const dataSource = dataSources.find((ds) => ds.id === mapping.sourceId);
      if (!dataSource) continue;

      console.log(`Processing RSS source: ${dataSource.name}`);

      const sourceData = await fetchDataFromSource(dataSource, supabase);
      if (!sourceData) continue;

      // Extract items using the specified path
      let items = getValueFromPath(sourceData, mapping.itemsPath);
      if (!Array.isArray(items)) continue;

      // FIXED: Apply transformations AFTER extracting items for RSS
      if (endpoint.transform_config?.transformations?.length > 0) {
        console.log(`Applying transformations to ${items.length} RSS items...`);
        items = await applyTransformationPipeline(items, endpoint.transform_config, supabase);
      }

      // Apply per-source limit
      if (maxItemsPerSource > 0) {
        items = items.slice(0, maxItemsPerSource);
      }

      // Map fields to RSS structure
      const mappedItems = items.map((item) => mapItemToRSS(item, mapping, dataSource.name));
      allItems = allItems.concat(mappedItems);
    }

    // Apply merge strategy
    if (mergeStrategy === "interleaved") {
      allItems = interleaveItems(allItems);
    }
  } else {
    // Fallback single source mode
    allItems = await generateSingleSourceRSS(endpoint, dataSources, supabase);
  }

  // Apply total items limit
  if (maxTotalItems > 0) {
    allItems = allItems.slice(0, maxTotalItems);
  }

  const rssXML = buildRSSXML(channelTitle, channelDescription, channelLink, allItems);

  return new Response(rssXML, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/rss+xml; charset=utf-8"
    }
  });
}

function mapItemToRSS(item: any, mapping: any, sourceName: string): any {
  const fieldMappings = mapping.fieldMappings || {};
  
  const getMappedValue = (rssField: string, defaultField: string): string => {
    const sourceField = fieldMappings[rssField] || defaultField;
    if (!sourceField) return "";
    
    let value;
    if (sourceField.includes(".")) {
      value = getValueFromPath(item, sourceField);
    } else {
      value = item[sourceField];
    }
    
    // Ensure we always return a string
    return safeString(value);
  };

  return {
    title: getMappedValue("title", "title"),
    description: getMappedValue("description", "description"),
    link: getMappedValue("link", "link"),
    pubDate: formatDate(
      getMappedValue("pubDate", "pubDate") ||
      getMappedValue("pubDate", "date") ||
      getMappedValue("pubDate", "created_at") ||
      ""
    ),
    guid: getMappedValue("guid", "guid") ||
          getMappedValue("guid", "id") ||
          getMappedValue("guid", "link") ||
          Math.random().toString(),
    author: getMappedValue("author", "author"),
    category: getMappedValue("category", "category"),
    _sourceName: sourceName
  };
}

function interleaveItems(items: any[]): any[] {
  const sourceGroups: Record<string, any[]> = {};
  
  items.forEach((item) => {
    const source = item._sourceName || "unknown";
    if (!sourceGroups[source]) sourceGroups[source] = [];
    sourceGroups[source].push(item);
  });

  const interleaved: any[] = [];
  let hasMore = true;
  let index = 0;

  while (hasMore) {
    hasMore = false;
    for (const source in sourceGroups) {
      if (index < sourceGroups[source].length) {
        interleaved.push(sourceGroups[source][index]);
        hasMore = true;
      }
    }
    index++;
  }

  return interleaved;
}

async function generateSingleSourceRSS(
  endpoint: APIEndpoint,
  dataSources: DataSource[],
  supabase: any
): Promise<any[]> {
  if (dataSources.length === 0) return [];

  const dataSource = dataSources[0];
  let sourceData = await fetchDataFromSource(dataSource, supabase);
  
  if (!sourceData) return [];

  // For single source, apply transformations to full data
  if (endpoint.transform_config?.transformations?.length > 0) {
    sourceData = await applyTransformationPipeline(sourceData, endpoint.transform_config, supabase);
  }

  let items = sourceData;
  if (!Array.isArray(items)) {
    items = sourceData.items || sourceData.data || sourceData.results || sourceData.articles || [];
  }

  if (!Array.isArray(items)) return [];

  return items.map((item) => ({
    title: safeString(item.title),
    description: safeString(item.description || item.summary),
    link: safeString(item.link || item.url),
    pubDate: formatDate(item.pubDate || item.date || item.created_at),
    guid: safeString(item.guid || item.id || item.link) || Math.random().toString(),
    author: safeString(item.author),
    category: safeString(item.category)
  }));
}

function buildRSSXML(
  title: string,
  description: string,
  link: string,
  items: any[]
): string {
  // Use safeString to ensure all values are strings before passing to escapeXML
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXML(safeString(title))}</title>
    <description>${escapeXML(safeString(description))}</description>
    <link>${escapeXML(safeString(link))}</link>
    <generator>API Builder</generator>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${items.map((item) => `
    <item>
      <title>${escapeXML(safeString(item.title))}</title>
      <description>${escapeXML(safeString(item.description))}</description>
      <link>${escapeXML(safeString(item.link))}</link>
      <guid isPermaLink="false">${escapeXML(safeString(item.guid))}</guid>
      <pubDate>${safeString(item.pubDate)}</pubDate>
      ${item.author ? `<author>${escapeXML(safeString(item.author))}</author>` : ""}
      ${item.category ? `<category>${escapeXML(safeString(item.category))}</category>` : ""}
      ${item._sourceName ? `<source url="${escapeXML(safeString(link))}">${escapeXML(safeString(item._sourceName))}</source>` : ""}
    </item>`).join("")}
  </channel>
</rss>`;
}

// Helper to safely convert any value to string
function safeString(value: any): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return "";
}

function formatDate(dateValue: any): string {
  if (!dateValue) return new Date().toUTCString();
  
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) {
      return new Date().toUTCString();
    }
    return date.toUTCString();
  } catch {
    return new Date().toUTCString();
  }
}