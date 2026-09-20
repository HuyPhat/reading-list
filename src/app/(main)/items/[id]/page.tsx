import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { MarkDoneButton } from '@/components/mark-done-button'
import { STATUS_LABELS, type Status } from '@/lib/types'

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const item = await prisma.readingItem.findUnique({
    where: { id },
    include: { tags: true },
  })

  if (!item) {
    notFound()
  }

  const status = item.status as Status

  return (
    <article>
      <h1 className="text-2xl font-bold text-gray-900">{item.title}</h1>
      <p className="mt-1 text-gray-600">{item.author}</p>
      <span className="mt-3 inline-block rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">
        {STATUS_LABELS[status]}
      </span>
      {item.url && (
        <p className="mt-4">
          <a href={item.url} target="_blank" rel="noreferrer" className="text-blue-600 underline">
            {item.url}
          </a>
        </p>
      )}
      {item.notes && <p className="mt-4 whitespace-pre-wrap text-gray-700">{item.notes}</p>}
      {item.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {item.tags.map((tag) => (
            <span key={tag.id} className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">
              {tag.name}
            </span>
          ))}
        </div>
      )}
      <div className="mt-6">
        <MarkDoneButton id={item.id} status={status} />
      </div>
    </article>
  )
}
