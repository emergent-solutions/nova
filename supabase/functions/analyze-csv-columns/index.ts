// Edge Function: supabase/functions/analyze-csv-columns/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const { sample, hasHeaders } = await req.json();
    if (!sample || !Array.isArray(sample) || sample.length === 0) {
      throw new Error('Invalid sample data');
    }
    // Prepare data for Claude
    const sampleText = sample.slice(0, 10).map((row)=>Array.isArray(row) ? row.join('\t') : Object.values(row).join('\t')).join('\n');
    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('CLAUDE_API_KEY') || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-opus-20240229',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: `Analyze this CSV/TSV data and suggest appropriate column names.
          
The data ${hasHeaders ? 'has' : 'does not have'} headers.
Sample data (tab-separated):
${sampleText}

Please analyze each column and suggest descriptive names based on the data patterns. Consider:
1. Data types (numbers, dates, emails, URLs, etc.)
2. Value patterns and formats
3. Potential business meaning

Return a JSON object with:
- columnNames: array of suggested names
- columnTypes: array of detected types (string, number, date, email, url, etc.)
- confidence: your confidence level (0-1)
- reasoning: brief explanation of your suggestions`
          }
        ]
      })
    });
    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }
    const claudeResponse = await response.json();
    const content = claudeResponse.content[0].text;
    // Parse Claude's response
    let suggestions;
    try {
      // Extract JSON from Claude's response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse Claude response');
      }
    } catch (err) {
      // Fallback parsing
      suggestions = {
        columnNames: [],
        columnTypes: [],
        confidence: 0.5,
        reasoning: 'Could not parse AI response'
      };
    }
    return new Response(JSON.stringify({
      success: true,
      suggestions
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
