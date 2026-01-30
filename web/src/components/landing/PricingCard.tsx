import Link from "next/link";

interface PricingCardProps {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  ctaText: string;
  ctaHref: string;
  highlighted?: boolean;
}

export default function PricingCard({
  name,
  price,
  period,
  description,
  features,
  ctaText,
  ctaHref,
  highlighted,
}: PricingCardProps) {
  return (
    <div
      className={`relative rounded-2xl border p-7 ${
        highlighted
          ? "border-amber-400 bg-gradient-to-b from-white to-amber-50/40 shadow-xl ring-1 ring-amber-400 dark:border-amber-500 dark:from-gray-900 dark:to-amber-950/20 dark:ring-amber-500"
          : "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
      }`}
    >
      {highlighted && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 px-4 py-1 text-xs font-semibold text-white shadow-sm">
          Most Popular
        </span>
      )}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{name}</h3>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-4xl font-bold text-gray-900 dark:text-white">{price}</span>
        {period && (
          <span className="text-sm text-gray-500 dark:text-gray-400">{period}</span>
        )}
      </div>
      <p className="mt-2 text-[13.5px] text-gray-600 dark:text-gray-400">{description}</p>
      <ul className="mt-5 space-y-2.5">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-[13.5px] text-gray-700 dark:text-gray-300">
            <svg className={`mt-0.5 h-4 w-4 shrink-0 ${highlighted ? "text-amber-500 dark:text-amber-400" : "text-blue-600 dark:text-blue-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {feature}
          </li>
        ))}
      </ul>
      <Link
        href={ctaHref}
        className={`mt-7 block w-full rounded-lg py-2.5 text-center text-sm font-semibold transition-all ${
          highlighted
            ? "bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-md hover:shadow-lg hover:brightness-110"
            : "border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        }`}
      >
        {ctaText}
      </Link>
    </div>
  );
}
