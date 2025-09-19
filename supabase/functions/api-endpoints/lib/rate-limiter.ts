// Rate limiting logic
interface RateLimitResult {
  allowed: boolean;
  remaining?: number;
  resetAt?: Date;
}

export const rateLimiter = {
  async check(
    req: Request,
    endpoint: any,
    supabase: any
  ): Promise<RateLimitResult> {
    const config = endpoint.rate_limit_config;
    
    if (!config?.enabled) {
      return { allowed: true };
    }
    
    // Get client identifier
    const clientId = config.per_user
      ? req.headers.get("x-user-id") || req.headers.get("x-api-key")
      : req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "anonymous";
    
    const windowStart = new Date(Date.now() - 60000); // 1 minute window
    const cacheKey = `rate_limit:${endpoint.id}:${clientId}`;
    
    // Check current request count
    const { data: requests, error } = await supabase
      .from("api_access_logs")
      .select("id")
      .eq("endpoint_id", endpoint.id)
      .eq("ip_address", clientId)
      .gte("created_at", windowStart.toISOString());
    
    if (error) {
      console.error("Rate limit check error:", error);
      return { allowed: true }; // Fail open
    }
    
    const requestCount = requests?.length || 0;
    const limit = config.requests_per_minute || 60;
    
    if (requestCount >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(Date.now() + 60000)
      };
    }
    
    return {
      allowed: true,
      remaining: limit - requestCount - 1,
      resetAt: new Date(Date.now() + 60000)
    };
  }
};