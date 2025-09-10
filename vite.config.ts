// vite.config.ts
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [
      react(),
      {
        name: 'api-proxy',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url?.startsWith('/api/')) {
              const slug = req.url.replace('/api/', '').split('?')[0];
              console.log('Proxying request to:', slug);
              console.log('Client headers:', req.headers);
              
              try {
                // Create headers object from the incoming request
                const headers: Record<string, string> = {
                  // Add Supabase auth
                  'Authorization': `Bearer ${env.VITE_SUPABASE_ANON_KEY}`,
                };
                
                // Forward custom headers (including X-API-Key)
                const headersToSkip = ['host', 'connection', 'upgrade', 'cache-control', 'content-length'];
                Object.entries(req.headers).forEach(([key, value]) => {
                  if (!headersToSkip.includes(key.toLowerCase()) && typeof value === 'string') {
                    headers[key] = value;
                  }
                });
                
                // Read body if present
                let body: Buffer | undefined = undefined;
                if (req.method !== 'GET' && req.method !== 'HEAD') {
                  body = await new Promise<Buffer>((resolve) => {
                    const chunks: Buffer[] = [];
                    req.on('data', (chunk: Buffer) => chunks.push(chunk));
                    req.on('end', () => resolve(Buffer.concat(chunks)));
                  });
                  
                  // Set content-length for the body we're sending
                  if (body) {
                    headers['Content-Length'] = body.length.toString();
                  }
                }
                
                console.log('Headers being sent to Edge Function:', headers);
                console.log('Body length:', body?.length);
                
                // Make request to Edge Function
                const response = await fetch(
                  `${env.VITE_SUPABASE_URL}/functions/v1/api-endpoints/${slug}`,
                  {
                    method: req.method || 'GET',
                    headers,
                    // Convert Buffer to Uint8Array for fetch API
                    body: body ? new Uint8Array(body) : undefined
                  }
                );
                
                const data = await response.text();
                
                // Forward response headers correctly
                response.headers.forEach((value, key) => {
                  // Skip some headers that shouldn't be forwarded
                  if (!['content-encoding', 'transfer-encoding'].includes(key.toLowerCase())) {
                    res.setHeader(key, value);
                  }
                });
                
                res.statusCode = response.status;
                res.end(data);
              } catch (error) {
                console.error('Proxy error:', error);
                res.statusCode = 500;
                res.end(JSON.stringify({ 
                  error: 'Proxy error', 
                  details: error instanceof Error ? error.message : String(error) 
                }));
              }
            } else {
              next();
            }
          });
        }
      }
    ],
    server: {
      host: '0.0.0.0'
    }
  };
});