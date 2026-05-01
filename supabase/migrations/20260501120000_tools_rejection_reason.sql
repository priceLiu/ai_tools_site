-- Rejection reason for admin review + visibility in 我的提交
ALTER TABLE tools ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Owners may update their pending or rejected rows; resubmit must end with status = pending (admin sets approved/rejected).
-- Run in Supabase SQL Editor. If this errors on conflict with existing policies, adjust in the dashboard.
DROP POLICY IF EXISTS "tools_owner_update_for_resubmit" ON public.tools;

CREATE POLICY "tools_owner_update_for_resubmit" ON public.tools
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status IN ('pending', 'rejected'))
  WITH CHECK (auth.uid() = user_id AND status = 'pending');
