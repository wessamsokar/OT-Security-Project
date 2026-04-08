import { motion } from "framer-motion";
import { Activity, LineChart, LockKeyhole, Radar, Server, Shield } from "lucide-react";

import type { FeatureItem } from "../../types/common";

const iconMap = {
  shield: Shield,
  radar: Radar,
  lock: LockKeyhole,
  activity: Activity,
  server: Server,
  lineChart: LineChart
};

type Props = {
  item: FeatureItem;
  delay?: number;
};

export function FeatureCard({ item, delay = 0 }: Props) {
  const Icon = iconMap[item.icon];

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.45, delay }}
      whileHover={{ y: -6 }}
      className="rounded-2xl border border-white/12 bg-gradient-to-b from-[#121d3f]/90 to-[#0d1732]/90 p-6 shadow-panel"
    >
      <div className="mb-5 inline-flex rounded-xl bg-brand/20 p-2 text-brand">
        <Icon size={18} />
      </div>
      <h3 className="text-lg font-semibold text-white">{item.title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-muted">{item.description}</p>
    </motion.article>
  );
}
