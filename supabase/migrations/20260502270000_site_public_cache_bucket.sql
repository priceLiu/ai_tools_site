-- 首页等大型 JSON 快照（Vercel 无持久磁盘，用 Storage 代替本地静态文件）

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'site_public_cache',
  'site_public_cache',
  true,
  52428800,
  ARRAY['application/json']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

DROP POLICY IF EXISTS "site_public_cache_select_public" ON storage.objects;

CREATE POLICY "site_public_cache_select_public"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'site_public_cache');
