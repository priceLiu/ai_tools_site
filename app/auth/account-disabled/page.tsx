import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ShieldOff } from 'lucide-react'

export const metadata = {
  title: '账号已禁用 - AI工具集',
}

export default function AccountDisabledPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-background p-6 md:p-10">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <ShieldOff className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-xl">账号已被禁用</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center text-sm text-muted-foreground">
            <p>
              该账号已被管理员禁用，无法继续使用个人中心、提交工具等功能。若需申诉，请联系站点管理员。
            </p>
            <Button asChild className="w-full">
              <Link href="/">返回首页</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
