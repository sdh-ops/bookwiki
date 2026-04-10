"use strict";

const { supabase } = require('./common');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('=== Running Migration: 003_bestsellers.sql ===\n');

  const migrationPath = path.join(__dirname, '..', 'migrations', '003_bestsellers.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  // Split by semicolons and execute each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (!statement) continue;

    console.log(`[${i + 1}/${statements.length}] Executing...`);

    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
      if (error) {
        console.error(`❌ Error:`, error.message);
      } else {
        console.log(`✅ Success`);
      }
    } catch (e) {
      console.error(`❌ Exception:`, e.message);
    }
  }

  console.log('\n=== Migration Complete ===');
}

runMigration();
