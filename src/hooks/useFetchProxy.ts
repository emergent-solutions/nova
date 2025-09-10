import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface FetchProxyOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
}

interface FetchProxyResult {
  data: any;
  status: number;
  statusText: string;
  contentType: string;
  metadata: {
    size: number;
    url: string;
    fetchedAt: string;
  };
}

export const useFetchProxy = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchViaProxy = async (
    url: string, 
    options: FetchProxyOptions = {}
  ): Promise<FetchProxyResult> => {
    setLoading(true);
    setError(null);

    try {
      // Check if it's a local URL that we can fetch directly
      const isLocalUrl = url.startsWith('/') || 
                        url.includes('localhost') || 
                        url.includes('192.168') ||
                        url.includes('127.0.0.1');

      // For local URLs in development, try direct fetch first
      if (isLocalUrl && import.meta.env.DEV) {
        try {
          console.log('Attempting direct fetch for local URL:', url);
          
          const response = await fetch(url, {
            method: options.method || 'GET',
            headers: {
              ...options.headers,
              'Accept': 'application/json',
            },
            body: options.body ? JSON.stringify(options.body) : undefined
          });

          if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
          }

          const contentType = response.headers.get('content-type') || 'application/json';
          let data;
          
          if (contentType.includes('application/json')) {
            data = await response.json();
          } else {
            data = await response.text();
          }

          return {
            data,
            status: response.status,
            statusText: response.statusText,
            contentType,
            metadata: {
              size: typeof data === 'string' ? data.length : JSON.stringify(data).length,
              url,
              fetchedAt: new Date().toISOString()
            }
          };
        } catch (directFetchError) {
          console.warn('Direct fetch failed, falling back to proxy:', directFetchError);
          // Fall through to proxy method
        }
      }

      // Get the current session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Authentication required');
      }

      // Construct the proxy URL based on environment
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || supabase.supabaseUrl;
      const proxyUrl = `${supabaseUrl}/functions/v1/fetch-proxy`;
      
      console.log('Using proxy URL:', proxyUrl);

      // Make request to proxy function
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          url,
          method: options.method || 'GET',
          headers: options.headers || {},
          body: options.body
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || errorData.message || `HTTP error ${response.status}`
        );
      }

      const result = await response.json();
      
      // Check if the proxied request was successful
      if (result.status >= 400) {
        throw new Error(
          `Remote server error ${result.status}: ${result.statusText}`
        );
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Proxy request failed';
      setError(message);
      console.error('FetchProxy error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Convenience method for fetching text files
  const fetchTextFile = async (url: string): Promise<string> => {
    const result = await fetchViaProxy(url);
    return typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
  };

  // Convenience method for fetching JSON
  const fetchJSON = async (url: string): Promise<any> => {
    const result = await fetchViaProxy(url);
    if (typeof result.data === 'string') {
      try {
        return JSON.parse(result.data);
      } catch {
        throw new Error('Invalid JSON response');
      }
    }
    return result.data;
  };

  // Method to test if a URL is accessible
  const testUrl = async (url: string): Promise<boolean> => {
    try {
      const result = await fetchViaProxy(url, { method: 'HEAD' });
      return result.status >= 200 && result.status < 300;
    } catch {
      return false;
    }
  };

  return {
    fetchViaProxy,
    fetchTextFile,
    fetchJSON,
    testUrl,
    loading,
    error
  };
};