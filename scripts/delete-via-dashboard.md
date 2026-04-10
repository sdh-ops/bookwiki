# 베스트셀러 데이터 삭제 방법

RLS 정책 때문에 스크립트로는 데이터 삭제가 불가능합니다.
Supabase 대시보드에서 직접 삭제해주세요.

## 방법: Supabase SQL Editor 사용

1. https://supabase.com/dashboard 접속
2. 프로젝트 선택
3. 왼쪽 메뉴에서 **SQL Editor** 클릭
4. **New query** 클릭
5. 다음 SQL 복사해서 붙여넣기:

```sql
-- 1. 스냅샷 데이터 삭제
DELETE FROM bw_bestseller_snapshots;

-- 2. 책 데이터 삭제
DELETE FROM bw_books;

-- 3. 확인
SELECT
  (SELECT COUNT(*) FROM bw_bestseller_snapshots) as snapshot_count,
  (SELECT COUNT(*) FROM bw_books) as book_count;
```

6. **Run** 버튼 클릭
7. 결과에서 `snapshot_count`와 `book_count`가 모두 0이면 성공!

## 삭제 완료 후

터미널에서 다음 명령어로 새 데이터 수집 시작:

```bash
node scripts/bestseller-v2.js
```
