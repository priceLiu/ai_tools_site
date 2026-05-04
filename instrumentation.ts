/**
 * Next.js instrumentation 入口。
 *
 * 这里**不能**直接引用任何 Node-only API（如 `process.emitWarning`），
 * 否则 Edge runtime 静态扫描时会报：
 *   "A Node.js API is used (process.emitWarning) which is not supported in the Edge Runtime."
 *
 * 因此 Node 端的实际逻辑放在 `./instrumentation-node`，仅在 Node runtime 下
 * 通过动态 import 加载，让 Edge 打包永远不会触达那段代码。
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  await import('./instrumentation-node')
}
