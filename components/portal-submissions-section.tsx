'use client'

import { useMemo, useState } from 'react'
import { ToolSection } from '@/components/tool-section'
import type { PortalToolGroup } from '@/lib/account-portal-group-tools'
import { Button } from '@/components/ui/button'

type Phase = 'collapsed' | 'preview' | 'full'

const PREVIEW_COUNT = 8

export function PortalSubmissionsSection(props: {
  groups: PortalToolGroup[]
  toolCardLinkMode: 'public' | 'portal'
}) {
  const { groups, toolCardLinkMode } = props

  const flat = useMemo(() => groups.flatMap((g) => g.tools), [groups])
  const total = flat.length

  const [phase, setPhase] = useState<Phase>('collapsed')

  if (total === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        暂无已通过审核的工具展示。
      </p>
    )
  }

  if (phase === 'collapsed') {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPhase('preview')}
        >
          查看提交的工具（{total}）
        </Button>
      </div>
    )
  }

  if (phase === 'preview') {
    const previewTools = flat.slice(0, PREVIEW_COUNT)
    const hasMore = total > PREVIEW_COUNT
    return (
      <div className="space-y-5">
        <ToolSection
          title="提交的工具"
          tools={previewTools}
          toolCardLinkMode={toolCardLinkMode}
          mobileInitialCount={PREVIEW_COUNT}
        />
        <div className="flex flex-wrap items-center gap-3">
          {hasMore ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setPhase('full')}
            >
              显示全部（{total}）
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setPhase('collapsed')}
          >
            收起
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
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
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => setPhase('collapsed')}
      >
        收起
      </Button>
    </div>
  )
}
