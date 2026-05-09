import Link from 'next/link'
import { PortalSubmissionsSection } from '@/components/portal-submissions-section'
import { ToolSection } from '@/components/tool-section'
import { cn } from '@/lib/utils'
import type {
  PortalSectionConfigEntry,
  PortalSectionId,
  ToolCommentMineRow,
} from '@/lib/types'
import type { PortalFollowBlock } from '@/lib/account-portal-bundle'
import type { PortalToolGroup } from '@/lib/account-portal-group-tools'
import { accountPortalToolPath } from '@/lib/account-portal-path'
import { toolPublicPath } from '@/lib/tool-public-path'
import { toolToHomeListed } from '@/lib/tool-to-home-listed'

const PORTAL_SECTION_HEADING: Record<PortalSectionId, string> = {
  follows: '我的关注',
  favorites: '我的收藏',
  comments: '我的评论',
  submissions: '提交的工具',
}

export function AccountPortalBody(props: {
  portalTheme: string | null | undefined
  sections: PortalSectionConfigEntry[]
  /** 工具卡片与评论里工具链接：门户站内 / 主站公开 */
  toolCardLinkMode?: 'public' | 'portal'
  /** 公开发布页为 false：不展示「我的关注」等个人向分区标题 */
  showSectionHeadings?: boolean
  followBlocks: PortalFollowBlock[]
  favGroups: PortalToolGroup[]
  submissionGroups: PortalToolGroup[]
  comments: ToolCommentMineRow[]
}) {
  const {
    portalTheme,
    sections,
    toolCardLinkMode = 'public',
    showSectionHeadings = true,
    followBlocks,
    favGroups,
    submissionGroups,
    comments,
  } = props

  const commentToolHref = (slug: string) =>
    toolCardLinkMode === 'portal'
      ? accountPortalToolPath(slug)
      : toolPublicPath(slug)

  const theme = portalTheme?.trim() || 'default'

  function renderToolGroups(groups: PortalToolGroup[]) {
    if (groups.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">
          暂无已通过审核的工具展示。
        </p>
      )
    }
    return (
      <div className="space-y-8">
        {groups.map((g) => (
          <ToolSection
            key={`${g.kind}-${g.key}`}
            title={g.title}
            tools={g.tools}
            toolCardLinkMode={toolCardLinkMode}
          />
        ))}
      </div>
    )
  }

  function renderComments() {
    if (comments.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">暂无可见评论。</p>
      )
    }
    return (
      <ul className="divide-y rounded-xl border border-border bg-card">
        {comments.map((c) => (
          <li key={c.id} className="px-4 py-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link
                href={commentToolHref(c.tool_slug)}
                className="font-medium text-primary hover:underline"
                {...(toolCardLinkMode === 'portal'
                  ? {}
                  : { target: '_blank', rel: 'noopener noreferrer' })}
              >
                {c.tool_name}
              </Link>
              <time className="text-xs text-muted-foreground">
                {new Date(c.created_at).toLocaleString('zh-CN')}
              </time>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
              {c.body}
            </p>
          </li>
        ))}
      </ul>
    )
  }

  function renderFollowBlocks(blocks: PortalFollowBlock[]) {
    if (blocks.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">
          暂无置顶工具或订阅场景 / 角色下的可见工具。
        </p>
      )
    }
    return (
      <div className="space-y-8">
        {blocks.map((b) => (
          <ToolSection
            key={
              b.kind === 'pinned'
                ? 'follow-pinned'
                : `${b.kind}-${b.categoryId}`
            }
            title={b.title}
            tools={b.tools.map(toolToHomeListed)}
            toolCardLinkMode={toolCardLinkMode}
          />
        ))}
      </div>
    )
  }

  let renderedIdx = 0

  return (
    <div
      data-portal-theme={theme}
      className={cn(
        'portal-home-root space-y-12 pb-16',
        theme === 'minimal' && 'space-y-14',
        theme === 'dense' && 'space-y-8',
      )}
    >
      {sections.map((sec) => {
        if (!sec.visible) return null

        const inner = (() => {
          switch (sec.id) {
            case 'follows':
              return renderFollowBlocks(followBlocks)
            case 'favorites':
              return renderToolGroups(favGroups)
            case 'submissions':
              return (
                <PortalSubmissionsSection
                  groups={submissionGroups}
                  toolCardLinkMode={toolCardLinkMode}
                />
              )
            case 'comments':
              return renderComments()
            default:
              return null
          }
        })()

        if (inner == null) return null

        const blockIndex = renderedIdx
        renderedIdx += 1

        return (
          <div
            key={sec.id}
            className={cn(
              blockIndex > 0 && 'border-t border-border/70 pt-10',
              theme === 'dense' && blockIndex > 0 && 'pt-8',
            )}
          >
            {showSectionHeadings ? (
              <h2 className="mb-6 text-lg font-semibold tracking-tight text-foreground">
                {PORTAL_SECTION_HEADING[sec.id]}
              </h2>
            ) : null}
            {inner}
          </div>
        )
      })}
    </div>
  )
}
