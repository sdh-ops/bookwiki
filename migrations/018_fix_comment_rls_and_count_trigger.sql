-- 1. DROP EXISTING POLICIES TO AVOID CONFLICTS
DROP POLICY IF EXISTS "bw_comments_standard_access" ON "public"."bw_comments";
DROP POLICY IF EXISTS "bw_comments_select" ON "public"."bw_comments";
DROP POLICY IF EXISTS "bw_comments_insert" ON "public"."bw_comments";
DROP POLICY IF EXISTS "bw_comments_update" ON "public"."bw_comments";
DROP POLICY IF EXISTS "bw_comments_delete" ON "public"."bw_comments";
DROP POLICY IF EXISTS "Anyone can view non-deleted comments" ON "public"."bw_comments";

-- 2. CREATE REFINED POLICIES FOR bw_comments
-- SELECT: Anyone can view non-deleted comments; owner and admin can view deleted ones
CREATE POLICY "bw_comments_select" ON "public"."bw_comments"
FOR SELECT
USING (
    (is_deleted = false) 
    OR (auth.uid() = user_id)
    OR (EXISTS (SELECT 1 FROM bw_admins WHERE email = (SELECT auth.jwt()->>'email')))
);

-- INSERT: Authenticated users can insert as themselves, or user_id can be NULL for anonymous
CREATE POLICY "bw_comments_insert" ON "public"."bw_comments"
FOR INSERT
WITH CHECK (
    (auth.uid() = user_id) 
    OR (user_id IS NULL)
    OR (EXISTS (SELECT 1 FROM bw_admins WHERE email = (SELECT auth.jwt()->>'email')))
);

-- UPDATE: Owners and admins can update (for soft-delete or editing)
-- Anonymous comments can be updated by anyone in RLS (we check password in frontend)
-- To prevent unauthorized updates to anonymous comments at the DB level, 
-- we could check the password here, but usually it's handled in the app.
CREATE POLICY "bw_comments_update" ON "public"."bw_comments"
FOR UPDATE
USING (
    (auth.uid() = user_id) 
    OR (EXISTS (SELECT 1 FROM bw_admins WHERE email = (SELECT auth.jwt()->>'email')))
    OR (user_id IS NULL) -- Allow anonymous update (frontend must check password)
)
WITH CHECK (true);

-- DELETE: Only admins can hard delete
CREATE POLICY "bw_comments_delete" ON "public"."bw_comments"
FOR DELETE
USING (EXISTS (SELECT 1 FROM bw_admins WHERE email = (SELECT auth.jwt()->>'email')));


-- 3. AUTOMATIC COMMENT COUNT TRIGGER
-- Function to update comment_count on bw_posts
CREATE OR REPLACE FUNCTION public.update_post_comment_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.bw_posts
        SET comment_count = (
            SELECT count(*) 
            FROM public.bw_comments 
            WHERE post_id = NEW.post_id AND is_deleted = false
        )
        WHERE id = NEW.post_id;
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        -- If is_deleted changed, update count
        IF (OLD.is_deleted IS DISTINCT FROM NEW.is_deleted) THEN
            UPDATE public.bw_posts
            SET comment_count = (
                SELECT count(*) 
                FROM public.bw_comments 
                WHERE post_id = NEW.post_id AND is_deleted = false
            )
            WHERE id = NEW.post_id;
        END IF;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.bw_posts
        SET comment_count = (
            SELECT count(*) 
            FROM public.bw_comments 
            WHERE post_id = OLD.post_id AND is_deleted = false
        )
        WHERE id = OLD.post_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on bw_comments
DROP TRIGGER IF EXISTS trigger_update_post_comment_count ON public.bw_comments;
CREATE TRIGGER trigger_update_post_comment_count
AFTER INSERT OR UPDATE OR DELETE ON public.bw_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_post_comment_count();

-- 4. SYNC EXISTING COUNTS (One-time fix)
UPDATE public.bw_posts p
SET comment_count = (
    SELECT count(*) 
    FROM public.bw_comments c 
    WHERE c.post_id = p.id AND c.is_deleted = false
);
