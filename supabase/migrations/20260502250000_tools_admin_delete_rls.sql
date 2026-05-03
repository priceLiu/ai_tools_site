-- 管理员可删除任意工具（批量删除等）

DROP POLICY IF EXISTS "tools_delete_admin" ON public.tools;
CREATE POLICY "tools_delete_admin"
  ON public.tools
  FOR DELETE
  TO authenticated
  USING (public.is_admin_user());
