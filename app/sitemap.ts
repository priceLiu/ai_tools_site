import type { MetadataRoute } from 'next'
import * as neon from '@/lib/neon/data'
import { getSiteUrl } from '@/lib/site-url'

/**
 * Sitemap：每小时构建一次（与 Next ISR 配合，Vercel 上请求会命中已生成的版本）。
 * 失败时退化为只列首页 + about + 注册（保证爬虫至少能拿到入口页）。
 *
 * 公开页：
 *   - 首页 / about / `/category/hot`
 *   - 全部 approved 工具：/tool/[slug]
 *   - 全部一级 / 二级分类：/category/[slug]
 *   - 全部已启用的场景分类：/tag-category/[slug]
 *   - 全部 curated 标签：/tag/[name]
 *   - 全部已启用的角色页：/role/[slug]
 *
 * 不进 sitemap：admin、account、auth、api、submit、search、my-submissions、favorites、诊断页。
 */
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl()
  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${base}/about`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${base}/category/hot`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
  ]

  let roleEntries: MetadataRoute.Sitemap = []

  try {
    const roleSlugs = await neon.neonListRoleCategoryEnabledSlugs()
    roleEntries = roleSlugs.map((slug) => ({
      url: `${base}/role/${encodeURIComponent(slug)}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }))
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[sitemap] role_categories 不可用（迁移可能未执行）:',
        e instanceof Error ? e.message : e,
      )
    }
  }

  let toolEntries: MetadataRoute.Sitemap = []
  let categoryEntries: MetadataRoute.Sitemap = []
  let tagCategoryEntries: MetadataRoute.Sitemap = []
  let tagEntries: MetadataRoute.Sitemap = []

  try {
    const [slugs, cats] = await Promise.all([
      neon.neonListApprovedToolSlugs(),
      neon.neonListCategoriesEnabled(),
    ])

    categoryEntries = cats
      .map((c) => (c.slug ?? '').trim())
      .filter((s) => s.length > 0 && s !== 'hot')
      .map((slug) => ({
        url: `${base}/category/${encodeURIComponent(slug)}`,
        lastModified: now,
        changeFrequency: 'daily' as const,
        priority: 0.8,
      }))

    toolEntries = slugs.map((slug) => ({
      url: `${base}/tool/${encodeURIComponent(slug)}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[sitemap] 工具/分类不可用，跳过相关条目:', e)
    }
  }

  /**
   * 标签管理新表（20260506_* 迁移）独立 try：在迁移上线前不影响主体 sitemap。
   */
  try {
    const [tagCategories, tagsAll] = await Promise.all([
      neon.neonListTagCategoriesAll(),
      neon.neonAdminListTagsAll(),
    ])
    tagCategoryEntries = tagCategories
      .filter((c) => !c.is_disabled)
      .map((c) => (c.slug ?? '').trim())
      .filter((s) => s.length > 0)
      .map((slug) => ({
        url: `${base}/tag-category/${encodeURIComponent(slug)}`,
        lastModified: now,
        changeFrequency: 'daily' as const,
        priority: 0.8,
      }))

    tagEntries = tagsAll
      .filter((t) => t.is_curated && !t.is_disabled && t.tool_count > 0)
      .map((t) => ({
        url: `${base}/tag/${encodeURIComponent(t.name)}`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }))
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[sitemap] tag_categories / tags 元数据缺失（迁移可能未执行）:',
        e instanceof Error ? e.message : e,
      )
    }
  }

  return [
    ...staticEntries,
    ...roleEntries,
    ...categoryEntries,
    ...tagCategoryEntries,
    ...tagEntries,
    ...toolEntries,
  ]
}
