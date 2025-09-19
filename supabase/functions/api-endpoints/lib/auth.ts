// Authentication validation
export async function validateRequest(
  req: Request,
  endpoint: any,
  supabase: any
): Promise<{ valid: boolean; message: string }> {
  const authConfig = endpoint.auth_config;
  
  if (!authConfig?.required) {
    return { valid: true, message: "OK" };
  }

  const authHeader = req.headers.get("authorization");
  
  switch (authConfig.type) {
    case "none":
      return { valid: true, message: "OK" };
      
    case "api-key":
      const apiKey = req.headers.get(authConfig.config?.header || "x-api-key");
      if (!apiKey) {
        return { valid: false, message: "API key required" };
      }
      
      // Validate API key against stored keys
      const { data: validKey } = await supabase
        .from("api_keys")
        .select("*")
        .eq("endpoint_id", endpoint.id)
        .eq("key", apiKey)
        .eq("active", true)
        .single();
        
      if (!validKey) {
        return { valid: false, message: "Invalid API key" };
      }
      
      // Update last used timestamp
      await supabase
        .from("api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", validKey.id);
        
      return { valid: true, message: "OK" };
      
    case "bearer":
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return { valid: false, message: "Bearer token required" };
      }
      
      const token = authHeader.substring(7);
      
      // Validate token (custom logic or Supabase auth)
      try {
        const { data: user, error } = await supabase.auth.getUser(token);
        if (error || !user) {
          return { valid: false, message: "Invalid token" };
        }
        return { valid: true, message: "OK" };
      } catch {
        return { valid: false, message: "Invalid token" };
      }
      
    case "basic":
      if (!authHeader || !authHeader.startsWith("Basic ")) {
        return { valid: false, message: "Basic authentication required" };
      }
      
      const encoded = authHeader.substring(6);
      const decoded = atob(encoded);
      const [username, password] = decoded.split(":");
      
      // Validate credentials
      const validUser = authConfig.config?.username === username;
      const validPass = authConfig.config?.password === password;
      
      if (!validUser || !validPass) {
        return { valid: false, message: "Invalid credentials" };
      }
      
      return { valid: true, message: "OK" };
      
    default:
      return { valid: false, message: "Unknown authentication type" };
  }
}