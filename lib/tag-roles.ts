/**
 * 角色（4 个）→ 一级分类 / 标签预设包。
 *
 * 角色是配置层，并不真实存于数据库；它从「场景一级分类（tag_categories）」+
 * 「curated 标签（217 个）」里抓出一组工具，专门服务首页 Persona 入口。
 *
 * 来源参考：docs/slogan.seo.md
 */

import type { LucideIcon } from 'lucide-react'
import { Briefcase, Lightbulb, PenTool, Rocket } from 'lucide-react'

export interface TagRoleSpec {
  /** URL 段：/role/<slug> */
  slug: string
  /** 角色显示名 */
  name: string
  /** Lucide 图标（首页卡片 / 头部）；用 LucideIcon 引用而非字符串便于编译时检查 */
  icon: LucideIcon
  /** 一句话定位 */
  tagline: string
  /** 角色描述（用于 metadata.description / 页面副标题） */
  description: string
  /** 该角色聚合的一级分类名（与 tag_categories.name 完全一致） */
  tagCategoryNames: string[]
  /** 该角色单独想突出的 curated 标签（不在上述分类里也行；最终会用来高亮 chip） */
  highlightedTagNames: string[]
}

export const TAG_ROLES: TagRoleSpec[] = [
  {
    slug: 'office-worker',
    name: '打工人',
    icon: Briefcase,
    tagline: '加速日常文档、邮件与会议',
    description:
      '面向上班族：办公提效、表格 / PPT / 文档自动化、邮件与会议纪要、求职简历与面试 AI 工具。',
    tagCategoryNames: ['办公与效率提升'],
    highlightedTagNames: [
      'PPT生成',
      '会议纪要',
      '邮件生成',
      'Excel公式',
      '文档总结',
      '简历优化',
      '模拟面试',
      '数据可视化',
    ],
  },
  {
    slug: 'founder',
    name: '创业老板·一人公司',
    icon: Rocket,
    tagline: '打造增长引擎、把客户跑顺',
    description:
      '面向创业者 / 一人公司：广告与文案、SEO、客服与 CRM、用户分析、客户管理与订单。',
    tagCategoryNames: ['营销与商业'],
    highlightedTagNames: [
      '广告文案',
      'SEO优化',
      '智能客服',
      '聊天机器人',
      '竞品分析',
      '客户管理',
      '用户行为分析',
      '归因分析',
    ],
  },
  {
    slug: 'creator',
    name: '自由职业·自媒体',
    icon: PenTool,
    tagline: '内容生产 + 视觉设计两手抓',
    description:
      '面向自媒体 / 自由职业者：图文、短视频、直播脚本、Logo / 海报、品牌设计、配色与字体。',
    tagCategoryNames: ['内容创作与自媒体', '设计创意'],
    highlightedTagNames: [
      '社交媒体文案',
      '视频生成',
      '视频编辑',
      '图像生成',
      '海报设计',
      'Logo设计',
      '界面设计',
      '配色方案',
    ],
  },
  {
    slug: 'learner',
    name: '转型学习者',
    icon: Lightbulb,
    tagline: '从论文到代码，系统学习 AI 时代',
    description:
      '面向学生 / 转型学习者：文献综述与论文润色、外语学习、考试辅助、编程教学与代码实战。',
    tagCategoryNames: ['学术与教育'],
    highlightedTagNames: [
      '论文润色',
      '论文写作',
      '文献综述',
      '学术搜索',
      '外语学习',
      '编程教学',
      '代码生成',
      '代码解释',
    ],
  },
]

export function getTagRoleBySlug(slug: string): TagRoleSpec | null {
  const s = slug.trim().toLowerCase()
  return TAG_ROLES.find((r) => r.slug === s) ?? null
}

export const TAG_ROLE_SLUGS = TAG_ROLES.map((r) => r.slug)
