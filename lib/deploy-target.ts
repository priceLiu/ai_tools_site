/**
 * 双跑期间的部署/数据库识别工具。
 *
 * 设计目标：
 * - **零侵入**：每个调用都是 cheap pure function，可在 Edge Middleware / Server Action / Route Handler 任意位置使用。
 * - **可观测**：通过 `x-deploy-target` 响应头 + `/api/diag` 输出，方便从浏览器 DevTools 一眼判断当前流量被哪个部署、哪个 DB 服务到。
 * - **零依赖**：不引入 dotenv、新 npm 包；仅读取 `process.env`。
 *
 * 双跑（dual-run）期间，写动作可能从两个部署同时打到同一个 Tencent PG。
 * 由于只有一个数据真源（Tencent），不需要在应用层做合并/去重，PG 自身的事务/约束兜底即可。
 *
 * 详见 `docs/dual-run-strategy.md`。
 */

export type DeployTarget = 'vercel' | 'cloudbase' | 'local' | 'unknown'

export type DatabaseKind = 'neon' | 'tencent' | 'unknown'

/** 识别当前进程跑在哪个平台。优先级：显式 env > 平台特征 env > 兜底 'local'。 */
export function getDeployTarget(): DeployTarget {
  const explicit = (process.env.DEPLOY_TARGET || '').toLowerCase().trim()
  if (
    explicit === 'vercel' ||
    explicit === 'cloudbase' ||
    explicit === 'local'
  ) {
    return explicit as DeployTarget
  }
  /** Vercel 始终设置 VERCEL=1 / VERCEL_ENV */
  if (process.env.VERCEL === '1' || process.env.VERCEL_ENV) return 'vercel'
  /** CloudBase Run 容器里通常有 TCB_ENV / CLOUDBASE_ENV / TENCENTCLOUD_RUNENV */
  if (
    process.env.TENCENTCLOUD_RUNENV === 'SCF' ||
    process.env.CLOUDBASE_ENV ||
    process.env.TCB_ENV
  ) {
    return 'cloudbase'
  }
  /** 本机开发：NODE_ENV=development 且无云平台标记 */
  if (process.env.NODE_ENV === 'development') return 'local'
  return 'unknown'
}

/** 由 DATABASE_URL 的 host 反查 DB 提供商。 */
export function getDatabaseKind(databaseUrl?: string): DatabaseKind {
  const u = (databaseUrl ?? process.env.DATABASE_URL ?? '').trim()
  if (!u) return 'unknown'
  try {
    const host = new URL(u).host.toLowerCase()
    if (host.endsWith('.neon.tech')) return 'neon'
    if (
      host.endsWith('.tencentcdb.com') ||
      host.endsWith('.sql.tencentcdb.com') ||
      /^10\.\d+\.\d+\.\d+/.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+/.test(host) ||
      /^192\.168\.\d+\.\d+/.test(host)
    ) {
      return 'tencent'
    }
  } catch {
    /** 不规范 URL */
  }
  return 'unknown'
}

/** DB 是否通过 VPC 内网串连接（10.x / 172.16-31.x / 192.168.x）。 */
export function isDatabaseViaVpc(databaseUrl?: string): boolean {
  const u = (databaseUrl ?? process.env.DATABASE_URL ?? '').trim()
  if (!u) return false
  try {
    const host = new URL(u).host
    return (
      /^10\.\d+\.\d+\.\d+/.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+/.test(host) ||
      /^192\.168\.\d+\.\d+/.test(host)
    )
  } catch {
    return false
  }
}

/** Edge Middleware 用：把识别结果写到响应头。 */
export function deployTargetHeaders(): Record<string, string> {
  const t = getDeployTarget()
  const k = getDatabaseKind()
  const v = isDatabaseViaVpc()
  return {
    'x-deploy-target': t,
    'x-db-kind': k,
    'x-db-via-vpc': v ? '1' : '0',
  }
}
