"use strict";

const { supabase } = require('./common');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('🚀 Running Migration: 006_unify_deletion.sql\n');
  console.log('📝 Unifying deletion system: is_hidden → is_deleted\n');

  const migrationPath = path.join(__dirname, '..', 'migrations', '006_unify_deletion.sql');
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

  // Verify the migration
  const { data: stats, error: statsError } = await supabase
    .from('bw_comments')
    .select('is_deleted')
    .limit(1000);

  if (!statsError && stats) {
    const active = stats.filter(c => !c.is_deleted).length;
    const deleted = stats.filter(c => c.is_deleted).length;
    console.log('📊 Comment Statistics:');
    console.log(`  Active: ${active}`);
    console.log(`  Deleted: ${deleted}`);
  }

  console.log('\n✅ Migration 006_unify_deletion.sql complete!');
}

runMigration().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
