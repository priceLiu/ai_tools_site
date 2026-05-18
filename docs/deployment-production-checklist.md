# 生产环境部署清单（本站）

面向门户主页、`/excellent-ai-solutions` 等与 **`DATABASE_URL`（PostgreSQL）** 直连的业务。**不包含密钥占位**：密钥仅在宿主平台的「环境变量」里配置，且绝不写入仓库或聊天记录。

---

## 一、环境与密钥（`.env.local` 与此对照）

1. **`.env.local` 仅供本机**  
   - 已被 `.gitignore` 忽略；**不要**把其中的连接串、密码、`AUTH_SECRET` 复制进仓库或发给他人。  
   - **若怀疑泄露**：立刻**轮换**数据库账号密码、`AUTH_SECRET`，并在腾讯云 / Neon 控制台收紧访问策略。

2. **生产环境应配置的变量（名称示例）**  
   - **`DATABASE_URL`**：指向**生产库**的连接串。  
     - 应用部署在腾讯云 VPC 内时，优先使用 **内网地址 + 内网端口**（延迟与安全更好）；不要在生产长期使用「仅用于迁移验证」的宽松策略（例如不必要的 `sslmode=disable`），应以云厂商文档为准启用 TLS。  
     - 若暂用公网串：在安全组 / 防火墙中**仅限应用出口 IP**，禁止 `0.0.0.0/0` 裸露端口（除非你确认并接受风险）。  
   - **`AUTH_SECRET`**：**独立生成**一条足够长的随机串（≥32 字符），**勿与开发机 `.env.local` 共用**，否则会话可被伪造。  
   - **登录 cookie（生产常见故障）**：会话为 HttpOnly Cookie；若生产 **`NODE_ENV=production`** 且对浏览器表现为 **HTTPS**，但反向代理到 Node 时未转发协议头，可能导致 **`Secure` cookie 与实际情况不符**，浏览器直接丢弃 Set-Cookie，现象为 **点登录无报错却一直是未登录**。  
     - **推荐**：在 Nginx / CLB / Ingress 上向应用转发 **`X-Forwarded-Proto: https`**（及按需 `X-Forwarded-Host`）。  
     - **可选**：设置 **`SESSION_COOKIE_SECURE=true`**（强制 Secure）或 **`SESSION_COOKIE_SECURE=false`**（强制不 Secure，仅用于排查或纯 HTTP 环境；正式 HTTPS 站点优先修代理头）。  
   - **`SITE_URL`（首选）或 `NEXT_PUBLIC_SITE_URL`**：生产站点 **对外访问用的根 URL**（浏览器能打开的域名），形如 **`https://ai-code8.com`**（无尾斜杠），用于 canonical、sitemap、OG（见 [`lib/site-url.ts`](../lib/site-url.ts)）。**腾讯云 / 自建部署没有 `VERCEL_URL`**；不配此项时会回落到仓库占位域名。**切勿**填 **`http://0.0.0.0:3000`**：`0.0.0.0` 只是 Dockerfile 里容器 **监听地址**，不是网址；在浏览器里访问只会连本机或出现 **`ERR_CONNECTION_CLOSED`**。云托管用户请用 **HTTPS + 备案域名** 或环境 **`*.app.tcloudbase.com`**（并已在「HTTP 访问服务」配置路由）。若误写 `http://`，生产环境 [`getSiteUrl()`](../lib/site-url.ts) 会改为 `https://`；**`0.0.0.0` / `localhost` / `127.0.0.1` 在生产会被视为无效并忽略。**  
   - **HTTP→HTTPS（应用层）**：[`middleware.ts`](../middleware.ts) 在生产环境对 **非 localhost** 请求执行 [`maybeHttpsRedirect`](../lib/middleware-https-redirect.ts)：当 **`X-Forwarded-Proto: http`**（用户经 http 访问 CDN/入口）或未传该头且直连 Node 为 `http:` 时，**308** 重定向到同源 **HTTPS**。需在 **Nginx / 阿里云 SLB / CDN / 云托管网关** 向应用透传 **`X-Forwarded-Proto`**（与上文 cookie `Secure` 一致）。  
     **若浏览器 / 网关错误地把 `Host` 设为 `0.0.0.0:3000`**（监听地址误当网址），中间件会尝试用 **`X-Forwarded-Host`** 修正跳转目标；请务必在网关配置 **`X-Forwarded-Host: 用户访问的域名`**，否则无法自动纠正。  
   - **`NEXT_PUBLIC_SUPABASE_*`**：若前台仍通过 `@supabase/supabase-js` 访问 Supabase，按现有项目约定配置（名称以代码为准）。  
   - **`NEON_DRIVER=postgres`**：注释写明多见于本地 Neon TCP；生产若在 Serverless 上用 Neon HTTP 等，**按运行环境删除或改写**，避免多余假设。

3. **`NEON_DATABASE_URL_BACKUP` / `TENCENT_DATABASE_URL*`**  
   - 这些可作为运维备忘保存在**密钥管理器**，不必全部塞进运行时环境；运行时通常只需 **`DATABASE_URL` 一条「当前主库」**。

---

## 二、数据库迁移（上线必跑）

在**生产库**按顺序执行（或等价流水线），至少包含门户与公开发布相关：

| 顺序 | 文件 |
|------|------|
| 1 | [`supabase/migrations/20260509120000_profiles_portal_showcase.sql`](../supabase/migrations/20260509120000_profiles_portal_showcase.sql) |
| 2 | [`supabase/migrations/20260509133000_showcase_revoke_requested.sql`](../supabase/migrations/20260509133000_showcase_revoke_requested.sql) |

若漏跑：**前台门户 / AI 方案集 / 撤销请求** 会因缺列或约束报错。

