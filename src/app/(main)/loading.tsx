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
