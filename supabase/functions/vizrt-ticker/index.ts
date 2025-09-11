// File: supabase/functions/vizrt-ticker/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    // Get timezone from environment variable
    const timezone = Deno.env.get('TICKER_TIMEZONE') || 'UTC';
    console.log('Using timezone:', timezone);
    // Parse the URL to get channel name
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const channelName = pathParts[pathParts.length - 1] || '';
    if (!channelName) {
      return new Response(JSON.stringify({
        error: 'Channel name is required'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Get query parameters
    const includeInactive = url.searchParams.get('include_inactive') === 'true';
    // Create Supabase client
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    // 1. Find the channel
    const { data: channel, error: channelError } = await supabaseClient.from('channels').select('*').eq('name', decodeURIComponent(channelName)).eq('type', 'channel').single();
    if (channelError || !channel) {
      return new Response(JSON.stringify({
        error: `Channel "${channelName}" not found`
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    if (!channel.active && !includeInactive) {
      return new Response(JSON.stringify({
        error: `Channel "${channelName}" is not active`
      }), {
        status: 403,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // 2. Get playlists
    const playlistQuery = supabaseClient.from('channels').select('*').eq('parent_id', channel.id).eq('type', 'playlist').order('order');
    if (!includeInactive) {
      playlistQuery.eq('active', true);
    }
    const { data: playlists } = await playlistQuery;
    // 3. Build XML structure
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<!DOCTYPE tickerfeed SYSTEM "http://www.vizrt.com/ticker/tickerfeed-2.4.dtd">\n';
    xml += '<tickerfeed version="2.4">\n';
    // 4. Process each playlist
    for (const playlist of playlists || []){
      const playlistXml = await buildPlaylistXml(playlist, supabaseClient, includeInactive, timezone);
      if (playlistXml) {
        xml += playlistXml;
      }
    }
    xml += '</tickerfeed>';
    // Return XML response
    return new Response(xml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
async function buildPlaylistXml(playlist, supabase, includeInactive, timezone) {
  // Check if playlist is currently active based on its schedule
  if (!isCurrentlyActive(playlist.schedule, timezone)) {
    return null; // Skip this entire playlist if it's not scheduled to be active
  }
  // Get buckets for this playlist
  const bucketQuery = supabase.from('channels').select('*').eq('parent_id', playlist.id).eq('type', 'bucket').order('order');
  if (!includeInactive) {
    bucketQuery.eq('active', true);
  }
  const { data: buckets } = await bucketQuery;
  if (!buckets || buckets.length === 0) return null;
  // Filter buckets that are currently active
  const activeBuckets = [];
  for (const bucket of buckets){
    if (isCurrentlyActive(bucket.schedule, timezone)) {
      activeBuckets.push(bucket);
    }
  }
  if (activeBuckets.length === 0) return null;
  const playlistType = determinePlaylistType(playlist);
  let xml = `  <playlist type="${playlistType}" name="${escapeXml(playlist.name)}" target="carousel">\n`;
  // Add defaults
  xml += '    <defaults>\n';
  xml += '      <template>default_template</template>\n';
  xml += `      <gui-color>${generateColorForPlaylist(playlist.name)}</gui-color>\n`;
  xml += '    </defaults>\n';
  // Build groups for each active bucket
  for (const bucket of activeBuckets){
    const groupXml = await buildGroupXml(bucket, supabase, includeInactive, timezone);
    if (groupXml) xml += groupXml;
  }
  xml += '  </playlist>\n';
  return xml;
}
async function buildGroupXml(bucket, supabase, includeInactive, timezone) {
  const elements = await getElementsForBucket(bucket, supabase, includeInactive, timezone);
  if (elements.length === 0) return null;
  let xml = `    <group use_existing="${bucket.content_id || ''}">\n`;
  xml += `      <description>${escapeXml(bucket.name)}</description>\n`;
  xml += `      <gui-color>${generateDistinctColorForBucket(bucket)}</gui-color>\n`;
  xml += '      <elements>\n';
  for (const element of elements){
    xml += buildElementXml(element, 4);
  }
  xml += '      </elements>\n';
  xml += '    </group>\n';
  return xml;
}
async function getElementsForBucket(bucket, supabase, includeInactive, timezone) {
  const items = await getItemsForBucket(bucket, supabase, includeInactive, timezone);
  const elements = [];
  for (const item of items){
    const element = await createElement(item, supabase);
    elements.push(element);
  }
  return elements;
}
async function getItemsForBucket(bucket, supabase, includeInactive, timezone) {
  if (!bucket.content_id) return [];
  // This function recursively gets all items from a container (bucket or itemFolder)
  async function getAllItemsRecursive(containerId) {
    const allItems = [];
    // Get all direct children of this container
    const query = supabase.from('content').select('*').eq('parent_id', containerId).order('order');
    if (!includeInactive) {
      query.eq('active', true);
    }
    const { data: children } = await query;
    for (const child of children || []){
      if (child.type === 'item') {
        // Check if this item is currently active based on its schedule
        if (isCurrentlyActive(child.schedule, timezone)) {
          allItems.push(child);
        }
      } else if (child.type === 'itemFolder') {
        // Check if this itemFolder is currently active based on its schedule
        if (isCurrentlyActive(child.schedule, timezone)) {
          // ItemFolder is active - recursively get all items from within it
          const itemsFromFolder = await getAllItemsRecursive(child.id);
          allItems.push(...itemsFromFolder);
        }
      // If itemFolder is not active, skip all its contents
      }
    // Note: We ignore other types that might be in the content tree
    }
    return allItems;
  }
  // Start the recursive search from the bucket's content_id
  return await getAllItemsRecursive(bucket.content_id);
}
async function createElement(item, supabase) {
  // Get item fields
  const { data: fields } = await supabase.from('item_tabfields').select('*').eq('item_id', item.id);
  const element = {
    fields: []
  };
  // Add template if available
  if (item.template_id) {
    const { data: template } = await supabase.from('templates').select('name').eq('id', item.template_id).single();
    if (template) {
      element.template = template.name;
    }
  }
  // Add all fields
  for (const field of fields || []){
    element.fields.push({
      name: field.name,
      value: field.value
    });
  }
  // Only add duration if explicitly set on the item
  if (item.duration && item.duration > 0) {
    element.duration = item.duration.toString();
  }
  // Add TTL for time-sensitive content
  if (hasTimeSensitiveField(fields || [])) {
    element.ttl = {
      action: 'remove',
      value: '3600'
    };
  }
  return element;
}
function buildElementXml(element, indent) {
  const spaces = '  '.repeat(indent);
  let xml = `${spaces}<element>\n`;
  // Add fields
  for (const field of element.fields){
    xml += `${spaces}  <field name="${escapeXml(field.name)}">${escapeXml(field.value)}</field>\n`;
  }
  // Add optional properties
  if (element.duration) {
    xml += `${spaces}  <duration>${element.duration}</duration>\n`;
  }
  if (element.template) {
    xml += `${spaces}  <template>${escapeXml(element.template)}</template>\n`;
  }
  if (element.ttl) {
    xml += `${spaces}  <ttl action="${element.ttl.action}">${element.ttl.value}</ttl>\n`;
  }
  xml += `${spaces}</element>\n`;
  return xml;
}
// Schedule filtering functions with timezone support
function isCurrentlyActive(scheduleData, timezone = 'UTC') {
  // If no schedule, always active
  if (!scheduleData) {
    return true;
  }
  let schedule;
  // Handle both object (new JSON column) and string (legacy) formats
  if (typeof scheduleData === 'object' && scheduleData !== null) {
    // Already an object (JSON column format)
    schedule = scheduleData;
  } else if (typeof scheduleData === 'string') {
    const trimmedValue = scheduleData.trim();
    // Handle empty strings
    if (!trimmedValue || trimmedValue === 'null' || trimmedValue === 'undefined') {
      return true;
    }
    // Handle legacy text schedules (for backward compatibility)
    if (!trimmedValue.startsWith('{')) {
      // Legacy schedules like "Hourly", "Daily" etc. are always active
      return true;
    }
    // Try to parse JSON string
    try {
      schedule = JSON.parse(trimmedValue);
    } catch (error) {
      // If JSON parsing fails, treat as always active
      console.warn('Error parsing schedule JSON:', error);
      return true;
    }
  } else {
    // Invalid schedule format, always active
    return true;
  }
  // If not a valid object, always active
  if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)) {
    return true;
  }
  const now = new Date();
  console.log('Current UTC time:', now.toISOString());
  console.log('Checking schedule in timezone:', timezone);
  // Check start/end datetime filters
  if (!isWithinDateTimeRange(now, schedule.startDate, schedule.endDate, timezone)) {
    return false;
  }
  // Check days of week filter
  if (!isActiveOnCurrentDay(now, schedule.daysOfWeek, timezone)) {
    return false;
  }
  // Check time ranges filter
  if (!isWithinTimeRanges(now, schedule.timeRanges, timezone)) {
    return false;
  }
  return true;
}
function isWithinDateTimeRange(currentTime, startDate, endDate, timezone) {
  // If no start/end dates defined, active indefinitely
  if (!startDate && !endDate) {
    return true;
  }
  try {
    // Get current time in timezone
    const nowInTimezone = new Date(currentTime.toLocaleString("en-US", {
      timeZone: timezone
    }));
    // Check start date
    if (startDate) {
      const start = new Date(startDate);
      if (!isNaN(start.getTime()) && nowInTimezone < start) {
        return false;
      }
    }
    // Check end date
    if (endDate) {
      const end = new Date(endDate);
      if (!isNaN(end.getTime()) && nowInTimezone > end) {
        return false;
      }
    }
    return true;
  } catch (error) {
    console.warn('Error checking date range:', error);
    return true; // If error, don't filter out
  }
}
function isActiveOnCurrentDay(currentTime, daysOfWeek, timezone) {
  // If no days specified or invalid, active all days
  if (!daysOfWeek || typeof daysOfWeek !== 'object' || Array.isArray(daysOfWeek)) {
    return true;
  }
  // Check if any day is selected
  const hasSelectedDays = Object.values(daysOfWeek).some((selected)=>selected === true);
  // If no days selected, active all days
  if (!hasSelectedDays) {
    return true;
  }
  // Get the day in the specified timezone
  const localTime = new Date(currentTime.toLocaleString("en-US", {
    timeZone: timezone
  }));
  // Map current day to schedule format
  const dayNames = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday'
  ];
  const currentDayName = dayNames[localTime.getDay()];
  // Check if current day is selected
  return daysOfWeek[currentDayName] === true;
}
function isWithinTimeRanges(currentTime, timeRanges, timezone) {
  // If no time ranges specified or invalid, active all day
  if (!Array.isArray(timeRanges) || timeRanges.length === 0) {
    return true;
  }
  // Check if there are any valid time ranges
  const validTimeRanges = timeRanges.filter((range)=>range && typeof range === 'object' && range.start && range.end);
  // If no valid time ranges, active all day
  if (validTimeRanges.length === 0) {
    return true;
  }
  // Get current time in the specified timezone
  const options = {
    timeZone: timezone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  };
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const currentTimeString = formatter.format(currentTime);
  console.log('Current time in', timezone, ':', currentTimeString);
  // Check if current time falls within any of the time ranges
  for (const range of validTimeRanges){
    if (isTimeWithinRange(currentTimeString, range.start, range.end)) {
      return true;
    }
  }
  return false; // Not within any time range
}
function isTimeWithinRange(currentTime, startTime, endTime) {
  try {
    // Convert times to minutes since midnight for easier comparison
    const toMinutes = (timeStr)=>{
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };
    const current = toMinutes(currentTime);
    const start = toMinutes(startTime);
    const end = toMinutes(endTime);
    // Handle ranges that span midnight (e.g., 22:00 to 06:00)
    if (start > end) {
      // Range spans midnight
      return current >= start || current <= end;
    } else {
      // Normal range within same day
      return current >= start && current <= end;
    }
  } catch (error) {
    console.warn('Error comparing times:', error);
    return true; // If error, don't filter out
  }
}
// Helper functions
function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
function determinePlaylistType(playlist) {
  if (playlist.name.toLowerCase().includes('breaking') || playlist.name.toLowerCase().includes('urgent')) {
    return 'flipping_carousel';
  }
  return 'scrolling_carousel';
}
function generateColorForPlaylist(name) {
  const colors = [
    '#FF5733',
    '#33FF57',
    '#3357FF',
    '#FF33F5',
    '#F5FF33',
    '#33FFF5'
  ];
  let hash = 0;
  for(let i = 0; i < name.length; i++){
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}
function generateDistinctColorForBucket(bucket) {
  // Extended color palette with distinct, vibrant colors
  const colors = [
    '#FF6B6B',
    '#4ECDC4',
    '#45B7D1',
    '#F7DC6F',
    '#BB8FCE',
    '#52C234',
    '#FF8C42',
    '#6C5CE7',
    '#A8E6CF',
    '#FFD93D',
    '#F8B195',
    '#C7CEEA',
    '#FF6B9D',
    '#2ECC71',
    '#E74C3C',
    '#3498DB',
    '#F39C12',
    '#9B59B6',
    '#1ABC9C',
    '#34495E'
  ];
  // Use bucket ID for more consistent coloring
  let hash = 0;
  const str = bucket.id || bucket.name;
  for(let i = 0; i < str.length; i++){
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}
function hasTimeSensitiveField(fields) {
  const timeSensitiveKeywords = [
    'breaking',
    'urgent',
    'live',
    'now',
    'alert'
  ];
  return fields.some((field)=>timeSensitiveKeywords.some((keyword)=>field.name.toLowerCase().includes(keyword) || field.value.toLowerCase().includes(keyword)));
}