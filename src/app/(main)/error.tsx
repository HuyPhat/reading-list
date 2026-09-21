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
