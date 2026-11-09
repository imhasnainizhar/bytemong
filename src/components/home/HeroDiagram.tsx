"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";

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

const edges = [
  "M140 76 H200",
  "M320 76 H380",
  "M440 96 V130 Q440 180 330 180",
  "M190 180 Q80 180 80 268",
  "M260 200 V268",
  "M320 288 H380",
];

const order = ["src", "cmp", "bc", "int", "stk", "heap", "gc"];

export function HeroDiagram() {
  const [active, setActive] = useState(0);
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
      <div className="card animate-float overflow-hidden shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <div className="flex items-center gap-2 font-mono text-[11px] text-muted">
            <span className="h-2 w-2 rounded-full bg-emerald animate-pulse-soft" />
            wisp-vm · running fib(25)
          </div>
          <span className="font-mono text-[10px] text-faint">ops 1,214,409</span>
        </div>
        <svg viewBox="0 0 520 340" className="block w-full">
          <defs>
            <linearGradient id="edge-g" x1="0" x2="1">
              <stop stopColor="#4f8cff" stopOpacity=".6" />
              <stop offset="1" stopColor="#8b5cf6" stopOpacity=".6" />
            </linearGradient>
          </defs>
          {edges.map((d, i) => (
            <g key={i}>
              <path d={d} stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" fill="none" />
              <path d={d} stroke="url(#edge-g)" strokeWidth="1.5" fill="none" className="edge-flow" />
              <circle r="2.6" fill="#c4b5fd">
                <animateMotion dur={`${2 + (i % 3) * 0.6}s`} repeatCount="indefinite" path={d} begin={`${i * 0.3}s`} />
              </circle>
            </g>
          ))}
          {nodes.map((n) => {
            const on = order[active] === n.id;
            return (
              <g key={n.id}>
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
          <g transform="translate(345 180)">
            <circle r="9" fill="none" stroke="rgba(16,185,129,.25)" strokeWidth="1.5" />
            <path d="M0 -9 A9 9 0 0 1 9 0" stroke="#10b981" strokeWidth="1.8" fill="none" strokeLinecap="round">
              <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="1.4s" repeatCount="indefinite" />
            </path>
          </g>
        </svg>
      </div>
    </motion.div>
  );
}
