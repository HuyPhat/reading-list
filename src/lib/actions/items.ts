'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'

export async function createItem(formData: FormData): Promise<void> {
  const title = String(formData.get('title') ?? '').trim()
  const author = String(formData.get('author') ?? '').trim()
  const url = String(formData.get('url') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim()
  const tagIds = formData.getAll('tagIds').map(String)

  if (!title || !author) {
    throw new Error('Title and author are required.')
  }

  await prisma.readingItem.create({
    data: {
      title,
      author,
      url: url || null,
      notes: notes || null,
      tags: { connect: tagIds.map((id) => ({ id })) },
    },
  })

  revalidatePath('/')
}

export async function markAsDone(id: string): Promise<void> {
  await prisma.readingItem.update({
    where: { id },
    data: { status: 'DONE' },
  })
  revalidatePath(`/items/${id}`)
  revalidatePath('/')
}
