# SEO 接入方案与执行清单

> 目标：从 SEO 0 分起步，让 Google / 百度 / Bing 等主流搜索引擎能：
> 1. 发现站内全部公开页（首页 / 分类 / 工具 / about）；
> 2. 抓到合规的 metadata、canonical、OG / Twitter 卡、JSON-LD 结构化数据；
> 3. 不抓也不收录后台 / 鉴权 / 诊断页；
> 4. 让你能在 Google Search Console / 百度站长平台 提交 sitemap，看到关键词曲线。

---

## 〇、最重要的前置：可达性 > 一切技术 SEO

国内搜索：百度 / Bing 中文 / 360 / 搜狗 / 神马 / 头条搜索。

- `*.vercel.app` 域名在国内移动网络都打不开（已实测，详见 `deploy.md` 第十一节），**百度蜘蛛走的是国内出口，根本爬不到**。
- Google 虽能爬到，但「无品牌权重 + 共享子域名 + 域名级风控」会被抑制排名。

**结论：** 先解决域名（自定义域名 + Cloudflare 代理，或备案 + 国内部署），再谈 SEO。否则下面所有工作的收益都会被这个瓶颈卡住。

---

## 一、现状盘点

### ✅ 已具备的 SEO 基础

| 项 | 位置 | 说明 |
| --- | --- | --- |
| 全站默认 metadata | `app/layout.tsx` | title / description / keywords |
| 工具页动态 metadata | `app/tool/[slug]/page.tsx` | `generateMetadata` 用 `cache()` 复用一次取数 |
| 分类页动态 metadata | `app/category/[slug]/page.tsx` | 同上 |
| 静态预渲染 | `generateStaticParams` × 工具/分类 | 爬虫一次拿全 HTML |
| 60s ISR | 首页/分类/工具 | 编辑后短时间内可被爬到新版本 |
| `lang="zh-CN"` | `app/layout.tsx` | ✅ |
| viewport 正确 | `app/layout.tsx` | Mobile-first 排名前提 |

### ❌ 关键缺失（本次补齐）

| 项 | 影响 |
| --- | --- |
| 没有 `sitemap.xml` | Google / 百度无法快速发现全部工具与分类页 |
| 没有 `robots.txt` | 爬虫不知道哪些不爬，admin/account/api 暴露 |
| 没有 `metadataBase` | OG / Twitter 图无法生成绝对 URL，社交分享无图 |
| 没有 canonical | 大小写 / query string 不同的同一页可能被当作重复内容降权 |
| OG / Twitter Card 缺失 | 微信 / X / LinkedIn 分享时无图无标题 |
| 无 JSON-LD | Google 富片段（rich snippet）拿不到 |
| 后台未显式 noindex | 抓取预算被浪费在 admin / account / auth |

---

## 二、技术 SEO（一次性补齐，本次实施）

### 2.1 `app/sitemap.ts`

读 `neonListApprovedToolSlugs` + `neonListCategoriesEnabled` 自动生成（已禁用产品线不进站地图）。

- 域名从 `process.env.SITE_URL` 取，构建期注入；缺省回退 `https://ai-tools-site-xi.vercel.app`。
- 1 小时 revalidate；后台审核完工具会通过 `revalidatePath` 推首页/详情，不需要手动重建 sitemap。

### 2.2 `app/robots.ts`

- 允许：`/`、`/about`、`/category/`、`/tool/`、`/auth/sign-up`（注册入口收录）。
- 禁止：`/admin/`、`/account/`、`/api/`、`/auth/login`、`/auth/callback`、`/auth/error`、`/submit`、`/favorites`、`/my-submissions`、`/diag`、`/echo`、`/search`。
- 末尾声明 `sitemap`，引导爬虫读 sitemap.xml。

### 2.3 `app/layout.tsx` 全站 metadata 升级

- `metadataBase = new URL(SITE_URL)`，让所有相对 URL 自动转绝对。
- `title` 用 `template: '%s | AI 工具集'`，子页只写工具名/分类名，浏览器标签自动拼。
- 默认 `openGraph` + `twitter`（card: summary_large_image）。
- 默认 `robots = { index: true, follow: true, googleBot: { 'max-image-preview': 'large', 'max-snippet': -1 } }`，子页要不收录就在自己 metadata 里覆盖 `robots: { index: false }`。

### 2.4 工具页 / 分类页 generateMetadata

- 增加 `alternates.canonical`（指向自身公开 URL）。
- `openGraph`：type / url / images（工具 logo）。
- `twitter`：title / description / images。

### 2.5 工具页 JSON-LD（`SoftwareApplication`）

```jsonld
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": tool.name,
  "description": tool.description,
  "applicationCategory": tool.category?.name,
  "url": tool.website_url,
  "image": tool.logo_url,
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": 5,
    "ratingCount": tool.favorite_count
  }
}
```

