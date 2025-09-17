import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS"
};
// Authentication Handler Class
class AuthenticationHandler {
  authConfig;
  supabase;
  constructor(authConfig, supabase){
    this.authConfig = authConfig;
    this.supabase = supabase;
  }
  async validateRequest(req) {
    // If auth is not required, allow the request
    if (!this.authConfig?.required) {
      return {
        valid: true
      };
    }
    const authHeader = req.headers.get("Authorization");
    switch(this.authConfig.type){
      case "api_key":
        return this.validateApiKey(req);
      case "bearer":
        return this.validateBearerToken(authHeader);
      case "basic":
        return this.validateBasicAuth(authHeader);
      case "custom":
        return this.validateCustom(req);
      default:
        return {
          valid: true
        }; // If no specific type, allow
    }
  }
  async validateApiKey(req) {
    const config = this.authConfig.config || {};
    const headerName = config.header_name || "X-API-Key";
    const apiKey = req.headers.get(headerName);
    if (!apiKey) {
      return {
        valid: false,
        error: `Missing ${headerName} header`
      };
    }
    // Check if the key exists in the allowed keys
    const allowedKeys = config.keys || [];
    const validKey = allowedKeys.find((k)=>k.key === apiKey && k.active !== false);
    if (!validKey) {
      return {
        valid: false,
        error: "Invalid API key"
      };
    }
    return {
      valid: true,
      user: {
        type: "api_key",
        key_name: validKey.name
      }
    };
  }
  async validateBearerToken(authHeader) {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return {
        valid: false,
        error: "Missing or invalid Authorization header"
      };
    }
    const token = authHeader.substring(7);
    const config = this.authConfig.config || {};
    // Check against allowed tokens list
    const allowedTokens = config.allowed_tokens || [];
    if (allowedTokens.length > 0) {
      if (!allowedTokens.includes(token)) {
        return {
          valid: false,
          error: "Token not authorized"
        };
      }
    }
    // If no specific validation, accept any bearer token
    return {
      valid: true,
      user: {
        type: "bearer",
        token: token.substring(0, 10) + "..."
      }
    };
  }
  async validateBasicAuth(authHeader) {
    if (!authHeader || !authHeader.startsWith("Basic ")) {
      return {
        valid: false,
        error: "Missing or invalid Authorization header"
      };
    }
    try {
      const credentials = atob(authHeader.substring(6));
      const [username, password] = credentials.split(":");
      const config = this.authConfig.config || {};
      const users = config.users || [];
      const validUser = users.find((u)=>u.username === username && u.password === password && u.active !== false);
      if (!validUser) {
        return {
          valid: false,
          error: "Invalid credentials"
        };
      }
      return {
        valid: true,
        user: {
          type: "basic",
          username
        }
      };
    } catch (error) {
      return {
        valid: false,
        error: "Invalid Basic auth format"
      };
    }
  }
  async validateCustom(req) {
    const config = this.authConfig.config || {};
    if (!config.validation_endpoint) {
      return {
        valid: false,
        error: "Custom validation endpoint not configured"
      };
    }
    try {
      const validationResponse = await fetch(config.validation_endpoint, {
        method: config.validation_method || "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: req.headers.get("Authorization") || "",
          "X-API-Key": req.headers.get("X-API-Key") || ""
        },
        body: JSON.stringify({
          headers: Object.fromEntries(req.headers.entries()),
          url: req.url,
          method: req.method
        })
      });
      if (validationResponse.ok) {
        const result = await validationResponse.json();
        return {
          valid: true,
          user: result.user || {
            type: "custom"
          }
        };
      }
      return {
        valid: false,
        error: "Custom validation failed"
      };
    } catch (error) {
      return {
        valid: false,
        error: "Custom validation service unavailable"
      };
    }
  }
  getCorsHeaders() {
    if (this.authConfig?.cors_enabled === false) {
      return {};
    }
    const origins = this.authConfig?.cors_origins || [
      "*"
    ];
    return {
      "Access-Control-Allow-Origin": origins.join(", "),
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS"
    };
  }
}
// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(supabaseUrl, supabaseServiceKey);
serve(async (req)=>{
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  try {
    const url = new URL(req.url);
    console.log("Full URL:", req.url);
    console.log("Pathname:", url.pathname);
    // Extract slug from the URL
    let slug = "";
    // Method 1: If the function name is in the path
    if (url.pathname.includes("/api-endpoints/")) {
      const parts = url.pathname.split("/api-endpoints/");
      slug = parts[1] || "";
    } else {
      const pathParts = url.pathname.split("/").filter((p)=>p);
      slug = pathParts[pathParts.length - 1] || "";
    }
    // Clean the slug
    slug = slug.split("?")[0].replace(/\/$/, "");
    console.log("Extracted slug:", slug);
    // Check slug FIRST
    if (!slug) {
      return new Response(JSON.stringify({
        error: "Endpoint slug required",
        debug: {
          url: req.url,
          pathname: url.pathname
        }
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json; charset=utf-8"
        }
      });
    }
    // Get the endpoint first
    const { data: endpoint, error: endpointError } = await supabase.from("api_endpoints").select("*").eq("slug", slug).eq("active", true).single();
    // Check slug FIRST
    if (!endpoint) {
      return new Response(JSON.stringify({
        error: "Endpoint not found",
        debug: {
          url: req.url,
          pathname: url.pathname
        }
      }), {
        status: 404,
        headers: {
          "Content-Type": "application/json; charset=utf-8"
        }
      });
    }
    // Initialize authentication handler
    const authHandler = new AuthenticationHandler(endpoint.auth_config || {
      required: false,
      type: "none"
    }, supabase);
    // Get CORS headers
    const corsHeaders = authHandler.getCorsHeaders();
    if (endpointError || !endpoint) {
      console.error("Endpoint not found:", endpointError);
      return new Response(JSON.stringify({
        error: "Endpoint not found",
        slug: slug
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json; charset=utf-8"
        }
      });
    }
    console.log("Found endpoint:", endpoint.id, endpoint.name);
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: corsHeaders
      });
    }
    // Validate authentication
    const authResult = await authHandler.validateRequest(req);
    if (!authResult.valid) {
      return new Response(JSON.stringify({
        error: authResult.error || "Authentication failed"
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json; charset=utf-8",
          "WWW-Authenticate": endpoint.auth_config?.type === "basic" ? 'Basic realm="API Endpoint"' : "Bearer"
        }
      });
    }
    // Log successful access
    try {
      await supabase.from("api_access_logs").insert({
        endpoint_id: endpoint.id,
        request_method: req.method,
        request_path: url.pathname,
        request_params: Object.fromEntries(url.searchParams),
        response_status: 200,
        response_time_ms: 0,
        client_ip: req.headers.get("CF-Connecting-IP") || req.headers.get("X-Forwarded-For") || "unknown",
        user_agent: req.headers.get("User-Agent"),
        auth_user: authResult.user,
        created_at: new Date().toISOString()
      });
    } catch (logError) {
      console.error("Failed to log access:", logError);
    }
    // Get the junction records
    const { data: endpointSources, error: sourcesError } = await supabase.from("api_endpoint_sources").select("*").eq("endpoint_id", endpoint.id).order("sort_order");
    console.log("Junction records found:", endpointSources?.length || 0);
    // Get the actual data sources
    const dataSourceIds = endpointSources?.map((es)=>es.data_source_id) || [];
    console.log("Data source IDs:", dataSourceIds);
    let dataSources = [];
    if (dataSourceIds.length > 0) {
      const { data: sources, error: dsError } = await supabase.from("data_sources").select("*").in("id", dataSourceIds);
      if (dsError) {
        console.error("Error fetching data sources:", dsError);
      }
      dataSources = sources || [];
      console.log("Fetched data sources:", dataSources.map((ds)=>({
          id: ds.id,
          name: ds.name,
          type: ds.type
        })));
    }
    console.log("Data sources count:", dataSources.length);
    // Check authentication if required
    if (endpoint.auth_config?.required) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({
          error: "Authentication required"
        }), {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json; charset=utf-8"
          }
        });
      }
    // Add your authentication logic here
    }
    // Handle different output formats
    if (endpoint.output_format === "rss") {
      console.log("Generating RSS feed...");
      const rssFeed = await generateRSSFeed(endpoint, dataSources, supabase);
      return new Response(rssFeed, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/rss+xml; charset=utf-8"
        }
      });
    } else if (endpoint.output_format === "json") {
      console.log("Generating JSON response...");
      const jsonData = await generateJSONResponse(endpoint, dataSources, supabase);
      // Check if pretty print is enabled
      const metadata = endpoint.schema_config?.schema?.metadata || {};
      const prettyPrint = metadata.prettyPrint !== false;
      // Use a replacer function to clean strings during stringify
      const jsonString = JSON.stringify(jsonData, (key, value)=>{
        if (typeof value === "string") {
          // Clean the string right here during serialization
          return value.replace(/'/g, "'") // Replace curly quotes with straight quotes
          .replace(/'/g, "'").replace(/"/g, '"').replace(/"/g, '"').replace(/—/g, "—").replace(/–/g, "–").replace(/…/g, "...");
        }
        return value;
      }, prettyPrint ? 2 : 0);
      return new Response(jsonString, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json; charset=utf-8"
        }
      });
    } else {
      return new Response(JSON.stringify({
        error: `Unsupported format: ${endpoint.output_format}`,
        supportedFormats: [
          "json",
          "rss",
          "xml",
          "csv"
        ]
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json; charset=utf-8"
        }
      });
    }
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      details: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json; charset=utf-8"
      }
    });
  }
});
// Generate RSS feed for multi-source configuration
async function generateRSSFeed(endpoint, dataSources, supabase) {
  const metadata = endpoint.schema_config?.schema?.metadata || {};
  const { channelTitle = "RSS Feed", channelDescription = "RSS Feed Description", channelLink = "https://example.com", sourceMappings = [], mergeStrategy = "sequential", maxItemsPerSource = 0, maxTotalItems = 0 } = metadata;
  console.log("RSS Metadata:", {
    channelTitle,
    sourceMappings: sourceMappings.length,
    hasTransformations: !!endpoint.transform_config?.transformations
  });
  // Check if we have multi-source configuration
  const hasMultiSource = sourceMappings && sourceMappings.length > 0;
  let allItems = [];
  if (hasMultiSource) {
    console.log("Using multi-source RSS generation");
    // Multi-source RSS generation
    for (const mapping of sourceMappings){
      if (!mapping.enabled) {
        console.log(`Skipping disabled source mapping`);
        continue;
      }
      // Find the data source
      const dataSource = dataSources.find((ds)=>ds.id === mapping.sourceId);
      if (!dataSource) {
        console.log(`Data source not found for mapping: ${mapping.sourceId}`);
        continue;
      }
      console.log(`Processing source: ${dataSource.name} (${dataSource.type})`);
      // Fetch data from source
      const sourceData = await fetchDataFromSource(dataSource, supabase);
      if (!sourceData) {
        console.log(`No data returned from source: ${dataSource.name}`);
        continue;
      }
      // Extract items using the specified path
      let items = getValueFromPath(sourceData, mapping.itemsPath);
      console.log(`Found ${Array.isArray(items) ? items.length : 0} items at path: ${mapping.itemsPath}`);
      if (!Array.isArray(items)) continue;
      // CRITICAL FIX: Apply transformations to the items AFTER extracting them
      // This ensures transformations work on the actual item data, not the wrapper
      if (endpoint.transform_config?.transformations && endpoint.transform_config.transformations.length > 0) {
        console.log(`Applying transformations to ${items.length} RSS items from ${dataSource.name}...`);
        // Apply transformations to the items array
        items = await applyTransformationPipeline(items, endpoint.transform_config, supabase);
        console.log(`Transformations complete. Resulting items: ${Array.isArray(items) ? items.length : 0}`);
      }
      // Apply per-source limit
      const limitedItems = maxItemsPerSource > 0 ? items.slice(0, maxItemsPerSource) : items;
      // Map fields to RSS structure
      const mappedItems = limitedItems.map((item)=>{
        const fieldMappings = mapping.fieldMappings || {};
        // Helper function to get mapped field value
        const getMappedValue = (rssField, defaultField)=>{
          const sourceField = fieldMappings[rssField] || defaultField;
          if (!sourceField) return '';
          // Handle nested paths
          if (sourceField.includes('.')) {
            return getValueFromPath(item, sourceField) || '';
          }
          return item[sourceField] || '';
        };
        return {
          title: getMappedValue('title', 'title'),
          description: getMappedValue('description', 'description'),
          link: getMappedValue('link', 'link'),
          pubDate: formatDate(getMappedValue('pubDate', 'pubDate') || getMappedValue('pubDate', 'date') || getMappedValue('pubDate', 'created_at')),
          guid: getMappedValue('guid', 'guid') || getMappedValue('guid', 'id') || getMappedValue('guid', 'link') || Math.random().toString(),
          author: getMappedValue('author', 'author'),
          category: getMappedValue('category', 'category'),
          _sourceName: dataSource.name
        };
      });
      // Add to combined items
      allItems = allItems.concat(mappedItems);
      console.log(`Added ${mappedItems.length} mapped items from ${dataSource.name}`);
    }
    // Apply merge strategy
    if (mergeStrategy === 'interleaved' && allItems.length > 0) {
      console.log('Applying interleaved merge strategy');
      const sourceGroups = {};
      allItems.forEach((item)=>{
        const source = item._sourceName || 'unknown';
        if (!sourceGroups[source]) sourceGroups[source] = [];
        sourceGroups[source].push(item);
      });
      allItems = [];
      let hasMore = true;
      let index = 0;
      while(hasMore){
        hasMore = false;
        for(const source in sourceGroups){
          if (index < sourceGroups[source].length) {
            allItems.push(sourceGroups[source][index]);
            hasMore = true;
          }
        }
        index++;
      }
    }
  } else {
    // FALLBACK: Single source mode (backward compatibility)
    console.log("Using single source mode");
    if (dataSources.length > 0) {
      const dataSource = dataSources[0];
      let sourceData = await fetchDataFromSource(dataSource, supabase);
      if (sourceData) {
        // For single source mode, apply transformations to the full data
        // This maintains backward compatibility with existing JSON endpoints
        if (endpoint.transform_config?.transformations && endpoint.transform_config.transformations.length > 0) {
          console.log("Applying transformations to source data...");
          sourceData = await applyTransformationPipeline(sourceData, endpoint.transform_config, supabase);
        }
        // Try to extract array of items
        let items = sourceData;
        if (!Array.isArray(items)) {
          // Look for common array patterns
          items = sourceData.items || sourceData.data || sourceData.results || sourceData.articles || [];
        }
        if (Array.isArray(items)) {
          allItems = items.map((item)=>({
              title: item.title || '',
              description: item.description || item.summary || '',
              link: item.link || item.url || '',
              pubDate: formatDate(item.pubDate || item.date || item.created_at) || new Date().toUTCString(),
              guid: item.guid || item.id || item.link || Math.random().toString()
            }));
        }
      }
    }
  }
  // Apply total items limit
  if (maxTotalItems > 0) {
    allItems = allItems.slice(0, maxTotalItems);
  }
  console.log(`Generating RSS with ${allItems.length} total items`);
  // Generate RSS XML
  const rssXML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXML(channelTitle)}</title>
    <description>${escapeXML(channelDescription)}</description>
    <link>${escapeXML(channelLink)}</link>
    <generator>API Builder</generator>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${allItems.map((item)=>`
    <item>
      <title>${escapeXML(item.title)}</title>
      <description>${escapeXML(item.description)}</description>
      <link>${escapeXML(item.link)}</link>
      <guid isPermaLink="false">${escapeXML(item.guid)}</guid>
      <pubDate>${item.pubDate}</pubDate>
      ${item.author ? `<author>${escapeXML(item.author)}</author>` : ""}
      ${item.category ? `<category>${escapeXML(item.category)}</category>` : ""}
      ${item._sourceName ? `<source url="${escapeXML(channelLink)}">${escapeXML(item._sourceName)}</source>` : ""}
    </item>`).join("")}
  </channel>
