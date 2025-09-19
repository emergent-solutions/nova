// Main entry point - handles routing and orchestration
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { corsHeaders } from "./lib/cors.ts";
import { generateRSSFeed } from "./formatters/rss.ts";
import { generateJSONResponse } from "./formatters/json.ts";
import { generateXMLResponse } from "./formatters/xml.ts";
import { generateCSVResponse } from "./formatters/csv.ts";
import { validateRequest } from "./lib/auth.ts";
import { rateLimiter } from "./lib/rate-limiter.ts";
import { cacheManager } from "./lib/cache.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    
    if (pathParts.length < 2 || pathParts[0] !== "api-endpoints") {
      return new Response(
        JSON.stringify({ error: "Invalid endpoint path" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const endpointSlug = pathParts[1];
    
    // Check cache first
    const cachedResponse = await cacheManager.get(endpointSlug, supabase);
    if (cachedResponse) {
      console.log("Returning cached response");
      return cachedResponse;
    }

    // Fetch endpoint configuration with sources
    const { data: endpoint, error: endpointError } = await supabase
      .from("api_endpoints")
      .select(`
        *,
        api_endpoint_sources (
          *,
          data_source:data_sources (*)
        )
      `)
      .eq("slug", endpointSlug)
      .eq("active", true)
      .single();

    if (endpointError || !endpoint) {
      return new Response(
        JSON.stringify({ error: "Endpoint not found or inactive" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate authentication if required
    if (endpoint.auth_config?.required) {
      const authResult = await validateRequest(req, endpoint, supabase);
      if (!authResult.valid) {
        return new Response(
          JSON.stringify({ error: authResult.message }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Apply rate limiting
    if (endpoint.rate_limit_config?.enabled) {
      const rateLimitResult = await rateLimiter.check(req, endpoint, supabase);
      if (!rateLimitResult.allowed) {
        return new Response(
          JSON.stringify({ 
            error: "Rate limit exceeded",
            remaining: rateLimitResult.remaining,
            resetAt: rateLimitResult.resetAt
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Extract data sources from the joined data
    const dataSources = endpoint.api_endpoint_sources
      ?.map((s: any) => s.data_source)
      ?.filter(Boolean) || [];

    console.log(`Processing endpoint: ${endpoint.name} with ${dataSources.length} sources`);

    // Generate response based on format
    let response: Response;
    
    switch (endpoint.output_format) {
      case "rss":
        console.log("Generating RSS feed...");
        response = await generateRSSFeed(endpoint, dataSources, supabase);
        break;
        
      case "json":
        console.log("Generating JSON response...");
        response = await generateJSONResponse(endpoint, dataSources, supabase);
        break;
        
      case "xml":
        console.log("Generating XML response...");
        response = await generateXMLResponse(endpoint, dataSources, supabase);
        break;
        
      case "csv":
        console.log("Generating CSV response...");
        response = await generateCSVResponse(endpoint, dataSources, supabase);
        break;
        
      default:
        response = new Response(
          JSON.stringify({ 
            error: `Unsupported format: ${endpoint.output_format}`,
            supportedFormats: ["json", "rss", "xml", "csv"]
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    // Cache the response if caching is enabled
    if (endpoint.cache_config?.enabled && response.status === 200) {
      await cacheManager.set(
        endpointSlug, 
        response.clone(), 
        endpoint.cache_config.ttl || 3600, 
        supabase
      );
    }

    // Log access
    try {
      await supabase.from("api_access_logs").insert({
        endpoint_id: endpoint.id,
        method: req.method,
        user_agent: req.headers.get("user-agent"),
        ip_address: req.headers.get("x-forwarded-for") || 
                   req.headers.get("x-real-ip") || 
                   "unknown",
        response_status: response.status,
        created_at: new Date().toISOString()
      });
    } catch (logError) {
      console.error("Failed to log access:", logError);
      // Don't fail the request if logging fails
    }

    return response;
    
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error",
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});