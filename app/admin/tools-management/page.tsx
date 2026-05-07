import { redirect } from 'next/navigation'

/** 侧栏「工具管理」直达 `/admin/stats`；保留本路径以便旧链接跳转。 */
export default function AdminToolsManagementRedirectPage() {
  redirect('/admin/stats')
}
