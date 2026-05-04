import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/site-url'

/**
 * 公开收录：首页 / about / 分类 / 工具详情。
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
        allow: ['/', '/about', '/category/', '/tool/'],
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
