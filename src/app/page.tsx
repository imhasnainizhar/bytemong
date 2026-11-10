import Link from "next/link";
import { ArrowRight, Boxes, Brain, FlaskConical, Hammer, MonitorPlay, Sparkles } from "lucide-react";
import { HeroDiagram } from "@/components/home/HeroDiagram";
import { RoadmapTimeline } from "@/components/home/RoadmapTimeline";
import { Reveal } from "@/components/Reveal";
import { lessons, roadmap } from "@/content";

const features = [
  {
    icon: MonitorPlay,
    color: "#4f8cff",
    title: "Live simulations",
    body: "Step the operand stack, trace a mark-sweep, watch fibers park. Every core idea has something you can interact with.",
  },
  {
    icon: Hammer,
    color: "#8b5cf6",
    title: "Build-along, not read-along",
    body: "One growing Rust codebase, built step by step: commented code, a walkthrough of how it works, and the output you should see.",
  },
  {
    icon: FlaskConical,
    color: "#10b981",
    title: "Grounded in the JVM",
    body: "Thirty years of HotSpot engineering, distilled. Each lesson starts from what the JVM does, then explains why.",
  },
  {
    icon: Brain,
    color: "#f59e0b",
    title: "Intuition, then depth",
    body: "Questions are answered twice: a mental model you can hold onto, and the precise technical mechanism behind it.",
  },
  {
    icon: Boxes,
    color: "#ec4899",
    title: "No classes required",
    body: "Wisp is a small prototype-and-closure language. You'll learn how dynamic objects get JVM-like speed through shapes and inline caches.",
  },
  {
    icon: Sparkles,
    color: "#22d3ee",
    title: "Modern techniques",
    body: "NaN-boxing, quickening, tri-color GC, fibers and safepoints. The ideas behind V8, LuaJIT and Loom, made approachable.",
  },
];

// Every call-to-action button shares one fixed width so pairs line up exactly.
const btnBase = "inline-flex w-[220px] items-center justify-center gap-2 rounded-lg border border-transparent px-5 py-2.5 text-[14px] font-medium transition";
const btnPrimary = "bg-gradient-to-r from-blue to-violet text-white shadow-[0_8px_30px_-8px_rgba(124,92,255,0.7)] hover:brightness-110";
const btnGhost = "!border-line bg-white/[0.03] text-ink hover:border-line-strong hover:bg-white/[0.06]";

export default function Home() {
  return (
    <>
      {/* HERO */}
      <section className="relative mx-auto flex max-w-5xl flex-col items-center px-4 pb-24 pt-32 text-center sm:px-6 lg:pt-40">
        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white/[0.03] px-3 py-1 text-[12px] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-violet animate-pulse-soft" />
            JVM lessons · build your own VM
          </span>
        </Reveal>
        <Reveal delay={0.05}>
          <h1 className="mt-6 font-bold tracking-tight">
            <span className="block text-[clamp(2.4rem,6vw,4rem)] leading-[1.05]">Build a VM.</span>
            <span className="mt-2 block text-[clamp(1.35rem,3.2vw,2.1rem)] font-semibold leading-tight text-[#c9c9d3]">
              Understand the <span className="text-gradient">JVM</span>.
            </span>
          </h1>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mx-auto mt-5 max-w-xl text-[15px] font-light leading-relaxed text-muted">
            Learn from one of the best-studied runtimes ever built, then use those lessons to build a modern bytecode VM for a small scripting
            language, one interactive stop at a time.
          </p>
        </Reveal>
        {/* HeroDiagram animates itself in; a Reveal wrapper would shrink it to content width. */}
        <div className="mt-10 w-full max-w-2xl text-left">
          <HeroDiagram />
        </div>
        <div>
          <Reveal delay={0.2}>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Link href="/architecture" className={`group ${btnBase} ${btnPrimary}`}>
                Explore Architecture
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <a href="#roadmap" className={`${btnBase} ${btnGhost}`}>
                View Roadmap
              </a>
            </div>
          </Reveal>
          <Reveal delay={0.25}>
            <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[12.5px] text-faint">
              <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald" />{roadmap.length} roadmap stops</span>
              <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-blue" />{lessons.filter((l) => l.sim !== "flow").length} live simulations</span>
              <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-violet" />{lessons.reduce((n, l) => n + l.questions.length, 0)} guided questions</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* WHY */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <Reveal>
          <p className="text-center font-mono text-[12px] uppercase tracking-[0.2em] text-violet">Why this exists</p>
          <h2 className="mt-3 text-center text-3xl font-bold tracking-tight sm:text-4xl">Understand it by building it</h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-muted">
            Reading about a garbage collector is one thing. Finding the root you forgot is another. Every page pairs the JVM&apos;s design with
            the steps to build the same piece yourself.
          </p>
        </Reveal>
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.05}>
              <div className="card card-hover h-full p-6">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-lg border"
                  style={{ borderColor: `${f.color}40`, background: `${f.color}12`, color: f.color }}
                >
                  <f.icon className="h-[18px] w-[18px]" />
                </span>
                <h3 className="mt-5 font-semibold text-ink">{f.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-muted">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ROADMAP */}
      <section id="roadmap" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6">
        <Reveal>
          <p className="text-center font-mono text-[12px] uppercase tracking-[0.2em] text-blue">Learning path</p>
          <h2 className="mt-3 text-center text-3xl font-bold tracking-tight sm:text-4xl">The VM builder&apos;s roadmap</h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-muted">
            Start with how code runs and finish with a VM you can profile, tune and extend. Each stop builds on the one before.
          </p>
        </Reveal>
        <div className="mt-16">
          <RoadmapTimeline items={roadmap} />
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-4 pt-10 sm:px-6">
        <Reveal>
          <div className="card relative overflow-hidden px-6 py-14 text-center">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(40rem_16rem_at_50%_0%,rgba(124,92,255,0.18),transparent)]" />
            <h2 className="relative text-3xl font-bold tracking-tight">Ready to write your first opcode?</h2>
            <p className="relative mx-auto mt-3 max-w-xl text-muted">
              Start with the big picture, then go stop by stop. Your VM will grow alongside your understanding.
            </p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/learn/how-code-runs" className={`group ${btnBase} ${btnPrimary}`}>
                Start Learning <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <Link href="/learn/bytecode" className={`${btnBase} ${btnGhost}`}>
                Bytecode Playground
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
