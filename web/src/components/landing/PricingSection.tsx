import PricingCard from "./PricingCard";

const tiers = [
  {
    name: "Free",
    price: "$0",
    period: "/mo",
    description: "Exploring AI-powered content management",
    features: [
      "50 messages per day",
      "Browse & search documents",
      "Basic workflow tasks",
      "Single user",
    ],
    ctaText: "Get Started",
    ctaHref: "/sign-up",
  },
  {
    name: "Pro",
    price: "$49",
    period: "/mo",
    description: "Daily content management at scale",
    features: [
      "Unlimited messages",
      "All 38 enterprise tools",
      "Workflows & permissions",
      "Records management",
      "Visual analytics & charts",
      "Priority support",
    ],
    ctaText: "Start Free Trial",
    ctaHref: "/sign-up",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "Advanced security & compliance",
    features: [
      "Everything in Pro",
      "SSO / SAML authentication",
      "Dedicated instance",
      "Custom tool integrations",
      "SLA guarantee",
      "Audit logging",
      "Onboarding & training",
    ],
    ctaText: "Contact Sales",
    ctaHref: "/sign-up",
  },
];

export default function PricingSection() {
  return (
    <section id="pricing" className="px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Start free and scale as your team grows.
          </p>
        </div>
        <div className="grid gap-8 lg:grid-cols-3">
          {tiers.map((tier) => (
            <PricingCard key={tier.name} {...tier} />
          ))}
        </div>
      </div>
    </section>
  );
}
