# 阶段交付说明（Done）

本文档汇总本阶段已贯通的产品能力、实现位置、数据库变更与已知注意事项，便于评审、上线与后续迭代。

---

## 1. 阶段目标概览

在现有 **Next.js + Supabase** 的 AI 工具导航站内，完成：内容审核与展示、访问统计、评论与权限、用户与管理员治理、存储与导航等核心链路的闭环；**并落实工具标签（分类名 + 介绍中的 AI 能力标签、入库、前台与管理端维护）**；相关表结构、RLS、RPC 与前端行为保持一致。

---

## 2. 需求与功能清单（已实现）

### 2.1 工具与前台的贯通

| 能力 | 说明 |
|------|------|
| 工具提交与状态 | 用户提交工具；`pending` / `approved` / `rejected`；拒绝原因 `rejection_reason` 可在「我的提交」中展示 |
| 审核与热门 | 管理后台审核通过/拒绝、热门标记；通过后种子访问量（见 2.3） |
| 工具禁用 | `tools.is_disabled`：已通过工具可被管理员禁用，前台列表与公开 API 不展示 |
| 分类与导航 | 多级分类（`categories.parent_id`）；首页侧栏 `navigation_menu_items` 可后台配置 |
| 工具介绍格式 | `introduction` + `introduction_format`（纯文本 / Markdown / HTML） |
| 收藏 | `favorites` + `tools.favorite_count` 触发器同步 |

### 2.2 访问量（真实落库）

| 能力 | 说明 |
|------|------|
| 计数规则 | 仅在**带意图的链接点击**路径上调用 `recordToolViewBySlug` → `POST /api/public/tools/[slug]/view` → RPC `increment_tool_view_count`；**仅** `approved` 且未 `is_disabled` 的工具有效 |
| 起始基数 | 新通过或历史 `view_count < 3000` 时，统一到 **3000–5000（含）** 随机整数，再加 `+1` 递增（迁移 + 审核逻辑 + 可选 backfill） |
| 首页展示 | 计数后 `revalidateTag(home-tool-bundle)`，避免首页 `unstable_cache` 长期陈旧 |
| 详情页展示 | 首屏加载后短延迟再拉一次公开工具，减少与 POST 并发的显示滞后 |

**主要代码路径**

- `lib/client-record-tool-view.ts` — 浏览器上报访问
- `app/api/public/tools/[slug]/view/route.ts` — 服务端 RPC + 缓存失效
- `lib/tool-view-seed.ts` — 随机种子
- `components/tool-card.tsx`、`components/tool-list-row-card.tsx` — 点击上报（**`ToolListRowCard` 为 Client Component**）
- `components/user-submissions-list.tsx` — 仅已通过工具有 `recordViewSlug`
- `components/admin-tool-actions.tsx` — 审核通过时若 `view_count < 3000` 写种子
- `components/admin/page.tsx` — 管理列表不传 `recordViewSlug`，避免误计公开访问

### 2.3 评论

| 能力 | 说明 |
|------|------|
| 阅读 | 所有人可读 `tool_comments` |
| 发表 | **仅登录用户**可 `INSERT`（RLS：`authenticated` + 校验内容长度与已通过工具等） |
| 前端 | 未登录仅展示列表与引导「去登录」；登录页支持 `?redirect=` 回到工具页 |

**主要代码路径**

- `components/tool-comments-section.tsx`
- `app/auth/login/page.tsx` — `safeRedirectTarget` 处理回跳
- 数据库：`20260502220000_tool_view_increment_and_comments_auth.sql` 中评论策略替换

### 2.4 用户与管理员（后台）

| 能力 | 说明 |
|------|------|
| 管理员 | `profiles.is_admin`；仅管理员可进 `/admin` |
| 用户管理 | `/admin/users`：开关管理员、账号禁用 |
| 禁用生效 | `profiles.is_disabled = true` 时，中间件查询 profile 后 `signOut` 并跳转 `/auth/account-disabled`；**当前登录账号不可在 UI 中禁用自己** |
| 数据安全 | `is_admin_user()`、`profiles` RLS、触发器禁止非管理员改 `is_admin`/`is_disabled`，并**至少保留一名管理员** |

**主要代码路径**

- `app/admin/users/page.tsx`、`app/admin/users/actions.ts`、`components/admin-users-table.tsx`
- `supabase/migrations/20260502240000_profiles_is_disabled_admin_rls.sql`
- `lib/supabase/proxy.ts`

