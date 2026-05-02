-- 匿名也可安全增加「已通过且未禁用」工具的访问量（SECURITY DEFINER）
CREATE OR REPLACE FUNCTION public.increment_tool_view_count(p_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.tools
  SET
    view_count = COALESCE(view_count, 0) + 1,
    updated_at = now()
  WHERE trim(slug) = trim(p_slug)
    AND status = 'approved'
    AND COALESCE(is_disabled, false) = false;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_tool_view_count(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_tool_view_count(text) TO anon, authenticated;

-- 仅登录用户可发表评论
DROP POLICY IF EXISTS "Anyone can insert tool comments" ON public.tool_comments;
CREATE POLICY "Authenticated users can insert tool comments"
  ON public.tool_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
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

-- 已通过工具访问量为 0 的，赋予 3000–5000 随机起始值（与新审核逻辑一致）
UPDATE public.tools
SET view_count = 3000 + floor(random() * 2001)::int
WHERE status = 'approved'
  AND COALESCE(is_disabled, false) = false
  AND COALESCE(view_count, 0) = 0;
