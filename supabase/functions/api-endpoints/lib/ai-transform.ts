// AI transformation handler with navigation context awareness
import { getValueFromPath, setValueAtPath } from "./transformations.ts";

export async function aiTransform(
  data: any,
  config: any,
  transformation: any,
  supabase: any
): Promise<any> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  
  try {
    // Check if we have a source_field specified
    if (transformation.source_field) {
      console.log(`AI Transform - source_field: "${transformation.source_field}", data type: ${Array.isArray(data) ? 'array' : typeof data}`);
      
      // Handle array transformations with field targeting
      if (Array.isArray(data)) {
        // Check if the source_field contains array notation like [*]
        let fieldPath = transformation.source_field;
        
        // Remove array notation since we're already working with an array
        if (fieldPath.includes('[*]')) {
          // Extract the part after [*]. if any
          const parts = fieldPath.split('[*].');
          if (parts.length > 1) {
            fieldPath = parts[1]; // Use the part after [*].
          } else {
            // If it ends with [*], remove it
            fieldPath = fieldPath.replace('[*]', '');
            // Also remove any prefix before [*]
            const beforeArray = fieldPath.lastIndexOf('.');
            if (beforeArray > -1) {
              fieldPath = fieldPath.substring(beforeArray + 1);
            }
          }
        }
        
        // If we still have a path that doesn't match the current context
        // try to extract just the field name
        if (fieldPath.includes('.')) {
          const parts = fieldPath.split('.');
          // Use the last part as the field name
          fieldPath = parts[parts.length - 1];
        }
        
        console.log(`Adjusted field path for array items: "${fieldPath}"`);
        
        return await processArrayFieldTransformation(
          data,
          fieldPath,
          config,
          supabase
        );
      }
      
      // For non-array data, try to extract the field value
      const fieldValue = getValueFromPath(data, transformation.source_field);
      if (fieldValue !== undefined && fieldValue !== null) {
        const transformedValue = await transformSingleValue(fieldValue, config, supabase);
        
        // Create a copy and set the transformed value back
        const result = JSON.parse(JSON.stringify(data)); // Deep clone
        setValueAtPath(result, transformation.source_field, transformedValue);
        return result;
      }
    }
    
    // No source_field or couldn't find it, transform the entire data
    console.log("Transforming entire data object");
    return await transformSingleValue(data, config, supabase);
    
  } catch (error) {
    console.error("AI transformation failed:", error);
    return data;
  }
}

async function transformSingleValue(
  value: any,
  config: any,
  supabase: any
): Promise<any> {
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  
  let prompt = config.prompt || "Transform this value";
  prompt = `Value: ${JSON.stringify(value)}\n\nTask: ${prompt}`;
  
  if (config.outputFormat === "json") {
    prompt += "\n\nRespond with valid JSON only.";
  }

  const response = await supabase.functions.invoke("claude", {
    body: {
      prompt,
      systemPrompt: config.systemPrompt || "You are a data transformation assistant. Transform the input according to the instructions provided.",
      maxTokens: config.maxTokens || 500,
      temperature: config.temperature || 0.7,
      outputFormat: config.outputFormat
    },
    headers: {
      Authorization: `Bearer ${supabaseServiceKey}`
    }
  });

  if (response.error) {
    console.error("AI transformation error:", response.error);
    return value;
  }

  let result = response.data?.response || response.data;
  
  // Extract the actual value from the AI response
  result = extractValueFromAIResponse(result, config);
  
  return result;
}

