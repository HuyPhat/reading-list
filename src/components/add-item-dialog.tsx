'use client'

import { useState } from 'react'
import { Dialog } from '@/components/dialog'
import { AddItemForm } from '@/components/add-item-form'
import type { Tag } from '@/generated/prisma/client'

export function AddItemDialog({ tags }: { tags: Tag[] }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Add reading item"
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-gray-900 text-2xl text-white shadow-lg hover:bg-gray-800"
      >
        +
      </button>
      <Dialog open={isOpen} onClose={() => setIsOpen(false)} title="Add reading item">
        <AddItemForm tags={tags} onSuccess={() => setIsOpen(false)} />
      </Dialog>
    </>
  )
}
