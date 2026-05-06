/**
 * 标签 → 关键词词典
 *
 * - key 为 docs/label.txt 中 217 个 curated 标签的标准名（与 supabase/migrations/20260506000100_*.sql 完全一致）；
 * - value 为该标签的同义/英文/口语关键词数组，匹配时**统一转小写**后做包含匹配；
 *
 * 命中策略由 lib/tool-tags-extract.ts 决定：
 *   标题 / 描述 / 介绍 三段累加权重，正文权重最低；
 *   排序输出 ≤ 12，分类名兜底首位。
 *
 * 维护建议：
 *   - 关键词不必追求多，**5–10 个**即可；过多会冲淡评分；
 *   - 必要时把分类名（"内容创作与自媒体"）保留为兜底，由 matcher 做归一。
 */
export const TAG_KEYWORDS: Record<string, string[]> = {
  // ============== 内容创作与自媒体 ==============
  文本生成: ['文本生成', '生成文本', 'text generation', 'text gen', '续写', '写文', '生成段落'],
  文章写作: ['文章写作', '写文章', '撰写', 'article', '写稿', '稿件', '博客写作', 'blog writer'],
  文案生成: ['文案生成', '文案', 'copywriting', 'copywriter', '广告文案', '种草文案', '小红书文案'],
  小说创作: ['小说', '小说创作', 'novel', 'fiction', '故事写作', '续写小说', '剧情创作'],
  脚本生成: ['脚本生成', '脚本', '剧本', 'script', 'screenplay', '短视频脚本', '分镜脚本'],
  社交媒体文案: [
    '社交媒体',
    '小红书',
    '微博文案',
    '抖音文案',
    'twitter post',
    'social post',
    'social media copy',
  ],
  视频生成: ['视频生成', '生成视频', 'video generation', 'text to video', '文生视频', 'image to video', '图生视频'],
  视频编辑: ['视频编辑', '剪辑', 'video editing', '剪视频', '视频剪辑', '一键剪辑', 'video editor'],
  自动字幕: ['字幕', '自动字幕', 'auto subtitle', 'caption', '字幕生成', 'srt'],
  数字人: ['数字人', 'digital human', '虚拟人', 'avatar', 'ai主播', 'ai 主持人', 'lip sync'],
  音乐生成: ['音乐生成', '生成音乐', 'music gen', 'ai music', 'compose music', 'suno', '歌曲生成'],
  语音合成: ['语音合成', 'tts', 'text to speech', '配音', '朗读', 'voice synthesis', '克隆音色'],
  播客制作: ['播客', 'podcast', '播客制作', 'ai podcast', '播客脚本'],
  图像生成: ['图像生成', '文生图', '图生图', 'ai绘画', 'ai绘图', 'text to image', 'image generation', 'stable diffusion'],
  图片编辑: ['图片编辑', '图像编辑', '修图', 'photo editor', 'image editing', 'inpaint', '局部重绘'],
  图片修复: ['图片修复', '图像修复', '老照片修复', 'photo restore', 'restoration', '高清修复'],
  Logo设计: ['logo设计', 'logo 设计', 'logo generator', 'logo maker', '商标设计'],
  海报设计: ['海报', '海报设计', 'poster', 'flyer', '宣传图', '广告图'],
  视频转GIF: ['视频转gif', 'video to gif', 'gif 制作', '动图生成', 'mp4 to gif'],
  视频压缩: ['视频压缩', '压缩视频', 'video compress', 'compress mp4', '降低码率'],
  音频编辑: ['音频编辑', '剪音频', 'audio editing', 'audio editor', '波形剪辑'],
  音频降噪: ['音频降噪', '降噪', 'noise reduction', 'denoise', '去噪'],
  背景去除: ['背景去除', '去背景', '抠图', 'remove background', 'bg remove', '透明背景'],
  对象移除: ['对象移除', '物体移除', 'object remove', 'erase object', 'inpaint object'],
  人脸替换: ['人脸替换', '换脸', 'face swap', 'deepfake', 'face replace'],

  // ============== 办公与效率提升 ==============
  文档总结: ['文档总结', '文档摘要', '总结文档', 'summarize document', 'summary'],
  文档翻译: ['文档翻译', '文档 翻译', 'document translation', 'translate document'],
  文档校对: ['文档校对', '校对', 'proofread', 'grammar check', '语法检查'],
  PDF处理: ['pdf处理', 'pdf 处理', 'pdf 编辑', 'pdf 解析', 'pdf to', 'pdf merge', 'split pdf'],
  PPT生成: ['ppt生成', '生成ppt', '一键ppt', 'slides generate', 'ppt maker', 'ai ppt'],
  PPT美化: ['ppt美化', 'ppt 优化', 'beautify slides', 'ppt redesign', '幻灯片美化'],
  演讲稿生成: ['演讲稿', 'speech writer', 'speech generation', '演讲生成', '发言稿'],
  Excel公式: ['excel公式', '公式生成', 'excel formula', 'formula generator', 'excel function'],
  数据清洗: ['数据清洗', 'data cleaning', 'data wrangling', '清洗数据', '去重数据'],
  图表生成: ['图表生成', 'chart generator', 'chart maker', '生成图表', 'plot generator'],
  会议纪要: ['会议纪要', '会议记录', 'meeting notes', 'meeting minutes', 'meeting recap'],
  邮件生成: ['邮件生成', '写邮件', 'email writer', 'email generator', 'mail copy'],
  日程管理: ['日程管理', '日程', 'calendar', 'schedule manage', '日程助手'],
  表格处理: ['表格处理', '处理表格', 'spreadsheet', 'sheet 处理', 'csv 处理', '表格转换'],
  报告生成: ['报告生成', '生成报告', 'report generator', '一键写报告', 'report writing'],
  数据录入: ['数据录入', '录入数据', 'data entry', '自动录入', '批量录入'],
  合同审核: ['合同审核', '合同检查', 'contract review', '合同分析', '合同风险'],
  法律咨询: ['法律咨询', '法律助手', 'legal assistant', 'legal advice', '法律ai'],
  预约管理: ['预约管理', '预约', '预定管理', 'appointment', 'booking', 'reservation'],
  发票生成: ['发票生成', '开票', 'invoice generator', '一键发票'],
  知识库: ['知识库', 'knowledge base', '企业知识库', '知识中心', 'wiki'],
  帮助文档: ['帮助文档', '帮助中心', 'help docs', 'help center', '产品文档'],
  用户手册: ['用户手册', '使用手册', 'user manual', 'manual', 'usage guide'],
  远程协作: ['远程协作', '远程办公', 'remote work', 'remote collaboration'],
  白板工具: ['白板', '白板工具', 'whiteboard', '协作白板'],
  思维导图: ['思维导图', '脑图', 'mind map', 'mindmap'],
  流程图制作: ['流程图', '流程图制作', 'flowchart', 'process diagram'],
  协作平台: ['协作平台', '团队协作', '协同办公', 'collaboration platform'],

  // ============== 学术与教育 ==============
  文献综述: ['文献综述', 'literature review', 'lit review', '综述写作'],
  论文润色: ['论文润色', '论文优化', 'paper polish', 'paper editing', '英文润色'],
  论文降重: ['论文降重', '论文查重', '降重', 'paraphrase', 'plagiarism reduce'],
  参考文献生成: ['参考文献', '参考文献生成', 'citation generator', 'bibliography', 'reference 生成'],
  考公刷题: ['考公', '公务员考试', '行测', '申论', '考公刷题'],
  考研辅导: ['考研', '考研辅导', '研究生考试', '考研助手'],
  错题本: ['错题本', '错题', '错题整理', '错题集', 'wrong question'],
  外语学习: ['外语学习', '英语学习', 'language learning', '口语练习', '托福', '雅思'],
  编程教学: ['编程教学', '编程教程', '编程培训', 'coding tutorial', 'learn programming', 'learn coding'],
  问答助手: ['问答助手', '问答 ai', 'qa assistant', 'question answer', '答疑'],
  学习助手: ['学习助手', 'study assistant', '学习ai', 'learning helper'],
  作业批改: ['作业批改', '批改作业', '批阅', 'homework grading', 'auto grading'],
  考试辅助: ['考试辅助', '考试 ai', 'exam helper', '考试助手', '考试备考'],
  论文写作: ['论文写作', '写论文', 'paper writing', 'thesis writer', 'academic writing'],
  学术搜索: ['学术搜索', 'academic search', 'scholar search', '学术检索', 'scholar'],
  科研助手: ['科研助手', '科研 ai', 'research assistant', '研究助手'],
  教程生成: ['教程生成', '生成教程', 'tutorial generator', '一键教程'],

  // ============== 数据与编程 ==============
  代码生成: ['代码生成', '生成代码', 'code generation', 'code gen', '写代码', 'codegen', 'copilot'],
  代码补全: ['代码补全', 'code completion', 'autocomplete code', 'tab complete'],
  代码调试: ['代码调试', 'debug code', 'debugging', '代码 debug'],
  代码解释: ['代码解释', 'explain code', 'code explainer', '解读代码'],
  单元测试: ['单元测试', 'unit test', 'unit testing', 'jest test', 'pytest'],
  SQL生成: ['sql生成', '生成sql', 'text to sql', 'sql generator', 'natural language to sql'],
  数据可视化: ['数据可视化', 'data visualization', '图表分析', 'visualize data', 'dashboard chart'],
  报表生成: ['报表生成', '生成报表', 'report generator', '报表制作'],
  代码审查: ['代码审查', 'code review', 'pr review', 'review code'],
  性能优化: ['性能优化', 'performance optimization', 'optimize performance', '加速代码'],
  Bug检测: ['bug检测', 'bug detection', '查找bug', '排查bug', 'static analysis'],
  自动化测试: ['自动化测试', '自动测试', 'automation test', 'e2e test', 'auto test'],
  部署工具: ['部署工具', 'deploy tool', '一键部署', 'deployment'],
  数据库管理: ['数据库管理', '数据库工具', 'database management', 'db tool', 'sql client'],
  代码示例: ['代码示例', 'code example', 'snippet', 'code snippet', 'sample code'],
  项目生成: ['项目生成', '一键项目', 'project generator', 'scaffold project', 'starter template'],
  数据分析报告: ['数据分析报告', 'data analysis report', '分析报告', '数据报告'],
  可视化图表: ['可视化图表', '可视化', 'chart visualize', 'visualization'],
  仪表盘: ['仪表盘', 'dashboard', '看板', 'metrics dashboard'],
  预测分析: ['预测分析', 'predictive analytics', '业务预测', '销量预测'],
  关联规则: ['关联规则', 'association rule', '关联挖掘', 'apriori'],
  聚类分析: ['聚类', '聚类分析', 'clustering', 'kmeans'],
  回归分析: ['回归分析', 'regression', 'linear regression', 'logistic regression'],
  时间序列: ['时间序列', '时序分析', 'time series', 'forecasting'],
  推荐优化: ['推荐优化', '推荐策略', 'recsys optimize', '推荐排序优化'],
  排序学习: ['排序学习', 'learning to rank', 'ltr', 'ranking model'],
  版本控制: ['版本控制', 'version control', 'git', 'svn'],
  代码托管: ['代码托管', 'code hosting', 'git hosting', 'github 替代', 'gitlab'],
  持续集成: ['持续集成', 'ci', 'continuous integration', 'pipeline ci'],
  容器化: ['容器化', 'docker', 'container', 'kubernetes', 'k8s'],
  微服务: ['微服务', 'microservice', 'service mesh', 'micro-service'],
  无服务器: ['无服务器', 'serverless', 'lambda', 'cloudflare worker'],
  智能合约: ['智能合约', 'smart contract', 'solidity'],

  // ============== 营销与商业 ==============
  广告文案: ['广告文案', 'ad copy', 'ad copywriting', '推广文案'],
  SEO优化: ['seo优化', 'seo', '搜索引擎优化', 'seo writer', 'seo 文章'],
  营销邮件: ['营销邮件', 'marketing email', 'edm', 'cold email', '邮件营销'],
  智能客服: ['智能客服', 'ai customer service', '客服机器人', 'customer support ai'],
  聊天机器人: ['聊天机器人', 'chatbot', 'chat bot', '机器人客服'],
  竞品分析: ['竞品分析', 'competitor analysis', '竞争分析', 'competitive analysis'],
  舆情监控: ['舆情监控', '舆情分析', 'public opinion', 'social listening'],
  口号生成: ['口号生成', 'slogan', 'slogan generator', '广告语生成'],
  客户管理: ['客户管理', 'crm', 'customer management', '客户系统'],
  销售管理: ['销售管理', 'sales management', 'sales pipeline'],
  库存管理: ['库存管理', 'inventory', 'inventory management', '库存系统'],
  订单处理: ['订单处理', 'order processing', '订单系统'],
  售后客服: ['售后客服', '售后', 'after-sales', 'after sales support'],
  工单系统: ['工单', '工单系统', 'ticket system', 'helpdesk'],
  'A/B测试': ['ab测试', 'a/b测试', 'ab test', 'a/b test', 'split test'],
  用户行为分析: ['用户行为分析', 'user behavior', 'behavior analytics', 'event tracking'],
  漏斗分析: ['漏斗分析', 'funnel analysis', 'conversion funnel'],
  留存分析: ['留存分析', 'retention analysis', '用户留存'],
  归因分析: ['归因分析', 'attribution', 'attribution analysis'],

  // ============== 生活与创意 ==============
  简历优化: ['简历优化', '简历润色', 'resume optimize', 'resume builder', 'cv 优化'],
  模拟面试: ['模拟面试', 'mock interview', '面试练习', '模拟 hr'],
  职业规划: ['职业规划', 'career planning', '职业咨询', 'career coach'],
  个人助理: ['个人助理', 'personal assistant', '私人助理', 'pa ai'],
  灵感记录: ['灵感记录', 'idea capture', '灵感本', 'inspiration journal'],
  AI聊天: ['ai聊天', 'ai 聊天', 'chat ai', 'ai chatbot', '陪聊'],
  故事生成: ['故事生成', 'story generator', '生成故事', 'storytelling'],
  逻辑推理: ['逻辑推理', 'logic reasoning', 'reasoning', '推理 ai'],
  创意生成: ['创意生成', 'creative ideas', 'idea generator', '创意点子'],
  头脑风暴: ['头脑风暴', '脑暴', 'brainstorm', 'brainstorming'],
  命名生成: ['命名生成', '取名', 'name generator', 'naming', '产品命名'],

  // ============== 设计创意 ==============
  界面设计: ['界面设计', 'ui设计', 'ui design', 'interface design'],
  原型设计: ['原型设计', 'prototype design', '产品原型', 'wireframe'],
  原型图: ['原型图', 'wireframe', 'mockup', '低保真原型', 'hi-fi prototype'],
  '3D建模': ['3d建模', '三维建模', '3d model', '3d modeling', 'modeling 3d'],
  材质生成: ['材质生成', '贴图生成', 'material generation', 'pbr texture'],
  户型设计: ['户型设计', '户型图', 'floor plan', '户型布局'],
  装修设计: ['装修设计', '装修', 'interior design', '家装设计', '室内设计'],
  品牌设计: ['品牌设计', 'brand design', 'branding', '品牌视觉'],
  配色方案: ['配色', '配色方案', 'color palette', 'color scheme'],
  字体设计: ['字体设计', 'typeface', 'font design', '字形设计'],
  原型演示: ['原型演示', 'prototype demo', '交互演示', 'click prototype'],

  // ============== 工具与基础设施 ==============
  OCR识别: ['ocr', 'ocr识别', '文字识别', 'optical character recognition'],
  语音识别: ['语音识别', 'asr', 'speech recognition', 'voice recognition'],
  语音转文字: ['语音转文字', 'speech to text', 'voice to text', '听写', 'transcribe'],
  文字转语音: ['文字转语音', 'text to speech', 'tts', '朗读'],
  翻译工具: ['翻译工具', 'translator', '机器翻译', 'translation tool'],
  情感分析: ['情感分析', 'sentiment analysis', '舆情情感'],
  数据标注: ['数据标注', '标注', 'data labeling', 'data annotation'],
  模型训练: ['模型训练', 'model training', 'train model', 'fine tuning'],
  API集成: ['api集成', 'api integration', 'api connector', 'webhook'],
  工作流自动化: ['工作流自动化', 'workflow automation', '自动化工作流', 'no-code workflow', 'zapier'],
  网页抓取: ['网页抓取', 'web scraping', '爬虫', 'scraper', 'crawler'],
  表单生成: ['表单生成', 'form generator', '生成表单', 'survey form'],
  数据分析: ['数据分析', 'data analysis', '业务分析', 'analytics'],
  预测建模: ['预测建模', 'predictive modeling', '预测模型'],
  推荐系统: ['推荐系统', 'recommendation system', 'recsys', '推荐算法'],
  知识图谱: ['知识图谱', 'knowledge graph', 'kg', 'graph 知识'],
  语义搜索: ['语义搜索', 'semantic search', 'vector search', '向量检索'],
  文档解析: ['文档解析', 'document parsing', 'pdf parsing', 'doc 解析'],
  信息提取: ['信息提取', 'information extraction', '抽取信息', 'ner'],
  知识库管理: ['知识库管理', 'knowledge base management', 'kb 管理'],
  姿势检测: ['姿势检测', 'pose detection', '姿态检测', '动作检测'],
  文字识别: ['文字识别', 'text recognition', '字符识别'],
  手写识别: ['手写识别', 'handwriting recognition', 'handwriting ocr'],
  表格识别: ['表格识别', 'table recognition', 'table extraction'],
  发票识别: ['发票识别', 'invoice ocr', 'invoice recognition'],
  身份证识别: ['身份证识别', 'id card ocr', 'id recognition'],
  服务器监控: ['服务器监控', 'server monitoring', 'server monitor', '监控服务器'],
  日志分析: ['日志分析', 'log analysis', 'log analytics', 'splunk'],
  安全检测: ['安全检测', 'security scan', '安全扫描', 'security check'],
  漏洞扫描: ['漏洞扫描', 'vulnerability scan', 'vuln scan', 'cve 扫描'],
  加密工具: ['加密工具', 'encryption', 'encrypt tool', 'cipher'],
  密码管理: ['密码管理', 'password manager', '密码工具', 'pwd manage'],
  备份恢复: ['备份恢复', 'backup restore', '数据备份', 'restore tool'],
  文件转换: ['文件转换', 'file convert', 'file converter'],
  格式转换: ['格式转换', 'format convert', 'format converter'],
  压缩解压: ['压缩解压', '压缩 解压', 'archive', 'unzip', 'zip tool'],
  批量处理: ['批量处理', 'batch processing', 'bulk process', '批处理'],
  定时任务: ['定时任务', 'cron', 'scheduled task', 'task scheduler'],
  通知推送: ['通知推送', 'push notification', 'notification', 'webhook 通知'],
  订阅管理: ['订阅管理', 'subscription management', '订阅工具'],
  表单构建: ['表单构建', 'form builder', '构建表单', 'survey builder'],
  调查问卷: ['调查问卷', 'survey', 'questionnaire', '问卷调查'],
  投票系统: ['投票系统', 'voting', 'poll', 'voting system'],
  支付集成: ['支付集成', 'payment integration', 'stripe', 'payment sdk'],
  物流跟踪: ['物流跟踪', 'logistics tracking', '快递跟踪', 'shipment tracking'],
  文件管理: ['文件管理', 'file management', '文件工具', 'file manager'],
  云存储: ['云存储', 'cloud storage', 'object storage', 's3'],
  同步备份: ['同步备份', 'sync backup', '备份同步', '云同步'],
  用户测试: ['用户测试', 'user testing', 'usability test', 'ux test'],
  监控报警: ['监控报警', 'monitoring alert', 'alerting', '告警'],
  自然语言处理: ['自然语言处理', 'nlp', 'natural language processing'],
  图像分类: ['图像分类', 'image classification', 'classify image'],
  目标检测: ['目标检测', 'object detection', 'yolo', 'detection model'],
  语义分割: ['语义分割', 'semantic segmentation', 'segmentation 模型'],
  姿态估计: ['姿态估计', 'pose estimation', '人体姿态', 'pose model'],
  视频分析: ['视频分析', 'video analysis', '视频理解', 'video analytics'],
  音频分析: ['音频分析', 'audio analysis', '声音分析'],
  情感计算: ['情感计算', 'affective computing', 'emotion ai'],
  强化学习: ['强化学习', 'reinforcement learning', 'rlhf', 'rl model'],
  迁移学习: ['迁移学习', 'transfer learning', 'transfer model'],
  联邦学习: ['联邦学习', 'federated learning'],
  模型压缩: ['模型压缩', 'model compression', 'quantization', 'distillation'],
  模型部署: ['模型部署', 'model deployment', 'model serving', 'inference server'],
  特征工程: ['特征工程', 'feature engineering', 'feature store'],
  超参数优化: ['超参数', '超参数优化', 'hyperparameter', 'hpo'],
  实验管理: ['实验管理', 'experiment tracking', 'mlflow', 'ml experiment'],
  边缘计算: ['边缘计算', 'edge computing', 'edge device'],
  物联网: ['物联网', 'iot', 'internet of things'],
  区块链: ['区块链', 'blockchain', '链上'],
  去中心化: ['去中心化', 'decentralized', 'web3'],
  隐私计算: ['隐私计算', 'privacy computing', '安全多方计算', 'mpc'],
  同态加密: ['同态加密', 'homomorphic encryption', 'fhe'],
  零知识证明: ['零知识证明', 'zero knowledge', 'zk proof', 'zkp'],
}

