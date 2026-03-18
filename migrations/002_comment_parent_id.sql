-- Add parent_id to comments for proper threading
ALTER TABLE bw_comments
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES bw_comments(id) ON DELETE CASCADE;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_bw_comments_parent_id ON bw_comments(parent_id);

-- Update existing @ mention comments to set parent_id (best effort)
-- This is a one-time migration for existing data
-- Note: This won't be perfect as @ mentions don't guarantee exact parent linkage
