const { supabase } = require('./common');

async function forceWipe() {
  const dates = ['2026-03-31', '2026-04-01'];
  console.log(`Force wiping bestseller data for dates: ${dates.join(', ')}`);

  for (const date of dates) {
    const { count, error } = await supabase
      .from('bw_bestseller_snapshots')
      .delete()
      .eq('snapshot_date', date);

    if (error) {
      console.error(`Error wiping ${date}:`, error.message);
    } else {
      console.log(`Successfully wiped ${date}.`);
    }
  }

  console.log('Wipe complete.');
}

forceWipe();
