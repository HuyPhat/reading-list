# Reading List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Reading List app end to end — Prisma/SQLite data layer, server-rendered list and detail pages, Server Action mutations, a relational tag system with its own management screen, a TanStack-Query-backed search/filter bar hitting a Route Handler, and the loading/error/not-found file conventions — as a guided exercise in Next.js App Router patterns.

**Architecture:** Server Components own all read paths (list, detail, tags) by querying Prisma directly. Four Server Actions (`createItem`, `markAsDone`, `createTag`, `deleteTag`) handle all writes and call `revalidatePath` so the framework re-renders the affected route in the same round trip. One Route Handler (`GET /api/items`) exists solely to give a Client Component (`FilterBar`) something to `fetch` via TanStack Query, since Server Actions aren't fetchable the way `useQuery` needs. Client Components are used only where interactivity strictly requires them: mark-done's pending state, the tag-delete confirmation modal, the create-tag form's inline error, and the filter bar's input/query state.

**Tech Stack:** Next.js 16.3.5 (App Router, Turbopack), React 19.2.8, TypeScript, Tailwind CSS v4, Prisma 7.10.0 + `@prisma/adapter-better-sqlite3` (SQLite), TanStack Query 5.103.1, ESLint.

**Spec:** [docs/superpowers/specs/2026-09-20-reading-list-design.md](../specs/2026-09-20-reading-list-design.md) — read this alongside the plan; it has the full rationale for every product/schema decision made during brainstorming.

## Global Constraints

- Pin exact versions everywhere below — do **not** install with `@latest`. As of this plan, `prisma`'s npm `latest` tag resolves to an unstable `8.0.0-rc.15` while `@prisma/client`'s `latest` is the stable `7.10.0`; installing both with `@latest` installs mismatched majors and breaks the client. Use `prisma@7.10.0`, `@prisma/client@7.10.0`, `@prisma/adapter-better-sqlite3@7.10.0`, `dotenv@18.0.1`, `tsx@4.23.15`, `@tanstack/react-query@5.103.1`.
- **Prisma 7's `PrismaClient` requires an explicit driver adapter — there is no zero-argument constructor.** `new PrismaClient()` throws `PrismaClientInitializationError` at runtime. Every instantiation must pass `{ adapter: new PrismaBetterSqlite3({ url: ... }) }`. This was verified empirically against the real installed package (Task 1's steps below), not assumed from prior Prisma versions.
- Prisma 7's default generator is `provider = "prisma-client"` (not the older `prisma-client-js`), which emits plain `.ts` source into an `output` directory rather than an installable package under `node_modules/@prisma/client`. `@prisma/client` is still a required runtime dependency (it supplies `@prisma/client/runtime/client`, which the generated code imports), but the `PrismaClient` class and model types are imported from the generated output, not from `@prisma/client` directly.
- Datasource configuration lives in `prisma.config.ts` (via `defineConfig`), not inline in `schema.prisma`. `schema.prisma`'s `datasource` block has no `url` line. `prisma.config.ts` loads `.env` itself via `import 'dotenv/config'` — this only affects Prisma CLI/seed execution; Next.js loads `.env` for the app itself independently, so application code never needs that import.
- Seed command configuration lives in `prisma.config.ts`'s `migrations.seed` field, not `package.json`'s `"prisma"` key (that mechanism is gone in Prisma 7).
- `status` on `ReadingItem` is a `String`, not a Prisma `enum` — the SQLite connector doesn't support native enums. Use the `Status` union type and `STATUSES`/`STATUS_LABELS` from `src/lib/types.ts` everywhere a status is read, written, or displayed.
- Tags are a relational many-to-many (`Tag[]` on both models, Prisma's implicit join table) — never a comma-separated string field.
- No uniqueness constraint on `ReadingItem` beyond its primary key, and no duplicate-detection logic in `createItem`. No indexes beyond what `@id`/`@unique` create automatically.
- Every mutating Server Action calls `revalidatePath` for every route its change affects; none call `router.refresh()` (redundant — Server Actions invoked from the tree already trigger a same-response re-render of the calling route). A `revalidatePath` call that uses the `'page'`/`'layout'` type argument for a route nested inside the `(main)` route group must include the group segment in the path, e.g. `revalidatePath('/(main)/items/[id]', 'page')` — verified against the Next.js 16 docs: pattern-based revalidation matches route *file structure*, which includes route groups, while literal-path revalidation (no type argument) matches the resolved URL, which does not.
- `error.tsx` files use the `retry` prop (stable since Next.js 16.3, confirmed in the bundled docs), not `reset` — `retry()` re-fetches and re-renders the segment, which is what "try again" should do here; `reset()` only clears error state without re-fetching.
- No automated test framework is introduced (per the spec). Verification per task is manual: `npx tsc --noEmit` for type correctness, `sqlite3`/`curl` for data and read-path checks, and the Claude Browser tool (or your own browser at `http://localhost:3000`) for anything that requires submitting a form or clicking a button tied to a Server Action.
- Run all commands from the project root: `/Users/hle/nextjs/reading-list`.

---

### Task 1: Prisma schema, client, and shared types

**Files:**
- Create: `prisma/schema.prisma`
- Create: `prisma.config.ts`
- Create: `.env`
- Create: `src/lib/prisma.ts`
- Create: `src/lib/types.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `prisma` (default `PrismaClient` instance, `src/lib/prisma.ts`) — every later task's data access goes through this.
- Produces: `Status` (`'TO_READ' | 'READING' | 'DONE'`), `STATUSES: Status[]`, `STATUS_LABELS: Record<Status, string>`, `ReadingItemWithTags` (`ReadingItem & { tags: Tag[] }`) — all from `src/lib/types.ts`.

- [ ] **Step 1: Install dependencies**

```bash
npm install @prisma/client@7.10.0 @prisma/adapter-better-sqlite3@7.10.0
npm install --save-dev prisma@7.10.0 dotenv@18.0.1
```

- [ ] **Step 2: Create `.env`**

```
DATABASE_URL="file:./prisma/dev.db"
```

- [ ] **Step 3: Write `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "sqlite"
}

