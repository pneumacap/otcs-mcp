import Link from "next/link";

export default function CtaSection() {
  return (
    <section className="px-6 py-14">
      <div className="section-dark relative mx-auto max-w-4xl overflow-hidden rounded-2xl px-8 py-14 text-center shadow-xl sm:px-16">
        {/* Decorative gold accent */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-amber-500/10 via-transparent to-amber-400/5" />
        <div className="gold-line absolute top-0 left-0 w-full" />

        <div className="relative z-10">
          <h2 className="text-3xl font-bold text-white">
            Ready to simplify Content Server?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-blue-200">
            Start managing documents, workflows, and permissions through conversation.
          </p>
          <Link
            href="/sign-up"
            className="mt-7 inline-block rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 px-8 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:brightness-110"
          >
            Get Started for Free
          </Link>
        </div>
      </div>
    </section>
  );
}
