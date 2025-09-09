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
                  // Add content-type if present
                  ...(req.headers['content-type'] ? { 'Content-Type': req.headers['content-type'] } : {}),
                };
                
                // Forward custom headers (including X-API-Key)
                // Copy all headers except the ones we don't want to forward
                const headersToSkip = ['host', 'connection', 'upgrade', 'cache-control'];
                
                Object.entries(req.headers).forEach(([key, value]) => {
                  if (!headersToSkip.includes(key.toLowerCase()) && typeof value === 'string') {
                    headers[key] = value;
                  }
                });
                
                console.log('Headers being sent to Edge Function:', headers);
                
                // Read body if present
                let body = undefined;
                if (req.method !== 'GET' && req.method !== 'HEAD') {
                  body = await new Promise<Buffer>((resolve) => {
                    const chunks: Buffer[] = [];
                    req.on('data', (chunk: Buffer) => chunks.push(chunk));
                    req.on('end', () => resolve(Buffer.concat(chunks)));
                  });
                }
                
                // Make request to Edge Function
                const response = await fetch(
                  `${env.VITE_SUPABASE_URL}/functions/v1/api-endpoints/${slug}`,
                  {
                    method: req.method || 'GET',
                    headers,
                    body
                  }
                );
                
                const data = await response.text();
                
                // Forward response headers
                Object.entries(response.headers.entries()).forEach(([key, value]) => {
                  res.setHeader(key, value);
                });
                
                res.statusCode = response.status;
                res.end(data);
              } catch (error) {
                console.error('Proxy error:', error);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'Proxy error', details: error.message }));
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