'use client'

import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close()
      }}
      className="m-auto w-full max-w-sm rounded-lg border-0 p-0 shadow-lg backdrop:bg-black/40"
    >
      <div className="relative p-6">
        <button
          onClick={() => ref.current?.close()}
          aria-label="Close dialog"
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
        >
          ×
        </button>
        {title && <h2 className="pr-6 text-lg font-semibold text-gray-900">{title}</h2>}
        <div className={title ? 'mt-4' : ''}>{children}</div>
      </div>
    </dialog>
  )
}
