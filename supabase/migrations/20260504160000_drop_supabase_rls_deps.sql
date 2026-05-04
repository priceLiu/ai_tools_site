-- 迁移到 Neon 后不再使用 Supabase PostgREST，auth.uid() 不可用。
-- 把依赖它的 trigger 和 RLS 移除；权限校验已在应用层完成。

-- 1. 删除 profiles 上的触发器
DROP TRIGGER IF EXISTS profiles_guard_flags ON public.profiles;
DROP FUNCTION IF EXISTS public.profiles_guard_flags();

-- 2. 删除依赖 auth.uid() 的 is_admin_user 函数
DROP FUNCTION IF EXISTS public.is_admin_user();

-- 3. 关闭 profiles 的 RLS（现在是应用层校验）
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- 4. 删掉旧的 RLS 策略（可选，DISABLE 后不生效，但保持整洁）
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