model ReadingItem {
  id        String   @id @default(cuid())
  title     String
  author    String
  url       String?
  notes     String?
  status    String   @default("TO_READ")
  tags      Tag[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Tag {
  id    String        @id @default(cuid())
  name  String        @unique
  items ReadingItem[]
}
```

- [ ] **Step 4: Write `prisma.config.ts`**

```ts
import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
})
```

- [ ] **Step 5: Run the initial migration, then generate the client**

```bash
npx prisma migrate dev --name init
npx prisma generate
```

Expected: `migrate dev` creates `prisma/migrations/<timestamp>_init/migration.sql` and `prisma/dev.db`. Verified empirically that `migrate dev` does **not** reliably auto-generate the client with this generator — run `prisma generate` explicitly as a separate step; it prints `✔ Generated Prisma Client (7.10.0) to ./src/generated/prisma`.

- [ ] **Step 6: Update `.gitignore`**

Add these lines at the end of `.gitignore`:

```
# prisma
/prisma/dev.db*
/src/generated/
```

- [ ] **Step 7: Write `src/lib/prisma.ts`**

```ts
import { PrismaClient } from '@/generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createPrismaClient() {
  const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

- [ ] **Step 8: Write `src/lib/types.ts`**

```ts
import type { ReadingItem, Tag } from '@/generated/prisma/client'

export type Status = 'TO_READ' | 'READING' | 'DONE'

export const STATUSES: Status[] = ['TO_READ', 'READING', 'DONE']

export const STATUS_LABELS: Record<Status, string> = {
  TO_READ: 'To Read',
  READING: 'Reading',
  DONE: 'Done',
}

export type ReadingItemWithTags = ReadingItem & { tags: Tag[] }
```

- [ ] **Step 9: Verify**

```bash
npx tsc --noEmit
sqlite3 prisma/dev.db ".tables"
```

Expected: `tsc` reports no errors. `.tables` lists `ReadingItem`, `Tag`, `_prisma_migrations`, and an implicit join table (something like `_ReadingItemToTag`).

- [ ] **Step 10: Commit**

```bash
git add prisma prisma.config.ts .gitignore src/lib/prisma.ts src/lib/types.ts package.json package-lock.json
git commit -m "Add Prisma schema, client, and shared types"
```

(`.env` is gitignored by create-next-app's default `.gitignore` already — don't force-add it.)

---

### Task 2: Seed script and sample data

