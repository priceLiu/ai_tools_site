-- 收藏总数落在 tools 表，由触发器与 favorites 同步；并做一次回填
ALTER TABLE public.tools
  ADD COLUMN IF NOT EXISTS favorite_count integer NOT NULL DEFAULT 0;

UPDATE public.tools t
SET favorite_count = COALESCE(
  (SELECT count(*)::integer FROM public.favorites f WHERE f.tool_id = t.id),
  0
);

CREATE OR REPLACE FUNCTION public.tools_adjust_favorite_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF tg_op = 'INSERT' THEN
    UPDATE public.tools
    SET favorite_count = favorite_count + 1,
        updated_at = now()
    WHERE id = NEW.tool_id;
    RETURN NEW;
  ELSIF tg_op = 'DELETE' THEN
    UPDATE public.tools
    SET favorite_count = GREATEST(0, favorite_count - 1),
        updated_at = now()
    WHERE id = OLD.tool_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS favorites_bump_tools_count ON public.favorites;
CREATE TRIGGER favorites_bump_tools_count
  AFTER INSERT OR DELETE ON public.favorites
  FOR EACH ROW
  EXECUTE FUNCTION public.tools_adjust_favorite_count();
