import Link from "next/link";

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden px-6 py-24 text-center sm:py-32">
      {/* Subtle gradient background glow */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-blue-50/60 via-transparent to-transparent dark:from-blue-950/20" />

      <div className="mx-auto max-w-3xl animate-fade-in-up">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl dark:text-white">
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            AI
          </span>{" "}
          without Workspaces
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-600 dark:text-gray-400">
          Manage your entire OpenText Content Server through natural language.
          Browse folders, search documents, run workflows, and control
          permissions — all from a single conversation.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/sign-up"
            className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg"
          >
            Start Free
          </Link>
          <a
            href="#demo"
            className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            See it in action
          </a>
        </div>
        <p className="mt-8 text-xs text-gray-500 dark:text-gray-500">
          Powered by Claude Opus 4.5 — 38 enterprise tools, one intelligent assistant
        </p>
      </div>
    </section>
  );
}
