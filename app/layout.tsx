import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { TooltipProvider } from '@radix-ui/react-tooltip'
import { SiteFooter } from '@/components/site-footer'
import { ExcellentSolutionsFab } from '@/components/excellent-solutions-fab'
import {
  SITE_BRAND_DESCRIPTION as SITE_DESCRIPTION,
  SITE_BRAND_KEYWORDS,
  SITE_BRAND_NAME as SITE_NAME,
  SITE_BRAND_TITLE as SITE_TITLE,
} from '@/lib/site-brand'
import { getSiteUrlObject } from '@/lib/site-url'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

/**
 * 全站默认 metadata：
 *  - `metadataBase`：让所有相对 URL（OG image、canonical）自动转绝对，详见 `lib/site-url.ts`。
 *  - `title.template`：子页 metadata 只写「工具名 / 分类名」即可，自动拼成 "X | 智选AI"。
 *  - `robots`：默认允许收录；后台 / 鉴权 / 诊断在各自 layout 或 page 中覆盖为 noindex。
 *  - `openGraph` / `twitter`：站点级默认值，子页可补 type=article、images。
 */
export const metadata: Metadata = {
  metadataBase: getSiteUrlObject(),
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [...SITE_BRAND_KEYWORDS],
  applicationName: SITE_NAME,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    siteName: SITE_NAME,
    url: '/',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: '/logo-zhixuanai.png', width: 512, height: 512, alt: SITE_NAME }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ['/logo-zhixuanai.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  formatDetection: { email: false, address: false, telephone: false },
}

/**
 * 必须显式 `width: device-width`，否则 iOS / Android 默认按 980px 桌面宽度渲染再缩放，
 * 移动端会出现「白屏 / 内容打不开」假象。
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#8b5cf6',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" className="bg-background" suppressHydrationWarning>
      <body className="font-sans antialiased">
        {/**
         * 全局 Tooltip Provider：避免每张 ToolCard 自己挂一个 Provider；
         * `delayDuration={280}` 与 `disableHoverableContent` 让 Tooltip 在 touch 设备上也不打扰。
         */}
        <TooltipProvider delayDuration={280} disableHoverableContent>
          <div className="flex min-h-screen flex-col">
            <div className="flex-1">{children}</div>
            <ExcellentSolutionsFab />
            <SiteFooter />
          </div>
        </TooltipProvider>
        {/**
         * 只在 Vercel 部署环境加载 Analytics。本地 `pnpm run start` 也能跑生产模式，
         * 但 `/_vercel/insights/script.js` 不存在，浏览器会报 404 噪音。
         */}
        {process.env.VERCEL ? <Analytics /> : null}
      </body>
    </html>
  )
}
