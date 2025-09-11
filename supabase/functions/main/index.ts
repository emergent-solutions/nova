Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const path = url.pathname.split('/').filter(Boolean);
  
  // Extract function name
  const functionName = path[0] === 'v1' ? path[1] : path[0];
  
  console.log(`Request for function: ${functionName}`);
  
  // Handle root path
  if (!functionName) {
    return new Response(JSON.stringify({
      message: "Edge Functions are running",
      available_functions: ["claude", "analyze-csv-columns", "detect-file-format"]
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  
  // Try to import and run the function
  try {
    const functionPath = `/home/deno/functions/${functionName}/index.ts`;
    const module = await import(functionPath);
    return await module.default(req);
  } catch (error) {
    console.error(`Error loading function ${functionName}:`, error);
    return new Response(JSON.stringify({
      error: `Function ${functionName} not found or has errors`,
      details: error.message
    }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }
});
