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
   - **`SITE_URL` 或 `NEXT_PUBLIC_SITE_URL`**：生产站点绝对根 URL（无尾斜杠），用于 canonical、sitemap、OG（见 [`lib/site-url.ts`](../lib/site-url.ts)）。  
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

若漏跑：**前台门户 / 优秀方案 / 撤销请求** 会因缺列或约束报错。

---

## 三、构建与发布

1. **`pnpm install` / `pnpm build`**：与 lockfile 一致；Docker / CI 参考仓库既有 [`Dockerfile`](../Dockerfile)、[`pnpm-workspace.yaml`](../pnpm-workspace.yaml)、[`.npmrc`](../.npmrc)。  
2. **Node / pnpm 版本**：与 [`package.json`](../package.json) 的 `packageManager`、`engines`（若有）一致。  
3. **Docker / CI 构建与 `DATABASE_URL`**：`pnpm run build` 阶段会为多个路由做静态预渲染。[`/app/excellent-ai-solutions/page.tsx`](../app/excellent-ai-solutions/page.tsx) 使用 **`dynamic = 'force-dynamic'`**，在**未注入 `DATABASE_URL` 的镜像构建**中也可完成编译（列表在容器运行时读库渲染）。若希望改为构建期生成静态 HTML，需在 **`docker build` 传入可用的 `DATABASE_URL`（BuildKit secret）**，可自行去掉该页的 `force-dynamic` 并恢复 ISR。
4. **ISR / 缓存**：[`app/excellent-ai-solutions/[slug]/page.tsx`](../app/excellent-ai-solutions/[slug]/page.tsx) 等仍可使用 `revalidate`；发布后若需立即见效，可对相关路径做一次 **`revalidatePath`** 或等待 TTL。

---

## 四、上线后烟雾测试（建议）

- [ ] 登录 → `/account/home` 门户加载正常（关注分块、收藏、评论、提交三步展开）。  
- [ ] `/excellent-ai-solutions` 头像墙与 Tooltip（桌面）。  
- [ ] 任意已通过 slug：`/excellent-ai-solutions/[slug]`，且无「我的关注」类分区标题。  
- [ ] 管理员：`/admin/showcases` 审核 / 撤销 / 「用户请求撤销」排序与徽章。  
- [ ] 个人中心 / 管理后台侧栏宽度与主区左边距无错位。

---

## 五、安全与合规提示

- 生产数据库**最小权限**：应用账号仅需要业务所需 DDL/DML，迁移账号与运行时账号宜分离。  
- **备份**：大版本或迁移前做一次快照 / 逻辑备份。  
- **审计**：若 `.env.local` 曾提交到 Git（哪怕是私有仓库），按泄露事件处理：轮换密钥并清理历史（如需要）。