</rss>`;
  return rssXML;
}
// Generate JSON response
async function generateJSONResponse(endpoint, dataSources, supabase) {
  // Handle different possible schema config structures
  const schemaConfig = endpoint.schema_config || {};
  const metadata = schemaConfig.schema?.metadata || schemaConfig.metadata || {};
  console.log("Schema config structure:", {
    hasSchema: !!schemaConfig.schema,
    hasMetadata: !!metadata,
    hasJsonMappingConfig: !!metadata.jsonMappingConfig,
    fieldMappingsCount: metadata.jsonMappingConfig?.fieldMappings?.length || 0
  });
  // Check if JSON mapping config exists (don't require jsonConfigMode)
  const jsonMappingConfig = metadata.jsonMappingConfig;
  // Use advanced mapping if jsonMappingConfig exists and has field mappings
  if (jsonMappingConfig && jsonMappingConfig.fieldMappings && jsonMappingConfig.fieldMappings.length > 0) {
    console.log("Using advanced JSON field mapping (detected from jsonMappingConfig presence)");
    let result = await generateAdvancedJSONResponse(endpoint, dataSources, supabase, jsonMappingConfig);
    result = deepCleanObject(result);
    return result;
  }
  // Original JSON generation logic (backward compatibility)
  console.log("Using standard JSON generation");
  let results = {};
  // Check for concatenations/relationships
  const concatenations = endpoint.concatenations || [];
  const relationships = endpoint.relationships || [];
  if (concatenations.length > 0) {
    // Handle concatenated sources
    for (const concat of concatenations){
      const combinedData = [];
      for (const sourceId of concat.sources){
        const source = dataSources.find((ds)=>ds.id === sourceId);
        if (!source) continue;
        const data = await fetchDataFromSource(source, supabase);
        if (Array.isArray(data)) {
          combinedData.push(...data);
        }
      }
      // Apply merge strategy
      let merged = combinedData;
      if (concat.merge_strategy === "union" && concat.deduplicate) {
        // Remove duplicates based on field
        const seen = new Set();
        merged = combinedData.filter((item)=>{
          const key = concat.deduplicate_field ? item[concat.deduplicate_field] : JSON.stringify(item);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
      results.data = merged;
    }
  } else {
    // Fetch data from each source
    for (const source of dataSources){
      const data = await fetchDataFromSource(source, supabase);
      results[source.name] = data;
    }
  }
  // Apply simple wrapper if configured
  if (metadata.rootWrapper && metadata.rootWrapper !== "data") {
    const wrapped = {};
    if (metadata.includeMetadata) {
      wrapped.metadata = {
        timestamp: new Date().toISOString(),
        sources: dataSources.map((ds)=>({
            id: ds.id,
            name: ds.name,
            type: ds.type
          })),
        count: Array.isArray(results.data) ? results.data.length : Object.keys(results).length
      };
    }
    wrapped[metadata.rootWrapper] = results;
    results = deepCleanObject(wrapped);
  }
  results = deepCleanObject(results);
  return results;
}
async function generateAdvancedJSONResponse(endpoint, dataSources, supabase, mappingConfig) {
  console.log("Advanced JSON Mapping Config:", JSON.stringify(mappingConfig, null, 2));
  // Validate mapping configuration
  if (!mappingConfig || !mappingConfig.fieldMappings || mappingConfig.fieldMappings.length === 0) {
    console.error("No field mappings configured");
    return {
      error: "No field mappings configured"
    };
  }
  // Check if we have multiple sources (multi-source mode)
  const sources = mappingConfig.sourceSelection?.sources || [];
  const mergeMode = mappingConfig.sourceSelection?.mergeMode || "single";
  console.log(`Processing ${sources.length} sources in ${mergeMode} mode`);
  // MULTI-SOURCE COMBINED MODE
  if (mergeMode === "combined" && sources.length > 1) {
    console.log("Using combined multi-source mode");
    let allItems = [];
    // Collect items from each source
    for (const sourceConfig of sources){
      const dataSource = dataSources.find((ds)=>ds.id === sourceConfig.id);
      if (!dataSource) {
        console.log(`Data source not found: ${sourceConfig.id}`);
        continue;
      }
      console.log(`Fetching from source: ${dataSource.name}`);
      let sourceData = await fetchDataFromSource(dataSource, supabase);
      if (!sourceData) {
        console.log(`No data from source: ${dataSource.name}`);
        continue;
      }
      // Apply transformations to the FULL source data BEFORE navigation
      if (endpoint.transform_config?.transformations) {
        console.log(`Applying transformations to source data from ${dataSource.name}...`);
        sourceData = await applyTransformationPipeline(sourceData, endpoint.transform_config, supabase);
      }
      // Navigate to primary path if specified
      let dataToProcess = sourceData;
      if (sourceConfig.primaryPath) {
        console.log(`Navigating to path: ${sourceConfig.primaryPath}`);
        dataToProcess = getValueFromPath(sourceData, sourceConfig.primaryPath);
      }
      // Add source tracking to each item
      if (Array.isArray(dataToProcess)) {
        dataToProcess.forEach((item)=>{
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
        console.log(`Added ${dataToProcess.length} items from ${dataSource.name}`);
      } else if (dataToProcess && typeof dataToProcess === "object") {
        // Handle single object as one item
        allItems.push({
          ...dataToProcess,
          _sourceInfo: {
            id: dataSource.id,
            name: dataSource.name,
            type: dataSource.type,
            category: dataSource.category
          }
        });
        console.log(`Added single object from ${dataSource.name}`);
      }
    }
    console.log(`Total items to map: ${allItems.length}`);
    // Apply field mappings to combined items
    const mappedData = allItems.map((item, index)=>{
      const result = {};
      const mappingsByTarget = {};
      mappingConfig.fieldMappings.forEach((mapping)=>{
        const targetPath = mapping.targetPath;
        if (!mappingsByTarget[targetPath]) {
          mappingsByTarget[targetPath] = [];
        }
        mappingsByTarget[targetPath].push(mapping);
      });
      for (const [targetPath, mappings] of Object.entries(mappingsByTarget)){
        const matchingMapping = mappings.find((m)=>m.sourceId === item._sourceInfo.id);
        if (matchingMapping) {
          let value;
          // Handle metadata fields
          if (matchingMapping.sourcePath.startsWith('_source.')) {
            const metadataKey = matchingMapping.sourcePath.substring(8);
            value = getSourceMetadataValue(metadataKey, item._sourceInfo);
          } else {
            // FIX: Check if we need to adjust the path
            let adjustedPath = matchingMapping.sourcePath;
            // Find the source config to check if it has a primaryPath
            const sourceConfig = sources.find((s)=>s.id === matchingMapping.sourceId);
            if (sourceConfig && sourceConfig.primaryPath) {
              // Remove the primaryPath prefix if it exists in the sourcePath
              const primaryPathPrefix = sourceConfig.primaryPath + '.';
              const primaryPathArrayPrefix = sourceConfig.primaryPath + '[*].';
              if (adjustedPath.startsWith(primaryPathArrayPrefix)) {
                // "articles[*].title" -> "title"
                adjustedPath = adjustedPath.substring(primaryPathArrayPrefix.length);
              } else if (adjustedPath.startsWith(primaryPathPrefix)) {
                // "articles.title" -> "title"
                adjustedPath = adjustedPath.substring(primaryPathPrefix.length);
              }
            }
            value = getValueFromPath(item, adjustedPath);
          }
          // ... rest of the mapping logic (transformations, conditionals, etc.)
          setValueAtPath(result, targetPath, value);
        }
      }
      return result;
    });
    console.log(`Mapped ${mappedData.length} items`);
    // Apply output wrapper if configured
    const wrapperConfig = mappingConfig.outputWrapper || mappingConfig.outputTemplate?.wrapperConfig;
    if (wrapperConfig?.enabled) {
      console.log("Applying output wrapper");
      const wrappedOutput = {};
      // Add metadata if enabled
      if (wrapperConfig.includeMetadata) {
        const metadata = {};
        if (wrapperConfig.metadataFields?.timestamp !== false) {
          metadata.timestamp = new Date().toISOString();
        }
        if (wrapperConfig.metadataFields?.source !== false) {
          metadata.sources = sources.map((s)=>({
              id: s.id,
              name: s.name,
              type: s.type,
              category: s.category
            }));
          // Add source counts
          metadata.sourceCounts = {};
          sources.forEach((source)=>{
            metadata.sourceCounts[source.name] = allItems.filter((item)=>item._sourceInfo.id === source.id).length;
          });
        }
        if (wrapperConfig.metadataFields?.count !== false) {
          metadata.count = mappedData.length;
          metadata.totalCount = allItems.length;
        }
        if (wrapperConfig.metadataFields?.version) {
          metadata.version = "1.0.0";
        }
        wrappedOutput.metadata = metadata;
      }
      // Add the data with the specified wrapper key
      wrappedOutput[wrapperConfig.wrapperKey || "data"] = mappedData;
      return wrappedOutput;
    }
    return deepCleanObject(mappedData);
  } else if (mergeMode === "separate" && sources.length > 1) {
    // SEPARATE MODE: Keep each source's data separate
    console.log("Using separate multi-source mode");
    const result = {};
    for (const sourceConfig of sources){
      const dataSource = dataSources.find((ds)=>ds.id === sourceConfig.id);
      if (!dataSource) continue;
      const sourceData = await fetchDataFromSource(dataSource, supabase);
      if (!sourceData) continue;
      let dataToProcess = sourceData;
      if (sourceConfig.primaryPath) {
        dataToProcess = getValueFromPath(sourceData, sourceConfig.primaryPath);
      }
      // Apply mappings for this source only
      let mappedData;
      if (Array.isArray(dataToProcess)) {
        mappedData = dataToProcess.map((item)=>{
          const mappedItem = {};
          // Only use mappings for this source
          const sourceMappings = mappingConfig.fieldMappings.filter((m)=>m.sourceId === sourceConfig.id);
          sourceMappings.forEach((mapping)=>{
            let value = getValueFromPath(item, mapping.sourcePath);
            // Apply transformations, conditionals, etc.
            setValueAtPath(mappedItem, mapping.targetPath, value);
          });
          return mappedItem;
        });
      } else {
        mappedData = dataToProcess;
      }
      // Use custom key or source name
      const key = dataSource.name || dataSource.id;
      result[key] = mappedData;
    }
    // Add metadata if configured
    const wrapperConfig = mappingConfig.outputWrapper;
    if (wrapperConfig?.includeMetadata) {
      result.metadata = {
        timestamp: new Date().toISOString(),
        sources: sources.map((s)=>({
            id: s.id,
            name: s.name
          }))
      };
    }
    return deepCleanObject(result);
  } else {
    // SINGLE SOURCE MODE (your existing code)
    console.log("Using single source mode (backward compatible)");
    const sourceId = mappingConfig.sourceSelection?.sources?.[0]?.id;
    if (!sourceId) {
      console.error("No source selected in mapping configuration");
      return {
        error: "No source configured for mapping"
      };
    }
    const dataSource = dataSources.find((ds)=>ds.id === sourceId);
    if (!dataSource) {
      console.error("Data source not found:", sourceId);
      return {
        error: "Data source not found"
      };
    }
    // Rest of your existing single-source code...
    const sourceMetadata = {
      id: dataSource.id,
      name: dataSource.name,
      type: dataSource.type,
      category: dataSource.category || dataSource.config?.category,
      metadata: dataSource.metadata || {},
      fetchedAt: new Date().toISOString()
    };
    let sourceData = await fetchDataFromSource(dataSource, supabase);
    if (!sourceData) {
      console.error("Failed to fetch data from source");
      return {
        error: "Failed to fetch data from source"
      };
    }
    // Apply transformations to FULL source data
    if (endpoint.transform_config?.transformations) {
      console.log("Applying transformations to source data...");
      sourceData = await applyTransformationPipeline(sourceData, endpoint.transform_config, supabase);
    }
    let dataToMap = sourceData;
    if (mappingConfig.sourceSelection.primaryPath) {
      dataToMap = getValueFromPath(sourceData, mappingConfig.sourceSelection.primaryPath);
    }
    // Apply mappings
    let mappedData;
    if (mappingConfig.sourceSelection.type === "array" && Array.isArray(dataToMap)) {
      mappedData = dataToMap.map((item, index)=>{
        const result = applyFieldMappings(item, mappingConfig.fieldMappings, sourceMetadata, mappingConfig.transformations);
        // Check first item after mapping
        if (index === 0) {
          console.log("=== AFTER MAPPING ===");
          console.log("First mapped item:", JSON.stringify(result, null, 2).substring(0, 200));
        }
        return result;
      });
    } else {
      mappedData = applyFieldMappings(dataToMap, mappingConfig.fieldMappings, sourceMetadata, mappingConfig.transformations);
    }
    // Apply output wrapper if configured
    const wrapperConfig = mappingConfig.outputWrapper || mappingConfig.outputTemplate?.wrapperConfig;
    if (wrapperConfig?.enabled) {
      const wrappedOutput = {};
      if (wrapperConfig.includeMetadata) {
        const metadata = {};
        if (wrapperConfig.metadataFields?.timestamp !== false) {
          metadata.timestamp = new Date().toISOString();
        }
        if (wrapperConfig.metadataFields?.source !== false) {
          metadata.source = {
            id: sourceMetadata.id,
            name: sourceMetadata.name,
            type: sourceMetadata.type,
            category: sourceMetadata.category
          };
        }
        if (wrapperConfig.metadataFields?.count !== false && Array.isArray(mappedData)) {
          metadata.count = mappedData.length;
        }
        if (wrapperConfig.metadataFields?.version) {
          metadata.version = "1.0.0";
        }
        wrappedOutput.metadata = metadata;
      }
      wrappedOutput[wrapperConfig.wrapperKey || "data"] = mappedData;
      return deepCleanObject(wrappedOutput);
    }
    return deepCleanObject(mappedData);
  }
}
function applyFieldMappings(sourceItem, mappings, sourceMetadata, transformations) {
  console.log("Applying field mappings, count:", mappings?.length || 0);
  // IMPORTANT: Start with empty object, not source data
  const result = {};
  if (!mappings || mappings.length === 0) {
    console.warn("No mappings provided, returning empty object");
    return result;
  }
  // Process each mapping
  for (const mapping of mappings){
    console.log(`Processing mapping: ${mapping.sourcePath} -> ${mapping.targetPath}`);
    let value;
    // Handle source metadata fields (_source.*)
    if (mapping.sourcePath.startsWith("_source.")) {
      const metadataKey = mapping.sourcePath.substring(8);
      console.log("Getting metadata value for key:", metadataKey);
      value = getSourceMetadataValue(metadataKey, sourceMetadata);
      console.log("Metadata value:", value);
    } else {
      // Regular data field
      value = getValueFromPath(sourceItem, mapping.sourcePath);
      console.log(`Field value for ${mapping.sourcePath}:`, value);
    }
    // CLEAN THE VALUE HERE
    if (typeof value === "string") {
      value = cleanEncodingIssues(value);
    }
    // Apply transformation if specified
    if (mapping.transformId && transformations) {
      const transform = transformations.find((t)=>t.id === mapping.transformId);
      if (transform) {
        console.log("Applying transformation:", transform.type);
        value = applyTransformation(value, transform);
      }
    }
    // Apply conditional logic
    if (mapping.conditional) {
      console.log("Applying conditional logic");
      const conditionValue = mapping.conditional.when.startsWith("_source.") ? getSourceMetadataValue(mapping.conditional.when.substring(8), sourceMetadata) : getValueFromPath(sourceItem, mapping.conditional.when);
      if (evaluateCondition(conditionValue, mapping.conditional.operator, mapping.conditional.value)) {
        value = mapping.conditional.then;
      } else if (mapping.conditional.else !== undefined) {
        value = mapping.conditional.else;
      }
    }
    // Use fallback value if null/undefined
    if (value === null || value === undefined) {
      if (mapping.fallbackValue !== undefined) {
        console.log("Using fallback value:", mapping.fallbackValue);
        value = mapping.fallbackValue;
      }
    }
    // Clean again after all transformations
    if (typeof value === "string") {
      value = cleanEncodingIssues(value);
    }
    // Set the value at the target path
    console.log(`Setting ${mapping.targetPath} = ${value}`);
    setValueAtPath(result, mapping.targetPath, value);
  }
  console.log("Final mapped result:", result);
  return result;
}
// Get source metadata value
function getSourceMetadataValue(key, metadata) {
  switch(key){
    case "id":
      return metadata.id;
    case "name":
      return metadata.name;
    case "type":
      return metadata.type;
    case "category":
      return metadata.category;
    case "timestamp":
      return metadata.fetchedAt;
    default:
      // Check for nested metadata
      if (key.startsWith("metadata.")) {
        const nestedKey = key.substring(9);
        return metadata.metadata?.[nestedKey];
      }
      return null;
  }
}
// Set value at nested path
function setValueAtPath(obj, path, value) {
  const parts = path.split(".");
  let current = obj;
  for(let i = 0; i < parts.length - 1; i++){
    const part = parts[i];
    if (!current[part]) {
      current[part] = {};
    }
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
}
// Evaluate conditional operators
function evaluateCondition(value, operator, compareValue) {
  switch(operator){
    case "equals":
      return value === compareValue;
    case "not_equals":
      return value !== compareValue;
    case "contains":
      return String(value).includes(String(compareValue));
    case "greater_than":
      return Number(value) > Number(compareValue);
    case "less_than":
      return Number(value) < Number(compareValue);
    case "exists":
      return value !== null && value !== undefined;
    case "not_exists":
      return value === null || value === undefined;
    default:
      return false;
  }
}
// Fetch data from a single data source
async function fetchDataFromSource(dataSource, supabase, requestHost) {
  try {
    console.log(`Fetching data from source: ${dataSource.name} (${dataSource.type})`);
    if (dataSource.type === "api") {
      const apiConfig = dataSource.api_config || dataSource.config?.api_config;
      if (!apiConfig?.url) {
        console.log("No API URL configured");
        return null;
      }
      let url = apiConfig.url;
      // Handle dynamic host replacement
      if (url.startsWith("/")) {
        // Use the request origin if available
        const host = requestHost || Deno.env.get("DEFAULT_DATA_HOST") || "http://localhost:5173";
        url = `${host}${url}`;
      } else if (url.includes("{{HOST}}")) {
        // Replace template variable
        const host = requestHost || Deno.env.get("DEFAULT_DATA_HOST") || "http://localhost:5173";
        url = url.replace("{{HOST}}", host);
      }
      console.log(`Fetching from API: ${url}`);
      // Add proper encoding headers
      const headers = {
        ...apiConfig.headers || {},
        "Accept-Charset": "utf-8"
      };
      const response = await fetch(url, {
        method: apiConfig.method || "GET",
        headers: headers,
        body: apiConfig.body ? JSON.stringify(apiConfig.body) : undefined
      });
      if (!response.ok) {
        console.error(`API fetch failed for ${dataSource.name}:`, response.statusText);
        return null;
      }
      // Check content type
      const contentType = response.headers.get("content-type") || "";
      console.log("Content type:", contentType);
      let data;
      if (contentType.includes("application/json")) {
        data = await response.json();
        if (data.articles && data.articles[0]) {
          console.log("First article title after parse:", data.articles[0].title);
        }
      } else if (contentType.includes("text/") || contentType.includes("application/rss") || contentType.includes("application/xml")) {
        // For text content, use proper UTF-8 decoding
        const buffer = await response.arrayBuffer();
        const decoder = new TextDecoder("utf-8");
        let textData = decoder.decode(buffer);
        // Clean encoding issues immediately after fetching
        textData = cleanEncodingIssues(textData);
        // If it's RSS/XML, parse it
        if (contentType.includes("rss") || contentType.includes("xml")) {
          // For RSS, we need to parse and clean the content
          data = parseAndCleanRSS(textData);
        } else {
          // Try to parse as JSON if possible
          try {
            data = JSON.parse(textData);
          } catch  {
            data = textData;
          }
        }
      } else {
        // Default to text
        const textData = await response.text();
        data = cleanEncodingIssues(textData);
      }
      // Navigate to data path if specified
      /*if (apiConfig.data_path) {
        const result = getValueFromPath(data, apiConfig.data_path);
        console.log('After navigation:', result[0]?.title);
        return result;
      }*/ return data;
    } else if (dataSource.type === "database") {
      // Your existing database code
      const dbConfig = dataSource.database_config || dataSource.config?.database_config;
      if (!dbConfig?.query) return null;
      const { data, error } = await supabase.rpc("execute_query", {
        query: dbConfig.query,
        params: dbConfig.params || {}
      });
      if (error) {
        console.error(`Database query failed for ${dataSource.name}:`, error);
        return null;
      }
      return data;
    } else if (dataSource.type === "rss") {
      // Fetch and parse RSS feed with encoding fix
      const rssConfig = dataSource.rss_config || dataSource.config?.rss_config;
      if (!rssConfig?.feed_url) return null;
      const response = await fetch(rssConfig.feed_url, {
        headers: {
          "Accept-Charset": "utf-8"
        }
      });
      // Use proper UTF-8 decoding
      const buffer = await response.arrayBuffer();
      const decoder = new TextDecoder("utf-8");
      let xml = decoder.decode(buffer);
      // Clean encoding issues
      xml = cleanEncodingIssues(xml);
      // Parse RSS
      return parseAndCleanRSS(xml);
    } else if (dataSource.type === "file") {
      // Your existing file handling code
      const fileConfig = dataSource.file_config || dataSource.config?.file_config;
      if (!fileConfig?.url) return null;
      const response = await fetch(fileConfig.url);
      if (fileConfig.format === "json") {
        return await response.json();
      } else if (fileConfig.format === "csv") {
        const text = await response.text();
        // Basic CSV parsing
        const lines = text.split("\n");
        const headers = lines[0].split(",").map((h)=>h.trim());
        const data = [];
        for(let i = 1; i < lines.length; i++){
          if (!lines[i].trim()) continue;
          const values = lines[i].split(",").map((v)=>v.trim());
          const row = {};
          headers.forEach((header, index)=>{
            row[header] = values[index];
          });
          data.push(row);
        }
        return data;
      }
      return null;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching data from ${dataSource.name}:`, error);
    return null;
  }
}
// Apply merge strategy to items
function applyMergeStrategy(items, strategy) {
  console.log(`Applying merge strategy: ${strategy}`);
  switch(strategy){
    case "chronological":
      // Sort by date (newest first)
      return items.sort((a, b)=>{
        const dateA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
        const dateB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
        return dateB - dateA;
      });
    case "interleaved":
      // Interleave items from different sources
      const sourceGroups = {};
      // Group by source
      items.forEach((item)=>{
        const sourceId = item._sourceId || "default";
        if (!sourceGroups[sourceId]) sourceGroups[sourceId] = [];
        sourceGroups[sourceId].push(item);
      });
      // Interleave
      const interleaved = [];
      const maxLength = Math.max(...Object.values(sourceGroups).map((g)=>g.length));
      for(let i = 0; i < maxLength; i++){
        for(const sourceId in sourceGroups){
          if (sourceGroups[sourceId][i]) {
            interleaved.push(sourceGroups[sourceId][i]);
          }
        }
      }
      return interleaved;
    case "priority":
      // Keep original order (sources are already in priority order)
      return items;
    case "sequential":
    default:
      // Default sequential (no change needed)
      return items;
  }
}
// Helper function to get nested value from object
function getValueFromPath(obj, path) {
  if (!path || !obj) return obj;
  const parts = path.split(".");
  let current = obj;
  for (const part of parts){
    if (current === null || current === undefined) return null;
    current = current[part];
  }
  // If the result is a string, ensure it's not corrupted
  if (typeof current === "string") {
    // Check if it contains corruption patterns
    if (current.includes("â€")) {
      console.warn("Corruption detected in getValueFromPath:", current);
      // Try to clean it
      current = current.replace(/â€™/g, "'").replace(/â€˜/g, "'").replace(/â€œ/g, '"').replace(/â€/g, '"').replace(/â€"/g, "—");
    }
  }
  return current;
}
// Helper function to escape XML special characters
function escapeXML(str) {
  if (!str) return "";
  // First, clean up any encoding issues
  let cleaned = String(str);
  // Fix common Windows-1252 to UTF-8 conversion issues using Map to avoid duplicates
  const encodingFixes = new Map([
    // Curly quotes and apostrophes
    [
      "â€™",
      "'"
    ],
    [
      "â€˜",
      "'"
    ],
    [
      "â€œ",
      '"'
    ],
    [
      "â€",
      '"'
    ],
    // Em dash (only one entry for â€" to avoid duplicate key)
    [
      'â€"',
      "—"
    ],
    // Other common issues
    [
      "â€¦",
      "…"
    ],
    [
      "â€¢",
      "•"
    ],
    [
      "â€‰",
      " "
    ],
    [
      "Â ",
      " "
    ],
    // Accented characters
    [
      "Ã©",
      "é"
    ],
    [
      "Ã¨",
      "è"
    ],
    [
      "Ã¢",
      "â"
    ],
    [
      "Ã´",
      "ô"
    ],
    [
      "Ã§",
      "ç"
    ],
    [
      "Ã±",
      "ñ"
    ],
    [
      "Ã¼",
      "ü"
    ],
    [
      "Ã¶",
      "ö"
    ],
    [
      "Ã¤",
      "ä"
    ],
    [
      "Ã",
      "í"
    ],
    [
      "Ã¡",
      "á"
    ],
    [
      "Ã³",
      "ó"
    ],
    [
      "Ãº",
      "ú"
    ],
    [
      "Ã€",
      "À"
    ],
    [
      "Ã‰",
      "É"
    ],
    [
      "Ãˆ",
      "È"
    ],
    [
      "Ã‚",
      "Â"
    ],
    [
      "ÃŠ",
      "Ê"
    ],
    [
      'Ã"',
      "Ô"
    ],
    [
      "Ã‡",
      "Ç"
    ],
    // Special characters
    [
      "Ã…",
      "Å"
    ],
    [
      "Ã†",
      "Æ"
    ],
    [
      "Ã˜",
      "Ø"
    ]
  ]);
  // Also handle direct Unicode characters
  const unicodeFixes = new Map([
    [
      "\u2018",
      "'"
    ],
    [
      "\u2019",
      "'"
    ],
    [
      "\u201C",
      '"'
    ],
    [
      "\u201D",
      '"'
    ],
    [
      "\u2014",
      "—"
    ],
    [
      "\u2013",
      "–"
    ],
    [
      "\u2026",
      "…"
    ],
    [
      "\u2022",
      "•"
    ],
    [
      "\u00A0",
      " "
    ]
  ]);
  // Apply encoding fixes
  for (const [pattern, replacement] of encodingFixes){
    cleaned = cleaned.split(pattern).join(replacement);
  }
  // Apply Unicode fixes
  for (const [pattern, replacement] of unicodeFixes){
    cleaned = cleaned.split(pattern).join(replacement);
  }
  // Remove any remaining artifacts
  cleaned = cleaned.replace(/â€[\x80-\x9F]/g, "") // Remove other Windows-1252 artifacts
  .replace(/Â[\x80-\x9F]/g, "") // Remove non-breaking space artifacts
  .replace(/Ã[\x80-\xBF](?![a-zA-Z])/g, ""); // Remove other UTF-8 decoding artifacts (preserve valid accented chars)
  // Then escape XML special characters
  return cleaned.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
// Helper function to extract value from XML
function extractXMLValue(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\/${tag}>`)) || xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\/${tag}>`));
  return match ? match[1].trim() : "";
}
// Helper function to format dates
function formatDate(date) {
  if (!date) return new Date().toUTCString();
  try {
    const d = new Date(date);
    return d.toUTCString();
  } catch  {
    return new Date().toUTCString();
  }
}
function cleanEncodingIssues(text) {
  if (!text || typeof text !== "string") return text;
  let cleaned = text;
  // Multi-pass cleaning to catch all variations
  const maxPasses = 3;
  for(let pass = 0; pass < maxPasses; pass++){
    const previousCleaned = cleaned;
    // Fix the most common UTF-8/Windows-1252 issues
    cleaned = cleaned // Single quotes (these are the most problematic)
    .replace(/â€™/g, "'") // Right single quote
    .replace(/â€˜/g, "'") // Left single quote
    .replace(/â€'/g, "'") // Generic quote corruption
    .replace(/â€™/g, "'") // Another variant
    .replace(/â€˜/g, "'") // Another variant
    // Double quotes
    .replace(/â€œ/g, '"') // Left double quote
    .replace(/â€/g, '"') // Right double quote
    .replace(/â€"/g, '"') // Another variant
    .replace(/Ã¢â‚¬Å"/g, '"') // Triple-encoded left quote
    .replace(/Ã¢â‚¬/g, '"') // Triple-encoded right quote
    // Dashes
    .replace(/â€"/g, "—") // Em dash
    .replace(/â€"/g, "–") // En dash variant
    .replace(/Ã¢â‚¬â€œ/g, "–") // Triple-encoded dash
    // Other punctuation
    .replace(/â€¦/g, "…") // Ellipsis
    .replace(/â€¢/g, "•") // Bullet
    // Spaces
    .replace(/Â /g, " ") // Non-breaking space
    .replace(/â€‰/g, " ") // Thin space
    .replace(/Ã‚Â /g, " ") // Double-encoded space
    // Common accented characters
    .replace(/Ã©/g, "é").replace(/Ã¨/g, "è").replace(/Ã¢/g, "â").replace(/Ã´/g, "ô").replace(/Ã§/g, "ç").replace(/Ã±/g, "ñ").replace(/Ã¼/g, "ü").replace(/Ã¶/g, "ö").replace(/Ã¤/g, "ä").replace(/Ã¡/g, "á").replace(/Ã³/g, "ó").replace(/Ãº/g, "ú").replace(/Ã/g, "í");
    // If nothing changed, we're done
    if (cleaned === previousCleaned) break;
  }
  // Final cleanup of any remaining artifacts
  cleaned = cleaned.replace(/â€[\x00-\xFF]/g, "") // Remove any remaining â€ sequences
  .replace(/Ã¢[\x00-\xFF][\x00-\xFF]/g, "") // Remove triple-encoded sequences
  .replace(/Â[\x00-\xFF]/g, function(match) {
    // Only remove if it's a corruption, not legitimate text
    if (match === "Â " || match === "Â") return "";
    return match;
  });
  // Handle HTML entities if present
  cleaned = cleaned.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&#8217;/g, "'") // Right single quote entity
  .replace(/&#8216;/g, "'") // Left single quote entity
  .replace(/&#8220;/g, '"') // Left double quote entity
  .replace(/&#8221;/g, '"'); // Right double quote entity
  return cleaned;
}
// Deep clean an object/array recursively
function deepCleanObject(obj) {
  if (typeof obj === "string") {
    return cleanEncodingIssues(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map((item)=>deepCleanObject(item));
  }
  if (obj && typeof obj === "object") {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)){
      cleaned[key] = deepCleanObject(value);
    }
    return cleaned;
  }
  return obj;
}
// Parse and clean RSS content
function parseAndCleanRSS(xml) {
  const items = [];
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
  for (const match of itemMatches){
    const itemXml = match[1];
    // Extract and clean each field
    const title = cleanEncodingIssues(extractXMLValue(itemXml, "title"));
    const description = cleanEncodingIssues(extractXMLValue(itemXml, "description"));
    const link = extractXMLValue(itemXml, "link");
    const pubDate = extractXMLValue(itemXml, "pubDate");
    const guid = extractXMLValue(itemXml, "guid");
    const author = cleanEncodingIssues(extractXMLValue(itemXml, "author"));
    const category = cleanEncodingIssues(extractXMLValue(itemXml, "category"));
    items.push({
      title: title || "",
      description: description || "",
      link: link || "",
      pubDate: pubDate || "",
      guid: guid || "",
      author: author || "",
      category: category || ""
    });
  }
  return items;
}
// ===== TRANSFORMATION PIPELINE FUNCTIONS =====
async function applyTransformationPipeline(data, transformConfig, supabase) {
  if (!transformConfig?.transformations || transformConfig.transformations.length === 0) {
    return data;
  }
  let result = data;
  // Process transformations in order
  for (const transformation of transformConfig.transformations){
    try {
      console.log(`Applying transformation: ${transformation.type}`);
      result = await applyTransformation(result, transformation, supabase);
    } catch (error) {
      console.error(`Transformation ${transformation.type} failed:`, error);
      // Decide whether to continue with partial result or throw
      // For now, let's continue with what we have
      console.warn("Continuing with partial transformation result");
    }
  }
  return result;
}
async function applyTransformation(data, transformation, supabase) {
  const { type, config = {} } = transformation;
  switch(type){
    // Array operations (work on arrays)
    case "filter":
      if (!Array.isArray(data)) return data;
      return data.filter((item)=>{
        const value = getValueFromPath(item, config.field);
        return evaluateConditionSimple(value, config.operator, config.value);
      });
    case "sort":
      if (!Array.isArray(data)) return data;
      return [
        ...data
      ].sort((a, b)=>{
        const aVal = getValueFromPath(a, config.field);
        const bVal = getValueFromPath(b, config.field);
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return config.order === "desc" ? -comparison : comparison;
      });
    case "limit":
      if (!Array.isArray(data)) return data;
      return data.slice(0, config.count || 10);
    case "unique":
      if (!Array.isArray(data)) return data;
      if (config.field) {
        const seen = new Set();
        return data.filter((item)=>{
          const value = getValueFromPath(item, config.field);
          if (seen.has(value)) return false;
          seen.add(value);
          return true;
        });
      }
      return [
        ...new Set(data)
      ];
    case "map":
      if (!Array.isArray(data)) return data;
      return data.map((item)=>{
        const mapped = {};
        for (const [newKey, oldPath] of Object.entries(config.fields || {})){
          mapped[newKey] = getValueFromPath(item, oldPath);
        }
        return mapped;
      });
    // Field operations
    case "add-field":
      if (Array.isArray(data)) {
        return data.map((item)=>({
            ...item,
            [config.field]: config.value
          }));
      }
      return {
        ...data,
        [config.field]: config.value
      };
    case "remove-field":
      if (Array.isArray(data)) {
        return data.map((item)=>{
          const copy = {
            ...item
          };
          delete copy[config.field];
          return copy;
        });
      }
      const copy = {
        ...data
      };
      delete copy[config.field];
      return copy;
    case "rename-field":
      if (Array.isArray(data)) {
        return data.map((item)=>{
          const copy = {
            ...item
          };
          if (config.from in copy) {
            copy[config.to] = copy[config.from];
            delete copy[config.from];
          }
          return copy;
        });
      }
      if (config.from in data) {
        const copy = {
          ...data
        };
        copy[config.to] = copy[config.from];
        delete copy[config.from];
        return copy;
      }
      return data;
    // String transformations
    case "uppercase":
    case "lowercase":
    case "capitalize":
    case "trim":
      if (Array.isArray(data)) {
        return data.map((item)=>transformField(item, config.field, (val)=>{
            const str = String(val);
            if (type === "uppercase") return str.toUpperCase();
            if (type === "lowercase") return str.toLowerCase();
            if (type === "capitalize") return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
            if (type === "trim") return str.trim();
            return str;
          }));
      }
      return transformField(data, config.field, (val)=>{
        const str = String(val);
        if (type === "uppercase") return str.toUpperCase();
        if (type === "lowercase") return str.toLowerCase();
        if (type === "capitalize") return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
        if (type === "trim") return str.trim();
        return str;
      });
    // Number operations
    case "round":
    case "floor":
    case "ceil":
      if (Array.isArray(data)) {
        return data.map((item)=>transformField(item, config.field, (val)=>{
            const num = Number(val);
            if (type === "round") return Math.round(num);
            if (type === "floor") return Math.floor(num);
            if (type === "ceil") return Math.ceil(num);
            return num;
          }));
      }
      return transformField(data, config.field, (val)=>{
        const num = Number(val);
        if (type === "round") return Math.round(num);
        if (type === "floor") return Math.floor(num);
        if (type === "ceil") return Math.ceil(num);
        return num;
      });
    // Aggregations
    case "count":
      if (!Array.isArray(data)) return {
        count: 1
      };
      return {
        count: data.length
      };
    case "sum":
      if (!Array.isArray(data)) return data;
      if (!config.field) {
        console.warn("Sum transformation requires a field");
        return data;
      }
      return {
        sum: data.reduce((acc, item)=>acc + Number(getValueFromPath(item, config.field) || 0), 0)
      };
    case "average":
      if (!Array.isArray(data)) return data;
      if (!config.field) {
        console.warn("Average transformation requires a field");
        return data;
      }
      const sum = data.reduce((acc, item)=>acc + Number(getValueFromPath(item, config.field) || 0), 0);
      return {
        average: data.length > 0 ? sum / data.length : 0
      };
    // AI transformation
    case "ai-transform":
      return await applyAITransformation(data, transformation, supabase);
    default:
      console.warn(`Unknown transformation type: ${type}`);
      return data;
  }
}
async function applyAITransformation(data, transformation, supabase) {
  const { config = {}, source_field } = transformation;
  console.log("=== AI TRANSFORMATION DEBUG ===");
  console.log("Transformation config:", JSON.stringify(transformation, null, 2));
  console.log("Data type:", Array.isArray(data) ? "array" : typeof data);
  console.log("Data length if array:", Array.isArray(data) ? data.length : "N/A");
  try {
    // Handle array wildcard notation like "articles[*].title"
    if (source_field && source_field.includes("[*]")) {
      console.log(`Processing array field with wildcard: ${source_field}`);
      // Parse "articles[*].title" -> arrayPath: "articles", fieldName: "title"
      const parts = source_field.split("[*].");
      const arrayPath = parts[0];
      const fieldName = parts[1] || "";
      console.log(`Array path: "${arrayPath}", Field name: "${fieldName}"`);
      // Get the array from the data
      let arrayData;
      if (arrayPath) {
        arrayData = getValueFromPath(data, arrayPath);
      } else {
        // If no array path (just "[*].field"), assume data itself is the array
        arrayData = data;
      }
      if (!Array.isArray(arrayData)) {
        console.warn(`Expected array at path "${arrayPath || "root"}", got:`, typeof arrayData);
        return data;
      }
      console.log(`Found array with ${arrayData.length} items`);
      // Process the array with field transformation
      const transformedArray = await processArrayFieldTransformation(arrayData, fieldName, config, supabase);
      // Put the transformed array back into the data structure
      if (arrayPath) {
        const result = JSON.parse(JSON.stringify(data)); // Deep clone
        setValueAtPath(result, arrayPath, transformedArray);
        return result;
      } else {
        return transformedArray;
      }
    }
    // Handle simple field notation when data is an array (e.g., "title" on array of items)
    if (source_field && Array.isArray(data) && !source_field.includes(".")) {
      console.log(`Processing simple field "${source_field}" on array of ${data.length} items`);
      return await processArrayFieldTransformation(data, source_field, config, supabase);
    }
    // Handle nested field notation (e.g., "metadata.description")
    if (source_field && Array.isArray(data) && source_field.includes(".")) {
      console.log(`Processing nested field "${source_field}" on array of ${data.length} items`);
      return await processArrayFieldTransformation(data, source_field, config, supabase);
    }
    // If no source_field specified, transform the entire dataset
    if (!source_field) {
      console.log("No source_field specified, transforming entire dataset");
      let prompt = config.prompt || "Transform this data";
      prompt = `Input data:\n${JSON.stringify(data, null, 2)}\n\nTask: ${prompt}`;
      if (config.outputFormat === "json") {
        prompt += "\n\nRespond with valid JSON only.";
      }
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const response = await supabase.functions.invoke("claude", {
        body: {
          prompt,
          systemPrompt: config.systemPrompt || "You are a data transformation assistant.",
          outputFormat: config.outputFormat
        },
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`
        }
      });
      if (response.error) {
        console.error("AI transformation error:", response.error);
        return data;
      }
      let result = response.data.response;
      // Parse result if needed
      if (typeof result === "string" && config.outputFormat === "json") {
        result = result.replace(/^```(?:json)?\s*\n?/i, "");
        result = result.replace(/\n?```\s*$/i, "");
        result = result.trim();
        try {
          result = JSON.parse(result);
        } catch (e) {
          console.error("Failed to parse JSON:", e);
          return data;
        }
      }
      return result;
    }
    // Fallback: return original data
    console.log("No matching transformation pattern, returning original data");
    return data;
  } catch (error) {
    console.error("AI transformation failed:", error);
    return data;
  }
}
// Separate function to handle array field transformations with batching
async function processArrayFieldTransformation(arrayData, fieldName, config, supabase) {
  console.log(`Processing ${arrayData.length} items for field: "${fieldName}"`);
  // Batching configuration
  const CLAUDE_RATE_LIMIT = 60; // requests per minute (adjust to your actual limit)
  const batchSize = config.batchSize || 5;
  const minDelayMs = 60 * 1000 / CLAUDE_RATE_LIMIT * batchSize; // milliseconds
  // Use the greater of user-configured delay or minimum required delay
  const delayBetweenBatches = Math.max(config.batchDelay || 1000, minDelayMs // But respect rate limits
  );
  const maxItems = config.maxItems || 50;
  const itemsToProcess = arrayData.slice(0, Math.min(arrayData.length, maxItems));
  const skippedCount = arrayData.length - itemsToProcess.length;
  if (skippedCount > 0) {
    console.warn(`Processing only first ${maxItems} items, skipping ${skippedCount} items`);
  }
  const results = [];
  // Process in batches
  for(let i = 0; i < itemsToProcess.length; i += batchSize){
    const batch = itemsToProcess.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(itemsToProcess.length / batchSize)}`);
    const batchResults = await Promise.all(batch.map(async (item)=>{
      // Get the field value from the item
      const fieldValue = fieldName ? getValueFromPath(item, fieldName) : item;
      if (fieldValue === null || fieldValue === undefined) {
        console.warn(`No value found for field "${fieldName}" in item`);
        return item;
      }
      let prompt = config.prompt || "Transform this value";
      prompt = `Value: ${JSON.stringify(fieldValue)}\n\nTask: ${prompt}`;
      if (config.outputFormat === "json") {
        prompt += "\n\nRespond with valid JSON only.";
      }
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      try {
        const response = await supabase.functions.invoke("claude", {
          body: {
            prompt,
            systemPrompt: config.systemPrompt || "You are a data transformation assistant.",
            outputFormat: config.outputFormat
          },
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`
          }
        });
        if (response.error) {
          console.error("AI transformation error for item:", response.error);
          return item;
        }
        let result = response.data.response;
        // Clean up the response
        if (typeof result === "string") {
          result = result.replace(/^```(?:json)?\s*\n?/i, "");
          result = result.replace(/\n?```\s*$/i, "");
          result = result.trim();
          try {
            const parsed = JSON.parse(result);
            // Extract value from common wrapper patterns
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
              const keys = Object.keys(parsed);
              if (keys.length === 1) {
                result = parsed[keys[0]];
              } else if (parsed.summary !== undefined) {
                result = parsed.summary;
              } else if (parsed.result !== undefined) {
                result = parsed.result;
              } else if (parsed.value !== undefined) {
                result = parsed.value;
              } else {
                result = parsed;
              }
            } else {
              result = parsed;
            }
          } catch (e) {
            console.error("Failed to parse JSON:", e);
          }
        }
        // Set the transformed value back into the item
        if (fieldName) {
          const newItem = JSON.parse(JSON.stringify(item)); // Deep clone
          setValueAtPath(newItem, fieldName, result);
          return newItem;
        } else {
          return result;
        }
      } catch (error) {
        console.error("AI transformation failed for item:", error);
        return item;
      }
    }));
    results.push(...batchResults);
    // Delay between batches
    if (i + batchSize < itemsToProcess.length) {
      console.log(`Waiting ${delayBetweenBatches}ms before next batch...`);
      await new Promise((resolve)=>setTimeout(resolve, delayBetweenBatches));
    }
  }
  // Add back any skipped items unchanged
  if (skippedCount > 0) {
    results.push(...arrayData.slice(maxItems));
  }
  return results;
}
// Helper function to transform a specific field
function transformField(obj, fieldPath, transformFn) {
  if (!fieldPath) return obj;
  const result = {
    ...obj
  };
  const parts = fieldPath.split(".");
  if (parts.length === 1) {
    result[fieldPath] = transformFn(result[fieldPath]);
    return result;
  }
  // Handle nested fields
  let current = result;
  for(let i = 0; i < parts.length - 1; i++){
    if (!(parts[i] in current)) return result;
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = transformFn(current[parts[parts.length - 1]]);
  return result;
}
// Simple condition evaluator (rename to avoid conflict with your existing evaluateCondition)
function evaluateConditionSimple(value, operator, compareValue) {
  switch(operator){
    case "equals":
      return value === compareValue;
    case "not_equals":
      return value !== compareValue;
    case "contains":
      return String(value).includes(compareValue);
    case "greater_than":
      return value > compareValue;
    case "less_than":
      return value < compareValue;
    case "starts_with":
      return String(value).startsWith(compareValue);
    case "ends_with":
      return String(value).endsWith(compareValue);
    case "is_empty":
      return !value || value === "";
    case "is_not_empty":
      return value && value !== "";
    default:
      return true;
  }
}
