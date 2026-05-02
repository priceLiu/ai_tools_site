/** 新通过审核的工具起始访问量：3000–5000（含边界） */
export function randomToolViewSeed(): number {
  return Math.floor(3000 + Math.random() * 2001)
}
