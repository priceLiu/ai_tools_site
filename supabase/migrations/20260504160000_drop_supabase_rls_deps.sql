-- 迁移到 Neon 后不再使用 Supabase PostgREST，auth.uid() 不可用。
-- 把依赖它的 trigger 和 RLS 移除；权限校验已在应用层完成。
--
-- 注意：必须先删掉所有引用 is_admin_user() 的 policy / 再 DROP FUNCTION，
-- 并改写 set_tool_tags_for_tool（其函数体引用了 is_admin_user）。

-- 1. 删除依赖 is_admin_user() 的 tools / profiles 策略
DROP POLICY IF EXISTS "tools_delete_admin" ON public.tools;
DROP POLICY IF EXISTS "tools_insert_admin" ON public.tools;
DROP POLICY IF EXISTS "tools_update_admin" ON public.tools;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;

-- 2. profiles 触发器（依赖 is_admin_user）
DROP TRIGGER IF EXISTS profiles_guard_flags ON public.profiles;
DROP FUNCTION IF EXISTS public.profiles_guard_flags();

-- 3. 改写标签函数：去掉 auth.uid() / is_admin_user()（应用在服务端直接写 tool_tags，此函数仍保留供兼容）
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

  IF NOT EXISTS (SELECT 1 FROM public.tools t WHERE t.id = p_tool_id) THEN
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

-- 4. 删除依赖 auth.uid() 的 is_admin_user 函数
DROP FUNCTION IF EXISTS public.is_admin_user();

-- 5. 关闭 profiles 的 RLS（应用层校验）
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
