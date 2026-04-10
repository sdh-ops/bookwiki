"use strict";

const { execSync } = require('child_process');

/**
 * 전체 베스트셀러 데이터 재구축 스크립트
 *
 * 순서:
 * 1. 기존 데이터 완전 삭제
 * 2. 새로운 스크레이퍼로 전체 수집 (10개 카테고리, 5개 서점)
 * 3. 책 제목 정규화
 * 4. 데이터 검증
 */

async function rebuild() {
  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log('║     베스트셀러 시스템 전체 재구축 시작     ║');
  console.log('╚═══════════════════════════════════════════════╝\n');

  const startTime = Date.now();

  try {
    // Step 1: 데이터 삭제
    console.log('STEP 1️⃣  데이터 삭제 중...\n');
    execSync('node scripts/wipe-data.js', { stdio: 'inherit' });
    console.log('\n✅ Step 1 완료\n');

    await new Promise(r => setTimeout(r, 3000));

    // Step 2: 새로운 스크레이퍼 실행
    console.log('\nSTEP 2️⃣  베스트셀러 데이터 수집 중...\n');
    execSync('node scripts/bestseller-v2.js', { stdio: 'inherit' });
    console.log('\n✅ Step 2 완료\n');

    await new Promise(r => setTimeout(r, 2000));

    // Step 3: 책 제목 정규화
    console.log('\nSTEP 3️⃣  책 제목 정규화 중...\n');
    execSync('node scripts/normalize-books.js', { stdio: 'inherit' });
    console.log('\n✅ Step 3 완료\n');

    await new Promise(r => setTimeout(r, 2000));

    // Step 4: 데이터 검증
    console.log('\nSTEP 4️⃣  데이터 검증 중...\n');
    execSync('node scripts/check-platform-data.js', { stdio: 'inherit' });
    console.log('\n✅ Step 4 완료\n');

    const duration = Math.round((Date.now() - startTime) / 1000);

    console.log('\n╔═══════════════════════════════════════════════╗');
    console.log('║         🎉 전체 재구축 완료! 🎉            ║');
    console.log('╚═══════════════════════════════════════════════╝');
    console.log(`\n⏱️  소요 시간: ${duration}초 (${Math.round(duration / 60)}분)\n`);

  } catch (error) {
    console.error('\n❌ 오류 발생:', error.message);
    console.log('\n중단된 단계에서 다시 시작할 수 있습니다.');
    process.exit(1);
  }
}

rebuild();
