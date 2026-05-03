import type { IntroductionFormat } from '@/lib/introduction-format'
import type { ToolTagLink } from '@/lib/types'
import { normalizeIntroductionFormat } from '@/lib/introduction-format'

/** 对外最多展示 / 入库的标签数 */
export const TOOL_TAGS_MAX = 6

export type CapabilityRule = {
  /** 写入库中的标准名称（与已有 tags 表 name 匹配） */
  label: string
  /** 在介绍正文中匹配（已统一小写空白后的小写串上做测试时可再包一层） */
  patterns: RegExp[]
}

/**
 * AI 能力向标签规则：仅从介绍中匹配能力维度（分类标签单独由分类名注入）
 * 顺序约靠前优先命中；会与分类名合并后去重截断至 TOOL_TAGS_MAX
 */
export const AI_CAPABILITY_TAG_RULES: CapabilityRule[] = [
  {
    label: '视频',
    patterns: [
      /视频/,
      /\bvideo\b/i,
      /影片/,
      /短视频/,
      /音视频/,
      /生成视频/,
      /文生视频/,
      /图生视频/,
    ],
  },
  {
    label: '音频',
    patterns: [/音频/, /\baudio\b/i, /语音/, /播客/, /配乐/, /音效/],
  },
  {
    label: '动画',
    patterns: [/动画/, /动效/, /motion\b/i, /animat/i],
  },
  {
    label: '图像生成',
    patterns: [/文生图/, /图生图/, /图像生成/, /出图/, /ai绘画/, /ai绘图/, /\bai\s*image/i],
  },
  {
    label: '图像编辑',
    patterns: [/修图/, /抠图/, /图像编辑/, /图片编辑/, /inpaint/i, /图像处理/],
  },
  {
    label: '代码',
    patterns: [
      /代码生成/,
      /编程助手/,
      /\bcopilot\b/i,
      /\bcode\s*gen/i,
      /写代码/,
      /代码补全/,
      /ide插件/,
      /\bgithub\b.*\bai\b/i,
    ],
  },
  {
    label: '文本写作',
    patterns: [/写作/, /文案/, /撰文/, /续写/, /润色/, /生成文本/, /\bwriting\b/i],
  },
  {
    label: '对话',
    patterns: [/对话/, /聊天机器人/, /chatbot/i, /\bchat\b.*\bai\b/i, /多轮对话/],
  },
  {
    label: '搜索',
    patterns: [/搜索/, /检索增强/, /\brag\b/i, /联网搜索/, /实时信息/],
  },
  {
    label: '翻译',
    patterns: [/翻译/, /\btranslate/i, /多语言/, /本地化/],
  },
  {
    label: '数据分析',
    patterns: [/数据分析/, /数据可视化/, /bi\b/i, /报表/, /统计/, /excel/i, /表格分析/],
  },
  {
    label: '表格',
    patterns: [/电子表格/, /表格/, /\bspreadsheet/i, /\bexcel\b/i],
  },
  {
    label: '演示文档',
    patterns: [/ppt/i, /幻灯片/, /演示文稿/, /deck/i],
  },
  {
    label: 'PDF',
    patterns: [/\bpdf\b/i, /pdf文档/],
  },
  {
    label: '3D',
    patterns: [/\b3d\b/i, /三维/, /建模/],
  },
  {
    label: '学术文献',
    patterns: [/文献/, /论文/, /引用/, /\bcitation/i, /doi\b/i, /zotero|mendeley|endnote/i],
  },
  {
    label: 'OCR',
    patterns: [/\bocr\b/i, /文字识别/, /识图识字/],
  },
  {
    label: '语音合成',
    patterns: [/语音合成/, /tts\b/i, /朗读/, /文本转语音/],
  },
  {
    label: '语音识别',
    patterns: [/语音识别/, /语音转文字/, /asr\b/i, /听写/],
  },
  {
    label: '会议',
    patterns: [/会议/, /纪要/, /会议记录/, /实时字幕/],
  },
  {
    label: '智能体',
    patterns: [/智能体/, /\bagent\b/i, /自动化工作流/, /工作流/, /编排/],
  },
  {
    label: '知识库',
    patterns: [/知识库/, /企业知识/, /文档问答/],
  },
  {
    label: '多模态',
    patterns: [/多模态/, /\bmultimodal\b/i],
  },
]

/** 将介绍转为适合关键词匹配的单行小写文本（尽量剔除 markdown/html 噪音） */
export function introductionToTagScanText(
  raw: string,
  format: IntroductionFormat | string | null | undefined,
): string {
  const fmt = normalizeIntroductionFormat(format as string | undefined)
  let t = (raw ?? '').trim()
  if (!t) return ''
  if (fmt === 'html') {
    t = t
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  } else if (fmt === 'markdown') {
    t = t
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`[^`]*`/g, ' ')
      .replace(/!?\[[^\]]*]\([^)]*\)/g, ' ')
      .replace(/^#{1,6}\s+/gm, ' ')
      .replace(/[*_>#\-]{1,3}\s*/g, ' ')
  }
  return t.replace(/\s+/g, ' ').trim().toLowerCase()
}

export function extractAiCapabilityLabels(scanTextLower: string): string[] {
  if (!scanTextLower) return []
  const out: string[] = []
  const lower = scanTextLower
  for (const rule of AI_CAPABILITY_TAG_RULES) {
    const hit = rule.patterns.some((p) => {
      try {
        return p.test(lower)
      } catch {
        return false
      }
    })
    if (hit && !out.includes(rule.label)) {
      out.push(rule.label)
    }
  }
  return out
}

/**
 * 组装完整标签建议：第 1 个为分类名（若有），其后为介绍中解析的 AI 能力标签；去重、最多 6 个
 */
export function buildSuggestedToolTagNames(input: {
  categoryName: string | null | undefined
  introduction: string
  introductionFormat: IntroductionFormat | string | null | undefined
}): string[] {
  const scan = introductionToTagScanText(
    input.introduction,
    input.introductionFormat,
  )
  const caps = extractAiCapabilityLabels(scan)
  const cat = (input.categoryName ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ')
  const out: string[] = []
  if (cat) {
    out.push(cat)
  }
  for (const c of caps) {
    if (out.length >= TOOL_TAGS_MAX) break
    const cNorm = c.normalize('NFKC').trim()
    if (!cNorm) continue
    const dup = out.some((x) => x.toLowerCase() === cNorm.toLowerCase())
    if (!dup) out.push(cNorm)
  }
  return out.slice(0, TOOL_TAGS_MAX)
}

export function toolTagLabelsFromTool(tool: { tool_tags?: ToolTagLink[] }): string[] {
  const rows = tool.tool_tags
  if (!rows?.length) return []
  return [...rows]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((r) => r.tag?.name)
    .filter((x): x is string => Boolean(x?.trim()))
}
