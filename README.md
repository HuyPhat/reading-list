![CI](https://github.com/HuyPhat/reading-list/actions/workflows/ci.yml/badge.svg)

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, install dependencies (this also runs `prisma generate` via the `postinstall` script):

```bash
pnpm install
```

Copy the example environment file:

```bash
cp .env.example .env
```

Then set up the database and seed it with sample data:

```bash
pnpm exec prisma migrate dev
pnpm exec prisma db seed
```

Then run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

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

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
