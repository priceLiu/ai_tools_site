/** URL slug for `tag_categories`：小写拉丁 + 数字 + 中日韩；冲突时调用方追加后缀 */
export function slugifyTagCategoryName(raw: string): string {
  const s = raw
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return s.length > 0 ? s : 'scene'

}
