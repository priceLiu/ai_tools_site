/**
 * 仅纯函数与类型，可被 Client Components 安全导入（勿从此文件引入 Neon/SQL）。
 * 「AI 方案集」公开发布申请前置条件计数口径与 `submitShowcaseApplicationAction` 一致。
 */

export type ShowcasePublishEligibilityCounts = {
  followToolCount: number
  favoriteCount: number
  submissionCount: number
}

export function isShowcasePublishEligible(
  e: ShowcasePublishEligibilityCounts,
): boolean {
  return (
    e.followToolCount > 0 &&
    e.favoriteCount > 0 &&
    e.submissionCount > 0
  )
}