async function processArrayFieldTransformation(
  arrayData: any[],
  fieldName: string,
  config: any,
  supabase: any
): Promise<any[]> {
  console.log(`Processing ${arrayData.length} items for field: "${fieldName}"`);
  
  // IMPORTANT: Process sequentially, not in batches
  const CLAUDE_RATE_LIMIT = 50; // Conservative limit
  const delayBetweenRequests = 1200; // 1.2 seconds between requests = ~50/min
  const maxItems = config.maxItems || 20; // Reduced default
  
  const itemsToProcess = arrayData.slice(0, Math.min(arrayData.length, maxItems));
  const skippedCount = arrayData.length - itemsToProcess.length;
  
  if (skippedCount > 0) {
    console.warn(`Processing only first ${maxItems} items, skipping ${skippedCount} items`);
  }
  
  console.log(`Rate limiting config:
    - Items to process: ${itemsToProcess.length}
    - Delay between requests: ${delayBetweenRequests}ms
    - Estimated time: ${(itemsToProcess.length * delayBetweenRequests) / 1000}s
    - Effective rate: ${(60000 / delayBetweenRequests).toFixed(1)} requests/min`);
  
  const results: any[] = [];
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  
  // Process SEQUENTIALLY, not in parallel
  for (let i = 0; i < itemsToProcess.length; i++) {
    const item = itemsToProcess[i];
    console.log(`Processing item ${i + 1} of ${itemsToProcess.length}`);
    
    // Get the field value
    let fieldValue;
    if (item.hasOwnProperty(fieldName)) {
      fieldValue = item[fieldName];
    } else {
      fieldValue = getValueFromPath(item, fieldName);
    }
    
    if (fieldValue === null || fieldValue === undefined) {
      console.warn(`No value found for field "${fieldName}" in item ${i}`);
      results.push(item); // Return unchanged
      continue;
    }
    
    // Log sample for first item
    if (i === 0) {
      console.log(`Sample field value for "${fieldName}":`, 
        typeof fieldValue === 'string' ? fieldValue.substring(0, 100) : fieldValue);
    }
    
    let prompt = config.prompt || "Transform this value";
    prompt = `Value: ${JSON.stringify(fieldValue)}\n\nTask: ${prompt}`;
    
    if (config.outputFormat === "json") {
      prompt += "\n\nRespond with valid JSON only.";
    }
    
    try {
      let retries = 0;
      const maxRetries = 3;
      let lastError;
      
      while (retries <= maxRetries) {
        try {
          const response = await supabase.functions.invoke("claude", {
            body: {
              prompt,
              systemPrompt: config.systemPrompt || "You are a data transformation assistant.",
              outputFormat: config.outputFormat,
              maxTokens: config.maxTokens || 500,
              temperature: config.temperature || 0.7
            },
            headers: {
              Authorization: `Bearer ${supabaseServiceKey}`
            }
          });
          
          if (response.error) {
            // Check if it's a rate limit error (429 or 529)
            const errorMessage = response.error.message || '';
            if (errorMessage.includes('429') || 
                errorMessage.includes('529') || 
                errorMessage.includes('rate') || 
                errorMessage.includes('Too many requests')) {
              
              if (retries < maxRetries) {
                retries++;
                // Exponential backoff: 2s, 4s, 8s
                const backoffMs = 2000 * Math.pow(2, retries - 1);
                console.log(`Rate limit hit on item ${i + 1}. Waiting ${backoffMs}ms before retry ${retries}/${maxRetries}`);
                await new Promise(resolve => setTimeout(resolve, backoffMs));
                continue;
              }
            }
            
            console.error(`AI transformation error for item ${i + 1}:`, response.error);
            results.push(item);
            break;
          }
          
          // Success - process the response
          let transformedValue = response.data?.response || response.data;
          
          if (i === 0) {
            console.log("Sample AI response:", typeof transformedValue === 'string' ? 
              transformedValue.substring(0, 200) : JSON.stringify(transformedValue).substring(0, 200));
          }
          
          transformedValue = extractValueFromAIResponse(transformedValue, config);
          
          // Create new item with transformed field
          const newItem = { ...item };
          if (item.hasOwnProperty(fieldName)) {
            newItem[fieldName] = transformedValue;
          } else {
            setValueAtPath(newItem, fieldName, transformedValue);
          }
          
          results.push(newItem);
          break; // Success, exit retry loop
          
        } catch (error: any) {
          lastError = error;
          console.error(`Error processing item ${i + 1}:`, error);
          
          if (retries < maxRetries) {
            retries++;
            const backoffMs = 2000 * Math.pow(2, retries - 1);
            console.log(`Error on item ${i + 1}. Waiting ${backoffMs}ms before retry ${retries}/${maxRetries}`);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
            continue;
          }
          
          // Max retries exhausted
          console.error(`Failed item ${i + 1} after ${maxRetries} retries:`, lastError);
          results.push(item);
          break;
        }
      }
    } catch (error) {
      console.error(`Unexpected error for item ${i + 1}:`, error);
      results.push(item);
    }
    
    // Add delay before next request (except for last item)
    if (i < itemsToProcess.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
    }
  }
  
  // Add unprocessed items if any
  if (skippedCount > 0) {
    results.push(...arrayData.slice(maxItems));
  }
  
  return results;
}

