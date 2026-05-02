-- 已通过且未禁用：访问量仍小于 3000 的，统一到 3000–5000（含）随机起始值，之后由 increment_tool_view_count 继续递增
UPDATE public.tools
SET view_count = 3000 + floor(random() * 2001)::int
WHERE status = 'approved'
  AND COALESCE(is_disabled, false) = false
  AND COALESCE(view_count, 0) < 3000;
