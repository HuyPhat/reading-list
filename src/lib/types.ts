import type { ReadingItem, Tag } from '@/generated/prisma/client'

export type Status = 'TO_READ' | 'READING' | 'DONE'

export const STATUSES: Status[] = ['TO_READ', 'READING', 'DONE']

export const STATUS_LABELS: Record<Status, string> = {
  TO_READ: 'To Read',
  READING: 'Reading',
  DONE: 'Done',
}

export type ReadingItemWithTags = ReadingItem & { tags: Tag[] }
