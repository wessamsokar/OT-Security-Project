import { motion } from "framer-motion";
import { Shield, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { Logo } from "../components/layout/Logo";

type Props = {
  title: string;
  subtitle: string;
  children: ReactNode;
  /** Wider form column, tighter padding, centered hero — onboarding / register only. */
  onboardingLayout?: boolean;
};

export function AuthLayout({ title, subtitle, children, onboardingLayout = false }: Props) {
  const gridClass = onboardingLayout
    ? "gap-4 px-4 py-4 sm:px-5 md:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)] md:gap-5 md:px-6 md:py-5 lg:grid-cols-[minmax(0,0.40fr)_minmax(0,0.60fr)]"
    : "gap-6 px-4 py-6 md:grid-cols-2 md:px-8";

  const heroClass = onboardingLayout
    ? "relative hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#0f1b3b] to-[#0a1228] p-7 md:flex md:min-h-0 md:flex-col md:justify-center xl:p-8"
    : "relative hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#0f1b3b] to-[#0a1228] p-10 md:flex md:flex-col md:justify-between";

  const heroTitleClassOnboarding = "text-2xl font-semibold leading-snug text-white xl:text-[1.65rem]";
  const heroTitleClassDefault = "mt-7 text-3xl font-semibold text-white";

  const heroLeadClass = onboardingLayout
    ? "max-w-md text-sm leading-relaxed text-muted"
    : "mt-4 max-w-md text-sm leading-relaxed text-muted";

  const onboardingBadgesWrap = "flex flex-wrap gap-2 text-xs text-muted xl:text-sm";

  const defaultBadgesWrap = "space-y-4 text-sm text-muted";

  const badgeChipClass = onboardingLayout
    ? "inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1.5"
    : "inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2";

  const formColClass = onboardingLayout
    ? "flex min-h-0 items-start justify-center pt-1 md:items-center md:pt-0"
    : "flex items-center justify-center";

  const cardClass = onboardingLayout
    ? "w-full max-w-xl rounded-3xl border border-white/10 bg-[#0d1732]/95 p-5 shadow-panel sm:max-w-2xl md:flex md:max-h-[min(100dvh-2rem,56rem)] md:min-h-0 md:flex-col md:p-6 lg:max-w-[42rem] lg:p-6"
    : "w-full max-w-md rounded-3xl border border-white/10 bg-[#0d1732]/95 p-6 shadow-panel md:p-8";

  const mobileLogoMb = onboardingLayout ? "mb-5" : "mb-7";

  const titleClass = onboardingLayout ? "text-xl font-semibold tracking-tight text-white sm:text-2xl" : "text-2xl font-semibold text-white";

  const subtitleClass = onboardingLayout ? "mt-1.5 text-xs leading-relaxed text-muted sm:text-sm" : "mt-2 text-sm text-muted";

  const childrenWrapClass = onboardingLayout
    ? "mt-4 min-h-0 w-full md:mt-5 md:flex-1 md:overflow-y-auto md:overscroll-y-contain md:pr-1 md:[scrollbar-gutter:stable]"
    : "mt-7";

  return (
    <main className="relative min-h-screen overflow-hidden bg-transparent">
      <div className={`mx-auto grid min-h-screen max-w-7xl grid-cols-1 ${gridClass}`}>
        <motion.section
          initial={{ opacity: 0, x: -26 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className={heroClass}
        >
          {onboardingLayout ? (
            <div className="max-w-md space-y-4">
              <Logo />
              <h2 className={heroTitleClassOnboarding}>Protect OT devices and process networks with confidence.</h2>
              <p className={heroLeadClass}>
                Unified OT visibility for attacks, anomalies, and incident triage across PLC, SCADA, and field network layers.
              </p>
              <div className={onboardingBadgesWrap}>
                <div className={badgeChipClass}>
                  <Shield size={14} className="text-brand shrink-0" /> OT-aware detection pipeline
                </div>
                <div className={badgeChipClass}>
                  <Sparkles size={14} className="text-brand shrink-0" /> Real-time ML threat classification
                </div>
              </div>
            </div>
          ) : (
            <>
              <div>
                <Logo />
                <h2 className={heroTitleClassDefault}>Protect OT devices and process networks with confidence.</h2>
                <p className={heroLeadClass}>
                  Unified OT visibility for attacks, anomalies, and incident triage across PLC, SCADA, and field network layers.
                </p>
              </div>
              <div className={defaultBadgesWrap}>
                <div className={badgeChipClass}>
                  <Shield size={15} className="text-brand" /> OT-aware detection pipeline
                </div>
                <div className={badgeChipClass}>
                  <Sparkles size={15} className="text-brand" /> Real-time ML threat classification
                </div>
              </div>
            </>
          )}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, x: 26 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55 }}
          className={formColClass}
        >
          <div className={cardClass}>
            <div className={onboardingLayout ? "shrink-0" : undefined}>
              <div className={`${mobileLogoMb} md:hidden`}>
                <Logo />
              </div>
              <h1 className={titleClass}>{title}</h1>
              <p className={subtitleClass}>{subtitle}</p>
            </div>
            <div className={childrenWrapClass}>{children}</div>
          </div>
        </motion.section>
      </div>
    </main>
  );
}
