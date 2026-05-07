-- 个人中心「我的关注」：单工具订阅（与 favorites 收藏独立；上限应用层 20）

CREATE TABLE IF NOT EXISTS public.user_follow_tools (
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  tool_id uuid NOT NULL REFERENCES public.tools (id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tool_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follow_tools_user_sort
  ON public.user_follow_tools (user_id, sort_order);

COMMENT ON TABLE public.user_follow_tools IS
  '用户在「我的关注」 pinned 的工具（最多 20）；工具下架后仍可保留行以便提示失效。';

ALTER TABLE public.user_follow_tools DISABLE ROW LEVEL SECURITY;
