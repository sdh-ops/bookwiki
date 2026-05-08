-- BW_POSTS POLICIES
DROP POLICY IF EXISTS "bw_posts_standard_access" ON "public"."bw_posts";

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


-- BW_COMMENTS POLICIES
DROP POLICY IF EXISTS "bw_comments_standard_access" ON "public"."bw_comments";

CREATE POLICY "bw_comments_select" ON "public"."bw_comments"
FOR SELECT
USING (
    (is_deleted = false) 
    OR (auth.uid() = user_id)
    OR (EXISTS (SELECT 1 FROM bw_admins WHERE email = (SELECT auth.jwt()->>'email')))
);

CREATE POLICY "bw_comments_insert" ON "public"."bw_comments"
FOR INSERT
WITH CHECK (
    (auth.uid() = user_id) 
    OR (user_id IS NULL)
    OR (EXISTS (SELECT 1 FROM bw_admins WHERE email = (SELECT auth.jwt()->>'email')))
);

CREATE POLICY "bw_comments_update" ON "public"."bw_comments"
FOR UPDATE
USING (
    (auth.uid() = user_id) 
    OR (EXISTS (SELECT 1 FROM bw_admins WHERE email = (SELECT auth.jwt()->>'email')))
    OR (user_id IS NULL)
)
WITH CHECK (true);

CREATE POLICY "bw_comments_delete" ON "public"."bw_comments"
FOR DELETE
USING (EXISTS (SELECT 1 FROM bw_admins WHERE email = (SELECT auth.jwt()->>'email')));
