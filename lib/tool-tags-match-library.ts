/**
 * 基于 **当前数据库中全部标签**（name + aliases），辅以 `TAG_KEYWORDS` 的补充词，
 * 对工具名称 / 概述 / 介绍做子串命中与分段权重打分，供「自动提取标签」使用。
 *
 * 语义与 `buildSuggestedToolTagNames` 对齐：前几位为所选菜单/场景/角色分类名提示（去重），
 * 后续为按分排序的标签名（标准名为 DB 中的 `name`）。
 */

import type { IntroductionFormat } from '@/lib/introduction-format'
import {
  CURATED_TAG_NAMES,
  TAG_KEYWORDS,
  getTagKeywordSpec,
} from '@/lib/tag-keywords'
import {
  TOOL_TAGS_MAX,
  TOOL_TAGS_SUGGEST_MAX,
  introductionToTagScanText,
  prependTaxonomyHintTagNames,
  type BuildSuggestedToolTagNamesInput,
} from '@/lib/tool-tags-extract'

/** 字段权重：与 tool-tags-extract 一致 */
const FIELD_WEIGHTS = {
  name: 5,
  description: 3,
  introduction: 1,
} as const

export type TagSuggestDictionaryRow = {
  name: string
  aliases: string[]
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

function collectKeywordsForDictionaryRow(row: TagSuggestDictionaryRow): string[] {
  const out: string[] = []
  const push = (raw: string | null | undefined) => {
    const s = plainLower(raw)
    if (s.length >= 2) out.push(s)
  }
  push(row.name)
  for (const a of row.aliases ?? []) push(a)
  const extra = getTagKeywordSpec(row.name)
  for (const k of extra) push(k)
  const seen = new Set<string>()
  const uniq: string[] = []
  for (const k of out) {
    if (seen.has(k)) continue
    seen.add(k)
    uniq.push(k)
  }
  uniq.sort((a, b) => b.length - a.length)
  return uniq
}

function scoreRowForFields(
  keywords: string[],
  fields: { name: string; description: string; introduction: string },
): number {
  let s = 0
  if (keywords.some((k) => k && fields.name.includes(k))) s += FIELD_WEIGHTS.name
  if (keywords.some((k) => k && fields.description.includes(k)))
    s += FIELD_WEIGHTS.description
  if (keywords.some((k) => k && fields.introduction.includes(k)))
    s += FIELD_WEIGHTS.introduction
  return s
}

export interface BuildSuggestedFromDictionaryInput
  extends Omit<BuildSuggestedToolTagNamesInput, 'limit'> {
  dictionary: TagSuggestDictionaryRow[]
  limit?: number
}

/**
 * @param input.dictionary — 通常来自 `neonListTagsSuggestDictionary()`，经 `getCachedTagsSuggestDictionary` 缓存
 */
export function buildSuggestedToolTagNamesFromDictionary(
  input: BuildSuggestedFromDictionaryInput,
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

  const scores = new Map<string, number>()
  const dict = input.dictionary ?? []
  for (const row of dict) {
    const name = row.name?.trim()
    if (!name) continue
    const kws = collectKeywordsForDictionaryRow(row)
    if (kws.length === 0) continue
    const s = scoreRowForFields(kws, fields)
    if (s > 0) scores.set(name, s)
  }

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

  for (const [nm] of ranked) {
    if (out.length >= limit) break
    const k = nm.toLowerCase()
    if (seen.has(k)) continue
    out.push(nm)
    seen.add(k)
  }

  return out.slice(0, TOOL_TAGS_MAX)
}
