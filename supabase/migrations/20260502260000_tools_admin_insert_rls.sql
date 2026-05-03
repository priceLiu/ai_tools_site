-- 管理员可插入工具（批量导入初始数据等）

DROP POLICY IF EXISTS "tools_insert_admin" ON public.tools;
CREATE POLICY "tools_insert_admin"
  ON public.tools
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_user());
