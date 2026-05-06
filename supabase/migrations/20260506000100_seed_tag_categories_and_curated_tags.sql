-- 标签管理系统改造（数据种子）
-- 1) 写入 8 个 tag_categories（按 docs/type.txt 顺序）
-- 2) 写入 217 个 curated tags 并填 tag_category_id、is_curated=true
-- 3) 幂等：基于 unique index `tags_name_normalized_unique` 与 tag_categories.slug 唯一约束

-- =========================================================
-- 1) tag_categories
-- =========================================================
INSERT INTO public.tag_categories (name, slug, icon, sort_order, description)
VALUES
  ('内容创作与自媒体', 'content-creation',     'Pen',           1, '写作 / 图像 / 音视频 / 内容形态生产'),
  ('办公与效率提升', 'office-productivity',   'Briefcase',     2, '文档 / PPT / 表格 / 会议 / 协作'),
  ('学术与教育',     'academic-education',    'GraduationCap', 3, '论文 / 学习 / 考试辅助 / 教程'),
  ('数据与编程',     'data-coding',           'Code2',         4, '代码 / 数据库 / 测试 / 数据分析建模'),
  ('营销与商业',     'marketing-business',    'Megaphone',     5, '广告 / 客服 / 客户 / 增长分析'),
  ('生活与创意',     'life-creativity',       'Sparkles',      6, '日常 / 求职 / 创意 / 灵感'),
  ('设计创意',       'design-creative',       'Palette',       7, 'UI / 3D / 配色 / 品牌 / 装修'),
  ('工具与基础设施', 'tools-infrastructure',  'Wrench',        8, '识别 / 自动化 / 模型 / 系统类工具')
ON CONFLICT (slug) DO UPDATE
  SET name        = EXCLUDED.name,
      icon        = EXCLUDED.icon,
      sort_order  = EXCLUDED.sort_order,
      description = EXCLUDED.description;

-- =========================================================
-- 2) curated tags
--    每条都用 ON CONFLICT (lower(trim(name))) 命中
--    `tags_name_normalized_unique` 幂等覆盖 tag_category_id 与 is_curated。
--    name 同时回写为 curated 标准写法，让历史脏数据被规整。
-- =========================================================
DO $seed_tags$
DECLARE
  cat_id uuid;
