import Link from "next/link";

export default function HeroSection() {
  return (
    <section className="hero-bg dot-grid relative overflow-hidden px-6 py-16 text-center sm:py-20">
      {/* Gold accent line at top */}
      <div className="gold-line absolute top-0 left-0 w-full" />

      <div className="relative z-10 mx-auto max-w-3xl animate-fade-in-up">
        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-50 px-4 py-1.5 text-xs font-medium text-amber-700 dark:border-amber-500/20 dark:bg-amber-950/40 dark:text-amber-400">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
          Powered by Claude Opus 4.5 — 38 enterprise tools
        </div>

        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl dark:text-white">
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            AI
          </span>{" "}
          WITHOUT WORKSPACES
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-gray-600 dark:text-gray-400">
          Manage your entire OpenText Content Server through natural language.
          Browse folders, search documents, run workflows, and control
          permissions — all from a single conversation.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/sign-up"
            className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:brightness-110"
          >
            Start Free
          </Link>
          <a
            href="#demo"
            className="rounded-lg border border-gray-300 bg-white/60 px-6 py-3 text-sm font-semibold text-gray-700 backdrop-blur transition-all hover:bg-white dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            See it in action
          </a>
        </div>
      </div>
    </section>
  );
}
