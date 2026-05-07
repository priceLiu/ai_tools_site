import 'server-only'

import { unstable_cache } from 'next/cache'
import * as neon from '@/lib/neon/data'
import { TAG_SUGGEST_DICTIONARY_CACHE_TAG } from '@/lib/navigation-menu-cache-config'

/**
 * 全库标签匹配用字典；读多写少，随管理员改标签失效。
 */
async function loadTagsSuggestDictionaryUncached() {
  return neon.neonListTagsSuggestDictionary()
}

export const getCachedTagsSuggestDictionary = unstable_cache(
  loadTagsSuggestDictionaryUncached,
  ['tags-suggest-dictionary-v1'],
  {
    tags: [TAG_SUGGEST_DICTIONARY_CACHE_TAG],
    revalidate: 600,
  },
)
