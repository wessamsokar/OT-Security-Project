import { useEffect, useRef, useState } from "react";

import DarkVeil from "../components/DarkVeil";
import { ErrorBoundary } from "../components/ErrorBoundary";

import { AppRouter } from "./Router";

export function App() {
  const [securityWarning, setSecurityWarning] = useState("");
  const renderCountRef = useRef(0);

  renderCountRef.current += 1;
  console.debug(`[app] App render ${renderCountRef.current}`);

  useEffect(() => {
    console.info("[app] App mounted");
    const warning = sessionStorage.getItem("ot_runtime_security_warning") ?? "";
    if (warning) {
      setSecurityWarning(warning);
      sessionStorage.removeItem("ot_runtime_security_warning");
    }
    return () => {
      console.info("[app] App unmounted");
    };
  }, []);

  return (
    <div style={{ position: "relative", minHeight: "100vh", isolation: "isolate" }}>
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 0,
          pointerEvents: "none"
        }}
      >
        <DarkVeil hueShift={0} noiseIntensity={0} scanlineIntensity={0} speed={1.5} />
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>
        {securityWarning ? (
          <div className="fixed left-1/2 top-20 z-[60] w-[min(92vw,42rem)] -translate-x-1/2 rounded-2xl border border-amber-400/40 bg-amber-950/90 px-4 py-3 text-sm text-amber-100 shadow-panel backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <p>{securityWarning}</p>
              <button
                type="button"
                className="text-amber-200 transition hover:text-white"
                onClick={() => setSecurityWarning("")}
                aria-label="Dismiss security warning"
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}
        <ErrorBoundary>
          <AppRouter />
        </ErrorBoundary>
      </div>
    </div>
  );
}
