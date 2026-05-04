/** 与「介绍前 50 字」规则一致，用于名称 + 分类 + 介绍片段三重判重 */
export const TOOL_DEDUP_INTRO_PREVIEW_LENGTH = 50

/** 与写入 tools.name 时保持一致，便于按 name 等值缩小查询范围 */
export function toolNameDedupKey(name: string): string {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ')
}

export function toolIntroductionPreviewDedup(
  introduction: string | null | undefined,
): string {
  return (introduction ?? '').trim().slice(0, TOOL_DEDUP_INTRO_PREVIEW_LENGTH)
}

export const TOOL_DEDUP_REJECT_MESSAGE =
  '已存在相同工具（名称、介绍前50字、分类三者均一致），无法重复添加。'
