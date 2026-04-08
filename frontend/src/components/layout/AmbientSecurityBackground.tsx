import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";

type AmbientSecurityBackgroundProps = {
  intensity?: number;
  speed?: number;
  palette?: [string, string, string, string?];
  className?: string;
};

type BlobConfig = {
  top: string;
  left: string;
  size: string;
  color: string;
  duration: number;
  x: [number, number, number, number];
  y: [number, number, number, number];
  scale: [number, number, number, number];
};

const DEFAULT_PALETTE: [string, string, string, string] = ["#1e3a8a", "#1d4ed8", "#0ea5e9", "#06b6d4"];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function AmbientSecurityBackground({
  intensity = 0.55,
  speed = 1,
  palette = DEFAULT_PALETTE,
  className = ""
}: AmbientSecurityBackgroundProps) {
  const reducedMotion = useReducedMotion();
  const safeIntensity = clamp(intensity, 0.15, 1);
  const safeSpeed = clamp(speed, 0.4, 2);

  const blobs = useMemo<BlobConfig[]>(
    () => [
      {
        top: "10%",
        left: "-8%",
        size: "34rem",
        color: palette[0],
        duration: 26 / safeSpeed,
        x: [0, 38, -20, 0],
        y: [0, 26, -14, 0],
        scale: [1, 1.08, 0.96, 1]
      },
      {
        top: "-12%",
        left: "56%",
        size: "30rem",
        color: palette[1],
        duration: 30 / safeSpeed,
        x: [0, -26, 14, 0],
        y: [0, 30, -18, 0],
        scale: [0.98, 1.06, 0.94, 0.98]
      },
      {
        top: "56%",
        left: "18%",
        size: "28rem",
        color: palette[2],
        duration: 28 / safeSpeed,
        x: [0, 20, -16, 0],
        y: [0, -24, 18, 0],
        scale: [1, 1.05, 0.95, 1]
      },
      {
        top: "62%",
        left: "72%",
        size: "24rem",
        color: palette[3] ?? palette[2],
        duration: 33 / safeSpeed,
        x: [0, -18, 12, 0],
        y: [0, -20, 16, 0],
        scale: [0.96, 1.04, 0.92, 0.96]
      }
    ],
    [palette, safeSpeed]
  );

  return (
    <div className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden ${className}`} aria-hidden="true">
      {blobs.map((blob, index) => {
        const baseOpacity = 0.12 * safeIntensity;
        const blobOpacity = baseOpacity - index * 0.015;

        return (
          <motion.div
            key={`${blob.top}-${blob.left}-${index}`}
            className="absolute rounded-full blur-3xl will-change-transform"
            style={{
              top: blob.top,
              left: blob.left,
              width: blob.size,
              height: blob.size,
              backgroundColor: blob.color,
              opacity: blobOpacity
            }}
            animate={
              reducedMotion
                ? { opacity: blobOpacity }
                : {
                    x: blob.x,
                    y: blob.y,
                    scale: blob.scale
                  }
            }
            transition={
              reducedMotion
                ? undefined
                : {
                    duration: blob.duration,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }
            }
          />
        );
      })}

      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(14,165,233,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(14,165,233,0.055) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(circle at center, black 34%, transparent 86%)",
          opacity: 0.32
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(rgba(125,211,252,0.08) 0.6px, transparent 0.8px), radial-gradient(rgba(8,47,73,0.2) 0.7px, transparent 0.9px)",
          backgroundSize: "3px 3px, 7px 7px",
          backgroundPosition: "0 0, 1px 1px",
          opacity: 0.18
        }}
      />
    </div>
  );
}
