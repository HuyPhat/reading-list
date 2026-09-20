import { prisma } from '@/lib/prisma'
import { CreateTagForm } from '@/components/create-tag-form'
import { TagDeleteButton } from '@/components/tag-delete-button'

export default async function TagsPage() {
  const tags = await prisma.tag.findMany({
    include: { _count: { select: { items: true } } },
    orderBy: { name: 'asc' },
  })

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Tags</h1>
      <div className="mt-6">
        <CreateTagForm />
      </div>
      <ul className="mt-6 divide-y divide-gray-200">
        {tags.map((tag) => (
          <li key={tag.id} className="flex items-center justify-between py-3">
            <span className="text-gray-900">
              {tag.name}{' '}
              <span className="text-sm text-gray-500">
                ({tag._count.items} item{tag._count.items === 1 ? '' : 's'})
              </span>
            </span>
            <TagDeleteButton id={tag.id} name={tag.name} itemCount={tag._count.items} />
          </li>
        ))}
      </ul>
    </div>
  )
}