### 2.5 其他贯通能力

- **Logo/资源上传**：`supabase/migrations/20260502200000_storage_tool_uploads.sql`（策略说明见文件内注释）
- **匿名读工具详情**：`app/api/public/tools/[slug]/route.ts` 使用 public Supabase 客户端，避免登录用户 RLS 与 anon 读不一致

### 2.6 工具标签（AI 能力提取与入库）

**产品需求（已实现）**

| 场景 | 说明 |
|------|------|
| 用户提交 / 被拒后重提 | 选择分类并填写（或上传）工具介绍后，**自动提取标签**（防抖）；展示在表单中，**用户可手动增删**；新建 `insert` 后、修改 `update` 后调用 RPC **写入 `tool_tags`** |
| 管理后台 — 全站 | 后台顶部提供 **「一键提取全部标签」**，按当前规则为库内工具批量重写标签（管理员校验） |
| 管理后台 — 单工具编辑 | 工具编辑区有标签编辑器；支持 **「根据介绍自动生成」** 一键重算；**保存工具信息时**一并 `set_tool_tags_for_tool` |

**规则约定**

| 规则 | 说明 |
|------|------|
| 分类即首标 | 工具所属 **分类名称** 作为标签列表的 **第一项**（与介绍解析结果合并、去重） |
| 仅从介绍提取能力向标签 | 基于关键词规则识别 **AI 能力维度**（如：视频、音频、动画、图像生成、对话等），非泛随意抽词 |
| 数量上限 | 最多 **6** 个标签 |
| 持久化与归一 | `tags` 表 + `tool_tags` 关联；`upsert_tag_by_display_name` / `set_tool_tags_for_tool` 尽量与已有标签名匹配（`lower(trim(name))` 唯一） |

**前台展示**

- 工具详情页 **第一块头部卡片下方** 增加横向标签区域（`ToolTagsBar`），风格与现有 UI 一致。
- 公开详情 API 的 `select` 需包含 `tool_tags` → `tags`，便于前台与比对场景使用。

**主要代码路径**

- `supabase/migrations/20260502300000_tool_capability_tags.sql` — `tags`、`tool_tags`、RLS、`upsert_tag_by_display_name`、`set_tool_tags_for_tool`
- `lib/tool-tags-extract.ts` — 介绍扫描、`AI_CAPABILITY_TAG_RULES`、`buildSuggestedToolTagNames`、`toolTagLabelsFromTool`
- `app/actions/tool-tags.ts` — `suggestToolTagNamesAction`、`setToolTagsAction`、`bulkExtractToolTagsAdminAction`
- `components/tool-tags-bar.tsx`、`components/tool-tags-editor.tsx`
- `components/submit-tool-form.tsx` — 自动建议、手动编辑、提交后写标签
- `app/submit/page.tsx` — 编辑被拒工具时拉取 `initialTagNames`
- `components/admin-approved-tool-editor.tsx`、`app/admin/tools/[id]/page.tsx` — 单工具标签与保存
- `components/admin-bulk-extract-tags-button.tsx`、`app/admin/page.tsx` — 全站一键提取入口
- `components/tool-detail-view.tsx` — 详情首屏下标签展示
- `app/api/public/tools/[slug]/route.ts` — 公开接口嵌入 `tool_tags`（若已有则保持一致）
- `app/admin/tools/import-actions.ts`（如已接入）— 导入成功后可选写入标签

**上线注意**

- 须在目标环境 **执行** `20260502300000_tool_capability_tags.sql` 后，前端写标签 RPC 才可用。
- 全量一键提取会对 **所有工具** 逐条调用写标签；数据量大时耗时与 RPC 次数与工具行数成正比，可在低峰执行。

---

## 3. 数据库迁移脚本（按文件名排序，建议执行顺序一致）

所有脚本位于 `supabase/migrations/`。

