-- 管理员可更新任意 tools 行（与会话用户是否为 tool owner 无关）

DROP POLICY IF EXISTS "tools_update_admin" ON public.tools;

CREATE POLICY "tools_update_admin"
  ON public.tools
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());
