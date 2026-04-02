"use strict";

const { supabaseAdmin } = require('./common');

/**
 * 데이터 완전 초기화 스크립트
 * 모든 베스트셀러 스냅샷 및 책 데이터를 삭제합니다.
 * SUPABASE_SERVICE_ROLE_KEY 환경변수 또는 .env.local 필요
 */

async function wipeAllData() {
  if (!supabaseAdmin) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY가 없습니다.');
    console.error('   .env.local에 SUPABASE_SERVICE_ROLE_KEY=... 를 추가하세요.');
    console.error('   Supabase 대시보드 → Settings → API → service_role key');
    process.exit(1);
  }

  console.log('\n⚠️  === DATA WIPE WARNING ===');
  console.log('This will delete ALL bestseller data!');
  console.log('Press Ctrl+C to cancel...\n');

  await new Promise(r => setTimeout(r, 5000));

  console.log('Starting data wipe...\n');

  try {
    // 1. 베스트셀러 스냅샷 삭제
    console.log('1. Deleting bestseller snapshots...');
    const { error: snapError } = await supabaseAdmin
      .from('bw_bestseller_snapshots')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (snapError) {
      console.error('  ❌ Error deleting snapshots:', snapError.message);
      return;
    }

    const { count: snapCount } = await supabaseAdmin
      .from('bw_bestseller_snapshots')
      .select('*', { count: 'exact', head: true });
    console.log(`  ✅ Snapshots remaining: ${snapCount}`);

    // 2. 책 데이터 삭제
    console.log('\n2. Deleting book records...');
    const { error: bookError } = await supabaseAdmin
      .from('bw_books')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (bookError) {
      console.error('  ❌ Error deleting books:', bookError.message);
      return;
    }

    const { count: bookCount } = await supabaseAdmin
      .from('bw_books')
      .select('*', { count: 'exact', head: true });
    console.log(`  ✅ Books remaining: ${bookCount}`);

    console.log('\n✅ === DATA WIPE COMPLETE ===');
    console.log('Database is now clean and ready for fresh data.\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
  }
}

wipeAllData();
