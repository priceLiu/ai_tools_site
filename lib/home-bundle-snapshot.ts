import type { HomeToolBundle } from '@/lib/home-tool-bundle-types'
import type { HomeListedTool } from '@/lib/types'
import { getNeonSql } from '@/lib/neon/sql'
import { publicizeToolImages } from '@/lib/public-tool-image-url'

export const HOME_BUNDLE_SNAPSHOT_KEY = 'home_tool_bundle_v1' as const

function isHomeToolBundleLike(v: unknown): v is HomeToolBundle {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    Array.isArray(o.categories) &&
    Array.isArray(o.featured) &&
    Array.isArray(o.latest) &&
    Array.isArray(o.homeCategoryBlocks)
  )
}

/**
 * 防御性兜底：旧快照里 logo/截图字段可能还保留 base64 `data:` URL（升级前写入），
 * 读出时再走一次 publicize → 内联图改走 `/api/img/...`，HTML / Data Cache 不再爆 2MB。
 */
function publicizeBundleImages(b: HomeToolBundle): HomeToolBundle {
  const fixList = (xs: HomeListedTool[]): HomeListedTool[] =>
    xs.map((t) => publicizeToolImages(t))
  return {
    categories: b.categories,
    featured: fixList(b.featured),
    latest: fixList(b.latest),
    homeCategoryBlocks: b.homeCategoryBlocks.map((block) => ({
      root: block.root,
      sections: block.sections.map((s) => ({
        category: s.category,
        tools: fixList(s.tools),
      })),
    })),
  }
}

/** 从 Neon app_kv 读首页 bundle 快照；无记录或解析失败返回 null */
export async function fetchHomeToolBundleFromSnapshot(): Promise<HomeToolBundle | null> {
  if (process.env.HOME_BUNDLE_SNAPSHOT_DISABLE === '1') return null

  try {
    const sql = getNeonSql()
    const rows = await sql`
      SELECT value FROM app_kv WHERE key = ${HOME_BUNDLE_SNAPSHOT_KEY} LIMIT 1
    `
    const raw = (rows[0] as { value: unknown } | undefined)?.value
    if (raw == null) return null
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!isHomeToolBundleLike(parsed)) return null
    return publicizeBundleImages(parsed)
  } catch {
    return null
  }
}

/**
 * 将当前 bundle 写入 Neon app_kv（无需第三方 Storage）。
 */
export async function uploadHomeToolBundleSnapshot(
  bundle: HomeToolBundle,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const sql = getNeonSql()
    const json = JSON.stringify(bundle)
    await sql`
      INSERT INTO app_kv (key, value, updated_at)
      VALUES (${HOME_BUNDLE_SNAPSHOT_KEY}, ${json}::jsonb, now())
      ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = now()
    `
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'snapshot write failed',
    }
  }
}
