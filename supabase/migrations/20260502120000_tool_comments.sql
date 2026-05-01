-- Guest comments under tool detail pages
CREATE TABLE IF NOT EXISTS public.tool_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id uuid NOT NULL REFERENCES public.tools (id) ON DELETE CASCADE,
  body text NOT NULL,
  nickname text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  website text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tool_comments_tool_created
  ON public.tool_comments (tool_id, created_at DESC);

ALTER TABLE public.tool_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read tool comments" ON public.tool_comments;
CREATE POLICY "Anyone can read tool comments"
  ON public.tool_comments FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tools t
      WHERE t.id = tool_id AND t.status = 'approved'
    )
  );

DROP POLICY IF EXISTS "Anyone can insert tool comments" ON public.tool_comments;
CREATE POLICY "Anyone can insert tool comments"
  ON public.tool_comments FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tools t
      WHERE t.id = tool_id AND t.status = 'approved'
    )
    AND length(trim(body)) BETWEEN 1 AND 5000
    AND length(trim(nickname)) BETWEEN 1 AND 80
    AND length(trim(email)) BETWEEN 3 AND 255
    AND (
      website IS NULL OR trim(website) = ''
      OR (
        length(trim(website)) <= 500
        AND trim(website) ~* '^https?://'
      )
    )
  );
