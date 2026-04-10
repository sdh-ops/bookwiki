"use strict";

const { supabase } = require('./common');

async function verifyMigrations() {
  console.log('🔍 Verifying migrations...\n');

  // 1. Check job_type column
  console.log('1️⃣ Checking job_type column...');
  const { data: jobPosts, error: jobError } = await supabase
    .from('bw_posts')
    .select('id, title, job_type')
    .eq('board_type', 'job')
    .limit(5);

  if (jobError) {
    console.error('❌ job_type column check failed:', jobError.message);
  } else {
    console.log('✅ job_type column exists');
    console.table(jobPosts);
  }

  // 2. Check is_deleted column in comments
  console.log('\n2️⃣ Checking is_deleted column in comments...');
  const { data: comments, error: commentError } = await supabase
    .from('bw_comments')
    .select('id, author, is_deleted')
    .limit(5);

  if (commentError) {
    console.error('❌ is_deleted column check failed:', commentError.message);
  } else {
    console.log('✅ is_deleted column exists');
    console.table(comments);
  }

  // 3. Check bw_comment_mentions table
  console.log('\n3️⃣ Checking bw_comment_mentions table...');
  const { data: mentions, error: mentionError } = await supabase
    .from('bw_comment_mentions')
    .select('count');

  if (mentionError) {
    console.error('❌ bw_comment_mentions table check failed:', mentionError.message);
  } else {
    console.log('✅ bw_comment_mentions table exists');
    console.log('Total mentions:', mentions?.length || 0);
  }

  console.log('\n🎉 All migrations verified!');
  console.log('\n📝 Next steps:');
  console.log('1. Restart your development server: npm run dev');
  console.log('2. Test each feature on the website');
  console.log('3. Create a test post in 구인구직 board');
  console.log('4. Try @mention in comments');
}

verifyMigrations().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
