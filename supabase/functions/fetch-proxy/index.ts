// File: supabase/functions/fetch-proxy/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({
        error: 'Method not allowed'
      }), {
        status: 405,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({
        error: 'No authorization header'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Parse request body
    const { url, method = 'GET', headers = {}, body = null } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({
        error: 'URL is required'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Validate URL
    try {
      new URL(url);
    } catch  {
      return new Response(JSON.stringify({
        error: 'Invalid URL'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Security: Optionally restrict to certain domains
    const allowedDomains = Deno.env.get('ALLOWED_PROXY_DOMAINS')?.split(',') || [];
    if (allowedDomains.length > 0) {
      const urlObj = new URL(url);
      if (!allowedDomains.some((domain)=>urlObj.hostname.endsWith(domain))) {
        return new Response(JSON.stringify({
          error: 'Domain not allowed'
        }), {
          status: 403,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
    }
    console.log('Request details:', {
      url,
      method,
      headers: {
        ...headers,
        'User-Agent': headers['User-Agent'] || 'Mozilla/5.0 (compatible; Supabase Edge Function/1.0)'
      }
    });
    const cleanHeaders = {};
    for (const [key, value] of Object.entries(headers)){
      const lowercaseKey = key.toLowerCase();
      // Skip headers that shouldn't be forwarded to external APIs
      if (![
        'authorization',
        'x-client-info',
        'apikey',
        'host',
        'origin',
        'referer'
      ].includes(lowercaseKey)) {
        cleanHeaders[key] = value;
      }
    }
    // Add Accept-Charset to request UTF-8
    cleanHeaders['Accept-Charset'] = 'utf-8';
    console.log(`Proxying request to: ${url}`);
    // Make the external request    
    const proxyResponse = await fetch(url, {
      method,
      headers: {
        //'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        //'Accept': 'application/json',
        ...cleanHeaders
      },
      body: body ? JSON.stringify(body) : null
    });
    // Get response content type
    const contentType = proxyResponse.headers.get('content-type') || 'text/plain';
    let responseData;
    if (contentType.includes('application/json')) {
      responseData = await proxyResponse.json();
    } else if (contentType.includes('text/') || contentType.includes('application/rss') || contentType.includes('application/xml')) {
      // For text-based content, ensure proper UTF-8 decoding
      const buffer = await proxyResponse.arrayBuffer();
      const decoder = new TextDecoder('utf-8');
      responseData = decoder.decode(buffer);
      // Clean up common encoding issues
      responseData = cleanEncodingIssues(responseData);
    } else {
      // For other content types, return as text
      responseData = await proxyResponse.text();
    }
    // Return the proxied response
    return new Response(JSON.stringify({
      status: proxyResponse.status,
      statusText: proxyResponse.statusText,
      headers: Object.fromEntries(proxyResponse.headers.entries()),
      contentType,
      data: responseData,
      // For file content, include some metadata
      metadata: {
        size: typeof responseData === 'string' ? responseData.length : JSON.stringify(responseData).length,
        url: url,
        fetchedAt: new Date().toISOString()
      }
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json; charset=utf-8'
      }
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(JSON.stringify({
      error: 'Proxy request failed',
      details: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
// Helper function to clean up common encoding issues
function cleanEncodingIssues(text) {
  // Use a map for replacements to avoid parsing issues
  const replacementMap = new Map([
    // Curly quotes and apostrophes (corrupted UTF-8)
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
    // Spaces and breaks (corrupted UTF-8)
    [
      "â€‰",
      " "
    ],
    // Other punctuation (corrupted UTF-8)
    [
      "â€¦",
      "…"
    ],
    [
      "â€¢",
      "•"
    ],
    // Common accented characters (corrupted UTF-8)
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
    // Ligatures and special characters (corrupted UTF-8)
    [
      "Ã†",
      "Æ"
    ],
    [
      "Ã˜",
      "Ø"
    ],
    [
      "Ã…",
      "Å"
    ],
    // Currency and symbols (corrupted UTF-8)
    [
      "â‚¬",
      "€"
    ],
    [
      "Â£",
      "£"
    ],
    [
      "Â¥",
      "¥"
    ],
    [
      "Â¢",
      "¢"
    ],
    [
      "Â©",
      "©"
    ],
    [
      "Â®",
      "®"
    ],
    [
      "Â°",
      "°"
    ],
    [
      "Â±",
      "±"
    ],
    [
      "Â¶",
      "¶"
    ],
    [
      "Â§",
      "§"
    ],
    [
      "Âµ",
      "µ"
    ],
    // Fractions (corrupted UTF-8)
    [
      "Â¼",
      "¼"
    ],
    [
      "Â½",
      "½"
    ],
    [
      "Â¾",
      "¾"
    ],
    // Mathematical symbols (corrupted UTF-8)
    [
      "Ã—",
      "×"
    ],
    [
      "Ã·",
      "÷"
    ]
  ]);
  // Also handle direct Unicode characters
  const unicodeMap = new Map([
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
    ],
    [
      "\u2122",
      "™"
    ],
    [
      "\u0152",
      "Œ"
    ],
    [
      "\u0153",
      "œ"
    ],
    [
      "\u221E",
      "∞"
    ],
    [
      "\u2260",
      "≠"
    ],
    [
      "\u2264",
      "≤"
    ],
    [
      "\u2265",
      "≥"
    ]
  ]);
  let cleaned = text;
  // Apply corrupted UTF-8 replacements
  for (const [pattern, replacement] of replacementMap){
    cleaned = cleaned.split(pattern).join(replacement);
  }
  // Apply Unicode replacements
  for (const [pattern, replacement] of unicodeMap){
    cleaned = cleaned.split(pattern).join(replacement);
  }
  // Remove any remaining artifacts using regex patterns
  cleaned = cleaned.replace(/â€[\x80-\x9F]/g, '') // Remove other Windows-1252 artifacts
  .replace(/Â[\x80-\x9F]/g, '') // Remove non-breaking space artifacts
  .replace(/Ã[\x80-\xBF](?![a-zA-Z])/g, ''); // Remove other UTF-8 decoding artifacts (but preserve valid accented chars)
  // Fix any double-encoded entities
  cleaned = cleaned.replace(/&amp;amp;/g, '&amp;').replace(/&amp;lt;/g, '&lt;').replace(/&amp;gt;/g, '&gt;').replace(/&amp;quot;/g, '&quot;').replace(/&amp;#39;/g, '&#39;').replace(/&amp;apos;/g, '&apos;');
  return cleaned;
}
