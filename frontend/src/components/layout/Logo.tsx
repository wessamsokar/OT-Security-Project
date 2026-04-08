import { ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

type Props = {
  withText?: boolean;
};

export function Logo({ withText = true }: Props) {
  return (
    <Link to="/" className="inline-flex items-center gap-2 rounded-full px-1 py-1">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-brand/20 text-brand ring-1 ring-brand/40">
        <ShieldCheck size={18} />
      </span>
      {withText ? (
        <span className="text-sm font-semibold tracking-wide text-text">
          OT Sentinel <span className="text-brand">AI</span>
        </span>
      ) : null}
    </Link>
  );
}