**Files:**
- Modify: `prisma.config.ts`
- Create: `prisma/seed.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/prisma` — actually seed.ts constructs its own client directly (see below), since `src/lib/prisma.ts` relies on `process.env.NODE_ENV` dev-singleton behavior meant for the Next.js runtime; the seed script is a standalone CLI invocation and doesn't need that caching.

- [ ] **Step 1: Install tsx**

```bash
npm install --save-dev tsx@4.23.15
```

- [ ] **Step 2: Add the seed command to `prisma.config.ts`**

Modify the `migrations` block:

```ts
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
```

- [ ] **Step 3: Write `prisma/seed.ts`**

```ts
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
```

- [ ] **Step 4: Run the seed**

```bash
npx prisma db seed
```

Expected: `🌱 The seed command has been executed.`

- [ ] **Step 5: Verify**

```bash
sqlite3 prisma/dev.db "SELECT count(*) FROM ReadingItem;"
sqlite3 prisma/dev.db "SELECT count(*) FROM Tag;"
sqlite3 prisma/dev.db "SELECT status, count(*) FROM ReadingItem GROUP BY status;"
```

Expected: 10 items, 9 tags, and a status breakdown of `DONE|3`, `READING|2`, `TO_READ|5`.

- [ ] **Step 6: Commit**

```bash
git add prisma.config.ts prisma/seed.ts package.json package-lock.json
git commit -m "Add seed script with sample reading list data"
```

---

### Task 3: `(main)` route group shell — nav, about page

**Files:**
- Delete: `src/app/page.tsx`
- Create: `src/app/(main)/layout.tsx`
- Create: `src/app/(main)/about/page.tsx`

**Interfaces:**
- Produces: the `(main)` layout renders `{children}` for every route nested under it (`/`, `/tags`, `/about`, `/items/[id]`), so later tasks creating pages under `src/app/(main)/` inherit this nav automatically.

- [ ] **Step 1: Delete the default homepage**

```bash
rm src/app/page.tsx
```

(This is expected to make `/` 404 temporarily — Task 4 replaces it under the route group. `/about` is what this task verifies.)

- [ ] **Step 2: Write `src/app/(main)/layout.tsx`**

```tsx
import Link from 'next/link'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6">
      <nav className="flex gap-6 border-b border-gray-200 py-4">
        <Link href="/" className="font-semibold text-gray-900">
          Reading List
        </Link>
        <Link href="/tags" className="text-gray-600 hover:text-gray-900">
          Tags
        </Link>
        <Link href="/about" className="text-gray-600 hover:text-gray-900">
          About
        </Link>
      </nav>
      <main className="flex-1 py-8">{children}</main>
    </div>
  )
}
```

- [ ] **Step 3: Write `src/app/(main)/about/page.tsx`**

```tsx
export default function AboutPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">About</h1>
      <p className="mt-4 text-gray-600">
        Reading List is a personal app for tracking articles and books you
        want to read. It was built as a learning project to practice the
        Next.js App Router: Server Components, Client Components, Server
        Actions, Route Handlers, and the loading/error/not-found file
        conventions.
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Verify**

```bash
npm run dev &
sleep 3
curl -s http://localhost:3000/about | grep -o "Reading List is a personal app"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
kill %1
```

Expected: the `grep` prints a match; `/` returns `404` (expected — fixed in Task 4).

- [ ] **Step 5: Commit**

```bash
git add -A src/app
git commit -m "Add (main) route group shell with nav and about page"
```

---

### Task 4: List page — Server Component reading seeded items

**Files:**
- Create: `src/components/reading-item-card.tsx`
- Create: `src/app/(main)/page.tsx`

**Interfaces:**
- Consumes: `prisma` (`@/lib/prisma`), `ReadingItemWithTags`, `STATUS_LABELS`, `Status` (`@/lib/types`).
- Produces: `ReadingItemCard({ item: ReadingItemWithTags })` — reused by Task 8's `FilterBar`.

- [ ] **Step 1: Write `src/components/reading-item-card.tsx`**

```tsx
import Link from 'next/link'
import { STATUS_LABELS, type ReadingItemWithTags, type Status } from '@/lib/types'

const STATUS_STYLES: Record<Status, string> = {
  TO_READ: 'bg-gray-100 text-gray-700',
  READING: 'bg-amber-100 text-amber-800',
  DONE: 'bg-green-100 text-green-800',
}

