"use strict";

const { supabase } = require('./common');

/**
 * 오래된 베스트셀러 스냅샷 정리
 * 기본: 30일 이전 데이터 삭제
 */

async function cleanupOldSnapshots(daysToKeep = 30) {
  console.log(`\n=== Cleaning up snapshots older than ${daysToKeep} days ===\n`);

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

  console.log(`Cutoff date: ${cutoffDateStr}`);

  // 삭제 전 카운트
  const { count: beforeCount } = await supabase
    .from('bw_bestseller_snapshots')
    .select('*', { count: 'exact', head: true })
    .lt('snapshot_date', cutoffDateStr);

  console.log(`Found ${beforeCount} old snapshots to delete`);

  if (beforeCount === 0) {
    console.log('No old snapshots to clean up.');
    return;
  }

  // 삭제 실행
  const { error } = await supabase
    .from('bw_bestseller_snapshots')
    .delete()
    .lt('snapshot_date', cutoffDateStr);

  if (error) {
    console.error('Error deleting old snapshots:', error);
    return;
  }

  console.log(`✅ Deleted ${beforeCount} old snapshots`);

  // 삭제 후 카운트
  const { count: afterCount } = await supabase
    .from('bw_bestseller_snapshots')
    .select('*', { count: 'exact', head: true });

  console.log(`Remaining snapshots: ${afterCount}`);

  // 고아 책(orphaned books) 정리 - 스냅샷이 없는 책
  console.log('\n=== Cleaning up orphaned books ===\n');

  const { data: orphanedBooks } = await supabase
    .from('bw_books')
    .select('id')
    .not('id', 'in',
      supabase
        .from('bw_bestseller_snapshots')
        .select('book_id')
    );

  if (orphanedBooks && orphanedBooks.length > 0) {
    console.log(`Found ${orphanedBooks.length} orphaned books`);

    const { error: deleteError } = await supabase
      .from('bw_books')
      .delete()
      .in('id', orphanedBooks.map(b => b.id));

    if (!deleteError) {
      console.log(`✅ Deleted ${orphanedBooks.length} orphaned books`);
    }
  } else {
    console.log('No orphaned books to clean up.');
  }

  console.log('\n=== Cleanup complete ===');
}

// 실행 - 30일 이전 데이터 삭제 (인자로 변경 가능)
cleanupOldSnapshots(30);