/**
 * Extracts the actual value from an AI response
 * Handles both JSON objects and plain text responses
 */
function extractValueFromAIResponse(response: any, config: any): any {
  console.log("Extracting from AI response, type:", typeof response);
  
  // Handle null/undefined
  if (response === null || response === undefined) {
    return "";
  }
  
  // If it's already an object (not string), handle it directly
  if (typeof response === "object" && !Array.isArray(response)) {
    return extractFromObject(response, config);
  }
  
  // If it's not a string, return as-is
  if (typeof response !== "string") {
    return response;
  }
  
  // Now we have a string response - clean it up
  let cleaned = response.trim();
  
  // Remove markdown code blocks if present
  if (cleaned.includes('```')) {
    // Extract content between code blocks
    const match = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (match && match[1]) {
      cleaned = match[1].trim();
    } else {
      // Fallback: just remove the markers
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "");
      cleaned = cleaned.replace(/\n?```\s*$/i, "");
      cleaned = cleaned.trim();
    }
  }
  
  // Try to parse as JSON, regardless of outputFormat
  // Claude often returns JSON even when asked for plain text
  if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
    try {
      const parsed = JSON.parse(cleaned);
      console.log("Successfully parsed JSON from response");
      
      // If it's an object, extract the value
      if (typeof parsed === "object" && !Array.isArray(parsed)) {
        const extracted = extractFromObject(parsed, config);
        console.log("Extracted value:", typeof extracted === 'string' ? 
          extracted.substring(0, 100) : extracted);
        return extracted;
      }
      
      return parsed;
      
    } catch (e) {
      console.log("Failed to parse as JSON, returning as text");
      // If parsing fails, return the cleaned string
      return cleaned;
    }
  }
  
  // Not JSON, return the cleaned string
  return cleaned;
}

/**
 * Extract value from a parsed JSON object
 */
function extractFromObject(obj: any, config: any): any {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return obj;
  }
  
  const keys = Object.keys(obj);
  
  // If config specifies an expected field name, use it
  if (config.expectedField && obj[config.expectedField] !== undefined) {
    return obj[config.expectedField];
  }
  
  // If the object has only one property, return its value
  if (keys.length === 1) {
    const singleKey = keys[0];
    const value = obj[singleKey];
    console.log(`Extracting single field '${singleKey}'`);
    return value;
  }
  
  // Priority list of common field names
  const priorityFields = [
    'result', 'output', 'value', 'text', 'content',
    'summary', 'condensedText', 'condensed', 'summarized',
    'category', 'classification', 'label',
    'translation', 'translated',
    'extracted', 'data', 'response', 'answer'
  ];
  
  // Check priority fields in order
  for (const field of priorityFields) {
    if (obj[field] !== undefined && obj[field] !== null) {
      console.log(`Found value in field '${field}'`);
      return obj[field];
    }
  }
  
  // For small objects, return as-is
  if (keys.length <= 3) {
    return obj;
  }
  
  // Find the longest string value
  let bestValue = null;
  let bestLength = 0;
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string" && value.length > bestLength) {
      bestLength = value.length;
      bestValue = value;
    }
  }
  
  if (bestValue) {
    return bestValue;
  }
  
  return obj;
}