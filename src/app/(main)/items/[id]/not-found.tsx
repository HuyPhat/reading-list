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
