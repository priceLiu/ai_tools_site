-- 幂等种子：4 个角色 + 与旧版 lib/tag-roles.ts「高亮标签」一致的关联（按名称匹配 tags）

INSERT INTO public.role_categories (name, slug, icon, sort_order, tagline, description, is_disabled)
VALUES
  (
    '打工人',
    'office-worker',
    'Briefcase',
    1,
    '加速日常文档、邮件与会议',
    '面向上班族：办公提效、表格 / PPT / 文档自动化、邮件与会议纪要、求职简历与面试 AI 工具。',
    false
  ),
  (
    '创业老板·一人公司',
    'founder',
    'Rocket',
    2,
    '打造增长引擎、把客户跑顺',
    '面向创业者 / 一人公司：广告与文案、SEO、客服与 CRM、用户分析、客户管理与订单。',
    false
  ),
  (
    '自由职业·自媒体',
    'creator',
    'PenTool',
    3,
    '内容生产 + 视觉设计两手抓',
    '面向自媒体 / 自由职业者：图文、短视频、直播脚本、Logo / 海报、品牌设计、配色与字体。',
    false
  ),
  (
    '转型学习者',
    'learner',
    'Lightbulb',
    4,
    '从论文到代码，系统学习 AI 时代',
    '面向学生 / 转型学习者：文献综述与论文润色、外语学习、考试辅助、编程教学与代码实战。',
    false
  )
ON CONFLICT (slug) DO UPDATE
  SET name        = EXCLUDED.name,
      icon        = EXCLUDED.icon,
      sort_order  = EXCLUDED.sort_order,
      tagline     = EXCLUDED.tagline,
      description = EXCLUDED.description;

-- 按角色批量关联标签（仅当 tags 表中存在同名时插入）
INSERT INTO public.role_category_tags (role_category_id, tag_id, sort_order)
SELECT rc.id, t.id, u.ord::int
FROM public.role_categories rc
CROSS JOIN unnest(
  ARRAY[
    'PPT生成',
    '会议纪要',
    '邮件生成',
    'Excel公式',
    '文档总结',
    '简历优化',
    '模拟面试',
    '数据可视化'
  ]::text[]
) WITH ORDINALITY AS u(name, ord)
JOIN public.tags t ON lower(trim(t.name)) = lower(trim(u.name))
WHERE rc.slug = 'office-worker'
ON CONFLICT (role_category_id, tag_id) DO NOTHING;

INSERT INTO public.role_category_tags (role_category_id, tag_id, sort_order)
SELECT rc.id, t.id, u.ord::int
FROM public.role_categories rc
CROSS JOIN unnest(
  ARRAY[
    '广告文案',
    'SEO优化',
    '智能客服',
    '聊天机器人',
    '竞品分析',
    '客户管理',
    '用户行为分析',
    '归因分析'
  ]::text[]
) WITH ORDINALITY AS u(name, ord)
JOIN public.tags t ON lower(trim(t.name)) = lower(trim(u.name))
WHERE rc.slug = 'founder'
ON CONFLICT (role_category_id, tag_id) DO NOTHING;

INSERT INTO public.role_category_tags (role_category_id, tag_id, sort_order)
SELECT rc.id, t.id, u.ord::int
FROM public.role_categories rc
CROSS JOIN unnest(
  ARRAY[
    '社交媒体文案',
    '视频生成',
    '视频编辑',
    '图像生成',
    '海报设计',
    'Logo设计',
    '界面设计',
    '配色方案'
  ]::text[]
) WITH ORDINALITY AS u(name, ord)
JOIN public.tags t ON lower(trim(t.name)) = lower(trim(u.name))
WHERE rc.slug = 'creator'
ON CONFLICT (role_category_id, tag_id) DO NOTHING;

INSERT INTO public.role_category_tags (role_category_id, tag_id, sort_order)
SELECT rc.id, t.id, u.ord::int
FROM public.role_categories rc
CROSS JOIN unnest(
  ARRAY[
    '论文润色',
    '论文写作',
    '文献综述',
    '学术搜索',
    '外语学习',
    '编程教学',
    '代码生成',
    '代码解释'
  ]::text[]
) WITH ORDINALITY AS u(name, ord)
JOIN public.tags t ON lower(trim(t.name)) = lower(trim(u.name))
WHERE rc.slug = 'learner'
ON CONFLICT (role_category_id, tag_id) DO NOTHING;
