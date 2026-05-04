/**
 * 公共展示页（首页 / 详情 / 分类等）渲染前，把可能为 base64 `data:` URL 的图片字段
 * 替换为 `/api/img/tool/<id>/<kind>` 的轻量代理路径，避免：
 *
 * - HTML 体积膨胀（每条工具上百 KB ~ 数 MB 的内联图）
 * - `unstable_cache` 触发 2MB 上限
 * - 浏览器无法跨页缓存图片
 *
 * 外部 `http(s)` 链接保持原样：浏览器会按域名做正常 HTTP 缓存，无需多一跳。
 */

type WithImages = {
  id: string
  logo_url?: string | null
  screenshot_url?: string | null
  updated_at?: string
}

function cacheBuster(updatedAt?: string): string {
  if (!updatedAt) return ''
  const t = updatedAt.trim()
  if (!t) return ''
  return `?v=${encodeURIComponent(t)}`
}

export function publicizeToolLogoUrl(
  toolId: string,
  raw: string | null | undefined,
  updatedAt?: string,
): string | null {
  if (!raw) return null
  if (raw.startsWith('data:')) {
    return `/api/img/tool/${encodeURIComponent(toolId)}/logo${cacheBuster(updatedAt)}`
  }
  return raw
}

export function publicizeToolScreenshotUrl(
  toolId: string,
  raw: string | null | undefined,
  updatedAt?: string,
): string | null {
  if (!raw) return null
  if (raw.startsWith('data:')) {
    return `/api/img/tool/${encodeURIComponent(toolId)}/screenshot${cacheBuster(updatedAt)}`
  }
  return raw
}

/**
 * 用于公开 Tool 对象（首页 bundle、详情页、分类页、用户收藏列表等）。
 * Admin 编辑/重新提交场景需要原始 data URL，请勿调用此函数。
 */
export function publicizeToolImages<T extends WithImages>(t: T): T {
  return {
    ...t,
    logo_url: publicizeToolLogoUrl(t.id, t.logo_url ?? null, t.updated_at),
    ...('screenshot_url' in t
      ? {
          screenshot_url: publicizeToolScreenshotUrl(
            t.id,
            t.screenshot_url ?? null,
            t.updated_at,
          ),
        }
      : {}),
  }
}
