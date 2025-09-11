// supabase/functions/sync-file-integration/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
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
  // Optionally normalize whitespace
  // str = str.replace(/\s+/g, ' ');
  return str.trim();
}
// Helper function to parse CSV/TSV files
function parseCSV(content, options) {
  const { delimiter, hasHeaders, customHeaders } = options;
  // Parse CSV manually to handle edge cases
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;
  for(let i = 0; i < content.length; i++){
    const char = content[i];
    const nextChar = content[i + 1];
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && char === delimiter) {
      currentRow.push(currentField);
      currentField = '';
    } else if (!inQuotes && (char === '\n' || char === '\r' && nextChar === '\n')) {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
      if (char === '\r') i++; // Skip \n in \r\n
    } else {
      currentField += char;
    }
  }
  // Don't forget last field/row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }
  // Process headers
  let headers = [];
  let dataRows = rows;
  if (hasHeaders && rows.length > 0) {
    headers = rows[0].map((h)=>h.trim());
    dataRows = rows.slice(1);
  }
  // Use custom headers if provided
  if (customHeaders && customHeaders.length > 0) {
    headers = customHeaders;
  } else if (!hasHeaders) {
    // Generate headers if none exist
    headers = rows[0] ? rows[0].map((_, i)=>`column${i}`) : [];
  }
  console.log('CSV Parser - Headers:', headers);
  console.log('CSV Parser - Total rows:', dataRows.length);
  // Convert to objects
  return dataRows.map((row, rowIndex)=>{
    const obj = {};
    // Store by header name
    headers.forEach((header, i)=>{
      obj[header] = row[i] || '';
    });
    // Also add numeric indices
    row.forEach((value, i)=>{
      obj[i] = value || '';
    });
    return obj;
  });
}
// Process a single data source
async function processSingleDataSource(supabaseClient, dataSourceId, queueId, debug = false) {
  const SYNC_TIMEOUT_MS = 120000; // 2 minutes
  const controller = new AbortController();
  const timeoutId = setTimeout(()=>controller.abort(), SYNC_TIMEOUT_MS);
  try {
    console.log(`Processing data source: ${dataSourceId}, debug: ${debug}`);
    // Get the data source configuration
    const { data: dataSource, error: dsError } = await supabaseClient.from('data_sources').select('*').eq('id', dataSourceId).single();
    if (dsError || !dataSource) {
      throw new Error('Data source not found');
    }
    // Check if it's a file type
    if (dataSource.type !== 'file') {
      throw new Error('Invalid data source type: ' + dataSource.type);
    }
    // Check if already running (skip in debug mode)
    if (dataSource.sync_status === 'running' && !debug) {
      const lastSyncTime = dataSource.last_sync_at ? new Date(dataSource.last_sync_at) : null;
      const timeSinceSync = lastSyncTime ? Date.now() - lastSyncTime.getTime() : Infinity;
      if (timeSinceSync < 300000) {
        throw new Error(`Sync already in progress (started ${Math.floor(timeSinceSync / 1000)}s ago)`);
      } else {
        // Reset if stuck for more than 5 minutes
        console.log('Resetting stuck sync for:', dataSource.name);
        await supabaseClient.from('data_sources').update({
          sync_status: 'idle',
          last_sync_error: 'Previous sync was stuck, starting fresh'
        }).eq('id', dataSourceId);
      }
    }
    // Debug mode - return parsed data without syncing
    if (debug) {
      const response = await fetch(dataSource.file_config.url, {
        signal: controller.signal
      });
      const fileContent = await response.text();
      const delimiter = dataSource.file_config.format === 'tsv' ? '\t' : ',';
      const parsedData = parseCSV(fileContent, {
        delimiter,
        hasHeaders: dataSource.file_config.hasHeaders ?? true,
        customHeaders: dataSource.file_config.customHeaders
      });
      return {
        fileConfig: dataSource.file_config,
        templateMapping: dataSource.template_mapping,
        sampleData: parsedData.slice(0, 3),
        totalRows: parsedData.length,
        headers: dataSource.file_config.customHeaders || dataSource.file_config.headers,
        availableKeys: parsedData[0] ? Object.keys(parsedData[0]) : []
      };
    }
    // Normal sync mode
    if (!dataSource.sync_config?.enabled) {
      throw new Error('Sync not enabled for this data source');
    }
    // Update data source status
    await supabaseClient.from('data_sources').update({
      sync_status: 'running',
      last_sync_at: new Date().toISOString()
    }).eq('id', dataSourceId);
    // Fetch and process the file
    console.log('Fetching file from:', dataSource.file_config.url);
    let fileContent = '';
    if (dataSource.file_config.source === 'url') {
      const response = await fetch(dataSource.file_config.url, {
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
      }
      fileContent = await response.text();
      console.log('File fetched, size:', fileContent.length);
    } else {
      throw new Error('Only URL source is currently supported');
    }
    // Parse the file based on format
    let parsedData = [];
    if (dataSource.file_config.format === 'csv' || dataSource.file_config.format === 'tsv') {
      const delimiter = dataSource.file_config.format === 'tsv' ? '\t' : ',';
      parsedData = parseCSV(fileContent, {
        delimiter,
        hasHeaders: dataSource.file_config.hasHeaders ?? true,
        customHeaders: dataSource.file_config.customHeaders
      });
      console.log(`Parsed ${parsedData.length} rows`);
    } else if (dataSource.file_config.format === 'json') {
      parsedData = JSON.parse(fileContent);
      if (!Array.isArray(parsedData)) {
        parsedData = [
          parsedData
        ];
      }
      console.log(`Parsed JSON with ${parsedData.length} items`);
    } else {
      throw new Error(`Unsupported file format: ${dataSource.file_config.format}`);
    }
    // Get template fields
    let templateFieldNames = [];
    if (dataSource.template_mapping?.templateId) {
      console.log('Loading template fields for:', dataSource.template_mapping.templateId);
      const { data: formSchema } = await supabaseClient.from('template_forms').select('schema').eq('template_id', dataSource.template_mapping.templateId).maybeSingle();
      if (formSchema && formSchema.schema?.components) {
        templateFieldNames = formSchema.schema.components.filter((comp)=>comp.key && comp.input).map((comp)=>comp.key);
        console.log('Template fields from Form.io:', templateFieldNames);
      } else {
        const { data: templateFields } = await supabaseClient.from('tabfields').select('name').eq('template_id', dataSource.template_mapping.templateId);
        if (templateFields) {
          templateFieldNames = templateFields.map((f)=>f.name);
          console.log('Template fields from tabfields:', templateFieldNames);
        }
      }
    }
    // Create mapping map
    const mappingMap = new Map();
    if (dataSource.template_mapping?.fieldMappings) {
      for (const mapping of dataSource.template_mapping.fieldMappings){
        if (mapping.templateField && mapping.sourceColumn !== undefined) {
          mappingMap.set(mapping.templateField, mapping.sourceColumn);
        }
      }
      console.log('Field mappings:', Array.from(mappingMap.entries()));
    }
    // Get existing items in the target bucket for sync mode handling
    let existingItems = [];
    const syncMode = dataSource.sync_config?.syncMode || 'replace';
    if (syncMode === 'update' || syncMode === 'replace') {
      const { data: currentItems } = await supabaseClient.from('content').select('id, name, order').eq('parent_id', dataSource.sync_config.targetBucketId).eq('type', 'item').order('order');
      existingItems = currentItems || [];
      console.log(`Found ${existingItems.length} existing items in target bucket`);
    }
    // If replace mode, delete all existing items first
    if (syncMode === 'replace' && existingItems.length > 0) {
      console.log('Replace mode: Deleting existing items and their fields...');
      const deleteIds = existingItems.map((item)=>item.id);
      // First delete all item_tabfields for these items
      await supabaseClient.from('item_tabfields').delete().in('item_id', deleteIds);
      // Then delete the items themselves in batches
      const batchSize = 100;
      for(let i = 0; i < deleteIds.length; i += batchSize){
        const batch = deleteIds.slice(i, i + batchSize);
        const { error: deleteError } = await supabaseClient.from('content').delete().in('id', batch);
        if (deleteError) {
          console.error('Error deleting existing items:', deleteError);
          throw deleteError;
        }
      }
      console.log(`Deleted ${deleteIds.length} existing items`);
    }
    // Process each row and create items
    const errors = [];
    let itemsProcessed = 0;
    let itemsCreated = 0;
    let itemsUpdated = 0;
    for(let rowIndex = 0; rowIndex < parsedData.length; rowIndex++){
      const row = parsedData[rowIndex];
      try {
        // Generate item name
        let itemName = '';
        // First, try to use a mapped field for the name
        if (dataSource.template_mapping?.fieldMappings) {
          // Look for common name fields
          const possibleNameFields = [
            'headline',
            'title',
            'name',
            'subject'
          ];
          for (const field of possibleNameFields){
            if (row[field]) {
              itemName = sanitizeForPostgres(row[field]);
              break;
            }
          }
          if (!itemName) {
            itemName = `Headline ${rowIndex + 1}`;
          }
        }
        let itemId;
        // In update mode, try to find existing item
        if (syncMode === 'update' && existingItems.length > 0) {
          // Match by position/order
          if (rowIndex < existingItems.length) {
            const existingItem1 = existingItems[rowIndex];
            itemId = existingItem1.id;
            // Update the existing item
            const { error: updateError } = await supabaseClient.from('content').update({
              name: itemName,
              updated_at: new Date().toISOString()
            }).eq('id', itemId);
            if (updateError) {
              console.error(`Error updating item ${itemId}:`, updateError);
              errors.push({
                row: rowIndex,
                error: updateError.message
              });
              continue;
            }
            console.log(`Updated existing item ${itemId} for row ${rowIndex}`);
            // Delete existing fields before creating new ones
            await supabaseClient.from('item_tabfields').delete().eq('item_id', itemId);
            itemsUpdated++;
          }
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
            order: rowIndex
          };
          const { data: newItem, error: itemError } = await supabaseClient.from('content').insert(itemData).select().single();
          if (itemError) {
            console.error(`Error creating item for row ${rowIndex}:`, itemError);
            errors.push({
              row: rowIndex,
              error: itemError.message
            });
            continue;
          }
          itemId = newItem.id;
          console.log(`Created new item ${itemId} for row ${rowIndex}`);
          itemsCreated++;
        }
        // Create item fields (same for both update and create)
        if (templateFieldNames.length > 0 && itemId) {
          const fieldInserts = templateFieldNames.map((fieldName)=>{
            let value = '';
            if (mappingMap.has(fieldName)) {
              const sourceColumn = mappingMap.get(fieldName);
              const mappedValue = row[sourceColumn];
              if (mappedValue !== undefined && mappedValue !== null) {
                value = sanitizeForPostgres(mappedValue); // SANITIZE HERE
              }
              console.log(`Field "${fieldName}" <- column "${sourceColumn}" = "${value}"`);
            } else {
              console.log(`Field "${fieldName}" has no mapping, using empty string`);
            }
            return {
              item_id: itemId,
              name: fieldName,
              value: value
            };
          });
          if (fieldInserts.length > 0) {
            const { error: fieldsError } = await supabaseClient.from('item_tabfields').insert(fieldInserts);
            if (fieldsError) {
              console.error(`Error creating fields for item ${itemId}:`, fieldsError);
              errors.push({
                row: rowIndex,
                error: `Fields: ${fieldsError.message}`
              });
              // Rollback - delete the item if fields failed
              if (!existingItem) {
                await supabaseClient.from('content').delete().eq('id', itemId);
                itemsCreated--; // Decrement counter
              }
              continue;
            }
            console.log(`Created ${fieldInserts.length} fields for item ${itemId}`);
          }
        }
        itemsProcessed++;
      } catch (rowError) {
        console.error(`Error processing row ${rowIndex}:`, rowError);
        errors.push({
          row: rowIndex,
          error: rowError.message
        });
      }
    }
    // Update sync result
    const syncResult = {
      itemsProcessed: itemsProcessed,
      itemsCreated: itemsCreated,
      itemsUpdated: itemsUpdated,
      totalRows: parsedData.length,
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
    await supabaseClient.from('data_sources').update({
      sync_status: errors.length === 0 ? 'success' : 'error',
      last_sync_at: new Date().toISOString(),
      last_sync_result: syncResult,
      last_sync_count: itemsProcessed,
      last_sync_error: errors.length > 0 ? `${errors.length} errors occurred` : null,
      next_sync_at: nextSyncAt?.toISOString() || null
    }).eq('id', dataSourceId);
    return {
      success: errors.length === 0,
      itemsProcessed: itemsProcessed,
      itemsCreated: itemsCreated,
      itemsUpdated: itemsUpdated,
      totalRows: parsedData.length,
      errors: errors.length,
      message: `Sync completed. ${itemsCreated} items created, ${itemsUpdated} items updated.`
    };
  } catch (error) {
    console.error('Sync error:', error);
    // Update data source with error
    await supabaseClient.from('data_sources').update({
      sync_status: 'error',
      last_sync_error: error.message,
      last_sync_at: new Date().toISOString()
    }).eq('id', dataSourceId);
    throw error;
  } finally{
    clearTimeout(timeoutId);
  }
}
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
    const { dataSourceId, queueId, debug } = await req.json();
    if (!dataSourceId) {
      throw new Error('dataSourceId is required');
    }
    const result = await processSingleDataSource(supabaseClient, dataSourceId, queueId, debug);
    return new Response(JSON.stringify(result), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('Error:', error);
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
