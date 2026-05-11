import { type PointerEvent, useRef } from "react";
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring } from "framer-motion";

/**
 * Decorative OT network hero visual (grid, nodes, PLC/SCADA/RTU labels).
 * Standalone — no API calls — used on the marketing home page.
 */
export function OtTopologyHeroVisual() {
  const compactCardRef = useRef<HTMLDivElement | null>(null);
  const reduceMotion = useReducedMotion();
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const depth = useMotionValue(0);
  const smoothRotateX = useSpring(rotateX, { stiffness: 140, damping: 18, mass: 0.6 });
  const smoothRotateY = useSpring(rotateY, { stiffness: 140, damping: 18, mass: 0.6 });
  const smoothDepth = useSpring(depth, { stiffness: 140, damping: 20, mass: 0.7 });
  const cardTransform = useMotionTemplate`perspective(900px) rotateX(${smoothRotateX}deg) rotateY(${smoothRotateY}deg)`;
  const layerTransform = useMotionTemplate`translateZ(${smoothDepth}px)`;

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (reduceMotion || event.pointerType === "touch") return;
    const target = compactCardRef.current;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    rotateX.set(-y * 10);
    rotateY.set(x * 12);
    depth.set(10);
  };

  const resetPointer = () => {
    rotateX.set(0);
    rotateY.set(0);
    depth.set(0);
  };

  return (
    <motion.div
      ref={compactCardRef}
      className="group relative h-[420px] overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#101b3d]/70 to-[#0a1228]/58 p-5 shadow-panel"
      style={{ transform: reduceMotion ? "none" : cardTransform, transformStyle: "preserve-3d" }}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointer}
      onPointerCancel={resetPointer}
    >
      <motion.div
        className="pointer-events-none absolute inset-0"
        animate={
          reduceMotion
            ? undefined
            : {
                backgroundPosition: ["0% 0%", "100% 50%", "0% 100%"]
              }
        }
        transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(34,211,238,0.22), transparent 42%), radial-gradient(circle at 80% 80%, rgba(147,51,234,0.18), transparent 40%)",
          backgroundSize: "160% 160%"
        }}
      />
      <div className="pointer-events-none absolute left-10 top-10 h-36 w-36 rounded-full bg-cyan-400/15 blur-2xl" />
      <div className="pointer-events-none absolute bottom-8 right-8 h-40 w-40 rounded-full bg-violet-500/20 blur-3xl" />

      <motion.div
        className="relative mt-2 h-full rounded-2xl border border-cyan-400/30 bg-[#081126]/70 p-4"
        style={{ transformStyle: "preserve-3d" }}
        animate={reduceMotion ? undefined : { boxShadow: ["0 0 0 rgba(34,211,238,0)", "0 0 26px rgba(34,211,238,0.28)", "0 0 0 rgba(34,211,238,0)"] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[linear-gradient(to_right,rgba(255,255,255,0.09)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.09)_1px,transparent_1px)] bg-[size:26px_26px] opacity-45" />
        <motion.div
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-cyan-300/80"
          animate={reduceMotion ? undefined : { y: [0, 320, 0] }}
          transition={{ duration: 4.6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/50"
          style={{ transform: reduceMotion ? "translate(-50%, -50%)" : `translate(-50%, -50%) ${layerTransform}` }}
          animate={reduceMotion ? undefined : { scale: [0.92, 1.05, 0.92], opacity: [0.45, 0.95, 0.45] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-violet-300/50"
          style={{ transform: reduceMotion ? "translate(-50%, -50%)" : `translate(-50%, -50%) ${layerTransform}` }}
          animate={reduceMotion ? undefined : { scale: [1.05, 0.9, 1.05], opacity: [0.35, 0.85, 0.35] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute left-6 top-9 h-3 w-3 rounded-full bg-emerald-300"
          style={{ transform: reduceMotion ? "none" : layerTransform }}
          animate={reduceMotion ? undefined : { opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute left-1/2 top-16 h-3 w-3 -translate-x-1/2 rounded-full bg-cyan-300"
          style={{ transform: reduceMotion ? "none" : layerTransform }}
          animate={reduceMotion ? undefined : { opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute right-8 top-12 h-3 w-3 rounded-full bg-amber-300"
          style={{ transform: reduceMotion ? "none" : layerTransform }}
          animate={reduceMotion ? undefined : { opacity: [0.45, 1, 0.45] }}
          transition={{ duration: 2.1, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-16 left-12 h-3 w-3 rounded-full bg-rose-300"
          style={{ transform: reduceMotion ? "none" : layerTransform }}
          animate={reduceMotion ? undefined : { opacity: [0.35, 1, 0.35] }}
          transition={{ duration: 1.7, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute right-12 top-1/2 h-3 w-3 rounded-full bg-sky-300"
          style={{ transform: reduceMotion ? "none" : layerTransform }}
          animate={reduceMotion ? undefined : { opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="pointer-events-none absolute inset-x-6 bottom-10 flex items-center justify-between text-[10px] tracking-[0.2em] text-cyan-100/75">
          <span>PLC-A</span>
          <span>SCADA</span>
          <span>RTU-4</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
