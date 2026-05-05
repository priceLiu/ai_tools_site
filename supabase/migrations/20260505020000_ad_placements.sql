-- 首页广告位（独立投放表，与 tools 解耦；同一工具可多次投放、不同时段）
--
-- 与 docs/info.md 中"展示热门 AI 工具 + 用户提交 + 审核上架"流程并行：
--   placement = 'section1'：首页 logo 下"三个 tab"区域；tab_key 为 'A' / 'B' / 'C'
--   placement = 'section2'：首页第二屏"3 张 banner 自动轮播"；需要 banner_url
-- 应用层校验：start < end；前台只取 status='approved' AND now() ∈ [starts_at, ends_at]。

CREATE TABLE IF NOT EXISTS public.ad_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id uuid NOT NULL REFERENCES public.tools (id) ON DELETE CASCADE,
  placement text NOT NULL,
  tab_key text,
  banner_url text,
  price numeric(10, 2) NOT NULL DEFAULT 0,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  rejection_reason text,
  sort_order integer NOT NULL DEFAULT 0,
  submitted_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ad_placements_placement_check
    CHECK (placement IN ('section1', 'section2')),
  CONSTRAINT ad_placements_status_check
    CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT ad_placements_tabkey_check
    CHECK (
      (placement = 'section1' AND tab_key IN ('A', 'B', 'C'))
      OR (placement = 'section2' AND tab_key IS NULL)
    ),
  CONSTRAINT ad_placements_banner_check
    CHECK (
      placement <> 'section2'
      OR (banner_url IS NOT NULL AND length(trim(banner_url)) > 0)
    ),
  CONSTRAINT ad_placements_period_check
    CHECK (ends_at > starts_at)
);

-- 已通过 + 在生效期 + 同 placement / tab 内的有序拉取
CREATE INDEX IF NOT EXISTS ad_placements_active_idx
  ON public.ad_placements (placement, tab_key, sort_order)
  WHERE status = 'approved';

CREATE INDEX IF NOT EXISTS ad_placements_period_idx
  ON public.ad_placements (starts_at, ends_at);

CREATE INDEX IF NOT EXISTS ad_placements_tool_idx
  ON public.ad_placements (tool_id);

ALTER TABLE public.ad_placements DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.ad_placements IS
  '首页广告位投放：section1 左右 tab 网格 / section2 banner 轮播';
COMMENT ON COLUMN public.ad_placements.tab_key IS
  'section1 时为 A 或 B，对应首页左侧两个按钮；section2 时为 NULL';
COMMENT ON COLUMN public.ad_placements.banner_url IS
  'section2 必填；可为 data: URL，前端通过 /api/img/ad/<id> 代理';
