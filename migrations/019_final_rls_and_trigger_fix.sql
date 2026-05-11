-- 1. CLEAN UP ALL POTENTIAL POLICIES ON bw_posts
DROP POLICY IF EXISTS "bw_posts_standard_access" ON "public"."bw_posts";
DROP POLICY IF EXISTS "bw_posts_select" ON "public"."bw_posts";
DROP POLICY IF EXISTS "bw_posts_insert" ON "public"."bw_posts";
DROP POLICY IF EXISTS "bw_posts_update" ON "public"."bw_posts";
DROP POLICY IF EXISTS "bw_posts_delete" ON "public"."bw_posts";

-- 2. CREATE CLEAN POLICIES FOR bw_posts
CREATE POLICY "bw_posts_select" ON "public"."bw_posts"
FOR SELECT
USING (
    (is_deleted = false) 
    OR (auth.uid() = user_id)
    OR (EXISTS (SELECT 1 FROM bw_admins WHERE email = (SELECT auth.jwt()->>'email')))
);

CREATE POLICY "bw_posts_insert" ON "public"."bw_posts"
FOR INSERT
WITH CHECK (
    (auth.uid() = user_id) 
    OR (user_id IS NULL)
    OR (EXISTS (SELECT 1 FROM bw_admins WHERE email = (SELECT auth.jwt()->>'email')))
);

CREATE POLICY "bw_posts_update" ON "public"."bw_posts"
FOR UPDATE
USING (
    (auth.uid() = user_id) 
    OR (EXISTS (SELECT 1 FROM bw_admins WHERE email = (SELECT auth.jwt()->>'email')))
    OR (user_id IS NULL)
)
WITH CHECK (true);

CREATE POLICY "bw_posts_delete" ON "public"."bw_posts"
FOR DELETE
USING (EXISTS (SELECT 1 FROM bw_admins WHERE email = (SELECT auth.jwt()->>'email')));


-- 3. ENHANCE TRIGGER FUNCTIONS WITH SECURITY DEFINER AND SEARCH PATH
-- Update comment count function
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update HOT status function to also be SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.check_and_update_hot_status()
RETURNS TRIGGER AS $$
BEGIN
    -- If admin manually toggled or override is active, skip auto logic
    IF NEW.admin_hot_override = true THEN
        RETURN NEW;
    END IF;

    IF NOT NEW.is_hot THEN
        IF NEW.board_type = 'job' AND (COALESCE(NEW.view_count, 0) + COALESCE(NEW.comment_count, 0) * 10) >= 200 THEN
            NEW.is_hot := true;
        ELSIF NEW.board_type != 'job' AND (COALESCE(NEW.view_count, 0) + COALESCE(NEW.comment_count, 0) * 10) >= 100 THEN
            NEW.is_hot := true;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Re-apply triggers
DROP TRIGGER IF EXISTS trigger_update_post_comment_count ON public.bw_comments;
CREATE TRIGGER trigger_update_post_comment_count
AFTER INSERT OR UPDATE OR DELETE ON public.bw_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_post_comment_count();

DROP TRIGGER IF EXISTS trigger_update_hot_status ON public.bw_posts;
CREATE TRIGGER trigger_update_hot_status
BEFORE UPDATE OF view_count, comment_count ON public.bw_posts
FOR EACH ROW
EXECUTE FUNCTION public.check_and_update_hot_status();
