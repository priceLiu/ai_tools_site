-- 用户禁用；管理员可查看/更新所有用户资料；非管理员不可改动 is_admin / is_disabled

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_disabled boolean NOT NULL DEFAULT false;

-- 供 RLS/触发器判断当前登录者是否为管理员（绕过 profiles 上的 RLS 递归）
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 本人可读自己的资料；管理员可读全部
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
CREATE POLICY "profiles_select_admin"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_admin_user());

-- 本人可改自己的资料（昵称等）；触发器限制不能自改管理员/禁用标记
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- 注册时插入自己的 profile（若由客户端写入；trigger 若用 SECURITY DEFINER 则不受此项影响）
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.profiles_guard_flags()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- 非管理员禁止修改 is_admin / is_disabled
  IF NOT public.is_admin_user() THEN
    IF NEW.is_admin IS DISTINCT FROM OLD.is_admin
      OR NEW.is_disabled IS DISTINCT FROM OLD.is_disabled
    THEN
      RAISE EXCEPTION '只有管理员可修改管理员权限与账号禁用状态';
    END IF;
  ELSE
    -- 至少保留一名管理员
    IF OLD.is_admin = true AND NEW.is_admin = false THEN
      IF (SELECT COUNT(*)::int FROM public.profiles WHERE is_admin = true) <= 1 THEN
        RAISE EXCEPTION '至少需要保留一名管理员';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_flags ON public.profiles;
CREATE TRIGGER profiles_guard_flags
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.profiles_guard_flags();
