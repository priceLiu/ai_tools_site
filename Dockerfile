# 多阶段 Dockerfile：用于腾讯云 CloudBase Run / 任意支持 Docker 的 Node serverless 平台
# 依赖：next.config.mjs 必须含 `output: 'standalone'`
#
# 本地构建测试：
#   docker build -t ai-tools:local .
#   docker run --rm -p 3000:3000 \
#     -e DATABASE_URL="postgresql://..." \
#     -e AUTH_SECRET="$(openssl rand -base64 32)" \
#     ai-tools:local

# ---------- Stage 1: deps ----------
FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
# argon2 是 native 模块，alpine 上要装 build deps
RUN apk add --no-cache python3 make g++ \
 && pnpm install --frozen-lockfile \
 && apk del python3 make g++ || true

# ---------- Stage 2: build ----------
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN pnpm run build

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
