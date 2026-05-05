import { unstable_cache } from 'next/cache'
import * as neon from '@/lib/neon/data'
import { getAdSettings } from '@/lib/ad-settings'
import { HOME_ADS_CACHE_TAG } from '@/lib/navigation-menu-cache-config'
import type { AdPlacement, AdSettings } from '@/lib/types'

export interface HomeAdsBundle {
  settings: AdSettings
  /** Section 1 · Tab A：≤20 条 */
  section1A: AdPlacement[]
  /** Section 1 · Tab B：≤20 条 */
  section1B: AdPlacement[]
  /** Section 1 · Tab C：≤20 条 */
  section1C: AdPlacement[]
  /** Section 2 · Banner：≤9 条；3 个一屏，3 屏 */
  section2: AdPlacement[]
}

const EMPTY_BUNDLE: HomeAdsBundle = {
  settings: {
    enabled_section1: false,
    enabled_section2: false,
    section1_tab_a_label: '热门工具',
    section1_tab_b_label: '新晋推荐',
    section1_tab_c_label: '精选推荐',
    section2_rotate_seconds: 10,
    default_price_section1: 0,
    default_price_section2: 0,
  },
  section1A: [],
  section1B: [],
  section1C: [],
  section2: [],
}

async function loadHomeAdsBundle(): Promise<HomeAdsBundle> {
  try {
    const settings = await getAdSettings()
    const [section1A, section1B, section1C, section2] = await Promise.all([
      settings.enabled_section1
        ? neon.neonListActiveAds({
            placement: 'section1',
            tabKey: 'A',
            limit: 20,
          })
        : Promise.resolve<AdPlacement[]>([]),
      settings.enabled_section1
        ? neon.neonListActiveAds({
            placement: 'section1',
            tabKey: 'B',
            limit: 20,
          })
        : Promise.resolve<AdPlacement[]>([]),
      settings.enabled_section1
        ? neon.neonListActiveAds({
            placement: 'section1',
            tabKey: 'C',
            limit: 20,
          })
        : Promise.resolve<AdPlacement[]>([]),
      settings.enabled_section2
        ? neon.neonListActiveAds({
            placement: 'section2',
            limit: 9,
          })
        : Promise.resolve<AdPlacement[]>([]),
    ])
    return { settings, section1A, section1B, section1C, section2 }
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[home ads] load failed:', e)
    }
    return EMPTY_BUNDLE
  }
}

const cachedHomeAdsBundle = unstable_cache(
  loadHomeAdsBundle,
  ['home-ads-bundle:v1'],
  { tags: [HOME_ADS_CACHE_TAG], revalidate: 60 },
)

export async function getHomeAdsBundle(): Promise<HomeAdsBundle> {
  return cachedHomeAdsBundle()
}
