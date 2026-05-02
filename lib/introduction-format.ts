export type IntroductionFormat = 'plain' | 'markdown' | 'html'

export const INTRO_LIMIT_PLAIN = 3000
export const INTRO_LIMIT_RICH = 100_000

/** 概述描述 / 列表摘要最大长度（写入 tools.description） */
export const LISTING_DESCRIPTION_MAX = 500

export function normalizeIntroductionFormat(
  raw: string | null | undefined,
): IntroductionFormat {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  if (s === 'plain') return 'plain'
  if (s === 'html') return 'html'
  return 'markdown'
}

/** 生成列表/搜索用的短摘要（写入 tools.description） */
export function excerptForListing(
  introduction: string,
  format: IntroductionFormat,
  maxLen = LISTING_DESCRIPTION_MAX,
): string {
  let t = introduction.trim()
  if (!t) return ''
  if (format === 'html') {
    t = t
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  } else if (format === 'markdown') {
    t = t
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`[^`]*`/g, ' ')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[#>*_\-~]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }
  if (t.length <= maxLen) return t
  return `${t.slice(0, maxLen - 1)}…`
}