| 文件 | 摘要 |
|------|------|
| `20260501120000_tools_rejection_reason.sql` | `tools.rejection_reason`；用户重提审核相关 UPDATE 策略 |
| `20260502120000_tool_comments.sql` | `tool_comments` 表与 RLS（后续评论 INSERT 策略在下一文件中覆盖） |
| `20260502140000_tools_favorite_count.sql` | `tools.favorite_count` 与 favorites 触发器、回填 |
| `20260502153000_navigation_menu_items.sql` | 侧栏菜单表与 RLS（依赖已有 `profiles.is_admin`） |
| `20260502161500_categories_parent.sql` | 分类父子关系 `parent_id` |
| `20260502180000_tools_is_disabled.sql` | `tools.is_disabled` 及索引 |
| `20260502190000_tools_introduction_format.sql` | 工具介绍格式字段 |
| `20260502200000_storage_tool_uploads.sql` | Storage bucket `tool-uploads` 与策略说明 |
| `20260502220000_tool_view_increment_and_comments_auth.sql` | `increment_tool_view_count`；评论仅 `authenticated` 可写；`view_count` 为 0 的已通过工具随机 3000–5000 |
| `20260502223000_tools_view_count_baseline_under_3000.sql` | 已通过且 `view_count < 3000` → 随机 3000–5000 |
| `20260502240000_profiles_is_disabled_admin_rls.sql` | `profiles.is_disabled`；`is_admin_user()`；`profiles` RLS；触发器；`profiles_insert_own` |
| `20260502300000_tool_capability_tags.sql` | `tags`、`tool_tags`；标签 upsert / 按工具批量设标；RLS；供内容标记与检索比对 |

> **上线注意**：本地/远程 Supabase 须按序执行或合并执行；若项目里原本已有 `profiles` / `tools` 的自定义 RLS，可能与本次 `DROP POLICY … / CREATE POLICY` 重名或语义叠加，需在 Dashboard 核对后合并。

---

## 4. 环境与依赖

- **必选**：`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **上传**：按 `20260502200000_storage_tool_uploads.sql` 说明，服务端上传若使用 service role，需配置 `SUPABASE_SERVICE_ROLE_KEY`（本阶段用户管理列表**未强制**依赖 service role，仅用登录管理员 + RLS 读 `profiles`）

---

## 5. 已知问题与约定（后续可优化）

1. **访问量与「直接打开 URL」**  
   当前设计为在**列表/卡片等链接触发**处上报；用户**仅粘贴** `/tool/[slug]` 打开可能不会 `+1`（若需「打开详情即计」，需另增规则并防刷）。

2. **首页缓存与性能**  
   每次有效访问会 `revalidateTag(HOME_TOOL_BUNDLE_CACHE_TAG)`，访问量极大时可能增加重建首页 bundle 的频率；可按需改为更长 revalidate 或异步队列。

3. **中间件与禁用用户**  
   已登录用户每次请求会多一次 `profiles.is_disabled` 查询；若需减负可改为短期 cookie 或仅对部分路径校验。

4. **历史数据库**  
   若 `profiles` 创建方式非「客户端 `id = auth.uid()` 插入」且无 SECURITY DEFINER 的 `handle_new_user`，需确认注册链路在启用 `profiles` RLS 后仍能插入首行 profile。

5. **RSC 与事件**  
   含 `onClick` 等交互的组件须为 Client Component（已修复：`tool-list-row-card.tsx` 顶部 `'use client'`），避免「Event handlers cannot be passed to Client Component props」类错误。

6. **中间件与 「Error: fetch failed」**（`context.fetch` / `@supabase/auth-js`）  
   开发或部署时在终端看到该栈，通常表示 **Edge 中间件**（`lib/supabase/proxy.ts` → `supabase.auth.getUser()`）访问 **Supabase Auth**（`NEXT_PUBLIC_SUPABASE_URL`）的 HTTPS 请求失败或极慢（断网、代理/VPN、DNS、云端项目暂停、URL/Key 错误等）。页面仍可能返回 200，但 `proxy.ts` 耗时会拉高。  
   **排查**：在终端对项目根执行 `curl -sS -o /dev/null -w "%{http_code}" "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/health"`（需已 export 相同 env）应得到 `200`；检查 Supabase 控制台项目是否活跃、`.env.local` 是否与 Dashboard 一致。  
   **代码侧**：`is_disabled` 的二次查询已包在 try/catch 中，避免数据库短时失败导致未捕获异常；Auth 的 `getUser` 仍依赖网络，问题本质多为环境与连通性。

---

## 6. 阶段结论

本阶段已将 **工具生命周期、前台展示、访问统计、评论权限、管理员与用户禁用、菜单与分类、收藏与介绍格式、存储策略、工具标签（分类 + 介绍能力提取、后台批量与单条维护、详情展示）** 等与代码及迁移脚本对齐，并形成可追溯的迁移列表与风险说明。后续迭代建议在 `done.md` 同目录增加版本号或日期分卷，或迁入 `docs/` 并链到 README。
