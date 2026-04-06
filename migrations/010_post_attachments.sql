-- 게시글 첨부파일 컬럼 추가
ALTER TABLE bw_posts ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- Storage 버킷 생성 (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-uploads', 'post-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: 누구나 업로드 가능
CREATE POLICY "public_upload_post_files" ON storage.objects
  FOR INSERT TO public
  WITH CHECK (bucket_id = 'post-uploads');

-- Storage RLS: 누구나 읽기 가능
CREATE POLICY "public_read_post_files" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'post-uploads');

-- Storage RLS: 로그인 사용자 삭제 가능
CREATE POLICY "auth_delete_post_files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'post-uploads');
