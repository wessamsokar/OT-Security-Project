import { ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

type Props = {
  withText?: boolean;
};

export function Logo({ withText = true }: Props) {
  return (
    <Link to="/" className="inline-flex items-center gap-2 rounded-full px-1 py-1">
      <img
        src="/src/assets/logo.png"
        alt="OT Sentinel AI Logo"
        className="h-11 w-11 rounded-full object-cover"
      />
      {withText ? (
        <span className="text-sm font-semibold tracking-wide text-text">
          OT Sentinel <span className="bg-gradient-to-br from-brand to-violet-400 bg-clip-text text-transparent">AI</span>
        </span>
      ) : null}
    </Link>
  );
}
