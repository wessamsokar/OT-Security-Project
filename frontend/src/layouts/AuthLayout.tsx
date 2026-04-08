import { motion } from "framer-motion";
import { Shield, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { Logo } from "../components/layout/Logo";

type Props = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

export function AuthLayout({ title, subtitle, children }: Props) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-transparent">
      <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-2 md:px-8">
        <motion.section
          initial={{ opacity: 0, x: -26 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="relative hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#0f1b3b] to-[#0a1228] p-10 md:flex md:flex-col md:justify-between"
        >
          <div>
            <Logo />
            <h2 className="mt-7 text-3xl font-semibold text-white">Protect OT devices and process networks with confidence.</h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
              Unified OT visibility for attacks, anomalies, and incident triage across PLC, SCADA, and field network layers.
            </p>
          </div>
          <div className="space-y-4 text-sm text-muted">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2">
              <Shield size={15} className="text-brand" /> OT-aware detection pipeline
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2">
              <Sparkles size={15} className="text-brand" /> Real-time ML threat classification
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, x: 26 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55 }}
          className="flex items-center justify-center"
        >
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0d1732]/95 p-6 shadow-panel md:p-8">
            <div className="mb-7 md:hidden">
              <Logo />
            </div>
            <h1 className="text-2xl font-semibold text-white">{title}</h1>
            <p className="mt-2 text-sm text-muted">{subtitle}</p>
            <div className="mt-7">{children}</div>
          </div>
        </motion.section>
      </div>
    </main>
  );
}
