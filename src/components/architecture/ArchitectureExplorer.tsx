"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import { ArrowRight, Coffee, Cpu, Hammer, MousePointerClick } from "lucide-react";
import { archEdges, archNodes, NODE_H, NODE_W, type ArchNode } from "@/content/architecture";
import { accentHex } from "@/content";
import { CodeBlock } from "../CodeBlock";

const byId = Object.fromEntries(archNodes.map((n) => [n.id, n]));

function edgePath(a: ArchNode, b: ArchNode) {
  if (Math.abs(a.y - b.y) < 4) {
    const dir = b.x > a.x ? 1 : -1;
    const x1 = a.x + (dir * NODE_W) / 2;
    const x2 = b.x - (dir * NODE_W) / 2;
    return `M${x1} ${a.y} L${x2} ${b.y}`;
  }
  const down = b.y > a.y;
  const y1 = a.y + ((down ? 1 : -1) * NODE_H) / 2;
  const y2 = b.y - ((down ? 1 : -1) * NODE_H) / 2;
  const my = (y1 + y2) / 2;
  return `M${a.x} ${y1} C${a.x} ${my}, ${b.x} ${my}, ${b.x} ${y2}`;
}

export function ArchitectureExplorer() {
  const [selected, setSelectedState] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // When the panel is stacked under the graph, bring it into view on selection.
  const setSelected = (id: string | null) => {
    setSelectedState(id);
    if (id && window.innerWidth < 1280) {
      requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };
  const [hover, setHover] = useState<string | null>(null);
  const focus = hover ?? selected;
  const node = selected ? byId[selected] : null;

  const connected = (id: string) => !focus || id === focus || archEdges.some(([a, b]) => (a === focus && b === id) || (b === focus && a === id));

  return (
    <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
      {/* Graph */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <div className="flex items-center gap-2 font-mono text-[12px] text-muted">
            <span className="h-2 w-2 rounded-full bg-emerald animate-pulse-soft" />
            Wisp VM pipeline
          </div>
          <span className="flex items-center gap-1.5 text-[11px] text-faint">
            <MousePointerClick className="h-3.5 w-3.5" /> click a node
          </span>
        </div>
        <div className="overflow-x-auto">
          <svg viewBox="0 0 760 600" className="block w-full min-w-[560px]">
            <defs>
              <pattern id="arch-dots" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="0.8" fill="rgba(255,255,255,0.06)" />
              </pattern>
            </defs>
            <rect width="760" height="600" fill="url(#arch-dots)" />
            {/* group bands */}
            <rect x="14" y="326" width="732" height="70" rx="12" fill="rgba(79,140,255,0.025)" stroke="rgba(79,140,255,0.12)" strokeDasharray="4 4" />
            <text x="24" y="320" fontSize="9" fill="#55555f" fontFamily="var(--font-mono)" letterSpacing="1">
              RUNTIME DATA AREAS
            </text>

            {archEdges.map(([from, to], i) => {
              const a = byId[from], b = byId[to];
              const d = edgePath(a, b);
              const on = focus ? from === focus || to === focus : false;
              const dim = focus && !on;
              const c = accentHex[a.accent];
              return (
                <g key={i} style={{ opacity: dim ? 0.12 : 1, transition: "opacity .3s" }}>
                  <path d={d} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1.5" />
                  <path d={d} fill="none" stroke={c} strokeOpacity={on ? 0.95 : 0.45} strokeWidth={on ? 1.8 : 1.3} className="edge-flow" />
                  <circle r={on ? 3 : 2.2} fill={c}>
                    <animateMotion dur={`${2.2 + (i % 4) * 0.4}s`} repeatCount="indefinite" path={d} begin={`${(i * 0.37) % 2}s`} />
                  </circle>
                </g>
              );
            })}

            {archNodes.map((n) => {
              const c = accentHex[n.accent];
              const isSel = selected === n.id;
              const lit = connected(n.id);
              return (
                <g
                  key={n.id}
                  onClick={() => setSelected(isSel ? null : n.id)}
                  onMouseEnter={() => setHover(n.id)}
                  onMouseLeave={() => setHover(null)}
                  style={{ cursor: "pointer", opacity: lit ? 1 : 0.3, transition: "opacity .3s" }}
                  role="button"
                  tabIndex={0}
                  aria-label={n.label}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setSelected(isSel ? null : n.id);
                  }}
                >
                  {isSel && (
                    <rect x={n.x - NODE_W / 2 - 5} y={n.y - NODE_H / 2 - 5} width={NODE_W + 10} height={NODE_H + 10} rx="13" fill="none" stroke={c} strokeOpacity=".5" className="animate-pulse-soft" />
                  )}
                  <rect
                    x={n.x - NODE_W / 2}
                    y={n.y - NODE_H / 2}
                    width={NODE_W}
                    height={NODE_H}
                    rx="10"
                    fill={isSel ? `${c}2a` : `${c}12`}
                    stroke={isSel || hover === n.id ? c : `${c}66`}
                    strokeWidth={isSel ? 1.6 : 1}
                    style={{ filter: isSel ? `drop-shadow(0 0 12px ${c}88)` : "none", transition: "all .25s" }}
                  />
                  <circle cx={n.x - NODE_W / 2} cy={n.y} r="2.5" fill={c} />
                  <circle cx={n.x + NODE_W / 2} cy={n.y} r="2.5" fill={c} />
                  <text x={n.x} y={n.y - 2} textAnchor="middle" fontSize="12" fontWeight="600" fill={isSel ? "#fff" : c}>
                    {n.label}
                  </text>
                  <text x={n.x} y={n.y + 12} textAnchor="middle" fontSize="8.8" fill="#6b6b78" fontFamily="var(--font-mono)">
                    {n.sub}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Detail panel */}
      <div ref={panelRef} className="card flex min-h-[520px] scroll-mt-24 flex-col overflow-hidden xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)]">
        <AnimatePresence mode="wait">
          {node ? (
            <motion.div key={node.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }} className="flex-1 overflow-y-auto p-5">
              <div className="flex items-center gap-2">
                <span className="rounded-md border px-2 py-0.5 text-[10.5px]" style={{ borderColor: `${accentHex[node.accent]}50`, color: accentHex[node.accent] }}>
                  {node.group}
                </span>
                <span className="font-mono text-[10.5px] text-faint">JVM ≈ {node.jvm}</span>
              </div>
              <h3 className="mt-3 text-xl font-semibold text-ink">{node.label}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-[#b0b0ba]">{node.role}</p>

              <div className="mt-5 rounded-lg border border-amber/20 bg-amber/[0.04] p-3.5">
                <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-amber">
                  <Coffee className="h-3.5 w-3.5" /> From the JVM
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{node.jvmLesson}</p>
              </div>

              <div className="mt-5">
                <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-emerald">
                  <Hammer className="h-3.5 w-3.5" /> Build your own
                </div>
                <ol className="mt-2.5 space-y-2">
                  {node.build.map((b, i) => (
                    <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-[#b0b0ba]">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-emerald/40 font-mono text-[9px] text-emerald">{i + 1}</span>
                      {b}
                    </li>
                  ))}
                </ol>
              </div>
              {node.code && (
                <div className="mt-4">
                  <CodeBlock code={node.code.code} lang={node.code.lang} />
                </div>
              )}
              {node.lesson && (
                <Link href={`/learn/${node.lesson}`} className="mt-5 inline-flex items-center gap-1.5 text-[13px] text-violet-300 transition hover:text-violet-200">
                  Go deeper in the lesson <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-1 flex-col">
              <div className="flex flex-col items-center px-6 pb-6 pt-10 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-blue/30 bg-blue/10 text-blue">
                  <Cpu className="h-5 w-5" />
                </span>
                <p className="mt-4 text-[14px] text-muted">Click any node in the diagram</p>
                <p className="mt-1 text-[12px] text-faint">You&apos;ll see its JVM counterpart and how to build it</p>
              </div>
              <div className="border-t border-line px-5 py-4">
                <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-faint">Components</div>
                <div className="grid gap-1">
                  {archNodes.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => setSelected(n.id)}
                      onMouseEnter={() => setHover(n.id)}
                      onMouseLeave={() => setHover(null)}
                      className="flex items-center gap-3 rounded-md px-2 py-1.5 text-left text-[13px] text-muted transition hover:bg-white/[0.03] hover:text-ink"
                    >
                      <span className="h-2 w-2 rounded-full" style={{ background: accentHex[n.accent] }} />
                      {n.label}
                      <span className="ml-auto truncate font-mono text-[10px] text-faint">{n.jvm}</span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {node && (
          <button onClick={() => setSelected(null)} className="border-t border-line px-5 py-2.5 text-left text-[12px] text-faint transition hover:text-ink">
            ← All components
          </button>
        )}
      </div>
    </div>
  );
}
