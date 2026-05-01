/**
 * 在个人中心内进行「我的提交」检索时，应把关键词带到仍展示列表的子页面。
 */
export function getAccountSubmissionSearchHref(
  pathname: string | null,
  query: string,
): string {
  const q = encodeURIComponent(query.trim())
  if (!pathname?.startsWith('/account')) return `/account/history?q=${q}`
  if (pathname.startsWith('/account/pending')) return `/account/pending?q=${q}`
  if (pathname.startsWith('/account/history')) return `/account/history?q=${q}`
  /** 详情或个人资料页：统一到历史列表展示筛选结果（含全部状态匹配） */
  return `/account/history?q=${q}`
}
