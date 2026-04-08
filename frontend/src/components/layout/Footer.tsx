import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#090f22]/72">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-3 md:px-8">
        <div>
          <Logo />
          <p className="mt-4 max-w-sm text-sm text-muted/90">
            OT and ICS threat detection platform for continuous monitoring of industrial devices over network traffic.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-text/90">Product</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted/90">
            <li>Real-time OT Detection</li>
            <li>ML Attack Classification</li>
            <li>Anomaly Risk Scoring</li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-text/90">Operations</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted/90">
            <li>Substations</li>
            <li>SCADA Networks</li>
            <li>Plant SOC Teams</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-muted/85">
        2026 OT Sentinel AI. All rights reserved.
      </div>
    </footer>
  );
}
