import { supabase } from '../lib/supabase';

export interface ColumnSuggestions {
  columnNames: string[];
  columnTypes: string[];
  confidence: number;
  reasoning: string;
}

export const analyzeColumnsWithClaude = async (
  sample: any[],
  hasHeaders: boolean
): Promise<ColumnSuggestions> => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('Authentication required');
  }

  const response = await fetch(
    `${supabase.supabaseUrl}/functions/v1/analyze-csv-columns`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ sample, hasHeaders })
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to analyze columns');
  }

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'Analysis failed');
  }

  return result.suggestions;
};

export const detectFileFormatWithClaude = async (
  fileContent: string,
  fileName?: string
): Promise<{
  format: 'csv' | 'tsv' | 'json' | 'txt';
  delimiter?: string;
  hasHeaders: boolean;
  encoding?: string;
}> => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('Authentication required');
  }

  // Take a sample of the file content (first 1000 characters)
  const sample = fileContent.substring(0, 1000);

  const response = await fetch(
    `${supabase.supabaseUrl}/functions/v1/detect-file-format`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ 
        sample, 
        fileName,
        fullLength: fileContent.length 
      })
    }
  );

  if (!response.ok) {
    throw new Error('Failed to detect file format');
  }

  const result = await response.json();
  return result.format;
};