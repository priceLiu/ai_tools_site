-- 防御性迁移：保证删除 profile 时，其提交的 tools 仅 user_id 置 NULL，
-- 不会把工具行一并 CASCADE 掉。
--
-- 即使应用层将来又写出 `DELETE FROM profiles WHERE id = ...` 这类语句，
-- 由数据库层兜底，工具数据不会被波及。
--
-- 步骤：
-- 1) 把 tools.user_id 设为可空（如果当前不可空）
-- 2) 删掉 tools.user_id 上原有的外键，重建为 ON DELETE SET NULL
--    （兼容历史名称：fk_tools_user, tools_user_id_fkey 等，按 information_schema 查找）

DO $$
DECLARE
  is_nullable text;
  fk_name     text;
BEGIN
  SELECT c.is_nullable
    INTO is_nullable
    FROM information_schema.columns c
   WHERE c.table_schema = 'public'
     AND c.table_name   = 'tools'
     AND c.column_name  = 'user_id';

  IF is_nullable = 'NO' THEN
    EXECUTE 'ALTER TABLE public.tools ALTER COLUMN user_id DROP NOT NULL';
  END IF;

  FOR fk_name IN
    SELECT tc.constraint_name
      FROM information_schema.table_constraints  tc
      JOIN information_schema.key_column_usage   kcu
        ON kcu.constraint_name   = tc.constraint_name
       AND kcu.constraint_schema = tc.constraint_schema
     WHERE tc.constraint_schema = 'public'
       AND tc.table_name        = 'tools'
       AND tc.constraint_type   = 'FOREIGN KEY'
       AND kcu.column_name      = 'user_id'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.tools DROP CONSTRAINT %I',
      fk_name
    );
  END LOOP;

  EXECUTE
    'ALTER TABLE public.tools
       ADD CONSTRAINT tools_user_id_fkey
       FOREIGN KEY (user_id)
       REFERENCES public.profiles(id)
       ON DELETE SET NULL';
END
$$;
