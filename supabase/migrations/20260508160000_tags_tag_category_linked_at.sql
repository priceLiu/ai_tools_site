-- 场景归属变更时间：后台「场景分类管理」下列表按「最新迁入」倒序；写入路径见 neonAdminAssignTagToCategory 等。

ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS tag_category_linked_at timestamptz;

COMMENT ON COLUMN public.tags.tag_category_linked_at IS
  '最近一次变更场景归属（tags.tag_category_id）的时间；迁入 / 迁出 / 工具打标签回填场景时刷新。';

UPDATE public.tags
SET tag_category_linked_at = created_at
WHERE tag_category_id IS NOT NULL
  AND tag_category_linked_at IS NULL;
