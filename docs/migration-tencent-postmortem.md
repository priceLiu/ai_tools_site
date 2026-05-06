# Neon → 腾讯云 整站迁移：事后总结（实操 + 踩坑录）

> **本文档是 2026-05-05 ~ 2026-05-06 实际迁移过程的完整记录。**
> 与 [`docs/migration-tencent.md`](./migration-tencent.md)（迁移**前**计划）和 [`docs/dual-run-strategy.md`](./dual-run-strategy.md)（双跑策略）配合使用。
>
> 先看本文档：
>
> - **「我现在要从 0 开始迁一份类似项目到腾讯云」** → 第二节 [完整迁移 Checklist](#二完整迁移-checklist一步一勾)
> - **「我已经迁完了但某个功能炸了」** → 第三节 [所有踩过的坑](#三所有踩过的坑共-12-个含截图)
> - **「我要看长期运维方案」** → 第六节 [验收 / 安全收紧 / 长期运维](#六验收--安全收紧--长期运维)

---

## 一、为什么要迁，迁了什么

### 1.1 背景

| 维度 | 旧 | 新 |
|---|---|---|
| 数据库 | Neon PostgreSQL（Serverless，AWS Singapore） | **腾讯云 云数据库 PostgreSQL 16**（上海地域） |
| 应用 | Vercel（Singapore） | **CloudBase Run**（上海地域，与 DB 同 VPC） |
| 国内访问 | `*.vercel.app` 被部分运营商干扰、Neon 同区跨境 ~30ms | 自有备案域名 + VPC 内网 < 3ms |
| DB 驱动 | `@neondatabase/serverless`（HTTP）+ `postgres` 双驱动 | 单一 `postgres` TCP（保留 `lib/neon/sql.ts` 路径不动，60+ 文件 import 不变） |
| 月成本 | Neon Free + Vercel Free | 云数据库 PG 单机版 ¥85 + CloudBase Run ¥30–60 = **¥115–145** |

### 1.2 关键决策

- ✅ **仍用 PostgreSQL** — 项目里有 100+ 处 SQL 模板和 5 个 plpgsql 函数；迁到 MySQL / 文档库要重写 1.5–3 周
- ✅ **代码尽量不动** — 只改 `lib/neon/sql.ts` 拿掉 HTTP 驱动；其他 60+ 个文件 `import` 路径都不动
- ❌ **不用 TDSQL-C PostgreSQL Serverless** — 这个产品**腾讯云不存在**（Serverless 形态只有 MySQL 版）
- ❌ **不用 CloudBase 数据库** — MySQL/文档库都要重写 SQL；PostgREST 不是真 SQL
- ✅ **双跑期** — Vercel + CloudBase Run **共用**同一个腾讯 PG，并通过 `x-deploy-target` / `x-db-kind` 响应头区分

### 1.3 迁移结果（一句话）

```
12 表 / 1375 行数据 / schema 27 个迁移文件 / 32 秒搬完
应用首次部署因 prerender / ISR / NOT NULL 漂移踩了 3 个坑，全部修复
最终 /, /tool/<slug>, /role/<slug>, /category/<slug>, /admin, /submit 全部跑通
```

---

## 二、完整迁移 Checklist（一步一勾）

> **完全不知道腾讯云怎么用？** 按这个 checklist 逐项做，全程约 4–6 小时（含等审核）。

### 阶段 A：腾讯云资源开通（你做，2 小时）

- [ ] **A.1** 注册腾讯云 + 实名认证 — <https://cloud.tencent.com/>，个人微信扫码 5 分钟
- [ ] **A.2** 选地域 — **上海**或广州，与你后续业务用户分布最近的；本项目选**上海**
- [ ] **A.3** 创建 VPC + 子网 — 控制台搜「私有网络」，新建 `aitools-vpc`（CIDR `10.0.0.0/16`）+ 一个子网 `aitools-subnet-sh`（CIDR `10.0.0.0/24`，可用区任选）
- [ ] **A.4** 创建安全组 — 名字 `aitools-pg-sg`，**入站**先全开 `0.0.0.0/0` TCP 5432（本机 dump 时要用），出站全部放行
- [ ] **A.5** 购买云数据库 PostgreSQL — 路径 `控制台 → 云产品 → 数据库 → 云数据库 PostgreSQL → 立即购买`：
  - 计费：按量付费（先验证再包年）
  - 地域：与上面 VPC 同地域
  - 主可用区：随便选；备可用区：**单机版**就不需要选，**双机版**才有备
  - 版本：**PostgreSQL 16**
  - 规格：1 核 2 GB（最低档够用）
  - 网络：选刚才的 `aitools-vpc` + `aitools-subnet-sh`
  - 安全组：选 `aitools-pg-sg`
  - 字符集：`UTF8`，区域 `C`，排序 `C`
  - 实例名：`aitools-pg`
  - 用户名：`aitools_admin`，密码 **只用字母数字下划线**（例 `Password_1`，强度后面再改；**别**用 `@` `#` `&` 等 URL 特殊字符 — 见踩坑 ④）
  - **必须开启**：内网访问 + 外网访问（外网先开，迁数据用，迁完再关）
- [ ] **A.6** 拿到连接串 — 实例详情里有「外网地址」如 `sh-postgres-xxxxxx.sql.tencentcdb.com:24155`、「内网地址」如 `10.0.0.2:5432`。复制下来记到 `.env.local`。
- [ ] **A.7** 创建数据库 `aitools`（默认只有 `postgres` 系统库，业务库需手动建）：
  ```bash
  # 项目根目录
  node -e "
  const postgres = require('postgres');
  const sql = postgres('postgresql://aitools_admin:Password_1@sh-postgres-xxxxxx.sql.tencentcdb.com:24155/postgres?sslmode=disable', {ssl: false});
  sql\`CREATE DATABASE aitools OWNER aitools_admin\`.then(r => { console.log('OK'); sql.end(); });
  "
  ```
  或在控制台「**数据库管理 → 新建数据库**」里点（见图 12）。
- [ ] **A.8** 开通 CloudBase 环境 — 控制台搜「云开发 CloudBase」→ 创建环境 → **个人版免费** / 包年 ¥30+ 起。地域**必须与 DB 同地域**（上海）。记下 envId（形如 `aitools-d0g1a19n626a79a79`）。
- [ ] **A.9** 在该环境内开通 **云托管 / Cloud Run**（容器托管） — 后面要部署 Next.js 用的。

### 阶段 B：本地代码改造（我已做完，commit 见 git log）

- [x] **B.1** `lib/neon/sql.ts`：拿掉 `@neondatabase/serverless` HTTP 驱动；保留模块路径不动
- [x] **B.2** `package.json`：删 `@neondatabase/serverless`，留 `postgres@3.4.5`
- [x] **B.3** `next.config.mjs`：加 `output: 'standalone'`（Docker 构建必需）
- [x] **B.4** 新增 `Dockerfile` — 3 阶段（deps / build / runtime），node:22-alpine + 非 root 用户
- [x] **B.5** 新增 `.dockerignore` — 排除 `node_modules` / `.next/cache` / `.env*` / `docs` / `supabase` / `dumps` / `scripts` / `.vercel`
- [x] **B.6** 新增 `lib/deploy-target.ts` — 检测当前实例是 vercel/cloudbase/local 与 DB 是 neon/tencent
- [x] **B.7** 修改 `middleware.ts` + `app/api/diag/route.ts`：所有响应自动带 `x-deploy-target` / `x-db-kind` 头，方便双跑期诊断

### 阶段 C：数据迁移（机器侧做，30 秒）

- [x] **C.1** `.env.local` 配齐：
  ```env
  DATABASE_URL="postgresql://aitools_admin:Password_1@sh-postgres-xxxxxx.sql.tencentcdb.com:24155/aitools?sslmode=disable"
  TENCENT_DATABASE_URL="<同上>"
  TENCENT_DATABASE_URL_VPC="postgresql://aitools_admin:Password_1@10.0.0.2:5432/aitools?sslmode=disable"
  NEON_DATABASE_URL_BACKUP="postgresql://neondb_owner:...@ep-xxx.neon.tech/neondb?sslmode=require&channel_binding=require"
  ```
- [x] **C.2** 跑迁移：`node scripts/migrate-neon-to-tencent.mjs`
  - 自动按 `information_schema.referential_constraints` 拓扑排序
  - 自引用 FK（`categories.parent_id` / `navigation_menu_items.parent_id`）两阶段处理
  - 单批 200 行，出错自动降级到逐行重试
  - 完成后会打印每张表的「源行数 == 目标行数」对账
- [x] **C.3** schema 漂移对账：`node scripts/diff-schema-neon-vs-tencent.mjs`
  - 对比表 / 列定义 / trigger / function / sequence / extension
  - **本项目对账结果：** 14 列 nullable 漂移（Neon 比 migration 文件松），2 个 `_updated_at` trigger 漏装，trigger 内容代码已显式 SET 兜底（不影响行为）

### 阶段 D：本地验证（pnpm dev 连腾讯 PG）

- [x] **D.1** `pnpm dev`，浏览器打开 `localhost:3000`，工具列表能加载就 OK
- [x] **D.2** 访问 `localhost:3000/api/diag` 看 JSON：
  ```json
  {
    "ok": true,
    "deploy": { "target": "local" },
    "database": { "kind": "tencent", "via_vpc": false }
  }
  ```

### 阶段 E：Vercel 切到腾讯 DB（双跑期 Phase 1）

- [x] **E.1** Vercel 项目环境变量：把 `DATABASE_URL` 改成腾讯**外网串**（`sh-postgres-xxx.sql.tencentcdb.com:24155` + `?sslmode=disable`）
- [x] **E.2** 重新部署。验收：网站正常 + DevTools 能看到 `x-deploy-target: vercel` + `x-db-kind: tencent`
- [x] **E.3** **暂时**保持 Vercel 在线（用户访问还是走 Vercel；DB 是腾讯）

### 阶段 F：CloudBase Run 部署

- [x] **F.1** GitHub 推代码 — 包含 `Dockerfile` 与 `next.config.mjs output:'standalone'`
- [x] **F.2** CloudBase 控制台 → 云托管 → 新建服务 `aitools-web`：
  - 来源选 **GitHub**（要授权一次）
  - Branch: `main`
  - Build context: `/`（项目根，Dockerfile 在根）
  - 端口：`3000`（与 Dockerfile 里 `EXPOSE 3000` 对齐）
  - 内存：512 MB / 1 vCPU 起步即可
  - 环境变量：
    ```
    DATABASE_URL = postgresql://aitools_admin:Password_1@sh-postgres-xxx.sql.tencentcdb.com:24155/aitools?sslmode=disable
    AUTH_SECRET = <openssl rand -base64 32>
    SITE_URL = https://aitools-d0g1a19n626a79a79-1422563795.ap-shanghai.app.tcloudbase.com
    ```
    > **个人版 CloudBase Run 不支持自定义 VPC**，所以 `DATABASE_URL` 必须用**外网串**；要走 VPC 内网得升级到企业版 / 把容器与 DB 都搬到 TKE
- [x] **F.3** 点「部署」，等 build —— 第一次大概率挂在某些 prerender 错误（[详见踩坑 ⑧⑨⑩](#三所有踩过的坑共-12-个含截图)），按踩坑录修一个 push 一次，CloudBase Run 会自动重新构建
- [x] **F.4** 配置 HTTP 路由 —— 见踩坑 ②（默认域名打开是 404 就是这个步骤没做）

### 阶段 G：验收

- [ ] **G.1** 首页能开 `/` —— 看到完整工具列表 + 场景卡 + 热门工具
- [ ] **G.2** `/api/diag` 返回 `database.kind:'tencent'` 且 `tools.count == 174`
- [ ] **G.3** 工具详情 `/tool/<slug>` 能开
- [ ] **G.4** 角色页 `/role/<slug>` 能开（如 `/role/office-worker`）
- [ ] **G.5** 分类页 `/category/<slug>` 能开
- [ ] **G.6** 注册 / 登录跑通
- [ ] **G.7** 后台 `/admin` 能开，`pending` 工具能审核通过、隐藏，**且首页立刻反映变化**（不需手动「生成静态」）

### 阶段 H：安全收紧（迁完必做）

- [ ] **H.1** 重置 PG 密码为强密码：`openssl rand -base64 24`
- [ ] **H.2** CloudBase Run 的 `DATABASE_URL` 同步换成新密码
- [ ] **H.3** 关闭 PG 实例的**外网访问**（控制台 → 实例 → 网络）
- [ ] **H.4** 删除安全组里临时的 `0.0.0.0/0` 入站规则
- [ ] **H.5** 备案自有域名 + CloudBase Run 绑域名 — 走完后 `*.tcloudbase.com` 的「测试域名拦截」消失（见踩坑 ⑥）

---

## 三、所有踩过的坑（共 12 个，含截图）

> 按发生顺序记录，每个坑都给出：现象 → 原因 → 解决 → 涉及代码/文件。

---

### ① `pnpm install --no-frozen-lockfile` 卡死

**现象**：交互式 prompt 卡在「是否清空 node_modules」，没有 stdin 永远等。

**原因**：`pnpm` 检测到 `node_modules` 与 lockfile 不一致时默认问交互式问题。

**解决**：加 `--config.confirmModulesPurge=false` 或用 `--frozen-lockfile`（推荐）：

```bash
pnpm install --frozen-lockfile
```

---

### ② `brew install libpq` 跑 8 分钟无声 → 弃用 `pg_dump`，改用纯 Node 迁移

**现象**：原计划 `dump-from-neon.sh` 要装 `libpq` 才能跑 `pg_dump`/`pg_restore`，但 macOS Brew 编译 PG 客户端要 5–10 分钟，且过程没输出极易让人以为卡死。

**原因**：项目代码里已有 `postgres` npm 包；何必再装 native 客户端。

**解决**：写 `scripts/migrate-neon-to-tencent.mjs` 完全用 Node 实现（无 native 依赖）：

- 自动按 `information_schema.referential_constraints` **拓扑排序** 决定插入顺序
- 自引用 FK（`categories.parent_id`、`navigation_menu_items.parent_id`）**两阶段**：
  1. 整批 INSERT 时这些字段全置 NULL
  2. 再用 UPDATE 回填（避免 FK 自引用 deadlock）
- 单批 200 行 INSERT；失败自动降级到逐行重试，便于定位脏数据
- 全量 1375 行 / 12 表 / 27 个 schema 文件 → **32 秒**完成

```bash
node scripts/migrate-neon-to-tencent.mjs              # 完整跑
node scripts/migrate-neon-to-tencent.mjs --check      # 仅连通性
node scripts/migrate-neon-to-tencent.mjs --skip-schema # 复跑数据
```

---

### ③ TencentDB Serverless PG 不存在

**现象**：腾讯云控制台「TDSQL-C」入口（`cynosdb`）只有 MySQL 版有 Serverless，PostgreSQL 版没有 Serverless 形态。

**原因**：与 AWS 的 Aurora Serverless / Neon 不一样，腾讯只为 MySQL 版提供 Serverless。

**解决**：买**云数据库 PostgreSQL**（标准托管 PG 16，路径 `buy.cloud.tencent.com/pgsql`）。单机版 1c2g + 20GB 月费约 ¥85，与 Neon 行为最接近。

---

### ④ `DATABASE_URL` 里密码含 `@` 把 host 切碎了

**现象**：连接报错 `getaddrinfo ENOTFOUND 1389@sh-postgres-...`。

**原因**：密码 `Password@1389` 里有 `@`，URL 解析器把它当成 `userinfo:host` 分隔符 → host 被错位解析。

**解决**：

- 推荐 — 重置密码为**纯字母数字下划线**（如 `Password_1`）
- 不重置 — 必须 URL 编码：`Password@1389` → `Password%401389`

---

### ⑤ `nc -zv` 通但 PG 协议握手 30 秒零返回

**现象**：

```bash
nc -zv sh-postgres-xxx.sql.tencentcdb.com 24155
# Connection succeeded
node scripts/migrate-neon-to-tencent.mjs
# CONNECT_TIMEOUT 后挂掉
```

**原因**：

1. 安全组入站规则原配 `216.227.168.217/32`（自家公网 IP）
2. 但腾讯云 LB 看到的客户端 IP **可能不是** `ifconfig.me` 看到的那个（NAT / 双线 ISP 等原因）
3. TCP 层 LB 接受了三次握手，但应用层数据被 SG 丢弃 → 0 字节返回

**解决**：临时把 SG 改 `0.0.0.0/0` 测试。30 秒生效后立刻通。**部署后必须删掉这条规则**（见阶段 H）。

---

### ⑥ `ssl: 'require'` 连不上 / Server returned `N`

**现象**：`postgres` 客户端报错 `Server returned 'N' (no SSL support)`。

**原因**：腾讯云 PG 实例**默认未开 SSL**（与 Neon 默认强制 SSL 相反）。

**解决**：

- URL 末尾加 `?sslmode=disable`
- `postgres` 客户端 `{ ssl: false }`（不能写 `'require'` 也不能不写让它默认）
- 后续走 VPC 内网就无所谓 SSL 了

---

### ⑦ `FATAL: database "aitools" does not exist`

**现象**：连得上 PG 实例，但跑任何 SQL 都说 `database "aitools" does not exist`。

**原因**：腾讯云 PG 实例创建时只默认建一个 `postgres` 系统库，**业务库需要手动建**。

**解决**：先连 `postgres` 系统库执行：

```sql
CREATE DATABASE aitools OWNER aitools_admin;
```

或在腾讯 PG 控制台「**库管理 → 新建数据库**」里点：

![PG 库管理](./images/migration-tencent/12-pg-db-management.png)

> 控制台两个库：`postgres`（系统库，永远别动）+ `aitools`（业务库）。Schema 树里的 `pg_catalog` / `information_schema` 是 PG 系统目录，业务表全在 **`public`** schema 下。

---

### ⑧ CloudBase Run 首次构建挂在 `Error: DATABASE_URL is required`

**现象**：

![Build error: DATABASE_URL is required](./images/migration-tencent/01-build-error-database-url.png)

```
Error occurred prerendering page "/role/office-worker".
Error: DATABASE_URL is required
  at neonListTagCategoriesAll
  at <unknown>
Export encountered an error on /role/[slug]/page: /role/office-worker, exiting the build.
ERROR: failed to solve: process "/bin/sh -c pnpm run build" did not complete successfully: exit code: 1
```

**原因**：

- `app/role/[slug]/page.tsx` 当时是 `export const dynamicParams = false` —— 强制 build 期把 9 个角色 slug 全部预渲染
- 但 **CloudBase Run 的 Docker 构建阶段拿不到运行时环境变量**（环境变量只在容器**运行时**注入，build 时为空）
- 渲染过程调 `neonListTagCategoriesAll()` → `getNeonSql()` → 抛 `DATABASE_URL is required`
- Vercel 上没事 — 因为 Vercel build 时**也**注入了环境变量

**解决**：让 generateStaticParams 在缺 DB 时返回 `[]`，build 期不预渲染任何角色页；运行时首次访问 SSR + 60s ISR：

```ts
// app/role/[slug]/page.tsx
export const revalidate = 60
export const dynamicParams = true   // ← 之前是 false

export async function generateStaticParams() {
  if (!process.env.DATABASE_URL) return []   // ← 关键哨兵
  return TAG_ROLE_SLUGS.map((slug) => ({ slug }))
}
```

> 与其他 4 个动态页（`tag` / `tag-category` / `category` / `tool`）的 `try/catch return []` 兜底等价，只是把 try/catch 改成显式哨兵；行为对用户透明。

---

### ⑨ 默认域名打开是 404 / 「页面访问提示」

**现象 A**（404）：CloudBase Run 部署完成，访问环境给的默认域名 `*.app.tcloudbase.com` 是 404。

**现象 B**（拦截页）：访问服务自身的直连测试域名 `*.sh.run.tcloudbase.com` 弹出腾讯云「**当前域名是测试域名，仅供开发测试，内容可能未审核**」拦截：

![CloudBase 测试域名拦截](./images/migration-tencent/08-cloudbase-test-domain-warning.png)

**原因**：

- 现象 A：CloudBase 默认域名需要手动配置「**HTTP 访问服务**」路由把 `/*` 转给容器
- 现象 B：腾讯云对**所有** `*.sh.run.tcloudbase.com` 域名都强制弹合规拦截页，绕不过 — 必须绑自己备案的域名

**解决（现象 A）**：

环境管理 → **HTTP 访问服务** → 路由管理 → 「+ 添加该域名路由」：

![HTTP 访问服务空路由](./images/migration-tencent/02-http-route-empty.png)

按这样填：

![路由配置](./images/migration-tencent/03-http-route-config.png)

| 字段 | 填什么 | 说明 |
|---|---|---|
| 访问路径 | `/` | 根路径 |
| 关联资源 | 云托管 + 你的服务名（如 `aitools-web-001`） | |
| 路径透传 | **打开** | 关掉的话 `/tool/foo` 会被剥成 `/foo`，Next 路由全 404 |
| 身份认证 | **关闭** | 公开网站 |

10–30 秒生效。

**解决（现象 B）**：

绕不过 — 等 H.5 阶段绑自己备案的域名后这个拦截页消失。在那之前**永远用环境级域名 `*.app.tcloudbase.com`**，而不是服务级 `*.sh.run.tcloudbase.com`。

---

### ⑩ `/tool/<slug>` 100% 500：`digest: 'DYNAMIC_SERVER_USAGE'`

**现象**：

![tool/runway 500](./images/migration-tencent/04-tool-page-500.png)

首页与 `/api/diag` 都正常：

![首页 OK](./images/migration-tencent/05-home-ok.png)
![/api/diag JSON 返回 ok:true](./images/migration-tencent/06-api-diag-json.png)

但 `/tool/<slug>` 必 500。CloudBase Run CLS 日志：

![DYNAMIC_SERVER_USAGE 错误日志](./images/migration-tencent/07-dynamic-server-usage.png)

```
[Error: An error occurred in the Server Components render. The specific message is omitted in production builds...]
digest: 'DYNAMIC_SERVER_USAGE'
```

**原因**：

- `app/tool/[slug]/page.tsx` 标了 ISR (`revalidate = 60` + `dynamicParams = true`)
- 但 server-side 又 `await searchParams` 读 `?admin_preview=1`
- Next 16 在首次访问未预渲染 slug 时执行 demand-static，遇到 per-request 动态 API（`searchParams` / `cookies` / `headers`）直接抛 `DYNAMIC_SERVER_USAGE`
- Vercel 部署「Ready」后**没人真访问过**这页（截图里那个 Forbidden 是 Vercel 抓爬虫的占位图），所以问题潜伏到 CloudBase Run 才暴露

**解决**：把 `admin_preview` 从 server-side 移到客户端组件读：

```tsx
// components/tool-detail-public-view.tsx ('use client')
import { useSearchParams } from 'next/navigation'

export function ToolDetailPublicView({ tool }: { tool: Tool }) {
  const sp = useSearchParams()
  const hideComments = sp?.get('admin_preview') === '1'
  // ...
}

// app/tool/[slug]/page.tsx：完全不再访问 searchParams
import { Suspense } from 'react'
// ...
<Suspense fallback={null}>
  <ToolDetailPublicView tool={tool} />
</Suspense>
```

`<Suspense>` 必须包 — 否则 Next 把整页 deopt 到 dynamic，60s ISR 失效。

---

### ⑪ `/submit` 报「Server Components render error」：`code: '23502'` view_count NOT NULL 违反

**现象**：

![/submit 报错](./images/migration-tencent/09-submit-error.png)

CloudBase CLS 日志结构化字段：

![CLS 日志列表视图](./images/migration-tencent/10-cls-log-23502.png)

terminal 视图（同一段 PG 错误的连续行）：

![CLS 日志 terminal 视图](./images/migration-tencent/11-cls-log-terminal-view.png)

```
severity: 'ERROR'
code: '23502'           ← PG 错误码：not_null_violation
schema_name: 'public'
table_name: 'tools'
column_name: 'view_count'
detail: 'Failing row contains (..., tt1, tt1-motrlydy6i1u, ...)'
```

**原因**：链条是这样的：

1. `app/actions/database-mutations.ts` 调 `neonSubmitInsertTool` 时**没传** `view_count` 字段
2. `lib/neon/data.ts` 的 INSERT 用三元表达式把 undefined 翻译成 `null`：
   ```ts
   ${v.view_count != null ? Number(v.view_count) : null}
   ```
3. **Neon 上**：`tools.view_count` 列被 Supabase 早期某次 `ALTER COLUMN DROP NOT NULL` 改成了 `nullable=YES`（schema 漂移），所以传 `NULL` 也能插
4. **腾讯 PG 上**：严格按 migration 文件 `view_count integer NOT NULL DEFAULT 0` 执行 → 23502

**解决（代码层）**：

```ts
// lib/neon/data.ts
- ${v.view_count != null ? Number(v.view_count) : null}
+ ${v.view_count != null ? Number(v.view_count) : 0}
```

简单一字之差。改成 `0` 后：

- trigger 装上时：`BEFORE INSERT` 看到 0，把 view_count 替换成 3000–5000 启动随机值
- trigger 没装时：直接插 0（合法），后续按访问递增

**解决（运维层 — schema 对账）**：

新增 `scripts/diff-schema-neon-vs-tencent.mjs`，对比表/列/trigger/function/sequence/extension：

```bash
node scripts/diff-schema-neon-vs-tencent.mjs
```

本项目对账输出：

| 维度 | 状态 |
|---|---|
| 表 | ✅ 12 表一致 |
| 列定义 | ⚠️ 14 列 nullable 漂移（**腾讯端按 migration 严格 NOT NULL 是正确的**，Neon 漂松了） |
| Trigger | ⚠️ Neon 多 2 个 `_updated_at` trigger（代码里都显式 SET 了，不影响行为） |
| Function | ⚠️ 同上 |
| Favorites | 腾讯多 `favorites_bump_tools_count`（更优 — 自动维护 favorite_count） |
| pgcrypto | 腾讯多（自动安装） |

**结论**：腾讯端 schema 是**对的**，Neon 漂移过；这次的 23502 暴露了一个沉睡多年的代码 bug，借迁移修掉了。

---

### ⑫ 后台审核通过 / 隐藏后，首页不立即更新（必须手动「生成静态」）

**现象**：管理员在 `/admin` 点「通过」/「隐藏」，前台首页 60 秒内还是旧列表，要点「生成静态」按钮才立刻刷新。

**原因**：

- `revalidatePublicAfterToolChange` 只 revalidate 了 `/tool/<具体slug>` + `/category/[slug]` 模板 + 首页 bundle
- 但**漏了** `/tool/[slug]` / `/tag/[slug]` / `/tag-category/[slug]` / `/role/[slug]` 等模板路径
- 同时 `revalidateHomeToolBundleAction` 里快照重建失败时的告警被 `NODE_ENV === 'development'` 门控，**production 完全静默**，看不到任何错误

**解决**：

```ts
// app/actions/database-mutations.ts
async function revalidatePublicAfterToolChange(toolId: string) {
  const meta = await neon.neonGetToolAdminMetaById(toolId)
  if (meta?.slug) revalidatePath(toolPublicPath(meta.slug))
  revalidatePath('/category/[slug]', 'page')
+ revalidatePath('/tool/[slug]', 'page')
+ revalidatePath('/tag-category/[slug]', 'page')
+ revalidatePath('/tag/[slug]', 'page')
+ revalidatePath('/role/[slug]', 'page')
  await revalidateHomeToolBundleAction()
}
```

```ts
// app/actions/revalidate-home-tool-bundle.ts
- if (!uploaded.ok && process.env.NODE_ENV === 'development') {
-   console.warn('[revalidateHomeToolBundle] snapshot:', uploaded.error)
- }
+ if (!uploaded.ok) {
+   console.warn('[revalidateHomeToolBundle] snapshot upload failed:', uploaded.error)
+ } else {
+   console.info('[revalidateHomeToolBundle] snapshot ok',
+     `categories=${bundle.categories.length}`, ...)
+ }
+ revalidateTag(NAVIGATION_MENU_CACHE_TAG, { expire: 0 })
```

修复后，自动 revalidate 与手动「生成静态」**完全等价**；CLS 日志里能直接看到 `[revalidateHomeToolBundle] snapshot ok` 或 `failed: ...`。

---

## 四、关键脚本与代码清单

### 4.1 数据迁移

| 脚本 | 用途 |
|---|---|
| [`scripts/migrate-neon-to-tencent.mjs`](../scripts/migrate-neon-to-tencent.mjs) | 一键迁数据：schema apply + 拓扑排序数据 INSERT + 行数对账 |
| [`scripts/diff-schema-neon-vs-tencent.mjs`](../scripts/diff-schema-neon-vs-tencent.mjs) | 迁移完成后对账：表/列/trigger/function/sequence/extension |
| [`scripts/probe-tencent-pg.mjs`](../scripts/probe-tencent-pg.mjs) | 4 种 SSL 配置穷举，定位连接问题用 |
| [`scripts/probe-tencent-raw-tcp.mjs`](../scripts/probe-tencent-raw-tcp.mjs) | raw TCP 层手发 PG SSL 请求包，看返回字节，验证防火墙是否真放行 |
| [`scripts/apply-neon-migration.mjs`](../scripts/apply-neon-migration.mjs) | 旧脚本（单方向应用迁移到 Neon） |

### 4.2 应用代码改动

| 文件 | 改动 |
|---|---|
| [`lib/neon/sql.ts`](../lib/neon/sql.ts) | 拿掉 `@neondatabase/serverless` HTTP 驱动，统一走 `postgres` TCP |
| [`lib/neon/data.ts`](../lib/neon/data.ts) | INSERT view_count 默认 `null` → `0`（修踩坑 ⑪） |
| [`lib/deploy-target.ts`](../lib/deploy-target.ts) | **新增** — 检测当前 deploy target / DB kind |
| [`middleware.ts`](../middleware.ts) | 所有响应自动加 `x-deploy-target` / `x-db-kind` 头 |
| [`app/api/diag/route.ts`](../app/api/diag/route.ts) | JSON 诊断端点强化（含 deploy / db / dual_run 信息） |
| [`app/role/[slug]/page.tsx`](../app/role/%5Bslug%5D/page.tsx) | `dynamicParams` 改 true + `generateStaticParams` 加 DB 哨兵（修踩坑 ⑧） |
| [`app/tool/[slug]/page.tsx`](../app/tool/%5Bslug%5D/page.tsx) | 拿掉 `searchParams` 访问，client 端读 admin_preview（修踩坑 ⑩） |
| [`components/tool-detail-public-view.tsx`](../components/tool-detail-public-view.tsx) | 用 `useSearchParams()` 读 admin_preview |
| [`app/actions/database-mutations.ts`](../app/actions/database-mutations.ts) | revalidatePublicAfterToolChange 补全模板路径（修踩坑 ⑫） |
| [`app/actions/revalidate-home-tool-bundle.ts`](../app/actions/revalidate-home-tool-bundle.ts) | console.warn 不再被 NODE_ENV 门控 + 补 NAVIGATION_MENU 失效 |
| [`Dockerfile`](../Dockerfile) | **新增** 多阶段 — alpine + corepack pnpm + 非 root |
| [`.dockerignore`](../.dockerignore) | **新增** |
| [`next.config.mjs`](../next.config.mjs) | 加 `output: 'standalone'` |

### 4.3 文档

| 文档 | 内容 |
|---|---|
| [`docs/migration-tencent.md`](./migration-tencent.md) | 迁移**前**计划与 12 步看板 |
| [`docs/dual-run-strategy.md`](./dual-run-strategy.md) | Vercel + CloudBase Run 双跑期策略与切流 |
| **[`docs/migration-tencent-postmortem.md`](./migration-tencent-postmortem.md)** | **本文档** — 迁移**后**事后总结 + 完整踩坑录 |
| [`docs/done.md`](./done.md) | 全项目按日期的功能/迁移完成清单 |

---

## 五、Q&A 速查（用户问过的）

### Q1. 安全组怎么选？放通全部端口可以吗？

不可以放通全部，但**迁移期**为了快速过坑可以临时全开（见踩坑 ⑤）。
长期方案：
- 入站只允许 5432（PG 端口），来源限制为 CloudBase Run 出口 IP / VPC 内网
- 出站默认全开

### Q2. 上海一区为什么不可选？

腾讯云不同地域**已售罄**或停售时该可用区会变灰。本项目用「**上海二区主**+**上海三区备**」（双机版高可用）也行，**单机版**只选一个可用区即可。

### Q3. 实例的外网地址在哪找？

**实例详情页 → 网络与安全**：

- 内网地址：形如 `10.0.0.2:5432`（VPC 内才连得上）
- 外网地址：形如 `sh-postgres-xxxxxx.sql.tencentcdb.com:24155`（**24155 这种 5 位数是腾讯随机分配的外网端口**，不是 5432！）

### Q4. 用的是哪个数据库？怎么看表？

用的是 **`aitools`**（业务库）。`postgres` 是系统库不要碰。

控制台 → 数据库管理 →顶部下拉选 `aitools` → 左边展开 **`public`** schema，下面 12 个业务表。

或用 SQL 查询窗口跑：

```sql
-- 看所有业务表 + 行数
SELECT relname AS table_name, n_live_tup AS row_count
FROM pg_stat_user_tables ORDER BY n_live_tup DESC;

-- 验证审核流是否生效（最近 5 个上线工具）
SELECT id, name, slug, status, view_count, created_at
FROM public.tools
WHERE status = 'approved' AND COALESCE(is_disabled, false) = false
ORDER BY created_at DESC LIMIT 5;

-- 看首页快照是否被自动刷新（updated_at 应该是最近一次审核通过的时间）
SELECT key, updated_at, length(value::text) AS json_size FROM public.app_kv;
```

### Q5. CLS 日志页面报「LogService Status `Normal` Not Allowed」

腾讯云控制台自身 bug — 别点「恢复」按钮，直接刷新页面，下面的日志列表正常显示。

### Q6. 是访问 `*.app.tcloudbase.com` 还是 `*.sh.run.tcloudbase.com`？

永远用 `*.app.tcloudbase.com`（环境级 / 已绑路由的）。`*.sh.run.tcloudbase.com` 是服务级测试直连，腾讯强制弹合规拦截页（见踩坑 ⑨）。

---

## 六、验收 / 安全收紧 / 长期运维

### 6.1 双跑期对比验证

```bash
# Vercel
curl -I https://your-project.vercel.app/api/diag
# 应该看到：x-deploy-target: vercel | x-db-kind: tencent

# CloudBase Run
curl -I https://aitools-d0g1a19n626a79a79-1422563795.ap-shanghai.app.tcloudbase.com/api/diag
# 应该看到：x-deploy-target: cloudbase | x-db-kind: tencent
```

两个站点的工具列表应该一样（共享同一个腾讯 PG）。

### 6.2 安全收紧（H 阶段必做）

```bash
# 1. 重置强密码
NEW_PWD=$(openssl rand -base64 24 | tr -d '/+=')
echo "$NEW_PWD"

# 2. 在腾讯 PG 控制台改密码（或 SQL）
ALTER USER aitools_admin WITH PASSWORD '<NEW_PWD>';

# 3. CloudBase Run 环境变量同步更新 DATABASE_URL
# 4. Vercel 环境变量也同步（双跑期）
# 5. 关 PG 实例的外网访问
# 6. 删除 SG 里 0.0.0.0/0 那条规则
```

### 6.3 监控

- CloudBase Run → 服务 `aitools-web` → **监控**：CPU / 内存 / QPS / P95 延迟
- 腾讯 PG → 实例 → **监控**：连接数 / 慢查询 / 锁等待
- CLS 日志关键词搜索：`ERROR` / `revalidateHomeToolBundle snapshot` / `digest:`

### 6.4 回滚预案

- **DB 回滚**：`.env.local` 里保留了 `NEON_DATABASE_URL_BACKUP`，把 `DATABASE_URL` 改回它即可。Neon 数据是迁移**起点的快照**，迁移后腾讯 PG 上新增的数据**不会**回写 Neon
- **应用回滚**：DNS 切回 Vercel；CloudBase Run 服务保留但不再被流量访问

### 6.5 schema 对账日常化

每次后台跑 `supabase/migrations/` 里的新迁移文件后，**立即**跑一次：

```bash
node scripts/diff-schema-neon-vs-tencent.mjs
```

如果出现「Neon 有但腾讯没有」的对象 — 就是这次迁移文件**只跑了 Neon 没跑腾讯**，要补跑：

```bash
DATABASE_URL=$TENCENT_DATABASE_URL node scripts/apply-neon-migration.mjs <文件名>
```

---

## 七、TL;DR — 5 行迁移 SOP

```
1. 买腾讯云 PG 实例（上海，PG 16，单机版，¥85/月起），开外网，SG 临时全开
2. .env.local 配 DATABASE_URL → Tencent，跑 node scripts/migrate-neon-to-tencent.mjs
3. CloudBase Run 控制台连 GitHub 部署，环境变量配 DATABASE_URL（外网串）
4. HTTP 访问服务加路由 / -> 你的服务，「路径透传」要开
5. 部署成功后跑 node scripts/diff-schema-neon-vs-tencent.mjs 对账，再按踩坑 ⑧⑨⑩⑪⑫ 逐项消除报错
```

迁移日：2026-05-05 ~ 2026-05-06（实施约 2 小时 + 调试 4 小时）
负责人：vic.liu
本文档完成日：2026-05-06
