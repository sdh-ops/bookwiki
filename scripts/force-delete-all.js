"use strict";

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function forceDeleteAll() {
  console.log('\n=== Force Delete All Bestseller Data ===\n');

  // SERVICE_ROLE_KEY 사용 (RLS 우회)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in .env');
    console.error('Please use Supabase Dashboard SQL Editor instead.\n');
    console.log('SQL to run:');
    console.log('  DELETE FROM bw_bestseller_snapshots;');
    console.log('  DELETE FROM bw_books;');
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    console.log('1. Deleting all snapshots...');
    const { error: snapError, count: snapCount } = await supabase
      .from('bw_bestseller_snapshots')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (snapError) {
      console.error('Error deleting snapshots:', snapError);
    } else {
      console.log(`   ✅ Deleted ${snapCount || 'all'} snapshots`);
    }

    console.log('\n2. Deleting all books...');
    const { error: bookError, count: bookCount } = await supabase
      .from('bw_books')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (bookError) {
      console.error('Error deleting books:', bookError);
    } else {
      console.log(`   ✅ Deleted ${bookCount || 'all'} books`);
    }

    // 확인
    console.log('\n3. Verifying deletion...');
    const { count: remainingSnaps } = await supabase
      .from('bw_bestseller_snapshots')
      .select('*', { count: 'exact', head: true });

    const { count: remainingBooks } = await supabase
      .from('bw_books')
      .select('*', { count: 'exact', head: true });

    console.log(`   Remaining snapshots: ${remainingSnaps || 0}`);
    console.log(`   Remaining books: ${remainingBooks || 0}`);

    if (remainingSnaps === 0 && remainingBooks === 0) {
      console.log('\n✅ All data deleted successfully!\n');
    } else {
      console.log('\n⚠️  Some data remains. Please check manually.\n');
    }

  } catch (error) {
    console.error('\nError:', error.message);
  }
}

forceDeleteAll();
