import { Anthropic } from 'npm:@anthropic-ai/sdk@0.18.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? ''
});

Deno.serve(async (req) => {
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

    // Parse request body - now flexible to accept different parameters
    const body = await req.json();
    const { prompt, systemPrompt, outputFormat } = body;
    
    console.log('📨 Claude Function - Request received:', {
      hasPrompt: !!prompt,
      promptLength: prompt?.length,
      hasSystemPrompt: !!systemPrompt,
      systemPromptLength: systemPrompt?.length,
      outputFormat: outputFormat || 'not specified'
    });
    
    if (!prompt) {
      throw new Error('Prompt is required');
    }

    // Check if API key is configured
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      console.error('❌ ANTHROPIC_API_KEY is not configured');
      throw new Error('ANTHROPIC_API_KEY is not configured in environment variables');
    }
    console.log('✅ API Key found, length:', apiKey.length);

    // Determine the system prompt to use
    let system: string;
    if (systemPrompt) {
      // Use provided system prompt
      system = systemPrompt;
      console.log('📝 Using provided system prompt');
    } else if (outputFormat === 'json') {
      // Default for JSON output
      system = "You are a helpful AI assistant. Respond with valid JSON only, no explanations or markdown formatting.";
      console.log('📝 Using JSON default system prompt');
    } else {
      // Default system prompt
      system = "You are an AI assistant helping to populate form fields based on user prompts. Respond with accurate, concise content.";
      console.log('📝 Using default system prompt');
    }

    // Adjust prompt based on outputFormat if not already included
    let finalPrompt = prompt;
    if (outputFormat === 'json' && !prompt.toLowerCase().includes('json')) {
      finalPrompt = `${prompt}\n\nRespond with valid JSON only, no explanations or markdown formatting.`;
      console.log('🔧 Added JSON instruction to prompt');
    }

    console.log('🚀 Calling Claude API with:', {
      model: 'claude-3-sonnet-20240229',
      promptLength: finalPrompt.length,
      systemLength: system.length,
      outputFormat: outputFormat || 'text',
      promptPreview: finalPrompt.substring(0, 100) + '...',
      systemPreview: system.substring(0, 100) + '...'
    });

    // Call Claude API with correct model name
    const completion = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      temperature: 0.7,
      system: system,
      messages: [
        {
          role: 'user',
          content: finalPrompt
        }
      ]
    });

    // Extract the response text
    const responseText = completion.content[0]?.text || '';
    
    console.log('✅ Claude response received:', {
      responseLength: responseText.length,
      responsePreview: responseText.substring(0, 200) + '...',
      usage: completion.usage
    });

    // Return the response
    return new Response(
      JSON.stringify({
        response: responseText,
        usage: completion.usage // Include token usage if needed
      }), 
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 200
      }
    );
  } catch (error) {
    console.error('❌ Claude Edge Function Error:', error);
    console.error('Error stack:', error.stack);
    
    // More detailed error handling
    let errorMessage = 'Failed to call Claude API';
    let errorDetails = error instanceof Error ? error.message : 'Unknown error';
    let statusCode = 500;
    
    if (errorDetails.includes('Connection error') || errorDetails.includes('error sending request')) {
      errorMessage = 'Failed to connect to Claude API';
      errorDetails = 'Please check your ANTHROPIC_API_KEY environment variable';
      console.error('🔌 Connection error - likely API key issue');
    } else if (errorDetails.includes('model')) {
      errorMessage = 'Invalid model specified';
      errorDetails = 'Please check the model name in the edge function';
      console.error('🤖 Model error - check model name');
    } else if (errorDetails.includes('rate limit')) {
      errorMessage = 'Rate limit exceeded';
      statusCode = 429;
      console.error('⏱️ Rate limit hit');
    }
    
    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: errorDetails
      }), 
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: statusCode
      }
    );
  }
});