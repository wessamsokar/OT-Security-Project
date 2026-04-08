import { motion } from "framer-motion";

export function AmbientBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <motion.div
        className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-brand/20 blur-3xl"
        animate={{ x: [0, 35, -15, 0], y: [0, -30, 15, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute right-0 top-0 h-[22rem] w-[22rem] rounded-full bg-accent/20 blur-3xl"
        animate={{ x: [0, -20, 10, 0], y: [0, 25, -20, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl"
        animate={{ x: [0, 18, -12, 0], y: [0, -16, 20, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(12,20,42,0.02)_1px,transparent_1px)] bg-[length:22px_22px]" />
    </div>
  );
}
