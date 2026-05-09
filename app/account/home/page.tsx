import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth/session'
import { getSessionProfile } from '@/lib/server-profile'
import * as neon from '@/lib/neon/data'
import { normalizePortalSections } from '@/lib/account-portal-section-defaults'
import {
  loadAccountPortalBundle,
  portalFollowToolIds,
} from '@/lib/account-portal-bundle'
import { groupToolsForPortalStrip } from '@/lib/account-portal-group-tools'
import { AccountPortalBody } from '@/components/account-portal-body'
import { AccountPortalHomeBar } from '@/components/account-portal-home-bar'

export const metadata = {
  title: '个人主页',
}

export default async function AccountHomePage() {
  const user = await getAuthUser()
  if (!user) return null

  const profile = await getSessionProfile(user.id)
  if (!profile) redirect('/account/profile')

  if (
    profile.portal_disabled_by_admin === true ||
    profile.portal_home_enabled === false
  ) {
    redirect('/account/profile')
  }

  const bundle = await loadAccountPortalBundle(user.id)
  const sections = normalizePortalSections(profile.portal_section_config)

  const followIdSet = portalFollowToolIds(bundle.followBlocks)
  const favTools = bundle.favoriteTools.filter((t) => !followIdSet.has(t.id))
  const subTools = bundle.submissionTools

  const ids = [
    ...new Set([
      ...followIdSet,
      ...favTools.map((t) => t.id),
      ...subTools.map((t) => t.id),
    ]),
  ]
  const { tagsByTool, rolesByTagId } =
    await neon.neonPortalTaxonomyMapsForTools(ids)

  const taxonomyOpts = {
    tagsByTool,
    rolesByTagId,
    scenesEnabled: bundle.scenesEnabled,
    rolesEnabled: bundle.rolesEnabled,
  }

  const favGroups = groupToolsForPortalStrip(favTools, taxonomyOpts)
  const submissionGroups = groupToolsForPortalStrip(subTools, taxonomyOpts)

  return (
    <div>
      <AccountPortalHomeBar profile={profile} email={user.email ?? ''} />
      <AccountPortalBody
        portalTheme={profile.portal_theme}
        sections={sections}
        toolCardLinkMode="portal"
        followBlocks={bundle.followBlocks}
        favGroups={favGroups}
        submissionGroups={submissionGroups}
        comments={bundle.comments}
      />
    </div>
  )
}
