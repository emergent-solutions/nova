// supabase/functions/sync-database-integration/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Client as PgClient } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { Client as MySQLClient } from "https://deno.land/x/mysql@v2.11.0/mod.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
// Function to sanitize values for PostgreSQL
function sanitizeForPostgres(value) {
  if (value === null || value === undefined) {
    return '';
  }
  // Convert to string
  let str = String(value);
  // Remove null bytes and other problematic Unicode characters
  str = str.replace(/\u0000/g, ''); // Remove null bytes
  str = str.replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters except tab, newline, carriage return
  str = str.replace(/[\t\n\r]/g, ' '); // Replace tabs, newlines with spaces if needed
  return str.trim();
}
// Database connection helper
async function createDatabaseConnection(connection, dbType) {
  try {
    if (dbType === 'postgres') {
      const client = new PgClient({
        hostname: connection.host,
        port: connection.port || 5432,
        user: connection.username,
        password: connection.password,
        database: connection.database,
        tls: connection.ssl ? {
          enabled: true
        } : undefined
      });
      await client.connect();
      return client;
    } else if (dbType === 'mysql') {
      const client = await new MySQLClient().connect({
        hostname: connection.host,
        port: connection.port || 3306,
        username: connection.username || connection.user,
        password: connection.password,
        db: connection.database
      });
      return client;
    }
    throw new Error(`Unsupported database type: ${dbType}`);
  } catch (err) {
    console.error('Database connection error:', err);
    throw new Error(`Failed to connect to ${dbType}: ${err.message}`);
  }
}
// Execute query with proper error handling
async function executeQuery(connection, sql, dbType, parameters = []) {
  try {
    if (dbType === 'postgres') {
      const result = await connection.queryObject(sql, parameters);
      return result.rows;
    } else if (dbType === 'mysql') {
      const result = await connection.execute(sql, parameters);
      return result.rows || [];
    }
    throw new Error(`Unsupported database type: ${dbType}`);
  } catch (err) {
    console.error('Query execution error:', err);
    throw new Error(`Query failed: ${err.message}`);
  }
}
// Process simple queries
async function processSimpleQueries(dataSource, supabaseClient, signal) {
  const results = [];
  const queries = Object.entries(dataSource.database_config.queries || {}).filter(([_, query])=>query.mode === 'simple');
  for (const [queryId, query] of queries){
    if (signal.aborted) throw new Error('Sync aborted due to timeout');
    console.log(`Processing simple query: ${queryId}`);
    const connection = dataSource.database_config.connections[query.connectionId];
    let dbConn;
    try {
      dbConn = await createDatabaseConnection(connection, dataSource.database_config.dbType);
      const rows = await executeQuery(dbConn, query.sql, dataSource.database_config.dbType, query.parameters || []);
      console.log(`Query returned ${rows.length} rows`);
      results.push({
        queryId,
        rows,
        templateId: dataSource.template_mapping?.templateId,
        fieldMappings: dataSource.template_mapping?.fieldMappings,
        childrenKey: undefined // Simple queries don't have children
      });
    } finally{
      // Clean up connection
      if (dbConn) {
        if (dataSource.database_config.dbType === 'postgres') {
          await dbConn.end();
        } else if (dataSource.database_config.dbType === 'mysql') {
          await dbConn.close();
        }
      }
    }
  }
  return results;
}
// Process parent-child queries
async function processParentChildQueries(dataSource, supabaseClient, signal) {
  const results = [];
  const queries = Object.entries(dataSource.database_config.queries || {}).filter(([_, query])=>query.mode === 'parent-child');
  for (const [queryId, query] of queries){
    if (signal.aborted) throw new Error('Sync aborted due to timeout');
    console.log(`Processing parent-child query: ${queryId}`);
    // Get connections
    const parentConn = dataSource.database_config.connections[query.parentQuery.connectionId];
    const childConn = dataSource.database_config.connections[query.childQuery.connectionId];
    let parentDb, childDb;
    try {
      // Connect to parent database
      parentDb = await createDatabaseConnection(parentConn, dataSource.database_config.dbType);
      // Execute parent query
      const parentRows = await executeQuery(parentDb, query.parentQuery.sql, dataSource.database_config.dbType, query.parentQuery.parameters || []);
      console.log(`Parent query returned ${parentRows.length} rows`);
      // Connect to child database (might be same as parent)
      if (query.childQuery.connectionId === query.parentQuery.connectionId) {
        childDb = parentDb; // Reuse connection
      } else {
        childDb = await createDatabaseConnection(childConn, dataSource.database_config.dbType);
      }
      // Process each parent row
      const processedRows = [];
      for (const parentRow of parentRows){
        if (signal.aborted) throw new Error('Sync aborted due to timeout');
        // Get parent value for child query
        const parentKey = query.childQuery.parentKey || query.childQuery.parentKeyField;
        const parentValue = parentRow[parentKey];
        if (parentValue === undefined || parentValue === null) {
          console.warn(`Parent key '${parentKey}' not found or null in parent row`);
          continue;
        }
        let childRows;
        // Check if using parameterized query (contains ?) or template query (contains {{key}})
        if (query.childQuery.sql.includes('?')) {
          // Parameterized query - pass value as parameter
          childRows = await executeQuery(childDb, query.childQuery.sql, dataSource.database_config.dbType, [
            parentValue
          ]);
        } else {
          // Template query - replace placeholders
          const joinKey = query.childQuery.joinKey;
          let childSql = query.childQuery.sql;
          childSql = childSql.replace(new RegExp(`{{${joinKey}}}`, 'g'), parentValue);
          childRows = await executeQuery(childDb, childSql, dataSource.database_config.dbType);
        }
        // Apply child limit if specified
        const limitedChildRows = query.childQuery.limit ? childRows.slice(0, query.childQuery.limit) : childRows;
        // Combine parent and child data
        const childrenKey = query.childQuery.childrenKey || 'children';
        processedRows.push({
          ...parentRow,
          [childrenKey]: limitedChildRows
        });
        console.log(`Parent row has ${limitedChildRows.length} children under key '${childrenKey}'`);
        // Log first processed row structure for debugging
        if (processedRows.length === 0) {
          console.log('First processed row structure:');
          console.log('  Parent fields:', Object.keys(parentRow));
          console.log('  Children key:', childrenKey);
          console.log('  Number of children:', limitedChildRows.length);
          if (limitedChildRows.length > 0) {
            console.log('  First child fields:', Object.keys(limitedChildRows[0]));
          }
        }
      }
      results.push({
        queryId,
        rows: processedRows,
        templateSelection: query.templateSelection,
        fieldMappings: query.fieldMappings,
        childrenKey: query.childQuery.childrenKey || 'children'
      });
    } finally{
      // Clean up connections
      if (parentDb && parentDb !== childDb) {
        if (dataSource.database_config.dbType === 'postgres') {
          await parentDb.end();
        } else {
          await parentDb.close();
        }
      }
      if (childDb) {
        if (dataSource.database_config.dbType === 'postgres') {
          await childDb.end();
        } else {
          await childDb.close();
        }
      }
    }
  }
  return results;
}
// Map fields based on configuration
function mapFieldsToTemplate(row, mappings, templateFields, childrenKey = 'children') {
  const mappedData = {};
  console.log('Mapping fields with childrenKey:', childrenKey);
  console.log('Available template fields:', templateFields.length);
  // Apply static field mappings
  if (mappings?.staticFields) {
    Object.entries(mappings.staticFields).forEach(([templateField, mapping])=>{
      // For static fields, validate against template fields if available
      if (templateFields.length > 0 && !templateFields.includes(templateField)) return;
      switch(mapping.source){
        case 'parent':
          if (mapping.field && row[mapping.field] !== undefined) {
            mappedData[templateField] = row[mapping.field];
          }
          break;
        case 'child':
          // Static child index mapping (e.g., always get first child)
          if (mapping.field && childrenKey && Array.isArray(row[childrenKey])) {
            const childIndex = mapping.childIndex || 0;
            const child = row[childrenKey][childIndex];
            if (child && child[mapping.field] !== undefined) {
              mappedData[templateField] = child[mapping.field];
            }
          }
          break;
        case 'child-dynamic':
          // Dynamic child mapping in static fields (concatenates all values)
          if (mapping.field && childrenKey && Array.isArray(row[childrenKey])) {
            const values = row[childrenKey].map((child)=>child[mapping.field]).filter((v)=>v !== undefined);
            if (values.length > 0) {
              mappedData[templateField] = values.join(', ');
            }
          }
          break;
        case 'literal':
          if (mapping.value !== undefined) {
            mappedData[templateField] = mapping.value;
          }
          break;
      }
    });
  }
  // Apply indexed field mappings (for dynamic child indices)
  if (mappings?.indexedFields) {
    Object.entries(mappings.indexedFields).forEach(([templatePattern, mapping])=>{
      if (!mapping.field || !childrenKey) return;
      const children = row[childrenKey];
      if (!Array.isArray(children) || children.length === 0) {
        console.log(`No children found for indexed mapping ${templatePattern}`);
        return;
      }
      const indexPattern = mapping.indexPattern || '{i}';
      const indexOffset = mapping.indexOffset || 0;
      // Process each child and create indexed template fields
      children.forEach((child, index)=>{
        if (child[mapping.field] === undefined) return;
        // Generate the template field name by replacing {i} with the index
        const actualIndex = index + indexOffset;
        if (actualIndex < 0) return; // Skip negative indices
        const templateField = templatePattern.replace(indexPattern, String(actualIndex));
        // Map the field even if not explicitly in templateFields
        mappedData[templateField] = child[mapping.field];
      });
    });
  }
  console.log(`Mapped ${Object.keys(mappedData).length} fields`);
  return mappedData;
}
// Determine template ID based on selection mode
function determineTemplateId(row, selection, templates) {
  if (!selection) {
    console.log('No template selection provided');
    return null;
  }
  console.log(`Template selection mode: ${selection.mode}`);
  console.log('Row data keys:', Object.keys(row));
  console.log('Row data sample:', JSON.stringify(row).substring(0, 200) + '...');
  switch(selection.mode){
    case 'static':
      console.log(`Using static template ID: ${selection.templateId}`);
      return selection.templateId;
    case 'dynamic':
      // Use pattern to match template name
      const pattern = selection.templatePattern;
      console.log(`Dynamic template selection:`);
      console.log(`  Pattern: ${pattern}`);
      // Extract field name from pattern (e.g., {candidate_count} -> candidate_count)
      const fieldMatch = pattern.match(/\{([^}]+)\}/);
      const extractedField = fieldMatch ? fieldMatch[1] : null;
      // Use templateField if provided, otherwise use extracted field from pattern
      const templateField = selection.templateField || extractedField;
      console.log(`  Template field: ${templateField} (${selection.templateField ? 'explicit' : 'extracted from pattern'})`);
      if (!templateField) {
        console.error('ERROR: Could not determine template field from pattern or templateField property');
        console.error('Pattern should contain {fieldname} or provide explicit templateField');
        return null;
      }
      const value = row[templateField];
      console.log(`  Field value: ${value}`);
      console.log(`  Field type: ${typeof value}`);
      if (!value && value !== 0) {
        console.warn(`Template field '${templateField}' is null or undefined in row`);
        console.log('Available fields in row:', Object.keys(row));
        return null;
      }
      // Replace the field placeholder in the pattern with the actual value
      let templateName = pattern.replace(`{${templateField}}`, value);
      // Also handle {{fieldname}} pattern
      templateName = templateName.replace(`{{${templateField}}}`, value);
      console.log(`  Generated template name: ${templateName}`);
      // Log available templates
      console.log(`  Available templates: ${templates.map((t)=>t.name).join(', ')}`);
      const template = templates.find((t)=>t.name === templateName);
      if (template) {
        console.log(`  Found matching template: ${template.name} (ID: ${template.id})`);
      } else {
        console.warn(`  No template found matching name: ${templateName}`);
      }
      return template?.id || null;
    case 'conditional':
      // Evaluate rules in order
      console.log(`Conditional template selection with ${selection.rules?.length || 0} rules`);
      for (const rule of selection.rules || []){
        const fieldValue = row[rule.field];
        let matches = false;
        console.log(`  Evaluating rule: ${rule.field} ${rule.operator} ${rule.value}`);
        console.log(`  Field value: ${fieldValue}`);
        switch(rule.operator){
          case 'equals':
            matches = fieldValue == rule.value;
            break;
          case 'contains':
            matches = String(fieldValue).includes(rule.value);
            break;
          case 'startsWith':
            matches = String(fieldValue).startsWith(rule.value);
            break;
          case 'endsWith':
            matches = String(fieldValue).endsWith(rule.value);
            break;
        }
        if (matches) {
          console.log(`  Rule matched! Using template ID: ${rule.templateId}`);
          return rule.templateId;
        }
      }
      console.log(`  No rules matched, using default: ${selection.defaultTemplateId}`);
      return selection.defaultTemplateId || null;
    default:
      console.warn(`Unknown template selection mode: ${selection.mode}`);
      return null;
  }
}
// Main sync function
async function processSingleDataSource(supabaseClient, dataSourceId, queueId, debug = false, force = false) {
  const SYNC_TIMEOUT_MS = 300000; // 5 minutes for database queries
  const controller = new AbortController();
  const timeoutId = setTimeout(()=>controller.abort(), SYNC_TIMEOUT_MS);
  try {
    console.log(`Processing database data source: ${dataSourceId}`);
    // Get data source configuration
    const { data: dataSource, error: dsError } = await supabaseClient.from('data_sources').select('*').eq('id', dataSourceId).single();
    if (dsError || !dataSource) {
      throw new Error('Data source not found');
    }
    if (dataSource.type !== 'database') {
      throw new Error('Invalid data source type: ' + dataSource.type);
    }
    // Check if already running
    if (dataSource.sync_status === 'running' && !debug && !force) {
      const lastSyncTime = dataSource.last_sync_at ? new Date(dataSource.last_sync_at) : null;
      const timeSinceSync = lastSyncTime ? Date.now() - lastSyncTime.getTime() : Infinity;
      if (timeSinceSync < 300000) {
        throw new Error(`Sync already in progress (started ${Math.floor(timeSinceSync / 1000)}s ago)`);
      } else {
        // Sync has been running for more than 5 minutes - assume it's stuck
        console.warn(`Previous sync appears stuck (running for ${Math.floor(timeSinceSync / 1000)}s) - proceeding with new sync`);
      }
    }
    if (force && dataSource.sync_status === 'running') {
      console.log('Force sync requested - overriding running status');
    }
    // Update sync status
    if (!debug) {
      await supabaseClient.from('data_sources').update({
        sync_status: 'running',
        last_sync_at: new Date().toISOString()
      }).eq('id', dataSourceId);
    }
    // Get all templates for dynamic/conditional selection
    const { data: templates } = await supabaseClient.from('templates').select('id, name');
    console.log(`Loaded ${templates?.length || 0} templates from database`);
    if (templates && templates.length > 0) {
      console.log('Template names:', templates.map((t)=>t.name).sort().join(', '));
    }
    // Process queries based on type
    const hasSimpleQueries = Object.values(dataSource.database_config?.queries || {}).some((q)=>q.mode === 'simple');
    const hasParentChildQueries = Object.values(dataSource.database_config?.queries || {}).some((q)=>q.mode === 'parent-child');
    let allResults = [];
    if (hasSimpleQueries) {
      const simpleResults = await processSimpleQueries(dataSource, supabaseClient, controller.signal);
      allResults.push(...simpleResults);
    }
    if (hasParentChildQueries) {
      const parentChildResults = await processParentChildQueries(dataSource, supabaseClient, controller.signal);
      allResults.push(...parentChildResults);
    }
    // Debug mode - return sample data
    if (debug) {
      return {
        databaseConfig: dataSource.database_config,
        queryCount: allResults.length,
        sampleData: allResults.map((r)=>({
            queryId: r.queryId,
            rowCount: r.rows.length,
            sampleRows: r.rows.slice(0, 3)
          })),
        templates: templates?.map((t)=>({
            id: t.id,
            name: t.name
          }))
      };
    }
    // Process results and sync to buckets
    const syncMode = dataSource.sync_config?.syncMode || 'replace';
    const targetBucketId = dataSource.sync_config?.targetBucketId;
    if (!targetBucketId) {
      throw new Error('No target bucket configured');
    }
    // Get existing items if needed
    let existingItems = [];
    if (syncMode === 'replace') {
      const { data: items } = await supabaseClient.from('content').select('id').eq('parent_id', targetBucketId).eq('type', 'item');
      if (items && items.length > 0) {
        console.log(`Deleting ${items.length} existing items`);
        // First delete all item_tabfields for these items
        const itemIds = items.map((i)=>i.id);
        await supabaseClient.from('item_tabfields').delete().in('item_id', itemIds); // Changed from content_id to item_id
        // Then delete the content items
        await supabaseClient.from('content').delete().in('id', itemIds);
      }
    }
    // Create new items
    let totalItemsCreated = 0;
    let totalItemsUpdated = 0;
    console.log(`\n=== Starting item creation for ${allResults.length} query results ===`);
    for (const result of allResults){
      const { queryId, rows, templateSelection, fieldMappings, templateId, childrenKey } = result;
      console.log(`\nProcessing result from query: ${queryId}`);
      console.log(`  Number of rows: ${rows.length}`);
      console.log(`  Has templateSelection: ${!!templateSelection}`);
      console.log(`  Has fieldMappings: ${!!fieldMappings}`);
      console.log(`  Children key: ${childrenKey}`);
      // Get template fields for mapping
      let templateFields = [];
      const currentTemplateId = templateSelection ? null : templateId; // Use from mapping if no selection
      if (currentTemplateId) {
        const { data: formSchema } = await supabaseClient.from('template_forms').select('schema').eq('template_id', currentTemplateId).maybeSingle();
        if (formSchema?.schema?.components) {
          templateFields = formSchema.schema.components.filter((c)=>c.key && c.input).map((c)=>c.key);
        } else {
          // Fallback to tabfields metadata table for template field definitions
          const { data: templateFieldDefs } = await supabaseClient.from('tabfields').select('name').eq('template_id', currentTemplateId);
          if (templateFieldDefs) {
            templateFields = templateFieldDefs.map((f)=>f.name);
          }
        }
      }
      // Process each row
      for (const row of rows){
        if (controller.signal.aborted) throw new Error('Sync aborted');
        console.log(`\n--- Processing row from query ${queryId} ---`);
        // Determine template ID for this row
        const rowTemplateId = templateSelection ? determineTemplateId(row, templateSelection, templates || []) : currentTemplateId;
        if (!rowTemplateId) {
          console.warn(`No template found for row in query ${queryId}`);
          console.log('Template selection config:', JSON.stringify(templateSelection));
          console.log('Row data:', JSON.stringify(row).substring(0, 500));
          continue;
        }
        // Get template fields if using dynamic selection
        let currentTemplateFields = templateFields;
        if (templateSelection && rowTemplateId !== currentTemplateId) {
          const { data: formSchema } = await supabaseClient.from('template_forms').select('schema').eq('template_id', rowTemplateId).maybeSingle();
          if (formSchema?.schema?.components) {
            currentTemplateFields = formSchema.schema.components.filter((c)=>c.key && c.input).map((c)=>c.key);
          } else {
            // Fallback to tabfields metadata table for template field definitions
            const { data: templateFieldDefs } = await supabaseClient.from('tabfields').select('name').eq('template_id', rowTemplateId);
            if (templateFieldDefs) {
              currentTemplateFields = templateFieldDefs.map((f)=>f.name);
            }
          }
        }
        // Map fields - use childrenKey from result if available
        const mappedData = fieldMappings ? mapFieldsToTemplate(row, fieldMappings, currentTemplateFields, childrenKey) : {};
        // Create item name (use first mapped field or fallback)
        const nameField = Object.keys(mappedData)[0];
        const itemName = mappedData[nameField] || `Item ${totalItemsCreated + 1}`;
        // Create content item (without data field)
        const contentItem = {
          name: String(itemName).substring(0, 255),
          type: 'item',
          parent_id: targetBucketId,
          template_id: rowTemplateId,
          order: totalItemsCreated,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        const { data: insertedItem, error: insertError } = await supabaseClient.from('content').insert([
          contentItem
        ]).select().single();
        if (insertError) {
          console.error('Failed to create item:', insertError);
          continue;
        }
        // Insert field values into tabfields
        if (insertedItem && Object.keys(mappedData).length > 0) {
          const tabfieldInserts = Object.entries(mappedData).filter(([fieldName, fieldValue])=>fieldValue !== undefined && fieldValue !== null).map(([fieldName, fieldValue])=>({
              item_id: insertedItem.id,
              name: fieldName,
              value: sanitizeForPostgres(fieldValue),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }));
          if (tabfieldInserts.length > 0) {
            console.log(`Inserting ${tabfieldInserts.length} fields for item ${insertedItem.id}`);
            const { error: tabfieldsError } = await supabaseClient.from('item_tabfields').insert(tabfieldInserts);
            if (tabfieldsError) {
              console.error('Failed to insert tabfields:', tabfieldsError);
              console.error('Field data:', tabfieldInserts);
              console.error('Possible column name issues - check if foreign key is named item_id, content_id, or parent_id');
              // Rollback by deleting the content item
              await supabaseClient.from('content').delete().eq('id', insertedItem.id);
              continue;
            }
            console.log(`Created item "${itemName}" with ${tabfieldInserts.length} fields`);
          } else {
            console.log(`Created item "${itemName}" with no fields`);
          }
        }
        totalItemsCreated++;
      }
    }
    // Update sync status
    const syncResult = {
      itemsProcessed: totalItemsCreated + totalItemsUpdated,
      itemsCreated: totalItemsCreated,
      itemsUpdated: totalItemsUpdated,
      queries: allResults.length,
      timestamp: new Date().toISOString()
    };
    // Calculate next sync time
    let nextSyncAt = null;
    if (dataSource.sync_config?.enabled && dataSource.sync_config?.interval) {
      nextSyncAt = new Date();
      nextSyncAt.setMinutes(nextSyncAt.getMinutes() + dataSource.sync_config.interval);
    }
    await supabaseClient.from('data_sources').update({
      sync_status: 'success',
      last_sync_at: new Date().toISOString(),
      last_sync_result: syncResult,
      next_sync_at: nextSyncAt?.toISOString() || null,
      last_sync_error: null
    }).eq('id', dataSourceId);
    return syncResult;
  } catch (error) {
    console.error('Sync error:', error);
    // Update error status
    if (!debug) {
      await supabaseClient.from('data_sources').update({
        sync_status: 'error',
        last_sync_error: error.message || 'Unknown error',
        last_sync_at: new Date().toISOString()
      }).eq('id', dataSourceId);
    }
    throw error;
  } finally{
    clearTimeout(timeoutId);
  }
}
// Main handler
serve(async (req)=>{
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    // Get request body
    const { dataSourceId, queueId, debug, force } = await req.json();
    if (!dataSourceId) {
      throw new Error('dataSourceId is required');
    }
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }
    const supabaseClient = createClient(supabaseUrl, supabaseKey);
    // Process the data source
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
      error: error.message || 'Internal server error',
      details: error.stack
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 400
    });
  }
});
