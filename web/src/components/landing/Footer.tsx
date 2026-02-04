import Link from "next/link";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Pricing", href: "#pricing" },
      { label: "Chat Demo", href: "/chat" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Blog", href: "#" },
      { label: "Careers", href: "#" },
      { label: "Contact", href: "#" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "#" },
      { label: "Terms of Service", href: "#" },
      { label: "Security", href: "#" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-gray-100 px-6 py-10 dark:border-gray-800 dark:bg-gray-950">
      <div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {/* Brand */}
        <div>
          <div className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#1a6aff] to-[#00008b] text-xs font-bold text-white">
              OT
            </span>
            Altius
          </div>
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            AI-powered interface to OpenText Content Server.
          </p>
        </div>

        {/* Link columns */}
        {columns.map((col) => (
          <div key={col.title}>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {col.title}
            </h4>
            <ul className="mt-3 space-y-2">
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Copyright */}
      <div className="mx-auto mt-12 max-w-6xl border-t border-gray-200 pt-6 dark:border-gray-800">
        <p className="text-center text-xs text-gray-400 dark:text-gray-600">
          &copy; 2026 Altius. All rights reserved.
        </p>
        <p className="mt-2 text-center text-xs text-gray-400 dark:text-gray-600">
          Powered by Claude Sonnet 4.5
        </p>
      </div>
    </footer>
  );
}
