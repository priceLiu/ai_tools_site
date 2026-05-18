# 发布说明：SEO 构建选项、页脚文案与文档修订

**发布日期**：2026-05-11  
**适用范围**：生产镜像构建（Docker / CI）、运维环境变量、前台展示文案。

---

## 1. 变更摘要

| 类型 | 说明 |
|------|------|
| Docker 构建 | 构建阶段 **`DATABASE_URL` / `BUILD_DATABASE_URL`** ARG（见 [`Dockerfile`](../Dockerfile)）；**自动 CI** 见 [`scripts/docker-build-ci.sh`](../scripts/docker-build-ci.sh)、[`.github/workflows/docker-build.yml`](../.github/workflows/docker-build.yml)、[`docs/ci-auto-build-database-url.md`](./ci-auto-build-database-url.md)。 |
| 页脚 | 去掉「内容由 AI 生成」表述，保留站点性质与联系方式引导，见 [`components/site-footer.tsx`](../components/site-footer.tsx)。 |
| 文档 | [`docs/seo-v1.0.md`](./seo-v1.0.md) 审计备忘；[`docs/deployment-production-checklist.md`](./deployment-production-checklist.md) 构建说明。 |

**未改动的产品策略**：工具详情仍为 **服务端渲染 + ISR（60s）** + **`dynamicParams: true`**；收藏、评论、访问量等仍为客户端动态能力。

---

## 2. 发布前检查（运维）

- [ ] **`SITE_URL`**：生产为 **`https://ai-code8.com`**（或当前正式域名），无尾斜杠，`https`。**勿**写成 **`http://0.0.0.0:3000`**（监听地址不是访问地址，见 [`deployment-production-checklist.md`](./deployment-production-checklist.md) 第一节）。  
- [ ] **CDN / 反代**：回源携带 **`X-Forwarded-Proto`**；**HTTP→HTTPS 跳转在网关层完成**（应用层不再做，避免 `Host: 0.0.0.0:3000` 时跳到 `https://0.0.0.0`）。  
- [ ] **数据库迁移**：仍按 [`deployment-production-checklist.md`](./deployment-production-checklist.md) 第二节执行（若尚未执行）。

---

## 3. 镜像构建（推荐）

**自动部署 / CloudBase**：控制台「环境变量」常在 **运行时**才注入，Docker 构建阶段拿不到 → 详见 **[`docs/ci-auto-build-database-url.md`](./ci-auto-build-database-url.md)**（GitHub Actions、腾讯云流水线、`docker-build-ci.sh`）。

**手工或任意 CI**：传入只读 PostgreSQL（构建机须能访问库）：

```bash
docker build \
  --build-arg DATABASE_URL="postgresql://USER:PASS@HOST:5432/DB?sslmode=require" \
  -t your-registry/ai-tools:TAG .
```

或使用仓库脚本（依赖环境变量 **`DATABASE_URL`** 或 **`BUILD_DATABASE_URL`**）：

```bash
export DATABASE_URL="postgresql://..."
pnpm run docker:build:ci -- -t your-registry/ai-tools:TAG
```

（`pnpm run docker:build:ci -- -t ...` 会把 `-t` 传给 `scripts/docker-build-ci.sh`。）

**注意**：构建日志勿打印明文连接串；密钥仅存流水线 / Secrets。

若不传 **`DATABASE_URL` / `BUILD_DATABASE_URL`**：构建仍可完成；工具列表依赖运行时 **ISR**。

---

## 4. 发布后验证（烟雾）

- [ ] `curl -sI https://你的域名/robots.txt` → `Sitemap:` 指向同一域名下的 **`/sitemap.xml`**。  
- [ ] `curl -sI http://你的域名/` → **308/301** 到 `https://...`（若仍能从外网访问 http）。  
- [ ] 任选工具 slug：`curl -sL https://你的域名/tool/<slug>` → 响应 HTML 中含工具标题或正文片段（非空白壳）。  
- [ ] 页脚：无「内容由 AI 生成」字样，仍有联系与站点说明。  
- [ ] Search Console / 百度站长：**提交 sitemap**（若尚未提交）。

---

## 5. 回滚说明

- 页脚与文档：**仅文案与说明**，回滚对应提交即可。  
- Dockerfile：去掉 **`ARG DATABASE_URL`** 与 **`export DATABASE_URL`** 行即恢复旧构建方式（不推荐长期去掉构建期预生成能力）。
