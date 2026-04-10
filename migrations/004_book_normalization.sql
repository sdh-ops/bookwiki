-- Add normalized_title column for book deduplication
ALTER TABLE bw_books
ADD COLUMN IF NOT EXISTS normalized_title TEXT;

-- Add index for faster searches
CREATE INDEX IF NOT EXISTS idx_books_normalized_title ON bw_books(normalized_title);

-- Add index for title search (for autocomplete)
CREATE INDEX IF NOT EXISTS idx_books_title_pattern ON bw_books USING gin(title gin_trgm_ops);

-- Enable pg_trgm extension if not already enabled (for fuzzy search)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Comments
COMMENT ON COLUMN bw_books.normalized_title IS 'Normalized title for grouping book variations (removes parentheses, special chars, etc.)';
