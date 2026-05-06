import { unstable_cache } from 'next/cache'
import * as neon from '@/lib/neon/data'
import type { TagCategory } from '@/lib/types'
import { HOME_TAG_CATEGORIES_CACHE_TAG } from '@/lib/navigation-menu-cache-config'

export interface HomeTagCategoryCard {
  category: TagCategory
  /** 该分类下工具数前 5 的标签（来自 curated 与历史皆可）；用于卡片 chip 展示 */
  topTags: { id: string; name: string; tool_count: number }[]
  /** 一级分类下工具总数 */
  toolCount: number
}

async function loadHomeTagCategoryCards(): Promise<HomeTagCategoryCard[]> {
  let cats
  try {
    cats = await neon.neonListTagCategoriesAll()
  } catch (e) {
    /**
     * `tag_categories` 表 / `tags.tag_category_id` 列缺失时：
     * 表示两条迁移（20260506000000_*.sql / 20260506000100_*.sql）尚未在 Neon 上执行。
     * 这里返回空数组以避免首页 500，方便先跑迁移、后填数据。
     */
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[home-tag-categories] schema not ready, returning empty cards. Apply pending migrations:',
        e instanceof Error ? e.message : e,
      )
    }
    return []
  }
  if (cats.length === 0) return []

  const cards: HomeTagCategoryCard[] = []
  for (const cat of cats) {
    try {
      const [topTags, tools] = await Promise.all([
        neon.neonListTagsForCategoryWithCounts(cat.id, 5),
        neon.neonListToolsByTagCategoryId(cat.id),
      ])
      cards.push({
        category: cat,
        topTags: topTags.filter((t) => t.tool_count > 0),
        toolCount: tools.length,
      })
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          `[home-tag-categories] skip category ${cat.slug}:`,
          e instanceof Error ? e.message : e,
        )
      }
    }
  }
  return cards
}

/**
 * 首页「按场景找 AI」8 张卡片的数据。
 *
 * - 30s revalidate；
 * - tag：`HOME_TAG_CATEGORIES_CACHE_TAG`；
 * - 写标签 / 合并 / 删除 / 批量重打时失效。
 */
export const getHomeTagCategoryCards = unstable_cache(
  loadHomeTagCategoryCards,
  ['home-tag-category-cards'],
  {
    tags: [HOME_TAG_CATEGORIES_CACHE_TAG],
    revalidate: 60,
  },
)