BEGIN
  -- ---- 内容创作与自媒体 (25) ----
  SELECT id INTO cat_id FROM public.tag_categories WHERE slug = 'content-creation';
  INSERT INTO public.tags (name, tag_category_id, is_curated)
  SELECT v, cat_id, true
  FROM unnest(ARRAY[
    '文本生成','文章写作','文案生成','小说创作','脚本生成','社交媒体文案',
    '视频生成','视频编辑','自动字幕','数字人','音乐生成','语音合成','播客制作',
    '图像生成','图片编辑','图片修复','Logo设计','海报设计',
    '视频转GIF','视频压缩','音频编辑','音频降噪','背景去除','对象移除','人脸替换'
  ]::text[]) AS v
  ON CONFLICT (lower(trim(name))) DO UPDATE
    SET name            = EXCLUDED.name,
        tag_category_id = EXCLUDED.tag_category_id,
        is_curated      = true;

  -- ---- 办公与效率提升 (28) ----
  SELECT id INTO cat_id FROM public.tag_categories WHERE slug = 'office-productivity';
  INSERT INTO public.tags (name, tag_category_id, is_curated)
  SELECT v, cat_id, true
  FROM unnest(ARRAY[
    '文档总结','文档翻译','文档校对','PDF处理','PPT生成','PPT美化','演讲稿生成',
    'Excel公式','数据清洗','图表生成','会议纪要','邮件生成','日程管理',
    '表格处理','报告生成','数据录入','合同审核','法律咨询','预约管理','发票生成',
    '知识库','帮助文档','用户手册','远程协作','白板工具','思维导图','流程图制作','协作平台'
  ]::text[]) AS v
  ON CONFLICT (lower(trim(name))) DO UPDATE
    SET name            = EXCLUDED.name,
        tag_category_id = EXCLUDED.tag_category_id,
        is_curated      = true;

  -- ---- 学术与教育 (17) ----
  SELECT id INTO cat_id FROM public.tag_categories WHERE slug = 'academic-education';
  INSERT INTO public.tags (name, tag_category_id, is_curated)
  SELECT v, cat_id, true
  FROM unnest(ARRAY[
    '文献综述','论文润色','论文降重','参考文献生成','考公刷题','考研辅导','错题本',
    '外语学习','编程教学','问答助手',
    '学习助手','作业批改','考试辅助','论文写作','学术搜索','科研助手','教程生成'
  ]::text[]) AS v
  ON CONFLICT (lower(trim(name))) DO UPDATE
    SET name            = EXCLUDED.name,
        tag_category_id = EXCLUDED.tag_category_id,
        is_curated      = true;

  -- ---- 数据与编程 (33) ----
  SELECT id INTO cat_id FROM public.tag_categories WHERE slug = 'data-coding';
  INSERT INTO public.tags (name, tag_category_id, is_curated)
  SELECT v, cat_id, true
  FROM unnest(ARRAY[
    '代码生成','代码补全','代码调试','代码解释','单元测试','SQL生成','数据可视化','报表生成',
    '代码审查','性能优化','Bug检测','自动化测试','部署工具','数据库管理','代码示例','项目生成',
    '数据分析报告','可视化图表','仪表盘','预测分析','关联规则','聚类分析','回归分析','时间序列',
    '推荐优化','排序学习','版本控制','代码托管','持续集成','容器化','微服务','无服务器','智能合约'
  ]::text[]) AS v
  ON CONFLICT (lower(trim(name))) DO UPDATE
    SET name            = EXCLUDED.name,
        tag_category_id = EXCLUDED.tag_category_id,
        is_curated      = true;

  -- ---- 营销与商业 (19) ----
  SELECT id INTO cat_id FROM public.tag_categories WHERE slug = 'marketing-business';
  INSERT INTO public.tags (name, tag_category_id, is_curated)
  SELECT v, cat_id, true
  FROM unnest(ARRAY[
    '广告文案','SEO优化','营销邮件','智能客服','聊天机器人','竞品分析','舆情监控','口号生成',
    '客户管理','销售管理','库存管理','订单处理','售后客服','工单系统',
    'A/B测试','用户行为分析','漏斗分析','留存分析','归因分析'
  ]::text[]) AS v
  ON CONFLICT (lower(trim(name))) DO UPDATE
    SET name            = EXCLUDED.name,
        tag_category_id = EXCLUDED.tag_category_id,
        is_curated      = true;

  -- ---- 生活与创意 (11) ----
  SELECT id INTO cat_id FROM public.tag_categories WHERE slug = 'life-creativity';
  INSERT INTO public.tags (name, tag_category_id, is_curated)
  SELECT v, cat_id, true
  FROM unnest(ARRAY[
    '简历优化','模拟面试','职业规划','个人助理','灵感记录','AI聊天','故事生成',
    '逻辑推理','创意生成','头脑风暴','命名生成'
  ]::text[]) AS v
  ON CONFLICT (lower(trim(name))) DO UPDATE
    SET name            = EXCLUDED.name,
        tag_category_id = EXCLUDED.tag_category_id,
        is_curated      = true;

  -- ---- 设计创意 (11，含 原型图) ----
  SELECT id INTO cat_id FROM public.tag_categories WHERE slug = 'design-creative';
  INSERT INTO public.tags (name, tag_category_id, is_curated)
  SELECT v, cat_id, true
  FROM unnest(ARRAY[
    '界面设计','原型设计','原型图','3D建模','材质生成','户型设计','装修设计',
    '品牌设计','配色方案','字体设计','原型演示'
  ]::text[]) AS v
  ON CONFLICT (lower(trim(name))) DO UPDATE
    SET name            = EXCLUDED.name,
        tag_category_id = EXCLUDED.tag_category_id,
        is_curated      = true;

  -- ---- 工具与基础设施 (73) ----
  SELECT id INTO cat_id FROM public.tag_categories WHERE slug = 'tools-infrastructure';
  INSERT INTO public.tags (name, tag_category_id, is_curated)
  SELECT v, cat_id, true
  FROM unnest(ARRAY[
    'OCR识别','语音识别','语音转文字','文字转语音','翻译工具','情感分析','数据标注','模型训练',
    'API集成','工作流自动化','网页抓取','表单生成','数据分析','预测建模','推荐系统','知识图谱',
    '语义搜索','文档解析','信息提取','知识库管理','姿势检测','文字识别','手写识别','表格识别',
    '发票识别','身份证识别','服务器监控','日志分析','安全检测','漏洞扫描','加密工具','密码管理',
    '备份恢复','文件转换','格式转换','压缩解压','批量处理','定时任务','通知推送','订阅管理',
    '表单构建','调查问卷','投票系统','支付集成','物流跟踪','文件管理','云存储','同步备份',
    '用户测试','监控报警','自然语言处理','图像分类','目标检测','语义分割','姿态估计','视频分析',
    '音频分析','情感计算','强化学习','迁移学习','联邦学习','模型压缩','模型部署','特征工程',
    '超参数优化','实验管理','边缘计算','物联网','区块链','去中心化','隐私计算','同态加密','零知识证明'
  ]::text[]) AS v
  ON CONFLICT (lower(trim(name))) DO UPDATE
    SET name            = EXCLUDED.name,
        tag_category_id = EXCLUDED.tag_category_id,
        is_curated      = true;

END
$seed_tags$;
