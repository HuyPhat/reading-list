'use client'

import { useState, useTransition } from 'react'
import { deleteTag } from '@/lib/actions/tags'
import { Dialog } from '@/components/dialog'

export function TagDeleteButton({
  id,
  name,
  itemCount,
}: {
  id: string
  name: string
  itemCount: number
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="text-sm text-red-600 hover:underline">
        Delete
      </button>
      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <p className="text-gray-900">
          Are you sure you want to delete the tag &quot;{name}&quot;? It
          will be removed from {itemCount} item{itemCount === 1 ? '' : 's'}.
          This cannot be undone.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => setIsOpen(false)}
            className="rounded border border-gray-300 px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await deleteTag(id)
                setIsOpen(false)
              })
            }
            className="rounded bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Delete Tag
          </button>
        </div>
      </Dialog>
    </>
  )
}
