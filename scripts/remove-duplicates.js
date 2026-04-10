"use strict";

const { supabase } = require('./common');

async function removeDuplicates() {
  console.log('\n=== Removing Duplicate Snapshots ===\n');

  // 1. 모든 스냅샷 가져오기
  const { data: allSnapshots } = await supabase
    .from('bw_bestseller_snapshots')
    .select('*')
    .order('created_at', { ascending: true });

  console.log(`Total snapshots: ${allSnapshots?.length || 0}`);

  // 2. 중복 찾기 (같은 book_id, platform, snapshot_date, common_category)
  const seen = new Map();
  const duplicates = [];

  allSnapshots?.forEach(snapshot => {
    const key = `${snapshot.book_id}_${snapshot.platform}_${snapshot.snapshot_date}_${snapshot.common_category}`;

    if (seen.has(key)) {
      // 중복 발견 - 나중에 생성된 것을 삭제 대상으로 표시
      duplicates.push(snapshot.id);
    } else {
      // 첫 번째 발견 - 유지
      seen.set(key, snapshot.id);
    }
  });

  console.log(`Found ${duplicates.length} duplicate records`);

  if (duplicates.length === 0) {
    console.log('No duplicates to remove!');
    return;
  }

  // 3. 중복 삭제 (배치로 처리)
  const batchSize = 100;
  let deletedCount = 0;

  for (let i = 0; i < duplicates.length; i += batchSize) {
    const batch = duplicates.slice(i, i + batchSize);

    const { error } = await supabase
      .from('bw_bestseller_snapshots')
      .delete()
      .in('id', batch);

    if (!error) {
      deletedCount += batch.length;
      console.log(`  Deleted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} records`);
    } else {
      console.error(`  Error deleting batch: ${error.message}`);
    }
  }

  console.log(`\n✅ Total deleted: ${deletedCount} duplicate records`);

  // 4. 결과 확인
  const { count: afterCount } = await supabase
    .from('bw_bestseller_snapshots')
    .select('*', { count: 'exact', head: true });

  console.log(`Remaining snapshots: ${afterCount}`);
  console.log('\n=== Cleanup Complete ===\n');
}

removeDuplicates();
