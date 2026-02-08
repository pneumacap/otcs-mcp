import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="flex flex-col items-center gap-6 px-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#1a6aff] to-[#00008b] text-lg font-bold text-white">
          A
        </div>
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Page not found</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            The page you are looking for does not exist or has been moved.
          </p>
        </div>
        <Link
          href="/chat"
          className="rounded-lg bg-gradient-to-r from-[#1a6aff] to-[#00008b] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md"
        >
          Back to Chat
        </Link>
      </div>
    </div>
  );
}
