'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Tag, X, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TOOL_TAGS_MAX } from '@/lib/tool-tags-extract'

export function ToolTagsEditor({
  value,
  onChange,
  disabled,
  suggestLoading,
  onRequestSuggest,
  idPrefix,
  allowManualEntry = true,
}: {
  value: string[]
  onChange: (names: string[]) => void
  disabled?: boolean
  suggestLoading?: boolean
  onRequestSuggest?: () => void
  idPrefix: string
  /** 若为 false（访客提交）：仅允许移除 chip，必须通过「自动提取标签」填入 */
  allowManualEntry?: boolean
}) {
  const [draft, setDraft] = useState('')

  const addDraft = () => {
    const n = draft.normalize('NFKC').trim().replace(/\s+/g, ' ')
    if (!n) return
    if (value.length >= TOOL_TAGS_MAX) return
    const lower = n.toLowerCase()
    if (value.some((x) => x.toLowerCase() === lower)) {
      setDraft('')
      return
    }
    onChange([...value, n])
    setDraft('')
  }

  const removeAt = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="flex items-center gap-1.5 text-sm font-medium">
          <Tag className="h-4 w-4 text-primary" aria-hidden />
          标签
          <span className="text-xs font-normal text-muted-foreground">
            （最多 {TOOL_TAGS_MAX} 个）
          </span>
        </Label>
        {onRequestSuggest ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-xs"
            disabled={disabled || suggestLoading}
            onClick={() => onRequestSuggest()}
          >
            {suggestLoading ? (
              <Spinner className="h-3.5 w-3.5" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" />
            )}
            {allowManualEntry ? '根据介绍自动生成' : '自动提取标签'}
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {allowManualEntry ? (
          <>
            首个一般为分类名；其余为从介绍中识别的 AI
            能力（视频、音频等）。可自行增删。
          </>
        ) : (
          <>
            仅能从受控标签库匹配：请点击「自动提取标签」一键生成（可删减 chip，不可手写新标签）。
          </>
        )}
      </p>
      <div className="flex min-h-[2.25rem] flex-wrap gap-2">
        {value.map((label, i) => (
          <span
            key={`${label}-${i}`}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground"
          >
            {label}
            <button
              type="button"
              className={cn(
                'rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground',
                disabled && 'pointer-events-none opacity-50',
              )}
              aria-label={`移除标签 ${label}`}
              disabled={disabled}
              onClick={() => removeAt(i)}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {value.length === 0 ? (
          <span className="text-xs text-muted-foreground">暂无标签</span>
        ) : null}
      </div>
      {allowManualEntry ? (
        <div className="flex flex-wrap gap-2">
          <Input
            id={`${idPrefix}-tag-draft`}
            placeholder="手动添加标签…"
            value={draft}
            disabled={disabled || value.length >= TOOL_TAGS_MAX}
            className="max-w-xs flex-1"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addDraft()
              }
            }}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled || value.length >= TOOL_TAGS_MAX}
            onClick={() => addDraft()}
          >
            添加
          </Button>
        </div>
      ) : null}
    </div>
  )
}
