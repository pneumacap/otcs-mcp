import Link from "next/link";

export default function CtaSection() {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-4xl rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-16 text-center shadow-xl sm:px-16">
        <h2 className="text-3xl font-bold text-white">
          Ready to simplify Content Server?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-blue-100">
          Start managing documents, workflows, and permissions through conversation.
        </p>
        <Link
          href="/sign-up"
          className="mt-8 inline-block rounded-lg bg-white px-8 py-3 text-sm font-semibold text-blue-600 shadow-md transition-all hover:shadow-lg"
        >
          Get Started for Free
        </Link>
      </div>
    </section>
  );
}
