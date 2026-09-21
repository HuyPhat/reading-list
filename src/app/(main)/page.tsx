import { prisma } from '@/lib/prisma'
import { AddItemForm } from '@/components/add-item-form'
import { FilterBar } from '@/components/filter-bar'

export const dynamic = 'force-dynamic'

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
      <div className="mt-6">
        <FilterBar initialItems={items} allTags={tags} />
      </div>
    </div>
  )
}