export function ReadingItemCard({ item }: { item: ReadingItemWithTags }) {
  const status = item.status as Status

  return (
    <Link
      href={`/items/${item.id}`}
      className="block rounded-lg border border-gray-200 p-4 hover:border-gray-300 hover:bg-gray-50"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-gray-900">{item.title}</h2>
          <p className="text-sm text-gray-600">{item.author}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}>
          {STATUS_LABELS[status]}
        </span>
      </div>
      {item.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.tags.map((tag) => (
            <span key={tag.id} className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">
              {tag.name}
            </span>
          ))}
        </div>
      )}
    </Link>
  )
}
```

- [ ] **Step 2: Write `src/app/(main)/page.tsx`**

```tsx
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
```

- [ ] **Step 3: Verify**

```bash
npm run dev &
sleep 3
curl -s http://localhost:3000/ | grep -o "Atomic Habits"
curl -s http://localhost:3000/ | grep -o "Sapiens"
kill %1
```

Expected: both greps match (confirms the Server Component is really reading from Prisma, not showing stale/placeholder content).

- [ ] **Step 4: Commit**

```bash
git add src/components/reading-item-card.tsx src/app/\(main\)/page.tsx
git commit -m "Add list page rendering seeded reading items"
```

---

### Task 5: Tag management — actions, `/tags` page, create/delete UI

**Files:**
- Create: `src/lib/actions/tags.ts`
- Create: `src/components/create-tag-form.tsx`
- Create: `src/components/tag-delete-button.tsx`
- Create: `src/app/(main)/tags/page.tsx`

**Interfaces:**
- Produces: `createTag(prevState: TagFormState, formData: FormData): Promise<TagFormState>` where `TagFormState = { error?: string }`; `deleteTag(id: string): Promise<void>`. Task 6's `AddItemForm` will read `Tag[]` from Prisma directly (not from this file), so there's no cross-task type dependency beyond `TagFormState` being local to this task's own Client Component.

- [ ] **Step 1: Write `src/lib/actions/tags.ts`**

```ts
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
```

- [ ] **Step 2: Write `src/components/create-tag-form.tsx`**

```tsx
'use client'

import { useActionState } from 'react'
import { createTag, type TagFormState } from '@/lib/actions/tags'

const initialState: TagFormState = {}

