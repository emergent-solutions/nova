// vite.config.ts
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'http';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [
      react(),
      {
        name: 'api-proxy',
        configureServer(server) {
          server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
            if (req.url?.startsWith('/api/')) {
              const slug = req.url.replace('/api/', '').split('?')[0];
              const queryString = req.url.includes('?') ? req.url.split('?')[1] : '';
              
              console.log('Proxying request to:', slug);
              console.log('Query string:', queryString);
              
              try {
                // Create headers object from the incoming request
                const headers: Record<string, string> = {
                  // Add Supabase auth
                  'Authorization': `Bearer ${env.VITE_SUPABASE_ANON_KEY}`,
                  // Ensure we accept all content types
                  'Accept': req.headers.accept || '*/*',
                };
                
                // Forward custom headers (including X-API-Key)
                const headersToSkip = ['host', 'connection', 'content-length', 'transfer-encoding'];
                Object.entries(req.headers).forEach(([key, value]) => {
                  if (!headersToSkip.includes(key.toLowerCase()) && typeof value === 'string') {
                    headers[key] = value;
                  }
                });
                
                // Read body if present
                let body: Buffer | undefined = undefined;
                if (req.method !== 'GET' && req.method !== 'HEAD') {
                  body = await new Promise<Buffer>((resolve, reject) => {
                    const chunks: Buffer[] = [];
                    req.on('data', (chunk: Buffer) => chunks.push(chunk));
                    req.on('end', () => resolve(Buffer.concat(chunks)));
                    req.on('error', reject);
                  });
                  
                  // Set content headers for the body
                  if (body && body.length > 0) {
                    headers['Content-Length'] = body.length.toString();
                    // Set content-type if not already set
                    if (!headers['Content-Type'] && !headers['content-type']) {
                      headers['Content-Type'] = 'application/json';
                    }
                  }
                }
                
                console.log('Headers being sent to Edge Function:', headers);
                console.log('Body length:', body?.length || 0);
                
                // Construct the full URL with query string
                const targetUrl = `${env.VITE_SUPABASE_URL}/functions/v1/api-endpoints/${slug}${queryString ? '?' + queryString : ''}`;
                console.log('Target URL:', targetUrl);
                
                // Make request to Edge Function
                const response = await fetch(targetUrl, {
                  method: req.method || 'GET',
                  headers,
                  // Use body directly if it exists
                  body: body || undefined,
                });
                
                console.log('Response status:', response.status);
                
                // Get response as ArrayBuffer for binary safety
                const responseBuffer = await response.arrayBuffer();
                const responseData = Buffer.from(responseBuffer);
                
                console.log('Response size:', responseData.length, 'bytes');
                
                // Forward response headers, but carefully handle content-length
                const responseHeaders: Record<string, string> = {};
                let hasContentLength = false;
                
                response.headers.forEach((value, key) => {
                  const lowerKey = key.toLowerCase();
                  
                  // Skip headers that could cause issues
                  if (['content-encoding', 'transfer-encoding', 'connection'].includes(lowerKey)) {
                    return;
                  }
                  
                  // Handle content-length specially to avoid duplicates
                  if (lowerKey === 'content-length') {
                    hasContentLength = true;
                    // Use our calculated length instead of the original
                    responseHeaders[key] = responseData.length.toString();
                  } else {
                    responseHeaders[key] = value;
                  }
                });
                
                // Only add Content-Length if it wasn't in the original headers
                if (!hasContentLength) {
                  responseHeaders['Content-Length'] = responseData.length.toString();
                }
                
                // Log the headers we're about to send
                console.log('Response headers to client:', responseHeaders);
                
                // Write headers
                res.writeHead(response.status, responseHeaders);
                
                // Write the complete response
                res.end(responseData);
                
              } catch (error) {
                console.error('Proxy error:', error);
                
                const errorResponse = JSON.stringify({
                  error: 'Proxy error',
                  details: error instanceof Error ? error.message : String(error),
                  stack: error instanceof Error ? error.stack : undefined,
                });
                
                res.writeHead(500, {
                  'Content-Type': 'application/json',
                  'Content-Length': Buffer.byteLength(errorResponse).toString(),
                });
                res.end(errorResponse);
              }
            } else {
              next();
            }
          });
        }
      }
    ],
    server: {
      host: '0.0.0.0',
      // Add CORS headers if needed
      cors: true,
    }
  };
});