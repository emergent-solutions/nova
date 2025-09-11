import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }

  try {
    // Get test parameters from request
    const { config, params, headers, method, body } = await req.json();
    
    if (!config) {
      return new Response(
        JSON.stringify({ error: 'No configuration provided' }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Start timing
    const startTime = Date.now();

    // Fetch data from each configured source
    const allData = {};
    
    // Process data sources if they exist
    const dataSources = config.data_sources || config.dataSources; // Check both
    if (dataSources && Array.isArray(dataSources)) {
    console.log('Processing', dataSources.length, 'data sources');
    for (const source of dataSources){
        try {
        console.log('Processing source:', source.name);
        const sourceData = await fetchDataFromSource(source, supabaseClient, params, headers, method, body);
        console.log('Source data retrieved:', sourceData ? 'Success' : 'Empty');
        allData[source.id || source.name] = sourceData;
        } catch (error) {
        console.error(`Error fetching from source ${source.name}:`, error);
        allData[source.id || source.name] = {
            error: error.message,
            source: source.name
        };
        }
    }
    console.log('All data keys:', Object.keys(allData));
    } else {
    console.log('No data sources found in config');
    }

    // Apply transformations if configured
    let transformedData = allData;
    if (config.transformations && config.transformations.length > 0) {
      transformedData = await applyTransformations(allData, config.transformations);
    }

    // Format response based on output format
    const formattedResponse = await formatResponse(config, transformedData);
    
    // Calculate response time
    const responseTime = Date.now() - startTime;

    // Return test results
    return new Response(
      JSON.stringify({
        success: true,
        response: formattedResponse.body ? JSON.parse(formattedResponse.body) : formattedResponse,
        status: 200,
        headers: {
          'Content-Type': formattedResponse.contentType || 'application/json',
          'X-Response-Time': `${responseTime}ms`
        },
        responseTime
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error('Test error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Test failed',
        status: 500
      }),
      {
        status: 200, // Return 200 even for test errors so the UI can handle it
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});

async function fetchDataFromSource(
  source: any,
  supabase: any,
  params?: Record<string, any>,
  headers?: Record<string, string>,
  method?: string,
  body?: any
) {
  switch (source.type) {
    case 'api':
      // Build URL with params if it's a GET request
      let url = source.api_config?.endpoint || source.api_config?.url || source.config?.url;
      console.log('API URL found:', url);
      console.log('Full api_config:', JSON.stringify(source.api_config, null, 2));
      
      if (!url) throw new Error('No URL configured for API source');
      
      if (params && Object.keys(params).length > 0 && (!method || method === 'GET')) {
        const queryString = new URLSearchParams(params).toString();
        url += (url.includes('?') ? '&' : '?') + queryString;
      }
      
      // Merge headers
      const apiHeaders = {
        ...source.api_config?.headers || source.config?.headers || {},
        ...headers || {}
      };
      console.log('Request headers:', apiHeaders);
      
      // Make the API request
      const apiMethod = method || source.api_config?.method || source.config?.method || 'GET';
      console.log('Request method:', apiMethod);
      
      const requestOptions = {
        method: apiMethod,
        headers: apiHeaders
      };
      
      // Add body for non-GET requests
      if (body && apiMethod !== 'GET' && apiMethod !== 'DELETE') {
        requestOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
      }
      
      console.log('Making request to:', url);
      const response = await fetch(url, requestOptions);
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      
      const contentType = response.headers.get('content-type');
      console.log('Response content-type:', contentType);
      
      let data;
      if (contentType?.includes('application/json')) {
        data = await response.json();
        console.log('Parsed JSON data keys:', Object.keys(data));
        console.log('Data sample:', JSON.stringify(data).substring(0, 500));
      } else if (contentType?.includes('text/')) {
        data = await response.text();
        console.log('Text data length:', data.length);
      } else {
        data = await response.blob();
        console.log('Blob data size:', data.size);
      }
      
      // Navigate to data path if specified
      if (source.api_config?.data_path || source.config?.data_path) {
        const dataPath = source.api_config?.data_path || source.config?.data_path;
        console.log('Navigating to data path:', dataPath);
        const parts = dataPath.split('.');
        let current = data;
        for (const part of parts){
          console.log('Accessing:', part, 'Current type:', typeof current);
          current = current?.[part];
        }
        console.log('Final data after path navigation:', current ? 'Found' : 'Not found');
        return current;
      }
      
      return data;
    case 'database':
      // For database sources, we might want to execute a test query
      const dbConfig = source.database_config || source.config;
      if (!dbConfig) {
        throw new Error('No database configuration found');
      }

      // This would depend on your database setup
      // For now, returning mock data
      return {
        message: 'Database query would be executed here',
        config: dbConfig
      };

    case 'rss':
      // Fetch RSS feed
      const rssUrl = source.rss_config?.url || source.config?.url;
      if (!rssUrl) throw new Error('No URL configured for RSS source');
      
      const rssResponse = await fetch(rssUrl);
      const rssText = await rssResponse.text();
      
      // Parse RSS (simplified - you might want to use a proper RSS parser)
      return parseRSS(rssText);

    case 'file':
      // Handle file sources
      const fileConfig = source.file_config || source.config;
      if (fileConfig?.url) {
        const fileResponse = await fetch(fileConfig.url);
        const fileContent = await fileResponse.text();
        
        // Parse based on format
        if (fileConfig.format === 'json') {
          return JSON.parse(fileContent);
        } else if (fileConfig.format === 'csv') {
          return parseCSV(fileContent);
        }
        return fileContent;
      }
      return { message: 'File source configured but no URL provided' };

    default:
      return { message: `Unsupported source type: ${source.type}` };
  }
}

async function applyTransformations(data: any, transformations: any[]): Promise<any> {
  let result = data;
  
  for (const transformation of transformations) {
    switch (transformation.type) {
      case 'filter':
        // Apply filter transformation
        if (Array.isArray(result)) {
          result = result.filter((item: any) => {
            // Simple filter implementation
            return evaluateCondition(item, transformation.config);
          });
        }
        break;
        
      case 'map':
        // Apply mapping transformation
        if (Array.isArray(result)) {
          result = result.map((item: any) => {
            return applyMapping(item, transformation.config);
          });
        }
        break;
        
      case 'aggregate':
        // Apply aggregation
        result = applyAggregation(result, transformation.config);
        break;
        
      default:
        console.warn(`Unknown transformation type: ${transformation.type}`);
    }
  }
  
  return result;
}

function evaluateCondition(item: any, config: any): boolean {
  // Simple condition evaluation
  if (!config || !config.field || !config.operator) return true;
  
  const value = item[config.field];
  const compareValue = config.value;
  
  switch (config.operator) {
    case 'equals':
      return value === compareValue;
    case 'not_equals':
      return value !== compareValue;
    case 'contains':
      return String(value).includes(compareValue);
    case 'greater_than':
      return value > compareValue;
    case 'less_than':
      return value < compareValue;
    default:
      return true;
  }
}

function applyMapping(item: any, config: any): any {
  if (!config || !config.fields) return item;
  
  const mapped: any = {};
  for (const [newKey, oldKey] of Object.entries(config.fields)) {
    mapped[newKey] = item[oldKey];
  }
  return mapped;
}

function applyAggregation(data: any, config: any): any {
  if (!Array.isArray(data) || !config) return data;
  
  switch (config.function) {
    case 'count':
      return { count: data.length };
    case 'sum':
      if (!config.field) return data;
      return {
        sum: data.reduce((acc: number, item: any) => acc + (Number(item[config.field]) || 0), 0)
      };
    case 'average':
      if (!config.field) return data;
      const sum = data.reduce((acc: number, item: any) => acc + (Number(item[config.field]) || 0), 0);
      return { average: sum / data.length };
    default:
      return data;
  }
}

async function formatResponse(config: any, data: any) {
  const outputFormat = config.output_format || 'json';
  
  switch (outputFormat) {
    case 'rss':
      return {
        body: generateRSSFeed(config, data),
        contentType: 'application/rss+xml'
      };
      
    case 'xml':
      return {
        body: generateXML(data),
        contentType: 'application/xml'
      };
      
    case 'csv':
      return {
        body: generateCSV(data),
        contentType: 'text/csv'
      };
      
    case 'json':
    default:
      return {
        body: JSON.stringify(data),
        contentType: 'application/json'
      };
  }
}

function generateRSSFeed(config: any, data: any): string {
  const metadata = config.schema_config?.metadata || {};
  
  let rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(metadata.channelTitle || 'Test Feed')}</title>
    <description>${escapeXml(metadata.channelDescription || 'Test API Feed')}</description>
    <link>${escapeXml(metadata.channelLink || 'https://example.com')}</link>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
`;

  // Add items if data is an array
  if (Array.isArray(data)) {
    for (const item of data) {
      rss += '    <item>\n';
      rss += `      <title>${escapeXml(item.title || 'Item')}</title>\n`;
      rss += `      <description>${escapeXml(item.description || '')}</description>\n`;
      if (item.link) {
        rss += `      <link>${escapeXml(item.link)}</link>\n`;
      }
      if (item.pubDate) {
        rss += `      <pubDate>${new Date(item.pubDate).toUTCString()}</pubDate>\n`;
      }
      rss += '    </item>\n';
    }
  }

  rss += `  </channel>
</rss>`;
  
  return rss;
}

function generateXML(data: any): string {
  // Simple XML generation
  return `<?xml version="1.0" encoding="UTF-8"?>
<root>${objectToXML(data)}</root>`;
}

function objectToXML(obj: any, indent: string = ''): string {
  if (typeof obj !== 'object' || obj === null) {
    return escapeXml(String(obj));
  }
  
  let xml = '';
  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        xml += `\n${indent}  <${key}>${objectToXML(item, indent + '  ')}</${key}>`;
      }
    } else if (typeof value === 'object' && value !== null) {
      xml += `\n${indent}  <${key}>${objectToXML(value, indent + '  ')}\n${indent}  </${key}>`;
    } else {
      xml += `\n${indent}  <${key}>${escapeXml(String(value))}</${key}>`;
    }
  }
  return xml;
}

function generateCSV(data: any): string {
  if (!Array.isArray(data) || data.length === 0) {
    return '';
  }
  
  // Get headers from first object
  const headers = Object.keys(data[0]);
  let csv = headers.join(',') + '\n';
  
  // Add rows
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      // Escape values containing commas or quotes
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csv += values.join(',') + '\n';
  }
  
  return csv;
}

function parseRSS(rssText: string): any {
  // Simple RSS parsing - in production you'd use a proper parser
  const items: any[] = [];
  const itemMatches = rssText.match(/<item>(.*?)<\/item>/gs) || [];
  
  for (const itemXml of itemMatches) {
    const item: any = {};
    
    const titleMatch = itemXml.match(/<title>(.*?)<\/title>/s);
    if (titleMatch) item.title = titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1');
    
    const descMatch = itemXml.match(/<description>(.*?)<\/description>/s);
    if (descMatch) item.description = descMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1');
    
    const linkMatch = itemXml.match(/<link>(.*?)<\/link>/s);
    if (linkMatch) item.link = linkMatch[1];
    
    const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/s);
    if (pubDateMatch) item.pubDate = pubDateMatch[1];
    
    items.push(item);
  }
  
  return { items };
}

function parseCSV(csvText: string): any[] {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(',').map(h => h.trim());
  const data: any[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row: any = {};
    headers.forEach((header, index) => {
      row[header] = values[index];
    });
    data.push(row);
  }
  
  return data;
}

function escapeXml(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}