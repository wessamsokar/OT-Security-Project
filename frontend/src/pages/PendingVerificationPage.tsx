import { Clock, Mail } from "lucide-react";
import { motion } from "framer-motion";

/**
 * Limited dashboard view for authenticated users awaiting OT platform approval.
 */
export function PendingVerificationPage() {
  return (
    <section className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-panel/55 p-8 shadow-panel backdrop-blur-sm md:p-10">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-500/35 bg-amber-500/10 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-amber-200">
          <Clock size={14} className="text-amber-300" />
          Pending Verification
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">Access under review</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted md:text-base">
          Your organization request is currently under administrative review.
        </p>
        <p className="mt-3 inline-flex gap-2 text-sm leading-relaxed text-muted md:text-base">
          <Mail size={17} className="mt-0.5 shrink-0 text-brand" />
          <span>You will receive an email once your access request has been approved.</span>
        </p>
        <div className="mt-8 rounded-2xl border border-white/10 bg-[#0c152d]/55 p-4 text-xs leading-relaxed text-muted md:text-sm">
          OT monitoring, analytics, device data, and incident workflows stay disabled until your account is activated.
          Settings and privacy options remain available so you can review how the platform handles your information.
        </div>
      </motion.div>
    </section>
  );
}