/** 标签的标准名 → tag_category（一级分类）名 */
export const TAG_TO_CATEGORY_NAME: Record<string, string> = {}

const _CATEGORY_TO_TAGS: Record<string, string[]> = {
  内容创作与自媒体: [
    '文本生成', '文章写作', '文案生成', '小说创作', '脚本生成', '社交媒体文案',
    '视频生成', '视频编辑', '自动字幕', '数字人', '音乐生成', '语音合成', '播客制作',
    '图像生成', '图片编辑', '图片修复', 'Logo设计', '海报设计',
    '视频转GIF', '视频压缩', '音频编辑', '音频降噪', '背景去除', '对象移除', '人脸替换',
  ],
  办公与效率提升: [
    '文档总结', '文档翻译', '文档校对', 'PDF处理', 'PPT生成', 'PPT美化', '演讲稿生成',
    'Excel公式', '数据清洗', '图表生成', '会议纪要', '邮件生成', '日程管理',
    '表格处理', '报告生成', '数据录入', '合同审核', '法律咨询', '预约管理', '发票生成',
    '知识库', '帮助文档', '用户手册', '远程协作', '白板工具', '思维导图', '流程图制作', '协作平台',
  ],
  学术与教育: [
    '文献综述', '论文润色', '论文降重', '参考文献生成', '考公刷题', '考研辅导', '错题本',
    '外语学习', '编程教学', '问答助手',
    '学习助手', '作业批改', '考试辅助', '论文写作', '学术搜索', '科研助手', '教程生成',
  ],
  数据与编程: [
    '代码生成', '代码补全', '代码调试', '代码解释', '单元测试', 'SQL生成', '数据可视化', '报表生成',
    '代码审查', '性能优化', 'Bug检测', '自动化测试', '部署工具', '数据库管理', '代码示例', '项目生成',
    '数据分析报告', '可视化图表', '仪表盘', '预测分析', '关联规则', '聚类分析', '回归分析', '时间序列',
    '推荐优化', '排序学习', '版本控制', '代码托管', '持续集成', '容器化', '微服务', '无服务器', '智能合约',
  ],
  营销与商业: [
    '广告文案', 'SEO优化', '营销邮件', '智能客服', '聊天机器人', '竞品分析', '舆情监控', '口号生成',
    '客户管理', '销售管理', '库存管理', '订单处理', '售后客服', '工单系统',
    'A/B测试', '用户行为分析', '漏斗分析', '留存分析', '归因分析',
  ],
  生活与创意: [
    '简历优化', '模拟面试', '职业规划', '个人助理', '灵感记录', 'AI聊天', '故事生成',
    '逻辑推理', '创意生成', '头脑风暴', '命名生成',
  ],
  设计创意: [
    '界面设计', '原型设计', '原型图', '3D建模', '材质生成', '户型设计', '装修设计',
    '品牌设计', '配色方案', '字体设计', '原型演示',
  ],
  工具与基础设施: [
    'OCR识别', '语音识别', '语音转文字', '文字转语音', '翻译工具', '情感分析', '数据标注', '模型训练',
    'API集成', '工作流自动化', '网页抓取', '表单生成', '数据分析', '预测建模', '推荐系统', '知识图谱',
    '语义搜索', '文档解析', '信息提取', '知识库管理', '姿势检测', '文字识别', '手写识别', '表格识别',
    '发票识别', '身份证识别', '服务器监控', '日志分析', '安全检测', '漏洞扫描', '加密工具', '密码管理',
    '备份恢复', '文件转换', '格式转换', '压缩解压', '批量处理', '定时任务', '通知推送', '订阅管理',
    '表单构建', '调查问卷', '投票系统', '支付集成', '物流跟踪', '文件管理', '云存储', '同步备份',
    '用户测试', '监控报警', '自然语言处理', '图像分类', '目标检测', '语义分割', '姿态估计', '视频分析',
    '音频分析', '情感计算', '强化学习', '迁移学习', '联邦学习', '模型压缩', '模型部署', '特征工程',
    '超参数优化', '实验管理', '边缘计算', '物联网', '区块链', '去中心化', '隐私计算', '同态加密', '零知识证明',
  ],
}

for (const [cat, tagList] of Object.entries(_CATEGORY_TO_TAGS)) {
  for (const t of tagList) {
    TAG_TO_CATEGORY_NAME[t] = cat
  }
}

/** 全部 217 个 curated 标签的标准名（保持迁移种子顺序，便于稳定排序） */
export const CURATED_TAG_NAMES: string[] = Object.keys(TAG_TO_CATEGORY_NAME)

/** 取一个 curated 标签的关键词数组；找不到时返回标签名本身（兜底） */
export function getTagKeywordSpec(name: string): string[] {
  const exact = TAG_KEYWORDS[name]
  if (exact && exact.length > 0) return exact
  return [name]
}

/** 取标签所属分类名（不在 curated 词表里的返回 null） */
export function getCategoryOfTag(name: string): string | null {
  return TAG_TO_CATEGORY_NAME[name] ?? null
}

/** 一级分类的固定显示顺序（与 type.txt 一致） */
export const TAG_CATEGORY_NAMES: string[] = Object.keys(_CATEGORY_TO_TAGS)
