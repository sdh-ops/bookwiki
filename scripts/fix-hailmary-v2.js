"use strict";

const { supabase } = require('./common');

async function fixHailMary() {
  const wrongId = '3bd79635-eabf-4d62-b58d-93fd84fd36e7';
  const correctId = 'af790b0d-3089-4d54-946e-29371bafa46d';

  console.log('Step 1: Counting snapshots pointing to wrong book...');
  const { count: beforeCount } = await supabase
    .from('bw_bestseller_snapshots')
    .select('*', { count: 'exact', head: true })
    .eq('book_id', wrongId);
  console.log(`  Found ${beforeCount} snapshots`);

  console.log('\nStep 2: Deleting snapshots...');
  const { data: deletedSnaps, error: deleteSnapError } = await supabase
    .from('bw_bestseller_snapshots')
    .delete()
    .eq('book_id', wrongId)
    .select();

  if (deleteSnapError) {
    console.error('  ❌ Delete snapshots error:', deleteSnapError);
    return;
  }
  console.log(`  ✓ Deleted ${deletedSnaps ? deletedSnaps.length : 0} snapshots`);

  console.log('\nStep 3: Verifying no snapshots remain...');
  const { count: afterCount } = await supabase
    .from('bw_bestseller_snapshots')
    .select('*', { count: 'exact', head: true })
    .eq('book_id', wrongId);
  console.log(`  Remaining snapshots: ${afterCount}`);

  if (afterCount > 0) {
    console.error('  ❌ Snapshots still exist! Cannot proceed.');
    return;
  }

  console.log('\nStep 4: Deleting wrong book entry...');
  const { data: deletedBook, error: deleteBookError } = await supabase
    .from('bw_books')
    .delete()
    .eq('id', wrongId)
    .select();

  if (deleteBookError) {
    console.error('  ❌ Delete book error:', deleteBookError);
    return;
  }
  console.log(`  ✓ Deleted book:`, deletedBook);

  console.log('\nStep 5: Verifying book is gone...');
  const { data: checkBook } = await supabase
    .from('bw_books')
    .select('title, author')
    .eq('id', wrongId);

  if (checkBook && checkBook.length > 0) {
    console.error('  ❌ Book still exists!');
    return;
  }
  console.log('  ✓ Book successfully deleted');

  const { count } = await supabase
    .from('bw_books')
    .select('*', { count: 'exact', head: true });
  console.log(`\n✅ Done! Total books now: ${count}`);
}

fixHailMary();
