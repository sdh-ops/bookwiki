"use strict";

const { supabase } = require('./common');
const fs = require('fs');

async function runMigration() {
  console.log('📦 전자책 플래그 마이그레이션 실행...\n');

  const sql = fs.readFileSync('migrations/005_add_ebook_flag.sql', 'utf8');

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error('❌ 마이그레이션 실패:', error);
      console.log('\n수동으로 Supabase 대시보드에서 실행하세요:');
      console.log(sql);
    } else {
      console.log('✅ 마이그레이션 성공!');
    }
  } catch (err) {
    console.error('❌ 에러:', err.message);
    console.log('\n수동으로 Supabase SQL Editor에서 실행하세요:');
    console.log('─'.repeat(80));
    console.log(sql);
    console.log('─'.repeat(80));
  }
}

runMigration();
