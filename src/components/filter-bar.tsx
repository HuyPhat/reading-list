'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ReadingItemCard } from '@/components/reading-item-card'
import { STATUSES, STATUS_LABELS, type ReadingItemWithTags, type Status } from '@/lib/types'
import type { Tag } from '@/generated/prisma/client'

async function fetchFilteredItems(
  search: string,
  status: string,
  tagIds: string[]
): Promise<ReadingItemWithTags[]> {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (status) params.set('status', status)
  tagIds.forEach((id) => params.append('tag', id))

  const res = await fetch(`/api/items?${params.toString()}`)
  if (!res.ok) throw new Error('Failed to fetch items')
  return res.json()
}

export function FilterBar({
  initialItems,
  allTags,
}: {
  initialItems: ReadingItemWithTags[]
  allTags: Tag[]
}) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [tagIds, setTagIds] = useState<string[]>([])

  const hasFilters = search !== '' || status !== '' || tagIds.length > 0

  const { data, isLoading, isError } = useQuery({
    queryKey: ['items', search, status, tagIds],
    queryFn: () => fetchFilteredItems(search, status, tagIds),
    enabled: hasFilters,
  })

  function toggleTag(id: string) {
    setTagIds((current) => (current.includes(id) ? current.filter((t) => t !== id) : [...current, id]))
  }

  const displayedItems = hasFilters ? data ?? [] : initialItems

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title or author…"
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s as Status]}
            </option>
          ))}
        </select>
      </div>
      {allTags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-3">
          {allTags.map((tag) => (
            <label key={tag.id} className="flex items-center gap-1 text-sm text-gray-700">
              <input type="checkbox" checked={tagIds.includes(tag.id)} onChange={() => toggleTag(tag.id)} />
              {tag.name}
            </label>
          ))}
        </div>
      )}
      {hasFilters && isLoading && <p className="mt-4 text-sm text-gray-500">Loading…</p>}
      {hasFilters && isError && (
        <p className="mt-4 text-sm text-red-600">Couldn&apos;t load results. Try again.</p>
      )}
      <div className="mt-6 space-y-4">
        {displayedItems.map((item) => (
          <ReadingItemCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  )
}