### 2.6 后台 / 账户 / auth / 诊断 → 显式 noindex

- `app/admin/layout.tsx` / `app/account/layout.tsx`：`metadata.robots = { index: false, follow: false }`。
- `app/auth/login`、`app/auth/error`、`app/auth/account-disabled`、`app/auth/sign-up-success`：同上。
- `app/diag` / `app/echo` 已经设过，沿用。

---

## 三、内容 SEO（持续运营）

### 3.1 长尾关键词页面

参考 `docs/info.md` 的场景分类，每个分类页的 H1 / title 要带关键词。

| 当前 | 改成 |
| --- | --- |
| `${cat.name} - AI工具集` | `AI 论文工具推荐 · 论文降重 / 写作 / 润色 - AI 工具集` |

把分类页 description 写成「该分类介绍 + 适合什么场景 + 推荐 Top N」，这是长尾流量主力。

### 3.2 工具详情正文

- `introduction` 字段渲染时按 H2 / H3 切层级（确认 markdown / HTML 渲染保留 heading）。
- 详情页底部加「相似工具」「同分类工具」内链区块（提升爬虫发现率 + 用户停留）。

### 3.3 站内搜索页 noindex

`/search` 一律 noindex（容易被 SEO spam 利用），但可以在站内继续暴露入口。

---

## 四、性能 SEO（Core Web Vitals）

Google Core Web Vitals 是排名因素：

| 指标 | 目标 | 当前关注点 |
| --- | --- | --- |
| LCP | ≤ 2.5s | 首屏 logo 用 `next/image priority`；公网域名可达性 |
| INP | ≤ 200ms | React 客户端组件减少；按需 lazy |
| CLS | ≤ 0.1 | 工具卡片图片设 width/height，预留位 |

具体优化项：

- 工具 logo：从 `<img>` 切到 `next/image`，加 `sizes` / `priority`（首屏 LCP 卡片才加 priority）。
- 字体：`Geist({ display: 'swap' })`，避免 FOIT。
- 首屏 bundle：`/diag` 已经能测端到端，bundleJSON > 200KB 时考虑压缩。

---

## 五、提交与监测

### 5.1 必接

| 平台 | 操作 |
| --- | --- |
| **Google Search Console** | 1) DNS TXT 验证域名 2) 提交 `sitemap.xml` 3) 监控 indexing coverage / mobile usability / Core Web Vitals |
| **百度站长平台** | 备案后 1) 验证域名 2) 提交 `sitemap.xml` 3) 加「自动推送 JS」（百度提供的一段脚本，用户访问页面时主动推送给百度蜘蛛） |
| **Bing Webmaster Tools** | 与 Google 共用一份 sitemap，1 分钟提交 |

### 5.2 加分项

| 平台 | 必要性 |
| --- | --- |
| 神马（UC/夸克） | ⭐⭐ 中文移动端流量重要 |
| 360 / 搜狗 | ⭐ 权重低，提交即可 |
| 头条搜索 | ⭐⭐ 增长中 |

---

## 六、站外（最难也最关键）

排名公式简化：**内容 × 关键词 × 域名权威 × 用户行为**。前三可控，最后靠站外：

- V2EX / 即刻 / 少数派 / 知乎 / 小红书 / 公众号：写「20 款 AI 写作工具实测」类长文，反链回工具页。
- 加入 ToolFolder、AIBase、Product Hunt 等导航站。
- **不要做垃圾外链**（GSA / 黑帽），百度对这个打击非常狠，可能直接被惩罚降权。

---

## 七、落地节奏

| 周 | 工作 | 状态 |
| --- | --- | --- |
| W1 | 解决域名可达；加 sitemap/robots/metadataBase；后台 noindex | 本次提交完成大部分 |
| W2 | 工具/分类页 OG/canonical/JSON-LD；接入 GSC + 百度站长平台 | 本次提交完成 |
| W3 | 分类页内容补充（描述 + FAQ）；工具页加「相似工具」内链 | TODO |
| W4 | 性能优化：next-image / 字体 swap；监控 Core Web Vitals | TODO |
| 持续 | 站外内容投放、定期看 GSC 关键词、调 title/desc | TODO |

---

## 八、未来再退步的兜底

新页面要按本规范写。已用 Cursor Rule（`.cursor/rules/seo-page-conventions.mdc`）锁住下面三件事，新建 page.tsx 时 AI 会自动遵循：

1. 必须导出 `generateMetadata` 或 `metadata`，含 `title` / `description` / `alternates.canonical`。
2. 公开内容页加 `openGraph`；可结构化的内容（工具）加 JSON-LD。
3. 后台 / 鉴权页一律 `robots: { index: false }`。
