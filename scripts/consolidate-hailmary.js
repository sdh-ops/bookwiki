"use strict";

const { supabase } = require('./common');

async function consolidate() {
  const book1 = '3bd79635-eabf-4d62-b58d-93fd84fd36e7'; // 강동혁 외, no ISBN
  const book2 = 'c280212b-0319-4ff4-af10-578bcdd92a07'; // 알수없음, ISBN
  const book3 = 'af790b0d-3089-4d54-946e-29371bafa46d'; // 앤디 위어, no ISBN

  console.log('Step 1: Update book2 (ISBN entry) to have correct author...');
  await supabase
    .from('bw_books')
    .update({ author: '앤디 위어' })
    .eq('id', book2);
  console.log('  ✓ Updated');

  console.log('\nStep 2: Move snapshots from book1 and book3 to book2...');
  const { error: err1 } = await supabase
    .from('bw_bestseller_snapshots')
    .update({ book_id: book2 })
    .eq('book_id', book1);

  if (!err1) console.log('  ✓ Moved book1 snapshots');
  else console.log('  ⚠️  Book1 snapshots conflict (expected)');

  const { error: err3 } = await supabase
    .from('bw_bestseller_snapshots')
    .update({ book_id: book2 })
    .eq('book_id', book3);

  if (!err3) console.log('  ✓ Moved book3 snapshots');
  else console.log('  ⚠️  Book3 snapshots conflict (expected)');

  console.log('\nStep 3: Delete empty books book1 and book3...');
  await supabase.from('bw_books').delete().eq('id', book1);
  await supabase.from('bw_books').delete().eq('id', book3);
  console.log('  ✓ Deleted');

  console.log('\n✅ Consolidation complete!');

  const { data } = await supabase
    .from('bw_books')
    .select('id, title, author, isbn')
    .ilike('title', '%헤일메리%');

  console.log('\nRemaining books:');
  console.log(JSON.stringify(data, null, 2));
}

consolidate();
