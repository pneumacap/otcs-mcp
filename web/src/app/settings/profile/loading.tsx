export default function ProfileLoading() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" />
            <div className="h-5 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <div className="space-y-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                <div className="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
              </div>
            ))}
            <div className="h-10 w-24 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" />
          </div>
        </div>
      </main>
    </div>
  );
}
