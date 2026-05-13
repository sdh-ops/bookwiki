"use strict";

const { supabase } = require('./common');

async function checkPlatformNames() {
  console.log('=== Checking Platform Names in Snapshots ===');
  
  const { data, error } = await supabase
    .from('bw_bestseller_snapshots')
    .select('platform')
    .limit(100);

  if (error) {
    console.log('❌ Error:', error.message);
  } else {
    const names = [...new Set(data.map(d => d.platform))];
    console.log('Platforms found in DB:', names);
  }
}

checkPlatformNames();
