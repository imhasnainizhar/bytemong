import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Coffee, Cpu, Hammer } from "lucide-react";
import { ArchitectureExplorer } from "@/components/architecture/ArchitectureExplorer";
import { Reveal } from "@/components/Reveal";
import { archNodes } from "@/content/architecture";
import { accentHex } from "@/content";

export const metadata: Metadata = {
  title: "VM Architecture",
  description: "An interactive map of a modern bytecode VM. Each component shows its JVM counterpart and how to build it yourself.",
};

const groups = ["Front end", "Loading", "Runtime data", "Execution", "Memory management", "Native"] as const;

export default function ArchitecturePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-28 sm:px-6 lg:pt-32">
      <Reveal>
        <Link href="/#roadmap" className="inline-flex items-center gap-1.5 text-[12.5px] text-faint transition hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Roadmap
        </Link>
        <div className="mt-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white/[0.03] px-3 py-1 text-[12px] text-muted">
            <Cpu className="h-3.5 w-3.5 text-blue" /> Stop 01 · VM internals
          </span>
        </div>
        <h1 className="mt-5 text-[clamp(2.2rem,5vw,3.6rem)] font-bold tracking-tight">
          VM <span className="text-gradient">Architecture</span>
        </h1>
        <p className="mt-4 max-w-3xl text-[16.5px] leading-relaxed text-muted">
          This is the whole machine on one page. Each node is a part of the Wisp VM, mapped to the JVM subsystem it&apos;s modelled on. Click one to see what it does, what the JVM
          teaches about it, and how to build your own version.
        </p>
      </Reveal>

      <Reveal delay={0.05} className="mt-10">
        <ArchitectureExplorer />
      </Reveal>

      {/* Every component, side by side: JVM vs your VM */}
      <section className="mt-24">
        <Reveal>
          <p className="font-mono text-[12px] uppercase tracking-[0.2em] text-violet">All components</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">From the JVM to your VM</h2>
          <p className="mt-3 max-w-2xl text-muted">For each part: what the JVM does, and a short build plan for the version in your own VM.</p>
        </Reveal>

        <div className="mt-10 space-y-12">
          {groups.map((g) => {
            const items = archNodes.filter((n) => n.group === g);
            return (
              <div key={g}>
                <Reveal>
                  <h3 className="mb-4 flex items-center gap-3 text-[13px] font-medium uppercase tracking-[0.14em] text-faint">
                    {g}
                    <span className="h-px flex-1 bg-line" />
                  </h3>
                </Reveal>
                <div className="grid gap-4 lg:grid-cols-2">
                  {items.map((n, i) => {
                    const c = accentHex[n.accent];
                    return (
                      <Reveal key={n.id} delay={i * 0.05}>
                        <div className="card card-hover h-full p-5">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-lg border font-mono text-[13px] font-semibold" style={{ borderColor: `${c}40`, background: `${c}12`, color: c }}>
                              {n.label[0]}
                            </span>
                            <div>
                              <div className="font-semibold text-ink">{n.label}</div>
                              <div className="font-mono text-[10.5px] text-faint">JVM ≈ {n.jvm}</div>
                            </div>
                          </div>
                          <p className="mt-3 text-[13.5px] leading-relaxed text-muted">{n.role}</p>
                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-lg border border-line bg-black/30 p-3">
                              <div className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wider text-amber">
                                <Coffee className="h-3 w-3" /> In the JVM
                              </div>
                              <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#9a9aa6]">{n.jvmLesson}</p>
                            </div>
                            <div className="rounded-lg border border-line bg-black/30 p-3">
                              <div className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wider text-emerald">
                                <Hammer className="h-3 w-3" /> In your VM
                              </div>
                              <ul className="mt-1.5 space-y-1">
                                {n.build.map((b, k) => (
                                  <li key={k} className="flex gap-2 text-[12.5px] leading-relaxed text-[#9a9aa6]">
                                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-emerald" />
                                    {b}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                          {n.lesson && (
                            <Link href={`/learn/${n.lesson}`} className="mt-4 inline-flex items-center gap-1 text-[12.5px] text-faint transition hover:text-violet-300">
                              Related lesson <ArrowRight className="h-3 w-3" />
                            </Link>
                          )}
                        </div>
                      </Reveal>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <Reveal className="mt-20">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-white/[0.02] p-5">
          <div>
            <div className="text-[11.5px] text-faint">Next stop · 02</div>
            <div className="font-semibold text-ink">Lexing, Parsing & ASTs</div>
          </div>
          <Link href="/learn/front-end" className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue to-violet px-4 py-2 text-[13px] font-medium text-white transition hover:brightness-110">
            Continue <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Reveal>
    </div>
  );
}
