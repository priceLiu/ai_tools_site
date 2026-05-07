import { getNeonSql } from '@/lib/neon/sql'
import type { AdSettings } from '@/lib/types'

export const AD_SETTINGS_KEY = 'ad:settings' as const

/** 系统默认值；任何字段缺失或非法都退回到这里 */
export const DEFAULT_AD_SETTINGS: AdSettings = {
  enabled_section1: false,
  enabled_section2: false,
  /** 与首页锚点区块「热门工具」（is_featured）区分；此处为广告 Section1 Tab A */
  section1_tab_a_label: '编辑推荐',
  section1_tab_b_label: '新晋推荐',
  section1_tab_c_label: '精选推荐',
  section2_rotate_seconds: 10,
  default_price_section1: 99,
  default_price_section2: 299,
}

function clampInt(v: unknown, fallback: number, min: number, max: number): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.floor(n)))
}

function asNonNegPrice(v: unknown, fallback: number): number {
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.round(n * 100) / 100
}

function asString(v: unknown, fallback: string, maxLen = 20): string {
  if (typeof v !== 'string') return fallback
  const t = v.trim()
  if (!t) return fallback
  return t.length > maxLen ? t.slice(0, maxLen) : t
}

function normalizeAdSettings(raw: unknown): AdSettings {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    enabled_section1: Boolean(o.enabled_section1),
    enabled_section2: Boolean(o.enabled_section2),
    section1_tab_a_label: asString(
      o.section1_tab_a_label,
      DEFAULT_AD_SETTINGS.section1_tab_a_label,
    ),
    section1_tab_b_label: asString(
      o.section1_tab_b_label,
      DEFAULT_AD_SETTINGS.section1_tab_b_label,
    ),
    section1_tab_c_label: asString(
      o.section1_tab_c_label,
      DEFAULT_AD_SETTINGS.section1_tab_c_label,
    ),
    section2_rotate_seconds: clampInt(
      o.section2_rotate_seconds,
      DEFAULT_AD_SETTINGS.section2_rotate_seconds,
      3,
      120,
    ),
    default_price_section1: asNonNegPrice(
      o.default_price_section1,
      DEFAULT_AD_SETTINGS.default_price_section1,
    ),
    default_price_section2: asNonNegPrice(
      o.default_price_section2,
      DEFAULT_AD_SETTINGS.default_price_section2,
    ),
  }
}

export async function getAdSettings(): Promise<AdSettings> {
  try {
    const sql = getNeonSql()
    const rows = await sql`
      SELECT value FROM app_kv WHERE key = ${AD_SETTINGS_KEY} LIMIT 1
    `
    const raw = (rows[0] as { value: unknown } | undefined)?.value
    if (raw == null) return { ...DEFAULT_AD_SETTINGS }
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return normalizeAdSettings(parsed)
  } catch {
    return { ...DEFAULT_AD_SETTINGS }
  }
}

export async function saveAdSettings(input: Partial<AdSettings>): Promise<AdSettings> {
  const current = await getAdSettings()
  const merged = normalizeAdSettings({ ...current, ...input })
  const sql = getNeonSql()
  await sql`
    INSERT INTO app_kv (key, value, updated_at)
    VALUES (${AD_SETTINGS_KEY}, ${JSON.stringify(merged)}::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET
      value = EXCLUDED.value,
      updated_at = now()
  `
  return merged
}
