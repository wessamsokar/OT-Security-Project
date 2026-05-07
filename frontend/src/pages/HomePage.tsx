import { ArrowRight, CheckCircle2 } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";

import { LiveThreatSnapshot } from "../components/LiveThreatSnapshot";
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
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-transparent text-text">
      <Navbar />

      <main className="pt-24">
        <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-section pt-20 md:grid-cols-2 md:px-8">
          <Reveal>
            <motion.p
              className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/15 px-3 py-1 text-xs uppercase tracking-[0.2em] text-brand"
              animate={reduceMotion ? undefined : { boxShadow: ["0 0 0 rgba(56,189,248,0)", "0 0 18px rgba(56,189,248,0.25)", "0 0 0 rgba(56,189,248,0)"] }}
              whileHover={reduceMotion ? undefined : { scale: 1.03, textShadow: "0 0 12px rgba(168,85,247,0.8)" }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
            >
              OT Security Platform
            </motion.p>
            <motion.h1
              className="text-balance text-4xl font-semibold leading-tight text-white md:text-6xl"
              initial={reduceMotion ? undefined : { opacity: 0, y: 16 }}
              animate={
                reduceMotion
                  ? undefined
                  : {
                      opacity: 1,
                      y: [0, -2, 0],
                      textShadow: [
                        "0 0 0 rgba(168,85,247,0)",
                        "0 0 18px rgba(168,85,247,0.38)",
                        "0 0 0 rgba(168,85,247,0)"
                      ]
                    }
              }
              transition={
                reduceMotion
                  ? undefined
                  : {
                      opacity: { duration: 0.6, ease: "easeOut" },
                      y: { duration: 4.2, repeat: Infinity, ease: "easeInOut" },
                      textShadow: { duration: 3.4, repeat: Infinity, ease: "easeInOut" }
                    }
              }
              whileHover={reduceMotion ? undefined : { scale: 1.01, textShadow: "0 0 14px rgba(168,85,247,0.6)" }}
            >
              Detect OT network attacks in real time with AI-powered analytics.
            </motion.h1>
            <motion.p
              className="mt-6 max-w-xl text-base leading-relaxed text-muted md:text-lg"
              initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
              animate={
                reduceMotion
                  ? undefined
                  : {
                      opacity: 1,
                      y: [0, 2, 0],
                      color: ["rgb(156 163 175)", "rgb(209 213 219)", "rgb(156 163 175)"]
                    }
              }
              transition={
                reduceMotion
                  ? undefined
                  : {
                      opacity: { duration: 0.7, delay: 0.08, ease: "easeOut" },
                      y: { duration: 4.8, repeat: Infinity, ease: "easeInOut" },
                      color: { duration: 3.8, repeat: Infinity, ease: "easeInOut" }
                    }
              }
              whileHover={reduceMotion ? undefined : { scale: 1.01, color: "rgb(229 231 235)" }}
            >
              OT Sentinel monitors industrial network traffic from connected devices and identifies malicious behavior using ML,
              helping your SOC respond before operational impact escalates.
            </motion.p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link to="/register">
                <Button size="lg">
                  Start OT Monitoring <ArrowRight size={16} className="ml-1 inline" />
                </Button>
              </Link>
              <Link to="/live-threats">
                <Button variant="outline" size="lg">
                  View Live Snapshot
                </Button>
              </Link>
            </div>
          </Reveal>

          <Reveal delay={0.12}>
            <LiveThreatSnapshot variant="compact" />
          </Reveal>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-4 pb-section md:px-8">
          <motion.div
            animate={reduceMotion ? undefined : { opacity: [0.85, 1, 0.85] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            whileHover={reduceMotion ? undefined : { scale: 1.01, textShadow: "0 0 12px rgba(168,85,247,0.75)" }}
          >
            <SectionTitle
              eyebrow="Product"
              title="Built for OT defenders and industrial SOC workflows"
              subtitle="From telemetry ingestion to explainable ML detections in one operationally aware command center."
            />
          </motion.div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {features.map((item, index) => (
              <FeatureCard key={item.title} item={item} delay={index * 0.06} />
            ))}
          </div>
        </section>

        <section id="workflow" className="mx-auto max-w-7xl px-4 pb-section md:px-8">
          <Reveal>
            <motion.div
              animate={reduceMotion ? undefined : { opacity: [0.88, 1, 0.88] }}
              transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
              whileHover={reduceMotion ? undefined : { scale: 1.01, textShadow: "0 0 12px rgba(168,85,247,0.75)" }}
            >
              <SectionTitle
                eyebrow="How It Works"
                title="From raw OT traffic to actionable incident response"
                subtitle="A streamlined detection pipeline optimized for industrial networks and process-critical environments."
              />
            </motion.div>
          </Reveal>
          <div className="grid gap-4 md:grid-cols-2">
            {workflow.map((step, idx) => (
              <Reveal key={step} delay={idx * 0.08}>
                <div className="rounded-2xl border border-white/10 bg-panel/40 p-5">
                  <motion.p
                    className="text-xs uppercase tracking-[0.15em] text-brand"
                    animate={reduceMotion ? undefined : { opacity: [0.72, 1, 0.72] }}
                    whileHover={reduceMotion ? undefined : { textShadow: "0 0 12px rgba(168,85,247,0.8)", scale: 1.03 }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: idx * 0.1 }}
                  >
                    Step {idx + 1}
                  </motion.p>
                  <p className="mt-3 text-sm leading-relaxed text-muted">{step}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section id="security" className="mx-auto max-w-7xl px-4 pb-section md:px-8">
          <Reveal>
            <div className="rounded-3xl border border-brand/20 bg-gradient-to-r from-[#111e44] to-[#0c1733] p-8 md:p-12">
              <motion.div
                animate={reduceMotion ? undefined : { opacity: [0.88, 1, 0.88] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                whileHover={reduceMotion ? undefined : { scale: 1.01, textShadow: "0 0 12px rgba(168,85,247,0.75)" }}
              >
                <SectionTitle
                  eyebrow="Trust & Security"
                  title="Defensive architecture for critical OT environments"
                  subtitle="Strict monitoring-only design, secure access controls, and auditable workflows for operational safety."
                />
              </motion.div>
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
