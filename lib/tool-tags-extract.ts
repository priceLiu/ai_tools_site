import type { IntroductionFormat } from '@/lib/introduction-format'
import type { ToolTagLink } from '@/lib/types'
import { normalizeIntroductionFormat } from '@/lib/introduction-format'
import {
  CURATED_TAG_NAMES,
  TAG_TO_CATEGORY_NAME,
  getTagKeywordSpec,
} from '@/lib/tag-keywords'

/**
 * 入库时单工具最多 20 个标签（与 schema 迁移
 * `20260506000000_tag_categories_and_curated_tags.sql` 中 `tool_tags_sort_order_range` 0..19 一致）
 */
export const TOOL_TAGS_MAX = 20

/** 自动建议默认输出上限（含分类名兜底位） */
export const TOOL_TAGS_SUGGEST_MAX = 12

/** 字段权重：标题 > 描述 > 介绍 */
const FIELD_WEIGHTS = {
  name: 5,
  description: 3,
  introduction: 1,
} as const

/** 将介绍转为适合关键词匹配的单行小写文本（尽量剔除 markdown / html 噪音） */
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

function plainLower(text: string | null | undefined): string {
  return (text ?? '')
    .toString()
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function tagOrderIndex(name: string): number {
  const idx = CURATED_TAG_NAMES.indexOf(name)
  return idx >= 0 ? idx : Number.POSITIVE_INFINITY
}

/**
 * 按顺序将菜单 / 场景 / 角色分类名 prepend 为标签匹配提示（与 curated 词表对齐后去重）。
 * 最多写入 `maxCount` 条（与外层 `limit` 对齐，含词典匹配前的占位）。
 */
export function prependTaxonomyHintTagNames(
  out: string[],
  seen: Set<string>,
  hints: {
    categoryName?: string | null | undefined
    sceneCategoryName?: string | null | undefined
    roleCategoryName?: string | null | undefined
  },
  maxCount: number,
): void {
  for (const raw of [
    hints.categoryName,
    hints.sceneCategoryName,
    hints.roleCategoryName,
  ]) {
    if (out.length >= maxCount) break
    const catRaw = (raw ?? '')
      .normalize('NFKC')
      .trim()
      .replace(/\s+/g, ' ')
    if (!catRaw) continue
    const canonical = CURATED_TAG_NAMES.find(
      (t) => t.toLowerCase() === catRaw.toLowerCase(),
    )
    const useName = canonical ?? catRaw
    const k = useName.toLowerCase()
    if (seen.has(k)) continue
    out.push(useName)
    seen.add(k)
  }
}

/** 用 217 关键词词典对三段文本分别评分；返回 { tagName: score } */
function scoreTagsForFields(fields: {
  name: string
  description: string
  introduction: string
}): Map<string, number> {
  const scores = new Map<string, number>()
  for (const tag of CURATED_TAG_NAMES) {
    const kws = getTagKeywordSpec(tag).map((s) => s.toLowerCase())
    let s = 0
    if (kws.some((k) => k && fields.name.includes(k))) s += FIELD_WEIGHTS.name
    if (kws.some((k) => k && fields.description.includes(k))) s += FIELD_WEIGHTS.description
    if (kws.some((k) => k && fields.introduction.includes(k))) s += FIELD_WEIGHTS.introduction
    if (s > 0) scores.set(tag, s)
  }
  return scores
}

export interface BuildSuggestedToolTagNamesInput {
  /** 工具名称（可选，匹配权重 5） */
  name?: string | null
  /** 简介 / 描述（可选，匹配权重 3） */
  description?: string | null
  /** 富文本介绍（必填，匹配权重 1） */
  introduction: string
  introductionFormat: IntroductionFormat | string | null | undefined
  /** 首页左侧菜单分类名（categories.name）；提示位，顺序优先于场景/角色 */
  categoryName?: string | null | undefined
  /** 场景分类名（tag_categories.name）；仅作标签匹配提示，不批量挂载该场景下全部标签 */
  sceneCategoryName?: string | null | undefined
  /** 角色分类名（role_categories.name）；同上 */
  roleCategoryName?: string | null | undefined
  /** 自定义最多输出标签数（含分类名）；默认 `TOOL_TAGS_SUGGEST_MAX` (12) */
  limit?: number
}

/**
 * 组装完整标签建议：
 *   1) 前几位为所选菜单 / 场景 / 角色分类名提示（去重；顺序：菜单→场景→角色；若属 217 词表则规整为 curated 标准名）；
 *   2) 后续按 217 关键词词典评分排序（标题 5 + 描述 3 + 介绍 1）；
 *   3) 全部去重；总数 ≤ `limit`（默认 12，硬上限 `TOOL_TAGS_MAX` = 20）。
 */
export function buildSuggestedToolTagNames(
  input: BuildSuggestedToolTagNamesInput,
): string[] {
  const limit = Math.max(
    1,
    Math.min(input.limit ?? TOOL_TAGS_SUGGEST_MAX, TOOL_TAGS_MAX),
  )

  const fields = {
    name: plainLower(input.name),
    description: plainLower(input.description),
    introduction: introductionToTagScanText(
      input.introduction,
      input.introductionFormat,
    ),
  }

  const scores = scoreTagsForFields(fields)
  const ranked = Array.from(scores.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]
    return tagOrderIndex(a[0]) - tagOrderIndex(b[0])
  })

  const out: string[] = []
  const seen = new Set<string>()
  prependTaxonomyHintTagNames(out, seen, {
    categoryName: input.categoryName,
    sceneCategoryName: input.sceneCategoryName,
    roleCategoryName: input.roleCategoryName,
  }, limit)

  for (const [name] of ranked) {
    if (out.length >= limit) break
    const k = name.toLowerCase()
    if (seen.has(k)) continue
    out.push(name)
    seen.add(k)
  }

  return out.slice(0, TOOL_TAGS_MAX)
}

/** 列表展示：从 tool.tool_tags 里按 sort_order 取出标签名数组 */
export function toolTagLabelsFromTool(tool: {
  tool_tags?: ToolTagLink[]
}): string[] {
  const rows = tool.tool_tags
  if (!rows?.length) return []
  return [...rows]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((r) => r.tag?.name)
    .filter((x): x is string => Boolean(x?.trim()))
}

/** 标签 → 一级分类名（不在 curated 词表里的返回 null） */
export function tagCategoryNameOf(tagName: string): string | null {
  return TAG_TO_CATEGORY_NAME[tagName] ?? null
}
