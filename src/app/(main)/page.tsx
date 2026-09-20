import { prisma } from '@/lib/prisma'
import { ReadingItemCard } from '@/components/reading-item-card'
import { AddItemForm } from '@/components/add-item-form'

export default async function HomePage() {
  const [items, tags] = await Promise.all([
    prisma.readingItem.findMany({
      include: { tags: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.tag.findMany({ orderBy: { name: 'asc' } }),
  ])

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Reading List</h1>
      <div className="mt-6">
        <AddItemForm tags={tags} />
      </div>
      <div className="mt-6 space-y-4">
        {items.map((item) => (
          <ReadingItemCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  )
}
