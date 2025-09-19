// Caching manager
export const cacheManager = {
  async get(key: string, supabase: any): Promise<Response | null> {
    try {
      const { data, error } = await supabase
        .from("api_cache")
        .select("*")
        .eq("cache_key", key)
        .gte("expires_at", new Date().toISOString())
        .single();
      
      if (error || !data) {
        return null;
      }
      
      // Update hit count
      await supabase
        .from("api_cache")
        .update({ 
          hit_count: data.hit_count + 1,
          last_accessed_at: new Date().toISOString()
        })
        .eq("id", data.id);
      
      // Reconstruct response
      return new Response(data.response_body, {
        status: data.response_status || 200,
        headers: data.response_headers || {}
      });
      
    } catch (error) {
      console.error("Cache get error:", error);
      return null;
    }
  },
  
  async set(
    key: string,
    response: Response,
    ttl: number,
    supabase: any
  ): Promise<void> {
    try {
      // Clone response to read it
      const clonedResponse = response.clone();
      const body = await clonedResponse.text();
      
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      
      const expiresAt = new Date(Date.now() + ttl * 1000);
      
      await supabase
        .from("api_cache")
        .upsert({
          cache_key: key,
          response_body: body,
          response_status: response.status,
          response_headers: headers,
          expires_at: expiresAt.toISOString(),
          hit_count: 0,
          created_at: new Date().toISOString(),
          last_accessed_at: new Date().toISOString()
        }, {
          onConflict: "cache_key"
        });
        
    } catch (error) {
      console.error("Cache set error:", error);
    }
  },
  
  async invalidate(patterns: string[], supabase: any): Promise<void> {
    try {
      for (const pattern of patterns) {
        await supabase
          .from("api_cache")
          .delete()
          .like("cache_key", pattern);
      }
    } catch (error) {
      console.error("Cache invalidate error:", error);
    }
  }
};