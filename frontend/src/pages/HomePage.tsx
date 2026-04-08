import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";

import { Footer } from "../components/layout/Footer";
import { Navbar } from "../components/layout/Navbar";
import { Reveal } from "../components/motion/Reveal";
import { FeatureCard } from "../components/ui/FeatureCard";
import { SectionTitle } from "../components/ui/SectionTitle";
import { Button } from "../components/ui/Button";
import type { FeatureItem } from "../types/common";

const features: FeatureItem[] = [
  {
    icon: "shield",
    title: "Real-Time OT Attack Detection",
    description: "Continuously inspect network traffic from PLCs, RTUs, and SCADA assets to detect malicious activity in real time."
  },
  {
    icon: "radar",
    title: "Industrial Behavioral Baselines",
    description: "Build baseline behavior for OT protocols and flag deviations that indicate reconnaissance, misuse, or process tampering."
  },
  {
    icon: "lock",
    title: "Protocol-Aware Monitoring",
    description: "Analyze Modbus, DNP3, and IEC-104 metadata to uncover suspicious command patterns and unauthorized control attempts."
  },
  {
    icon: "activity",
    title: "ML Attack Classification",
    description: "Use supervised ML to classify detected events and prioritize response by attack class and operational impact."
  },
  {
    icon: "server",
    title: "Asset-Centric Visibility",
    description: "Map detections to industrial assets and zones so SOC and OT engineers can triage threats faster."
  },
  {
    icon: "lineChart",
    title: "Risk and Confidence Scoring",
    description: "Each detection includes risk score, confidence, and feature-level explanation to support reliable decision-making."
  }
];

const workflow = [
  "Ingest OT network telemetry from mirrored traffic, taps, or flow exporters.",
  "ML inference scores anomalies and predicts attack class in near real time.",
  "Analysts investigate alerts with protocol context, confidence, and explanation.",
  "Teams execute containment and recovery playbooks with minimal process disruption."
];

export function HomePage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-transparent text-text">
      <Navbar />

      <main className="pt-24">
        <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-section pt-20 md:grid-cols-2 md:px-8">
          <Reveal>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/15 px-3 py-1 text-xs uppercase tracking-[0.2em] text-brand">
              OT Security Platform
            </p>
            <h1 className="text-balance text-4xl font-semibold leading-tight text-white md:text-6xl">
              Detect OT network attacks in real time with AI-powered analytics.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted md:text-lg">
              OT Sentinel monitors industrial network traffic from connected devices and identifies malicious behavior using ML,
              helping your SOC respond before operational impact escalates.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link to="/register">
                <Button size="lg">
                  Start OT Monitoring <ArrowRight size={16} className="ml-1 inline" />
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="outline" size="lg">
                  View Detection Demo
                </Button>
              </Link>
            </div>
          </Reveal>

          <Reveal delay={0.12}>
            <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#101b3d]/70 to-[#0a1228]/58 p-7 shadow-panel">
              <p className="text-xs uppercase tracking-[0.18em] text-brand">Live OT Threat Snapshot</p>
              <div className="mt-6 space-y-4">
                {[
                  ["Critical OT alerts", "07"],
                  ["Detected attack events", "1,428"],
                  ["Mean detection latency", "2.1s"]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs text-muted">{label}</p>
                    <p className="mt-1 text-xl font-semibold text-white">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-4 pb-section md:px-8">
          <SectionTitle
            eyebrow="Product"
            title="Built for OT defenders and industrial SOC workflows"
            subtitle="From telemetry ingestion to explainable ML detections in one operationally aware command center."
          />
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {features.map((item, index) => (
              <FeatureCard key={item.title} item={item} delay={index * 0.06} />
            ))}
          </div>
        </section>

        <section id="workflow" className="mx-auto max-w-7xl px-4 pb-section md:px-8">
          <Reveal>
            <SectionTitle
              eyebrow="How It Works"
              title="From raw OT traffic to actionable incident response"
              subtitle="A streamlined detection pipeline optimized for industrial networks and process-critical environments."
            />
          </Reveal>
          <div className="grid gap-4 md:grid-cols-2">
            {workflow.map((step, idx) => (
              <Reveal key={step} delay={idx * 0.08}>
                <div className="rounded-2xl border border-white/10 bg-panel/40 p-5">
                  <p className="text-xs uppercase tracking-[0.15em] text-brand">Step {idx + 1}</p>
                  <p className="mt-3 text-sm leading-relaxed text-muted">{step}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section id="security" className="mx-auto max-w-7xl px-4 pb-section md:px-8">
          <Reveal>
            <div className="rounded-3xl border border-brand/20 bg-gradient-to-r from-[#111e44] to-[#0c1733] p-8 md:p-12">
              <SectionTitle
                eyebrow="Trust & Security"
                title="Defensive architecture for critical OT environments"
                subtitle="Strict monitoring-only design, secure access controls, and auditable workflows for operational safety."
              />
              <div className="mx-auto grid max-w-4xl gap-3 text-sm text-muted md:grid-cols-2">
                {["Role-based analyst access", "Protocol-level auditability", "Detection-only workflow", "High-availability monitoring stack"].map((item) => (
                  <div key={item} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
                    <CheckCircle2 size={16} className="text-brand" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-20 md:px-8">
          <Reveal>
            <div className="rounded-3xl border border-white/10 bg-[#0d1733]/72 px-6 py-10 text-center md:px-10">
              <h3 className="text-balance text-3xl font-semibold text-white/90">Ready to secure your OT network in real time?</h3>
              <p className="mx-auto mt-3 max-w-2xl text-sm text-muted/90 md:text-base">
                Move from delayed alerting to ML-driven, real-time OT attack detection across your connected industrial assets.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Link to="/register">
                  <Button size="lg">Create Account</Button>
                </Link>
                <Link to="/login">
                  <Button size="lg" variant="outline">
                    Sign In
                  </Button>
                </Link>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <Footer />
    </div>
  );
}
