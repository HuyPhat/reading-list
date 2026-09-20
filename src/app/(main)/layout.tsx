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
