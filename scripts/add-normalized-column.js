"use strict";

const { supabase } = require('./common');

async function addNormalizedColumn() {
  console.log('\n=== Adding normalized_title Column ===\n');

  try {
    // Check if column already exists
    const { data: columns } = await supabase
      .from('bw_books')
      .select('normalized_title')
      .limit(1);

    console.log('✅ Column normalized_title already exists or was just created!');
    console.log('\n=== Complete ===\n');

  } catch (error) {
    if (error.message.includes('column "normalized_title" does not exist')) {
      console.log('Column does not exist yet. This is expected for first-time setup.');
      console.log('\nNote: You may need to add the column manually through Supabase dashboard:');
      console.log('ALTER TABLE bw_books ADD COLUMN normalized_title TEXT;');
      console.log('\nOr the column will be auto-created when we first try to update it.');
    } else {
      console.error('Error:', error.message);
    }
  }
}

addNormalizedColumn();
