import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

type Props = {
  id: string;
  label: string;
  type?: "text" | "email" | "password";
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
};

export function InputField({ id, label, type = "text", placeholder, value, onChange, error }: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const actualType = type === "password" ? (showPassword ? "text" : "password") : type;

  return (
    <label htmlFor={id} className="block">
      <span className="mb-2 block text-sm text-muted">{label}</span>
      <div className="relative">
        <input
          id={id}
          type={actualType}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={[
            "w-full rounded-xl border bg-[#0c152d]/80 px-3 py-3 text-sm text-text outline-none transition",
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
