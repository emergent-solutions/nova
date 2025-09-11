// supabase/functions/sync-api-integration/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
function extractDataPathFromMappings(templateMapping, apiConfig) {
  // If data_path is already set, use it
  if (apiConfig.data_path) {
    return apiConfig.data_path;
  }
  // Try to auto-detect from field mappings
  if (!templateMapping?.fieldMappings || !Array.isArray(templateMapping.fieldMappings)) {
    return null;
  }
  // Look for patterns like "articles[0].field" or "data[0].field"
  const arrayPathPattern = /^([a-zA-Z_][a-zA-Z0-9_]*)\[(\d+|\*)\]\./;
  let detectedPath = null;
  for (const mapping of templateMapping.fieldMappings){
    if (mapping.sourceColumn) {
      const match = mapping.sourceColumn.match(arrayPathPattern);
      if (match) {
        const pathCandidate = match[1]; // e.g., "articles" from "articles[0].headline"
        // Verify all mappings use the same path
        if (detectedPath && detectedPath !== pathCandidate) {
          console.warn(`Multiple data paths detected: ${detectedPath} and ${pathCandidate}`);
          return null; // Inconsistent paths
        }
        detectedPath = pathCandidate;
      }
    }
  }
  if (detectedPath) {
    console.log(`Auto-detected data_path: ${detectedPath}`);
  }
  return detectedPath;
}
function cleanFieldMappings(mappings, dataPath) {
  if (!dataPath) return mappings;
  const patterns = [
    new RegExp(`^${dataPath}\\[\\d+\\]\\.`),
    new RegExp(`^${dataPath}\\.`),
    new RegExp(`^${dataPath}\\[\\]\\.`) // e.g., "articles[]."
  ];
  return mappings.map((mapping)=>{
    let cleanedColumn = mapping.sourceColumn;
    for (const pattern of patterns){
      if (pattern.test(cleanedColumn)) {
        cleanedColumn = cleanedColumn.replace(pattern, '');
        break;
      }
    }
    return {
      ...mapping,
      sourceColumn: cleanedColumn,
      originalSourceColumn: mapping.sourceColumn // Keep original for reference
    };
  });
}
// Sanitize values for PostgreSQL to avoid Unicode errors
function sanitizeForPostgres(value) {
  if (value === null || value === undefined) {
    return '';
  }
  // Convert to string
  let str = String(value);
  // Remove null bytes (PostgreSQL doesn't support these)
  str = str.replace(/\u0000/g, '');
  // Remove other problematic control characters but keep tabs, newlines, carriage returns
  str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return str.trim();
}
// Build authenticated request headers and params
function buildAuthenticatedRequest(apiConfig) {
  const headers = {
    ...apiConfig.headers || {}
  };
  const params = {};
  const auth_type = apiConfig.auth_type || 'none';
  const auth_config = apiConfig.auth_config || {};
  switch(auth_type){
    case 'basic':
      if (auth_config.username && auth_config.password) {
        const basicAuth = btoa(`${auth_config.username}:${auth_config.password}`);
        headers['Authorization'] = `Basic ${basicAuth}`;
      }
      break;
    case 'bearer':
      if (auth_config.token) {
        headers['Authorization'] = `Bearer ${auth_config.token}`;
      }
      break;
    case 'api_key_header':
      if (auth_config.api_key) {
        const headerName = auth_config.key_header_name || 'X-API-Key';
        headers[headerName] = auth_config.api_key;
      }
      break;
    case 'api_key_query':
      if (auth_config.api_key) {
        const paramName = auth_config.key_param_name || 'api_key';
        params[paramName] = auth_config.api_key;
      }
      break;
    case 'oauth2':
      if (auth_config.token) {
        headers['Authorization'] = `Bearer ${auth_config.token}`;
      }
      break;
    case 'custom':
      // Apply custom headers and params
      if (auth_config.custom_headers) {
        Object.assign(headers, auth_config.custom_headers);
      }
      if (auth_config.custom_params) {
        Object.assign(params, auth_config.custom_params);
      }
      break;
  }
  // Ensure Content-Type is set for JSON requests
  if (!headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  return {
    headers,
    params
  };
}
// Extract data from API response based on configuration
function extractDataFromResponse(data, apiConfig) {
  // If data_path is specified, navigate to that path
  if (apiConfig.data_path) {
    const pathSegments = apiConfig.data_path.split('.');
    let current = data;
    for (const segment of pathSegments){
      if (current && typeof current === 'object') {
        current = current[segment];
      } else {
        console.warn(`Path segment '${segment}' not found in data`);
        break;
      }
    }
    data = current;
  }
  // Ensure we have an array
  if (!Array.isArray(data)) {
    if (typeof data === 'object' && data !== null) {
      // If it's a single object, wrap it in an array
      return [
        data
      ];
    }
    console.warn('API response is not an array or object');
    return [];
  }
  return data;
}
// Process a single data source
async function processSingleDataSource(supabaseClient, dataSourceId, queueId, debug = false, force = false) {
  console.log(`\n=== Starting sync for dataSourceId: ${dataSourceId} ===`);
  console.log(`Parameters: debug=${debug}, force=${force}`);
  // CRITICAL: First thing - always reset if stuck or forced
  try {
    const { data: currentStatus } = await supabaseClient.from('data_sources').select('sync_status, last_sync_at').eq('id', dataSourceId).single();
    if (currentStatus) {
      console.log(`Current status: ${currentStatus.sync_status}, last_sync: ${currentStatus.last_sync_at}`);
      // ALWAYS reset if running or forced
      if (currentStatus.sync_status === 'running' || force) {
        console.log(`RESETTING sync status (was ${currentStatus.sync_status}, force=${force})`);
        await supabaseClient.from('data_sources').update({
          sync_status: 'idle',
          last_sync_error: null
        }).eq('id', dataSourceId);
        // Wait for DB update
        await new Promise((resolve)=>setTimeout(resolve, 500));
      }
    }
  } catch (resetError) {
    console.error('Error checking/resetting status:', resetError);
  }
  const SYNC_TIMEOUT_MS = 120000; // 2 minutes
  const controller = new AbortController();
  const timeoutId = setTimeout(()=>controller.abort(), SYNC_TIMEOUT_MS);
  let apiData = []; // Declare apiData at function scope
  try {
    // Get the data source configuration
    const { data: dataSource, error: dsError } = await supabaseClient.from('data_sources').select('*').eq('id', dataSourceId).single();
    if (dsError || !dataSource) {
      throw new Error('Data source not found');
    }
    // Check if it's an API type
    if (dataSource.type !== 'api') {
      throw new Error('Invalid data source type: ' + dataSource.type);
    }
    const apiConfig = dataSource.api_config || {};
    // Debug mode - return config without syncing
    if (debug) {
      console.log('Debug mode - returning config without syncing');
      return {
        apiConfig: {
          url: apiConfig.url,
          method: apiConfig.method,
          auth_type: apiConfig.auth_type,
          data_path: apiConfig.data_path,
          pagination_enabled: apiConfig.pagination_enabled,
          page_param: apiConfig.page_param,
          limit_param: apiConfig.limit_param,
          page_size: apiConfig.page_size
        },
        templateMapping: dataSource.template_mapping,
        sampleData: [],
        totalRecords: 0,
        availableFields: []
      };
    }
    // Normal sync mode
    if (!dataSource.sync_config?.enabled) {
      throw new Error('Sync not enabled for this data source');
    }
    // Update data source status to running
    console.log('Setting sync status to running...');
    await supabaseClient.from('data_sources').update({
      sync_status: 'running',
      last_sync_at: new Date().toISOString(),
      last_sync_error: null
    }).eq('id', dataSourceId);
    // Build URL with query parameters
    if (!apiConfig.url) {
      throw new Error('API URL is not configured for this data source');
    }
    // Auto-detect data_path from field mappings if not set
    const detectedDataPath = extractDataPathFromMappings(dataSource.template_mapping, apiConfig);
    if (detectedDataPath && !apiConfig.data_path) {
      apiConfig.data_path = detectedDataPath;
      console.log(`Using auto-detected data_path: ${detectedDataPath}`);
      // Clean up field mappings to remove the array path
      if (dataSource.template_mapping?.fieldMappings) {
        dataSource.template_mapping.fieldMappings = cleanFieldMappings(dataSource.template_mapping.fieldMappings, detectedDataPath);
        console.log('Cleaned field mappings:', dataSource.template_mapping.fieldMappings);
      }
    }
    // Build authenticated request
    const { headers, params } = buildAuthenticatedRequest(apiConfig);
    const url = new URL(apiConfig.url);
    Object.entries(params).forEach(([key, value])=>{
      url.searchParams.append(key, value);
    });
    // Add pagination parameters if configured in api_config
    if (apiConfig.pagination_enabled) {
      const pageParam = apiConfig.page_param || 'page';
      const limitParam = apiConfig.limit_param || 'limit';
      const pageSize = apiConfig.page_size || 100;
      url.searchParams.append(pageParam, '1');
      url.searchParams.append(limitParam, String(pageSize));
    }
    console.log('Fetching from URL:', url.toString());
    // Make the API request
    let response;
    try {
      response = await fetch(url.toString(), {
        method: apiConfig.method || 'GET',
        headers: headers,
        signal: controller.signal,
        body: apiConfig.body ? JSON.stringify(apiConfig.body) : undefined
      });
    } catch (fetchError) {
      console.error('Fetch failed:', fetchError);
      throw new Error(`API fetch failed: ${fetchError.message}`);
    }
    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }
    let responseData;
    try {
      responseData = await response.json();
    } catch (parseError) {
      throw new Error(`Failed to parse JSON response: ${parseError.message}`);
    }
    // Extract data array from response using api_config.data_path
    apiData = extractDataFromResponse(responseData, apiConfig);
    console.log(`Extracted ${apiData.length} records from API response`);
    // Get template fields if template is mapped
    let templateFields = [];
    if (dataSource.template_mapping?.templateId) {
      const { data: formSchema } = await supabaseClient.from('template_forms').select('schema').eq('template_id', dataSource.template_mapping.templateId).maybeSingle();
      if (formSchema?.schema?.components) {
        templateFields = formSchema.schema.components.filter((c)=>c.key && c.input).map((c)=>c.key);
      } else {
        // Fallback to tabfields
        const { data: tabfieldsData } = await supabaseClient.from('tabfields').select('name').eq('template_id', dataSource.template_mapping.templateId);
        if (tabfieldsData) {
          templateFields = tabfieldsData.map((f)=>f.name);
        }
      }
    }
    console.log(`Template has ${templateFields.length} fields`);
    // Get existing items in target bucket for update mode
    let existingItems = [];
    const syncMode = dataSource.sync_config?.syncMode || 'replace';
    if (syncMode === 'replace' && dataSource.sync_config?.targetBucketId) {
      // Delete existing items in replace mode
      const { error: deleteError } = await supabaseClient.from('content').delete().eq('parent_id', dataSource.sync_config.targetBucketId).eq('type', 'item');
      if (deleteError) {
        console.error('Error deleting existing items:', deleteError);
      } else {
        console.log('Deleted existing items in replace mode');
      }
    } else if (syncMode === 'update' && dataSource.sync_config?.targetBucketId) {
      // Get existing items for update mode
      const { data: items } = await supabaseClient.from('content').select('id, name').eq('parent_id', dataSource.sync_config.targetBucketId).eq('type', 'item').order('order', {
        ascending: true
      });
      if (items) {
        existingItems = items;
        console.log(`Found ${existingItems.length} existing items for update`);
      }
    }
    // Process each record
    let itemsProcessed = 0;
    let itemsCreated = 0;
    let itemsUpdated = 0;
    const errors = [];
    for(let recordIndex = 0; recordIndex < apiData.length; recordIndex++){
      if (controller.signal.aborted) throw new Error('Sync aborted');
      try {
        const record = apiData[recordIndex];
        // Determine item name
        let itemName = `Item ${recordIndex + 1}`;
        if (dataSource.template_mapping?.itemNameField) {
          const nameValue = record[dataSource.template_mapping.itemNameField];
          if (nameValue) {
            itemName = sanitizeForPostgres(nameValue);
          }
        }
        let itemId;
        // In update mode, try to find existing item
        if (syncMode === 'update' && recordIndex < existingItems.length) {
          const existingItem = existingItems[recordIndex];
          itemId = existingItem.id;
          // Update the existing item
          const { error: updateError } = await supabaseClient.from('content').update({
            name: itemName,
            updated_at: new Date().toISOString()
          }).eq('id', itemId);
          if (updateError) {
            console.error(`Error updating item ${itemId}:`, updateError);
            errors.push({
              record: recordIndex,
              error: updateError.message
            });
            continue;
          }
          // Delete existing fields before creating new ones
          await supabaseClient.from('item_tabfields').delete().eq('item_id', itemId);
          itemsUpdated++;
        }
        // Create new item if we don't have an existing one
        if (!itemId) {
          const itemData = {
            name: itemName,
            type: 'item',
            parent_id: dataSource.sync_config.targetBucketId,
            template_id: dataSource.template_mapping?.templateId,
            active: true,
            user_id: dataSource.user_id,
            order: recordIndex
          };
          const { data: newItem, error: itemError } = await supabaseClient.from('content').insert(itemData).select().single();
          if (itemError) {
            console.error(`Error creating item for record ${recordIndex}:`, itemError);
            errors.push({
              record: recordIndex,
              error: itemError.message
            });
            continue;
          }
          itemId = newItem.id;
          itemsCreated++;
        }
        // Map and create item fields
        if (templateFields.length > 0 && itemId) {
          console.log(`Creating fields for item ${itemId}`);
          console.log('Template fields:', templateFields);
          console.log('Field mappings:', dataSource.template_mapping?.fieldMappings);
          // Create a mapping map from the fieldMappings array
          const mappingMap = new Map();
          if (dataSource.template_mapping?.fieldMappings && Array.isArray(dataSource.template_mapping.fieldMappings)) {
            for (const mapping of dataSource.template_mapping.fieldMappings){
              if (mapping.templateField && mapping.sourceColumn !== undefined) {
                mappingMap.set(mapping.templateField, mapping.sourceColumn);
                console.log(`Mapping: ${mapping.templateField} <- ${mapping.sourceColumn}`);
              }
            }
          }
          if (recordIndex === 0) {
            console.log('First record structure:', JSON.stringify(record, null, 2));
            console.log('Field mappings:', JSON.stringify(dataSource.template_mapping?.fieldMappings, null, 2));
            console.log('API data_path:', apiConfig.data_path);
          }
          const fieldInserts = [];
          for (const fieldName of templateFields){
            let value = '';
            if (mappingMap.has(fieldName)) {
              const sourceColumn = mappingMap.get(fieldName);
              // Clean up the source column to handle various formats
              let cleanedSourceColumn = sourceColumn;
              // If we have a data_path and the sourceColumn includes it, remove it
              if (apiConfig.data_path && sourceColumn.includes(apiConfig.data_path)) {
                // Remove patterns like "articles[0]." or "articles."
                const patterns = [
                  `${apiConfig.data_path}[0].`,
                  `${apiConfig.data_path}.`,
                  `${apiConfig.data_path}[].`
                ];
                for (const pattern of patterns){
                  if (sourceColumn.startsWith(pattern)) {
                    cleanedSourceColumn = sourceColumn.substring(pattern.length);
                    console.log(`Cleaned "${sourceColumn}" to "${cleanedSourceColumn}"`);
                    break;
                  }
                }
              }
              // Now try to get the value
              let sourceValue = record[cleanedSourceColumn];
              // If still undefined, try the original column name
              if (sourceValue === undefined) {
                sourceValue = record[sourceColumn];
              }
              // If still undefined and contains dots, try nested path
              if (sourceValue === undefined && cleanedSourceColumn.includes('.')) {
                const pathSegments = cleanedSourceColumn.split('.');
                sourceValue = pathSegments.reduce((obj, segment)=>{
                  return obj?.[segment];
                }, record);
              }
              if (sourceValue !== undefined && sourceValue !== null) {
                value = sanitizeForPostgres(sourceValue);
                console.log(`Field "${fieldName}" <- "${sourceColumn}" (cleaned: "${cleanedSourceColumn}") = "${value}"`);
              } else {
                console.log(`Field "${fieldName}" <- "${sourceColumn}" (cleaned: "${cleanedSourceColumn}") is null/undefined`);
                console.log('Available fields in record:', Object.keys(record));
              }
            } else {
              console.log(`Field "${fieldName}" has no mapping`);
            }
            fieldInserts.push({
              item_id: itemId,
              name: fieldName,
              value: value
            });
          }
          if (fieldInserts.length > 0) {
            console.log(`Inserting ${fieldInserts.length} fields for item ${itemId}`);
            const { error: fieldsError } = await supabaseClient.from('item_tabfields').insert(fieldInserts);
            if (fieldsError) {
              console.error(`Error creating fields for item ${itemId}:`, fieldsError);
              console.error('Field inserts that failed:', JSON.stringify(fieldInserts, null, 2));
              errors.push({
                record: recordIndex,
                error: `Fields: ${fieldsError.message}`
              });
              // Rollback - delete the item if fields failed and it was just created
              if (itemsCreated > 0 && syncMode !== 'update') {
                await supabaseClient.from('content').delete().eq('id', itemId);
                itemsCreated--;
              }
              continue;
            }
            console.log(`Successfully created ${fieldInserts.length} fields`);
          }
        }
        itemsProcessed++;
      } catch (recordError) {
        console.error(`Error processing record ${recordIndex}:`, recordError);
        errors.push({
          record: recordIndex,
          error: recordError.message
        });
      }
    }
    // Update sync result
    const syncResult = {
      itemsProcessed: itemsProcessed,
      itemsCreated: itemsCreated,
      itemsUpdated: itemsUpdated,
      totalRecords: apiData.length,
      errors: errors.length,
      errorDetails: errors.length > 0 ? errors : null,
      timestamp: new Date().toISOString()
    };
    // Calculate next sync time
    let nextSyncAt = null;
    if (dataSource.sync_config.interval) {
      nextSyncAt = new Date();
      const intervalUnit = dataSource.sync_config.intervalUnit || 'minutes';
      switch(intervalUnit){
        case 'hours':
          nextSyncAt.setHours(nextSyncAt.getHours() + dataSource.sync_config.interval);
          break;
        case 'days':
          nextSyncAt.setDate(nextSyncAt.getDate() + dataSource.sync_config.interval);
          break;
        default:
          nextSyncAt.setMinutes(nextSyncAt.getMinutes() + dataSource.sync_config.interval);
      }
    }
    // Update data source status
    console.log('Updating final sync status to success...');
    await supabaseClient.from('data_sources').update({
      sync_status: errors.length === 0 ? 'success' : 'error',
      last_sync_at: new Date().toISOString(),
      last_sync_result: syncResult,
      last_sync_count: itemsProcessed,
      last_sync_error: errors.length > 0 ? `${errors.length} errors occurred` : null,
      next_sync_at: nextSyncAt?.toISOString() || null
    }).eq('id', dataSourceId);
    console.log(`=== Sync completed successfully: ${itemsProcessed} items ===\n`);
    return {
      success: errors.length === 0,
      itemsProcessed: itemsProcessed,
      itemsCreated: itemsCreated,
      itemsUpdated: itemsUpdated,
      totalRecords: apiData.length,
      errors: errors.length,
      message: `Sync completed. ${itemsCreated} items created, ${itemsUpdated} items updated.`
    };
  } catch (error) {
    console.error('=== Sync failed with error ===');
    console.error(error);
    // Always update to error status
    try {
      await supabaseClient.from('data_sources').update({
        sync_status: 'error',
        last_sync_error: error.message || 'Unknown error occurred',
        last_sync_at: new Date().toISOString()
      }).eq('id', dataSourceId);
    } catch (updateError) {
      console.error('Failed to update error status:', updateError);
    }
    throw error;
  } finally{
    clearTimeout(timeoutId);
    console.log('=== Sync function cleanup complete ===\n');
  }
}
// Main serve function
serve(async (req)=>{
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: {
        headers: {
          Authorization: req.headers.get('Authorization')
        }
      }
    });
    const { dataSourceId, queueId, debug, force } = await req.json();
    if (!dataSourceId) {
      throw new Error('dataSourceId is required');
    }
    const result = await processSingleDataSource(supabaseClient, dataSourceId, queueId, debug, force);
    return new Response(JSON.stringify(result), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('Handler error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 400
    });
  }
});
