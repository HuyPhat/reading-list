import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

type SeedItem = {
  title: string
  author: string
  url?: string
  notes?: string
  status: 'TO_READ' | 'READING' | 'DONE'
  tags: string[]
}

const items: SeedItem[] = [
  { title: 'Deep Work', author: 'Cal Newport', status: 'DONE', tags: ['productivity', 'non-fiction'] },
  { title: 'Atomic Habits', author: 'James Clear', status: 'READING', tags: ['productivity', 'non-fiction'] },
  { title: 'The Pragmatic Programmer', author: 'David Thomas and Andrew Hunt', status: 'TO_READ', tags: ['programming', 'non-fiction'] },
  { title: 'A Philosophy of Software Design', author: 'John Ousterhout', status: 'TO_READ', tags: ['programming'] },
  { title: 'How Complex Systems Fail', author: 'Richard Cook', url: 'https://how.complexsystems.fail/', status: 'DONE', tags: ['engineering', 'longread'] },
  { title: 'The Bitter Lesson', author: 'Rich Sutton', url: 'http://www.incompleteideas.net/IncIdeas/BitterLesson.html', status: 'READING', tags: ['ai', 'longread'] },
  { title: 'Notes on Distributed Systems for Young Bloods', author: 'Jeff Hodges', url: 'https://www.somethingsimilar.com/2013/01/14/notes-on-distributed-systems-for-young-bloods/', status: 'TO_READ', tags: ['engineering', 'distributed-systems'] },
  { title: 'Sapiens', author: 'Yuval Noah Harari', status: 'DONE', notes: 'Recommended by a coworker.', tags: ['non-fiction', 'history'] },
  { title: 'You Are Not a Gadget', author: 'Jaron Lanier', status: 'TO_READ', tags: ['non-fiction', 'technology'] },
  { title: 'Falsehoods Programmers Believe About Names', author: 'Patrick McKenzie', url: 'https://www.kalzumeus.com/2010/06/17/falsehoods-programmers-believe-about-names/', status: 'TO_READ', tags: ['programming', 'longread'] },
]

async function main() {
  for (const item of items) {
    await prisma.readingItem.create({
      data: {
        title: item.title,
        author: item.author,
        url: item.url,
        notes: item.notes,
        status: item.status,
        tags: {
          connectOrCreate: item.tags.map((name) => ({
            where: { name },
            create: { name },
          })),
        },
      },
    })
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
