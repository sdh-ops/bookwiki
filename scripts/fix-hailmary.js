"use strict";

const { supabase } = require('./common');

async function fixHailMary() {
  const wrongId = '3bd79635-eabf-4d62-b58d-93fd84fd36e7';
  const correctId = 'af790b0d-3089-4d54-946e-29371bafa46d';

  // Check which categories have which book
  const { data: wrong } = await supabase
    .from('bw_bestseller_snapshots')
    .select('common_category, rank')
    .eq('book_id', wrongId)
    .eq('platform', 'kyobo');

  const { data: correct } = await supabase
    .from('bw_bestseller_snapshots')
    .select('common_category, rank')
    .eq('book_id', correctId)
    .eq('platform', 'kyobo');

  console.log('Categories with WRONG book (강동혁 외):');
  if (wrong) {
    wrong.forEach(s => {
      console.log(`  ${s.common_category} - Rank ${s.rank}`);
    });
  }

  console.log('\nCategories with CORRECT book (앤디 위어):');
  if (correct) {
    correct.forEach(s => {
      console.log(`  ${s.common_category} - Rank ${s.rank}`);
    });
  }

  // Strategy: Delete snapshots pointing to wrong book, then delete wrong book
  console.log('\nDeleting snapshots pointing to wrong book...');
  const { error: deleteSnapError } = await supabase
    .from('bw_bestseller_snapshots')
    .delete()
    .eq('book_id', wrongId);

  if (deleteSnapError) {
    console.error('Delete snapshots error:', deleteSnapError);
    return;
  }

  console.log('Deleting wrong book entry...');
  const { error: deleteBookError } = await supabase
    .from('bw_books')
    .delete()
    .eq('id', wrongId);

  if (deleteBookError) {
    console.error('Delete book error:', deleteBookError);
    return;
  }

  console.log('✅ Fixed! Wrong book and its snapshots deleted.');

  const { count } = await supabase
    .from('bw_books')
    .select('*', { count: 'exact', head: true });
  console.log(`Total books now: ${count}`);
}

fixHailMary();
