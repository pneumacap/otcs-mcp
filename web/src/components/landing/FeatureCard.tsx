interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export default function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 transition-shadow hover:shadow-lg dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
        {icon}
      </div>
      <h3 className="mb-2 text-[15px] font-semibold text-gray-900 dark:text-gray-100">
        {title}
      </h3>
      <p className="text-[13.5px] leading-relaxed text-gray-600 dark:text-gray-400">
        {description}
      </p>
    </div>
  );
}
