/** 在用户自己的工具列表中按名称 / 工具介绍做不区分大小写子串匹配 */
export function filterOwnTools<T extends { name: string; description: string }>(
  tools: T[],
  raw: string | undefined,
): T[] {
  const q = raw?.trim().toLowerCase()
  if (!q) return tools
  return tools.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q),
  )
}
