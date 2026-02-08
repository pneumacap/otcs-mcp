export default function ChatLoading() {
  return (
    <div className="flex h-screen flex-col bg-white dark:bg-gray-950">
      {/* Header skeleton */}
      <header className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" />
          <div className="h-5 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
        </div>
        <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200 dark:bg-gray-800" />
      </header>

      {/* Messages area skeleton */}
      <div className="flex-1 space-y-6 overflow-hidden px-6 py-8">
        {[...Array(3)].map((_, i) => (
          <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
            <div className={`space-y-2 ${i % 2 === 0 ? "max-w-[60%]" : "max-w-[70%]"}`}>
              <div className="h-4 animate-pulse rounded bg-gray-200 dark:bg-gray-800" style={{ width: `${200 + i * 60}px` }} />
              <div className="h-4 animate-pulse rounded bg-gray-200 dark:bg-gray-800" style={{ width: `${140 + i * 40}px` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Input skeleton */}
      <div className="border-t border-gray-200 px-6 py-4 dark:border-gray-800">
        <div className="h-12 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-900" />
      </div>
    </div>
  );
}
