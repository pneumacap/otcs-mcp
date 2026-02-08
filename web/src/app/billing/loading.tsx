export default function BillingLoading() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" />
            <div className="h-5 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
          </div>
          <div className="h-4 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">
        {/* Plan card skeleton */}
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <div className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
          <div className="mt-3 h-7 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
          <div className="mt-4 h-2 animate-pulse rounded-full bg-gray-200 dark:bg-gray-800" />
        </div>
        {/* Pricing cards skeleton */}
        <div className="grid gap-6 md:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
              <div className="h-5 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
              <div className="mt-2 h-4 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
              <div className="mt-4 space-y-2">
                {[0, 1, 2].map((j) => (
                  <div key={j} className="h-4 w-36 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                ))}
              </div>
              <div className="mt-6 h-10 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
