import Link from 'next/link'
import {
  Sparkles,
  Flame,
  ShieldCheck,
  Users,
  Upload,
  Search,
  Heart,
  ArrowRight,
  Zap,
  Layers,
  Globe,
  CheckCircle2,
} from 'lucide-react'
import type { Metadata, Viewport } from 'next'

export const dynamic = 'force-static'
export const revalidate = false

export const metadata: Metadata = {
  title: '项目简介',
  description:
    '汇集全网热门 AI 工具，按场景分类，支持用户提交新工具、社区共建。注册登录后可提交工具，经管理员审核后免费上架。',
  keywords:
    'AI 工具, 人工智能, AI 工具集, AI 导航, AI 写作, AI 绘画, AI 编程, AI 学术, 工具提交',
  alternates: { canonical: '/about' },
  openGraph: {
    type: 'website',
    url: '/about',
    title: 'AI 工具集 · 项目简介',
    description: '汇集全网热门 AI 工具，按场景分类，社区共建。',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI 工具集 · 项目简介',
    description: '汇集全网热门 AI 工具，按场景分类，社区共建。',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#8b5cf6',
}

const features = [
  {
    Icon: Flame,
    title: '热门排行 · 一眼看见趋势',
    desc: '按访问量、收藏数、最近更新综合排序，让你一开页就看到当下大家在用什么、哪些值得收藏。',
  },
  {
    Icon: Users,
    title: '社区共建 · 人人可提交',
    desc: '任何注册用户都能提交新工具，把自己发现的「宝藏」分享给更多人；评论与收藏让真实反馈沉淀下来。',
  },
  {
    Icon: ShieldCheck,
    title: '严格审核 · 内容更靠谱',
    desc: '所有提交都需通过管理员审核：核对官网、检查描述、清理标签后才会上架，避免广告与劣质重复条目。',
  },
  {
    Icon: Zap,
    title: '极速访问 · 全静态推送',
    desc: '首页 / 详情 / 分类全部走 ISR + CDN 边缘缓存，配合后端按需推送，无论 PC 还是手机都能秒开。',
  },
] as const

const flow = [
  {
    Icon: Search,
    title: '浏览发现',
    desc: '按分类或搜索关键词，快速定位写作 / 绘画 / 视频 / 编程等你需要的工具。',
  },
  {
    Icon: Heart,
    title: '收藏对比',
    desc: '点心收藏，回头在「我的收藏」一键回顾；评论里看真实用户的使用心得。',
  },
  {
    Icon: Upload,
    title: '提交分享',
    desc: '注册后通过「AI 工具提交」上传工具信息；管理员审核通过即在公开列表上线。',
  },
] as const

const categories = [
  '通用对话',
  'AI 写作',
  'AI 绘画',
  'AI 视频',
  'AI 音频',
  'AI 编程',
  '论文学术',
  '小说网文',
  '公文办公',
  '新媒体营销',
  '英文润色',
  '设计 / 灵感',
] as const

const stats = [
  { label: '收录工具', value: '500+' },
  { label: '场景分类', value: '15+' },
  { label: '审核通过率', value: '~70%' },
  { label: '日均访问', value: '稳步上升' },
] as const

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* 顶栏：仅静态 link，不挂任何客户端态，避免 DB / fetch 阻塞首屏 */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 md:h-16 md:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </span>
            <span className="text-base font-bold text-foreground md:text-lg">
              AI 工具集
            </span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            进入主站
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* Hero：渐变背景 + 大字标题 */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent"
        />
        <div
          aria-hidden
          className="absolute -top-24 left-1/2 -z-10 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl"
        />
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-12 text-center md:px-6 md:pb-24 md:pt-20">
          <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary md:text-sm">
            <Sparkles className="h-3.5 w-3.5" />
            社区驱动 · 人人共建的 AI 工具导航
          </div>
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl md:text-5xl md:leading-[1.15]">
            发现并分享
            <br className="md:hidden" />
            <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              全网最好用的 AI 工具
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base md:mt-6 md:text-lg">
            汇聚当下热门、排名靠前的 AI 工具，按场景细分整理。
            <br className="hidden md:block" />
            注册即可提交你发现的好工具，经管理员审核后，免费在站内上架供更多人发现。
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row md:mt-9">
            <Link
              href="/"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md transition-colors hover:bg-primary/90 sm:w-auto md:text-base"
            >
              立即开始浏览
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted sm:w-auto md:text-base"
            >
              <Upload className="h-4 w-4" />
              提交一个工具
            </Link>
          </div>

          {/* 数据卡片 */}
          <div className="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4 md:mt-16 md:gap-4">
            {stats.map(({ label, value }) => (
              <div
                key={label}
                className="rounded-2xl border border-border/70 bg-card/60 px-3 py-4 backdrop-blur md:px-4 md:py-5"
              >
                <p className="text-xl font-bold text-foreground sm:text-2xl md:text-3xl">
                  {value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground md:text-sm">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features 区块 */}
      <section className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-20">
        <div className="mb-8 text-center md:mb-12">
          <h2 className="text-2xl font-bold text-foreground md:text-3xl">
            为什么选择我们
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground md:mt-3 md:text-base">
            不只是工具列表，而是一个由真实用户共建、严格把关的 AI 工具导航站。
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-4">
          {features.map(({ Icon, title, desc }) => (
            <div
              key={title}
              className="group flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md md:p-6"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="text-base font-semibold text-foreground md:text-lg">
                {title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 用户旅程 */}
      <section className="border-y border-border/60 bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-20">
          <div className="mb-8 text-center md:mb-12">
            <h2 className="text-2xl font-bold text-foreground md:text-3xl">
              三步用起来
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground md:mt-3 md:text-base">
              不论你是想找工具，还是想推荐自己的「宝藏」，几分钟就能完成。
            </p>
          </div>
          <ol className="grid gap-4 sm:grid-cols-3 md:gap-6">
            {flow.map(({ Icon, title, desc }, i) => (
              <li
                key={title}
                className="relative rounded-2xl border border-border/70 bg-card p-5 shadow-sm md:p-6"
              >
                <span className="absolute right-4 top-4 text-3xl font-bold tabular-nums text-primary/15 md:text-4xl">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-3 text-base font-semibold text-foreground md:text-lg">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {desc}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 分类 pills */}
      <section className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-20">
        <div className="mb-6 text-center md:mb-10">
          <h2 className="text-2xl font-bold text-foreground md:text-3xl">
            场景全覆盖
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground md:mt-3 md:text-base">
            从写作绘画，到学术编程，几乎你想到的 AI 场景都能在这里找到。
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 md:gap-3">
          {categories.map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm md:px-4 md:py-2 md:text-sm"
            >
              <Layers className="h-3.5 w-3.5 text-primary" />
              {c}
            </span>
          ))}
        </div>
      </section>

      {/* 致 mobile / 公网测试 */}
      <section className="mx-auto max-w-6xl px-4 pb-12 md:px-6 md:pb-16">
        <div className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 via-primary/10 to-transparent p-6 md:p-10">
          <div className="grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-center md:gap-8">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
                <Globe className="h-3.5 w-3.5" />
                适配 PC / 手机 / 平板
              </div>
              <h2 className="text-2xl font-bold text-foreground md:text-3xl">
                现在就去逛逛
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
                这一页是纯静态的（没有任何数据库 / 鉴权请求），可作为公网移动端打开速度的「基准对照」。
                如果这里能秒开、主站打开慢，那说明问题出在主站的数据加载链路上，
                可以再针对性优化。
              </p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                >
                  打开主站首页
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/auth/sign-up"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted"
                >
                  注册一个账号
                </Link>
              </div>
            </div>
            <ul className="space-y-2 text-sm md:text-base">
              {[
                '没有 DB 查询，纯 CDN 静态推送',
                '不挂任何 React 客户端组件',
                '中间件已豁免，跳过 JWT 校验',
                '可作为公网链接分享给任何人',
              ].map((s) => (
                <li
                  key={s}
                  className="flex items-start gap-2 rounded-xl border border-border/60 bg-card/60 px-3 py-2"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="text-foreground/90">{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}
