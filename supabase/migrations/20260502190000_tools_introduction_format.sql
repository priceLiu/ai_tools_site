-- 工具介绍在详情页的渲染方式：纯文本 / Markdown / HTML（.md 文件存为 markdown）
alter table public.tools
  add column if not exists introduction_format text not null default 'markdown';

alter table public.tools
  drop constraint if exists tools_introduction_format_check;

alter table public.tools
  add constraint tools_introduction_format_check
  check (introduction_format in ('plain', 'markdown', 'html'));
