import type { Category, HomeListedTool } from '@/lib/types'

export type HomeCategoryBlock = {
  root: Category
  sections: { category: Category; tools: HomeListedTool[] }[]
}

export type HomeToolBundle = {
  categories: Category[]
  featured: HomeListedTool[]
  latest: HomeListedTool[]
  homeCategoryBlocks: HomeCategoryBlock[]
}
