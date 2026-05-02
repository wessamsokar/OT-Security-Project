import { LiveThreatSnapshot } from "../components/LiveThreatSnapshot";
import { AmbientSecurityBackground } from "../components/layout/AmbientSecurityBackground";
import { Navbar } from "../components/layout/Navbar";

export function LiveSnapshotPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-transparent text-text">
      <Navbar />
      <AmbientSecurityBackground intensity={0.7} speed={0.85} />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-28 md:px-8">
        <LiveThreatSnapshot />
      </main>
    </div>
  );
}
