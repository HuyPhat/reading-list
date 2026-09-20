# Reading List — Design

**Date:** 2026-09-20
**Status:** Approved for implementation

## Purpose

A personal app to track articles and books to read, built as a learning
project to solidify Next.js App Router concepts (Server Components, Client
Components, Server Actions, Route Handlers, dynamic routes, route groups,
and the loading/error/not-found file conventions) alongside TanStack Query
for client-side data fetching. Explicit secondary goal: understand *why*
each pattern is used where it's used, not just working code.

## Stack

- Next.js 16 (App Router), TypeScript, Turbopack (default)
- Tailwind CSS
- Prisma + SQLite (structured so a swap to Postgres later only touches the
  Prisma datasource block and the `status` field's future enum conversion)
- TanStack Query (client-side data fetching for the search/filter bar)
- ESLint

## Data model

```prisma
model ReadingItem {
  id        String   @id @default(cuid())
  title     String
  author    String
  url       String?
  notes     String?
  status    String   @default("TO_READ") // "TO_READ" | "READING" | "DONE"
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

Decisions and rationale:

- **`author` is a single free-text field** covering "whoever or wherever
  this came from" — a person for books, a publication/site for articles.
  No separate `source` field.
- **`status` is `String`, not a Prisma `enum`** — Prisma's SQLite connector
  doesn't support native enums. A TypeScript union type
  (`"TO_READ" | "READING" | "DONE"`) in `lib/types.ts` is validated against
  in every Server Action. Swapping to Postgres later turns this into a real
  `enum` with minimal other changes.
- **Tags are a relational many-to-many** (`Tag[]` on both models, Prisma's
  implicit many-to-many join table), not a comma-separated string column.
  Chosen for cleaner querying and a dedicated tag-management screen, at the
  cost of one extra model versus a plain string field.
- **`url` and `notes` are optional** — useful for articles/books that have
  a link or a personal note, but not required for every item.
- **No uniqueness constraint on `(title, author)` or `title` alone, and no
  soft duplicate-detection warning.** A DB-level constraint risked false
  conflicts (different items can legitimately share a title) and blocking
  intentional re-adds (e.g. tracking a re-read). Explicitly decided to
  allow free duplicates for this first pass.
- **No additional indexes beyond what constraints imply** (primary keys,
  `Tag.name`'s unique index, and the join table's automatic foreign-key
  indexes). At the expected scale — tens of rows for one personal user — a
  full table scan costs microseconds; indexing `status`/`createdAt` now
  would optimize for a scale this app won't reach. Worth revisiting only if
  the app becomes multi-user or the row count grows by orders of magnitude.

## Routes, pages, and Server vs. Client Components

```
src/
  app/
    (main)/
      layout.tsx          ← shared nav (Server Component)
      page.tsx             ← "/" list view (Server Component)
      loading.tsx          ← list loading skeleton
      error.tsx            ← list error boundary (Client Component)
      items/
        [id]/
          page.tsx          ← detail view (Server Component)
          loading.tsx       ← detail loading skeleton
          error.tsx         ← detail error boundary (Client Component)
          not-found.tsx     ← invalid item id
      tags/
        page.tsx            ← manage-tags screen (Server Component)
      about/
        page.tsx            ← "/about" (Server Component, static content)
    api/
      items/
        route.ts             ← GET handler for search/filter
    layout.tsx               ← root layout (html/body, fonts, QueryProvider)
  components/
    reading-item-card.tsx     ← Server Component (list + filter results)
    add-item-form.tsx         ← Server Component shell (form + tag checkboxes)
    mark-done-button.tsx      ← Client Component (onClick + pending state)
    filter-bar.tsx            ← Client Component (TanStack Query + input state)
    tag-delete-button.tsx     ← Client Component (confirmation modal)
    query-provider.tsx        ← Client Component (QueryClientProvider)
  lib/
    prisma.ts                 ← Prisma client singleton
    types.ts                  ← Status union type, shared types
    actions/
      items.ts                ← Server Actions: createItem, markAsDone
      tags.ts                 ← Server Actions: createTag, deleteTag
  prisma/
    schema.prisma
    seed.ts
```

Server vs. Client rationale:

- **Server Components by default** (list, detail, tags page, nav, item
  cards) — they read from Prisma directly with no client-side JS shipped,
  and are where the RSC data-fetching model actually lives.
- **`mark-done-button.tsx` is a Client Component** — needs `onClick` and a
  pending/disabled state while its Server Action runs; static server-
  rendered HTML can't provide that interactivity.
- **`filter-bar.tsx` is a Client Component** — owns search/status/tag
  input state and calls TanStack Query's `useQuery`, which only runs in
  the browser.
- **`tag-delete-button.tsx` is a Client Component** — solely because of
  the confirmation modal's open/closed local state; the `/tags` page
  around it stays server-rendered.
- **`query-provider.tsx` wraps the tree as a Client Component** —
  `QueryClientProvider` needs to exist once, high in the tree, and any
  context provider is inherently client-side.
- **`(main)` route group** shares the nav/shell layout across the list,
  detail, tags, and about pages without `/about` needing a copy of that
  layout, and without `(main)` appearing in the URL.

## Server Actions and Route Handler

**`lib/prisma.ts`** — Prisma Client cached on `globalThis` in development,
so Turbopack's hot-reload doesn't spin up a new client (and new DB
connection pool) on every file save.

**`lib/actions/items.ts`**
- `createItem(formData)` — validates non-empty `title`/`author`; reads
  `url`, `notes`, and checked tag IDs off the form; inserts via
  `prisma.readingItem.create` with `tags: { connect: [...] }`; calls
  `revalidatePath('/')`.
- `markAsDone(id)` — bound to the button via `markAsDone.bind(null, item.id)`;
  updates `status: "DONE"`; calls `revalidatePath('/items/${id}')` and
  `revalidatePath('/')`.

**`lib/actions/tags.ts`**
- `createTag(formData)` — validates a non-empty, trimmed `name`; inserts;
  catches Prisma's `P2002` (unique violation) and returns
  `{ error: "Tag already exists" }` instead of crashing; calls
  `revalidatePath('/tags')` and `revalidatePath('/')` (the add-item form's
  checkbox list needs the new tag).
- `deleteTag(id)` — shown only after the confirmation modal accepts;
  deletes the tag (the implicit many-to-many join table cascades the
  detach automatically — no orphaned rows); calls `revalidatePath('/tags')`,
  `revalidatePath('/')`, and `revalidatePath('/items/[id]', 'page')` to
  invalidate every dynamic detail page at once.

All four are Server Actions, not Route Handlers, because each is a
mutation triggered directly by a form or button already in the tree.
Server Actions let React manage pending/error UI and let Next.js
auto-refresh the calling route once the action resolves — no manual
`fetch`, JSON handling, or `router.refresh()` needed. (Server Actions
integrate with the router to refresh the invoking route automatically;
`router.refresh()` would only be needed for state changes *not* triggered
by a Server Action in the current tree, e.g. a polling interval or
WebSocket message — not a case this app has.)

**`app/api/items/route.ts` — `GET`**
```ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') ?? ''
  const status = searchParams.get('status')
  const tagIds = searchParams.getAll('tag')

  const items = await prisma.readingItem.findMany({
    where: {
      OR: search
        ? [{ title: { contains: search } }, { author: { contains: search } }]
        : undefined,
      status: status || undefined,
      tags: tagIds.length ? { some: { id: { in: tagIds } } } : undefined,
    },
    include: { tags: true },
  })

  return Response.json(items)
}
```

A Route Handler is the right tool here (instead of a Server Action)
because TanStack Query's `useQuery` fetches via plain HTTP `GET` with a
cache key derived from the URL/params — REST-style semantics, not an RPC
call bound to a form.

Search filtering uses Prisma's `contains` directly against SQLite, with no
`mode: 'insensitive'` and no `COLLATE NOCASE`. Verified directly: SQLite's
`LIKE` operator (what `contains` compiles to) is case-insensitive for
ASCII by default, independent of column collation — `COLLATE NOCASE` and
`mode: 'insensitive'` matter for `=`-based exact-match comparisons and
sorting, not for substring `LIKE` matching. Confirmed with a throwaway
`node:sqlite` test (`LIKE '%hello%'` matched `'Hello World'` with default
collation). Non-ASCII case-folding (e.g. `é`/`É`) isn't handled, which is
an acceptable limitation for this app.

## Tag management

- **`/tags` page** (Server Component) lists all tags with each tag's item
  count, a form to create a new tag, and a delete control per tag.
- **Add-item form uses a checkbox list of existing tags**, not free-text
  input — tag creation lives only on `/tags`, so there's one place tags
  are minted, and the add-item form just selects from what already exists.
- **Deleting a tag** shows a confirmation modal (`tag-delete-button.tsx`,
  Client Component for its open/closed state) with the copy:
  > "Are you sure you want to delete the tag '[Tag Name]'? It will be
  > removed from N items. This cannot be undone."
  Primary action "Delete Tag" (destructive/red styling), secondary
  "Cancel". Confirmed deletion always succeeds (no blocking on item count)
  — the join table cascade handles detaching cleanly.

## Loading, error, and not-found states

- **List (`app/(main)/page.tsx`)**: `loading.tsx` renders skeleton card
  placeholders (not a bare spinner) while Next.js's automatic `Suspense`
  wrapper waits on the Server Component's Prisma query — chosen to match
  the "reasonably polished" styling direction and avoid layout shift.
  `error.tsx` is a Client Component (required — error boundaries need
  React state to support the `reset()` recovery function) showing a
  message and a "Try again" button.
- **Detail (`app/(main)/items/[id]/page.tsx`)**: same skeleton/error
  pattern, scoped to this route segment. `not-found.tsx` renders when the
  Server Component's Prisma lookup returns `null` and calls `notFound()`
  (from `next/navigation`) — a special thrown error that Next.js's router
  catches to render the nearest `not-found.tsx`, bypassing `error.tsx`.
- **`/tags` and `/about`** intentionally have no dedicated `loading.tsx`/
  `error.tsx` — out of scope per the original feature list; trivial to add
  later.
- **`/api/items` fetch failures** are *not* handled via `error.tsx` at
  all — TanStack Query surfaces them as `isError`/`error` state in
  `filter-bar.tsx`, rendered as an inline message in that component. This
  is a deliberate contrast: file-based error boundaries are a Server
  Component/routing concept; TanStack Query errors are ordinary React
  state owned by the component that issued the query.

## Seed data and verification

- `prisma/seed.ts` inserts ~10 sample `ReadingItem` rows, mixing books and
  articles across all three statuses, referencing a handful of shared tags
  via `connectOrCreate` so the tag filter and `/tags` page have real data
  to show. Wired up via `"prisma": { "seed": "tsx prisma/seed.ts" }` and
  run with `npx prisma db seed`.
- No automated test suite requested for this project. Verification is
  manual, done incrementally in the browser as each piece is built: list
  renders seeded data → add an item and confirm it appears without reload
  → open its detail page → mark it done and confirm the status updates in
  place → create/select tags and confirm they show up → search/filter via
  the TanStack Query bar and confirm results update → visit an invalid
  `/items/xyz` id and confirm `not-found.tsx` renders → check `/about` and
  the nav.

## Build order

1. Scaffold (done) — `create-next-app` with TypeScript, Tailwind, ESLint,
   App Router, `src/`, `@/*` alias, Turbopack.
2. Prisma schema, client singleton, migration, and seed script.
3. Root layout, `(main)` route group, nav, list page (unfiltered).
4. Tag management screen (`/tags`) — built before the add-item form since
   the form's tag checkboxes depend on tags already existing.
5. Add-item Server Action and form (with tag checkboxes).
6. Detail page and mark-done Server Action.
7. Search/filter bar via TanStack Query + `/api/items` Route Handler.
8. `loading.tsx` / `error.tsx` / `not-found.tsx` for list and detail routes.
9. README section listing the App Router concepts this project exercises.

## Out of scope for this pass

- Editing or deleting a `ReadingItem` (only create and mark-as-done).
- Pagination (dataset size doesn't warrant it).
- Auth/multi-user support.
- Automated tests.
- Postgres migration itself (schema is just structured to make that swap
  easier later).
