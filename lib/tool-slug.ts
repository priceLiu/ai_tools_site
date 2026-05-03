/** 与提交表单一致的工具 slug 规则，可选 salt 避免批量导入同毫秒碰撞 */
export function generateToolSlug(toolName: string, salt?: string): string {
  const base = toolName
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50)
  const tail = salt ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  return `${base}-${tail}`
}
