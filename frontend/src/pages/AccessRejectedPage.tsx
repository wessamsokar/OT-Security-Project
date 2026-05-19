import { motion } from "framer-motion";
import { ShieldOff } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "../components/ui/Button";
import { Logo } from "../components/layout/Logo";
import { useAuth } from "../contexts/AuthContext";
import { logoutUser } from "../api/authApi";

/**
 * Full-screen access denial for accounts whose onboarding was rejected (defensive UI; APIs also return 403).
 */
export function AccessRejectedPage() {
  const navigate = useNavigate();
  const { clearSession } = useAuth();

  return (
    <div className="min-h-screen bg-transparent px-4 py-16 text-text">
      <div className="mx-auto flex max-w-lg flex-col items-center text-center">
        <Logo />
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="mt-10 w-full rounded-3xl border border-red-500/25 bg-panel/55 p-8 shadow-panel backdrop-blur-sm md:p-10"
        >
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 text-red-200">
            <ShieldOff size={28} aria-hidden />
          </div>
          <h1 className="text-2xl font-semibold text-white">Access request not approved</h1>
          <p className="mt-4 text-sm leading-relaxed text-muted md:text-base">
            Your onboarding request was not approved. OT Sentinel AI cannot provision platform access for this
            registration.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-muted md:text-base">
            If you believe this was a mistake, please contact your ICS security administrator or your organizational
            security contact for next steps.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              type="button"
              variant="primary"
              className="w-full sm:w-auto"
              onClick={async () => {
                try {
                  await logoutUser();
                } catch {
                  /* cookie cleared server-side when reachable */
                }
                clearSession();
                navigate("/login", { replace: true });
              }}
            >
              Return to sign in
            </Button>
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => navigate("/", { replace: true })}>
              Back to home
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
