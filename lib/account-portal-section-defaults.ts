import type {
  PortalSectionConfigEntry,
  PortalSectionId,
} from '@/lib/types'

const DEFAULT_SECTIONS: PortalSectionConfigEntry[] = [
  { id: 'follows', visible: true, order: 0 },
  { id: 'favorites', visible: true, order: 1 },
  { id: 'comments', visible: true, order: 2 },
  { id: 'submissions', visible: true, order: 3 },
]

export function normalizePortalSections(
  raw: PortalSectionConfigEntry[] | null | undefined,
): PortalSectionConfigEntry[] {
  const byId = new Map<PortalSectionId, PortalSectionConfigEntry>()
  const source =
    raw && raw.length > 0
      ? raw
      : DEFAULT_SECTIONS
  for (const row of source) {
    if (!row?.id) continue
    byId.set(row.id, {
      id: row.id,
      visible: row.visible !== false,
      order: Number(row.order ?? 0),
    })
  }
  for (const d of DEFAULT_SECTIONS) {
    if (!byId.has(d.id)) {
      byId.set(d.id, { ...d })
    }
  }
  return [...byId.values()].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
}
