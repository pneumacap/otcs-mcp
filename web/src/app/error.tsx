'use client';

import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="flex flex-col items-center gap-6 px-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#1a6aff] to-[#00008b] text-lg font-bold text-white">
          A
        </div>
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Something went wrong</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {error.message || 'An unexpected error occurred.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-gradient-to-r from-[#1a6aff] to-[#00008b] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md"
          >
            Try again
          </button>
          <Link
            href="/chat"
            className="rounded-lg px-4 py-2.5 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Back to Chat
          </Link>
        </div>
      </div>
    </div>
  );
}
