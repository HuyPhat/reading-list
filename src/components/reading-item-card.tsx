import Link from 'next/link'
import { STATUS_LABELS, type ReadingItemWithTags, type Status } from '@/lib/types'

const STATUS_STYLES: Record<Status, string> = {
  TO_READ: 'bg-gray-100 text-gray-700',
  READING: 'bg-amber-100 text-amber-800',
  DONE: 'bg-green-100 text-green-800',
}

export function ReadingItemCard({ item }: { item: ReadingItemWithTags }) {
  const status = item.status as Status

  return (
    <Link
      href={`/items/${item.id}`}
      className="block rounded-lg border border-gray-200 p-4 hover:border-gray-300 hover:bg-gray-50"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-gray-900">{item.title}</h2>
          <p className="text-sm text-gray-600">{item.author}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}>
          {STATUS_LABELS[status]}
        </span>
      </div>
      {item.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.tags.map((tag) => (
            <span key={tag.id} className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">
              {tag.name}
            </span>
          ))}
        </div>
      )}
    </Link>
  )
}
