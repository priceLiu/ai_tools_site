-- 工具能力标签：词表归一 + 工具关联（最多 6 个 / 工具）

CREATE TABLE IF NOT EXISTS public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tags_name_normalized_unique
  ON public.tags (lower(trim(name)));

CREATE TABLE IF NOT EXISTS public.tool_tags (
  tool_id uuid NOT NULL REFERENCES public.tools (id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags (id) ON DELETE CASCADE,
  sort_order smallint NOT NULL,
  PRIMARY KEY (tool_id, tag_id),
  CONSTRAINT tool_tags_sort_order_range CHECK (sort_order >= 0 AND sort_order <= 5),
  CONSTRAINT tool_tags_unique_order UNIQUE (tool_id, sort_order)
);

CREATE INDEX IF NOT EXISTS tool_tags_tag_id_idx ON public.tool_tags (tag_id);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tags_select_all" ON public.tags;
CREATE POLICY "tags_select_all"
  ON public.tags FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "tool_tags_select_all" ON public.tool_tags;
CREATE POLICY "tool_tags_select_all"
  ON public.tool_tags FOR SELECT
  TO anon, authenticated
  USING (true);

-- 写入仅通过 SECURITY DEFINER 函数，避免污染词表

CREATE OR REPLACE FUNCTION public.upsert_tag_by_display_name(p_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n text := trim(p_name);
  vid uuid;
BEGIN
  IF n = '' OR n IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT id INTO vid FROM public.tags WHERE lower(trim(name)) = lower(n) LIMIT 1;
  IF vid IS NOT NULL THEN
    RETURN vid;
  END IF;
  INSERT INTO public.tags (name) VALUES (n) RETURNING id INTO vid;
  RETURN vid;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_tag_by_display_name(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_tag_by_display_name(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_tool_tags_for_tool(p_tool_id uuid, p_names text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i int := 0;
  n text;
  vid uuid;
  seen uuid[] := '{}';
BEGIN
  IF p_tool_id IS NULL THEN
    RAISE EXCEPTION 'invalid tool id';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tools t
    WHERE t.id = p_tool_id
      AND (
        t.user_id = auth.uid()
        OR public.is_admin_user()
      )
  ) THEN
    RAISE EXCEPTION 'not allowed to set tags for this tool';
  END IF;

  DELETE FROM public.tool_tags WHERE tool_id = p_tool_id;

  IF p_names IS NULL OR cardinality(p_names) = 0 THEN
    RETURN;
  END IF;

  FOREACH n IN ARRAY p_names
  LOOP
    EXIT WHEN i >= 6;
    n := trim(n);
    CONTINUE WHEN n = '';
    vid := public.upsert_tag_by_display_name(n);
    CONTINUE WHEN vid IS NULL;
    IF vid = ANY (seen) THEN
      CONTINUE;
    END IF;
    seen := array_append(seen, vid);
    INSERT INTO public.tool_tags (tool_id, tag_id, sort_order)
    VALUES (p_tool_id, vid, i);
    i := i + 1;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.set_tool_tags_for_tool(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_tool_tags_for_tool(uuid, text[]) TO authenticated;
