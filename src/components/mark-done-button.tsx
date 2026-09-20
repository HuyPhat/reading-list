'use client'

import { useTransition } from 'react'
import { markAsDone } from '@/lib/actions/items'
import type { Status } from '@/lib/types'

export function MarkDoneButton({ id, status }: { id: string; status: Status }) {
  const [isPending, startTransition] = useTransition()

  if (status === 'DONE') {
    return <span className="text-sm font-medium text-green-700">Done</span>
  }

  return (
    <button
      disabled={isPending}
      onClick={() => startTransition(() => markAsDone(id))}
      className="rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
    >
      {isPending ? 'Marking…' : 'Mark as done'}
    </button>
  )
}
