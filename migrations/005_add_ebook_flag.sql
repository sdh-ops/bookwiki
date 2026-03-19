-- Add is_ebook column to bw_bestseller_snapshots
ALTER TABLE bw_bestseller_snapshots
ADD COLUMN IF NOT EXISTS is_ebook BOOLEAN DEFAULT FALSE;

-- Add comment
COMMENT ON COLUMN bw_bestseller_snapshots.is_ebook IS '전자책 여부 (교보문고 EBK 등)';
