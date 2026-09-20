'use client'

import { useActionState } from 'react'
import { createTag, type TagFormState } from '@/lib/actions/tags'

const initialState: TagFormState = {}

export function CreateTagForm() {
  const [state, formAction, isPending] = useActionState(createTag, initialState)

  return (
    <form action={formAction} className="flex items-start gap-2">
      <div className="flex-1">
        <input
          name="name"
          placeholder="New tag name"
          required
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
        {state.error && <p className="mt-1 text-sm text-red-600">{state.error}</p>}
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {isPending ? 'Adding…' : 'Add tag'}
      </button>
    </form>
  )
}
