import Link from 'next/link'
import {
  Briefcase,
  Code2,
  GraduationCap,
  Megaphone,
  Palette,
  Pen,
  Sparkles,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { HomeTagCategoryCard } from '@/lib/cached-home-tag-categories'
import {
  rolePublicPath,
  tagCategoryPublicPath,
  tagPublicPath,
} from '@/lib/tag-slug'
import { TAG_ROLES } from '@/lib/tag-roles'

const ICON_MAP: Record<string, LucideIcon> = {
  Pen,
  Briefcase,
  GraduationCap,
  Code2,
  Megaphone,
  Sparkles,
  Palette,
  Wrench,
}

interface Props {
  cards: HomeTagCategoryCard[]
  /** 区块顶部锚点 id；首页主导航跳转使用 */
  anchorId?: string
}

export function HomeTagCategoriesSection({ cards, anchorId = 'home-scenes' }: Props) {
  if (cards.length === 0) return null

  return (
    <section id={anchorId} className="mb-6 md:mb-8">
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 md:mb-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </span>
          <h2 className="text-sm font-semibold text-foreground md:text-base">
            按场景找 AI
          </h2>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <span className="text-[10px] text-muted-foreground md:text-xs">
            按角色：
          </span>
          {TAG_ROLES.map((r) => {
            const RIcon = r.icon
            return (
              <Link
                key={r.slug}
                href={rolePublicPath(r.slug)}
                aria-label={`${r.name}：${r.tagline}`}
                title={r.tagline}
                className="inline-flex"
              >
                <Badge
                  variant="outline"
                  className={cn(
                    'h-6 gap-1 border-primary/60 bg-card px-1.5 text-[10px] font-medium text-foreground/80',
                    'hover:border-primary hover:bg-primary hover:text-primary-foreground',
                  )}
                >
                  <RIcon className="h-3 w-3" />
                  {r.name}
                </Badge>
              </Link>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {cards.map((card) => (
          <ScenarioCard key={card.category.id} card={card} />
        ))}
      </div>
    </section>
  )
}

function ScenarioCard({ card }: { card: HomeTagCategoryCard }) {
  const Icon = (card.category.icon && ICON_MAP[card.category.icon]) || Sparkles
  const slug = card.category.slug
  const chips = card.topTags.slice(0, 2)
  const disabled = card.toolCount === 0

  return (
    <Card
      className={cn(
        'group relative overflow-hidden border p-2.5 transition-all',
        disabled
          ? 'cursor-not-allowed border-dashed bg-muted/30 opacity-60'
          : 'bg-card/80 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md',
      )}
      aria-disabled={disabled || undefined}
    >
      {!disabled && (
        <Link
          href={tagCategoryPublicPath(slug)}
          className="absolute inset-0 z-10"
          aria-label={`${card.category.name}：${card.toolCount} 个工具`}
        />
      )}
      <div className="pointer-events-none relative z-20 flex items-center gap-2">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
            disabled
              ? 'bg-muted-foreground/10'
              : 'bg-primary/10 group-hover:bg-primary/20',
          )}
        >
          <Icon
            className={cn(
              'h-4 w-4',
              disabled ? 'text-muted-foreground' : 'text-primary',
            )}
          />
        </div>
        <div className="min-w-0 flex-1">
          <h3
            className={cn(
              'truncate text-sm font-semibold leading-tight',
              disabled ? 'text-muted-foreground' : 'text-foreground',
            )}
          >
            {card.category.name}
          </h3>
          <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
            {disabled ? '暂无工具' : `${card.toolCount} 个工具`}
          </p>
        </div>

        {chips.length > 0 && !disabled && (
          <div className="pointer-events-auto hidden shrink-0 flex-col items-end gap-0.5 md:flex">
            {chips.map((t) => (
              <Link
                key={t.id}
                href={tagPublicPath(t.name)}
                className="inline-flex"
              >
                <Badge
                  variant="secondary"
                  className={cn(
                    'h-5 max-w-[88px] truncate px-1.5 text-[10px] font-normal',
                    'hover:bg-primary hover:text-primary-foreground',
                  )}
                >
                  {t.name}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}
