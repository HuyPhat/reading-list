import { createItem } from '@/lib/actions/items'
import type { Tag } from '@/generated/prisma/client'

export function AddItemForm({ tags }: { tags: Tag[] }) {
  return (
    <form action={createItem} className="space-y-4 rounded-lg border border-gray-200 p-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Title</label>
        <input name="title" required className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Author</label>
        <input name="author" required className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">URL (optional)</label>
        <input name="url" type="url" className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Notes (optional)</label>
        <textarea name="notes" rows={2} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
      </div>
      {tags.length > 0 && (
        <div>
          <span className="block text-sm font-medium text-gray-700">Tags</span>
          <div className="mt-1 flex flex-wrap gap-3">
            {tags.map((tag) => (
              <label key={tag.id} className="flex items-center gap-1 text-sm text-gray-700">
                <input type="checkbox" name="tagIds" value={tag.id} />
                {tag.name}
              </label>
            ))}
          </div>
        </div>
      )}
      <button type="submit" className="rounded bg-gray-900 px-4 py-2 text-sm text-white">
        Add item
      </button>
    </form>
  )
}
