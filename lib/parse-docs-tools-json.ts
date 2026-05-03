export type DocsToolJsonItem = {
  name: string
  logo_url?: string
  introduction: string
  official_url: string
}

export type ParseDocsToolsJsonResult =
  | { ok: true; items: DocsToolJsonItem[] }
  | { ok: false; error: string }

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** 校验 `docs/data.json` 数组结构 */
export function parseDocsToolsJson(raw: unknown): ParseDocsToolsJsonResult {
  if (!Array.isArray(raw)) {
    return { ok: false, error: '根节点须为 JSON 数组' }
  }
  const items: DocsToolJsonItem[] = []
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i]
    if (!isRecord(row)) {
      return { ok: false, error: `第 ${i + 1} 条不是对象` }
    }
    const name = typeof row.name === 'string' ? row.name.trim() : ''
    const introduction =
      typeof row.introduction === 'string' ? row.introduction.trim() : ''
    const official_url =
      typeof row.official_url === 'string' ? row.official_url.trim() : ''
    const logo_url =
      typeof row.logo_url === 'string' ? row.logo_url.trim() : undefined

    if (!name) return { ok: false, error: `第 ${i + 1} 条缺少 name` }
    if (!introduction)
      return { ok: false, error: `第 ${i + 1} 条缺少 introduction` }
    if (!official_url)
      return { ok: false, error: `第 ${i + 1} 条缺少 official_url` }

    items.push({
      name,
      introduction,
      official_url,
      ...(logo_url ? { logo_url } : {}),
    })
  }
  return { ok: true, items }
}
