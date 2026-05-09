import { getAuthUser } from '@/lib/auth/session'
import { AccountProfileForm } from '@/components/account-profile-form'
import { AccountChangePasswordCard } from '@/components/account-change-password-card'
import { AccountAvatarEditor } from '@/components/account-avatar-editor'
import { AccountPortalPreferenceCard } from '@/components/account-portal-preference-card'
import { AccountShowcasePublishCard } from '@/components/account-showcase-publish-section'
import type { Profile } from '@/lib/types'
import { getSessionProfile } from '@/lib/server-profile'
import {
  computeShowcasePublishEligibility,
  loadAccountPortalBundle,
} from '@/lib/account-portal-bundle'
import { neonFindAuthCredentialsByUserId } from '@/lib/auth/credentials-db'

export const metadata = {
  title: '个人信息 - 个人中心',
}

export default async function AccountProfilePage() {
  const user = await getAuthUser()
  if (!user) return null

  const profile = await getSessionProfile(user.id)

  const p = profile as Profile | null

  const credRow = await neonFindAuthCredentialsByUserId(user.id)
  const hasLocalPassword = credRow != null

  let showcaseEligibility = {
    followToolCount: 0,
    favoriteCount: 0,
    submissionCount: 0,
  }
  if (p && p.showcase_status !== 'approved') {
    const bundle = await loadAccountPortalBundle(user.id)
    showcaseEligibility = computeShowcasePublishEligibility(bundle)
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">个人信息</h1>
        <p className="mt-1 text-muted-foreground">管理在当前站点展示的账号信息</p>
      </div>

      {p ? <AccountPortalPreferenceCard profile={p} /> : null}

      {p ? (
        <AccountShowcasePublishCard profile={p} eligibility={showcaseEligibility} />
      ) : null}

      <AccountAvatarEditor profile={p} />

      <AccountProfileForm profile={p} email={user.email ?? null} />

      {hasLocalPassword ? (
        <AccountChangePasswordCard />
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">
          当前账号未绑定本地登录密码（例如历史迁入账号），无法在站内自助修改密码；如需登录请使用管理员重置密码。
        </p>
      )}
    </div>
  )
}
