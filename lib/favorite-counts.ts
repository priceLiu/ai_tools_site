import type { SupabaseClient } from '@supabase/supabase-js'

/** Count favorites per tool_id in one query (for list UIs). */
export async function getFavoriteCountsByToolIds(
  supabase: SupabaseClient,
  toolIds: string[],
): Promise<Record<string, number>> {
  if (toolIds.length === 0) return {}
  const { data, error } = await supabase
    .from('favorites')
    .select('tool_id')
    .in('tool_id', toolIds)

  if (error || !data) return {}

  const map: Record<string, number> = {}
  for (const row of data) {
    const id = row.tool_id as string
    map[id] = (map[id] || 0) + 1
  }
  return map
}
