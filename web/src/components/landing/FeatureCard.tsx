interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export default function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="group rounded-xl border border-gray-200 bg-gradient-to-b from-white to-gray-50/80 p-5 transition-all hover:border-amber-300/60 hover:shadow-lg dark:border-gray-800 dark:from-gray-900 dark:to-gray-900/80 dark:hover:border-amber-500/30">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-50 to-[#1a6aff]/10 text-[#1a6aff] transition-colors group-hover:from-amber-50 group-hover:to-yellow-50 group-hover:text-amber-600 dark:from-blue-950 dark:to-[#00008b]/20 dark:text-blue-400 dark:group-hover:from-amber-950/40 dark:group-hover:to-yellow-950/40 dark:group-hover:text-amber-400">
        {icon}
      </div>
      <h3 className="mb-1.5 text-[15px] font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      <p className="text-[13px] leading-relaxed text-gray-600 dark:text-gray-400">{description}</p>
    </div>
  );
}
