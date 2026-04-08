import { motion } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

type Variant = "primary" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

type Props = HTMLMotionProps<"button"> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
};

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-brand to-accent text-white shadow-soft hover:brightness-110 focus-visible:ring-brand/60",
  ghost: "bg-transparent text-text hover:bg-white/5 focus-visible:ring-white/20",
  outline: "border border-white/20 bg-white/5 text-text hover:border-brand/50 hover:bg-brand/10"
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-2 text-sm",
  md: "px-4 py-2.5 text-sm",
  lg: "px-5 py-3 text-base"
};

export function Button({ variant = "primary", size = "md", loading = false, className = "", children, ...props }: Props) {
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.16 }}
      className={[
        "rounded-xl2 font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2",
        variantClasses[variant],
        sizeClasses[size],
        loading ? "cursor-not-allowed opacity-70" : "",
        className
      ].join(" ")}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? "Please wait..." : children}
    </motion.button>
  );
}
