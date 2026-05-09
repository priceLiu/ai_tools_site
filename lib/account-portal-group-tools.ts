import type { HomeListedTool, RoleCategory, TagCategory, Tool } from '@/lib/types'

export type PortalToolGroupKind = 'scene' | 'role' | 'misc'

export interface PortalToolGroup {
  kind: PortalToolGroupKind
  /** 场景或角色分类 id；misc 固定为 `misc` */
  key: string
  title: string
  sortKey: number
  tools: HomeListedTool[]
}

/**
 * 按首页 taxonomy：优先归入 **启用中的场景分类**（词条 tag_category_id），
 * 否则归入 **启用中的角色分类**（词条经 role_category_tags），否则「工具」。
 */
export function groupToolsForPortalStrip(
  toolsInOrder: Tool[],
  opts: {
    tagsByTool: Map<string, NonNullable<Tool['tool_tags']>>
    rolesByTagId: Map<string, string[]>
    scenesEnabled: TagCategory[]
    rolesEnabled: RoleCategory[]
  },
): PortalToolGroup[] {
  const sceneById = new Map(opts.scenesEnabled.map((c) => [c.id, c]))
  const roleById = new Map(opts.rolesEnabled.map((c) => [c.id, c]))

  const buckets = new Map<string, HomeListedTool[]>()
  const meta = new Map<
    string,
    { kind: PortalToolGroupKind; title: string; sortKey: number }
  >()

  function ensureMisc() {
    const key = 'misc'
    if (!buckets.has(key)) {
      buckets.set(key, [])
      meta.set(key, { kind: 'misc', title: '工具', sortKey: 999999 })
    }
    return key
  }

  function ensureScene(cat: TagCategory) {
    const key = `scene:${cat.id}`
    if (!buckets.has(key)) {
      buckets.set(key, [])
      meta.set(key, {
        kind: 'scene',
        title: cat.name,
        sortKey: cat.sort_order,
      })
    }
    return key
  }

  function ensureRole(cat: RoleCategory) {
    const key = `role:${cat.id}`
    if (!buckets.has(key)) {
      buckets.set(key, [])
      meta.set(key, {
        kind: 'role',
        title: cat.name,
        sortKey: cat.sort_order,
      })
    }
    return key
  }

  for (const tool of toolsInOrder) {
    const links = opts.tagsByTool.get(tool.id) ?? []
    let placedKey: string | null = null

    for (const row of links) {
      const tcid = row.tag.tag_category_id ?? null
      if (tcid) {
        const sc = sceneById.get(tcid)
        if (sc && !sc.is_disabled) {
          placedKey = ensureScene(sc)
          break
        }
      }
    }

    if (!placedKey) {
      outerRole: for (const row of links) {
        const roleIds = opts.rolesByTagId.get(row.tag.id) ?? []
        let best: RoleCategory | null = null
        let bestOrder = Infinity
        for (const rid of roleIds) {
          const rc = roleById.get(rid)
          if (rc && !rc.is_disabled && rc.sort_order < bestOrder) {
            bestOrder = rc.sort_order
            best = rc
          }
        }
        if (best) {
          placedKey = ensureRole(best)
          break outerRole
        }
      }
    }

    if (!placedKey) {
      placedKey = ensureMisc()
    }

    const list = buckets.get(placedKey)!
    list.push({
      id: tool.id,
      name: tool.name,
      slug: tool.slug,
      description: tool.description,
      logo_url: tool.logo_url,
      category_id: tool.category_id,
      view_count: tool.view_count,
      is_featured: tool.is_featured,
      status: tool.status,
      created_at: tool.created_at,
      updated_at: tool.updated_at,
      favorite_count: tool.favorite_count,
      is_disabled: tool.is_disabled,
      category: tool.category,
      introduction: tool.introduction,
    })
  }

  const groups: PortalToolGroup[] = []
  for (const [key, tools] of buckets) {
    if (tools.length === 0) continue
    const m = meta.get(key)!
    groups.push({
      kind: m.kind,
      key,
      title: m.title,
      sortKey: m.sortKey,
      tools,
    })
  }

  groups.sort((a, b) => {
    if (a.kind !== b.kind) {
      const orderKind = { scene: 0, role: 1, misc: 2 }
      return orderKind[a.kind] - orderKind[b.kind]
    }
    if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey
    return a.title.localeCompare(b.title, 'zh-CN')
  })

  return groups
}
