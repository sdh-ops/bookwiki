-- 베스트셀러 트렌드 분석을 위한 테이블 생성
-- 실행 날짜: 2026-03-18
-- 설명: 5대 플랫폼(교보, 예스24, 알라딘, 리디, 밀리)의 베스트셀러 데이터 저장 및 추이 분석을 위한 스키마

-- 1. 도서 마스터 테이블 (ISBN 기준 중복 방지)
CREATE TABLE IF NOT EXISTS bw_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  isbn TEXT UNIQUE,
  title TEXT NOT NULL,
  author TEXT,
  publisher TEXT,
  cover_url TEXT,
  description TEXT,
  category TEXT, -- 대분류 (소설, 경제경영 등)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 인덱스 추가 (ISBN 검색 최적화)
CREATE INDEX IF NOT EXISTS idx_bw_books_isbn ON bw_books(isbn);

-- 2. 베스트셀러 순위 스냅샷 테이블 (시계열 데이터)
CREATE TABLE IF NOT EXISTS bw_bestseller_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID REFERENCES bw_books(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- kyobo, yes24, aladdin, ridi, millie
  period_type TEXT NOT NULL, -- daily, weekly, monthly
  rank INTEGER NOT NULL, -- 1~20+
  rank_change INTEGER, -- 순위 변동 (이전 대비)
  category_name TEXT, -- 플랫폼별 상세 카테고리
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 인덱스 추가 (조회 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_bw_bestseller_snapshots_date ON bw_bestseller_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_bw_bestseller_snapshots_platform ON bw_bestseller_snapshots(platform);
CREATE INDEX IF NOT EXISTS idx_bw_bestseller_snapshots_period ON bw_bestseller_snapshots(period_type);
CREATE INDEX IF NOT EXISTS idx_bw_bestseller_snapshots_book_id ON bw_bestseller_snapshots(book_id);

-- 복합 인덱스 (특정 날짜의 플랫폼별 순위 조회)
CREATE INDEX IF NOT EXISTS idx_bw_bestseller_platform_date ON bw_bestseller_snapshots(platform, snapshot_date);

-- 3. RLS 정책 설정
ALTER TABLE bw_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE bw_bestseller_snapshots ENABLE ROW LEVEL SECURITY;

-- 누구나 조회 가능
DROP POLICY IF EXISTS "Anyone can view books" ON bw_books;
CREATE POLICY "Anyone can view books" ON bw_books FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can view bestseller snapshots" ON bw_bestseller_snapshots;
CREATE POLICY "Anyone can view bestseller snapshots" ON bw_bestseller_snapshots FOR SELECT USING (true);

-- 데이터 삽입/업데이트는 익명 권한 없음 (서버 측 스크립트 전용)
-- 스크립트가 service_role key를 사용한다고 가정

-- 4. 업데이트 시간 자동 변경 트리거 (선택 사항)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_bw_books_updated_at
    BEFORE UPDATE ON bw_books
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
