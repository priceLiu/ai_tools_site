# 多阶段 Dockerfile：用于腾讯云 CloudBase Run / 任意支持 Docker 的 Node serverless 平台
# 依赖：next.config.mjs 必须含 `output: 'standalone'`
#
# 本地构建测试：
#   docker build -t ai-tools:local .
#   docker run --rm -p 3000:3000 \
#     -e DATABASE_URL="postgresql://..." \
#     -e AUTH_SECRET="$(openssl rand -base64 32)" \
#     ai-tools:local
#
# SEO / 静态预生成（可选）：
#   - CloudBase Run 控制台里配的「环境变量」多在容器运行时生效，Dockerfile 的 RUN pnpm build 往往拿不到 →
#     见 docs/ci-auto-build-database-url.md（GitHub Actions / 自建 CI / 镜像拉取三种做法）。
#   - 任意能执行 docker build 的流水线：传入可读库的 DATABASE_URL（或 BUILD_DATABASE_URL）即可预渲染。
#   示例：
#     docker build --build-arg DATABASE_URL="postgresql://..." -t ai-tools:local .
#     ./scripts/docker-build-ci.sh -t ai-tools:local

# ---------- Stage 1: deps ----------
FROM node:22-alpine AS deps
# 固定 pnpm 版本，避免 Node 镜像自带 corepack 解析到其它 11.x 行为不一致
RUN corepack enable && corepack prepare pnpm@11.0.8 --activate
WORKDIR /app
# `.npmrc` 放行依赖构建脚本；`pnpm-workspace.yaml` 为显式 allowBuilds 双保险
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
# argon2 是 native 模块，alpine 上要装 build deps
RUN apk add --no-cache python3 make g++ \
 && pnpm install --frozen-lockfile \
 && apk del python3 make g++ || true

# ---------- Stage 2: build ----------
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@11.0.8 --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# 构建期连库：DATABASE_URL 为主；BUILD_DATABASE_URL 为备用 ARG（流水线密钥可与运行时区分命名）。
ARG DATABASE_URL=
ARG BUILD_DATABASE_URL=
RUN MERGED_DB="${DATABASE_URL:-${BUILD_DATABASE_URL}}" \
 && export DATABASE_URL="$MERGED_DB" \
 && if [ -z "$DATABASE_URL" ]; then \
      echo "[docker build] 未注入 DATABASE_URL/BUILD_DATABASE_URL → 构建期不连库预渲染（CloudBase 默认常如此）；见 docs/ci-auto-build-database-url.md"; \
    else \
      echo "[docker build] 已注入 DATABASE_URL，执行 next build（含 generateStaticParams）"; \
    fi \
 && pnpm run build

# ---------- Stage 3: runtime ----------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# 非 root 用户运行
RUN addgroup -S app && adduser -S -G app app
USER app

# Next.js standalone 输出
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
