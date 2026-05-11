import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

type Props = {
  id: string;
  label: string;
  type?: "text" | "email" | "password" | "number";
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  min?: number;
  max?: number;
  /** Tighter label/input spacing for dense forms (e.g. onboarding). */
  compact?: boolean;
};

export function InputField({
  id,
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  error,
  min,
  max,
  compact
}: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const actualType = type === "password" ? (showPassword ? "text" : "password") : type;

  const pad = compact ? "px-2.5 py-2" : "px-3 py-3";
  const labelMb = compact ? "mb-1 block text-xs text-muted sm:text-sm" : "mb-2 block text-sm text-muted";

  return (
    <label htmlFor={id} className="block min-w-0">
      <span className={labelMb}>{label}</span>
      <div className="relative">
        <input
          id={id}
          type={actualType}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          min={type === "number" ? min : undefined}
          max={type === "number" ? max : undefined}
          className={[
            "w-full min-h-0 rounded-xl border bg-[#0c152d]/80 text-sm text-text outline-none transition",
            pad,
            "placeholder:text-muted/70 focus:border-brand/70 focus:ring-2 focus:ring-brand/20",
            error ? "border-danger/80" : "border-white/15"
          ].join(" ")}
        />
        {type === "password" ? (
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition hover:text-text"
            aria-label="Toggle password visibility"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        ) : null}
      </div>
      {error ? (
        <span className="mt-1 inline-flex items-center gap-1 text-xs text-danger">
          <AlertCircle size={13} />
          {error}
        </span>
      ) : null}
    </label>
  );
}
