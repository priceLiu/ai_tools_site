import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { TooltipProvider } from '@radix-ui/react-tooltip'
import { SiteFooter } from '@/components/site-footer'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'AI工具集 - 发现最好用的AI工具',
  description: '汇集全网优质AI工具，包括AI对话、AI图像、AI视频、AI写作、AI编程等各类人工智能工具导航',
  keywords: 'AI工具,人工智能,AI导航,ChatGPT,AI绘画,AI写作',
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
