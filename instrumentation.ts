/**
 * Next.js instrumentation hook：在 Node runtime 启动时静默 `TimeoutNegativeWarning`。
 *
 * 这条 Node 警告由「计算 setTimeout 时，目标时刻早已过去 → 负数 → 被 clamp 到 1ms」触发，
 * 我们项目里实际看到的来源是：
 *   1. `postgres` (porsager) 驱动内部对 idle/keep-alive timer 的算术；
 *   2. Next.js `unstable_cache` 在条目过期太久后调度 revalidate 时的算术；
 * 二者均不影响功能，但 Turbopack dev 会把 stderr 警告原样回放到客户端 console，
 * 导致页面"红色错误提示"看起来像应用 bug，每次刷新都跳。这里只过滤掉这一类，
 * 其它 warning 维持默认行为。
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const originalEmit = process.emitWarning.bind(process) as typeof process.emitWarning

  function isTimeoutNegativeWarning(
    warning: string | Error,
    nameOrOptions?: string | { type?: string },
  ): boolean {
    if (warning instanceof Error && warning.name === 'TimeoutNegativeWarning') {
      return true
    }
    if (typeof warning === 'string') {
      const optsName =
        typeof nameOrOptions === 'string'
          ? nameOrOptions
          : nameOrOptions?.type
      if (optsName === 'TimeoutNegativeWarning') return true
      if (warning.includes('TimeoutNegativeWarning')) return true
    }
    return false
  }

  // 用宽松类型签名覆盖原 API 重载，避免逐一适配。
  ;(process as unknown as { emitWarning: (...a: unknown[]) => void }).emitWarning = (
    ...args: unknown[]
  ) => {
    const [warning, second] = args as [string | Error, unknown?]
    if (isTimeoutNegativeWarning(warning, second as never)) return
    return (originalEmit as (...a: unknown[]) => void)(...args)
  }
}
