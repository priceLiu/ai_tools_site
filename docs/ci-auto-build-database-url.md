# 自动部署场景下：构建期注入 `DATABASE_URL`（SEO 预渲染）

## 背景

Next.js 在 **`pnpm run build`**（Dockerfile 的 `RUN pnpm run build`）阶段会执行各路由的 **`generateStaticParams`**。  
若能连接 PostgreSQL，可在镜像构建时预生成大量 `/tool/[slug]` 等页面。

**腾讯云 CloudBase 云托管**里，控制台配置的「环境变量」多数只注入到 **运行中的容器**，**构建镜像时 Dockerfile 的 RUN 默认拿不到**（与 [`migration-tencent-postmortem.md`](./migration-tencent-postmortem.md) 踩坑 ⑧ 一致）。  
因此：**仅靠控制台点「部署」、不写流水线**，通常仍是「构建期无 DB → 预渲染跳过 → 运行时 ISR」，站点仍可对爬虫输出 HTML，但没有构建期整批静态页。

要在 **全自动流水线里**完成「代码提交 → 镜像构建（带 DB）→ 部署」，需要下面三种之一。

---

## 方案 A：GitHub Actions 构建镜像（本仓库已提供）

1. 仓库 **Settings → Secrets and variables → Actions** 新增密钥其一：
   - **`DATABASE_URL`**（推荐：与生产库只读账号或同一实例，构建机须能访问 PG），或  
   - **`BUILD_DATABASE_URL`**（仅构建用命名，Dockerfile 两处 ARG 会合并使用）。
2. 推送 **`main` / `master`** 会触发 [`.github/workflows/docker-build.yml`](../.github/workflows/docker-build.yml)：若配置了上述 Secret，则执行  
   **`./scripts/docker-build-ci.sh`**（内部带 `--build-arg DATABASE_URL=...`）。
3. 当前 workflow **只验证构建成功**，不把镜像推到腾讯云。你可自行追加步骤：
   - `docker login` 腾讯云容器镜像服务 / GHCR  
   - `docker push`  
   - 再在 CloudBase 选择 **镜像拉取** 部署该 tag。

**本地 / 任意 CI** 等价命令：

```bash
export DATABASE_URL='postgresql://...'
./scripts/docker-build-ci.sh -t your-registry/ai-tools:TAG
```

日志掩码：流水线请对含连接串的输出关闭明文打印。

---

## 方案 B：腾讯云侧流水线（CODING DevOps / 云原生构建 等）

在 **执行 `docker build` 的步骤**里显式传入（变量来自流水线密钥库，勿写入仓库）：

```bash
docker build \
  --build-arg DATABASE_URL="$DATABASE_URL" \
  -t your-registry/ai-tools:$CI_COMMIT_SHORT_SHA \
  .
```

若希望密钥名与运行时区分，可传 **`BUILD_DATABASE_URL`**：

```bash
docker build --build-arg BUILD_DATABASE_URL="$BUILD_DATABASE_URL" ...
```

Dockerfile 已支持 **`DATABASE_URL` 优先，否则 `BUILD_DATABASE_URL`**。

---

## 方案 C：CloudBase 控制台若支持「Docker 构建参数」

部分容器平台在版本高级配置中提供 **Build Args / 构建参数**。若腾讯云后续在云托管版本配置里提供 **与 Dockerfile ARG 同名**的项，可将 **`DATABASE_URL`** 绑定控制台密钥（勿粘贴进 Git）。  
**以控制台当前实际选项为准**；若无此项，请用方案 A 或 B。

---

## 方案 D：接受构建期不连库（无需改运维）

不传任何 build-arg 时：

- **`pnpm run build` 仍可完成**（各页 `generateStaticParams` 已做空库兜底）。
- 工具详情依赖 **运行时 ISR**，爬虫仍可拿到服务端渲染 HTML，只是缺少「构建瞬间预生成几百页」的预热。

---

## 相关文件

| 文件 | 说明 |
|------|------|
| [`Dockerfile`](../Dockerfile) | `ARG DATABASE_URL` / `ARG BUILD_DATABASE_URL`，合并后 `export DATABASE_URL` 再 `pnpm run build` |
| [`scripts/docker-build-ci.sh`](../scripts/docker-build-ci.sh) | CI 封装 `docker build --build-arg` |
| [`.github/workflows/docker-build.yml`](../.github/workflows/docker-build.yml) | push 自动构建；有 Secret 则带 DB |