### 故障排除：`column "showcase_revoke_requested_at" does not exist`

说明 **第 2 条迁移未在当前 `DATABASE_URL` 指向的库上执行**。在与 **`DATABASE_URL` 对应的 PostgreSQL** 上执行即可（任选其一）：云数据库控制台自带的 **SQL 窗口**、`psql`、DataGrip / DBeaver 等客户端连接到同一实例后执行。下面脚本含 **`IF NOT EXISTS`**，可重复执行：

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS showcase_revoke_requested_at timestamptz;

COMMENT ON COLUMN public.profiles.showcase_revoke_requested_at IS
  '用户点击「通知撤销」的时间；管理员下架或重新审核后应清空';
```

也可在项目根目录用 **`psql`**（连接串与运行时 **`DATABASE_URL` 一致**）：

```bash
psql "$DATABASE_URL" -f supabase/migrations/20260509133000_showcase_revoke_requested.sql
```

---

## 三、构建与发布

1. **`pnpm install` / `pnpm build`**：与 lockfile 一致；Docker / CI 参考仓库既有 [`Dockerfile`](../Dockerfile)、[`pnpm-workspace.yaml`](../pnpm-workspace.yaml)、[`.npmrc`](../.npmrc)。  
2. **Node / pnpm 版本**：与 [`package.json`](../package.json) 的 `packageManager`、`engines`（若有）一致。  
3. **Docker / CI 构建与 `DATABASE_URL`**：`pnpm run build` 阶段会为多个路由执行 **`generateStaticParams`**（若此时能连库）。  
   - **CloudBase 控制台自动部署**：运行时环境变量 **通常不会**进入 Docker `RUN pnpm build`，构建期预渲染需 **流水线传入 `--build-arg`** 或改用「镜像拉取」——详见 **[`docs/ci-auto-build-database-url.md`](./ci-auto-build-database-url.md)**。  
   - **推荐（任意能跑 docker build 的 CI）**：`docker build --build-arg DATABASE_URL="..."` 或使用 **[`scripts/docker-build-ci.sh`](../scripts/docker-build-ci.sh)**（环境变量 **`DATABASE_URL`** 或 **`BUILD_DATABASE_URL`**）；流水线应对日志 **掩码**。Dockerfile 支持 **`ARG DATABASE_URL`** 与备用 **`ARG BUILD_DATABASE_URL`**。  
   - **GitHub 仓库**：推送 `main`/`master` 触发 [`.github/workflows/docker-build.yml`](../.github/workflows/docker-build.yml)，在 Actions Secrets 配置 **`DATABASE_URL`** 或 **`BUILD_DATABASE_URL`** 后即自动 **带参构建**（默认不 push 镜像，可自行追加推送步骤）。  
   - **未传入 build-arg**：构建仍可完成，对应路由依赖运行时 **ISR / 按需生成**。  
   - [`/app/excellent-ai-solutions/page.tsx`](../app/excellent-ai-solutions/page.tsx) 使用 **`dynamic = 'force-dynamic'`**，列表仅在运行时读库；与工具详情 **ISR** 策略不同。
4. **ISR / 缓存**：[`app/excellent-ai-solutions/[slug]/page.tsx`](../app/excellent-ai-solutions/[slug]/page.tsx) 等仍可使用 `revalidate`；发布后若需立即见效，可对相关路径做一次 **`revalidatePath`** 或等待 TTL。

---

## 四、上线后烟雾测试（建议）

**SEO / 收录相关扩展清单**：见 [`docs/release-seo-build-footer.md`](./release-seo-build-footer.md) 第四节；**自动构建与 CloudBase**：见 [`docs/ci-auto-build-database-url.md`](./ci-auto-build-database-url.md)。

- [ ] 登录 → `/account/home` 门户加载正常（关注分块、收藏、评论、提交三步展开）。  
- [ ] `/excellent-ai-solutions` 头像墙与 Tooltip（桌面）。  
- [ ] 任意已通过 slug：`/excellent-ai-solutions/[slug]`，且无「我的关注」类分区标题。  
- [ ] 管理员：`/admin/showcases` 审核 / 撤销 / 「用户请求撤销」排序与徽章。  
- [ ] 个人中心 / 管理后台侧栏宽度与主区左边距无错位。

---

## 五、故障：`ERR_CONNECTION_CLOSED` 或地址栏出现 `0.0.0.0:3000`

| 现象 | 说明与处理 |
|------|------------|
| 浏览器访问 **`http://0.0.0.0:3000`** | **`0.0.0.0` 不是网站地址**，只是容器内「监听所有网卡」。请改用 **`https://备案域名`** 或 CloudBase **`*.app.tcloudbase.com`**（并已配置 HTTP 访问服务路由）。 |
| 跳转后仍停留在 `0.0.0.0` | 网关把 **`Host`** 写成了 `0.0.0.0:3000`。请在 **CDN / 负载均衡 / Nginx** 上设置 **`X-Forwarded-Host`** 为真实域名（与 [`maybeHttpsRedirect`](../lib/middleware-https-redirect.ts) 行为一致）。 |
| `SITE_URL` 误配 | 控制台 **`SITE_URL`** 必须为 **`https://你的域名`**，见第一节；[`getSiteUrl()`](../lib/site-url.ts) 在生产会忽略 `0.0.0.0` / `localhost` 等。 |

---

## 六、安全与合规提示

- 生产数据库**最小权限**：应用账号仅需要业务所需 DDL/DML，迁移账号与运行时账号宜分离。  
- **备份**：大版本或迁移前做一次快照 / 逻辑备份。  
- **审计**：若 `.env.local` 曾提交到 Git（哪怕是私有仓库），按泄露事件处理：轮换密钥并清理历史（如需要）。