export function CreateTagForm() {
  const [state, formAction, isPending] = useActionState(createTag, initialState)

  return (
    <form action={formAction} className="flex items-start gap-2">
      <div className="flex-1">
        <input
          name="name"
          placeholder="New tag name"
          required
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
        {state.error && <p className="mt-1 text-sm text-red-600">{state.error}</p>}
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {isPending ? 'Adding…' : 'Add tag'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Write `src/components/tag-delete-button.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { deleteTag } from '@/lib/actions/tags'

export function TagDeleteButton({
  id,
  name,
  itemCount,
}: {
  id: string
  name: string
  itemCount: number
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="text-sm text-red-600 hover:underline">
        Delete
      </button>
      {isOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
            <p className="text-gray-900">
              Are you sure you want to delete the tag &quot;{name}&quot;? It
              will be removed from {itemCount} item{itemCount === 1 ? '' : 's'}.
              This cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setIsOpen(false)}
                className="rounded border border-gray-300 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await deleteTag(id)
                    setIsOpen(false)
                  })
                }
                className="rounded bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                Delete Tag
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 4: Write `src/app/(main)/tags/page.tsx`**

```tsx
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
```

- [ ] **Step 5: Verify reads with curl**

```bash
npm run dev &
sleep 3
curl -s http://localhost:3000/tags | grep -o "programming"
curl -s http://localhost:3000/tags | grep -o "9 items\|1 item" # at least one tag's count renders
```

- [ ] **Step 6: Verify mutations with the browser**

Using the Claude Browser tool (or your own browser) with the dev server running at `http://localhost:3000/tags`:
1. Type `test-tag` into the "New tag name" field and click "Add tag". Confirm `test-tag (0 items)` appears in the list.
2. Type `test-tag` again and click "Add tag" again. Confirm the inline error `Tag "test-tag" already exists.` appears and no duplicate row is added.
3. Click "Delete" next to `test-tag`. Confirm the modal shows: `Are you sure you want to delete the tag "test-tag"? It will be removed from 0 items. This cannot be undone.` with "Cancel" and "Delete Tag" buttons.
4. Click "Delete Tag". Confirm the modal closes and `test-tag` is gone from the list.

- [ ] **Step 7: Commit**

```bash
git add src/lib/actions/tags.ts src/components/create-tag-form.tsx src/components/tag-delete-button.tsx src/app/\(main\)/tags
git commit -m "Add tag management: create/delete actions and /tags page"
```

---

### Task 6: Add-item — `createItem` action and form

**Files:**
- Create: `src/lib/actions/items.ts`
- Create: `src/components/add-item-form.tsx`
- Modify: `src/app/(main)/page.tsx`

**Interfaces:**
- Produces: `createItem(formData: FormData): Promise<void>` (`@/lib/actions/items`) — Task 7 appends `markAsDone` to this same file.
- Produces: `AddItemForm({ tags: Tag[] })` (`@/components/add-item-form`), where `Tag` is Prisma's generated model type from `@/generated/prisma/client`.

- [ ] **Step 1: Write `src/lib/actions/items.ts`**

```ts
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
```

- [ ] **Step 2: Write `src/components/add-item-form.tsx`**

```tsx
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
```

- [ ] **Step 3: Modify `src/app/(main)/page.tsx`** to fetch tags and render the form

```tsx
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
```

- [ ] **Step 4: Verify with the browser**

With the dev server running, navigate to `/`:
1. Fill in Title: `Test Book`, Author: `Test Author`, check one tag checkbox (e.g. `programming`).
2. Click "Add item".
3. Confirm the page now shows a `Test Book` card with the `Test Author` byline and the `programming` tag, without a full browser navigation (the URL stays `/`).
4. Confirm the total item count in the list is now 11.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/items.ts src/components/add-item-form.tsx src/app/\(main\)/page.tsx
git commit -m "Add createItem Server Action and add-item form"
```

---

### Task 7: Detail page — dynamic route, not-found, mark-done

**Files:**
- Modify: `src/lib/actions/items.ts` (append `markAsDone`)
- Create: `src/components/mark-done-button.tsx`
- Create: `src/app/(main)/items/[id]/page.tsx`
- Create: `src/app/(main)/items/[id]/not-found.tsx`

**Interfaces:**
- Produces: `markAsDone(id: string): Promise<void>` appended to `@/lib/actions/items`.
- Produces: `MarkDoneButton({ id: string; status: Status })` (`@/components/mark-done-button`).

- [ ] **Step 1: Append `markAsDone` to `src/lib/actions/items.ts`**

Add this function after `createItem`:

```ts
export async function markAsDone(id: string): Promise<void> {
  await prisma.readingItem.update({
    where: { id },
    data: { status: 'DONE' },
  })
  revalidatePath(`/items/${id}`)
  revalidatePath('/')
}
```

- [ ] **Step 2: Write `src/components/mark-done-button.tsx`**

```tsx
'use client'

import { useTransition } from 'react'
import { markAsDone } from '@/lib/actions/items'
import type { Status } from '@/lib/types'

export function MarkDoneButton({ id, status }: { id: string; status: Status }) {
  const [isPending, startTransition] = useTransition()

  if (status === 'DONE') {
    return <span className="text-sm font-medium text-green-700">Done</span>
  }

  return (
    <button
      disabled={isPending}
      onClick={() => startTransition(() => markAsDone(id))}
      className="rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
    >
      {isPending ? 'Marking…' : 'Mark as done'}
    </button>
  )
}
```

- [ ] **Step 3: Write `src/app/(main)/items/[id]/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { MarkDoneButton } from '@/components/mark-done-button'
import { STATUS_LABELS, type Status } from '@/lib/types'

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const item = await prisma.readingItem.findUnique({
    where: { id },
    include: { tags: true },
  })

  if (!item) {
    notFound()
  }

  const status = item.status as Status

  return (
    <article>
      <h1 className="text-2xl font-bold text-gray-900">{item.title}</h1>
      <p className="mt-1 text-gray-600">{item.author}</p>
      <span className="mt-3 inline-block rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">
        {STATUS_LABELS[status]}
      </span>
      {item.url && (
        <p className="mt-4">
          <a href={item.url} target="_blank" rel="noreferrer" className="text-blue-600 underline">
            {item.url}
          </a>
        </p>
      )}
      {item.notes && <p className="mt-4 whitespace-pre-wrap text-gray-700">{item.notes}</p>}
      {item.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {item.tags.map((tag) => (
            <span key={tag.id} className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">
              {tag.name}
            </span>
          ))}
        </div>
      )}
      <div className="mt-6">
        <MarkDoneButton id={item.id} status={status} />
      </div>
    </article>
  )
}
```

- [ ] **Step 4: Write `src/app/(main)/items/[id]/not-found.tsx`**

```tsx
import Link from 'next/link'

export default function ItemNotFound() {
  return (
    <div className="text-center">
      <h1 className="text-xl font-bold text-gray-900">Item not found</h1>
      <p className="mt-2 text-gray-600">This reading list item doesn&apos;t exist.</p>
      <Link href="/" className="mt-4 inline-block text-blue-600 underline">
        Back to list
      </Link>
    </div>
  )
}
```

- [ ] **Step 5: Verify reads and not-found with curl**

```bash
npm run dev &
sleep 3
ID=$(sqlite3 prisma/dev.db "SELECT id FROM ReadingItem WHERE title = 'Atomic Habits';")
curl -s http://localhost:3000/items/$ID | grep -o "Atomic Habits"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/items/does-not-exist
curl -s http://localhost:3000/items/does-not-exist | grep -o "Item not found"
kill %1
```

Expected: title grep matches; the invalid id returns `404` and the "Item not found" grep matches.

- [ ] **Step 6: Verify mark-as-done with the browser**

Navigate to the detail page for a `TO_READ` item (e.g. `A Philosophy of Software Design`). Click "Mark as done". Confirm the button is replaced by a `Done` label without a full page reload, and that navigating back to `/` shows this item with the `Done` badge.

- [ ] **Step 7: Commit**

```bash
git add src/lib/actions/items.ts src/components/mark-done-button.tsx src/app/\(main\)/items
git commit -m "Add item detail page with mark-as-done action"
```

---

### Task 8: Search/filter — TanStack Query provider, Route Handler, filter bar

**Files:**
- Create: `src/components/query-provider.tsx`
- Modify: `src/app/layout.tsx`
- Create: `src/app/api/items/route.ts`
- Create: `src/components/filter-bar.tsx`
- Modify: `src/app/(main)/page.tsx`

**Interfaces:**
- Produces: `QueryProvider({ children: ReactNode })` wrapping the whole app.
- Produces: `GET /api/items` returning `ReadingItemWithTags[]` as JSON, accepting `?search=`, `?status=`, and repeated `?tag=<id>` query params.
- Produces: `FilterBar({ initialItems: ReadingItemWithTags[]; allTags: Tag[] })` — replaces the plain item-list rendering in `page.tsx`.

- [ ] **Step 1: Install TanStack Query**

```bash
npm install @tanstack/react-query@5.103.1
```

- [ ] **Step 2: Write `src/components/query-provider.tsx`**

```tsx
'use client'

import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

let browserQueryClient: QueryClient | undefined

function getQueryClient() {
  if (typeof window === 'undefined') return new QueryClient()
  browserQueryClient ??= new QueryClient()
  return browserQueryClient
}

export function QueryProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>
}
```

This is the pattern from Next.js's own bundled TanStack Query guide (`node_modules/next/dist/docs/01-app/02-guides/client-side-data-fetching/tanstack-query.md`): a fresh `QueryClient` per server render (so requests never leak state between users), but one reused client in the browser (so client-side navigations don't lose the cache).

- [ ] **Step 3: Modify `src/app/layout.tsx`** to wrap `children` in the provider

Add the import:
```tsx
import { QueryProvider } from "@/components/query-provider";
```

Change:
```tsx
      <body className="min-h-full flex flex-col">{children}</body>
