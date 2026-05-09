import * as neon from '@/lib/neon/data'
import type {
  TagCategory,
  Tool,
  RoleCategory,
  ToolCommentMineRow,
} from '@/lib/types'
import type { ShowcasePublishEligibilityCounts } from '@/lib/account-showcase-eligibility'

export type { ShowcasePublishEligibilityCounts } from '@/lib/account-showcase-eligibility'
export { isShowcasePublishEligible } from '@/lib/account-showcase-eligibility'

function listedPublic(tool: Tool): boolean {
  return tool.status === 'approved' && tool.is_disabled !== true
}

/** 主页「关注」分块：与 `/account/follows` 数据源一致，标题即订阅维度（不按词条 taxonomy 再归类）。 */
export type PortalFollowBlock =
  | { kind: 'pinned'; title: string; tools: Tool[] }
  | {
      kind: 'scene_follow'
      categoryId: string
      title: string
      tools: Tool[]
    }
  | {
      kind: 'role_follow'
      categoryId: string
      title: string
      tools: Tool[]
    }

export function portalFollowToolIds(blocks: PortalFollowBlock[]): Set<string> {
  const ids = new Set<string>()
  for (const b of blocks) {
    for (const t of b.tools) ids.add(t.id)
  }
  return ids
}

export type AccountPortalBundle = {
  followBlocks: PortalFollowBlock[]
  favoriteTools: Tool[]
  comments: ToolCommentMineRow[]
  submissionTools: Tool[]
  scenesEnabled: TagCategory[]
  rolesEnabled: RoleCategory[]
}

async function buildFollowBlocks(
  userId: string,
  listedOnly: boolean,
): Promise<PortalFollowBlock[]> {
  const [pinnedEntries, sceneFollows, roleFollows] = await Promise.all([
    neon.neonListUserFollowToolsForAccount(userId),
    neon.neonListUserFollowTagCategoriesJoined(userId),
    neon.neonListUserFollowRoleCategoriesJoined(userId),
  ])

  const pinnedSorted = [...pinnedEntries].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    return a.created_at.localeCompare(b.created_at)
  })
  const pinnedTools = pinnedSorted
    .filter((e) => !listedOnly || e.listing_ok)
    .map((e) => e.tool)
  const pinnedIds = new Set(pinnedTools.map((t) => t.id))

  const blocks: PortalFollowBlock[] = []
  if (pinnedTools.length > 0) {
    blocks.push({ kind: 'pinned', title: '置顶关注', tools: pinnedTools })
  }

  const enabledScenes = sceneFollows.filter((s) => !s.is_disabled)
  const enabledRoles = roleFollows.filter((r) => !r.is_disabled)

  const [sceneLists, roleLists] = await Promise.all([
    Promise.all(
      enabledScenes.map((s) => neon.neonListToolsByTagCategoryId(s.id)),
    ),
    Promise.all(
      enabledRoles.map((r) => neon.neonListToolsByRoleCategoryId(r.id)),
    ),
  ])

  for (let i = 0; i < enabledScenes.length; i++) {
    let tools = sceneLists[i]
    if (listedOnly) tools = tools.filter(listedPublic)
    tools = tools.filter((t) => !pinnedIds.has(t.id))
    if (tools.length === 0) continue
    const cat = enabledScenes[i]
    blocks.push({
      kind: 'scene_follow',
      categoryId: cat.id,
      title: cat.name,
      tools,
    })
  }

  for (let i = 0; i < enabledRoles.length; i++) {
    let tools = roleLists[i]
    if (listedOnly) tools = tools.filter(listedPublic)
    tools = tools.filter((t) => !pinnedIds.has(t.id))
    if (tools.length === 0) continue
    const cat = enabledRoles[i]
    blocks.push({
      kind: 'role_follow',
      categoryId: cat.id,
      title: `${cat.name}（角色订阅）`,
      tools,
    })
  }

  return blocks
}

/**
 * 聚合门户所需原始列表。
 * `publicListedOnly`：公开发布页仅保留主站可见工具相关的条目。
 */
export async function loadAccountPortalBundle(
  userId: string,
  opts?: { publicListedOnly?: boolean },
): Promise<AccountPortalBundle> {
  const listedOnly = opts?.publicListedOnly === true

  const [
    followBlocks,
    favRows,
    comments,
    submissionTools,
    scenesEnabled,
    rolesEnabled,
  ] = await Promise.all([
    buildFollowBlocks(userId, listedOnly),
    neon.neonListFavoritesWithToolsForUser(userId),
    neon.neonListToolCommentsMineForUser(userId, {
      limit: 150,
      listedToolsOnly: listedOnly,
    }),
    neon.neonListToolsForUser(userId),
    neon.neonListTagCategoriesEnabled(),
    neon.neonListRoleCategoriesEnabled(),
  ])

  const favoriteTools = (
    listedOnly ? favRows.filter((f) => listedPublic(f.tool)) : favRows
  ).map((f) => f.tool)

  const submissionsFiltered = listedOnly
    ? submissionTools.filter(listedPublic)
    : submissionTools

  return {
    followBlocks,
    favoriteTools,
    comments,
    submissionTools: submissionsFiltered,
    scenesEnabled,
    rolesEnabled,
  }
}

export function computeShowcasePublishEligibility(
  bundle: AccountPortalBundle,
): ShowcasePublishEligibilityCounts {
  const followToolCount = portalFollowToolIds(bundle.followBlocks).size
  return {
    followToolCount,
    favoriteCount: bundle.favoriteTools.length,
    submissionCount: bundle.submissionTools.length,
  }
}
