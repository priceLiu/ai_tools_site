import { redirect } from 'next/navigation'

interface MySubmissionsPageProps {
  searchParams: Promise<{ success?: string; resubmitted?: string }>
}

export const metadata = {
  title: '我的提交 - AI工具集',
}

/** Prefer /account/history — this route keeps old links working */
export default async function MySubmissionsPage({
  searchParams,
}: MySubmissionsPageProps) {
  const params = await searchParams
  const qs = new URLSearchParams()
  if (params.success === 'true') qs.set('success', 'true')
  if (params.resubmitted === 'true') qs.set('resubmitted', 'true')
  const q = qs.toString()
  redirect(q ? `/account/history?${q}` : '/account/history')
}
