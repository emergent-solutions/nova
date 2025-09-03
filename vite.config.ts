// vite.config.ts
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createClient } from '@supabase/supabase-js';

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
              
              const supabase = createClient(
                env.VITE_SUPABASE_URL,
                env.VITE_SUPABASE_ANON_KEY
              );
              
              try {
                // Get endpoint config
                const { data: endpoint } = await supabase
                  .from('api_endpoints')
                  .select('*')
                  .eq('slug', slug)
                  .eq('active', true)
                  .single();

                if (!endpoint) {
                  res.statusCode = 404;
                  res.end(JSON.stringify({ error: 'Endpoint not found' }));
                  return;
                }

                // Fetch from Edge Function
                const response = await fetch(
                  `${env.VITE_SUPABASE_URL}/functions/v1/api-endpoints/${slug}`,
                  {
                    headers: {
                      'Authorization': `Bearer ${env.VITE_SUPABASE_ANON_KEY}`
                    }
                  }
                );
                
                const data = await response.text();

                // Set content type
                let contentType = 'application/json';
                if (['xml', 'rss'].includes(endpoint.output_format?.toLowerCase())) {
                  contentType = 'application/xml';
                } else if (endpoint.output_format === 'csv') {
                  contentType = 'text/csv';
                }

                res.setHeader('Content-Type', contentType);
                res.statusCode = response.status;
                res.end(data);
              } catch (error) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'Internal server error' }));
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