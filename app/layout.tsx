import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SiteFooter } from '@/components/site-footer'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'AI工具集 - 发现最好用的AI工具',
  description: '汇集全网优质AI工具，包括AI对话、AI图像、AI视频、AI写作、AI编程等各类人工智能工具导航',
  keywords: 'AI工具,人工智能,AI导航,ChatGPT,AI绘画,AI写作',
}

export const viewport: Viewport = {
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
        <div className="flex min-h-screen flex-col">
          <div className="flex-1">{children}</div>
          <SiteFooter />
        </div>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
