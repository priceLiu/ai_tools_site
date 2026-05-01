'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CheckCircle, XCircle, Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface AdminToolActionsProps {
  toolId: string
}

export function AdminToolActions({ toolId }: AdminToolActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [action, setAction] = useState<string | null>(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectError, setRejectError] = useState('')
  const [rejectSubmitting, setRejectSubmitting] = useState(false)

  const handleApprove = async (featured = false) => {
    setAction('approved')

    const supabase = createClient()

    const updateData: {
      status: string
      is_featured?: boolean
      updated_at: string
      rejection_reason: null
    } = {
      status: 'approved',
      updated_at: new Date().toISOString(),
      rejection_reason: null,
    }

    if (featured) {
      updateData.is_featured = true
    }

    await supabase.from('tools').update(updateData).eq('id', toolId)

    startTransition(() => {
      router.refresh()
    })

    setAction(null)
  }

  const confirmReject = async () => {
    const reason = rejectReason.trim()
    if (!reason) {
      setRejectError('请填写拒绝原因')
      return
    }
    setRejectError('')
    setRejectSubmitting(true)
    setAction('rejected')

    const supabase = createClient()
    const { error } = await supabase
      .from('tools')
      .update({
        status: 'rejected',
        rejection_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', toolId)

    setRejectSubmitting(false)
    setAction(null)

    if (error) {
      setRejectError(error.message)
      return
    }

    setRejectOpen(false)
    setRejectReason('')

    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleApprove(true)}
          disabled={isPending}
          className="gap-1 text-yellow-600 hover:text-yellow-700"
        >
          {isPending && action === 'approved' ? (
            <Spinner className="h-3 w-3" />
          ) : (
            <Star className="h-3 w-3" />
          )}
          推荐
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleApprove(false)}
          disabled={isPending}
          className="gap-1 text-green-600 hover:text-green-700"
        >
          {isPending && action === 'approved' ? (
            <Spinner className="h-3 w-3" />
          ) : (
            <CheckCircle className="h-3 w-3" />
          )}
          通过
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setRejectReason('')
            setRejectError('')
            setRejectOpen(true)
          }}
          disabled={isPending || rejectSubmitting}
          className="gap-1 text-red-600 hover:text-red-700"
        >
          {rejectSubmitting ? (
            <Spinner className="h-3 w-3" />
          ) : (
            <XCircle className="h-3 w-3" />
          )}
          拒绝
        </Button>
      </div>

      <Dialog open={rejectOpen} onOpenChange={(open) => !rejectSubmitting && setRejectOpen(open)}>
        <DialogContent showCloseButton={!rejectSubmitting}>
          <DialogHeader>
            <DialogTitle>拒绝原因</DialogTitle>
            <DialogDescription>
              提交人将能在「我的提交」中查看原因，并修改后再次提交审核。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="请说明未通过的原因（必填）"
              rows={4}
              maxLength={1000}
              disabled={rejectSubmitting}
            />
            {rejectError ? (
              <p className="text-sm text-destructive">{rejectError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {rejectReason.length}/1000
              </p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRejectOpen(false)}
              disabled={rejectSubmitting}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmReject}
              disabled={rejectSubmitting}
            >
              {rejectSubmitting && <Spinner className="mr-2 h-4 w-4" />}
              确认拒绝
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
