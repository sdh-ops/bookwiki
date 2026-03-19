"use strict";

const { supabase } = require('./common');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('🚀 Running Migration: 005_job_type.sql\n');
  console.log('📝 Adding job_type column for explicit hiring/seeking classification\n');

  const migrationPath = path.join(__dirname, '..', 'migrations', '005_job_type.sql');
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
    .from('bw_posts')
    .select('job_type, count')
    .eq('board_type', 'job');

  if (!statsError && stats) {
    console.log('📊 Job Post Statistics:');
    console.table(stats);
  }

  // Sample some migrated posts
  const { data: samples } = await supabase
    .from('bw_posts')
    .select('id, title, job_type')
    .eq('board_type', 'job')
    .limit(10);

  if (samples) {
    console.log('\n📝 Sample Migrated Posts:');
    console.table(samples);
  }

  console.log('\n✅ Migration 005_job_type.sql complete!');
}

runMigration().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
