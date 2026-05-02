-- Public bucket for tool logo/screenshot uploads when Vercel Blob is not configured.
-- Server uploads via SUPABASE_SERVICE_ROLE_KEY bypass RLS; anonymous read via policy.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tool_uploads',
  'tool_uploads',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

DROP POLICY IF EXISTS "tool_uploads_select_public" ON storage.objects;

CREATE POLICY "tool_uploads_select_public"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'tool_uploads');
