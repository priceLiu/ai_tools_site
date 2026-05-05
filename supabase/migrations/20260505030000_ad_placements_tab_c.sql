-- 给 Section 1 增加第三个 Tab (C)
-- 如果表已存在，需要修改 CHECK 约束

DO $$
BEGIN
  -- 先检查表是否存在
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ad_placements'
  ) THEN
    -- 删除旧约束
    ALTER TABLE public.ad_placements
      DROP CONSTRAINT IF EXISTS ad_placements_tabkey_check;
    
    -- 添加新约束（包含 'C'）
    ALTER TABLE public.ad_placements
      ADD CONSTRAINT ad_placements_tabkey_check
      CHECK (
        (placement = 'section1' AND tab_key IN ('A', 'B', 'C'))
        OR (placement = 'section2' AND tab_key IS NULL)
      );
  END IF;
END $$;
