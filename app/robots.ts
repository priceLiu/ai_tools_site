import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/site-url'

/** 与 `app/sitemap.ts` 一致：按运行时 `SITE_URL` 刷新，避免构建期未注入域名时 robots 永久指向占位域名。 */
export const revalidate = 3600

/**
 * 公开收录：默认允许整站抓取；仅通过 disallow 排除不需收录的路径。
 * （不在此列举 Allow：部分爬虫对 Allow 白名单解读不一致，且与 sitemap 中的
 *   /tag、/tag-category、/role、/excellent-ai-solutions 等易不一致。）
 *
 * 屏蔽：
 *   - 后台与账户体系：admin / account / favorites / my-submissions / submit
 *   - 鉴权流程：auth/*（登录注册成功页都不需要被搜索引擎收录）
 *   - API：所有内部接口
 *   - 站内搜索：/search 容易被 SEO spam 利用
 *   - 诊断：/diag /echo
 */
export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl()

  return {
    rules: [
      {
        userAgent: '*',
        disallow: [
          '/admin/',
          '/account/',
          '/api/',
          '/auth/',
          '/submit',
          '/favorites',
          '/my-submissions',
          '/search',
          '/diag',
          '/echo',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
