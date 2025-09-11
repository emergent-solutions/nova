import { Anthropic } from 'npm:@anthropic-ai/sdk@0.18.0';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? ''
});
Deno.serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  try {
    // Only accept POST requests
    if (req.method !== "POST") {
      throw new Error(`Method ${req.method} not allowed`);
    }
    // Parse request body
    const { prompt } = await req.json();
    if (!prompt) {
      throw new Error('Prompt is required');
    }
    // Call Claude API
    const completion = await anthropic.messages.create({
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 1000,
      system: "You are an AI assistant helping to populate form fields based on user prompts. Respond with accurate, concise content formatted as a JSON object.",
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });
    // Extract the response text
    const responseText = completion.content[0].text;
    // Return the response
    return new Response(JSON.stringify({
      response: responseText
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      status: 200
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to call Claude API',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      status: 500
    });
  }
});
