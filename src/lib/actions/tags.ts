'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'

export type TagFormState = { error?: string }

export async function createTag(
  _prevState: TagFormState,
  formData: FormData
): Promise<TagFormState> {
  const name = String(formData.get('name') ?? '').trim()

  if (!name) {
    return { error: 'Tag name is required.' }
  }

  try {
    await prisma.tag.create({ data: { name } })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { error: `Tag "${name}" already exists.` }
    }
    throw error
  }

  revalidatePath('/tags')
  revalidatePath('/')
  return {}
}

export async function deleteTag(id: string): Promise<void> {
  await prisma.tag.delete({ where: { id } })
  revalidatePath('/tags')
  revalidatePath('/')
  revalidatePath('/(main)/items/[id]', 'page')
}
