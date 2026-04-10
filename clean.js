const fs = require('fs');
const files = [
  'src/app/write/page.js',
  'src/app/terms/page.js',
  'src/app/privacy/page.js',
  'src/app/post/[id]/edit/page.js',
  'src/app/mypage/page.js',
  'src/app/admin/deleted-posts/page.js',
  'src/app/admin/members/page.js'
];

files.forEach(f => {
  if (!fs.existsSync(f)) return;
  let content = fs.readFileSync(f, 'utf8');
  // Find <header>...</header>
  const replaced = content.replace(/<header[\s\S]*?<\/header>/, '');
  if (replaced !== content) {
    fs.writeFileSync(f, replaced);
    console.log('Cleaned:', f);
  } else {
    console.log('Header not found in', f);
  }
});
