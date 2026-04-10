// Quick test - 종합 카테고리 하나만 테스트
const fs = require('fs');
const finalScript = fs.readFileSync(__dirname + '/bestseller-final.js', 'utf-8');

// COMMON_CATEGORIES를 종합 하나만으로 변경
const modifiedScript = finalScript.replace(
  /const COMMON_CATEGORIES = \[[^\]]+\];/s,
  `const COMMON_CATEGORIES = [
  { id: 'total', name: '종합', kyobo: '000', yes24: '001', aladdin: '0', ridi: 'general', millie: '0' }
];`
);

eval(modifiedScript);
