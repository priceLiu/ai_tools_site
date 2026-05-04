import type { MetadataRoute } from 'next'
import * as neon from '@/lib/neon/data'
import { getSiteUrl } from '@/lib/site-url'

/**
 * Sitemap：每小时构建一次（与 Next ISR 配合，Vercel 上请求会命中已生成的版本）。
 * 失败时退化为只列首页 + about + 注册（保证爬虫至少能拿到入口页）。
 *
 * 公开页：首页 / about / 全部 approved 工具 / 全部分类 / `/category/hot`。
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

  let toolEntries: MetadataRoute.Sitemap = []
  let categoryEntries: MetadataRoute.Sitemap = []

  try {
    const [slugs, cats] = await Promise.all([
      neon.neonListApprovedToolSlugs(),
      neon.neonListCategoriesAll(),
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
      console.warn('[sitemap] 数据库不可用，仅输出静态入口:', e)
    }
  }

  return [...staticEntries, ...categoryEntries, ...toolEntries]
}
