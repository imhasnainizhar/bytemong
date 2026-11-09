"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Maximize2 } from "lucide-react";
import { VmCanvas } from "../architecture/VmCanvas";

type N = { id: string; label: string; sub: string; x: number; y: number; w: number; color: string };

const nodes: N[] = [
  { id: "src", label: "fib.wisp", sub: "source", x: 20, y: 56, w: 120, color: "#8a8a96" },
  { id: "cmp", label: "Compiler", sub: "AST → ops", x: 200, y: 56, w: 120, color: "#8b5cf6" },
  { id: "bc", label: "Bytecode", sub: "Chunk", x: 380, y: 56, w: 120, color: "#22d3ee" },
  { id: "int", label: "Interpreter", sub: "dispatch loop", x: 190, y: 160, w: 140, color: "#10b981" },
  { id: "stk", label: "Value Stack", sub: "frames", x: 20, y: 268, w: 120, color: "#4f8cff" },
  { id: "heap", label: "Heap", sub: "objects", x: 200, y: 268, w: 120, color: "#ec4899" },
  { id: "gc", label: "GC", sub: "mark · sweep", x: 380, y: 268, w: 120, color: "#f59e0b" },
];

const edges: { d: string; from: string; to: string }[] = [
  { d: "M140 76 H200", from: "src", to: "cmp" },
  { d: "M320 76 H380", from: "cmp", to: "bc" },
  { d: "M440 96 V130 Q440 180 330 180", from: "bc", to: "int" },
  { d: "M190 180 Q80 180 80 268", from: "int", to: "stk" },
  { d: "M260 200 V268", from: "int", to: "heap" },
  { d: "M320 288 H380", from: "heap", to: "gc" },
];

const order = ["src", "cmp", "bc", "int", "stk", "heap", "gc"];

export function HeroDiagram() {
  const [active, setActive] = useState(0);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const touches = (e: (typeof edges)[number], id: string) => e.from === id || e.to === id;
  const isNeighbor = (id: string) => !!hover && edges.some((e) => touches(e, hover) && touches(e, id) && id !== hover);
  const nodeOpacity = (id: string) => (!hover || id === hover ? 1 : isNeighbor(id) ? 0.55 : 0.18);
  useEffect(() => {
    const t = setInterval(() => setActive((a) => (a + 1) % order.length), 1100);
    return () => clearInterval(t);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="relative"
    >
      <div className="absolute -inset-10 -z-10 rounded-full bg-[radial-gradient(closest-side,rgba(139,92,246,0.16),transparent)] blur-2xl" />
      <div
        role="button"
        tabIndex={0}
        aria-label="Open the interactive VM canvas"
        onClick={() => setCanvasOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setCanvasOpen(true);
          }
        }}
        className="card group relative cursor-pointer animate-float overflow-hidden shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] transition hover:border-violet/40 focus-visible:border-violet/60 focus-visible:outline-none"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <div className="flex items-center gap-2 font-mono text-[11px] text-muted">
            <span className="h-2 w-2 rounded-full bg-emerald animate-pulse-soft" />
            wisp-vm · running fib(25)
          </div>
          <span className="flex items-center gap-1.5 text-[11px] text-faint transition group-hover:text-ink">
            <span className="hidden font-mono sm:inline">open canvas</span>
            <Maximize2 className="h-3.5 w-3.5" />
          </span>
        </div>
        {/* Hover/focus hint */}
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center opacity-0 transition duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
          <span className="flex items-center gap-2 rounded-full border border-violet/40 bg-black/80 px-3.5 py-1.5 text-[12px] text-ink shadow-lg backdrop-blur-md">
            <Maximize2 className="h-3.5 w-3.5 text-violet-300" />
            Click to explore the full VM
          </span>
        </div>
        <svg viewBox="0 0 520 340" className="block w-full">
          <defs>
            <linearGradient id="edge-g" x1="0" x2="1">
              <stop stopColor="#4f8cff" stopOpacity=".6" />
              <stop offset="1" stopColor="#8b5cf6" stopOpacity=".6" />
            </linearGradient>
          </defs>
          {edges.map(({ d, from, to }, i) => (
            <g key={i} style={{ opacity: hover && from !== hover && to !== hover ? 0.08 : 1, transition: "opacity .25s" }}>
              <path d={d} stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" fill="none" />
              <path d={d} stroke="url(#edge-g)" strokeWidth="1.5" fill="none" className="edge-flow" />
              <circle r="2.6" fill="#c4b5fd">
                <animateMotion dur={`${2 + (i % 3) * 0.6}s`} repeatCount="indefinite" path={d} begin={`${i * 0.3}s`} />
              </circle>
            </g>
          ))}
          {nodes.map((n) => {
            const on = hover ? hover === n.id : order[active] === n.id;
            return (
              <g
                key={n.id}
                onMouseEnter={() => setHover(n.id)}
                onMouseLeave={() => setHover(null)}
                style={{ opacity: nodeOpacity(n.id), transition: "opacity .25s" }}
              >
                <motion.rect
                  x={n.x}
                  y={n.y}
                  width={n.w}
                  height={40}
                  rx={9}
                  fill={on ? `${n.color}26` : "rgba(255,255,255,0.025)"}
                  stroke={on ? n.color : "rgba(255,255,255,0.1)"}
                  strokeWidth={on ? 1.4 : 1}
                  animate={{ opacity: 1 }}
                  style={{ filter: on ? `drop-shadow(0 0 10px ${n.color}66)` : "none", transition: "all .4s" }}
                />
                <text x={n.x + n.w / 2} y={n.y + 18} textAnchor="middle" fill={on ? "#fff" : n.color} fontSize="11.5" fontWeight="600" style={{ transition: "fill .4s" }}>
                  {n.label}
                </text>
                <text x={n.x + n.w / 2} y={n.y + 31} textAnchor="middle" fill="#6b6b78" fontSize="9" fontFamily="var(--font-mono)">
                  {n.sub}
                </text>
              </g>
            );
          })}
          {/* the interpreter's spinning loop glyph */}
          <g transform="translate(345 180)" style={{ opacity: hover && hover !== "int" ? 0.18 : 1, transition: "opacity .25s" }}>
            <circle r="9" fill="none" stroke="rgba(16,185,129,.25)" strokeWidth="1.5" />
            <path d="M0 -9 A9 9 0 0 1 9 0" stroke="#10b981" strokeWidth="1.8" fill="none" strokeLinecap="round">
              <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="1.4s" repeatCount="indefinite" />
            </path>
          </g>
        </svg>
      </div>
      <VmCanvas open={canvasOpen} onClose={() => setCanvasOpen(false)} />
    </motion.div>
  );
}
