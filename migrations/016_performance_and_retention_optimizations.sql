-- 1. Missing Index Optimizations
CREATE INDEX IF NOT EXISTS idx_bw_page_views_user_id ON public.bw_page_views(user_id);
CREATE INDEX IF NOT EXISTS idx_bw_poll_votes_user_id ON public.bw_poll_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_sentence_id ON public.likes(sentence_id);
CREATE INDEX IF NOT EXISTS idx_sentences_user_id ON public.sentences(user_id);

-- 2. Remove Unused Indexes
DROP INDEX IF EXISTS public.idx_bw_comments_is_deleted;
DROP INDEX IF EXISTS public.idx_bw_posts_job_category;
DROP INDEX IF EXISTS public.idx_bw_nickname_history_changed_at;
DROP INDEX IF EXISTS public.idx_bw_comment_mentions_comment_id;
DROP INDEX IF EXISTS public.idx_bw_poll_votes_poll_id;
DROP INDEX IF EXISTS public.idx_bw_comment_mentions_user_id;
DROP INDEX IF EXISTS public.idx_bw_comment_mentions_created_at;

-- 3. RLS Policy Optimizations & Consolidation
-- sentences
DROP POLICY IF EXISTS "Allow public read access" ON public.sentences;
DROP POLICY IF EXISTS "Users can select their own sentences" ON public.sentences;
DROP POLICY IF EXISTS "Users can view their own or public sentences" ON public.sentences;
CREATE POLICY "sentences_read_access" ON public.sentences
    FOR SELECT USING (is_public = true OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Allow public insert access" ON public.sentences;
DROP POLICY IF EXISTS "Users can insert their own sentences" ON public.sentences;
CREATE POLICY "sentences_insert_access" ON public.sentences
    FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Allow public delete access" ON public.sentences;
DROP POLICY IF EXISTS "Users can delete their own sentences" ON public.sentences;
CREATE POLICY "sentences_delete_access" ON public.sentences
    FOR DELETE USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update their own sentences" ON public.sentences;
CREATE POLICY "Users can update their own sentences" ON public.sentences
    FOR UPDATE USING (user_id = (SELECT auth.uid()));

-- bw_comments
DROP POLICY IF EXISTS "Admins can do everything on bw_comments" ON public.bw_comments;
DROP POLICY IF EXISTS "Allow all for bw_comments" ON public.bw_comments;
DROP POLICY IF EXISTS "Anyone can view non-deleted comments" ON public.bw_comments;
CREATE POLICY "bw_comments_standard_access" ON public.bw_comments
    FOR ALL USING (
        (is_deleted = false) OR 
        (EXISTS (SELECT 1 FROM bw_admins WHERE email = (SELECT auth.jwt() ->> 'email')))
    );

-- bw_posts
DROP POLICY IF EXISTS "Admins can do everything on bw_posts" ON public.bw_posts;
DROP POLICY IF EXISTS "Allow all for bw_posts" ON public.bw_posts;
CREATE POLICY "bw_posts_standard_access" ON public.bw_posts
    FOR ALL USING (
        (is_deleted = false) OR 
        (EXISTS (SELECT 1 FROM bw_admins WHERE email = (SELECT auth.jwt() ->> 'email')))
    );

-- 4. Data Retention Policies (pg_cron)
-- bw_page_views (3 months)
DELETE FROM public.bw_page_views WHERE visited_at < NOW() - INTERVAL '3 months';
SELECT cron.schedule('bw-page-views-retention', '0 0 * * *', $$DELETE FROM public.bw_page_views WHERE visited_at < NOW() - INTERVAL '3 months'$$);

-- bw_bestseller_snapshots (Removed automatic deletion as per request)
-- DELETE FROM public.bw_bestseller_snapshots WHERE snapshot_date < CURRENT_DATE - INTERVAL '6 months';
-- SELECT cron.schedule('bw-bestseller-retention', '0 0 * * *', $$DELETE FROM public.bw_bestseller_snapshots WHERE snapshot_date < CURRENT_DATE - INTERVAL '6 months'$$);

