-- 新增/首次变为已通过时保证起始阅读量在 3000–5000（与应用层 randomToolViewSeed、历史 UPDATE 脚本一致），避免直插 approved 仍为 0

CREATE OR REPLACE FUNCTION public.tools_seed_view_count_if_needed()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'approved'
     OR COALESCE(NEW.is_disabled, false) = true THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.view_count, 0) >= 3000 THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.view_count := 3000 + floor(random() * 2001)::int;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'approved' THEN
    NEW.view_count := 3000 + floor(random() * 2001)::int;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tools_seed_view_count_trigger ON public.tools;

CREATE TRIGGER tools_seed_view_count_trigger
  BEFORE INSERT OR UPDATE ON public.tools
  FOR EACH ROW
  EXECUTE FUNCTION public.tools_seed_view_count_if_needed();

COMMENT ON FUNCTION public.tools_seed_view_count_if_needed() IS
  '已通过且未禁用且 view_count<3000：INSERT 为 approved 或 UPDATE 首次变为 approved 时写入 3000–5000 随机基数';
