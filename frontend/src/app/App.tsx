import DarkVeil from "../components/DarkVeil";

import { AppRouter } from "./Router";

export function App() {
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
        <AppRouter />
      </div>
    </div>
  );
}
