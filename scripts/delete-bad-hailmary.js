"use strict";

const { supabase } = require('./common');

async function deleteBad() {
  const badId = '3bd79635-eabf-4d62-b58d-93fd84fd36e7';

  console.log('Deleting bad book (강동혁 외)...');
  const { data: snaps } = await supabase
    .from('bw_bestseller_snapshots')
    .select('id')
    .eq('book_id', badId);

  console.log(`  Found ${snaps?.length || 0} snapshots`);

  await supabase
    .from('bw_bestseller_snapshots')
    .delete()
    .eq('book_id', badId);

  await supabase
    .from('bw_books')
    .delete()
    .eq('id', badId);

  console.log('✓ Deleted');

  const { count } = await supabase
    .from('bw_books')
    .select('*', { count: 'exact', head: true });

  console.log(`Total books now: ${count}`);

  const { data } = await supabase
    .from('bw_books')
    .select('title, author, isbn')
    .ilike('title', '%헤일메리%');

  console.log('\nRemaining Hail Mary books:');
  console.log(JSON.stringify(data, null, 2));
}

deleteBad();
