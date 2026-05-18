# SEO 技术审计备忘（v1.1，已与实现对齐）

> 早期结论已过时：本站 **并非**「纯 CSR、爬虫只能看到空壳」。以下为 **2026-05** 与代码对照后的口径与运维要点。

---

## 一、渲染形态（事实）

| 页面类型 | 机制 | 爬虫能否拿到正文 |
|----------|------|------------------|
| 首页 `/` | App Router 服务端取数 + **`revalidate`**（ISR） | 由服务端生成 HTML / RSC，非浏览器独拉正文 |
| 工具详情 `/tool/[slug]` | 服务端查库 + **`generateStaticParams`** + **`revalidate = 60`** + 客户端岛（收藏、访问量、评论等） | 工具描述与介绍在服务端参与渲染；动态部分为交互而非「全文 CSR」 |

工具详情客户端壳见 [`components/tool-detail-public-view.tsx`](../components/tool-detail-public-view.tsx) 注释：服务端已渲染静态信息，客户端负责收藏、上报访问等。

---

## 二、为何仍可能「收录慢 / 抓取异常」（排查顺序）

1. **正式域名与环境变量**  
   生产必须配置 **`SITE_URL=https://你的域名`**（浏览器能打开的地址，无尾斜杠）。[`lib/site-url.ts`](../lib/site-url.ts) 驱动 **`robots.txt` 的 `sitemap` / `host`**、canonical、结构化数据绝对 URL。**不要**把 **`http://0.0.0.0:3000`** 当作站点 URL：`0.0.0.0` 只是容器「监听所有网卡」，在浏览器里等同访问本机或连接被关闭（`ERR_CONNECTION_CLOSED`）；端口 **`3000`** 多在容器内，外网通常走 **80/443** 由平台转发。

2. **HTTP 进站**  
   用户从 `http://` 书签进入会显示浏览器「不安全」。**HTTP→HTTPS 强制跳转交给前置网关**（CloudBase 自定义域名 / CDN / Nginx），应用层不做此跳转（曾尝试后回退，详见 [`docs/done.md`](./done.md) 2026-05-11 第 7 条）。请在网关启用 HTTPS 跳转 + HSTS，并把 **`X-Forwarded-Proto`** 透传给容器（cookie `Secure` 判定仍需要）。

3. **构建期未连库 → 未预生成工具路径**  
   若 **`pnpm build` / `docker build` 阶段没有可用的 `DATABASE_URL`**，`app/tool/[slug]/page.tsx` 内 **`generateStaticParams`** 会捕获异常并 **`return []`**：**镜像内没有构建期静态页**，首次访问仍以 **服务端 ISR** 生成 HTML（对 Google 通常仍可索引），但缺少「构建即带好几百页」的预热。  
   **推荐**：在 **能执行 `docker build` 的 CI**（见 [`docs/ci-auto-build-database-url.md`](./ci-auto-build-database-url.md)）传入 **`--build-arg DATABASE_URL=...`**（或 `BUILD_DATABASE_URL`），或使用仓库 **`scripts/docker-build-ci.sh`** / GitHub Actions workflow。

4. **站长平台**  
   主动向 Google Search Console、百度搜索资源平台提交 **`https://你的域名/sitemap.xml`**，并用 URL  inspection / 抓取诊断查看实际 HTML。

---

## 三、不建议的方向（除非产品有新要求）

- **为 SEO 单独做「仅爬虫预渲染」**：当前已是服务端渲染 + ISR，收益有限、维护成本高。
- **关掉 `dynamicParams`**：新工具 slug 可能 **404**，需每次全量重部署，一般不采纳。
- **去掉 ISR 改为纯静态**：新工具上架必须重新 build，运维成本高；保留 **`revalidate` + 后台 `revalidatePath`** 更合适。

---

## 四、持续优化（产品与运营）

- 内链：分类 / 标签 / 角色页与工具详情互联（站内已有导航与列表）。
- 外链与品牌：与其他站点互换引用、稳定品牌名（如「智选AI」）与 `SITE_URL` 一致。
- 内容：工具介绍原创度、截图与结构化数据（已实现 JSON-LD 等）持续迭代。

---

## 五、历史记录（v1.0 摘要，仅供参考）

v1.0 曾误判为纯 CSR、建议手写 sitemap；实际上 **`app/sitemap.ts`** 已生成 sitemap，域名由 **`SITE_URL`** 决定。请以本文 **§二** 为准。
