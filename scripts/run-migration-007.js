"use strict";

const { supabase } = require('./common');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('🚀 Running Migration: 007_comment_mentions.sql\n');
  console.log('📝 Adding @mention system for comments\n');

  const migrationPath = path.join(__dirname, '..', 'migrations', '007_comment_mentions.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  // Split by semicolons and execute each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (!statement) continue;

    console.log(`[${i + 1}/${statements.length}] Executing statement...`);

    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
      if (error) {
        console.error(`❌ Error:`, error.message);
        console.error('Statement:', statement.substring(0, 100) + '...');
      } else {
        console.log(`✅ Success`);
      }
    } catch (e) {
      console.error(`❌ Exception:`, e.message);
      console.error('Statement:', statement.substring(0, 100) + '...');
    }
  }

  console.log('\n=== Verifying Migration ===\n');

  // Check if table exists
  const { data: tables, error: tableError } = await supabase
    .from('bw_comment_mentions')
    .select('count')
    .limit(1);

  if (!tableError) {
    console.log('✅ bw_comment_mentions table created successfully');
  } else {
    console.log('❌ Table verification failed:', tableError.message);
  }

  console.log('\n✅ Migration 007_comment_mentions.sql complete!');
  console.log('💡 You can now use @mention in comments');
}

runMigration().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
