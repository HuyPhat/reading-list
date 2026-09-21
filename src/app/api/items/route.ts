import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const search = searchParams.get('search') ?? ''
  const status = searchParams.get('status')
  const tagIds = searchParams.getAll('tag')

  const items = await prisma.readingItem.findMany({
    where: {
      OR: search ? [{ title: { contains: search } }, { author: { contains: search } }] : undefined,
      status: status || undefined,
      tags: tagIds.length ? { some: { id: { in: tagIds } } } : undefined,
    },
    include: { tags: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(items)
}