```
to:
```tsx
      <body className="min-h-full flex flex-col">
        <QueryProvider>{children}</QueryProvider>
      </body>
```

- [ ] **Step 4: Write `src/app/api/items/route.ts`**

```ts
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
```

- [ ] **Step 5: Write `src/components/filter-bar.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ReadingItemCard } from '@/components/reading-item-card'
import { STATUSES, STATUS_LABELS, type ReadingItemWithTags, type Status } from '@/lib/types'
import type { Tag } from '@/generated/prisma/client'

async function fetchFilteredItems(
  search: string,
  status: string,
  tagIds: string[]
): Promise<ReadingItemWithTags[]> {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (status) params.set('status', status)
  tagIds.forEach((id) => params.append('tag', id))

  const res = await fetch(`/api/items?${params.toString()}`)
  if (!res.ok) throw new Error('Failed to fetch items')
  return res.json()
}

export function FilterBar({
  initialItems,
  allTags,
}: {
  initialItems: ReadingItemWithTags[]
  allTags: Tag[]
}) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [tagIds, setTagIds] = useState<string[]>([])

  const hasFilters = search !== '' || status !== '' || tagIds.length > 0

  const { data, isLoading, isError } = useQuery({
    queryKey: ['items', search, status, tagIds],
    queryFn: () => fetchFilteredItems(search, status, tagIds),
    enabled: hasFilters,
  })

  function toggleTag(id: string) {
    setTagIds((current) => (current.includes(id) ? current.filter((t) => t !== id) : [...current, id]))
  }

  const displayedItems = hasFilters ? data ?? [] : initialItems

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title or author…"
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s as Status]}
            </option>
          ))}
        </select>
      </div>
      {allTags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-3">
          {allTags.map((tag) => (
            <label key={tag.id} className="flex items-center gap-1 text-sm text-gray-700">
              <input type="checkbox" checked={tagIds.includes(tag.id)} onChange={() => toggleTag(tag.id)} />
              {tag.name}
            </label>
          ))}
        </div>
      )}
      {hasFilters && isLoading && <p className="mt-4 text-sm text-gray-500">Loading…</p>}
      {hasFilters && isError && (
        <p className="mt-4 text-sm text-red-600">Couldn&apos;t load results. Try again.</p>
      )}
      <div className="mt-6 space-y-4">
        {displayedItems.map((item) => (
          <ReadingItemCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Modify `src/app/(main)/page.tsx`** to use `FilterBar` instead of a plain list

```tsx
import { prisma } from '@/lib/prisma'
import { AddItemForm } from '@/components/add-item-form'
import { FilterBar } from '@/components/filter-bar'

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
```

- [ ] **Step 7: Verify the Route Handler with curl**

```bash
npm run dev &
sleep 3
curl -s "http://localhost:3000/api/items?status=DONE" | grep -o "\"status\":\"DONE\"" | wc -l
curl -s "http://localhost:3000/api/items?search=atomic" | grep -o "Atomic Habits"
kill %1
```

Expected: the status count is `3` (matches the seeded DONE count), and the search grep matches.

- [ ] **Step 8: Verify the filter bar with the browser**

Navigate to `/`. Type `atomic` into the search box. Confirm the list narrows to just "Atomic Habits" without a full page navigation. Clear the search box and select the "Done" status instead; confirm exactly the DONE items show. Check a tag checkbox and confirm the list narrows further to items with that tag.

- [ ] **Step 9: Commit**

```bash
git add src/components/query-provider.tsx src/app/layout.tsx src/app/api src/components/filter-bar.tsx src/app/\(main\)/page.tsx package.json package-lock.json
git commit -m "Add search/filter bar via TanStack Query and Route Handler"
```

---

### Task 9: Loading and error boundaries

**Files:**
- Create: `src/app/(main)/loading.tsx`
- Create: `src/app/(main)/error.tsx`
- Create: `src/app/(main)/items/[id]/loading.tsx`
- Create: `src/app/(main)/items/[id]/error.tsx`

- [ ] **Step 1: Write `src/app/(main)/loading.tsx`**

```tsx
export default function Loading() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-lg border border-gray-200 p-4">
          <div className="h-4 w-1/3 rounded bg-gray-200" />
          <div className="mt-2 h-3 w-1/4 rounded bg-gray-200" />
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Write `src/app/(main)/error.tsx`**

```tsx
'use client'

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <div className="text-center">
      <h1 className="text-xl font-bold text-gray-900">Something went wrong</h1>
      <p className="mt-2 text-gray-600">{error.message}</p>
      <button onClick={() => retry()} className="mt-4 rounded bg-gray-900 px-4 py-2 text-sm text-white">
        Try again
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Write `src/app/(main)/items/[id]/loading.tsx`**

```tsx
export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-6 w-2/3 rounded bg-gray-200" />
      <div className="mt-2 h-4 w-1/3 rounded bg-gray-200" />
      <div className="mt-6 h-20 w-full rounded bg-gray-200" />
    </div>
  )
}
```

- [ ] **Step 4: Write `src/app/(main)/items/[id]/error.tsx`**

```tsx
'use client'

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <div className="text-center">
      <h1 className="text-xl font-bold text-gray-900">Something went wrong</h1>
      <p className="mt-2 text-gray-600">{error.message}</p>
      <button onClick={() => retry()} className="mt-4 rounded bg-gray-900 px-4 py-2 text-sm text-white">
        Try again
      </button>
    </div>
  )
}
```

- [ ] **Step 5: Verify the list page's error boundary**

Temporarily add `throw new Error('test error boundary')` as the first line inside `HomePage` in `src/app/(main)/page.tsx`. With the dev server running, load `/` in the browser and confirm the "Something went wrong" UI renders with the message `test error boundary` and a working "Try again" button. Remove the temporary `throw` line afterward and confirm `/` loads normally again.

- [ ] **Step 6: Verify the list page's loading skeleton**

Temporarily add `await new Promise((r) => setTimeout(r, 2000))` as the first line inside `HomePage`. Reload `/` in the browser and confirm the 5-card skeleton renders for about 2 seconds before the real list appears. Remove the temporary delay afterward.

(Local SQLite queries normally resolve in low single-digit milliseconds, so without this artificial delay the skeleton is real but not humanly visible — that's expected, not a bug.)

- [ ] **Step 7: Repeat steps 5–6 for the detail page**

Same technique (temporary `throw` / temporary `setTimeout` delay, then revert) inside `ItemDetailPage` in `src/app/(main)/items/[id]/page.tsx`, verifying its own `error.tsx` and `loading.tsx`.

- [ ] **Step 8: Commit**

```bash
git add src/app/\(main\)/loading.tsx src/app/\(main\)/error.tsx src/app/\(main\)/items/\[id\]/loading.tsx src/app/\(main\)/items/\[id\]/error.tsx
git commit -m "Add loading skeletons and error boundaries for list and detail routes"
```

---

### Task 10: README — App Router concepts exercised

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add a Prisma setup step to Getting Started**

In `README.md`, change:

```markdown
First, run the development server:

```bash
npm run dev
```

to:

```markdown
First, set up the database and seed it with sample data:

```bash
npx prisma migrate dev
npx prisma db seed
```

Then run the development server:

```bash
npm run dev
```

- [ ] **Step 2: Add the concepts section**

Insert a new `## App Router Concepts Exercised` section right before the existing `## Learn More` heading in `README.md`:

```markdown
## App Router Concepts Exercised

This project was built to practice the following Next.js App Router patterns:

- **Server Components fetching data directly** — `page.tsx` for the list, detail, and tags routes query Prisma with no client-side fetch or API layer in between.
- **Client Components at interactivity boundaries only** — `MarkDoneButton`, `FilterBar`, `TagDeleteButton`, `CreateTagForm`, and `QueryProvider` are `'use client'` because they specifically need state, event handlers, or a browser-only hook; everything else stays a Server Component by default.
- **Server Actions vs. a Route Handler** — `createItem`, `markAsDone`, `createTag`, and `deleteTag` are Server Actions, invoked directly from forms/buttons in the tree, because each is a same-origin mutation tied to specific UI. `GET /api/items` is a Route Handler because it's fetched by TanStack Query's `useQuery`, which needs a real URL to call.
- **On-demand revalidation with `revalidatePath`** — every mutating Server Action invalidates exactly the routes it affects, including the pattern-based form (`revalidatePath('/(main)/items/[id]', 'page')`) for invalidating every dynamic detail page at once.
- **Dynamic route segments** — `app/(main)/items/[id]/page.tsx`, with the `params` prop as a `Promise` that must be awaited.
- **Route groups** — `(main)` shares one nav/layout across `/`, `/tags`, `/about`, and `/items/[id]` without adding a segment to the URL.
- **`loading.tsx` / `error.tsx` / `not-found.tsx` file conventions** — automatic Suspense fallbacks, a Client Component error boundary using the `retry()` recovery function, and `notFound()` for an invalid item id.
- **TanStack Query alongside the RSC data model** — the list page's initial render comes from a Server Component, while the search/filter bar layers client-side fetching and caching on top via a Route Handler, illustrating both data-fetching models in the same page.
```

- [ ] **Step 3: Verify**

```bash
grep -c "App Router Concepts Exercised" README.md
```

Expected: `1`.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "Document App Router concepts exercised in README"
```
