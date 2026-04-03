-- 베스트셀러 스냅샷에 판매지수 컬럼 추가 (yes24, aladin만 제공)
ALTER TABLE bw_bestseller_snapshots
  ADD COLUMN IF NOT EXISTS sales_point INTEGER;
