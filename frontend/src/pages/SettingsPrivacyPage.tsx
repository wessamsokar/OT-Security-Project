import { useState } from "react";

export function SettingsPrivacyPage() {
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [anonymizeLogs, setAnonymizeLogs] = useState(true);
  const [mfaRequired, setMfaRequired] = useState(false);

  return (
    <section className="rounded-3xl border border-white/10 bg-panel/45 p-6 shadow-panel">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.16em] text-brand">Settings Page</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Settings & Privacy</h1>
        <p className="mt-1 text-sm text-muted">Manage notification preferences, authentication controls, and privacy behavior.</p>
      </div>

      <div className="space-y-4">
        {[{
          label: "Email alerts for critical OT attacks",
          value: emailAlerts,
          setValue: setEmailAlerts
        }, {
          label: "Anonymize exported logs",
          value: anonymizeLogs,
          setValue: setAnonymizeLogs
        }, {
          label: "Require MFA for analyst accounts",
          value: mfaRequired,
          setValue: setMfaRequired
        }].map((item) => (
          <div key={item.label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
            <span className="text-sm text-white">{item.label}</span>
            <button
              type="button"
              onClick={() => item.setValue(!item.value)}
              className={[
                "relative inline-flex h-7 w-12 items-center rounded-full transition",
                item.value ? "bg-brand/70" : "bg-white/20"
              ].join(" ")}
            >
              <span
                className={[
                  "inline-block h-5 w-5 transform rounded-full bg-white transition",
                  item.value ? "translate-x-6" : "translate-x-1"
                ].join(" ")}
              />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
