import { prisma } from '@/lib/prisma'
import { ReadingItemCard } from '@/components/reading-item-card'

export default async function HomePage() {
  const items = await prisma.readingItem.findMany({
    include: { tags: true },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Reading List</h1>
      <div className="mt-6 space-y-4">
        {items.map((item) => (
          <ReadingItemCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  )
}
