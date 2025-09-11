import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client as MySQLClient } from "https://deno.land/x/mysql@v2.11.0/mod.ts";
import { Client as PostgresClient } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const { dataSourceId, connection, sql, parameters = [], type = 'mysql', mode = 'simple', parentQuery, childQuery, parentConnection, childConnection } = await req.json();
    console.log('Testing database query:', {
      type,
      mode
    });
    // Handle different query modes
    if (mode === 'parent-child') {
      return await testParentChildQuery({
        parentConnection: parentConnection || connection,
        childConnection: childConnection || connection,
        parentQuery,
        childQuery,
        type
      });
    } else {
      return await testSimpleQuery({
        connection,
        sql,
        parameters,
        type
      });
    }
  } catch (error) {
    console.error('Test query error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Unknown error occurred'
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
async function testSimpleQuery({ connection, sql, parameters, type }) {
  let client;
  try {
    // Create appropriate client based on database type
    if (type === 'mysql') {
      client = await new MySQLClient().connect({
        hostname: connection.host,
        port: connection.port || 3306,
        username: connection.username || connection.user,
        password: connection.password,
        db: connection.database
      });
      // Add LIMIT if not present (for safety)
      const testSql = sql.toLowerCase().includes('limit') ? sql : `${sql} LIMIT 10`;
      // Execute query
      const result = await client.execute(testSql, parameters);
      // Get column information
      const columns = result.fields?.map((field)=>({
          name: field.name,
          type: field.type,
          table: field.table
        })) || [];
      const response = {
        success: true,
        rowCount: result.rows?.length || 0,
        columns: columns.map((c)=>c.name),
        columnDetails: columns,
        sampleData: result.rows?.slice(0, 10) || [],
        executionTime: Date.now() - startTime
      };
      await client.close();
      return new Response(JSON.stringify(response), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    } else if (type === 'postgresql') {
      client = new PostgresClient({
        hostname: connection.host,
        port: connection.port || 5432,
        user: connection.username || connection.user,
        password: connection.password,
        database: connection.database
      });
      await client.connect();
      // Add LIMIT if not present
      const testSql = sql.toLowerCase().includes('limit') ? sql : `${sql} LIMIT 10`;
      // Execute query
      const result = await client.queryObject(testSql, parameters);
      // Get column information from the first row
      const columns = result.rows.length > 0 ? Object.keys(result.rows[0]).map((name)=>({
          name,
          type: 'unknown'
        })) : [];
      const response = {
        success: true,
        rowCount: result.rows.length,
        columns: columns.map((c)=>c.name),
        columnDetails: columns,
        sampleData: result.rows.slice(0, 10),
        executionTime: Date.now() - startTime
      };
      await client.end();
      return new Response(JSON.stringify(response), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    throw new Error(`Unsupported database type: ${type}`);
  } catch (error) {
    console.error('Query execution error:', error);
    if (client) {
      try {
        if (type === 'mysql') await client.close();
        else if (type === 'postgresql') await client.end();
      } catch (e) {
        console.error('Error closing connection:', e);
      }
    }
    throw error;
  }
}
async function testParentChildQuery({ parentConnection, childConnection, parentQuery, childQuery, type }) {
  const startTime = Date.now();
  let parentClient;
  let childClient;
  try {
    // Test parent query first
    const parentResult = await testSimpleQuery({
      connection: parentConnection,
      sql: parentQuery.sql,
      parameters: parentQuery.parameters || [],
      type
    });
    const parentData = await parentResult.json();
    if (!parentData.success) {
      throw new Error(`Parent query failed: ${parentData.error}`);
    }
    // Test child query with first parent result if available
    let childData = null;
    if (parentData.sampleData.length > 0 && childQuery.parentKeyField) {
      const firstParent = parentData.sampleData[0];
      console.log('=== Debug Info ===');
      console.log('Parent columns:', parentData.columns);
      console.log('First parent row:', JSON.stringify(firstParent, null, 2));
      console.log('Parent key field looking for:', childQuery.parentKeyField);
      console.log('Available keys in parent:', Object.keys(firstParent));
      const parentKeyValue = firstParent[childQuery.parentKeyField];
      console.log('Parent key value found:', parentKeyValue);
      console.log('Parent key value type:', typeof parentKeyValue);
      console.log('Child query SQL:', childQuery.sql);
      if (parentKeyValue !== undefined && parentKeyValue !== null) {
        const childResult = await testSimpleQuery({
          connection: childConnection,
          sql: childQuery.sql,
          parameters: [
            parentKeyValue
          ],
          type
        });
        childData = await childResult.json();
      } else {
        console.log('WARNING: Parent key value is undefined or null!');
      }
    }
    // Combine results
    const response = {
      success: true,
      mode: 'parent-child',
      parentColumns: parentData.columns,
      parentColumnDetails: parentData.columnDetails,
      parentSampleData: parentData.sampleData,
      parentRowCount: parentData.rowCount,
      childColumns: childData?.columns || [],
      childColumnDetails: childData?.columnDetails || [],
      childSampleData: childData?.sampleData || [],
      childRowsPerParent: childData?.rowCount || 0,
      executionTime: Date.now() - startTime,
      summary: {
        parentRows: parentData.rowCount,
        avgChildrenPerParent: childData?.rowCount || 0,
        totalExpectedChildren: parentData.rowCount * (childData?.rowCount || 0)
      }
    };
    return new Response(JSON.stringify(response), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error('Parent-child query test error:', error);
    throw error;
  }
}
const startTime = Date.now();

