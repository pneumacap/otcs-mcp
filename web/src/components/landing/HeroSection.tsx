import Link from 'next/link';

export default function HeroSection() {
  return (
    <section className="hero-bg dot-grid relative overflow-hidden px-6 py-16 text-center sm:py-20">
      {/* Gold accent line at top */}
      <div className="gold-line absolute top-0 left-0 w-full" />

      <div className="relative z-10 mx-auto max-w-3xl animate-fade-in-up">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl dark:text-white">
          NO WORKSPACES?
          <br />
          <span className="bg-gradient-to-r from-[#1a6aff] to-[#00008b] bg-clip-text text-transparent">
            NO PROBLEM.
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-gray-600 dark:text-gray-400">
          Automate complex content operations that once took hours into single conversations.
          Upload, organize, analyze, and act on documents at scale — powered by agentic AI that
          understands your business.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/sign-up"
            className="rounded-lg bg-gradient-to-r from-[#1a6aff] to-[#00008b] px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:brightness-110"
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
